import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { SECTIONS, FIELDS, blankPlan, fieldError, assess, packet, importPlan, reviewText } from '../src/launch-model.js';

test('launch budget uses exact cents and never treats filled fields as live approval', () => {
  const plan = blankPlan();
  Object.assign(plan.fields, {investment:'1000.10',fees:'35.01',reserve:'200.00',cash:'1100.10'});
  assert.equal(assess(plan).budget.required,123511n);
  assert.equal(assess(plan).budget.gap,13501n);
  const money = FIELDS.find(f=>f[0]==='investment');
  for(const bad of ['-1','1.001','1e3','0','NaN']) assert(fieldError(money,bad));
  for(const field of FIELDS) {
    const [key,,type,choices] = field;
    plan.fields[key] = type==='select'?choices.at(-1):type==='address'?'0x1234567890123456789012345678901234567890':type==='url'?'https://example.com':type==='money'?'10.00':type==='chain'?'1':type==='percent'?'70':'Operator supplied';
  }
  assert.equal(assess(plan).filled,FIELDS.length);
  assert.equal(assess(plan).liveEnabled,false);
  assert.equal(packet(plan).liveEnabled,false);
  assert.match(reviewText(plan),/Real-money actions are disabled/);
});

test('import validates untrusted files and cannot carry activation state', () => {
  const plan = blankPlan(); plan.fields.entity = 'Example Entity';
  const serialized = packet(plan); serialized.liveEnabled=true; serialized.fields.productionEnabled=true;
  assert.equal(packet(importPlan(serialized)).liveEnabled,false);
  assert.equal(importPlan(serialized).fields.productionEnabled,undefined);
  for (const bad of ['javascript:alert(1)','https://name:password@example.com']) {
    assert.throws(()=>importPlan({...serialized,fields:{...serialized.fields,offeringUrl:bad}}));
  }
  assert.throws(()=>importPlan({...serialized,evidence:[{name:'fraud',sha256:'no'}]}));
  assert.throws(()=>importPlan({...serialized,version:2}));
  assert.throws(()=>importPlan({...serialized,fields:{investment:12}}));
  assert.deepEqual(importPlan(packet(plan)),plan);
});

function browser(saved) {
  const dom = new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://mainstreet-equity.kenshipops.chatgpt.site/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window;
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.URL.createObjectURL=()=> 'blob:launch-export'; w.URL.revokeObjectURL=()=>{}; w.HTMLAnchorElement.prototype.click=function(){};
  if (saved) w.localStorage.setItem('mainstreet:launch-plan:v1',saved);
  w.eval(fs.readFileSync('dist/opportunities.js','utf8')+'\n'+fs.readFileSync('dist/app.js','utf8'));
  w.eval(fs.readFileSync('dist/launch.js','utf8'));
  return dom;
}
test('launch UI persists drafts, calculates budget, restores safely and links directory purchases', async () => {
  const dom=browser(); const w=dom.window; const q=s=>w.document.querySelector(s);
  try {
    assert.equal(w.document.body.dataset.view,'home');
    w.history.replaceState(null,'','#launch'); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    assert.equal(w.document.body.dataset.view,'launch');
    assert.equal(w.document.documentElement.dataset.launchApp,'ready');
    q('[data-launch-stage="purchase"]').click();
    for(const [key,value] of Object.entries({investment:'1000.10',fees:'35.01',reserve:'200',cash:'1100.10'})) {
      q('#launch-'+key).value=value; q('#launch-'+key).dispatchEvent(new w.Event('input',{bubbles:true}));
    }
    assert.match(q('#launch-budget').textContent,/\$135.01/);
    const saved=w.localStorage.getItem('mainstreet:launch-plan:v1'); assert(saved);
    const restored=browser(saved);
    restored.window.document.querySelector('[data-launch-stage="purchase"]').click();
    assert.equal(restored.window.document.querySelector('#launch-investment').value,'1000.10'); restored.window.close();
    q('#launch-investment').value='1.999'; q('#launch-investment').dispatchEvent(new w.Event('input',{bubbles:true}));
    q('#launch-export').click(); await Promise.resolve();
    assert.match(q('#launch-feedback').textContent,/Fix Proposed investment/);
    assert.equal(q('#launch-investment').getAttribute('aria-invalid'),'true');
    w.MainstreetDirectory.openOpportunity('miso-robotics');
    q('[data-launch-business="miso-robotics"]').click();
    assert.equal(q('#launch-business').value,'Miso Robotics');
    assert.equal(q('#holding-dialog').open,false);
    q('#launch-security').value='Negotiated preferred stock'; q('#launch-security').dispatchEvent(new w.Event('input',{bubbles:true}));
    w.MainstreetDirectory.openOpportunity('miso-robotics'); q('[data-launch-business="miso-robotics"]').click();
    assert.equal(q('#launch-security').value,'Negotiated preferred stock','Repeated selection must preserve operator edits');
    w.history.replaceState(null,'','/'); w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    assert.equal(w.document.body.dataset.view,'home','Returning to a bare URL must return to the home page');
    const attack=packet(blankPlan()); attack.fields.entity='<img src=x onerror=alert(1)>';
    const malicious=browser(JSON.stringify(attack)); malicious.window.document.querySelector('[data-launch-stage="entity"]').click();
    assert.equal(malicious.window.document.querySelector('#launch-entity').value,attack.fields.entity);
    assert.equal(malicious.window.document.querySelectorAll('#view-launch img').length,0); malicious.window.close();
    q('[data-launch-stage="review"]').click();
    assert.match(q('#launch-review-area').textContent,/Production remains disabled/);
  } finally { dom.window.close(); }
});

test('document fingerprints and imported drafts stay local and require deliberate replacement', async () => {
  const dom = browser(), w=dom.window, q=s=>w.document.querySelector(s);
  const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
  try {
    q('[data-launch-stage="review"]').click();
    const fileInput=q('#launch-evidence-file');
    Object.defineProperty(fileInput,'files',{configurable:true,value:[{name:'review.txt',size:3,arrayBuffer:async()=>new TextEncoder().encode('abc').buffer}]});
    fileInput.dispatchEvent(new w.Event('change')); await flush();
    assert.equal(q('#launch-evidence-list code').textContent,'0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    fileInput.dispatchEvent(new w.Event('change')); await flush();
    assert.match(q('#launch-feedback').textContent,/already has a reference/);
    assert.equal(q('#launch-evidence-list').children.length,1);
    const imported=packet(blankPlan()); imported.fields.entity='Imported Entity'; imported.liveEnabled=true;
    const upload=q('#launch-import');
    Object.defineProperty(upload,'files',{value:[{size:1000,text:async()=>JSON.stringify(imported)}]});
    upload.dispatchEvent(new w.Event('change')); await flush();
    assert.equal(q('#launch-import-dialog').open,true);
    assert.equal(JSON.parse(w.localStorage.getItem('mainstreet:launch-plan:v1')).evidence.length,1,'Import must leave the draft unchanged until confirmed');
    q('#launch-import-confirm').click();
    assert.equal(q('#launch-import-dialog').open,false);
    const saved=JSON.parse(w.localStorage.getItem('mainstreet:launch-plan:v1'));
    assert.equal(saved.fields.entity,'Imported Entity'); assert.equal(saved.liveEnabled,false); assert.equal(saved.evidence.length,0);
  } finally {dom.window.close();}
});
