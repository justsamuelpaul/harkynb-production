const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const site='https://hbproduction.co';
// Shared top-of-page markup for every portal page, including the console (studio-view.mjs).
export const portalHead=title=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#ffffff"><title>${title} | HarkynB Production</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/studio.css">`;
export const portalHome='<a class="portal-home" href="/admin/"><img class="portal-logo" src="/brand/harkynb-production.png" alt="HarkynB Production" width="228" height="144"><span>Staff portal</span></a>';
export const logout='<form method="post" action="/logout" class="logout"><button type="submit" class="ghost">Log out</button></form>';

// Small line icons. Decorative only: every icon sits next to a visible text label.
const paths={
  inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
  editor:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  lists:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="8.5" r="1.5"/>',
  team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.8 3.4-6 6.5-6s5.7 2.2 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.4c1.9.8 3.1 2.8 3.5 5.6"/>',
  external:'<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/>'
};
export const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
const initial=name=>escape((name||'?').trim().charAt(0).toUpperCase()||'?');

// Top bar for signed-in pages: logo, who is signed in, log out.
export function appHeader(name,extra=''){
  return `<header class="topbar">${portalHome}<div class="topbar-user">${extra}${name?`<span class="user-chip"><span class="avatar" aria-hidden="true">${initial(name)}</span><span class="user-name"><span class="visually-hidden">Signed in as </span>${escape(name)}</span></span>`:''}${logout}</div></header>`;
}
// Section navigation. In the console the first three are tab buttons (studio.js); elsewhere they link back to the console.
export function appNav(role,current){
  const editor=role!=='inbox', inbox=role!=='editor', inConsole=current==='console';
  const item=(tab,label,extra='')=>inConsole
    ?`<button type="button" class="nav-item" data-tab="${tab}">${icon(tab)}<span class="nav-label">${label}</span>${extra}</button>`
    :`<a class="nav-item" href="/admin/#${tab}">${icon(tab)}<span class="nav-label">${label}</span></a>`;
  return `<nav class="sidenav" aria-label="Portal sections"><div class="nav-group">${inbox?item('inbox','Enquiries','<span id="badge" class="badge" hidden></span>'):''}${editor?item('editor','Website text &amp; photos')+item('lists','Portfolio &amp; news'):''}${role==='manager'?`<a class="nav-item" href="/team"${current==='team'?' aria-current="page"':''}>${icon('team')}<span class="nav-label">Staff access</span></a>`:''}</div><a class="nav-item nav-external" href="${site}" target="_blank" rel="noopener">${icon('external')}<span class="nav-label">View website</span></a></nav>`;
}

// Login, signup and approval pages: one centred card.
function card(title,body,{lead='',iconName=''}={}){
  return `<!doctype html><html lang="en"><head>${portalHead(title)}</head><body class="entrance-page"><main class="entrance"><div class="entrance-brand"><img class="entrance-logo" src="/brand/harkynb-production.png" alt="HarkynB Production" width="228" height="144"><span>Staff portal</span></div><section class="entrance-card">${iconName?`<span class="entrance-icon">${icon(iconName)}</span>`:''}<h1>${title}</h1>${lead?`<p class="lead">${lead}</p>`:''}${body}</section><p class="entrance-foot"><a href="${site}">Go to the HarkynB website ${icon('external')}</a></p></main></body></html>`;
}
export function entrance(signup=false,message=''){
 const title=signup?'Create a staff account':'Staff login';
 const lead=signup?'Choose a username and password. A manager will approve your access before you can use the portal.':'Sign in to manage the HarkynB website and enquiries.';
 return card(title,`${message?'<p role="alert" class="alert-box">'+escape(message)+'</p>':''}<form method="post" action="/${signup?'signup':'login'}" class="stack"><label>Username<input name="name" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="64" pattern="[A-Za-z0-9._\\-]{3,64}"><small>3 to 64 letters, numbers, dots, dashes or underscores.</small></label><label>Password<input type="password" name="password" autocomplete="${signup?'new-password':'current-password'}" required maxlength="256" ${signup?'minlength="15"':''}>${signup?'<small>Use at least 15 characters. A short sentence is easy to remember.</small>':''}</label>${signup?'<label>Confirm password<input type="password" name="confirm" autocomplete="new-password" required></label>':''}<button class="primary block" type="submit">${signup?'Create account':'Log in'}</button></form><p class="switch">${signup?'Already registered? <a href="/login">Log in</a>':'New staff member? <a href="/signup">Create an account</a>'}</p>${signup?'':'<p class="hint">Forgotten your password? Ask a manager to approve a new account for you.</p>'}`,{lead,iconName:'lock'});
}
export function pending(user){return card('Awaiting approval',`<p>You are signed in as <strong>${escape(user.name)}</strong>. A manager needs to approve your access before you can use the portal. They will find your username under <strong>Staff access</strong>.</p><p class="hint">If they ask, this is your account ID:</p><p class="account-id"><code>${escape(user.id)}</code></p><div class="row-actions"><a class="button primary" href="/admin/">Check again</a>${logout}</div>`,{iconName:'clock'});}

