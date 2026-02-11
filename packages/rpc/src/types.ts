/**
 * Nano RPC response types
 * Based on Nano RPC protocol documentation
 */

/** Block information from block_info RPC */
export interface BlockInfo {
  /** Block hash */
  hash: string;
  /** Block type (state, send, receive, etc.) */
  type: string;
  /** Block subtype (send, receive, change, etc.) */
  subtype?: string;
  /** Account that created the block */
  block_account: string;
  /** Previous block hash */
  previous: string;
  /** Representative address (for state blocks) */
  representative?: string;
  /** Account balance after this block */
  balance: string;
  /** Link field (destination for sends, source for receives) */
  link: string;
  /** Link as account address */
  link_as_account?: string;
  /** Block signature */
  signature: string;
  /** Proof of work */
  work: string;
  /** Amount transferred in this block (in raw) */
  amount: string;
  /** Whether block is confirmed */
  confirmed: boolean | string;
  /** Block height */
  height: number;
}

/** Account information from account_info RPC */
export interface AccountInfo {
  /** Account frontier (latest block hash) */
  frontier: string;
  /** Account representative */
  representative: string;
  /** Current balance (in raw) */
  balance: string;
  /** Block count / height */
  block_count: number | string;
  /** Confirmation height (cemented) */
  confirmation_height?: number | string;
  /** Account version */
  account_version?: number;
}

/** RPC error response */
export interface RpcError {
  error: string;
}

/** Generic RPC response wrapper */
export type RpcResponse<T> = T | RpcError;
