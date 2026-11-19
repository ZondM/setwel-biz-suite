# Monthly update guide — prices, products and specials

No coding needed. Everything is done at **https://setwelafrica.com/admin**.

## How prices work

- You enter the **supplier cost excl. VAT** (the price on the supplier's price sheet).
- The website adds the markup from **Admin → Pricing rules** and rounds **up** to the next rand:

| Products | Markup |
|---|---|
| HP, Brother and Canon ink & toner | **15%**, e.g. R1 557.38 → R1 791 |
| Canon printers | **55%** |
| Everything else (incl. Kyocera, Ricoh and Pantum cartridges) | **45%** (the default) |

- Change a markup or add a rule (any brand and/or category) on the Pricing rules page. Then click **Recalculate all prices** to update the products already in the shop.
- Setwel Africa is not VAT registered, so the website adds no VAT.
- Customers never see your cost price or your supplier's name.

---

## A. Update prices from the supplier's price sheet (most months)

1. Fill in the supplier's blank price sheet in Excel as usual. Save it as **.xlsx** (Excel Workbook).
2. Admin → **Import / update prices** → choose the file.
   - Did you save a column matching last month? Pick it under **Use saved column matching**.
3. Click **Upload & continue**.
4. **Match columns:** check that the supplier's code column says *SKU*, their price column says *Supplier cost (excl. VAT)*, and so on.
   - The first time, type a name such as `Supplier price sheet` in **Save this matching** so next month is automatic.
   - Choose **Only update prices & stock** if you only want to change prices of products already in your shop.
   - Leave **Keep the product names already in my store** ticked.
5. Click **Preview changes**. Nothing is saved yet. You see:
   - **New** — products that will be added
   - **Update** — old price → new price, shown in red and green
   - **Error** — rows that will be skipped, with the reason (e.g. "price abc is not a number")
6. If it looks right, click **Import**. Done.

Tips:
- Empty cells never delete anything.
- To end a sale through Excel, type `CLEAR` in the Sale price column.
- A stock quantity works too: 0 = out of stock, 1–5 = low stock, more = in stock.

## B. Change many products in Excel (your own sheet)

1. Admin → **Products** → **Export Excel**. You get every product with all its details.
2. Change what you want in Excel: prices, stock, descriptions, Visible yes/no.
3. Save, then import it (section A). The columns match automatically.

## C. Add, change or remove one product

- **Add:** Products → **+ Add product**. Fill in the name, SKU, brand, category and supplier cost (the selling price is calculated from your pricing rules), add photos, then **Save**.
- **New in Market / Specials:** tick "New in Market" or "Show on the Specials page" on the product, or tick many products in the list and use **With ticked products → Mark as New in Market / Mark as Special**.
- **Change:** click the product name, edit, **Save**.
- **Hide** (e.g. discontinued): untick **Visible on website**. Hiding is safer than deleting.
- **Delete:** open the product → **Delete product** at the bottom.

## D. Many products at once

Products list → tick the products (the top box ticks all) → **With ticked products** → choose an action → **Apply**. Actions:

- Show on website / Hide from website
- Mark as popular (shows on the home page)
- End sale price
- Mark as New in Market / Mark as Special (and remove again)
- Recalculate selling price from cost (uses your pricing rules)
- Set stock status
- Delete

## E. Product photos

- **One product:** edit the product → **Add photos**.
- **Many products:** name each photo with its SKU, e.g. `CMF3010.jpg` (extra photos: `CMF3010-2.jpg`). Then Admin → **Bulk images** → choose all the files → **Upload**.
- Use photos from the distributor's white-label flyers or the manufacturer's reseller material. Your distributors have confirmed you may advertise their products.

## F. Monthly specials

1. Give products a **Sale price** and a **Sale ends** date, either by editing each product or with the *Sale price* and *Sale ends* columns in your import file.
2. Admin → **Banners & specials** → edit the banner:
   - Headline: `Monthly specials`
   - Button link: `/specials`
   - **Show until:** the last day of the month
3. Check **https://setwelafrica.com/specials**. It is your Setwel-branded catalogue. Click **Print / save as PDF catalogue** to get a PDF you can WhatsApp or email to customers.
4. On the end date, sale prices and banners switch off by themselves.

## F2. Weekly specials (HP, Riso, Brother cartridges)

The page **https://setwelafrica.com/weekly-specials** has a sliding showcase, a countdown to the end of the week, a moving price strip (also on the home page) and HP / Riso / Brother buttons.

**Load the week's specials (Excel, quickest):**
1. Open **Weekly-Specials-Template.xlsx** (in the `dist` folder). Fill in the first sheet, one cartridge per row. The *Example* sheet shows how.
   - Product already on the website: **SKU**, **Sale price**, **Sale ends** (e.g. Sunday), **Weekly special** = `yes`.
   - New product (e.g. Riso): also **Name**, **Brand**, **Category** (`Ink & Toner`), **Selling price** (normal price) and descriptions.
2. Admin → **Import** → choose the file → **Add new & update existing products** → Preview → **Apply**.

**Or one by one:** Admin → Products → open the product → set **Sale price** and **Sale ends** → tick **Weekly special** → Save.

**Stock quantities:** put a number in the **Stock** column of the file (e.g. `23`), or in **Quantity in stock** on the product page. The website then shows "23 in stock" or "Only 2 left", stops customers ordering more than you have, and lowers the number by itself when an order is placed. At 0 the product shows "Out of stock". Cancelled orders do not put stock back; correct the number on the product page.

After the *Sale ends* date the product leaves the page by itself. Leave *Sale ends* empty for **while stocks last**: the page then shows "While stocks last" instead of a countdown, and you remove the product yourself when it is sold out. Next week, load the new list. To clear old ones early: Admin → Products → show **Weekly specials** → tick all → **Remove from Weekly specials**.

## G. Orders

1. You get an email for every new order. Admin → **Orders** → open the order.
2. **EFT orders:** when the money is **in your bank account**, click **Mark as paid**. The customer gets a receipt automatically. A proof of payment alone is not proof — check your bank.
3. **PayFast orders** turn **Paid** by themselves.
4. When you send the parcel: change the status to **Shipped with courier**, type the courier and tracking number, and keep **Email the customer** ticked.
5. For collections: set **Ready for collection**. Later, set **Completed**.
6. Invoice / receipt PDF: the button at the top of the order.

## H. Quote requests and leads

Every enquiry now lands in **Admin → Leads**: instant quotes, quote requests, contact messages, call-back requests and AI assistant conversations. The Leads page shows this month's numbers (leads, not contacted, time to first reply, quotes given, won, paid orders, WhatsApp clicks, chats). Red/orange rows have waited more than 2 hours.

**Answer a lead:** open it → **Reply on WhatsApp** (opens WhatsApp with a ready message and marks it "Contacted"), or Call / Email. Set the status to **Won** or **Lost** when you know.

**Fix a price on a quote:** open the lead → change the price or quantity under *Quote items* → **Update & send to customer**. The customer gets the new quote by email with an "Accept & pay" link; for WhatsApp customers, send them the *Customer's quote page* link.

### One-time setup (15 minutes)

1. **WhatsApp alerts to your phone (free):** save the number **+34 644 66 32 62** in your phone as "CallMeBot", send it the WhatsApp message `I allow callmebot to send me messages`, and copy the key it sends back into **Admin → Settings → Leads, alerts & follow-ups → WhatsApp alert key**. Click **Save**, then **Send test WhatsApp** (further down the Settings page) — you should get a message within a minute. Every new lead then arrives on your WhatsApp within seconds. (CallMeBot is a free outside service — if it ever stops, you still get the email alert. If the number above does not answer, check the current number on callmebot.com.)
2. **Follow-ups and reminders:** cPanel → **Cron Jobs** → Common settings **Once Per Hour** → paste the command shown under *Cron key* in Settings (it starts with `wget -q -O /dev/null "https://setwelafrica.com/cron/...`) → **Add New Cron Job**. Every hour the store then:
   - emails customers who got an instant quote but did not pay (after 1 day and 3 days), and
   - reminds you on WhatsApp/email about any lead nobody has contacted after 2 hours.
3. **Instant reply text:** Settings → *Instant reply text* — shown on screen and emailed after every enquiry.
4. **AI assistant (optional, paid per use):** create an API key at **console.anthropic.com** (add a payment card and a monthly spend limit there), paste it into **Settings → AI assistant → Anthropic API key**, check that **AI model** says *Claude Haiku 5.5*, tick **Show the AI assistant**, and Save. When it makes a quote, the assistant always asks the customer to double-check with a person on WhatsApp before paying. An "Ask us — instant answers" button appears on every page. Add facts under *Extra facts* (e.g. same-day delivery areas, school payment terms). Read a few conversations under Leads in the first week.

## I. Monthly 10-minute checklist

- [ ] Import the new supplier price sheet (A)
- [ ] Set this month's specials and banner (F)
- [ ] Dashboard: fix "products without a photo" and "without a price"
- [ ] Download a backup in cPanel (see the install guide, Step 11)
- [ ] Newsletter: Admin → Newsletter → download the list and send your specials using Mailchimp or Brevo (both have free plans)

## Getting help from Claude Code

Open this project in Claude Code and describe what you want in plain words, for example:

- "Add a new category called Riso Ink and Masters"
- "My supplier sent a new price list, here it is — set up the import"
- "Change the home page headline to …"

Claude Code changes the files. Then you upload the changed files to cPanel File Manager. Or ask Claude Code for a fresh zip, and say **"don't overwrite my app/config.php, storage or uploads"**.
