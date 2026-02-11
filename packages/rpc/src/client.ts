import type { BlockInfo, AccountInfo } from './types.js';

export interface NanoRpcClientOptions {
  /** RPC endpoint URLs to try in order */
  endpoints: string[];
  /** Maximum retries per endpoint */
  maxRetries?: number;
  /** Initial retry delay in ms (doubles each retry) */
  retryDelayMs?: number;
}

export class NanoRpcClient {
  private endpoints: string[];
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options: NanoRpcClientOptions) {
    if (!options.endpoints.length) {
      throw new Error('At least one endpoint is required');
    }
    this.endpoints = options.endpoints;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Get block information by hash
   */
  async getBlockInfo(hash: string): Promise<BlockInfo> {
    const response = await this.callRpc('block_info', {
      json_block: true,
      hash
    });
    
    return {
      hash: (response.hash as string | undefined) ?? hash,
      type: (response.type as string | undefined) ?? 'state',
      subtype: response.subtype as string | undefined,
      block_account: response.block_account as string,
      previous: response.previous as string,
      representative: response.representative as string | undefined,
      balance: response.balance as string,
      link: response.link as string,
      link_as_account: response.link_as_account as string | undefined,
      signature: response.signature as string,
      work: response.work as string,
      amount: response.amount as string,
      confirmed: (response.confirmed as boolean | undefined) ?? false,
      height: parseInt((response.height as string | undefined) ?? '0', 10)
    };
  }

  /**
   * Confirm a block (trigger election if needed)
   */
  async confirmBlock(hash: string): Promise<void> {
    await this.callRpc('block_confirm', { hash });
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
   * Internal method to call RPC with failover and retry
   */
  private async callRpc(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const errors: Error[] = [];
    
    for (const endpoint of this.endpoints) {
      try {
        return await this.callEndpointWithRetry(endpoint, action, params);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
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
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action, ...params })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as Record<string, unknown>;
        
        if (data.error) {
          throw new Error(`RPC error: ${data.error}`);
        }
        
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError ?? new Error('Unknown error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
