#!/usr/bin/env node
import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const endpoints = [
  {
    label: "BRC-100 HTTP wallet",
    origin: "http://localhost:3321",
    port: 3321
  },
  {
    label: "BRC-100 HTTPS wallet",
    origin: "https://localhost:2121",
    port: 2121,
    insecureLocalTls: true
  }
];

const calls = [
  { name: "getVersion", path: "/getVersion" },
  { name: "isAuthenticated", path: "/isAuthenticated" },
  { name: "getNetwork", path: "/getNetwork" }
];

function requestJson(url, { method = "GET", insecureLocalTls = false } = {}) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(
      url,
      {
        method,
        rejectUnauthorized: !insecureLocalTls,
        timeout: 2200,
        headers: {
          "content-type": "application/json"
        }
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch {}
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: parsed });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
    req.end(method === "POST" ? "{}" : undefined);
  });
}

async function callWallet(endpoint, call) {
  const getResult = await requestJson(`${endpoint.origin}${call.path}`, {
    insecureLocalTls: endpoint.insecureLocalTls
  });

  if (getResult.ok) return { ...getResult, method: "GET" };

  const postResult = await requestJson(`${endpoint.origin}${call.path}`, {
    method: "POST",
    insecureLocalTls: endpoint.insecureLocalTls
  });

  return { ...postResult, method: "POST" };
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

function valueSummary(value) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    if ("version" in value) return value.version;
    if ("authenticated" in value) return String(value.authenticated);
    if ("isAuthenticated" in value) return String(value.isAuthenticated);
    if ("network" in value) return value.network;
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

export async function runPreflight({ json = false, strict = false } = {}) {
  const results = [];

  for (const endpoint of endpoints) {
    const owner = await portOwner(endpoint.port);
    const checks = [];
    for (const call of calls) {
      checks.push({ name: call.name, ...(await callWallet(endpoint, call)) });
    }
    results.push({ ...endpoint, portOpen: owner.listening, owner: owner.owner, checks });
  }

  const portOpen = results.some((endpoint) => endpoint.portOpen);
  const apiCallable = results.some((endpoint) => endpoint.checks.some((check) => check.ok));
  const authenticated = results.some((endpoint) =>
    endpoint.checks.some((check) => check.name === "isAuthenticated" && check.ok && /true/i.test(valueSummary(check.body)))
  );
  const network = results
    .flatMap((endpoint) => endpoint.checks)
    .find((check) => check.name === "getNetwork" && check.ok)?.body;

  const summary = {
    ok: true,
    portOpen,
    apiCallable,
    authenticated,
    network: network ? valueSummary(network) : "unknown",
    starterMode: "no-spend mock",
    canRunStarter: true,
    mainnetReady: apiCallable && authenticated,
    endpoints: results
  };

  if (json) return summary;

  console.log("BSV wallet preflight");
  console.log("====================");
  for (const endpoint of results) {
    console.log(`\n${endpoint.label}`);
    console.log(`  ${endpoint.origin}`);
    console.log(`  port open: ${endpoint.portOpen}`);
    console.log(`  owner: ${endpoint.owner}`);
    for (const check of endpoint.checks) {
      const icon = check.ok ? "ok" : "fail";
      const detail = check.ok ? valueSummary(check.body) : check.error || `HTTP ${check.status}`;
      console.log(`  ${icon} ${check.name} (${check.method || "GET"}): ${detail}`);
    }
  }

  console.log("\nResult");
  console.log(`  wallet port open: ${summary.portOpen}`);
  console.log(`  direct API probe passed: ${summary.apiCallable}`);
  console.log(`  authenticated: ${summary.authenticated}`);
  console.log(`  network: ${summary.network}`);
  console.log(`  starter mode: ${summary.starterMode}`);
  console.log(`  mainnet-ready wallet calls: ${summary.mainnetReady}`);
  console.log("\nThe starter can run in no-spend mock mode even when direct wallet API probes fail.");
  console.log("Use --strict when a script should fail unless the wallet API is directly callable and authenticated.");
  console.log("\nIf both BSV Desktop and Metanet Client are installed, only one app can own the same local wallet port at a time.");
  console.log("Quit the extra wallet app if port 3321 is already bound by the wrong process.");

  if (strict && !summary.mainnetReady) process.exitCode = 1;
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runPreflight({ json: process.argv.includes("--json"), strict: process.argv.includes("--strict") }).then((summary) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
  });
}
