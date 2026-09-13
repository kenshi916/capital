import {requireValue,AppError,hash} from './voting-model.js';
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>stmt(db,sql,...args).first();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const member=user=>'Member '+hash({purpose:'capital-forum-member-v1',user}).slice(2,12);
const fields='m.*,p.body AS parent_body,p.user_id AS parent_user,p.hidden_at AS parent_hidden';
function post(row,auth){return {id:row.id,author:member(row.user_id),body:row.hidden_at?'':row.body,createdAt:row.created_at,hidden:!!row.hidden_at,isMine:row.user_id===auth.user,canHide:auth.admin||row.user_id===auth.user,canRestore:!!row.hidden_at&&(auth.admin||row.hidden_by===auth.user),replyTo:row.parent_id?{id:row.parent_id,author:member(row.parent_user||''),body:row.parent_hidden?'Message removed':String(row.parent_body||'').slice(0,180),hidden:!!row.parent_hidden}:null};}
const readPost=(db,id)=>first(db,`SELECT ${fields} FROM capital_messages m LEFT JOIN capital_messages p ON p.id=m.parent_id WHERE m.id=?`,id);
export async function forum(request,db,auth,env,readBody){
 requireValue(auth.user,'Sign in to join the community.',401);
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/api/forum/session'&&method==='GET')return json({signedIn:true,author:member(auth.user),isAdmin:auth.admin,preview:!!env.CAPITAL_PREVIEW});
 if(path==='/api/forum/messages'&&method==='GET'){
  const raw=url.searchParams.get('before'),before=raw===null?null:Number(raw);requireValue(before===null||Number.isSafeInteger(before)&&before>0,'Invalid message cursor.');
  const result=await stmt(db,`SELECT ${fields} FROM capital_messages m LEFT JOIN capital_messages p ON p.id=m.parent_id ${before===null?'':'WHERE m.id<?'} ORDER BY m.id DESC LIMIT 51`,...(before===null?[]:[before])).all();
  const rows=result.results.slice(0,50);return json({messages:rows.map(r=>post(r,auth)),hasMore:result.results.length>50,nextBefore:rows.at(-1)?.id??null});
 }
 if(path==='/api/forum/messages'&&method==='POST'){
  const input=await readBody(request);requireValue(input&&typeof input==='object'&&!Array.isArray(input),'Send a message object.');
  requireValue(typeof input.body==='string'&&input.body.trim().length>0&&input.body.trim().length<=2000,'Write a message between 1 and 2,000 characters.');
  requireValue(typeof input.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.requestId),'Invalid message request ID.');
  const body=input.body.trim(),parent=input.replyTo??null;requireValue(parent===null||Number.isSafeInteger(parent)&&parent>0,'Invalid reply.');
  const existing=await first(db,'SELECT id,body,parent_id FROM capital_messages WHERE user_id=? AND request_id=?',auth.user,input.requestId);
  if(existing){requireValue(existing.body===body&&existing.parent_id===parent,'This request already belongs to a different message.',409);return json({message:post(await readPost(db,existing.id),auth),duplicate:true});}
  await stmt(db,`INSERT OR IGNORE INTO capital_messages(user_id,request_id,body,parent_id,created_at)
   SELECT ?,?,?,?,unixepoch() WHERE (SELECT COUNT(*) FROM capital_messages WHERE user_id=? AND created_at>unixepoch()-60)<5
   AND (? IS NULL OR EXISTS(SELECT 1 FROM capital_messages WHERE id=? AND hidden_at IS NULL))`,auth.user,input.requestId,body,parent,auth.user,parent,parent).run();
  const accepted=await first(db,'SELECT id,body,parent_id FROM capital_messages WHERE user_id=? AND request_id=?',auth.user,input.requestId);
  if(!accepted){if(parent!==null)requireValue(await first(db,'SELECT id FROM capital_messages WHERE id=? AND hidden_at IS NULL',parent),'That message is no longer available to reply to.',409);throw new AppError('Please wait a minute before posting again.',429);}
  requireValue(accepted.body===body&&accepted.parent_id===parent,'This request already belongs to a different message.',409);
  return json({message:post(await readPost(db,accepted.id),auth)},201);
 }
 const match=path.match(/^\/api\/forum\/messages\/([1-9][0-9]*)\/visibility$/);
 if(match&&method==='POST'){
  const id=Number(match[1]);requireValue(Number.isSafeInteger(id),'Invalid message.');const input=await readBody(request);requireValue(input&&typeof input.hidden==='boolean','Choose whether to hide this message.');
  const row=await readPost(db,id);requireValue(row,'Message not found.',404);requireValue(auth.admin||row.user_id===auth.user,'Only the author or administrator can remove a message.',403);
  if(input.hidden){await stmt(db,auth.admin?'UPDATE capital_messages SET hidden_at=COALESCE(hidden_at,unixepoch()),hidden_by=? WHERE id=?':'UPDATE capital_messages SET hidden_at=unixepoch(),hidden_by=? WHERE id=? AND hidden_at IS NULL',auth.user,id).run();}
  else{requireValue(auth.admin||row.hidden_by===auth.user||!row.hidden_at,'An administrator removed this message.',403);await stmt(db,auth.admin?'UPDATE capital_messages SET hidden_at=NULL,hidden_by=NULL WHERE id=?':'UPDATE capital_messages SET hidden_at=NULL,hidden_by=NULL WHERE id=? AND hidden_by=?',id,...(auth.admin?[]:[auth.user])).run();}
  return json({message:post(await readPost(db,id),auth)});
 }
 throw new AppError('Forum endpoint not found.',404);
}
