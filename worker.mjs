const privateHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers:privateHeaders});
const fail = (error,status=400) => json({error},status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const teams = ['production','onevoicefm','shotit','academy','summit'];
const fields = ['team','service','name','email','phone','organisation','date','location','budget','message','method'];
const digest = s => crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));

async function readJson(request,max) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error('Use JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Missing request.');
  const chunks = []; let size = 0;
  for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size>max) { await reader.cancel(); throw Error('Request is too large.'); }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}

export default {async fetch(request,env) {
  const url = new URL(request.url), path = url.pathname;
  const store = env.STUDIO.get(env.STUDIO.idFromName('production'));
  const portal = 'https://harkynb-admin.justsamuelpaul.workers.dev';
  if (['GET','HEAD'].includes(request.method)) {
    const destination = new Map([
      ['/admin','/admin/'], ['/admin/','/admin/'], ['/team','/team'],
      ['/signup','/signup'], ['/login','/login'], ['/staff/setup','/signup'], ['/staff/setup/','/signup']
    ]).get(path);
    if (destination) return new Response(null,{status:302,headers:{...privateHeaders,Location:portal+destination+'#','Referrer-Policy':'no-referrer'}});
  }
  if (path==='/admin' || path.startsWith('/admin/') || path.startsWith('/staff/')) return fail('Use the staff portal.',410);
  if (path==='/api/enquiries' && request.method==='POST') {
    if (request.headers.get('origin')!==url.origin) return fail('Invalid origin.',403);
    let d; try {d=await readJson(request,18000);} catch {return fail('Invalid submission.');}
    if (!d || !uuid.test(d.requestId)) return fail('Invalid submission.');
    const entry = {};
    for (const k of fields) {
      if (typeof d[k]!=='string' || d[k].length>(k==='message'?5000:200)) return fail('Check the form fields.');
      entry[k]=d[k].trim();
    }
    if (!teams.includes(entry.team)||!entry.name||entry.message.length<10||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) return fail('Check your name, email, team and message.');
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const bucket = Array.from(new Uint8Array(await digest(ip+'|'+Math.floor(Date.now()/600000)))).join('.');
    const saved = await store.submit(d.requestId,entry,bucket);
    return saved ? json({saved:true},201) : fail('Please try again in ten minutes.',429);
  }
  if (path.startsWith('/media/') && uuid.test(path.slice(7)) && request.method==='GET') {
    const image = await store.photo(path.slice(7));
    return image ? new Response(image.bytes,{headers:{'Content-Type':image.mime,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}}) : fail('Unknown image.',404);
  }
  const res = await env.ASSETS.fetch(request);
  if (request.method!=='GET' || res.status!==200 || !res.headers.get('content-type')?.includes('text/html')) return res;
  const page = path.replace(/index\.html$/,'').replace(/\/?$/,'/');
  const {current} = await store.page(page);
  const rewrite = new HTMLRewriter()
    .on('[data-copy]',{element(el){const value=current.text[el.getAttribute('data-copy')]; if(typeof value==='string') el.setInnerContent(value);}})
    .on('[data-feature]',{element(el){if(current.images.feature) el.removeAttribute('hidden');}})
    .on('[data-picture]',{element(el){const img=current.images[el.getAttribute('data-picture')]; if(img){el.setAttribute('src','/media/'+img.id);el.setAttribute('alt',img.alt);}}});
  const output = rewrite.transform(res);
  const headers = new Headers(output.headers);
  headers.delete('etag'); headers.delete('last-modified'); headers.set('cache-control','no-store');
  return new Response(output.body,{headers});
}};

