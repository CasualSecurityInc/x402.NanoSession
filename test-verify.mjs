import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress, createBlock, signBlock } from 'nanocurrency';

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
  body: JSON.stringify({ action: 'account_info', account: clientAddress, representative: 'true' })
});

const infoData = await infoRes.json();
console.log('Balance:', infoData.balance);

// Generate work
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'work_generate', hash: infoData.frontier })
});

const workData = await workRes.json();
console.log('Work generated');

// Create and sign block
const blockData = {
  work: workData.work,
  balance: String(BigInt(infoData.balance) - 1000000000000000000000000n),
  representative: infoData.representative,
  previous: infoData.frontier,
  link: serverAddress
};

const block = createBlock(secretKeyHex, blockData);
const signature = signBlock({ hash: block.hash, secretKey: secretKeyHex });

console.log('Block hash:', block.hash);
console.log('Block link:', block.block.link_as_account);

// Process block
const processRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'process',
    block: { ...block.block, signature },
    json_block: true
  })
});

const processData = await processRes.json();
console.log('Process result:', processData.error || 'Success!');

// Wait and check block info
await new Promise(r => setTimeout(r, 3000));

const blockInfoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'block_info', hash: block.hash })
});

const blockInfo = await blockInfoRes.json();
console.log('Block info:', JSON.stringify(blockInfo, null, 2));
