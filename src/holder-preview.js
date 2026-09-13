import { escapeHTML as esc } from './chain-utils.js';

const $ = s => document.querySelector(s);
const paid = { A: false, B: false };
let account = 'A';
const amount = () => account === 'A' ? 600 : 400;
const units = () => account === 'A' ? 60 : 40;
const number = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function render() {
  const claimed = paid[account], allocation = amount();
  $('#holder-preview-content').innerHTML = `<div class="example-stats">
    <div><span>Example participation</span><strong>${units()}<small> / 100 units</small></strong><small>${units()}% of the example allocation</small></div>
    <div><span>Attributed example cost</span><strong>${number(15000 * units() / 100)}</strong><small>mUSD · not a market valuation</small></div>
    <div><span>Claimable in this example</span><strong>${number(claimed ? 0 : allocation)}</strong><small>mUSD · allocation already funded</small></div>
    <div><span>Example distributions claimed</span><strong>${number(claimed ? allocation : 0)}</strong><small>mUSD · no real payment</small></div>
  </div><div class="example-body"><section><h3>Underlying investment records</h3><p>Illustrative costs in real businesses. Mainstreet has not purchased these investments.</p>
    <div class="example-position"><span class="example-monogram" aria-hidden="true">AB</span><div><strong>Animoca Brands</strong><small>Tokenized beneficial share interest · Republic / INX</small></div><span>${number(10000 * units() / 100)}<br><small>attributed mUSD</small></span></div>
    <div class="example-position"><span class="example-monogram" aria-hidden="true">MR</span><div><strong>Miso Robotics</strong><small>Company equity · confirm provider documents</small></div><span>${number(5000 * units() / 100)}<br><small>attributed mUSD</small></span></div>
    <p style="margin-top:16px">Your Mainstreet units would describe your interest in the treasury structure. An allocation here does not make you a direct shareholder in either company.</p>
  </section><section class="example-allocation"><span class="example-badge">EXAMPLE DISTRIBUTION 01</span><h3>${claimed ? 'Example claim recorded' : 'Funded and ready to claim'}</h3><strong>${number(allocation)} <small>mUSD</small></strong><p>1,200 mUSD example income − 200 reserve = 1,000 funded. Holder A receives 600; Holder B receives 400. Each allocation can be claimed once.</p>
    <button class="button button-dark" id="example-claim" ${claimed ? 'disabled' : ''}>${claimed ? 'Claimed in this example' : `Try example claim · ${number(allocation)} mUSD`}</button>
    <div class="example-payment"><span>${claimed ? 'Simulated receipt · Holder ' + account : 'Recipient · Holder ' + account}</span><strong>${claimed ? 'Recorded' : 'Claimable'}</strong></div>
  </section></div>`;
  $('#example-claim').onclick = () => { if (paid[account]) return; paid[account] = true; render(); $('#example-feedback').textContent = `Holder ${account} claimed ${number(allocation)} example mUSD. Claimable is now zero; a second claim is disabled. No wallet transaction occurred.`; };
}

function initialize() {
  $('#wallet-empty').insertAdjacentHTML('beforebegin', `<div class="holder-mode" role="group" aria-label="Portfolio mode"><button id="holder-live-mode" aria-pressed="true">Connected wallet</button><button id="holder-example-mode" aria-pressed="false">Preview a holder</button><span>Robinhood Chain / Pons launch plan</span></div>
  <section id="holder-example" class="holder-preview" aria-label="Example holder portfolio" hidden><div class="holder-preview-head"><div><span class="example-badge">INTERACTIVE EXAMPLE · NO ASSETS OWNED</span><h2>See it as a holder.</h2><p>Switch between two participants to see investment records, funded allocations and a simulated claim.</p></div><div class="holder-preview-actions"><label for="example-account">Example holder<select id="example-account"><option value="A">Holder A · 60 units</option><option value="B">Holder B · 40 units</option></select></label><button class="text-button" id="example-reset">Reset example</button></div></div><div id="holder-preview-content"></div><div id="example-feedback" class="example-feedback" role="status" aria-live="polite"></div><div class="example-foot">The launch token on Pons and an underlying investment are separate assets. Republic’s <a href="https://republic.com/animoca-trade" target="_blank" rel="noopener noreferrer">Animoca program</a> represents beneficial share ownership on Solana. Wefunder investments can use <a href="https://help.wefunder.com/article/abf8c072-what-is-an-spv-or-custodian-account-and-how-does-it-affect-my-investment" target="_blank" rel="noopener noreferrer">direct, custodian or SPV structures</a>. Neither becomes a Robinhood Chain share by appearing in this portfolio. The signed investment and Mainstreet holder agreements determine rights.</div></section>`);
  const live = () => { const on = document.body.dataset.holderMode !== 'example'; $('#holder-example').hidden = on; $('#holder-live-mode').setAttribute('aria-pressed', String(on)); $('#holder-example-mode').setAttribute('aria-pressed', String(!on)); };
  $('#holder-live-mode').onclick = () => { document.body.dataset.holderMode = 'live'; live(); };
  $('#holder-example-mode').onclick = () => { document.body.dataset.holderMode = 'example'; live(); };
  $('#example-account').onchange = e => { account = e.target.value; $('#example-feedback').textContent = ''; render(); };
  $('#example-reset').onclick = () => { paid.A = false; paid.B = false; render(); $('#example-feedback').textContent = 'Example reset. Both allocations are available to try again.'; };
  render();
}
initialize();
