export function initLeaderboard(){
 const $=s=>document.querySelector(s),esc=window.MainstreetDirectory.escapeHtml;
 const panel=$('#company-interest'),list=$('#interest-list'),search=$('#interest-search'),more=$('#interest-more'),status=$('#interest-status');
 let state=null,busy=false,sequence=0,expanded=false;
 const active=()=>location.hash==='#forum'&&!!$('#legacy-interest')?.open;
 $('#legacy-interest')?.addEventListener('toggle',()=>{if(active())refresh();});
 async function api(body){
  const response=await fetch('/api/forum/company-interest',{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  let data;try{data=await response.json();}catch{throw Error('Company picks could not be reached. Try Refresh.');}
  if(!response.ok)throw Object.assign(Error(data.error||'Your pick could not be saved.'),{status:response.status});return data;
 }
 function render(focusId){
  if(!state)return;
  const term=search.value.trim().toLowerCase(),filtered=state.companies.filter(c=>(c.name+' '+c.category).toLowerCase().includes(term)),shown=term||expanded?filtered:filtered.slice(0,5);
  list.innerHTML=shown.length?shown.map(c=>`<li class="interest-row${state.selectedCompany===c.id?' is-selected':''}"><span class="interest-rank" aria-label="${c.rank?'Rank '+c.rank:'Unranked'}">${c.rank||'—'}</span><button type="button" class="interest-company" data-interest-profile="${esc(c.id)}" aria-label="Read about ${esc(c.name)}"><img src="${esc(c.image)}" alt="" width="36" height="36" loading="lazy" style="object-position:${esc(c.imagePosition||'center')}"><span><strong>${esc(c.name)}</strong><small>${state.selectedCompany===c.id?'Your pick':esc(c.category)}</small></span></button><button type="button" class="interest-pick" data-interest-pick="${esc(c.id)}" aria-pressed="${state.selectedCompany===c.id}" aria-label="${state.selectedCompany===c.id?'Remove your pick for':'Pick'} ${esc(c.name)}. ${c.supporters} community ${c.supporters===1?'pick':'picks'}" ${busy?'disabled':''}><span aria-hidden="true">${state.selectedCompany===c.id?'✓':'↑'}</span><span>${c.supporters}</span></button></li>`).join(''):'<li class="interest-empty">No matching companies.</li>';
  $('#interest-summary').textContent=state.totalPicks?`${state.totalPicks} community ${state.totalPicks===1?'pick':'picks'}`:'No picks yet. Research picks are separate from treasury voting.';
  const selected=state.companies.find(c=>c.id===state.selectedCompany);
  $('#interest-choice').textContent=selected?'Your pick: '+selected.name:'One active pick per member.';
  more.hidden=!!term||state.companies.length<=5;more.textContent=expanded?'Show top 5':`Show all ${state.companies.length}`;more.setAttribute('aria-expanded',String(expanded));
  if(focusId){const target=list.querySelector(`[data-interest-pick="${CSS.escape(focusId)}"]`);(target||search).focus({preventScroll:true});}
 }
 async function refresh(){
  if(busy)return;const seq=++sequence;
  try{const result=await api();if(seq!==sequence)return;state=result;render();if(status.dataset.error){status.textContent='';delete status.dataset.error;}}
  catch(error){if(seq!==sequence)return;if(error.status===401){state=null;$('#interest-summary').textContent='';$('#interest-choice').textContent='One active pick per member.';list.innerHTML='<li class="interest-empty">Sign in to see earlier company research picks.</li>';more.hidden=true;}status.textContent=error.status===401?'Sign in above to join.':state?'Showing the last loaded picks. Try Refresh.':error.message;status.dataset.error='true';}
 }
 list.addEventListener('click',async event=>{
  const profile=event.target.closest('[data-interest-profile]');if(profile){window.MainstreetDirectory.openOpportunity(profile.dataset.interestProfile);return;}
  const button=event.target.closest('[data-interest-pick]');if(!button||busy||!state)return;
  const id=button.dataset.interestPick,companyId=state.selectedCompany===id?null:id;
  busy=true;++sequence;list.querySelectorAll('[data-interest-pick]').forEach(b=>b.disabled=true);status.textContent='Saving your pick…';
  try{state=await api({companyId,expectedVersion:state.version});const selected=state.companies.find(c=>c.id===state.selectedCompany);status.textContent=selected?`${selected.name} is your pick. You can change it anytime.`:'Your pick was removed.';delete status.dataset.error;}
  catch(error){status.textContent=error.message+' Your displayed pick is the last confirmed choice.';status.dataset.error='true';if(error.status===409){try{state=await api();status.textContent='Your choice changed in another tab. The current choice is shown.';}catch{}}}
  finally{busy=false;render(id);}
 });
 search.addEventListener('input',()=>render());more.addEventListener('click',()=>{expanded=!expanded;render();});
 $('#forum-refresh').addEventListener('click',refresh);window.addEventListener('hashchange',()=>{if(active())refresh();});
 setInterval(()=>{if(active()&&!document.hidden&&!panel.contains(document.activeElement))refresh();},10000);
 if(active())refresh();
 if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'capital_read_company_interest',title:'Read earlier company research interest',description:'Read shared community interest counts and the current member choice. This is separate from formal investment voting.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('No parameters are accepted.');return api();}})).catch(()=>{});}catch{}}
}
