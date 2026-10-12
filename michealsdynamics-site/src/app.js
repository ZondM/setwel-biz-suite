const path = require('path');
const express = require('express');
const compression = require('compression');
const config = require('./config');
const { sessionMiddleware, csrfProtect, html } = require('./util');
const { layout } = require('./views/layout');
const { seedIfEmpty } = require('./seed');

seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Caddy/Nginx/Render: real client IP + HTTPS

// Security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src https://www.google.com https://maps.google.com; " +
      "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za https://payments.yoco.com https://c.yoco.com; base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
  });
  if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});
app.use(compression());

// Payment webhooks need their raw bodies, so they're mounted before the form parsers.
app.use('/payments', require('./routes/payments').router);

app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css'), { maxAge: '7d' }));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js'), { maxAge: '7d' }));
app.use('/img', express.static(path.join(__dirname, '..', 'public', 'img'), { maxAge: '30d' }));
app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', index: false }));

app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 5000 }));
app.use(sessionMiddleware);
app.use(csrfProtect);

app.use('/admin', require('./routes/admin'));
app.use(require('./routes/account'));
app.use(require('./routes/cart').router);
app.use(require('./routes/shop'));

app.use((req, res) => {
  res.status(404).send(layout(req, { title: 'Page not found', noindex: true, body: String(html`<div class="wrap section narrow"><h1>Page not found</h1>
    <p>Sorry, we couldn't find that page.</p><p><a class="btn" href="/shop">Browse products</a> <a class="btn btn--ghost" href="/">Home</a></p></div>`) }));
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again, or contact us on WhatsApp.');
});

module.exports = app;
