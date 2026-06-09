const pathData = {
  "paid-agent": {
    label: "Paid AI API prompt",
    goal: "a paid AI endpoint that charges a few sats before returning an expensive AI result",
    payoff: "the developer sees wallet auth, a payment request, and a successful paid response",
    checks: [
      "A local UI has a prompt input and a price shown in sats.",
      "The app requests wallet permission before payment.",
      "The paid action has loading, success, and failure states.",
      "The code has one obvious place to swap in a real model provider.",
      "The UI makes it clear why payment belongs in this action instead of bolting on billing later."
    ]
  },
  "private-memory": {
    label: "Private AI memory prompt",
    goal: "a private AI memory app where users save encrypted notes that remain tied to their wallet identity",
    payoff: "the developer sees a private record saved, retrieved, and deleted through wallet-mediated access",
    checks: [
      "The UI can create and list private memory records.",
      "The app explains wallet permission in the UI state, not in a long README.",
      "Stored records are treated as user-owned data, not app-owned profiles.",
      "There is a visible empty, loading, success, and error state.",
      "The copy explains why portable private data is better than another app-owned profile silo."
    ]
  },
  "creation-proof": {
    label: "Creation proof prompt",
    goal: "a creation proof app that signs metadata for an AI-generated artifact and renders a shareable proof page",
    payoff: "the developer sees a signed proof with creator identity, timestamp, artifact metadata, and optional paid unlock",
    checks: [
      "The UI accepts an artifact title, description, and file or URL.",
      "The app requests a wallet signature for the proof metadata.",
      "A proof page shows what was signed and who signed it.",
      "The code leaves a clear hook for paid unlock or licensing.",
      "The proof has obvious value for authorship, consent, audit, or AI artifact provenance."
    ]
  }
};

const USERCOM_BASE = "https://usercom.babbage.systems";
const USERCOM_SUBMIT_ENDPOINT = `${USERCOM_BASE}/submit`;
const USERCOM_SIGNAL_ENDPOINT = `${USERCOM_BASE}/signal`;
const USERCOM_SOURCE = "use.bsv.tools";

const stackHints = {
  react: "Use React + TypeScript with a small Vite frontend. Keep files minimal and readable.",
  next: "Use Next.js with one API route for the paid or signed server action and a compact frontend page.",
  node: "Use a Node service plus a plain frontend. Keep the server boundary explicit."
};

const walletHints = {
  browser: "Use browser wallet permissions first and make the wallet state obvious in the UI.",
  server: "Use a server-side payment or verification check before doing the expensive work.",
  hybrid: "Use browser wallet permission for the user action and a server endpoint for the paid or verified result."
};

const promptOutput = document.querySelector("#promptOutput");
const activePathLabel = document.querySelector("#activePathLabel");
const stackSelect = document.querySelector("#stack");
const walletSelect = document.querySelector("#wallet");
const cards = [...document.querySelectorAll("[data-path-card]")];
const feedbackForm = document.querySelector("#feedbackForm");
const feedbackStatus = document.querySelector("#feedbackStatus");
const feedbackSubmit = document.querySelector("#feedbackSubmit");
let activePath = "paid-agent";

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredId(storage, key) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const created = randomId();
    storage.setItem(key, created);
    return created;
  } catch {
    return undefined;
  }
}

function cleanContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function tagValue(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9:._-]/g, "")
    .slice(0, 80);
}

function usercomMetadata({ surface, tags = [], context = {} } = {}) {
  return {
    source: USERCOM_SOURCE,
    surface,
    url: window.location.href,
    path: window.location.pathname + window.location.hash,
    referrer: document.referrer || undefined,
    anonymousId: getStoredId(window.localStorage, "use_bsv_tools_anonymous_id"),
    sessionId: getStoredId(window.sessionStorage, "use_bsv_tools_session_id"),
    tags: [
      surface ? `surface:${tagValue(surface)}` : undefined,
      ...tags
    ].filter(Boolean),
    context: cleanContext(context)
  };
}

function postSignal(name, metadata = {}) {
  try {
    fetch(USERCOM_SIGNAL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        ...metadata
      }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Analytics must not interrupt the builder flow.
  }
}

function renderPrompt() {
  const path = pathData[activePath];
  activePathLabel.textContent = path.label;
  promptOutput.textContent = `You are helping me build ${path.goal}.

Audience: a competent web developer who is new to BSV.
Stack: ${stackHints[stackSelect.value]}
Wallet/payment surface: ${walletHints[walletSelect.value]}

What I want the first working slice to prove:
- ${path.payoff}
- Start from https://github.com/p2ppsr/use.bsv.tools/tree/master/starter and keep its real wallet flows working.
- It should run locally with the fewest possible manual edits.
- Prefer one command or generated scaffolding over hand-written setup.
- Keep the value visible: money, identity, private data, or proof should be part of the product behavior, not background plumbing.
- Preserve wallet preflight plus visible empty, loading, success, and error states.

Acceptance checks:
${path.checks.map((check) => `- ${check}`).join("\n")}
- npm --prefix starter test still passes after the change.

Use current Project Babbage / BSV wallet APIs where appropriate. If you are unsure about an API, pause and point me at the exact docs page instead of inventing method names. Keep the first milestone small enough that I can see the BSV-specific payoff before refactoring or polishing.`;
}

