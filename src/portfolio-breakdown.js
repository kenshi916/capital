import {startupFund as fund} from './portfolio-model.js';
import {escapeHTML as esc} from './chain-utils.js';

export function portfolioBreakdown(icon){
 const row=c=>`<button type="button" class="portfolio-exposure-row" data-exposure-company="${esc(c.id)}" aria-label="View ${esc(c.name)}: ${esc(c.weight)} approximate share of fund net assets">${icon(c)}<span class="portfolio-exposure-company"><strong>${esc(c.name)}</strong><small>${esc(c.category)}</small></span><span class="portfolio-exposure-weight">${esc(c.weight)}</span><span class="portfolio-exposure-arrow" aria-hidden="true">↗</span></button>`;
 return `<section id="portfolio-exposure" class="portfolio-exposure" data-balance-state="disconnected" aria-labelledby="portfolio-exposure-title"><div class="portfolio-exposure-heading"><h3 id="portfolio-exposure-title">Companies behind VCXx</h3><span>20 selected companies</span></div><p id="portfolio-exposure-status" class="portfolio-exposure-status" role="status" aria-live="polite">Connect your wallet to verify your VCXx exposure. These rows show fund information.</p><div class="portfolio-exposure-labels"><span>Indirect exposure through VCX</span><span>Approx. fund weight</span></div><div class="portfolio-exposure-grid">${fund.companies.slice(0,6).map(row).join('')}</div><details id="portfolio-exposure-more" class="portfolio-exposure-more"><summary><span class="exposure-show-all">View all 20 companies</span><span class="exposure-show-less">Show fewer companies</span><span class="exposure-chevron" aria-hidden="true">⌄</span></summary><div class="portfolio-exposure-grid">${fund.companies.slice(6).map(row).join('')}</div></details><p class="portfolio-exposure-note">Approximate bands of fund net assets as of <time datetime="${fund.reportedAt}">June 30, 2026</time>. Selected holdings, including indirect positions; composition can change. These are not individual company shares or payout allocations. <a href="${esc(fund.holdingsUrl)}" target="_blank" rel="noopener noreferrer">Fund disclosure ↗</a></p></section>`;
}

export function updatePortfolioExposure(state,balance=''){
 const panel=document.querySelector('#portfolio-exposure');if(!panel)return;
 panel.dataset.balanceState=state;
 document.querySelector('#portfolio-exposure-status').textContent={
  disconnected:'Connect your wallet to verify your VCXx exposure. These rows show fund information.',
  loading:'Checking your VCXx wallet balance… These rows show fund information.',
  held:`${balance} VCXx verified in your Ethereum wallet. Explore selected companies behind the fund below.`,
  empty:'No VCXx detected in this Ethereum wallet. These rows show fund information.',
  unavailable:'Your wallet balance could not be verified. These rows show fund information.'
 }[state];
}
