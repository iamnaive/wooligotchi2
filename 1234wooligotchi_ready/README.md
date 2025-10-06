
 

## Quickstart: Lives via NFT to Vault

1) Install deps and run the app:
```bash
npm i
npm run dev
```

2) Start the granter service (separate terminal):
```bash
# set your RPC (prefer wss), collection and vault addresses
export RPC_URL="wss://testnet-rpc.monad.xyz/ws"
export COLLECTION_ERC721="$VITE_COLLECTION_ADDRESS"
export VAULT_ADDRESS="$VITE_VAULT_ADDRESS"
node server/granter.mjs
```

3) In `.env` (or Vercel env) set:
```
VITE_CHAIN_ID=10143
VITE_RPC_URL=https://testnet-rpc.monad.xyz
VITE_RPC_WSS=wss://testnet-rpc.monad.xyz/ws
VITE_LIVES_REST=http://localhost:8787
VITE_COLLECTION_ADDRESS=0xYourCollection
VITE_VAULT_ADDRESS=0xYourVault
```

This setup grants +1 life when an ERC-721 `Transfer` into the Vault is seen on the chain, and the frontend fetches the current life count from the granter REST API.
