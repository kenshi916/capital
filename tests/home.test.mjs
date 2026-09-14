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
  assert.equal(originals.length,20);
  assert.equal(new Set(originals.map(e=>e.dataset.exposureCompany)).size,20);
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
 q('#fund-niche').click();assert.equal(w.document.querySelectorAll('.fund-company-row').length,12);
 q('#fund-search').value='dogs';q('#fund-search').dispatchEvent(new w.Event('input'));
 assert.equal(w.document.querySelectorAll('.fund-company-row').length,1);
 q('.fund-company-main').click();assert.match(q('#fund-dialog').textContent,/indirect fund exposure/);
 assert.equal(q('#fund-dialog a').href,'https://loyal.com/');
 q('#fund-search').value='no matching company';q('#fund-search').dispatchEvent(new w.Event('input'));q('#fund-clear').click();
 assert.equal(w.document.querySelectorAll('.fund-company-row').length,20);
 assert.equal(q('.fund-claim-button').disabled,true);assert.match(q('#vcxx-balance').textContent,/—/);
 assert.equal(q('#portfolio-test-tools').open,false);dom.window.close();
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
 wallet(null);assert.match(q('#vcxx-balance').textContent,/—/);assert.equal(q('#vcxx-wallet-link').hidden,true);dom.window.close();
});
