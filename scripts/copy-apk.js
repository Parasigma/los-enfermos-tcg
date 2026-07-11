'use strict';
/* Copia la APK compilada a dist/ con su nombre de verdad. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'LOS ENFERMOS TCG.apk');

if (!fs.existsSync(SRC)) {
  console.error('No se encuentra la APK compilada:', SRC);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(SRC, OUT);
console.log('APK lista:', OUT, `(${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
