import {consoleHtml} from '../studio-view.mjs';
import {entrance,pending,team,site,logout} from './views.mjs';
import {hash} from './accounts.mjs';
// Preserve the Studio namespace from this Worker's first deployment.
export {Studio} from '../worker.mjs';
export {Accounts} from './accounts.mjs';
const privateHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers:privateHeaders});
const fail = (error,status=400) => json({error},status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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


const html=(s,status=200)=>new Response(s,{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
const cookieName='__Host-harkynb';
const redirect=(path,cookie)=>{const headers={...privateHeaders,Location:path};if(cookie)headers['Set-Cookie']=cookie;return new Response(null,{status:303,headers});};
const cookie=(token,age)=>cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
async function fields(request){
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return null;
  const reader=request.body?.getReader();if(!reader)return null;
  const decoder=new TextDecoder();let total=0,body='';
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>5000){await reader.cancel();return null;}body+=decoder.decode(value,{stream:true});}
  return new URLSearchParams(body+decoder.decode());
}
export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname, method=request.method;
  if(!['GET','POST'].includes(method))return fail('Method not allowed.',405);
  if(method==='POST' && request.headers.get('origin')!==url.origin)return fail('Invalid origin.',403);
  if(method==='GET' && ['/studio.css','/studio.js'].includes(path))return env.SITE.fetch(new URL(path,site));
  const accounts=env.IDENTITY.get(env.IDENTITY.idFromName('staff'));
  if(method==='GET' && ['/','/login','/signup'].includes(path))return html(entrance(path==='/signup'));
  if(method==='POST' && ['/signup','/login'].includes(path)){
    const signup=path==='/signup',form=await fields(request);
    const name=(form?.get('name')||'').trim().toLowerCase(),password=form?.get('password')||'';
    if(!/^[a-z0-9._-]{3,64}$/.test(name)||password.length>256||!password)return html(entrance(signup,'Enter a valid username and password.'),400);
    if(signup && (password.length<15 || password!==form.get('confirm')))return html(entrance(true,'Use at least 15 characters and confirm the same password.'),400);
    if(!await accounts.allow(await hash(path+'|'+(request.headers.get('CF-Connecting-IP')||'local'))))return html(entrance(signup,'Please try again in ten minutes.'),429);
    if(signup && !await accounts.signup(name,password))return html(entrance(true,'Choose a different username or log in to your account.'),409);
    const token=await accounts.login(name,password);
    return token?redirect('/admin/',cookie(token,28800)):html(entrance(false,'Check your username and password.'),401);
  }
  const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-harkynb=([0-9a-f]{64})(?:;|$)/)?.[1];
  const key=token?await hash(token):null;
  if(path==='/logout' && method==='POST'){if(key)await accounts.logout(key);return redirect('/',cookie('',0));}
  const user=key && await accounts.account(key);
  if(!user)return ['/admin','/admin/','/team'].includes(path) && method==='GET'?redirect('/login'):fail('Please log in.',401);
  const role=user.id===env.OWNER_ACCOUNT_ID?'manager':user.role;
  if(role==='pending')return method==='GET' && ['/admin','/admin/','/team'].includes(path)?html(pending(user)):fail('Staff approval required.',403);
  if(path==='/team' && method==='GET' && role!=='manager')return redirect('/admin/');
  if(path==='/team' && role==='manager'){
    if(method==='GET')return html(team(await accounts.list(),env.OWNER_ACCOUNT_ID));
    const f=await fields(request),id=f?.get('id'),r=f?.get('role');
    if(!uuid.test(id)||id===user.id||id===env.OWNER_ACCOUNT_ID||!['editor','inbox','manager','pending'].includes(r))return fail('Invalid role change.');
    await accounts.change(id,r);return redirect('/team');
  }
  if(method==='GET' && ['/admin','/admin/'].includes(path))return html(consoleHtml(role).replace('href="/">View website','href="'+site+'">View website').replace('</header>',(role==='manager'?'<a href="/team">Staff access</a>':'')+logout+'</header>'));
  if(role!=='inbox' && method==='GET' && (path==='/editor-pages.json'||/^\/media\/[0-9a-f-]{36}$/.test(path)||path.startsWith('/art/')))return env.SITE.fetch(new URL(path,site));
  const store=env.STUDIO.get(env.STUDIO.idFromName('production'));
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
      const manifest = await (await env.SITE.fetch(new URL('/editor-pages.json',site))).json();
      if (!Object.hasOwn(manifest,page)) return fail('Unknown page.',404);
      if (request.method==='GET') return json(await store.page(page));
      if (request.method==='POST') {
        let d; try { d=await readJson(request,1250000); } catch {return fail('Invalid or oversized change.');}
        const reply = await store.publish(page,manifest[page],d);
        return json(reply,reply.status || 200);
      }
    }
  return fail('Unavailable for this account.',403);
}};
