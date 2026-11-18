import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Run the Worker's request handlers against real SQLite with local binding adapters.
const shim = 'export class DurableObject { constructor(ctx){this.ctx=ctx;} }';
const loader = 'export async function resolve(s,c,next){if(s==="cloudflare:workers")return {url:"data:text/javascript,'+encodeURIComponent(shim)+'",shortCircuit:true};return next(s,c)}';
register('data:text/javascript,'+encodeURIComponent(loader));
crypto.subtle.timingSafeEqual=timingSafeEqual;
const {default:worker,Studio}=await import('../worker.mjs');
const db=new DatabaseSync(':memory:');
const sql={exec(q,...args){
  if(q.startsWith('CREATE ')){db.exec(q);return;}
  const rows=db.prepare(q).all(...args);return {toArray:()=>rows};
}};
const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const studio=new Studio(ctx,{});
const pages=JSON.parse(await readFile(new URL('../dist/editor-pages.json',import.meta.url)));
const env={STUDIO:{get:()=>studio,idFromName:s=>s},ASSETS:{fetch:()=>Response.json(pages)}};
const origin='https://example.test';
const call=(path,account,data)=>worker.fetch(new Request(origin+path,{method:data?'POST':'GET',headers:{origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
assert.match((await call('/staff/setup/?token=obsolete')).headers.get('Location'),/workers\.dev\/signup#$/);
assert.equal((await call('/admin/enquiries')).status,410);
const data={requestId:crypto.randomUUID(),team:'shotit',name:'Test visitor',email:'test@example.com',service:'Photography',message:'A test booking request',phone:'',location:'',date:'',organisation:'',budget:'',method:'Email'};
assert.equal((await call('/api/enquiries',null,{...data,email:'bad'})).status,400);
for(let i=0;i<2;i++)assert.equal((await call('/api/enquiries',null,data)).status,201);
const {default:admin,Accounts}=await import('../admin/index.mjs');
const accounts=new Accounts(ctx,{});
const bindings={IDENTITY:{get:()=>accounts,idFromName:x=>x},STUDIO:env.STUDIO,SITE:env.ASSETS};
const adminCall=(path,cookie='',form=null)=>admin.fetch(new Request(origin+path,{
  method:form?'POST':'GET',headers:{origin,cookie},body:form?new URLSearchParams(form):undefined
}),bindings);
const registerStaff=async name=>{
  const response=await adminCall('/signup','',{name,password:'my testing password',confirm:'my testing password'});
  assert.equal(response.status,303);
  return response.headers.get('set-cookie').split(';')[0];
};
assert.match(await (await adminCall('/')).text(),/Create a staff account/);
const owner=await registerStaff('owner'), member=await registerStaff('member');
assert.equal((await adminCall('/admin/enquiries',member)).status,403);
bindings.OWNER_ACCOUNT_ID=accounts.list().find(row=>row.name==='owner').id;
const memberId=accounts.list().find(row=>row.name==='member').id;
assert.match(await (await adminCall('/team',member)).text(),/Awaiting approval/);
assert.equal((await adminCall('/team',owner,{id:memberId,role:'editor'})).status,303);
const adminJson=(path,cookie,data)=>admin.fetch(new Request(origin+path,{method:data?'POST':'GET',headers:{origin,cookie,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),bindings);
for(const page of Object.keys(pages))assert.equal((await adminCall('/admin/page?path='+encodeURIComponent(page),member)).status,200);
assert.equal((await adminCall('/admin/enquiries',member)).status,403);
const route='/brands/harkynbshotit/', path='/admin/page?path='+route, key=Object.keys(pages[route].fields)[0];
const publish=d=>adminJson(path,member,d);
assert.equal((await publish({key,value:'Updated work',revision:0})).status,200);
assert.equal((await publish({key,value:'Outdated edit',revision:0})).status,409);
const img=await (await publish({key:'feature',alt:'Test photograph',image:'/9j/2Q==',revision:1})).json();
assert.equal(img.current.text[key],'Updated work');
assert.equal((await call('/media/'+img.current.images.feature.id)).headers.get('content-type'),'image/jpeg');
assert.equal((await (await publish({revision:2,restore:true})).json()).current.images.feature,undefined);
const inbox=await (await adminJson('/admin/enquiries',owner)).json();
assert.equal(inbox.length,1);assert.equal(inbox[0].entry.message,data.message);
await adminJson('/admin/enquiries',owner,{id:data.requestId,status:'Resolved'});
assert.equal(studio.inbox(0)[0].status,'Resolved');

assert.equal((await adminCall('/team',owner,{id:memberId,role:'inbox'})).status,303);
assert.equal((await (await adminCall('/admin/enquiries',member)).json())[0].id,data.requestId);
assert.equal((await adminCall('/admin/page?path=/',member)).status,403);
assert.equal((await adminCall('/logout',member,{})).status,303);
assert.equal((await adminCall('/admin/enquiries',member)).status,401);
assert.equal((await adminCall('/login','',{name:'member',password:'my testing password'})).status,303);
console.log('PASS: separate portal signup, owner approval, login, shared inbox, role checks and logout.');
