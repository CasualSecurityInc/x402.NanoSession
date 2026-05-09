import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { testApp } from './app';
import { decodePaymentRequired, decodePaymentPayload, decodePaymentResponse } from '@nanosession/core';
import { NanoMacaroonFacilitator } from '@nanomacaroon/facilitator';
import { __setPollRpcClientForTests } from '../routes/poll';
import { __setProtectedFacilitatorForTests } from '../routes/protected';
import { getNextDemoDestination, resetDemoDestinationPoolForTests } from '../destination-pool';

const SEND_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PAYER_ACCOUNT = 'nano_1111111111111111111111111111111111111111111111111111hifc8npp';

process.env.NANO_RPC_URL = 'http://localhost:7076';
process.env.NANO_SERVER_ADDRESS = 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4';
process.env.MACAROON_ROOT_KEY = 'demo-test-root-key';

describe('Protected demo routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.NANO_TEST_SEED;
    delete process.env.NANO_DEMO_ADDRESS_POOL_SIZE;
    delete process.env.NANO_DEMO_ADDRESS_START_INDEX;
    resetDemoDestinationPoolForTests();
    __setPollRpcClientForTests({
      async getAccountHistory() {
        return [
          {
            type: 'send',
            account: PAYER_ACCOUNT,
            amount: '10000000000000000000000000000',
            hash: SEND_HASH,
            local_timestamp: '0',
            height: '1',
            confirmed: 'true',
          }
        ];
      },
      async getBlockInfo() {
        return {
          hash: SEND_HASH,
          type: 'state',
          block_account: PAYER_ACCOUNT,
          amount: '10000000000000000000000000000',
          confirmed: true,
          link_as_account: process.env.NANO_SERVER_ADDRESS,
        };
      },
    } as any);

    __setProtectedFacilitatorForTests(new NanoMacaroonFacilitator({
      rootKey: process.env.MACAROON_ROOT_KEY!,
      location: 'protected-demo-test',
      rpcClient: {
        async getBlockInfo(hash: string) {
          if (hash !== SEND_HASH) return null;
          return {
            hash,
            block_account: PAYER_ACCOUNT,
            amount: '10000000000000000000000000000',
            destination: process.env.NANO_SERVER_ADDRESS,
            confirmed: true,
          };
        },
        async getAccountInfo() {
          return {
            frontier: SEND_HASH,
            open_block: SEND_HASH,
          };
        },
      },
    }));
  });

  it('returns PAYMENT-REQUIRED on the first request', async () => {
    const response = await request(testApp).get('/api/protected');

    expect(response.status).toBe(402);
    expect(response.headers['payment-required']).toBeDefined();

    const paymentRequired = decodePaymentRequired(response.headers['payment-required']);
    expect(paymentRequired).not.toBeNull();
    expect(paymentRequired!.accepts[0].extra.challenge.mechanism).toBe('nanoMacaroon');
    expect(paymentRequired!.accepts[0].extra.challenge.mode).toBe('settle');
    expect(paymentRequired!.accepts[0].payTo).toBe(process.env.NANO_SERVER_ADDRESS);
  });

  it('allocates unique payTo addresses from a bounded derived pool when NANO_TEST_SEED is configured', async () => {
    process.env.NANO_TEST_SEED = '809BA38BC4301B0170E972161C384ADFE2D19702031762EFEA78637BAE6AC045';
    process.env.NANO_DEMO_ADDRESS_POOL_SIZE = '2';
    process.env.NANO_DEMO_ADDRESS_START_INDEX = '1';
    resetDemoDestinationPoolForTests();

    const expectedA = getNextDemoDestination();
    const expectedB = getNextDemoDestination();
    resetDemoDestinationPoolForTests();

    const responseA = await request(testApp).get('/api/protected');
    const responseB = await request(testApp).get('/api/protected');

    const paymentRequiredA = decodePaymentRequired(responseA.headers['payment-required']);
    const paymentRequiredB = decodePaymentRequired(responseB.headers['payment-required']);

    expect(paymentRequiredA!.accepts[0].payTo).toBe(expectedA);
    expect(paymentRequiredB!.accepts[0].payTo).toBe(expectedB);
    expect(paymentRequiredA!.accepts[0].payTo).not.toBe(paymentRequiredB!.accepts[0].payTo);
  });

  it('returns PAYMENT-RESPONSE on successful settlement proof retry', async () => {
    const challengeResponse = await request(testApp).get('/api/protected');
    const paymentRequired = decodePaymentRequired(challengeResponse.headers['payment-required']);
    const requirements = paymentRequired!.accepts[0];

    const signaturePayload = {
      x402Version: 2 as const,
      accepted: requirements,
      payload: {
        version: 'nm1' as const,
        mechanism: 'nanoMacaroon' as const,
        mode: 'settle' as const,
        challengeId: requirements.extra.challenge.id,
        challenge: Buffer.from(JSON.stringify(requirements.extra.challenge)).toString('base64url'),
        payerAccount: PAYER_ACCOUNT,
        sendHash: SEND_HASH,
        proofOptions: {
          blockIncluded: false,
        },
      },
    };

    const encodedSignature = Buffer.from(JSON.stringify(signaturePayload)).toString('base64url');
    const response = await request(testApp)
      .get('/api/protected')
      .set('PAYMENT-SIGNATURE', encodedSignature);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers['payment-response']).toBeDefined();

    const paymentResponse = decodePaymentResponse(response.headers['payment-response']);
    expect(paymentResponse).not.toBeNull();
    expect(paymentResponse!.result.acceptedPayment.sendHash).toBe(SEND_HASH);
    expect(paymentResponse!.result.acceptedPayment.payerAccount).toBe(PAYER_ACCOUNT);

    const decodedSignature = decodePaymentPayload(encodedSignature);
    expect(decodedSignature).not.toBeNull();
    expect(decodedSignature!.payload.mode).toBe('settle');
  });

  it('finds a matching send via the demo polling endpoint', async () => {
    const response = await request(testApp)
      .get('/api/poll-for-demo')
      .query({
        payerAccount: PAYER_ACCOUNT,
        payTo: process.env.NANO_SERVER_ADDRESS,
        amount: '10000000000000000000000000000',
      });

    expect(response.status).toBe(200);
    expect(response.body.found).toBe(true);
    expect(response.body.sendHash).toBe(SEND_HASH);
  });
});
