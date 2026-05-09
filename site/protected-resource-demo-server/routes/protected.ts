import { Request, Response, Router } from 'express';
import { NanoRpcClient } from '@nanosession/rpc';
import {
  buildPaymentRequired,
  buildPaymentSettlementPayload,
  buildPaymentResponse,
  decodePaymentPayload,
  encodePaymentPayload,
  encodePaymentRequired,
  encodePaymentResponse,
} from '@nanosession/core';
import { NanoMacaroonFacilitator } from '@nanomacaroon/facilitator';
import type { Challenge, SettlementProof } from '@nanomacaroon/core';
import { getNextDemoDestination } from '../destination-pool';

let rpcClient: NanoRpcClient | null = null;
let facilitator: NanoMacaroonFacilitator | null = null;

export function __setProtectedFacilitatorForTests(nextFacilitator: NanoMacaroonFacilitator | null) {
  facilitator = nextFacilitator;
}

function getRpcClient(): NanoRpcClient {
  if (!rpcClient) {
    if (!process.env.NANO_RPC_URL) {
      throw new Error('NANO_RPC_URL environment variable is not set');
    }

    rpcClient = new NanoRpcClient({
      endpoints: [process.env.NANO_RPC_URL],
      timeoutMs: 15000,
    });
  }

  return rpcClient;
}

function getFacilitator(): NanoMacaroonFacilitator {
  if (!facilitator) {
    facilitator = new NanoMacaroonFacilitator({
      rootKey: process.env.MACAROON_ROOT_KEY ?? 'demo-root-key',
      location: 'x402-protected-demo',
      rpcClient: {
        async getBlockInfo(hash: string) {
          const rpc = getRpcClient() as unknown as {
            getBlockInfo?: (h: string) => Promise<{
              hash: string;
              block_account: string;
              amount: string;
              confirmed: boolean;
              contents?: { link_as_account?: string };
            } | null>;
          };

          const blockInfo = await rpc.getBlockInfo?.(hash);
          if (!blockInfo) {
            return null;
          }

          return {
            hash: blockInfo.hash,
            block_account: blockInfo.block_account,
            amount: blockInfo.amount,
            confirmed: blockInfo.confirmed,
            destination: blockInfo.contents?.link_as_account,
          };
        },
        async getAccountInfo(address: string) {
          const accountInfo = await getRpcClient().getAccountInfo(address);
          return {
            frontier: accountInfo.frontier,
            open_block: accountInfo.frontier,
          };
        },
      },
    });
  }

  return facilitator;
}

function getResourceUrl(req: Request): string {
  const proto = req.header('X-Forwarded-Proto') || req.protocol;
  const host = req.header('X-Forwarded-Host') || req.header('Host') || 'localhost:3001';
  return `${proto}://${host}${req.baseUrl || '/api/protected'}`;
}

const EXCLUSIVE_CONTENT_HTML = `
  <div class="exclusive-content">
    <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/TAT35tflCUM?si=TAzGQJ9jmgDuFgnw&amp;controls=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    <p><em>This content was unlocked after the client retried the protected resource request with a rev8 nanoMacaroon settlement proof.</em></p>
  </div>
`;

export const protectedRoute = Router();

protectedRoute.get('/', async (req: Request, res: Response) => {
  const paymentSignature = req.header('PAYMENT-SIGNATURE');
  const currentFacilitator = getFacilitator();

  if (!paymentSignature) {
    const payTo = getNextDemoDestination();
    const challenge = await currentFacilitator.createChallenge(
      payTo,
      '10000000000000000000000000000',
      {
        resourceUrl: getResourceUrl(req),
        resourceDescription: 'Access to protected demo content',
        expiresInSeconds: 180,
      }
    );

    const paymentRequired = buildPaymentRequired(getResourceUrl(req), challenge, {
      description: 'Access to protected demo content',
      mimeType: 'application/json',
    });

    res.status(402)
      .setHeader('PAYMENT-REQUIRED', encodePaymentRequired(paymentRequired))
      .json({
        x402Version: 2,
        error: 'Payment Required',
      });
    return;
  }

  const paymentPayload = decodePaymentPayload(paymentSignature);
  if (!paymentPayload || paymentPayload.payload.mode !== 'settle' || !('accepted' in paymentPayload)) {
    res.status(400).json({ error: 'Invalid PAYMENT-SIGNATURE payload' });
    return;
  }

  const proof = paymentPayload.payload as SettlementProof;
  const result = await currentFacilitator.verifySettlement(proof);

  if (!result.valid || !result.settlementResult) {
    res.status(402)
      .setHeader('PAYMENT-RESPONSE', encodePaymentResponse(buildPaymentResponse({
        version: 'nm1',
        mechanism: 'nanoMacaroon',
        mode: 'access',
        challengeId: proof.challengeId,
        acceptedPayment: {
          challengeId: proof.challengeId,
          sendHash: proof.sendHash,
          payerAccount: proof.payerAccount,
          destination: paymentPayload.accepted.payTo,
          network: paymentPayload.accepted.network,
          amount: paymentPayload.accepted.amount,
          settledAt: new Date().toISOString(),
        },
        credential: {
          format: 'macaroon',
          value: '',
        },
      }, false)))
      .json({ error: result.error ?? 'Settlement verification failed' });
    return;
  }

  res.status(200)
    .setHeader('PAYMENT-RESPONSE', encodePaymentResponse(buildPaymentResponse(result.settlementResult)))
    .json({
      success: true,
      html: EXCLUSIVE_CONTENT_HTML,
    });
});

protectedRoute.post('/', async (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Use GET /api/protected with PAYMENT-SIGNATURE' });
});
