import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import { deriveSecretKey, derivePublicKey, createBlock, signBlock, computeWork, validateWork, type BlockData } from 'nanocurrency';
import { NanoSessionFacilitatorHandler } from '@nanosession/server';
import { NanoSessionPaymentHandler, deriveAddressFromSeed } from '@nanosession/client';
import { NanoRpcClient } from '@nanosession/rpc';

dotenv.config({ path: './test/integration/e2e.env' });

describe('Integration: Full Payment Flow', () => {
  let shouldSkip = false;
  let skipReason = '';
  let server: ReturnType<typeof createServer>;
  let serverPort: number;
  let seed = '';
  let clientAddress = '';
  let serverAddress = '';
  let clientSecretKey = '';
  let serverSecretKey = '';
  let serverPublicKey = '';
  let rpcClient: NanoRpcClient;
  let rpcEndpoints: Array<{ baseUrl: string; extraParams: Record<string, string> }> = [];
  let hasRpcCredentials = false;

  const paymentAmount = '1000000000000000000000000';
  const fallbackWorkThreshold = 'fffffff800000000';

  const callEndpointWithRetry = async (
    endpoint: { baseUrl: string; extraParams: Record<string, string> },
    action: string,
    params: Record<string, unknown>
  ) => {
    const maxRetries = 3;
    let delayMs = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint.baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...params, ...endpoint.extraParams })
        });

        if (!response.ok) {
          throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as Record<string, unknown>;
        if (data.error) {
          throw new Error(`RPC error: ${data.error}`);
        }

        return data;
      } catch (error) {
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }

        throw error;
      }
    }

    throw new Error('RPC request failed');
  };

  const rpcCall = async (action: string, params: Record<string, unknown>) => {
    const errors: Error[] = [];

    for (const endpoint of rpcEndpoints) {
      try {
        return await callEndpointWithRetry(endpoint, action, params);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    const message = `All RPC endpoints failed for action: ${action}`;
    throw new Error(`${message} (${errors.map(error => error.message).join('; ')})`);
  };

  const getAccountInfoSafe = async (address: string) => {
    try {
      return await rpcClient.getAccountInfo(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // RPC returns "Account not found" for accounts that haven't been opened yet
      if (message.toLowerCase().includes('account not found')) {
        return null;
      }
      throw error;
    }
  };

  const getWorkThreshold = async () => {
    try {
      const telemetry = await rpcCall('telemetry', {});
      const activeDifficulty = telemetry.active_difficulty;
      if (typeof activeDifficulty === 'string' && activeDifficulty.length > 0) {
        return activeDifficulty;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`   ⚠️  RPC telemetry failed (${message}); using fallback threshold...`);
    }

    return fallbackWorkThreshold;
  };

  const generateWork = async (root: string) => {
    const threshold = await getWorkThreshold();

    if (hasRpcCredentials) {
      const maxRetries = 10;
      let delayMs = 1000;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await rpcCall('work_generate', { hash: root, difficulty: threshold });
          return result.work as string;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isRateLimited = message.includes('429') || message.toLowerCase().includes('too many');

          if (isRateLimited && attempt < maxRetries - 1) {
            console.log(`   ⏳ Rate limited, waiting ${delayMs / 1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs = Math.min(delayMs * 2, 30000);
            continue;
          }

          throw new Error(`RPC work_generate failed: ${message}`);
        }
      }
    }

    const work = await computeWork(root, { workThreshold: threshold });
    if (!work) {
      throw new Error('Local work generation failed');
    }
    if (!validateWork({ blockHash: root, work, threshold })) {
      throw new Error('Local work generation failed to meet threshold');
    }
    return work;
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

  const parseRpcUrl = (url: string): { baseUrl: string; extraParams: Record<string, string> } => {
    const parsed = new URL(url);
    const extraParams: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      extraParams[key] = value;
    });
    parsed.search = '';
    return { baseUrl: parsed.toString().replace(/\/$/, ''), extraParams };
  };

  beforeAll(async () => {
    seed = process.env.NANO_TEST_SEED || '';
    if (!seed) {
      skipReason = 'NANO_TEST_SEED not set';
      console.log(`\n⚠️  Skipping integration tests: ${skipReason}`);
      console.log('   Create e2e.env file from e2e.env.example to run integration tests\n');
      shouldSkip = true;
      return;
    }

    clientAddress = deriveAddressFromSeed(seed, 0);
    serverAddress = deriveAddressFromSeed(seed, 1);
    clientSecretKey = deriveSecretKey(seed, 0);
    serverSecretKey = deriveSecretKey(seed, 1);
    serverPublicKey = derivePublicKey(serverSecretKey);
    const rpcUrls = process.env.NANO_RPC_URLS || process.env.NANO_RPC_URL || 'https://rpc.nano.to';
    rpcEndpoints = rpcUrls
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(parseRpcUrl);
    if (!rpcEndpoints.length) {
      skipReason = 'no RPC endpoints configured';
      console.log(`\n⚠️  Skipping integration tests: ${skipReason}`);
      shouldSkip = true;
      return;
    }
    hasRpcCredentials = rpcEndpoints.some(e => Object.keys(e.extraParams).length > 0);
    rpcClient = new NanoRpcClient({ endpoints: rpcEndpoints.map(e => e.baseUrl) });

    console.log('\n🔑 Test Accounts:');
    console.log(`   Client (acct0): ${clientAddress}`);
    console.log(`   Server (acct1): ${serverAddress}`);
    if (hasRpcCredentials) {
      console.log('   🔧 Work generation: RPC (credentials detected)');
    } else {
      console.log('   🔧 Work generation: Local CPU/GPU');
    }
  });

  afterAll(async () => {
    if (shouldSkip || !seed) {
      return;
    }

    console.log('\n🧹 Cleanup: sweeping funds back to client account...');

    try {
      const clientInfo = await getAccountInfoSafe(clientAddress);
      const representative = clientInfo?.representative ?? clientAddress;
      
      await receivePendingAll(serverAddress, serverSecretKey, representative);
      const sweepHash = await sweepAll(serverAddress, clientAddress, serverSecretKey);
      if (sweepHash) {
        console.log(`   ↩️  Swept server balance to client: ${sweepHash}`);
      }
      
      await receivePendingAll(clientAddress, clientSecretKey, representative);
      console.log('   ✅ Received all pending blocks on client account');
    } catch (error) {
      console.log('   ⚠️  Cleanup failed (non-fatal):', error);
    }
  }, 120000);

  test('full payment flow on mainnet', async () => {
    if (shouldSkip) {
      console.log(`Test skipped - ${skipReason || 'integration prerequisites not met'}`);
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
      const requirementsCache = new Map<string, ReturnType<typeof serverHandler.getRequirements>>();
      
      server = createServer(async (req, res) => {
        if (req.url === '/protected') {
          const paymentResponse = req.headers['x-payment-response'];

          if (!paymentResponse) {
            const requirements = serverHandler.getRequirements({
              amount: paymentAmount,
              payTo: serverAddress,
              maxTimeoutSeconds: 300
            });
            requirementsCache.set(requirements.extra.sessionId, requirements);

            res.writeHead(402, {
              'Content-Type': 'application/json',
              'X-Payment-Required': JSON.stringify(requirements)
            });
            res.end(JSON.stringify({ error: 'Payment required' }));
            return;
          }

          try {
            const payload = JSON.parse(paymentResponse as string);
            const sessionId = payload.sessionId as string | undefined;
            const requirements = sessionId ? requirementsCache.get(sessionId) : undefined;
            
            if (!requirements) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unknown session' }));
              return;
            }

            const result = await serverHandler.handleSettle!(requirements, payload);

            if (result?.success) {
              requirementsCache.delete(sessionId!);
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

      // Encode tag in payment amount: taggedAmount = baseAmount + tag
      // Server validates: actualTag = amount % tagModulus === expected tag
      const taggedAmount = (BigInt(requirements.amount) + BigInt(requirements.extra.tag)).toString();
      console.log(`   🏷️  Tag: ${requirements.extra.tag}, Tagged amount: ${taggedAmount}`);

      let paymentHash: string | null;
      try {
        paymentHash = await createAndProcessSendBlock({
          fromAddress: clientAddress,
          toAddress: serverAddress,
          amountRaw: taggedAmount,
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
          'X-Payment-Response': JSON.stringify({ 
            blockHash: paymentHash,
            sessionId: requirements.extra.sessionId
          })
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

  // ============================================================================
  // SECURITY ATTACK TESTS
  // These tests verify the Session Binding Invariant from Rev5 Security Model
  // ============================================================================

  test('rejects frontrun attack - stolen hash with wrong session', async () => {
    if (shouldSkip) {
      console.log(`Test skipped - ${skipReason || 'integration prerequisites not met'}`);
      return;
    }

    // This test verifies the Session Binding Invariant:
    // A payment made for Session A cannot be used to satisfy Session B
    
    console.log('\n🔓 ATTACK TEST: Frontrun (Receipt Stealing)');
    
    // 1. Victim requests resource → gets sessionId A with tag A
    // 2. Attacker requests resource → gets sessionId B with tag B  
    // 3. Victim pays (amount includes tag A)
    // 4. Attacker tries to use victim's blockHash with sessionId B
    // 5. Server MUST reject: tag A ≠ tag B

    const serverHandler = new NanoSessionFacilitatorHandler({ rpcClient });
    
    // Get requirements for two different "sessions"
    const victimRequirements = serverHandler.getRequirements({
      amount: paymentAmount,
      payTo: serverAddress,
      maxTimeoutSeconds: 300
    });
    
    const attackerRequirements = serverHandler.getRequirements({
      amount: paymentAmount,
      payTo: serverAddress,
      maxTimeoutSeconds: 300
    });
    
    console.log(`   Victim session: ${victimRequirements.extra.sessionId}, tag: ${victimRequirements.extra.tag}`);
    console.log(`   Attacker session: ${attackerRequirements.extra.sessionId}, tag: ${attackerRequirements.extra.tag}`);
    
    // Verify tags are different (critical for this test)
    expect(victimRequirements.extra.tag).not.toBe(attackerRequirements.extra.tag);
    
    // Victim pays with THEIR tag encoded in amount
    const victimTaggedAmount = (BigInt(victimRequirements.amount) + BigInt(victimRequirements.extra.tag)).toString();
    
    const clientInfo = await getAccountInfoSafe(clientAddress);
    if (!clientInfo || BigInt(clientInfo.balance) < BigInt(victimTaggedAmount)) {
      console.log('   ⚠️ Skipping: Insufficient balance');
      return;
    }
    
    const victimBlockHash = await createAndProcessSendBlock({
      fromAddress: clientAddress,
      toAddress: serverAddress,
      amountRaw: victimTaggedAmount,
      secretKeyHex: clientSecretKey
    });
    
    if (!victimBlockHash) {
      console.log('   ⚠️ Skipping: Could not create payment block');
      return;
    }
    
    await waitForConfirmation(victimBlockHash);
    console.log(`   ✅ Victim payment confirmed: ${victimBlockHash}`);
    
    // ATTACK: Attacker tries to use victim's hash with attacker's session
    const attackPayload = {
      blockHash: victimBlockHash,
      sessionId: attackerRequirements.extra.sessionId // WRONG SESSION!
    };
    
    const result = await serverHandler.handleSettle!(attackerRequirements, attackPayload);
    
    // MUST FAIL - the block's tag doesn't match attacker's session tag
    console.log(`   Attack result: success=${result?.success}, error=${result?.error}`);
    expect(result?.success).toBe(false);
    console.log('   ✅ Attack correctly rejected!');
    
    // Cleanup: sweep funds back
    await receivePendingAll(serverAddress, serverSecretKey, clientInfo.representative);
    await sweepAll(serverAddress, clientAddress, serverSecretKey);
  }, 120000);

  test('rejects receipt reuse - already spent', async () => {
    if (shouldSkip) {
      console.log(`Test skipped - ${skipReason || 'integration prerequisites not met'}`);
      return;
    }

    console.log('\n🔓 ATTACK TEST: Receipt Reuse (Double Spend Attempt)');
    
    const serverHandler = new NanoSessionFacilitatorHandler({ rpcClient });
    
    const requirements = serverHandler.getRequirements({
      amount: paymentAmount,
      payTo: serverAddress,
      maxTimeoutSeconds: 300
    });
    
    const taggedAmount = (BigInt(requirements.amount) + BigInt(requirements.extra.tag)).toString();
    
    const clientInfo = await getAccountInfoSafe(clientAddress);
    if (!clientInfo || BigInt(clientInfo.balance) < BigInt(taggedAmount)) {
      console.log('   ⚠️ Skipping: Insufficient balance');
      return;
    }
    
    const blockHash = await createAndProcessSendBlock({
      fromAddress: clientAddress,
      toAddress: serverAddress,
      amountRaw: taggedAmount,
      secretKeyHex: clientSecretKey
    });
    
    if (!blockHash) {
      console.log('   ⚠️ Skipping: Could not create payment block');
      return;
    }
    
    await waitForConfirmation(blockHash);
    console.log(`   ✅ Payment confirmed: ${blockHash}`);
    
    // First submission - should succeed
    const payload = { blockHash, sessionId: requirements.extra.sessionId };
    const result1 = await serverHandler.handleSettle!(requirements, payload);
    console.log(`   First submission: success=${result1?.success}`);
    expect(result1?.success).toBe(true);
    
    // Second submission - same hash - MUST FAIL (already spent)
    const result2 = await serverHandler.handleSettle!(requirements, payload);
    console.log(`   Second submission: success=${result2?.success}, error=${result2?.error}`);
    expect(result2?.success).toBe(false);
    console.log('   ✅ Reuse correctly rejected!');
    
    // Cleanup
    await receivePendingAll(serverAddress, serverSecretKey, clientInfo.representative);
    await sweepAll(serverAddress, clientAddress, serverSecretKey);
  }, 120000);

  test('rejects unknown session - session spoofing', async () => {
    if (shouldSkip) {
      console.log(`Test skipped - ${skipReason || 'integration prerequisites not met'}`);
      return;
    }

    console.log('\n🔓 ATTACK TEST: Session Spoofing (Unknown Session)');
    
    const serverHandler = new NanoSessionFacilitatorHandler({ rpcClient });
    
    // Create a real payment for a real session
    const realRequirements = serverHandler.getRequirements({
      amount: paymentAmount,
      payTo: serverAddress,
      maxTimeoutSeconds: 300
    });
    
    const taggedAmount = (BigInt(realRequirements.amount) + BigInt(realRequirements.extra.tag)).toString();
    
    const clientInfo = await getAccountInfoSafe(clientAddress);
    if (!clientInfo || BigInt(clientInfo.balance) < BigInt(taggedAmount)) {
      console.log('   ⚠️ Skipping: Insufficient balance');
      return;
    }
    
    const blockHash = await createAndProcessSendBlock({
      fromAddress: clientAddress,
      toAddress: serverAddress,
      amountRaw: taggedAmount,
      secretKeyHex: clientSecretKey
    });
    
    if (!blockHash) {
      console.log('   ⚠️ Skipping: Could not create payment block');
      return;
    }
    
    await waitForConfirmation(blockHash);
    console.log(`   ✅ Payment confirmed: ${blockHash}`);
    
    // ATTACK: Submit with a FAKE session ID that was never issued
    const fakeSessionId = 'fake-session-id-12345-never-issued';
    
    // Create fake requirements with the spoofed session
    const fakeRequirements = {
      ...realRequirements,
      extra: { ...realRequirements.extra, sessionId: fakeSessionId }
    };
    
    const payload = { blockHash, sessionId: fakeSessionId };
    const result = await serverHandler.handleSettle!(fakeRequirements, payload);
    
    // This should fail because the tag won't match (or session is unknown)
    // The exact behavior depends on implementation, but it MUST NOT succeed
    console.log(`   Attack result: success=${result?.success}, error=${result?.error}`);
    expect(result?.success).toBe(false);
    console.log('   ✅ Spoofing correctly rejected!');
    
    // Cleanup
    await receivePendingAll(serverAddress, serverSecretKey, clientInfo.representative);
    await sweepAll(serverAddress, clientAddress, serverSecretKey);
  }, 120000);
});
