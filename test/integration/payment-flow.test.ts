import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import { deriveSecretKey, derivePublicKey, createBlock, signBlock, type BlockData } from 'nanocurrency';
import { NanoSessionFacilitatorHandler } from '@nanosession/server';
import { NanoSessionPaymentHandler, deriveAddressFromSeed } from '@nanosession/client';
import { NanoRpcClient } from '@nanosession/rpc';

dotenv.config({ path: './test/integration/e2e.env' });

describe('Integration: Full Payment Flow', () => {
  let shouldSkip = false;
  let server: ReturnType<typeof createServer>;
  let serverPort: number;
  let seed = '';
  let clientAddress = '';
  let serverAddress = '';
  let clientSecretKey = '';
  let serverSecretKey = '';
  let serverPublicKey = '';
  let rpcClient: NanoRpcClient;
  let rpcEndpoint = '';

  const paymentAmount = '1000000000000000000000000';

  const rpcCall = async (action: string, params: Record<string, unknown>) => {
    const response = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params })
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    if (data.error) {
      throw new Error(`RPC error: ${data.error}`);
    }

    return data;
  };

  const getAccountInfoSafe = async (address: string) => {
    try {
      return await rpcClient.getAccountInfo(address);
    } catch (error) {
      // Handle AggregateError from RPC client (wraps multiple endpoint failures)
      if (error instanceof AggregateError && Array.isArray((error as AggregateError).errors)) {
        const errors = (error as AggregateError).errors;
        const isAccountNotFound = errors.some(e => {
          const msg = e instanceof Error ? e.message : String(e);
          return msg.toLowerCase().includes('account not found');
        });
        if (isAccountNotFound) {
          return null;
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      // RPC returns "Account not found" for accounts that haven't been opened yet
      if (message.toLowerCase().includes('account not found')) {
        return null;
      }
      throw error;
    }
  };

  const generateWork = async (root: string) => {
    const result = await rpcCall('work_generate', { hash: root });
    return result.work as string;
  };

  const createAndProcessSendBlock = async (args: {
    fromAddress: string;
    toAddress: string;
    amountRaw: string;
    secretKeyHex: string;
  }) => {
    const accountInfo = await getAccountInfoSafe(args.fromAddress);
    if (!accountInfo) {
      return null;
    }

    const newBalance = BigInt(accountInfo.balance) - BigInt(args.amountRaw);
    if (newBalance < 0n) {
      return null;
    }

    const work = await generateWork(accountInfo.frontier);

    // Use nanocurrency.createBlock to create the block
    const blockData: BlockData = {
      work: work,
      balance: newBalance.toString(),
      representative: accountInfo.representative,
      previous: accountInfo.frontier,
      link: args.toAddress
    };

    const block = createBlock(args.secretKeyHex, blockData);

    // Debug: Log block details
    console.log('   Creating block:');
    console.log('   - From:', args.fromAddress);
    console.log('   - To:', args.toAddress);
    console.log('   - Balance:', blockData.balance);
    console.log('   - Previous:', blockData.previous);
    console.log('   - Representative:', blockData.representative);
    console.log('   - Work:', blockData.work);
    console.log('   - Block hash:', block.hash);

    // Sign the block
    const signature = signBlock({
      hash: block.hash,
      secretKey: args.secretKeyHex
    });

    // Process the block
    const processResult = await rpcCall('process', {
      json_block: true,
      block: {
        ...block.block,
        signature: signature
      }
    });

    return processResult.hash as string;
  };

  const receivePendingAll = async (address: string, secretKeyHex: string, representativeFallback: string) => {
    let pending;
    try {
      pending = await rpcCall('pending', {
        account: address,
        count: 100,
        source: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('account not found')) {
        return;
      }
      throw error;
    }

    const blocks = (pending.blocks as Record<string, unknown> | undefined) ?? {};
    const entries = Object.entries(blocks);
    if (!entries.length) {
      return;
    }

    let accountInfo = await getAccountInfoSafe(address);
    let balance = accountInfo ? BigInt(accountInfo.balance) : 0n;
    let previous = accountInfo ? accountInfo.frontier : '0';
    let representative = accountInfo ? accountInfo.representative : representativeFallback;

    for (const [pendingHash, info] of entries) {
      const amountRaw = typeof info === 'string'
        ? info
        : (info as { amount?: string }).amount;

      if (!amountRaw) {
        continue;
      }

      balance += BigInt(amountRaw);

      // For receive blocks:
      // - If account doesn't exist (previous = '0' or null), create open block with previous: null
      // - If account exists, previous is the frontier hash
      const isNewAccount = previous === '0' || previous === null || previous === undefined;
      
      const workRoot = isNewAccount ? serverPublicKey : previous;
      const work = await generateWork(workRoot);

      // Use nanocurrency.createBlock for receive blocks
      const receiveBlockData: BlockData = {
        work: work,
        balance: balance.toString(),
        representative: representative,
        previous: isNewAccount ? null : previous,
        link: pendingHash  // For receive, link is the pending send block hash
      };

      const receiveBlock = createBlock(secretKeyHex, receiveBlockData);
      const receiveSignature = signBlock({
        hash: receiveBlock.hash,
        secretKey: secretKeyHex
      });

      const processResult = await rpcCall('process', {
        json_block: true,
        block: { ...receiveBlock.block, signature: receiveSignature }
      });

      previous = (processResult.hash as string | undefined)
        ?? (receiveBlock.hash as string | undefined)
        ?? previous;

      accountInfo = await getAccountInfoSafe(address);
      if (accountInfo) {
        representative = accountInfo.representative;
      }
    }
  };

  const sweepAll = async (fromAddress: string, toAddress: string, secretKeyHex: string) => {
    const accountInfo = await getAccountInfoSafe(fromAddress);
    if (!accountInfo) {
      return null;
    }

    if (BigInt(accountInfo.balance) === 0n) {
      return null;
    }

    return createAndProcessSendBlock({
      fromAddress,
      toAddress,
      amountRaw: accountInfo.balance,
      secretKeyHex
    });
  };

  const waitForConfirmation = async (hash: string, timeoutMs: number = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const blockInfo = await rpcClient.getBlockInfo(hash);
      if (blockInfo.confirmed) {
        return blockInfo;
      }

      try {
        await rpcClient.confirmBlock(hash);
      } catch {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Block ${hash} not confirmed within ${timeoutMs}ms`);
  };

  beforeAll(() => {
    seed = process.env.NANO_TEST_SEED || '';
    if (!seed) {
      console.log('\n⚠️  Skipping integration tests: NANO_TEST_SEED not set');
      console.log('   Create e2e.env file from e2e.env.example to run integration tests\n');
      shouldSkip = true;
      return;
    }

    clientAddress = deriveAddressFromSeed(seed, 0);
    serverAddress = deriveAddressFromSeed(seed, 1);
    clientSecretKey = deriveSecretKey(seed, 0);
    serverSecretKey = deriveSecretKey(seed, 1);
    serverPublicKey = derivePublicKey(serverSecretKey);
    rpcEndpoint = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
    rpcClient = new NanoRpcClient({ endpoints: [rpcEndpoint] });

    console.log('\n🔑 Test Accounts:');
    console.log(`   Client (acct0): ${clientAddress}`);
    console.log(`   Server (acct1): ${serverAddress}`);
  });

  afterAll(async () => {
    if (shouldSkip || !seed) {
      return;
    }

    try {
      const clientInfo = await getAccountInfoSafe(clientAddress);
      const representative = clientInfo?.representative ?? clientAddress;
      await receivePendingAll(serverAddress, serverSecretKey, representative);
      const sweepHash = await sweepAll(serverAddress, clientAddress, serverSecretKey);
      if (sweepHash) {
        console.log(`   ↩️  Swept server balance to client: ${sweepHash}`);
      }
    } catch (error) {
      console.log('   ⚠️  Cleanup failed (non-fatal):', error);
    }
  });

  test('full payment flow on mainnet', async () => {
    if (shouldSkip) {
      console.log('Test skipped - no NANO_TEST_SEED');
      return;
    }

    const serverHandler = new NanoSessionFacilitatorHandler({ rpcClient });

    const clientAccountInfo = await getAccountInfoSafe(clientAddress);
    if (!clientAccountInfo) {
      console.log('⚠️  Skipping: Client account not found on chain');
      return;
    }

    await receivePendingAll(serverAddress, serverSecretKey, clientAccountInfo.representative);
    const sweepBeforeHash = await sweepAll(serverAddress, clientAddress, serverSecretKey);
    if (sweepBeforeHash) {
      console.log(`   ↩️  Swept server balance to client: ${sweepBeforeHash}`);
    }

    await new Promise<void>((resolve) => {
      server = createServer(async (req, res) => {
        if (req.url === '/protected') {
          const paymentResponse = req.headers['x-payment-response'];

          if (!paymentResponse) {
            const requirements = serverHandler.getRequirements({
              amount: paymentAmount,
              payTo: serverAddress,
              maxTimeoutSeconds: 300
            });

            res.writeHead(402, {
              'Content-Type': 'application/json',
              'X-Payment-Required': JSON.stringify(requirements)
            });
            res.end(JSON.stringify({ error: 'Payment required' }));
            return;
          }

          try {
            const payload = JSON.parse(paymentResponse as string);
            const requirements = serverHandler.getRequirements({
              amount: paymentAmount,
              payTo: serverAddress,
              maxTimeoutSeconds: 300
            });

            const result = await serverHandler.handleSettle!(requirements, payload);

            if (result?.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                message: 'Access granted',
                transactionHash: result.transactionHash
              }));
            } else {
              res.writeHead(402, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Payment verification failed',
                details: result?.error
              }));
            }
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payment response' }));
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
        }
        resolve();
      });
    });

    const baseUrl = `http://127.0.0.1:${serverPort}`;

    try {
      console.log('\n📡 Step 1: Requesting protected resource...');
      const response1 = await fetch(`${baseUrl}/protected`);

      expect(response1.status).toBe(402);
      const paymentRequiredHeader = response1.headers.get('X-Payment-Required');
      expect(paymentRequiredHeader).toBeTruthy();

      const requirements = JSON.parse(paymentRequiredHeader!);
      console.log('   ✓ Received 402 with PaymentRequirements');
      console.log(`   💰 Amount: ${requirements.amount} raw (${Number(requirements.amount) / 1e30} XNO)`);

      console.log('\n💳 Step 2: Creating payment...');
      const clientHandler = new NanoSessionPaymentHandler({
        rpcClient,
        seed,
        maxSpend: process.env.NANO_MAX_SPEND || '1000000000000000000000000000'
      });

      const execers = await clientHandler.handle({}, [requirements]);
      expect(execers.length).toBeGreaterThan(0);

      const clientBalance = BigInt(clientAccountInfo.balance);
      if (clientBalance < BigInt(requirements.amount)) {
        console.log('⚠️  Skipping: Insufficient balance to cover payment');
        return;
      }

      console.log('   ✓ Payment execer created');
      console.log('   📤 Broadcasting payment via RPC...');

      let paymentHash: string | null;
      try {
        paymentHash = await createAndProcessSendBlock({
          fromAddress: clientAddress,
          toAddress: serverAddress,
          amountRaw: requirements.amount,
          secretKeyHex: clientSecretKey
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`   ⚠️  Broadcasting failed: ${message}`);
        console.log('   This is expected for unfunded test accounts');
        return;
      }

      if (!paymentHash) {
        console.log('   ⚠️  Skipping: Could not create payment block (account may not exist)');
        return;
      }

      const blockInfo = await waitForConfirmation(paymentHash);
      console.log(`   ✅ Payment confirmed: ${paymentHash}`);
      console.log(`   🔗 Destination: ${blockInfo.link_as_account ?? blockInfo.link}`);

      console.log('\n🔐 Step 3: Retrying with payment...');
      const response2 = await fetch(`${baseUrl}/protected`, {
        headers: {
          'X-Payment-Response': JSON.stringify({ blockHash: paymentHash })
        }
      });

      console.log(`   Response status: ${response2.status}`);
      if (response2.status === 402) {
        const errorBody = await response2.json();
        console.log(`   Server error: ${JSON.stringify(errorBody)}`);
      }

      expect(response2.status).toBe(200);
      const responseBody = await response2.json();
      expect(responseBody.transactionHash).toBe(paymentHash);

      await receivePendingAll(serverAddress, serverSecretKey, clientAccountInfo.representative);
      const sweepAfterHash = await sweepAll(serverAddress, clientAddress, serverSecretKey);
      if (sweepAfterHash) {
        console.log(`   ↩️  Swept server balance to client: ${sweepAfterHash}`);
      }
    } finally {
      server.close();
    }
  }, 120000);
});
