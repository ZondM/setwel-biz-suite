// Records product-tour videos of the real Setwel app (phone/web version served locally),
// with a moving cursor, captions and title cards, frame by frame, into MP4.
//
//   php -S 127.0.0.1:8150 -t website        (in another terminal)
//   node tools/video/tour.js                 -> social/videos/setwel-tour-16x9.mp4 (YouTube, Facebook)
//   node tools/video/tour.js shorts          -> social/videos/setwel-short-*-9x16.mp4 (TikTok, Reels, Shorts)
//
// Receipt scanning is shown with a fixed AI answer (no internet needed); everything else is the app as it is.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'social', 'videos');
const FPS = 30;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

async function recorder(mode, out) {
  const tall = mode === 'tall';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(tall ? { viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 } : { viewport: { width: 1412, height: 794 }, deviceScaleFactor: 1920 / 1412 });
  await ctx.route('**/api/scan.php', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ remaining: 28, fields: { is_receipt: true, supplier_name: 'Engen Quickshop', supplier_vat_number: '4123456789', document_number: 'TX88231',
      date: ago(1), total: 1214.9, vat_amount: 158.47, description: 'Diesel and engine oil', category: 'Fuel & travel', confidence: 'high' } }),
  }));
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(__dirname, 'tour-stage.html') + `?mode=${tall ? 'tall' : 'wide'}`);
  await page.evaluate(() => document.fonts.ready);
  const app = page.frameLocator('#app');
  await app.getByRole('button', { name: /Get started/ }).waitFor();

  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '64k', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let frames = 0;
  let cur = tall ? { x: 300, y: 700 } : { x: 1100, y: 660 };
  const R = {
    app, page,
    async shot(n = 1) {
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      for (let i = 0; i < n; i++) ff.stdin.write(buf);
      frames += n;
    },
    async hold(sec) { await R.shot(Math.round(sec * FPS)); },
    async live(sec) { // real time passing (app animations), captured every 2nd frame
      const n = Math.round(sec * FPS / 2);
      for (let i = 0; i < n; i++) { await page.waitForTimeout(50); await R.shot(2); }
    },
    async caption(h, p) {
      for (let i = 6; i >= 0; i--) { await page.evaluate((o) => stage.capOpacity(o), i / 6); await R.shot(1); }
      await page.evaluate(([h, p]) => stage.caption(h, p), [h, p]);
      for (let i = 0; i <= 10; i++) { await page.evaluate((o) => stage.capOpacity(o), ease(i / 10)); await R.shot(1); }
    },
    async card(html, sec, fadeIn = true) {
      await page.evaluate((h) => stage.card(h), html);
      if (fadeIn) for (let i = 0; i <= 12; i++) { await page.evaluate((o) => stage.cardOpacity(o), ease(i / 12)); await R.shot(1); }
      else await page.evaluate(() => stage.cardOpacity(1));
      await R.hold(sec);
    },
    async uncard() { for (let i = 12; i >= 0; i--) { await page.evaluate((o) => stage.cardOpacity(o), ease(i / 12)); await R.shot(1); } },
    async moveTo(loc, frac = 0.5) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const b = await loc.boundingBox();
      if (!b) throw new Error('not visible: ' + loc);
      const to = { x: b.x + b.width * frac, y: b.y + b.height / 2 };
      const n = Math.max(10, Math.min(24, Math.round(Math.hypot(to.x - cur.x, to.y - cur.y) / (tall ? 18 : 32))));
      for (let i = 1; i <= n; i++) {
        const k = ease(i / n);
        await page.evaluate(([x, y]) => stage.cursor(x, y), [cur.x + (to.x - cur.x) * k, cur.y + (to.y - cur.y) * k]);
        await R.shot(1);
      }
      cur = to;
    },
    async click(loc, opts = {}) {
      await R.moveTo(loc, opts.frac);
      for (let i = 0; i < 4; i++) { await page.evaluate(([x, y, k]) => { stage.ripple(x, y, k); stage.cursor(x, y, 0.88); }, [cur.x, cur.y, i / 6]); await R.shot(1); }
      await loc.click();
      for (let i = 4; i <= 7; i++) { await page.evaluate(([x, y, k]) => { stage.ripple(x, y, k); stage.cursor(x, y, 1); }, [cur.x, cur.y, i / 7]); await R.shot(1); }
      await page.evaluate(() => stage.ripple(0, 0, 0));
      await page.waitForTimeout(opts.wait ?? 350);
    },
    async type(loc, text, perChar = 2) {
      await R.click(loc, { wait: 100 });
      await loc.fill('');
      for (const ch of text) { await loc.press(ch === ' ' ? 'Space' : ch); await R.shot(perChar); }
    },
    async close() {
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      await browser.close();
      console.log('Wrote', path.relative(ROOT, out), (frames / FPS).toFixed(1) + 's');
    },
  };
  await page.evaluate(([x, y]) => stage.cursor(x, y), [cur.x, cur.y]);
  return R;
}

