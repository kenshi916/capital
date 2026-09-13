import { BrowserProvider, JsonRpcProvider, FetchRequest, Contract, ContractFactory, formatEther, sha256, toUtf8Bytes, getAddress } from 'ethers';
import { escapeHTML as esc, safeURL, amount, dollars, exactDollars, address, shortAddress, sameContract } from './chain-utils.js';

const $ = s => document.querySelector(s);
const providers = new Map();
const state = { config: null, artifacts: null, chain: 46630, account: null, injected: null, browser: null, rpc: null, treasury: null, address: null, data: null, busy: false, generation: 0, readSequence: 0, epochLimit: 25, selected: null, logs: [], owner: false, evidence: null };
let providerListeners = null;
let connecting = false, connectionSequence = 0, connectedWithSDK = false, sdkModule = null;
const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
const network = () => state.config?.networks[state.chain] || { name: 'Robinhood Chain Testnet', rpcUrls: ['https://rpc.testnet.chain.robinhood.com'], explorer: 'https://explorer.testnet.chain.robinhood.com', faucet: 'https://docs.robinhood.com/chain/' };
const link = (kind, value) => `${network().explorer}/${kind}/${value}`;
const closeDialog = selector => $(selector)?.close();
const formValue = (form, name) => String(new FormData(form).get(name) || '').trim();
function notify(message, error = false) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); toast.classList.toggle('chain-error', error);
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) { let feedback = dialog.querySelector('.chain-feedback'); if (!feedback) { feedback = document.createElement('div'); feedback.className = 'chain-feedback'; feedback.setAttribute('role','status'); (dialog.querySelector('h2') || dialog.firstElementChild).insertAdjacentElement('afterend', feedback); } feedback.textContent = message; feedback.classList.toggle('chain-error', error); }
  clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 6500);
}
function errorMessage(error) {
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Request cancelled in your wallet. No confirmed action was recorded.';
  if (error.code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs test ETH for gas. Use Get test ETH, then try again.';
  if (error.code === -32002) return 'A wallet request is already open. Finish it in your wallet first.';
  return error.reason || error.shortMessage || error.message || 'The request did not complete. Please try again.';
}
function status(message, bad = false) { text('#chain-status', message); $('#chain-status').classList.toggle('is-error', bad); }
function openDialog(id) { const dialog = $(id); if (dialog && !dialog.open) dialog.showModal(); }
function download(name, object) { const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function installDialogs() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="chain-transaction" class="chain-transaction" role="status" aria-live="polite" hidden></div>
    <dialog id="chain-fee-dialog" class="info-dialog" aria-labelledby="chain-fee-title"><button class="icon-button dialog-close" data-close aria-label="Close fee deposit">×</button><p class="eyebrow">TEST THE FEE FLOW</p><h2 id="chain-fee-title">Fund the test treasury.</h2><p class="dialog-intro">Move mUSD from your connected wallet into the treasury. This simulates received trading fees; it is not a Pons fee collection.</p><form id="chain-fee-form" class="chain-form"><label>Test dollars to deposit<input name="amount" inputmode="decimal" value="5000" required></label><div class="chain-inline-note">Wallet → exact mUSD approval → treasury deposit. No real dollars move.</div><button class="button button-dark" type="submit">Deposit test fees</button></form></dialog>
    <dialog id="chain-admin-dialog" class="chain-admin-dialog" aria-labelledby="chain-admin-title"><button class="icon-button dialog-close" data-close aria-label="Close treasury management">×</button><p class="eyebrow">TREASURY ADMINISTRATION</p><h2 id="chain-admin-title">Manage your test treasury.</h2><p class="dialog-intro" id="chain-admin-note">The administrator signs every management transaction.</p><div class="chain-admin-tabs" role="tablist" aria-label="Treasury management"><button role="tab" id="admin-tab-purchases" data-admin-tab="purchases" aria-controls="admin-purchases" aria-selected="true">Purchases</button><button role="tab" id="admin-tab-payments" data-admin-tab="payments" aria-controls="admin-payments" aria-selected="false" tabindex="-1">Payments</button><button role="tab" id="admin-tab-members" data-admin-tab="members" aria-controls="admin-members" aria-selected="false" tabindex="-1">Participants</button><button role="tab" id="admin-tab-payouts" data-admin-tab="payouts" aria-controls="admin-payouts" aria-selected="false" tabindex="-1">Distributions</button></div>
      <section id="admin-purchases" role="tabpanel" aria-labelledby="admin-tab-purchases"><form id="chain-purchase-form" class="chain-form"><fieldset data-owner-form><div class="chain-form-grid"><label>Business<select name="business" id="chain-purchase-business"></select></label><label>Test acquisition cost · mUSD<input name="cost" inputmode="decimal" value="2000" required></label><label>Security description<input name="security" id="chain-purchase-security" maxlength="120" required></label><label>Original offering URL<input name="source" id="chain-purchase-source" type="url" maxlength="500" required></label></div><p class="chain-inline-note">This reserves test dollars. Open the resulting record to attach a test document and settle to your administrator wallet. It does not submit an order to a funding platform.</p><button class="button button-dark" type="submit">Reserve test purchase</button></fieldset></form><div class="chain-separator"></div><h3>Preparing a real investment?</h3><p>Use an approved entity account and the provider’s checkout. Capital does not have access to your investing accounts.</p><button class="text-button" data-real-setup>Open real purchase worksheet ↗</button><div class="chain-integration-note"><strong>Pons fee connection · not active</strong><p>Pons V1 and V2 use different fee mechanics. Use Launch setup to check the exact V2 token, quote asset and creator recipient. Fees must be collected and reconciled before funding an outside investment.</p><a href="https://docs.ponsfamily.com/v2" target="_blank" rel="noopener noreferrer">Read Pons fee mechanics ↗</a></div></section>
      <section id="admin-payments" role="tabpanel" aria-labelledby="admin-tab-payments" hidden><form id="chain-payment-form" class="chain-form"><fieldset data-owner-form><label>Recorded test investment<select name="investment" id="chain-payment-investment" required></select></label><div class="chain-form-grid"><label>Principal repayment · mUSD<input name="principal" inputmode="decimal" value="0" required></label><label>Investment income · mUSD<input name="income" inputmode="decimal" value="1200" required></label></div><label>Unique test payment reference<input name="reference" maxlength="160" required placeholder="TEST-PAYMENT-001"></label><p class="chain-inline-note">Your wallet deposits the full payment. Principal reduces outstanding cost; income becomes eligible for a funded distribution. A reference hash prevents this receipt being recorded twice.</p><button class="button button-dark" type="submit">Deposit and record test payment</button></fieldset></form></section>
      <section id="admin-members" role="tabpanel" aria-labelledby="admin-tab-members" hidden><form id="chain-member-form" class="chain-form"><fieldset data-owner-form><div class="chain-form-grid"><label>Participant wallet<input name="account" id="chain-member-account" required placeholder="0x…"></label><label>Nontransferable test units<input name="units" inputmode="numeric" type="number" min="0" max="1000000000000000000" step="1" value="60" required></label></div><button class="text-button" type="button" id="chain-use-wallet">Use my connected wallet</button><p class="chain-inline-note">For a 60/40 test, assign 60 units to one wallet and 40 to another. Units affect future distributions only. They are not real equity or the Pons launch token.</p><button class="button button-dark" type="submit">Save participant units</button></fieldset></form><div id="chain-members-list" class="chain-members-list"></div></section>
      <section id="admin-payouts" role="tabpanel" aria-labelledby="admin-tab-payouts" hidden><form id="chain-reserve-form" class="chain-form"><fieldset data-owner-form><label>Cash to retain for expenses / taxes · mUSD<input name="reserve" inputmode="decimal" value="200" required></label><button class="button button-light" type="submit">Set cash reserve</button></fieldset></form><div class="chain-separator"></div><form id="chain-distribution-form" class="chain-form"><fieldset data-owner-form><div class="chain-form-grid"><label>Distribution budget · mUSD<input name="budget" id="chain-distribution-budget" inputmode="decimal" value="1000" required></label><label>Distribution description<input name="memo" maxlength="240" value="Test business income distribution" required></label></div><div id="chain-payout-preview" class="chain-inline-note">Assign participants and record income first.</div><p class="chain-inline-note">The contract freezes allocations and transfers their total into the claim contract. Allocated funds cannot be withdrawn by the administrator. Rounding remainder stays in the treasury.</p><button class="button button-dark" type="submit">Fund distribution</button></fieldset></form></section>
    </dialog>
    <dialog id="chain-investment-dialog" class="chain-admin-dialog" aria-labelledby="chain-record-title"><div id="chain-record-content"></div></dialog>
    <dialog id="chain-real-dialog" class="chain-admin-dialog" aria-labelledby="chain-real-title"><button class="icon-button dialog-close" data-close aria-label="Close real purchase worksheet">×</button><p class="eyebrow">REAL-MONEY PREPARATION · NOT AN ORDER</p><h2 id="chain-real-title">Prepare the first real purchase.</h2><p class="dialog-intro">This worksheet prepares a reviewable purchase plan. Real-money trading and token-holder equity rights are not enabled.</p><form id="chain-real-form" class="chain-form"><div class="chain-form-grid"><label>Proposed investing entity<input name="entity" maxlength="160" required placeholder="Legal entity name"></label><label>Business<select name="business" id="chain-real-business"></select></label><label>Proposed investment · USD<input name="cost" inputmode="decimal" required placeholder="Amount before fees"></label><label>Platform fees · USD<input name="fees" inputmode="decimal" value="0" required></label><label>Security / instrument<input name="security" maxlength="160" required placeholder="As stated in the offering documents"></label><label>Provider account status<select name="accountStatus"><option value="not-approved">Approval not confirmed</option><option value="reported-approved">Reported approved by the operator</option></select></label></div><label>Purchase notes<textarea name="notes" maxlength="1500" rows="3" placeholder="Eligibility, custody, offering terms, and intended holder rights. Do not enter account passwords or sensitive personal information."></textarea></label><ol class="info-steps"><li><h3>Approve the structure and investor account</h3><p>Confirm the entity can buy this offering and how any eventual token-holder rights would work. A platform account alone does not authorize distributing equity through a token.</p></li><li><h3>Review the offering and sign through the provider</h3><p>Confirm availability, limits, instrument, fees, and transfer restrictions. Payment and agreements happen on the provider’s website using real funds.</p></li><li><h3>Reconcile the finalized holding</h3><p>Retain the signed agreement, payment confirmation, and finalized holding statement. An order reservation is not a completed investment.</p></li></ol><div class="chain-button-row"><button class="button button-dark" type="submit">Download purchase worksheet</button><a class="button button-light" id="chain-real-source" href="https://republic.com/miso-robotics" target="_blank" rel="noopener noreferrer">Open original offering ↗</a></div><p class="section-note">Worksheet data stays in this page until you download it. Downloading neither submits an order nor confirms a holding.</p></form></dialog>
  `);
  const businesses = window.MainstreetDirectory.opportunities;
  const options = businesses.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  $('#chain-purchase-business').innerHTML = options;
  $('#chain-real-business').innerHTML = options;
  updatePurchaseBusiness(); updateRealBusiness();
}
function updatePurchaseBusiness() {
  const c = window.MainstreetDirectory.opportunities.find(c => c.id === $('#chain-purchase-business').value);
  if (!c) return;
  $('#chain-purchase-security').value = `Test ${c.security || c.instrument}`.slice(0, 120);
  $('#chain-purchase-source').value = c.source;
}
function updateRealBusiness() { const c = window.MainstreetDirectory.opportunities.find(c => c.id === $('#chain-real-business').value); if (c) $('#chain-real-source').href = safeURL(c.source); }

function renderWalletOptions() {
  const box = $('#chain-wallet-options');
  const mobileURL = ['localhost','127.0.0.1'].includes(location.hostname) ? `mainstreet-equity.kenshipops.chatgpt.site/${location.search}${location.hash}` : `${location.host}${location.pathname}${location.search}${location.hash}`;
  $('#chain-mobile-wallet').href = `https://link.metamask.io/dapp/${mobileURL}`;
  const isMetaMask = p => ['io.metamask','io.metamask.mobile','io.metamask.flask'].includes(p.info.rdns) || p.provider.isMetaMask;
  const entries = [...providers], meta = entries.find(([, p]) => isMetaMask(p));
  box.innerHTML = `<button class="chain-wallet-option metamask-option" data-wallet-provider="${esc(meta?.[0] || 'metamask-connect')}" ${connecting ? 'disabled' : ''}><img src="/assets/metamask.svg" alt="" width="40" height="40"><span><strong>MetaMask</strong><small>${connecting ? 'Waiting for wallet approval…' : meta ? 'Connect your browser wallet' : 'Connect with mobile QR or browser extension'}</small></span><span aria-hidden="true">↗</span></button>` + entries.filter(([,p])=>!isMetaMask(p)).map(([id,p])=>`<button class="chain-wallet-option" data-wallet-provider="${esc(id)}" ${connecting ? 'disabled' : ''}><span>${esc(p.info.name)}</span><span>Connect ↗</span></button>`).join('');
  $('#chain-connected-wallet').hidden = !state.account;
  if (state.account) $('#chain-connected-wallet').innerHTML = `<div class="chain-inline-note"><strong>Connected wallet</strong><p class="chain-address">${esc(state.account)}</p><button class="text-button" id="chain-disconnect">Disconnect from this page</button></div>`;
}
function announce(event) {
  const d = event.detail;
  if (!d?.provider?.request || !d.info?.uuid) return;
  providers.set(d.info.uuid, { info: { name: String(d.info.name).slice(0, 60), rdns: String(d.info.rdns || '') }, provider: d.provider });
  renderWalletOptions();
}
function registerProviders() {
  window.addEventListener('eip6963:announceProvider', announce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  if (window.ethereum?.request && ![...providers.values()].some(p => p.provider === window.ethereum)) providers.set('injected', { info: { name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet' }, provider: window.ethereum });
  renderWalletOptions();
}
function detachProviderListeners() {
  if (!providerListeners || !state.injected?.removeListener) return;
  state.injected.removeListener('accountsChanged', providerListeners.accounts);
  state.injected.removeListener('chainChanged', providerListeners.chain);
}
async function connect(id) {
  if (connecting) throw new Error('A connection request is already open. Finish it in MetaMask.');
  let selected = providers.get(id);
  if (!selected && id !== 'metamask-connect') throw new Error('Choose an installed wallet.');
  if (state.busy) throw new Error('Finish the current transaction first.');
  const sequence = ++connectionSequence;
  connecting = true; renderWalletOptions();
  let accounts;
  try {
    if (id === 'metamask-connect') {
      closeDialog('#wallet-dialog');
      notify('Opening MetaMask. Approve in your extension or scan its QR code with MetaMask mobile.');
      sdkModule ||= await import('/metamask-connect.js?v=capital-17');
      const result = await sdkModule.connectMetaMask(document.body.dataset.view === 'treasury' ? state.chain : 4663);
      selected = { provider: result.provider }; accounts = result.accounts;
    } else accounts = await selected.provider.request({ method: 'eth_requestAccounts' });
  } finally { if (sequence === connectionSequence) { connecting = false; renderWalletOptions(); } }
  if (sequence !== connectionSequence) return;
  if (!accounts.length) throw new Error('No wallet account was connected.');
  connectedWithSDK = id === 'metamask-connect';
  detachProviderListeners(); state.injected = selected.provider; state.account = getAddress(accounts[0]); state.browser = new BrowserProvider(state.injected, 'any'); state.generation++;
  providerListeners = {
    accounts: accounts => { state.generation++; state.account = accounts[0] ? getAddress(accounts[0]) : null; state.browser = state.account ? new BrowserProvider(state.injected, 'any') : null; state.data = null; clearBalances(); updateWallet(); refresh().catch(showReadError); },
    chain: () => { state.generation++; state.browser = new BrowserProvider(state.injected, 'any'); state.data = null; clearBalances(); updateWallet(); refresh().catch(showReadError); }
  };
  state.injected.on?.('accountsChanged', providerListeners.accounts); state.injected.on?.('chainChanged', providerListeners.chain);
  updateWallet(); closeDialog('#wallet-dialog'); await refresh();
}
function disconnect() { connectionSequence++; connecting = false; detachProviderListeners(); if (connectedWithSDK) sdkModule?.disconnectMetaMask().catch(()=>{}); connectedWithSDK = false; state.generation++; state.account = null; state.injected = null; state.browser = null; state.owner = false; state.data = null; clearBalances(); updateWallet(); refresh().catch(showReadError); }
function updateWallet() {
  text('#wallet-button span', state.account ? shortAddress(state.account) : 'Connect wallet');
  $('#wallet-empty').hidden = !!state.account; $('#holdings-content').hidden = !state.account;
  text('#chain-holder-wallet', state.account || 'Wallet not connected');
  text('#chain-holder-network', network().name);
  document.dispatchEvent(new CustomEvent('mainstreet:wallet', { detail: { account: state.account } }));
  renderWalletOptions(); updateControls();
}
function updateControls() {
  const ready = !!state.treasury && !!state.data;
  $('#chain-deploy').disabled = state.busy || !state.config || !state.artifacts;
  $('#chain-network').disabled = state.busy;
  $('#chain-share').disabled = !ready;
  $('#chain-mint').disabled = !ready || !state.account || state.busy;
  $('#chain-fee-button').disabled = !ready || !state.account || state.busy;
  $('#chain-admin-button').disabled = !ready || state.busy;
  $('#chain-export-holder').disabled = !ready || !state.account;
  document.querySelectorAll('[data-owner-form]').forEach(el => el.disabled = !state.owner || state.busy || !ready);
  document.querySelectorAll('[data-chain-claim]').forEach(el => el.disabled = state.busy || !state.account || !ready);
  document.querySelectorAll('#chain-fee-form button[type="submit"], #chain-record-form button[type="submit"], #chain-cancel-purchase').forEach(el => el.disabled = state.busy || !ready);
}
async function switchWallet() {
  if (!state.account || !state.injected) { openDialog('#wallet-dialog'); throw new Error('Connect a wallet to continue.'); }
  const chainId = '0x' + Number(state.chain).toString(16);
  if (Number(await state.injected.request({ method: 'eth_chainId' })) !== state.chain) {
    try { await state.injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); }
    catch (e) {
      if (e.code !== 4902 && e.data?.originalError?.code !== 4902) throw e;
      await state.injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId, chainName: network().name, nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: network().rpcUrls, blockExplorerUrls: [network().explorer] }] });
      await state.injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    }
  }
  if (Number(await state.injected.request({ method: 'eth_chainId' })) !== state.chain) throw new Error('Switch your wallet to the selected test network.');
  state.browser = new BrowserProvider(state.injected, 'any');
  return state.browser.getSigner(state.account);
}
async function checkedSigner(owner = false) {
  const signer = await switchWallet();
  if (owner && (!state.treasury || (await state.treasury.owner()).toLowerCase() !== state.account.toLowerCase())) throw new Error('Only this treasury’s administrator can perform that action.');
  return signer;
}
async function readProvider() {
  if (state.injected && Number(await state.injected.request({ method: 'eth_chainId' })) === state.chain) return new BrowserProvider(state.injected, 'any');
  if (state.rpc) return state.rpc;
  for (const url of network().rpcUrls) {
    const request = new FetchRequest(url); request.timeout = 8000;
    const provider = new JsonRpcProvider(request, state.chain, { staticNetwork: true, batchMaxCount: 1 });
    try { if (Number(await provider.send('eth_chainId', [])) !== state.chain) throw new Error('Unexpected network'); await provider.getBlockNumber(); state.rpc = provider; return provider; } catch { provider.destroy(); }
  }
  throw new Error('The test network is not responding. Connect a wallet on this network to use its connection, or try Refresh shortly.');
}
function saveSelection() {
  const url = new URL(location.href); url.searchParams.set('network', state.chain);
  if (state.address) url.searchParams.set('treasury', state.address); else url.searchParams.delete('treasury');
  history.replaceState(null, '', url);
  try { localStorage.setItem('mainstreet:selected-treasury:v1', JSON.stringify({ chain: state.chain, address: state.address })); } catch { /* Optional device preference only. */ }
}
async function attach(value) {
  if (state.busy) throw new Error('Finish the current transaction first.');
  state.generation++; state.address = address(value); state.treasury = null; state.data = null; state.logs = []; state.owner = false; clearBalances();
  $('#chain-address-input').value = state.address;
  await refresh();
  if (state.treasury) saveSelection();
}
function txStatus(message, tx) {
  const box = $('#chain-transaction'); box.hidden = false;
  box.innerHTML = `<span>${esc(message)}</span>${tx ? `<a href="${link('tx', tx)}" target="_blank" rel="noopener noreferrer">View transaction ↗</a>` : ''}`;
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) { let inline = dialog.querySelector('.chain-operation-status'); if (!inline) { inline = document.createElement('div'); inline.className = 'chain-operation-status'; inline.setAttribute('role','status'); (dialog.querySelector('h2') || dialog.firstElementChild).insertAdjacentElement('afterend', inline); } inline.innerHTML = box.innerHTML; }
}
async function transact(label, task, owner = false) {
  if (state.busy) return;
  let entered = false;
  let lastConfirmed = null;
  try {
    state.busy = true; updateControls();
    const initial = { account: state.account, injected: state.injected, chain: state.chain };
    const signer = await checkedSigner(owner);
    const signerAddress = await signer.getAddress();
    if (initial.account !== state.account || initial.injected !== state.injected || initial.chain !== state.chain || signerAddress.toLowerCase() !== state.account?.toLowerCase()) throw new Error('Wallet or network changed. Refresh and review the action again.');
    const session = { generation: state.generation, account: state.account, chain: state.chain, injected: state.injected, treasury: state.address };
    const guard = async () => {
      const accounts = await session.injected.request({ method: 'eth_accounts' });
      const id = Number(await session.injected.request({ method: 'eth_chainId' }));
      if (session.generation !== state.generation || session.injected !== state.injected || session.account !== state.account || session.chain !== state.chain || session.treasury !== state.address || accounts[0]?.toLowerCase() !== signerAddress.toLowerCase() || id !== session.chain || (await signer.getAddress()).toLowerCase() !== signerAddress.toLowerCase()) throw new Error('Wallet or network changed. Refresh and review the action again.');
    };
    if (state.address) { await refresh(); if (!state.data) throw new Error('Refresh the treasury before submitting a transaction.'); }
    await guard();
    entered = true; updateControls();
    const send = async (description, action) => {
      await guard(); txStatus(`${description} — review in your wallet`);
      const tx = await action(); txStatus(`${description} — waiting for confirmation`, tx.hash);
      let receipt;
      try { receipt = await tx.wait(1); }
      catch (e) { if (e.code === 'TRANSACTION_REPLACED' && !e.cancelled && e.receipt?.status === 1) receipt = e.receipt; else throw e; }
      if (receipt.status !== 1) throw new Error('Transaction reverted. No state change was confirmed.');
      lastConfirmed = {description, hash: receipt.hash};
      await guard(); txStatus(`${description} — confirmed`, receipt.hash); return receipt;
    };
    await task(signer, send, guard);
    notify(`${label} confirmed on testnet.`);
    try { await refresh(); } catch { status('Confirmed · refresh balances', true); notify(`${label} confirmed. Balances could not refresh yet; use Refresh.`, true); }
  } catch (error) { const message = errorMessage(error) + (lastConfirmed ? ` Last confirmed step: ${lastConfirmed.description}.` : ''); notify(message, true); if (entered) txStatus(message, lastConfirmed?.hash); }
  finally { state.busy = false; updateControls(); }
}
async function approve(signer, send, value) {
  const token = new Contract(state.data.asset, state.artifacts.MainstreetTestDollar.abi, signer);
  const allowance = await token.allowance(state.account, state.address);
  if (allowance < value) await send(`Approve ${dollars(value)} mUSD for this treasury`, () => token.approve(state.address, value));
}
async function deploy() {
  await transact('Test treasury deployment', async (signer, send) => {
    const factory = new ContractFactory(state.artifacts.MainstreetTreasury.abi, state.artifacts.MainstreetTreasury.bytecode, signer);
    const request = await factory.getDeployTransaction();
    const receipt = await send('Deploy treasury, test dollar, and claim contracts', () => signer.sendTransaction(request));
    if (!receipt.contractAddress) throw new Error('The deployment receipt did not contain a contract address.');
    state.address = getAddress(receipt.contractAddress); state.treasury = null; state.data = null; state.logs = []; saveSelection();
  });
}

