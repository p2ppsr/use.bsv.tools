import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");

const requiredHtml = [
  "Build apps where users bring identity, money, private data, and proof.",
  "Make value a feature, not a billing project.",
  "First hundred builders",
  'id="feedbackForm"',
  'id="feedbackEmail"',
  "Email <span>optional</span>",
  'id="feedbackMessage"',
  "Prefer GitHub? Open an issue.",
  'id="starterCommand"',
  "npm run preflight && npm run dev",
  "Real wallet loop",
  "QA loopback gate",
  "Wallet as account",
  "Pay per API call",
  "User-owned memory",
  "Signed proof"
];

for (const value of requiredHtml) {
  assert.ok(html.includes(value), `frontend/index.html is missing: ${value}`);
}

const requiredJs = [
  'const USERCOM_BASE = "https://usercom.babbage.systems";',
  "const USERCOM_SUBMIT_ENDPOINT",
  "const USERCOM_SIGNAL_ENDPOINT",
  'type: "feedback"',
  "newsletterSubscribe",
  "source: USERCOM_SOURCE",
  'surface: "first-builder-feedback"',
  'postSignal("page.view"',
  "submitFeedback",
  "Keep the value visible"
];

for (const value of requiredJs) {
  assert.ok(js.includes(value), `frontend/app.js is missing: ${value}`);
}

assert.match(
  js,
  /subject:\s*`use\.bsv\.tools feedback:/,
  "feedback payload subject should identify use.bsv.tools"
);

assert.doesNotMatch(
  html,
  /id="feedbackEmail"[^>]*required/,
  "feedback email should be optional"
);

console.log("Frontend smoke checks passed.");
