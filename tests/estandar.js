// Pruebas del estándar de repositorios (comunes a todas las apps): sintaxis, service worker, claves de almacenamiento,
// scripts de package.json, ausencia de secretos y coherencia de los workflows. Se ejecutan con: npm test
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process'), vm = require('vm');
const raiz = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
let n = 0;
const pendientes = [];
const ok = (nombre, fn) => {
  const listo = () => { n++; console.log('  ok  ' + nombre); };
  const r = fn();
  if (r && typeof r.then === 'function') pendientes.push(r.then(listo)); else listo();
};
const pkg = JSON.parse(leer('package.json'));

ok('sintaxis: script inline de index.html y sw.js compilan', () => {
  const html = leer('index.html');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 2, 'no se encontraron los scripts inline');
  scripts.forEach((s, i) => { try { new Function(s); } catch (e) { assert.fail('script inline #' + (i + 1) + ': ' + e.message); } });
  cp.execFileSync(process.execPath, ['--check', path.join(raiz, 'sw.js')], { stdio: 'pipe' });
});

// El service worker construido se ejecuta con caches simuladas: solo debe borrar cachés con SU prefijo
if (!fs.existsSync(path.join(raiz, 'dist', 'site', 'sw.js'))) cp.execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build-pwa.js')], { stdio: 'pipe' });
ok('service worker: prefijo de caché propio y borrado solo de cachés propias', () => {
  const src = fs.readFileSync(path.join(raiz, 'dist', 'site', 'sw.js'), 'utf8');
  const version = /const VERSION = '([0-9a-f]{10})'/.exec(src)[1];
  const prefijo = /const PREFIJO = '([^']+)'/.exec(src)[1];
  assert.ok(/^[a-z0-9]+-$/.test(prefijo) && prefijo !== '-', 'prefijo de caché inválido: ' + prefijo);
  const borradas = [], oyentes = {};
  const existentes = [prefijo + 'viejo1', prefijo + 'viejo2', prefijo + version, 'crono-abc123', 'otra-app-9', 'workbox-precache-v2', prefijo.slice(0, -1) + 'x-ajena'];
  const self = { addEventListener: (t, f) => { oyentes[t] = f; }, clients: { claim: async () => {} }, location: { origin: 'https://x.github.io' }, skipWaiting() {} };
  const caches = { keys: async () => existentes.slice(), delete: async (k) => { borradas.push(k); return true; }, open: async () => ({ add: async () => {} }) };
  vm.runInNewContext(src, { self, caches, Request: function () {}, URL, fetch: async () => {} });
  let esperar; oyentes.activate({ waitUntil: (p) => { esperar = p; } });
  return esperar.then(() => {
    assert.deepStrictEqual(borradas.sort(), [prefijo + 'viejo1', prefijo + 'viejo2'].sort(), 'solo deben borrarse cachés antiguas con el prefijo propio; borró: ' + borradas);
  });
});

ok('almacenamiento: todo localStorage pasa por el prefijo propio (optimizador:)', () => {
  const html = leer('index.html');
  assert.ok(/const PREFIJO_LS = 'optimizador:';/.test(html), 'PREFIJO_LS debe ser optimizador:');
  const accesos = [...html.matchAll(/localStorage\.(getItem|setItem|removeItem)\(([^)]*)\)/g)];
  assert.ok(accesos.length >= 3, 'no se encontraron accesos a localStorage');
  for (const a of accesos) assert.ok(/^PREFIJO_LS(_ANTIGUO)? \+ clave/.test(a[2].trim()), 'acceso a localStorage sin prefijo: ' + a[0]);
  assert.ok(!/removeItem/.test(html), 'la migración no debe borrar claves antiguas (podrían ser de otra app)');
  assert.ok(!/sessionStorage|indexedDB/.test(html), 'sessionStorage/IndexedDB sin revisar prefijos');
});

ok('package.json: campos y scripts comunes del estándar', () => {
  assert.ok(pkg.name && /^\d+\.\d+\.\d+$/.test(pkg.version) && pkg.private === true && pkg.license === 'MIT');
  assert.ok(/>=\s*22/.test(pkg.engines.node), 'engines.node debe ser >= 22');
  for (const s of ['test', 'build:pwa', 'build:android-web', 'android:sync', 'android:debug', 'android:release']) assert.ok(pkg.scripts[s], 'falta el script ' + s);
  assert.ok(/bundleRelease/.test(pkg.scripts['android:release']) && /assembleRelease/.test(pkg.scripts['android:release']), 'android:release debe generar APK y AAB');
  assert.ok(/android:sync/.test(pkg.scripts['android:debug']) && /build:android-web/.test(pkg.scripts['android:sync']));
  for (const t of ['harness', 'pwa', 'android', 'estandar']) assert.ok(pkg.scripts.test.includes('tests/' + t + '.js'), 'npm test no ejecuta tests/' + t + '.js');
});

