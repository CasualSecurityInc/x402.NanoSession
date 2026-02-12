import { facilitator, x402 } from '@faremeter/types';
import { SCHEME, NETWORK } from '@nanosession/core';
import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import { NanoSessionFacilitatorHandler, type HandlerOptions } from '@nanosession/server';
import type { SpentSetStorage } from '@nanosession/server';

type FacilitatorHandler = facilitator.FacilitatorHandler;
type x402PaymentRequirements = x402.x402PaymentRequirements;
type x402PaymentPayload = x402.x402PaymentPayload;
type x402SupportedKind = x402.x402SupportedKind;
type x402VerifyResponse = x402.x402VerifyResponse;
type x402SettleResponse = x402.x402SettleResponse;

export interface FacilitatorOptions {
  rpcClient: HandlerOptions['rpcClient'];
  payTo: string;
  spentSet?: SpentSetStorage;
  defaultAmount?: string;
  maxTimeoutSeconds?: number;
  tagModulus?: number;
}

interface SessionRequirements {
  requirements: PaymentRequirements;
  x402Requirements: x402PaymentRequirements;
}

export function createFacilitatorHandler(options: FacilitatorOptions): FacilitatorHandler {
  const underlying = new NanoSessionFacilitatorHandler({
    rpcClient: options.rpcClient,
    spentSet: options.spentSet,
  });

  const sessionMap = new Map<string, SessionRequirements>();

  const getSupported = (): Promise<x402SupportedKind>[] => {
    return [Promise.resolve({
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
    })];
  };

  const getRequirements = async (reqs: x402PaymentRequirements[]): Promise<x402PaymentRequirements[]> => {
    const result: x402PaymentRequirements[] = [];

    for (const req of reqs) {
      if (req.scheme !== SCHEME || req.network !== NETWORK) {
        continue;
      }

      const nanoReq = underlying.getRequirements({
        amount: req.maxAmountRequired || options.defaultAmount || '0',
        payTo: options.payTo,
        maxTimeoutSeconds: options.maxTimeoutSeconds ?? req.maxTimeoutSeconds,
        tagModulus: options.tagModulus,
      });

      const enriched: x402PaymentRequirements = {
        ...req,
        scheme: nanoReq.scheme,
        network: nanoReq.network,
        asset: nanoReq.asset,
        maxAmountRequired: nanoReq.amount,
        payTo: nanoReq.payTo,
        maxTimeoutSeconds: nanoReq.maxTimeoutSeconds,
        extra: {
          tag: nanoReq.extra.tag,
          sessionId: nanoReq.extra.sessionId,
          tagModulus: nanoReq.extra.tagModulus,
          expiresAt: nanoReq.extra.expiresAt,
        },
      };

      sessionMap.set(nanoReq.extra.sessionId, {
        requirements: nanoReq,
        x402Requirements: enriched,
      });

      result.push(enriched);
    }

    return result;
  };

  const toNanoRequirements = (req: x402PaymentRequirements): PaymentRequirements | null => {
    if (!req.extra) return null;
    
    const extra = req.extra as {
      tag?: number;
      sessionId?: string;
      tagModulus?: number;
      expiresAt?: string;
    };

    if (extra.sessionId === undefined || extra.tag === undefined || 
        extra.tagModulus === undefined || extra.expiresAt === undefined) {
      return null;
    }

    return {
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
    };
  };

  const toNanoPayload = (payment: x402PaymentPayload): PaymentPayload | null => {
    const payload = payment.payload as { blockHash?: string };
    if (!payload.blockHash) return null;
    return { blockHash: payload.blockHash };
  };

  const handleVerify = async (
    req: x402PaymentRequirements,
    payment: x402PaymentPayload
  ): Promise<x402VerifyResponse | null> => {
    if (req.scheme !== SCHEME || req.network !== NETWORK) {
      return null;
    }

    const nanoReq = toNanoRequirements(req);
    const nanoPayload = toNanoPayload(payment);

    if (!nanoReq || !nanoPayload) {
      return {
        isValid: false,
        invalidReason: 'Invalid payment format',
      };
    }

    const result = await underlying.handleVerify(nanoReq, nanoPayload);
    
    if (!result) return null;

    return {
      isValid: result.isValid,
      invalidReason: result.error ?? null,
    };
  };

  const handleSettle = async (
    req: x402PaymentRequirements,
    payment: x402PaymentPayload
  ): Promise<x402SettleResponse | null> => {
    if (req.scheme !== SCHEME || req.network !== NETWORK) {
      return null;
    }

    const nanoReq = toNanoRequirements(req);
    const nanoPayload = toNanoPayload(payment);

    if (!nanoReq || !nanoPayload) {
      return {
        success: false,
        txHash: null,
        networkId: null,
        error: 'Invalid payment format',
      };
    }

    const result = await underlying.handleSettle(nanoReq, nanoPayload);
    
    if (!result) return null;

    return {
      success: result.success,
      txHash: result.transactionHash ?? null,
      networkId: result.success ? NETWORK : null,
      error: result.error ?? null,
    };
  };

  return {
    getSupported,
    getRequirements,
    handleVerify,
    handleSettle,
  };
}
