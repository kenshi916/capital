// Run with npm test.
// Reads the current static directory. No build files or Site files are changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const { JSDOM } = require('jsdom');

function browser() {
  const dom = new JSDOM(fs.readFileSync('dist/index.html', 'utf8'), {
    url: 'https://mainstreet-equity.kenshipops.chatgpt.site/#explore', runScripts: 'outside-only'
  });
  const w = dom.window, errors = [];
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.addEventListener('error', e => errors.push(e.error || e.message));
  w.eval(fs.readFileSync('dist/opportunities.js', 'utf8') + '\n' + fs.readFileSync('dist/app.js', 'utf8'));
  const q = selector => { const element = w.document.querySelector(selector); assert(element, `Missing ${selector}`); return element; };
  const qa = selector => Array.from(w.document.querySelectorAll(selector));
  const raw = Array.from(w.MainstreetDirectory.opportunities, c => ({ id: c.id, name: c.name, instrument: c.instrument }));
  const shown = () => qa('#view-explore .opportunity-card').map(card => card.querySelector('[data-opportunity]').dataset.opportunity);
  const chooseSector = id => q(`[data-sector="${id}"]`).click();
  const chooseType = id => q(`[data-filter="${id}"]`).click();
  const search = value => { q('#company-search').value = value; q('#company-search').dispatchEvent(new w.Event('input', { bubbles: true })); };
  const assertShown = (expected, message) => {
    assert.deepEqual(shown().slice().sort(), expected.slice().sort(), message);
    assert.equal(q('#empty-state').hidden, expected.length > 0);
    assert.equal(q('#results-announcement').textContent, `${expected.length} ${expected.length === 1 ? 'business' : 'businesses'} shown`);
    for (const [kind, section, total] of [['Equity', 'equity-section', 'equity-total'], ['Debt', 'debt-section', 'loan-total']]) {
      const count = expected.filter(id => raw.find(c => c.id === id).instrument === kind).length;
      assert.equal(q('#' + section).hidden, count === 0);
      assert.equal(q('#' + total).textContent, String(count));
    }
  };
  return { dom, w, q, qa, raw, shown, chooseSector, chooseType, search, assertShown,
    close() { assert.deepEqual(errors, []); dom.window.close(); } };
}

test('nine sectors cover every one of 19 businesses exactly once and intersect with investment type and search', () => {
  const b = browser();
  try {
    const all = b.raw.map(c => c.id);
    assert.equal(all.length, 19);
    assert.equal(new Set(all).size, 19);
    b.assertShown(all);
    const sectors = b.qa('[data-sector]').filter(button => button.dataset.sector !== 'All');
    assert.equal(sectors.length, 9);
    const visited = [];
    for (const button of sectors) {
      const sector = button.dataset.sector;
      b.chooseType('All'); b.search(''); b.chooseSector(sector);
      const members = b.shown();
      assert(members.length > 0, `${sector} must not be an empty category`);
      assert.equal(Number(button.querySelector('span').textContent), members.length, `${sector} category count must match its unfiltered membership`);
      assert.deepEqual(b.qa('[data-sector][aria-pressed="true"]').map(el => el.dataset.sector), [sector]);
      visited.push(...members);
      for (const type of ['Equity', 'Debt']) {
        b.chooseType(type);
        const expected = members.filter(id => b.raw.find(c => c.id === id).instrument === type);
        b.assertShown(expected, `${sector} + ${type} must use intersection, not union`);
        assert.equal(b.q(`[data-sector="${sector}"]`).getAttribute('aria-pressed'), 'true', 'Changing investment type must preserve the sector');
        assert.equal(b.q(`[data-filter="${type}"]`).getAttribute('aria-pressed'), 'true');
        if (expected.length) {
          const target = b.raw.find(c => c.id === expected[0]);
          b.search('  ' + target.name.toUpperCase() + '  ');
          b.assertShown([target.id], `${sector} + ${type} + search must remain conjunctive and trim/case-normalize text`);
          b.search(''); b.assertShown(expected);
        }
      }
    }
    assert.equal(visited.length, 19, 'Summed sector membership must contain exactly 19 entries');
    assert.equal(new Set(visited).size, 19, 'No business may appear under multiple sectors');
    assert.deepEqual(visited.slice().sort(), all.slice().sort(), 'No business may be omitted from the sector browser');
  } finally { b.close(); }
});

test('sector changes retain type/search filters while Clear filters resets all directory dimensions', () => {
  const b = browser();
  try {
    const initialOrder = b.shown();
    b.chooseSector('health'); b.chooseType('Debt'); b.search('Eisana');
    b.assertShown(['eisana-health']);
    b.chooseSector('food'); b.assertShown([], 'Sector change must not silently clear the active search');
    assert.equal(b.q('#company-search').value, 'Eisana');
    assert.equal(b.q('[data-filter="Debt"]').getAttribute('aria-pressed'), 'true');
    b.chooseSector('All'); b.assertShown(['eisana-health'], 'All sectors must retain type/search filters');
    b.search('');
    b.assertShown(b.raw.filter(c => c.instrument === 'Debt').map(c => c.id));
    b.chooseType('All'); b.search('  HEALTHCARE  ');
    b.assertShown(['chatrx', 'eisana-health'], 'Search must include human-readable sector labels');
    b.chooseSector('food'); b.assertShown([]);
    b.q('#company-sort').value = 'name'; b.q('#company-sort').dispatchEvent(new b.w.Event('change'));
    b.q('#reset-filters').click();
    b.assertShown(b.raw.map(c => c.id));
    assert.deepEqual(b.shown(), initialOrder, 'Reset must restore featured order');
    assert.equal(b.q('#company-search').value, '');
    assert.equal(b.q('#company-sort').value, 'featured');
    assert.equal(b.q('[data-sector="All"]').getAttribute('aria-pressed'), 'true');
    assert.equal(b.q('[data-filter="All"]').getAttribute('aria-pressed'), 'true');
    assert.equal(b.w.document.activeElement, b.q('#company-search'));
    b.chooseSector('robotics'); b.chooseType('Watchlist'); b.assertShown(['miso-robotics']);
    b.search('no match'); b.assertShown([]);
    b.q('#view-watchlist').click();
    b.assertShown(['miso-robotics', 'startengine', 'atombeam'], 'Open research list must clear sector/search while retaining Watchlist');
    assert.equal(b.q('[data-sector="All"]').getAttribute('aria-pressed'), 'true');
    assert.equal(b.q('[data-filter="Watchlist"]').getAttribute('aria-pressed'), 'true');
    assert.equal(b.q('#company-search').value, '');
  } finally { b.close(); }
});

