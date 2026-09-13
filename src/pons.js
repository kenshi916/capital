import { Contract, JsonRpcProvider, FetchRequest, getAddress, formatUnits, ZeroAddress } from 'ethers';
import factoryABI from './pons-factory-abi.json';
export const PONS = { chainId: 4663, factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com', source: 'https://docs.ponsfamily.com/v2' };
const tokenABI = ['function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)','function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)','function launchFactory() view returns (address)','function curve() view returns (address)'];
const curveABI = ['function factory() view returns (address)','function token() view returns (address)','function pairToken() view returns (address)','function feeEscrow() view returns (address)','function quoteFeeBalance() view returns (uint256)','function creatorTaxBalance() view returns (uint256)','function buybackQuoteBalance() view returns (uint256)'];
const escrowABI = ['function balanceOf(address) view returns (uint256)','function balanceOfToken(address,address) view returns (uint256)'];
const same = (a,b) => a.toLowerCase() === b.toLowerCase();
export function pendingCreatorFees(base, tax, earmarked, protocolBps) {
  if ([base,tax,earmarked,protocolBps].some(n=>typeof n !== 'bigint' || n < 0n) || protocolBps > 10000n) throw new Error('Invalid fee accounting inputs.');
  const creator = base - base * protocolBps / 10000n;
  return creator - (earmarked < creator ? earmarked : creator) + tax;
}
export async function inspectPons({token,recipient,holder}, suppliedProvider) {
  const tokenAddress = token ? getAddress(token) : null;
  const expectedRecipient = recipient ? getAddress(recipient) : null;
  const holderAddress = holder ? getAddress(holder) : null;
  const request = new FetchRequest(PONS.rpc); request.timeout = 12000;
  const provider = suppliedProvider || new JsonRpcProvider(request, undefined, { batchMaxCount: 8 });
  try {
    if (Number((await provider.getNetwork()).chainId) !== PONS.chainId) throw new Error('RPC returned the wrong network. No launch data is accepted.');
    const block = await provider.getBlockNumber(), at = { blockTag: block };
    const factory = new Contract(PONS.factory, factoryABI, provider);
    if (await provider.getCode(PONS.factory,block) === '0x') throw new Error('The supported Pons factory is unavailable.');
    const canLaunch = holderAddress ? await factory.canLaunch(holderAddress,at) : null;
    const result = { block, checkedAt: new Date().toISOString(), chainId: PONS.chainId, factory: PONS.factory, canLaunch, holder: holderAddress };
    if (!tokenAddress) return result;
    const launch = await factory.getLaunchedToken(tokenAddress,at);
    if (!launch.exists || !same(launch.token,tokenAddress)) throw new Error('This address is not registered in the supported Pons V2 factory. V1 and other factories need their own integration.');
    const contract = new Contract(tokenAddress,tokenABI,provider), curve = new Contract(launch.curve,curveABI,provider);
    const [origin,tokenCurve,curveFactory,curveToken,curveQuote,escrowAddress,curveEscrow,policy,pending] = await Promise.all([
      contract.launchFactory(at),contract.curve(at),curve.factory(at),curve.token(at),curve.pairToken(at),factory.feeEscrow(at),curve.feeEscrow(at),factory.getLaunchFeePolicy(tokenAddress,at),factory.pendingCreatorFeeRecipient(tokenAddress,at)
    ]);
    if (!same(origin,PONS.factory) || !same(tokenCurve,launch.curve) || !same(curveFactory,PONS.factory) || !same(curveToken,tokenAddress) || !same(curveQuote,launch.pairToken) || !same(curveEscrow,escrowAddress)) throw new Error('The token, factory and curve references do not match. No launch balance is accepted.');
    const escrow = new Contract(escrowAddress,escrowABI,provider);
    const quote = same(launch.pairToken,ZeroAddress) ? null : new Contract(launch.pairToken,tokenABI,provider);
    const [name,symbol,decimals,supply,balance,quoteSymbol,quoteDecimals,claimable] = await Promise.all([
      contract.name(at),contract.symbol(at),contract.decimals(at),contract.totalSupply(at),holderAddress ? contract.balanceOf(holderAddress,at) : null,
      quote ? quote.symbol(at) : 'ETH',quote ? quote.decimals(at) : 18,
      quote ? escrow.balanceOfToken(launch.creatorFeeRecipient,launch.pairToken,at) : escrow.balanceOf(launch.creatorFeeRecipient,at)
    ]);
    let unswept = null;
    if (Number(launch.phase) === 0) {
      const [base,tax,earmark] = await Promise.all([curve.quoteFeeBalance(at),curve.creatorTaxBalance(at),curve.buybackQuoteBalance(at)]);
      unswept = formatUnits(pendingCreatorFees(base,tax,earmark,policy.protocolFeeShareBps),quoteDecimals);
    }
    return {...result, token: tokenAddress, name: name.slice(0,100), symbol: symbol.slice(0,32), totalSupply: formatUnits(supply,decimals), walletBalance: balance == null ? null : formatUnits(balance,decimals),
      curve: launch.curve, phase: Number(launch.phase), recipient: launch.creatorFeeRecipient, recipientMatches: expectedRecipient ? same(expectedRecipient,launch.creatorFeeRecipient) : null,
      quote: launch.pairToken, quoteSymbol: quoteSymbol.slice(0,32), escrow: escrowAddress, claimable: formatUnits(claimable,quoteDecimals), unswept,
      creatorTaxBps: Number(launch.creatorTaxBps), protocolShareBps: Number(policy.protocolFeeShareBps),
      pendingRecipient: same(pending.newRecipient,ZeroAddress) ? null : { address: pending.newRecipient, effectiveAt: pending.effectiveAt.toString(), expiresAt: pending.expiresAt.toString() }
    };
  } finally { if (!suppliedProvider) provider.destroy(); }
}
