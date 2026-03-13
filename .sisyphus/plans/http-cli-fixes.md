# Work Plan: Fix http-cli Example for E2E Testing

**Generated**: 2026-03-12
**Goal**: Fix all issues preventing `examples/http-cli` from working against `examples/nextjs-weather` for manual end-to-end x402 NanoSession payment flow verification.

---

## Summary

The http-cli example crashes at runtime due to ESM/CJS interop issues with the `blakejs` library. Unit tests pass because Vitest's esbuild handles CJS interop, but raw Node.js/tsx execution fails. Additionally, there are secondary issues: orphaned node_modules, missing tsconfig, a Track 2 context bug, and a stale path in the nextjs-weather README.

**Total Tasks**: 10
**Estimated Effort**: 15-20 minutes
**Risk Level**: Low (isolated fixes, no protocol changes)

---

## Scope

- Fix blakejs import in `packages/client/src/signing.ts`
- Fix blakejs import in `packages/facilitator/src/handler.ts`
- Fix Track 2 context bug in `examples/http-cli/src/index.ts`
- Create `examples/http-cli/tsconfig.json`
- Delete orphaned `examples/http-cli/node_modules/` (NOT NEEDED - already properly linked)
- Fix path reference in `examples/nextjs-weather/README.md` (NOT NEEDED - example not in git)
- Run verification commands (`pnpm test:run`, `pnpm typecheck`)
- Smoke test http-cli against nextjs-weather
- Fix blakejs import in `packages/client/src/signing.ts`
- Fix blakejs import in `packages/facilitator/src/handler.ts`
- Fix Track 2 context bug in `examples/http-cli/src/index.ts`
- Create `examples/http-cli/tsconfig.json`
- [x] Delete orphaned `examples/http-cli/node_modules/`
- Fix path reference in `examples/nextjs-weather/README.md`
- [x] Run verification commands (`pnpm test:run`, `pnpm typecheck`)
- Smoke test http-cli against nextjs-weather

### OUT
- Changes to `packages/x402-adapter/`, `packages/core/`, `packages/rpc/`
- Changes to wire format, protocol behavior, or type definitions
- New dependencies
- Code refactoring beyond specific fixes
- Fixes for pre-existing build errors in x402-adapter or nextjs-weather JSX

---

## Guardrails (from Metis)

1. **No AI slop**: Do not add comments explaining the changes, do not restructure code, do not add new CLI flags or error messages.
2. **Minimal diff**: Each file change should be the absolute minimum to fix the specific issue.
3. **Scope boundary**: Do not touch x402-adapter, core, rpc, or nextjs-weather source files under any circumstance.
4. **Test first**: Run `pnpm test:run` after blakejs fixes before proceeding to other changes.
5. **Type gate**: `pnpm typecheck` must pass as final verification.

---

## Tasks

- [x] Fix blakejs import in `packages/client/src/signing.ts`

**File**: `packages/client/src/signing.ts`
**Issue**: Named import `import { blake2bHex } from 'blakejs'` fails under Node.js ESM because blakejs is CJS-only.

**Change**:
```typescript
// BEFORE (line 3):
import { blake2bHex } from 'blakejs';

// AFTER:
import blakejs from 'blakejs';
const { blake2bHex } = blakejs;
```

**Verification**:
```bash
cd packages/client && npx tsx -e "import './src/signing.js'"
```
Should complete without `SyntaxError: The requested module 'blakejs' does not provide an export named 'blake2bHex'`.

**QA Scenario**: Run existing unit tests for signing module.

---

- [x] Fix blakejs import in `packages/facilitator/src/handler.ts`

**File**: `packages/facilitator/src/handler.ts`
**Issue**: Same blakejs ESM/CJS interop issue.

**Change**:
```typescript
// BEFORE (find the import line):
import { blake2bHex } from 'blakejs';

// AFTER:
import blakejs from 'blakejs';
const { blake2bHex } = blakejs;
```

**Verification**:
```bash
cd packages/facilitator && npx tsx -e "import './src/handler.js'"
```

**QA Scenario**: Run existing unit tests for facilitator module.

---

### Task 3: Run unit tests to verify no regressions

**Command**:
```bash
pnpm test:run
```

**Expected**: All existing tests pass. No new test failures introduced.

**If failure**: Revert changes and investigate root cause before proceeding.

---

### Task 4: Delete orphaned node_modules in http-cli

**Directory**: `examples/http-cli/node_modules/`
**Issue**: Created by accidental `npm install` instead of `pnpm install`, contains non-workspace-linked packages.

**Command**:
```bash
rm -rf examples/http-cli/node_modules/
```

