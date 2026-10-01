# Monthly update guide — prices, products and specials

No coding needed. Everything is done at **https://setwelafrica.com/admin**.

## How prices work

- You enter the **supplier cost excl. VAT** (the price on the distributor sheet or flyer).
- The store adds your markup (**55%**, change it in Settings → Pricing) and rounds **up** to the nearest rand.
  Example: R299.00 × 1.55 = R463.45 → **R464**.
- Setwel Africa is not VAT registered, so the store adds no VAT. Your 55% already covers the VAT you pay the supplier.
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

- **Add:** Products → **+ Add product**. Fill in the name, SKU, brand, category and supplier cost (the selling price is calculated for you), add photos, then **Save**.
- **Change:** click the product name, edit, **Save**.
- **Hide** (e.g. discontinued): untick **Visible on website**. Hiding is safer than deleting.
- **Delete:** open the product → **Delete product** at the bottom.

## D. Many products at once

Products list → tick the products (the top box ticks all) → **With ticked products** → choose an action → **Apply**. Actions:

- Show on website / Hide from website
- Mark as popular (shows on the home page)
- End sale price
- Recalculate selling price from cost (use after changing the markup %)
- Set stock status
- Delete

## E. Product photos

- **One product:** edit the product → **Add photos**.
- **Many products:** name each photo with its SKU, e.g. `CMF3010.jpg` (extra photos: `CMF3010-2.jpg`). Then Admin → **Bulk images** → choose all the files → **Upload**.
- Use photos from the distributor's white-label flyers or the manufacturer's reseller material. Your distributors have confirmed you may advertise their products.

## F. Monthly specials (e.g. "October specials")

1. Give products a **Sale price** and a **Sale ends** date, either by editing each product or with the *Sale price* and *Sale ends* columns in your import file.
2. Admin → **Banners & specials** → edit the banner:
   - Headline: `October specials`
   - Button link: `/specials`
   - **Show until:** the last day of the month
3. Check **https://setwelafrica.com/specials**. It is your Setwel-branded catalogue. Click **Print / save as PDF catalogue** to get a PDF you can WhatsApp or email to customers.
4. On the end date, sale prices and banners switch off by themselves.

## G. Orders

1. You get an email for every new order. Admin → **Orders** → open the order.
2. **EFT orders:** when the money is **in your bank account**, click **Mark as paid**. The customer gets a receipt automatically. A proof of payment alone is not proof — check your bank.
3. **PayFast orders** turn **Paid** by themselves.
4. When you send the parcel: change the status to **Shipped with courier**, type the courier and tracking number, and keep **Email the customer** ticked.
5. For collections: set **Ready for collection**. Later, set **Completed**.
6. Invoice / receipt PDF: the button at the top of the order.

## H. Quote requests

Admin → **Quote requests** → open one → **Reply by email**. Set the status (Quote sent / Won / Lost) so you can track them.

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
