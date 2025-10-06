// src/wagmi-phantom-only.ts
// All comments in English only.
import { Connector } from 'wagmi';
import type { Chain } from 'viem';

type PhantomEthereum = {
  isPhantom?: boolean;
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, cb: (...args: any[]) => void) => void;
  removeListener?: (event: string, cb: (...args: any[]) => void) => void;
};

function findPhantom(): PhantomEthereum | null {
  // 1) Desktop Phantom EVM entry
  const direct = (window as any)?.phantom?.ethereum;
  if (direct && typeof direct.request === 'function') return direct;

  // 2) EIP-6963 discovery (multiple providers)
  const announced: PhantomEthereum[] = [];
  const handler = (event: any) => {
    const p = event.detail?.provider;
    if (p && typeof p.request === 'function') announced.push(p);
  };
  window.addEventListener('eip6963:announceProvider', handler as any);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  window.removeEventListener('eip6963:announceProvider', handler as any);

  const ph = announced.find((p: any) => p?.isPhantom === true);
  if (ph) return ph;

  // 3) Fallback: window.ethereum but reject MetaMask
  const eth: any = (window as any).ethereum;
  if (eth && !eth.isMetaMask && typeof eth.request === 'function') return eth;

  return null;
}

export class PhantomOnlyConnector extends Connector {
  readonly id = 'phantom-only';
  readonly name = 'Phantom (EVM)';
  protected provider_: PhantomEthereum | null = null;

  constructor({ chains }: { chains?: Chain[] } = {}) {
    super({ chains });
  }

  async getProvider(): Promise<PhantomEthereum | null> {
    if (this.provider_) return this.provider_;
    this.provider_ = findPhantom();
    return this.provider_;
  }

  async connect() {
    const provider = await this.getProvider();
    if (!provider) throw new Error('Phantom provider not found');
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    return {
      account: accounts[0] as `0x${string}`,
      chain: { id: chainId, unsupported: false },
      provider,
    };
  }

  async disconnect() {
    // No explicit disconnect; rely on dapp state.
    this.provider_ = this.provider_; // noop
  }

  async getAccount() {
    const provider = await this.getProvider();
    if (!provider) throw new Error('Phantom provider not found');
    const accounts = await provider.request({ method: 'eth_accounts' });
    return (accounts?.[0] ?? null) as `0x${string}` | null;
  }

  async getChainId() {
    const provider = await this.getProvider();
    if (!provider) throw new Error('Phantom provider not found');
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  }

  async isAuthorized() {
    try {
      const acc = await this.getAccount();
      return Boolean(acc);
    } catch {
      return false;
    }
  }

  async switchChain(chainId: number) {
    const provider = await this.getProvider();
    if (!provider) throw new Error('Phantom provider not found');
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }],
    });
    const target = this.chains?.find(c => c.id === chainId);
    return target ?? ({ id: chainId, name: 'Unknown' } as any);
  }
}
