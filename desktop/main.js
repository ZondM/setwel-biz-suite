/**
 * Setwel Biz Suite — desktop app (Windows .exe / Mac .dmg).
 *
 * Wraps the same app that runs in the browser, and adds what a desktop
 * install needs: the data saved to a real file on the computer (with daily
 * backups), a 30-day trial that starts on first open, and licence activation
 * (by key, or one click from the setwel://activate link in the payment email).
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const licence = require('./licence');

const SITE = 'https://setwelbusiness.co.za';
const WEB_ROOT = path.join(__dirname, 'web');
const BACKUPS_KEPT = 14;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.setAsDefaultProtocolClient('setwel');

let mainWindow = null;
let gateWindow = null;
let pendingKey = null;

const dbFile = () => path.join(app.getPath('userData'), 'setwel.db');
const backupDir = () => path.join(app.getPath('userData'), 'backups');

/* ---------- data file ---------- */

ipcMain.handle('db:load', () => {
  try {
    return fs.readFileSync(dbFile());
  } catch {
    return null;
  }
});

ipcMain.handle('db:save', (_e, bytes) => {
  const tmp = dbFile() + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(bytes));
  fs.renameSync(tmp, dbFile());
  backupOncePerDay();
});

function backupOncePerDay() {
  fs.mkdirSync(backupDir(), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(backupDir(), `setwel-${today}.db`);
  if (!fs.existsSync(target)) fs.copyFileSync(dbFile(), target);
  const old = fs.readdirSync(backupDir()).filter((f) => f.endsWith('.db')).sort().slice(0, -BACKUPS_KEPT);
  old.forEach((f) => fs.rmSync(path.join(backupDir(), f), { force: true }));
}

ipcMain.handle('file:save', async (_e, name, data, isString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('documents'), name),
  });
  if (canceled || !filePath) return;
  let bytes;
  if (isString) {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    bytes = Buffer.from(base64, 'base64');
  } else {
    bytes = Buffer.from(data);
  }
  fs.writeFileSync(filePath, bytes);
  shell.showItemInFolder(filePath);
});

/* ---------- licence ---------- */

ipcMain.handle('licence:status', () => licence.status());
ipcMain.handle('licence:activate', async (_e, key) => {
  try {
    const result = await licence.activate(key);
    if (result.mode === 'licensed') setTimeout(openApp, 1200);
    return result;
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('licence:continue', () => {
  if (licence.status().mode !== 'expired') openApp();
});
ipcMain.handle('open:pricing', () => shell.openExternal(`${SITE}/pricing.html`));
ipcMain.handle('open:whatsapp', () => shell.openExternal('https://wa.me/27820829050'));

function gateQuery() {
  const query = pendingKey ? { key: pendingKey } : {};
  pendingKey = null;
  return { query };
}

function showGate() {
  if (gateWindow) {
    if (pendingKey) gateWindow.loadFile(path.join(__dirname, 'gate.html'), gateQuery());
    gateWindow.focus();
    return;
  }
  gateWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    title: 'Setwel Biz Suite',
    backgroundColor: '#ffffff',
    webPreferences: { preload: path.join(__dirname, 'gate-preload.js') },
  });
  gateWindow.setMenu(null);
  gateWindow.loadFile(path.join(__dirname, 'gate.html'), gateQuery());
  gateWindow.on('closed', () => {
    gateWindow = null;
    if (!mainWindow) app.quit();
  });
}

function closeGate() {
  if (!gateWindow) return;
  const g = gateWindow;
  gateWindow = null;
  g.destroy();
}

function openApp() {
  if (mainWindow) {
    closeGate();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Setwel Biz Suite',
    backgroundColor: '#0D1B2A',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  mainWindow.loadURL('app://setwel/index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  closeGate();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open backups folder', click: () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); } },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Licence',
      submenu: [
        { label: 'Enter licence key…', click: showGate },
        { label: 'Buy or upgrade', click: () => shell.openExternal(`${SITE}/pricing.html`) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Help on WhatsApp', click: () => shell.openExternal('https://wa.me/27820829050') },
        { label: 'setwelbusiness.co.za', click: () => shell.openExternal(SITE) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- setwel://activate?key=... links ---------- */

function handleLink(url) {
  try {
    const u = new URL(url);
    const key = u.searchParams.get('key');
    if (!key) return;
    pendingKey = key;
    if (app.isReady()) showGate();
  } catch {
    // not a link we understand
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleLink(url);
});

app.on('second-instance', (_e, argv) => {
  const link = argv.find((a) => a.startsWith('setwel://'));
  if (link) handleLink(link);
  else if (mainWindow) mainWindow.focus();
});

const firstLink = process.argv.find((a) => a.startsWith('setwel://'));
if (firstLink) handleLink(firstLink);

/* ---------- start ---------- */

app.whenReady().then(async () => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(pathname)));
    const safe = file.startsWith(WEB_ROOT) && fs.existsSync(file) && fs.statSync(file).isFile();
    return net.fetch(pathToFileURL(safe ? file : path.join(WEB_ROOT, 'index.html')).toString());
  });

  licence.init(app.getPath('userData'));
  buildMenu();

  // Only wait for the network when a renewal check could unlock the app; otherwise refresh in the background.
  let s = licence.status();
  if (s.mode === 'expired') s = await licence.refresh();
  else licence.refresh();
  const nearEnd = s.mode === 'trial' && s.daysLeft <= 7;
  if (pendingKey || s.mode === 'expired' || nearEnd) showGate();
  else openApp();
});

app.on('window-all-closed', () => {
  app.quit();
});
