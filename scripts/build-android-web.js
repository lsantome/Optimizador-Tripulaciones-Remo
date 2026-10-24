#!/usr/bin/env node
// Prepara los archivos web que se empaquetan dentro del APK (Capacitor, webDir = dist/app).
// Parte del sitio PWA (dist/site, que genera build-pwa.js en este mismo proceso) y quita lo que no pinta nada en el
// APK: el service worker (en la app nativa los archivos viajan dentro del APK y se actualizan con él), los ejemplos
// y la versión autónoma. Se conservan las licencias de SheetJS e IBM Plex (se redistribuyen dentro del APK).
// Uso: npm run build:android-web
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

require('./build-pwa.js');

const origen = path.join(raiz, 'dist', 'site');
const destino = path.join(raiz, 'dist', 'app');
const EXCLUIR = [/^sw\.js$/, /^examples(\/|$)/, /^optimizador-tripulaciones-remo\.html$/];

fs.rmSync(destino, { recursive: true, force: true });
let n = 0;
(function copiar(dir) {
  for (const e of fs.readdirSync(path.join(origen, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (EXCLUIR.some(r => r.test(rel))) continue;
    if (e.isDirectory()) { copiar(rel); continue; }
    const dst = path.join(destino, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(origen, rel), dst);
    n++;
  }
})('');
if (!fs.existsSync(path.join(destino, 'index.html'))) throw new Error('dist/app sin index.html');
const idx = fs.readFileSync(path.join(destino, 'index.html'), 'utf8');
if (!/<script id="buildInfo" type="application\/json">\{"version":"[0-9a-f]{10}"/.test(idx)) throw new Error('index.html del APK sin versión estampada');
console.log('OK: dist/app (' + n + ' archivos para el APK)');
