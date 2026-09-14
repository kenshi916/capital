import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
test('leaderboard supports searching, shared picks, focus preservation, failure recovery and removal',async()=>{
 const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://capital.test/#forum',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,q=s=>w.document.querySelector(s);w.AbortSignal=AbortSignal;w.CSS={escape:s=>s};
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let fail=false,saved=null,version=0,sends=[];const companies=Array.from({length:7},(_,i)=>({id:i===0?'animoca-brands':'company-'+i,name:i===0?'Animoca Brands':'Company '+i,category:'Technology',image:'/assets/animoca-brands.webp',supporters:0,rank:null}));
 const snapshot=()=>({companies:companies.map(c=>({...c,supporters:c.id===saved?1:0,rank:c.id===saved?1:null})).sort((a,b)=>b.supporters-a.supporters||a.name.localeCompare(b.name)),selectedCompany:saved,version,totalPicks:saved?1:0});
 const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 w.fetch=async(url,options={})=>{if(url.endsWith('/company-interest')){if(options.method==='POST'){sends.push(JSON.parse(options.body));if(fail)throw Error('Connection lost');saved=sends.at(-1).companyId;version++;}return response(snapshot());}if(url.endsWith('/session'))return response({signedIn:true,author:'Member abc',isAdmin:false});return response({messages:[],hasMore:false,nextBefore:null});};
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
 try{
  q('#legacy-interest').open=true;w.eval(['opportunities','app','forum'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));await flush();assert.equal(q('#interest-list').children.length,5);assert.match(q('#interest-summary').textContent,/No picks yet/);
  q('#interest-more').click();assert.equal(q('#interest-list').children.length,7);q('#interest-search').value='Animoca';q('#interest-search').dispatchEvent(new w.Event('input'));assert.equal(q('#interest-list').children.length,1);
  q('[data-interest-pick="animoca-brands"]').click();await flush();assert.deepEqual(sends[0],{companyId:'animoca-brands',expectedVersion:0});assert.equal(q('[data-interest-pick]').getAttribute('aria-pressed'),'true');assert.equal(w.document.activeElement.dataset.interestPick,'animoca-brands');assert.match(q('#interest-summary').textContent,/1 community pick/);
  fail=true;q('[data-interest-pick]').click();await flush();assert.equal(q('[data-interest-pick]').getAttribute('aria-pressed'),'true');assert.match(q('#interest-status').textContent,/Connection lost/);assert.equal(q('[data-interest-pick]').disabled,false);
  fail=false;q('[data-interest-pick]').click();await flush();assert.equal(q('[data-interest-pick]').getAttribute('aria-pressed'),'false');assert.match(q('#interest-summary').textContent,/No picks yet/);assert.deepEqual(sends.at(-1),{companyId:null,expectedVersion:1});
  q('#interest-search').value='no such company';q('#interest-search').dispatchEvent(new w.Event('input'));assert.match(q('#interest-list').textContent,/No matching companies/);
 }finally{await new Promise(resolve=>setTimeout(resolve,0));w.close();}
});
