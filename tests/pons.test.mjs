import {test} from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
// Bundle the JSON ABI import for the Node test runner, using the same compiler as production.
const {outputFiles}=await build({entryPoints:['src/pons.js'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
const source=outputFiles[0].text.replace('from "ethers"',`from ${JSON.stringify(new URL('../node_modules/ethers/lib.esm/index.js',import.meta.url).href)}`);
const {pendingCreatorFees,inspectPons}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Pons pending-fee math keeps tax and buyback earmarks separate from protocol fees',()=>{
  assert.equal(pendingCreatorFees(10000n,2000n,1000n,3000n),8000n);
  assert.equal(pendingCreatorFees(1n,0n,0n,3333n),1n,'Protocol rounding stays in creator bucket');
  assert.equal(pendingCreatorFees(100n,20n,999n,5000n),20n,'Oversized earmark is clamped; creator tax remains');
  assert.throws(()=>pendingCreatorFees(100n,0n,0n,10001n));
});
test('Pons refuses wrong-network responses and malformed token addresses',async()=>{
  await assert.rejects(()=>inspectPons({}, {getNetwork:async()=>({chainId:1n})}),/wrong network/);
  await assert.rejects(()=>inspectPons({token:'Mainstreet'},{}),/invalid address/i);
});
