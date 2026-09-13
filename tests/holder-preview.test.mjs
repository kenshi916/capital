// Run with npm test.
// Exercises current source through an in-memory bundle; never writes build outputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
const { outputFiles } = await build({ entryPoints: ['src/holder-preview.js'], bundle: true, write: false, format: 'iife', target: ['es2022'] });
const previewScript = outputFiles[0].text;

function browser() {
  const dom = new JSDOM(fs.readFileSync('dist/index.html', 'utf8'), {
    url: 'https://mainstreet-equity.kenshipops.chatgpt.site/#holdings',
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window, calls = [], errors = [], scrollTargets = [];
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this.id); };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async (...args) => { calls.push(['fetch', ...args]); throw new Error('Preview attempted network access'); };
  w.ethereum = { request: async request => { calls.push(['wallet', request]); throw new Error('Preview attempted a wallet request'); } };
  w.addEventListener('error', e => errors.push(e.error || e.message));
  w.eval(fs.readFileSync('dist/opportunities.js', 'utf8') + '\n' + fs.readFileSync('dist/app.js', 'utf8'));
  w.eval(previewScript);
  const q = selector => { const element = w.document.querySelector(selector); assert(element, `Missing ${selector}`); return element; };
  const qa = selector => Array.from(w.document.querySelectorAll(selector));
  const chooseHolder = holder => { q('#example-account').value = holder; q('#example-account').dispatchEvent(new w.Event('change', { bubbles: true })); };
  const votes = () => qa('[data-example-vote][aria-pressed="true"]').map(el => el.dataset.exampleVote);
  const choose = candidate => q(`[data-example-vote="${candidate}"]`).click();
  const stat = label => {
    const row = qa('.example-stats > div').find(el => el.querySelector('span')?.textContent === label);
    assert(row, `Missing stat: ${label}`);
    return row.querySelector('strong').textContent.trim();
  };
  const close = () => { assert.deepEqual(errors, [], 'Preview must not throw browser errors'); assert.deepEqual(calls, [], 'Preview actions must remain local'); dom.window.close(); };
  return { dom, w, q, qa, calls, errors, scrollTargets, chooseHolder, choose, votes, stat, close };
}

const FIRST = 'sunday-supper', SECOND = 'blushift-aerospace', THIRD = 'simplex-chat';

test('connected-wallet mode remains the default; preview and live modes are explicit', () => {
  const b = browser();
  try {
    assert.equal(b.q('#holder-example').hidden, true);
    assert.equal(b.q('#holder-live-mode').getAttribute('aria-pressed'), 'true');
    assert.equal(b.q('#holder-example-mode').getAttribute('aria-pressed'), 'false');
    assert.equal(b.q('#wallet-empty').hidden, false, 'Disconnected visitors still see the wallet connection prompt');
    b.q('#holder-example-mode').click();
    assert.equal(b.w.document.body.dataset.holderMode, 'example');
    assert.equal(b.q('#holder-example').hidden, false);
    assert.equal(b.q('#holder-live-mode').getAttribute('aria-pressed'), 'false');
    assert.equal(b.q('#holder-example-mode').getAttribute('aria-pressed'), 'true');
    assert.match(b.q('#holder-example').textContent, /INTERACTIVE EXAMPLE.*NO ASSETS OWNED/);
    b.q('#holder-live-mode').click();
    assert.equal(b.w.document.body.dataset.holderMode, 'live');
    assert.equal(b.q('#holder-example').hidden, true);
    assert.match(b.q('.live-community-note').textContent, /Live voting opens after holder eligibility/);
  } finally { b.close(); }
});

