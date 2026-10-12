# Micheals Dynamics — online shop (michealsdynamics.co.za)

A complete, self-hosted online shop. **No Shopify, no monthly platform fee.** You own the code and the data.

Built with Node.js and a built-in SQLite database (one file). Pages are made on the server, so they load fast and Google can read them.

---

## What the website does

**For customers**
- **Home:** headline, product search, category tiles, bestsellers, "why buy from us", WhatsApp order button.
- **Shop:** categories, filters (size, material, sterile/non-sterile, pack size, brand, in stock), sorting.
- **Product page:** photos, specs, pack size, price per pack + price per item, stock status, quantity selector, bulk price table, data-sheet download, "non-returnable" notice.
- **Cart:** delivery cost by postal code, bulk discount applied automatically, free delivery over R2,000.
- **Checkout:** guest checkout. Pay by PayFast (card + instant EFT) or Yoco (card). Approved business accounts can also pay by bank EFT.
- **Emails:** order confirmation with a PDF invoice, and a tracking email when you dispatch. Invoices say "Not VAT registered", with no VAT added.
- **Request a Quote:** form with file upload (Excel, PDF, Word, CSV or photo, max 10 MB).
- **Business accounts:** apply, you approve, then they get order history, a re-order button, invoice downloads and EFT payment.
- **Info and legal pages:** About, Contact (with map), FAQ, Delivery & Returns, Privacy Policy (POPIA), Terms (CPA/ECTA), Returns Policy, Cookie notice.
- **Footer:** reg. no. 2024/551935/07, SAHPRA licence 00005896MD, "Not VAT registered".
- **SEO:** page titles and descriptions, `sitemap.xml`, `robots.txt`, Google product data, Google Business Profile link.

**For you (Admin at `/admin`)**
- **Dashboard:** launch checklist, orders to dispatch, orders waiting for EFT, low stock, new quotes and messages.
- **Prices & stock:** one page to type all prices and stock levels, then Save.
- **Products:** add or edit products, sizes, photos and data sheets; hide or show; mark as bestseller.
- **Orders:** mark EFT orders as paid, enter courier and tracking number (the customer gets an email), cancel (stock goes back), download invoices.
- **Business accounts:** approve or reject. **Quotes and messages:** read them and download attached files.
- **Settings:** business details, delivery prices and areas, bank details, low-stock level, courier tracking links.
- **Database backup:** a download button.
- **Low-stock email:** sent to you automatically when an item drops to your low-stock level.

---

## Current state — please read

- **No prices and no photos yet.** You haven't sent them, so every product shows **"Price on request"** and a "Photo coming soon" picture. Customers can't buy an item until it has a price and stock. Add them in **Admin → Prices & stock** and **Admin → Products**.
- The 16 starter products are **examples** in your categories. Edit, hide or delete any of them.
- **Not VAT registered:** no VAT is charged or shown anywhere.
- **Delivery prices are empty.** Set them in **Admin → Settings → Delivery**. Until you do, only "collect" is offered at checkout.
- **Courier:** you book the courier yourself (Bob Go, The Courier Guy or Pargo), then type the tracking number into the order. The website emails the customer. Automatic courier booking through their API is **not** built yet; it can be added once you have a courier account and API key.
- **Legal texts** follow POPIA, CPA and ECTA, but have a South African attorney check them before launch.

---

## What YOU need to do (step by step)

### 1. Hosting (where the website runs)
You need a small server that can run Node.js 22 (about R100–R200 per month). Options:
- A South African VPS, e.g. Afrihost, Xneelo or Hetzner (1 CPU, 1–2 GB RAM is enough).
- Or a platform like Render or Railway **with a persistent disk**. Without one, orders and photos are lost when the site restarts.

The first server setup takes a technical person about 1–2 hours. Give them this section:

