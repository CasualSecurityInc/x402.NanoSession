#!/usr/bin/env node
/**
 * Debug script to compare raw RPC responses vs RPC client responses
 * to identify why link_as_account is undefined
 */

import { NanoRpcClient } from './packages/rpc/dist/client.js';

// Test configuration
const RPC_ENDPOINT = 'https://nanoslo.0x.no/proxy';
const TEST_ACCOUNT = 'nano_13arha9xh79u6n4i8i5jpthhmoy638m9daw1jzkj9pycupdemorjremb9zye'; // Client account (acct0)

console.log('=== NanoSession RPC Debug ===\n');

async function callRawRpc(action, params) {
  const response = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

async function main() {
  // Step 1: Get a recent block hash
  console.log('Step 1: Getting recent block hash from test account...');
  const accountInfo = await callRawRpc('account_info', {
    account: TEST_ACCOUNT,
    representative: true
  });
  
  console.log('Account info response:', JSON.stringify(accountInfo, null, 2));
  
  const blockHash = accountInfo.frontier;
  
  if (!blockHash) {
    console.error('❌ Could not get frontier block. Account may not exist or have no blocks.');
    console.log('Using a known block hash from integration test instead...');
    // Use a known send block hash from the integration test logs
    // This is a placeholder - we'll need to find a real block
    console.log('\nPlease provide a block hash from a recent test run.');
    process.exit(1);
  }
  
  console.log(`✓ Using block hash: ${blockHash}\n`);
  
  // Step 2: Call raw RPC block_info
  console.log('Step 2: Calling raw RPC block_info...');
  const rawResponse = await callRawRpc('block_info', {
    json_block: true,
    hash: blockHash
  });
  
  console.log('Raw RPC Response:');
  console.log(JSON.stringify(rawResponse, null, 2));
  console.log('\nRaw Response Keys:', Object.keys(rawResponse));
  console.log('link_as_account in raw response (top level):', rawResponse.link_as_account);
  console.log('link_as_account in raw response (contents):', rawResponse.contents?.link_as_account);
  console.log('Raw response has contents object:', !!rawResponse.contents);
  console.log();
  
  // Step 3: Call RPC client getBlockInfo
  console.log('Step 3: Calling RPC client getBlockInfo...');
  const rpcClient = new NanoRpcClient({
    endpoints: [RPC_ENDPOINT]
  });
  
  const clientResponse = await rpcClient.getBlockInfo(blockHash);
  
  console.log('RPC Client Response:');
  console.log(JSON.stringify(clientResponse, null, 2));
  console.log('\nClient Response Keys:', Object.keys(clientResponse));
  console.log('link_as_account in client response:', clientResponse.link_as_account);
  console.log('link_as_account type:', typeof clientResponse.link_as_account);
  console.log();
  
  // Step 4: Compare
  console.log('Step 4: Comparison...');
  console.log('─'.repeat(60));
  console.log('Field Comparison:');
  
  const fields = [
    'hash', 'type', 'subtype', 'block_account', 
    'previous', 'representative', 'balance', 
    'link', 'link_as_account', 'signature', 
    'work', 'amount', 'confirmed', 'height'
  ];
  
  let hasDifferences = false;
  
  for (const field of fields) {
    const rawValue = rawResponse[field];
    const clientValue = clientResponse[field];
    const match = rawValue === clientValue;
    
    if (!match) {
      hasDifferences = true;
      console.log(`\n❌ ${field}:`);
      console.log(`   Raw:    ${JSON.stringify(rawValue)} (${typeof rawValue})`);
      console.log(`   Client: ${JSON.stringify(clientValue)} (${typeof clientValue})`);
    }
  }
  
  if (!hasDifferences) {
    console.log('\n✓ All fields match!');
  }
  
  console.log('\n─'.repeat(60));
  
  // Step 5: Root cause analysis
  console.log('\nRoot Cause Analysis:');
  console.log('═'.repeat(60));
  
  if (!rawResponse.contents) {
    console.log('⚠️  Raw RPC response has no "contents" field');
    console.log('    This is unexpected for json_block: true');
  } else {
    console.log('🔍 FOUND THE ISSUE:');
    console.log('    Raw RPC returns block data in a nested "contents" object!');
    console.log('');
    console.log('    Response structure:');
    console.log('    {');
    console.log('      block_account: "...",');
    console.log('      amount: "...",');
    console.log('      contents: {              ← Block data is HERE');
    console.log('        type: "state",');
    console.log('        link: "...",');
    console.log('        link_as_account: "...", ← This is where it lives!');
    console.log('        ...');
    console.log('      }');
    console.log('    }');
    console.log('');
    console.log('    But RpcClient.getBlockInfo() expects flat structure:');
    console.log('    {');
    console.log('      link: "...",');
    console.log('      link_as_account: "...", ← Expected here');
    console.log('      ...');
    console.log('    }');
    console.log('');
    console.log('🐛 BUG: RPC client needs to access response.contents fields!');
    console.log('   Current code: response.link_as_account');
    console.log('   Should be:    response.contents.link_as_account');
  }
  
  console.log('\n=== Debug Complete ===');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
