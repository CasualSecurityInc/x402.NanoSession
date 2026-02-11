import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

console.log('NANO_TEST_SEED:', process.env.NANO_TEST_SEED);
console.log('NANO_RPC_URL:', process.env.NANO_RPC_URL);
