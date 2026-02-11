import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

const seed = process.env.NANO_TEST_SEED;
const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';

// Derive accounts
const secretKeyHex = deriveSecretKey(seed, 0);
const publicKeyHex = derivePublicKey(secretKeyHex);
const clientAddress = deriveAddress(publicKeyHex, { useNanoPrefix: true });

const serverSecretKeyHex = deriveSecretKey(seed, 1);
const serverPublicKeyHex = derivePublicKey(serverSecretKeyHex);
const serverAddress = deriveAddress(serverPublicKeyHex, { useNanoPrefix: true });

console.log('Client (acct0):', clientAddress);
console.log('Server (acct1):', serverAddress);
console.log('');

// Get client account info
console.log('Getting client account info...');
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'account_info', account: clientAddress })
});

const infoData = await infoRes.json();
console.log('Account info:', JSON.stringify(infoData, null, 2));

if (infoData.error) {
  console.log('Error:', infoData.error);
  process.exit(0);
}

// Generate work
console.log('\nGenerating work...');
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'work_generate', hash: infoData.frontier })
});

const workData = await workRes.json();
console.log('Work:', workData.work);

// Create block
console.log('\nCreating block...');
const createRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'block_create',
    type: 'state',
    account: clientAddress,
    previous: infoData.frontier,
    representative: infoData.representative,
    balance: String(BigInt(infoData.balance) - 1000000000000000000000000n),
    link: serverAddress,
    key: secretKeyHex,
    work: workData.work
  })
});

const createData = await createRes.json();
console.log('Block create response:', JSON.stringify(createData, null, 2));
