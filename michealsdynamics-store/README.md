# Micheals Dynamics — online shop build kit (Shopify)

Everything needed to launch **michealsdynamics.co.za**: theme add-ons, product import file,
all page and legal texts, SEO titles, and a step-by-step setup guide.

---

## 1. Platform recommendation: **Shopify**

| | Shopify | WooCommerce (WordPress) |
|---|---|---|
| Hosting, security, backups, updates | Done for you | You (or a paid developer) |
| Admin for a non-coder | Very easy + phone app for orders | Workable, but plugins break after updates |
| PayFast / Yoco | Supported | Supported |
| Courier (Bob Go → Courier Guy, Pargo etc.) | App available | Plugin available |
| Monthly cost | Plan fee (USD) + some apps + a small transaction fee because Shopify Payments isn't available in SA | Cheaper software, but hosting + paid plugins + developer time |
| Speed out of the box | Good (Dawn theme) | Depends on hosting/plugins |

**Pick Shopify** (Basic plan is enough to start). You won't have to maintain servers or plugins,
and you can run everything from the Shopify phone app. WooCommerce only makes sense if you
have a developer on call. Check current prices at shopify.com/za/pricing.

---

## 2. Things you need to decide or fix first

1. **VAT.** Your brief says "prices incl. VAT" **and** "not VAT registered". These conflict.
   If you are not VAT registered you **must not** charge or show VAT. This kit is set up as
   **not VAT registered — no VAT charged**. When you register (compulsory once 12-month taxable sales pass
   the SARS threshold — check sars.gov.za), update the footer, terms and tax settings.
2. **Trading hours** and **cut-off time** for next-day delivery: fill in `[...]` placeholders.
3. **Director name(s)** and **Information Officer** (POPIA): fill in the placeholders in the terms and privacy policy.
4. **Prices, stock, weights, brands.** The import file has all prices at **R0.00**, stock 0,
   weight 0 and brand "Brand TBC", and every product is a **draft** — nothing goes live until you fill these in.
   Products listed are examples; delete or add as needed.
5. **Bulk discount tiers.** Placeholder is 10+ packs = 5% off, 50+ = 10% off. Set your own.
6. **Legal texts** follow POPIA, CPA and ECTA, but I'm not a lawyer. Have a South African
   attorney review them before launch (a one-off review is cheap compared to a dispute).

---

## 3. What's in this folder

```
theme/sections/md-hero-search.liquid        Home: headline + search + WhatsApp button
theme/sections/md-compliance-bar.liquid     Footer: reg no, SAHPRA no, VAT line, Google link + floating WhatsApp
theme/sections/md-map.liquid                Contact: Google map + details
theme/sections/md-request-form.liquid       Request a Quote / Business account application form
theme/sections/md-delivery-estimator.liquid Cart: delivery cost check by postal code
theme/snippets/md-product-info.liquid       Product: sterile badge, price per item, stock status,
                                            bulk price table, specs, data-sheet download, returns notice
theme/templates/page.*.json                 Ready page layouts (quote, business account, contact with map)
products/products-import.csv                17 example products / 40 variants (draft)
products/metafields.md                      Product fields to create before import + filter setup
content/pages/*.html                        About, Contact, FAQ, Delivery & Returns
content/policies/*.html, cookie-banner.txt  Privacy (POPIA), Terms (CPA/ECTA), Returns, Shipping, Cookie banner
seo/seo-plan.md                             Titles, descriptions, sitemap, Google setup
```

---

## 4. Step-by-step build

Legend: **[YOU]** = needs your login, ID or money. **[KIT]** = copy/paste from this folder.

### Step 1 — Create the store [YOU]
1. Sign up at shopify.com with **michealsdynamicresults@gmail.com**. Store name: *Micheals Dynamics*.
2. Settings > **Store details**: legal name, address, phone, currency **ZAR (R)**, timezone Johannesburg.
3. Settings > **Taxes and duties** > South Africa: **do not collect tax** (not VAT registered).

