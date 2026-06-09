#!/usr/bin/env node
import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const defaultClientOrigin = process.env.BSV_TOOLS_ORIGIN || "http://127.0.0.1:7171";
export const defaultTimeoutMs = Number(process.env.BSV_TOOLS_WALLET_TIMEOUT_MS || 3500);
export const defaultIdentityTimeoutMs = Number(process.env.BSV_TOOLS_IDENTITY_TIMEOUT_MS || 2200);

export const defaultEndpoints = [
  {
    label: "BRC-100 HTTP wallet",
    origin: process.env.BSV_TOOLS_WALLET_HTTP_URL || "http://localhost:3321",
    port: Number(new URL(process.env.BSV_TOOLS_WALLET_HTTP_URL || "http://localhost:3321").port || 3321)
  },
  {
    label: "BRC-100 HTTPS wallet",
    origin: process.env.BSV_TOOLS_WALLET_HTTPS_URL || "https://localhost:2121",
    port: Number(new URL(process.env.BSV_TOOLS_WALLET_HTTPS_URL || "https://localhost:2121").port || 2121),
    insecureLocalTls: true
  }
];

const statusCalls = [
  { name: "getVersion", path: "/getVersion" },
  { name: "isAuthenticated", path: "/isAuthenticated" },
  { name: "getNetwork", path: "/getNetwork" }
];

const loopProtocolID = [0, "use bsv tools qa"];

function originatorHeader(origin) {
  const parsed = new URL(origin);
  return parsed.host;
}

function pathUrl(endpoint, path) {
  return new URL(path, endpoint.origin).toString();
}

function requestJson(
  url,
  {
    method = "POST",
    body = {},
    insecureLocalTls = false,
    origin = defaultClientOrigin,
    timeoutMs = defaultTimeoutMs
  } = {}
) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const startedAt = Date.now();
    const req = client.request(
      url,
      {
        method,
        rejectUnauthorized: !insecureLocalTls,
        timeout: timeoutMs,
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "Origin": origin,
          "Originator": originatorHeader(origin)
        }
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let parsed = responseBody;
          try {
            parsed = JSON.parse(responseBody);
          } catch {}
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            elapsedMs: Date.now() - startedAt,
            body: parsed
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    req.on("error", (error) => {
      resolve({ ok: false, elapsedMs: Date.now() - startedAt, error: error.message });
    });
    req.end(method === "POST" ? JSON.stringify(body ?? {}) : undefined);
  });
}

async function callWallet(endpoint, call, options = {}) {
  const methods = call.methods || ["POST", "GET"];
  let result;

  for (const method of methods) {
    result = await requestJson(pathUrl(endpoint, call.path), {
      method,
      body: call.body,
      insecureLocalTls: endpoint.insecureLocalTls,
      ...options
    });
    if (result.ok) return { name: call.name, method, ...result };
  }

  return { name: call.name, method: methods[methods.length - 1], ...result };
}

async function portOwner(port) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]);
    const lines = stdout.trim().split("\n").slice(1);
    return {
      listening: lines.length > 0,
      owner: lines.map((line) => line.replace(/\s+/g, " ")).join(" | ") || "no listener"
    };
  } catch {
    return {
      listening: false,
      owner: "no listener or lsof unavailable"
    };
  }
}

function asBytes(value) {
  return [...textEncoder.encode(value)];
}

