import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

const seed = process.env.NANO_TEST_SEED || '';
if (!seed) {
  console.log('No seed set - create e2e.env with NANO_TEST_SEED');
  process.exit(0);
}

const index = 0;
const secretKeyHex = deriveSecretKey(seed, index);
const publicKeyHex = derivePublicKey(secretKeyHex);
const address = deriveAddress(publicKeyHex, { useNanoPrefix: true });

console.log('Seed:', seed.substring(0, 8) + '...' + seed.substring(56, 64));
console.log('Address from seed:', address);

// Check account info
const response = await fetch('https://rpc.nano.to', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'account_info',
    account: address
  })
});

const data = await response.json();
if (data.error) {
  console.log('Account error:', data.error);
} else {
  console.log('Balance:', data.balance, 'raw');
  console.log('Frontier:', data.frontier);
  console.log('Representative:', data.representative);
}
