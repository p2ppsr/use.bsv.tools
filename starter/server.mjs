import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import { createAuthMiddleware } from "@bsv/auth-express-middleware";
import { createPaymentMiddleware } from "@bsv/payment-express-middleware";
import { AuthFetch, HTTPWalletJSON } from "@bsv/sdk";
import { runPreflight } from "./bin/wallet-preflight.mjs";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT || 7171);
const walletBaseUrl = process.env.BSV_TOOLS_WALLET_URL || process.env.BSV_TOOLS_WALLET_HTTP_URL || "http://localhost:3321";
const configuredOrigin = process.env.BSV_TOOLS_ORIGIN || `http://127.0.0.1:${port || 7171}`;
const paidSummaryPriceSats = Number(process.env.BSV_TOOLS_PAID_SUMMARY_SATS || 3);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const memories = new Map();
let serverOrigin = configuredOrigin;

const memoryProtocolID = [2, "use bsv tools private memory"];
const proofProtocolID = [2, "use bsv tools creation proof"];

function wallet() {
  return new HTTPWalletJSON(configuredOrigin, walletBaseUrl);
}

function bytes(value) {
  return [...textEncoder.encode(String(value ?? ""))];
}

function fromBytes(value) {
  return textDecoder.decode(new Uint8Array(value));
}

function base64(value) {
  return Buffer.from(value).toString("base64");
}

function jsonError(error, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    error: message,
    status,
    walletBaseUrl,
    origin: configuredOrigin
  };
}

function publicMemoryRecord(record) {
  return {
    id: record.id,
    label: record.label,
    keyID: record.keyID,
    createdAt: record.createdAt,
    encryptedBytes: record.ciphertext.length,
    ciphertextPreview: `${base64(record.ciphertext).slice(0, 28)}...`
  };
}

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function routeWalletRequest(fn) {
  return asyncHandler(async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      const body = jsonError(error, 503);
      res.status(503).json({
        ...body,
        next: "Start an authenticated BRC-100 wallet on localhost:3321, then retry. If the wallet prompts for permission, answer the prompt and the request will continue."
      });
    }
  });
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(root));

const protectedWallet = wallet();
const authMiddleware = createAuthMiddleware({
  allowUnauthenticated: true,
  wallet: protectedWallet
});

const paymentMiddleware = createPaymentMiddleware({
  wallet: protectedWallet,
  calculateRequestPrice: async () => paidSummaryPriceSats
});

app.use(authMiddleware);

app.get("/api/wallet/health", asyncHandler(async (_req, res) => {
  const result = await runPreflight({ json: true });
  res.json({
    ...result,
    starterMode: result.mainnetReady ? "real wallet ready" : "real wallet required",
    canRunStarter: true,
    walletBaseUrl,
    origin: configuredOrigin
  });
}));

