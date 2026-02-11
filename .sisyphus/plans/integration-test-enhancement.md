# Integration Test Enhancement Plan

## Goal
Update integration tests to perform real mainnet transactions with proper HD wallet account derivation.

## Background
Current integration test (`test/integration/payment-flow.test.ts`) skips actual broadcast and just validates structure. User wants real mainnet testing with:
- HD account derivation (seed → multiple accounts)
- Account #0 = client (source)
- Account #1 = server destination (simplest pool)
- Real payment broadcast and verification
- Sweep funds back to acct0 after test

## Technical Requirements

### From Research
1. **Nano uses seed+index model** (not BIP32):
   - `secretKey = blake2b(seed || uint32_be(index), 32 bytes)`
   - `publicKey = ed25519.publicKey(secretKey)`
   - `address = nano_base32(publicKey)`

2. **nanocurrency npm package** provides:
   - `deriveSecretKey(seed, index)`
   - `derivePublicKey(secretKey)`
   - `deriveAddress(publicKey)`

3. **Derivation path from docs**:
   - Extension A: `m/44'/165'/<Generation>'/<Pool_Index>'`
   - For now (single server address): use account index 1

## Tasks

- [x] Add `nanocurrency` package to @nanosession/client dependencies
- [x] Create AddressPool interface in @nanosession/core for future extensibility
- [x] Implement StandardAccountPool (uses account index 1 for server)
- [x] Update deriveKeyPair to support account index parameter
- [x] Create account derivation utilities (deriveAddressFromSeed)
- [x] Create sweep utility (send all funds from subaccount back to acct0)
- [x] Update integration test:
  - [x] Derive acct0 and acct1 addresses from seed
  - [x] Log addresses (not seed) at test start
  - [x] Sweep acct1 → acct0 before test
  - [x] Execute real payment broadcast via RPC (gracefully handles unfunded accounts)
  - [x] Verify payment on blockchain (gracefully handles unfunded accounts)
  - [x] Sweep remaining funds back to acct0 after test
- [x] Update e2e.env.example with documentation
- [x] Add integration test documentation

## Definition of Done
- [x] `nanocurrency` package added
- [x] AddressPool interface exists with StandardAccountPool implementation
- [x] deriveKeyPair supports account index
- [x] Integration test performs real mainnet transactions when env vars set
- [x] Integration test properly sweeps funds before/after
- [x] Addresses are logged, seed is never logged
- [x] All 22 tests still pass
- [x] TypeScript compiles clean

## Files to Modify
- `packages/client/package.json` - add nanocurrency
- `packages/client/src/signing.ts` - update deriveKeyPair
- `packages/core/src/index.ts` - export AddressPool interface
- `packages/core/src/address-pool.ts` - new file
- `test/integration/payment-flow.test.ts` - main test updates
- `e2e.env.example` - documentation updates
- `test/integration/README.md` - update docs
