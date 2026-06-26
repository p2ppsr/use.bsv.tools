import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");

const requiredHtml = [
  "For AI-assisted founders and product builders",
  "Add payments, private data, and proof with one BSV starter.",
  "Copy the AI-ready reference into your coding agent",
  "wallet login already in the path",
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
  "Paid result ready",
  "Builder proof",
  "Hands-on development with the BSV SDK",
  "Metanet Academy Student",
  "https://metanetacademy.com/",
  "MetanetApps catalog",
  "AuthSig",
  "View AuthSig on MetanetApps",
  "https://metanetapps.com/app/aca4733da793b5bc04a182f7a3d899cfe5bbc85b2ffa4967ccea62760c265f5e.0",
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
  "Press Cmd+C",
  "showCopyFallback",
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
  /Builder proof slot|App catalog slot/,
  "placeholder proof slots should not return"
);

assert.doesNotMatch(
  html,
  /bsv-tools-workbench\.png/,
  "old workbench hero image should not be used"
);

assert.doesNotMatch(
  html,
  /Unlock result/,
  "mock app preview should not include fake button copy"
);

assert.doesNotMatch(
  html,
  /Tell us what to fix/,
  "hero should not include a third CTA"
);

assert.doesNotMatch(
  html,
  /class="audience-grid"/,
  "passive audience labels should not use the old card grid"
);

assert.doesNotMatch(
  js,
  /Copy unavailable/,
  "clipboard fallback should offer manual copy instead of a dead unavailable state"
);

console.log("Frontend smoke checks passed.");
