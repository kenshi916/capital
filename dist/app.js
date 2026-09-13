'use strict';

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number.isInteger(value)?0:2}).format(value);
const escapeHtml = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opportunities = FUNDING_OPPORTUNITIES.map(c=>({availability:'open',statusNote:'The source listed this offering as fundraising on September 13, 2026.',documents:null,additionalSources:[],minimum:null,closing:null,...c}));
const state = {filter:'All',query:'',sort:'featured',view:'treasury',demoAccount:true,selected:null,profileTab:'overview',watched:new Set(opportunities.filter(c=>['miso-robotics','startengine','atombeam'].includes(c.id)).map(c=>c.id))};
const dateLabel = date => date ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Not stated';
const deadlinePassed = c => c.closingAt ? new Date(c.closingAt)<new Date() : c.closing && c.closing<new Date().toISOString().slice(0,10);
const availabilityLabel = c => c.availability==='closed'?'Previous round closed':c.availability==='unverified'?'Funding status unverified':deadlinePassed(c)?'Listed deadline passed':'Offering reported open';
const hasCurrentTerms = c => c.availability==='open';
const minimumLabel = c => hasCurrentTerms(c)&&c.minimum!==null?money(c.minimum):'Check source';
const instrumentLabel = c => c.instrument==='Debt'?'Business loan':c.security||'Equity research';
const bookmarkIcon = saved => `<svg viewBox="0 0 24 24" aria-hidden="true"${saved?' class="saved-icon"':''}><path d="M6 4h12v17l-6-4-6 4Z"/></svg>`;
const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';
function watchButton(c,extraClass='') {return `<button class="watch-button ${extraClass}" data-watch="${c.id}" aria-pressed="${state.watched.has(c.id)}" aria-label="${state.watched.has(c.id)?'Remove':'Add'} ${escapeHtml(c.name)} ${state.watched.has(c.id)?'from':'to'} research watchlist">${bookmarkIcon(state.watched.has(c.id))}</button>`;}
function opportunityCard(c){return `<article class="opportunity-card">
  <div class="opportunity-media"><button data-opportunity="${c.id}" aria-label="Read ${escapeHtml(c.name)} business profile"><img src="${c.thumbnail||c.image}" alt="${escapeHtml(c.imageAlt)}" width="720" height="460" loading="eager" decoding="async" style="object-position:${c.imagePosition||'center'}"></button>${watchButton(c)}</div>
  <div class="opportunity-body"><div class="opportunity-category"><span>${escapeHtml(c.category)}</span><span>${escapeHtml(c.platform)}</span></div><h3><button data-opportunity="${c.id}">${escapeHtml(c.name)}</button></h3><p class="opportunity-description">${escapeHtml(c.description)}</p>
    <div class="offering-status ${c.availability!=='open'||deadlinePassed(c)?'status-muted':''}">${availabilityLabel(c)}</div><div class="opportunity-metrics"><div><span>${hasCurrentTerms(c)?(c.feeNote?'Minimum, before fees':'Minimum investment'):'Current terms'}</span><strong>${minimumLabel(c)}</strong>${c.feeNote?'<small class="fee-caption">+ 3.5% fee</small>':''}</div><div><span>Instrument</span><strong class="instrument-value">${escapeHtml(instrumentLabel(c))}</strong></div></div>
    <button class="profile-link" data-opportunity="${c.id}">Explore business ${arrowIcon}</button>
  </div></article>`;}
