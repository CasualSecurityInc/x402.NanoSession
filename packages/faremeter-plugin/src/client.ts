import { client, x402 } from '@faremeter/types';
import { SCHEME, NETWORK } from '@nanosession/core';
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

      const extra = req.extra as {
        tag?: number;
        sessionId?: string;
        tagModulus?: number;
        expiresAt?: string;
      } | undefined;

      if (!extra || extra.tag === undefined || !extra.sessionId || 
          !extra.tagModulus || !extra.expiresAt) {
        continue;
      }

      nanoAccepts.push({
        scheme: req.scheme,
        network: req.network,
        asset: req.asset,
        amount: req.maxAmountRequired,
        payTo: req.payTo,
        maxTimeoutSeconds: req.maxTimeoutSeconds,
        extra: {
          tag: extra.tag,
          sessionId: extra.sessionId,
          tagModulus: extra.tagModulus,
          expiresAt: extra.expiresAt,
        },
      });
    }

    const underlyingExecers = await underlying.handle(context, nanoAccepts);

    return underlyingExecers.map((execer): PaymentExecer => ({
      requirements: accepts.find(r => 
        r.scheme === execer.requirements.scheme && 
        r.network === execer.requirements.network
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