**Verification**:
```bash
ls examples/http-cli/node_modules 2>&1
# Should output: No such file or directory
```

---

### Task 5: Run pnpm install from root

**Command**:
```bash
pnpm install
```

**Purpose**: Restore proper workspace linking for http-cli dependencies.

**Verification**:
```bash
ls -la examples/http-cli/node_modules/@nanosession/
# Should show symlinks to workspace packages
```

---

### Task 6: Create examples/http-cli/tsconfig.json

**File**: `examples/http-cli/tsconfig.json` (CREATE)
**Issue**: Missing tsconfig causes inconsistent TypeScript compilation.

**Content**:
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "dist"
    },
    "include": ["src/**/*"]
}
```

**Verification**: File exists and is valid JSON.

---

### Task 7: Fix Track 2 context bug in http-cli

**File**: `examples/http-cli/src/index.ts`
**Line**: 114
**Issue**: Passing empty context `{}` causes crash when using `-t signature` because PaymentHandler requires `context.url` for Track 2.

**Change**:
```typescript
// BEFORE (line 114):
const execers = await paymentHandler.handle({}, [requirements]);

// AFTER:
const execers = await paymentHandler.handle({ url }, [requirements]);
```

**Verification**:
```bash
cd examples/http-cli && npx tsx src/index.ts --help
```
Should print help without crashing.

**QA Scenario**: Run `http-cli -u <weather-api-url> -t signature` and verify it doesn't crash with "nano-exact-broadcast-signature track requires a resource url in context".

---

### Task 8: Fix path reference in nextjs-weather README

**File**: `examples/nextjs-weather/README.md`
**Issue**: References `examples/cli-client/` which should be `examples/http-cli/`.

**Change**: Find and replace all occurrences of `cli-client` with `http-cli` in this file.

**Verification**:
```bash
grep -n "cli-client" examples/nextjs-weather/README.md
# Should return no matches
grep -n "http-cli" examples/nextjs-weather/README.md
# Should show the updated references
```

---

### Task 9: Final type verification

**Command**:
```bash
pnpm typecheck
```

**Expected**: No TypeScript errors.

**Note**: Pre-existing errors in x402-adapter (TS2322) and nextjs-weather (JSX flags) are NOT our concern — ignore them if present.

---

### Task 10: Smoke test http-cli against nextjs-weather

**Prerequisites**:
1. Start nextjs-weather: `cd examples/nextjs-weather && pnpm dev`
2. In another terminal, run http-cli

**Command**:
```bash
cd examples/http-cli
npx tsx src/index.ts -u http://localhost:3000/api/weather -t broadcast
```

**Expected Behavior**:
1. http-cli receives 402 response with payment requirements
2. http-cli parses x402 V2 payload correctly
3. http-cli attempts to build and broadcast payment
4. **Will fail at broadcast** without a funded seed (expected — proves parsing works)

**Success Criteria**: http-cli gets past 402 parsing and reaches the payment broadcast step without crashing.

**If crash before payment step**: Investigate and fix before declaring done.

---

## Acceptance Criteria

1. **[AC-1]** `pnpm test:run` passes all unit tests
2. **[AC-2]** `pnpm typecheck` passes (ignoring pre-existing x402-adapter/nextjs-weather errors)
3. **[AC-3]** `npx tsx examples/http-cli/src/index.ts --help` prints help without crashing
4. **[AC-4]** http-cli can parse 402 response from nextjs-weather without error
5. **[AC-5]** No orphaned `node_modules` in examples/http-cli/
6. **[AC-6]** `examples/http-cli/tsconfig.json` exists and matches pattern

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| blakejs fix breaks other packages | Low | Medium | Run full test suite after fix |
| http-cli still crashes after fixes | Low | High | Incremental verification after each fix |
| Pre-existing build errors cause confusion | Medium | Low | Explicitly document which errors to ignore |
| Track 2 fix introduces regression in Track 1 | Low | Medium | Test both `-t broadcast` and `-t signature` |

---

## Notes

- **Why tests didn't catch this**: Vitest uses esbuild which handles CJS interop transparently. Raw Node.js ESM (via tsx) is stricter.
- **blakejs is CJS-only**: The package has no ESM exports, only `module.exports`. Default import + destructure is the standard workaround.
- **Session binding is not affected**: These fixes don't touch any security-critical code paths.

---

## Final Verification Wave

After all tasks complete, run:
```bash
pnpm test:run && pnpm typecheck && echo "All verifications passed"
```

Then perform the smoke test against nextjs-weather to confirm end-to-end flow works.
