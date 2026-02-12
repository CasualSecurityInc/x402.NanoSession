# NanoSession + Faremeter Example Server

This example demonstrates integrating NanoSession payments with the Faremeter x402 middleware.

## Architecture

```
┌──────────────┐      ┌───────────────────┐      ┌─────────────────────┐
│    Client    │      │   Express Server  │      │ NanoSession         │
│              │      │  + Faremeter MW   │      │ Facilitator Service │
│              │      │                   │      │                     │
│ 1. Request   │─────>│                   │      │                     │
│              │      │ 2. Check payment  │─────>│ 3. Get requirements │
│              │      │                   │<─────│    (session+tag)    │
│ 4. Receive   │<─────│                   │      │                     │
│    402       │      │                   │      │                     │
│              │      │                   │      │                     │
│ 5. Pay Nano  │      │                   │      │                     │
│    (on-chain)│      │                   │      │                     │
│              │      │                   │      │                     │
│ 6. Retry     │─────>│                   │      │                     │
│   + payment  │      │ 7. Verify payment │─────>│ 8. Check block      │
│              │      │                   │<─────│    (tag matches?)   │
│ 9. Access!   │<─────│                   │      │                     │
└──────────────┘      └───────────────────┘      └─────────────────────┘
```

## Quick Start

### 1. Install dependencies

```bash
cd examples/faremeter-server
pnpm install
```

### 2. Start the facilitator service (Terminal 1)

```bash
NANO_SERVER_ADDRESS=nano_your_receiving_address pnpm start:facilitator
```

### 3. Start the Express server (Terminal 2)

```bash
pnpm start
```

### 4. Test with cURL

```bash
# Should return 402 Payment Required
curl -i http://localhost:3000/api/resource

# Health check
curl http://localhost:3000/health
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NANO_SERVER_ADDRESS` | (required) | Your Nano receiving address |
| `NANO_RPC_URL` | `https://rpc.nano.to` | Nano RPC endpoint |
| `PAYMENT_AMOUNT` | `1000000000000000000000000` | Payment amount in raw (0.001 XNO) |
| `FACILITATOR_PORT` | `4000` | Facilitator service port |
| `PORT` | `3000` | Express server port |
| `FACILITATOR_URL` | `http://localhost:4000` | URL of facilitator service |

## Components

### Facilitator Service (`src/facilitator.ts`)

Implements the Faremeter facilitator protocol:
- `POST /accepts` - Returns enriched payment requirements with NanoSession tags
- `POST /verify` - Verifies a payment without settling
- `POST /settle` - Verifies and marks payment as spent

### Express Server (`src/index.ts`)

Uses `@faremeter/middleware` to protect endpoints with 402 payment walls.

## Security Warning

**⚠️ This example uses an in-memory spent set that resets on restart.**

For production, you MUST implement persistent storage. See:
- `packages/faremeter-plugin/PRODUCTION.md`
