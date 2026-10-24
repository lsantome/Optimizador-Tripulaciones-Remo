// Pruebas de la parte PWA: manifest, iconos, enlaces relativos (GitHub Pages sirve bajo /<repo>/), service worker
// generado por el build y ausencia de restos PWA en el HTML autónomo. Se ejecutan con: npm test
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const raiz = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p));
let n = 0;
const ok = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };

function dimsPng(f) { const b = leer(f); assert.strictEqual(b.slice(1, 4).toString(), 'PNG', f + ' no es PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

const m = JSON.parse(leer('manifest.webmanifest').toString('utf8'));

ok('manifest: campos obligatorios y rutas relativas', () => {
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'background_color', 'theme_color']) assert.ok(m[k], 'falta ' + k);
  assert.strictEqual(m.display, 'standalone');
  assert.ok(m.start_url.startsWith('.') && m.scope.startsWith('.'), 'start_url y scope deben ser relativos (subruta de Pages)');
  // Chrome resuelve `id` contra el ORIGEN de start_url (no contra su carpeta): "./" o "/" darían la raíz del dominio y
  // colisionarían con cualquier otra PWA de https://<usuario>.github.io. Debe ser un identificador propio de esta app.
  const idResuelto = new URL(m.id, new URL(m.start_url, 'https://usuario.github.io/Optimizador-Tripulaciones-Remo/').origin);
  assert.ok(idResuelto.pathname !== '/' && idResuelto.pathname.length > 1, 'manifest.id resuelve a la raíz del origen (' + idResuelto.href + '): colisiona con otras PWA del mismo dominio');
  // El id es la identidad de la app, NO el nombre del repositorio: se mantiene aunque el repo se renombre (Optimizador-Tripulaciones-Remo)
  assert.ok(idResuelto.pathname.includes('optimizador-alineacion-remo'), 'manifest.id debe ser único para esta app y estable');
  assert.ok(m.short_name.length <= 12, 'short_name demasiado largo para el icono');
  const textos = JSON.stringify(m);
  assert.ok(!/"\/[^"]/.test(textos), 'rutas absolutas con "/" inicial romperían el despliegue bajo /<repo>/');
});

ok('manifest: iconos existen, con el tamaño declarado, y hay 192, 512 y maskable', () => {
  let tiene192 = false, tiene512 = false, maskable = false;
  for (const ic of m.icons) {
    assert.ok(fs.existsSync(path.join(raiz, ic.src)), 'no existe ' + ic.src);
    if (ic.type === 'image/png') {
      const [w, h] = dimsPng(ic.src);
      assert.strictEqual(ic.sizes, w + 'x' + h, ic.src + ' declara ' + ic.sizes + ' pero mide ' + w + 'x' + h);
      if (w === 192 && ic.purpose === 'any') tiene192 = true;
      if (w === 512 && ic.purpose === 'any') tiene512 = true;
      if (ic.purpose === 'maskable') maskable = true;
    }
  }
  assert.ok(tiene192 && tiene512 && maskable, 'faltan iconos 192/512/maskable');
  assert.deepStrictEqual(dimsPng('icons/apple-touch-icon.png'), [180, 180]);
});

