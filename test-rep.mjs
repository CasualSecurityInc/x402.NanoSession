import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';

const clientAddress = 'nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye';

// Check representative
console.log('Checking account info...');
const infoRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'account_info', account: clientAddress })
});

const infoData = await infoRes.json();
console.log('Representative:', infoData.representative);

// Validate representative
console.log('\nValidating representative...');
const valRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'validate_account_number',
    account: infoData.representative 
  })
});

const valData = await valRes.json();
console.log('Validate response:', JSON.stringify(valData, null, 2));

// Try with account_block instead
console.log('\nTrying account_block...');
const blockRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'account_block',
    account: clientAddress,
    representative: infoData.representative
  })
});

const blockData = await blockRes.json();
console.log('Account block response:', JSON.stringify(blockData, null, 2));
