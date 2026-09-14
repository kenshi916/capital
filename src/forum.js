import {initLeaderboard} from './forum-leaderboard.js';
initLeaderboard();
const $=s=>document.querySelector(s),esc=window.MainstreetDirectory.escapeHtml;
let session=null,messages=[],reply=null,before=null,nextBefore=null,hasMore=false,busy=false,pending=null,sequence=0;
const text=$('#forum-message'),form=$('#forum-form'),feed=$('#forum-feed');
const date=t=>new Date(t*1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
const active=()=>location.hash==='#forum';
async function api(path,body){
 const response=await fetch('/api/forum/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 let data;try{data=await response.json();}catch{throw Error('The forum could not be reached. Your draft is still here.');}
 if(!response.ok)throw Object.assign(Error(data.error||'The request did not finish.'),{status:response.status});return data;
}
function feedback(value){$('#forum-feedback').textContent=value;}
function composer(){
 $('#forum-count').textContent=`${text.value.length} / 2,000`;
 $('#forum-post').disabled=busy||!session?.signedIn||!text.value.trim()||text.value.trim().length>2000;text.readOnly=busy;
 $('#forum-post').textContent=busy?'Posting…':reply?'Post reply':'Post message';$('#forum-cancel-reply').disabled=busy;
 $('#forum-reply').hidden=!reply;$('#forum-reply-label').textContent=reply?`Replying to ${reply.author}: ${reply.body.slice(0,100)}`:'';
}
function render(){
 feed.innerHTML=messages.length?messages.map(m=>`<article class="forum-post${m.isMine?' is-mine':''}" data-message-id="${m.id}"><div class="forum-avatar" aria-hidden="true">${esc(m.author.slice(-2).toUpperCase())}</div><div class="forum-post-content"><div class="forum-post-meta"><strong>${esc(m.author)}</strong>${m.isMine?'<span>You</span>':''}<time datetime="${new Date(m.createdAt*1000).toISOString()}">${esc(date(m.createdAt))}</time></div>${m.replyTo&&!m.hidden?`<blockquote class="forum-quote"><strong>Reply to ${esc(m.replyTo.author)}</strong><span>${esc(m.replyTo.body)}</span></blockquote>`:''}<p class="forum-body${m.hidden?' is-removed':''}">${m.hidden?'Message removed.':esc(m.body)}</p><div class="forum-post-actions">${!m.hidden?`<button type="button" data-forum-reply="${m.id}">Reply</button>`:''}${m.canHide&&!m.hidden?`<button type="button" data-forum-hide="${m.id}">Remove</button>`:''}${m.canRestore?`<button type="button" data-forum-restore="${m.id}">Restore message</button>`:''}</div></div></article>`).join(''):'<div class="forum-empty"><h2>Start the conversation.</h2><p>Share a treasury idea, a VCX fund update or a question about holder distributions.</p></div>';
 $('#forum-older').hidden=!hasMore;$('#forum-latest').hidden=before===null;
}
async function refresh(){
 const seq=++sequence;$('#forum-refresh').disabled=true;
 try{const [s,result]=await Promise.all([api('session'),api('messages'+(before===null?'':'?before='+before))]);if(seq!==sequence)return;
  session=s;messages=result.messages;hasMore=result.hasMore;nextBefore=result.nextBefore;
  $('#forum-signin').hidden=true;$('#forum-identity').textContent='Posting as '+s.author;
  $('#forum-connection').textContent=s.preview?'Local preview · separate message history':before===null?'New messages refresh every 10 seconds':'Earlier messages · use Latest for new posts';
  render();composer();
 }catch(error){if(seq!==sequence)return;$('#forum-connection').textContent=error.status===401?'Sign in to read and join the conversation':'Messages could not be refreshed';
  if(error.status===401){session=null;messages=[];feed.innerHTML='';$('#forum-signin').hidden=false;$('#forum-identity').textContent='Your sign-in identifies your messages';}
  else if(!messages.length)feed.innerHTML='<div class="forum-empty"><h2>Messages are unavailable.</h2><p>Try Refresh. Your draft will stay here.</p></div>';
  feedback(error.message);composer();
 }finally{if(seq===sequence)$('#forum-refresh').disabled=false;}
}
text.addEventListener('input',()=>{pending=null;composer();});
$('#forum-cancel-reply').addEventListener('click',()=>{if(busy)return;reply=null;pending=null;composer();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!session?.signedIn||!text.value.trim())return;
 pending??={requestId:crypto.randomUUID(),body:text.value.trim(),replyTo:reply?.id??null};busy=true;composer();feedback('Posting your message…');
 try{const result=await api('messages',pending);messages=[result.message,...messages.filter(m=>m.id!==result.message.id)];before=null;text.value='';reply=null;pending=null;render();feedback('Message posted.');await refresh();}
 catch(error){feedback(error.message);}
 finally{busy=false;composer();}
});
feed.addEventListener('click',async event=>{
 if(busy)return;
 const answer=event.target.closest('[data-forum-reply]'),hide=event.target.closest('[data-forum-hide]'),restore=event.target.closest('[data-forum-restore]');
 if(answer){reply=messages.find(m=>m.id===Number(answer.dataset.forumReply));pending=null;composer();text.focus();form.scrollIntoView({block:'center',behavior:'auto'});return;}
 const button=hide||restore;if(!button)return;button.disabled=true;
 try{const id=Number(hide?.dataset.forumHide||restore?.dataset.forumRestore);await api(`messages/${id}/visibility`,{hidden:!!hide});feedback(hide?'Message removed. You can restore your own removal.':'Message restored.');await refresh();}
 catch(error){feedback(error.message);button.disabled=false;}
});
$('#forum-refresh').addEventListener('click',refresh);
$('#forum-older').addEventListener('click',()=>{if(nextBefore){before=nextBefore;refresh();}});
$('#forum-latest').addEventListener('click',()=>{before=null;refresh();});
window.addEventListener('hashchange',()=>{if(active())refresh();});
setInterval(()=>{if(active()&&!document.hidden&&!busy&&before===null&&!feed.contains(document.activeElement))refresh();},10000);
composer();if(active())refresh();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'capital_read_forum',title:'Read Capital community messages',description:'Read the latest shared Capital forum messages. Does not post or reply.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('No parameters are accepted.');const result=await api('messages');return {messages:result.messages,hasMore:result.hasMore};}})).catch(()=>{});}catch{}}

const discussionStarters={purchase:'Purchase policy idea: ',distribution:'Holder distribution policy idea: ',reserve:'Treasury reserve policy idea: '};
document.querySelectorAll('[data-discuss-topic]').forEach(button=>button.addEventListener('click',()=>{
 if(busy)return;
 if(!text.value.trim()){text.value=discussionStarters[button.dataset.discussTopic];pending=null;composer();}
 text.focus();form.scrollIntoView({block:'center',behavior:'auto'});
}));
