function $(id) {
  return document.getElementById(id);
}

function show(id, value) {
  $(id).textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, body: await readJson(response) };
}

$("runPreflight").addEventListener("click", async () => {
  show("preflightOutput", "Checking local wallet ports and real BRC-100 crypto loop...");
  const response = await fetch("/api/wallet/health");
  show("preflightOutput", await readJson(response));
});

$("runPaid").addEventListener("click", async () => {
  show("paidOutput", "Calling AuthFetch against the paid route. If the wallet needs permission or a payment review, answer the wallet prompt.");
  const prompt = $("paidPrompt").value;
  const paid = await postJson("/api/paid-summary", { prompt });
  show("paidOutput", {
    status: paid.response.status,
    ...paid.body
  });
});

$("saveMemory").addEventListener("click", async () => {
  show("memoryOutput", "Asking the wallet to encrypt this note. If prompted, grant the starter access.");
  const saved = await postJson("/api/memory", {
    label: "Starter private memory",
    text: $("memoryText").value
  });
  const list = await fetch("/api/memory").then(readJson);
  show("memoryOutput", {
    status: saved.response.status,
    saved: saved.body,
    serverList: list.records
  });
});

$("deleteMemory").addEventListener("click", async () => {
  const list = await fetch("/api/memory").then(readJson);
  for (const record of list.records) {
    await fetch(`/api/memory/${record.id}`, { method: "DELETE" });
  }
  show("memoryOutput", { deleted: list.records.length, records: [] });
});

$("makeProof").addEventListener("click", async () => {
  show("proofOutput", "Asking the wallet to sign proof metadata. If prompted, grant signature access.");
  const proof = await postJson("/api/proof", {
    title: $("proofTitle").value,
    body: $("proofBody").value
  });
  show("proofOutput", {
    status: proof.response.status,
    ...proof.body
  });
});
