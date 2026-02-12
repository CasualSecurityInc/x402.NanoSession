# AGENTS.md

## Project: x402.NanoSession
**Goal**: Create a standard for High-Frequency M2M Nano Payments using HTTP 402.

### 📦 Package Manager: pnpm

This monorepo uses **pnpm** with workspace protocol for local package linking.

**Common Commands:**
```bash
pnpm install          # Install all dependencies
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm build            # Build all packages
pnpm clean            # Remove dist folders
```

**Package-specific commands:**
```bash
pnpm --filter @nanosession/core test    # Run tests for core only
pnpm --filter "./packages/*" build      # Build all library packages
```

**Adding dependencies:**
```bash
pnpm add zod --filter @nanosession/core        # Add to specific package
pnpm add -D vitest -w                           # Add to root workspace
```

**Workspace protocol**: Internal dependencies use `workspace:*` in package.json to link locally.

### 📂 Directory Structure

*   **/packages**: Library packages (`@nanosession/core`, `rpc`, `server`, `client`)
*   **/examples**: Example applications (`server`, `client`)
*   **/docs**: **Source of Truth**. Contains the Markdown specifications for the protocol and its extensions.
    *   `x402_NanoSession_revX_Protocol.md`: The core specification.
    *   `x402_NanoSession_revX_Extension_...md`: Optional extensions.
*   **/site**: **Public Documentation Website**.
    *   Built with VitePress.
    *   Generates a static site from `/docs`.
    *   See `site/AGENTS.md` for build details.

### 🤖 Core Workflows

1.  **Developing Packages**:
    *   Run `pnpm test` from root for watch mode.
    *   Use `pnpm --filter <package> <command>` for package-specific work.
    *   Internal deps use `workspace:*` protocol.

2.  **Refining the Spec**:
    *   Edit files in `/docs`.
    *   Always respect the `_revX_` naming convention.
    *   Do **NOT** edit files in `/site/docs` directly; they are overwritten by the build script.

3.  **Building the Site**:
    *   `cd site`
    *   `SPEC_REV=rev3 pnpm docs:build`
    *   `pnpm docs:preview`

4.  **Deploying the Site**:
    *   Automatic via GitHub Actions on push to `main`.
    *   Workflow: `.github/workflows/deploy.yml`
    *   **Live URL**: https://csi.ninzin.net/x402.NanoSession/
    *   Note: The CasualSecurityInc org has a custom domain (`csi.ninzin.net`), so `cbrunnkvist.github.io` URLs redirect there.

### ⚠️ Critical Context
*   **Nano**: A feeless, instant cryptocurrency.
*   **HTTP 402**: The status code used for payment required.
 *   **Rev5**: The current active revision.
 *   **pnpm**: Required package manager (enforced via `packageManager` field).

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
