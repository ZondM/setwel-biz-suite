// One-time: tells Yoco where to send "payment succeeded" notifications.
// Run on the server after setting YOCO_SECRET_KEY and BASE_URL in .env:  npm run yoco:webhook
// Copy the printed secret into .env as YOCO_WEBHOOK_SECRET, then restart the site.
const config = require('../src/config');

(async () => {
  if (!config.yoco.secretKey) return console.error('Set YOCO_SECRET_KEY in .env first.');
  if (!config.baseUrl.startsWith('https://')) return console.error('BASE_URL must be your live https:// address.');
  const r = await fetch('https://payments.yoco.com/api/webhooks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.yoco.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'micheals-dynamics-shop', url: `${config.baseUrl}/payments/yoco/webhook` }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return console.error('Yoco said:', r.status, data);
  console.log('Webhook registered. Add this line to your .env file and restart:\n');
  console.log(`YOCO_WEBHOOK_SECRET=${data.secret}`);
})();
