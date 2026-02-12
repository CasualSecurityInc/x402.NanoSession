# Monorepo Cleanup Finalization

## TL;DR

> **Quick Summary**: Complete the monorepo cleanup by updating file path references after moving e2e.env files to test/integration/
> 
> **Deliverables**:
> - Updated integration test with correct e2e.env path
> - Updated .gitignore with new e2e.env location
> - Updated README.md with correct integration test instructions
> - Updated test/integration/README.md with correct paths
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: YES - 3 files can be edited in parallel
> **Critical Path**: Edit files → Run tests to verify

---

## Context

### Already Completed (via Prometheus)
- ✅ Deleted 16 debug `test-*.mjs` files from root
- ✅ Deleted `DEBUG_SUMMARY.md`, `debug-output.txt`, `VERIFICATION.md`
- ✅ Moved `whitepaper_text.txt` and `x402-whitepaper.pdf` to `docs/references/`
- ✅ Moved `e2e.env` and `e2e.env.example` to `test/integration/`

### Remaining Work
The file moves created path mismatches that need to be fixed in code/docs.

---

## Work Objectives

### Core Objective
Fix all file path references after reorganizing the monorepo structure.

### Concrete Deliverables
- `test/integration/payment-flow.test.ts` - Update dotenv path
- `.gitignore` - Update e2e.env location pattern
- `README.md` - Update integration test instructions
- `test/integration/README.md` - Update setup instructions

### Definition of Done
- [x] `pnpm test` passes (unit tests)
- [x] `pnpm test:integration` passes (with e2e.env configured)
- [x] No hardcoded paths pointing to old locations

### Must Have
- Correct relative path from test file to e2e.env
- .gitignore ignores the new location
- Documentation reflects new structure

### Must NOT Have (Guardrails)
- No hardcoded Nano addresses in tests (already correct - addresses are derived)
- No references to deleted debug files
- No stale paths in documentation

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after (the existing tests ARE the verification)
- **Framework**: vitest

### Agent-Executed QA Scenarios (MANDATORY)

```
Scenario: Unit tests pass after cleanup
  Tool: Bash
  Preconditions: Dependencies installed (pnpm install)
  Steps:
    1. Run: pnpm test:run
    2. Assert: Exit code 0
    3. Assert: Output contains "passing" or all tests pass
  Expected Result: All unit tests pass
  Evidence: Terminal output captured

Scenario: Integration test skips gracefully without credentials
  Tool: Bash
  Preconditions: No e2e.env file (or empty NANO_TEST_SEED)
  Steps:
    1. Run: pnpm test:integration
    2. Assert: Exit code 0
    3. Assert: Output contains "Skipping" or similar skip message
  Expected Result: Tests skip gracefully, don't error
  Evidence: Terminal output captured
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - All Independent):
├── Task 1: Update integration test dotenv path
├── Task 2: Update .gitignore
└── Task 3: Update README.md integration section

Wave 2 (After Wave 1):
└── Task 4: Update test/integration/README.md

Wave 3 (After Wave 2):
└── Task 5: Verify tests pass
```

---

## TODOs

- [x] 1. Update integration test dotenv path

  **What to do**:
  - Change `dotenv.config({ path: './e2e.env' })` to `dotenv.config({ path: './test/integration/e2e.env' })`
  - This is a one-line change

  **Must NOT do**:
  - Change any other logic in the test file
  - Add hardcoded addresses

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (no special skills needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `test/integration/payment-flow.test.ts:9` - Line to change

  **Acceptance Criteria**:
  - [ ] Line 9 reads: `dotenv.config({ path: './test/integration/e2e.env' });`

  **Commit**: YES (groups with 2, 3, 4)
  - Message: `chore: update paths after monorepo cleanup`
  - Files: `test/integration/payment-flow.test.ts`

---

- [x] 2. Update .gitignore

  **What to do**:
  - Change `e2e.env` pattern to `test/integration/e2e.env` (or add both for safety)

  **Must NOT do**:
  - Remove any other ignore patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `.gitignore:19` - Current line: `e2e.env`

  **Acceptance Criteria**:
  - [ ] .gitignore contains pattern that ignores `test/integration/e2e.env`
  - [ ] Comment updated to reflect new location

  **Commit**: YES (groups with 1, 3, 4)

---

- [x] 3. Update README.md integration test section

  **What to do**:
  - Update lines 175-181 to reflect new e2e.env location:
    ```bash
    # Setup environment
    cp test/integration/e2e.env.example test/integration/e2e.env
    # Edit test/integration/e2e.env with your test credentials

    # Run integration tests
    source ./test/integration/e2e.env && pnpm test:integration
    ```

  **Must NOT do**:
  - Change any other sections

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `README.md:175-181` - Integration Tests section

  **Acceptance Criteria**:
  - [ ] `cp` command references `test/integration/e2e.env.example`
  - [ ] `source` command references `./test/integration/e2e.env`

  **Commit**: YES (groups with 1, 2, 4)

---

- [x] 4. Update test/integration/README.md

  **What to do**:
  - Update Setup section to reflect that e2e.env.example is now local:
    ```bash
    cp e2e.env.example e2e.env  # Files are now in this directory
    ```
  - The current text references root-level copy which is outdated

  **Must NOT do**:
  - Change HD derivation explanation or test flow description

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `test/integration/README.md:21-24` - Setup section

  **Acceptance Criteria**:
  - [ ] Setup instructions reflect local e2e.env.example location
  - [ ] Add note that files are in test/integration/ directory

  **Commit**: YES (groups with 1, 2, 3)

---

- [x] 5. Verify tests pass

  **What to do**:
  - Run `pnpm test:run` to verify unit tests pass
  - Run `pnpm test:integration` to verify integration tests skip gracefully (without credentials)

  **Must NOT do**:
  - Run with actual credentials (that's optional)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential - verification step)
  - **Parallel Group**: Wave 3
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  - `package.json` - Test scripts

  **Acceptance Criteria**:
  - [ ] `pnpm test:run` exits 0
  - [ ] `pnpm test:integration` exits 0 (graceful skip)

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1, 2, 3, 4 | `chore: update paths after monorepo cleanup` | All 4 files | pnpm test:run |

---

## Success Criteria

### Verification Commands
```bash
pnpm test:run           # Expected: All tests pass
pnpm test:integration   # Expected: Graceful skip (no e2e.env credentials)
ls test/integration/    # Expected: e2e.env, e2e.env.example, payment-flow.test.ts, README.md
```

### Final Checklist
- [x] All file path references updated
- [x] .gitignore ignores new location
- [x] Documentation accurate
- [x] Tests pass
