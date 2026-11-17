import {readFile,readdir,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=new URL('../dist/',import.meta.url);
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const u=new URL(entry.name+(entry.isDirectory()?'/':''),dir);files.push(...entry.isDirectory()?await walk(u):[u]);}return files;}
const files=await walk(base),html=files.filter(f=>f.pathname.endsWith('.html'));
const decoded=s=>s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
let links=0;
for(const file of html){const text=await readFile(file,'utf8');assert.equal((text.match(/<h1[ >]/g)||[]).length,1,`One main heading: ${file}`);assert.match(text,/<meta name="description" content="[^"]+"/);assert.match(text,/<html lang="en"/);assert.match(text,/<main id="main"/);assert.ok(!text.includes('undefined'),`No undefined content: ${file}`);assert.ok(!/[\u2014]/.test(text),'No long dashes');
 const current=new URL(file.href.replace(/index\.html$/,''));
 for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){const value=decoded(match[1]);if(/^(?:https?:|mailto:|data:)/.test(value))continue;assert.ok(value,`Empty URL in ${file}`);let target;if(value.startsWith('/'))target=new URL(value.slice(1),base);else target=new URL(value,current);if(target.hash){const dest=new URL(target.href);dest.hash='';dest.search='';if(dest.pathname.endsWith('/'))dest.pathname+='index.html';const body=await readFile(dest,'utf8');assert.ok(body.includes(`id="${target.hash.slice(1)}"`),`Missing anchor: ${value} in ${file}`);}
 target.hash='';target.search='';if(target.pathname.endsWith('/'))target.pathname+='index.html';await stat(target);links++;}
}
const settings=JSON.parse(await readFile(new URL('settings.json',base),'utf8'));
assert.ok(settings.contacts.production);assert.ok(html.length>=25,'Expected full set of brand and course pages');
const home=await readFile(new URL('index.html',base),'utf8');for(const path of ['onevoicefm','harkynbshotit','academy','summit'])assert.ok(home.includes(`/brands/${path}/`));
const radio=await readFile(new URL('brands/onevoicefm/index.html',base),'utf8');if(!radio.includes('data-radio'))assert.ok(radio.includes('Live stream not connected'));
const form=await readFile(new URL('contact/index.html',base),'utf8');for(const name of ['name','email','team','service','message','date','location','budget','method'])assert.ok(form.includes(`name="${name}"`));
console.log(`PASS: ${html.length} pages, ${links} local links/assets, headings, metadata, brand routes, radio status, and form fields.`);
