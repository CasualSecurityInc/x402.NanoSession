# Work Plan: NanoSession /protected Demo Page

## Overview
Build a `/protected` demo page for NanoSession that showcases real Nano payments, integrated into the VitePress docs site, similar to x402.org/protected but simpler.

**Goal**: "gosh how simple was that" experience for potential adopters.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEMO ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   VitePress (:5173)              Demo Server (:3001)                │
│   ─────────────────              ──────────────────                 │
│   /protected (Vue)  ◄────────►   GET  /api/protected (402)          │
│                                  GET  /api/status/:sessionId (SSE)  │
│                                                                     │
│   Demo Server                    Nano Network                       │
│   ───────────                    ────────────                       │
│   WebSocket client  ◄──────────► wss://ws.nano.to                   │
│   (subscribe confirmations)      (block confirmations)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Payment detection | Server-Sent Events (SSE) |
| Demo location | VitePress site (`/site/`) |
| Wallet experience | QR Code + Full Xnap MetaMask Snap integration |
| Scope | Polished (amount display, countdown, generic errors) |
| Server architecture | Separate server (:3001) alongside VitePress (:5173) |
| RPC endpoint | Environment variable (`NANO_RPC_URL`) |
| Session persistence | In-memory only (refresh = new session) |
| Error handling | Generic errors (tell user to refresh) |
| Test strategy | Tests after implementation + Playwright E2E |

---

## Phase 1: Demo Server Foundation

### Task 1.1: Create Demo Server Skeleton
**File**: `site/demo-server/index.ts`

**MUST**:
- Express server on port 3001
- CORS enabled for localhost:5173
- Load environment variables:
  - `NANO_RPC_URL` - RPC endpoint (required)
  - `NANO_SERVER_ADDRESS` - Payment receiving address (required)
  - `NANO_SERVER_SEED` - Wallet seed if using `StandardAccountPool` (optional, for future extensibility)
- Validate required env vars on startup (fail fast with clear error)
- Graceful shutdown handling

**MUST NOT**:
- Add database dependencies
- Add authentication/login
- Add rate limiting (dev demo)

**Acceptance**:
```bash
curl http://localhost:3001/health
# Returns: {"status":"ok"}
```

### Task 1.2: Implement 402 Protected Endpoint
**File**: `site/demo-server/routes/protected.ts`

**MUST**:
- Return 402 with `X-Payment-Required` header on first request
- Use `NanoSessionFacilitatorHandler` from `@nanosession/server`
- Use `InMemorySpentSet` from `@nanosession/server`
- Pass `payTo` directly from `NANO_SERVER_ADDRESS` env var (like `examples/server/src/index.ts`)
  - NOTE: `InMemoryAddressPool` does NOT exist. The examples show passing `payTo` directly to `handler.getRequirements({ amount, payTo, maxTimeoutSeconds })`
- Generate unique sessionId per request
- Include in response: `payTo`, `amount` (raw), `sessionId`, `expiresAt`
- Set `Access-Control-Expose-Headers: X-Payment-Required`

**MUST NOT**:
- Persist sessions to disk/DB
- Convert raw amounts (pass through as-is)

**Acceptance**:
```bash
curl -i http://localhost:3001/api/protected
# Returns: HTTP 402
# Header: X-Payment-Required: {"scheme":"nano-session","network":"nano:mainnet",...}
```

### Task 1.3: Implement SSE Status Endpoint
**File**: `site/demo-server/routes/status.ts`

**MUST**:
- Return `text/event-stream` content type
- Send heartbeat every 30 seconds
- Send current payment status on connect (buffered state)
- Clean up subscription on client disconnect
- Use `AbortController` for cleanup

**MUST NOT**:
- Leave subscriptions running indefinitely
- Buffer more than current state

**Acceptance**:
```bash
curl -N http://localhost:3001/api/status/test-session-id
# Returns: event: status\ndata: {"status":"pending"}\n\n
```

### Task 1.4: Implement Nano WebSocket Bridge
**File**: `site/demo-server/services/nano-websocket.ts`

**MUST**:
- Connect to `wss://ws.nano.to`
- Subscribe to confirmations for server's payment address (from `NANO_SERVER_ADDRESS` env var)
- Parse incoming confirmation messages
- Match confirmations to pending sessions by amount tag
- Emit events to SSE connections
- Auto-reconnect on disconnect (simple retry, no exponential backoff)
- Max subscription lifetime: 10 minutes per session

**MUST NOT**:
- Implement complex retry logic
- Pool connections (one per server instance is fine)

