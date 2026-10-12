// All settings that come from the server environment (.env file). See .env.example.
const fs = require('fs');
const path = require('path');

// Minimal .env loader so the owner doesn't need extra tools.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const dataDir = path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data'));

module.exports = {
  port: Number(env.PORT || 3000),
  baseUrl: (env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  production: env.NODE_ENV === 'production',
  dataDir,
  dbFile: path.join(dataDir, 'shop.db'),
  uploadDir: path.join(dataDir, 'uploads'),
  outboxDir: path.join(dataDir, 'outbox'),

  admin: { email: env.ADMIN_EMAIL || '', password: env.ADMIN_PASSWORD || '' },

  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Micheals Dynamics <michealsdynamicresults@gmail.com>',
    adminTo: env.ADMIN_NOTIFY_EMAIL || 'michealsdynamicresults@gmail.com',
  },

  payfast: {
    merchantId: env.PAYFAST_MERCHANT_ID || '',
    merchantKey: env.PAYFAST_MERCHANT_KEY || '',
    passphrase: env.PAYFAST_PASSPHRASE || '',
    sandbox: env.PAYFAST_SANDBOX === 'true',
  },

  yoco: {
    secretKey: env.YOCO_SECRET_KEY || '',
    webhookSecret: env.YOCO_WEBHOOK_SECRET || '',
  },
};
