import {STORAGE_KEY,initialState,validateState,saveRound,chooseBusiness,archiveRound} from './rounds-model.js';
const directory=window.MainstreetDirectory;
const companies=directory.opportunities, knownIds=companies.map(c=>c.id), esc=directory.escapeHtml;
const $=selector=>document.querySelector(selector), company=id=>companies.find(c=>c.id===id);
let state=initialState(), storageMode='saved', selectedId='r-first', filter='draft', editingId=null, editorChanged=false;
try{const raw=localStorage.getItem(STORAGE_KEY);if(raw!==null){try{state=validateState(JSON.parse(raw),knownIds);}catch{storageMode='unreadable';}}}catch{storageMode='visit';}
function persist(){if(storageMode==='unreadable')return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageMode='saved';}catch{storageMode='visit';}}
function storageNotes(){const text=storageMode==='saved'?'Saved in this browser · not submitted':storageMode==='unreadable'?'Saved data could not be loaded · changes available for this visit':'Available for this visit · not submitted';document.querySelectorAll('.community-storage-note').forEach(el=>el.textContent=text);}
const targetLabel=round=>round.target?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number(round.target)%1?2:0}).format(Number(round.target)):'Not set';
const avatar=c=>`<img class="round-company-image" src="${esc(c.image)}" alt="" loading="lazy" style="object-fit:${c.imageFit==='contain'?'contain':'cover'}">`;
function metric(label,value){return `<div><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;}
function feedback(message){$('#community-feedback').textContent=message;$('#rounds-feedback').textContent=message;}
function savedMessage(message){return storageMode==='saved'?`${message} Saved in this browser; not submitted.`:`${message} Available for this visit only; not submitted.`;}
function selectFromHash(){const requested=location.hash.startsWith('#community/')?location.hash.slice(11):null;if(requested&&state.rounds.some(r=>r.id===requested))selectedId=requested;if(!state.rounds.some(r=>r.id===selectedId))selectedId=(state.rounds.find(r=>!r.archived)||state.rounds[0]).id;}
function renderCommunity(){
 selectFromHash();const round=state.rounds.find(r=>r.id===selectedId), choice=state.preferences[round.id];
 $('#community-round').innerHTML=state.rounds.map(r=>`<option value="${esc(r.id)}" ${r.id===round.id?'selected':''}>Round ${r.number} · ${esc(r.title)}${r.archived?' · Archived':''}</option>`).join('');
 $('#community-round-state').textContent=round.archived?'Archived':'Planning draft';
 $('#community-round-summary').innerHTML=`<div class="round-overview"><div class="round-overview-heading"><div><span class="round-eyebrow">ROUND ${String(round.number).padStart(2,'0')}</span><h2>${esc(round.title)}</h2><p>${esc(round.notes||'Explore the shortlist and save your preference.')}</p></div><a class="round-text-link" href="#rounds">Manage rounds ↗</a></div><div class="round-metrics">${metric('Businesses',round.candidates.length)}${metric('Planning target',targetLabel(round))}${metric('Your preference',choice?company(choice).name:'Not selected')}</div></div>`;
 $('#community-candidate-count').textContent=`${round.candidates.length} businesses`;
 $('#community-candidates').innerHTML=round.candidates.map(id=>{const c=company(id),chosen=choice===id;return `<article class="community-company ${chosen?'is-chosen':''}">${avatar(c)}<div class="community-company-info"><div class="community-company-title"><h3>${esc(c.name)}</h3>${chosen?'<span class="choice-badge">Your preference</span>':''}</div><span class="community-company-meta">${esc(c.platform)} · ${esc(c.security)}</span><p>${esc(c.description)}</p></div><div class="community-company-actions"><button class="round-text-link" data-opportunity="${esc(id)}" aria-label="Research ${esc(c.name)}">Research ↗</button><button class="preference-button" data-round-choice="${esc(id)}" aria-pressed="${chosen}" aria-label="${chosen?'Clear preference for':'Save preference for'} ${esc(c.name)}" ${round.archived?'disabled':''}>${round.archived?(chosen?'Your preference':'Archived'):chosen?'Clear preference':'Save preference'}${chosen?'<span aria-hidden="true">✓</span>':''}</button></div></article>`;}).join('');
}
function renderRounds(){
 const active=state.rounds.filter(r=>!r.archived), businesses=new Set(active.flatMap(r=>r.candidates));
 $('#rounds-summary').innerHTML=metric('Draft rounds',active.length)+metric('Businesses in drafts',businesses.size)+metric('Your preferences',Object.keys(state.preferences).length);
 const visible=state.rounds.filter(r=>filter==='all'||(filter==='archived'?r.archived:!r.archived)).toReversed();
 $('#rounds-count').textContent=`${visible.length} ${visible.length===1?'round':'rounds'}`;
 document.querySelectorAll('[data-round-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.roundFilter===filter)));
 $('#rounds-list').innerHTML=visible.length?visible.map(r=>`<article class="round-card" id="card-${esc(r.id)}" tabindex="-1"><div class="round-card-top"><span class="round-eyebrow">ROUND ${String(r.number).padStart(2,'0')}</span><span class="round-state">${r.archived?'Archived':'Planning draft'}</span></div><h2>${esc(r.title)}</h2><p class="round-card-description">${esc(r.notes||'A shortlist of businesses to consider together.')}</p><div class="round-card-details"><div class="round-avatar-group">${r.candidates.slice(0,5).map(id=>avatar(company(id))).join('')}<span>${r.candidates.length} businesses</span></div><div class="round-target"><span>Planning target</span><strong>${esc(targetLabel(r))}</strong></div><div class="round-preference"><span>Your preference</span><strong>${esc(company(state.preferences[r.id])?.name||'Not selected')}</strong></div></div><div class="round-card-actions"><a class="button button-dark" href="#community/${esc(r.id)}">${r.archived?'View shortlist':'Choose a business'} <span aria-hidden="true">↗</span></a><div>${!r.archived?`<button class="round-text-link" data-edit-round="${esc(r.id)}">Edit round</button>`:''}<button class="round-text-link" data-archive-round="${esc(r.id)}">${r.archived?'Restore draft':'Archive'}</button></div></div></article>`).join(''):`<div class="round-empty"><h2>${filter==='archived'?'No archived rounds':'No draft rounds'}</h2><p>${filter==='archived'?'Archived rounds stay here for reference.':'Create a round or restore an archived draft to build your next shortlist.'}</p></div>`;
}
function render(){renderCommunity();renderRounds();storageNotes();}
function openEditor(id=null){
 editingId=id;editorChanged=false;const r=id?state.rounds.find(r=>r.id===id):null;if(id&&(!r||r.archived))return;
 $('#round-editor-title').textContent=r?'Edit round':'Create a round';$('#round-name').value=r?.title||'';$('#round-target').value=r?.target||'';$('#round-notes').value=r?.notes||'';$('#round-form-error').textContent='';
 $('#round-candidate-picker').innerHTML=companies.map(c=>`<label class="round-candidate-option"><input type="checkbox" name="candidate" value="${esc(c.id)}" ${r?.candidates.includes(c.id)?'checked':''}>${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${esc(c.platform)}</small></span></label>`).join('');
 updateCount();$('#round-editor').showModal();$('#round-name').focus();
}
function updateCount(){$('#round-candidate-selection').textContent=`${document.querySelectorAll('#round-candidate-picker input:checked').length} selected · choose 2–12`;}
$('#new-round').addEventListener('click',()=>openEditor());
$('#community-round').addEventListener('change',e=>{selectedId=e.target.value;location.hash=`community/${selectedId}`;feedback('');renderCommunity();});
$('#round-candidate-picker').addEventListener('change',updateCount);
$('#round-form').addEventListener('submit',event=>{
 event.preventDefault();try{
 if(editorChanged)throw new Error('Rounds changed in another tab. Close this editor and reopen the round to use the latest version.');
 const result=saveRound(state,{title:$('#round-name').value,target:$('#round-target').value,notes:$('#round-notes').value,candidates:[...document.querySelectorAll('#round-candidate-picker input:checked')].map(el=>el.value)},knownIds,editingId);
 state=result.state;selectedId=result.id;filter='draft';persist();$('#round-editor').close();render();feedback(savedMessage('Round updated.'));$(`#card-${result.id}`).focus();
 }catch(error){$('#round-form-error').textContent=error.message;}
});
document.addEventListener('click',event=>{
 const choice=event.target.closest('[data-round-choice]');if(choice){try{state=chooseBusiness(state,selectedId,choice.dataset.roundChoice);persist();render();feedback(savedMessage(state.preferences[selectedId]?'Preference updated.':'Preference cleared.'));document.querySelector(`[data-round-choice="${choice.dataset.roundChoice}"]`)?.focus();}catch(error){feedback(error.message);}return;}
 const filterButton=event.target.closest('[data-round-filter]');if(filterButton){filter=filterButton.dataset.roundFilter;renderRounds();feedback('');return;}
 const edit=event.target.closest('[data-edit-round]');if(edit){openEditor(edit.dataset.editRound);return;}
 const archive=event.target.closest('[data-archive-round]');if(archive){state=archiveRound(state,archive.dataset.archiveRound);persist();render();feedback(savedMessage('Round updated.'));document.querySelector(`[data-round-filter="${filter}"]`).focus();}
});
window.addEventListener('hashchange',()=>{if(location.hash==='#community'||location.hash.startsWith('#community/')){feedback('');renderCommunity();}});
window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY&&event.key!==null)return;if($('#round-editor').open)editorChanged=true;try{state=event.newValue===null?initialState():validateState(JSON.parse(event.newValue),knownIds);storageMode='saved';render();feedback('Rounds updated from another tab.');}catch{storageMode='unreadable';storageNotes();}});
const roundFeedback=document.createElement('div');roundFeedback.id='rounds-feedback';roundFeedback.className='community-feedback';roundFeedback.setAttribute('role','status');roundFeedback.setAttribute('aria-live','polite');$('#rounds-summary').after(roundFeedback);
render();
