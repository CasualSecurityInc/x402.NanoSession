# @nanosession/faremeter

> Faremeter adapter for NanoSession x402 payments

This package provides adapters that bridge NanoSession's payment handlers to the [Faremeter](https://faremeter.com) x402 middleware interface.

## Installation

```bash
npm install @nanosession/faremeter
# or
pnpm add @nanosession/faremeter
```

**Peer dependencies:** This package requires `@nanosession/core`, `@nanosession/server`, `@nanosession/client`, and `@nanosession/rpc` to be installed.

## Usage

### Server-Side: FacilitatorHandler

The `createFacilitatorHandler` function creates a Faremeter-compatible `FacilitatorHandler` that verifies and settles NanoSession payments.

```typescript
import { createFacilitatorHandler } from '@nanosession/faremeter';
import { NanoRpcClient } from '@nanosession/rpc';

const rpcClient = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });

const facilitatorHandler = createFacilitatorHandler({
  rpcClient,
  payTo: 'nano_your_receiving_address',
  defaultAmount: '1000000000000000000000000', // 0.001 XNO in raw
  maxTimeoutSeconds: 300,
});

// Use with Faremeter middleware:
// app.use(faremeter({ facilitatorHandler }));
```

#### FacilitatorHandler Methods

| Method | Description |
|--------|-------------|
| `getSupported()` | Returns supported payment schemes (nano-session on nano:mainnet) |
| `getRequirements(accepts)` | Enriches payment requirements with session ID and tag |
| `handleVerify(req, payment)` | Verifies a payment without marking as spent |
| `handleSettle(req, payment)` | Verifies and settles a payment (marks as spent) |

### Client-Side: PaymentHandler

The `createPaymentHandler` function creates a Faremeter-compatible `PaymentHandler` that creates and broadcasts Nano payments.

```typescript
import { createPaymentHandler } from '@nanosession/faremeter';
import { NanoRpcClient } from '@nanosession/rpc';

const rpcClient = new NanoRpcClient({ endpoints: ['https://rpc.nano.to'] });

const paymentHandler = createPaymentHandler({
  rpcClient,
  seed: process.env.NANO_WALLET_SEED!, // 64-char hex seed
  maxSpend: '100000000000000000000000000', // Optional: max spend limit per request
});

// Use with Faremeter client:
// const client = createClient({ paymentHandler });
```

## Security Model

NanoSession uses **session-bound payments** to prevent receipt theft attacks:

1. Each payment request includes a unique `sessionId` and `tag`
2. The payment amount encodes the tag: `actualAmount = baseAmount + tag`
3. Server verifies the tag matches the session before accepting payment

This prevents attackers from stealing payment proofs (block hashes) and reusing them for different sessions.

**Critical**: The server MUST maintain a spent set to prevent replay attacks. See [PRODUCTION.md](./PRODUCTION.md) for production deployment requirements.

## API Reference

### `createFacilitatorHandler(options: FacilitatorOptions)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `rpcClient` | `NanoRpcClient` | Yes | Nano RPC client instance |
| `payTo` | `string` | Yes | Receiving Nano address |
| `defaultAmount` | `string` | No | Default payment amount in raw |
| `maxTimeoutSeconds` | `number` | No | Session timeout (default: 300) |
| `spentSet` | `SpentSetStorage` | No | Custom spent set storage |
| `tagModulus` | `number` | No | Tag modulus (default: 1,000,000) |

### `createPaymentHandler(options: PaymentHandlerOptions)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `rpcClient` | `NanoRpcClient` | Yes | Nano RPC client instance |
| `seed` | `string` | Yes | 64-character hex wallet seed |
| `maxSpend` | `string` | No | Maximum spend per request in raw |

## Example

See [`examples/faremeter-server/`](../../examples/faremeter-server/) for a complete working example with:
- Express server using Faremeter middleware
- NanoSession facilitator service
- 402 Payment Required flow

## License

MIT
