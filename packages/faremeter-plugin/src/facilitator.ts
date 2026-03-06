import { facilitator, x402 } from '@faremeter/types';
import { SCHEME, NETWORK } from '@nanosession/core';
import type { PaymentRequirements, PaymentPayload } from '@nanosession/core';
import { NanoSessionFacilitatorHandler, type HandlerOptions } from '@nanosession/facilitator';
import type { SpentSetStorage } from '@nanosession/facilitator';

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

/**
 * Creates a Faremeter-compatible FacilitatorHandler for NanoSession.
 * Implements x402 V2 support for NanoSession/exact scheme.
 * 
 * @param options Configuration for the facilitator (RPC, addresses, etc)
 * @returns A Faremeter FacilitatorHandler object
 */
export function createFacilitatorHandler(options: FacilitatorOptions): FacilitatorHandler {
  const underlying = new NanoSessionFacilitatorHandler({
    rpcClient: options.rpcClient,
    spentSet: options.spentSet,
  });

  const sessionMap = new Map<string, SessionRequirements>();

  const getSupported = (): Promise<x402SupportedKind>[] => {
    return [Promise.resolve({
      x402Version: 2,
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
          nanoSession: {
            tag: nanoReq.extra.nanoSession.tag,
            id: nanoReq.extra.nanoSession.id,
            tagModulus: nanoReq.extra.nanoSession.tagModulus,
            expiresAt: nanoReq.extra.nanoSession.expiresAt,
          }
        },
      };

      sessionMap.set(nanoReq.extra.nanoSession.id, {
        requirements: nanoReq,
        x402Requirements: enriched,
      });

      result.push(enriched);
    }

    return result;
  };

  const toNanoRequirements = (req: x402PaymentRequirements): PaymentRequirements | null => {
    const extra = (req.extra as any)?.nanoSession;
    if (!extra) return null;

    if (extra.id === undefined || extra.tag === undefined ||
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
        nanoSession: {
          tag: extra.tag,
          id: extra.id,
          tagModulus: extra.tagModulus,
          expiresAt: extra.expiresAt,
        }
      },
    };
  };

  const toNanoPayload = (payment: x402PaymentPayload, req: PaymentRequirements): PaymentPayload | null => {
    const payload = payment.payload as { blockHash?: string };
    if (!payload.blockHash) return null;
    return {
      x402Version: 2,
      accepted: req,
      payload: { proof: payload.blockHash }
    };
  };

  const handleVerify = async (
    req: x402PaymentRequirements,
    payment: x402PaymentPayload
  ): Promise<x402VerifyResponse | null> => {
    if (req.scheme !== SCHEME || req.network !== NETWORK) {
      return null;
    }

    const nanoReq = toNanoRequirements(req);
    if (!nanoReq) {
      return {
        isValid: false,
        invalidReason: 'Invalid requirements format',
      };
    }

    const nanoPayload = toNanoPayload(payment, nanoReq);

    if (!nanoPayload) {
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
    if (!nanoReq) {
      return {
        success: false,
        txHash: null,
        networkId: null,
        error: 'Invalid requirements format',
      };
    }

    const nanoPayload = toNanoPayload(payment, nanoReq);

    if (!nanoPayload) {
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
