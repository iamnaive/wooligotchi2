// src/wagmi.ts
// All comments in English only.
import { createConfig, WagmiProvider, http } from 'wagmi';
import { defineChain } from 'viem';
import { PhantomOnlyConnector } from './wagmi-phantom-only';

const MONAD_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 10143);
const RPC_URL = String(import.meta.env.VITE_RPC_URL ?? 'https://testnet-rpc.monad.xyz');

export const MONAD = defineChain({
  id: MONAD_CHAIN_ID,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const config = createConfig({
  chains: [MONAD],
  connectors: [new PhantomOnlyConnector({ chains: [MONAD] })],
  transports: { [MONAD.id]: http(RPC_URL) },
});

// Re-export provider for convenience
export { WagmiProvider };
