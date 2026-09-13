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
  w.eval(['opportunities','app','home'].map(file=>fs.readFileSync(`dist/${file}.js`,'utf8')).join('\n')); 
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
  assert.match(q('#home-motion').textContent,/Play animation/);
  const originals=[...w.document.querySelectorAll('.company-track-set:not([aria-hidden]) .home-company')];
  assert.equal(originals.length,19);
  assert.equal(new Set(originals.map(e=>e.dataset.opportunity)).size,19);
  for(const e of w.document.querySelectorAll('.company-track-set[aria-hidden] button')) assert.equal(e.tabIndex,-1);
  originals[0].click(); assert.equal(q('#holding-dialog').open,true); assert.match(q('#holding-title').textContent,/Miso Robotics/);
  q('#home-motion').click(); assert.equal(q('#home-company-wall').dataset.paused,'false');
  q('#home-motion').click(); assert.equal(q('#home-company-wall').dataset.paused,'true');
  const menu=q('.sector-menu'); menu.open=true; q('[data-sector="robotics"]').click();
  assert.equal(menu.open,false); assert.equal(q('#sector-summary').textContent,'Robotics');
  const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id); assert.equal(new Set(ids).size,ids.length);
  dom.window.close();
});