**Acceptance**:
- Manual test: Send payment, see confirmation logged within 2 seconds

---

## Phase 2: Frontend Paywall Component

### Task 2.1: Create Vue Paywall Component
**File**: `site/.vitepress/theme/components/NanoPaywall.vue`

**MUST**:
- Display QR code with `nano://` URI
- Show payment amount in human-readable XNO (e.g., "0.000001 XNO")
- Show countdown timer (time until session expires)
- Show payment status: "Waiting for payment...", "Payment confirmed!", "Error"
- Include `data-testid` attributes for Playwright:
  - `data-testid="payment-required"` on paywall container
  - `data-testid="payment-address"` on address display
  - `data-testid="payment-amount-raw"` with `data-raw` attribute
  - `data-testid="payment-status"` with `data-status` attribute
  - `data-testid="protected-content"` on revealed content

**MUST NOT**:
- Sign transactions in browser
- Store wallet keys
- Add payment history
- Add animations beyond simple transitions

**Dependencies**:
- `qrcode` npm package for QR generation

### Task 2.2: Implement SSE Client Connection
**File**: `site/.vitepress/theme/composables/usePaymentStatus.ts`

**MUST**:
- Connect to demo server SSE endpoint
- Parse incoming status events
- Update reactive state
- Clean up on component unmount
- Handle connection errors gracefully (show generic error)

**MUST NOT**:
- Implement reconnection logic (user refreshes on error)
- Buffer historical events

### Task 2.3: Implement Xnap MetaMask Snap Integration
**File**: `site/.vitepress/theme/composables/useXnapSnap.ts`

**MUST**:
- Detect if MetaMask is installed (`window.ethereum`)
- Check if Xnap Snap is installed
- Provide function to install Xnap Snap if missing
- Provide function to trigger payment via Snap
- Show appropriate UI states: "Install MetaMask", "Install Xnap", "Pay with Xnap"

**MUST NOT**:
- Fall back to other wallets
- Store any wallet state

**Reference**: https://xnap.app for Snap API documentation

### Task 2.4: Create Protected Page
**File**: `site/protected.md`

**MUST**:
- Use NanoPaywall component
- Show "exclusive content" after payment confirmed
- Include disclaimer: "This demo uses real Nano mainnet. Amounts are tiny (~$0.0001)"
- Work with VitePress navigation

**Protected content example**:
```
🎉 Payment successful!

You've just experienced NanoSession - feeless, instant payments via HTTP 402.

This content was protected by a real Nano payment. No accounts, no sign-ups, 
just pay and access.
```

---

## Phase 3: Integration & Polish

### Task 3.1: Add Development Scripts
**File**: `site/package.json`

**MUST**:
- Add `dev:demo` script that runs both VitePress and demo server
- Add `NANO_RPC_URL` and `NANO_SERVER_ADDRESS` to `.env.example`
- Document setup in `site/README.md`
- NOTE: VitePress uses `docs:dev` NOT `dev` (see existing `site/package.json`)

**Script example**:
```json
{
  "scripts": {
    "docs:dev": "node scripts/prepare-rev.js && vitepress dev .",
    "dev:demo": "concurrently \"pnpm docs:dev\" \"pnpm demo:server\"",
    "demo:server": "tsx demo-server/index.ts"
  }
}
```

### Task 3.2: Add Demo Server Dependencies
**Files**: `site/package.json`, `pnpm-lock.yaml`

**Dependencies to add**:
- `express` - HTTP server
- `cors` - CORS middleware
- `qrcode` - QR code generation
- `ws` - WebSocket client for Nano
- `concurrently` - Run multiple processes
- `tsx` - TypeScript execution

**Workspace dependencies**:
- `@nanosession/server` - Facilitator handler
- `@nanosession/rpc` - RPC client
- `@nanosession/core` - Types and constants

### Task 3.3: Error States & Loading UI
**File**: `site/.vitepress/theme/components/NanoPaywall.vue`

**MUST**:
- Show loading spinner while fetching payment requirements
- Show "Session expired, please refresh" when countdown reaches 0
- Show "Something went wrong, please refresh" on any error
- Disable QR code interaction after payment confirmed

### Task 3.4: Style Paywall Component
**File**: `site/.vitepress/theme/components/NanoPaywall.vue`

**MUST**:
- Match VitePress default theme styling
- Responsive layout (mobile-friendly QR code)
- Clear visual hierarchy: QR code prominent, amount visible, status clear
- Use VitePress CSS variables for colors