function selectPath(pathKey) {
  activePath = pathKey;
  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.pathCard === pathKey);
  });
  renderPrompt();
  postSignal("builder.path_selected", usercomMetadata({
    surface: "paths",
    tags: [`path:${pathKey}`],
    context: {
      pathKey,
      label: pathData[pathKey].label
    }
  }));
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = "Copied";
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
}

function setFeedbackStatus(message, state = "idle") {
  feedbackStatus.textContent = message;
  feedbackStatus.dataset.state = state;
}

function getFormValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function buildFeedbackPayload(formData) {
  const stage = getFormValue(formData, "stage");
  const goal = getFormValue(formData, "goal");
  const blocker = getFormValue(formData, "blocker") || "None provided";
  const feedback = getFormValue(formData, "feedback");
  const selectedPath = pathData[activePath].label.replace(" prompt", "");
  const email = getFormValue(formData, "email");

  return {
    type: "feedback",
    name: getFormValue(formData, "name") || undefined,
    email: email || undefined,
    subject: `use.bsv.tools feedback: ${stage} / ${goal}`,
    feedback,
    newsletterSubscribe: formData.get("newsletterSubscribe") === "on",
    ...usercomMetadata({
      surface: "first-builder-feedback",
      tags: [
        "intent:first-builder-feedback",
        `path:${activePath}`,
        `stage:${stage}`,
        `goal:${goal}`,
        `blocker:${blocker}`,
        `stack:${stackSelect.value}`,
        `wallet:${walletSelect.value}`
      ],
      context: {
        selectedPathKey: activePath,
        selectedPath,
        stage,
        desiredValue: goal,
        blocker,
        stack: stackSelect.value,
        walletSurface: walletSelect.value
      }
    })
  };
}

async function submitFeedback(event) {
  event.preventDefault();

  if (!feedbackForm.reportValidity()) {
    setFeedbackStatus("Please add the feedback we should act on.", "error");
    return;
  }

  const payload = buildFeedbackPayload(new FormData(feedbackForm));
  feedbackSubmit.disabled = true;
  setFeedbackStatus("Sending feedback...", "sending");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(USERCOM_SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Usercom returned HTTP ${response.status}`);
    }

    feedbackForm.reset();
    document.querySelector("#builderStage").value = "Running the starter";
    document.querySelector("#builderGoal").value = "Paid API or AI action";
    document.querySelector("#newsletterSubscribe").checked = true;
    setFeedbackStatus("Feedback sent. We will use this to tune the starter and docs.", "success");
  } catch (error) {
    const isAbort = error.name === "AbortError";
    setFeedbackStatus(
      isAbort
        ? "Usercom did not respond in time. Try again or open a GitHub issue."
        : "Feedback could not be sent. Try again or open a GitHub issue.",
      "error"
    );
  } finally {
    clearTimeout(timeout);
    feedbackSubmit.disabled = false;
  }
}

document.querySelectorAll("[data-path]").forEach((button) => {
  button.addEventListener("click", () => selectPath(button.dataset.path));
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = button.dataset.copyTarget;
    const text = target === "promptOutput"
      ? promptOutput.textContent
      : document.querySelector(`#${target}`).innerHTML.trim();
    await copyText(text, button);
    postSignal("builder.copy_clicked", usercomMetadata({
      surface: "copy-control",
      tags: [`copy:${target}`],
      context: {
        target,
        activePath,
        stack: stackSelect.value,
        walletSurface: walletSelect.value
      }
    }));
  });
});

stackSelect.addEventListener("change", () => {
  renderPrompt();
  postSignal("builder.stack_changed", usercomMetadata({
    surface: "agent-prompt-controls",
    tags: [`stack:${stackSelect.value}`],
    context: { stack: stackSelect.value, activePath }
  }));
});
walletSelect.addEventListener("change", () => {
  renderPrompt();
  postSignal("builder.wallet_surface_changed", usercomMetadata({
    surface: "agent-prompt-controls",
    tags: [`wallet:${walletSelect.value}`],
    context: { walletSurface: walletSelect.value, activePath }
  }));
});
feedbackForm.addEventListener("submit", submitFeedback);
renderPrompt();
postSignal("page.view", usercomMetadata({
  surface: "home",
  tags: ["intent:first-builder-entry"],
  context: {
    activePath,
    stack: stackSelect.value,
    walletSurface: walletSelect.value
  }
}));