```bash
# On Ubuntu 24.04 VPS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs caddy git
git clone <this repository> && cd setwel-biz-suite/michealsdynamics-site
npm ci --omit=dev
cp .env.example .env && nano .env        # fill in (see step 4)
npm test                                  # should say: pass 15, fail 0
# Keep it running (systemd service):
sudo tee /etc/systemd/system/md-shop.service >/dev/null <<EOF
[Service]
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/npm start
Restart=always
User=$USER
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now md-shop
# HTTPS (free certificate, automatic):
echo 'michealsdynamics.co.za, www.michealsdynamics.co.za {
  reverse_proxy localhost:3000
}' | sudo tee /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

### 2. Domain DNS
Log in where you registered **michealsdynamics.co.za** and change the DNS:
- `A` record, host `@` → your server's IP address
- `A` record, host `www` → the same IP

Leave any MX (email) records alone. Changes can take up to 24 hours. HTTPS (the padlock) switches on by itself once DNS points to the server.

### 3. Payment account
- **PayFast** (recommended; cards + instant EFT): sign up at payfast.io as a business. You'll need company registration documents, director ID, proof of address and a business bank account.
  Then go to Settings → Developer settings, copy the **Merchant ID** and **Merchant Key**, and **set a passphrase**. Put all three in `.env`.
- **Yoco** (optional, cards): get the secret key from the Yoco portal, put it in `.env`, then run `npm run yoco:webhook` once on the server and paste the printed line into `.env`.
- Restart the site after changing `.env`: `sudo systemctl restart md-shop`.
- Test with PayFast's sandbox first (`PAYFAST_SANDBOX=true`), then switch to live.

### 4. Email (order confirmations and invoices)
In your Gmail account, turn on 2-Step Verification, then create an **App password** (Google Account → Security → App passwords). Put it in `.env` as `SMTP_PASS`.
Until this is done, emails are not sent; they're saved in `data/outbox` on the server.
A domain email (e.g. orders@michealsdynamics.co.za) looks more trustworthy. Optional.

### 5. Courier account
Open an account with **Bob Go** (bobgo.co.za; books The Courier Guy, Pargo and others) or a courier directly.
In **Admin → Settings → Courier tracking links**, add one line per courier in the form `Courier name|tracking link with {tracking}`. Copy the link format from your courier's website.

### 6. In Admin (`https://michealsdynamics.co.za/admin`)
1. Log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`, then change the password in Settings.
2. **Settings:** trading hours, director name(s), POPIA Information Officer, delivery prices and Cape Town postal-code ranges, bank details, Google Business Profile link.
3. **Prices & stock:** enter prices (per pack, in Rand) and stock.
4. **Products:** upload real photos (square, about 1200×1200 px, under 500 KB) and data-sheet PDFs.
5. The dashboard checklist turns all ✓ when you're ready to launch.

### 7. Google
- Create your **Google Business Profile** (category "Medical supply store") with the same name, address and phone as the website.
- Add the site to **Google Search Console** and submit `https://michealsdynamics.co.za/sitemap.xml`.

### 8. Backups (important)
Each week, click **Admin → Settings → Download database backup** and keep the file safe.
Also copy the `data/uploads` folder (photos) from the server now and then.

---

## Daily use
- **New paid order:** you get an email → open it in Admin → pack → enter the courier and tracking number → "Mark as shipped" (the customer is emailed).
- **EFT order:** check that the money is in your bank → open the order → "Mark as paid" (stock is deducted, the customer gets the invoice) → dispatch.
- **Low stock:** you get an email → update stock in **Prices & stock**.
- **Quote request:** you get an email with the attached file → reply to the customer → set its status in Admin → Quotes.

## For a developer
- `npm start` runs the site, `npm test` runs the end-to-end tests (15 tests: pricing, bulk tiers, delivery, PayFast signature/ITN, Yoco webhook, EFT, accounts, invoices, quotes, CSRF, filters, SEO).
- Code is in `src/`: `routes/` for pages, `views/` for HTML, `shop.js` for pricing/cart/delivery, `orders.js` for paid/shipped/emails, `invoice.js` for the PDF, `content/pages.js` for legal texts.
- Data: `data/shop.db` (SQLite) and `data/uploads/`. Quote files are in `data/quote-files/` (not public).
- Security: hashed passwords, CSRF tokens on every form, rate-limited logins, strict Content-Security-Policy, and orders are marked paid only by a verified PayFast/Yoco server notification.
