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

// Get account info
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'account_info', account: clientAddress })
});

const infoData = await infoRes.json();
if (infoData.error) {
  console.log('Account error:', infoData.error);
  process.exit(0);
}

const balance = BigInt(infoData.balance);
const sendAmount = 1000000000000000000000000n; // 0.001 XNO
const newBalance = balance - sendAmount;

console.log('Current balance:', balance.toString(), 'raw');
console.log('Sending:', sendAmount.toString(), 'raw');
console.log('New balance:', newBalance.toString(), 'raw');
console.log('Frontier:', infoData.frontier);

// Try generating work with higher difficulty
console.log('\nGenerating work...');
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'work_generate', 
    hash: infoData.frontier,
    difficulty: 'fffffff800000000'  // Minimum difficulty
  })
});

const workData = await workRes.json();
console.log('Work:', workData.work);
console.log('Multiplier:', workData.multiplier);

// Create block
console.log('\nCreating block...');
const blockParams = {
  account: clientAddress,
  previous: infoData.frontier,
  representative: infoData.representative,
  balance: newBalance.toString(),
  link: serverAddress,
  key: secretKeyHex,
  work: workData.work
};

console.log('Block params:', JSON.stringify(blockParams, null, 2));

const createRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'block_create',
    type: 'state',
    ...blockParams
  })
});

const createData = await createRes.json();
console.log('Create response:', JSON.stringify(createData, null, 2));

if (createData.hash) {
  console.log('\nBlock created! Hash:', createData.hash);
  
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
  console.log('Process response:', JSON.stringify(processData, null, 2));
}
