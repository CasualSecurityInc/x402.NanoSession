import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const blockHash = '19B45E2650EADBA5985DEDD68E2E8A6EF38BB27B027707AD687C6CD1A4B77BC6';

const response = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'block_info',
    hash: blockHash,
    json_block: true
  })
});

const data = await response.json();
console.log('Block info:', JSON.stringify(data, null, 2));