function valueSummary(value) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} bytes]`;
  if (value && typeof value === "object") {
    if ("version" in value) return value.version;
    if ("authenticated" in value) return String(value.authenticated);
    if ("isAuthenticated" in value) return String(value.isAuthenticated);
    if ("network" in value) return value.network;
    if ("publicKey" in value) return `${String(value.publicKey).slice(0, 18)}...`;
    if ("ciphertext" in value) return `ciphertext:${value.ciphertext?.length ?? 0} bytes`;
    if ("plaintext" in value) return textDecoder.decode(new Uint8Array(value.plaintext));
    if ("signature" in value) return `signature:${value.signature?.length ?? 0} bytes`;
    if ("valid" in value) return String(value.valid);
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

function check(name, result, passed, detail = valueSummary(result.body)) {
  return {
    name,
    ok: Boolean(result.ok && passed),
    status: result.status,
    elapsedMs: result.elapsedMs,
    detail: result.ok ? detail : result.error || valueSummary(result.body) || `HTTP ${result.status}`
  };
}

function skipped(name, reason) {
  return { name, ok: false, skipped: true, detail: reason };
}

async function runRealWalletLoop(endpoint, { origin, timeoutMs, identityTimeoutMs }) {
  const checks = [];
  const plaintext = asBytes("use.bsv.tools wallet loop");

  const publicKey = await callWallet(
    endpoint,
    {
      name: "derivedPublicKey",
      path: "/getPublicKey",
      body: {
        protocolID: loopProtocolID,
        keyID: "builder-loop",
        counterparty: "self",
        seekPermission: false
      },
      methods: ["POST"]
    },
    { origin, timeoutMs }
  );
  checks.push(check("derivedPublicKey", publicKey, typeof publicKey.body?.publicKey === "string"));

  let encrypted;
  if (checks.at(-1).ok) {
    encrypted = await callWallet(
      endpoint,
      {
        name: "encrypt",
        path: "/encrypt",
        body: {
          protocolID: loopProtocolID,
          keyID: "builder-loop",
          counterparty: "self",
          plaintext,
          seekPermission: false
        },
        methods: ["POST"]
      },
      { origin, timeoutMs }
    );
    checks.push(check("encrypt", encrypted, Array.isArray(encrypted.body?.ciphertext)));
  } else {
    checks.push(skipped("encrypt", "derived public key failed"));
  }

  if (encrypted?.body?.ciphertext) {
    const decrypted = await callWallet(
      endpoint,
      {
        name: "decrypt",
        path: "/decrypt",
        body: {
          protocolID: loopProtocolID,
          keyID: "builder-loop",
          counterparty: "self",
          ciphertext: encrypted.body.ciphertext,
          seekPermission: false
        },
        methods: ["POST"]
      },
      { origin, timeoutMs }
    );
    const roundTrip = Array.isArray(decrypted.body?.plaintext)
      ? textDecoder.decode(new Uint8Array(decrypted.body.plaintext))
      : "";
    checks.push(check("decrypt", decrypted, roundTrip === "use.bsv.tools wallet loop", roundTrip || valueSummary(decrypted.body)));
  } else {
    checks.push(skipped("decrypt", "encrypt failed"));
  }

  const signature = await callWallet(
    endpoint,
    {
      name: "createSignature",
      path: "/createSignature",
      body: {
        protocolID: loopProtocolID,
        keyID: "proof-loop",
        counterparty: "self",
        data: plaintext,
        seekPermission: false
      },
      methods: ["POST"]
    },
    { origin, timeoutMs }
  );
  checks.push(check("createSignature", signature, Array.isArray(signature.body?.signature)));

  if (signature.body?.signature) {
    const verified = await callWallet(
      endpoint,
      {
        name: "verifySignature",
        path: "/verifySignature",
        body: {
          protocolID: loopProtocolID,
          keyID: "proof-loop",
          counterparty: "self",
          data: plaintext,
          signature: signature.body.signature,
          forSelf: true,
          seekPermission: false
        },
        methods: ["POST"]
      },
      { origin, timeoutMs }
    );
    checks.push(check("verifySignature", verified, verified.body?.valid === true));
  } else {
    checks.push(skipped("verifySignature", "signature creation failed"));
  }

  const identityKey = await callWallet(
    endpoint,
    {
      name: "identityKey",
      path: "/getPublicKey",
      body: {
        identityKey: true,
        seekPermission: false
      },
      methods: ["POST"]
    },
    { origin, timeoutMs: identityTimeoutMs }
  );
  const identityCheck = check("identityKey", identityKey, typeof identityKey.body?.publicKey === "string");

  return {
    ready: checks.every((item) => item.ok),
    identityKeyReady: identityCheck.ok,
    checks,
    identityKey: identityCheck
  };
}

function booleanStatus(checks, name) {
  return checks.some((check) => check.name === name && check.ok && /true/i.test(valueSummary(check.body)));
}

function resultNetwork(checks) {
  return checks.find((check) => check.name === "getNetwork" && check.ok)?.body;
}

function collectBlockers({ portOpen, apiCallable, authenticated, realWalletLoopReady, identityKeyReady, network }) {
  const blockers = [];
  const warnings = [];

  if (!portOpen) blockers.push("No local BRC-100 wallet listener was found on the checked ports.");
  if (!apiCallable) blockers.push("Wallet status API is not callable from this origin.");
  if (apiCallable && !authenticated) blockers.push("Wallet API is callable, but the wallet reports unauthenticated.");
  if (authenticated && network !== "mainnet") warnings.push(`Wallet network is ${network}; mainnet tutorials need mainnet.`);
  if (authenticated && !realWalletLoopReady) blockers.push("Real wallet crypto loop did not complete.");
  if (authenticated && realWalletLoopReady && !identityKeyReady) {
    blockers.push("Identity-key revelation did not return a bounded success; production auth flows may hang or fail.");
  }

  return { blockers, warnings };
}

export async function runPreflight({
  json = false,
  strict = false,
  requireIdentity = false,
  origin = defaultClientOrigin,
  endpoints = defaultEndpoints,
  timeoutMs = defaultTimeoutMs,
  identityTimeoutMs = defaultIdentityTimeoutMs
} = {}) {
  const results = [];

  for (const endpoint of endpoints) {
    const owner = await portOwner(endpoint.port);
    const checks = [];
    for (const call of statusCalls) {
      checks.push(await callWallet(endpoint, call, { origin, timeoutMs }));
    }

    const endpointAuthenticated = booleanStatus(checks, "isAuthenticated");
    const statusReady = checks.every((item) => item.ok);
    const realLoop = statusReady && endpointAuthenticated
      ? await runRealWalletLoop(endpoint, { origin, timeoutMs, identityTimeoutMs })
      : {
          ready: false,
          identityKeyReady: false,
          checks: [skipped("walletLoop", statusReady ? "wallet is not authenticated" : "status checks failed")],
          identityKey: skipped("identityKey", statusReady ? "wallet is not authenticated" : "status checks failed")
        };

    results.push({ ...endpoint, portOpen: owner.listening, owner: owner.owner, checks, realLoop });
  }

  const portOpen = results.some((endpoint) => endpoint.portOpen);
  const apiCallable = results.some((endpoint) => endpoint.checks.every((check) => check.ok));
  const authenticated = results.some((endpoint) => booleanStatus(endpoint.checks, "isAuthenticated"));
  const networkValue = results
    .flatMap((endpoint) => endpoint.checks)
    .map((check) => resultNetwork([check]))
    .find(Boolean);
  const network = networkValue ? valueSummary(networkValue) : "unknown";
  const realWalletLoopReady = results.some((endpoint) => endpoint.realLoop.ready);
  const identityKeyReady = results.some((endpoint) => endpoint.realLoop.identityKeyReady);
  const mainnetReady = apiCallable && authenticated && network === "mainnet" && realWalletLoopReady && identityKeyReady;
  const { blockers, warnings } = collectBlockers({
    portOpen,
    apiCallable,
    authenticated,
    realWalletLoopReady,
    identityKeyReady,
    network
  });

  const summary = {
    ok: true,
    checkedOrigin: origin,
    portOpen,
    apiCallable,
    authenticated,
    network,
    realWalletLoopReady,
    identityKeyReady,
    starterMode: mainnetReady ? "real wallet ready" : "no-spend mock",
    canRunStarter: true,
    mainnetReady,
    blockers,
    warnings,
    endpoints: results
  };

  if (json) return summary;

  console.log("BSV wallet preflight");
  console.log("====================");
  console.log(`origin: ${origin}`);
  for (const endpoint of results) {
    console.log(`\n${endpoint.label}`);
    console.log(`  ${endpoint.origin}`);
    console.log(`  port open: ${endpoint.portOpen}`);
    console.log(`  owner: ${endpoint.owner}`);
    for (const check of endpoint.checks) {
      const icon = check.ok ? "ok" : "fail";
      const detail = check.ok ? valueSummary(check.body) : check.error || valueSummary(check.body) || `HTTP ${check.status}`;
      console.log(`  ${icon} ${check.name} (${check.method || "POST"}, ${check.elapsedMs ?? 0}ms): ${detail}`);
    }
    for (const check of endpoint.realLoop.checks) {
      const icon = check.ok ? "ok" : "fail";
      console.log(`  ${icon} ${check.name}: ${check.detail}`);
    }
    const identity = endpoint.realLoop.identityKey;
    console.log(`  ${identity.ok ? "ok" : "fail"} identityKey: ${identity.detail}`);
  }

  console.log("\nResult");
  console.log(`  wallet port open: ${summary.portOpen}`);
  console.log(`  direct API probe passed: ${summary.apiCallable}`);
  console.log(`  authenticated: ${summary.authenticated}`);
  console.log(`  network: ${summary.network}`);
  console.log(`  real wallet loop ready: ${summary.realWalletLoopReady}`);
  console.log(`  identity key ready: ${summary.identityKeyReady}`);
  console.log(`  starter mode: ${summary.starterMode}`);
  console.log(`  mainnet-ready wallet calls: ${summary.mainnetReady}`);
  if (summary.blockers.length > 0) {
    console.log("\nBlockers");
    for (const blocker of summary.blockers) console.log(`  - ${blocker}`);
  }
  if (summary.warnings.length > 0) {
    console.log("\nWarnings");
    for (const warning of summary.warnings) console.log(`  - ${warning}`);
  }
  console.log("\nThe starter can run in no-spend mock mode even when production wallet readiness fails.");
  console.log("Use --strict when CI or a mainnet-upgrade script should fail unless the full real-wallet loop is ready.");
  console.log("Use --require-identity to fail unless identity-key revelation is also ready.");
  console.log("\nIf both BSV Desktop and Metanet Client are installed, only one app can own the same local wallet port at a time.");
  console.log("Quit the extra wallet app if port 3321 is already bound by the wrong process.");

  if ((strict && !summary.mainnetReady) || (requireIdentity && !summary.identityKeyReady)) process.exitCode = 1;
  return summary;
}

function cliValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runPreflight({
    json: process.argv.includes("--json"),
    strict: process.argv.includes("--strict"),
    requireIdentity: process.argv.includes("--require-identity") || process.argv.includes("--strict-identity"),
    origin: cliValue("--origin") || defaultClientOrigin
  }).then((summary) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
  });
}
