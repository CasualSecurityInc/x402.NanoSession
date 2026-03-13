 # Work Plan: LocalFacilitatorClient for NanoSession

> **Quick Summary**: Create a Local adapter class that wraps x402Facilitator and implements FacilitatorClient interface,>
> **Deliverables**:
> - `packages/x402-adapter/src/local-facilitator.ts` - LocalFacilitatorClient class
> - `packages/x402-adapter/package.json` - Export configuration
> - `examples/nextjs-weather/src/x402.ts` - Updated to use LocalFacilitatorClient
>
> **Estimated Effort**: Quick | Short | Medium
> **Parallel Execution**: NO - sequential (> **Critical Path**: Task 1 → Task 2 → Task 7
> **Commit Strategy**: Single atomic commit after all tasks complete

>
> **Success Criteria**:
> - TypeScript compiles without errors
> - Example runs and receives 402 response for nano:mainnet payments
> - Both Track 1 (nanoSession) and Track 2 (nanoSignature) work correctly
>
> **What to do NEXT**: Run `/start-work` to begin execution. Run `/start-work` from the x402.NanoSession repo to start the Sisyphus worker.

---

## TL;DR

Create a thin adapter class that enables `x402ResourceServer` to use a local `x402Facilitator` instance instead of HTTP calls.

---

## Context

### Problem Statement
The `x402ResourceServer` requires a `FacilitatorClient` to:
1. **`initialize()`**: Fetch supported schemes/networks from all registered facilitators clients
2. **`verify()` and `settle()`**: Verify and settle payments

Currently, `examples/nextjs-weather/src/x402.ts` creates the server without a client:
```typescript
export const server = new x402ResourceServer(); // Uses default HTTPFacilitatorClient → https://x402.org
server.register("nano:mainnet", nanoScheme);
```

The default `HTTPFacilitatorClient` points to `https://x402.org/facilitator`, which doesn't know about `nano:mainnet` as a supported scheme.

### Solution
Create a `LocalFacilitatorClient` class that wraps the local `x402Facilitator` instance (which has `ExactNanoFacilitator` registered) and implements the `FacilitatorClient` interface.

### Why This Matters
- **Feeless**: Nano is feeless, no remote HTTP facilitator needed
- **In-process**: All logic runs in the same process
- **Simple**: Just delegation, no complex adapter logic

### Pattern Comparison
**Original (coinbase/x402 with remote HTTP facilitator)**:
```typescript
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new x402ResourceServer(facilitatorClient);
  .register("eip155:*", new ExactEvmScheme());
```

**Our Version (with local facilitator)**:
```typescript
const facilitator = new x402Facilitator();
facilitator.register("nano:mainnet", new ExactNanoFacilitator({ rpcClient }));

const facilitatorClient = new LocalFacilitatorClient(facilitator);

const server = new x402ResourceServer(facilitatorClient)
  .register("nano:mainnet", new ExactNanoScheme());
```

The pattern is identical - just using a local adapter instead of HTTP client.

---

## Work Objectives

1. Create `LocalFacilitatorClient` adapter class in `@nanosession/x402` package
2. Update `examples/nextjs-weather` to. use the new pattern
3. Verify both Track 1 and Track 2 payment flows work correctly with real Nano mainnet

### Must Have
- LocalFacilitatorClient class implementing FacilitatorClient interface
- LocalFacilitatorClient wraps x402Facilitator instance
- Updated nextjs-weather example uses LocalFacilitatorClient

### Must NOT Have (Guardrails)
- No complex adapter logic beyond delegation
- No retry logic (not needed for local calls)
- No HTTP-specific error handling (local trust boundary)
- No modifications to x402Facilitator class itself
- No configuration options beyond wrapped facilitator instance

---

## Verification Strategy
- **Automated tests**: None (per user preference - example serves as integration test)
- **Agent-Executed QA**: Manual verification via nextjs-weather example
  - Start server
  - Test Track 1 (nanoSession) payment flow
  - Test Track 2 (nanoSignature) payment flow
  - Verify 402 responses include payment requirements
  - Verify successful payments return protected resource

---

## Execution Strategy

### Sequential Tasks
1. **Create adapter class** - Implement LocalFacilitatorClient
2. **Add package exports** - Update package.json with new export path
3. **Update example** - Modify nextjs-weather to use LocalFacilitatorClient

4. **Manual verification** - Test both payment tracks

No parallel execution - this is a straightforward sequential implementation.

---

## TODOs

- [ ] 1. Create LocalFacilitatorClient adapter class
  **What to do**: Create `packages/x402-adapter/src/local-facilitator.ts` implementing the `FacilitatorClient` interface from `@x402/core/server`.
  The class wraps an `x402Facilitator` instance and delegates all method calls.
  
  **Must NOT do**:
  - Add retry logic,  - Add HTTP-specific error handling
  - Add configuration beyond wrapped facilitator instance
  - Modify x402Facilitator class itself
  
  **References**:
  - `docs/references/coinbase-x402/typescript/packages/core/src/http/httpFacilitatorClient.ts:25-56` - FacilitatorClient interface definition
  - `docs/references/coinbase-x402/typescript/packages/core/src/facilitator/x402Facilitator.ts:219-274` - x402Facilitator.getSupported() implementation
  - `examples/nextjs-weather/src/x402.ts` - Current example setup to update
  
  **Recommended Agent Profile**: quick
  - Reason: Single file, minimal changes,  - Skills: No special skills needed
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2 (package exports)
  - **Blocked By**: None (can start immediately)
  
  **Acceptance Criteria**:
  - [ ] TypeScript file compiles without errors
  - [ ] Class implements FacilitatorClient interface correctly
  - [ ] Constructor accepts x402Facilitator instance
  - [ ] Methods delegate to wrapped facilitator
  
  **QA Scenarios (Manual)**:
  - **Happy Path**: Create LocalFacilitatorClient, call getSupported(), verify returns array with nano:mainnet
  - **Edge Case**: Pass undefined facilitator, verify getSupported() returns empty arrays gracefully
  
  **Evidence to**: TypeScript compilation succeeds

- [ ] 2. Add export configuration to package.json
  **What to do**: Update `packages/x402-adapter/package.json` to add export path for `./local-facilitator`:
    "import": "./dist/local-facilitator.js",
    "types": "./dist/local-facilitator.d.ts"
  }
  
  **Must NOT do**:
  - Create separate test file
  - Add to existing exports
  
  **References**:
  - `packages/x402-adapter/package.json` - Existing export structure
  
  **Recommended Agent Profile**: quick
  - Reason: Simple configuration update
  - Skills: No special skills needed
  
  **Parallelization**:
  - **Can Run In Parallel**: NO (must run after Task 1)
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3 (example update, manual verification)
  - **Blocked By**: Task 1
  
  **Acceptance Criteria**:
  - [ ] Export path added to package.json
  - [ ] Build succeeds without errors
  
  **QA Scenarios (Manual)**:
  - **Happy Path**: Run `pnpm build`, verify export path is accessible
  - **Edge Case**: Missing export path returns 404
  
  **Evidence**: Build log shows successful export

