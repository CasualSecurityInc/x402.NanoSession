# Draft: NanoSession x402 Integration

## Requirements (confirmed)
- Create x402-compatible schema mapping for NanoSession
- Build lightweight standalone client + server implementation
- Design for future repackaging as Faremeter plugin contribution
- Testing can use mainnet (Nano is feeless)

## Research Findings

### Faremeter Plugin Architecture
- **FacilitatorHandler** interface (server-side):
  - `getSupported()` → advertises scheme/network/extra
  - `getRequirements()` → enriches requirements with scheme-specific data
  - `handleVerify()` → validates payment without settling
  - `handleSettle()` → executes final settlement
- **PaymentHandler** (client-side): returns `PaymentExecer[]`
- **extra field**: scheme-specific metadata (EIP-712 for EVM, feePayer for Solana)
- Registration: explicit handler array, no dynamic discovery

### Coinbase x402 SDK
- PaymentRequirements schema:
  ```ts
  {
    scheme: string;
    network: `${string}:${string}`; // CAIP-2
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, unknown>;
  }
  ```
- Separation: core protocol vs HTTP wrappers vs mechanisms
- Testing: unit → integration (testnets) → e2e

### Nano RPC Verification
- `block_info` → check `confirmed`, `amount`, `link` (destination)
- `block_confirm` → trigger election if needed
- Sub-second to few seconds confirmation
- No gas = mainnet testing viable

## Technical Decisions

### Scheme Identifier
- **Decision**: `nano-session` (matches NanoSession branding)
- **Rationale**: Distinct from hypothetical `nano` base scheme; indicates session/tagging capability

### Network Identifier (CAIP-2)
- **Decision**: `nano:mainnet` or `nano:1` (need to verify CAIP-2 convention for Nano)
- **Rationale**: CAIP-2 format required by x402 spec

### Asset Identifier
- **Decision**: `XNO` (native asset, no contract address needed)
- **Rationale**: Nano has single native currency

### Extra Field Contents
- `tag`: number (0-9,999,999) - the raw tag for this payment
- `sessionId`: string - optional session identifier
- `tagModulus`: number - TAG_MODULUS constant (10,000,000)
- `expiresAt`: ISO timestamp - tag reservation deadline

## Open Questions
- [x] What is the correct CAIP-2 identifier for Nano mainnet?
  - **RESOLVED**: Nano is NOT registered in ChainAgnostic namespaces. We will use `nano:mainnet` as proposed identifier.
  - Future work: Submit CAIP-2 namespace registration to ChainAgnostic/namespaces repo
- [ ] Should we support Nano beta/test networks?
  - Beta network exists but testing on mainnet is viable (no fees)
- [x] How to handle the "no facilitator needed" aspect?
  - **RESOLVED**: Support "Optional Facilitator" mode - server can verify directly via Nano RPC OR use facilitator for x402 consistency

## User Decisions (from interview)
- **Facilitator Strategy**: Optional Facilitator (direct + facilitator both supported)
- **Network Identifier**: `nano:mainnet` (not officially registered, but following CAIP-2 pattern)
- **Project Structure**: Standalone packages (@nanosession/core, @nanosession/client, @nanosession/server)
- **Test Strategy**: TDD (test-first)
- **Runtime**: Node.js + tsx
- **Spent Set Storage**: Pluggable interface with in-memory default
- **Test Wallet**: User will provide seed via env var
- **Scope**: Minimal + examples (core, client, server, spent set, RPC client, example apps)

## Metis Review Findings (addressed)
1. **Spent set architecture**: Pluggable interface, in-memory default, can add persistent later
2. **Package scope boundaries**: Minimal + examples (no facilitator service, no rate limiting, no monitoring)
3. **Faremeter plugin integration**: Follow their patterns NOW to ease future contribution
4. **Network ID registration**: OUT OF SCOPE - use unofficial `nano:mainnet` for now
5. **Mainnet testing**: User provides test wallet seed via env var
6. **Error handling**: Follow x402-compatible patterns (return null for non-matching, error objects for failures)

## Schema Mapping

### NanoSession Headers → x402 PaymentRequirements

| NanoSession Header | x402 Field | Notes |
|-------------------|------------|-------|
| X-402-Address | payTo | Nano address (nano_...) |
| X-402-Price-Raw | amount | Base price in raw (string) |
| X-402-Tag | extra.tag | Unique tag for this request |
| X-402-Session | extra.sessionId | Session identifier |
| X-402-Expires | maxTimeoutSeconds + extra.expiresAt | Timeout handling |
| (implicit) | scheme | "nano-session" |
| (implicit) | network | "nano:mainnet" |
| (implicit) | asset | "XNO" |

### x402 PaymentPayload for NanoSession

```ts
{
  accepted: PaymentRequirements;  // The requirements being fulfilled
  payload: {
    blockHash: string;           // The send block hash (proof of payment)
    // Note: No signature needed - block hash IS the proof
  };
  resource?: string;
  extensions?: Record<string, unknown>;
}
```

## Scope Boundaries
- **INCLUDE**: Core client + server, schema mapping, Nano RPC integration
- **INCLUDE**: Unit tests, integration tests (mainnet)
- **INCLUDE**: Express middleware wrapper
- **EXCLUDE**: Facilitator service (Nano doesn't need one - direct verification)
- **EXCLUDE**: Pool/stochastic extensions (base spec only)
- **EXCLUDE**: Browser wallet integration (server-to-server focus)
