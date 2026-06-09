const pathData = {
  "paid-agent": {
    label: "Paid AI API prompt",
    goal: "a paid AI endpoint that charges a few sats before returning an expensive AI result",
    payoff: "the developer sees wallet auth, a payment request, and a successful paid response",
    checks: [
      "A local UI has a prompt input and a price shown in sats.",
      "The app requests wallet permission before payment.",
      "The paid action has loading, success, and failure states.",
      "The code has one obvious place to swap in a real model provider."
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
      "There is a visible empty, loading, success, and error state."
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
      "The code leaves a clear hook for paid unlock or licensing."
    ]
  }
};

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
let activePath = "paid-agent";

function renderPrompt() {
  const path = pathData[activePath];
  activePathLabel.textContent = path.label;
  promptOutput.textContent = `You are helping me build ${path.goal}.

Audience: a competent web developer who is new to BSV.
Stack: ${stackHints[stackSelect.value]}
Wallet/payment surface: ${walletHints[walletSelect.value]}

What I want the first working slice to prove:
- ${path.payoff}
- It should run locally with the fewest possible manual edits.
- Prefer one command or generated scaffolding over hand-written setup.

Acceptance checks:
${path.checks.map((check) => `- ${check}`).join("\n")}

Use current Project Babbage / BSV wallet APIs where appropriate. If you are unsure about an API, pause and point me at the exact docs page instead of inventing method names. Keep the first milestone small enough that I can see the BSV-specific payoff before refactoring or polishing.`;
}

function selectPath(pathKey) {
  activePath = pathKey;
  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.pathCard === pathKey);
  });
  renderPrompt();
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
  });
});

stackSelect.addEventListener("change", renderPrompt);
walletSelect.addEventListener("change", renderPrompt);
renderPrompt();
