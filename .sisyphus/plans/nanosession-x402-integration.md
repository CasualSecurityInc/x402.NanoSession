# NanoSession x402 Integration

## TL;DR

> **Quick Summary**: Create x402-compatible schema mapping for NanoSession protocol with standalone TypeScript implementation (client + server + examples), designed for future Faremeter plugin contribution.
> 
> **Deliverables**:
> - `@nanosession/core` - Types, schema mapping, validation
> - `@nanosession/client` - PaymentHandler implementation  
> - `@nanosession/server` - FacilitatorHandler implementation + spent set
> - `@nanosession/rpc` - Nano RPC client with failover
> - Example client and server applications
> - x402 compatibility documentation
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (setup) → Task 2 (core) → Tasks 3-5 (parallel) → Task 6 (integration) → Tasks 7-8 (examples + docs)

---

## Context

### Original Request
Create x402-compatible schema mapping for NanoSession and plan a lightweight standalone client + server implementation, with the intention to repackage it as a plugin to contribute directly to Faremeter.

### Interview Summary
**Key Discussions**:
- **Facilitator Strategy**: Optional - supports direct RPC verification AND facilitator delegation
- **Network Identifier**: `nano:mainnet` (unofficial CAIP-2, registration out of scope)
- **Package Structure**: Monorepo with @nanosession/* packages
- **Testing**: TDD with Node.js + tsx, integration tests on mainnet
- **Spent Set**: Pluggable storage interface with in-memory default
- **Test Wallet**: User provides seed via NANO_TEST_SEED env var
- **Environment File**: Test credentials sourced from `./e2e.env` (gitignored)

**Research Findings**:
- **Faremeter**: FacilitatorHandler interface with getSupported/getRequirements/handleVerify/handleSettle; handlers return `null` for non-matching schemes
- **x402 SDK**: PaymentRequirements = {scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra}
- **Nano RPC**: block_info for verification (confirmed, amount, link), sub-second confirmation, no fees

### Metis Review
**Identified Gaps** (addressed):
- Spent set architecture → Pluggable interface, in-memory default
- Package scope → Minimal + examples (no facilitator service, no rate limiting)
- Error handling → x402-compatible patterns
- Mainnet testing → User provides test wallet

---

## Work Objectives

### Core Objective
Implement x402-compatible NanoSession protocol as standalone TypeScript packages that can be contributed to Faremeter as a plugin.

### Concrete Deliverables
- `packages/core/` - Types, PaymentRequirements mapping, validation schemas
- `packages/client/` - PaymentHandler implementation
- `packages/server/` - FacilitatorHandler implementation, SpentSet interface
- `packages/rpc/` - Nano RPC client with endpoint failover
- `examples/client/` - Example payment client
- `examples/server/` - Example resource server with payment protection
- `docs/x402_NanoSession_rev3_Extension_x402_Compat.md` - x402 compatibility spec addition

### Definition of Done
- [x] `npm test` passes with >90% coverage on core/client/server packages
- [x] `npm run test:integration` completes mainnet payment verification
- [x] TypeScript compiles without errors: `npx tsc --noEmit`
- [x] Example server accepts payment and grants access
- [x] Example client detects 402, pays, and retries successfully

### Must Have
- x402 PaymentRequirements ↔ NanoSession headers bidirectional mapping
- FacilitatorHandler interface compliance (Faremeter-compatible)
- PaymentHandler interface compliance (x402-compatible)
- Spent set with pluggable storage (in-memory default)
- Nano RPC client with failover support
- Direct verification mode (no facilitator required)
- TDD with unit and integration tests

### Must NOT Have (Guardrails)
- ❌ Facilitator service implementation (only handler interface)
- ❌ Persistent storage implementation (only interface + in-memory)
- ❌ Rate limiting or abuse prevention
- ❌ Monitoring/metrics/logging frameworks
- ❌ CLI tools
- ❌ Browser wallet integration
- ❌ Pool/Stochastic extensions (base spec only)
- ❌ More than 5 production dependencies per package
- ❌ Heavy frameworks (Express, Fastify in core packages)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> The executing agent verifies using tools (Playwright, bash, curl, etc.).

### Test Decision
- **Infrastructure exists**: NO (new packages)
- **Automated tests**: YES (TDD)
- **Framework**: vitest (Node.js compatible, fast)

### Test Setup Task (Task 1)
- Install: `npm init -y && npm add -D vitest typescript tsx @types/node`
- Config: Create `vitest.config.ts`, `tsconfig.json`
- Verify: `npm test -- --run` → shows test runner ready
- Example: Create `packages/core/src/__tests__/example.test.ts`
- Verify: `npm test -- --run` → 1 test passes

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Each task includes detailed scenarios specifying:
- **Tool**: vitest (unit), bash/curl (integration)
- **Steps**: Exact commands with expected outputs
- **Evidence**: Test output, coverage reports, terminal logs

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Project setup + test infrastructure

Wave 2 (After Wave 1):
├── Task 2: Core types + schema mapping (critical path)
└── Task 3: Nano RPC client (independent)

Wave 3 (After Task 2):
├── Task 4: Server handler + spent set
└── Task 5: Client handler

Wave 4 (After Wave 3):
└── Task 6: Integration tests (mainnet)

Wave 5 (After Wave 4):
├── Task 7: Example applications
└── Task 8: Documentation

Critical Path: 1 → 2 → 4 → 6 → 7
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 4, 5 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 2, 3 | 6 | 5 |
| 5 | 2 | 6 | 4 |
| 6 | 4, 5 | 7 | None |
| 7 | 6 | 8 | None |
| 8 | 7 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Category |
|------|-------|---------------------|
| 1 | 1 | quick |
| 2 | 2, 3 | unspecified-low (parallel) |
| 3 | 4, 5 | unspecified-low (parallel) |
| 4 | 6 | deep |
| 5 | 7, 8 | quick (parallel) |

---

## TODOs

---

- [x] 1. Project Setup + Test Infrastructure

  **What to do**:
  - Initialize monorepo with npm workspaces
  - Create package structure: `packages/core`, `packages/client`, `packages/server`, `packages/rpc`
  - Create example structure: `examples/client`, `examples/server`
  - Configure TypeScript with strict mode, path aliases
  - Configure vitest for workspace testing
  - Add initial passing test to verify setup
  - Create `e2e.env.example` template file with required env vars
  - Add `e2e.env` to `.gitignore`

  **Must NOT do**:
  - Don't add production dependencies yet (only dev deps)
  - Don't add CI/CD configuration
  - Don't add linting/formatting tools
  - Don't commit actual `e2e.env` file (only the `.example` template)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Boilerplate setup, no complex logic
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  
  **Pattern References**:
  - Faremeter monorepo structure: https://github.com/faremeter/faremeter - package organization pattern
  - x402 TypeScript workspace: https://github.com/coinbase/x402/tree/main/typescript - pnpm workspace pattern
  
  **Documentation References**:
  - npm workspaces: https://docs.npmjs.com/cli/v7/using-npm/workspaces
  - vitest workspaces: https://vitest.dev/guide/workspace.html

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] Create example test: `packages/core/src/__tests__/setup.test.ts` with `test('setup works', () => expect(true).toBe(true))`
  - [ ] `npm test -- --run` → PASS (1 test)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Monorepo structure is valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. ls packages/ → shows core, client, server, rpc directories
      2. ls examples/ → shows client, server directories
      3. cat package.json | grep workspaces → shows "packages/*", "examples/*"
    Expected Result: All directories exist, workspaces configured
    Evidence: Terminal output captured

  Scenario: TypeScript compiles
    Tool: Bash
    Preconditions: Setup complete
    Steps:
      1. npx tsc --noEmit
    Expected Result: Exit code 0, no errors
    Evidence: Terminal output captured

  Scenario: Test runner works
    Tool: Bash
    Preconditions: vitest configured
    Steps:
      1. npm test -- --run
    Expected Result: "1 passed" in output, exit code 0
    Evidence: Test output captured

  Scenario: Environment template exists
    Tool: Bash
    Preconditions: Setup complete
    Steps:
      1. cat e2e.env.example
      2. Assert contains NANO_TEST_SEED=
      3. Assert contains NANO_RPC_URL=
      4. Assert contains NANO_SERVER_ADDRESS=
      5. grep -q "e2e.env" .gitignore
    Expected Result: Template exists, actual file gitignored
    Evidence: File contents and gitignore check
  ```

  **Commit**: YES
  - Message: `feat(setup): initialize monorepo with npm workspaces and vitest`
  - Files: `package.json`, `tsconfig.json`, `vitest.config.ts`, `packages/*/package.json`, `examples/*/package.json`, `e2e.env.example`, `.gitignore`
  - Pre-commit: `npm test -- --run`

---

- [x] 2. Core Types + Schema Mapping

  **What to do**:
  - Define NanoSession-specific types (NanoSessionRequirements, NanoSessionPayload, NanoSessionExtra)
  - Define x402-compatible types (PaymentRequirements, PaymentPayload) based on x402 SDK
  - Implement bidirectional mapping functions:
    - `toX402Requirements(headers: NanoSessionHeaders): PaymentRequirements`
    - `fromX402Requirements(req: PaymentRequirements): NanoSessionHeaders`
    - `toX402Payload(blockHash: string, requirements: PaymentRequirements): PaymentPayload`
  - Implement validation using Zod schemas
  - Add TAG_MODULUS constant (10,000,000)
  - Add scheme constants: SCHEME="nano-session", NETWORK="nano:mainnet", ASSET="XNO"

  **Must NOT do**:
  - Don't implement verification logic (that's server's job)
  - Don't make RPC calls
  - Don't add storage or state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Type definitions and pure functions, moderate complexity
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `docs/x402_NanoSession_rev3_Protocol.md:39-47` - TAG_MODULUS and tagging logic
  - `docs/x402_NanoSession_rev3_Protocol.md:51-64` - Header names and verification flow
  
  **API/Type References**:
  - x402 PaymentRequirements: `{scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra}`
  - x402 PaymentPayload: `{accepted: PaymentRequirements, payload: object, resource?: string, extensions?: object}`
  
  **External References**:
  - Zod validation: https://zod.dev/?id=basic-usage

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] RED: Write test `toX402Requirements converts NanoSession headers to PaymentRequirements`
  - [ ] RED: Write test `fromX402Requirements converts PaymentRequirements to NanoSession headers`
  - [ ] RED: Write test `validates tag is within TAG_MODULUS range`
  - [ ] RED: Write test `validates amount is multiple of TAG_MODULUS`
  - [ ] GREEN: Implement mapping functions to pass tests
  - [ ] REFACTOR: Extract constants, improve types

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: NanoSession headers map to x402 PaymentRequirements
    Tool: vitest
    Preconditions: Core package exists
    Steps:
      1. npm test -- --run packages/core
      2. Assert test "toX402Requirements converts headers" passes
      3. Assert output PaymentRequirements has scheme="nano-session"
      4. Assert output PaymentRequirements has network="nano:mainnet"
      5. Assert output extra contains tag, sessionId, tagModulus, expiresAt
    Expected Result: All assertions pass
    Evidence: Test output with specific assertions

  Scenario: Round-trip mapping preserves data
    Tool: vitest
    Preconditions: Both mapping functions implemented
    Steps:
      1. npm test -- --run packages/core
      2. Assert test "round-trip preserves data" passes
      3. Assert toX402 → fromX402 returns equivalent headers
    Expected Result: Data integrity preserved
    Evidence: Test output

  Scenario: Invalid tag rejected
    Tool: vitest
    Preconditions: Validation implemented
    Steps:
      1. npm test -- --run packages/core
      2. Assert test "rejects tag >= TAG_MODULUS" passes
      3. Assert Zod throws validation error for tag=10000000
    Expected Result: Validation error thrown
    Evidence: Test output with error message
  ```

  **Commit**: YES
  - Message: `feat(core): add x402 schema mapping and validation`
  - Files: `packages/core/src/types.ts`, `packages/core/src/mapping.ts`, `packages/core/src/validation.ts`, `packages/core/src/constants.ts`
  - Pre-commit: `npm test -- --run packages/core`

---

- [x] 3. Nano RPC Client

  **What to do**:
  - Create `NanoRpcClient` class with:
    - Constructor accepting array of RPC endpoint URLs
    - `getBlockInfo(hash: string): Promise<BlockInfo>` - calls `block_info` RPC
    - `confirmBlock(hash: string): Promise<void>` - calls `block_confirm` RPC
    - `getAccountInfo(address: string): Promise<AccountInfo>` - calls `account_info` RPC
  - Implement endpoint failover (try next URL on failure)
  - Define response types: BlockInfo, AccountInfo
  - Add retry logic with exponential backoff
  - Support both mainnet and beta network endpoints

  **Must NOT do**:
  - Don't implement websocket subscriptions (polling only for MVP)
  - Don't cache responses
  - Don't add authentication

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: HTTP client wrapper, moderate complexity
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Documentation References**:
  - Nano RPC Protocol: https://docs.nano.org/commands/rpc-protocol/
  - `block_info` RPC: https://docs.nano.org/commands/rpc-protocol/#block_info
  - `block_confirm` RPC: https://docs.nano.org/commands/rpc-protocol/#block_confirm
  - `account_info` RPC: https://docs.nano.org/commands/rpc-protocol/#account_info

  **External References**:
  - Public Nano RPC: https://rpc.nano.to (community endpoint)
  - Nano Node docs: https://docs.nano.org/running-a-node/overview/

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] RED: Write test `getBlockInfo returns block data` (mocked fetch)
  - [ ] RED: Write test `failover tries next endpoint on failure`
  - [ ] RED: Write test `retry with backoff on transient error`
  - [ ] GREEN: Implement NanoRpcClient
  - [ ] REFACTOR: Extract retry logic, improve error types

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: RPC client fetches block info (mocked)
    Tool: vitest
    Preconditions: RPC package exists
    Steps:
      1. npm test -- --run packages/rpc
      2. Assert test "getBlockInfo returns block data" passes
      3. Assert BlockInfo contains: hash, amount, confirmed, subtype, link
    Expected Result: Block info parsed correctly
    Evidence: Test output

  Scenario: Failover works on endpoint failure (mocked)
    Tool: vitest
    Preconditions: Multiple endpoints configured
    Steps:
      1. npm test -- --run packages/rpc
      2. Assert test "failover tries next endpoint" passes
      3. Mock first endpoint to fail, second to succeed
      4. Assert second endpoint was called
    Expected Result: Request succeeded via failover
    Evidence: Test output showing both endpoints tried

  Scenario: Real RPC call to public node
    Tool: Bash
    Preconditions: Network access, known block hash
    Steps:
      1. NANO_RPC_URL=https://rpc.nano.to npx tsx packages/rpc/src/__tests__/live.test.ts
      2. Use known block hash from mainnet
      3. Assert response contains "confirmed": "true"
    Expected Result: Real block info retrieved
    Evidence: Response JSON logged
  ```

  **Commit**: YES
  - Message: `feat(rpc): add Nano RPC client with failover`
  - Files: `packages/rpc/src/client.ts`, `packages/rpc/src/types.ts`, `packages/rpc/src/__tests__/client.test.ts`
  - Pre-commit: `npm test -- --run packages/rpc`

---

- [x] 4. Server Handler + Spent Set

  **What to do**:
  - Implement `SpentSetStorage` interface:
    ```ts
    interface SpentSetStorage {
      has(blockHash: string): Promise<boolean>;
      add(blockHash: string): Promise<void>;
    }
    ```
  - Implement `InMemorySpentSet` default implementation
  - Implement `NanoSessionFacilitatorHandler` matching Faremeter's FacilitatorHandler:
    - `getSupported()` - returns nano-session scheme info
    - `getRequirements(args)` - enriches requirements with tag, expiry
    - `handleVerify(requirements, payload)` - verifies block exists and matches
    - `handleSettle(requirements, payload)` - verifies + marks spent
  - Verification logic:
    1. Parse blockHash from payload
    2. Call RPC `block_info` to get block details
    3. Verify block.confirmed === true
    4. Verify block.link matches payTo address
    5. Verify block.amount % TAG_MODULUS === expected tag
    6. Check blockHash not in spent set
    7. Add to spent set on success

  **Must NOT do**:
  - Don't implement persistent SpentSet (just interface + in-memory)
  - Don't implement rate limiting
  - Don't add middleware wrappers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Core verification logic, needs careful implementation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `docs/x402_NanoSession_rev3_Protocol.md:59-64` - Server verification flow
  - Faremeter FacilitatorHandler: `packages/types/src/facilitator.ts` (from research)
  
  **API/Type References**:
  - FacilitatorHandler interface: `{getSupported, getRequirements, handleVerify, handleSettle}`
  - Handler returns `null` when scheme doesn't match (not error)

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] RED: Write test `SpentSet.has returns false for new hash`
  - [ ] RED: Write test `SpentSet.add then has returns true`
  - [ ] RED: Write test `handleVerify returns valid for confirmed block`
  - [ ] RED: Write test `handleVerify returns invalid for unconfirmed block`
  - [ ] RED: Write test `handleSettle rejects duplicate blockHash`
  - [ ] RED: Write test `returns null for non-matching scheme`
  - [ ] GREEN: Implement handler and spent set
  - [ ] REFACTOR: Improve error messages, add logging hooks

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Spent set prevents double-spend
    Tool: vitest
    Preconditions: Server package exists
    Steps:
      1. npm test -- --run packages/server
      2. Assert test "handleSettle rejects duplicate blockHash" passes
      3. Assert first settlement succeeds
      4. Assert second settlement with same hash returns error
    Expected Result: Double-spend prevented
    Evidence: Test output with rejection message

  Scenario: Verification checks block confirmation
    Tool: vitest
    Preconditions: RPC client mocked
    Steps:
      1. npm test -- --run packages/server
      2. Assert test "handleVerify returns invalid for unconfirmed" passes
      3. Mock block_info to return confirmed=false
      4. Assert handleVerify returns {isValid: false}
    Expected Result: Unconfirmed blocks rejected
    Evidence: Test output

  Scenario: Handler returns null for wrong scheme
    Tool: vitest
    Preconditions: Handler implemented
    Steps:
      1. npm test -- --run packages/server
      2. Assert test "returns null for non-matching scheme" passes
      3. Pass requirements with scheme="evm-exact"
      4. Assert handler returns null (not error)
    Expected Result: Non-matching schemes ignored
    Evidence: Test output
  ```

  **Commit**: YES
  - Message: `feat(server): add FacilitatorHandler with spent set`
  - Files: `packages/server/src/handler.ts`, `packages/server/src/spent-set.ts`, `packages/server/src/__tests__/`
  - Pre-commit: `npm test -- --run packages/server`

---

- [x] 5. Client Handler

  **What to do**:
  - Implement `NanoSessionPaymentHandler` matching x402's PaymentHandler pattern:
    - Accept PaymentRequirements, return PaymentExecer
    - PaymentExecer.exec() creates and broadcasts Nano send block
  - Implement Nano block signing:
    - Accept seed/private key from environment
    - Calculate work (or use work server)
    - Sign send block with ed25519
    - Broadcast via RPC `process`
  - Support budget limits (max spend per request, daily budget)

  **Must NOT do**:
  - Don't implement wallet UI
  - Don't store keys (accept from env only)
  - Don't implement work generation (use external work server or precomputed)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Crypto operations require care, moderate complexity
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - x402 PaymentHandler pattern: `(context, accepts) => Promise<PaymentExecer[]>`
  - PaymentExecer: `{requirements, exec: () => Promise<{payload}>}`
  
  **External References**:
  - Nano block signing: https://docs.nano.org/integration-guides/key-management/
  - nanocurrency-js library: https://github.com/AnotherDesign/nanocurrency-js (for reference)
  - Nano work generation: https://docs.nano.org/integration-guides/work-generation/

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] RED: Write test `handler returns execer for matching scheme`
  - [ ] RED: Write test `handler returns empty for non-matching scheme`
  - [ ] RED: Write test `execer.exec creates valid send block` (mocked broadcast)
  - [ ] RED: Write test `budget limit prevents overspend`
  - [ ] GREEN: Implement client handler
  - [ ] REFACTOR: Extract signing logic, improve key handling

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Client creates payment for matching requirements
    Tool: vitest
    Preconditions: Client package exists
    Steps:
      1. npm test -- --run packages/client
      2. Assert test "handler returns execer for matching scheme" passes
      3. Pass requirements with scheme="nano-session"
      4. Assert returned PaymentExecer has requirements and exec function
    Expected Result: Execer created for matching scheme
    Evidence: Test output

  Scenario: Budget limit enforced
    Tool: vitest
    Preconditions: Budget tracking implemented
    Steps:
      1. npm test -- --run packages/client
      2. Assert test "budget limit prevents overspend" passes
      3. Set budget to 1000 raw, request payment of 2000 raw
      4. Assert error thrown with budget exceeded message
    Expected Result: Payment rejected due to budget
    Evidence: Test output with error

  Scenario: Block signing produces valid signature
    Tool: vitest
    Preconditions: Signing logic implemented
    Steps:
      1. npm test -- --run packages/client
      2. Assert test "creates valid send block" passes
      3. Verify block hash matches expected format (64 hex chars)
      4. Verify signature can be verified with public key
    Expected Result: Valid block created
    Evidence: Test output with block hash
  ```

  **Commit**: YES
  - Message: `feat(client): add PaymentHandler with block signing`
  - Files: `packages/client/src/handler.ts`, `packages/client/src/signing.ts`, `packages/client/src/__tests__/`
  - Pre-commit: `npm test -- --run packages/client`

---

- [x] 6. Integration Tests (Mainnet)

  **What to do**:
  - Create integration test that performs real payment on mainnet:
    1. Start mock resource server (Node http)
    2. Client requests protected resource → gets 402
    3. Client parses PaymentRequirements
    4. Client creates and broadcasts real Nano payment
    5. Client retries with blockHash
    6. Server verifies via real RPC
    7. Server returns 200 with resource
  - Use small amounts (0.000001 XNO = 1000000000000000000000000 raw)
  - Document actual XNO spent in test output
  - **Source environment from `./e2e.env`** using dotenv or shell sourcing
  - Support fallback to direct env vars if `e2e.env` doesn't exist

  **Environment File (`./e2e.env`):**
  ```bash
  # Copy from e2e.env.example and fill in values
  NANO_TEST_SEED=your_64_char_hex_seed_here
  NANO_RPC_URL=https://rpc.nano.to
  NANO_SERVER_ADDRESS=nano_your_receiving_address
  NANO_MAX_SPEND=1000000000000000000000000000  # 0.001 XNO in raw
  ```

  **Must NOT do**:
  - Don't spend more than 0.001 XNO per test run
  - Don't commit seed to repo (e2e.env is gitignored)
  - Don't skip tests if seed not provided (fail gracefully with skip message)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: E2E test with real network calls, requires careful orchestration
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (solo)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Documentation References**:
  - `docs/x402_NanoSession_rev3_Protocol.md` - Full verification flow
  - Nano RPC `process`: https://docs.nano.org/commands/rpc-protocol/#process

  **Acceptance Criteria**:

  **TDD Steps:**
  - [ ] RED: Write integration test script structure
  - [ ] GREEN: Implement full flow with real mainnet calls
  - [ ] Document: Add README with test wallet setup instructions

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full payment flow on mainnet
    Tool: Bash
    Preconditions: ./e2e.env exists with valid credentials, wallet has balance
    Steps:
      1. source ./e2e.env && npm run test:integration
      2. Assert output contains "Payment broadcast: hash=<64-char-hex>"
      3. Assert output contains "Verification: confirmed=true"
      4. Assert output contains "Access granted: status=200"
      5. Assert output contains "XNO spent: <amount>"
    Expected Result: Full flow completes successfully
    Evidence: Terminal output with all steps logged

  Scenario: Graceful skip without e2e.env
    Tool: Bash
    Preconditions: ./e2e.env does not exist, NANO_TEST_SEED not set
    Steps:
      1. mv ./e2e.env ./e2e.env.bak 2>/dev/null || true
      2. unset NANO_TEST_SEED && npm run test:integration
      3. Assert output contains "Skipping integration tests: NANO_TEST_SEED not set"
      4. Assert exit code 0 (skip, not fail)
      5. mv ./e2e.env.bak ./e2e.env 2>/dev/null || true
    Expected Result: Tests skipped gracefully
    Evidence: Terminal output

  Scenario: Budget enforcement in integration
    Tool: Bash
    Preconditions: ./e2e.env exists
    Steps:
      1. NANO_MAX_SPEND=1 source ./e2e.env && npm run test:integration
      2. Assert error about budget exceeded (1 raw is impossibly small)
    Expected Result: Budget prevents overspend
    Evidence: Error output
  ```

  **Commit**: YES
  - Message: `test(integration): add mainnet integration tests`
  - Files: `test/integration/payment-flow.test.ts`, `test/integration/README.md`
  - Pre-commit: `npm test -- --run` (unit tests only, integration requires seed)

---

- [x] 7. Example Applications

  **What to do**:
  - Create example server (`examples/server/`):
    - Simple HTTP server with one protected endpoint
    - Uses @nanosession/server handler
    - Returns 402 with PaymentRequirements for unauthenticated requests
    - Verifies payment and returns resource
  - Create example client (`examples/client/`):
    - Fetch wrapper that handles 402 automatically
    - Uses @nanosession/client handler
    - Demonstrates budget configuration
  - Add README with usage instructions for each example

  **Must NOT do**:
  - Don't add Express/Fastify (use Node http module)
  - Don't add frontend UI
  - Don't over-engineer (minimal viable examples)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple glue code using existing packages
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 8
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - Faremeter examples: https://github.com/faremeter/faremeter/tree/main/scripts
  - x402 examples: https://github.com/coinbase/x402/tree/main/examples

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Example server starts and returns 402
    Tool: Bash
    Preconditions: Examples built
    Steps:
      1. cd examples/server && npx tsx src/index.ts &
      2. sleep 1
      3. curl -s http://localhost:3000/protected
      4. Assert response status is 402
      5. Assert response contains X-Payment-Required header
      6. kill server process
    Expected Result: Server returns 402 for protected resource
    Evidence: curl output with headers

  Scenario: Example client handles 402 automatically
    Tool: Bash
    Preconditions: Server running, ./e2e.env exists with valid credentials
    Steps:
      1. Start server in background
      2. source ./e2e.env && cd examples/client && npx tsx src/index.ts
      3. Assert output shows "Received 402, paying..."
      4. Assert output shows "Payment complete, retrying..."
      5. Assert output shows "Resource received: ..."
    Expected Result: Client completes payment flow
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat(examples): add example client and server`
  - Files: `examples/server/`, `examples/client/`, `examples/README.md`
  - Pre-commit: `npm test -- --run`

---

- [x] 8. Documentation

  **What to do**:
  - Create `docs/x402_NanoSession_rev3_Extension_x402_Compat.md`:
    - x402 compatibility section
    - Schema mapping table
    - PaymentRequirements structure
    - PaymentPayload structure
    - Facilitator interface compliance
  - Update root README.md with:
    - Package descriptions
    - Quick start guide
    - Link to x402 compatibility doc
  - Add inline JSDoc comments to exported functions

  **Must NOT do**:
  - Don't create separate API documentation site
  - Don't add excessive examples (link to examples/ instead)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation task
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (after Task 7)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `docs/x402_NanoSession_rev3_Protocol.md` - Existing spec format
  - `docs/x402_NanoSession_rev3_Intro.md` - Comparison table pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Extension doc follows spec format
    Tool: Bash
    Preconditions: Doc created
    Steps:
      1. cat docs/x402_NanoSession_rev3_Extension_x402_Compat.md
      2. Assert contains "## Abstract" section
      3. Assert contains "## Schema Mapping" section
      4. Assert contains PaymentRequirements example
      5. Assert frontmatter has title and status
    Expected Result: Doc follows existing patterns
    Evidence: File contents

  Scenario: README has quick start
    Tool: Bash
    Preconditions: README updated
    Steps:
      1. cat README.md
      2. Assert contains "## Quick Start" section
      3. Assert contains npm install command
      4. Assert contains usage example
    Expected Result: README provides onboarding
    Evidence: File contents
  ```

  **Commit**: YES
  - Message: `docs: add x402 compatibility extension and update README`
  - Files: `docs/x402_NanoSession_rev3_Extension_x402_Compat.md`, `README.md`
  - Pre-commit: None

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(setup): initialize monorepo with npm workspaces and vitest` | package.json, tsconfig.json, vitest.config.ts, packages/*/package.json | npm test -- --run |
| 2 | `feat(core): add x402 schema mapping and validation` | packages/core/src/*.ts | npm test -- --run packages/core |
| 3 | `feat(rpc): add Nano RPC client with failover` | packages/rpc/src/*.ts | npm test -- --run packages/rpc |
| 4 | `feat(server): add FacilitatorHandler with spent set` | packages/server/src/*.ts | npm test -- --run packages/server |
| 5 | `feat(client): add PaymentHandler with block signing` | packages/client/src/*.ts | npm test -- --run packages/client |
| 6 | `test(integration): add mainnet integration tests` | test/integration/*.ts | npm test -- --run |
| 7 | `feat(examples): add example client and server` | examples/**/*.ts | npm test -- --run |
| 8 | `docs: add x402 compatibility extension and update README` | docs/*.md, README.md | None |

---

## Success Criteria

### Verification Commands
```bash
# All unit tests pass
npm test -- --run
# Expected: All tests pass, >90% coverage

# TypeScript compiles
npx tsc --noEmit
# Expected: Exit code 0

# Integration tests (source credentials from e2e.env)
source ./e2e.env && npm run test:integration
# Expected: "Payment verified", "Access granted"

# Example server works
cd examples/server && npx tsx src/index.ts &
curl http://localhost:3000/protected
# Expected: HTTP 402 with payment headers

# Example client with payment (requires e2e.env)
source ./e2e.env && cd examples/client && npx tsx src/index.ts
# Expected: "Resource received: ..."
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All unit tests pass
- [x] Integration test completes on mainnet
- [x] Example applications work end-to-end
- [x] x402 compatibility documented
