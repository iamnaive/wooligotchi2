// src/App.tsx
// App shell with Phantom-only connector + SendByIdPanel + Tamagotchi wiring.
// Comments: English only.

import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  WagmiProvider,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config as wagmiConfig, MONAD as monadChain } from "./wagmi";
import { Address, parseAbi } from "viem";

import Tamagotchi from "./components/Tamagotchi";
import { GameProvider } from "./game/useGame";
import { catalog, type AnimSet, type FormKey } from "./game/catalog";
import { getLives, setLives, useOneLife } from "./game/lives";
import "./styles.css";

// ===== ENV =====
const MONAD_CHAIN_ID = monadChain.id as const;
const REST_BASE =
  (import.meta as any).env.VITE_LIVES_REST || "http://localhost:8787";
const COLLECTION_ADDRESS = String(
  (import.meta as any).env.VITE_COLLECTION_ADDRESS || ""
).toLowerCase() as Address;
const VAULT_ADDRESS = String(
  (import.meta as any).env.VITE_VAULT_ADDRESS || ""
).toLowerCase() as Address;

// ===== Inline SendByIdPanel =====
function SendByIdPanel() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const ERC721_ABI = parseAbi([
    "function safeTransferFrom(address from, address to, uint256 tokenId) external",
  ]);

  const [rawId, setRawId] = useState("");
  const tokenId = useMemo(() => {
    const s = rawId.trim();
    if (!s) return null;
    if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
    if (/^\d+$/.test(s)) return BigInt(s.replace(/^0+/, "") || "0");
    return null;
  }, [rawId]);

  const [sending, setSending] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function mapError(e: any): string {
    const t = String(e?.shortMessage || e?.message || e || "").toLowerCase();
    if (e?.code === 4001 || t.includes("user rejected"))
      return "You rejected the transaction in the wallet.";
    if (t.includes("insufficient funds")) return "Not enough MON to pay gas.";
    if (
      t.includes("mismatch") ||
      t.includes("wrong network") ||
      t.includes("chain of the wallet")
    )
      return `Wrong network. Switch to Monad (${MONAD_CHAIN_ID}).`;
    if (t.includes("non erc721receiver"))
      return "Vault is not ERC721Receiver or wrong address.";
    if (t.includes("not token owner") || t.includes("not owner nor approved"))
      return "You are not the owner of this tokenId.";
    return e?.shortMessage || e?.message || "Failed.";
  }

  async function onSend() {
    setErr(null);
    setHash(null);
    if (!address) {
      setErr("Connect a wallet first.");
      return;
    }
    if (!COLLECTION_ADDRESS || !VAULT_ADDRESS) {
      setErr("Environment addresses are not set.");
      return;
    }
    if (tokenId === null) {
      setErr("Invalid tokenId.");
      return;
    }

    if (chainId !== MONAD_CHAIN_ID) {
      try {
        await switchChain({ chainId: MONAD_CHAIN_ID });
      } catch {
        setErr(`Wrong network. Switch to Monad (${MONAD_CHAIN_ID}).`);
        return;
      }
    }

    try {
      setSending(true);
      const tx = await writeContractAsync({
        address: COLLECTION_ADDRESS,
        abi: ERC721_ABI,
        functionName: "safeTransferFrom",
        args: [address, VAULT_ADDRESS, tokenId],
        chainId: MONAD_CHAIN_ID,
        account: address,
        gas: 120_000n, // explicit gas headroom
      });
      setHash(tx as string);
      // Backend watcher should credit lives on Transfer event.
    } catch (e: any) {
      setErr(mapError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(180deg,#0f1117,#0b0d12)",
        color: "#eaeaf0",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Send NFT by ID</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
          Collection → Vault on Monad ({MONAD_CHAIN_ID})
        </div>
      </div>

      <div>
        <label className="text-xs opacity-80" style={{ display: "block", marginBottom: 6 }}>
          tokenId
        </label>
        <div
          className="flex items-center rounded-xl px-3 py-2"
          style={{ background: "#17171c", border: "1px solid #2b2b31" }}
        >
          <div
            className="text-xs mr-2 px-2 py-1 rounded-lg"
            style={{ background: "#222228", border: "1px solid #32323a", color: "#ddd" }}
          >
            #ID
          </div>
          <input
            className="flex-1 outline-none text-sm"
            placeholder="e.g. 1186 or 0x4a2"
            value={rawId}
            onChange={(e) => setRawId(e.target.value)}
            spellCheck={false}
            style={{ color: "#fff", background: "transparent", border: 0, caretColor: "#fff" }}
          />
          <span
            className="text-[11px] ml-2"
            style={{ opacity: 0.75, color: tokenId !== null ? "#9fe29f" : "#ff9e9e" }}
          >
            {tokenId !== null ? "ok" : "invalid"}
          </span>
        </div>
        <div className="muted" style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
          Make sure your wallet is on Monad.
        </div>
      </div>

      <button
        disabled={!address || tokenId === null || sending}
        onClick={onSend}
        className="w-full rounded-xl py-3 transition"
        style={{
          marginTop: 12,
          background:
            !address || tokenId === null || sending
              ? "#2a2a2f"
              : "linear-gradient(90deg,#7c4dff,#00c8ff)",
          color: "#fff",
          boxShadow:
            !address || tokenId === null || sending
              ? "none"
              : "0 8px 22px rgba(124,77,255,0.35)",
          opacity: sending ? 0.85 : 1,
          cursor:
            !address || tokenId === null || sending ? "not-allowed" : "pointer",
        }}
      >
        {sending ? "Sending…" : "Send to Vault"}
      </button>

      {hash && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
          Tx: <code>{hash.slice(0, 12)}…{hash.slice(-10)}</code>
        </div>
      )}
      {err && (
        <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>{err}</div>
      )}
    </div>
  );
}

// ===== Game glue =====
type PetConfig = { name: string; fps?: number; anims: AnimSet };
function makeConfigFromForm(form: FormKey): PetConfig {
  return { name: "Tamagotchi", fps: 8, anims: catalog[form] };
}
const FORM_KEY_STORAGE = "wg_form_v1";
function loadForm(): FormKey {
  return (localStorage.getItem(FORM_KEY_STORAGE) as FormKey) || "egg";
}
function saveForm(f: FormKey) {
  localStorage.setItem(FORM_KEY_STORAGE, f);
}

// Authoritative lives via backend
async function fetchLivesREST(address?: string | null): Promise<number> {
  if (!address) return 0;
  try {
    const r = await fetch(`${REST_BASE.replace(/\/$/, "")}/lives/${address}`);
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.lives || 0);
  } catch {
    return 0;
  }
}

