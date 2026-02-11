import * as dotenv from 'dotenv';
dotenv.config({ path: './e2e.env' });

const rpcUrl = process.env.NANO_RPC_URL || 'https://rpc.nano.to';
const frontier = 'E275BCB3FF6BAC01CCC195DD0A07ACB4AEEDC0F8C5134AA76C981CBB20613EF2';

// Try with higher difficulty
console.log('Trying with high difficulty...');
const workRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'work_generate', 
    hash: frontier,
    difficulty: 'fffffff800000000'
  })
});

const workData = await workRes.json();
console.log('Work:', workData.work);
console.log('Multiplier:', workData.multiplier);
console.log('Valid work:', workData.work && !workData.error);

// The work needs to meet the account's default difficulty
// For state blocks, the difficulty is based on the account's current work threshold
console.log('\nChecking work validity...');
const validateRes = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'work_validate',
    work: workData.work,
    hash: frontier
  })
});

const validateData = await validateRes.json();
console.log('Work validate:', JSON.stringify(validateData, null, 2));
