#!/usr/bin/env node
// Genera el sitio publicable en GitHub Pages (PWA) en dist/site:
//   index.html, manifest.webmanifest, sw.js (con versión y lista de precaché), icons/, vendor/ (solo lo necesario),
//   examples/ y el HTML autónomo descargable (se genera en el mismo proceso con build-standalone).
// Uso: npm run build:pwa
// La versión de la caché es un hash del contenido de los archivos precacheados + sw.js: si nada cambia, no hay
// "versión nueva" para los usuarios; si cambia cualquier archivo, el service worker se actualiza solo.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const salida = path.join(raiz, 'dist', 'site');

// El HTML autónomo se genera en este mismo proceso para que ambos compartan hash y fecha de compilación
require('./build-standalone.js');
const { identidad, estampar } = require('./version.js');
const { lista: precache, info } = identidad();

fs.rmSync(salida, { recursive: true, force: true });
const copiar = (rel) => {
  const dst = path.join(salida, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(raiz, rel), dst);
};
precache.forEach(copiar);

// Descargables que no se precachean
fs.readdirSync(path.join(raiz, 'examples')).filter(f => f.endsWith('.xlsx')).forEach(f => copiar('examples/' + f));
['LICENSE', 'vendor/LICENSE-sheetjs.txt', 'vendor/fonts/LICENSE-IBM-Plex-OFL.txt'].forEach(f => { if (fs.existsSync(path.join(raiz, f))) copiar(f); });
fs.copyFileSync(path.join(raiz, 'dist', 'optimizador-tripulaciones-remo.html'), path.join(salida, 'optimizador-tripulaciones-remo.html'));

// index.html publicado: lleva la misma versión (hash) y fecha que el service worker, visibles en el pie de la app
const idx = path.join(salida, 'index.html');
fs.writeFileSync(idx, estampar(fs.readFileSync(idx, 'utf8'), info));

// Service worker con versión y lista de precaché
let sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
const version = info.version;
const lista = ['./'].concat(precache.map(f => './' + f)); // './' = raíz del sitio (la navegación a la carpeta)
const reVersion = /^const VERSION = .*\/\/ @build$/m, rePre = /^const PRECACHE = .*\/\/ @build$/m;
if (!reVersion.test(sw) || !rePre.test(sw)) throw new Error('sw.js: no se encuentran las líneas marcadas con @build');
sw = sw.replace(reVersion, "const VERSION = '" + version + "';")
       .replace(rePre, 'const PRECACHE = ' + JSON.stringify(lista) + ';');
fs.writeFileSync(path.join(salida, 'sw.js'), sw);

console.log('OK: dist/site (' + (precache.length + 1) + ' URLs precacheadas, versión ' + version + ', compilada ' + info.fecha + ')');
