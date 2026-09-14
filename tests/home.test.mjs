import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

function page(path = '/', reduced = false) {
  const dom = new JSDOM(fs.readFileSync('dist/index.html','utf8'), {url:'https://example.com'+path, runScripts:'outside-only', pretendToBeVisual:true});
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  w.HTMLDialogElement.prototype.close = function(){this.open=false;};
  w.matchMedia = () => ({matches:reduced,addEventListener(){}});
  w.eval(['opportunities','app','portfolio-explorer','home'].map(file=>fs.readFileSync(`dist/${file}.js`,'utf8')).join('\n'));
  return dom;
}

test('home is the default and skip links preserve an initialized route', () => {
  for (const [path, expected] of [['/','home'],['/#main','home'],['/?treasury=0x123#main','treasury'],['/#launch','launch'],['/#holdings','holdings']]) {
    const dom=page(path); const w=dom.window;
    assert.equal(w.document.body.dataset.view,expected);
    assert.deepEqual([...w.document.querySelectorAll('.view')].filter(e=>!e.hidden).map(e=>e.id),['view-'+expected]);
    w.history.replaceState(null,'','#main'); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    assert.equal(w.document.body.dataset.view,expected);
    dom.window.close();
  }
});

test('home gallery respects reduced motion and opens company profiles', () => {
  const dom=page('/',true); const w=dom.window; const q=s=>w.document.querySelector(s);
  assert.equal(q('#home-company-wall').dataset.paused,'true');
  assert.equal(q('#view-home').dataset.motionPaused,'true');
  assert.match(q('#home-features-motion').textContent,/Play animations/);
  assert.match(q('#home-motion').textContent,/Play animation/);
  const originals=[...w.document.querySelectorAll('.company-track-set:not([aria-hidden]) .home-company')];
  assert.equal(originals.length,29);
  assert.equal(new Set(originals.map(e=>e.dataset.exposureCompany)).size,29);
  for(const e of w.document.querySelectorAll('.company-track-set[aria-hidden] button')) assert.equal(e.tabIndex,-1);
  originals[0].click(); assert.equal(q('#fund-dialog').open,true); assert.match(q('#fund-dialog-title').textContent,/Loyal/);
  q('#home-motion').click(); assert.equal(q('#home-company-wall').dataset.paused,'false');
  assert.equal(q('#home-features-motion').getAttribute('aria-pressed'),'false');
  q('#home-features-motion').click(); assert.equal(q('#home-company-wall').dataset.paused,'true');
  assert.equal(q('#view-home').dataset.motionPaused,'true');
  assert.equal(q('#home-motion').getAttribute('aria-pressed'),'true');
  assert.equal(w.document.querySelectorAll('.capital-feature').length,4);
  assert.equal(w.document.querySelectorAll('.capital-steps li').length,3);
  for(const link of w.document.querySelectorAll('.capital-feature a,.capital-steps a'))assert.ok(q('#view-'+link.hash.slice(1).split('/')[0]),link.hash);
  for(const link of w.document.querySelectorAll('.capital-platforms a')){assert.equal(link.protocol,'https:');assert.match(link.rel,/noopener/);}
  const menu=q('.sector-menu'); menu.open=true; q('[data-sector="robotics"]').click();
  assert.equal(menu.open,false); assert.equal(q('#sector-summary').textContent,'Robotics');
  const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id); assert.equal(new Set(ids).size,ids.length);
  dom.window.close();
});

test('fund search and niches retain indirect exposure labels and cannot activate unfunded claims',()=>{
 const dom=page('/#explore'),w=dom.window,q=s=>w.document.querySelector(s);
 q('#fund-niche').click();assert.equal(w.document.querySelectorAll('.fund-company-row').length,20);
 q('#fund-search').value='dogs';q('#fund-search').dispatchEvent(new w.Event('input'));
 assert.equal(w.document.querySelectorAll('.fund-company-row').length,1);
 q('.fund-company-main').click();assert.match(q('#fund-dialog').textContent,/indirect fund exposure/);
 assert.equal(q('#fund-dialog a').href,'https://loyal.com/');
 q('#fund-search').value='no matching company';q('#fund-search').dispatchEvent(new w.Event('input'));q('#fund-clear').click();
 assert.equal(w.document.querySelectorAll('.fund-company-row').length,29);
 assert.equal(q('.fund-claim-button').disabled,true);assert.match(q('#vcxx-balance').textContent,/—/);
 assert.equal(q('#portfolio-test-tools').open,false);
 for(const id of ['prometheus','anyscale','handshake','fin','risotto','luminos','erebor','stripe','rhino']){
  const row=q(`#fund-companies [data-exposure-company=${id}]`);assert.ok(row,id);row.click();assert.ok(q('#fund-dialog a').href.startsWith('https://'));
 }
 for(const container of ['#fund-directory','#portfolio-exposure']){
  const other=q(container+' .fund-other-assets');assert.equal(other.open,false);other.querySelector('summary').click();assert.equal(other.open,true);
  assert.equal(other.querySelectorAll('[data-fund-asset]').length,6);assert.equal(other.querySelectorAll('[data-exposure-company]').length,0);
  assert.match(other.textContent,/Data-center debt/);assert.match(other.textContent,/Cash management/);assert.match(other.textContent,/June 30, 2026/);
 }
 dom.window.close();
});