function useRemoteLives(chainId: number | undefined, address?: string | null) {
  const [lives, setLivesState] = useState(0);
  useEffect(() => {
    let timer: any;
    async function tick() {
      const v = await fetchLivesREST(address);
      setLivesState(v);
      setLives(chainId ?? MONAD_CHAIN_ID, address || undefined, v); // mirror to local storage
    }
    tick();
    timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [chainId, address]);
  return lives;
}

function AppInner() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalanceMock(address, chainId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<FormKey>(() => loadForm());
  useEffect(() => {
    saveForm(form);
  }, [form]);

  const lives = useRemoteLives(chainId, address);
  const petConfig = useMemo(() => makeConfigFromForm(form), [form]);

  const walletItems = useMemo(
    () => connectors.map((c) => ({ id: c.id, label: c.name })),
    [connectors]
  );

  const pickWallet = async (connectorId: string) => {
    try {
      const c = connectors.find((x) => x.id === connectorId);
      if (!c) return;
      await connect({ connector: c });
      setPickerOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.shortMessage || e?.message || "Connect failed");
    }
  };

  const evolve = React.useCallback(
    (next?: FormKey) => {
      const n = next ?? form;
      setForm(n);
      return n;
    },
    [form]
  );

  const gate: "splash" | "locked" | "game" =
    !isConnected ? "splash" : lives <= 0 ? "locked" : "game";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="logo">🐣</div>
          <div className="title">Wooligotchi</div>
        </div>

        {!isConnected ? (
          <button
            className="btn btn-primary"
            onClick={() => setPickerOpen(true)}
          >
            Connect
          </button>
        ) : (
          <div className="walletRow">
            <span className="pill">
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
            </span>
            <span className="pill">Chain: {chainId ?? "—"}</span>
            <button className="btn ghost" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        )}
      </header>

      {gate === "splash" && (
        <section className="card splash">
          <div className="splash-inner">
            <div className="splash-title">Wooligotchi</div>
            <div className="muted">Send 1 NFT → get 1 life (to the Vault)</div>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setPickerOpen(true)}
            >
              Connect Wallet
            </button>
          </div>
        </section>
      )}

      {gate === "locked" && (
        <section className="card splash">
          <div className="splash-inner">
            <div className="splash-title">No lives</div>
            <div className="muted">Send 1 NFT → get 1 life</div>
            <SendByIdPanel />
          </div>
        </section>
      )}

      {gate === "game" && (
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <GameProvider config={petConfig}>
            <Tamagotchi
              key={address || "no-wallet"}
              currentForm={form}
              onEvolve={(n) => setForm(n)}
              lives={lives}
              onLoseLife={() => {
                const spent = useOneLife(
                  chainId ?? MONAD_CHAIN_ID,
                  address || undefined
                );
                if (!spent) alert("No lives");
              }}
              walletAddress={address || undefined}
            />
          </GameProvider>
        </div>
      )}

      <footer className="foot">
        <span className="muted">Status: {status}</span>
      </footer>

      {pickerOpen && !isConnected && (
        <div onClick={() => setPickerOpen(false)} className="modal">
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: 460, maxWidth: "92vw" }}
          >
            <div
              className="title"
              style={{ fontSize: 20, marginBottom: 10, color: "white" }}
            >
              Connect a wallet
            </div>
            <div className="wallet-grid">
              {connectors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickWallet(c.id)}
                  disabled={connectStatus === "pending"}
                  className="btn btn-ghost"
                  style={{ width: "100%" }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div
              style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}
            >
              <button onClick={() => setPickerOpen(false)} className="btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// very small fake balance label (optional)
function useBalanceMock(address?: string | null, chainId?: number) {
  const [data, set] = useState<{ formatted: string; symbol: string } | null>(
    null
  );
  useEffect(() => {
    set(null);
  }, [address, chainId]);
  return { data };
}

// ===== Root with WagmiProvider & QueryClient =====
export default function App() {
  const qc = useMemo(() => new QueryClient(), []);
  return (
    <QueryClientProvider client={qc}>
      <WagmiProvider config={wagmiConfig}>
        <AppInner />
      </WagmiProvider>
    </QueryClientProvider>
  );
}
