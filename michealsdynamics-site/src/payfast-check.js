// Checks the PayFast settings (from cPanel's Node.js app variables or .env). Never returns secret values.
const config = require('./config');
const { payfastSignature } = require('./routes/payments');

function checkPayfast() {
  const pf = config.payfast;
  const problems = [];
  const notes = [];

  if (!pf.merchantId) problems.push('PAYFAST_MERCHANT_ID is empty.');
  else if (!/^\d{8,}$/.test(pf.merchantId)) problems.push('PAYFAST_MERCHANT_ID should be digits only (e.g. 10012345). Check for spaces or typos.');

  if (!pf.merchantKey) problems.push('PAYFAST_MERCHANT_KEY is empty.');
  else if (!/^[a-z0-9]{13}$/i.test(pf.merchantKey)) problems.push('PAYFAST_MERCHANT_KEY is usually 13 letters/numbers. Check for spaces or a missing character.');

  if (!pf.passphrase) notes.push('No PAYFAST_PASSPHRASE set. That only works if NO passphrase is set in PayFast (Settings > Developer Settings). Setting one is safer.');
  else if (/^\s|\s$/.test(process.env.PAYFAST_PASSPHRASE || '')) problems.push('PAYFAST_PASSPHRASE starts or ends with a space. Remove it.');

  if (!config.baseUrl.startsWith('https://')) problems.push(`BASE_URL is "${config.baseUrl}". It must be your live https:// address, or PayFast cannot confirm payments to the site.`);
  if (!config.production) notes.push('NODE_ENV is not "production". Set NODE_ENV=production on the live server.');
  if (pf.sandbox && pf.merchantId && pf.merchantId !== '10000100') {
    notes.push('Test (sandbox) mode is on but the merchant ID is not the PayFast sandbox ID. Your real account details only work with PAYFAST_SANDBOX=false.');
  }

  let signed = false;
  try {
    signed = /^[a-f0-9]{32}$/.test(payfastSignature({ merchant_id: pf.merchantId, merchant_key: pf.merchantKey, amount: '10.00', item_name: 'Test' }, pf.passphrase));
  } catch { signed = false; }
  if (!signed) problems.push('Could not build a signed PayFast request.');

  return {
    mode: pf.sandbox ? 'TEST (sandbox — no real money)' : 'LIVE (real money)',
    notifyUrl: `${config.baseUrl}/payments/payfast/notify`,
    problems,
    notes,
  };
}

module.exports = { checkPayfast };
