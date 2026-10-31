// Renders tools/video/automation.html into MP4 clips and still images, frame by frame,
// with Playwright and ffmpeg.
//   node tools/video/render.js            -> website/assets/automation.mp4 + automation-poster.jpg (1280x720)
//   node tools/video/render.js social     -> the social media pack in social/ (see social.md)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FPS = 30;

async function open(browser, w, h, query) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('file://' + path.join(__dirname, 'automation.html') + `?render&w=${w}&h=${h}&${query || ''}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return page;
}

async function video(browser, { w, h, query, out, poster, social = false }) {
  const page = await open(browser, w, h, query);
  const duration = await page.evaluate(() => window.DURATION);
  const big = w * h > 1280 * 720;
  // Social clips get a silent sound track: some upload tools reject video with no audio stream,
  // and it lets people add music in the TikTok / Instagram app.
  const audio = social ? ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:a', 'aac', '-b:a', '64k'] : ['-an'];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    ...(social ? audio.slice(0, 4) : []),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', big ? '22' : '27',
    '-preset', 'slow', '-movflags', '+faststart', ...(social ? audio.slice(4) : audio), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
    if (poster && f === Math.round(poster.at * FPS)) await page.screenshot({ path: poster.out, type: 'jpeg', quality: 78 });
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
  console.log('Wrote', path.relative(ROOT, out), duration.toFixed(1) + 's');
}

async function still(browser, { w, h, query, at, out }) {
  const page = await open(browser, w, h, query);
  await page.evaluate((t) => window.render(t), at);
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  await page.close();
  console.log('Wrote', path.relative(ROOT, out));
}

// Social media pack. 9:16 = Reels, TikTok, Facebook Reels, Stories, WhatsApp Status. 4:5 = Instagram and Facebook feed.
const SIZES = { '9x16': [1080, 1920], '4x5': [1080, 1350] };
const SCENES = ['receipts', 'invoices', 'reminders', 'tax-alerts'];
const STILL_AT = [3.95, 3.8, 3.95, 2.3]; // seconds into each scene when it is fully built
// Extra opening lines to test against the built-in ones (9:16 only, where the first second matters most).
// | starts a new line, *text* is highlighted.
const HOOK_VARIANTS = {
  automation: ['Running a business|*from your phone?*', 'Paperwork done.|*Evenings free.*'],
  receipts: ['Lost slips mean|*lost VAT claims.*', 'Capture an expense|*in seconds.*'],
  invoices: ['Stop retyping|*invoices.*', 'Invoice your client|*on WhatsApp.*'],
  reminders: ['Who still|*owes you money?*', 'Hate asking for|*your money?*'],
  'tax-alerts': ['Know your VAT201|*before it is due.*', 'Do you know what|*you owe in tax?*'],
};

async function social(browser) {
  const dir = path.join(ROOT, 'social');
  for (const sub of ['videos', 'images', 'covers', 'hook-tests']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    await video(browser, { w, h, query: 'hook', out: path.join(dir, 'videos', `setwel-automation-${size}.mp4`), social: true });
    for (let i = 0; i < SCENES.length; i++) {
      await video(browser, { w, h, query: `scene=${i}&hook`, out: path.join(dir, 'videos', `setwel-${SCENES[i]}-${size}.mp4`), social: true });
      await still(browser, { w, h, query: `scene=${i}&still`, at: STILL_AT[i], out: path.join(dir, 'images', `setwel-${SCENES[i]}-${size}.jpg`) });
    }
    await still(browser, { w, h, query: 'scene=0&still', at: 4.5 + 1.2, out: path.join(dir, 'images', `setwel-brand-${size}.jpg`) });
    // Covers (thumbnails) for every clip: the opening question over the finished screen
    for (let i = 0; i < SCENES.length; i++) {
      await still(browser, { w, h, query: `scene=${i}&hook&cover`, at: STILL_AT[i] + 1.8, out: path.join(dir, 'covers', `cover-${SCENES[i]}-${size}.jpg`) });
    }
    await still(browser, { w, h, query: 'scene=0&hook&cover', at: STILL_AT[0] + 1.8, out: path.join(dir, 'covers', `cover-automation-${size}.jpg`) });
    await still(browser, { w, h, query: 'scene=0&hook', at: 0.9, out: path.join(dir, 'images', `setwel-cover-${size}.jpg`) });
  }
  const [w, h] = SIZES['9x16'];
  for (const [name, hooks] of Object.entries(HOOK_VARIANTS)) {
    const i = SCENES.indexOf(name);
    for (const [k, text] of hooks.entries()) {
      const letter = 'BC'[k];
      const base = i < 0 ? '' : `scene=${i}&`;
      const hook = 'hook=' + encodeURIComponent(text);
      await video(browser, { w, h, query: base + hook, out: path.join(dir, 'hook-tests', `setwel-${name}-hook${letter}-9x16.mp4`), social: true });
      await still(browser, { w, h, query: `scene=${Math.max(i, 0)}&${hook}&cover`, at: STILL_AT[Math.max(i, 0)] + 1.8, out: path.join(dir, 'hook-tests', `cover-${name}-hook${letter}-9x16.jpg`) });
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  if (process.argv[2] === 'social') await social(browser);
  else await video(browser, {
    w: 1280, h: 720, out: path.join(ROOT, 'website/assets/automation.mp4'),
    poster: { at: 3.8, out: path.join(ROOT, 'website/assets/automation-poster.jpg') },
  });
  await browser.close();
})();
