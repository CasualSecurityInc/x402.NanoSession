# Next.js Weather API Example

This example demonstrates how to integrate the `@nanosession/x402` adapter with the official `@x402/next` server libraries to protect a Next.js App Router API route.

It exposes a single route at `/api/weather` that requires a fraction of Nano (XNO) to access, and offers both Track 1 (`nanoSession` – Stateful Tagging) and Track 2 (`nanoSignature` – Stateless Signatures) as payment options.

## Getting Started

1. Ensure your dependencies are installed at the monorepo root.
2. Build the packages at the monorepo root (e.g. `pnpm build`).
3. Configure environment variables (see Configuration below).
4. Start the development server:
   ```bash
   pnpm dev
   ```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NANO_RPC_URL` | No | Nano RPC endpoint (default: https://rpc.nano.to) |
| `NANO_PAY_TO` | No | Fallback receiving address (used if NANO_SEED not set) |
| `NANO_SEED` | Track 2 only | 64-character hex seed for Track 2 receive block signing |
| `NANO_ACCOUNT_INDEX` | No | Account index for seed derivation (default: 0) |
| `NANO_RECEIVE_MODE` | No | Track 2 receive mode: 'sync' or 'async' (default: 'sync') |

### Payment Tracks

**Track 1 (nanoSession)** - Stateful with session tagging:
- Works without `NANO_SEED`
- Requires session state (in-memory by default)
- Default if no seed is configured

**Track 2 (nanoSignature)** - Stateless with Ed25519 signatures:
- Requires `NANO_SEED` to create receive blocks
- `payTo` is automatically derived from seed + accountIndex
- No server-side session state needed

### Example .env.local

```bash
# Required for Track 2 (optional for Track 1)
NANO_SEED=your_64_character_hex_seed_here
NANO_ACCOUNT_INDEX=0
NANO_RECEIVE_MODE=sync

# Optional
NANO_RPC_URL=https://rpc.nano.to
NANO_PAY_TO=nano_your_address_here  # Only used if NANO_SEED not set
```

⚠️ **Security**: Never commit `NANO_SEED` to version control. Use `.env.local` (gitignored by Next.js).

## Testing the API

To test the API, you can use the minimalistic CLI client located in `examples/cli-client/`, passing it the `--type session` or `--type signature` flags as needed.

```bash
cd ../cli-client
export NANO_TEST_SEED=your_seed_here
npm start -- -t session http://localhost:3000/api/weather
```