- [ ] 3. Update nextjs-weather example
  **What to do**: Modify `examples/nextjs-weather/src/x402.ts` to:
1. Import `LocalFacilitatorClient` from `@nanosession/x402/local-facilitator`
2. Create x402Facilitator instance with ExactNanoFacilitator registered
3. Create LocalFacilitatorClient wrapping the facilitator
4. Pass facilitatorClient to x402ResourceServer constructor
5. Call server.initialize() (happens automatically via withX402 middleware)
  
  **Must NOT do**:
  - Change any payment logic
  - Add new environment variables
  - Modify the existing imports structure
  
  **References**:
  - `docs/references/coinbase-x402/examples/typescript/fullstack/next/proxy.ts` - Original pattern to follow
  - `packages/x402-adapter/src/facilitator.ts` - ExactNanoFacilitator implementation
  - `packages/x402-adapter/src/server.ts` - ExactNanoScheme implementation
  
  **Recommended Agent Profile**: quick
  - Reason: Simple file modifications, minimal risk
  - Skills: No special skills needed
  
  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: Task 4 (manual verification)
  - **Blocked By**: Task 1, 2
  
  **Acceptance Criteria**:
  - [ ] Example starts without errors
  - [ ] 402 response includes valid payment requirements for nano:mainnet
  - [ ] Payment verification and settlement work correctly
  
  **QA Scenarios (Manual)**:
  - **Scenario**: Start nextjs-weather server
    - **Tool**: Bash (pnpm dev)
    - **Preconditions**: Server not running
    - **Steps**:
      1. `cd examples/nextjs-weather`
      2. `pnpm dev`
      3. Make GET request to `/api/weather` (expect 402)
      4. Verify response includes payment requirements for `nano:mainnet`
    - **Expected Result**: 402 Payment Required with PAYMENT-REQUIRED header
    - **Evidence**: Terminal output showing server started successfully
  
  - **Scenario**: Make payment with Track 1 client
    - **Tool**: Bash (curl or cli-client)
    - **Preconditions**: Server running,    - **Steps**:
      1. Use cli-client to make payment
      2. Retry request with PAYMENT-SIGNATURE header
    - **Expected Result**: 200 OK with weather data
    - **Evidence**: Weather data returned in response body

  **Evidence to Capture**:
  - [ ] Server starts successfully
  - [ ] 402 response includes nano:mainnet requirements
  - [ ] Payment flow completes end-to-end