### Step 2 — Theme [KIT]
1. Online Store > Themes: use the free **Dawn** theme (fast, mobile-first).
2. Customize > Theme settings > **Colors**: background `#FFFFFF`, text `#10202A`,
   buttons/accent `#0B6E78` (teal — passes contrast checks on white). Typography: a plain sans-serif (e.g. Assistant/Inter).
3. Upload the logo (Theme settings > Logo).
4. Add the code files — Themes > **⋯ > Edit code**:
   - *Sections* folder > **Add a new section** > name it exactly like the file (e.g. `md-hero-search`) > delete the sample code > paste the file's contents > Save. Repeat for all 5 section files.
   - *Snippets* folder > **Add a new snippet** > `md-product-info` > paste > Save.
   - *Templates* folder > **Add a new template** > type *page*, JSON, names `quote`, `business-account`, `contact-map` > paste each file > Save.

### Step 3 — Products [KIT + YOU]
1. Create the product fields in `products/metafields.md` **first**.
2. Products > **Import** > `products/products-import.csv`.
3. For each product: set **price**, **stock**, **weight** (needed for courier quotes), **brand** (Vendor),
   upload **real photos** and the **data sheet** PDF, then set Status to **Active**.
4. Collections > create automated collections with condition *Product type is equal to*:
   Gloves, Wound Care, Syringes & Needles, Swabs, IV Giving Sets, PPE.
5. Install **Search & Discovery** (free) and add filters as listed in `metafields.md`.
6. Customize > Products > Default product > **Add block > Custom liquid** (below Price), paste:
   `{% render 'md-product-info', product: product %}`

### Step 4 — Pages [KIT]
Online Store > **Pages** > Add page. Click the `<>` (Show HTML) button in the editor and paste the file.

| Page title | File | Template (right side) |
|---|---|---|
| About | `content/pages/about.html` | default |
| Contact | `content/pages/contact.html` | `contact-map` |
| FAQ | `content/pages/faq.html` | default |
| Delivery & Returns | `content/pages/delivery-returns.html` | default (handle must be `delivery-returns`) |
| Request a quote | (short intro or empty) | `quote` |
| Business account | (short intro or empty) | `business-account` |

Settings > **Policies**: paste Privacy, Terms of service, Refund (returns) and Shipping policy files.
Settings > **Customer privacy** > turn on the cookie banner for South Africa and paste `cookie-banner.txt`.

### Step 5 — Home page layout [KIT]
Customize > Home page, in this order:
1. **MD Hero with search** (headline, search, WhatsApp order)
2. **Collection list** → the 6 categories (category tiles)
3. **Featured collection** → "Bestsellers" (make a manual collection)
4. **Multicolumn** "Why buy from us": SAHPRA licensed · Next-day Cape Town delivery · Free delivery over R2,000 · Bulk & institutional pricing
5. Footer > add **MD Compliance bar**; paste your Google Business Profile link there.
Cart page > add **MD Delivery estimator** and set the same prices you use in Step 6.

Menus (Online Store > Navigation): Main menu = Shop · Gloves · Wound care · Syringes & needles · PPE · Request a quote · Contact.
Footer menu = About · FAQ · Delivery & Returns · Business account · Privacy · Terms · Returns.

### Step 6 — Delivery [YOU]
1. Settings > **Shipping and delivery**:
   - **Local delivery** (from your Khayelitsha location): add the Cape Town postal codes you deliver to next day, set price, and a free rate for orders ≥ R2,000.
   - **Shipping** zone *South Africa*: a courier rate (flat or by weight), plus a **R0 rate with condition "order price ≥ R2,000"**.
2. Sign up at **Bob Go** (bobgo.co.za) and install its Shopify app. It books The Courier Guy, Pargo and others
   from one dashboard, prints waybills, and sends the tracking number back to Shopify, which emails the customer.
3. Optional: live courier rates at checkout need Shopify's *carrier-calculated shipping*, which isn't on every plan
   (Advanced plan, or an add-on). The flat/local rates above work on Basic.

### Step 7 — Payments [YOU]
1. Open a **PayFast** (payfast.io) or **Yoco** (yoco.com) merchant account. You'll need: company reg. documents,
   ID of director, proof of address, business bank account. Approval usually takes a few days.