import {DurableObject} from 'cloudflare:workers';
export class Studio extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS credentials(name TEXT PRIMARY KEY,version TEXT,salt TEXT,hash TEXT); CREATE TABLE IF NOT EXISTS used_invites(version TEXT PRIMARY KEY)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pages(path TEXT PRIMARY KEY,revision INTEGER,current TEXT,previous TEXT); CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,mime TEXT,bytes BLOB); CREATE TABLE IF NOT EXISTS enquiries(id TEXT UNIQUE,created TEXT,entry TEXT,status TEXT); CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)');
  }
  credential(name,version) {
    return this.sql.exec('SELECT salt,hash FROM credentials WHERE name=? AND version=?',name,version).toArray()[0] || null;
  }
  activate(name,version,salt,hash) {
    return this.ctx.storage.transactionSync(()=>{
      if (this.sql.exec('SELECT 1 FROM used_invites WHERE version=?',version).toArray().length) return false;
      this.sql.exec('INSERT INTO used_invites VALUES(?)',version);
      this.sql.exec('INSERT OR REPLACE INTO credentials VALUES(?,?,?,?)',name,version,salt,hash);
      return true;
    });
  }
  reserveAuth(bucket) {
    this.sql.exec('DELETE FROM limits WHERE expires<=?',Date.now());
    const n=this.sql.exec('SELECT n FROM limits WHERE bucket=?',bucket).toArray()[0]?.n || 0;
    if(n>=15)return false;
    this.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?)',bucket,n+1,Date.now()+600000);
    return true;
  }
  releaseAuth(bucket){this.sql.exec('UPDATE limits SET n=MAX(0,n-1) WHERE bucket=?',bucket);}
  page(path) {
    const row = this.sql.exec('SELECT * FROM pages WHERE path=?',path).toArray()[0];
    const current = row ? JSON.parse(row.current) : {text:{},images:{}};
    current.was ||= {};
    return {revision:row?.revision || 0,current,canRestore:!!row?.previous};
  }
  // Saved edits whose field no longer exists on the built page, counted per page.
  // Field keys come from the page's built-in wording, so a code change to that wording disconnects staff edits.
  orphans(manifest) {
    const out = {};
    for (const row of this.sql.exec('SELECT path,current FROM pages').toArray()) {
      const def = manifest[row.path]; if (!def) continue;
      const c = JSON.parse(row.current);
      const n = Object.keys(c.text).filter(k=>!Object.hasOwn(def.fields,k)).length + Object.keys(c.images).filter(k=>!Object.hasOwn(def.photos,k)).length;
      if (n) out[row.path] = n;
    }
    return out;
  }
  publish(path,schema,d) {
    const state = this.page(path);
    if (d?.revision!==state.revision) return {status:409,error:'This page changed. Reload it before publishing.'};
    const previous=JSON.stringify(state.current), next=state.current;
    let upload;
    if (d.restore) {
      const row=this.sql.exec('SELECT previous FROM pages WHERE path=?',path).toArray()[0];
      if (!row?.previous) return {status:400,error:'No previous version.'};
      const prior=JSON.parse(row.previous);
      next.text=prior.text; next.images=prior.images; next.was=prior.was || {};
    } else if (d.relink && typeof d.relink.from==='string') {
      const {from,to}=d.relink;
      const kind=Object.hasOwn(next.text,from) && !Object.hasOwn(schema.fields,from) ? 'text'
        : Object.hasOwn(next.images,from) && !Object.hasOwn(schema.photos,from) ? 'images' : null;
      if (!kind) return {status:400,error:'That edit is already connected to the page.'};
      if (to!==null) {
        const targets=kind==='text' ? schema.fields : schema.photos;
        if (typeof to!=='string' || !Object.hasOwn(targets,to)) return {status:400,error:'Choose where this edit belongs.'};
        next[kind][to]=next[kind][from];
        if (kind==='text') next.was[to]=targets[to].value;
      }
      delete next[kind][from]; delete next.was[from];
    } else if (Object.hasOwn(schema.fields,d.key) && typeof d.value==='string' && d.value.trim() && d.value.length<=5000) {
      if (d.value===schema.fields[d.key].value) {delete next.text[d.key]; delete next.was[d.key];}
      else {next.text[d.key]=d.value.trim(); next.was[d.key]=schema.fields[d.key].value;}
    } else if (Object.hasOwn(schema.photos,d.key) && typeof d.image==='string' && typeof d.alt==='string' && d.alt.trim() && d.alt.length<=300) {
      let bytes;
      try {bytes=Uint8Array.from(atob(d.image),c=>c.charCodeAt(0));} catch {return {status:400,error:'Invalid image.'};}
      const jpg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
      if (!jpg || bytes.length>900000) return {status:400,error:'Choose a smaller JPEG image.'};
      const id=crypto.randomUUID(); upload={id,bytes}; next.images[d.key]={id,alt:d.alt.trim()};
    } else return {status:400,error:'Invalid change.'};
    this.ctx.storage.transactionSync(()=>{
      if (upload) this.sql.exec('INSERT INTO media VALUES(?,?,?)',upload.id,'image/jpeg',upload.bytes);
      this.sql.exec('INSERT OR REPLACE INTO pages VALUES(?,?,?,?)',path,state.revision+1,JSON.stringify(next),previous);
    });
    return this.page(path);
  }
  photo(id){return this.sql.exec('SELECT mime,bytes FROM media WHERE id=?',id).toArray()[0];}
  submit(id,entry,bucket) {
    return this.ctx.storage.transactionSync(()=>{
      if (this.sql.exec('SELECT 1 FROM enquiries WHERE id=?',id).toArray().length) return true;
      this.sql.exec('DELETE FROM limits WHERE expires<=?',Date.now());
      const count=this.sql.exec('SELECT n FROM limits WHERE bucket=?',bucket).toArray()[0]?.n || 0;
      if (count>=12) return false;
      this.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?)',bucket,count+1,Date.now()+600000);
      this.sql.exec('INSERT INTO enquiries VALUES(?,?,?,?)',id,new Date().toISOString(),JSON.stringify(entry),'New');
      return true;
    });
  }
  inbox(before) {
    return this.sql.exec('SELECT rowid AS cursor,* FROM enquiries WHERE rowid < ? ORDER BY rowid DESC LIMIT 30',before || Number.MAX_SAFE_INTEGER).toArray().map(r=>({...r,entry:JSON.parse(r.entry)}));
  }
  setStatus(id,status){this.sql.exec('UPDATE enquiries SET status=? WHERE id=?',status,id);return {status};}
}
