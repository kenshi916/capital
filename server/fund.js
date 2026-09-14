import {Interface,formatUnits,isAddress,getAddress} from 'ethers';
import {startupFund as fund} from '../src/portfolio-model.js';
const tokenInterface=new Interface(['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
// Read-only, fixed asset and network. Never forwards arbitrary RPC calls or signs transactions.
export async function readFundBalance(request,env={},fetcher=fetch){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const wallet=new URL(request.url).searchParams.get('wallet');
 if(!wallet||!isAddress(wallet))return json({error:'Enter a valid Ethereum wallet address.'},400);
 const endpoint=env.CAPITAL_RPC_1||'https://ethereum.publicnode.com';
 async function rpc(method,params){const response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('RPC unavailable');const data=await response.json();if(data.error||data.result==null)throw Error('RPC rejected');return data.result;}
 try{
  if(BigInt(await rpc('eth_chainId',[]))!==1n)throw Error('Wrong network');
  const block=await rpc('eth_getBlockByNumber',['safe',false]);
  if(!/^0x[0-9a-f]+$/i.test(block?.number)||!/^0x[0-9a-f]{64}$/i.test(block?.hash))throw Error('Block unavailable');
  const results=await Promise.all(['decimals','balanceOf'].map(method=>rpc('eth_call',[{to:fund.address,data:tokenInterface.encodeFunctionData(method,method==='balanceOf'?[wallet]:[])},block.number])));
  const decimals=Number(tokenInterface.decodeFunctionResult('decimals',results[0])[0]);
  if(decimals!==fund.decimals)throw Error('Token metadata changed');
  const balance=tokenInterface.decodeFunctionResult('balanceOf',results[1])[0];
  return json({wallet:getAddress(wallet),token:fund.token,address:fund.address,chainId:1,decimals,balance:formatUnits(balance,decimals),rawBalance:balance.toString(),block:Number(BigInt(block.number)),blockHash:block.hash,checkedAt:new Date().toISOString()});
 }catch{return json({error:'The Ethereum VCXx balance could not be verified. Please retry.'},503);}
}
