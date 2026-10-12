// Sends email through SMTP (Gmail app password or your domain email).
// If SMTP isn't configured yet, emails are saved as files in data/outbox so nothing is lost.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config');

let transport = null;
if (config.mail.host && config.mail.user) {
  transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });
}

async function sendMail({ to, subject, html, text, attachments = [], replyTo }) {
  const msg = { from: config.mail.from, to, subject, html, text, attachments, replyTo };
  if (!transport) {
    fs.mkdirSync(config.outboxDir, { recursive: true });
    const file = path.join(config.outboxDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...msg, attachments: attachments.map((a) => a.filename) }, null, 2));
    return { saved: file };
  }
  try {
    return await transport.sendMail(msg);
  } catch (e) {
    console.error('Email failed:', subject, '→', to, e.message);
    return { error: e.message };
  }
}

module.exports = { sendMail };
