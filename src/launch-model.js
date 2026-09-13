import { getAddress } from 'ethers';

export const SECTIONS = [
  { id: 'token', title: 'Token & fees', intro: 'Identify the launch and the route from creator fees to investment cash.', fields: [
    ['networkName', 'Launch network', 'text', 'Network name'],
    ['chainId', 'Chain ID', 'chain', 'Confirm with the network'],
    ['tokenAddress', 'Launch token address', 'address', '0x…'],
    ['launchUrl', 'Pons launch URL', 'url', 'https://…'],
    ['feeWallet', 'Creator payout wallet', 'address', '0x…'],
    ['creatorShare', 'Creator fee share · %', 'percent', 'Use this launch’s actual split'],
    ['feeAssets', 'Assets received as fees', 'text', 'Token symbols and contract addresses'],
    ['conversion', 'Conversion & bank settlement route', 'textarea', 'Who collects fees, converts assets and reconciles the cash?']
  ]},
  { id: 'entity', title: 'Entity & rights', intro: 'Record the proposed buyer and the structure your reviewers need to approve.', fields: [
    ['entity', 'Investing entity', 'text', 'Full legal name'],
    ['jurisdiction', 'Entity jurisdiction', 'text', 'Country and state / region'],
    ['structure', 'Investment structure', 'textarea', 'How the entity holds investments and participants receive enforceable rights'],
    ['eligibility', 'Participant eligibility & transfer rules', 'textarea', 'Who may participate and who checks eligibility?'],
    ['rights', 'Holder rights & allocation formula', 'textarea', 'Define economic rights, snapshot timing, exclusions and rounding'],
    ['reviewer', 'Structure reviewer / counsel', 'text', 'Name or firm; no personal contact details'],
    ['structureStatus', 'Structure review status', 'select', ['Not reviewed', 'In review', 'Operator reports approval']]
  ]},
  { id: 'purchase', title: 'First purchase', intro: 'Budget a specific investment and track the provider handoff. This plan does not place an order.', fields: [
    ['business', 'Business / legal issuer', 'text', 'Choose from Businesses or enter an issuer'],
    ['provider', 'Funding provider', 'text', 'Provider name'],
    ['offeringUrl', 'Original offering URL', 'url', 'https://…'],
    ['security', 'Security / instrument', 'text', 'As stated in the offering documents'],
    ['investment', 'Proposed investment · USD', 'money', '0.00'],
    ['fees', 'Platform & transaction fees · USD', 'money', '0.00'],
    ['reserve', 'Cash reserve · USD', 'money', '0.00'],
    ['cash', 'Available settled cash · USD', 'money', '0.00'],
    ['accountStatus', 'Entity’s provider account', 'select', ['Approval not confirmed', 'In review', 'Operator reports approval']],
    ['purchaseStatus', 'Purchase status', 'select', ['Not submitted', 'Submitted to provider', 'Payment sent', 'Provider reports holding finalized']],
    ['purchaseReference', 'Provider reference / reconciliation notes', 'textarea', 'Record the provider’s order reference and final holding details when available. No bank or account credentials.']
  ]},
  { id: 'custody', title: 'Custody & payouts', intro: 'Specify who controls funds and how a production payout should be calculated and reviewed.', fields: [
    ['custodian', 'Treasury custodian / signing policy', 'textarea', 'Custodian or multisignature signers, threshold and recovery process'],
    ['settlementAsset', 'Settlement asset & network', 'text', 'Currency, token address if applicable, and network'],
    ['treasuryAddress', 'Proposed production treasury', 'address', '0x… when deployed and reviewed'],
    ['distributionAddress', 'Proposed production claim contract', 'address', '0x… when deployed and reviewed'],
    ['incomePolicy', 'Income, expenses & loss accounting', 'textarea', 'Separate principal from income; include fees, losses, taxes and cash reserves'],
    ['distributionPolicy', 'Payout approval & eligibility policy', 'textarea', 'Approval process, holder snapshot, unclaimed funds and wallet recovery'],
    ['operations', 'Monitoring & incident owner', 'textarea', 'Who reconciles balances, handles failed payments and responds to incidents?']
  ]}
];
export const FIELDS = SECTIONS.flatMap(s => s.fields);
export const EVIDENCE_TYPES = ['Structure review', 'Provider account approval', 'Signed subscription agreement', 'Payment confirmation', 'Final holding statement', 'Contract security review', 'Integration acceptance'];
export const PRODUCTION_BLOCKERS = [
  'Confirm the launch token, Pons fee recipient and collection / conversion integration.',
  'Obtain review of the investing structure, holder rights and participant eligibility.',
  'Complete the provider’s entity approval, purchase and holding reconciliation.',
  'Implement and review production custody and distribution contracts, then verify their deployment.',
  'Connect and test live settlement, accounting, monitoring and payout operations.'
];
export const blankPlan = () => ({ fields: { ...Object.fromEntries(FIELDS.map(([key]) => [key, ''])), networkName: 'Robinhood Chain', chainId: '4663' }, evidence: [] });
export function cents(value) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) throw new Error('Use a nonnegative USD amount with at most two decimal places.');
  const [whole, decimal = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
}
export function usd(value) { const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value; return `${sign}$${(n / 100n).toLocaleString('en-US')}.${String(n % 100n).padStart(2, '0')}`; }
export function fieldError(field, value) {
  const [, , type, options] = field;
  if (!value) return '';
  if (typeof value !== 'string' || value.length > (type === 'textarea' ? 2000 : 500)) return 'This value is too long.';
  if (type === 'address') { try { if (getAddress(value) === '0x0000000000000000000000000000000000000000') return 'Use a nonzero address.'; } catch { return 'Enter a valid Ethereum address, including its checksum when mixed case.'; } }
  if (type === 'url') { try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) return 'Use an HTTPS URL without embedded credentials.'; } catch { return 'Enter a complete HTTPS URL.'; } }
  if (type === 'chain' && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)) return 'Use a positive whole-number chain ID.';
  if (type === 'percent' && (!/^\d{1,3}(\.\d{1,2})?$/.test(value) || Number(value) > 100)) return 'Use a percentage from 0 to 100, with at most two decimals.';
  if (type === 'money') { try { if (cents(value) === 0n && field[0] === 'investment') return 'The proposed investment must be above zero.'; } catch (e) { return e.message; } }
  if (type === 'select' && !options.includes(value)) return 'Choose a listed status.';
  return '';
}
export function assess(plan) {
  const invalid = FIELDS.filter(f => fieldError(f, plan.fields[f[0]]));
  const sections = SECTIONS.map(s => ({ id: s.id, title: s.title, total: s.fields.length, filled: s.fields.filter(f => plan.fields[f[0]] && !fieldError(f, plan.fields[f[0]])).length }));
  const budgetFields = ['investment', 'fees', 'reserve', 'cash'];
  let budget = null;
  if (budgetFields.every(k => plan.fields[k] && !fieldError(FIELDS.find(f => f[0] === k), plan.fields[k]))) {
    const [investment, fees, reserve, cash] = budgetFields.map(k => cents(plan.fields[k]));
    budget = { purchase: investment + fees, required: investment + fees + reserve, cash, gap: investment + fees + reserve - cash };
  }
  return { sections, filled: sections.reduce((n,s) => n+s.filled,0), total: FIELDS.length, invalid, budget, liveEnabled: false };
}
export function packet(plan) {
  return { schema: 'mainstreet-launch-plan', version: 1, exportedAt: new Date().toISOString(), status: 'DRAFT — OPERATOR REPORTED, NOT VERIFIED', liveEnabled: false, fields: { ...plan.fields }, evidence: plan.evidence.map(e => ({...e})), productionBlockers: [...PRODUCTION_BLOCKERS], notice: 'Preparation only. No order, transfer, approval or ownership verification is performed. Document hashes identify bytes; they do not establish authenticity or ownership.' };
}
export function importPlan(input) {
  if (!input || input.schema !== 'mainstreet-launch-plan' || input.version !== 1 || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw new Error('Choose a Capital launch plan JSON file (version 1).');
  const plan = blankPlan();
  for (const field of FIELDS) {
    const value = input.fields[field[0]] ?? '';
    if (typeof value !== 'string') throw new Error(`${field[1]} must be text.`);
    const cleaned = value.trim(), error = fieldError(field, cleaned);
    if (error) throw new Error(`${field[1]}: ${error}`);
    plan.fields[field[0]] = cleaned;
  }
  if (!Array.isArray(input.evidence) || input.evidence.length > 30) throw new Error('The plan can contain up to 30 document references.');
  plan.evidence = input.evidence.map(e => {
    if (!e || !EVIDENCE_TYPES.includes(e.type) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 255 || typeof e.sha256 !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(e.sha256) || !Number.isSafeInteger(e.size) || e.size < 0 || e.size > 10*1024*1024 || typeof e.addedAt !== 'string' || !Number.isFinite(Date.parse(e.addedAt))) throw new Error('A document reference is invalid. Import was cancelled.');
    return { type: e.type, name: e.name, sha256: e.sha256.toLowerCase(), size: e.size, addedAt: new Date(e.addedAt).toISOString() };
  });
  if (new Set(plan.evidence.map(e => e.type + e.sha256)).size !== plan.evidence.length) throw new Error('The plan contains duplicate document references.');
  return plan;
}
export function reviewText(plan) {
  const result = assess(plan);
  return ['# Capital launch review packet', '', 'DRAFT — operator reported; not independently verified. Real-money actions are disabled.', '', `Prepared: ${new Date().toISOString()}`, '', ...SECTIONS.flatMap(s => [`## ${s.title}`, '', ...s.fields.flatMap(([key,label]) => [`${label}: ${plan.fields[key] || 'NOT PROVIDED'}`, ''])]), '## Purchase budget', '', ...(result.budget ? [`Purchase including fees: ${usd(result.budget.purchase)}`, `Required including reserve: ${usd(result.budget.required)}`, `Reported settled cash: ${usd(result.budget.cash)}`, `Funding gap: ${usd(result.budget.gap > 0n ? result.budget.gap : 0n)}`] : ['Incomplete — supply investment, fees, reserve and settled cash.']), '', '## Document references', '', ...plan.evidence.map(e => `${e.type}: ${e.name}\nSHA-256: ${e.sha256}\nSize: ${e.size} bytes; added: ${e.addedAt}`), ...(plan.evidence.length ? [] : ['No documents referenced.']), '', 'Hashes identify file contents only. Original files are not included, uploaded, or verified.', '', '## Required before activation', '', ...PRODUCTION_BLOCKERS.map(s => `- ${s}`), '', 'Completing this draft does not activate production, prove ownership, or authorize any investment or payout.', ''].join('\n');
}
