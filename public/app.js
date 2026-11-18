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
  const team=form.elements.team,service=form.elements.service,result=document.querySelector('#form-result');
  const params=new URLSearchParams(location.search);
  if([...team.options].some(o=>o.value===params.get('team')))team.value=params.get('team');
  const desired=params.get('service');if(desired&&desired.length<=150){if(![...service.options].some(o=>o.value===desired)){const option=new Option(desired,desired);service.add(option);}service.value=desired;}
  const highlight=()=>document.querySelectorAll('[data-team-link]').forEach(a=>a.classList.toggle('selected',a.dataset.teamLink===team.value));highlight();
  document.querySelectorAll('[data-team-link]').forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();team.value=a.dataset.teamLink;highlight();result.hidden=true;form.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}));
  form.addEventListener('input',()=>{result.hidden=true;});team.addEventListener('change',()=>{highlight();result.hidden=true;});
  let requestId = crypto.randomUUID();
  form.addEventListener('input', () => { requestId = crypto.randomUUID(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...Object.fromEntries(new FormData(form)), requestId})
      });
      const reply = await response.json();
      if (!response.ok || !reply.saved) throw Error(reply.error || 'Please try again.');
      form.reset();
      highlight();
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
