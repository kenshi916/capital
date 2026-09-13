# Mainstreet launch preparation and test treasury

## Prepare a real-money launch

The default **Launch setup** workspace collects a draft across token/fee routing, investing entity and holder rights, first purchase, and custody/payout operations. No launch-specific details are prefilled. The user has not yet chosen the token, fee wallet, buying entity, or provider structure.

- Drafts save only in this browser's local storage. They are not shared with the Site owner or other devices. Download a JSON draft to back up or transfer it; validated imports preview the replacement before it is applied.
- USD purchase budgeting uses exact integer cents, distinguishes purchase fees and retained reserves, and reports the funding gap against operator-reported settled cash.
- Business profiles can populate a purchase draft without overwriting existing operator edits. Terms still require confirmation at the provider.
- Review & evidence records SHA-256 document fingerprints locally (up to 30 references, 10 MB per file). Original documents are neither uploaded nor included in exports. Fingerprints do not authenticate the documents or establish ownership.
- A readable Markdown review packet includes all plan fields, missing details, the budget, evidence fingerprints and remaining production dependencies. Reported approvals remain unverified.
- No field or imported file can enable live operations. Real Pons collection, order submission, production custody and real payouts are not implemented or connected. Production requires a separately reviewed design and integration; the existing test contracts cannot be converted by changing a network setting.

The original testnet treasury, directory and wallet claim flows remain available under **Test treasury**, **Businesses**, and **My portfolio**. Treasury links continue to open their testnet context.

Mainstreet is a wallet-connected testnet application with a real-company research directory. It does not hold real company shares, issue equity rights, collect live Pons fees, or send orders to Republic/Wefunder.

## Run the pilot

1. Open the published site and connect MetaMask (an extension or its mobile browser).
2. Select Robinhood Chain Testnet, chain ID `46630`, or Ethereum Sepolia, `11155111`.
3. Obtain test ETH through the selected network's documentation/faucet resources. Click **Deploy test treasury**. The wallet signs one deployment creating the treasury, mUSD test token, and immutable-allocation distribution contract. The signing wallet is the administrator and original test settlement recipient.
4. Use **Get test dollars** for 10,000 valueless mUSD (once per wallet per day). **Deposit test fees** performs an exact-amount token approval followed by a deposit.
5. In **Manage treasury → Purchases**, reserve a test purchase. Open its record, create/download a clearly labeled test document or hash a local document, then record the test settlement. Only hashes and an optional public URL are sent onchain; local files are not uploaded. The settlement transfers mUSD to the original administrator, not to Republic or the issuer.
6. In **Payments**, deposit and record principal and income separately. In **Participants**, assign 60 units to one wallet and 40 to another. In **Distributions**, set a cash reserve, then fund 1,000 mUSD of received income.
7. Each allocated wallet can claim 600/400 mUSD under **My portfolio**. Updating units afterward cannot change existing allocations; double claims are rejected.
8. Use **Share treasury** to send a link containing the network and contract address. Those records are shared onchain. Only the selected address preference is stored locally. The root site has no globally deployed default until `dist/deployment.json` is updated with an actual deployed address.

## Contract boundaries

- `MainstreetTreasury` deploys only on the two supported test networks or local chain `31337`.
- The fixed asset is a newly deployed `MainstreetTestDollar`, not USDC. No real stablecoin deposit or production-chain deployment is enabled.
- Management is owner-only, using OpenZeppelin two-step ownership. No private key, seed phrase, or server signing account is used by the site.
- The pilot supports at most 100 participant addresses and 200 investment records.
- Purchase reservations and cash reserves cannot be spent by another purchase or distribution.
- Repeated receipt hashes are rejected. Principal repayments reduce cost and do not create distributable income.
- Distribution amounts are calculated and fully funded atomically. Recipients/amounts cannot be modified or withdrawn by the administrator afterward. Rounding remains in the treasury.
- The client checks runtime bytecode, excluding compiler-declared immutable slots, for all three contracts before enabling token approvals. It rechecks wallet account/network before every transaction and approves only the required mUSD amount.
- Reads use a common block for balance/record consistency. Transaction history is bounded to the latest 10,000 blocks; lifetime claim totals and the investment register are read directly from contract state. Earlier distributions can be loaded in batches.

## Real-purchase handoff

**Real purchase setup** exports an unsubmitted worksheet with the proposed investing entity, business, instrument, USD budget, fees and account status. Inputs are operator-reported, not verified. A real purchase still needs an approved investing structure, provider acceptance, real funds, signed documents and final holding confirmation. A hash alone does not verify ownership. No production asset, holder-rights formula, custody arrangement, bank/offramp or signed provider integration is configured.

For a real pilot, choose a specific offering and approved buyer, review terms and budget, complete provider checkout, reconcile the finalized holding, and then build/approve the production custody and distribution integration. The test contracts cannot be switched to accept real money.

## Pons research

Checked September 13, 2026: [Pons documentation](https://docs.ponsfamily.com/#fees) describes creator fees in both the launch token and WETH, with a current 70% creator / 30% protocol split snapshotted at launch (legacy launches have a different split). Claims accrue in the locked position and route to the creator payout wallet. There is no Mainstreet launch token or fee wallet configured. Dollar investments therefore also require actual collection, conversion/offramp and reconciliation. Test mUSD deposits do not represent that integration.

Network settings were cross-checked against [ethereum-lists chain data](https://chainid.network/chains.json). Public testnet RPC requests from the development environment timed out or returned access errors, and no funded user wallet was available. Browser deployment is implemented; no public deployment address is asserted in the configuration.

## Development and checks

```sh
npm ci
npm run contracts
npm run bundle
npm test
```

The static site lives in `dist/`; contract source is in `contracts/`, browser source in `src/`. `scripts/compile.mjs` emits the ABI, deployment bytecode and immutable references into `dist/contracts/artifacts.json`. `scripts/bundle.mjs` bundles the wallet application with a pinned ethers dependency.

Tests execute the actual compiled contracts on an in-process EVM. They cover authorization, duplicate receipts, reserves, principal/income separation, immutable 60/40 allocations, two claims, double-claim rejection, production-chain rejection, and the published UI's wallet-to-payout flow. These are local tests, not a public-testnet transaction or an independent security audit.

Publishing uses the existing Sites project and its static hosting manifest. Keep source and compiled outputs in the same pushed revision. No development server is required for these static assets.
