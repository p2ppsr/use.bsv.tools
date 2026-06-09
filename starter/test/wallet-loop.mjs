import assert from "node:assert/strict";
import http from "node:http";
import { PrivateKey, ProtoWallet } from "@bsv/sdk";
import { runPreflight } from "../bin/wallet-preflight.mjs";

const wallet = new ProtoWallet(new PrivateKey(1));

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function originator(headers) {
  const rawOrigin = headers.origin;
  if (!rawOrigin) return "";
  return new URL(rawOrigin).host;
}

const walletMethods = new Set([
  "getPublicKey",
  "encrypt",
  "decrypt",
  "createSignature",
  "verifySignature"
]);

const server = http.createServer(async (req, res) => {
  try {
    if (!req.headers.origin) {
      json(res, 400, { message: "Origin header is required" });
      return;
    }

    const method = (req.url || "/").replace(/^\//, "");
    if (method === "getVersion") return json(res, 200, { version: "wallet-loopback-1.0.0" });
    if (method === "isAuthenticated") return json(res, 200, { authenticated: true });
    if (method === "getNetwork") return json(res, 200, { network: "mainnet" });

    if (!walletMethods.has(method)) {
      json(res, 404, { message: "Unknown wallet method" });
      return;
    }

    const args = await readJson(req);
    const result = await wallet[method](args, originator(req.headers));
    json(res, 200, result);
  } catch (error) {
    json(res, 400, { message: error instanceof Error ? error.message : String(error) });
  }
});

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const missingOrigin = await fetch(`${baseUrl}/getVersion`, {
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
        origin: baseUrl,
        port: address.port
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
  assert.deepEqual(result.blockers, []);

  console.log("wallet loopback test passed");
} finally {
  server.close();
}
