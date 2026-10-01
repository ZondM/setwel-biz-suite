<?php
/** Starting content: categories, brands, pages and 10 sample products. Runs once during installation. */

function seed_basics(): void
{
    $cats = [
        ['Printers', 'printers', 'printer', 'Laser, inkjet, MegaTank and multifunction printers for home, school and office.'],
        ['Ink & Toner', 'ink-toner', 'drop', 'Genuine ink and toner cartridges, drums and maintenance supplies.'],
        ['Scanners', 'scanners', 'scan', 'Document and photo scanners for offices, schools and archives.'],
        ['Laptop Bags', 'laptop-bags', 'bag', 'Kenton laptop backpacks, business bags and anti-theft bags.'],
        ['USB Flash Drives', 'usb-flash-drives', 'usb', 'Reliable USB flash drives in all sizes.'],
        ['SSD Drives', 'ssd-drives', 'ssd', 'Fast SSD drives to upgrade laptops and desktops.'],
        ['Paper & Office', 'paper-office', 'paper', 'Paper, labels and everyday office supplies.'],
        ['Accessories', 'accessories', 'plug', 'Cables, keyboards, mice and other accessories.'],
    ];
    foreach ($cats as $i => [$n, $s, $icon, $d]) {
        if (!q_val('SELECT id FROM categories WHERE slug = ?', [$s])) {
            db_insert('categories', ['name' => $n, 'slug' => $s, 'icon' => $icon, 'description' => $d, 'sort_order' => $i, 'visible' => 1]);
        }
    }
    foreach (['Canon', 'HP', 'Epson', 'Riso', 'Brother', 'Kenton'] as $i => $b) {
        if (!q_val('SELECT id FROM brands WHERE slug = ?', [slugify($b)])) {
            db_insert('brands', ['name' => $b, 'slug' => slugify($b), 'sort_order' => $i, 'visible' => 1]);
        }
    }
    foreach (seed_pages() as $slug => [$title, $desc, $content]) {
        if (!q_val('SELECT id FROM pages WHERE slug = ?', [$slug])) {
            db_insert('pages', ['slug' => $slug, 'title' => $title, 'meta_description' => $desc, 'content' => $content, 'updated_at' => now()]);
        }
    }
    db_insert('banners', [
        'title' => 'Genuine printers, ink & toner — delivered nationwide',
        'subtitle' => 'Canon, HP, Epson, Riso and Brother for businesses, schools, government and home offices. Free delivery over R2 500.',
        'link_url' => '/shop', 'button_text' => 'Shop now', 'placement' => 'hero', 'active' => 1, 'sort_order' => 1, 'created_at' => now(),
    ]);
    db_insert('banners', [
        'title' => 'October specials on Canon printers',
        'subtitle' => 'Monthly deals while stocks last.',
        'link_url' => '/specials', 'button_text' => 'View specials', 'placement' => 'hero', 'active' => 1, 'sort_order' => 2, 'created_at' => now(),
    ]);
}

