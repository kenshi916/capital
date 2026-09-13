import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {STORAGE_KEY,DEFAULT_CANDIDATES,initialState,normalizeTarget,validateState,saveRound,chooseBusiness,archiveRound} from '../src/rounds-model.js';
const ids=DEFAULT_CANDIDATES;
const fields={title:'Robotics shortlist',notes:'Two businesses to compare.',target:'10000',candidates:ids.slice(0,2)};
test('targets and candidate shortlists reject misleading or invalid values',()=>{
 assert.equal(normalizeTarget('00100.5'),'100.50');assert.equal(normalizeTarget(''),'');
 for(const target of ['0','-1','NaN','1e6','1,000','0.001','1000000000'])assert.throws(()=>normalizeTarget(target));
 assert.throws(()=>saveRound(initialState(),{...fields,candidates:['not-a-business',ids[0]]},ids));
 assert.throws(()=>saveRound(initialState(),{...fields,candidates:[ids[0],ids[0]]},ids));
 assert.throws(()=>saveRound(initialState(),{...fields,title:'  '},ids));
});
test('preferences are independent per round, reversible, and cannot change while archived',()=>{
 let {state,id}=saveRound(initialState(),fields,ids);state=chooseBusiness(state,'r-first',ids[1]);state=chooseBusiness(state,id,ids[0]);
 assert.equal(state.preferences['r-first'],ids[1]);assert.equal(state.preferences[id],ids[0]);
 state=archiveRound(state,id);assert.throws(()=>chooseBusiness(state,id,ids[1]));assert.throws(()=>saveRound(state,fields,ids,id));
 state=archiveRound(state,id);assert.equal(state.preferences[id],ids[0]);state=chooseBusiness(state,id,ids[0]);assert.equal(state.preferences[id],undefined);
 state=chooseBusiness(state,id,ids[0]);state=saveRound(state,{...fields,candidates:ids.slice(1,3)},ids,id).state;assert.equal(state.preferences[id],undefined);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(state)),ids),state);
});
test('stored data is constrained and new rounds cannot exceed the numbering limit',()=>{
 const state=initialState();state.rounds[0].id=['r-first'];assert.throws(()=>validateState(state,ids));
 const valid=initialState();valid.preferences={'r-first':'missing'};assert.deepEqual(validateState(valid,ids).preferences,{});
 valid.rounds[0].number=100000;assert.throws(()=>saveRound(valid,fields,ids));
 const duplicate=initialState();duplicate.rounds.push({...duplicate.rounds[0]});assert.throws(()=>validateState(duplicate,ids));
});
function page({stored=null,blocked=false,writeBlocked=false,hash='#community'}={}){
 const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:`https://capital.test/${hash}`,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[],errors=[];w.fetch=(...args)=>{calls.push(args);throw Error('No network expected');};w.ethereum={request:r=>{calls.push(r);throw Error('No wallet expected');}};
 w.addEventListener('error',e=>errors.push(e.error));
 if(stored!==null)w.localStorage.setItem(STORAGE_KEY,stored);
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('Blocked');}});
 else if(writeBlocked)w.Storage.prototype.setItem=function(){throw Error('Full');};
 w.eval(['opportunities','app','community'].map(name=>fs.readFileSync(`dist/${name}.js`,'utf8')).join('\n'));
 const q=s=>w.document.querySelector(s),all=s=>[...w.document.querySelectorAll(s)];
 const hashTo=hash=>{w.history.pushState(null,'',hash);w.dispatchEvent(new w.HashChangeEvent('hashchange'));};
 return {w,q,all,hashTo,close(){assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);w.close();}};
}
test('community deep links save, replace, clear and restore preferences after reload',()=>{
 let p=page({hash:'#community/r-first'});assert.equal(p.w.document.body.dataset.view,'community');assert.equal(p.all('[data-round-choice]').length,6);
 p.q(`[data-round-choice="${ids[0]}"]`).click();p.q(`[data-round-choice="${ids[1]}"]`).click();assert.equal(p.all('[data-round-choice][aria-pressed="true"]').length,1);
 let saved=p.w.localStorage.getItem(STORAGE_KEY);assert.equal(JSON.parse(saved).preferences['r-first'],ids[1]);p.close();
 p=page({stored:saved});assert.equal(p.q(`[data-round-choice="${ids[1]}"]`).getAttribute('aria-pressed'),'true');p.q(`[data-round-choice="${ids[1]}"]`).click();assert.equal(p.all('[data-round-choice][aria-pressed="true"]').length,0);p.close();
});
test('round editor creates and edits a draft; filters, archive and restore work',()=>{
 const p=page({hash:'#rounds'});assert.equal(p.q('.main-nav [aria-current="page"]').textContent,'Community');p.q('#new-round').click();
 p.q('#round-name').value='<b>Robotics</b>';p.q('#round-target').value='1200.50';
 p.q('#round-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));assert.match(p.q('#round-form-error').textContent,/2 and 12/);
 for(const id of ids.slice(0,2))p.q(`[name=candidate][value="${id}"]`).click();p.q('#round-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));
 assert.equal(p.q('#round-editor').open,false);assert.equal(p.all('.round-card').length,2);assert.equal(p.all('.round-card h2 b').length,0);
 const saved=JSON.parse(p.w.localStorage.getItem(STORAGE_KEY)),id=saved.rounds[1].id;assert.equal(saved.rounds[1].target,'1200.50');
 p.q(`[data-edit-round="${id}"]`).click();p.q('#round-name').value='Technology shortlist';p.q('#round-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));assert.match(p.q(`#card-${id}`).textContent,/Technology shortlist/);
 p.hashTo(`#community/${id}`);assert.equal(p.all('[data-round-choice]').length,2);p.q(`[data-round-choice="${ids[0]}"]`).click();
 p.hashTo('#rounds');p.q(`[data-archive-round="${id}"]`).click();assert.equal(p.all('.round-card').length,1);p.q('[data-round-filter=archived]').click();assert.equal(p.all('.round-card').length,1);
 p.hashTo(`#community/${id}`);assert(p.all('[data-round-choice]').every(el=>el.disabled));p.hashTo('#rounds');p.q(`[data-archive-round="${id}"]`).click();p.q('[data-round-filter=draft]').click();assert.equal(p.all('.round-card').length,2);p.close();
});
test('storage failures keep the interface usable without a false saved confirmation',()=>{
 for(const options of [{blocked:true},{writeBlocked:true},{stored:'broken-json'}]){
 const p=page(options);p.q(`[data-round-choice="${ids[0]}"]`).click();assert.match(p.q('#community-feedback').textContent,/visit only/);assert.doesNotMatch(p.q('.community-storage-note').textContent,/Saved in this browser/);
 if(options.stored)assert.equal(p.w.localStorage.getItem(STORAGE_KEY),'broken-json');p.close();
 }
});
test('a cross-tab update cannot silently overwrite an open editor',()=>{
 const p=page({hash:'#rounds'});p.q('[data-edit-round="r-first"]').click();
 const fresh=initialState();fresh.rounds[0].title='Changed in another tab';p.w.dispatchEvent(new p.w.StorageEvent('storage',{key:STORAGE_KEY,newValue:JSON.stringify(fresh)}));
 p.q('#round-name').value='Old edit';p.q('#round-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));assert.equal(p.q('#round-editor').open,true);assert.match(p.q('#round-form-error').textContent,/changed in another tab/);p.close();
});
test('clearing saved rounds in another tab resets the local view and storage writes can recover',()=>{
 const chosen=chooseBusiness(initialState(),'r-first',ids[0]);const p=page({stored:JSON.stringify(chosen)});
 p.w.dispatchEvent(new p.w.StorageEvent('storage',{key:null,newValue:null}));assert.equal(p.all('[data-round-choice][aria-pressed="true"]').length,0);p.close();
 const q=page();const original=q.w.Storage.prototype.setItem;q.w.Storage.prototype.setItem=function(){throw Error('Full');};
 q.q(`[data-round-choice="${ids[0]}"]`).click();assert.match(q.q('#community-feedback').textContent,/visit only/);
 q.w.Storage.prototype.setItem=original;q.q(`[data-round-choice="${ids[1]}"]`).click();assert.match(q.q('#community-feedback').textContent,/Saved in this browser/);assert.equal(JSON.parse(q.w.localStorage.getItem(STORAGE_KEY)).preferences['r-first'],ids[1]);q.close();
});
