import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
function page(route){
 const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://example.com/'+route,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(['opportunities','app','portfolio-explorer','docs'].map(name=>fs.readFileSync(`dist/${name}.js`,'utf8')).join('\n'));return dom;
}
const chapters=['overview','ownership','treasury','distributions','wallet','faq'];
test('docs deep links resolve to one readable chapter and keep the main navigation active',()=>{
 for(const chapter of chapters){const dom=page('#docs/'+chapter);const d=dom.window.document;
  assert.equal(d.body.dataset.view,'docs');assert.equal(d.querySelector('.main-nav [aria-current="page"]').textContent,'Docs');
  assert.deepEqual([...d.querySelectorAll('[data-doc-page]')].filter(e=>!e.hidden).map(e=>e.dataset.docPage),[chapter]);
  assert.equal(d.querySelector('[data-doc-link][aria-current="page"]').dataset.docLink,chapter);
  assert.equal(d.querySelectorAll('.main-nav a').length,6);dom.window.close();
 }
});
test('chapter navigation, fallback, and the page skip link preserve the reading state',()=>{
 const dom=page('#docs/unknown'),w=dom.window,d=w.document;
 assert.equal(d.querySelector('[data-doc-link][aria-current="page"]').dataset.docLink,'overview');
 w.history.pushState(null,'','#docs/ownership');w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 assert.equal(d.activeElement,d.querySelector('[data-doc-page="ownership"] h1'));
 assert.equal(d.querySelector('.docs-page-next').getAttribute('href'),'#docs/treasury');
 w.history.pushState(null,'','#main');w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 assert.equal(d.body.dataset.view,'docs');assert.equal(d.querySelector('[data-doc-link][aria-current="page"]').dataset.docLink,'ownership');
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 const docs=d.querySelector('#view-docs').textContent;assert.doesNotMatch(docs,/launch status/i);
 assert.match(docs,/test-dollar token has no cash value/);assert.match(docs,/600 mUSD/);assert.match(docs,/400 mUSD/);
 dom.window.close();
});
