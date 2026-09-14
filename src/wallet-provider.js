const METAMASK_RDNS=new Set(['io.metamask','io.metamask.mobile','io.metamask.flask']);

// isMetaMask alone is not a wallet identity: other injected wallets also set it.
export function isMetaMaskProvider(detail,phantomProvider){
 const provider=detail?.provider;
 return !!provider && typeof provider.request==='function' &&
  METAMASK_RDNS.has(detail.info?.rdns) &&
  provider.isPhantom!==true && provider!==phantomProvider;
}
