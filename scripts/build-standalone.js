#!/usr/bin/env node
// Genera un único HTML autónomo (sin dependencias externas ni carpetas adicionales):
// incrusta SheetJS (vendor/xlsx.full.min.js) y las fuentes IBM Plex (vendor/fonts, en base64) dentro de index.html.
// Uso: npm run build  →  dist/optimizador-tripulaciones-remo.html
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const { identidad, estampar } = require('./version.js');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p));

let html = leer('index.html').toString('utf8');

// 0a) Versión (hash) y fecha de compilación, idénticas a las de la PWA para el mismo código
html = estampar(html, identidad().info);

// 0) La versión autónoma no es una PWA (se abre desde file://): se eliminan los bloques marcados con PWA:START/PWA:END
html = html.replace(/<!-- PWA:START -->[\s\S]*?<!-- PWA:END -->\n?/g, '');
if (/PWA:|manifest\.webmanifest|serviceWorker/.test(html)) throw new Error('Quedan restos de PWA en la versión autónoma');

// 1) Fuentes: <link rel="stylesheet" href="vendor/fonts/ibm-plex.css"> → <style> con @font-face en base64
const enlace = '<link rel="stylesheet" href="vendor/fonts/ibm-plex.css">';
if (!html.includes(enlace)) throw new Error('No se encontró el <link> de fuentes en index.html');
const css = leer('vendor', 'fonts', 'ibm-plex.css').toString('utf8').replace(/url\('([^']+\.woff2)'\)/g, (m, f) => {
  const b64 = leer('vendor', 'fonts', f).toString('base64');
  return "url('data:font/woff2;base64," + b64 + "')";
});
if (/url\('(?!data:)/.test(css)) throw new Error('Quedan fuentes sin incrustar');
html = html.replace(enlace, () => '<style>\n' + css + '</style>');

// 2) SheetJS: <script src="vendor/xlsx.full.min.js"></script> → script en línea
const etiqueta = '<script src="vendor/xlsx.full.min.js"></script>';
if (!html.includes(etiqueta)) throw new Error('No se encontró el <script> de SheetJS en index.html');
const xlsx = leer('vendor', 'xlsx.full.min.js').toString('utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(etiqueta, () => '<script>\n' + xlsx + '\n</script>');

// 3) Comprobación: ninguna referencia externa en el resultado
const externas = html.match(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi) || [];
const locales = html.match(/(?:src|href)\s*=\s*["']vendor\/[^"']+/gi) || [];
if (externas.length || locales.length) throw new Error('Referencias externas o locales sin incrustar: ' + externas.concat(locales).join(', '));

const pkg = JSON.parse(leer('package.json').toString('utf8'));
html = html.replace('<head>', '<head>\n<!-- Versión autónoma ' + pkg.version + ' generada con scripts/build-standalone.js: incluye SheetJS 0.18.5 e IBM Plex. -->');

const salida = path.join(raiz, 'dist', 'optimizador-tripulaciones-remo.html');
fs.mkdirSync(path.dirname(salida), {recursive: true});
fs.writeFileSync(salida, html);
console.log('OK:', path.relative(raiz, salida), (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MB');
