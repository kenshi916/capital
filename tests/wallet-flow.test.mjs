import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import ganache from 'ganache';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import { amount, safeURL, sameContract } from '../src/chain-utils.js';

const read = name => fs.readFileSync(name, 'utf8');
const artifacts = JSON.parse(read('dist/contracts/artifacts.json'));
const waitFor = async (condition, message, timeout = 25000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await condition()) return; await new Promise(r => setTimeout(r, 30)); }
  throw new Error(message);
};

test('amounts and document URLs reject malformed or executable input', () => {
  assert.equal(amount('12.000001'), 12000001n);
  for (const input of ['1e6','-2','1.0000001','NaN','0']) assert.throws(() => amount(input));
  assert.equal(safeURL('javascript:alert(1)'), '');
  assert.equal(safeURL('https://user:password@example.com'), '');
  assert.equal(safeURL('https://republic.com/miso-robotics'), 'https://republic.com/miso-robotics');
});

test('published UI completes wallet deployment, fee deposit, purchase, payment, allocation and two claims', async () => {
  const engine = ganache.provider({ chain: { chainId: 46630 }, wallet: { totalAccounts: 2 }, logging: { quiet: true } });
  await engine.request({method:'eth_chainId',params:[]});
  const dom = new JSDOM(read('dist/index.html'), { url: 'https://mainstreet-equity.kenshipops.chatgpt.site/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, errors = [];
  const accounts = await engine.request({method:'eth_accounts',params:[]});
  let activeAccount = accounts[0];
  const listeners = new Map();
  try {
    w.addEventListener('error', e => errors.push(e.error || e.message));
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.Response = Response; w.Request = Request;
    w.scrollTo = () => {};
    w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
    w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    w.URL.createObjectURL = () => 'blob:test-document'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () {};
    w.fetch = async url => {
      if (String(url).startsWith('/deployment.json')) return new Response(read('dist/deployment.json'));
      if (String(url).startsWith('/contracts/artifacts.json')) return new Response(read('dist/contracts/artifacts.json'));
      throw new Error('Unexpected network access in UI test: ' + url);
    };
    w.ethereum = {
      isMetaMask: true,
      request: args => ['eth_requestAccounts','eth_accounts'].includes(args.method) ? Promise.resolve([activeAccount]) : engine.request(args),
      on(name, listener) { listeners.set(name, listener); }, removeListener(name) { listeners.delete(name); }
    };
    w.eval(read('dist/opportunities.js') + '\n' + read('dist/app.js')); w.eval(read('dist/chain.js'));
    await waitFor(() => w.document.documentElement.dataset.chainApp === 'ready', 'Application did not initialize');
    assert.equal(w.document.querySelectorAll('.opportunity-card').length, 10);
    assert.equal(w.document.querySelector('#total-assets').textContent, '—', 'A disconnected page must not show fictional balances');
    w.document.querySelector('#wallet-button').click();
    w.document.querySelector('[data-wallet-provider="injected"]').click();
    await waitFor(() => w.document.querySelector('#wallet-button span').textContent.startsWith('0x'), 'Wallet did not connect');
    w.document.querySelector('#chain-deploy').click();
    await waitFor(() => w.document.querySelector('#chain-treasury-address').textContent.includes('Administrator'), 'Test suite deployment did not complete: ' + w.document.querySelector('#toast').textContent);
    await waitFor(() => !w.document.querySelector('#chain-mint').disabled, 'Test faucet remained disabled');
    const treasuryAddress = new URL(w.location.href).searchParams.get('treasury');
    assert.match(treasuryAddress, /^0x[0-9a-fA-F]{40}$/);
    const provider = new BrowserProvider(engine), treasury = new Contract(treasuryAddress, artifacts.MainstreetTreasury.abi, provider);
    assert(sameContract(await provider.getCode(treasuryAddress), artifacts.MainstreetTreasury), 'Runtime bytecode verification failed');
    const actualCode = await provider.getCode(treasuryAddress);
    assert(!sameContract(actualCode.slice(0,-2)+'ff', artifacts.MainstreetTreasury), 'Modified runtime must not be accepted');
    w.document.querySelector('#chain-mint').click();
    await waitFor(() => w.document.querySelector('#holder-assets').textContent === '10,000.00', 'Faucet did not update the wallet balance');
    await waitFor(() => !w.document.querySelector('#chain-fee-button').disabled, 'Deposit remained disabled');
    w.document.querySelector('#chain-fee-button').click();
    w.document.querySelector('#chain-fee-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => w.document.querySelector('#fee-receipts').textContent === '5,000.00', 'Fee deposit did not update confirmed balances: ' + w.document.querySelector('#toast').textContent);
    assert.equal(await treasury.totalFees(), parseUnits('5000',6));
    assert.equal(w.document.querySelector('#holder-assets').textContent, '5,000.00');
    assert.equal(w.document.querySelector('#available-cash').textContent, '5,000.00');
    assert.equal(w.document.querySelector('#chain-investment-count').textContent, '0');
    const ready = () => waitFor(() => !w.document.querySelector('#chain-mint').disabled, 'Transaction did not finish');
    const submit = id => w.document.querySelector(id).dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    const input = (form, name, value) => { w.document.querySelector(`${form} [name="${name}"]`).value = value; };
    await ready(); w.document.querySelector('#chain-admin-button').click(); submit('#chain-purchase-form');
    await waitFor(() => w.document.querySelector('#chain-record-form'), 'Reserved purchase did not open for recording');
    await ready(); w.document.querySelector('#chain-test-document').click();
    await waitFor(() => w.document.querySelector('#chain-evidence-status').textContent.includes('Labeled test document'), 'Test document was not prepared');
    submit('#chain-record-form');
    await waitFor(() => w.document.querySelector('#capital-allocated').textContent === '2,000.00', 'Purchase did not settle: '+w.document.querySelector('#toast').textContent);
    await ready(); w.document.querySelector('#chain-investment-dialog').close(); w.document.querySelector('#chain-admin-button').click();
    w.document.querySelector('[data-admin-tab="payments"]').click();
    input('#chain-payment-form','principal','300'); input('#chain-payment-form','reference','TEST-PAYMENT-001'); submit('#chain-payment-form');
    await waitFor(() => w.document.querySelector('#chain-income-available').textContent === '1,200.00', 'Payment was not recorded: '+w.document.querySelector('#toast').textContent);
    await ready(); w.document.querySelector('[data-admin-tab="members"]').click();
    input('#chain-member-form','account',accounts[0]); input('#chain-member-form','units','60'); submit('#chain-member-form');
    await waitFor(async () => await treasury.eligibleUnits(accounts[0]) === 60n, 'First participant was not saved'); await ready();
    input('#chain-member-form','account',accounts[1]); input('#chain-member-form','units','40'); submit('#chain-member-form');
    await waitFor(async () => await treasury.eligibleUnits(accounts[1]) === 40n, 'Second participant was not saved'); await ready();
    w.document.querySelector('[data-admin-tab="payouts"]').click(); submit('#chain-reserve-form');
    await waitFor(() => w.document.querySelector('#chain-cash-reserve').textContent === '200.00', 'Cash reserve was not set'); await ready();
    submit('#chain-distribution-form');
    await waitFor(() => w.document.querySelector('#chain-holder-claimable').textContent === '600.00', 'Distribution did not freeze the 60/40 allocation: '+w.document.querySelector('#toast').textContent);
    await ready(); w.document.querySelector('#chain-admin-dialog').close(); w.location.hash = '#holdings';
    w.document.querySelector('[data-chain-claim="0"]').click();
    await waitFor(() => w.document.querySelector('#chain-holder-received').textContent === '600.00', 'First claim did not arrive'); await ready();
    assert.equal(w.document.querySelector('#chain-holder-claimable').textContent,'0.00');
    activeAccount = accounts[1]; listeners.get('accountsChanged')([activeAccount]);
    await waitFor(() => w.document.querySelector('#chain-holder-claimable').textContent === '400.00', 'Switching wallets did not load the second allocation'); await ready();
    w.document.querySelector('[data-chain-claim="0"]').click();
    await waitFor(() => w.document.querySelector('#chain-holder-received').textContent === '400.00', 'Second claim did not arrive'); await ready();
    assert.equal(w.document.querySelector('#holder-assets').textContent,'400.00');
    assert.equal(w.document.querySelector('#chain-holder-claimable').textContent,'0.00');
    assert.equal(w.document.querySelectorAll('[data-chain-claim]').length,0,'A completed claim must not be offered again');
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); await engine.disconnect(); }
});
