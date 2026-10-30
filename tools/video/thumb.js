// Renders tools/video/thumbnail.html to social/images/youtube-thumbnail.jpg (1280x720).
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file://' + path.join(__dirname, 'thumbnail.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, '../../social/images/youtube-thumbnail.jpg'), type: 'jpeg', quality: 90 }); await b.close(); })();
