# x402 with Nano

> **Feeless, instant machine-to-machine payments via HTTP 402**

Implement the [HTTP 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) status code using [Nano](https://nano.org/) (XNO) cryptocurrency. Zero fees. Sub-second settlement. High-frequency M2M payments.

This repository contains a suite of TypeScript libraries and reference implementations for building x402-compatible services and clients on the Nano network.

## Why Nano for x402?

- **Feeless**: Nano has no transaction fees — pay exactly what you owe
- **Instant**: Sub-second confirmation, no block wait times
- **Protocol-Bound**: Payments are cryptographically tied to requests (via `nanoSession` or `nanoSignature`)
- **Simple**: HTTP headers + one RPC call = payment verified

The **x402 with Nano** implementation supports multiple security mechanisms, including `nanoSession` (stateful session binding) and `nanoSignature` (stateless cryptographic signature). See the [Rev 7 Protocol Spec](./docs/x402_NanoSession_rev7_Protocol.md) for security details.

## Repository Layout

```
x402.NanoSession/
├── packages/                   # TypeScript libraries (@nanosession/*)
│   ├── core/                   # Types, constants, schema mapping
│   ├── rpc/                    # Nano RPC client with endpoint failover
│   ├── facilitator/            # NanoSessionFacilitatorHandler
│   ├── client/                 # NanoSessionPaymentHandler
│   └── faremeter-plugin/       # Faremeter adapter (@nanosession/faremeter)
├── examples/                   # Working demos (server, client, faremeter)
│   ├── standalone-facilitator/ # Reference standalone facilitator server
│   ├── client/                 # Reference paying client
│   └── faremeter-server/       # Express + Faremeter integration example
├── docs/                       # Rev 7 protocol docs (source of truth)
├── site/                       # VitePress docs + protected-resource demo server
└── test/integration/           # E2E tests with real Nano mainnet transactions
```

## Quick Start

This is a **pnpm monorepo**. All projects share dependencies installed at the root.

### Initial Setup (Required Once)

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install all dependencies for all projects
pnpm install
```

### Documentation Site

Generate and preview the protocol specification website:

```bash
cd site
SPEC_REV=rev7 pnpm site:build    # Build static site from docs/
pnpm site:preview                 # Preview at localhost:4173
```

For development with hot reload:
```bash
cd site
SPEC_REV=rev7 pnpm site:dev      # Dev server at localhost:5173
```

### Reference Server & Client

Run the example implementations:

```bash
# Terminal 1: Start the payment-protected server
cd examples/standalone-facilitator
NANO_SERVER_ADDRESS=nano_your_address pnpm start

# Terminal 2: Run the paying client
cd examples/client
NANO_SEED=your_64_char_hex_seed pnpm start
```

See [examples/README.md](./examples/README.md) for configuration options.

### Faremeter Integration

For projects using [Faremeter](https://github.com/faremeter/faremeter) x402 middleware:

```bash
# Terminal 1: Start the facilitator service
cd examples/faremeter-server
NANO_SERVER_ADDRESS=nano_your_address pnpm start:facilitator

# Terminal 2: Start the Express server with Faremeter middleware
cd examples/faremeter-server
pnpm start

# Terminal 3: Test the 402 response
curl -i http://localhost:3000/api/resource
```

See [packages/faremeter-plugin/README.md](./packages/faremeter-plugin/README.md) for API documentation.

### Library Packages

Build and test the `@nanosession/*` packages:

```bash
# From repository root:
pnpm build          # Build all packages
pnpm test           # Run unit tests (watch mode)
pnpm test:run       # Run unit tests once
```

### E2E Integration Tests

Run real Nano transactions on mainnet:

```bash
# Setup (once)
cp .env.example .env
# Edit .env with your test wallet seed

# Run integration tests
pnpm test:integration
```

⚠️ Uses real XNO (tiny amounts). See [test/integration/README.md](./test/integration/README.md).

## Documentation

| Resource | Description |
|----------|-------------|
| **[Rev 7 Intro](./docs/x402_NanoSession_rev7_Intro.md)** | High-level overview and Rev 7 architecture |
| **[Rev 7 Protocol Spec](./docs/x402_NanoSession_rev7_Protocol.md)** | Canonical wire format and security requirements |
| **[Examples](./examples/)** | Working server and client with step-by-step instructions |
| **[Integration Tests](./test/integration/)** | Real Nano transactions on mainnet |

The documentation website is built from `docs/` and deployed automatically.

## Packages

| Package | Description |
|---------|-------------|
| `@nanosession/core` | Types, constants, and schema mapping |
| `@nanosession/rpc` | Nano RPC client with endpoint failover |
| `@nanosession/facilitator` | `NanoSessionFacilitatorHandler` for servers |
| `@nanosession/client` | `NanoSessionPaymentHandler` for clients |
| `@nanosession/faremeter` | [Faremeter](https://github.com/faremeter/faremeter) x402 middleware adapter |

All packages are published under the `@nanosession` scope.

### x402 Extensions

`@nanosession/core` includes utility helpers for the upstream x402 [`payment-identifier`](https://docs.x402.org/) extension, which provides client-generated idempotency keys for deduplicating payment requests. This is orthogonal to NanoSession's built-in anti-replay mechanisms (spent set, session binding, signature binding) and operates at the HTTP request layer only.

```typescript
import {
  PAYMENT_IDENTIFIER,
  declarePaymentIdentifierExtension,
  appendPaymentIdentifierToExtensions,
  extractPaymentIdentifier,
} from '@nanosession/core';

// Server: advertise support in 402 response
const extensions = { [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension() };

// Client: attach idempotency key before sending payment
appendPaymentIdentifierToExtensions(extensions);

// Server: extract key for deduplication
const id = extractPaymentIdentifier(paymentPayload);
```

## Contributing

Contributions welcome. This implementation is designed to integrate with [x402](https://github.com/coinbase/x402) ecosystem tooling.

## License

MIT

## Acknowledgments

- [x402](https://github.com/coinbase/x402) — The payment-required standard
- [Nano](https://nano.org/) — Feeless, instant cryptocurrency
