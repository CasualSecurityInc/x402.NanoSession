# Integration Tests

These tests perform real transactions on the Nano mainnet. Use with caution.

## Setup

1. Copy the example environment file:
   ```bash
   cp e2e.env.example e2e.env
   ```

2. Edit `e2e.env` with your test wallet details:
   ```bash
   NANO_TEST_SEED=your_64_char_hex_seed_here
   NANO_RPC_URL=https://rpc.nano.to
   NANO_SERVER_ADDRESS=nano_your_receiving_address
   NANO_MAX_SPEND=1000000000000000000000000000  # 0.001 XNO in raw
   ```

3. Ensure your test wallet has a small amount of XNO (0.01 XNO is plenty for testing).

## Running Tests

```bash
# Load environment and run integration tests
source ./e2e.env && npm run test:integration

# Or let the test load e2e.env automatically
npm run test:integration
```

## Test Flow

1. **Server Setup**: Starts a local HTTP server with a payment-protected endpoint
2. **First Request**: Client requests resource without payment → receives 402
3. **Payment Creation**: Client creates and broadcasts a Nano send block
4. **Second Request**: Client retries with block hash → server verifies
5. **Access Granted**: Server returns 200 with resource content

## Safety Limits

- Maximum spend per test: 0.001 XNO
- Tests skip automatically if `NANO_TEST_SEED` is not set
- Tests use small amounts suitable for mainnet testing

## Troubleshooting

**Test skips with "NANO_TEST_SEED not set"**
- Ensure `e2e.env` file exists in project root
- Check that NANO_TEST_SEED is set to a valid 64-character hex string

**"Insufficient balance" errors**
- Your test wallet needs enough balance to cover the payment + minimum account balance
- Minimum account balance on Nano is currently 0.0001 XNO

**RPC connection failures**
- Try a different RPC endpoint
- Ensure you have internet connectivity
- Some public RPCs have rate limits

## Notes

- Integration tests are NOT run by default with `npm test`
- They only run when explicitly invoked via `npm run test:integration`
- Each test run spends real XNO (though very small amounts)
- The receiving address should be one you control for testing
