# AGENTS.md

## Project: x402.NanoSession
**Goal**: High-Frequency M2M Nano Payments using HTTP 402. Feeless, instant, session-bound. Compatible with the [coinbase/x402](https://docs.x402.org/) spec and evolving standard to the largest practical degree.

---

### 📦 Build/Test Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once (CI mode) |
| `pnpm test:integration` | Run E2E tests (real Nano transactions!) |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm build` | Build all packages |
| `pnpm clean` | Remove dist folders |

**Running a single test file:**
```bash
pnpm vitest run packages/core/src/__tests__/mapping.test.ts
pnpm vitest run test/integration/payment-flow.test.ts
```

**Running tests for a single package:**
```bash
pnpm --filter @nanosession/core test:run
pnpm --filter @nanosession/server test:run
```

**Adding dependencies:**
```bash
pnpm add zod --filter @nanosession/core        # Add to specific package
pnpm add -D vitest -w                           # Add to root workspace
```

**Workspace protocol**: Internal dependencies use `workspace:*` in package.json.

---

### 📂 Directory Structure

| Path | Purpose |
|------|---------|
| `/packages/` | Library packages: `core`, `rpc`, `server`, `client`, `faremeter-plugin` |
| `/examples/` | Working server + client demos |
| `/docs/` | **Source of truth** — Protocol specs (`x402_NanoSession_revX_*.md`) |
| `/docs/references/` | Read-only external refs (git submodule of coinbase-x402) |
| `/site/` | VitePress docs site (generated from `/docs/`) |
| `/test/integration/` | E2E tests with real Nano mainnet transactions |

---

### 🎨 Code Style Guidelines

**TypeScript Configuration:**
- Target: ES2022, Module: NodeNext
- `strict: true` — No implicit any, strict null checks
- Use `.js` extension in imports (ESM requirement)

**Imports:**
```typescript
// Node built-ins first
import { randomBytes } from 'crypto';

// External packages
import { describe, test, expect } from 'vitest';

// Internal packages (workspace)
import { SCHEME, NETWORK } from '@nanosession/core';
import type { PaymentRequirements } from '@nanosession/core';

// Relative imports with .js extension
import { InMemorySpentSet } from './spent-set.js';
import type { SpentSetStorage } from './spent-set.js';
```

**Naming Conventions:**
- Files: `kebab-case.ts` (e.g., `spent-set.ts`, `address-pool.ts`)
- Classes: `PascalCase` (e.g., `NanoSessionFacilitatorHandler`)
- Functions: `camelCase` (e.g., `toX402Requirements`, `getBlockInfo`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `TAG_MODULUS`, `SCHEME`)
- Types/Interfaces: `PascalCase` (e.g., `PaymentRequirements`, `VerifyResult`)

**Type Annotations:**
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `type` imports when importing only types: `import type { X } from '...'`

**Error Handling:**
```typescript
// Proper error narrowing
try {
  // ...
} catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error)
  };
}
```

**Formatting:**
- 2 spaces indentation (inferred from codebase)
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline

**Test Files:**
- Location: `packages/*/src/__tests__/*.test.ts`
- Integration tests: `test/integration/*.test.ts`
- Use `describe/test/expect` from vitest (globals enabled)
- Use `vi.fn()` for mocks, `vi.mock()` for module mocks

---

### ⚠️ Critical Context

- **Nano**: Feeless, instant cryptocurrency (sub-second finality)
- **HTTP 402**: Payment Required status code
- **Rev5**: Current active protocol revision
- **pnpm**: Required package manager (enforced via `packageManager` field)
- **ESM**: This is a pure ESM project — use `.js` extensions in imports

---

### 🧪 Integration Tests & RPC Configuration

Integration tests (`pnpm test:integration`) perform real Nano transactions on mainnet.

#### RPC URL Parameter Injection

RPC endpoint URLs support query parameters that get merged into each RPC request body. This enables API key authentication for paid RPC services:

```bash
# No credentials → local CPU/GPU PoW
NANO_RPC_URL=https://rpc.nano.org/proxy

# With credentials → RPC work_generate (params merged into request body)
NANO_RPC_URL=https://rpc.nano.to?key=YOUR-API-KEY
```

The test automatically detects credentials and chooses the appropriate PoW strategy:
- **URL has query params** → Use RPC `work_generate` with exponential backoff on 429 errors
- **URL has no query params** → Use local `nanocurrency.computeWork()`

#### Multiple Endpoints (Failover)

```bash
NANO_RPC_URLS=https://primary.example.com?key=ABC,https://backup.example.com
```

See `test/integration/e2e.env.example` for full configuration reference.

---

### 🔐 Security-First Protocol Development

**This protocol handles real money. Security is non-negotiable.**

#### The Receipt-Stealing Attack (Rev5 Security Model)

Before Rev5, the protocol had a critical vulnerability:

1. **Attack Vector**: Attacker monitors server's payment address
2. **Timing Window**: Client A pays, attacker sees the send-block hash on-chain
3. **Exploitation**: Attacker submits `{ blockHash: <stolen>, sessionId: <attacker's session> }`
4. **Result**: Attacker gets resource for free; Client A's payment is stolen

**Why This Matters**: Nano blocks are public. Anyone can see payment hashes. Without session binding, any hash could satisfy any request.

#### The Session Binding Invariant (MANDATORY)

> **Invariant**: A proof-of-payment (block hash) is valid for ONE and ONLY ONE session.

**Server MUST verify ALL of the following:**
1. Block exists on network
2. Block hash not already spent (spent-set check)
3. **Block amount encodes the EXACT tag for THIS session** ← Critical

```typescript
// Server verification (pseudo-code)
const expectedTag = sessions[sessionId].tag;
const actualTag = blockAmount % TAG_MODULUS;
if (actualTag !== expectedTag) {
  reject("Receipt does not belong to this session");
}
```

#### Security Checklist for Protocol Changes

Before any protocol modification, verify:

- [ ] **Receipt Theft**: Can an attacker use someone else's payment?
- [ ] **Replay Attack**: Can a receipt be reused within the same session?
- [ ] **Session Spoofing**: Can an attacker guess/forge session identifiers?
- [ ] **Double Spend**: Can the same payment satisfy multiple requests?
- [ ] **Timing Attack**: Is there a race condition window?
- [ ] **Frontier Issues**: Does this introduce block-lattice edge cases?

#### Attack Test Coverage (Required)

All security-critical code MUST have corresponding attack tests:

| Attack | Test Location | What It Verifies |
|--------|---------------|------------------|
| Frontrun (hash stealing) | `test/integration/payment-flow.test.ts` | Wrong sessionId rejected |
| Receipt Reuse | `test/integration/payment-flow.test.ts` | Same hash rejected twice |
| Session Spoofing | `test/integration/payment-flow.test.ts` | Unknown sessionId rejected |

**Never remove or weaken attack tests without explicit security review.**

#### Why "NanoSession" — The Name is a Security Reminder

The word "Session" in NanoSession is not incidental. Sessions are a **security primitive**, not an implementation detail. They bind payments to specific requests, preventing the receipt-stealing attack.

See: `docs/x402_NanoSession_rev5_Protocol.md` § Security Model
