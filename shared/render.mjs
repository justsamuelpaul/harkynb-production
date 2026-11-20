// Page fragments shared by the static build and the public Worker, so live staff edits render exactly like built pages.
// Pure functions only: no Node or Worker APIs.
import {workCategories} from '../content/catalogue.mjs';
export const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeUrl=v=>{let s=String(v??'');if(s.startsWith('/')&&!s.startsWith('//'))return e(s);try{const u=new URL(s);if(['https:','http:'].includes(u.protocol))return e(u.href);}catch{}return '';};
export const link=(href,text,cls='button')=>`<a class="${cls}" href="${e(href)}">${text}<span aria-hidden="true">&#8599;</span></a>`;
const academyOther=['Education sponsorship','Sponsorship','Education partnership','Institutional training'];
export const contact=(team='production',service='')=>team==='academy'&&!academyOther.includes(service)?`/brands/academy/register/?service=${encodeURIComponent(service)}`:`/contact/?team=${encodeURIComponent(team)}&service=${encodeURIComponent(service)}`;
export const tag=t=>`<span class="eyebrow">${t}</span>`;
export const heading=(k,h,p='')=>`${tag(k)}<h2>${h}</h2>${p?`<p class="lede">${p}</p>`:''}`;
export const section=(body,cls='')=>`<section class="section ${cls}"><div class="wrap">${body}</div></section>`;
export const empty=(title,text)=>`<div class="empty"><span aria-hidden="true" class="empty-icon">▧</span><div><h3>${title}</h3><p>${text}</p></div></div>`;
export const hero=(k,h,p,buttons='',mark='')=>`<section class="page-hero"><div class="wrap">${mark?`<div class="hero-mark">${mark}</div>`:''}${tag(k)}<h1>${h}</h1><div class="hero-bottom"><p class="lede">${p}</p><div class="actions">${buttons}</div></div></div></section>`;
const filters=(cats,id)=>`<div class="filters" role="group" aria-label="${id} categories">${cats.map((c,i)=>`<button type="button" class="filter ${i===0?'active':''}" data-filter="${e(c)}" aria-pressed="${i===0}">${e(c)}</button>`).join('')}</div>`;
// Filters list only categories that have items, and are omitted when they would not narrow anything.
export const gallery=(items,cats,id,blank)=>{const used=cats.filter((c,i)=>i===0||items.some(p=>p.category===c));return `<div data-gallery>${used.length>2?filters(used,id):''}<div class="gallery-grid">${items.map(p=>`<article data-category="${e(p.category)}"><button class="photo-button" type="button" data-photo="${safeUrl(p.image)}" data-caption="${e(p.title)}" aria-label="Enlarge ${e(p.title)}"><img src="${safeUrl(p.image)}" alt="${e(p.alt||p.title)}" width="900" height="700" loading="lazy"></button>${tag(e(p.category))}<h3>${e(p.title)}</h3><p>${e(p.description||'')}</p>${p.credit?`<small class="photo-credit">Photo: ${e(p.credit)}</small>`:''}${p.slug?link(`/work/${p.slug}/`,'View project','text-link'):''}</article>`).join('')}</div><div data-empty ${items.length?'hidden':''}>${empty(blank,'Approved photographs and project details will appear here. Tell us about the work you have in mind.')}</div></div>`;}
export const cta=(team='production')=>section(`<div class="cta"><div>${tag('Your next chapter')}<h2>Let’s create something<br>worth remembering.</h2><p>A project, a story, a new skill. It starts with a conversation.</p></div>${link(contact(team),'Start a conversation')}</div>`,'cta-section');

// Teams that can receive enquiries.
export const teams=['production','onevoicefm','shotit','academy','summit'];
export const shotitCategories=['All','Weddings','Portraits','Corporate','Brands','Film'];

// Staff-editable list regions. The comment markers keep these regions out of the page text editor;
// data-collection lets the public Worker replace the region with the published list.
export const collection=(name,view,inner)=>`<!--collection--><div data-collection="${name}" data-view="${view}">${inner}</div><!--/collection-->`;
export const newsList=items=>items.length?`<div class="three-col">${items.map(n=>`<article>${tag(e(n.date||'Update'))}<h3>${e(n.title)}</h3><p>${e(n.description)}</p>${safeUrl(n.url)?link(n.url,'Read update','text-link'):''}</article>`).join('')}</div>`:empty('New stories are on their way.','Approved news and programme announcements will appear here. In the meantime, explore the platforms behind the stories.');
export const views={
  'projects:work':items=>gallery(items,workCategories,'Portfolio','The portfolio is being curated.'),
  'projects:shotit':items=>gallery(items.filter(p=>shotitCategories.includes(p.category)),shotitCategories,'Studio portfolio','Selected photographs will appear here.'),
  'news:list':newsList
};
const teamOf=p=>teams.includes(p.team)?p.team:'production';
// Main content of a project detail page.
export const projectMain=p=>hero(e(p.category),e(p.title),e(p.description||''),link(contact(teamOf(p),p.category),'Plan a similar project'))
  +section(`<div class="project-cover"><img src="${safeUrl(p.image)}" alt="${e(p.alt||p.title)}" width="1400" height="900"></div><p>${e(p.location||'')}</p><p>${e(p.services||'')}</p>${gallery((p.gallery||[]).map(g=>({...g,category:p.category})),['All'],'Project images','More images will follow.')}`)
  +cta(teamOf(p));
