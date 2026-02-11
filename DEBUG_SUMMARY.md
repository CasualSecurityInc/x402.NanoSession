# RPC Client Debug Summary

## Problem
Integration test fails with:
```
Destination mismatch: expected nano_3bz7i1qzzzfb64u9umbfgnd68je4nyw5ysu7d6wm84jyxsuwmz4hkhuzhgcb, got undefined
```

The `link_as_account` field is `undefined` in the RPC client's response, even though the raw RPC returns it correctly.

## Root Cause

**The Nano RPC `block_info` action returns a nested structure, but `NanoRpcClient.getBlockInfo()` expects a flat structure.**

### Raw RPC Response Structure

```json
{
  "block_account": "nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye",
  "amount": "1000000000000000000000000",
  "balance": "91779000000000000000000000000",
  "height": "93",
  "subtype": "send",
  "confirmed": "true",
  "contents": {
    "type": "state",
    "account": "nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye",
    "previous": "9AD89D2655EEF2366717DCE06F38DC5FB368470737C0BCC55D6C39B2DB28912D",
    "representative": "nano_1iuz18n4g4wfp9gf7p1s8qkygxw7wx9qfjq6a9aq68uyrdnningdcjontgar",
    "balance": "91779000000000000000000000000",
    "link": "A7E5802FFFFDA920B67DCD2D7516434582A7B83F67655939330A3EEE77C9FC4F",
    "link_as_account": "nano_3bz7i1qzzzfb64u9umbfgnd68je4nyw5ysu7d6wm84jyxsuwmz4hkhuzhgcb",
    "signature": "2A6BF4A1BBD6F7B50C470F55928B7CC2804C408F4750B8036F6914C1E0F8ECA18618F66630EA0C89F2E4005E47A148D6A63C5BEE087A510DCE23B41B663FD00A",
    "work": "000166957a4e5785"
  }
}
```

### Current Implementation (Broken)

`packages/rpc/src/client.ts` lines 35-46:

```typescript
return {
  hash: (response.hash as string | undefined) ?? hash,
  type: (response.type as string | undefined) ?? 'state',
  subtype: response.subtype as string | undefined,
  block_account: response.block_account as string,
  previous: response.previous as string,              // ❌ undefined
  representative: response.representative as string | undefined,  // ❌ undefined
  balance: response.balance as string,
  link: response.link as string,                      // ❌ undefined
  link_as_account: response.link_as_account as string | undefined,  // ❌ undefined
  signature: response.signature as string,            // ❌ undefined
  work: response.work as string,                      // ❌ undefined
  amount: response.amount as string,
  confirmed: (response.confirmed as boolean | undefined) ?? false,
  height: parseInt((response.height as string | undefined) ?? '0', 10)
};
```

### Required Fix

Read from `response.contents` for block-specific fields:

```typescript
const contents = response.contents as Record<string, unknown>;

return {
  hash: (response.hash as string | undefined) ?? hash,
  type: (contents.type as string | undefined) ?? 'state',
  subtype: response.subtype as string | undefined,
  block_account: response.block_account as string,
  previous: contents.previous as string,
  representative: contents.representative as string | undefined,
  balance: response.balance as string,
  link: contents.link as string,
  link_as_account: contents.link_as_account as string | undefined,  // ✅ Fixed
  signature: contents.signature as string,
  work: contents.work as string,
  amount: response.amount as string,
  confirmed: (response.confirmed === 'true' || response.confirmed === true),
  height: parseInt((response.height as string | undefined) ?? '0', 10)
};
```

## Debug Method

Created `test-debug-rpc.mjs` that:
1. Fetches a block from the test account
2. Calls raw RPC `block_info` directly
3. Calls `rpcClient.getBlockInfo()` with the same hash
4. Compares both responses field-by-field

### Test Block Used

- **Hash**: `19B45E2650EADBA5985DEDD68E2E8A6EF38BB27B027707AD687C6CD1A4B77BC6`
- **Account**: `nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye` (acct0)
- **Destination**: `nano_3bz7i1qzzzfb64u9umbfgnd68je4nyw5ysu7d6wm84jyxsuwmz4hkhuzhgcb` (acct1)
- **Type**: send

### Debug Output

Full output saved to `debug-output.txt`.

Key finding:
```
link_as_account in raw response (top level): undefined
link_as_account in raw response (contents): nano_3bz7i1qzzzfb64u9umbfgnd68je4nyw5ysu7d6wm84jyxsuwmz4hkhuzhgcb
```

## Fields by Location

### Top-Level Fields (metadata)
- `block_account`
- `amount`
- `balance`
- `height`
- `local_timestamp`
- `successor`
- `confirmed`
- `subtype`

### Contents Fields (block data)
- `type`
- `account` (duplicate of block_account)
- `previous`
- `representative`
- `balance` (duplicate)
- `link`
- `link_as_account` ← **Critical missing field**
- `signature`
- `work`

## Next Steps

1. Fix `packages/rpc/src/client.ts` to read from `response.contents`
2. Run integration test to verify fix
3. Consider adding unit test for block_info parsing
4. Update type definitions if needed
