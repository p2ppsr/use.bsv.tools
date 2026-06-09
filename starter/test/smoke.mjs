import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { startLoopbackWallet } from "./helpers/loopback-wallet.mjs";

let baseUrl = "";
const loopback = await startLoopbackWallet();
let serverOutput = "";
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: "0",
    BSV_TOOLS_ORIGIN: "http://127.0.0.1:7171",
    BSV_TOOLS_WALLET_URL: loopback.baseUrl,
    BSV_TOOLS_WALLET_HTTP_URL: loopback.baseUrl
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 5000);
    server.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      serverOutput += text;
      const match = text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        baseUrl = `http://127.0.0.1:${match[1]}`;
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    server.on("exit", (code) => reject(new Error(`server exited with ${code}\n${serverOutput}`)));
  });

  const root = await fetch(`${baseUrl}/`);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /Run a BSV app that uses your wallet for real/);

  const walletHealth = await fetch(`${baseUrl}/api/wallet/health`);
  assert.equal(walletHealth.status, 200);
  const walletHealthBody = await walletHealth.json();
  assert.equal(walletHealthBody.canRunStarter, true);
  assert.equal(walletHealthBody.starterMode, "real wallet ready");
  assert.equal(walletHealthBody.mainnetReady, true);

  const paid = await fetch(`${baseUrl}/api/paid-summary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "test" })
  });
  assert.equal(paid.status, 200);
  const paidBody = await paid.json();
  assert.equal(paidBody.paid, true);
  assert.equal(paidBody.satoshisPaid, 3);
  assert.match(paidBody.receipt, /^bsv-payment-/);
  assert.match(paidBody.middleware, /payment-express-middleware/);

  const saved = await fetch(`${baseUrl}/api/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "test", text: "wallet-backed private memory" })
  });
  assert.equal(saved.status, 201);
  const savedBody = await saved.json();
  assert.equal(savedBody.decryptedWithWallet, "wallet-backed private memory");

  const list = await fetch(`${baseUrl}/api/memory`);
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.records.length, 1);

  const proof = await fetch(`${baseUrl}/api/proof`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "test", body: "wallet-backed proof" })
  });
  assert.equal(proof.status, 200);
  const proofBody = await proof.json();
  assert.equal(proofBody.verified, true);
  assert.match(proofBody.signature, /^[A-Za-z0-9+/]+={0,2}$/);

  console.log("starter smoke test passed");
} finally {
  server.kill("SIGTERM");
  await loopback.close();
}
