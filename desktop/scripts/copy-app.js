// Copies the built Setwel app (../app) into ./web so it is packaged inside the installer.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'app');
const dest = path.join(__dirname, '..', 'web');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied app into', dest);
