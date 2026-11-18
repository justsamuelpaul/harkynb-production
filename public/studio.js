const $ = id => document.getElementById(id);
const say = text => { $('notice').textContent=text; };
async function api(url,data) {
  const options=data ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {};
  const response=await fetch(url,options);
  if (!response.ok) throw Error((await response.json().catch(()=>({}))).error || 'Request failed. Reload and sign in again.');
  return response.json();
}
let pages, current, pendingImage, cursor, sequence=0, imageVersion=0;
const pageUrl=()=>'/admin/page?path='+encodeURIComponent($('page').value);
function displayField() {
  ++imageVersion;
  const def=pages[$('page').value], key=$('field').value;
  const photo=def.photos[key];
  $('copy-label').hidden=!!photo; $('photo-fields').hidden=!photo;
  pendingImage=null; $('photo').value='';
  if (photo) {
    const img=current.current.images[key], src=img?'/media/'+img.id:photo.source;
    $('alt').value=img?.alt || '';
    $('preview').hidden=!src;
    if (src) $('preview').src=src; else $('preview').removeAttribute('src');
  } else $('copy').value=current.current.text[key] ?? def.fields[key].value;
  $('restore').disabled=!current.canRestore;
}
async function loadPage() {
  const ticket=++sequence, path=$('page').value;
  $('edit-form').hidden=true; $('field').disabled=true;
  const state=await api(pageUrl()); if (ticket!==sequence) return;
  current=state;
  const def=pages[path], options=[];
  for(const [key,p] of Object.entries(def.photos)) options.push(new Option('Photo · '+p.label,key));
  for(const [key,p] of Object.entries(def.fields)) options.push(new Option(p.tag.toUpperCase()+' · '+p.value.slice(0,90),key));
  $('field').replaceChildren(...options); $('field').disabled=false; $('edit-form').hidden=false;
  $('public-page').href=new URL(path,'https://harkynb-production.justsamuelpaul.workers.dev').href; displayField(); renderOrphans();
}
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
// Field keys are derived from a page's built-in wording. When that wording changes in code,
// published edits lose their field. List them so staff can reconnect or discard instead of losing them silently.
async function loadAttention() {
  const counts=await api('/admin/attention'), list=Object.entries(counts).filter(([p])=>pages[p]);
  $('attention').hidden=!list.length;
  $('attention').replaceChildren(...(list.length?[
    el('p',{textContent:'Some published edits are no longer connected to their page because its built-in wording changed. Open each page to reconnect or discard them.'}),
    el('ul',{},...list.map(([p,n])=>el('li',{},el('button',{type:'button',textContent:pages[p].title+' · '+p+' · '+n+(n===1?' edit':' edits'),onclick:run(async()=>{$('page').value=p;await loadPage();})}))))
  ]:[]));
}
function renderOrphans() {
  const def=pages[$('page').value], c=current.current;
  const items=[...Object.keys(c.text).filter(k=>!Object.hasOwn(def.fields,k)).map(k=>({k,kind:'text'})),
    ...Object.keys(c.images).filter(k=>!Object.hasOwn(def.photos,k)).map(k=>({k,kind:'images'}))];
  $('orphans').hidden=!items.length;
  $('orphans').replaceChildren(...(items.length?[el('h3',{textContent:'Edits to reconnect on this page'})]:[]),...items.map(({k,kind})=>{
    const targets=kind==='text'
      ? Object.entries(def.fields).map(([key,f])=>new Option(f.tag.toUpperCase()+' · '+f.value.slice(0,90),key))
      : Object.entries(def.photos).map(([key,p])=>new Option('Photo · '+p.label,key));
    const pick=el('select',{},new Option('Choose where this belongs…',''),...targets);
    const buttons=[];
    const send=async to=>{
      if (to===null && !confirm('Discard this published edit? The page will show its built-in content instead.')) return;
      buttons.forEach(b=>b.disabled=true);
      try {current=await api(pageUrl(),{revision:current.revision,relink:{from:k,to}});}
      finally {buttons.forEach(b=>b.disabled=false);}
      displayField(); renderOrphans(); say(to===null?'Edit discarded.':'Edit reconnected and published.');
      await loadAttention();
    };
    const shown=kind==='text'
      ? [el('p',{},el('strong',{textContent:'Published text: '}),c.text[k]),...(c.was[k]?[el('p',{},el('strong',{textContent:'It replaced: '}),c.was[k])]:[])]
      : [el('img',{src:'/media/'+c.images[k].id,alt:c.images[k].alt,className:'orphan-photo'})];
    buttons.push(el('button',{type:'button',textContent:'Reconnect',onclick:run(()=>{if(!pick.value)throw Error('Choose where this edit belongs.');return send(pick.value);})}),
      el('button',{type:'button',textContent:'Discard',onclick:run(()=>send(null))}));
    return el('div',{className:'orphan'},...shown,el('label',{},'Reconnect to ',pick),...buttons);
  }));
}
function run(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>say(e.message));}
async function preparePhoto() {
  const ticket=++imageVersion, file=$('photo').files[0]; pendingImage=null;
  if (!file) {displayField();return;}
  if (file.size>25*1024*1024) throw Error('Choose a photograph smaller than 25 MB.');
  const bmp=await createImageBitmap(file);
  const scale=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
  let data;
  for(const q of [.84,.72,.55,.4]) {data=canvas.toDataURL('image/jpeg',q);if(data.length<1200000) break;}
  if (ticket!==imageVersion) return;
  if (data.length>=1200000) throw Error('Choose a smaller photograph.');
  pendingImage=data.split(',')[1];$('preview').src=data;$('preview').hidden=false;say('Photograph ready to publish.');
}
async function save(restore=false) {
  if (restore && !confirm('Restore the previous published version of this page?')) return;
  const key=$('field').value, data={revision:current.revision,key};
  if (restore) data.restore=true;
  else if ($('photo-fields').hidden) data.value=$('copy').value;
  else {
    if (!pendingImage || !$('alt').value.trim()) throw Error('Choose a photograph and describe it before publishing.');
    data.image=pendingImage;data.alt=$('alt').value;
  }
  const controls=['page','field','publish','restore','photo','copy','alt'];
  controls.forEach(id=>$(id).disabled=true);
  try {current=await api(pageUrl(),data);displayField();say(restore?'Previous version restored.':'Published to the website.');}
  finally {controls.forEach(id=>$(id).disabled=false);$('restore').disabled=!current.canRestore;}
}
if ($('editor')) {
  $('page').onchange=run(loadPage);$('field').onchange=displayField;$('photo').onchange=run(preparePhoto);
  $('edit-form').onsubmit=e=>{e.preventDefault();run(save)();};$('restore').onclick=run(()=>save(true));
  $('edit-form').hidden=true;
  run(async()=>{pages=await api('/editor-pages.json');for(const [path,def] of Object.entries(pages)) $('page').add(new Option(def.title+' · '+path,path));await loadPage();await loadAttention();})();
}
function addEntry(row) {
  const details=document.createElement('details'), summary=document.createElement('summary'), dl=document.createElement('dl'), button=document.createElement('button');
  const title=()=>{summary.textContent=[row.status,row.entry.name,row.entry.team,new Date(row.created).toLocaleDateString()].join(' · ');button.textContent=row.status==='New'?'Mark resolved':'Reopen';};
  title();for(const [key,value] of Object.entries({...row.entry,received:new Date(row.created).toLocaleString()})) {
    if (!value) continue; const dt=document.createElement('dt'), dd=document.createElement('dd');
    dt.textContent=key[0].toUpperCase()+key.slice(1);dd.textContent=value;dl.append(dt,dd);
  }
  button.onclick=run(async()=>{button.disabled=true;try{const r=await api('/admin/enquiries',{id:row.id,status:row.status==='New'?'Resolved':'New'});row.status=r.status;title();}finally{button.disabled=false;}});
  details.append(summary,dl,button);$('entries').append(details);
}
let inboxLoad=0;
async function loadInbox(more=false) {
  const ticket=++inboxLoad;
  const rows=await api('/admin/enquiries'+(more?'?before='+cursor:''));
  if(ticket!==inboxLoad)return;
  if(!more)$('entries').replaceChildren();for(const row of rows)addEntry(row);
  if(!more && !rows.length)$('entries').textContent='No enquiries yet.';
  cursor=rows.at(-1)?.cursor;$('older').hidden=rows.length<30;
}
const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach(tab=>tab.onclick=run(async()=>{for(const t of tabs){const active=t===tab;t.setAttribute('aria-pressed',active);$(t.dataset.tab).hidden=!active;}say('');if(tab.dataset.tab==='inbox')await loadInbox();}));
if ($('inbox')) {$('refresh').onclick=run(()=>loadInbox());$('older').onclick=run(()=>loadInbox(true));}
tabs[0].click();
