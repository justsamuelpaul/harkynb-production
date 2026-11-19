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
assert.match((await call('/staff/setup/?token=obsolete')).headers.get('Location'),/^https:\/\/admin\.hbproduction\.co\/signup#$/);
const www=await worker.fetch(new Request('https://www.hbproduction.co/about/?a=1'),env);
assert.equal(www.status,301);assert.equal(www.headers.get('Location'),'https://hbproduction.co/about/?a=1');
assert.equal((await call('/admin/enquiries')).status,410);
const data={requestId:crypto.randomUUID(),team:'shotit',name:'Test visitor',email:'test@example.com',shoot:'Weddings',message:'A test booking request',phone:'0800 000 0000',location:'Lagos',date:'2026-12-05',budget:'',method:'Email'};
// Each team's form has its own required questions, follow-ups and allowed answers.
const tryForm=async d=>call('/api/enquiries',null,{requestId:crypto.randomUUID(),name:'Visitor',email:'v@example.com',phone:'0800',message:'Tell me more about this, please.',...d});
assert.equal((await tryForm({team:'shotit'})).status,400,'ShotIt needs a type of shoot');
assert.equal((await tryForm({team:'shotit',shoot:'Underwater'})).status,400,'answers must be one of the choices');
assert.equal((await tryForm({team:'nowhere'})).status,400);
const student={team:'academy',as:'A prospective student',age:'18 to 24',city:'Ibadan, Oyo',programmes:['Photography','Video Editing'],experience:'Complete beginner',occupation:'Recent graduate',format:'Online'};
assert.equal((await tryForm({...student,programmes:[]})).status,400,'students choose at least one programme');
assert.equal((await tryForm({...student,programmes:['Juggling']})).status,400);
assert.equal((await tryForm({...student,age:'16 to 17'})).status,400,'under-18 students need a parent or guardian');
assert.equal((await tryForm({team:'academy',as:'A school or organisation'})).status,400,'schools give their name and programmes');
assert.equal((await tryForm({team:'summit',type:'Speaker application'})).status,400,'Summit takes enquiries and partnerships only');
assert.equal((await tryForm({team:'summit',type:'Partnership or sponsorship',organisation:'Acme'})).status,400,'partners choose an area');

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
assert.match(await (await adminCall('/')).text(),/Create an account/);
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

// Changing built-in wording in code disconnects a published edit. Staff must see it and can reconnect or discard it.
const attention=async()=>(await adminJson('/admin/attention',member)).json();
const other=Object.keys(pages[route].fields)[1], saved=pages[route].fields[key];
assert.deepEqual(await attention(),{});
delete pages[route].fields[key];
assert.deepEqual(await attention(),{[route]:1});
let state=await (await adminJson(path,member)).json();
assert.equal(state.current.was[key],saved.value);
assert.equal((await publish({revision:state.revision,relink:{from:key,to:'not-a-field'}})).status,400);
assert.equal((await publish({revision:state.revision,relink:{from:other,to:null}})).status,400);
state=await (await publish({revision:state.revision,relink:{from:key,to:other}})).json();
assert.equal(state.current.text[other],'Updated work');
assert.equal(state.current.text[key],undefined);
assert.equal(state.current.was[other],pages[route].fields[other].value);
assert.deepEqual(await attention(),{});
pages[route].fields[key]=saved;
const otherField=pages[route].fields[other]; delete pages[route].fields[other];
assert.deepEqual(await attention(),{[route]:1});
state=await (await publish({revision:state.revision,relink:{from:other,to:null}})).json();
assert.equal(state.current.text[other],undefined);
assert.deepEqual(await attention(),{});
pages[route].fields[other]=otherField;

// Portfolio and news lists: seeded from the build, validated, published, restorable, and rendered by the shared renderer.
const seed=JSON.parse(await readFile(new URL('../dist/editor-collections.json',import.meta.url)));
env.ASSETS.fetch=req=>new URL(String(req.url??req)).pathname==='/editor-collections.json'?Response.json(seed):Response.json(pages);
const getList=name=>adminJson('/admin/collections?name='+name,member);
const saveList=(name,d)=>adminJson('/admin/collections?name='+name,member,d);
let projects=await (await getList('projects')).json();
assert.equal(projects.published,false);assert.equal(projects.items.length,seed.projects.length);assert.ok(projects.categories.includes('Weddings'));
assert.equal((await getList('nope')).status,404);
assert.equal((await adminJson('/admin/media',member,{image:btoa('not a jpeg')})).status,400);
const {id:photoId}=await (await adminJson('/admin/media',member,{image:'/9j/2Q=='})).json();
assert.match(photoId,/^[0-9a-f-]{36}$/);
const shoot={slug:'new-shoot',title:'New <shoot>',category:'Portraits',team:'shotit',image:'/media/'+photoId,alt:'A portrait',gallery:[{title:'Detail',image:'/media/'+photoId,alt:'Detail photo'}]};
const tryItems=async items=>(await saveList('projects',{revision:0,items})).status;
assert.equal(await tryItems([...projects.items,{...shoot,slug:projects.items[0].slug}]),400,'duplicate slug');
assert.equal(await tryItems([{...shoot,image:'/media/'+crypto.randomUUID()}]),400,'photo that was never uploaded');
assert.equal(await tryItems([{...shoot,alt:''}]),400,'missing photo description');
assert.equal(await tryItems([{...shoot,category:'Nope'}]),400,'unknown category');
projects=await (await saveList('projects',{revision:0,items:[...projects.items,shoot]})).json();
assert.equal(projects.revision,1);assert.equal(projects.items.length,seed.projects.length+1);assert.equal(projects.canRestore,true);
assert.equal((await saveList('projects',{revision:0,items:[]})).status,409,'stale revision');
assert.equal((await call('/work/not-a-project/')).status,404);
// With a published portfolio the sitemap lists exactly the published project pages.
{
  const builtMap='<?xml version="1.0"?><urlset><url><loc>https://hbproduction.co/</loc></url><url><loc>https://hbproduction.co/work/old-project/</loc><lastmod>2026-01-01</lastmod></url></urlset>';
  const mapEnv={...env,ASSETS:{fetch:()=>new Response(builtMap)}};
  const xml=await (await worker.fetch(new Request(origin+'/sitemap.xml'),mapEnv)).text();
  assert.ok(!xml.includes('old-project')&&xml.includes('https://hbproduction.co/work/'+shoot.slug+'/')&&xml.includes('<loc>https://hbproduction.co/</loc>'));
}
assert.equal((await call('/work/_project/')).status,404);
const {views,projectMain}=await import('../shared/render.mjs');
const published=studio.collections().projects;
assert.match(views['projects:work'](published),/\/work\/new-shoot\//);
assert.match(views['projects:shotit'](published),/New &lt;shoot&gt;/);
const pageHtml=projectMain(published.at(-1));
assert.match(pageHtml,/<h1>New &lt;shoot&gt;<\/h1>/);assert.match(pageHtml,/team=shotit/);assert.ok(!pageHtml.includes('<shoot>'));
projects=await (await saveList('projects',{revision:1,items:published.slice(0,1)})).json();
assert.equal(projects.items.length,1);
projects=await (await saveList('projects',{revision:2,restore:true})).json();
assert.equal(projects.items.length,seed.projects.length+1);assert.equal(projects.canRestore,false);
assert.equal((await saveList('news',{revision:0,items:[{title:'Launch',url:'http://insecure.example'}]})).status,400,'news links must be https');
let news=await (await saveList('news',{revision:0,items:[{title:'Launch',date:'November 2026',description:'The new website is live.',url:'https://example.com/'}]})).json();
assert.equal(news.items[0].title,'Launch');assert.match(views['news:list'](news.items),/Read update/);
news=await (await saveList('news',{revision:1,restore:true})).json();
assert.equal(news.items,null,'restoring the first publish returns to the built list');
assert.equal((await (await getList('news')).json()).published,false);

const inbox=await (await adminJson('/admin/enquiries',owner)).json();
assert.equal(inbox.length,1);assert.equal(inbox[0].entry.message,data.message);
await adminJson('/admin/enquiries',owner,{id:data.requestId,status:'Resolved'});
assert.equal(studio.inbox(0)[0].status,'Resolved');

// Dashboard alerts reach every approved account. Editors get counts only and cannot read, assign or list staff.
const alertsFor=async c=>(await adminJson('/admin/alerts',c)).json();
assert.deepEqual(await alertsFor(member),{unseen:1,open:0,mine:0,canRead:false});
assert.equal((await adminJson('/admin/alerts/seen',member,{})).status,200);
assert.equal((await alertsFor(member)).unseen,0);
assert.equal((await adminCall('/admin/staff',member)).status,403);
assert.equal((await adminJson('/admin/enquiries',member,{id:data.requestId,status:'New'})).status,403);

assert.equal((await adminCall('/team',owner,{id:memberId,role:'inbox'})).status,303);
assert.equal((await (await adminCall('/admin/enquiries',member)).json())[0].id,data.requestId);

// Brand and status filters, assignment to inbox staff, and per-person unseen counts.
const more=[{...student,name:'Academy visitor',age:'16 to 17',guardian:'Mrs Visitor, 0800 111 2222',schedule:'Weekends',ignored:'not on this form'},{team:'summit',type:'Partnership or sponsorship',organisation:'Acme Ltd',partnership:['Media partnership'],name:'Summit visitor'}].map(x=>({...data,shoot:undefined,...x,requestId:crypto.randomUUID()}));
for(const m of more)assert.equal((await call('/api/enquiries',null,m)).status,201);
assert.equal((await alertsFor(owner)).unseen,3);
assert.deepEqual(await alertsFor(member),{unseen:2,open:2,mine:0,canRead:true});
const list=async(c,q='')=>(await adminJson('/admin/enquiries'+q,c)).json();
const [academyRow]=await list(owner,'?team=academy');
assert.equal(academyRow.entry.name,'Academy visitor');assert.equal(academyRow.entry.topic,'A prospective student');
assert.deepEqual(academyRow.entry.details,[['I am enquiring as','A prospective student'],['Student’s age group','16 to 17'],['Parent or guardian name and phone number','Mrs Visitor, 0800 111 2222'],['City and state of residence','Ibadan, Oyo'],['Programmes you are interested in','Photography, Video Editing'],['Current experience level','Complete beginner'],['Current occupation','Recent graduate'],['Preferred way to learn','Online'],['Preferred schedule','Weekends']],'answers are stored with their labels; questions from other forms are dropped');
assert.deepEqual((await list(owner,'?team=summit'))[0].entry.details,[['Type of enquiry','Partnership or sponsorship'],['Company or organisation','Acme Ltd'],['Partnership areas of interest','Media partnership']]);
assert.equal((await list(owner,'?status=open')).length,2);
assert.equal((await list(owner,'?status=Resolved'))[0].id,data.requestId);
assert.equal((await adminJson('/admin/enquiries?team=nope',owner)).status,400);
const {staff}=await (await adminJson('/admin/staff',owner)).json();
assert.deepEqual(staff.map(s=>s.name).sort(),['member','owner']);
assert.equal((await adminJson('/admin/enquiries',owner,{id:more[0].requestId,assignee:crypto.randomUUID()})).status,400);
assert.deepEqual(await (await adminJson('/admin/enquiries',owner,{id:more[0].requestId,assignee:memberId,status:'In progress'})).json(),{status:'In progress',assignee:memberId,assigneeName:'member'});
assert.deepEqual((await list(member,'?assigned=me')).map(r=>r.id),[more[0].requestId]);
assert.deepEqual((await list(member,'?assigned=none&status=open')).map(r=>r.id),[more[1].requestId]);
assert.equal((await alertsFor(member)).mine,1);
assert.equal((await (await adminJson('/admin/alerts/seen',member,{})).json()).unseen,0);
assert.equal((await adminJson('/admin/enquiries',owner,{id:more[0].requestId,assignee:''})).status,200);
assert.equal((await alertsFor(member)).mine,0);
assert.equal((await adminJson('/admin/enquiries',owner,{id:crypto.randomUUID(),status:'New'})).status,404);
assert.equal((await adminJson('/admin/enquiries',owner,{id:more[1].requestId,status:'Done'})).status,400);
assert.equal((await adminCall('/admin/page?path=/',member)).status,403);
assert.equal((await adminCall('/admin/attention',member)).status,403);
assert.equal((await adminCall('/admin/collections?name=projects',member)).status,403);
assert.equal((await adminJson('/admin/media',member,{image:'/9j/2Q=='})).status,403);
assert.equal((await adminCall('/logout',member,{})).status,303);
assert.equal((await adminCall('/admin/enquiries',member)).status,401);
assert.equal((await adminCall('/login','',{name:'member',password:'my testing password'})).status,303);
// Old workers.dev addresses forward to the real domains.
assert.equal((await worker.fetch(new Request('https://harkynb-production.example.workers.dev/about/?a=1'),env)).headers.get('Location'),'https://hbproduction.co/about/?a=1');
assert.equal((await admin.fetch(new Request('https://harkynb-admin.example.workers.dev/login'),bindings)).headers.get('Location'),'https://admin.hbproduction.co/login');

// Enquiry emails: a staff alert with every answer (replies go to the visitor) and a short confirmation to the visitor.
{
  const sent=[], realFetch=globalThis.fetch, pending=[];
  globalThis.fetch=async(u,o)=>{sent.push({url:String(u),auth:o.headers.Authorization,body:JSON.parse(o.body)});return new Response('{}');};
  const mailEnv={...env,RESEND_API_KEY:'re_test'}, mailCtx={waitUntil:p=>pending.push(p)};
  const enquiry={...student,requestId:crypto.randomUUID(),name:'Tola <b>Ade</b>',email:'tola@example.com',phone:'0800',message:'Secret plans for the visitor email test.'};
  const post=()=>worker.fetch(new Request(origin+'/api/enquiries',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(enquiry)}),mailEnv,mailCtx);
  assert.equal((await post()).status,201); await Promise.all(pending);
  assert.equal(sent.length,2); assert.ok(sent.every(m=>m.url==='https://api.resend.com/emails'&&m.auth==='Bearer re_test'));
  const [staffMail,visitorMail]=[sent.find(m=>m.body.to[0]==='hello@hbproduction.co'),sent.find(m=>m.body.to[0]==='tola@example.com')];
  assert.equal(staffMail.body.reply_to,'tola@example.com'); assert.match(staffMail.body.subject,/Creators Academy enquiry from Tola/);
  assert.ok(staffMail.body.html.includes('Programmes you are interested in')&&staffMail.body.html.includes('&lt;b&gt;')&&!staffMail.body.html.includes('<b>Ade'));
  assert.equal(visitorMail.body.reply_to,'hello@hbproduction.co'); assert.ok(!visitorMail.body.html.includes('Secret plans'),'confirmation does not echo the message');
  assert.equal((await post()).status,201); await Promise.all(pending); assert.equal(sent.length,2,'a resubmitted duplicate sends nothing');
  globalThis.fetch=realFetch;
}
console.log('PASS: separate portal signup, owner approval, login, shared inbox, alerts, brand filters, assignment, portfolio and news lists, role checks and logout.');
