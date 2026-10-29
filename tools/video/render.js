// Renders tools/video/automation.html into an MP4, frame by frame, with Playwright and ffmpeg.
//   node tools/video/render.js                      -> website/assets/automation.mp4 + automation-poster.jpg (1280x720)
//   node tools/video/render.js 1080 1920 out.mp4    -> upright version for social media
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const [W = 1280, H = 720] = process.argv.slice(2, 4).map(Number);
const ROOT = path.resolve(__dirname, '../..');
const out = process.argv[4] || path.join(ROOT, 'website/assets/automation.mp4');
const FPS = 30;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + path.join(__dirname, 'automation.html') + `?render&w=${W}&h=${H}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const duration = await page.evaluate(() => window.DURATION);

  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-crf', W > 1200 || H > 1200 ? '27' : '25',
    '-preset', 'slow', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
    if (f === Math.round(3.8 * FPS) && !process.argv[4]) {
      await page.screenshot({ path: path.join(ROOT, 'website/assets/automation-poster.jpg'), type: 'jpeg', quality: 78 });
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('Wrote', out, frames, 'frames');
})();