const roles=[['pending','No access yet','Waiting for approval. Cannot see anything.'],['editor','Website editor','Edits page text, photos, portfolio and news. Sees enquiry counts only.'],['inbox','Enquiries','Reads, assigns and resolves enquiries.'],['manager','Manager','Everything, plus approving staff.']];
const roleName=r=>(roles.find(x=>x[0]===r)||[r,r])[1];
export function team(rows,ownerId,me={}){
  const order=u=>u.id===ownerId?0:u.role==='pending'?1:2;
  const waiting=rows.filter(u=>u.role==='pending'&&u.id!==ownerId).length;
  const person=u=>{
    const owner=u.id===ownerId, wait=!owner&&u.role==='pending';
    return `<li class="staff-row${wait?' waiting':''}"><div class="staff-who"><span class="avatar" aria-hidden="true">${initial(u.name)}</span><div><strong class="staff-name">${escape(u.name)}</strong> ${owner?'<span class="pill pill-owner">Owner</span>':wait?'<span class="pill pill-new">Waiting for approval</span>':`<span class="pill">${roleName(u.role)}</span>`}<p class="hint">Account ID <code>${escape(u.id)}</code></p></div></div>${owner?'<p class="hint staff-fixed">The owner always has full access.</p>':`<form method="post" action="/team" class="staff-form"><input type="hidden" name="id" value="${escape(u.id)}"><label>Access for ${escape(u.name)}<select name="role">${roles.map(([r,n])=>`<option value="${r}" ${r===u.role?'selected':''}>${n}</option>`).join('')}</select></label><button class="primary" type="submit">Save access</button></form>`}</li>`;
  };
  const check='Check with each person that the username is theirs before you approve it.';
  return `<!doctype html><html lang="en"><head>${portalHead('Staff access')}</head><body class="app">${appHeader(me.name)}<div class="app-shell">${appNav('manager','team')}<main class="app-main" id="main"><div class="page-head"><div><h1>Staff access</h1><p class="lead">Approve new staff and choose what each person can do.</p></div></div>${waiting?`<p class="banner banner-warn"><strong>${waiting} ${waiting===1?'person is':'people are'} waiting for approval.</strong> ${check}</p>`:''}<section class="card"><h2>Access levels</h2><ul class="roles">${roles.map(([,n,d])=>`<li><strong>${n}</strong><span>${d}</span></li>`).join('')}</ul></section><section class="card"><h2>Staff <span class="count">${rows.length}</span></h2><ul class="staff-list">${[...rows].sort((a,b)=>order(a)-order(b)).map(person).join('')}</ul>${waiting?'':`<p class="hint">${check}</p>`}</section></main></div></body></html>`;
}
