# Integration Tests

These tests perform real transactions on the Nano mainnet using HD wallet account derivation. Use with caution.

## HD Account Derivation

The integration test uses Nano's **seed+index derivation model** (not BIP32):

```
secretKey = blake2b(seed || uint32_be(index))
publicKey = ed25519(secretKey)
address   = nano_base32(publicKey)
```

From a single test seed, two accounts are derived:
- **Account #0**: Client account (source of payments)
- **Account #1**: Server account (receives payments)

This ensures payments flow between different addresses (avoiding acct0→acct0 which is meaningless).

## Setup

1. Copy the example environment file (files are in this directory):
   ```bash
    cp e2e.env.example e2e.env
    ```

2. Edit `e2e.env` with your test wallet seed:
   ```bash
   NANO_TEST_SEED=your_64_char_hex_seed_here
   NANO_RPC_URL=https://rpc.nano.to
   NANO_MAX_SPEND=1000000000000000000000000000  # 0.001 XNO in raw
   ```

3. **Fund Account #0** (the derived client address):
   ```bash
   # Derive the client address to fund:
   # Account #0 address will be shown when you run the test
   ```

4. Ensure Account #0 has balance (0.01 XNO is plenty for testing).

## Running Tests

```bash
# Run integration tests (loads e2e.env automatically)
pnpm test:integration

# Or run all tests including integration
pnpm test
```

## Test Flow

1. **Setup Phase**:
   - Derive Account #0 (client) and Account #1 (server) addresses from seed
   - Log addresses (seed is never displayed)
   - Sweep any existing funds from Account #1 → Account #0

2. **Test Execution**:
   - Start local HTTP server with payment-protected endpoint
   - Client requests resource without payment → receives HTTP 402
   - Server returns PaymentRequirements with Account #1 as destination
   - Client creates Nano send block from Account #0
   - Broadcast block to mainnet via RPC
   - Poll for confirmation
   - Client retries request with block hash proof
   - Server verifies on blockchain → grants access

3. **Cleanup Phase**:
   - Sweep remaining funds from Account #1 → Account #0

## Safety Features

- **Seed never logged**: Only derived addresses are displayed
- **Automatic sweep**: Funds are returned to Account #0 after test
- **Balance checks**: Test validates sufficient balance before attempting payments
- **Maximum spend**: Hard limit per test (default 0.001 XNO)
- **Auto-skip**: Tests skip gracefully if `NANO_TEST_SEED` is not set

## Troubleshooting

**Test skips with "NANO_TEST_SEED not set"**
- Ensure `e2e.env` file exists in project root
- Check that NANO_TEST_SEED is set to a valid 64-character hex string

**"Insufficient balance" errors**
- Account #0 (derived from seed with index 0) needs balance
- The test logs the derived addresses on startup - fund Account #0
- Minimum account balance on Nano is currently 0.0001 XNO

**"Account not found" errors**
- Newly derived accounts don't exist on-chain until they receive funds
- Fund Account #0 first to open the account

**RPC connection failures**
- Try a different RPC endpoint
- Ensure you have internet connectivity
- Some public RPCs have rate limits

## Implementation Details

The integration test uses the `nanocurrency` npm package for proper HD derivation:

```typescript
import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

// Derive Account #0 (client)
const clientSecret = deriveSecretKey(seed, 0);
const clientPublic = derivePublicKey(clientSecret);
const clientAddress = deriveAddress(clientPublic, { useNanoPrefix: true });

// Derive Account #1 (server)
const serverSecret = deriveSecretKey(seed, 1);
const serverPublic = derivePublicKey(serverSecret);
const serverAddress = deriveAddress(serverPublic, { useNanoPrefix: true });
```

## Debugging with Block Explorer

To verify transactions against on-chain reality, use [blocklattice.io](https://blocklattice.io/).

**Important**: Our raw tags are very small values (e.g., `134771`) encoded in the payment amount. The account overview page won't show these - amounts are displayed in human-readable XNO format which rounds away the tag.

To see the actual raw tag value:
1. Navigate to the specific block page: `https://blocklattice.io/block/<BLOCK_HASH>`
2. Scroll to **"Original Block Content"**
3. The `balance` field shows the raw amount including the encoded tag

Example: https://blocklattice.io/block/AA4FC1BC444A83A425AC36CC39DF0EDE56545AE29EDE053CB6DBCBAB537E6965

## Notes

- Integration tests are NOT run by default with `pnpm test`
- They only run when explicitly invoked via `pnpm test:integration`
- Each test run spends real XNO (though very small amounts)
- The test handles its own address derivation - you only need to provide the seed
- Account #1 is automatically swept back to Account #0 after tests