function clearBalances() {
  state.owner = false;
  $('.capital-allocation-bar > span').style.width = '0%';
  for (const id of ['total-assets','fee-receipts','capital-allocated','available-cash','activity-cash','chain-cash-available','chain-cash-orders','chain-cash-reserve','chain-income-available','chain-distributed','holder-assets','holder-cost','chain-holder-claimable','chain-holder-received','chain-holder-gas']) text('#' + id, '—');
  text('#chain-updated', 'Balances not loaded'); text('#chain-holder-interest', 'Participation not loaded');
  $('#treasury-table').innerHTML = '<tr><td colspan="4" class="chain-empty-cell">Load a test treasury to read its records.</td></tr>';
  $('#holdings-table').innerHTML = '<div class="chain-empty surface">No confirmed records loaded.</div>';
  $('#chain-claims').innerHTML = '<div class="chain-empty surface">Load a treasury to read funded claims.</div>';
  $('#activity-list').innerHTML = '<li class="chain-empty-cell">No transaction history loaded.</li>';
  text('#chain-investment-count', '—'); updateControls();
}
function showReadError(error) { state.data = null; clearBalances(); status('Connection needs attention', true); text('#chain-updated', errorMessage(error)); notify(errorMessage(error), true); }
async function mapBatches(items, callback, size = 8) {
  const results = [];
  for (let i = 0; i < items.length; i += size) results.push(...await Promise.all(items.slice(i, i + size).map(callback)));
  return results;
}
async function refresh() {
  const sequence = ++state.readSequence, generation = state.generation;
  text('#chain-faucet-link', 'Get test ETH ↗'); $('#chain-faucet-link').href = network().faucet;
  if (!state.address) {
    state.treasury = null; state.data = null; state.owner = false; $('#chain-setup').hidden = false;
    status('No treasury selected'); text('#chain-treasury-address', 'No contract connected'); updateWallet();
    if (state.account && Number(await state.injected.request({ method: 'eth_chainId' })) === state.chain) {
      const p = new BrowserProvider(state.injected, 'any'); const balance = await p.getBalance(state.account);
      if (sequence === state.readSequence) text('#chain-holder-gas', `${Number(formatEther(balance)).toFixed(5)} ETH`);
    }
    return;
  }
  status('Reading testnet…');
  const provider = await readProvider(); const block = await provider.getBlockNumber();
  const treasuryAddress = state.address;
  const code = await provider.getCode(treasuryAddress, block);
  if (!sameContract(code, state.artifacts.MainstreetTreasury)) throw new Error('This address is not the Capital test-treasury contract for this version. No token approvals are enabled.');
  const t = new Contract(treasuryAddress, state.artifacts.MainstreetTreasury.abi, provider), at = { blockTag: block };
  const fields = ['owner','asset','distributions','startedAtBlock','cash','availableCash','totalFees','outstandingCost','reservedForOrders','cashReserve','undistributedIncome','totalIncome','totalDistributed','totalUnits','investmentCount','memberCount'];
  const values = await Promise.all(fields.map(name => t[name](at)));
  const d = Object.fromEntries(fields.map((name, i) => [name, values[i]])); d.block = block; d.claimReceipts = {}; d.historyAvailable = false;
  const [assetCode, distributionCode] = await Promise.all([provider.getCode(d.asset, block), provider.getCode(d.distributions, block)]);
  if (!sameContract(assetCode, state.artifacts.MainstreetTestDollar) || !sameContract(distributionCode, state.artifacts.MainstreetDistributions)) throw new Error('The treasury’s token or distribution contract could not be verified.');
  const dist = new Contract(d.distributions, state.artifacts.MainstreetDistributions.abi, provider);
  if ((await dist.treasury(at)).toLowerCase() !== treasuryAddress.toLowerCase()) throw new Error('Distribution contract belongs to another treasury.');
  if ((await dist.asset(at)).toLowerCase() !== d.asset.toLowerCase()) throw new Error('Distribution contract uses a different asset. No token approvals are enabled.');
  const token = new Contract(d.asset, state.artifacts.MainstreetTestDollar.abi, provider);
  d.investments = await mapBatches(Array.from({ length: Number(d.investmentCount) }, (_, id) => id), async id => ({ id, value: await t.getInvestment(id, at) }));
  d.members = await mapBatches(Array.from({ length: Number(d.memberCount) }, (_, i) => i), async i => { const a = await t.memberAt(i, at); return { address: a, units: await t.eligibleUnits(a, at) }; });
  d.epochCount = Number(await dist.epochCount(at));
  d.epochs = await mapBatches(Array.from({ length: Math.min(state.epochLimit, d.epochCount) }, (_, i) => d.epochCount - 1 - i), async id => {
    const [value, allocation, claimed] = await Promise.all([dist.getEpoch(id, at), state.account ? dist.allocation(id, state.account, at) : 0n, state.account ? dist.claimed(id, state.account, at) : false]);
    return { id, value, allocation, claimed };
  });
  if (state.account) {
    const [balance, units, allocated, claimed, gas, nextFaucet] = await Promise.all([token.balanceOf(state.account, at), t.eligibleUnits(state.account, at), dist.allocatedTotal(state.account, at), dist.claimedTotal(state.account, at), provider.getBalance(state.account, block), token.nextFaucetAt(state.account, at)]);
    Object.assign(d, { balance, units, allocated, claimed, gas, nextFaucet });
  }
  if (sequence !== state.readSequence || generation !== state.generation || treasuryAddress !== state.address) return;
  state.treasury = t; state.data = d; state.owner = !!state.account && d.owner.toLowerCase() === state.account.toLowerCase();
  $('#chain-setup').hidden = true; $('#chain-address-input').value = treasuryAddress;
  text('#chain-treasury-address', `${shortAddress(treasuryAddress)} · ${state.owner ? 'Administrator' : 'Read-only treasury'}`);
  $('#chain-treasury-address').title = treasuryAddress;
  status('Connected to testnet'); text('#chain-updated', `Read at block ${block.toLocaleString()}`);
  renderBalances(); renderInvestments(); renderClaims(); renderAdmin(); updateWallet();
  if (state.selected != null && $('#chain-investment-dialog').open) renderRecord(state.selected);
  try { await loadLogs(provider, t, dist, d, sequence); }
  catch { if (sequence === state.readSequence) { text('#chain-ledger-status', 'Balances are current, but transaction history could not be loaded. Try Refresh.'); $('#activity-list').innerHTML = '<li class="chain-empty-cell">History is temporarily unavailable.</li>'; } }
}
function renderBalances() {
  const d = state.data;
  const values = { 'total-assets': d.cash + d.outstandingCost, 'fee-receipts': d.totalFees, 'capital-allocated': d.outstandingCost, 'available-cash': d.availableCash, 'activity-cash': d.cash, 'chain-cash-available': d.availableCash, 'chain-cash-orders': d.reservedForOrders, 'chain-cash-reserve': d.cashReserve, 'chain-income-available': d.undistributedIncome, 'chain-distributed': d.totalDistributed };
  for (const [id, value] of Object.entries(values)) text('#' + id, dollars(value));
  const total = d.cash + d.outstandingCost;
  $('.capital-allocation-bar > span').style.width = total > 0n ? `${Number(d.outstandingCost * 10000n / total) / 100}%` : '0%';
  if (state.account) {
    text('#holder-assets', dollars(d.balance)); text('#holder-cost', dollars(d.totalUnits > 0n ? d.outstandingCost * d.units / d.totalUnits : 0n));
    text('#chain-holder-claimable', dollars(d.allocated - d.claimed)); text('#chain-holder-received', dollars(d.claimed));
    text('#chain-holder-gas', `${Number(formatEther(d.gas)).toFixed(5)} ETH`);
    const percentage = d.totalUnits > 0n ? (Number(d.units * 10000n / d.totalUnits) / 100).toFixed(2) : '0.00';
    text('#chain-holder-interest', `${d.units.toString()} test units · ${percentage}% current allocation`);
  }
}
const investmentStatus = value => ['Reserved test purchase','Test purchase recorded','Cancelled','Test principal repaid'][Number(value)];
function renderInvestments() {
  const normalizedSource = value => { try { const url = new URL(value); return url.origin.toLowerCase() + url.pathname.replace(/\/+$/, ''); } catch { return ''; } };
  const d = state.data; text('#chain-investment-count', String(d.investments.length));
  const rows = (holder = false) => d.investments.filter(inv => !holder || ((d.units || 0n) > 0n && [1,3].includes(Number(inv.value.status)))).map(({ id, value: inv }) => {
    const cost = holder ? (d.totalUnits > 0n ? (inv.cost - inv.principalRepaid) * (d.units || 0n) / d.totalUnits : 0n) : inv.cost - inv.principalRepaid;
    const source = normalizedSource(inv.source);
    const company = source && window.MainstreetDirectory?.opportunities.find(c => normalizedSource(c.source) === source);
    const logo = company ? `<img src="${esc(company.image)}" alt="" width="38" height="38" style="object-fit:${company.imageFit || 'cover'}">` : `<span>${esc(inv.name.slice(0,1))}</span>`;
    return `<tr><td><button class="table-company" data-chain-investment="${id}"><span class="company-logo">${logo}</span><span><strong>${esc(inv.name)}</strong><small>${esc(inv.security)}</small></span></button></td><td class="table-value">${dollars(cost)}</td><td><span class="chain-record-status">${investmentStatus(inv.status)}</span></td><td><button class="row-button" data-chain-investment="${id}" aria-label="Open ${esc(inv.name)} test record">↗</button></td></tr>`;
  }).join('');
  $('#treasury-table').innerHTML = rows() || '<tr><td colspan="4" class="chain-empty-cell">No investment records yet. The administrator can reserve the first test purchase.</td></tr>';
  $('#holdings-table').innerHTML = d.investments.filter(({value:inv}) => (d.units || 0n) > 0n && [1,3].includes(Number(inv.status))).map(({id,value:inv}) => {
    const source = normalizedSource(inv.source);
    const c = source && window.MainstreetDirectory?.opportunities.find(c => normalizedSource(c.source) === source);
    const cost = d.totalUnits > 0n ? (inv.cost - inv.principalRepaid) * d.units / d.totalUnits : 0n;
    const portrait = c ? `<img class="company-portrait" src="${esc(c.image)}" alt="${esc(c.name)}" width="64" height="64" style="object-fit:${c.imageFit || 'cover'}">` : `<span class="company-portrait portrait-fallback" aria-hidden="true">${esc(inv.name.slice(0,1))}</span>`;
    return `<article class="investment-strip glass-panel"><div class="investment-identity">${portrait}<div><span class="micro-label">${c ? esc(c.platform) + ' · ' : ''}TEST RECORD</span><h3>${esc(inv.name)}</h3><p>${esc(inv.security)}</p></div></div><div class="strip-metric"><span>Attributed test cost</span><strong>${dollars(cost)} <small>mUSD</small></strong><small>${investmentStatus(inv.status)}</small></div><div class="strip-metric equity-state"><span>Company equity rights</span><strong>Not established</strong><small>No real shares issued</small></div><button class="strip-action" data-chain-investment="${id}" aria-label="Open ${esc(inv.name)} test record">View record ↗</button></article>`;
  }).join('') || '<div class="chain-empty surface">No current participation in recorded test purchases. Any earlier funded allocations appear below.</div>';
}
function renderClaims() {
  const d = state.data;
  $('#chain-claims').innerHTML = d.epochs.length ? d.epochs.map(({ id, value, allocation, claimed }) => `<article class="chain-claim-card surface"><div class="chain-claim-top"><span class="eyebrow">DISTRIBUTION ${id + 1}</span><span class="chain-record-status">${claimed ? 'Claimed' : allocation > 0n ? 'Funded · ready to claim' : 'No allocation for this wallet'}</span></div><h3>${esc(value.memo)}</h3><strong class="chain-claim-amount">${dollars(allocation)} <small>mUSD</small></strong><p>${dollars(value.total)} mUSD funded for all recipients · snapshot block ${value.snapshotBlock.toString()}</p><div class="chain-claim-bottom"><a href="${link('address', d.distributions)}" target="_blank" rel="noopener noreferrer">View claim contract ↗</a>${allocation > 0n && !claimed ? `<button class="button button-dark" data-chain-claim="${id}">Claim ${dollars(allocation)} mUSD</button>` : `<span>${claimed ? 'Paid to your wallet' : 'Existing allocations cannot be changed'}</span>`}</div></article>`).join('') : '<div class="chain-empty surface"><h3>No funded distributions yet.</h3><p>After recording a test payment and assigning participants, the administrator can fund the first distribution.</p></div>';
  if (d.epochCount > d.epochs.length) $('#chain-claims').insertAdjacentHTML('beforeend', `<button class="button button-light" id="chain-more-claims">Load earlier distributions (${d.epochs.length} of ${d.epochCount} shown)</button>`);
  [...$('#chain-claims').querySelectorAll('.chain-claim-card')].forEach((card,index) => {
    const epoch = d.epochs[index], receipt = d.claimReceipts[epoch.id];
    const date = new Date(Number(epoch.value.createdAt)*1000).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
    card.insertAdjacentHTML('beforeend', `<p class="section-note">Funded ${esc(date)} UTC${receipt ? ` · <a href="${link('tx',receipt.hash)}" target="_blank" rel="noopener noreferrer">Your claim receipt ↗</a>` : epoch.claimed ? ' · Payment confirmed by contract; receipt not in the loaded history' : ''}</p>`);
  });
}
function exportHolder() {
  requireTreasury(); if (!state.account) throw new Error('Connect your wallet first.'); const d = state.data;
  download('capital-test-holder-statement.json', { type:'TESTNET HOLDER STATEMENT — NO REAL SHARES OR MONEY', createdAt:new Date().toISOString(), chainId:state.chain, block:d.block, treasury:state.address, wallet:state.account, currency:'mUSD — NO MONETARY VALUE', currentUnits:d.units.toString(), totalCurrentUnits:d.totalUnits.toString(), lifetimeAllocated:exactDollars(d.allocated), lifetimeClaimed:exactDollars(d.claimed), currentlyClaimable:exactDollars(d.allocated-d.claimed),
    investments:d.investments.filter(x=>[1,3].includes(Number(x.value.status))).map(({id,value:v})=>({id,business:v.name,instrument:v.security,source:safeURL(v.source),treasuryCostRemaining:exactDollars(v.cost-v.principalRepaid),attributedCost:d.totalUnits ? exactDollars((v.cost-v.principalRepaid)*d.units/d.totalUnits) : '0',documentSHA256:v.documentHash,paymentReferenceHash:v.receiptHash})),
    distributions:d.epochs.map(e=>({id:e.id,memo:e.value.memo,snapshotBlock:e.value.snapshotBlock.toString(),fundedAt:new Date(Number(e.value.createdAt)*1000).toISOString(),allocation:exactDollars(e.allocation),claimed:e.claimed,receipt:d.claimReceipts[e.id]||null})),
    coverage:{distributionsLoaded:d.epochs.length,totalDistributions:d.epochCount,receiptHistoryAvailable:d.historyAvailable,receiptLookbackBlocks:10000},notice:'Current units determine attributed cost, not past distribution allocations. Test investment records are administrator attestations, not actual company holdings. Receipt coverage is limited; lifetime totals are read from the contract.' });
}
function renderAdmin() {
  const d = state.data;
  text('#chain-admin-note', state.owner ? 'You are the administrator. Management actions require your wallet signature.' : `Read-only. The administrator is ${d.owner}. Connect that wallet to manage this treasury.`);
  const recorded = d.investments.filter(x => [1,3].includes(Number(x.value.status)));
  const oldSelection = $('#chain-payment-investment').value;
  $('#chain-payment-investment').innerHTML = recorded.length ? recorded.map(x => `<option value="${x.id}">${esc(x.value.name)} · ${dollars(x.value.cost - x.value.principalRepaid)} mUSD cost remaining</option>`).join('') : '<option value="">Record a test purchase first</option>';
  if (recorded.some(x => String(x.id) === oldSelection)) $('#chain-payment-investment').value = oldSelection;
  $('#chain-members-list').innerHTML = d.members.length ? '<h3>Current participants</h3>' + d.members.map(m => `<div><a href="${link('address', m.address)}" target="_blank" rel="noopener noreferrer">${esc(shortAddress(m.address))}</a><strong>${m.units} units</strong><span>${d.totalUnits > 0n ? (Number(m.units * 10000n / d.totalUnits) / 100).toFixed(2) : '0.00'}%</span></div>`).join('') : '<p class="chain-inline-note">No participants assigned yet.</p>';
  previewPayout(); updateControls();
}
function previewPayout() {
  const d = state.data; if (!d) return;
  try {
    const budget = amount($('#chain-distribution-budget').value);
    if (d.totalUnits === 0n) { text('#chain-payout-preview', 'Assign participant units before funding a distribution.'); return; }
    const allocations = d.members.map(m => ({ ...m, payout: budget * m.units / d.totalUnits }));
    const actual = allocations.reduce((sum, m) => sum + m.payout, 0n);
    $('#chain-payout-preview').innerHTML = `<strong>Allocation preview · ${dollars(actual)} mUSD total</strong>${allocations.filter(m => m.units > 0n).map(m => `<div class="chain-preview-row"><span>${esc(shortAddress(m.address))}</span><strong>${dollars(m.payout)} mUSD</strong></div>`).join('')}<p>${dollars(budget - actual)} mUSD rounding remainder stays in the treasury. ${budget > d.undistributedIncome || budget > d.availableCash ? '<strong>This budget exceeds available income or unreserved cash.</strong>' : 'Final allocations use units at the transaction’s block.'}</p>`;
  } catch { text('#chain-payout-preview', 'Enter a valid distribution budget.'); }
}
function renderRecord(id) {
  const found = state.data?.investments.find(x => x.id === Number(id)); if (!found) throw new Error('Investment record not found. Refresh the treasury.');
  state.selected = Number(id); const inv = found.value, reserved = Number(inv.status) === 0;
  const url = safeURL(inv.source), documentURI = safeURL(inv.documentURI);
  $('#chain-record-content').innerHTML = `<button class="icon-button dialog-close" data-close aria-label="Close investment record">×</button><p class="eyebrow">TESTNET INVESTMENT RECORD ${id + 1}</p><h2 id="chain-record-title">${esc(inv.name)}</h2><p class="dialog-intro">${esc(inv.security)} · ${investmentStatus(inv.status)}</p><div class="chain-form-grid chain-record-metrics"><div><span>Original test cost</span><strong>${dollars(inv.cost)} mUSD</strong></div><div><span>Principal repaid</span><strong>${dollars(inv.principalRepaid)} mUSD</strong></div><div><span>Test income received</span><strong>${dollars(inv.incomeReceived)} mUSD</strong></div></div><p class="chain-inline-note">This record does not establish ownership of ${esc(inv.name)}. It is an administrator’s testnet attestation, with test-dollar settlement.</p>${url ? `<a class="text-button" href="${url}" target="_blank" rel="noopener noreferrer">Original business source ↗</a>` : ''}
    ${reserved && state.owner ? `<div class="chain-separator"></div><form id="chain-record-form" class="chain-form"><label>Agreement or test document<input type="file" id="chain-evidence-file" accept=".pdf,.json,.txt,.docx,.png,.jpg,.jpeg"></label><button class="text-button" id="chain-test-document" type="button">Create and download a labeled test document</button><div id="chain-evidence-status" class="chain-inline-note">Choose a document. Only its SHA-256 hash is recorded; the file stays on your device.</div><label>Unique test purchase reference<input name="reference" maxlength="160" value="TEST-PURCHASE-${id + 1}" required></label><label>Public document URL · optional<input name="documentURI" type="url" maxlength="500" placeholder="https://…"></label><p class="chain-inline-note">Recording sends ${dollars(inv.cost)} mUSD from the treasury to its original administrator settlement wallet. No provider order is submitted and no real shares are bought.</p><div class="chain-button-row"><button class="button button-dark" type="submit">Record and settle test purchase</button><button class="button button-light" type="button" id="chain-cancel-purchase">Cancel reservation</button></div></form>` : `<dl class="chain-record-evidence"><div><dt>Document SHA-256</dt><dd>${inv.documentHash === '0x' + '0'.repeat(64) ? 'Not recorded' : esc(inv.documentHash)}</dd></div><div><dt>Receipt reference hash</dt><dd>${inv.receiptHash === '0x' + '0'.repeat(64) ? 'Not recorded' : esc(inv.receiptHash)}</dd></div></dl>${documentURI ? `<a class="text-button" href="${documentURI}" target="_blank" rel="noopener noreferrer">Public document supplied by administrator ↗</a>` : ''}<p class="section-note">A document hash proves that a particular file was referenced. It does not prove that the issuer accepted a purchase or that the file is genuine.</p>`}`;
  state.evidence = null; updateControls();
}
async function loadLogs(provider, treasury, dist, d, sequence) {
  const from = Math.max(Number(d.startedAtBlock), d.block - 9999);
  const tasks = [];
  for (let start = from; start <= d.block; start += 2500) {
    const to = Math.min(start + 2499, d.block);
    tasks.push([start, to, treasury], [start, to, dist]);
  }
  const batches = await mapBatches(tasks, async ([fromBlock, toBlock, c]) => {
    const logs = await provider.getLogs({ address: c.target, fromBlock, toBlock });
    return logs.map(log => { try { return { ...log, parsed: c.interface.parseLog(log) }; } catch { return null; } }).filter(Boolean);
  }, 4);
  if (sequence !== state.readSequence) return;
  d.historyAvailable = true;
  d.claimReceipts = Object.fromEntries(batches.flat().filter(log=>log.parsed?.name === 'Claimed' && state.account && log.parsed.args.account.toLowerCase() === state.account.toLowerCase()).map(log=>[Number(log.parsed.args.epoch),{hash:log.transactionHash,block:log.blockNumber}]));
  renderClaims();
  const rows = batches.flat().sort((a,b) => b.blockNumber - a.blockNumber || b.index - a.index).map(log => {
    const p = log.parsed; if (!p) return null;
    let label, movement = '—';
    if (p.name === 'FeeReceived') { label = 'Test fees deposited'; movement = '+' + dollars(p.args.amount); }
    if (p.name === 'InvestmentPrepared') label = 'Test purchase reserved';
    if (p.name === 'InvestmentRecorded') { label = 'Test purchase settled'; movement = '−' + dollars(p.args.cost); }
    if (p.name === 'InvestmentCancelled') label = 'Purchase reservation cancelled';
    if (p.name === 'InvestmentPayment') { label = `Test payment · ${dollars(p.args.principal)} principal / ${dollars(p.args.income)} income`; movement = '+' + dollars(p.args.principal + p.args.income); }
    if (p.name === 'DistributionFunded') { label = 'Distribution funded'; movement = '−' + dollars(p.args.amount); }
    if (p.name === 'Claimed') { label = `Claim paid to ${shortAddress(p.args.account)}`; movement = dollars(p.args.amount) + ' paid'; }
    if (p.name === 'UnitsUpdated') label = `Test units updated · ${shortAddress(p.args.account)}`;
    if (p.name === 'CashReserveUpdated') label = `Cash reserve set · ${dollars(p.args.amount)}`;
    return label ? { block: log.blockNumber, hash: log.transactionHash, label, movement } : null;
  }).filter(Boolean);
  state.logs = rows;
  text('#chain-ledger-status', from > Number(d.startedAtBlock) ? 'Showing events from the most recent 10,000 blocks. Investment and payout totals include all recorded history.' : 'Showing events since this treasury was deployed.');
  $('#ledger-table').innerHTML = rows.length ? rows.map(row => `<tr><td>${row.block.toLocaleString()}</td><td>${esc(row.label)}</td><td>${esc(row.movement)}</td><td><a href="${link('tx', row.hash)}" target="_blank" rel="noopener noreferrer">${shortAddress(row.hash)} ↗</a></td></tr>`).join('') : '<tr><td colspan="4" class="chain-empty-cell">No treasury transactions in this block range.</td></tr>';
  $('#activity-list').innerHTML = rows.slice(0,4).map(row => `<li><span class="activity-symbol" aria-hidden="true">↗</span><div><strong><a href="${link('tx', row.hash)}" target="_blank" rel="noopener noreferrer">${esc(row.label)}</a></strong><span>Block ${row.block.toLocaleString()}</span></div><strong>${esc(row.movement)}</strong></li>`).join('') || '<li class="chain-empty-cell">No test treasury activity yet.</li>';
}

