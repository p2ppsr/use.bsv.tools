import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");

const requiredHtml = [
  "For AI-assisted founders and product builders",
  "Add wallet login, tiny payments, private user data, or proof to your app with one AI-ready starter.",
  "Copy LLM reference",
  "People who know the product, not necessarily the protocol.",
  "AI-assisted founders",
  "Product designers",
  "Technical operators",
  "Developers validating a BSV use case",
  "Start with a product moment people can understand.",
  "Paid AI action",
  "Private customer memory",
  "Signed creation proof",
  "Builder proof slot",
  "Run the starter when you are ready to touch the real wallet flow.",
  "A real wallet-backed first win.",
  "Choose the first BSV-powered behavior your app should prove.",
  "Make value a feature, not a billing project.",
  "First hundred builders",
  'id="feedbackForm"',
  'id="feedbackEmail"',
  "Email <span>optional</span>",
  'id="feedbackMessage"',
  "Prefer GitHub? Open an issue.",
  'id="starterCommand"',
  "npm run preflight && npm run dev",
  'id="heroPrompt"',
  "Real wallet loop",
  "QA loopback gate",
  "No signup screen first",
  "Charge per use",
  "User-held private data",
  "Proof outside your database"
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
  'postSignal("builder.example_viewed"',
  'postSignal("builder.feedback_started"',
  '"builder.llm_reference_copied"',
  '"builder.starter_clicked"',
  "submitFeedback",
  "AI-assisted founder or product builder",
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

assert.doesNotMatch(
  html,
  /Use BSV tools to ship apps with money, memory, and proof built in\./,
  "old developer-first hero headline should not return"
);

assert.doesNotMatch(
  html,
  /bsv-tools-workbench\.png/,
  "old workbench hero image should not be used"
);

console.log("Frontend smoke checks passed.");
