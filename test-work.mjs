import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress, createBlock, signBlock } from 'nanocurrency';

const seed = process.env.NANO_TEST_SEED;
const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';

const secretKeyHex = deriveSecretKey(seed, 0);
const publicKeyHex = derivePublicKey(secretKeyHex);
const clientAddress = deriveAddress(publicKeyHex, { useNanoPrefix: true });
const serverAddress = deriveAddress(derivePublicKey(deriveSecretKey(seed, 1)), { useNanoPrefix: true });

// Get account info
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'account_info', account: clientAddress, representative: 'true' })
});

const infoData = await infoRes.json();
console.log('Balance:', infoData.balance);
console.log('Frontier:', infoData.frontier);

// Generate work
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'work_generate', hash: infoData.frontier })
});

const workData = await workRes.json();
console.log('Work data:', JSON.stringify(workData, null, 2));
console.log('Work type:', typeof workData.work);
