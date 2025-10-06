// src/wagmi-phantom-only.ts
// Comments: English only.

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Re-export the type so other files can import it as a type (no runtime).
export type { Connector } from "wagmi";

// ===== Chain (Monad Testnet) =====
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        (import.meta as any).env?.VITE_MONAD_RPC ||
          "http://127.0.0.1:8545", // set your testnet RPC here
      ],
    },
    public: {
      http: [
        (import.meta as any).env?.VITE_MONAD_RPC ||
          "http://127.0.0.1:8545",
      ],
    },
  },
});

// ===== Connector: Phantom-only via injected() with provider targeting =====
const phantomInjected = injected({
  target() {
    if (typeof window !== "undefined") {
      const w = window as any;
      // Prefer Phantom EVM provider if present
      const phantomEth = w?.phantom?.ethereum;
      if (phantomEth) return phantomEth;
      const eth = w?.ethereum;
      if (eth?.isPhantom) return eth;
    }
    // If not found, return undefined so connector stays unavailable
    return undefined;
  },
  shimDisconnect: true,
  name: (detectedName) => detectedName ?? "Phantom (EVM)",
});

// ===== Wagmi config (Phantom-only) =====
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [phantomInjected],
  transports: {
    [monadTestnet.id]: http(
      (import.meta as any).env?.VITE_MONAD_RPC || "http://127.0.0.1:8545"
    ),
  },
});
