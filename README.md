# x402.NanoSession

> **Feeless, instant machine-to-machine payments via HTTP 402**

NanoSession is a protocol for high-frequency M2M payments using [Nano](https://nano.org/) cryptocurrency and the [HTTP 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) status code. Zero fees. Sub-second settlement.

## Why NanoSession?

- **Feeless**: Nano has no transaction fees — pay exactly what you owe
- **Instant**: Sub-second confirmation, no block wait times
- **Session-bound**: Payments are cryptographically tied to requests (no receipt theft)
- **Simple**: HTTP headers + one RPC call = payment verified

## Repository Layout

```
x402.NanoSession/
├── packages/           # TypeScript libraries
│   ├── core/           # Types, constants, schemas (@nanosession/core)
│   ├── rpc/            # Nano RPC client with failover (@nanosession/rpc)
│   ├── server/         # Server-side payment handler (@nanosession/server)
│   └── client/         # Client-side payment handler (@nanosession/client)
├── docs/               # Protocol specification (source of truth)
├── examples/           # Working server + client demos
├── site/               # Documentation website (VitePress)
└── test/               # Integration tests (real Nano transactions)
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
SPEC_REV=rev5 pnpm docs:build    # Build static site from docs/
pnpm docs:preview                 # Preview at localhost:4173
```

For development with hot reload:
```bash
cd site
SPEC_REV=rev5 pnpm docs:dev      # Dev server at localhost:5173
```

### Reference Server & Client

Run the example implementations:

```bash
# Terminal 1: Start the payment-protected server
cd examples/server
NANO_SERVER_ADDRESS=nano_your_address pnpm start

# Terminal 2: Run the paying client
cd examples/client
NANO_TEST_SEED=your_64_char_hex_seed pnpm start
```

See [examples/README.md](./examples/README.md) for configuration options.

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
| **[Protocol Spec](./docs/)** | The canonical specification (see `x402_NanoSession_rev*_Protocol.md`) |
| **[Examples](./examples/)** | Working server and client with step-by-step instructions |
| **[Integration Tests](./test/integration/)** | Real Nano transactions on mainnet |

The documentation website is built from `docs/` and deployed automatically.

## Packages

| Package | Description |
|---------|-------------|
| `@nanosession/core` | Types, constants, and schema mapping |
| `@nanosession/rpc` | Nano RPC client with endpoint failover |
| `@nanosession/server` | `NanoSessionFacilitatorHandler` for servers |
| `@nanosession/client` | `NanoSessionPaymentHandler` for clients |

All packages are published under the `@nanosession` scope.

## How It Works

```
Client                          Server                      Nano
  │                               │                           │
  │  GET /resource                │                           │
  │──────────────────────────────>│                           │
  │                               │                           │
  │  402 + X-Payment-Required     │                           │
  │  (sessionId, amount, payTo)   │                           │
  │<──────────────────────────────│                           │
  │                               │                           │
  │  send_block(amount + tag)     │                           │
  │───────────────────────────────────────────────────────────>
  │                               │                           │
  │  GET /resource                │                           │
  │  + X-Payment (blockHash,      │                           │
  │    sessionId)                 │  verify block + session   │
  │──────────────────────────────>│──────────────────────────>│
  │                               │                           │
  │  200 OK                       │                           │
  │<──────────────────────────────│                           │
```

See the [protocol specification](./docs/) for complete details.

## Contributing

Contributions welcome. This implementation is designed to integrate with [x402](https://github.com/coinbase/x402) ecosystem tooling.

## License

MIT

## Acknowledgments

- [x402](https://github.com/coinbase/x402) — The payment-required standard
- [Nano](https://nano.org/) — Feeless, instant cryptocurrency
