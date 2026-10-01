# Setwel Africa — online store + business suite

## 🛒 Online store (setwelafrica.com) — `store/`

A complete online store for Setwel Africa: shop, search, cart, PayFast and EFT checkout, quotes, an admin area for products, Excel price imports, orders, banners, certificates, and SEO.

**Start here:** double-click **START-HERE.html** (all guides on one page) and **PREVIEW-WEBSITE.bat** (see the shop on your own Windows computer).

**Guides (also inside START-HERE.html):**
1. [Install on registerdomain hosting](docs/1-INSTALL-ON-REGISTERDOMAIN.md)
2. [Monthly update guide — prices, products, specials](docs/2-MONTHLY-UPDATE-GUIDE.md)
3. [Launch checklist](docs/3-LAUNCH-CHECKLIST.md)
4. [Running costs, why this setup, honest limits](docs/4-COSTS-AND-LIMITS.md)

**File to upload to cPanel:** `dist/setwel-store-upload.zip`. Rebuild it with `php build-store-zip.php`.

---

## 🖥️ Business Suite (desktop app) — installation

╔══════════════════════════════════════════════════════════════╗
║         SETWEL AFRICA BUSINESS SUITE — HOW TO INSTALL       ║
╚══════════════════════════════════════════════════════════════╝

The app runs locally on your computer — your data never leaves
your machine. Follow the steps for your operating system below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINDOWS (Step-by-step)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — Install Node.js (one-time, free)
  1. Go to https://nodejs.org
  2. Click the big green "LTS" button to download
  3. Run the downloaded installer — click Next → Next → Install
  4. Restart your computer after installing

STEP 2 — Extract this ZIP file
  1. Right-click the ZIP file you downloaded
  2. Choose "Extract All..."
  3. Choose a folder (e.g. C:\Setwel or your Desktop)
  4. Click Extract

STEP 3 — Start the app
  1. Open the extracted folder
  2. Double-click "Start Setwel Africa.bat"
  3. A black window will appear — this is normal, leave it open
  4. Your browser will automatically open to the app

STEP 4 — Use the app
  • The app opens at http://localhost:3000
  • Bookmark that address — you can also just run Step 3 again
  • To STOP the app: close the black window


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MAC (Step-by-step)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — Install Node.js (one-time, free)
  Option A (recommended): https://nodejs.org → click LTS → install
  Option B (if you use Homebrew): brew install node

STEP 2 — Extract the ZIP
  Double-click the ZIP file — macOS extracts it automatically

STEP 3 — Start the app
  Open Terminal and run:
    cd /path/to/extracted/folder
    bash "Start Setwel Africa.sh"

  OR right-click "Start Setwel Africa.sh" → Open With → Terminal

STEP 4 — Browser opens automatically at http://localhost:3000


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CREATE A DESKTOP SHORTCUT (Windows — optional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Right-click "Start Setwel Africa.bat"
  2. Choose "Send to" → "Desktop (create shortcut)"
  3. Double-click that shortcut anytime to launch the app


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  YOUR DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  All your business data is stored in your browser's local
  storage (IndexedDB). It stays on your computer — nothing is
  sent to the internet.

  TIP: Always use the same browser (e.g. Chrome) on the same
  computer to access your data.

  BACKUP: Use Settings → Export or download your reports as
  PDFs and CSV files regularly.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  "Port already in use" error
    → Another app is using port 3000. Open server.js in Notepad
      and change PORT = 3000 to PORT = 3001 (or 3002, etc.)

  Black window closes immediately
    → Node.js may not be installed. Repeat Step 1 above.

  Browser shows "This site can't be reached"
    → Make sure the black window is still open (don't close it)
    → Try typing http://localhost:3000 in your browser manually


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WHAT'S IN THIS FOLDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  dist/                      ← The built app (don't edit)
  server.js                  ← The local server (no dependencies)
  Start Setwel Africa.bat    ← Windows launcher (double-click)
  Start Setwel Africa.sh     ← Mac/Linux launcher
  INSTALL.txt                ← This file
  src/                       ← Source code (for developers)
  electron/                  ← Desktop app wrapper (for developers)
  README.md                  ← Full developer documentation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