2. Settings > **Payments** > *Add payment method* > connect PayFast or Yoco (cards + instant EFT).
3. Settings > Payments > **Manual payment methods** > *Bank deposit*: add your bank details, and the instruction
   "Use your order number as reference. Orders ship once payment reflects."
   To show EFT **only to business accounts**, install a payment-rules app (e.g. *HidePay*) and hide it unless the customer has tag `business`.
   (Simpler option: allow EFT for everyone.)
4. Discounts > **Create discount > Amount off products > Automatic**: one per bulk tier
   (e.g. min. quantity 10 → 5%, min. quantity 50 → 10%). Shopify applies the best one.

### Step 8 — Business accounts, invoices, re-order [YOU + KIT]
1. Settings > **Customer accounts**: turn on (new customer accounts). Customers see order history and can re-order (*Buy again*).
2. Practices apply via the **Business account** page. When you approve one: Customers > open the customer > add tag **`business`**.
3. Invoices: install an invoice app (e.g. **Sufio** or **Order Printer**) — set it to say *"Not VAT registered"*,
   attach the PDF to order emails, and enable the "download invoice" link in customer accounts.
4. Quote form file uploads: Shopify's built-in form can't accept files, so the page tells customers to email or WhatsApp their list.
   If you want an upload button, install a form app with file upload (e.g. *Globo Form Builder*) and use it on that page instead.

### Step 9 — Emails & stock alerts [YOU]
1. Settings > **Notifications** > Order confirmation: add "Micheals Dynamics (Pty) Ltd · Reg 2024/551935/07 · SAHPRA 00005896MD · Not VAT registered".
2. Install **Shopify Flow** (free) > template *"Get notified when product inventory is low"* → set threshold (e.g. 20) → your email.
3. Install the **Shopify** phone app to get order alerts and process orders anywhere.

### Step 10 — Domain [YOU]
1. If you don't own **michealsdynamics.co.za** yet, register it with a .co.za registrar (e.g. Domains.co.za, Afrihost, Xneelo).
2. Shopify: Settings > **Domains > Connect existing domain** > enter it.
3. At your registrar's **DNS settings** change:
   - `A` record, host `@` → **23.227.38.65**
   - `CNAME` record, host `www` → **shops.myshopify.com**
   - Remove any other `A`/`AAAA` records for `@`. Leave MX (email) records alone.
4. Back in Shopify click **Verify connection**, then set it as the primary domain. SSL (padlock) is automatic. DNS can take up to 48 hours.

### Step 11 — Google [YOU]
Follow `seo/seo-plan.md`: enter page titles, set up **Google Search Console** (submit `sitemap.xml`) and **Google Business Profile**.

### Step 12 — Test before launch
1. Settings > Payments: place a test order (PayFast/Yoco sandbox or a real R5 product you refund).
2. Check on your **phone**: search, filters, product page (per-item price, stock, bulk table), cart delivery check, checkout.
3. Confirm the order email arrives, the invoice is attached, and Bob Go receives the order.
4. Remove the store password: Online Store > Preferences > **Password protection off**.

---

## 5. Your checklist (things only you can do)

- [ ] Shopify account + plan
- [ ] PayFast or Yoco merchant account (company docs, ID, bank account)
- [ ] Bob Go account (+ courier accounts it links to)
- [ ] Domain registered + DNS records changed
- [ ] Real product photos, prices, stock, weights, brands, data-sheet PDFs
- [ ] Trading hours, cut-off time, director and Information Officer names
- [ ] Attorney review of legal texts
- [ ] Google Business Profile + Search Console
- [ ] Optional: a domain email (e.g. orders@michealsdynamics.co.za) — looks more trustworthy than Gmail

## Rules to keep
- **No medical claims or advice** on product pages (no "prevents infection", "treats wounds"). Describe what the product *is*.
- **Sterile and opened items are non-returnable** — already stated on every product page, the returns policy, FAQ and terms (faulty goods stay returnable by law).
