// Personal preview videos: one 9:16 clip per business, showing Setwel with the business's own
// name, the things it sells and a fitting receipt. Example figures only, set up off camera.
//
//   php -S 127.0.0.1:8150 -t website        (in another terminal)
//   node tools/video/personal.js [id]        -> social/personal/setwel-for-<id>.mp4
const fs = require('fs');
const path = require('path');
const { recorder, goTo, ago } = require('./tour');

const OUT = path.join(__dirname, '../../social/personal');
const STOCK = 'Stock / materials purchased';
const FUEL = { supplier_name: 'Engen Quickshop', description: 'Diesel for deliveries', total: 1150, vat_amount: 150, category: 'Fuel & travel' };

// greet: how the video addresses the owner. name: the business name typed into Setwel.
const BUSINESSES = [
  { id: 'jm-stationery', greet: 'Jabu', name: 'J&M Stationery', vat: true,
    customers: ['Thuto Primary School', 'Mzansi Logistics (Pty) Ltd'],
    paid: ['Canon 725 toner cartridge', 4, 580], overdue: ['HP 85A toner cartridge', 6, 650],
    doc: 'invoice', sell: ['HP 05A toner cartridge', '10', '690'],
    scan: { supplier_name: 'Office Wholesale Supplies', description: 'Toner stock: HP 85A x 20', total: 9890, vat_amount: 1290, category: STOCK } },
  { id: 'sibuzansi-recycling', greet: 'Lazarus', name: 'Sibuzansi Recycling', vat: false,
    customers: ['Ubuntu Community Clinic', 'Riverside Body Corporate'],
    paid: ['Recycled A4 paper (box)', 10, 260], overdue: ['Cleaning consumables pack', 5, 320],
    doc: 'invoice', sell: ['Remanufactured toner 05A', '8', '420'],
    scan: { ...FUEL, description: 'Diesel for collections' } },
  { id: 'emunah-projects', greet: 'Nxumalo', name: 'EMUNAH Projects', vat: false,
    customers: ['Siyakhula Primary School', 'Mthembu Attorneys'],
    paid: ['A4 copy paper (box of 5 reams)', 8, 420], overdue: ['HP 26A toner cartridge', 4, 890],
    doc: 'quote', sell: ['High-back office chair', '6', '1850'],
    scan: { supplier_name: 'Office Furniture Wholesale', description: 'Office chairs stock x 6', total: 7800, vat_amount: 0, category: STOCK } },
  { id: 'intellectual-office-supplies', greet: 'Jeffrey', name: 'Intellectual Office Supplies', vat: false,
    customers: ['Tshwane District Office', 'Lethabo Holdings (Pty) Ltd'],
    paid: ['Printer cartridges, assorted', 12, 650], overdue: ['Desktop PC, Core i5', 3, 9800],
    doc: 'quote', sell: ['Laptop 14", Core i5, 16GB', '10', '12500'],
    scan: { supplier_name: 'Tech Distributors', description: 'Laptops for tender stock', total: 45000, vat_amount: 0, category: STOCK } },
  { id: 'alron-toners', greet: 'Alex', name: 'Alron Toners', vat: false,
    customers: ['Phakama Accountants', 'Greenpark Dental'],
    paid: ['Toner refill 12A', 6, 350], overdue: ['Original toner 83A', 3, 720],
    doc: 'invoice', sell: ['Toner refill HP 83A', '8', '380'],
    scan: { supplier_name: 'Imaging Supplies', description: 'Toner powder and chips', total: 2350, vat_amount: 0, category: STOCK } },
  { id: 'milano-vip', greet: 'Milano', name: 'Milano VIP Sports Bar', vat: false,
    customers: ['Khumalo Family Function', 'Derby Supporters Club'],
    paid: ['VIP booth booking', 2, 2500], overdue: ['Year-end function hosting', 1, 6000],
    doc: 'invoice', sell: ['VIP booth booking, Saturday', '1', '2500'],
    scan: { supplier_name: 'Liquor Wholesale', description: 'Beverage stock for the weekend', total: 8640, vat_amount: 0, category: STOCK } },
  ...[['sean', 'Sean'], ['james', 'James'], ['mabuza', 'Mabuza'], ['bhebhe', 'Bhebhe']].map(([id, n]) => ({
    id, greet: n, name: `${n}'s Business`, vat: false,
    customers: ['Ndlovu Family', 'Greenfield Traders'],
    paid: ['Goods supplied', 10, 350], overdue: ['Services rendered', 1, 2800],
    doc: 'invoice', sell: ['Goods supplied', '5', '450'],
    scan: FUEL,
  })),
];

