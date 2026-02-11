# Architectural Decisions

## Decision: Access Nano RPC `block_info` Response via Nested `contents` Object

**Date**: 2026-02-11

**Context**: 
The Nano RPC's `block_info` action with `json_block: true` returns block data nested in a `contents` object, not at the top level. This was causing `link_as_account` and other critical fields to be undefined.

**Decision**:
Modified `NanoRpcClient.getBlockInfo()` to:
1. Extract the `contents` object: `const contents = response.contents as Record<string, unknown>`
2. Read block-specific fields from `contents`: `type`, `previous`, `representative`, `link`, `link_as_account`, `signature`, `work`
3. Read metadata fields from top level: `block_account`, `amount`, `balance`, `height`, `confirmed`, `subtype`

**Rationale**:
- Aligns with actual Nano RPC API structure
- Separates block data (in `contents`) from metadata (at top level)
- Enables proper access to `link_as_account` for destination verification

**Consequences**:
- Unit tests needed updates to match real RPC structure
- Added clarifying comment to prevent future regression
- Improved type safety by handling both string and boolean for `confirmed` field

**Alternatives Considered**:
1. Flatten the response in a preprocessing step - rejected because it adds complexity
2. Use optional chaining everywhere - rejected because it hides the real issue
3. Request flat structure from RPC - rejected because we don't control the RPC API

**Verification**:
Debug script `test-debug-rpc.mjs` confirms `link_as_account` is now correctly populated.
