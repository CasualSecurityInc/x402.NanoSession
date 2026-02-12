# Faremeter NanoSession Adapter

## TL;DR

> **Quick Summary**: Create `@nanosession/faremeter` adapter package that wraps our existing `@nanosession/*` implementation to expose Faremeter-compatible `PaymentHandler` and `FacilitatorHandler` interfaces, enabling NanoSession integration with the Faremeter x402 ecosystem.
> 
> **Deliverables**:
> - `packages/faremeter-plugin/` package with adapter code
> - Factory functions: `createPaymentHandler()`, `createFacilitatorHandler()`
> - TDD test suite verifying type compatibility and security
> - Working example server with Faremeter middleware
> - Production deployment documentation
> 
> **Estimated Effort**: Medium (~1 day)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7

---

## Context

### Original Request
Integrate NanoSession into the Faremeter x402 ecosystem by creating an adapter plugin. This validates our design in production before proposing upstream to x402.

### Interview Summary
**Key Discussions**:
- Package location: Inside this monorepo as `packages/faremeter-plugin/`
- Package name: `@nanosession/faremeter`
- Strategy: Thin adapter wrapping existing `@nanosession/*` packages
- Test strategy: TDD with vitest
- Scope: Full integration (adapter + middleware example + docs)

**Research Findings**:
- Faremeter uses `{scheme, network}` tuple matching for plugin selection
- Required interfaces: `PaymentHandler` (client), `FacilitatorHandler` (server)
- Our existing implementation is ~90% compatible; main changes are type mapping
- Solana implementation provides pattern: `createPaymentHandler()` / `createFacilitatorHandler()` factory functions

### Metis Review
**Identified Gaps** (addressed):
- Type signature compatibility: CONFIRMED via direct source code review
- Session binding security: PRESERVED in adapter design
- Example scope: LOCKED to minimal (single endpoint)
- Spent set warning: MANDATED in example code
- TypeScript config: ADDED to task list

---

## Work Objectives

### Core Objective
Enable NanoSession payments through Faremeter middleware by providing adapter functions that convert between our interfaces and Faremeter's plugin system.

### Concrete Deliverables
- `packages/faremeter-plugin/package.json` (ESM, workspace deps)
- `packages/faremeter-plugin/src/index.ts` (exports)
- `packages/faremeter-plugin/src/facilitator.ts` (server adapter)
- `packages/faremeter-plugin/src/client.ts` (client adapter)
- `packages/faremeter-plugin/src/__tests__/adapter.test.ts` (TDD tests)
- `examples/faremeter-server/` (minimal working example)
- `packages/faremeter-plugin/README.md` (package docs)
- `packages/faremeter-plugin/PRODUCTION.md` (deployment guidance)

### Definition of Done
- [ ] `pnpm --filter @nanosession/faremeter build` → exits 0
- [ ] `pnpm --filter @nanosession/faremeter test:run` → all tests pass
- [ ] Type checks pass: `const h: FacilitatorHandler = createFacilitatorHandler(...)`
- [ ] Example server responds 402 to unauthenticated requests
- [ ] Attack test verifies wrong tag (amount mismatch) is rejected
- [ ] Attack test verifies replay (already-spent hash) is rejected

### Must Have
- Factory functions matching Faremeter's expected signatures
- Type compatibility with `@faremeter/types`
- Tag-based session binding preservation (tag in amount = session identity; security critical)
- Spent set check (replay attack prevention)
- TDD test coverage
- Security warning in example code

### Must NOT Have (Guardrails)
- DO NOT modify core `@nanosession/*` packages (adapter only)
- DO NOT implement persistent spent set storage (document as user responsibility)
- DO NOT add rate limiting, auth, or business logic to example
- DO NOT create migration guide (no prior Nano-Faremeter integration exists)
- DO NOT add external dependencies to the adapter package beyond `@faremeter/types`
  - (Example package in `examples/faremeter-server/` MAY have additional deps like Express)
- DO NOT weaken tag-based session binding or skip tag validation

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: TDD
- **Framework**: vitest

