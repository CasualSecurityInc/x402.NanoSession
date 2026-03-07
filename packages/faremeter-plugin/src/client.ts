import { client, x402 } from '@faremeter/types';
import { SCHEME, NETWORK, createPaymentRequirements } from '@nanosession/core';
import type { PaymentRequirements } from '@nanosession/core';
import { NanoSessionPaymentHandler, type ClientOptions } from '@nanosession/client';

type PaymentHandler = client.PaymentHandler;
type PaymentExecer = client.PaymentExecer;
type RequestContext = client.RequestContext;
type x402PaymentRequirements = x402.x402PaymentRequirements;

export interface PaymentHandlerOptions {
  rpcClient: ClientOptions['rpcClient'];
  seed: string;
  maxSpend?: string;
}

/**
 * Creates a Faremeter-compatible Client PaymentHandler for NanoSession.
 * Automatically wraps the NanoSessionPaymentHandler for use in Faremeter middleware.
 * 
 * @param options Configuration options for the underlying handler
 * @returns A Faremeter PaymentHandler function
 */
export function createPaymentHandler(options: PaymentHandlerOptions): PaymentHandler {
  const underlying = new NanoSessionPaymentHandler({
    rpcClient: options.rpcClient,
    seed: options.seed,
    maxSpend: options.maxSpend,
  });

  return async (context: RequestContext, accepts: x402PaymentRequirements[]): Promise<PaymentExecer[]> => {
    const nanoAccepts: PaymentRequirements[] = [];

    for (const req of accepts) {
      if (req.scheme !== SCHEME || req.network !== NETWORK) {
        continue;
      }

      const extra = (req.extra as any)?.nanoSession;

      if (
        !extra ||
        extra.tag === undefined ||
        !extra.id ||
        !extra.resourceAmountRaw ||
        !extra.tagAmountRaw
      ) {
        continue;
      }

      const expiresAt = typeof extra.expiresAt === 'string'
        ? extra.expiresAt
        : new Date(Date.now() + req.maxTimeoutSeconds * 1000).toISOString();

      nanoAccepts.push(
        createPaymentRequirements({
          payTo: req.payTo,
          maxTimeoutSeconds: req.maxTimeoutSeconds,
          id: extra.id,
          tag: extra.tag,
          resourceAmountRaw: extra.resourceAmountRaw,
          tagAmountRaw: extra.tagAmountRaw,
          amount: req.maxAmountRequired,
          expiresAt,
          scheme: req.scheme,
          network: req.network,
          asset: req.asset
        })
      );
    }

    const underlyingExecers = await underlying.handle(context, nanoAccepts);

    return underlyingExecers.map((execer): PaymentExecer => ({
      requirements: accepts.find(r =>
        r.scheme === execer.requirements.scheme &&
        r.network === execer.requirements.network &&
        (r.extra as any)?.nanoSession?.id === execer.requirements.extra.nanoSession.id
      )!,
      exec: async () => {
        const result = await execer.exec();
        return {
          payload: result.payload,
        };
      },
    }));
  };
}
