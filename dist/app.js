'use strict';

const companies = [
  { id:'substack', name:'Substack', sector:'Software', category:'Publishing', description:'A home for independent voices and the people who read them.', detail:'Substack gives writers, podcasters, and creators tools to publish directly to their audience and build subscriptions.', cost:65000, color:'#ed9564', tint:'#fbe7d8', website:'https://substack.com/' },
  { id:'replit', name:'Replit', sector:'Software', category:'Developer tools', description:'Turning ideas into software, right in your browser.', detail:'Replit is a software creation platform with an online development environment and AI-assisted app-building tools.', cost:55000, color:'#8e9cec', tint:'#e5e9ff', website:'https://replit.com/' },
  { id:'mercury', name:'Mercury', sector:'Fintech', category:'Business finance', description:'Financial tools built around the way companies work.', detail:'Mercury provides financial technology and business finance tools. Mercury is a financial technology company, not a bank.', cost:45000, color:'#597b96', tint:'#dcebf3', website:'https://mercury.com/' },
  { id:'gumroad', name:'Gumroad', sector:'Software', category:'Creator commerce', description:'Helping creators turn what they make into a business.', detail:'Gumroad is a commerce platform that helps creators sell digital products and other work directly to their customers.', cost:35000, color:'#d1a1be', tint:'#fae3f1', website:'https://gumroad.com/' },
  { id:'nothing', name:'Nothing', sector:'Consumer', category:'Consumer technology', description:'Making everyday technology feel a little more human.', detail:'Nothing is a consumer technology company making smartphones, audio products, and other connected devices.', cost:30000, color:'#5f737f', tint:'#e3e8eb', website:'https://nothing.tech/' },
  { id:'levels', name:'Levels', sector:'Health', category:'Metabolic health', description:'A more personal understanding of your metabolic health.', detail:'Levels offers tools and educational experiences intended to help people understand their metabolic health and lifestyle patterns.', cost:20000, color:'#91af98', tint:'#e5f0e5', website:'https://www.levels.com/' }
];
const totalCost = companies.reduce((sum,c)=>sum+c.cost,0);
const state = { filter:'All', query:'', sort:'featured', view:'explore', demoAccount:false, selected:null };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number.isInteger(value)?0:2}).format(value);
const percent = company => company.cost / totalCost * 100;
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localLogoIds = new Set(['mercury','gumroad','nothing']);
const logo = c => `<span class="company-logo" style="--company-color:${c.color}">${localLogoIds.has(c.id)?`<img src="/assets/${c.id}-logo.png" alt="" loading="lazy">`:''}<span class="company-monogram" ${localLogoIds.has(c.id)?'hidden':''}>${c.name.slice(0,1)}</span></span>`;
function setupLogoFallbacks(root=document){root.querySelectorAll('.company-logo img').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;},{once:true});});}
const opportunities = FUNDING_OPPORTUNITIES;
const dateLabel = date => date ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'See offering';
const deadlinePassed = c => c.closing && c.closing < new Date().toISOString().slice(0,10);
const instrumentLabel = c => c.instrument === 'Equity' ? 'Common stock' : 'Business loan';
function opportunityCard(c) {
  const ended = deadlinePassed(c);
  return `<article class="opportunity-card ${c.instrument==='Equity'?'equity-card':''}">
    <button class="opportunity-media" data-opportunity="${c.id}" aria-label="Read about ${escapeHtml(c.name)}">
      <img src="${c.image}" alt="${escapeHtml(c.imageAlt)}" width="660" height="380" loading="lazy">
      <span class="instrument-badge ${c.instrument==='Equity'?'equity-badge':''}"><span aria-hidden="true">${c.instrument==='Equity'?'◈':'↗'}</span> ${instrumentLabel(c)}</span>
      ${c.id==='startengine'?'<span class="image-caption">Howard Marks · Co-founder</span>':''}
    </button>
    <div class="opportunity-body">
      <div class="opportunity-category"><span>${escapeHtml(c.category)}</span><span>${escapeHtml(c.location)}</span></div>
      <h3><button data-opportunity="${c.id}">${escapeHtml(c.name)}</button></h3>
      <p class="opportunity-description">${escapeHtml(c.description)}</p>
      <div class="opportunity-metrics"><div><span>Minimum investment</span><strong>${money(c.minimum)}</strong></div><div><span>${ended?'Listed deadline passed':'Listed close'}</span><strong class="closing-value">${dateLabel(c.closing)}${c.closing?'<small>2026</small>':''}</strong></div></div>
      <div class="opportunity-footer"><span class="platform-name"><i class="platform-dot ${c.platform==='StartEngine'?'se-dot':''}" aria-hidden="true"></i>${c.platform}</span><button class="offering-details-button" data-opportunity="${c.id}" aria-label="View ${escapeHtml(c.name)} offering details">Details <span aria-hidden="true">+</span></button></div>
      <a class="offering-link" href="${c.source}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(c.name)} offering on ${c.platform}">View original offering <span aria-hidden="true">↗</span></a>
    </div>
  </article>`;
}
function filteredCompanies(){
  return opportunities.filter(c => (state.filter==='All'||c.instrument===state.filter||c.sector===state.filter)&&`${c.name} ${c.sector} ${c.category} ${c.location} ${c.platform}`.toLowerCase().includes(state.query.toLowerCase().trim())).sort((a,b)=>{
    if(state.sort==='name')return a.name.localeCompare(b.name);
    if(state.sort==='minimum')return a.minimum-b.minimum;
    if(state.sort==='closing')return (a.closing||'9999').localeCompare(b.closing||'9999');
    return opportunities.indexOf(a)-opportunities.indexOf(b);
  });
}
function renderCompanies(){
  const list=filteredCompanies();
  $('#company-grid').innerHTML=list.map(opportunityCard).join('');
  $('#company-count').textContent=String(list.length);
  $('#results-announcement').textContent=`${list.length} ${list.length===1?'opportunity':'opportunities'} shown`;
  $('#empty-state').hidden=list.length>0;
  $('#company-grid').hidden=list.length===0;
  $('#opportunity-total').textContent=String(opportunities.length);
  $('#equity-total').textContent=String(opportunities.filter(c=>c.instrument==='Equity').length);
  $('#loan-total').textContent=String(opportunities.filter(c=>c.instrument==='Debt').length);
  document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===state.filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function openOpportunity(id){
  const c=opportunities.find(c=>c.id===id);
  if(!c)throw new Error('Unknown opportunity');
  state.selected=id;
  const fundingRows=c.target!==null?`<div><dt>Campaign target</dt><dd>${money(c.target)}</dd></div><div><dt>Reported raised · Sep 13</dt><dd>${money(c.raised)}</dd></div>`:'';
  $('#holding-detail').innerHTML=`
    <div class="offering-detail-cover"><img src="${c.image}" alt="${escapeHtml(c.imageAlt)}"><button class="icon-button dialog-close" data-close aria-label="Close offering details">×</button><span class="instrument-badge ${c.instrument==='Equity'?'equity-badge':''}">${instrumentLabel(c)}</span></div>
    <div class="offering-detail-heading"><p class="eyebrow">${escapeHtml(c.category)} · ${escapeHtml(c.location)}</p><h2 id="holding-title">${escapeHtml(c.name)}</h2><p>${escapeHtml(c.detail)}</p></div>
    <div class="detail-body">
      <div class="detail-metrics"><div><span>Minimum investment</span><strong>${money(c.minimum)}</strong></div><div><span>${deadlinePassed(c)?'Listed deadline passed':'Listed closing date'}</span><strong>${dateLabel(c.closing)}${c.closing?' <small>2026</small>':''}</strong></div></div>
      <dl class="detail-info"><div><dt>Legal issuer</dt><dd>${escapeHtml(c.issuer)}</dd></div><div><dt>Security</dt><dd>${c.security}</dd></div><div><dt>Offering framework</dt><dd>${c.exemption}</dd></div>${fundingRows}<div><dt>Source platform</dt><dd>${c.platform}</dd></div><div><dt>Availability checked</dt><dd>September 13, 2026</dd></div><div><dt>Mainstreet position</dt><dd>No investment made</dd></div></dl>
      <div class="use-of-funds"><h3>What the funding supports</h3><p>${escapeHtml(c.use)}</p></div>
      <div class="dialog-disclaimer">${escapeHtml(c.termsNote)} ${c.id==='azure-printed-homes'?'The source page contains differing interest-rate figures; confirm the governing documents before relying on a rate. ':''}Availability and eligibility can change.</div>
      <div class="detail-action-row"><a class="button button-dark" href="${c.source}" target="_blank" rel="noopener noreferrer">View original offering ↗</a><a class="button button-light" href="${c.documents||c.website}" target="_blank" rel="noopener noreferrer">${c.documents?'Offering circular':'Company website'} ↗</a></div>
      <p class="source-credit">Company information and photography: ${c.platform}. Independently listed; no affiliation or endorsement.</p>
    </div>`;
  $('#holding-dialog').showModal();
  return {company:c.name,instrument:c.security,minimum:c.minimum,source:c.source,checked:c.checked,noMainstreetInvestment:true};
}

function setView(view){if(!['explore','treasury','holdings'].includes(view))view='explore';const changed=state.view!==view;state.view=view;if(changed)window.scrollTo({top:0,behavior:'auto'});document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});document.title=`${view==='explore'?'Opportunities':view==='treasury'?'Demo treasury':'My holdings'} — Mainstreet`;}
function navigate(view){if(!['explore','treasury','holdings'].includes(view))throw new Error('Unknown view');if(location.hash!==`#${view}`)location.hash=view;else setView(view);}
function openHolding(id){const c=companies.find(c=>c.id===id);if(!c)throw new Error('Unknown company');state.selected=id;$('#holding-detail').innerHTML=`<div class="detail-banner" style="--company-color:${c.color};--company-tint:${c.tint}"><button class="icon-button dialog-close" data-close aria-label="Close company details">×</button>${logo(c)}<h2 id="holding-title">${c.name}</h2><p>${c.detail}</p><div class="detail-tags"><span class="sector-tag">${c.category}</span><span class="position-tag">Illustrative holding</span></div></div><div class="detail-body"><div class="detail-metrics"><div><span>Sample acquisition cost</span><strong>${money(c.cost)}</strong></div><div><span>Demo portfolio allocation</span><strong>${percent(c)}%</strong></div></div><dl class="detail-info"><div><dt>Company website</dt><dd><a href="${c.website}" target="_blank" rel="noopener noreferrer">${new URL(c.website).hostname.replace('www.','')} ↗</a></dd></div><div><dt>Investment instrument</dt><dd>Not selected · prototype only</dd></div><div><dt>Offering availability</dt><dd>Not verified</dd></div><div><dt>Ownership documents</dt><dd class="demo-text">No investment has been made</dd></div><div><dt>Valuation</dt><dd>No market valuation claimed</dd></div>${state.demoAccount?`<div><dt>Your sample attributable cost</dt><dd>${money(c.cost*.005)}</dd></div>`:''}</dl><div class="dialog-disclaimer">${c.name} is a real company. This position and its allocation are fictional examples, not a live offering, confirmed investment, or company endorsement.</div><div class="detail-action-row"><a class="button button-dark" href="${c.website}" target="_blank" rel="noopener noreferrer">Visit company website ↗</a><button class="button button-light" data-close>Back to portfolio</button></div></div>`;setupLogoFallbacks($('#holding-detail'));$('#holding-dialog').showModal();return {company:c.name,sampleCost:c.cost,allocationPercent:percent(c),demoOnly:true};}
function renderTables(){$('#treasury-table').innerHTML=companies.map(c=>`<tr><td><span class="table-company">${logo(c)}${c.name}</span></td><td>${c.sector}</td><td class="table-value">${money(c.cost)}</td><td>${percent(c)}%</td><td><span class="subtle-pill">Demo only</span></td><td><button class="row-button" data-company="${c.id}" aria-label="View ${c.name} demo details">↗</button></td></tr>`).join('');$('#holdings-table').innerHTML=companies.map(c=>`<tr><td><span class="table-company">${logo(c)}${c.name}</span></td><td class="table-value">${money(c.cost*.005)}</td><td>${percent(c)}%</td><td><button class="row-button" data-company="${c.id}" aria-label="View ${c.name} demo details">↗</button></td></tr>`).join('');$('#allocation-legend').innerHTML=companies.map(c=>`<li><i style="background:${c.color}"></i><span>${c.name}</span><strong>${percent(c)}%</strong></li>`).join('');setupLogoFallbacks();}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function useDemoAccount(){state.demoAccount=true;$('#wallet-empty').hidden=true;$('#holdings-content').hidden=false;$('#wallet-button span').textContent='Demo account';$('#disconnect-demo').hidden=false;$('#use-demo-account').textContent='View demo holdings ↗';if($('#wallet-dialog').open)$('#wallet-dialog').close();navigate('holdings');toast('Demo account opened. No wallet connected.');return {demoAccount:true,samplePortfolioInterest:.005};}
function endDemoAccount(){state.demoAccount=false;$('#wallet-empty').hidden=false;$('#holdings-content').hidden=true;$('#wallet-button span').textContent='Preview wallet';$('#disconnect-demo').hidden=true;$('#use-demo-account').textContent='Use demo account ↗';$('#wallet-dialog').close();toast('Demo session ended.');}
document.addEventListener('click',event=>{const opportunityButton=event.target.closest('[data-opportunity]');if(opportunityButton){openOpportunity(opportunityButton.dataset.opportunity);return;}const companyButton=event.target.closest('[data-company]');if(companyButton){openHolding(companyButton.dataset.company);return;}const filter=event.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;renderCompanies();return;}const close=event.target.closest('[data-close]');if(close){close.closest('dialog')?.close();}});
$('#company-search').addEventListener('input',e=>{state.query=e.target.value;renderCompanies();});
$('#company-sort').addEventListener('change',e=>{state.sort=e.target.value;renderCompanies();});
$('#reset-filters').addEventListener('click',()=>{state.filter='All';state.query='';$('#company-search').value='';renderCompanies();$('#company-search').focus();});
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
$('#footer-about').addEventListener('click',()=>$('#about-dialog').showModal());
$('#wallet-button').addEventListener('click',()=>$('#wallet-dialog').showModal());
$('#holdings-preview-button').addEventListener('click',useDemoAccount);
$('#use-demo-account').addEventListener('click',useDemoAccount);
$('#disconnect-demo').addEventListener('click',endDemoAccount);
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));
renderCompanies();renderTables();setView(location.hash.slice(1)||'explore');

