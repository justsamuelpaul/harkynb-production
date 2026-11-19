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
  $('public-page').href=new URL(path,'https://hbproduction.co').href; displayField(); renderOrphans();
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
// Resize to 1600px on the long edge and re-encode as a JPEG under the server's 900 KB limit. Returns a data URL.
async function compressPhoto(file) {
  if (file.size>25*1024*1024) throw Error('Choose a photograph smaller than 25 MB.');
  const bmp=await createImageBitmap(file);
  const scale=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
  let data;
  for(const q of [.84,.72,.55,.4]) {data=canvas.toDataURL('image/jpeg',q);if(data.length<1200000) break;}
  if (data.length>=1200000) throw Error('Choose a smaller photograph.');
  return data;
}
async function preparePhoto() {
  const ticket=++imageVersion, file=$('photo').files[0]; pendingImage=null;
  if (!file) {displayField();return;}
  const data=await compressPhoto(file);
  if (ticket!==imageVersion) return;
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
  const e=row.entry;
  const title=()=>{
    status.value=row.status; owner.value=row.assignee||'';
    summary.replaceChildren(el('span',{className:'status-tag '+row.status.toLowerCase().replace(/\s/g,'-'),textContent:row.status}),
      [e.name,teamNames[e.team]||e.team,e.topic||e.service,row.assigneeName?'Assigned to '+row.assigneeName:'Unassigned',new Date(row.created).toLocaleDateString()].filter(Boolean).join(' · '));
  };
  // Newer enquiries carry labelled answers from the team's own form; older ones are plain fields.
  const rows=[['Brand',teamNames[e.team]||e.team],['Name',e.name],['Email',e.email],['Phone',e.phone],
    ...(e.details||Object.entries(e).filter(([k])=>!['team','name','email','phone','message','method','topic','details'].includes(k)).map(([k,v])=>[k[0].toUpperCase()+k.slice(1),v])),
    ['Message',e.message],['Preferred contact',e.method],['Received',new Date(row.created).toLocaleString()],['Emails',row.emailNote]];
  for (const [label,value] of rows) if (value) dl.append(el('dt',{textContent:label}),el('dd',{textContent:value}));
  const digits=(e.phone||'').replace(/[^\d+]/g,''), wa=digits.replace(/^\+/,'').replace(/^0/,'234');
  const links=el('div',{className:'reply-links'},
    ...(e.email?[el('a',{className:'button-link',href:'mailto:'+e.email+'?subject='+encodeURIComponent('Your enquiry to '+(teamNames[e.team]||'HarkynB')),textContent:'Reply by email'})]:[]),
    ...(digits.length>=7?[el('a',{className:'button-link',href:'tel:'+digits,textContent:'Call'}),el('a',{className:'button-link',href:'https://wa.me/'+wa,target:'_blank',rel:'noopener',textContent:'WhatsApp'})]:[]));
  const change=async data=>{
    status.disabled=owner.disabled=true;
    try {Object.assign(row,await api('/admin/enquiries',{id:row.id,...data})); say('Enquiry updated.');}
    finally {status.disabled=owner.disabled=false; title();}
    refreshAlerts();
  };
  status.onchange=run(()=>change({status:status.value}));
  owner.onchange=run(()=>change({assignee:owner.value}));
  title();
  $('entries').append(el('details',{},summary,dl,links,el('div',{className:'enquiry-actions'},el('label',{},'Status ',status),el('label',{},'Assigned to ',owner))));
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


// Portfolio & news list editor. Edits stay in the browser until "Publish list"; photos upload as soon as they are chosen.
let listState=null, draft=[], listDirty=false, listLoad=0;
const slugify=s=>s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');
const markDirty=()=>{listDirty=true;};
const cleanItems=items=>JSON.parse(JSON.stringify(items,(k,v)=>k.startsWith('_')?undefined:v));
function textField(obj,key,label,{max=160,rows=0,type='text',hint='',onInput}={}) {
  const field=rows?el('textarea',{rows,maxLength:max}):el('input',{type,maxLength:max});
  field.value=obj[key]||'';
  field.oninput=()=>{obj[key]=field.value;markDirty();onInput?.(field.value);};
  return el('label',{},label,...(hint?[el('small',{textContent:hint})]:[]),field);
}
function choiceField(obj,key,label,options) {
  const field=el('select',{},...options.map(([value,text])=>new Option(text,value)));
  field.value=obj[key]||'';
  field.onchange=()=>{obj[key]=field.value;markDirty();};
  return el('label',{},label,field);
}
function photoField(obj,key,altKey,label) {
  const preview=el('img',{className:'list-photo',alt:''});
  preview.hidden=!obj[key]; if (obj[key]) preview.src=obj[key];
  const file=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp'});
  file.onchange=run(async()=>{
    if (!file.files[0]) return;
    file.disabled=true; say('Uploading photo…');
    try {
      const data=await compressPhoto(file.files[0]);
      const {id}=await api('/admin/media',{image:data.split(',')[1]});
      obj[key]='/media/'+id; preview.src=data; preview.hidden=false; markDirty();
      say('Photo uploaded. Publish the list to show it on the website.');
    } finally {file.disabled=false; file.value='';}
  });
  return el('div',{className:'list-photo-field'},el('strong',{textContent:label}),preview,el('label',{},obj[key]?'Replace photo':'Choose photo',file),textField(obj,altKey,'Photo description',{max:300,hint:'Describe what the photo shows, for visitors using screen readers.'}));
}
function moveButtons(array,i,rerender,noun) {
  const move=to=>()=>{const [item]=array.splice(i,1);array.splice(to,0,item);markDirty();rerender();};
  const remove=()=>{if(!confirm('Remove this '+noun+'? It will disappear from the website when you publish.'))return;array.splice(i,1);markDirty();rerender();};
  return el('div',{className:'item-controls'},
    el('button',{type:'button',textContent:'Move up',disabled:i===0,onclick:move(i-1)}),
    el('button',{type:'button',textContent:'Move down',disabled:i===array.length-1,onclick:move(i+1)}),
    el('button',{type:'button',textContent:'Remove',onclick:remove}));
}
function projectFields(p) {
  const slugInput=textField(p,'slug','Web address',{max:80,hint:'Lowercase words joined by hyphens. The page will be at /work/<web address>/.',onInput:()=>{p._autoSlug=false;}});
  const title=textField(p,'title','Project title',{onInput:value=>{if(p._autoSlug){p.slug=slugify(value);slugInput.querySelector('input').value=p.slug;}}});
  const galleryBox=el('div',{className:'list-gallery'});
  const renderGallery=()=>galleryBox.replaceChildren(...(p.gallery||[]).map((g,j)=>el('div',{className:'list-gallery-item'},
    photoField(g,'image','alt','Gallery photo '+(j+1)),textField(g,'title','Caption'),textField(g,'credit','Credit',{max:120}),moveButtons(p.gallery,j,renderGallery,'photo'))));
  renderGallery();
  return [title,slugInput,
    choiceField(p,'category','Category',[['','Choose a category'],...listState.categories.map(c=>[c,c])]),
    choiceField(p,'team','Enquiries from this page go to',[['','HarkynB Production'],...listState.teams.filter(t=>t!=='production').map(t=>[t,teamNames[t]||t])]),
    textField(p,'description','Summary',{max:600,rows:3}),textField(p,'services','Services delivered',{max:200}),textField(p,'location','Location',{max:120}),
    textField(p,'credit','Credit',{max:120,hint:'The brand that produced the work, such as HarkynBShotIt.'}),
    photoField(p,'image','alt','Cover photo'),
    el('h4',{textContent:'Gallery'}),galleryBox,
    el('button',{type:'button',textContent:'Add gallery photo',onclick:()=>{(p.gallery||=[]).push({title:'',image:'',alt:'',credit:p.credit||''});markDirty();renderGallery();}})];
}
const newsFields=n=>[textField(n,'title','Headline'),textField(n,'date','Date',{max:40,hint:'As it should appear, for example 18 November 2026.'}),textField(n,'description','Summary',{max:600,rows:3}),textField(n,'url','Link to the full story (optional)',{max:500,type:'url',hint:'Must start with https://'})];
function renderList() {
  const name=$('list-name').value;
  $('list-items').replaceChildren(...draft.map((item,i)=>{
    const summary=el('summary',{textContent:(i+1)+'. '+(item.title||'Untitled')+(item.category?' · '+item.category:'')+(item.date?' · '+item.date:'')});
    return el('details',{open:!item.title},summary,...(name==='news'?newsFields(item):projectFields(item)),moveButtons(draft,i,renderList,name==='news'?'update':'project'));
  }));
  if (!draft.length) $('list-items').textContent=name==='news'?'No news updates yet.':'No projects yet.';
  $('list-status').textContent=listState.published?'This list is managed here. Changes appear on the website when you publish.':'Showing the content built with the website. Once you publish, this list is managed here.';
  $('list-restore').disabled=!listState.canRestore;
  $('list-add').textContent=name==='news'?'Add news update':'Add project';
}
async function loadList() {
  const ticket=++listLoad, state=await api('/admin/collections?name='+$('list-name').value);
  if (ticket!==listLoad) return;
  listState=state; draft=structuredClone(state.items); listDirty=false; renderList();
}
async function saveList(restore=false) {
  if (restore && !confirm('Restore the previous published version of this list? Unsaved changes will be lost.')) return;
  const body=restore?{revision:listState.revision,restore:true}:{revision:listState.revision,items:cleanItems(draft)};
  const buttons=['list-add','list-publish','list-restore','list-reset'].map($);
  buttons.forEach(b=>b.disabled=true);
  try {await api('/admin/collections?name='+$('list-name').value,body);}
  finally {buttons.forEach(b=>b.disabled=false);}
  await loadList(); say(restore?'Previous version restored.':'Published to the website.');
}
if ($('lists')) {
  $('list-name').onchange=run(async()=>{
    if (listDirty && !confirm('Discard unsaved changes to this list?')) {$('list-name').value=$('list-name').value==='news'?'projects':'news';return;}
    await loadList();
  });
  $('list-add').onclick=()=>{draft.push($('list-name').value==='news'?{title:'',date:'',description:'',url:''}:{_autoSlug:true,slug:'',title:'',category:'',team:'',description:'',location:'',services:'',image:'',alt:'',credit:'',gallery:[]});markDirty();renderList();};
  $('list-publish').onclick=run(()=>saveList());
  $('list-restore').onclick=run(()=>saveList(true));
  $('list-reset').onclick=run(async()=>{if(!listDirty||confirm('Discard unsaved changes?'))await loadList();});
  addEventListener('beforeunload',e=>{if(listDirty)e.preventDefault();});
}
const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach(tab=>tab.onclick=run(async()=>{for(const t of tabs){const active=t===tab;t.setAttribute('aria-pressed',active);$(t.dataset.tab).hidden=!active;}say('');if(tab.dataset.tab==='inbox')await loadInbox();if(tab.dataset.tab==='lists'&&!listState)await loadList();}));
if ($('inbox')) {
  $('refresh').onclick=run(()=>loadInbox()); $('older').onclick=run(()=>loadInbox(true));
  for (const id of ['f-team','f-status','f-assigned']) $(id).onchange=run(()=>loadInbox());
}
tabs[0].click();
refreshAlerts();
