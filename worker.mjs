const privateHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers:privateHeaders});
const fail = (error,status=400) => json({error},status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
    // Each team has its own questions; see shared/forms.mjs.
    const {entry,error} = validateEnquiry(d);
    if (error) return fail(error);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const bucket = Array.from(new Uint8Array(await digest(ip+'|'+Math.floor(Date.now()/600000)))).join('.');
    const saved = await store.submit(d.requestId,entry,bucket);
    return saved ? json({saved:true},201) : fail('Please try again in ten minutes.',429);
  }
  if (path.startsWith('/media/') && uuid.test(path.slice(7)) && request.method==='GET') {
    const image = await store.photo(path.slice(7));
    return image ? new Response(image.bytes,{headers:{'Content-Type':image.mime,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}}) : fail('Unknown image.',404);
  }
  // Once staff publish the portfolio list, it decides which project pages exist, including ones added in the console.
  if (/^\/work\/_project\/?$/.test(path)) return notFound(env,url);
  const project = request.method==='GET' && path.match(/^\/work\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (project) {
    const {projects} = await store.collections();
    if (projects) {
      const p = projects.find(x=>x.slug===project[1]);
      if (!p) return notFound(env,url);
      const title = p.title+' | HarkynB Production', description = p.description || p.title;
      const template = await env.ASSETS.fetch(new Request(new URL('/work/_project/',url)));
      const output = new HTMLRewriter()
        .on('title',{element(el){el.setInnerContent(title);}})
        .on('meta[name="description"]',{element(el){el.setAttribute('content',description);}})
        .on('meta[property="og:title"]',{element(el){el.setAttribute('content',title);}})
        .on('meta[property="og:description"]',{element(el){el.setAttribute('content',description);}})
        .on('main#main',{element(el){el.setInnerContent(projectMain(p),{html:true});}})
        .transform(template);
      return new Response(output.body,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
  }
  const res = await env.ASSETS.fetch(request);
  if (request.method!=='GET' || res.status!==200 || !res.headers.get('content-type')?.includes('text/html')) return res;
  const page = path.replace(/index\.html$/,'').replace(/\/?$/,'/');
  const {current} = await store.page(page);
  // Pages showing staff-editable lists use the published list when there is one.
  const lists = ['/work/','/brands/harkynbshotit/','/news/'].includes(page) ? await store.collections() : {};
  const rewrite = new HTMLRewriter()
    .on('[data-collection]',{element(el){const items=lists[el.getAttribute('data-collection')], view=views[el.getAttribute('data-collection')+':'+el.getAttribute('data-view')]; if(items && view) el.setInnerContent(view(items),{html:true});}})
    .on('[data-copy]',{element(el){const value=current.text[el.getAttribute('data-copy')]; if(typeof value==='string') el.setInnerContent(value);}})
    .on('[data-feature]',{element(el){if(current.images.feature) el.removeAttribute('hidden');}})
    .on('[data-picture]',{element(el){const img=current.images[el.getAttribute('data-picture')]; if(img){el.setAttribute('src','/media/'+img.id);el.setAttribute('alt',img.alt);}}});
  const output = rewrite.transform(res);
  const headers = new Headers(output.headers);
  headers.delete('etag'); headers.delete('last-modified'); headers.set('cache-control','no-store');
  return new Response(output.body,{headers});
}};

// Base64 JPEG up to 900 KB, as prepared by the staff console. Returns bytes or {error}.
function decodeJpeg(image) {
  let bytes;
  try {bytes=Uint8Array.from(atob(image),c=>c.charCodeAt(0));} catch {return {error:'Invalid image.'};}
  const jpg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  return jpg && bytes.length<=900000 ? bytes : {error:'Choose a smaller JPEG image.'};
}
// The site's normal 404 page, with a 404 status.
async function notFound(env,url) {
  const res = await env.ASSETS.fetch(new Request(new URL('/__not-found__/',url)));
  return new Response(res.body,{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

import {DurableObject} from 'cloudflare:workers';
import {views,projectMain} from './shared/render.mjs';
import {validateCollection} from './shared/collections.mjs';
import {validateEnquiry} from './shared/forms.mjs';
export class Studio extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS credentials(name TEXT PRIMARY KEY,version TEXT,salt TEXT,hash TEXT); CREATE TABLE IF NOT EXISTS used_invites(version TEXT PRIMARY KEY)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pages(path TEXT PRIMARY KEY,revision INTEGER,current TEXT,previous TEXT); CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,mime TEXT,bytes BLOB); CREATE TABLE IF NOT EXISTS enquiries(id TEXT UNIQUE,created TEXT,entry TEXT,status TEXT); CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)');
    // Assignment and per-staff 'seen' state live in their own tables so the original enquiries schema needs no migration.
    this.sql.exec('CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,user TEXT,name TEXT); CREATE TABLE IF NOT EXISTS seen(user TEXT PRIMARY KEY,cursor INTEGER)');
    // Published staff lists (portfolio projects, news). previous='built' means restoring returns to the content built with the site.
    this.sql.exec('CREATE TABLE IF NOT EXISTS collections(name TEXT PRIMARY KEY,revision INTEGER,current TEXT,previous TEXT)');
  }
  collections() {
    const out = {projects:null,news:null};
    for (const row of this.sql.exec('SELECT name,current FROM collections').toArray()) out[row.name] = JSON.parse(row.current);
    return out;
  }
  collection(name) {
    const row = this.sql.exec('SELECT * FROM collections WHERE name=?',name).toArray()[0];
    return row ? {revision:row.revision,items:JSON.parse(row.current),canRestore:!!row.previous} : {revision:0,items:null,canRestore:false};
  }
  saveCollection(name,d) {
    const state = this.collection(name);
    if (d?.revision!==state.revision) return {status:409,error:'This list changed since you opened it. Reload it before publishing.'};
    if (d.restore) {
      const previous = this.sql.exec('SELECT previous FROM collections WHERE name=?',name).toArray()[0]?.previous;
      if (!previous) return {status:400,error:'No previous version.'};
      if (previous==='built') this.sql.exec('DELETE FROM collections WHERE name=?',name);
      else this.sql.exec('UPDATE collections SET revision=?,current=?,previous=NULL WHERE name=?',state.revision+1,previous,name);
      return this.collection(name);
    }
    const checked = validateCollection(name,d.items,id=>this.sql.exec('SELECT 1 FROM media WHERE id=?',id).toArray().length>0);
    if (checked.error) return {status:400,error:checked.error};
    const previous = state.items===null ? 'built' : JSON.stringify(state.items);
    this.sql.exec('INSERT OR REPLACE INTO collections VALUES(?,?,?,?)',name,state.revision+1,JSON.stringify(checked.items),previous);
    return this.collection(name);
  }
  // Store an uploaded JPEG (base64) and return its id; it is served at /media/<id>.
  storeImage(image) {
    const bytes = decodeJpeg(image);
    if (bytes.error) return {status:400,error:bytes.error};
    const id = crypto.randomUUID();
    this.sql.exec('INSERT INTO media VALUES(?,?,?)',id,'image/jpeg',bytes);
    return {id};
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
      const bytes=decodeJpeg(d.image);
      if (bytes.error) return {status:400,error:bytes.error};
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
  // filter: {team, status, assigned: 'me'|'none'|'', user}
  inbox(before,filter={}) {
    const where=['e.rowid < ?'], args=[before || Number.MAX_SAFE_INTEGER];
    if (filter.team) {where.push("json_extract(e.entry,'$.team') = ?"); args.push(filter.team);}
    if (filter.status==='open') where.push("e.status <> 'Resolved'");
    else if (filter.status) {where.push('e.status = ?'); args.push(filter.status);}
    if (filter.assigned==='me') {where.push('a.user = ?'); args.push(filter.user);}
    else if (filter.assigned==='none') where.push('a.user IS NULL');
    return this.sql.exec('SELECT e.rowid AS cursor,e.id,e.created,e.entry,e.status,a.user AS assignee,a.name AS assigneeName FROM enquiries e LEFT JOIN assignments a ON a.id=e.id WHERE '+where.join(' AND ')+' ORDER BY e.rowid DESC LIMIT 30',...args)
      .toArray().map(r=>({...r,entry:JSON.parse(r.entry)}));
  }
  // change: {status?, assignee?: {id,name} | null}
  updateEnquiry(id,change) {
    if (!this.sql.exec('SELECT 1 FROM enquiries WHERE id=?',id).toArray().length) return null;
    this.ctx.storage.transactionSync(()=>{
      if (change.status) this.sql.exec('UPDATE enquiries SET status=? WHERE id=?',change.status,id);
      if (change.assignee===null) this.sql.exec('DELETE FROM assignments WHERE id=?',id);
      else if (change.assignee) this.sql.exec('INSERT OR REPLACE INTO assignments VALUES(?,?,?)',id,change.assignee.id,change.assignee.name);
    });
    return this.sql.exec('SELECT e.status,a.user AS assignee,a.name AS assigneeName FROM enquiries e LEFT JOIN assignments a ON a.id=e.id WHERE e.id=?',id).toArray()[0];
  }
  setStatus(id,status){return this.updateEnquiry(id,{status});}
  // Dashboard alert counts. "unseen" is per staff member; nothing personal is returned.
  alerts(user) {
    const cursor=this.sql.exec('SELECT cursor FROM seen WHERE user=?',user).toArray()[0]?.cursor || 0;
    const count=(q,...a)=>this.sql.exec(q,...a).toArray()[0].n;
    return {
      unseen:count('SELECT COUNT(*) AS n FROM enquiries WHERE rowid > ?',cursor),
      open:count("SELECT COUNT(*) AS n FROM enquiries WHERE status <> 'Resolved'"),
      mine:count("SELECT COUNT(*) AS n FROM enquiries e JOIN assignments a ON a.id=e.id WHERE a.user=? AND e.status <> 'Resolved'",user)
    };
  }
  markSeen(user) {
    const top=this.sql.exec('SELECT MAX(rowid) AS n FROM enquiries').toArray()[0].n || 0;
    this.sql.exec('INSERT OR REPLACE INTO seen VALUES(?,?)',user,top);
    return this.alerts(user);
  }
}
