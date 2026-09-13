export const STORAGE_KEY = 'capital:community-rounds:v1';
export const DEFAULT_CANDIDATES = ['miso-robotics','animoca-brands','sunday-supper','blushift-aerospace','simplex-chat','organic-transit'];
export function initialState(){return {version:1,rounds:[{id:'r-first',number:1,title:'First investment shortlist',target:'',notes:'Choose the business you would like Capital to consider for its first investment round.',candidates:[...DEFAULT_CANDIDATES],archived:false}],preferences:{}};}
export function normalizeTarget(value){
 const text=String(value??'').trim();if(!text)return '';
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(text))throw new Error('Use a planning target up to 999,999,999.99 USD, with no more than two decimal places.');
 const [whole,fraction='']=text.split('.');const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 if(cents<=0n)throw new Error('Enter a target above zero, or leave it blank.');
 return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}
export function roundFields(input,knownIds){
 const title=typeof input.title==='string'?input.title.trim():'';if(!title||title.length>80)throw new Error('Use a round name between 1 and 80 characters.');
 const notes=typeof input.notes==='string'?input.notes.trim():'';if(notes.length>300)throw new Error('Keep the round description under 300 characters.');
 if(!Array.isArray(input.candidates)||input.candidates.some(id=>!knownIds.includes(id)))throw new Error('Choose businesses from the directory.');
 const candidates=[...new Set(input.candidates)];if(candidates.length<2||candidates.length>12)throw new Error('Choose between 2 and 12 businesses for this round.');
 return {title,notes,target:normalizeTarget(input.target),candidates};
}
export function validateState(value,knownIds){
 if(value?.version!==1||!Array.isArray(value.rounds)||!value.rounds.length||value.rounds.length>30)throw new Error('Saved rounds could not be read.');
 const rounds=value.rounds.map(r=>{if(!r||typeof r.id!=='string'||!/^r-[a-z0-9-]{1,60}$/.test(r.id)||!Number.isSafeInteger(r.number)||r.number<1||r.number>100000||typeof r.archived!=='boolean')throw new Error('Saved round is invalid.');return {id:r.id,number:r.number,...roundFields(r,knownIds),archived:r.archived};});
 if(new Set(rounds.map(r=>r.id)).size!==rounds.length||new Set(rounds.map(r=>r.number)).size!==rounds.length)throw new Error('Saved rounds are duplicated.');
 const preferences={};for(const r of rounds){const choice=value.preferences?.[r.id];if(typeof choice==='string'&&r.candidates.includes(choice))preferences[r.id]=choice;}
 return {version:1,rounds,preferences};
}
export function saveRound(state,input,knownIds,id){
 const fields=roundFields(input,knownIds);const existing=state.rounds.find(r=>r.id===id);
 if(id&&!existing)throw new Error('This round is no longer available.');
 if(existing?.archived)throw new Error('Restore this draft before editing it.');
 if(!existing&&Math.max(...state.rounds.map(r=>r.number))>=100000)throw new Error('This browser has reached its round numbering limit.');
 if(!existing&&state.rounds.length>=30)throw new Error('This browser can keep up to 30 round drafts.');
 const round=existing?{...existing,...fields}:{...fields,id:`r-${globalThis.crypto.randomUUID()}`,number:Math.max(0,...state.rounds.map(r=>r.number))+1,archived:false};
 const rounds=existing?state.rounds.map(r=>r.id===id?round:r):[...state.rounds,round];
 const preferences={...state.preferences};if(preferences[round.id]&&!round.candidates.includes(preferences[round.id]))delete preferences[round.id];
 return {state:{...state,rounds,preferences},id:round.id};
}
export function chooseBusiness(state,roundId,companyId){
 const round=state.rounds.find(r=>r.id===roundId);if(!round||round.archived)throw new Error('Archived rounds do not accept preferences. Restore the draft to change it.');
 if(!round.candidates.includes(companyId))throw new Error('This business is not in the round.');
 const preferences={...state.preferences};if(preferences[roundId]===companyId)delete preferences[roundId];else preferences[roundId]=companyId;
 return {...state,preferences};
}
export function archiveRound(state,roundId){
 if(!state.rounds.some(r=>r.id===roundId))throw new Error('Round not found.');
 return {...state,rounds:state.rounds.map(r=>r.id===roundId?{...r,archived:!r.archived}:r)};
}