test('portfolio ignores stale balance responses when the connected wallet changes',async()=>{
 const dom=page('/#holdings'),w=dom.window,q=s=>w.document.querySelector(s),pending=[];
 w.fetch=()=>new Promise(resolve=>pending.push(resolve));
 const wallet=account=>w.document.dispatchEvent(new w.CustomEvent('mainstreet:wallet',{detail:{account}}));
 wallet('0x0000000000000000000000000000000000000001');
 wallet('0x0000000000000000000000000000000000000002');
 pending[1]({ok:true,json:async()=>({balance:'3.5',block:200})});await new Promise(r=>setTimeout(r,0));
 pending[0]({ok:true,json:async()=>({balance:'99',block:100})});await new Promise(r=>setTimeout(r,0));
 assert.match(q('#vcxx-balance').textContent,/3.5/);assert.match(q('#vcxx-balance-status').textContent,/0002/);
 assert.equal(q('#portfolio-exposure').dataset.balanceState,'held');assert.match(q('#portfolio-exposure-status').textContent,/3.5 VCXx verified/);assert.doesNotMatch(q('#portfolio-exposure-status').textContent,/99|claimed|received from Capital/i);
 wallet(null);assert.match(q('#vcxx-balance').textContent,/—/);assert.equal(q('#vcxx-wallet-link').hidden,true);assert.equal(q('#portfolio-exposure').dataset.balanceState,'disconnected');assert.doesNotMatch(q('#portfolio-exposure-status').textContent,/3.5/);dom.window.close();
});

test('portfolio shows compact fund rows with an expandable, dated company breakdown',()=>{
 const dom=page('/#holdings'),w=dom.window,q=s=>w.document.querySelector(s);
 const rows=[...w.document.querySelectorAll('#portfolio-exposure .portfolio-exposure-row')];
 assert.equal(rows.length,29);assert.equal(new Set(rows.map(e=>e.dataset.exposureCompany)).size,29);
 assert.equal(w.document.querySelectorAll('#portfolio-exposure>.portfolio-exposure-grid .portfolio-exposure-row').length,6);
 assert.equal(q('#portfolio-exposure-more').open,false);q('#portfolio-exposure-more summary').click();assert.equal(q('#portfolio-exposure-more').open,true);
 q('#portfolio-exposure-more [data-exposure-company=anthropic]').click();assert.match(q('#fund-dialog-title').textContent,/Anthropic/);assert.match(q('#fund-dialog').textContent,/indirect fund exposure/i);
 assert.equal(q('#portfolio-exposure time').dateTime,'2026-06-30');assert.match(q('.portfolio-exposure-note').textContent,/not individual company shares or payout allocations/);
 assert.match(q('.portfolio-exposure-note a').href,/sec.gov/);assert.equal(q('.fund-claim-button').disabled,true);
 assert.equal(q('#portfolio-exposure').dataset.balanceState,'disconnected');assert.match(q('#portfolio-exposure-status').textContent,/fund information/);
 q('#portfolio-exposure-more summary').click();assert.equal(q('#portfolio-exposure-more').open,false);dom.window.close();
});

test('portfolio company context distinguishes a verified zero from an unavailable balance',async()=>{
 const dom=page('/#holdings'),w=dom.window,q=s=>w.document.querySelector(s);
 try{const wallet=account=>w.document.dispatchEvent(new w.CustomEvent('mainstreet:wallet',{detail:{account}}));
 w.fetch=async()=>({ok:true,json:async()=>({balance:'0',block:300})});wallet('0x0000000000000000000000000000000000000001');
 assert.equal(q('#portfolio-exposure').dataset.balanceState,'loading');await new Promise(r=>setTimeout(r,0));
 assert.equal(q('#portfolio-exposure').dataset.balanceState,'empty');assert.match(q('#portfolio-exposure-status').textContent,/No VCXx detected/);
 w.fetch=async()=>({ok:false,json:async()=>({error:'RPC unavailable'})});q('#vcxx-refresh').click();await new Promise(r=>setTimeout(r,0));
 // No wallet adapter in this fixture; a new account event drives the failed read.
 wallet('0x0000000000000000000000000000000000000001');await new Promise(r=>setTimeout(r,0));
 assert.equal(q('#portfolio-exposure').dataset.balanceState,'unavailable');assert.doesNotMatch(q('#portfolio-exposure-status').textContent,/No VCXx detected|verified in/);assert.match(q('#vcxx-balance').textContent,/—/);
 assert.equal(q('.fund-claim-button').disabled,true);assert.equal(w.document.querySelectorAll('.portfolio-exposure-row').length,29);
 }finally{w.close();}
});
