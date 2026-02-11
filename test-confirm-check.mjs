// Test confirmed field checking
const testCases = [
  { confirmed: true, desc: 'boolean true' },
  { confirmed: 'true', desc: 'string true' },
  { confirmed: false, desc: 'boolean false' },
  { confirmed: 'false', desc: 'string false' },
];

for (const tc of testCases) {
  console.log(`${tc.desc}:`);
  console.log(`  value: ${tc.confirmed} (type: ${typeof tc.confirmed})`);
  console.log(`  !value: ${!tc.confirmed}`);
  console.log(`  truthy: ${!!tc.confirmed}`);
  console.log();
}