const TITLE = (h, p) => `<img src="../../brand/setwel-logo-transparent.png" alt=""><h1>${h}</h1><p>${p}</p>`;
const END = `<img src="../../brand/setwel-logo-transparent.png" alt=""><h1>Setwel <em>Biz Suite</em></h1>
  <p>Invoices, receipts, reminders and VAT, done for you.</p><div class="pill">setwelbusiness.co.za</div><div class="small">30 days free · No card needed · From R59.99 a month</div>`;

async function setUp(R, { sample = true } = {}) {
  const { app } = R;
  await R.click(app.getByRole('button', { name: /Get started/ }));
  await R.type(app.getByPlaceholder("e.g. Thabo's Electrical Services"), "Thabo's Electrical");
  await R.click(app.getByRole('button', { name: /Finish setup/ }), { wait: 700 });
  if (sample) await R.click(app.getByRole('button', { name: /Load sample data/ }), { wait: 1200 });
}

/** Same set-up, off camera (shorts that start straight at the point). */
async function quickSetUp(R) {
  const { app } = R;
  await app.getByRole('button', { name: /Get started/ }).click();
  await app.getByPlaceholder("e.g. Thabo's Electrical Services").fill("Thabo's Electrical");
  await app.getByRole('button', { name: /Finish setup/ }).click();
  await app.getByRole('button', { name: /Load sample data/ }).click();
  await R.page.waitForTimeout(1200);
}

