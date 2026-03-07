# x402.NanoSession

> **Feeless, instant machine-to-machine payments via HTTP 402**

NanoSession is a protocol for high-frequency M2M payments using [Nano](https://nano.org/) cryptocurrency and the [HTTP 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) status code. Zero fees. Sub-second settlement.

## Why NanoSession?

- **Feeless**: Nano has no transaction fees — pay exactly what you owe
- **Instant**: Sub-second confirmation, no block wait times
- **Session-bound**: Payments are cryptographically tied to requests (no receipt theft)
- **Simple**: HTTP headers + one RPC call = payment verified

## Protocol Flow (Simplified)

Four steps. Session-bound proof. Zero fees.

```
Client                    Resource Server          Facilitator            Nano
  │                               │                     │                  │
  │  GET /resource                │                     │                  │
  │──────────────────────────────>│                     │                  │
  │                               │  init session       │                  │
  │                               │────────────────────>│                  │
  │                               │<────────────────────│                  │
  │  402 + PAYMENT-REQUIRED       │                     │                  │
  │  (amount, payTo,              │                     │                  │
  │   extra.nanoSession.id)       │                     │                  │
  │<──────────────────────────────│                     │                  │
  │                               │                     │                  │
  │  send_block(amount)           │                     │                  │
  │───────────────────────────────────────────────────────────────────────>│
  │                               │                     │                  │
  │  GET /resource +              │                     │                  │
  │  PAYMENT-SIGNATURE            │  verify(hash, id)   │                  │
  │  (payload.proof=blockHash,    │────────────────────>│─────────────────>│
  │   accepted.extra.nanoSession) │                     │                  │
  │                               │<────────────────────│                  │
  │  200 OK                       │                     │                  │
  │<──────────────────────────────│                     │                  │
```

The **session binding** (tag embedded in payment amount) prevents receipt theft. In Rev 6, the Resource Server issues challenges and the Facilitator verifies chain proofs + spent-set constraints. See the [Rev 6 Protocol Spec](./docs/x402_NanoSession_rev6_Protocol.md) for security details.

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
├── docs/                       # Rev 6 protocol docs (source of truth)
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
SPEC_REV=rev6 pnpm site:build    # Build static site from docs/
pnpm site:preview                 # Preview at localhost:4173
```

For development with hot reload:
```bash
cd site
SPEC_REV=rev6 pnpm site:dev      # Dev server at localhost:5173
```

### Reference Server & Client

Run the example implementations:

```bash
# Terminal 1: Start the payment-protected server
cd examples/standalone-facilitator
NANO_SERVER_ADDRESS=nano_your_address pnpm start

# Terminal 2: Run the paying client
cd examples/client
NANO_TEST_SEED=your_64_char_hex_seed pnpm start
```

See [examples/README.md](./examples/README.md) for configuration options.

### Faremeter Integration

For projects using [Faremeter](https://github.com/faremeter/faremeter) x402 middleware:

```bash
# Terminal 1: Start the NanoSession facilitator service
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
cp test/integration/e2e.env.example test/integration/e2e.env
# Edit e2e.env with your test wallet seed

# Run integration tests
pnpm test:integration
```

⚠️ Uses real XNO (tiny amounts). See [test/integration/README.md](./test/integration/README.md).

## Documentation

| Resource | Description |
|----------|-------------|
| **[Rev 6 Intro](./docs/x402_NanoSession_rev6_Intro.md)** | High-level overview and Rev 6 architecture |
| **[Rev 6 Protocol Spec](./docs/x402_NanoSession_rev6_Protocol.md)** | Canonical wire format and security requirements |
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


## Contributing

Contributions welcome. This implementation is designed to integrate with [x402](https://github.com/coinbase/x402) ecosystem tooling.

## License

MIT

## Acknowledgments

- [x402](https://github.com/coinbase/x402) — The payment-required standard
- [Nano](https://nano.org/) — Feeless, instant cryptocurrency
