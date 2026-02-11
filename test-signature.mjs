import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';
import crypto from 'crypto';
import nacl from 'tweetnacl';

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
const representative = infoData.representative;
const frontier = infoData.frontier;
const balance = BigInt(infoData.balance);
const sendAmount = 1000000000000000000000000n;
const newBalance = balance - sendAmount;

// Generate work
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'work_generate', hash: frontier })
});

const workData = await workRes.json();
const work = workData.work;

// Create block JSON
const blockJson = {
  type: 'state',
  account: clientAddress,
  previous: frontier,
  representative: representative,
  balance: newBalance.toString(),
  link: serverAddress,
  work: work
};

console.log('Block JSON:', JSON.stringify(blockJson, null, 2));

// Hash and sign
const blockBytes = Buffer.from(JSON.stringify(blockJson), 'utf8');
const hash = crypto.createHash('blake2b', undefined).update(blockBytes).digest();
console.log('\nBlock hash:', hash.toString('hex'));

const signature = nacl.sign.detached(hash, Buffer.from(secretKeyHex, 'hex'));
console.log('Signature:', Buffer.from(signature).toString('hex'));

// Verify
const verified = nacl.sign.detached.verify(hash, signature, Buffer.from(publicKeyHex, 'hex'));
console.log('Signature verified:', verified);

// Process block manually
console.log('\nProcessing block...');
const processRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'process',
    block: {
      ...blockJson,
      signature: Buffer.from(signature).toString('hex')
    },
    json_block: true
  })
});

const processData = await processRes.json();
console.log('Process result:', JSON.stringify(processData, null, 2));