function seed_products(): void
{
    $printers = (int)q_val("SELECT id FROM categories WHERE slug = 'printers'");
    $ink = (int)q_val("SELECT id FROM categories WHERE slug = 'ink-toner'");
    $bags = (int)q_val("SELECT id FROM categories WHERE slug = 'laptop-bags'");
    $canon = (int)q_val("SELECT id FROM brands WHERE slug = 'canon'");
    $kenton = (int)q_val("SELECT id FROM brands WHERE slug = 'kenton'");
    $w3 = '3-year Canon warranty (T&Cs apply)';

    // [sku, name, brand, cat, cost (supplier, excl VAT), short, description, specs, compatible, image, featured, mpn, warranty]
    $items = [
        ['CMF752CDW', 'Canon i-SENSYS MF752Cdw Colour Laser Multifunction Printer', $canon, $printers, 6959,
            'Fast colour laser all-in-one with 50-page document feeder and Wi-Fi.',
            "A busy-office colour laser printer that prints, copies and scans at up to 33 pages per minute.\n\nThe 50-sheet automatic document feeder handles multi-page scans and copies, and Wi-Fi lets the whole team print from laptops and phones.",
            "Functions: Print, Copy, Scan\nPrint speed: Up to 33 ppm (A4)\nDocument feeder: 50-page ADF\nConnectivity: Wi-Fi, Ethernet, USB\nPrint technology: Colour laser\nSuitable for: Home office and office", '', 'mf752cdw', 1, 'MF752Cdw', $w3],
        ['CMF664CDW', 'Canon i-SENSYS MF664Cdw Colour Laser Multifunction Printer', $canon, $printers, 4252,
            'Compact colour laser all-in-one with touchscreen and Wi-Fi.',
            "A compact colour laser multifunction printer for small offices — print, copy and scan in colour with an easy touchscreen.",
            "Functions: Print, Copy, Scan\nDocument feeder: 50-page ADF\nConnectivity: Wi-Fi, Ethernet, USB\nPrint technology: Colour laser\nSuitable for: Home and home office", '', 'mf664cdw', 1, 'MF664Cdw', $w3],
        ['CLBP6030', 'Canon i-SENSYS LBP6030 Mono Laser Printer', $canon, $printers, 1623,
            'Small, affordable black-and-white laser printer.',
            "A compact, energy-saving mono laser printer — ideal for homes, students and small offices that print mostly text.",
            "Functions: Print only\nPrint speed: 18 ppm (A4)\nConnectivity: Hi-Speed USB\nMemory: 32 MB\nUses toner: Canon 725", '', 'lbp6030', 0, 'LBP6030', $w3],
        ['CMF3010', 'Canon i-SENSYS MF3010 Mono Laser Multifunction Printer', $canon, $printers, 2474,
            'Print, copy and scan in one compact mono laser.',
            "A popular mono laser all-in-one: print, copy and scan with 2-on-1 ID card copy — perfect for schools and small offices.",
            "Functions: Print, Copy, Scan\nPrint speed: 18 ppm (A4)\nConnectivity: Hi-Speed USB\nSpecial feature: 2-on-1 ID card copy\nUses toner: Canon 725", '', 'mf3010', 1, 'MF3010', $w3],
        ['CMF275DW', 'Canon i-SENSYS MF275dw Mono Laser Multifunction Printer with Fax', $canon, $printers, 3092,
            'Print, copy, scan and fax with Wi-Fi and a 35-page document feeder.',
            "A 4-in-1 mono laser printer for the office — print, copy, scan and fax at up to 29 pages per minute.",
            "Functions: Print, Copy, Scan, Fax\nPrint speed: 29 ppm (A4)\nDocument feeder: 35-page ADF\nConnectivity: Wi-Fi, USB", '', 'mf275dw', 0, 'MF275dw', $w3],
        ['CTS3640', 'Canon PIXMA TS3640 Wireless Inkjet All-in-One Printer', $canon, $printers, 714,
            'Affordable home printer: print, copy, scan with Wi-Fi.',
            "An easy, affordable wireless inkjet printer for home and homework. Print, copy and scan, and print from your phone.",
            "Functions: Print, Copy, Scan\nPrint speed: approx. 7.7 ipm mono / 4.0 ipm colour\nConnectivity: Wi-Fi, cloud print\nSuitable for: Home", '', 'ts3640', 0, 'TS3640', ''],
        ['CRG725', 'Canon 725 Black Toner Cartridge', $canon, $ink, null,
            'Genuine Canon 725 toner for LBP6030 and MF3010.',
            "Genuine Canon 725 black toner cartridge for sharp, reliable prints.",
            "Colour: Black\nYield: approx. 1 600 pages\nType: Genuine (OEM)", "Canon i-SENSYS LBP6030\nCanon i-SENSYS MF3010\nCanon i-SENSYS LBP6000\nCanon i-SENSYS LBP6020", '', 0, '725', ''],
        ['1901BLACK', 'Kenton Laptop Backpack Black', $kenton, $bags, 266,
            'Sleek hard-shell style laptop backpack.',
            "A smart, minimalist black laptop backpack for work and study, with a padded laptop compartment.",
            "Colour: Black\nType: Backpack\nLaptop compartment: Padded", '', 'kenton-1901', 1, '1901BLACK', ''],
        ['CJB2205', 'Kenton 15.6" Black Laptop Backpack', $kenton, $bags, 335,
            'Roomy 15.6" laptop backpack with organiser pockets.',
            "A practical, roomy laptop backpack with several compartments — great for students and commuters.",
            "Fits laptops: Up to 15.6\"\nColour: Black\nType: Backpack", '', 'kenton-cjb2205', 0, 'CJB2205', ''],
        ['PDB1023DN', 'Kenton 15.6" Business Laptop Backpack Navy', $kenton, $bags, 313,
            'Slim navy business backpack for 15.6" laptops.',
            "A slim, professional navy business backpack with a dedicated 15.6\" laptop compartment.",
            "Fits laptops: Up to 15.6\"\nColour: Navy\nType: Business backpack", '', 'kenton-pdb1023dn', 0, 'PDB1023DN', ''],
    ];
    foreach ($items as [$sku, $name, $brand, $cat, $cost, $short, $desc, $specs, $compat, $img, $feat, $mpn, $warranty]) {
        if (q_val('SELECT id FROM products WHERE sku = ?', [$sku])) {
            continue;
        }
        $id = db_insert('products', [
            'sku' => $sku, 'name' => $name, 'slug' => unique_slug('products', $name), 'brand_id' => $brand, 'category_id' => $cat,
            'short_description' => $short, 'description' => $desc, 'specs' => $specs, 'compatible' => $compat,
            'cost_price' => $cost, 'price' => $cost ? price_from_cost($cost) : null, 'stock_status' => $cost ? 'in_stock' : 'on_order',
            'visible' => 1, 'featured' => $feat, 'mpn' => $mpn, 'warranty' => $warranty, 'created_at' => now(), 'updated_at' => now(),
        ]);
        if ($img && is_file(APP_DIR . "/seed/$img.jpg")) {
            add_product_image($id, APP_DIR . "/seed/$img.jpg", $name, $name);
        }
    }
    // One sample special so you can see how sale prices look (change or remove it in the admin).
    q("UPDATE products SET sale_price = 3699, sale_ends = '2026-10-31' WHERE sku = 'CMF3010'");
}

