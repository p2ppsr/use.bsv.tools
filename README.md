# Use BSV Tools

Static landing page for `https://use.bsv.tools`.

The page is designed as a builder entry point: developers choose a high-payoff BSV use case, run the maintained starter, copy an AI-agent prompt, and then use the deeper docs as reference material.

The production page also includes a first-builder feedback form. It posts public feedback payloads to Usercom at `https://usercom.babbage.systems/submit` with `type: "feedback"`, structured builder stage/use-case fields, and an optional newsletter follow-up flag.

## First-Run Starter

```bash
git clone https://github.com/p2ppsr/use.bsv.tools.git
cd use.bsv.tools/starter
npm install
npm run preflight
npm run dev
```

The starter is deliberately dependency-light and no-spend by default. It includes diagnostic wallet preflight, a paid API mock flow, private encrypted memory, creation proof, and smoke tests.

## Local Development

```bash
npm install
npm test
npm run serve
```

## Deploy

Production deploys run through CARS from GitHub Actions on pushes to `master`.
