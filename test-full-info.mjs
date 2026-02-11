import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const clientAddress = 'nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye';

// Get full account info
console.log('Getting account info...');
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'account_info', account: clientAddress, representative: 'true' })
});

const infoData = await infoRes.json();
console.log('All fields:', Object.keys(infoData));
console.log('Full response:', JSON.stringify(infoData, null, 2));

// Check if representative is in the response
if (infoData.representative) {
  console.log('\nRepresentative:', infoData.representative);
} else {
  console.log('\nNo representative in response');
  console.log('Available keys:', Object.keys(infoData));
}
