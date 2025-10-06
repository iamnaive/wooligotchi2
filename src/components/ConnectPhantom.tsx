// src/components/ConnectPhantom.tsx
// All comments in English only.
import React, { useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';

export default function ConnectPhantom() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Only our PhantomOnlyConnector exists; pick the first.
  const phantomConnector = useMemo(() => connectors[0], [connectors]);

  const [err, setErr] = useState<string>('');

  async function onConnect() {
    setErr('');
    try {
      await connect({ connector: phantomConnector });
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? 'Connect failed');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {!isConnected ? (
        <>
          <button onClick={onConnect} disabled={isPending} style={{ padding: '8px 12px' }}>
            Connect Phantom
          </button>
          {err && <div style={{ color: 'crimson', fontSize: 12 }}>{err}</div>}
          <small>
            If nothing happens, make sure Phantom (EVM) is installed and enabled. We ignore MetaMask on purpose.
          </small>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14 }}>
            Connected: {address?.slice(0, 6)}…{address?.slice(-4)} (chain {chainId})
          </div>
          <button onClick={() => disconnect()} style={{ padding: '8px 12px' }}>
            Disconnect
          </button>
        </>
      )}
    </div>
  );
}
