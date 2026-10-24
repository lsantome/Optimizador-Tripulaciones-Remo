#!/usr/bin/env node
// Comprobaciones del sitio generado (dist/site) que se ejecutan en CI después de `npm run build:pwa` y antes de desplegar:
// ficheros requeridos, sintaxis (node --check de scripts y service worker, y del script inline de la página), manifest válido
// y versión sellada (ni 'dev' ni vacía; el commit del pie coincide con el de CI). Falla con código 1 y la lista de problemas.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const raiz = path.join(__dirname, '..');
const sitio = (...p) => path.join(raiz, 'dist', 'site', ...p);
const problemas = [];
const falla = (m) => problemas.push(m);

// 1) Ficheros requeridos
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'optimizador-tripulaciones-remo.html', 'vendor/xlsx.full.min.js', 'vendor/fonts/ibm-plex.css']) {
  if (!fs.existsSync(sitio(f))) falla('falta dist/site/' + f);
}
if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }

// 2) Sintaxis
const node = (f) => { try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { falla('node --check falla en ' + path.relative(raiz, f) + ': ' + String(e.stderr || e.message).split('\n')[0]); } };
node(sitio('sw.js'));
fs.readdirSync(path.join(raiz, 'scripts')).filter(f => f.endsWith('.js')).forEach(f => node(path.join(raiz, 'scripts', f)));
const html = fs.readFileSync(sitio('index.html'), 'utf8');
const mayor = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
try { new Function(mayor); } catch (e) { falla('el script inline de index.html no compila: ' + e.message); }

// 3) Manifest
let m = {};
try { m = JSON.parse(fs.readFileSync(sitio('manifest.webmanifest'), 'utf8')); } catch (e) { falla('manifest.webmanifest no es JSON válido'); }
for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'background_color', 'theme_color']) if (!m[k]) falla('manifest sin ' + k);
for (const ic of (m.icons || [])) if (!fs.existsSync(sitio(ic.src))) falla('el manifest declara un icono que no existe en dist/site: ' + ic.src);

// 4) Versión sellada y precaché completo
const sw = fs.readFileSync(sitio('sw.js'), 'utf8');
const v = /const VERSION = '([^']*)';/.exec(sw);
if (!v || !/^[0-9a-f]{10}$/.test(v[1])) falla('sw.js sin versión sellada (VERSION = ' + (v && v[1]) + ')');
const pre = /const PRECACHE = (\[.*\]);/.exec(sw);
const lista = pre ? JSON.parse(pre[1]) : [];
if (!lista.length) falla('sw.js sin lista de precaché');
for (const u of lista) if (u !== './' && !fs.existsSync(sitio(u))) falla('precaché apunta a un archivo inexistente: ' + u);
const bi = /<script id="buildInfo" type="application\/json">(.*?)<\/script>/.exec(html);
const info = bi ? JSON.parse(bi[1]) : {};
if (!info.version || info.version === 'dev') falla('index.html sin versión sellada');
else if (v && info.version !== v[1]) falla('la versión de index.html (' + info.version + ') no coincide con la de sw.js (' + v[1] + ')');
if (!info.commit) falla('index.html sin commit sellado');
if (process.env.GITHUB_SHA && info.commit !== process.env.GITHUB_SHA.slice(0, 7)) falla('el commit sellado (' + info.commit + ') no es el de CI (' + process.env.GITHUB_SHA.slice(0, 7) + ')');
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
if (info.pkg !== pkg.version) falla('la versión sellada (' + info.pkg + ') no coincide con package.json (' + pkg.version + ')');

if (problemas.length) { console.error('check-site: ' + problemas.length + ' problema(s)\n - ' + problemas.join('\n - ')); process.exit(1); }
console.log('OK: dist/site v' + info.pkg + ' · build ' + info.commit + ' · caché oar-' + info.version + ' (' + lista.length + ' URLs precacheadas)');
