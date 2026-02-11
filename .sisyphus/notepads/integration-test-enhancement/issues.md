# Issues Found During Debugging

## Issue: link_as_account is undefined in RPC client response (2026-02-11)

**Symptom:**
- `handleSettle()` fails with "Destination mismatch: expected nano_3bz..., got undefined"
- Integration tests show `link_as_account: undefined` when calling `rpcClient.getBlockInfo()`

**Root Cause:**
The Nano RPC's `block_info` action with `json_block: true` returns a **nested structure**:

```json
{
  "block_account": "...",
  "amount": "...",
  "balance": "...",
  "contents": {
    "type": "state",
    "account": "...",
    "previous": "...",
    "representative": "...",
    "balance": "...",
    "link": "...",
    "link_as_account": "nano_...",  ← HERE
    "signature": "...",
    "work": "..."
  },
  "subtype": "send"
}
```

But `NanoRpcClient.getBlockInfo()` in `packages/rpc/src/client.ts` expects a **flat structure** and reads directly from the top-level response object:

```typescript
return {
  // ...
  link: response.link as string,                        // ❌ undefined
  link_as_account: response.link_as_account as string,  // ❌ undefined
  // ...
};
```

**Fix Required:**
Access fields from `response.contents` instead:

```typescript
const contents = response.contents as Record<string, unknown>;
return {
  // ...
  link: contents.link as string,
  link_as_account: contents.link_as_account as string | undefined,
  previous: contents.previous as string,
  representative: contents.representative as string | undefined,
  signature: contents.signature as string,
  work: contents.work as string,
  // Also need to get type from contents
  type: contents.type as string | undefined ?? 'state',
  // ...
};
```

**Test Block:**
- Hash: `19B45E2650EADBA5985DEDD68E2E8A6EF38BB27B027707AD687C6CD1A4B77BC6`
- Account: `nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye`
- Subtype: send
- Destination: `nano_3bz7i1qzzzfb64u9umbfgnd68je4nyw5ysu7d6wm84jyxsuwmz4hkhuzhgcb`

**Debug Script:**
Created `test-debug-rpc.mjs` to compare raw RPC vs client responses.

**Fields in `contents` object:**
- type
- account (same as block_account)
- previous
- representative
- balance
- link
- link_as_account
- signature
- work

**Fields at top level:**
- block_account
- amount
- balance
- height
- local_timestamp
- successor
- confirmed
- subtype
