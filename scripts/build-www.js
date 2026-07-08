'use strict';
/* Copia la web del juego a www/ (lo que Capacitor empaqueta en la app).
   Solo lo necesario: nada de node_modules, electron ni dist. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www');

/* archivos de trabajo que no hacen falta en el juego (proyectos de After
   Effects, metadatos de exportación...): fuera del bundle y de la APK */
const SKIP = /\.(aep|xmp)$/i;
const SKIP_DIR = /_AME$/i;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIR.test(entry.name)) copyDir(s, d); }
    else if (!SKIP.test(entry.name)) fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
for (const dir of ['css', 'js', 'assets']) {
  copyDir(path.join(ROOT, dir), path.join(OUT, dir));
}
console.log('www/ preparado para Capacitor');
