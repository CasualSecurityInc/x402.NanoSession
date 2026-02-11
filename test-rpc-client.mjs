import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

import { NanoRpcClient } from './packages/rpc/src/client.js';

const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const blockHash = '19B45E2650EADBA5985DEDD68E2E8A6EF38BB27B027707AD687C6CD1A4B77BC6';

const rpcClient = new NanoRpcClient({ endpoints: [rpcUrl] });

const blockInfo = await rpcClient.getBlockInfo(blockHash);
console.log('Block info from RPC client:');
console.log('- hash:', blockInfo.hash);
console.log('- link:', blockInfo.link);
console.log('- link_as_account:', blockInfo.link_as_account);
console.log('- amount:', blockInfo.amount);
console.log('- confirmed:', blockInfo.confirmed);
