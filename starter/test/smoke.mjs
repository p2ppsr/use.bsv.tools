import { spawn } from "node:child_process";
import assert from "node:assert/strict";

let baseUrl = "";
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 5000);
    server.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        baseUrl = `http://127.0.0.1:${match[1]}`;
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });

  const root = await fetch(`${baseUrl}/`);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /Run a BSV app that can prove your wallet is actually usable/);

  const walletHealth = await fetch(`${baseUrl}/api/wallet/health`);
  assert.equal(walletHealth.status, 200);
  const walletHealthBody = await walletHealth.json();
  assert.equal(walletHealthBody.canRunStarter, true);
  assert.equal(walletHealthBody.starterMode, "no-spend mock");
  assert.equal(typeof walletHealthBody.mainnetReady, "boolean");

  const challenge = await fetch(`${baseUrl}/api/paid-summary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "test" })
  });
  assert.equal(challenge.status, 402);

  const paid = await fetch(`${baseUrl}/api/paid-summary`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bsv-mock-payment": "paid" },
    body: JSON.stringify({ prompt: "test" })
  });
  assert.equal(paid.status, 200);
  const paidBody = await paid.json();
  assert.equal(paidBody.paid, true);
  assert.match(paidBody.receipt, /^mock-bsv-receipt-/);

  const saved = await fetch(`${baseUrl}/api/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "test", ciphertext: "abc", iv: "123" })
  });
  assert.equal(saved.status, 201);

  const list = await fetch(`${baseUrl}/api/memory`);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).records.length, 1);

  console.log("starter smoke test passed");
} finally {
  server.kill("SIGTERM");
}
