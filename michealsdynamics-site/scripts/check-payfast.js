// Checks the PayFast details before you go live. Prints no secret values.
// Usage (in the app folder):  npm run check:payfast
// The same check is shown on Admin > Dashboard.
const { checkPayfast } = require('../src/payfast-check');

const r = checkPayfast();
console.log(`PayFast mode: ${r.mode}`);
console.log(`Payment confirmations will be sent to: ${r.notifyUrl}`);
r.notes.forEach((n) => console.log(`Note: ${n}`));
if (r.problems.length) {
  r.problems.forEach((p) => console.log(`PROBLEM: ${p}`));
  console.log('\nFix the problems above, then run this again.');
  process.exit(1);
}
console.log('\nLooks good. Restart the site, then place a small test order to confirm.');
