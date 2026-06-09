import http from "node:http";
import { CompletedProtoWallet, PrivateKey } from "@bsv/sdk";

class LoopbackWallet extends CompletedProtoWallet {
  constructor(rootKey) {
    super(rootKey);
    this.internalizedActions = [];
    this.createdActions = [];
  }

  async createAction(args, originator) {
    this.createdActions.push({ args, originator });
    return { tx: [0xbe, 0xef] };
  }

  async internalizeAction(args, originator) {
    this.internalizedActions.push({ args, originator });
    return { accepted: true };
  }

  async listCertificates() {
    return { totalCertificates: 0, certificates: [] };
  }
}

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
  "verifySignature",
  "createHmac",
  "verifyHmac",
  "createAction",
  "internalizeAction",
  "listCertificates"
]);

export async function startLoopbackWallet({ network = "mainnet" } = {}) {
  const wallet = new LoopbackWallet(new PrivateKey(1));
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.headers.origin) {
        json(res, 400, { message: "Origin header is required" });
        return;
      }

      const method = (req.url || "/").replace(/^\//, "");
      if (method === "getVersion") return json(res, 200, { version: "wallet-loopback-1.0.0" });
      if (method === "isAuthenticated") return json(res, 200, { authenticated: true });
      if (method === "getNetwork") return json(res, 200, { network });

      if (!walletMethods.has(method)) {
        json(res, 404, { message: "Unknown wallet method" });
        return;
      }

      const args = await readJson(req);
      const result = await wallet[method](args, originator(req.headers));
      json(res, 200, result);
    } catch (error) {
      json(res, 400, {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("loopback wallet did not bind a TCP port");
  }

  return {
    wallet,
    server,
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
