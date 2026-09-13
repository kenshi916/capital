import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = p => fs.readFileSync(p,'utf8');
async function until(fn) { for(let i=0;i<100;i++) { if(fn()) return; await new Promise(r=>setTimeout(r,10)); } throw new Error('Expected wallet state did not arrive'); }
function setup({provider,failConfig=false}={}) {
  const dom = new JSDOM(read('dist/index.html'),{url:'https://mainstreet-equity.kenshipops.chatgpt.site/#launch',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.Response=Response;w.Request=Request;w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async url=> {if(failConfig) throw new Error('Configuration unavailable'); return new Response(read(String(url).startsWith('/deployment')?'dist/deployment.json':'dist/contracts/artifacts.json'));};
  if(provider) w.ethereum=provider;
  w.eval(read('dist/opportunities.js')+'\n'+read('dist/app.js'));w.eval(read('dist/chain.js'));
  return dom;
}
test('without an extension, MetaMask QR option and official logo are available',async()=>{
  const dom=setup();try{
    const q=s=>dom.window.document.querySelector(s);
    await until(()=>dom.window.document.documentElement.dataset.chainApp==='ready');
    q('#wallet-button').click();
    assert(q('#wallet-dialog').open);
    assert(q('[data-wallet-provider="metamask-connect"]'));
    assert.equal(q('.metamask-option img').getAttribute('src'),'/assets/metamask.svg');
    dom.window.history.replaceState(null,'','/?network=46630&treasury=0x1234567890123456789012345678901234567890#holdings');
    q('#wallet-button').click();
    assert.match(q('#chain-mobile-wallet').href,/link\.metamask\.io\/dapp\/.+treasury=0x1234/);
  }finally{dom.window.close();}
});
test('connection is single-flight, rejects cleanly, and works even when treasury config fails',async()=>{
  let count=0,rejectRequest,resolveRequest;
  const provider={isMetaMask:true,request:({method})=>{if(method==='eth_requestAccounts'){count++;return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;});} if(method==='eth_chainId') return Promise.resolve('0xb626');throw new Error(method);},on(){},removeListener(){}};
  const dom=setup({provider,failConfig:true});try{
    const w=dom.window,q=s=>w.document.querySelector(s);
    await until(()=>q('#chain-status').textContent==='Setup needs attention');
    q('#wallet-button').click();q('[data-wallet-provider="injected"]').click();await until(()=>count===1);
    assert(q('[data-wallet-provider="injected"]').disabled);q('[data-wallet-provider="injected"]').click();assert.equal(count,1);
    rejectRequest(Object.assign(new Error('Rejected'),{code:4001}));await until(()=>q('#toast').textContent.includes('cancelled'));
    assert(!q('[data-wallet-provider="injected"]').disabled);
    q('[data-wallet-provider="injected"]').click();await until(()=>count===2);resolveRequest(['0x1234567890123456789012345678901234567890']);
    await until(()=>q('#wallet-button span').textContent.startsWith('0x'));
    assert(!q('#wallet-dialog').open);assert.equal(q('#chain-holder-wallet').textContent,'0x1234567890123456789012345678901234567890');
    assert(q('#chain-deploy').disabled,'Unavailable treasury artifacts must not enable deployment after connection');
  }finally{dom.window.close();}
});