app.post("/api/paid-summary", routeWalletRequest(async (req, res) => {
  const clientWallet = wallet();
  const authFetch = new AuthFetch(clientWallet, undefined, undefined, configuredOrigin);
  const response = await authFetch.fetch(`${serverOrigin}/api/internal/paid-summary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: req.body?.prompt || "hello BSV" }),
    paymentRetryAttempts: 1
  });
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
  res.status(response.status).json({
    ...body,
    paid: response.ok,
    satoshisPaid: Number(response.headers.get("x-bsv-payment-satoshis-paid") || 0),
    middleware: "@bsv/auth-express-middleware + @bsv/payment-express-middleware",
    walletBaseUrl
  });
}));

app.post(
  "/api/internal/paid-summary",
  (req, res, next) => {
    if (!req.auth?.identityKey || req.auth.identityKey === "unknown") {
      res.status(401).json({ error: "wallet_auth_required" });
      return;
    }
    next();
  },
  paymentMiddleware,
  asyncHandler(async (req, res) => {
    const prompt = req.body?.prompt || "hello BSV";
    const digest = crypto
      .createHash("sha256")
      .update(`${prompt}:${req.auth.identityKey}:${req.payment.satoshisPaid}`)
      .digest("hex")
      .slice(0, 24);

    res.json({
      result: `Paid result for "${prompt}"`,
      receipt: `bsv-payment-${digest}`,
      paid: true,
      payerIdentityKey: req.auth.identityKey,
      satoshisPaid: req.payment.satoshisPaid,
      mode: "real BSV middleware"
    });
  })
);

app.get("/api/memory", (_req, res) => {
  res.json({ records: [...memories.values()].map(publicMemoryRecord) });
});

app.post("/api/memory", routeWalletRequest(async (req, res) => {
  const id = crypto.randomUUID();
  const keyID = `starter-memory-${id}`;
  const plaintext = bytes(req.body?.text || "");
  const label = req.body?.label || "Private note";
  const clientWallet = wallet();
  const encrypted = await clientWallet.encrypt({
    protocolID: memoryProtocolID,
    keyID,
    counterparty: "self",
    plaintext,
    seekPermission: true
  });
  const decrypted = await clientWallet.decrypt({
    protocolID: memoryProtocolID,
    keyID,
    counterparty: "self",
    ciphertext: encrypted.ciphertext,
    seekPermission: true
  });

  const record = {
    id,
    label,
    keyID,
    ciphertext: encrypted.ciphertext,
    createdAt: new Date().toISOString()
  };
  memories.set(id, record);

  res.status(201).json({
    record: publicMemoryRecord(record),
    decryptedWithWallet: fromBytes(decrypted.plaintext),
    mode: "wallet encrypt/decrypt"
  });
}));

app.post("/api/memory/:id/reveal", routeWalletRequest(async (req, res) => {
  const record = memories.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: "memory_not_found" });
    return;
  }

  const decrypted = await wallet().decrypt({
    protocolID: memoryProtocolID,
    keyID: record.keyID,
    counterparty: "self",
    ciphertext: record.ciphertext,
    seekPermission: true
  });

  res.json({
    record: publicMemoryRecord(record),
    decryptedWithWallet: fromBytes(decrypted.plaintext)
  });
}));

app.delete("/api/memory/:id", (req, res) => {
  memories.delete(req.params.id);
  res.json({ deleted: req.params.id });
});

app.post("/api/proof", routeWalletRequest(async (req, res) => {
  const proof = {
    title: req.body?.title || "Untitled artifact",
    body: req.body?.body || "",
    createdAt: new Date().toISOString(),
    mode: "wallet-backed proof"
  };
  const serialized = JSON.stringify(proof);
  const data = bytes(serialized);
  const keyID = `creation-proof-${crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 16)}`;
  const clientWallet = wallet();
  const signature = await clientWallet.createSignature({
    protocolID: proofProtocolID,
    keyID,
    counterparty: "self",
    data,
    seekPermission: true
  });
  const verified = await clientWallet.verifySignature({
    protocolID: proofProtocolID,
    keyID,
    counterparty: "self",
    data,
    signature: signature.signature,
    forSelf: true,
    seekPermission: true
  });
  const publicKey = await clientWallet.getPublicKey({
    protocolID: proofProtocolID,
    keyID,
    counterparty: "self",
    seekPermission: true
  });

  res.json({
    proof,
    keyID,
    artifactHash: base64(crypto.createHash("sha256").update(serialized).digest()),
    signature: base64(signature.signature),
    publicKey: publicKey.publicKey,
    verified: verified.valid,
    mode: "wallet createSignature/verifySignature"
  });
}));

app.get("/", (_req, res) => {
  res.sendFile("index.html", { root });
});

app.use((err, _req, res, _next) => {
  res.status(500).json(jsonError(err));
});

const server = app.listen(port, "127.0.0.1", async () => {
  const packageInfo = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  serverOrigin = process.env.BSV_TOOLS_SERVER_ORIGIN || `http://127.0.0.1:${actualPort}`;
  console.log(`${packageInfo.name} running at ${serverOrigin}`);
});