- [ ] 4. Manual verification of both payment tracks
  **What to do**: Test both Track 1 and Track 2 payment flows
  **QA Scenarios**:
  - **Scenario**: Track 1 (nanoSession) payment
    - **Tool**: Bash (cli-client)
    - **Preconditions**: Server running, NANO_SEED configured for receiving address
    - **Steps**:
      1. Make unpaid request to `/api/weather`
      2. Receive 402 with nanoSession requirements
      3. Use cli-client to make payment
      4. Retry with PAYMENT-SIGNATURE header
    - **Expected Result**: 200 OK with weather data
    - **Evidence**: Payment successful, response contains weather
  
  - **Scenario**: Track 2 (nanoSignature) payment
    - **Tool**: Bash (cli-client)
    - **Preconditions**: Server running, NANO_SEED configured
    - **Steps**:
      1. Make unpaid request to `/api/weather`
      2. Receive 402 with nanoSignature requirements
      3. Use cli-client to make payment
      4. Retry with PAYMENT-SIGNATURE header
    - **Expected Result**: 200 OK with weather data
    - **Evidence**: Payment successful, response contains weather

  **Evidence to Capture**:
  - [ ] Screenshots or terminal output showing successful payments

---

## Final Verification Wave (Manual QA)
- [ ] F1. TypeScript compilation and build verification
  - Run `pnpm typecheck` in packages/x402-adapter
  - Run `pnpm build` in packages/x402-adapter
  - Verify no TypeScript errors
- [ ] F2. Example server startup
  - Run `pnpm dev` in examples/nextjs-weather
  - Verify server starts without errors
- [ ] F3. Manual payment flow test
  - Use cli-client to test both Track 1 and Track 2
  - Verify 402 responses include correct requirements
  - Verify successful payments return protected resource

---

## Commit Strategy
- **Single commit**: `feat(x402-adapter): add LocalFacilitatorClient for local facilitator`
  - Files: `packages/x402-adapter/src/local-facilitator.ts`, `packages/x402-adapter/package.json`
  - Message: `feat(x402-adapter): add LocalFacilitatorClient for local inline facilitator support`
  
- **Follow-up commit**: `refactor(examples): use LocalFacilitatorClient pattern`
  - Files: `examples/nextjs-weather/src/x402.ts`
  - Message: `refactor(nextjs-weather): use LocalFacilitatorClient for x402 integration`

  - Pre-commit: `pnpm build` (verify build succeeds)

  - Depends on: Task 3 (manual verification)

  - Depends on: Task 4 (manual verification) - must must

---

## Success Criteria
### Verification Commands
```bash
# TypeScript compilation
cd packages/x402-adapter
pnpm typecheck
# Expected: No errors

```

### Final Checklist
- [ ] LocalFacilitatorClient class created
- [ ] Export path added to package.json
- [ ] nextjs-weather example updated
- [ ] Both Track 1 and Track 2 payment flows work
- [ ] TypeScript compiles without errors