async function goTo(R, hash) {
  await R.page.frame({ url: /\/app\// }).evaluate((h) => (location.hash = h), hash);
  await R.page.waitForTimeout(600);
}

async function tourWide() {
  const R = await recorder('wide', path.join(OUT, 'setwel-tour-16x9.mp4'));
  const { app } = R;
  await R.card(TITLE('Your business finances,<br><em>handled with confidence.</em>', 'A one-minute tour of Setwel Biz Suite'), 3, false);
  await R.page.evaluate(() => stage.caption('Set up in a minute.', 'No card, no sign-up form. Your 30 free days start now.'));
  await R.uncard();
  await setUp(R);
  await R.caption('Setwel tells you <em>what needs doing today.</em>', 'Money in and out, who owes you, and what is due.');
  await R.hold(1.6);
  await R.click(app.getByRole('button', { name: 'Send reminder' }).first(), { wait: 700 });
  await R.caption('Late payers? <em>The reminder is already written.</em>', 'Send it on WhatsApp or by email with the invoice attached.');
  await R.hold(2.4);
  await R.click(app.getByRole('button', { name: 'Cancel' }).first(), { wait: 400 });

  await R.caption('A professional invoice <em>in seconds.</em>', 'Your logo, your banking details, VAT worked out.');
  await R.click(app.getByRole('button', { name: /New invoice/ }).first(), { wait: 600 });
  await R.click(app.getByRole('button', { name: /Add line item/ }));
  await R.type(app.getByPlaceholder('Describe the work or item'), 'Solar geyser installation', 1);
  const nums = app.locator('input[type=number]');
  await R.type(nums.nth(1), '8500', 3);
  await R.hold(0.6);
  await R.click(app.getByRole('button', { name: /Save & view invoice/ }), { wait: 800 });
  await R.hold(1.2);
  await R.click(app.getByRole('button', { name: /^Send$/ }), { wait: 700 });
  await R.caption('Sent on <em>WhatsApp or email.</em>', 'Setwel types the message. You press send.');
  await R.hold(2.4);
  await R.click(app.getByRole('button', { name: 'Cancel' }).first(), { wait: 400 });

  await goTo(R, '#/expenses');
  await R.caption('Snap a receipt. <em>AI fills in the expense.</em>', 'Supplier, amount, VAT and category, ready to check and save.');
  await R.moveTo(app.getByRole('button', { name: /Scan receipt/ }));
  await app.locator('input[type=file]').first().setInputFiles(path.join(__dirname, 'receipt-sample.jpg'));
  await R.live(1.6);
  await R.hold(2.2);
  await R.click(app.getByRole('button', { name: 'Save expense' }), { wait: 600 });
  await R.hold(1);

  await goTo(R, '#/reports/monthly?month=' + new Date().toISOString().slice(0, 7));
  await R.caption('Your month <em>on one page.</em>', 'What came in, what went out and who owes you. Send it to your accountant.');
  await R.hold(3);
  await goTo(R, '#/dashboard');
  await R.caption('Less paperwork. <em>More business.</em>', 'Windows, Mac and phone.');
  await R.hold(2);
  await R.card(END, 3.5);
  await R.close();
}

async function shortsTall() {
  const HOOK = (h) => `<h1 style="padding:0 34px">${h}</h1>`;
  // 1. Invoice on the phone
  {
    const R = await recorder('tall', path.join(OUT, 'setwel-short-invoice-9x16.mp4'));
    const { app } = R;
    await R.card(HOOK('Invoice a client<br><em>in 20 seconds.</em>'), 1.6, false);
    await R.page.evaluate(() => stage.caption('Open Setwel <em>on your phone.</em>', 'Nothing to install. 30 days free.'));
    await R.uncard();
    await setUp(R);
    await goTo(R, '#/invoices/new');
    await R.caption('Pick the customer, <em>add the work.</em>', 'VAT and totals worked out for you.');
    await R.click(app.getByRole('button', { name: /Add line item/ }));
    await R.type(app.getByPlaceholder('Describe the work or item'), 'Geyser repair', 1);
    await R.type(app.locator('input[type=number]').nth(1), '2400', 3);
    await R.click(app.getByRole('button', { name: /Save & view invoice/ }), { wait: 800 });
    await R.click(app.getByRole('button', { name: /^Send$/ }), { wait: 700 });
    await R.caption('Send it <em>on WhatsApp.</em>', 'PDF invoice with your logo and banking details.');
    await R.hold(2.4);
    await R.card(END, 3);
    await R.close();
  }
  // 2. Receipt scan on the phone
  {
    const R = await recorder('tall', path.join(OUT, 'setwel-short-receipt-9x16.mp4'));
    const { app } = R;
    await R.page.evaluate(() => stage.cardOpacity(1));
    await quickSetUp(R);
    await goTo(R, '#/expenses');
    await R.card(HOOK('Still keeping slips<br>in a <em>shoebox?</em>'), 1.6, false);
    await R.page.evaluate(() => stage.caption('Snap the slip.', 'In Expenses, press Scan receipt.'));
    await R.uncard();
    await R.moveTo(app.getByRole('button', { name: /Scan receipt/ }));
    await app.locator('input[type=file]').first().setInputFiles(path.join(__dirname, 'receipt-sample.jpg'));
    await R.caption('AI reads it <em>in seconds.</em>', 'Supplier, amount, VAT and category.');
    await R.live(1.6);
    await R.hold(2.4);
    await R.click(app.getByRole('button', { name: 'Save expense' }), { wait: 600 });
    await R.caption('Saved. <em>VAT claimed correctly.</em>', 'No more lost slips at year end.');
    await R.hold(1.8);
    await R.card(END, 3);
    await R.close();
  }
  // 3. Who owes you
  {
    const R = await recorder('tall', path.join(OUT, 'setwel-short-reminder-9x16.mp4'));
    const { app } = R;
    await R.page.evaluate(() => stage.cardOpacity(1));
    await quickSetUp(R);
    await R.card(HOOK('Customers<br><em>paying late?</em>'), 1.6, false);
    await R.page.evaluate(() => stage.caption('Setwel shows <em>who owes you.</em>', 'Right on your dashboard.'));
    await R.uncard();
    await R.hold(1.4);
    await R.click(app.getByRole('button', { name: 'Send reminder' }).first(), { wait: 700 });
    await R.caption('The reminder is <em>already written.</em>', 'Friendly first, firmer later. You press send.');
    await R.hold(3);
    await R.card(END, 3);
    await R.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.argv[2] === 'shorts') await shortsTall();
  else await tourWide();
})().catch((e) => { console.error('FAILED', e.message.split('\n')[0]); process.exit(1); });
