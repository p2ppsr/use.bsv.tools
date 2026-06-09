import crypto from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { runPreflight } from "./bin/wallet-preflight.mjs";

const root = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT || 7171);
const memories = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body, null, 2));
}

async function bodyJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function receiptFor(input) {
  const receipt = crypto
    .createHash("sha256")
    .update(`${input}:${Date.now()}:use-bsv-tools`)
    .digest("hex")
    .slice(0, 24);
  return `mock-bsv-receipt-${receipt}`;
}

async function api(req, res) {
  if (req.url === "/api/wallet/health" && req.method === "GET") {
    const result = await runPreflight({ json: true });
    return json(res, 200, result);
  }

  if (req.url === "/api/paid-summary" && req.method === "POST") {
    const request = await bodyJson(req);
    if (req.headers["x-bsv-mock-payment"] !== "paid") {
      return json(
        res,
        402,
        {
          error: "payment_required",
          priceSats: 3,
          mode: "no-spend mock",
          next: "Retry with x-bsv-mock-payment: paid. In mainnet mode this is where AuthFetch or payment middleware pays the invoice."
        },
        { "x-bsv-price-sats": "3" }
      );
    }

    return json(res, 200, {
      result: `Paid result for "${request.prompt || "hello BSV"}"`,
      receipt: receiptFor(request.prompt || "hello BSV"),
      paid: true,
      mode: "no-spend mock"
    });
  }

  if (req.url === "/api/memory" && req.method === "GET") {
    return json(res, 200, { records: [...memories.values()].map(({ ciphertext, ...record }) => record) });
  }

  if (req.url === "/api/memory" && req.method === "POST") {
    const request = await bodyJson(req);
    const id = crypto.randomUUID();
    const record = {
      id,
      label: request.label || "Private note",
      ciphertext: request.ciphertext,
      iv: request.iv,
      createdAt: new Date().toISOString()
    };
    memories.set(id, record);
    return json(res, 201, record);
  }

  if (req.url?.startsWith("/api/memory/") && req.method === "DELETE") {
    const id = req.url.split("/").pop();
    memories.delete(id);
    return json(res, 200, { deleted: id });
  }

  return false;
}

async function staticFile(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) {
      const handled = await api(req, res);
      if (handled !== false) return;
    }
    await staticFile(req, res);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", async () => {
  const packageInfo = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`${packageInfo.name} running at http://127.0.0.1:${actualPort}`);
});