### If TDD Enabled

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**
1. **RED**: Write failing test first
   - Test file: `packages/faremeter-plugin/src/__tests__/adapter.test.ts`
   - Test command: `pnpm --filter @nanosession/faremeter test:run`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `pnpm --filter @nanosession/faremeter test:run`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| Package Build | Bash | Run build command, check exit code and dist/ files |
| Tests | Bash | Run test command, check exit code and output |
| Example Server | Bash (curl) | Start server, send request, assert 402 response |
| Documentation | Bash | Check file existence |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Package scaffolding + TypeScript config
└── Task 2: Root config updates (tsconfig.json, vitest.config.ts)

Wave 2 (After Wave 1):
├── Task 3: FacilitatorHandler adapter (TDD)
├── Task 4: PaymentHandler adapter (TDD)
└── Task 5: Security attack tests

Wave 3 (After Wave 2):
├── Task 6: Example server with Faremeter middleware
└── Task 7: Documentation (README, PRODUCTION.md)

Critical Path: Task 1 → Task 3 → Task 6 → Task 7
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5, 6, 7 | 2 |
| 2 | None | 3, 4, 5 | 1 |
| 3 | 1, 2 | 6 | 4, 5 |
| 4 | 1, 2 | 6 | 3, 5 |
| 5 | 1, 2 | None | 3, 4 |
| 6 | 3, 4 | 7 | None |
| 7 | 6 | None | None |

---

## TODOs

