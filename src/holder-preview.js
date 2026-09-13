import { escapeHTML as esc } from './chain-utils.js';

const $ = s => document.querySelector(s);
const paid = { A: false, B: false };
const ballots = { A: null, B: null };
let account = 'A';
const amount = () => account === 'A' ? 600 : 400;
const units = () => account === 'A' ? 60 : 40;
const number = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const company = id => window.MainstreetDirectory.opportunities.find(c => c.id === id);
const portrait = c => `<img class="company-portrait" src="${esc(c.image)}" alt="${esc(c.name)}" width="64" height="64" style="object-fit:${c.imageFit || 'cover'};object-position:${c.imagePosition || 'center'}">`;
const positions = [{ id: 'animoca-brands', cost: 8000 }, { id: 'miso-robotics', cost: 4000 }, { id: 'organic-transit', cost: 3000 }];
const candidates = ['sunday-supper', 'blushift-aerospace', 'simplex-chat'];

function render() {
  const claimed = paid[account], allocation = amount();
  $('#holder-preview-content').innerHTML = `<div class="example-stats">
    <div><span>Attributed example cost</span><strong>${number(15000 * units() / 100)}</strong><small>mUSD · at cost, not market value</small></div>
    <div><span>Current test participation</span><strong>${units()}<small> / 100 units</small></strong><small>${units()}% of this example treasury</small></div>
    <div><span>Cash available to claim</span><strong>${number(claimed ? 0 : allocation)}</strong><small>mUSD · simulated distribution</small></div>
    <div><span>Cash already distributed</span><strong>${number(claimed ? allocation : 0)}</strong><small>mUSD · simulated payment</small></div>
  </div>
  <section class="portfolio-block" aria-labelledby="example-investments-title"><div class="portfolio-section-head"><div><span class="micro-label">YOUR PORTFOLIO</span><h3 id="example-investments-title">Business holdings</h3><p>Real companies. Illustrative investment records.</p></div><span class="quiet-pill">3 example positions</span></div>
    <div class="investment-list">${positions.map(({id,cost}) => { const c = company(id); return `<article class="investment-strip glass-panel">
      <div class="investment-identity">${portrait(c)}<div><span class="micro-label">${esc(c.platform)}</span><h4>${esc(c.name)}</h4><p>${esc(c.security)}</p></div></div>
      <div class="strip-metric"><span>Your attributed cost</span><strong>${number(cost * units() / 100)} <small>mUSD</small></strong><small>Illustrative · not purchased</small></div>
      <div class="strip-metric equity-state"><span>Equity issued to you</span><strong>0 shares</strong><small>Holder rights not established</small></div>
      <button class="strip-action" data-opportunity="${id}" aria-label="View ${esc(c.name)} offering">View offering ↗</button>
    </article>`; }).join('')}</div>
    <p class="portfolio-note">Attributed cost is your example treasury allocation. Company shares or beneficial interests appear as owned only after a verified purchase and a documented allocation to you.</p>
  </section>
  <section class="portfolio-block distribution-block" aria-labelledby="example-distributions-title"><div class="portfolio-section-head"><div><span class="micro-label">PAYMENTS & OWNERSHIP</span><h3 id="example-distributions-title">Your distributions</h3><p>Cash payments and equity transfers have separate records.</p></div></div>
    <article class="distribution-strip glass-panel"><span class="distribution-symbol" aria-hidden="true">↓</span><div class="distribution-copy"><span class="micro-label">CASH · EXAMPLE DISTRIBUTION 01</span><h4>${claimed ? 'Paid in this example' : 'Funded and ready to claim'}</h4><p>Holder ${account} · fixed ${units()}% allocation of 1,000 mUSD</p></div><strong class="distribution-value">${number(allocation)} <small>mUSD</small></strong><button class="button button-dark" id="example-claim" ${claimed ? 'disabled' : ''}>${claimed ? 'Claimed' : 'Try example claim'}</button></article>
    <article class="distribution-strip glass-panel equity-distribution"><span class="distribution-symbol" aria-hidden="true">◇</span><div class="distribution-copy"><span class="micro-label">EQUITY DISTRIBUTIONS</span><h4>No company equity distributed yet</h4><p>Company, security, quantity, allocation date and supporting documents will belong here once verified.</p></div><span class="quiet-pill">Not issued</span></article>
    <details class="distribution-details"><summary>How this example is calculated</summary><p>1,200 mUSD example income minus a 200 mUSD reserve leaves 1,000 mUSD funded. Holder A receives 600; Holder B receives 400. These are portfolio cash allocations, not dividends attributed to any listed company. Each example claim can be made once.</p></details>
  </section>
  <section id="community-voting" class="portfolio-block" aria-labelledby="community-voting-title"><div class="portfolio-section-head"><div><span class="micro-label">A SAY IN WHAT COMES NEXT</span><h3 id="community-voting-title">Community voting</h3><p>Which business would you want Capital to fund?</p></div><span class="quiet-pill">Preview ballot</span></div>
    <p class="portfolio-note voting-note">Try one preference per example holder. You can change your choice. This preview stays in this page session; it is not a submitted community vote or a company shareholder vote.</p>
    <div class="investment-list">${candidates.map(id => { const c = company(id), selected = ballots[account] === id; return `<article class="vote-strip glass-panel${selected ? ' is-selected' : ''}"><div class="investment-identity">${portrait(c)}<div><span class="micro-label">${esc(c.platform)} · ${esc(c.security)}</span><h4>${esc(c.name)}</h4><p>${esc(c.description)}</p></div></div><button class="strip-action" data-opportunity="${id}" aria-label="Research ${esc(c.name)}">Details ↗</button><button class="button ${selected ? 'button-dark' : 'button-light'}" data-example-vote="${id}" aria-pressed="${selected}">${selected ? '✓ Your choice' : 'Choose business'}</button></article>`; }).join('')}</div>
    <div id="example-vote-status" class="ballot-status" role="status">${ballots[account] ? `Holder ${account}’s preview choice: ${esc(company(ballots[account]).name)}.` : `Holder ${account} has not chosen a business yet.`}</div>
  </section>`;
  $('#example-claim').onclick = () => { if (paid[account]) return; paid[account] = true; render(); $('#example-feedback').textContent = `Holder ${account} claimed ${number(allocation)} example mUSD. Claimable is now zero; a second claim is disabled. No wallet transaction occurred.`; };
  document.querySelectorAll('[data-example-vote]').forEach(button => { button.onclick = () => { ballots[account] = ballots[account] === button.dataset.exampleVote ? null : button.dataset.exampleVote; render(); $('#example-feedback').textContent = ballots[account] ? `Preview choice saved for Holder ${account}: ${company(ballots[account]).name}. No community vote has been submitted.` : `Holder ${account}’s preview choice cleared.`; }; });
}

