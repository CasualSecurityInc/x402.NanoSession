import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import type { NanoRpcClient } from '@nanosession/rpc';
import { deriveKeyPair, createSendBlock, signBlock } from './signing.js';
import { SCHEME } from '@nanosession/core';

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
      if (requirements.scheme !== SCHEME || requirements.network !== 'nano:mainnet') {
        continue;
      }

      const nanoSession = requirements.extra?.nanoSession;
      const tagValue = BigInt(nanoSession?.tag ?? 0);
      const tagMultiplier = BigInt(nanoSession?.tagMultiplier ?? '1');
      const totalAmount = BigInt(requirements.amount) + (tagValue * tagMultiplier);

      if (this.maxSpend && totalAmount > BigInt(this.maxSpend)) {
        throw new Error(`Payment exceeds max spend: ${totalAmount} > ${this.maxSpend}`);
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

    const nanoSession = requirements.extra?.nanoSession;
    const tagValue = BigInt(nanoSession?.tag ?? 0);
    const tagMultiplier = BigInt(nanoSession?.tagMultiplier ?? '1');
    const totalAmount = BigInt(requirements.amount) + (tagValue * tagMultiplier);

    const block = createSendBlock({
      account: '', // Would derive from public key
      previous: accountInfo.frontier,
      representative: accountInfo.representative,
      balance: (BigInt(accountInfo.balance) - totalAmount).toString(),
      link: requirements.payTo
    });

    const signature = signBlock(block, keyPair.secretKey);

    // Broadcast would happen here via RPC process
    // For now, return mock hash
    const blockHash = 'mock_hash_' + Date.now();

    return {
      payload: {
        x402Version: 2,
        accepted: requirements,
        payload: {
          proof: blockHash
        }
      }
    };
  }
}
