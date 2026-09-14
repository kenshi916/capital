import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeRound,hash,voteTypedData} from '../server/voting-model.js';
const original=JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-voting-v1.json',import.meta.url)));
test('original company proposal hashes and v1 ballot messages remain byte-compatible',()=>{
 const p=normalizeRound(original.input,original.companies);
 assert.deepEqual(p,original.normalized);
 assert.equal(hash(p),original.proposalHash);
 assert.equal(Object.hasOwn(p,'kind'),false);
 const typed=voteTypedData(original.round,p,p.token,'alpha',1,'original-nonce',1700000100,'https://capital.test');
 assert.deepEqual(typed,original.typedData);
 assert.equal(hash(typed),original.typedDataHash);
});
