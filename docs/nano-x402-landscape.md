# Nano x402 Landscape

**Status**: Draft  
**Last Updated**: 2026-03-09

## Purpose

This document maps the current Nano + x402 implementation landscape in a neutral way.

It is not a "winner/loser" comparison. The space is early, and multiple implementation styles can coexist:

- Reference-first implementations that optimize for simplicity and onboarding
- Production-focused implementations that optimize for security controls and high-throughput operations

## Context

A visible implementation in this landscape is `@x402nano/facilitator`, which presents a lightweight facilitator flow for Nano over x402.

x402.NanoSession targets the same broad problem space, with additional protocol and operational features for machine-to-machine workloads.

## Review Methodology

This document includes a direct code review of the local git submodule at:

- `docs/references/facilitator` (submodule commit: `e7ce9e8`, reviewed on 2026-03-09)

Reviewed files:

- `docs/references/facilitator/README.md` (76 lines)
- `docs/references/facilitator/index.js` (210 lines)
- `docs/references/facilitator/package.json` (34 lines)
- `docs/references/facilitator/Dockerfile` (25 lines)
- `docs/references/facilitator/docker-compose.yml` (15 lines)

Limitations:

- This review covers the facilitator repository itself, not a full deep audit of transitive dependencies (`@x402/core`, `@x402nano/exact`, `@x402nano/helper`).
- No live network execution or load testing was performed in this pass.
- Security properties delegated to upstream packages are noted but not independently verified.

## Comparison Scope

This comparison focuses on publicly observable implementation characteristics and documented behavior. It is not a claim about maintainership authority, ecosystem governance, or long-term roadmap quality.

## Side-by-Side Snapshot

| Dimension | `@x402nano/facilitator` (reference-style) | x402.NanoSession (production-oriented) |
|---|---|---|
| Primary posture | Minimal facilitator integration | Session-bound protocol profile + facilitator/client libraries |
| Typical fit | Quick adoption, lower operational complexity | High-frequency APIs, stricter payment/session controls |
| State model | Thin request-layer wrapper around external scheme libraries | Explicit session registry and verification invariants |
| Proof binding | Delegated to scheme/dependency behavior | Session-bound amount + tag-based binding model |
| Replay hardening | Delegated to scheme/dependency behavior | Local spent-set replay checks plus network checks |
| Session spoofing | Delegated to scheme/dependency behavior | Session registry with issued-requirements verification |
| Reliability controls | Basic process + RPC wiring in facilitator service | Confirmation retry/failover-oriented behavior in RPC/client paths |
| Throughput path | Single-account flow simplicity | Extension path for sharded pools (Rev6 Extension A) |
| Code size | ~210 lines (index.js) | ~450 lines (handler.ts) + supporting packages |

## Technical Review: `@x402nano/facilitator`

### Architecture Overview

The facilitator is a thin Express.js wrapper around upstream x402 protocol packages:

```
Express HTTP Server (index.js)
    └── x402Facilitator (@x402/core)
            └── ExactNanoScheme (@x402nano/exact)
                    └── Helper (@x402nano/helper)
                            └── Nano RPC
```

**Key imports (index.js:14-18):**
```javascript
import { x402Facilitator } from '@x402/core/facilitator'
import { ExactNanoScheme } from '@x402nano/exact/facilitator'
import { URL } from '@x402nano/typescript-common'
import { Helper } from '@x402nano/helper'
```

### Endpoints

| Endpoint | Method | Purpose | Lines |
|----------|--------|---------|-------|
| `/verify` | POST | Verify payment without broadcasting | 163-171 |
| `/settle` | POST | Settle payment on Nano network | 176-184 |
| `/supported` | GET | List supported schemes/networks | 190-203 |

### Security Analysis

#### 1. Perimeter Authentication Only

**Evidence (index.js:59-86):**
```javascript
const authenticateBearerToken = (req, res, next) => {
  if (!process.env.AUTHORIZATION_BEARER_TOKEN) {
    return next()  // No auth if token not configured
  }
  // ... Bearer token validation
}
```

- Optional bearer token middleware
- If `AUTHORIZATION_BEARER_TOKEN` is unset, **all endpoints are unauthenticated**
- This is perimeter-level auth, not payment-level security

#### 2. No Visible Session Management

**Evidence (index.js:163-171):**
```javascript
app.post('/verify', async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body
  let verifyResult = await facilitator.verify(paymentPayload, paymentRequirements)
  res.json(verifyResult)
})
```

- `paymentRequirements` is accepted directly from request body
- No session registry or issuance tracking visible at this layer
- No verification that requirements were server-generated

#### 3. No Visible Spent-Set Tracking

**Evidence:** The entire `index.js` contains no spent-set, replay tracking, or double-spend prevention logic at the service layer. This is delegated to `@x402nano/exact`.

#### 4. Requirements Trust Model

The facilitator trusts the caller to provide correct `paymentRequirements`. This is appropriate when:
- The Resource Server and Facilitator are operated by the same entity
- The Resource Server has its own session management
- The upstream scheme libraries provide adequate protection

This differs from NanoSession's approach where requirements are server-generated and cryptographically bound to sessions.

### Dependency Analysis

**package.json (v0.1.0):**
```json
{
  "dependencies": {
    "@x402/core": "^2.3.1",
    "@x402nano/exact": "^0.1.1",
    "@x402nano/typescript-common": "^0.1.0",
    "bunyan": "^1.8.15",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^4.18.2"
  }
}
```