function seed_pages(): array
{
    return [
        'about' => ['About Setwel Africa', 'Setwel Africa is a South African supplier of genuine printers, ink, toner and office technology for businesses, schools, government and individuals.', <<<TXT
## Who we are

**{legal_name}** is a proudly South African, 100% Black-owned business based in Cape Town. Since 2016 we have supplied printers, ink and toner cartridges, scanners, storage and office technology to businesses, schools, government departments and individuals.

## Authorised reseller

We are an authorised reseller of genuine **Canon, HP, Epson, Riso and Brother** products. Every product we sell is new, genuine and covered by the manufacturer's warranty. You can view our credentials on the [Credentials page](/credentials).

## Why buy from us

- Genuine products with full manufacturer warranty
- Nationwide courier delivery — free on orders over {free_delivery_threshold}
- Collection available in Cape Town
- Quotes and invoices for businesses, schools and government
- Real people who answer the phone: {phone}

## Get in touch

Email {email}, call {phone} or WhatsApp {whatsapp}. We are open {hours}.
TXT],
        'delivery-returns' => ['Delivery & Returns', 'Nationwide courier delivery, free over the free-delivery amount, collection in Cape Town, and our returns policy.', <<<TXT
## Delivery

- We deliver **nationwide** by courier.
- Delivery costs **{delivery_fee}** per order, and is **free on orders of {free_delivery_threshold} or more**.
- Orders are dispatched after payment has been received (PayFast payments are confirmed immediately; EFT payments once they reflect in our account).
- Delivery usually takes **2–5 working days** to main centres, longer to outlying areas.
- You will receive a tracking number by email when your order ships.
- Someone must be available to sign for the parcel. Please check the parcel before signing; note any visible damage on the courier's delivery note.

## Collection

You may collect your order free of charge from **{collection_address}** ({hours}). Wait for our "Ready for collection" email and bring your order number and ID.

## Returns and cancellations

- **Cooling-off (online purchases):** In terms of section 44 of the Electronic Communications and Transactions Act, you may cancel an online purchase within **7 days** of receiving the goods, without reason. Goods must be unused, in their original sealed packaging. You pay the cost of returning the goods.
- **Defective goods:** In terms of section 56 of the Consumer Protection Act, if a product is defective within **6 months** of delivery you may choose a repair, replacement or refund. Please contact us first so we can arrange the return.
- Opened consumables (ink, toner, ribbons) can only be returned if defective.
- Refunds are paid within 10 working days of receiving and checking the returned goods, to the original payment method or your bank account.

To arrange a return, email **{email}** with your order number.
TXT],
        'warranty' => ['Warranty', 'All products are new, genuine and covered by the manufacturer warranty.', <<<TXT
## Manufacturer warranty

Every product we sell is new and genuine, and carries the **manufacturer's warranty**. The warranty period depends on the product and is shown on the product page where available (for example, selected Canon printers carry a 3-year warranty, T&Cs apply).

## How to claim

1. Email **{email}** or WhatsApp **{whatsapp}** with your order number, the product and a short description of the fault.
2. We will help you log the claim with the manufacturer or its authorised service centre, or arrange the return to us.
3. Keep your invoice — it is your proof of purchase.

## What warranty does not cover

- Damage from incorrect use, power surges, drops or liquids
- Damage caused by non-genuine or refilled consumables, where the manufacturer excludes it
- Normal wear and tear and consumable parts

Your rights under the Consumer Protection Act are not affected.
TXT],
        'privacy' => ['Privacy Policy (POPIA)', 'How Setwel Africa collects, uses and protects your personal information in terms of the Protection of Personal Information Act (POPIA).', <<<TXT
## Who we are

**{legal_name}** ("we", "us") is the responsible party for personal information collected through this website. Information Officer: **{information_officer}**, email {email}, phone {phone}, address {address}.

## What we collect

- **Orders and quotes:** your name, company, email, phone number, delivery address and the products you order.
- **Payments:** card and bank payments are processed by **PayFast**. We never see or store your card details. If you pay by EFT, we store your proof of payment.
- **Newsletter:** your email address, only if you sign up.
- **Website use:** essential cookies needed for your cart and checkout. Analytics and advertising cookies (Google Analytics, Meta Pixel) are only used **if you accept them** in the cookie notice.

## Why we use it

To process and deliver your orders, send quotes and invoices, answer your questions, meet our legal and tax obligations, and — only with your consent — send you our specials newsletter.

## Who we share it with

Only with service providers who help us run the shop, and only what they need: PayFast (payments), our courier (delivery), our web hosting and email provider. We do not sell your information.

## How long we keep it

Order and invoice records are kept for 5 years as required by law. Newsletter subscriptions are kept until you unsubscribe. Other information is deleted when no longer needed.

## Your rights

You may ask to see, correct or delete your personal information, object to its use, or unsubscribe from marketing at any time — email {email}. If you are unhappy with how we handled your information, you may complain to the **Information Regulator**: www.inforegulator.org.za, complaints.IR@inforegulator.org.za.

## Security

We use HTTPS encryption, secure password storage and restricted access to protect your information.
TXT],
        'terms' => ['Terms & Conditions', 'Terms and conditions for buying printers, ink, toner and office technology from the Setwel Africa online store.', <<<TXT
**Please read these Terms carefully.** By using this website, requesting a quote or placing an order with Setwel Africa, you agree to these Terms and Conditions. If you do not agree, please do not use the website or place an order. These Terms form a legally binding agreement between you and {legal_name}.

## 1. Definitions

- **"Setwel Africa", "we", "us", "our"** means {legal_name}, registration number {registration_number}, a company incorporated in South Africa.
- **"Website"** means {site_url} and all its pages, forms and services.
- **"Customer", "you", "your"** means any person, business, school, government body or other organisation that uses the Website, requests a quote or places an order.
- **"Products"** means the printers, ink and toner cartridges, scanners, storage, laptop bags, accessories and other goods we sell.
- **"Order"** means a purchase placed through the Website, or a quote you have accepted in writing.

## 2. Who we are

Setwel Africa is a South African, 100% Black-owned company established in 2016. We supply genuine printers, ink, toner and office technology to businesses, schools, government and individuals across South Africa, and are an authorised reseller of the brands shown on our [Credentials page](/credentials).

- **Registered name:** {legal_name}
- **Registration number:** {registration_number}
- **Cape Town:** {address}
- **KwaZulu-Natal:** 570807 Snathing, Edendale, Pietermaritzburg, 3201
- **Email:** {email}
- **Phone:** {phone}
- **WhatsApp:** {whatsapp}

## 3. Products and information

- We sell only new, genuine products.
- Product photos are for illustration. Packaging and colours may differ slightly from the photo.
- Specifications and compatibility lists come from the manufacturer. Please check that a cartridge matches your printer model before ordering. If unsure, WhatsApp us your printer model and we will confirm.
- Brand names and logos belong to their owners and are used only to identify the products we sell.

## 4. Orders

- An Order is a request to buy. It is accepted only once **payment has been received and confirmed** by us.
- We may decline or cancel an Order if a product is out of stock, if a price was clearly wrong, or if we suspect fraud. If we cancel after you have paid, we refund you in full.
- You will receive an order confirmation email and can follow your order with the link in that email.

## 5. Prices

- All prices are in South African Rand (ZAR).
- {legal_name} is **not registered for VAT**. No VAT is added to our prices, and our invoices are not tax invoices.
- Prices and stock can change without notice. Specials are valid until the date shown or while stocks last.
- Errors and omissions excepted (E&OE). If a price on the Website is clearly wrong, we will contact you before processing the Order, and you may cancel for a full refund.
- Delivery costs are shown at checkout before you pay.

## 6. Payment

### 6.1 Payment methods

We accept payment through **PayFast**: credit and debit cards (Visa and Mastercard), Instant EFT and other methods offered by PayFast at checkout. You may also pay by **manual EFT** into our bank account, using your order number as the reference.

### 6.2 Payment security

Card payments are processed securely by PayFast. We never see or store your card details.

### 6.3 EFT orders

- Please upload your proof of payment on your order page.
- Orders are dispatched only once the money reflects in our bank account.
- Unpaid EFT orders may be cancelled after 3 working days.

### 6.4 Business and government orders

Formal quotes are available through our [quote form](/quote). Quotes are valid for 7 days unless stated otherwise, and are subject to stock availability.

## 7. Delivery and collection

- We deliver **nationwide** by courier. Delivery costs {delivery_fee} per order and is **free on orders of {free_delivery_threshold} or more**.
- Delivery usually takes 2–5 working days after payment to main centres, and longer to outlying areas. Delivery times are estimates, not guarantees.
- Someone must be available to sign for the parcel. Please check it before signing and note any visible damage on the courier's delivery note.
- You may collect your Order free of charge from {collection_address} ({hours}) after you receive our "Ready for collection" email.

Full details: [Delivery & Returns](/page/delivery-returns).

## 8. Returns, cancellations and refunds

- **Cooling-off for online purchases:** under section 44 of the Electronic Communications and Transactions Act, 25 of 2002 (ECTA), you may cancel an online purchase within **7 days** of receiving the goods, without giving a reason. Goods must be unused and in their original, sealed packaging. You pay the cost of returning the goods.
- **Defective goods:** under section 56 of the Consumer Protection Act, 68 of 2008 (CPA), you may return defective goods within **6 months** of delivery and choose a repair, replacement or refund.
- Opened consumables (ink, toner, ribbons) can only be returned if defective.
- Refunds are paid within 10 working days after we receive and check the returned goods.

To arrange a return, email {email} with your order number.

## 9. Warranty

Products carry the **manufacturer's warranty**. Where a warranty period is known, it is shown on the product page. See our [Warranty page](/page/warranty) for how to claim. Warranty does not cover damage from misuse, power surges, liquids, or non-genuine consumables where the manufacturer excludes this.

## 10. Your information and privacy

We process your personal information (name, contact details, delivery address and order history) in line with the Protection of Personal Information Act, 4 of 2013 (POPIA). We use it only to process your orders and quotes, deliver your goods, communicate with you and meet our legal obligations. We do not sell your information. Read our [Privacy Policy](/page/privacy).

## 11. Acceptable use of the Website

You may not use the Website to:

- place false or fraudulent orders, or pay with a card or account you are not authorised to use
- try to gain unauthorised access to the Website, our systems or other customers' information
- copy, scrape or reproduce our content, prices or photos for commercial use without permission
- break any law

We may block access or cancel orders where we reasonably believe the Website is being misused.

## 12. Intellectual property

The Website design, text, Setwel Africa name and logo belong to {legal_name} and are protected by South African and international copyright and trademark law. Manufacturer names, logos and product photos belong to their respective owners.

## 13. Limitation of liability

- We take care to keep the Website accurate and available, but cannot guarantee that it will always be error-free or uninterrupted.
- To the extent allowed by South African law, our total liability for any claim relating to an Order is limited to the amount you paid for that Order.
- We are not liable for indirect or consequential losses, such as loss of profit, loss of data or business interruption.
- Nothing in this clause limits your rights under the CPA.

## 14. Consumer Protection Act rights

Nothing in these Terms limits or waives your rights under the Consumer Protection Act, 68 of 2008. Where these Terms conflict with the CPA, the CPA applies. Your rights include:

- the right to fair, honest and transparent dealing
- the right to receive goods of good quality that are safe and fit for purpose
- the right to return defective goods within 6 months of delivery
- the right to a 5-business-day cooling-off period for purchases resulting from direct marketing (in addition to the 7-day ECTA cooling-off for online purchases)

## 15. Governing law and disputes

These Terms are governed by the laws of the Republic of South Africa. Before taking legal steps, please contact us first at {email} or on WhatsApp {whatsapp}. We will respond within 5 business days and try to resolve the matter fairly. Unresolved disputes may be referred to the **Consumer Goods and Services Ombud (CGSO)**, to mediation, or to the South African courts.

## 16. Changes to these Terms

We may update these Terms from time to time. The "Last updated" date at the bottom of this page shows when they last changed. The Terms that applied when you placed your Order apply to that Order.

## 17. Contact us

- **Email:** {email}
- **Phone:** {phone}
- **WhatsApp:** {whatsapp}
- **Cape Town:** {address}
- **KwaZulu-Natal:** 570807 Snathing, Edendale, Pietermaritzburg, 3201
- **Hours:** {hours}
TXT],
    ];
}