function adminTab(name) {
  for (const tab of document.querySelectorAll('[data-admin-tab]')) {
    const selected = tab.dataset.adminTab === name;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    $('#admin-' + tab.dataset.adminTab).hidden = !selected;
  }
}
function requireTreasury() { if (!state.treasury || !state.data) throw new Error('Open or deploy a test treasury first.'); }
function requireOwner() { requireTreasury(); if (!state.owner) throw new Error('Connect the treasury administrator’s wallet to manage this treasury.'); }
function safely(task) { return Promise.resolve().then(task).catch(error => notify(errorMessage(error), true)); }
function bindForm(id, handler) { $(id).addEventListener('submit', event => { event.preventDefault(); safely(() => handler(event.target)); }); }
function bindWalletActions() {
  $('#wallet-button').addEventListener('click', () => { registerProviders(); openDialog('#wallet-dialog'); });
  document.addEventListener('click', event => safely(async () => {
    const target = event.target;
    if (target.closest('[data-chain-connect]')) { registerProviders(); openDialog('#wallet-dialog'); }
    const selected = target.closest('[data-wallet-provider]'); if (selected) await connect(selected.dataset.walletProvider);
    if (target.closest('#chain-disconnect')) { disconnect(); closeDialog('#wallet-dialog'); }
  }));
}
function bindActions() {
  $('#chain-export-holder').addEventListener('click',()=>safely(exportHolder));
  $('#chain-deploy').addEventListener('click', () => safely(deploy));
  $('#chain-refresh').addEventListener('click', () => refresh().catch(showReadError));
  $('#chain-refresh-claims').addEventListener('click', () => refresh().catch(showReadError));
  $('#chain-share').addEventListener('click', () => safely(async () => { requireTreasury(); saveSelection(); await navigator.clipboard.writeText(location.href); notify('Treasury link copied. Other wallets can open the same onchain records.'); }));
  $('#chain-network').addEventListener('change', () => safely(async () => {
    if (state.busy) return;
    state.generation++; state.readSequence++; state.chain = Number($('#chain-network').value); state.address = null; state.treasury = null; state.data = null; state.logs = []; state.rpc?.destroy(); state.rpc = null; state.epochLimit = 25; clearBalances(); saveSelection(); closeDialog('#chain-admin-dialog'); closeDialog('#chain-investment-dialog'); await refresh();
  }));
  bindForm('#chain-attach-form', form => attach($('#chain-address-input').value).catch(error => { showReadError(error); $('#chain-setup').hidden = false; }));
  $('#chain-mint').addEventListener('click', () => safely(async () => {
    requireTreasury();
    await transact('Test dollars received', async (signer, send) => {
      const token = new Contract(state.data.asset, state.artifacts.MainstreetTestDollar.abi, signer);
      await send('Receive 10,000 mUSD from the test faucet', () => token.faucet());
    });
  }));
  $('#chain-fee-button').addEventListener('click', () => { if (state.data) openDialog('#chain-fee-dialog'); });
  $('#chain-admin-button').addEventListener('click', () => { if (state.data) { renderAdmin(); openDialog('#chain-admin-dialog'); } });
  $('#chain-purchase-business').addEventListener('change', updatePurchaseBusiness);
  $('#chain-real-business').addEventListener('change', updateRealBusiness);
  $('#chain-distribution-budget').addEventListener('input', previewPayout);
  $('#chain-use-wallet').addEventListener('click', () => { $('#chain-member-account').value = state.account || ''; });
  bindForm('#chain-fee-form', async form => {
    requireTreasury(); const value = amount(formValue(form, 'amount'));
    await transact('Fee deposit', async (signer, send) => {
      if (state.data.balance < value) throw new Error('Not enough mUSD in your wallet. Use Get test dollars first.');
      await approve(signer, send, value);
      await send(`Deposit ${dollars(value)} mUSD in test fees`, () => state.treasury.connect(signer).depositFees(value)); closeDialog('#chain-fee-dialog');
    });
  });
  bindForm('#chain-purchase-form', async form => {
    requireOwner();
    const business = window.MainstreetDirectory.opportunities.find(c => c.id === formValue(form, 'business'));
    if (!business) throw new Error('Choose a business.');
    const cost = amount(formValue(form, 'cost')), source = safeURL(formValue(form, 'source')), security = formValue(form, 'security');
    if (!source || !security) throw new Error('Add a security description and a valid HTTPS source URL.');
    await transact('Purchase reservation', async (signer, send) => {
      const receipt = await send(`Reserve ${dollars(cost)} mUSD for ${business.name}`, () => state.treasury.connect(signer).prepareInvestment(business.name, security, source, cost));
      const parsed = receipt.logs.map(l => { try { return state.treasury.interface.parseLog(l); } catch { return null; } }).find(l => l?.name === 'InvestmentPrepared');
      await refresh(); closeDialog('#chain-admin-dialog');
      if (parsed) { renderRecord(Number(parsed.args.investment)); openDialog('#chain-investment-dialog'); }
    }, true);
  });
  bindForm('#chain-payment-form', async form => {
    requireOwner(); const selection = formValue(form, 'investment');
    if (selection === '' || !state.data.investments.some(x => x.id === Number(selection) && [1,3].includes(Number(x.value.status)))) throw new Error('Choose a recorded test investment.');
    const principal = amount(formValue(form, 'principal'), true), income = amount(formValue(form, 'income'), true), reference = formValue(form, 'reference');
    if (principal + income === 0n || !reference) throw new Error('Enter a payment amount and unique reference.');
    await transact('Investment payment', async (signer, send) => {
      await approve(signer, send, principal + income);
      await send(`Deposit ${dollars(principal + income)} mUSD and record the test payment`, () => state.treasury.connect(signer).recordPayment(Number(selection), principal, income, sha256(toUtf8Bytes(reference))));
    }, true);
  });
  bindForm('#chain-member-form', async form => {
    requireOwner(); const account = address(formValue(form, 'account')), unitsText = formValue(form, 'units');
    if (!/^\d+$/.test(unitsText) || BigInt(unitsText) > 10n ** 18n) throw new Error('Use a whole number of units between 0 and 1,000,000,000,000,000,000.');
    await transact('Participant allocation', async (signer, send) => { await send(`Assign ${unitsText} test units to ${shortAddress(account)}`, () => state.treasury.connect(signer).setUnits(account, BigInt(unitsText))); }, true);
  });
  bindForm('#chain-reserve-form', async form => {
    requireOwner(); const reserve = amount(formValue(form, 'reserve'), true);
    await transact('Cash reserve', async (signer, send) => { await send(`Keep ${dollars(reserve)} mUSD reserved`, () => state.treasury.connect(signer).setCashReserve(reserve)); }, true);
  });
  bindForm('#chain-distribution-form', async form => {
    requireOwner(); const budget = amount(formValue(form, 'budget')), memo = formValue(form, 'memo');
    if (!memo) throw new Error('Describe this distribution.');
    await transact('Distribution funding', async (signer, send) => { await send(`Freeze allocations and fund up to ${dollars(budget)} mUSD`, () => state.treasury.connect(signer).fundDistribution(budget, memo)); }, true);
  });
  bindForm('#chain-real-form', form => {
    const c = window.MainstreetDirectory.opportunities.find(c => c.id === formValue(form, 'business'));
    if (!c) throw new Error('Choose a business.');
    const cost = amount(formValue(form, 'cost')), fees = amount(formValue(form, 'fees'), true);
    download(`capital-purchase-worksheet-${c.id}.json`, { type: 'purchase_preparation_only', status: 'DRAFT — NOT SUBMITTED, NOT PURCHASED', createdAt: new Date().toISOString(), investingEntity: formValue(form, 'entity'), business: c.name, source: c.source, proposedSecurity: formValue(form, 'security'), currency: 'USD', proposedInvestment: exactDollars(cost), platformFees: exactDollars(fees), proposedTotal: exactDollars(cost + fees), accountStatus: formValue(form, 'accountStatus'), notes: formValue(form, 'notes'), verification: 'Operator inputs are not independently verified. This worksheet does not transfer funds or confirm ownership.', requiredBeforeRecordingRealHolding: ['Approved investment structure and provider investor account','Current offering terms and eligibility reviewed','Signed subscription agreement','Payment confirmation','Finalized holding statement','Defined holder rights and appropriate production custody / distribution setup'] });
    notify('Purchase worksheet downloaded. No order was submitted.');
  });
  document.addEventListener('click', event => safely(async () => {
    const target = event.target;
    if (target.closest('[data-real-setup]')) { closeDialog('#chain-admin-dialog'); openDialog('#chain-real-dialog'); }
    const tab = target.closest('[data-admin-tab]'); if (tab) adminTab(tab.dataset.adminTab);
    const record = target.closest('[data-chain-investment]'); if (record) { requireTreasury(); renderRecord(Number(record.dataset.chainInvestment)); openDialog('#chain-investment-dialog'); }
    const claim = target.closest('[data-chain-claim]'); if (claim) {
      requireTreasury(); const epoch = Number(claim.dataset.chainClaim);
      await transact('Distribution claim', async (signer, send) => { const contract = new Contract(state.data.distributions, state.artifacts.MainstreetDistributions.abi, signer); await send(`Claim distribution ${epoch + 1} to your wallet`, () => contract.claim(epoch)); });
    }
    if (target.closest('#chain-more-claims')) { state.epochLimit += 25; await refresh(); }
    if (target.closest('#chain-test-document')) {
      const id = state.selected, inv = state.data.investments.find(x => x.id === id).value;
      const object = { type: 'TEST DOCUMENT — NOT A REAL SUBSCRIPTION AGREEMENT', treasury: state.address, chainId: state.chain, investmentId: id, business: inv.name, simulatedCost: exactDollars(inv.cost), currency: 'mUSD — NO MONETARY VALUE', createdAt: new Date().toISOString(), rights: 'No company shares, legal ownership, or real cash rights are created.' };
      const contents = JSON.stringify(object, null, 2); state.evidence = sha256(toUtf8Bytes(contents));
      download(`capital-test-document-${id + 1}.json`, object); text('#chain-evidence-status', `Labeled test document prepared. SHA-256: ${state.evidence}`);
    }
    if (target.closest('#chain-cancel-purchase')) { requireOwner(); const id = state.selected; await transact('Purchase cancellation', async (signer, send) => { await send('Release the reserved test dollars', () => state.treasury.connect(signer).cancelInvestment(id)); }, true); }
    const prepare = target.closest('[data-chain-prepare]'); if (prepare) {
      requireTreasury(); closeDialog('#holding-dialog'); $('#chain-purchase-business').value = prepare.dataset.chainPrepare; updatePurchaseBusiness(); adminTab('purchases'); renderAdmin(); openDialog('#chain-admin-dialog');
    }
    if (target instanceof HTMLDialogElement && target.open) { const rect = target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) target.close(); }
  }));
  document.addEventListener('change', event => safely(async () => {
    if (event.target.id !== 'chain-evidence-file') return;
    state.evidence = null; const file = event.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a document smaller than 10 MB.');
    const id = state.selected, generation = state.generation;
    const digest = sha256(new Uint8Array(await file.arrayBuffer()));
    if (id !== state.selected || generation !== state.generation) return;
    state.evidence = digest; text('#chain-evidence-status', `${file.name} · SHA-256: ${digest}. Only this hash will be recorded.`);
  }));
  document.addEventListener('submit', event => {
    if (event.target.id !== 'chain-record-form') return;
    event.preventDefault(); safely(async () => {
      requireOwner(); const form = event.target, id = state.selected, hash = state.evidence, reference = formValue(form, 'reference'), urlText = formValue(form, 'documentURI'), url = urlText ? safeURL(urlText) : '';
      if (!hash) throw new Error('Choose a document or create a labeled test document first.');
      if (!reference || (urlText && !url)) throw new Error('Add a receipt reference and, if supplied, a valid HTTPS document URL.');
      await transact('Test purchase recording', async (signer, send) => { await send('Record evidence and settle this test purchase', () => state.treasury.connect(signer).recordInvestment(id, hash, sha256(toUtf8Bytes(reference)), url)); }, true);
    });
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-admin-tab]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const tabs = [...document.querySelectorAll('[data-admin-tab]')], i = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    adminTab(tabs[next].dataset.adminTab); tabs[next].focus();
  });
}
async function initialize() {
  const [configResponse, artifactResponse] = await Promise.all([fetch('/deployment.json?v=equity-11'), fetch('/contracts/artifacts.json?v=equity-11')]);
  if (!configResponse.ok || !artifactResponse.ok) throw new Error('The testnet application could not load its configuration. Refresh this page.');
  state.config = await configResponse.json(); state.artifacts = await artifactResponse.json();
  const url = new URL(location.href); let saved = null;
  try { saved = JSON.parse(localStorage.getItem('mainstreet:selected-treasury:v1')); } catch { /* Optional device preference. */ }
  const selectedNetwork = Number(url.searchParams.get('network') || saved?.chain || state.config.defaultChainId);
  state.chain = [46630, 11155111].includes(selectedNetwork) ? selectedNetwork : state.config.defaultChainId;
  const selectedAddress = url.searchParams.get('treasury') || (!url.searchParams.has('network') && saved?.chain === state.chain ? saved?.address : null) || (state.chain === state.config.defaultChainId ? state.config.treasury : null);
  if (selectedAddress) { try { state.address = address(selectedAddress); } catch { notify('The treasury address in this link is invalid. Choose a valid contract.', true); } }
  $('#chain-network').value = String(state.chain); installDialogs(); bindActions(); registerProviders(); updateWallet();
  document.documentElement.dataset.chainApp = 'ready';
  await refresh();
}
bindWalletActions(); registerProviders(); updateWallet();
initialize().catch(error => { status('Setup needs attention', true); text('#chain-updated', errorMessage(error)); notify(errorMessage(error), true); $('#chain-deploy').disabled = true; });
window.CapitalWallet=Object.freeze({
 getAccount:()=>state.account,
 async signBallot(typed){
  if(!state.injected||!state.account)throw new Error('Connect your wallet first.');
  if(typed.domain?.name!=='Capital community voting'||![4663,46630,11155111].includes(Number(typed.domain.chainId))||typed.message?.wallet?.toLowerCase()!==state.account.toLowerCase())throw new Error('This ballot does not match the connected wallet.');
  const account=state.account,provider=state.injected,chainId='0x'+Number(typed.domain.chainId).toString(16);
  if(Number(await provider.request({method:'eth_chainId'}))!==Number(typed.domain.chainId)){
   try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
   catch(error){
    if(error.code!==4902&&error.data?.originalError?.code!==4902)throw error;
    const networks={4663:['Robinhood Chain','https://rpc.mainnet.chain.robinhood.com','https://robinhoodchain.blockscout.com'],46630:['Robinhood Chain Testnet','https://rpc.testnet.chain.robinhood.com','https://explorer.testnet.chain.robinhood.com'],11155111:['Ethereum Sepolia','https://ethereum-sepolia-rpc.publicnode.com','https://sepolia.etherscan.io']},n=networks[typed.domain.chainId];
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:n[0],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[n[1]],blockExplorerUrls:[n[2]]}]});
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
   }
  }
  const accounts=await provider.request({method:'eth_accounts'});if(!accounts.some(a=>a.toLowerCase()===account.toLowerCase())||state.account!==account)throw new Error('The connected wallet changed. Start the vote again.');
  return new BrowserProvider(provider,'any').getSigner(account).then(signer=>signer.signTypedData(typed.domain,typed.types,typed.message));
 }
});