test('ballots belong to individual holders, replace previous choices and toggle off', () => {
  const b = browser();
  try {
    b.q('#holder-example-mode').click();
    assert.deepEqual(b.votes(), []);
    b.choose(FIRST); assert.deepEqual(b.votes(), [FIRST]);
    b.choose(SECOND); assert.deepEqual(b.votes(), [SECOND], 'One holder cannot select two candidates');
    b.chooseHolder('B'); assert.deepEqual(b.votes(), [], 'Holder B must not inherit Holder A’s ballot');
    b.choose(THIRD); assert.deepEqual(b.votes(), [THIRD]);
    b.chooseHolder('A'); assert.deepEqual(b.votes(), [SECOND], 'Switching back must restore only A’s choice');
    b.q('#example-claim').click(); assert.deepEqual(b.votes(), [SECOND], 'Claiming does not erase a ballot');
    b.choose(SECOND); assert.deepEqual(b.votes(), [], 'Choosing the selected candidate again clears the ballot');
    b.chooseHolder('B'); assert.deepEqual(b.votes(), [THIRD], 'Changing A’s ballot must not change B’s');
    assert.match(b.q('#example-vote-status').textContent, /Holder B/);
    assert.match(b.q('.voting-note').textContent, /not a submitted community vote/);
  } finally { b.close(); }
});

test('cash claims stay at 600/400, reject repeated activation and never issue equity', () => {
  const b = browser();
  try {
    b.q('#holder-example-mode').click();
    assert.equal(b.stat('Attributed example cost'), '9,000.00');
    assert.deepEqual(b.qa('.investment-strip .equity-state strong').map(el => el.textContent), ['0 shares', '0 shares', '0 shares']);
    assert.deepEqual(b.qa('.investment-strip .strip-metric:not(.equity-state) strong').map(el => el.textContent.trim()), ['4,800.00 mUSD', '2,400.00 mUSD', '1,800.00 mUSD']);
    assert.equal(b.stat('Cash available to claim'), '600.00');
    assert.equal(b.stat('Cash already distributed'), '0.00');
    b.q('#example-claim').click();
    assert.equal(b.stat('Cash available to claim'), '0.00');
    assert.equal(b.stat('Cash already distributed'), '600.00');
    assert.equal(b.q('#example-claim').disabled, true);
    const receipt = b.q('#example-feedback').textContent;
    b.q('#example-claim').dispatchEvent(new b.w.MouseEvent('click', { bubbles: true }));
    assert.equal(b.stat('Cash already distributed'), '600.00', 'Even a programmatic second activation must not double-credit');
    assert.equal(b.q('#example-feedback').textContent, receipt);
    b.chooseHolder('B');
    assert.equal(b.stat('Attributed example cost'), '6,000.00');
    assert.equal(b.stat('Cash available to claim'), '400.00');
    assert.equal(b.stat('Cash already distributed'), '0.00');
    assert.equal(b.q('#example-claim').disabled, false);
    b.q('#example-claim').click();
    assert.equal(b.stat('Cash available to claim'), '0.00');
    assert.equal(b.stat('Cash already distributed'), '400.00');
    b.chooseHolder('A'); assert.equal(b.stat('Cash already distributed'), '600.00');
    assert.deepEqual(b.qa('.investment-strip .equity-state strong').map(el => el.textContent), ['0 shares', '0 shares', '0 shares']);
  } finally { b.close(); }
});

test('reset clears both holders’ claims and ballots without activating live voting', () => {
  const b = browser();
  try {
    b.q('#holder-example-mode').click(); b.choose(FIRST); b.q('#example-claim').click();
    b.chooseHolder('B'); b.choose(SECOND); b.q('#example-claim').click();
    b.q('#example-reset').click();
    for (const [holder, allocation] of [['A', '600.00'], ['B', '400.00']]) {
      b.chooseHolder(holder);
      assert.deepEqual(b.votes(), [], `Reset must clear Holder ${holder}’s ballot`);
      assert.equal(b.stat('Cash available to claim'), allocation);
      assert.equal(b.stat('Cash already distributed'), '0.00');
      assert.equal(b.q('#example-claim').disabled, false);
    }
    assert.equal(b.w.document.body.dataset.holderMode, 'example');
    assert.match(b.q('.live-community-note').textContent, /Live voting opens after holder eligibility/);
  } finally { b.close(); }
});

test('live portfolio vote link opens only the local preview ballot', () => {
  const b = browser();
  try {
    b.q('.live-community-note [data-preview-voting]').click();
    assert.equal(b.w.location.hash, '#holdings');
    assert.equal(b.w.document.body.dataset.holderMode, 'example');
    assert.equal(b.q('#holder-example').hidden, false);
    assert.deepEqual(b.scrollTargets, ['community-voting']);
    assert.deepEqual(b.votes(), []);
  } finally { b.close(); }
});

