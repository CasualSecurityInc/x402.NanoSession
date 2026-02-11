import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import type { NanoRpcClient } from '@nanosession/rpc';
import { deriveKeyPair, createSendBlock, signBlock } from './signing.js';

export interface PaymentExecer {
  requirements: PaymentRequirements;
  exec: () => Promise<{ payload: PaymentPayload }>;
}

export interface ClientOptions {
  rpcClient: NanoRpcClient;
  seed: string;
  maxSpend?: string;
}

export class NanoSessionPaymentHandler {
  private rpcClient: NanoRpcClient;
  private seed: string;
  private maxSpend?: string;
  private spentToday: bigint = BigInt(0);

  constructor(options: ClientOptions) {
    this.rpcClient = options.rpcClient;
    this.seed = options.seed;
    this.maxSpend = options.maxSpend;
  }

  async handle(
    _context: unknown,
    accepts: PaymentRequirements[]
  ): Promise<PaymentExecer[]> {
    const execers: PaymentExecer[] = [];

    for (const requirements of accepts) {
      if (requirements.scheme !== 'nano-session') {
        continue;
      }

      if (this.maxSpend && BigInt(requirements.amount) > BigInt(this.maxSpend)) {
        throw new Error(`Payment exceeds max spend: ${requirements.amount} > ${this.maxSpend}`);
      }

      execers.push({
        requirements,
        exec: async () => this.executePayment(requirements)
      });
    }

    return execers;
  }

  private async executePayment(requirements: PaymentRequirements): Promise<{ payload: PaymentPayload }> {
    const keyPair = deriveKeyPair(this.seed);
    
    // Get account info for previous block
    const accountInfo = await this.rpcClient.getAccountInfo(
      Buffer.from(keyPair.publicKey).toString('hex')
    );

    const block = createSendBlock({
      account: '', // Would derive from public key
      previous: accountInfo.frontier,
      representative: accountInfo.representative,
      balance: (BigInt(accountInfo.balance) - BigInt(requirements.amount)).toString(),
      link: requirements.payTo
    });

    const signature = signBlock(block, keyPair.secretKey);
    
    // Broadcast would happen here via RPC process
    // For now, return mock hash
    const blockHash = 'mock_hash_' + Date.now();

    return {
      payload: { blockHash }
    };
  }
}
