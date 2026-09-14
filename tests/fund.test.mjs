import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Interface,parseUnits} from 'ethers';
import {readFundBalance} from '../server/fund.js';
import {startupFund} from '../src/portfolio-model.js';
const wallet='0x0000000000000000000000000000000000000001';
const abi=new Interface(['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)']);
const request=(address=wallet)=>new Request('https://capital.test/api/fund/balance?wallet='+encodeURIComponent(address));
function mock({chain='0x1',decimals=18,balance=parseUnits('12.34567890123456789',18),reject=false}={}){
 const calls=[];return {calls,fetch:async(url,options)=>{const payload=JSON.parse(options.body);calls.push({url,...payload});if(reject)throw Error('offline');let result;
  if(payload.method==='eth_chainId')result=chain;
  else if(payload.method==='eth_getBlockByNumber')result={number:'0x123456',hash:'0x'+'a'.repeat(64)};
  else{assert.equal(payload.params[0].to,startupFund.address);assert.equal(payload.params[1],'0x123456');const call=abi.parseTransaction({data:payload.params[0].data});if(call.name==='balanceOf')assert.equal(call.args[0].toLowerCase(),wallet);result=abi.encodeFunctionResult(call.name,[call.name==='decimals'?decimals:balance]);}
  return Response.json({jsonrpc:'2.0',id:1,result});}};
}
test('VCXx balance preserves full precision and records the verified Ethereum block',async()=>{const m=mock();const r=await readFundBalance(request(),{},m.fetch);assert.equal(r.status,200);const d=await r.json();assert.equal(d.balance,'12.34567890123456789');assert.equal(d.rawBalance,'12345678901234567890');assert.equal(d.chainId,1);assert.equal(d.block,0x123456);assert.equal(d.wallet.toLowerCase(),wallet);assert.equal(d.address,startupFund.address);assert(m.calls.every(c=>c.url==='https://ethereum.publicnode.com'));assert(!m.calls.some(c=>c.method.includes('send')));});
test('unverified balance fails closed instead of showing zero',async()=>{for(const options of [{chain:'0x2'},{decimals:6},{reject:true}]){const r=await readFundBalance(request(),{},mock(options).fetch);assert.equal(r.status,503);const d=await r.json();assert.equal(d.balance,undefined);assert(d.error);}});
test('verified zero remains distinct from unavailable',async()=>{const r=await readFundBalance(request(),{},mock({balance:0n}).fetch);assert.equal(r.status,200);assert.equal((await r.json()).balance,'0.0');});
test('invalid wallets and mutations never reach the RPC',async()=>{let touched=false;const f=async()=>{touched=true;throw Error('unexpected')};assert.equal((await readFundBalance(request('not-a-wallet'),{},f)).status,400);assert.equal((await readFundBalance(new Request(request(),{method:'POST'}),{},f)).status,405);assert.equal(touched,false);});