ok('index.html: enlaza manifest e iconos con rutas relativas y marca los bloques PWA', () => {
  const html = leer('index.html').toString('utf8');
  assert.strictEqual((html.match(/<!-- PWA:START -->/g) || []).length, 2);
  assert.strictEqual((html.match(/<!-- PWA:END -->/g) || []).length, 2);
  assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'));
  assert.ok(html.includes("register('sw.js')"), 'el registro debe usar ruta relativa');
  for (const bloque of html.match(/<!-- PWA:START -->[\s\S]*?<!-- PWA:END -->/g)) {
    assert.ok(!/(?:src|href)=["']\//.test(bloque), 'ruta absoluta en bloque PWA');
  }
});

ok('sw.js fuente: modo desarrollo (sin caché) y líneas @build presentes', () => {
  const sw = leer('sw.js').toString('utf8');
  assert.ok(/^const VERSION = 'dev'; \/\/ @build$/m.test(sw));
  assert.ok(/^const PRECACHE = \[\];\s+\/\/ @build$/m.test(sw));
  new Function(sw.replace(/self\./g, 'globalThis.')); // sintaxis válida
});

ok('index.html fuente: línea buildInfo en modo dev, marcada con @build, y pie que la muestra', () => {
  const html = leer('index.html').toString('utf8');
  assert.strictEqual((html.match(/<script id="buildInfo" type="application\/json">.*<\/script> <!-- @build -->/g) || []).length, 1);
  assert.ok(html.includes('id="versionApp"'), 'falta el elemento del pie donde se muestra la versión');
  assert.ok(html.includes('mostrarVersion();'), 'mostrarVersion() no se invoca en el arranque');
});

// Construir de verdad (autónomo + sitio) y comprobar el resultado
cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-standalone.js')], { stdio: 'pipe' });
cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' });
const sitio = (...p) => path.join(raiz, 'dist', 'site', ...p);
const leerBuildInfoFuente = () => /<script id="buildInfo" type="application\/json">(.*?)<\/script>/.exec(leer('index.html').toString('utf8'))[1];

ok('build-pwa: sw.js con versión y precaché; todo lo precacheado existe en dist/site', () => {
  const sw = fs.readFileSync(sitio('sw.js'), 'utf8');
  const v = /const VERSION = '([0-9a-f]{10})';/.exec(sw);
  assert.ok(v, 'versión sin sustituir');
  const lista = JSON.parse(/const PRECACHE = (\[.*\]);/.exec(sw)[1]);
  for (const u of ['./', './index.html', './manifest.webmanifest', './vendor/xlsx.full.min.js', './vendor/fonts/ibm-plex.css']) assert.ok(lista.includes(u), 'falta en precaché ' + u);
  assert.strictEqual(lista.filter(u => u.endsWith('.woff2')).length, 8, 'deben precachearse las 8 fuentes');
  for (const u of lista) if (u !== './') assert.ok(fs.existsSync(sitio(u)), 'no existe ' + u);
  for (const ic of m.icons) assert.ok(lista.includes('./' + ic.src), 'icono sin precachear: ' + ic.src);
});

ok('build-pwa: determinista (mismo contenido → misma versión) y sensible a cambios', () => {
  const v1 = /VERSION = '([0-9a-f]{10})'/.exec(fs.readFileSync(sitio('sw.js'), 'utf8'))[1];
  cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' });
  const v2 = /VERSION = '([0-9a-f]{10})'/.exec(fs.readFileSync(sitio('sw.js'), 'utf8'))[1];
  assert.strictEqual(v1, v2);
  const idx = path.join(raiz, 'index.html'), orig = fs.readFileSync(idx);
  try {
    fs.writeFileSync(idx, Buffer.concat([orig, Buffer.from('\n<!-- cambio de prueba -->\n')]));
    cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' });
    const v3 = /VERSION = '([0-9a-f]{10})'/.exec(fs.readFileSync(sitio('sw.js'), 'utf8'))[1];
    assert.notStrictEqual(v1, v3, 'un cambio en index.html debe cambiar la versión de la caché');
  } finally { fs.writeFileSync(idx, orig); cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' }); }
});

ok('build: el mismo hash y fecha en el pie de la PWA, en el autónomo y en el service worker', () => {
  const info = (f) => JSON.parse(/<script id="buildInfo" type="application\/json">(.*?)<\/script>/.exec(fs.readFileSync(f, 'utf8'))[1]);
  const pwa = info(sitio('index.html')), solo = info(path.join(raiz, 'dist', 'optimizador-tripulaciones-remo.html'));
  const swv = /VERSION = '([0-9a-f]{10})'/.exec(fs.readFileSync(sitio('sw.js'), 'utf8'))[1];
  assert.strictEqual(pwa.version, swv, 'el hash mostrado debe ser el de la caché del service worker');
  assert.deepStrictEqual(pwa, solo, 'PWA y autónomo deben llevar la misma identidad');
  assert.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/.test(pwa.fecha) && !isNaN(new Date(pwa.fecha)), 'fecha ISO inválida: ' + pwa.fecha);
  assert.strictEqual(pwa.pkg, JSON.parse(leer('package.json').toString('utf8')).version);
  assert.ok(/^[0-9a-f]{7}\+?$|^local$/.test(pwa.commit), 'commit del build inválido: ' + pwa.commit);
  // la fecha no entra en el hash: SOURCE_DATE_EPOCH distinto → misma versión, distinta fecha
  cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe', env: Object.assign({}, process.env, { SOURCE_DATE_EPOCH: '1700000000' }) });
  const otra = info(sitio('index.html'));
  assert.strictEqual(otra.version, pwa.version, 'la fecha no debe alterar la versión');
  assert.strictEqual(otra.fecha, '2023-11-14T22:13:00.000Z');
  // el commit tampoco entra en el hash (un commit de documentación no debe forzar «versión nueva»)
  cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe', env: Object.assign({}, process.env, { BUILD_COMMIT: 'ABCDEF0123456789' }) });
  const otroCommit = info(sitio('index.html'));
  assert.strictEqual(otroCommit.commit, 'abcdef0', 'BUILD_COMMIT debe fijar el commit (7 caracteres)');
  assert.strictEqual(otroCommit.version, pwa.version, 'el commit no debe alterar la versión de la caché');
  cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' });
});

ok('pie: «v<paquete> · build <commit> · AAAA-MM-DD» (y «desarrollo» sin compilar)', () => {
  const html = fs.readFileSync(sitio('index.html'), 'utf8');
  const fn = /function mostrarVersion\(\)\{[\s\S]*?\n\}\n/.exec(html)[0];
  const ejecutar = (buildInfo) => {
    const el = { textContent: '', title: '' };
    new Function('document', fn + '; mostrarVersion();')({ getElementById: (id) => id === 'versionApp' ? el : { textContent: buildInfo } });
    return el;
  };
  const e = ejecutar(JSON.stringify({ version: '0123456789', commit: 'abc1234', fecha: '2026-10-24T12:00:00.000Z', pkg: '1.4.0' }));
  assert.ok(/^v1\.4\.0 · build abc1234 · 2026-10-2[45]$/.test(e.textContent), e.textContent);
  assert.ok(e.title.includes('0123456789'), 'el tooltip debe incluir el código de la caché');
  assert.strictEqual(ejecutar(leerBuildInfoFuente()).textContent, 'desarrollo');
});

ok('HTML autónomo: sin restos de PWA ni referencias externas', () => {
  const h = fs.readFileSync(path.join(raiz, 'dist', 'optimizador-tripulaciones-remo.html'), 'utf8');
  assert.ok(!/PWA:|manifest\.webmanifest|serviceWorker|apple-touch-icon/.test(h));
  assert.ok(fs.existsSync(sitio('optimizador-tripulaciones-remo.html')), 'el autónomo debe publicarse junto al sitio');
});

console.log('PWA: ' + n + ' pruebas OK');
