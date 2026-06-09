import assert from "node:assert/strict";
import { runPreflight } from "../bin/wallet-preflight.mjs";
import { startLoopbackWallet } from "./helpers/loopback-wallet.mjs";

const loopback = await startLoopbackWallet();

try {
  const missingOrigin = await fetch(`${loopback.baseUrl}/getVersion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  assert.equal(missingOrigin.status, 400);

  const result = await runPreflight({
    json: true,
    origin: "http://127.0.0.1:7171",
    endpoints: [
      {
        label: "BRC-100 loopback wallet",
        origin: loopback.baseUrl,
        port: loopback.port
      }
    ],
    timeoutMs: 1000,
    identityTimeoutMs: 1000
  });

  assert.equal(result.portOpen, true);
  assert.equal(result.apiCallable, true);
  assert.equal(result.authenticated, true);
  assert.equal(result.network, "mainnet");
  assert.equal(result.realWalletLoopReady, true);
  assert.equal(result.identityKeyReady, true);
  assert.equal(result.mainnetReady, true);
  assert.equal(result.starterMode, "real wallet ready");
  assert.deepEqual(result.blockers, []);

  console.log("wallet loopback test passed");
} finally {
  await loopback.close();
}
