import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { deriveSecretKey, derivePublicKey, deriveAddress } from 'nanocurrency';

const seed = process.env.NANO_TEST_SEED;
const index = 0;
const secretKeyHex = deriveSecretKey(seed, index);
const publicKeyHex = derivePublicKey(secretKeyHex);
const address = deriveAddress(publicKeyHex, { useNanoPrefix: true });

console.log('Seed:', seed);
console.log('Derived address (acct0):', address);
console.log('');
console.log('Expected address: nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye');
console.log('Match:', address === 'nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye' ? 'YES' : 'NO');