**MUST NOT**:
- Add dark mode toggle (use VitePress default)
- Add custom fonts
- Add complex animations

---

## Phase 4: Testing & QA

### Task 4.1: Unit Tests for Demo Server
**File**: `site/demo-server/__tests__/`

**MUST**:
- Test 402 response format
- Test session creation
- Test SSE message format
- Test WebSocket message parsing

### Task 4.2: Playwright E2E Test
**File**: `site/e2e/protected.spec.ts`

**MUST**:
- Navigate to `/protected`
- Verify 402 paywall is displayed
- Extract payment address and amount
- Use test helper to send real payment (reuse integration test seed)
- Wait for SSE confirmation (max 10s)
- Verify protected content is revealed

**Test structure**:
```typescript
test('Protected page payment flow', async ({ page }) => {
  await page.goto('http://localhost:5173/protected');
  
  // Assert paywall visible
  await expect(page.locator('[data-testid="payment-required"]')).toBeVisible();
  
  // Extract payment info
  const address = await page.locator('[data-testid="payment-address"]').textContent();
  const amountRaw = await page.locator('[data-testid="payment-amount-raw"]').getAttribute('data-raw');
  
  // Send payment via helper (uses @nanosession/rpc)
  await sendTestPayment(address, amountRaw);
  
  // Wait for confirmation
  await expect(page.locator('[data-status="confirmed"]')).toBeVisible({ timeout: 10000 });
  
  // Verify content revealed
  await expect(page.locator('[data-testid="protected-content"]')).toBeVisible();
});
```

### Task 4.3: Manual QA Checklist

- [ ] QR code scans correctly with Natrium
- [ ] QR code scans correctly with Nault
- [ ] Xnap button appears when MetaMask installed
- [ ] Xnap payment flow works
- [ ] Countdown timer counts down correctly
- [ ] Payment confirmation appears within 2 seconds
- [ ] Protected content reveals after confirmation
- [ ] Page refresh shows new session (no persistence)
- [ ] Error state shows when server unavailable

---

## Guardrails Summary

### MUST DO
- Use `InMemorySpentSet` from `@nanosession/server` (no DB)
- Pass `payTo` directly from `NANO_SERVER_ADDRESS` env var (like `examples/server/src/index.ts`)
- Pass `requirements.amount` (raw string) directly to QR code URI
- Implement SSE state buffering (send current status on connect)
- Clean up WebSocket subscriptions on SSE disconnect or timeout
- Add `data-testid` attributes for Playwright testing
- Add disclaimer about real mainnet payments
- Require `NANO_SERVER_ADDRESS` env var (fail fast if missing)

### MUST NOT
- Add database dependencies
- Convert raw amounts to XNO for QR code (precision loss)
- Leave WebSocket subscriptions running indefinitely
- Implement wallet signing in browser
- Add user accounts, authentication, or login
- Add payment history or past transactions UI
- Add i18n/localization
- Add analytics or tracking

---

## File Structure (Final)

```
site/
├── demo-server/
│   ├── index.ts                    # Express server entry
│   ├── routes/
│   │   ├── protected.ts            # 402 endpoint
│   │   └── status.ts               # SSE endpoint
│   ├── services/
│   │   └── nano-websocket.ts       # WebSocket bridge
│   └── __tests__/
│       └── routes.test.ts          # Unit tests
├── .vitepress/
│   └── theme/
│       ├── components/
│       │   └── NanoPaywall.vue     # Paywall component
│       └── composables/
│           ├── usePaymentStatus.ts # SSE client
│           └── useXnapSnap.ts      # Xnap integration
├── e2e/
│   └── protected.spec.ts           # Playwright test
├── protected.md                    # Protected page
├── package.json                    # Updated with demo scripts
└── README.md                       # Updated with demo docs
```

---

## Estimated Effort

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Server | 4 tasks | 3-4 hours |
| Phase 2: Frontend | 4 tasks | 4-5 hours |
| Phase 3: Integration | 4 tasks | 2-3 hours |
| Phase 4: Testing | 3 tasks | 2-3 hours |
| **Total** | **15 tasks** | **11-15 hours** |

---

## Success Criteria

1. User visits `/protected` and sees QR code with payment amount
2. User scans QR with any Nano wallet and sends payment
3. Within 2 seconds, page shows "Payment confirmed!"
4. Protected content is revealed
5. Alternatively, user with MetaMask + Xnap can pay via browser
6. Playwright test passes with real mainnet payment
