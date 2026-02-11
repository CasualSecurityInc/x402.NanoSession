# NanoSession x402 Integration

[![Tests](https://img.shields.io/badge/tests-22%20passing-brightgreen)](./)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](./)
[![License](https://img.shields.io/badge/license-MIT-green)](./)

> **Feeless, instant machine-to-machine payments via HTTP 402**
>
> NanoSession brings Nano cryptocurrency payments to the x402 standard, enabling seamless pay-per-request APIs with zero fees and sub-second confirmation.

## Overview

NanoSession is a protocol implementation that bridges the Nano cryptocurrency with the x402 payment standard. It allows API providers to charge for resources using Nano's feeless, instant transactions.

### Key Features

- **Feeless Payments**: Zero transaction fees using Nano
- **Instant Confirmation**: Sub-second settlement
- **x402 Compatible**: Works with existing x402 infrastructure
- **Direct or Facilitated**: Verify payments directly or via facilitators
- **TypeScript**: Full type safety and modern JavaScript support
- **Extensible**: Pluggable storage and custom verification logic

## Quick Start

### Installation

```bash
# Install packages
npm install

# Run tests
npm test
```

### Package Structure

This monorepo contains the following packages:

| Package | Description |
|---------|-------------|
| `@nanosession/core` | Types, constants, and schema mapping |
| `@nanosession/rpc` | Nano RPC client with failover |
| `@nanosession/server` | FacilitatorHandler for servers |
| `@nanosession/client` | PaymentHandler for clients |

### Server Setup

```typescript
import { createServer } from 'http';
import { NanoSessionFacilitatorHandler } from '@nanosession/server';
import { NanoRpcClient } from '@nanosession/rpc';

const rpcClient = new NanoRpcClient({
  endpoints: ['https://rpc.nano.to']
});

const handler = new NanoSessionFacilitatorHandler({ rpcClient });

const server = createServer(async (req, res) => {
  if (req.url === '/api/premium') {
    // Check for payment
    const payment = req.headers['x-payment-response'];
    
    if (!payment) {
      // Return 402 with payment requirements
      const requirements = handler.getRequirements({
        amount: '1000000000000000000000000', // 0.001 XNO
        payTo: 'nano_your_address_here'
      });
      
      res.writeHead(402, {
        'X-Payment-Required': JSON.stringify(requirements)
      });
      res.end('Payment required');
      return;
    }
    
    // Verify payment
    const result = await handler.handleSettle(
      requirements,
      JSON.parse(payment as string)
    );
    
    if (result?.success) {
      res.writeHead(200);
      res.end('Premium content here!');
    } else {
      res.writeHead(402);
      res.end('Payment verification failed');
    }
  }
});

server.listen(3000);
```

### Client Setup

```typescript
import { NanoSessionPaymentHandler } from '@nanosession/client';
import { NanoRpcClient } from '@nanosession/rpc';

const rpcClient = new NanoRpcClient({
  endpoints: ['https://rpc.nano.to']
});

const handler = new NanoSessionPaymentHandler({
  rpcClient,
  seed: process.env.NANO_TEST_SEED, // Your wallet seed
  maxSpend: '10000000000000000000000000' // 0.01 XNO limit
});

// Request resource
const response = await fetch('http://localhost:3000/api/premium');

if (response.status === 402) {
  // Parse payment requirements
  const requirements = JSON.parse(
    response.headers.get('X-Payment-Required')!
  );
  
  // Create payment
  const execers = await handler.handle({}, [requirements]);
  const { payload } = await execers[0].exec();
  
  // Retry with payment
  const paidResponse = await fetch('http://localhost:3000/api/premium', {
    headers: {
      'X-Payment-Response': JSON.stringify(payload)
    }
  });
  
  const content = await paidResponse.text();
  console.log(content); // "Premium content here!"
}
```

## Examples

See the `examples/` directory for complete working examples:

```bash
# Terminal 1: Start server
cd examples/server
export NANO_SERVER_ADDRESS=nano_your_address
npx tsx src/index.ts

# Terminal 2: Run client
cd examples/client
export NANO_TEST_SEED=your_seed
npx tsx src/index.ts
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Integration tests perform real transactions on Nano mainnet:

```bash
# Setup environment
cp e2e.env.example e2e.env
# Edit e2e.env with your test credentials

# Run integration tests
source ./e2e.env && npm run test:integration
```

⚠️ **Warning**: Integration tests spend real XNO (very small amounts).

## Documentation

- [Protocol Specification](./docs/x402_NanoSession_rev3_Protocol.md)
- [x402 Compatibility Extension](./docs/x402_NanoSession_rev3_Extension_x402_Compat.md)
- [Examples](./examples/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────────┐        ┌──────────────────────┐        │
│  │ PaymentHandler  │───────►│ Block Signing (NaCl) │        │
│  └─────────────────┘        └──────────────────────┘        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP 402 + Payment
                     │
┌────────────────────┼────────────────────────────────────────┐
│                    ▼                        Server           │
│  ┌──────────────────────┐        ┌──────────────────────┐    │
│  │ FacilitatorHandler   │◄───────┤   Spent Set Check    │    │
│  └──────────┬───────────┘        └──────────────────────┘    │
│             │                                                │
│             ▼                                                │
│  ┌──────────────────────┐                                    │
│  │   Nano RPC Client    │                                    │
│  └──────────┬───────────┘                                    │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
     ┌─────────────────┐
     │   Nano Network  │
     └─────────────────┘
```

## Protocol Flow

1. **Request**: Client requests protected resource
2. **402 Response**: Server returns HTTP 402 with PaymentRequirements
3. **Payment**: Client creates and broadcasts Nano send block
4. **Verification**: Server verifies block via RPC
5. **Access**: Server grants access to resource

## Security

- **Double-Spend Prevention**: Spent set tracks used block hashes
- **Tag Validation**: Payment tags prevent replay attacks  
- **Timeouts**: Payment requirements expire after configured time
- **Budget Limits**: Client-side spending limits prevent overspend

## Contributing

This implementation is designed to be contributed to [Faremeter](https://github.com/faremeter/faremeter) as a plugin.

## License

MIT

## Acknowledgments

- [x402](https://github.com/coinbase/x402) - The payment standard that makes this possible
- [Nano](https://nano.org/) - The feeless, instant cryptocurrency
- [Faremeter](https://faremeter.org/) - The facilitator infrastructure
