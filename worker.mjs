import {setupHtml} from './staff-setup.mjs';
import {consoleHtml} from './studio-view.mjs';

const privateHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers:privateHeaders});
const fail = (error,status=400) => json({error},status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const teams = ['production','onevoicefm','shotit','academy','summit'];
const fields = ['team','service','name','email','phone','organisation','date','location','budget','message','method'];
const digest = s => crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));

const encode = value => new TextEncoder().encode(value);
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2,'0')).join('');
function readRoster(binding) {
  let rows=binding;
  if (typeof rows==='string') {
    try {rows=JSON.parse(rows);} catch {return null;}
  }
  return rows && typeof rows==='object' && !Array.isArray(rows) ? rows : null;
}
function invitation(env,name) {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name)) return null;
  const rows=readRoster(env.STAFF_INVITES);
  const row=rows && Object.hasOwn(rows,name) && rows[name];
  if (!row || !['manager','editor','inbox'].includes(row.role) ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(row.token) || !Number.isFinite(Date.parse(row.expires))) return null;
  return row;
}
async function passwordHash(password,salt) {
  const key=await crypto.subtle.importKey('raw',encode(password),'PBKDF2',false,['deriveBits']);
  return crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:encode(salt),iterations:100000},key,256);
}
async function staff(request,env,store) {
  let pair;
  try { pair=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(request.headers.get('authorization').match(/^Basic ([A-Za-z0-9+/=]+)$/i)[1]),c=>c.charCodeAt(0))); }
  catch {return null;}
  const i=pair.indexOf(':'),name=pair.slice(0,i),password=pair.slice(i+1);
  const row=invitation(env,name);
  if (!row || password.length>256) return null;
  const tag=hex(await digest(row.token)), record=await store.credential(name,tag);
  if (!record) return null;
  const bucket=await authBucket(request,name);
  if (!await store.reserveAuth(bucket)) return null;
  const calculated=hex(await passwordHash(password,record.salt));
  if (!crypto.subtle.timingSafeEqual(encode(calculated),encode(record.hash))) return null;
  await store.releaseAuth(bucket);
  return row.role;
}
async function authBucket(request,name) {
  return hex(await digest((request.headers.get('CF-Connecting-IP')||'local')+'|'+name+'|'+Math.floor(Date.now()/600000)));
}

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
  if (path==='/staff/setup/' && request.method==='GET') return new Response(setupHtml,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'"}});
  if (path==='/staff/activate' && request.method==='POST') {
    if (request.headers.get('origin')!==url.origin) return fail('Invalid origin.',403);
    let d; try { d=await readJson(request,6000); } catch {return fail('Invalid request.');}
    if (typeof d?.password!=='string' || d.password.length<15 || d.password.length>256) return fail('Use a password of 15 to 256 characters.');
    const row=invitation(env,d.name);
    if (!readRoster(env.STAFF_INVITES)) return fail('Staff invitations are not configured correctly on this Worker. Check the production STAFF_INVITES secret and deploy.',503);
    const denied=()=>fail('This username and invitation code do not match the deployed invitation. Reopen the original invitation link or ask for a new one.',403);
    const used=()=>fail('This invitation was already used. Open /admin/ and sign in with the password you set.',403);
    if (!row || typeof d.token!=='string') return denied();
    const tag=await digest(row.token);
    if (!crypto.subtle.timingSafeEqual(tag,await digest(d.token))) return denied();
    const version=hex(tag);
    if (await store.credential(d.name,version)) return used();
    if (Date.parse(row.expires)<=Date.now()) return fail('This invitation has expired. Ask for a new invitation.',403);
    const salt=crypto.randomUUID(), hash=hex(await passwordHash(d.password,salt));
    return await store.activate(d.name,version,salt,hash) ? json({saved:true},201) : used();
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    const role = await staff(request,env,store);
    if (!role) return new Response('Staff sign-in required.',{status:401,headers:{...privateHeaders,'WWW-Authenticate':'Basic realm="HarkynB staff", charset="UTF-8"'}});
    if (request.method !== 'GET' && request.headers.get('origin')!==url.origin) return fail('Invalid origin.',403);
    if ((path==='/admin'||path==='/admin/') && request.method==='GET') return new Response(consoleHtml(role),{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"}});
    if (path==='/admin/enquiries' && role!=='editor') {
      if (request.method==='GET') return json(await store.inbox(Math.max(0,Number(url.searchParams.get('before'))||0)));
      if (request.method==='POST') {
        let d; try { d=await readJson(request,1000); } catch {return fail('Invalid request.');}
        if (!uuid.test(d?.id)||!['New','Resolved'].includes(d.status)) return fail('Invalid enquiry.');
        return json(await store.setStatus(d.id,d.status));
      }
    }
    if (path==='/admin/page' && role!=='inbox') {
      const page = url.searchParams.get('path');
      const manifest = await (await env.ASSETS.fetch(new URL('/editor-pages.json',url))).json();
      if (!Object.hasOwn(manifest,page)) return fail('Unknown page.',404);
      if (request.method==='GET') return json(await store.page(page));
      if (request.method==='POST') {
        let d; try { d=await readJson(request,1250000); } catch {return fail('Invalid or oversized change.');}
        const reply = await store.publish(page,manifest[page],d);
        return json(reply,reply.status || 200);
      }
    }
    return fail('Unavailable for this account.',403);
  }
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
    return row ? {revision:row.revision,current:JSON.parse(row.current),canRestore:!!row.previous} : {revision:0,current:{text:{},images:{}},canRestore:false};
  }
  publish(path,schema,d) {
    const state = this.page(path);
    if (d?.revision!==state.revision) return {status:409,error:'This page changed. Reload it before publishing.'};
    const previous=JSON.stringify(state.current), next=state.current;
    let upload;
    if (d.restore) {
      const row=this.sql.exec('SELECT previous FROM pages WHERE path=?',path).toArray()[0];
      if (!row?.previous) return {status:400,error:'No previous version.'};
      Object.assign(next,JSON.parse(row.previous));
    } else if (Object.hasOwn(schema.fields,d.key) && typeof d.value==='string' && d.value.trim() && d.value.length<=5000) {
      if (d.value===schema.fields[d.key].value) delete next.text[d.key]; else next.text[d.key]=d.value.trim();
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
