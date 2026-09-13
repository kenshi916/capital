import {AppError,requireValue,NETWORKS,tokenInterface,canonicalWallet,minimumUnits,now} from './voting-model.js';
export async function rpc(env,chainId,method,params){
 const endpoint=env[`CAPITAL_RPC_${chainId}`]||NETWORKS[chainId]?.rpc;requireValue(endpoint,'Network is not configured.',503);
 try{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('RPC HTTP error');const body=await response.json();if(body.error||body.result===null||body.result===undefined)throw Error('RPC result unavailable');return body.result;}catch{throw new AppError('The network could not verify historical token data. Try again; no vote has been accepted.',503);}
}
export async function tokenCall(env,p,method,args,block){const result=await rpc(env,p.chainId,'eth_call',[{to:p.token,data:tokenInterface.encodeFunctionData(method,args)},block]);try{return tokenInterface.decodeFunctionResult(method,result)[0];}catch{throw new AppError('This address does not expose the required ERC-20 token data.',400);}}
export async function verifyToken(env,p){
 requireValue(Number(BigInt(await rpc(env,p.chainId,'eth_chainId',[])))===p.chainId,'The RPC returned a different network.',503);
 const block=await rpc(env,p.chainId,'eth_getBlockByNumber',['finalized',false]);requireValue(block?.hash&&block?.number,'A finalized block is required.',503);
 requireValue(await rpc(env,p.chainId,'eth_getCode',[p.token,block.number])!=='0x','No token contract exists at that address.');
 const decimals=Number(await tokenCall(env,p,'decimals',[],block.number));requireValue(Number.isInteger(decimals)&&decimals>=0&&decimals<=36,'Unsupported token decimals.');
 const symbol=String(await tokenCall(env,p,'symbol',[],block.number)).slice(0,32);const supply=await tokenCall(env,p,'totalSupply',[],block.number);requireValue(supply>0n,'The token supply must be above zero.');minimumUnits({...p,decimals});return {decimals,symbol};
}
// Find the final canonical block at or before the published opening time.
export async function openingSnapshot(env,p){
 requireValue(now()>=p.opensAt,'This round has not opened yet.',409);
 requireValue(Number(BigInt(await rpc(env,p.chainId,'eth_chainId',[])))===p.chainId,'The RPC returned a different network.',503);
 const latest=await rpc(env,p.chainId,'eth_getBlockByNumber',['finalized',false]);requireValue(Number(BigInt(latest.timestamp))>p.opensAt,'Waiting for the opening block to become finalized. No votes can be accepted yet.',409);
 let low=0,high=Number(BigInt(latest.number)),best=null;
 while(low<=high){const middle=Math.floor((low+high)/2),b=middle===Number(BigInt(latest.number))?latest:await rpc(env,p.chainId,'eth_getBlockByNumber',['0x'+middle.toString(16),false]);if(Number(BigInt(b.timestamp))<=p.opensAt){best=b;low=middle+1;}else high=middle-1;}
 requireValue(best?.hash,'The opening snapshot could not be found.',503);await tokenCall(env,p,'totalSupply',[],best.number);return {number:Number(BigInt(best.number)),hash:best.hash,time:Number(BigInt(best.timestamp))};
}
export async function snapshotWeight(env,p,round,wallet){
 const tag='0x'+round.snapshot_number.toString(16);const before=await rpc(env,p.chainId,'eth_getBlockByNumber',[tag,false]);requireValue(before.hash===round.snapshot_hash,'The recorded snapshot is no longer canonical. Voting is unavailable.',503);
 const balance=await tokenCall(env,p,'balanceOf',[canonicalWallet(wallet)],tag);
 const after=await rpc(env,p.chainId,'eth_getBlockByNumber',[tag,false]);requireValue(after.hash===round.snapshot_hash,'The snapshot changed during verification. Try again.',503);
 requireValue(balance>=minimumUnits(p),'This wallet did not meet the minimum token holding at the opening snapshot.',403);
 return p.rule==='one-wallet'?'1':balance.toString();
}