ok('seguridad: .gitignore cubre claves y binarios; nada peligroso versionado', () => {
  const gi = leer('.gitignore').split('\n').map(l => l.trim());
  for (const e of ['node_modules/', 'dist/', '*.keystore', '*.jks', '*.p12', 'keystore.properties', 'local.properties', '*.apk', '*.aab', '.gradle/', 'build/', '.idea/', '*.log', '.DS_Store']) assert.ok(gi.includes(e), '.gitignore sin ' + e);
  let tracked = null;
  try { tracked = cp.execFileSync('git', ['ls-files'], { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n'); } catch (e) { /* sin git (zip): se omite */ }
  if (tracked) {
    const malos = tracked.filter(f => /\.(keystore|jks|p12|apk|aab)$|keystore\.properties$|local\.properties$/i.test(f));
    assert.deepStrictEqual(malos, [], 'ficheros peligrosos versionados: ' + malos);
  }
});

ok('workflows: despliegue solo desde main; android.yml con comprobaciones, AAB y secretos', () => {
  const pages = leer('.github', 'workflows', 'pages.yml'), and = leer('.github', 'workflows', 'android.yml');
  assert.ok(/deploy:[\s\S]*?if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/.test(pages), 'el despliegue debe limitarse a main');
  assert.ok(/pull_request:/.test(pages) && /npm ci/.test(pages) && /npm test/.test(pages) && /build:pwa/.test(pages) && /check:site/.test(pages));
  assert.ok(!/contents: write/.test(pages), 'pages.yml no necesita permisos de escritura sobre el contenido');
  assert.ok(/tags: \['v\*'\]/.test(and) && /workflow_dispatch/.test(and));
  assert.ok(/package\.json/.test(and) && /GITHUB_REF_NAME/.test(and), 'android.yml debe comparar etiqueta y package.json');
  assert.ok(/git ls-files \| grep -Ei/.test(and), 'android.yml debe fallar si hay un keystore versionado');
  for (const s of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) assert.ok(and.includes('secrets.' + s), 'android.yml no usa el secreto ' + s);
  assert.ok(/RUNNER_TEMP/.test(and) && /android:release/.test(and) && /android:debug/.test(and) && /softprops\/action-gh-release/.test(and));
  assert.ok(!/(ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_PASSWORD|KS_PASS|KEY_PASS)\s*[:=]\s*['"]?[A-Za-z0-9]{4,}['"]?\s*$/m.test(and.replace(/\$\{\{[^}]*\}\}/g, '')), 'posible contraseña escrita en android.yml');
});

ok('check-site: detecta una versión sin sellar y un commit que no es el de CI', () => {
  const correr = (env) => { try { cp.execFileSync(process.execPath, [path.join(raiz, 'scripts', 'check-site.js')], { stdio: 'pipe', env: Object.assign({}, process.env, env) }); return 0; } catch (e) { return e.status; } };
  assert.strictEqual(correr({}), 0, 'el sitio recién construido debe pasar');
  assert.strictEqual(correr({ GITHUB_SHA: '1234567890abcdef' }), 1, 'un GITHUB_SHA distinto del sellado debe fallar');
  const idx = path.join(raiz, 'dist', 'site', 'index.html'), orig = fs.readFileSync(idx, 'utf8');
  try {
    fs.writeFileSync(idx, orig.replace(/"version":"[0-9a-f]{10}"/, '"version":"dev"'));
    assert.strictEqual(correr({}), 1, 'index.html sin versión sellada debe fallar');
  } finally { fs.writeFileSync(idx, orig); }
});

ok('documentación: la primera versión del CHANGELOG es la de package.json y los enlaces locales del README existen', () => {
  const cl = leer('CHANGELOG.md');
  const primera = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m.exec(cl);
  assert.ok(primera, 'CHANGELOG.md sin entradas "## [X.Y.Z] - AAAA-MM-DD"');
  assert.strictEqual(primera[1], pkg.version, 'CHANGELOG (' + primera[1] + ') y package.json (' + pkg.version + ') deben coincidir');
  for (const f of ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md', 'LICENSE', 'docs/ANDROID.md', 'docs/GUIA_DE_USO.md', 'docs/MODELO.md']) assert.ok(fs.existsSync(path.join(raiz, f)), 'falta ' + f);
  for (const m of leer('README.md').matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)) assert.ok(fs.existsSync(path.join(raiz, m[1])), 'enlace roto en README.md: ' + m[1]);
  assert.ok(leer('README.md').includes('https://lsantome.github.io/Optimizador-Tripulaciones-Remo/'), 'el README debe llevar la URL real de la app');
});

Promise.all(pendientes).then(() => console.log('Estándar: ' + n + ' pruebas OK'));
