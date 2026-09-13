import {verifyTypedData} from 'ethers';
import {AppError,requireValue,now,hash,normalizeRound,checkPublication,statusOf,voteTypedData,tally,canonicalWallet,NETWORKS} from './voting-model.js';
import * as chain from './snapshot.js';
import companies from './companies.json';
const uid=()=>crypto.randomUUID();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const statement=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>statement(db,sql,...args).first();
const all=async(db,sql,...args)=>(await statement(db,sql,...args).all()).results;
const payload=r=>JSON.parse(r.payload);
async function identity(request,env,db){
 const user=request.headers.get('oai-authenticated-user-id')||'',email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
 let admin=await first(db,"SELECT user_id FROM capital_admins WHERE slot='owner'");
 // Sites dispatch supplies these headers after authentication. Pin the owner's site-scoped ID once.
 if(!admin&&user&&env.CAPITAL_ADMIN_EMAIL&&email===env.CAPITAL_ADMIN_EMAIL.trim().toLowerCase()){
  await statement(db,"INSERT OR IGNORE INTO capital_admins(slot,user_id,created_at) VALUES('owner',?,?)",user,now()).run();admin=await first(db,"SELECT user_id FROM capital_admins WHERE slot='owner'");
 }
 return {user,admin:!!user&&admin?.user_id===user,adminConfigured:!!admin||!!env.CAPITAL_ADMIN_EMAIL};
}
async function readBody(request){requireValue(request.headers.get('content-type')?.split(';')[0]==='application/json','Send JSON data.',415);requireValue(Number(request.headers.get('content-length')||0)<=48000,'The request is too large.',413);const text=await request.text();requireValue(text.length<=48000,'The request is too large.',413);try{return JSON.parse(text);}catch{throw new AppError('The request could not be read.');}}
const auditStatement=(db,id,roundId,action,actor,detail)=>statement(db,'INSERT INTO capital_round_audit(id,round_id,action,actor,detail,created_at) SELECT ?,id,?,?,?,? FROM capital_rounds WHERE id=? AND mutation_id=?',id,action,actor,JSON.stringify(detail),now(),roundId,id);
async function getRound(db,id,auth){const r=await first(db,'SELECT * FROM capital_rounds WHERE id=?',id);requireValue(r&&(auth.admin||r.status!=='draft'&&r.status!=='archived'),'Round not found.',404);return r;}
async function latestVotes(db,id){return all(db,'SELECT v.id,v.wallet,v.sequence,v.candidate,v.weight,v.accepted_at FROM capital_votes v WHERE v.round_id=? AND v.sequence=(SELECT MAX(v2.sequence) FROM capital_votes v2 WHERE v2.round_id=v.round_id AND v2.wallet=v.wallet) ORDER BY v.wallet',id);}
export function createApp(dependencies={}){
 const services={...chain,...dependencies};
 async function ensureSnapshot(db,env,r){
  if(r.status!=='published'||r.snapshot_hash||now()<r.opens_at||now()>=r.closes_at)return r;
  const snapshot=await services.openingSnapshot(env,payload(r));
  await statement(db,"UPDATE capital_rounds SET snapshot_number=?,snapshot_hash=?,snapshot_time=? WHERE id=? AND status='published' AND snapshot_hash IS NULL AND closes_at>unixepoch()",snapshot.number,snapshot.hash,snapshot.time,r.id).run();
  return first(db,'SELECT * FROM capital_rounds WHERE id=?',r.id);
 }
 async function serializeRound(db,r,details=false){
  r=await first(db,'SELECT *,unixepoch() AS database_time FROM capital_rounds WHERE id=?',r.id);const p=payload(r),status=statusOf(r,r.database_time);let results=null;
  if(r.status!=='draft'&&r.status!=='archived'){
   if(r.final_results)results=JSON.parse(r.final_results);
   else {const current=await latestVotes(db,r.id);results={...tally(current,p),final:status==='closed',calculatedAt:now()};if(status==='closed'){results.digest=hash({roundId:r.id,revision:r.revision,proposalHash:r.proposal_hash,snapshotHash:r.snapshot_hash,...results});await statement(db,"UPDATE capital_rounds SET final_results=? WHERE id=? AND status='published' AND closes_at<=unixepoch() AND final_results IS NULL",JSON.stringify(results),r.id).run();const latest=await first(db,'SELECT final_results FROM capital_rounds WHERE id=?',r.id);if(latest.final_results)results=JSON.parse(latest.final_results);}}
  }
  const output={id:r.id,parentId:r.parent_id,revision:r.revision,version:r.version,status,payload:p,proposalHash:r.proposal_hash,snapshot:r.snapshot_hash?{number:r.snapshot_number,hash:r.snapshot_hash,time:r.snapshot_time}:null,results,updatedAt:r.updated_at};
  if(!details){output.payload={...p,candidates:p.candidates.map(({terms,documents,...c})=>c)};if(results)output.results={...results,receiptIds:undefined};}
  return output;
 }
 return {async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/voting/')){if(env.ASSETS)return env.ASSETS.fetch(request);return new Response('Not found',{status:404});}
  try{
   requireValue(env.DB,'Shared voting storage is unavailable. Try again shortly.',503);
   const db=env.DB,auth=await identity(request,env,db),method=request.method;
   if(method!=='GET'){
    requireValue(['POST','PUT'].includes(method),'Method not allowed.',405);
    requireValue(request.headers.get('origin')===(env.CAPITAL_SITE_ORIGIN||new URL(request.url).origin),'This request must come from Capital.',403);
    requireValue(auth.user,'Sign in to Capital to continue.',401);
   }
   if(path==='/api/voting/session'&&method==='GET')return json({signedIn:!!auth.user,isAdmin:auth.admin,adminConfigured:auth.adminConfigured,networks:NETWORKS,serverTime:now(),preview:!!env.CAPITAL_PREVIEW});
   if(path==='/api/voting/rounds'&&method==='GET'){
    const rows=await all(db,auth.admin?'SELECT * FROM capital_rounds ORDER BY created_at DESC':"SELECT * FROM capital_rounds WHERE status NOT IN ('draft','archived') ORDER BY created_at DESC");
    return json({rounds:await Promise.all(rows.map(r=>serializeRound(db,r))),serverTime:now()});
   }
   if(path==='/api/voting/rounds'&&method==='POST'){
    requireValue(auth.admin,'Only the administrator can create rounds.',403);const input=await readBody(request),p=normalizeRound(input,companies);if(input.requestId)requireValue(/^[a-f0-9-]{36}$/.test(input.requestId),'Invalid draft request ID.');const id='r-'+(input.requestId||uid()),op=uid(),time=now();const existing=await first(db,'SELECT * FROM capital_rounds WHERE id=?',id);if(existing){requireValue(existing.status==='draft'&&hash(payload(existing))===hash(p),'This draft request was already used.',409);return json({round:await serializeRound(db,existing,true),duplicate:true});}
    await db.batch([statement(db,"INSERT INTO capital_rounds(id,parent_id,revision,version,status,mutation_id,payload,opens_at,closes_at,created_at,updated_at) VALUES(?,NULL,1,1,'draft',?,?,?,?,?,?)",id,op,JSON.stringify(p),p.opensAt,p.closesAt,time,time),auditStatement(db,op,id,'draft-created',auth.user,{termsHash:hash(p)})]);
    return json({round:await serializeRound(db,await getRound(db,id,auth),true)},201);
   }
   const match=path.match(/^\/api\/voting\/rounds\/(r-[a-z0-9-]+)(?:\/(publish|pause|revise|archive|challenge|ballot|audit))?$/);
   if(match){
    const [,id,action]=match;let r=await getRound(db,id,auth);
    if(!action&&method==='GET'){
     let snapshotError=null;try{r=await ensureSnapshot(db,env,r);}catch(error){snapshotError=error.message;}
     const account=new URL(request.url).searchParams.get('wallet');const myBallot=account?await first(db,'SELECT id,wallet,sequence,candidate,weight,accepted_at FROM capital_votes WHERE round_id=? AND wallet=? ORDER BY sequence DESC LIMIT 1',id,canonicalWallet(account)):null;return json({round:{...await serializeRound(db,r,true),myBallot},snapshotError,serverTime:now()});
    }
    if(action==='audit'&&method==='GET'){
     const url=new URL(request.url),offset=Math.max(0,Math.min(10000000,Number(url.searchParams.get('offset')||0)));requireValue(Number.isSafeInteger(offset),'Invalid audit offset.');
     const events=await all(db,'SELECT id,action,detail,created_at FROM capital_round_audit WHERE round_id=? ORDER BY created_at DESC,id DESC LIMIT 50',id);
     const votes=await all(db,'SELECT id,wallet,sequence,candidate,weight,signature,typed_data,accepted_at FROM capital_votes WHERE round_id=? ORDER BY accepted_at DESC,id DESC LIMIT 51 OFFSET ?',id,offset);
     return json({events:events.map(e=>({...e,detail:JSON.parse(e.detail),actor:'Administrator'})),receipts:votes.slice(0,50).map(v=>({...v,typedData:JSON.parse(v.typed_data),typed_data:undefined})),hasMore:votes.length>50,nextOffset:offset+Math.min(50,votes.length)});
    }
    if(!action&&method==='PUT'){
     requireValue(auth.admin,'Only the administrator can edit rounds.',403);requireValue(r.status==='draft','Published terms are fixed. Create a new revision to change them.',409);
     const input=await readBody(request),p=normalizeRound(input,companies);requireValue(input.version===r.version,'This draft changed. Reload it before saving.',409);const op=uid();
     const response=await db.batch([statement(db,"UPDATE capital_rounds SET payload=?,opens_at=?,closes_at=?,version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=? AND status='draft'",JSON.stringify(p),p.opensAt,p.closesAt,op,now(),id,input.version),auditStatement(db,op,id,'draft-edited',auth.user,{termsHash:hash(p)})]);
     requireValue(response[0].meta.changes===1,'This draft changed. Reload it before saving.',409);return json({round:await serializeRound(db,await getRound(db,id,auth),true)});
    }
    if(['publish','pause','revise','archive'].includes(action)&&method==='POST'){
     requireValue(auth.admin,'Only the administrator can publish or revise rounds.',403);const input=await readBody(request);requireValue(input.version===r.version,'This round changed. Reload it before continuing.',409);const op=uid();
     if(action==='publish'){
      requireValue(r.status==='draft','Only a draft can be published.',409);let p=payload(r);checkPublication(p);p={...p,...await services.verifyToken(env,p)};const proposalHash=hash({id,revision:r.revision,payload:p});
      const response=await db.batch([statement(db,"UPDATE capital_rounds SET status='published',payload=?,proposal_hash=?,version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=? AND status='draft'",JSON.stringify(p),proposalHash,op,now(),id,r.version),auditStatement(db,op,id,'published',auth.user,{proposalHash,opensAt:p.opensAt,closesAt:p.closesAt})]);requireValue(response[0].meta.changes===1,'This draft changed during publication. Reload it.',409);
     }else if(action==='archive'){
      requireValue(['draft','archived'].includes(r.status),'Only unpublished drafts can be archived.',409);const status=r.status==='draft'?'archived':'draft';const result=await db.batch([statement(db,'UPDATE capital_rounds SET status=?,version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=?',status,op,now(),id,r.version),auditStatement(db,op,id,status,auth.user,{})]);requireValue(result[0].meta.changes===1,'This round changed. Reload it.',409);
     }else if(action==='pause'){
      const reason=String(input.reason||'').trim();requireValue(reason.length>=5&&reason.length<=500,'Add a short reason for pausing.');requireValue(r.status==='published'&&now()<r.closes_at,'Only a scheduled or open round can be paused.',409);
      const result=await db.batch([statement(db,"UPDATE capital_rounds SET status='paused',version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=? AND status='published' AND closes_at>unixepoch()",op,now(),id,r.version),auditStatement(db,op,id,'paused',auth.user,{reason})]);requireValue(result[0].meta.changes===1,'This round already changed or closed.',409);
     }else{
      requireValue(r.status!=='draft'&&r.status!=='archived','Edit an unpublished draft directly.',409);const existing=await first(db,'SELECT id FROM capital_rounds WHERE parent_id=?',id);requireValue(!existing,'A replacement draft already exists for this round.',409);
      const reason=String(input.reason||'').trim();requireValue(reason.length>=5&&reason.length<=500,'Describe what changed for this revision.');const nextId='r-'+uid(),p={...payload(r),opensAt:0,closesAt:0,candidates:payload(r).candidates.map(c=>({...c,reviewed:false}))};delete p.decimals;delete p.symbol;
      const result=await db.batch([statement(db,"UPDATE capital_rounds SET status=CASE WHEN status='published' AND closes_at>unixepoch() THEN 'paused' ELSE status END,version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=?",op,now(),id,r.version),statement(db,"INSERT INTO capital_rounds(id,parent_id,revision,version,status,mutation_id,payload,opens_at,closes_at,created_at,updated_at) SELECT ?,id,revision+1,1,'draft',?,?,0,0,?,? FROM capital_rounds WHERE id=? AND mutation_id=?",nextId,op,JSON.stringify(p),now(),now(),id,op),auditStatement(db,op,id,'revision-created',auth.user,{reason,replacementId:nextId})]);requireValue(result[0].meta.changes===1,'This round changed. Reload it.',409);return json({round:await serializeRound(db,await getRound(db,nextId,auth),true)},201);
     }
     return json({round:await serializeRound(db,await getRound(db,id,auth),true)});
    }
    if(action==='challenge'&&method==='POST'){
     const input=await readBody(request),wallet=canonicalWallet(input.wallet);r=await ensureSnapshot(db,env,r);requireValue(statusOf(r)==='open','Voting is not open for this round.',409);const p=payload(r);requireValue(p.candidates.some(c=>c.id===input.candidate),'Choose a business in this round.');
     const count=await first(db,'SELECT COUNT(*) AS n FROM capital_vote_challenges WHERE user_id=? AND created_at>?',auth.user,now()-60);requireValue(count.n<15,'Wait a minute before requesting another ballot.',429);
     const weight=await services.snapshotWeight(env,p,r,wallet),current=await first(db,'SELECT MAX(sequence) AS n FROM capital_votes WHERE round_id=? AND wallet=?',id,wallet),sequence=(current.n||0)+1,nonce=uid(),expires=Math.min(now()+300,r.closes_at),typed=voteTypedData(r,p,wallet,input.candidate,sequence,nonce,expires,env.CAPITAL_SITE_ORIGIN||new URL(request.url).origin);
     await statement(db,'INSERT INTO capital_vote_challenges(id,round_id,wallet,user_id,sequence,candidate,weight,typed_data,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',nonce,id,wallet,auth.user,sequence,input.candidate,weight,JSON.stringify(typed),expires,now()).run();return json({challengeId:nonce,typedData:typed,weight,expiresAt:expires});
    }
    if(action==='ballot'&&method==='POST'){
     const input=await readBody(request);requireValue(typeof input.challengeId==='string'&&typeof input.signature==='string'&&/^0x[a-fA-F0-9]{130}$/.test(input.signature),'Provide a valid signed ballot.');
     const c=await first(db,'SELECT * FROM capital_vote_challenges WHERE id=? AND round_id=?',input.challengeId,id);requireValue(c&&c.user_id===auth.user,'Ballot request not found.',404);const typed=JSON.parse(c.typed_data);let signer;try{signer=verifyTypedData(typed.domain,typed.types,typed.message,input.signature).toLowerCase();}catch{throw new AppError('The ballot signature is invalid.',403);}requireValue(signer===c.wallet,'This signature belongs to a different wallet.',403);
     const receipt=await first(db,'SELECT * FROM capital_votes WHERE id=?',c.id);if(receipt)return json({receipt:{id:receipt.id,roundId:id,wallet:receipt.wallet,sequence:receipt.sequence,candidate:receipt.candidate,weight:receipt.weight,acceptedAt:receipt.accepted_at},duplicate:true});
     requireValue(statusOf(r)==='open'&&c.expires_at>now(),'This ballot expired or the round is no longer open.',409);
     requireValue(typed.message.proposalHash===r.proposal_hash&&typed.message.snapshotHash===r.snapshot_hash,'The round no longer matches this ballot.',409);
     const weight=await services.snapshotWeight(env,payload(r),r,c.wallet);requireValue(weight===c.weight,'The historical voting weight could not be reproduced.',503);
     // A single conditional INSERT is the acceptance transaction: the append-only log is also the ballot source of truth.
     await statement(db,`INSERT OR IGNORE INTO capital_votes(id,round_id,wallet,sequence,candidate,weight,signature,typed_data,accepted_at)
       SELECT c.id,c.round_id,c.wallet,c.sequence,c.candidate,c.weight,?,c.typed_data,unixepoch()
       FROM capital_vote_challenges c JOIN capital_rounds r ON r.id=c.round_id
       WHERE c.id=? AND c.user_id=? AND c.expires_at>unixepoch() AND r.status='published'
       AND r.opens_at<=unixepoch() AND r.closes_at>unixepoch() AND r.proposal_hash=? AND r.snapshot_hash=?
       AND c.sequence=(SELECT COALESCE(MAX(v.sequence),0)+1 FROM capital_votes v WHERE v.round_id=c.round_id AND v.wallet=c.wallet)`,input.signature,c.id,auth.user,r.proposal_hash,r.snapshot_hash).run();
     const accepted=await first(db,'SELECT * FROM capital_votes WHERE id=?',c.id);requireValue(accepted,'A newer ballot was accepted, or voting closed. Refresh before trying again.',409);
     return json({receipt:{id:accepted.id,roundId:id,wallet:accepted.wallet,sequence:accepted.sequence,candidate:accepted.candidate,weight:accepted.weight,acceptedAt:accepted.accepted_at}},201);
    }
   }
   throw new AppError('Voting endpoint not found.',404);
  }catch(error){if(!(error instanceof AppError))console.error('Voting request failed',path,error?.message);return json({error:error instanceof AppError?error.message:'Shared voting is temporarily unavailable. Your unsubmitted input has been kept.'},error.status||503);}
 }};
}
export default createApp();
