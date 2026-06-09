const enc = new TextEncoder();
const dec = new TextDecoder();
const memoryKey = await crypto.subtle.importKey(
  "raw",
  await crypto.subtle.digest("SHA-256", enc.encode("use-bsv-tools-starter-no-spend-key")),
  "AES-GCM",
  false,
  ["encrypt", "decrypt"]
);

function $(id) {
  return document.getElementById(id);
}

function show(id, value) {
  $(id).textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptText(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, memoryKey, enc.encode(text));
  return { iv: b64(iv), ciphertext: b64(ciphertext) };
}

async function decryptText(record) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(record.iv) },
    memoryKey,
    fromB64(record.ciphertext)
  );
  return dec.decode(plaintext);
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

$("runPreflight").addEventListener("click", async () => {
  show("preflightOutput", "Checking local wallet ports...");
  const response = await fetch("/api/wallet/health");
  show("preflightOutput", await response.json());
});

$("runPaid").addEventListener("click", async () => {
  show("paidOutput", "Requesting paid endpoint...");
  const prompt = $("paidPrompt").value;
  const first = await postJson("/api/paid-summary", { prompt });
  if (first.response.status !== 402) {
    show("paidOutput", first.body);
    return;
  }
  const paid = await postJson("/api/paid-summary", { prompt }, { "x-bsv-mock-payment": "paid" });
  show("paidOutput", { challenge: first.body, paidResult: paid.body });
});

$("saveMemory").addEventListener("click", async () => {
  show("memoryOutput", "Encrypting locally...");
  const encrypted = await encryptText($("memoryText").value);
  const saved = await postJson("/api/memory", {
    label: "Starter private memory",
    ...encrypted
  });
  const list = await fetch("/api/memory").then((res) => res.json());
  const decrypted = await decryptText(saved.body);
  show("memoryOutput", {
    savedRecord: saved.body,
    serverList: list.records,
    decryptedLocally: decrypted
  });
});

$("deleteMemory").addEventListener("click", async () => {
  const list = await fetch("/api/memory").then((res) => res.json());
  for (const record of list.records) {
    await fetch(`/api/memory/${record.id}`, { method: "DELETE" });
  }
  show("memoryOutput", { deleted: list.records.length, records: [] });
});

$("makeProof").addEventListener("click", async () => {
  show("proofOutput", "Hashing and signing proof metadata...");
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const proof = {
    title: $("proofTitle").value,
    body: $("proofBody").value,
    createdAt: new Date().toISOString(),
    mode: "no-spend mock"
  };
  const proofBytes = enc.encode(JSON.stringify(proof));
  const artifactHash = b64(await crypto.subtle.digest("SHA-256", proofBytes));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, proofBytes);
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.publicKey,
    signature,
    proofBytes
  );
  show("proofOutput", {
    proof,
    artifactHash,
    signature: b64(signature),
    verified
  });
});
