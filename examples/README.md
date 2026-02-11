# NanoSession Examples

This directory contains example applications demonstrating the NanoSession x402 protocol.

## Examples

### Server Example (`server/`)

A simple HTTP server that protects resources with Nano payments.

**Features:**
- Returns HTTP 402 with PaymentRequirements for unpaid requests
- Verifies Nano payments via RPC
- Grants access after successful payment verification
- Uses in-memory spent set (resets on restart)

**Run:**
```bash
cd examples/server
npx tsx src/index.ts
```

**Configuration (environment variables):**
- `PORT` - Server port (default: 3000)
- `NANO_RPC_URL` - Nano RPC endpoint (default: https://rpc.nano.to)
- `NANO_SERVER_ADDRESS` - Your receiving Nano address
- `PAYMENT_AMOUNT` - Amount in raw (default: 0.001 XNO)

**Test:**
```bash
# Health check
curl http://localhost:3000/health

# Try accessing protected resource (will get 402)
curl -i http://localhost:3000/api/resource
```

### Client Example (`client/`)

A fetch wrapper that automatically handles HTTP 402 responses by making Nano payments.

**Features:**
- Automatically detects 402 Payment Required responses
- Creates and broadcasts Nano payments
- Retries requests with payment proof
- Configurable spending limits

**Run:**
```bash
# Requires NANO_TEST_SEED environment variable
cd examples/client
export NANO_TEST_SEED=your_64_char_hex_seed
npx tsx src/index.ts

# Or with e2e.env
source ../e2e.env && npx tsx src/index.ts
```

**Configuration (environment variables):**
- `SERVER_URL` - Server URL (default: http://localhost:3000)
- `NANO_RPC_URL` - Nano RPC endpoint (default: https://rpc.nano.to)
- `NANO_TEST_SEED` - Your wallet seed (**required**)
- `NANO_MAX_SPEND` - Maximum spend per request (default: 0.01 XNO)

## Running Both Examples Together

1. **Terminal 1 - Start the server:**
   ```bash
   cd examples/server
   export NANO_SERVER_ADDRESS=nano_your_address_here
   npx tsx src/index.ts
   ```

2. **Terminal 2 - Run the client:**
   ```bash
   cd examples/client
   export NANO_TEST_SEED=your_seed_here
   npx tsx src/index.ts
   ```

The client will:
1. Request the protected resource
2. Receive a 402 response with payment requirements
3. Create and broadcast a Nano payment
4. Retry the request with payment proof
5. Receive the protected content

## Architecture

```
┌──────────────┐         ┌──────────────┐
│    Client    │         │    Server    │
│              │         │              │
│ 1. Request   │ ──────► │              │
│              │         │ 2. Check     │
│              │         │    Payment   │
│              │         │              │
│ 4. Receive   │ ◄────── │ 3. Return    │
│    402       │         │    402       │
│              │         │              │
│ 5. Create    │         │              │
│    Payment   │         │              │
│              │         │              │
│ 6. Retry     │ ──────► │ 7. Verify    │
│   + Payment  │         │              │
│              │         │ 8. Return    │
│ 9. Access    │ ◄────── │    Content   │
│    Granted   │         │              │
└──────────────┘         └──────────────┘
```

## Customization

### Change Payment Amount

Edit `examples/server/src/index.ts`:
```typescript
const PAYMENT_AMOUNT = '500000000000000000000000'; // 0.0005 XNO
```

### Add More Endpoints

Add new endpoints to the server:
```typescript
if (req.url === '/api/premium' && req.method === 'GET') {
  // Similar payment check logic
  // Different resource content
}
```

### Custom Payment Logic

Modify the client to handle specific error cases:
```typescript
if (response.status === 402) {
  // Custom validation before paying
  if (requirements.amount > MY_LIMIT) {
    throw new Error('Too expensive');
  }
  // ... proceed with payment
}
```

## Notes

- These are **minimal examples** for demonstration
- No persistence - spent set is in-memory only
- No rate limiting or abuse prevention
- Uses public RPC nodes by default
- For production, run your own Nano node
