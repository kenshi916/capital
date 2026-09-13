import { createEVMClient } from '@metamask/connect-evm';
let client;
export async function connectMetaMask(chainId) {
  client ||= await createEVMClient({
    dapp: { name: 'Mainstreet', url: location.origin, iconUrl: new URL('/favicon.svg', location.origin).href },
    api: { supportedNetworks: {
      '0x1237': 'https://rpc.mainnet.chain.robinhood.com',
      '0xb626': 'https://rpc.testnet.chain.robinhood.com',
      '0xaa36a7': 'https://ethereum-sepolia-rpc.publicnode.com'
    } },
    analytics: { enabled: false }, skipAutoAnnounce: true,
    ui: { preferExtension: true, showInstallModal: true }
  });
  const { accounts } = await client.connect({ chainIds: ['0x' + Number(chainId).toString(16)] });
  return { accounts, provider: client.getProvider() };
}
export async function disconnectMetaMask() { await client?.disconnect(); }
