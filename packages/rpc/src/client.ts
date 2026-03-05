import type { BlockInfo, AccountInfo, AccountHistoryEntry } from './types.js';

export interface NanoRpcClientOptions {
  /** RPC endpoint URLs to try in order */
  endpoints: string[];
  /** Maximum retries per endpoint */
  maxRetries?: number;
  /** Initial retry delay in ms (doubles each retry) */
  retryDelayMs?: number;
  /** Request timeout in ms */
  timeoutMs?: number;
}

export class NanoRpcClient {
  private endpoints: string[];
  private maxRetries: number;
  private retryDelayMs: number;
  private timeoutMs: number;

  constructor(options: NanoRpcClientOptions) {
    if (!options.endpoints.length) {
      throw new Error('At least one endpoint is required');
    }
    this.endpoints = options.endpoints;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  /**
   * Get block information by hash
   */
  async getBlockInfo(hash: string): Promise<BlockInfo> {
    const response = await this.callRpc('block_info', {
      json_block: true,
      hash
    });

    // Block data is nested in the contents object
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
      link_as_account: contents.link_as_account as string | undefined,
      signature: contents.signature as string,
      work: contents.work as string,
      amount: response.amount as string,
      confirmed: (response.confirmed === 'true' || response.confirmed === true),
      height: parseInt((response.height as string | undefined) ?? '0', 10)
    };
  }

  /**
   * Confirm a block (trigger election if needed)
   * Silently succeeds if the RPC doesn't support block_confirm
   */
  async confirmBlock(hash: string): Promise<void> {
    try {
      await this.callRpc('block_confirm', { hash }, { silent: true });
    } catch (error) {
      const isUnsupported = (err: Error): boolean => {
        const msg = err.message.toLowerCase();
        return msg.includes('unsupported') && msg.includes('rpc');
      };

      if (error instanceof AggregateError) {
        const allUnsupported = error.errors.every(e =>
          e instanceof Error && isUnsupported(e)
        );
        if (allUnsupported) {
          return;
        }
      } else if (error instanceof Error && isUnsupported(error)) {
        return;
      }

      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    const response = await this.callRpc('account_info', {
      account: address,
      representative: true
    });

    return {
      frontier: response.frontier as string,
      representative: response.representative as string,
      balance: response.balance as string,
      block_count: typeof response.block_count === 'string'
        ? parseInt(response.block_count, 10)
        : response.block_count as number,
      confirmation_height: response.confirmation_height
        ? (typeof response.confirmation_height === 'string'
          ? parseInt(response.confirmation_height, 10)
          : response.confirmation_height as number)
        : undefined,
      account_version: response.account_version as number | undefined
    };
  }

  /**
   * Get recent transaction history for an account
   */
  async getAccountHistory(account: string, count: number = 10): Promise<AccountHistoryEntry[]> {
    const response = await this.callRpc('account_history', {
      account,
      count: count.toString(),
      raw: true
    });

    const history = response.history as Record<string, unknown>[] | undefined;
    if (!Array.isArray(history)) return [];

    return history.map(entry => ({
      type: entry.type as string,
      account: entry.account as string,
      amount: entry.amount as string,
      hash: entry.hash as string,
      local_timestamp: entry.local_timestamp as string,
      height: entry.height as string,
      confirmed: entry.confirmed as string,
    }));
  }

  /**
   * Internal method to call RPC with failover and retry
   */
  private async callRpc(action: string, params: Record<string, unknown>, options?: { silent?: boolean }): Promise<Record<string, unknown>> {
    const silent = options?.silent ?? false;
    const errors: Error[] = [];

    for (const endpoint of this.endpoints) {
      try {
        return await this.callEndpointWithRetry(endpoint, action, params);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (!silent) {
          console.error(`[RPC] ${action} failed for ${endpoint}: ${err.message}`);
        }
        errors.push(err);
      }
    }

    if (!silent) {
      console.error(`[RPC] All endpoints failed for action: ${action}`, errors.map(e => e.message));
    }
    throw new AggregateError(errors, `All RPC endpoints failed for action: ${action}`);
  }

  private async callEndpointWithRetry(
    endpoint: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    let lastError: Error | undefined;
    let delay = this.retryDelayMs;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action, ...params }),
          signal: controller.signal
        });

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${response.statusText}${bodyText ? ` - ${bodyText.slice(0, 200)}` : ''}`);
        }

        const data = await response.json() as Record<string, unknown>;

        if (data.error) {
          throw new Error(`RPC error: ${data.error}`);
        }

        return data;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${this.timeoutMs}ms`);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
          delay *= 2;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