function setMode(mode) {
  const live = mode === 'live';
  document.body.dataset.holderMode = mode;
  $('#holder-example').hidden = live;
  $('#holder-live-mode').setAttribute('aria-pressed', String(live));
  $('#holder-example-mode').setAttribute('aria-pressed', String(!live));
}

function initialize() {
  $('#wallet-empty').insertAdjacentHTML('beforebegin', `<div class="holder-mode" role="group" aria-label="Portfolio mode"><button id="holder-live-mode" aria-pressed="true">Connected wallet</button><button id="holder-example-mode" aria-pressed="false">Preview a holder</button><span>Robinhood Chain / Pons launch plan</span></div>
  <section id="holder-example" class="holder-preview" aria-label="Example holder portfolio" hidden><div class="holder-preview-head"><div><span class="example-badge">INTERACTIVE EXAMPLE · NO ASSETS OWNED</span><h2>Your investments. In one place.</h2><p>See your business interests, distributions and community preferences.</p></div><div class="holder-preview-actions"><label for="example-account">Example holder<select id="example-account"><option value="A">Holder A · 60 units</option><option value="B">Holder B · 40 units</option></select></label><button class="text-button" id="example-reset">Reset example</button></div></div><div id="example-feedback" class="example-feedback" role="status" aria-live="polite"></div><div id="holder-preview-content"></div><details class="example-foot"><summary>What establishes a real holding?</summary><p>The launch token on Pons and an underlying investment are separate assets. Republic’s <a href="https://republic.com/animoca-trade" target="_blank" rel="noopener noreferrer">Animoca program</a> represents beneficial share ownership on Solana. Wefunder investments can use <a href="https://help.wefunder.com/article/abf8c072-what-is-an-spv-or-custodian-account-and-how-does-it-affect-my-investment" target="_blank" rel="noopener noreferrer">direct, custodian or SPV structures</a>. A SAFE is an agreement for possible future equity, not currently issued shares. Capital needs accepted purchase documents and enforceable holder agreements before reporting real ownership or distributing interests.</p></details></section>`);
  $('#holdings-content').insertAdjacentHTML('beforeend', `<section class="live-equity-overview portfolio-block"><div class="portfolio-section-head"><div><span class="micro-label">COMPANY OWNERSHIP</span><h2>Equity distributions</h2><p>No real company equity has been issued through Capital.</p></div><span class="quiet-pill">0 verified transfers</span></div><p class="portfolio-note">Your connected balances above are testnet records. Real holdings require verified provider purchases and documented holder rights.</p><div class="live-community-note"><div><h3>Community voting</h3><p>Live voting opens after holder eligibility and voting rules are established.</p></div><button class="button button-light" data-preview-voting>Preview a vote ↗</button></div></section>`);
  $('#holder-live-mode').onclick = () => setMode('live');
  $('#holder-example-mode').onclick = () => setMode('example');
  $('#example-account').onchange = e => { account = e.target.value; $('#example-feedback').textContent = ''; render(); };
  $('#example-reset').onclick = () => { paid.A = false; paid.B = false; ballots.A = null; ballots.B = null; render(); $('#example-feedback').textContent = 'Example reset. Both claims are available and both preview ballots are clear.'; };
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-preview-voting]')) return;
    setMode('example');
    const reveal = () => $('#community-voting').scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    if (location.hash !== '#holdings') window.addEventListener('hashchange', reveal, {once:true});
    else reveal();
    window.MainstreetDirectory.navigate('holdings');
  });
  render();
}
initialize();
