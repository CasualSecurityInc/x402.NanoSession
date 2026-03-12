# NanoSession HTTP CLI

A minimalist, "curl"-like command-line interface for interacting with x402 protected resources using the NanoSession protocol.

## Features

- **Dual-Track Support**: Handles both Track 1 (`nanoSession`) and Track 2 (`nanoSignature`) payment proofs.
- **Manual Track Selection**: Use `-t` to force a specific payment variant.
- **Verbose Mode**: Use `-v` to see detailed protocol exchange and payment logs.
- **Failover RPC**: Leverages `@nanosession/rpc` for reliable payment broadcasting.

## Installation

Ensure you have built the monorepo from the root:

```bash
pnpm build
```

The CLI depends on `@nanosession/client`, `@nanosession/core`, and `@nanosession/rpc`.

## Usage

Set your Nano test seed and index:

```bash
export NANO_SEED=0000000000000000000000000000000000000000000000000000000000000000
export NANO_ACCOUNT_INDEX=0
```

Run the CLI against a protected resource:

```bash
npx tsx src/index.ts http://localhost:3000/api/weather
```

### Options

- `-v, --verbose`: Enable verbose logging showing base64-decoded x402 headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`) and payment steps. Also enables `DEBUG=nanosession:*` output.
- `-t, --type <session|signature>`: Select the payment track (default: `session` if available).

### Example: Requesting with Signature Track

```bash
npx tsx src/index.ts -v -t signature http://localhost:3000/api/weather
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NANO_SEED` | **Required**. 64-char hex seed for the payer account. | - |
| `NANO_ACCOUNT_INDEX` | Lexical index for the Nano account derivation. | `0` |
| `NANO_RPC_URL` | Nano RPC endpoint for payment broadcasting. | `https://rpc.nano.to` |
| `NANO_MAX_SPEND` | Safety limit in raw (30 decimals) per request. | `0.01 XNO` |