- [ ] 1. Create package scaffolding

  **What to do**:
  - Create `packages/faremeter-plugin/` directory
  - Create `package.json` with ESM config following `packages/server/package.json` pattern
  - Create `tsconfig.json` extending root, following `packages/server/tsconfig.json` pattern
  - Create `src/index.ts` with placeholder exports
  - Add `@faremeter/types` as dependency
  - Add workspace deps: `@nanosession/core`, `@nanosession/server`, `@nanosession/client`

  **Must NOT do**:
  - Do NOT add external dependencies to this adapter package beyond `@faremeter/types`
  - Do NOT deviate from existing package structure patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward scaffolding following existing patterns
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None required for scaffolding

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `packages/server/package.json` - ESM package.json structure with workspace deps
  - `packages/server/tsconfig.json` - TypeScript composite project setup
  - `packages/server/src/index.ts` - Export pattern

  **External References**:
  - npm: `@faremeter/types` - Faremeter type definitions

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Package structure created correctly
    Tool: Bash
    Steps:
      1. ls packages/faremeter-plugin/
      2. Assert: package.json exists
      3. Assert: tsconfig.json exists
      4. Assert: src/index.ts exists
      5. cat packages/faremeter-plugin/package.json | grep "@nanosession/faremeter"
      6. Assert: name field is "@nanosession/faremeter"
    Expected Result: All files exist with correct content
    Evidence: Command outputs captured

  Scenario: Dependencies installable
    Tool: Bash
    Steps:
      1. pnpm install
      2. Assert: exit code 0
      3. Assert: no error about missing dependencies
    Expected Result: pnpm install succeeds
    Evidence: Command output captured
  ```

  **Commit**: YES
  - Message: `feat(faremeter): scaffold adapter package structure`
  - Files: `packages/faremeter-plugin/*`
  - Pre-commit: `pnpm install`

---

- [ ] 2. Update root TypeScript and Vitest config

  **What to do**:
  - Add path alias to `tsconfig.json`: `"@nanosession/faremeter": ["./packages/faremeter-plugin/src"]`
  - Add project reference to `tsconfig.json`: `{ "path": "./packages/faremeter-plugin" }`
  - Add alias to `vitest.config.ts`: `'@nanosession/faremeter': resolve(__dirname, './packages/faremeter-plugin/src')`

  **Must NOT do**:
  - Do NOT modify other path aliases
  - Do NOT change vitest global settings

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple config file edits
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `tsconfig.json:12-18` - Existing path aliases for @nanosession/* packages
  - `tsconfig.json:24-30` - Existing project references
  - `vitest.config.ts:8-12` - Existing alias configuration

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: TypeScript paths configured
    Tool: Bash
    Steps:
      1. grep "faremeter-plugin" tsconfig.json
      2. Assert: output contains "@nanosession/faremeter"
      3. Assert: output contains "path": "./packages/faremeter-plugin"
    Expected Result: Both path alias and project reference present
    Evidence: grep output captured

  Scenario: Vitest alias configured
    Tool: Bash
    Steps:
      1. grep "faremeter" vitest.config.ts
      2. Assert: output contains "@nanosession/faremeter"
    Expected Result: Vitest alias present
    Evidence: grep output captured
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(faremeter): scaffold adapter package structure`
  - Files: `tsconfig.json`, `vitest.config.ts`
  - Pre-commit: `pnpm build`

---

- [ ] 3. Implement FacilitatorHandler adapter (TDD)

  **What to do**:
  - RED: Write tests in `src/__tests__/adapter.test.ts` for:
    - `createFacilitatorHandler()` returns object satisfying `FacilitatorHandler` type
    - `getSupported()` returns correct scheme/network
    - `getRequirements()` filters by scheme and enriches with session data
    - `handleVerify()` returns null for non-matching schemes
    - `handleVerify()` returns valid response for correct payment
    - `handleSettle()` marks payment as spent
  - GREEN: Implement `src/facilitator.ts` with adapter logic
  - Adapter wraps `NanoSessionFacilitatorHandler` from `@nanosession/server`
  - Map types: `error` → `invalidReason`, add `network`/`transaction`/`payer` to SettleResponse

  **Must NOT do**:
  - Do NOT modify `@nanosession/server` source
  - Do NOT weaken tag-based session binding validation (tag encoded in amount)
  - Do NOT skip spent set checks

  **Security Model Note**:
  > Session binding in NanoSession is enforced via the **tag encoded in payment amount**, NOT via a sessionId field in PaymentPayload.
  > The server-side `requirements` object (containing `extra.tag` and `extra.sessionId`) is the source of truth.
  > Verification checks: `receivedAmount % tagModulus === expectedTag`.
  > The adapter must preserve this invariant by passing requirements correctly to the underlying handler.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core adapter logic requiring careful type mapping and security preservation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None needed for TypeScript adapter work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References** (existing code to follow):
  - `packages/server/src/handler.ts:61-245` - NanoSessionFacilitatorHandler to wrap
  - `packages/server/src/__tests__/handler.test.ts:23-80` - Test patterns and mocking

  **API/Type References** (contracts to implement):
  - Faremeter `FacilitatorHandler` interface (from research):
    ```typescript
    interface FacilitatorHandler {
      getSupported?: () => Promise<x402SupportedKind>[];
      getRequirements: (args: GetRequirementsArgs) => Promise<x402PaymentRequirements[]>;
      handleVerify?: (req, payment) => Promise<x402VerifyResponse | null>;
      handleSettle: (req, payment) => Promise<x402SettleResponse | null>;
    }
    ```
  - `packages/core/src/index.ts` - SCHEME, NETWORK, ASSET constants

  **Documentation References**:
  - `docs/x402_NanoSession_rev5_Protocol.md:§1.2` - Session binding security model
  - `docs/x402_NanoSession_rev5_Extension_x402_Compat.md:138-183` - FacilitatorHandler interface spec

  **WHY Each Reference Matters**:
  - `handler.ts` shows the exact methods to wrap and their signatures
  - Test file shows mocking patterns for NanoRpcClient
  - Protocol § 1.2 explains WHY sessionId validation is security-critical

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Test file created: `packages/faremeter-plugin/src/__tests__/adapter.test.ts`
  - [ ] Tests cover: type compatibility, getSupported, getRequirements, handleVerify, handleSettle
  - [ ] `pnpm --filter @nanosession/faremeter test:run` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Type compatibility verified at compile time
    Tool: Bash
    Preconditions: Package scaffolding complete
    Steps:
      1. pnpm --filter @nanosession/faremeter build
      2. Assert: exit code 0 (no TypeScript errors)
      3. grep "FacilitatorHandler" packages/faremeter-plugin/src/facilitator.ts
      4. Assert: imports FacilitatorHandler type
    Expected Result: Build passes, types imported
    Evidence: Build output captured

  Scenario: Tests pass for FacilitatorHandler adapter
    Tool: Bash
    Steps:
      1. pnpm --filter @nanosession/faremeter test:run
      2. Assert: exit code 0
      3. Assert: output contains "createFacilitatorHandler"
    Expected Result: All facilitator tests pass
    Evidence: Test output captured

  Scenario: Security comment present
    Tool: Bash
    Steps:
      1. grep -i "security.*session" packages/faremeter-plugin/src/facilitator.ts
      2. Assert: output contains security comment about session binding
    Expected Result: Security comment exists
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `feat(faremeter): implement FacilitatorHandler adapter with TDD`
  - Files: `packages/faremeter-plugin/src/facilitator.ts`, `packages/faremeter-plugin/src/__tests__/adapter.test.ts`
  - Pre-commit: `pnpm --filter @nanosession/faremeter test:run`

---

- [ ] 4. Implement PaymentHandler adapter (TDD)

  **What to do**:
  - RED: Add tests for:
    - `createPaymentHandler()` returns function satisfying `PaymentHandler` type
    - Handler filters accepts array by scheme
    - Handler returns PaymentExecer array with exec() method
    - exec() produces valid PaymentPayload
  - GREEN: Implement `src/client.ts` with adapter logic
  - Adapter wraps `NanoSessionPaymentHandler` from `@nanosession/client`

  **Must NOT do**:
  - Do NOT modify `@nanosession/client` source
  - Do NOT expose wallet secrets in adapter

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Simpler than facilitator; client handler has fewer methods
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `packages/client/src/handler.ts:16-78` - NanoSessionPaymentHandler to wrap
  - `packages/client/src/__tests__/handler.test.ts` - Client test patterns

  **API/Type References**:
  - Faremeter `PaymentHandler` type (from research):
    ```typescript
    type PaymentHandler = (
      context: RequestContext,
      accepts: x402PaymentRequirements[],
    ) => Promise<PaymentExecer[]>;
    ```

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests added to adapter.test.ts for PaymentHandler
  - [ ] `pnpm --filter @nanosession/faremeter test:run` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: PaymentHandler tests pass
    Tool: Bash
    Steps:
      1. pnpm --filter @nanosession/faremeter test:run
      2. Assert: exit code 0
      3. Assert: output contains "createPaymentHandler"
    Expected Result: All client tests pass
    Evidence: Test output

  Scenario: PaymentHandler filters by scheme
    Tool: Bash
    Steps:
      1. grep "scheme.*nano-session" packages/faremeter-plugin/src/client.ts
      2. Assert: filtering logic present
    Expected Result: Scheme filtering implemented
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `feat(faremeter): implement PaymentHandler adapter with TDD`
  - Files: `packages/faremeter-plugin/src/client.ts`, `packages/faremeter-plugin/src/__tests__/adapter.test.ts`
  - Pre-commit: `pnpm --filter @nanosession/faremeter test:run`

---

- [ ] 5. Add security attack tests

  **What to do**:
  - Add test: "rejects payment with wrong tag (amount mismatch)" — simulates receipt-stealing attack where attacker uses a valid block hash but the tag encoded in amount doesn't match the session's expected tag
  - Add test: "rejects already-spent block hash" (replay attack)
  - Add test: "returns null for non-matching scheme" (handler isolation)
  - Include comment explaining the tag-based session binding security model

  **Security Model Context**:
  > NanoSession binds payments to sessions via the **tag encoded in the payment amount**, NOT via a sessionId in the payload.
  > The server generates `requirements.extra.tag` and expects `receivedAmount % tagModulus === expectedTag`.
  > This prevents receipt-stealing: an attacker cannot reuse someone else's payment because the tag wouldn't match their session.
  > See: `packages/server/src/handler.ts:169-175` for tag validation logic.

  **Must NOT do**:
  - Do NOT skip or weaken these tests
  - Do NOT remove attack tests from CI

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Tests follow existing patterns from handler.test.ts
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `packages/server/src/__tests__/handler.test.ts:67-80` - Attack test patterns
  - `packages/server/src/handler.ts:169-175` - Tag validation logic (the actual security mechanism)

  **Documentation References**:
  - `docs/x402_NanoSession_rev5_Protocol.md:§1.2` - Receipt-stealing attack description
  - `AGENTS.md:§Security-First Protocol Development` - Attack test requirements

  **WHY Each Reference Matters**:
  - Attack tests are MANDATORY per AGENTS.md security requirements
  - Protocol § 1.2 describes exact attack vector to test against
  - handler.ts:169-175 shows the tag extraction and comparison logic to test

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Attack tests exist
    Tool: Bash
    Steps:
      1. grep -i "wrong.*tag\|amount.*mismatch\|receipt.*steal\|replay" packages/faremeter-plugin/src/__tests__/adapter.test.ts
      2. Assert: at least 2 attack test scenarios found
    Expected Result: Attack tests present
    Evidence: grep output

  Scenario: Attack tests pass
    Tool: Bash
    Steps:
      1. pnpm --filter @nanosession/faremeter test:run
      2. Assert: exit code 0
      3. Assert: output shows attack tests passed
    Expected Result: All security tests pass
    Evidence: Test output
  ```

  **Commit**: YES (groups with Task 3 or 4)
  - Message: `test(faremeter): add security attack tests for receipt-stealing prevention`
  - Files: `packages/faremeter-plugin/src/__tests__/adapter.test.ts`
  - Pre-commit: `pnpm --filter @nanosession/faremeter test:run`

---

- [ ] 6. Create example server with Faremeter middleware

  **What to do**:
  - Create `examples/faremeter-server/` directory
  - Create minimal Express server using `@faremeter/middleware`
  - Add single protected endpoint `/api/resource`
  - Wire up `createFacilitatorHandler()` from our adapter
  - Add GIANT WARNING comment about in-memory spent set
  - Create `README.md` with cURL test commands

  **Must NOT do**:
  - Do NOT implement persistent storage (document as user responsibility)
  - Do NOT add multiple endpoints, auth, or rate limiting
  - Do NOT include business logic beyond "return protected resource"

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Simple Express server setup following established patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `examples/server/` - Existing example server structure
  - `examples/server/src/index.ts` - Express setup pattern

  **External References**:
  - Faremeter middleware docs: `@faremeter/middleware` npm package
  - Faremeter example: `github.com/faremeter/faremeter/scripts/solana-example/server-express.ts`

  **WHY Each Reference Matters**:
  - Our existing example shows directory structure and package.json setup
  - Faremeter's Solana example shows exact middleware integration pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Example server responds 402 to unauthenticated request
    Tool: Bash
    Preconditions: Example dependencies installed
    Steps:
      1. cd examples/faremeter-server && pnpm install
      2. Start server in background: NANO_SERVER_ADDRESS=nano_test pnpm start &
      3. Sleep 2 seconds for startup
      4. curl -i http://localhost:3000/api/resource
      5. Assert: Response contains "HTTP/1.1 402"
      6. Assert: Response contains payment requirements header
      7. Kill background server
    Expected Result: 402 response with payment requirements
    Evidence: curl output captured

  Scenario: Security warning present in code
    Tool: Bash
    Steps:
      1. grep -i "warning.*memory\|production" examples/faremeter-server/src/index.ts
      2. Assert: warning comment found
    Expected Result: In-memory warning exists
    Evidence: grep output

  Scenario: README has cURL examples
    Tool: Bash
    Steps:
      1. grep "curl" examples/faremeter-server/README.md
      2. Assert: cURL command examples present
    Expected Result: Executable test commands documented
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `feat(examples): add Faremeter middleware example server`
  - Files: `examples/faremeter-server/*`
  - Pre-commit: `pnpm --filter ./examples/faremeter-server build`

---

- [ ] 7. Write documentation

  **What to do**:
  - Create `packages/faremeter-plugin/README.md`:
    - Quick Start (install, basic usage)
    - API Reference (factory function signatures)
    - Security Considerations (session binding, spent set)
  - Create `packages/faremeter-plugin/PRODUCTION.md`:
    - Spent set storage options (Redis, Postgres, DynamoDB)
    - Session management guidance
    - Scaling considerations
  - Update package exports in `src/index.ts` with JSDoc comments

  **Must NOT do**:
  - Do NOT write migration guide (no prior integration exists)
  - Do NOT add performance benchmarks
  - Do NOT duplicate protocol spec content (link instead)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation-focused task
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3, after Task 6)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `README.md` - Root README structure and tone (no per-package README exists in this repo)
  - `examples/README.md` - Example documentation format

  **Documentation References**:
  - `docs/x402_NanoSession_rev5_Protocol.md` - Link for security details
  - `docs/x402_NanoSession_rev5_Extension_x402_Compat.md` - x402 mapping reference

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Required documentation files exist
    Tool: Bash
    Steps:
      1. test -f packages/faremeter-plugin/README.md
      2. test -f packages/faremeter-plugin/PRODUCTION.md
      3. Assert: both exit code 0
    Expected Result: Both files exist
    Evidence: test command results

  Scenario: README contains required sections
    Tool: Bash
    Steps:
      1. grep -i "quick start\|installation" packages/faremeter-plugin/README.md
      2. grep -i "security" packages/faremeter-plugin/README.md
      3. Assert: both sections present
    Expected Result: Required sections exist
    Evidence: grep output

  Scenario: PRODUCTION.md mentions storage options
    Tool: Bash
    Steps:
      1. grep -i "redis\|postgres\|dynamodb" packages/faremeter-plugin/PRODUCTION.md
      2. Assert: at least one storage option mentioned
    Expected Result: Production storage guidance present
    Evidence: grep output

  Scenario: JSDoc comments on exports
    Tool: Bash
    Steps:
      1. grep "/\*\*" packages/faremeter-plugin/src/index.ts
      2. Assert: JSDoc comments present
    Expected Result: API documented with JSDoc
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `docs(faremeter): add README and production deployment guide`
  - Files: `packages/faremeter-plugin/README.md`, `packages/faremeter-plugin/PRODUCTION.md`, `packages/faremeter-plugin/src/index.ts`
  - Pre-commit: none

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1+2 | `feat(faremeter): scaffold adapter package structure` | packages/faremeter-plugin/*, tsconfig.json, vitest.config.ts | pnpm install |
| 3 | `feat(faremeter): implement FacilitatorHandler adapter with TDD` | src/facilitator.ts, src/__tests__/adapter.test.ts | pnpm test:run |
| 4 | `feat(faremeter): implement PaymentHandler adapter with TDD` | src/client.ts, src/__tests__/adapter.test.ts | pnpm test:run |
| 5 | `test(faremeter): add security attack tests` | src/__tests__/adapter.test.ts | pnpm test:run |
| 6 | `feat(examples): add Faremeter middleware example server` | examples/faremeter-server/* | pnpm build |
| 7 | `docs(faremeter): add README and production deployment guide` | README.md, PRODUCTION.md | none |

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
pnpm --filter @nanosession/faremeter build
# Expected: exit 0, dist/ files created

# All tests pass
pnpm --filter @nanosession/faremeter test:run
# Expected: exit 0, all tests green

# Example server responds 402
cd examples/faremeter-server && pnpm start &
curl -i http://localhost:3000/api/resource
# Expected: HTTP 402 with payment requirements

# Documentation exists
test -f packages/faremeter-plugin/README.md && test -f packages/faremeter-plugin/PRODUCTION.md
# Expected: exit 0
```

### Final Checklist
- [ ] Package builds without TypeScript errors
- [ ] All TDD tests pass (type compatibility, functionality, security)
- [ ] Attack tests verify session binding
- [ ] Example server returns 402 with proper headers
- [ ] Security warning present in example code
- [ ] README and PRODUCTION.md complete
- [ ] JSDoc comments on exported functions
