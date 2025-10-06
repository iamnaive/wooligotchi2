// server/granter.mjs
// Minimal lives granter: +1 life when ERC-721 Transfer(address,address,uint256)
// has `to == VAULT_ADDRESS` and contract == COLLECTION_ERC721.
// ESM (package "type": "module"). Run: `node server/granter.mjs`
// Env:
//   RPC_URL               - Monad RPC (wss or https). Prefer wss.
//   COLLECTION_ERC721     - ERC-721 contract address
//   VAULT_ADDRESS         - Vault (storage) address
//   LIVES_DB              - JSON path (default ./lives.json)
//   PORT                  - HTTP port (default 8787)

import http from "node:http";
import fs from "node:fs";
import { URL } from "node:url";
import { createPublicClient, webSocket, http as httpTransport, parseAbi, decodeEventLog, getAddress } from "viem";
import { defineChain } from "viem";

const RPC_URL = process.env.RPC_URL || "wss://testnet-rpc.monad.xyz/ws";
const COLLECTION_ERC721 = (process.env.COLLECTION_ERC721 || "").toLowerCase();
const VAULT_ADDRESS = (process.env.VAULT_ADDRESS || "").toLowerCase();
const DB_PATH = process.env.LIVES_DB || "./lives.json";
const PORT = Number(process.env.PORT || 8787);

if (!COLLECTION_ERC721 || !VAULT_ADDRESS) {
  console.error("Set COLLECTION_ERC721 and VAULT_ADDRESS in env.");
  process.exit(1);
}

const chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL.replace("ws", "http").replace("/ws","")], webSocket: [RPC_URL] } },
  testnet: true,
});

const transport = RPC_URL.startsWith("ws") ? webSocket(RPC_URL) : httpTransport(RPC_URL);
const client = createPublicClient({ chain, transport });

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // keccak256("Transfer(address,address,uint256)")
const LIVES_ABI = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)"
]);

let db = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) : {};

function save(){ fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function addLife(addr){
  const key = addr.toLowerCase();
  db[key] = (db[key] || 0) + 1;
  save();
  console.log("[life:+1]", key, "total:", db[key]);
}

// Watch Transfer logs to VAULT
client.watchEvent({
  address: COLLECTION_ERC721,
  abi: LIVES_ABI,
  eventName: "Transfer",
  onLogs: (logs) => {
    for (const log of logs) {
      const to = String(log.args.to).toLowerCase();
      const from = String(log.args.from).toLowerCase();
      if (to === VAULT_ADDRESS) {
        addLife(from);
      }
    }
  },
  onError: (e) => console.error("watchEvent error:", e),
  pollingInterval: transport.type === "http" ? 1500 : undefined,
});

console.log("Granter watching:", { COLLECTION_ERC721, VAULT_ADDRESS, RPC_URL });

// Simple REST for lives
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    if (req.method === "GET" && url.pathname.startsWith("/lives/")) {
      const addr = url.pathname.split("/").pop()?.toLowerCase() || "";
      const lives = db[addr] || 0;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ address: addr, lives }));
    }

    if (req.method === "POST" && url.pathname === "/consume") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      const addr = String(body.address || "").toLowerCase();
      if (!addr) { res.writeHead(400); return res.end("address required"); }
      const lives = db[addr] || 0;
      if (lives <= 0) { res.writeHead(409); return res.end("no lives"); }
      db[addr] = lives - 1; save();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ address: addr, lives: db[addr] }));
    }

    res.writeHead(404); res.end("not found");
  } catch (e) {
    res.writeHead(500); res.end("server error");
  }
});

server.listen(PORT, () => {
  console.log("Lives REST listening on http://localhost:" + PORT);
});
