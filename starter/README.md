# BSV Tools Starter

This is the maintained first-run path behind `use.bsv.tools`.

It gives a new developer one concrete win before asking them to understand wallets, Overlay, UHRP, CARS, or marketplace architecture.

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

- Wallet preflight checks common local BRC-100 wallet endpoints and port ownership.
- Paid API path demonstrates an HTTP 402 challenge, mock payment retry, and server receipt.
- Private Memory path creates, lists, decrypts, and deletes encrypted records in no-spend mode.
- Creation Proof path hashes an artifact, signs proof metadata with WebCrypto, and verifies the signature.

## Modes

The default mode is **no-spend mock mode**. It is intentionally honest: it proves the app workflow without requiring funded wallets, server private keys, storage services, or mainnet payment middleware.

The wallet preflight still checks the real local wallet state so developers know whether their machine is ready for mainnet tutorials.

By default, `npm run preflight` is diagnostic and exits successfully so the no-spend starter remains runnable. Use `node ./bin/wallet-preflight.mjs --strict` when a CI or mainnet-upgrade script should fail unless the wallet API is directly callable and authenticated.

## Why This Exists

The older docs path asked first-run developers to reconcile package audit warnings, competing local wallet ports, mismatched tutorial ports, unfinished redemption code, and CARS/LARS config drift before seeing any BSV-specific payoff. This starter keeps those advanced paths out of the first milestone.
