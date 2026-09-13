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
