import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

const seed = process.env.NANO_TEST_SEED;
const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';

const secretKeyHex = deriveSecretKey(seed, 0);
const publicKeyHex = derivePublicKey(secretKeyHex);
const clientAddress = deriveAddress(publicKeyHex, { useNanoPrefix: true });
const serverAddress = deriveAddress(derivePublicKey(deriveSecretKey(seed, 1)), { useNanoPrefix: true });

console.log('Client:', clientAddress);
console.log('Server:', serverAddress);

// Get account info WITH representative
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'account_info', 
    account: clientAddress,
    representative: 'true'
  })
});

const infoData = await infoRes.json();
const representative = infoData.representative;
console.log('Representative:', representative);

const balance = BigInt(infoData.balance);
const sendAmount = 1000000000000000000000000n; // 0.001 XNO
const newBalance = balance - sendAmount;

console.log('Balance:', balance.toString(), 'raw');
console.log('Sending:', sendAmount.toString(), 'raw');

// Generate work
console.log('\nGenerating work...');
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'work_generate', 
    hash: infoData.frontier
  })
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
    representative: representative,
    balance: newBalance.toString(),
    link: serverAddress,
    key: secretKeyHex,
    work: workData.work
  })
});

const createData = await createRes.json();
if (createData.error) {
  console.log('Create error:', createData.error);
} else {
  console.log('Block created! Hash:', createData.hash);
  
  // Process block
  console.log('\nProcessing block...');
  const processRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'process',
      block: createData.block || createData,
      json_block: true
    })
  });
  
  const processData = await processRes.json();
  console.log('Process result:', processData.error || 'Success! Hash: ' + processData.hash);
}
