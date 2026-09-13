import { sha256 } from 'ethers';
import { escapeHTML as esc } from './chain-utils.js';
import { SECTIONS, FIELDS, EVIDENCE_TYPES, PRODUCTION_BLOCKERS, blankPlan, fieldError, assess, packet, importPlan, reviewText, usd } from './launch-model.js';
import { PONS, inspectPons } from './pons.js';

const $ = s => document.querySelector(s), KEY = 'mainstreet:launch-plan:v1';
let plan = blankPlan(), stage = 'token', pendingImport = null, importGeneration = 0, evidenceGeneration = 0;
let connectedHolder = null, ponsSequence = 0;
document.addEventListener('mainstreet:wallet', e => { if (connectedHolder === e.detail.account) return; connectedHolder = e.detail.account; clearPonsResult(); });
function clearPonsResult() { ponsSequence++; const result = $('#pons-result'); if (result) result.textContent = 'Enter a launched token address below to read its Pons V2 registration and fee recipient. Connect a wallet to check its launch access and token balance.'; }
async function checkPons() {
  const seq = ++ponsSequence, token = plan.fields.tokenAddress, recipient = plan.fields.feeWallet;
  const result = $('#pons-result'); result.textContent = 'Reading Robinhood Chain…'; $('#pons-check').disabled = true;
  try {
    const d = await inspectPons({token,recipient,holder:connectedHolder}); if (seq !== ponsSequence) return;
    const addressLink = (address,label) => `<a href="${PONS.explorer}/address/${address}" target="_blank" rel="noopener noreferrer">${esc(label || address)}</a>`;
    const rows = [['Network','Robinhood Chain · 4663'],['Read at block',d.block.toLocaleString()],['Connected wallet launch access',d.canLaunch == null ? 'Connect a wallet to check' : d.canLaunch ? 'Permitted by the factory at this block' : 'Not permitted by the factory at this block']];
    if (d.token) rows.push(['Registered token',esc(d.name)+' · '+esc(d.symbol)],['Token address',addressLink(d.token)],['Your launch-token balance',d.walletBalance == null ? 'Connect a wallet to read' : esc(d.walletBalance)+' '+esc(d.symbol)],['Current creator fee recipient',addressLink(d.recipient)],['Recipient matches your plan',d.recipientMatches == null ? 'No expected recipient supplied' : d.recipientMatches ? 'Matches' : '<strong class="is-error">Mismatch — fees go to the address above</strong>'],['Phase',['Bonding curve','Pool pending','V4 pool created','Rescued'][d.phase] || 'Unknown'],['Quote asset',d.quote === '0x0000000000000000000000000000000000000000' ? 'Native ETH' : addressLink(d.quote,d.quoteSymbol)],['Creator tax',`${d.creatorTaxBps/100}%`],['Protocol share of base fees',`${d.protocolShareBps/100}%`],['Recipient escrow balance · all launches',esc(d.claimable)+' '+esc(d.quoteSymbol)],['Unswept curve estimate',d.unswept == null ? 'Pool-stage pending fees are not indexed here' : esc(d.unswept)+' '+esc(d.quoteSymbol)],['Pending recipient change',d.pendingRecipient ? addressLink(d.pendingRecipient.address) : 'None reported']);
    result.innerHTML = `<strong>${d.token ? 'Pons V2 registration and references matched' : 'Robinhood Chain connection checked'}</strong><dl>${rows.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${value}</dd></div>`).join('')}</dl><p>${d.token ? 'Escrow balances include all launches using that recipient. They are not Capital-only revenue or holder payouts. Unswept estimates are not settled cash. This check does not establish who controls the token or provide a contract audit.' : 'No Capital token address supplied. This check does not launch a token.'}</p>`;
  } catch(e) { if (seq === ponsSequence) result.textContent = `Not verified. ${e.code === 'INVALID_ARGUMENT' ? 'Enter valid public token and recipient addresses.' : e.message?.startsWith('This address') || e.message?.startsWith('The token') || e.message?.startsWith('RPC returned') ? e.message : 'The public network endpoint did not complete the read. Retry later; balances and launch access remain unknown.'}`; }
  finally { $('#pons-check').disabled = false; }
}
function message(value, error = false) { $('#launch-feedback').textContent = value; $('#launch-feedback').classList.toggle('launch-error', error); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(packet(plan))); $('#launch-save-status').textContent = 'Saved in this browser · not shared'; }
  catch { $('#launch-save-status').textContent = 'Browser save unavailable · download a backup'; }
}
function download(name, value, type) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fieldHTML(field) {
  const [key, label, type, hint] = field, value = plan.fields[key], invalid = fieldError(field, value);
  const attr = `id="launch-${key}" name="${key}" aria-describedby="launch-error-${key}" aria-invalid="${!!invalid}"`;
  let control;
  if (type === 'textarea') control = `<textarea ${attr} rows="3" maxlength="2000" placeholder="${esc(hint)}">${esc(value)}</textarea>`;
  else if (type === 'select') control = `<select ${attr}><option value="">Choose status</option>${hint.map(v => `<option${value === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  else control = `<input ${attr} type="${type === 'url' ? 'url' : 'text'}" ${['money','percent'].includes(type) ? 'inputmode="decimal"' : type === 'chain' ? 'inputmode="numeric"' : ''} maxlength="500" value="${esc(value)}" placeholder="${esc(hint)}" autocomplete="off">`;
  return `<label class="${type === 'textarea' ? 'launch-wide' : ''}" for="launch-${key}"><span>${esc(label)}</span>${control}<small class="launch-field-error" id="launch-error-${key}">${esc(invalid)}</small></label>`;
}
function renderSummary() {
  const a = assess(plan);
  $('#launch-count').textContent = `${a.filled} / ${a.total}`;
  $('#launch-progress').value = a.filled;
  $('#launch-next').textContent = a.filled === a.total ? 'Draft fields complete. External verification and production integration are still required.' : `Next: ${SECTIONS.find(s => a.sections.find(x => x.id === s.id).filled < s.fields.length)?.title}. Fill in the details you have; you can return to the rest.`;
  for (const s of a.sections) $(`[data-launch-count="${s.id}"]`).textContent = `${s.filled}/${s.total}`;
  $('#launch-document-count').textContent = `${plan.evidence.length} references`;
  $('#launch-budget').innerHTML = a.budget ? `<dl><div><dt>Purchase + fees</dt><dd>${usd(a.budget.purchase)}</dd></div><div><dt>Including cash reserve</dt><dd>${usd(a.budget.required)}</dd></div><div><dt>Reported settled cash</dt><dd>${usd(a.budget.cash)}</dd></div><div class="launch-budget-gap"><dt>${a.budget.gap > 0n ? 'Additional cash needed' : 'Cash after purchase & reserve'}</dt><dd>${usd(a.budget.gap > 0n ? a.budget.gap : -a.budget.gap)}</dd></div></dl><p>USD estimates from your inputs. Count only received creator fees allocated to Capital and settled in an accepted payment asset. Pending fees and test dollars are not available purchase funds.</p>` : '<p>Enter the investment, costs, reserve and settled creator-fee funds in First purchase to calculate the funding gap. Enter 0 where applicable.</p>';
}
function renderEvidence() {
  $('#launch-evidence-list').innerHTML = plan.evidence.length ? plan.evidence.map((e, i) => `<article class="launch-document"><div><strong>${esc(e.type)}</strong><span>${esc(e.name)} · ${(e.size/1024).toFixed(1)} KB</span><code>${esc(e.sha256)}</code><small>File fingerprint only · not verified</small></div><button type="button" class="text-button" data-remove-evidence="${i}" aria-label="Remove ${esc(e.type)} reference for ${esc(e.name)}">Remove</button></article>`).join('') : '<p class="launch-empty">No documents referenced yet. Add the approvals and confirmations as they become available.</p>';
}
function renderStage(focus = false) {
  document.querySelectorAll('[data-launch-stage]').forEach(el => { const active = el.dataset.launchStage === stage; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); });
  const section = SECTIONS.find(s => s.id === stage), review = stage === 'review';
  $('#launch-form-area').hidden = review; $('#launch-review-area').hidden = !review;
  $('#launch-stage-title').textContent = section?.title || 'Review & evidence';
  $('#launch-stage-intro').textContent = section?.intro || 'Keep the supporting document references with your plan and export a packet for review.';
  if (section) $('#launch-fields').innerHTML = section.fields.map(fieldHTML).join('');
  $('#launch-purchase-tools').hidden = stage !== 'purchase';
  $('#launch-stage-back').hidden = stage === 'token';
  $('#launch-stage-next').hidden = review;
  if (review) renderReview();
  renderSummary();
  if (stage === 'purchase' && $('.launch-context-details')) $('.launch-context-details').open = true;
  if (focus) $('#launch-stage-title').focus({preventScroll:true});
}
function renderReview() {
  const a = assess(plan);
  $('#launch-review-summary').innerHTML = a.sections.map(s => `<div><span>${esc(s.title)}</span><strong>${s.filled}/${s.total} fields</strong><button type="button" class="text-button" data-launch-stage="${s.id}">Edit<span class="sr-only"> ${esc(s.title)}</span></button></div>`).join('');
  $('#launch-invalid-summary').textContent = a.invalid.length ? `Fix ${a.invalid.length} invalid field${a.invalid.length === 1 ? '' : 's'} before exporting.` : 'Missing fields will be marked as not provided in your review packet.';
  renderEvidence();
}
function readSaved() {
  try {
    const saved = localStorage.getItem(KEY); if (!saved) return;
    // Restore an in-progress draft, including invalid entries so typing is never lost.
    const data = JSON.parse(saved), raw = data.fields;
    const clean = importPlan({...data, fields: {}});
    for (const [key,,type] of FIELDS) if (typeof raw?.[key] === 'string' && raw[key].length <= (type === 'textarea' ? 2000 : 500)) clean.fields[key] = raw[key];
    if (!clean.fields.networkName && !clean.fields.chainId) { clean.fields.networkName = 'Robinhood Chain'; clean.fields.chainId = '4663'; }
    plan = clean; $('#launch-save-status').textContent = 'Restored from this browser · not shared';
  } catch { message('The saved draft could not be restored. Import a backup or start filling in a new plan.', true); }
}
function exportPlan(human = false) {
  const errors = assess(plan).invalid;
  if (errors.length) { stage = SECTIONS.find(s => s.fields.some(f => f[0] === errors[0][0])).id; renderStage(); $(`#launch-${errors[0][0]}`).focus(); throw new Error(`Fix ${errors[0][1]} before exporting.`); }
  download(human ? 'capital-launch-review.md' : 'capital-launch-plan.json', human ? reviewText(plan) : JSON.stringify(packet(plan),null,2), human ? 'text/markdown' : 'application/json');
  message(human ? 'Review packet downloaded. It includes operator-reported details and file hashes; no original documents.' : 'Draft backup downloaded. Import this file to resume in another browser.');
}
async function safe(task) { try { await task(); } catch (e) { message(e.message || 'The action could not finish.', true); } }
function initialize() {
  const root = $('#view-launch');
  root.innerHTML = `<div class="launch-heading"><div><p class="eyebrow">CAPITAL / LAUNCH PREPARATION</p><h1>Launch setup</h1><p>Investment funding: Pons creator fees. Prepare the route from fee receipts to documented purchases.</p></div><div class="launch-heading-actions"><button class="button button-dark" id="launch-export">Download draft</button><button class="button button-light" id="launch-import-button">Import draft</button><input type="file" id="launch-import" accept=".json,application/json" hidden></div></div>
    <div class="launch-status-strip"><div><span class="launch-lock">Real-money actions locked</span><span>Testnet rehearsal available</span></div><span id="launch-save-status">Draft stays in this browser · not shared</span></div>
    <div id="launch-feedback" role="status" aria-live="polite"></div>
    <div class="launch-layout"><aside class="launch-sidebar"><div class="launch-progress-heading"><span>Plan details</span><strong id="launch-count">0 / ${FIELDS.length}</strong></div><progress id="launch-progress" max="${FIELDS.length}" value="0" aria-label="Launch plan fields filled"></progress><p>Filling the plan does not activate a launch.</p><nav aria-label="Launch plan steps">${SECTIONS.map((s,i) => `<button type="button" data-launch-stage="${s.id}"><span class="launch-step-number">0${i+1}</span><span>${esc(s.title)}</span><small data-launch-count="${s.id}">0/${s.fields.length}</small></button>`).join('')}<button type="button" data-launch-stage="review"><span class="launch-step-number">05</span><span>Review & evidence</span></button></nav><div class="launch-sidebar-foot"><span id="launch-document-count">0 references</span><a href="#treasury/test">Open testnet rehearsal ↗</a></div></aside>
    <div class="launch-main"><section class="surface launch-editor"><div class="launch-editor-heading"><p class="eyebrow">YOUR LAUNCH PLAN</p><h2 id="launch-stage-title" tabindex="-1"></h2><p id="launch-stage-intro"></p></div><div id="launch-form-area"><form id="launch-form" novalidate><div class="launch-fields" id="launch-fields"></div></form><div id="launch-purchase-tools" hidden><p>Need an offering? Explore a business and choose “Add to launch plan.”</p><div class="chain-button-row"><a class="button button-light" href="#explore">Explore businesses ↗</a><a id="launch-offering-link" class="text-button" target="_blank" rel="noopener noreferrer" hidden>Open original offering ↗</a></div></div></div>
    <div id="launch-review-area" hidden><div id="launch-review-summary"></div><p id="launch-invalid-summary"></p><h3>Supporting documents</h3><p>Choose a file to save its SHA-256 fingerprint. Files stay on your device; they are not uploaded or included in exports. A fingerprint does not verify a document.</p><div class="launch-evidence-controls"><label for="launch-evidence-type">Document purpose<select id="launch-evidence-type">${EVIDENCE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></label><label for="launch-evidence-file">Add a file reference · up to 10 MB<input type="file" id="launch-evidence-file"></label></div><div id="launch-evidence-list"></div><div class="launch-review-export"><button class="button button-dark" id="launch-export-review">Download review packet</button><span>Readable Markdown · no original files</span></div><div class="launch-activation"><h3>Required before activation</h3><ul>${PRODUCTION_BLOCKERS.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>Production remains disabled even when every field is filled. Addresses and approvals in this plan are operator-reported and have not been verified.</p></div></div>
    <div class="launch-editor-footer"><button class="button button-light" id="launch-stage-back">Previous</button><button class="button button-dark" id="launch-stage-next">Continue</button><span>Saved as you type</span></div></section><p class="launch-privacy">Use business details and public addresses only. Keep private keys, passwords, bank details and personal identity documents out of this plan.</p></div>
    <aside class="launch-context"><section class="surface"><p class="eyebrow">NEXT STEP</p><p id="launch-next"></p></section><section class="surface"><h3>First purchase budget</h3><div id="launch-budget"></div><button class="text-button" data-launch-stage="purchase">Edit budget ↗</button></section><section class="launch-boundaries"><h3>Connection status</h3><dl><div><dt>Pons fee collection</dt><dd>Not connected</dd></div><div><dt>Provider orders</dt><dd>Not connected</dd></div><div><dt>Real payouts</dt><dd>Not enabled</dd></div></dl><p>Your draft records the intended setup. It does not connect these services.</p></section></aside></div>
    <dialog id="launch-import-dialog" class="info-dialog" aria-labelledby="launch-import-title"><button class="icon-button dialog-close" data-close aria-label="Close draft import">×</button><p class="eyebrow">IMPORT DRAFT</p><h2 id="launch-import-title">Replace this browser’s plan?</h2><p id="launch-import-preview"></p><p>The imported plan replaces the draft saved here. Download your current draft first if you want to keep it.</p><div class="chain-button-row"><button class="button button-dark" id="launch-import-confirm">Replace draft</button><button class="button button-light" id="launch-import-cancel">Keep current draft</button></div></dialog>`;
  readSaved(); renderStage();
  document.addEventListener('click',event=>{const link=event.target.closest('[data-launch-open]');if(!link||!SECTIONS.some(s=>s.id===link.dataset.launchOpen))return;event.preventDefault();stage=link.dataset.launchOpen;window.MainstreetDirectory.navigate('launch');renderStage(true);});
  $('.launch-status-strip').insertAdjacentHTML('beforebegin', `<section class="launch-route" aria-labelledby="pons-route-title"><div><span class="route-label">SELECTED LAUNCH ROUTE</span><h2 id="pons-route-title">Robinhood Chain + pons</h2><p>Capital’s launch token is planned for Robinhood Chain mainnet, chain 4663. Business investments and holder rights require their own documented structure.</p><div class="launch-route-flow"><span>Pons creator fees</span>→<span>Verified treasury receipts</span>→<span>Documented investments</span></div><p>Holder deposits are not part of this funding plan. Collection, purchases and real payouts are not active.</p><div class="launch-route-links"><a href="https://www.ponsfamily.com/" target="_blank" rel="noopener noreferrer">Open pons ↗</a><a href="${PONS.source}" target="_blank" rel="noopener noreferrer">Pons V2 documentation ↗</a><button class="text-button" id="pons-preset">Use this network in my draft</button></div></div><div><span class="route-label">READ YOUR LAUNCH</span><h2>Check the actual token.</h2><p>Pons V2 documentation currently describes restricted launch access. The check reads access for your connected wallet and, when supplied, your token’s recipient and fees.</p><div class="launch-route-links"><button class="button button-dark" id="pons-check">Check network & token</button><button class="text-button" data-launch-stage="token">Edit token details ↗</button></div><div id="pons-result" class="pons-result" role="status" aria-live="polite"></div></div></section>`);
  clearPonsResult(); $('#pons-check').onclick = checkPons;
  $('#pons-preset').onclick = () => { plan.fields.networkName = 'Robinhood Chain'; plan.fields.chainId = '4663'; save(); stage = 'token'; renderStage(); message('Draft network set to Robinhood Chain mainnet. Test treasury transactions still use testnet.'); };
  const updateOffering = () => { const value = plan.fields.offeringUrl; const valid = value && !fieldError(FIELDS.find(f=>f[0]==='offeringUrl'),value); $('#launch-offering-link').hidden = !valid; if (valid) $('#launch-offering-link').href = value; else $('#launch-offering-link').removeAttribute('href'); };
  root.addEventListener('input', event => {
    const f = FIELDS.find(f => f[0] === event.target.name); if (!f) return;
    plan.fields[f[0]] = event.target.value.trim(); const error = fieldError(f, plan.fields[f[0]]); event.target.setAttribute('aria-invalid',String(!!error)); $(`#launch-error-${f[0]}`).textContent = error;
    if (['tokenAddress','feeWallet'].includes(f[0])) clearPonsResult();
    save(); renderSummary(); updateOffering();
  });
  $('#launch-form').addEventListener('submit', e => e.preventDefault());
  document.addEventListener('click', e => safe(async () => {
    const button = e.target.closest('[data-launch-stage]'); if (button) { stage = button.dataset.launchStage; renderStage(true); updateOffering(); }
    const business = e.target.closest('[data-launch-business]');
    if (business) {
      const c = window.MainstreetDirectory.opportunities.find(c => c.id === business.dataset.launchBusiness); if (!c) return;
      if (plan.fields.business && plan.fields.business !== c.name) { message('A purchase is already in your plan. Edit First purchase to choose a different issuer.',true); $('#holding-dialog').close(); window.MainstreetDirectory.navigate('launch'); stage = 'purchase'; renderStage(true); return; }
      for (const [key,value] of Object.entries({ business: c.name, provider: c.platform, offeringUrl: c.source, security: c.security || '' })) if (!plan.fields[key]) plan.fields[key] = value;
      save(); stage = 'purchase'; renderStage(); updateOffering(); $('#holding-dialog').close(); window.MainstreetDirectory.navigate('launch'); message(`${c.name} is in the purchase draft. Confirm current terms with the provider.`);
    }
    const remove = e.target.closest('[data-remove-evidence]'); if (remove) { plan.evidence.splice(Number(remove.dataset.removeEvidence),1); save(); renderEvidence(); renderSummary(); message('Document reference removed. Your original file is unchanged.'); }
  }));
  $('#launch-stage-next').onclick = () => { const ids = [...SECTIONS.map(s=>s.id),'review']; stage = ids[ids.indexOf(stage)+1] || 'review'; renderStage(true); updateOffering(); };
  $('#launch-stage-back').onclick = () => { const ids = [...SECTIONS.map(s=>s.id),'review']; stage = ids[Math.max(0,ids.indexOf(stage)-1)]; renderStage(true); updateOffering(); };
  $('#launch-export').onclick = () => safe(() => exportPlan()); $('#launch-export-review').onclick = () => safe(() => exportPlan(true));
  $('#launch-import-button').onclick = () => $('#launch-import').click();
  $('#launch-import').onchange = e => safe(async () => {
    const file = e.target.files[0], generation = ++importGeneration; pendingImport = null; if (!file) return;
    e.target.value = ''; if (file.size > 250000) throw new Error('Choose a launch plan JSON file smaller than 250 KB.');
    const candidate = importPlan(JSON.parse(await file.text())); if (generation !== importGeneration) return; pendingImport = candidate;
    $('#launch-import-preview').textContent = `${candidate.fields.entity || 'Entity not provided'} · ${assess(candidate).filled}/${FIELDS.length} fields · ${candidate.evidence.length} document references. All details remain unverified.`;
    $('#launch-import-dialog').showModal();
  });
  $('#launch-import-confirm').onclick = () => { if (!pendingImport) return; evidenceGeneration++; plan = pendingImport; pendingImport = null; clearPonsResult(); save(); stage = 'token'; renderStage(); updateOffering(); $('#launch-import-dialog').close(); message('Draft imported. Real-money actions remain locked.'); };
  $('#launch-import-cancel').onclick = () => { pendingImport = null; $('#launch-import-dialog').close(); };
  $('#launch-evidence-file').onchange = e => safe(async () => {
    const file = e.target.files[0], type = $('#launch-evidence-type').value, generation = evidenceGeneration; if (!file) return; e.target.value = '';
    if (file.size > 10*1024*1024) throw new Error('Choose a file no larger than 10 MB.');
    const hash = sha256(new Uint8Array(await file.arrayBuffer())); if (generation !== evidenceGeneration) return;
    if (plan.evidence.some(x=>x.sha256===hash && x.type===type)) throw new Error('This document already has a reference for that purpose.');
    if (plan.evidence.length >= 30) throw new Error('This draft supports up to 30 document references.');
    plan.evidence.push({type,name:file.name,sha256:hash,size:file.size,addedAt:new Date().toISOString()}); save(); renderEvidence(); renderSummary(); message('File fingerprint saved in this browser. The original file was not uploaded.');
  });
  const wrap = (element, label, className) => {
    const details = document.createElement('details'); details.className = className;
    const summary = document.createElement('summary'); summary.textContent = label;
    element.before(details); details.append(summary, element); return details;
  };
  wrap($('.launch-heading-actions'), 'Draft tools', 'launch-draft-tools');
  const networkDetails = wrap($('.launch-route'), 'Network & token check', 'simple-disclosure launch-network-details');
  const contextDetails = wrap($('.launch-context'), 'Budget & connection details', 'simple-disclosure launch-context-details');
  $('.launch-layout').after(networkDetails, contextDetails);
  updateOffering(); document.documentElement.dataset.launchApp = 'ready';
}
initialize();
