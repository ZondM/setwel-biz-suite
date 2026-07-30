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
