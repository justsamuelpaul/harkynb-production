(() => {
  const menu = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#main-nav');
  const closeMenu = () => {nav?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');};
  menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&nav?.classList.contains('is-open')){closeMenu();menu.focus();}});
  document.addEventListener('click',ev=>{if(nav?.classList.contains('is-open')&&!nav.contains(ev.target)&&!menu.contains(ev.target))closeMenu();});
  window.matchMedia('(min-width: 821px)').addEventListener('change',ev=>{if(ev.matches)closeMenu();});
  document.querySelectorAll('[data-gallery]').forEach(group=>{
    group.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
      group.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
      let count=0;
      group.querySelectorAll('[data-category]').forEach(card=>{const show=button.dataset.filter==='All'||card.dataset.category===button.dataset.filter;card.hidden=!show;if(show)count++;});
      const blank=group.querySelector('[data-empty]');if(blank)blank.hidden=count>0;
    }));
  });
  const dialog=document.querySelector('#lightbox');
  document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{
    if(!button.dataset.photo)return;
    const img=document.querySelector('#lightbox-img');const source=button.querySelector('img');img.src=source?.currentSrc||button.dataset.photo;img.alt=source?.alt||button.dataset.caption||'';
    document.querySelector('#lightbox-caption').textContent=button.dataset.caption||'';dialog.showModal();
  }));
  dialog?.querySelector('.close-dialog')?.addEventListener('click',()=>dialog.close());
  dialog?.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}});
  const radio=document.querySelector('[data-radio]');
  radio?.addEventListener('error',()=>{document.querySelector('#radio-status').textContent='The stream could not be reached. Please try again later.';});
  const form=document.querySelector('#enquiry-form');if(!form)return;
  // One form per team (shared/forms.mjs). Only the chosen team's fieldset, and only the follow-up
  // questions that apply to its answers, are enabled, so disabled ones are left out of the submission.
  const team=form.elements.team,result=document.querySelector('#form-result');
  const sets=[...form.querySelectorAll('[data-team-form]')];
  const active=()=>sets.find(s=>s.dataset.teamForm===team.value);
  const answers=set=>{const a={};set.querySelectorAll('input,select,textarea').forEach(i=>{if(i.disabled||!i.name)return;if(i.type==='checkbox'){(a[i.name]||=[]);if(i.checked)a[i.name].push(i.value);}else if(i.type==='radio'){if(i.checked)a[i.name]=i.value;}else a[i.name]=i.value;});return a;};
  const conditions=()=>{const set=active();
    // Repeat until stable: a follow-up question can depend on another follow-up (age, then guardian).
    for(let pass=0;pass<3;pass++){const a=answers(set);let changed=false;
      set.querySelectorAll('.cond').forEach(c=>{const when=JSON.parse(c.dataset.when),on=Object.entries(when).every(([k,v])=>[].concat(a[k]||[]).some(x=>v.includes(x)));
        if(c.hidden===on)changed=true;c.hidden=!on;c.querySelectorAll('input,select,textarea').forEach(i=>i.disabled=!on);});
      if(!changed)break;}};
  const show=()=>{sets.forEach(s=>{const on=s===active();s.hidden=!on;s.disabled=!on;});conditions();highlight();result.hidden=true;};
  const highlight=()=>document.querySelectorAll('[data-team-link]').forEach(a=>a.classList.toggle('selected',a.dataset.teamLink===team.value));
  const prefill=desired=>{const set=active();if(!desired||desired.length>150)return;
    const choose=(name,value)=>set.querySelectorAll(`[name="${CSS.escape(name)}"]:not(:disabled)`).forEach(i=>{if(i.type==='checkbox'||i.type==='radio'){if(i.value===value)i.checked=true;}else if(i.tagName==='SELECT'){if([...i.options].some(o=>o.value===value))i.value=value;}});
    const alias=JSON.parse(set.dataset.aliases||'{}')[desired];
    if(alias){for(const [k,v] of Object.entries(alias)){choose(k,v);conditions();}return;}
    set.querySelectorAll('select,input[type=radio],input[type=checkbox]').forEach(i=>choose(i.name,desired));conditions();};
  const params=new URLSearchParams(location.search);
  if([...team.options].some(o=>o.value===params.get('team')))team.value=params.get('team');
  show();prefill(params.get('service'));
  document.querySelectorAll('[data-team-link]').forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();team.value=a.dataset.teamLink;show();form.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}));
  team.addEventListener('change',show);
  form.addEventListener('change',ev=>{if(ev.target!==team)conditions();});
  // "Choose at least one" for required tick-box groups.
  const checkGroups=()=>{active().querySelectorAll('.choice[data-required]').forEach(g=>{const boxes=[...g.querySelectorAll('input[type=checkbox]')];if(!boxes.length)return;const ok=boxes[0].disabled||boxes.some(b=>b.checked);boxes[0].setCustomValidity(ok?'':'Choose at least one option.');});};
  let requestId = crypto.randomUUID();
  form.addEventListener('input', () => { requestId = crypto.randomUUID(); result.hidden=true; checkGroups(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    checkGroups();
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...answers(active()), team: team.value, requestId})
      });
      const reply = await response.json();
      if (!response.ok || !reply.saved) throw Error(reply.error || 'Please try again.');
      const chosen = team.value;
      form.reset();
      team.value = chosen; show();
      requestId = crypto.randomUUID();
      result.textContent = 'Your enquiry has been sent to HarkynB. Thank you.';
    } catch (error) {
      result.textContent = 'Delivery could not be confirmed. Your entries are still here. ' + (error.message || 'Please try again.');
    } finally {
      button.disabled = false;
      result.hidden = false;
      result.focus();
    }
  });
})();
