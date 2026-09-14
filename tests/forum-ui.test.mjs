import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
test('forum safely renders messages, preserves an in-flight reply and retries without a new request ID',async()=>{
 const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://capital.test/#forum',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,q=s=>w.document.querySelector(s);
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.AbortSignal=AbortSignal;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let rejectPost,sends=[],failRead=false;const posts=[{id:1,author:'Member abc123',body:'<img src=x onerror=alert(1)>',createdAt:123,isMine:false,hidden:false,canHide:false,canRestore:false,replyTo:null}];
 const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 w.fetch=async(url,options={})=>{
  if(url.endsWith('/company-interest'))return response({companies:[],selectedCompany:null,version:0,totalPicks:0});
  if(url.endsWith('/session'))return response({signedIn:true,author:'Member mine123',isAdmin:false});
  if(options.method==='POST'){const input=JSON.parse(options.body);sends.push(input);if(sends.length===1){posts.unshift({id:2,author:'Member mine123',body:input.body,createdAt:124,isMine:true,hidden:false,canHide:true,canRestore:false,replyTo:{id:1,author:posts[0].author,body:posts[0].body}});return new Promise((resolve,reject)=>{rejectPost=reject;});}return response({message:posts[0],duplicate:true});}
  if(failRead)throw Error('Connection lost');return response({messages:posts,hasMore:false,nextBefore:1});
 };
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 try{
  w.eval(['opportunities','app','forum'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));await flush();assert.equal(w.document.body.dataset.view,'forum');assert.equal(q('.main-nav [aria-current=page]').textContent,'Community');assert.equal(q('#forum-feed img'),null);assert.match(q('#forum-feed').textContent,/<img src=x/);
  q('[data-discuss-topic=purchase]').click();assert.equal(q('#forum-message').value,'Purchase policy idea: ');q('[data-discuss-topic=reserve]').click();assert.equal(q('#forum-message').value,'Purchase policy idea: ');assert.equal(sends.length,0);q('[data-forum-reply="1"]').click();q('#forum-message').value='This is a reply';q('#forum-message').dispatchEvent(new w.Event('input',{bubbles:true}));q('#forum-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(sends[0].replyTo,1);assert.equal(q('#forum-message').readOnly,true);
  q('#forum-cancel-reply').click();q('[data-forum-reply="1"]').click();rejectPost(Error('Response timed out'));await flush();assert.equal(q('#forum-message').value,'This is a reply');assert.equal(q('#forum-reply').hidden,false);assert.equal(q('#forum-post').disabled,false);
  q('#forum-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(sends.length,2);assert.deepEqual(sends[0],sends[1]);assert.equal(q('#forum-message').value,'');assert.equal(w.document.querySelectorAll('.forum-post').length,2);
  q('#forum-message').value='Keep my next draft';q('#forum-message').dispatchEvent(new w.Event('input',{bubbles:true}));failRead=true;q('#forum-refresh').click();await flush();assert.equal(q('#forum-message').value,'Keep my next draft');assert.match(q('#forum-connection').textContent,/could not be refreshed/);assert.equal(w.document.querySelectorAll('.forum-post').length,2);
 }finally{w.close();}
});
