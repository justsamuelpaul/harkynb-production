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
const teamNames={production:'HarkynB Production',onevoicefm:'Onevoicefm',shotit:'HarkynBShotIt',academy:'Creators Academy',summit:'Future Creators Summit'};
let staff=[], me='';
function addEntry(row) {
  const summary=el('summary'), dl=el('dl');
  const status=el('select',{},...['New','In progress','Resolved'].map(s=>new Option(s,s)));
  const owner=el('select',{},new Option('Unassigned',''),...staff.map(s=>new Option(s.id===me?s.name+' (me)':s.name,s.id)));
  if (row.assignee && !staff.some(s=>s.id===row.assignee)) owner.add(new Option(row.assigneeName+' (no inbox access)',row.assignee));
  const title=()=>{
    status.value=row.status; owner.value=row.assignee||'';
    summary.textContent=[row.status,row.entry.name,teamNames[row.entry.team]||row.entry.team,row.assigneeName?'Assigned to '+row.assigneeName:'Unassigned',new Date(row.created).toLocaleDateString()].join(' · ');
  };
  for (const [key,value] of Object.entries({...row.entry,team:teamNames[row.entry.team]||row.entry.team,received:new Date(row.created).toLocaleString()})) {
    if (value) dl.append(el('dt',{textContent:key[0].toUpperCase()+key.slice(1)}),el('dd',{textContent:value}));
  }
  const change=async data=>{
    status.disabled=owner.disabled=true;
    try {Object.assign(row,await api('/admin/enquiries',{id:row.id,...data})); say('Enquiry updated.');}
    finally {status.disabled=owner.disabled=false; title();}
    refreshAlerts();
  };
  status.onchange=run(()=>change({status:status.value}));
  owner.onchange=run(()=>change({assignee:owner.value}));
  title();
  $('entries').append(el('details',{},summary,dl,el('div',{className:'enquiry-actions'},el('label',{},'Status ',status),el('label',{},'Assigned to ',owner))));
}
let inboxLoad=0;
async function loadInbox(more=false) {
  const ticket=++inboxLoad;
  if (!staff.length) ({staff,me}=await api('/admin/staff'));
  const q=new URLSearchParams({team:$('f-team').value,status:$('f-status').value,assigned:$('f-assigned').value});
  if (more) q.set('before',cursor);
  const rows=await api('/admin/enquiries?'+q);
  if (ticket!==inboxLoad) return;
  if (!more) $('entries').replaceChildren();
  rows.forEach(addEntry);
  if (!more && !rows.length) $('entries').textContent='No enquiries match these filters.';
  cursor=rows.at(-1)?.cursor; $('older').hidden=rows.length<30;
  if (!more) showAlerts(await api('/admin/alerts/seen',{}));
}

// Dashboard alerts: every approved staff member sees counts; polling runs while the console is open.
let lastUnseen=null;
const desktopReady=()=>'Notification' in window && Notification.permission==='granted';
function showAlerts(a) {
  if ($('badge')) {$('badge').hidden=!a.unseen; $('badge').textContent=a.unseen;}
  document.title=(a.unseen?'('+a.unseen+') ':'')+'Staff console | HarkynB Production';
  const parts=[];
  if (a.unseen) parts.push(a.unseen+(a.unseen===1?' new enquiry':' new enquiries')+' since you last checked');
  if (a.mine) parts.push(a.mine+' assigned to you and still open');
  if (parts.length && a.open) parts.push(a.open+' open in total');
  $('alerts').hidden=!parts.length;
  $('alerts-text').textContent=parts.join(' · ')+(parts.length && !a.canRead?'. Inbox staff will follow these up.':'');
  $('alerts-seen').hidden=!a.unseen;
  if (lastUnseen!==null && a.unseen>lastUnseen && desktopReady() && document.hidden) new Notification('New HarkynB enquiry',{body:a.unseen+' unread in the staff console',tag:'harkynb-enquiries'});
  lastUnseen=a.unseen;
}
const refreshAlerts=run(async()=>showAlerts(await api('/admin/alerts')));
$('alerts-seen').onclick=run(async()=>{
  if ($('inbox') && $('inbox').hidden) {document.querySelector('[data-tab="inbox"]').click(); return;}
  showAlerts(await api('/admin/alerts/seen',{}));
});
if ('Notification' in window && Notification.permission==='default') {
  $('desktop-alerts').hidden=false;
  $('desktop-alerts').onclick=run(async()=>{await Notification.requestPermission(); $('desktop-alerts').hidden=true; say(desktopReady()?'Desktop alerts are on while the console is open.':'Desktop alerts were not allowed.');});
}
setInterval(refreshAlerts,30000);
document.addEventListener('visibilitychange',()=>{if (!document.hidden) refreshAlerts();});

const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach(tab=>tab.onclick=run(async()=>{for(const t of tabs){const active=t===tab;t.setAttribute('aria-pressed',active);$(t.dataset.tab).hidden=!active;}say('');if(tab.dataset.tab==='inbox')await loadInbox();}));
if ($('inbox')) {
  $('refresh').onclick=run(()=>loadInbox()); $('older').onclick=run(()=>loadInbox(true));
  for (const id of ['f-team','f-status','f-assigned']) $(id).onchange=run(()=>loadInbox());
}
tabs[0].click();
refreshAlerts();
