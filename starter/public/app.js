function $(id) {
  return document.getElementById(id);
}

function show(id, value) {
  $(id).textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setSummary(id, message, state = "idle") {
  const element = $(id);
  element.textContent = message;
  element.dataset.state = state;
}

function setWin(id, title, detail, state = "idle") {
  const element = $(id);
  element.dataset.state = state;
  element.querySelector("strong").textContent = title;
  element.querySelector("p").textContent = detail;
}

function errorMessage(error) {
  if (error?.name === "AbortError") {
    return "Timed out waiting for the wallet or server response.";
  }
  return error instanceof Error ? error.message : String(error);
}

function friendlyPaidMessage(message) {
  if (/insufficient funds/i.test(message)) {
    return "Wallet reached the payment step, but it does not have enough spendable sats for this request.";
  }
  if (/timed out/i.test(message)) {
    return "The paid request is still waiting. Check the wallet permission or payment review window, then retry.";
  }
  if (/permission|denied|not authorized|unauthenticated/i.test(message)) {
    return "Wallet permission is not approved yet. Approve the starter in your wallet, then retry.";
  }
  return message;
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

async function postJson(url, body, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return { response, body: await readJson(response) };
  } finally {
    clearTimeout(timer);
  }
}

$("runPreflight").addEventListener("click", async () => {
  setSummary("preflightSummary", "Checking local wallet ports and the real BRC-100 crypto loop...", "loading");
  setWin("walletWin", "Checking wallet", "Looking for wallet API, auth, mainnet, crypto loop, and identity key.", "loading");
  show("preflightOutput", "");

  try {
    const response = await fetch("/api/wallet/health");
    const body = await readJson(response);
    show("preflightOutput", body);

    if (body.mainnetReady) {
      setSummary(
        "preflightSummary",
        "Wallet ready: API callable, authenticated, mainnet, crypto loop complete, identity key ready.",
        "success"
      );
      setWin("walletWin", "Wallet ready", "Your local wallet can run the starter flows on mainnet.", "success");
      return;
    }

    const blockers = Array.isArray(body.blockers) && body.blockers.length > 0
      ? body.blockers.join(" ")
      : "Open and authenticate a BRC-100 wallet, then run preflight again.";
    setSummary("preflightSummary", blockers, "error");
    setWin("walletWin", "Wallet needs attention", blockers, "error");
  } catch (error) {
    const message = `Preflight failed: ${errorMessage(error)}`;
    setSummary("preflightSummary", message, "error");
    setWin("walletWin", "Preflight failed", "Check that the starter server is still running and retry.", "error");
    show("preflightOutput", { error: message });
  }
});

$("runPaid").addEventListener("click", async () => {
  setSummary(
    "paidSummary",
    "Calling AuthFetch against the paid route. If the wallet needs permission or payment review, answer the wallet prompt.",
    "loading"
  );
  setWin("paidWin", "Payment in progress", "Waiting for the wallet and payment middleware to return a receipt.", "loading");
  show("paidOutput", "");

  try {
    const prompt = $("paidPrompt").value;
    const paid = await postJson("/api/paid-summary", { prompt }, { timeoutMs: 18000 });
    const result = {
      status: paid.response.status,
      ...paid.body
    };
    show("paidOutput", result);

    if (paid.response.ok && paid.body.paid) {
      const sats = Number(paid.body.satoshisPaid || 0);
      const receipt = paid.body.receipt || "receipt returned";
      setSummary("paidSummary", `Paid result complete: ${sats} sats charged and receipt ${receipt}.`, "success");
      setWin("paidWin", `${sats} sats charged`, `Paid API returned ${receipt}.`, "success");
      return;
    }

    const message = paid.body.error || `Paid request returned HTTP ${paid.response.status}.`;
    const friendly = friendlyPaidMessage(message);
    setSummary("paidSummary", friendly, "error");
    setWin("paidWin", "Payment did not complete", friendly, "error");
  } catch (error) {
    const message = `Paid request failed: ${errorMessage(error)}`;
    const friendly = friendlyPaidMessage(message);
    setSummary("paidSummary", friendly, "error");
    setWin("paidWin", "Payment needs attention", friendly, "error");
    show("paidOutput", { error: message });
  }
});

$("saveMemory").addEventListener("click", async () => {
  setSummary("memorySummary", "Asking the wallet to encrypt this note. If prompted, grant the starter access.", "loading");
  setWin("memoryWin", "Encrypting note", "Waiting for wallet encrypt/decrypt to round-trip the note.", "loading");
  show("memoryOutput", "");

  try {
    const saved = await postJson("/api/memory", {
      label: "Starter private memory",
      text: $("memoryText").value
    });
    const list = await fetch("/api/memory").then(readJson);
    const result = {
      status: saved.response.status,
      saved: saved.body,
      serverList: list.records
    };
    show("memoryOutput", result);

    if (saved.response.ok && saved.body.decryptedWithWallet) {
      const bytes = saved.body.record?.encryptedBytes ?? "some";
      setSummary("memorySummary", `Encrypted memory saved: ${bytes} ciphertext bytes stored and decrypted back through the wallet.`, "success");
      setWin("memoryWin", "Encrypted note saved", `${bytes} ciphertext bytes are stored server-side, not the plaintext.`, "success");
      return;
    }

    const message = saved.body.error || `Memory request returned HTTP ${saved.response.status}.`;
    setSummary("memorySummary", message, "error");
    setWin("memoryWin", "Memory did not save", message, "error");
  } catch (error) {
    const message = `Memory request failed: ${errorMessage(error)}`;
    setSummary("memorySummary", message, "error");
    setWin("memoryWin", "Memory failed", "Check wallet permission and retry.", "error");
    show("memoryOutput", { error: message });
  }
});

$("deleteMemory").addEventListener("click", async () => {
  setSummary("memorySummary", "Deleting local starter memory records...", "loading");
  try {
    const list = await fetch("/api/memory").then(readJson);
    for (const record of list.records) {
      await fetch(`/api/memory/${record.id}`, { method: "DELETE" });
    }
    setSummary("memorySummary", `Deleted ${list.records.length} local starter record(s).`, "success");
    setWin("memoryWin", "Memory cleared", "The in-memory starter records were removed from this server process.", "idle");
    show("memoryOutput", { deleted: list.records.length, records: [] });
  } catch (error) {
    const message = `Delete failed: ${errorMessage(error)}`;
    setSummary("memorySummary", message, "error");
    show("memoryOutput", { error: message });
  }
});

$("makeProof").addEventListener("click", async () => {
  setSummary("proofSummary", "Asking the wallet to sign proof metadata. If prompted, grant signature access.", "loading");
  setWin("proofWin", "Signing proof", "Waiting for wallet createSignature and verifySignature.", "loading");
  show("proofOutput", "");

  try {
    const proof = await postJson("/api/proof", {
      title: $("proofTitle").value,
      body: $("proofBody").value
    });
    const result = {
      status: proof.response.status,
      ...proof.body
    };
    show("proofOutput", result);

    if (proof.response.ok && proof.body.verified) {
      const hash = String(proof.body.artifactHash || "").slice(0, 18);
      setSummary("proofSummary", `Creation proof verified: wallet signature is valid for artifact hash ${hash}...`, "success");
      setWin("proofWin", "Signature verified", "The wallet signed the artifact metadata and verified the signature.", "success");
      return;
    }

    const message = proof.body.error || `Proof request returned HTTP ${proof.response.status}.`;
    setSummary("proofSummary", message, "error");
    setWin("proofWin", "Proof did not verify", message, "error");
  } catch (error) {
    const message = `Proof request failed: ${errorMessage(error)}`;
    setSummary("proofSummary", message, "error");
    setWin("proofWin", "Proof failed", "Check wallet signature permission and retry.", "error");
    show("proofOutput", { error: message });
  }
});
