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
    const img=document.querySelector('#lightbox-img');img.src=button.dataset.photo;img.alt=button.dataset.caption||'';
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
  const settings=fetch('/settings.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>({contacts:{}}));
  let downloadUrl='';
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();if(!form.reportValidity())return;
    if(!form.elements.name.value.trim()||form.elements.message.value.trim().length<10){form.elements.message.setCustomValidity('Please enter a message of at least 10 non-space characters.');form.elements.message.reportValidity();return;}
    form.elements.message.setCustomValidity('');
    const data=Object.fromEntries(new FormData(form));const teamLabel=team.selectedOptions[0].textContent;
    const text=`HarkynB enquiry\nTeam: ${teamLabel}\nName: ${data.name}\nOrganisation: ${data.organisation||'Not provided'}\nEmail: ${data.email}\nPhone: ${data.phone||'Not provided'}\nService: ${data.service||'General enquiry'}\nProject date: ${data.date||'To discuss'}\nLocation: ${data.location||'To discuss'}\nEstimated budget: ${data.budget||'To discuss'}\nPreferred contact: ${data.method}\n\n${data.message}`;
    const config=await settings;const target=config.contacts?.[data.team]||{};
    result.replaceChildren();const p=document.createElement('p');p.textContent='Your enquiry draft is ready. It has not been sent. Download it or open an available contact app to review and send.';result.append(p);
    const preview=document.createElement('pre');preview.textContent=text;result.append(preview);
    if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const download=document.createElement('a');download.href=downloadUrl;download.download='harkynb-enquiry.txt';download.className='button';download.textContent='Download enquiry';result.append(download);
    if(target.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)){const email=document.createElement('a');email.className='text-link';email.href=`mailto:${target.email}?subject=${encodeURIComponent(`${data.service||'Project'} enquiry`)}&body=${encodeURIComponent(text)}`;email.textContent='Open email draft';result.append(email);}
    if(target.whatsapp&&/^\d{8,15}$/.test(target.whatsapp)){const wa=document.createElement('a');wa.className='text-link';wa.href=`https://wa.me/${target.whatsapp}?text=${encodeURIComponent(text)}`;wa.textContent='Open WhatsApp draft';wa.target='_blank';wa.rel='noopener noreferrer';result.append(wa);}
    if(!target.email&&!target.whatsapp){const pending=document.createElement('p');pending.className='small';pending.textContent='Delivery is not configured for this team yet. Keep your downloaded draft until contact details are confirmed.';result.append(pending);}
    result.hidden=false;result.focus();
  });
  form.elements.message.addEventListener('input',()=>form.elements.message.setCustomValidity(''));
})();
