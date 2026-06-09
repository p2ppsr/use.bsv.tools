# BSV Tools Starter

This is the maintained first-run path behind `use.bsv.tools`.

It gives a new developer one concrete win before asking them to understand Overlay, UHRP, CARS, or marketplace architecture. The starter now uses a real local BRC-100 wallet for paid requests, private data, and signed proof.

## Run It

```bash
git clone https://github.com/p2ppsr/use.bsv.tools.git
cd use.bsv.tools/starter
npm install
npm run preflight
npm run dev
```

Then open `http://127.0.0.1:7171`.

## What Works On First Run

- Wallet preflight checks common local BRC-100 wallet endpoints, required Origin headers, auth state, network, derived key, wallet encryption/decryption, wallet signing/verification, and identity-key readiness.
- Paid API path uses `AuthFetch`, `@bsv/auth-express-middleware`, and `@bsv/payment-express-middleware`.
- Private Memory path asks the wallet to encrypt/decrypt records and stores only ciphertext server-side.
- Creation Proof path asks the wallet to sign artifact metadata and verify the signature.

## Wallet Behavior

The starter is a real wallet app. If a permission is missing, the wallet should prompt the user and the request should wait. If the user denies the prompt, the endpoint returns that wallet error. The app does not turn permission-required states into fake success.

The wallet preflight checks the real local wallet state so developers know whether their machine is ready for mainnet tutorials and production app integration. It sends the Origin and Originator headers BRC-100 desktop wallets require.

By default, `npm run preflight` is diagnostic and exits successfully so the app can still open while the wallet is being configured. Use `node ./bin/wallet-preflight.mjs --strict` when CI or a production-readiness script should fail unless the wallet API is callable, authenticated, mainnet, and able to complete the full real-wallet loop. Add `--require-identity` when identity-key revelation must be green too.

The runnable CI gate is:

```bash
npm test
```

That runs the smoke test plus a strict loopback BRC-100 wallet. The loopback requires Origin headers and proves the same client code can complete derived public key, encrypt/decrypt, sign/verify, identity-key, `AuthFetch`, and payment middleware calls.

## Why This Exists

The older docs path asked first-run developers to reconcile package audit warnings, competing local wallet ports, mismatched tutorial ports, unfinished redemption code, and CARS/LARS config drift before seeing any BSV-specific payoff. This starter keeps those advanced paths out of the first milestone while making real wallet blockers visible instead of hiding them.