function filteredCompanies(){return opportunities.filter(c=>(state.filter==='All'||c.instrument===state.filter||c.sector===state.filter||(state.filter==='Watchlist'&&state.watched.has(c.id)))&&`${c.name} ${c.sector} ${c.category} ${c.location} ${c.platform}`.toLowerCase().includes(state.query.toLowerCase().trim())).sort((a,b)=>{
  if(state.sort==='name')return a.name.localeCompare(b.name);
  if(state.sort==='minimum')return (hasCurrentTerms(a)&&a.minimum!==null?a.minimum:Infinity)-(hasCurrentTerms(b)&&b.minimum!==null?b.minimum:Infinity);
  if(state.sort==='closing')return (hasCurrentTerms(a)&&a.closing?a.closing:'9999').localeCompare(hasCurrentTerms(b)&&b.closing?b.closing:'9999');
  return opportunities.indexOf(a)-opportunities.indexOf(b);
});}
function renderCompanies(){
  const list=filteredCompanies(),equity=list.filter(c=>c.instrument==='Equity'),debt=list.filter(c=>c.instrument==='Debt');
  $('#equity-grid').innerHTML=equity.map(opportunityCard).join('');$('#debt-grid').innerHTML=debt.map(opportunityCard).join('');
  $('#equity-section').hidden=!equity.length;$('#debt-section').hidden=!debt.length;$('#empty-state').hidden=!!list.length;
  $('#company-count').textContent=String(opportunities.length);$('#equity-total').textContent=String(equity.length);$('#loan-total').textContent=String(debt.length);$('#watch-filter-count').textContent=String(state.watched.size);
  $('#results-announcement').textContent=`${list.length} ${list.length===1?'business':'businesses'} shown`;
  document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===state.filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function renderWatchlist(){
  const watched=opportunities.filter(c=>state.watched.has(c.id));$('#watchlist-count').textContent=String(watched.length);
  $('#research-peek').innerHTML=watched.length?watched.slice(0,3).map(c=>`<button class="research-card" data-opportunity="${c.id}"><img src="${c.thumbnail||c.image}" alt="${escapeHtml(c.imageAlt)}" loading="eager" decoding="async" style="object-position:${c.imagePosition||'center'}"><span class="research-card-copy"><span>${escapeHtml(c.category)}</span><strong>${escapeHtml(c.name)}</strong><small>${availabilityLabel(c)}</small></span>${arrowIcon}</button>`).join(''):'<div class="research-empty">Your research list is empty. Use the bookmark on a business profile to add it for this session.</div>';
}
function toggleWatch(id){const c=opportunities.find(c=>c.id===id);if(!c)throw new Error('Unknown business');if(state.watched.has(id))state.watched.delete(id);else state.watched.add(id);renderCompanies();renderWatchlist();if($('#holding-dialog').open&&state.selected===id)renderProfile(c);toast(`${c.name} ${state.watched.has(id)?'added to':'removed from'} your session watchlist.`);return {id,watched:state.watched.has(id),sessionOnly:true};}
function sourceLink(url,label,detail=''){return `<a class="document-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(label)}</strong>${detail?`<small>${escapeHtml(detail)}</small>`:''}</span>${arrowIcon}</a>`;}
function renderProfile(c){
  const fundingRows=c.target!==null&&c.target!==undefined?`<div><dt>Campaign target</dt><dd>${money(c.target)}</dd></div>${c.raised!==null&&c.raised!==undefined?`<div><dt>Reported raised · Sep 13</dt><dd>${money(c.raised)}</dd></div>`:''}`:'';
  const docs=[sourceLink(c.source,c.platform+' offering page','Confirm availability, eligibility, and complete terms'),...(c.documents?[sourceLink(c.documents,'Offering document','Original filing or offering circular')]:[]),...(c.additionalSources||[]).map(s=>sourceLink(s.url,s.label,s.detail||'')),...(c.website?[sourceLink(c.website,'Company website','Learn about the operating business')]:[])].join('');
  const overview=`<div class="profile-overview-grid"><div><h3>About the business</h3><p>${escapeHtml(c.detail)}</p><h3>What the funding supports</h3><p>${escapeHtml(c.use)}</p></div><aside class="profile-facts"><h3>Business snapshot</h3><dl><div><dt>Location</dt><dd>${escapeHtml(c.location||'Not verified')}</dd></div><div><dt>Sector</dt><dd>${escapeHtml(c.sector)}</dd></div><div><dt>Legal issuer</dt><dd>${escapeHtml(c.issuer||'See offering documents')}</dd></div><div><dt>Mainstreet position</dt><dd>Not purchased</dd></div></dl></aside></div>`;
  const offering=`<div class="profile-overview-grid"><div><h3>Investment terms</h3><dl class="detail-info"><div><dt>Security</dt><dd>${escapeHtml(c.security)}</dd></div><div><dt>Offering framework</dt><dd>${escapeHtml(c.exemption||'Confirm with source')}</dd></div><div><dt>Minimum investment</dt><dd>${minimumLabel(c)}</dd></div>${c.feeNote?`<div><dt>Additional fees</dt><dd>${escapeHtml(c.feeNote)}</dd></div>`:''}<div><dt>Listed closing date</dt><dd>${hasCurrentTerms(c)&&c.closing?dateLabel(c.closing)+' '+c.closing.slice(0,4):'Not currently verified'}</dd></div>${fundingRows}</dl></div><aside class="profile-terms-note"><h3>Before investing</h3><p>${escapeHtml(c.termsNote)}</p>${c.id==='azure-printed-homes'?'<p>The source page contains differing interest-rate figures; confirm the governing documents before relying on a rate.</p>':''}</aside></div>`;
  const documents=`<div class="profile-documents"><div><h3>Read the original sources</h3><p>Review the provider’s documents and current offering status before making a decision.</p></div><div>${docs}</div></div>`;
  $('#holding-detail').innerHTML=`<div class="profile-cover"><img src="${c.thumbnail||c.image}" alt="${escapeHtml(c.imageAlt)}" style="object-position:${c.imagePosition||'center'}"><button class="icon-button dialog-close" data-close aria-label="Close ${escapeHtml(c.name)} profile">×</button><span class="profile-cover-credit">${escapeHtml(c.photoCredit||c.platform)} photography</span></div>
    <div class="profile-title-row"><div><p class="eyebrow">${escapeHtml(c.category)}${c.location?' / '+escapeHtml(c.location):''}</p><h2 id="holding-title">${escapeHtml(c.name)}</h2><p>${escapeHtml(c.description)}</p></div>${watchButton(c,'profile-watch')}</div>
    <div class="profile-status-bar"><div><span class="offering-status ${c.availability!=='open'||deadlinePassed(c)?'status-muted':''}">${availabilityLabel(c)}</span><span>Research checked September 13, 2026</span></div><span class="position-label">Research candidate · not purchased</span></div>
    <div class="profile-tabs" role="tablist" aria-label="Business profile">${['overview','offering','documents'].map(tab=>`<button role="tab" id="profile-tab-${tab}" data-profile-tab="${tab}" aria-selected="${state.profileTab===tab}" aria-controls="profile-panel-${tab}" tabindex="${state.profileTab===tab?'0':'-1'}">${tab==='overview'?'Business overview':tab==='offering'?'Investment terms':'Documents & sources'}</button>`).join('')}</div>
    <div class="profile-content">${[['overview',overview],['offering',offering],['documents',documents]].map(([tab,html])=>`<section role="tabpanel" id="profile-panel-${tab}" aria-labelledby="profile-tab-${tab}" ${state.profileTab!==tab?'hidden':''}>${html}</section>`).join('')}<div class="source-note"><strong>Source note</strong><p>${escapeHtml(c.statusNote)} ${c.availability==='open'?'Availability can change after the research date.':''}</p></div></div>
    <div class="profile-footer"><span>No affiliation or company endorsement.</span><div class="chain-profile-actions"><button class="button button-light" data-chain-prepare="${c.id}">Prepare test purchase</button><a class="button button-dark" href="${c.source}" target="_blank" rel="noopener noreferrer">Original offering ${arrowIcon}</a></div></div>`;
}
function openOpportunity(id){const c=opportunities.find(c=>c.id===id);if(!c)throw new Error('Unknown business');state.selected=id;state.profileTab='overview';renderProfile(c);if(!$('#holding-dialog').open)$('#holding-dialog').showModal();return {company:c.name,instrument:c.security,minimum:c.minimum,source:c.source,checked:c.checked,availability:c.availability,noMainstreetInvestment:true};}
function changeProfileTab(tab,focus=true){if(!['overview','offering','documents'].includes(tab))return;state.profileTab=tab;document.querySelectorAll('[data-profile-tab]').forEach(b=>{const active=b.dataset.profileTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});['overview','offering','documents'].forEach(t=>$(`#profile-panel-${t}`).hidden=t!==tab);}
function setView(view){if(!['explore','treasury','holdings'].includes(view))view='treasury';const changed=state.view!==view;state.view=view;if(changed)window.scrollTo({top:0,behavior:'auto'});document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});document.title=`${view==='explore'?'Businesses':view==='treasury'?'Treasury':'My portfolio'} — Mainstreet`;}
function navigate(view){if(!['explore','treasury','holdings'].includes(view))throw new Error('Unknown view');if(location.hash!==`#${view}`)location.hash=view;else setView(view);}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-about]')){$('#about-dialog').showModal();return;}
  if(event.target.closest('[data-rights]')){$('#rights-dialog').showModal();return;}
  const watch=event.target.closest('[data-watch]');if(watch){toggleWatch(watch.dataset.watch);return;}
  const opportunity=event.target.closest('[data-opportunity]');if(opportunity){openOpportunity(opportunity.dataset.opportunity);return;}
  const filter=event.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;renderCompanies();return;}
  const tab=event.target.closest('[data-profile-tab]');if(tab){changeProfileTab(tab.dataset.profileTab);return;}
  const close=event.target.closest('[data-close]');if(close)close.closest('dialog')?.close();
});
document.addEventListener('keydown',event=>{const tab=event.target.closest('[data-profile-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['overview','offering','documents'],i=tabs.indexOf(tab.dataset.profileTab);changeProfileTab(tabs[event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3]);});
$('#company-search').addEventListener('input',e=>{state.query=e.target.value;renderCompanies();});$('#company-sort').addEventListener('change',e=>{state.sort=e.target.value;renderCompanies();});
$('#reset-filters').addEventListener('click',()=>{state.filter='All';state.query='';state.sort='featured';$('#company-search').value='';$('#company-sort').value='featured';renderCompanies();$('#company-search').focus();});
$('#view-watchlist').addEventListener('click',()=>{state.filter='Watchlist';state.query='';$('#company-search').value='';renderCompanies();});
['about-button','footer-about'].forEach(id=>$(`#${id}`).addEventListener('click',()=>$('#about-dialog').showModal()));
['ledger-button','all-activity-button'].forEach(id=>$(`#${id}`).addEventListener('click',()=>$('#ledger-dialog').showModal()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));
renderCompanies();renderWatchlist();setView(location.hash.slice(1)||'treasury');

window.MainstreetDirectory={opportunities,openOpportunity,escapeHtml,navigate};