// Optional structured access mirrors the same visible prototype actions.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const tools=[
 {name:'list_funding_opportunities',title:'List sourced funding opportunities',description:'Read the dated snapshot of external equity and business-loan offerings. Availability must be confirmed with the source; Mainstreet has made no investments.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');return {checked:'2026-09-13',liveFeed:false,opportunities:opportunities.map(c=>({id:c.id,name:c.name,instrument:c.security,minimum:c.minimum,closing:c.closing,source:c.source}))};}},
 {name:'open_funding_opportunity',title:'Open funding opportunity details',description:'Open the visible sourced offering detail dialog without making an investment or visiting an external website.',inputSchema:{type:'object',properties:{opportunityId:{type:'string',enum:opportunities.map(c=>c.id)}},required:['opportunityId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='opportunityId')||typeof input.opportunityId!=='string')throw new Error('A valid opportunityId is required');return openOpportunity(input.opportunityId);}},
 {name:'list_demo_companies',title:'List Mainstreet demo companies',description:'Read the illustrative company positions. These are not actual investments or live offerings.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');return {demoOnly:true,companies:companies.map(c=>({id:c.id,name:c.name,sector:c.sector,sampleCost:c.cost}))};}},
 {name:'open_demo_holding',title:'Open a demo holding',description:'Open the company detail dialog. No investment or wallet transaction is performed.',inputSchema:{type:'object',properties:{companyId:{type:'string',enum:companies.map(c=>c.id)}},required:['companyId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='companyId')||typeof input.companyId!=='string')throw new Error('A valid companyId is required');return openHolding(input.companyId);}},
 {name:'navigate_mainstreet_demo',title:'Navigate Mainstreet',description:'Navigate to funding opportunities, demo treasury, or demo holdings.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['explore','treasury','holdings']}},required:['view'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='view')||!['explore','treasury','holdings'].includes(input.view))throw new Error('A valid view is required');setView(input.view);history.replaceState(null,'',`#${input.view}`);return {view:state.view,demoOnly:true};}}
 ];for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
