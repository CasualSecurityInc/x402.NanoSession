import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import type { NanoRpcClient } from '@nanosession/rpc';
import { deriveKeyPair, createSendBlock, signBlock } from './signing.js';
import { SCHEME, calculateTaggedAmount } from '@nanosession/core';

/**
 * An object that can execute a specific payment requirement
 */
export interface PaymentExecer {
  /** The requirements this execer will satisfy */
  requirements: PaymentRequirements;
  /** Executes the payment and returns the cryptographic proof */
  exec: () => Promise<{ payload: PaymentPayload }>;
}

/**
 * Configuration options for the NanoSessionPaymentHandler
 */
export interface ClientOptions {
  /** The RPC client used to interact with the Nano network */
  rpcClient: NanoRpcClient;
  /** The 64-character hex seed used to derive accounts */
  seed: string;
  /** Optional limit on how much can be spent in raw */
  maxSpend?: string;
}

/**
 * A client-side handler that automatically creates Nano payments for x402 "exact" requirements.
 */
export class NanoSessionPaymentHandler {
  private rpcClient: NanoRpcClient;
  private seed: string;
  private maxSpend?: string;
  private spentToday: bigint = BigInt(0);

  /**
   * @param options Initialization options
   */
  constructor(options: ClientOptions) {
    this.rpcClient = options.rpcClient;
    this.seed = options.seed;
    this.maxSpend = options.maxSpend;
  }

  /**
   * Evaluates a list of payment requirements and returns execers for those it can satisfy.
   * Currently only supports "exact" scheme on "nano:mainnet".
   * 
   * @param _context Optional implementation context (ignored)
   * @param accepts List of payment requirements from the server
   * @returns List of execers that can satisfy one or more requirements
   * @throws {Error} if a matching requirement exceeds maxSpend
   */
  async handle(
    _context: unknown,
    accepts: PaymentRequirements[]
  ): Promise<PaymentExecer[]> {
    const execers: PaymentExecer[] = [];

    for (const requirements of accepts) {
      if (requirements.scheme !== SCHEME || requirements.network !== 'nano:mainnet') {
        continue;
      }

      const totalAmount = BigInt(calculateTaggedAmount(requirements));

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

    const totalAmount = calculateTaggedAmount(requirements);

    const block = createSendBlock({
      account: '', // Would derive from public key
      previous: accountInfo.frontier,
      representative: accountInfo.representative,
      balance: (BigInt(accountInfo.balance) - BigInt(totalAmount)).toString(),
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