**Observations:**
- All x402 packages are early versions (0.1.x for x402nano/*)
- bunyan for structured logging (opt-in via `ENABLE_LOGGING`)

### Operational Characteristics

| Aspect | Implementation |
|--------|----------------|
| Deployment | Docker-first (image: `x402nano/facilitator:v0.1.0`) |
| Logging | Bunyan structured logging, opt-in via `ENABLE_LOGGING=true` |
| Verbosity | `LOGGING_VERBOSE=true` includes full context in logs |
| Lifecycle hooks | `onBeforeVerify`, `onAfterVerify`, `onBeforeSettle`, `onAfterSettle` |
| Network | Single network identifier (default: `nano:mainnet`) |
| Scaling | Single process, no sharding/queueing |

## Technical Review: x402.NanoSession Facilitator

For comparison, the NanoSession facilitator implementation in `packages/facilitator/src/handler.ts`:

### Security Controls

#### 1. Session Registry

**Evidence (handler.ts:93-99, 246-247):**
```typescript
// Session registry - maps sessionId to the PaymentRequirements that were issued.
// This prevents attackers from submitting payments with forged session IDs.
private sessionRegistry: SessionRegistry;

// On requirements generation:
this.sessionRegistry.set(sessionId, requirements);
this.activeSessionAmounts.set(sessionId, amount);
```

#### 2. Requirements Consistency Check

**Evidence (handler.ts:335-347):**
```typescript
// Requirements consistency check: do not trust mutated requirements
if (
  requirements.amount !== issuedRequirements.amount ||
  requirements.payTo !== issuedRequirements.payTo ||
  requirements.extra.nanoSession.tag !== issuedRequirements.extra.nanoSession.tag ||
  requirements.extra.nanoSession.resourceAmountRaw !== issuedRequirements.extra.nanoSession.resourceAmountRaw ||
  requirements.extra.nanoSession.tagAmountRaw !== issuedRequirements.extra.nanoSession.tagAmountRaw
) {
  return { isValid: false, error: 'Requirements mismatch for issued session' };
}
```

#### 3. Spent-Set Replay Prevention

**Evidence (handler.ts:431-440):**
```typescript
// Check if already spent
const isSpent = await this.spentSet.has(payload.payload.proof);
if (isSpent) {
  return { success: false, error: 'Payment already spent' };
}

// Mark as spent
await this.spentSet.add(payload.payload.proof);
```

#### 4. Confirmation Retry Logic

**Evidence (handler.ts:354-360):**
```typescript
// Simple retry logic for confirmation propagation delay
// WebSocket often sees block faster than RPC node marks it as confirmed
if (!blockInfo.confirmed) {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    blockInfo = await this.rpcClient.getBlockInfo(blockHash);
    if (blockInfo.confirmed) break;
  }
}
```

### Session Binding Model

NanoSession uses tag-based session binding:

1. **Tag generation**: Random 4-byte value modulo `TAG_MODULUS` (handler.ts:212-213)
2. **Amount encoding**: `amount = resourceAmountRaw + (tag * TAG_MULTIPLIER)` (handler.ts:224-225)
3. **Verification**: Block amount must exactly match the issued session amount (handler.ts:381-389)

This prevents receipt-theft attacks where an attacker observes a valid payment on-chain and replays it.

## What This Means Strategically

Both approaches are useful:

1. **Reference baseline for interoperability**
   NanoSession should treat lightweight facilitators as an interoperability target for baseline x402 compatibility testing.

2. **Differentiation for demanding workloads**
   NanoSession's value proposition is strongest where session security, replay resistance, and throughput control are hard requirements (for example: AI inference APIs, agent marketplaces, and high-traffic paid endpoints).

3. **Ecosystem-positive contribution path**
   Some hardening utilities (for example, replay tracking helpers or confirmation handling patterns) may be good candidates for upstream collaboration in shared Nano/x402 tooling.

4. **Security model transparency**
   The delegation model of `@x402nano/facilitator` is valid when the operator controls both Resource Server and Facilitator. NanoSession's self-contained security model is designed for scenarios where explicit verification invariants are required at the facilitator layer.

## Evidence Anchors In This Repository

The claims about x402.NanoSession capabilities above are anchored in current project components:

- Facilitator verification/session logic: `packages/facilitator/src/handler.ts`
- Client payment flow logic: `packages/client/src/handler.ts`
- RPC reliability/failover behavior: `packages/rpc/src/client.ts`
- Core types/constants and mechanism mapping: `packages/core/src/`
- Attack-oriented integration coverage:
  - `test/integration/payment-flow.test.ts` (includes frontrun/receipt-stealing, receipt reuse, session spoofing scenarios)
- Rev6 extension for throughput scaling:
  - `docs/x402_NanoSession_rev6_Extension_A_Pools.md`

For third-party facilitator observations, anchors are:

- `docs/references/facilitator/index.js` (210 lines)
- `docs/references/facilitator/README.md` (76 lines)
- `docs/references/facilitator/Dockerfile` (25 lines)
- `docs/references/facilitator/docker-compose.yml` (15 lines)
- `docs/references/facilitator/package.json` (34 lines)

## Positioning Guidance (External)

When describing the ecosystem publicly:

- Prefer: "complementary implementation styles" over "battlefield" framing
- Prefer: "reference-style" and "production-oriented" over "basic" and "advanced" as value judgments
- Ground claims in testable behavior and documented invariants, not branding language

## Open Tracking Items

To keep this landscape accurate, revisit on each notable upstream release:

1. Interoperability matrix update against latest `@x402nano/*` packages
2. Security-control delta review (session binding, replay checks, spoof resistance)
3. Operational delta review (retry/failover, throughput/sharding)
4. Any new standardization movement that changes baseline expectations

## Suggested Companion Work

- Add a repeatable interoperability test profile in CI that targets a reference facilitator stack.
- Publish a short "Choosing an approach" guide in `site/` for developers deciding between integration styles.
