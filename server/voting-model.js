import {getAddress,keccak256,toUtf8Bytes,parseUnits,Interface} from 'ethers';
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export const requireValue=(condition,message,status=400)=>{if(!condition)throw new AppError(message,status);};
export const now=()=>Math.floor(Date.now()/1000);
export const hash=value=>keccak256(toUtf8Bytes(typeof value==='string'?value:JSON.stringify(value)));
export const canonicalWallet=value=>{try{return getAddress(value).toLowerCase();}catch{throw new AppError('Enter a valid wallet or token address.');}};
export const NETWORKS={4663:{name:'Robinhood Chain',rpc:'https://rpc.mainnet.chain.robinhood.com',explorer:'https://robinhoodchain.blockscout.com',testnet:false},46630:{name:'Robinhood Chain Testnet',rpc:'https://rpc.testnet.chain.robinhood.com',explorer:'https://explorer.testnet.chain.robinhood.com',testnet:true},11155111:{name:'Ethereum Sepolia',rpc:'https://ethereum-sepolia-rpc.publicnode.com',explorer:'https://sepolia.etherscan.io',testnet:true}};
export const tokenInterface=new Interface(['function balanceOf(address) view returns(uint256)','function decimals() view returns(uint8)','function symbol() view returns(string)','function totalSupply() view returns(uint256)']);
const clean=(value,max,optional=false)=>{requireValue(typeof value==='string','A text field is missing.');const s=value.trim();requireValue((optional||s.length)&&s.length<=max,`Use ${optional?'up to':'between 1 and'} ${max} characters.`);return s;};
const url=value=>{const s=clean(value,1000);let parsed;try{parsed=new URL(s);}catch{throw new AppError('Use a complete HTTPS source URL.');}requireValue(parsed.protocol==='https:'&&!parsed.username&&!parsed.password,'Use an HTTPS source URL without credentials.');return parsed.href;};
export function normalizeRound(input,companies){
 const title=clean(input.title,80),notes=clean(input.notes||'',500,true),target=String(input.target||'').trim();
 requireValue(!target||/^\d{1,9}(\.\d{1,2})?$/.test(target)&&Number(target)>0,'Use a positive planning target with at most two decimal places.');
 const chainId=Number(input.chainId||4663);requireValue(NETWORKS[chainId],'Choose a supported network.');
 const token=input.token?canonicalWallet(input.token):'';const rule=input.rule||'';requireValue(['','token-weighted','one-wallet'].includes(rule),'Choose a voting rule.');
 const minimum=String(input.minimum||'1').trim();requireValue(/^\d{1,30}(\.\d{1,18})?$/.test(minimum)&&Number(minimum)>0,'Set a positive minimum token holding.');
 const opensAt=Number(input.opensAt||0),closesAt=Number(input.closesAt||0);requireValue(Number.isSafeInteger(opensAt)&&Number.isSafeInteger(closesAt)&&opensAt>=0&&closesAt>=0,'Use valid opening and closing dates.');
 requireValue(Array.isArray(input.candidates)&&input.candidates.length>=2&&input.candidates.length<=12,'Choose between 2 and 12 businesses.');
 const candidates=input.candidates.map(item=>{const c=companies.find(c=>c.id===item.id);requireValue(c,'Choose businesses from the directory.');const status=item.status||'unverified';requireValue(['open','secondary','unverified','closed'].includes(status),'Choose an offering status.');const checkedAt=Number(item.checkedAt||0);requireValue(Number.isSafeInteger(checkedAt)&&checkedAt>=0&&checkedAt<=now()+60,'Review dates cannot be in the future.');return {id:c.id,name:c.name,image:c.image,platform:c.platform,security:clean(item.security||c.security,200),terms:clean(item.terms||'',2000,true),source:url(item.source||c.source),documents:item.documents?url(item.documents):'',status,checkedAt,reviewed:item.reviewed===true};});
 requireValue(new Set(candidates.map(c=>c.id)).size===candidates.length,'A business can only appear once.');
 return {title,notes,target,chainId,token,rule,minimum,opensAt,closesAt,candidates};
}
export function checkPublication(p,time=now()){
 requireValue(p.token&&p.rule,'Set the token address and voting rule before publishing.');
 requireValue(p.opensAt>=time-120&&p.opensAt<=time+366*86400&&p.closesAt>=Math.max(time,p.opensAt)+300&&p.closesAt-p.opensAt<=90*86400,'Set an opening time from now onward and a voting window between 5 minutes and 90 days.');
 requireValue(p.candidates.every(c=>c.reviewed&&c.checkedAt>=time-7*86400&&['open','secondary'].includes(c.status)&&c.terms&&c.documents),'Review every candidate’s current terms and document source within seven days before publishing. Closed or unverified offerings cannot enter voting.');
}
export const statusOf=(r,time=now())=>r.status!=='published'?r.status:time>=r.closes_at?'closed':time<r.opens_at?'scheduled':r.snapshot_hash?'open':'snapshot-pending';
export function voteTypedData(round,p,wallet,candidate,sequence,nonce,expires,origin){
 return {domain:{name:'Capital community voting',version:'1',chainId:p.chainId,salt:hash(origin)},types:{Ballot:[{name:'roundTitle',type:'string'},{name:'business',type:'string'},{name:'wallet',type:'address'},{name:'roundId',type:'string'},{name:'revision',type:'uint256'},{name:'proposalHash',type:'bytes32'},{name:'snapshotBlock',type:'uint256'},{name:'snapshotHash',type:'bytes32'},{name:'choice',type:'string'},{name:'sequence',type:'uint256'},{name:'nonce',type:'string'},{name:'expiresAt',type:'uint256'}]},primaryType:'Ballot',message:{roundTitle:p.title,business:p.candidates.find(c=>c.id===candidate).name,wallet,roundId:round.id,revision:round.revision,proposalHash:round.proposal_hash,snapshotBlock:round.snapshot_number,snapshotHash:round.snapshot_hash,choice:candidate,sequence,nonce,expiresAt:expires}};
}
export function tally(votes,p){const weights=Object.fromEntries(p.candidates.map(c=>[c.id,'0']));for(const v of votes){requireValue(Object.hasOwn(weights,v.candidate),'Stored ballot references an unknown candidate.',503);weights[v.candidate]=(BigInt(weights[v.candidate])+BigInt(v.weight)).toString();}const total=Object.values(weights).reduce((sum,v)=>sum+BigInt(v),0n);return {wallets:votes.length,totalWeight:total.toString(),candidates:p.candidates.map(c=>({id:c.id,weight:weights[c.id],percent:total?Number(BigInt(weights[c.id])*10000n/total)/100:0})),receiptIds:votes.map(v=>v.id).sort()};}
export function minimumUnits(p){try{return parseUnits(p.minimum,p.decimals);}catch{throw new AppError('The minimum holding has too many decimal places for this token.');}}