/** Business, customers and two invoices (one paid, one overdue), set up off camera. */
async function prepare(R, b) {
  const { app } = R;
  await app.getByRole('button', { name: /Get started/ }).click();
  await app.getByPlaceholder("e.g. Thabo's Electrical Services").fill(b.name);
  if (b.vat) {
    await app.locator('label', { hasText: 'Not yet registered' }).last().locator('span').first().click();
    await app.getByPlaceholder('10-digit VAT number').fill('4710123456');
  }
  await app.getByRole('button', { name: /Finish setup/ }).click();
  await app.getByRole('button', { name: /start with my own data/ }).click();
  await goTo(R, '#/customers');
  for (const c of b.customers) {
    await app.getByRole('button', { name: 'Add customer' }).first().click();
    await app.locator('.fixed.inset-0 input').first().fill(c);
    await app.getByRole('button', { name: 'Save customer' }).click();
  }
  const invoice = async (customer, [desc, qty, price], dateAgo, dueAgo, pay) => {
    await goTo(R, '#/invoices/new');
    await app.locator('select').first().selectOption({ label: customer });
    await app.locator('input[type=date]').nth(0).fill(ago(dateAgo));
    await app.locator('input[type=date]').nth(1).fill(ago(dueAgo));
    await app.getByRole('button', { name: /Add line item/ }).click();
    await app.getByPlaceholder('Describe the work or item').fill(desc);
    await app.locator('input[type=number]').nth(0).fill(String(qty));
    await app.locator('input[type=number]').nth(1).fill(String(price));
    await app.getByRole('button', { name: /Save & view invoice/ }).click();
    await R.page.waitForTimeout(400);
    if (pay) {
      await app.getByRole('button', { name: /Record payment/ }).click();
      await app.getByRole('button', { name: 'Save payment' }).click();
    }
  };
  await invoice(b.customers[0], b.paid, 6, -24, true);
  await invoice(b.customers[1], b.overdue, 40, 10, false);
  await goTo(R, '#/dashboard');
  await R.page.waitForTimeout(500);
}

async function make(b) {
  const R = await recorder('tall', path.join(OUT, `setwel-for-${b.id}.mp4`), b.scan);
  const { app } = R;
  await R.page.evaluate(() => stage.cardOpacity(1));
  await prepare(R, b);

  await R.card(`<p style="font-size:17px;color:#e3a548;font-weight:700;margin:0 0 6px">For ${b.greet}</p>
    <h1 style="padding:0 28px">${b.name.replace(/&/g, '&amp;')}<br><em>on Setwel</em></h1>
    <p>What Setwel would do for your business, in 30 seconds.</p>`, 2.2, false);
  await R.page.evaluate(([g]) => stage.caption(`Welcome back, <em>${g}.</em>`, 'Who owes you, money in and out, on one screen. (Example figures.)'), [b.greet]);
  await R.uncard();
  await R.hold(1.8);

  await R.click(app.getByRole('button', { name: 'Send reminder' }).first(), { wait: 700 });
  await R.caption('Late payer? <em>The reminder is written.</em>', 'Send it on WhatsApp or email. You press send.');
  await R.hold(2.2);
  await R.click(app.getByRole('button', { name: 'Cancel' }).first(), { wait: 400 });

  const [desc, qty, price] = b.sell;
  if (b.doc === 'quote') {
    await goTo(R, '#/quotes/new');
    await R.caption('A professional quote <em>in seconds.</em>', 'Your name and banking details on a PDF. Ready for tenders.');
  } else {
    await goTo(R, '#/invoices/new');
    await R.caption('Invoice a client <em>in seconds.</em>', b.vat ? 'VAT at 15% worked out for you.' : 'Totals worked out for you.');
  }
  await R.click(app.getByRole('button', { name: /Add line item/ }));
  await R.type(app.getByPlaceholder('Describe the work or item'), desc, 1);
  await R.type(app.locator('input[type=number]').nth(0), qty, 3);
  await R.type(app.locator('input[type=number]').nth(1), price, 3);
  await R.hold(0.8);
  if (b.doc === 'quote') {
    await R.caption('When they say yes, <em>one click to invoice.</em>', 'Quote, invoice, payment, all in one place.');
    await R.click(app.getByRole('button', { name: /Save & mark as sent/ }), { wait: 800 });
    await R.hold(1.6);
  } else {
    await R.click(app.getByRole('button', { name: /Save & view invoice/ }), { wait: 800 });
    await R.click(app.getByRole('button', { name: /^Send$/ }), { wait: 700 });
    await R.caption('Sent <em>on WhatsApp.</em>', 'PDF invoice with your business details.');
    await R.hold(2);
    await R.click(app.getByRole('button', { name: 'Cancel' }).first(), { wait: 400 });
  }

  await goTo(R, '#/expenses');
  await R.caption('Snap a slip. <em>AI fills it in.</em>', 'Supplier, amount and category, ready to save.');
  await R.moveTo(app.getByRole('button', { name: /Scan receipt/ }));
  await app.locator('input[type=file]').first().setInputFiles(path.join(__dirname, 'receipt-sample.jpg'));
  await R.live(1.4);
  await R.hold(1.8);
  await R.click(app.getByRole('button', { name: 'Save expense' }), { wait: 600 });

  if (b.vat) {
    await goTo(R, '#/reports/vat201');
    await R.caption('Your VAT201, <em>worked out.</em>', 'Figures ready to copy onto eFiling.');
    await R.hold(2.2);
  }

  await R.card(`<img src="../../brand/setwel-logo-transparent.png" alt="">
    <h1 style="padding:0 26px">${b.greet}, try it<br><em>free for 30 days.</em></h1>
    <p>No card needed. Windows, Mac and phone.</p><div class="pill">setwelbusiness.co.za</div>
    <div class="small">From R59.99 a month after your trial</div>`, 3.2);
  await R.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  for (const b of BUSINESSES) if (!only || b.id === only) await make(b);
})().catch((e) => { console.error('FAILED', e.message.split('\n')[0]); process.exit(1); });
