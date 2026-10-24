// Pruebas del empaquetado Android (Capacitor): configuración coherente, recursos, contenido del APK y permisos.
// No compilan el APK (eso lo hace .github/workflows/android.yml; la compilación real se verifica a mano); comprueban lo que se rompe con facilidad al tocar el proyecto.
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const raiz = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
let n = 0;
const ok = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };

const cfg = JSON.parse(leer('capacitor.config.json'));
const pkg = JSON.parse(leer('package.json'));

ok('capacitor.config.json: appId válido, webDir = dist/app y esquema https', () => {
  assert.ok(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(cfg.appId), 'appId no es un nombre de paquete Java válido: ' + cfg.appId);
  assert.strictEqual(cfg.webDir, 'dist/app');
  assert.strictEqual(cfg.server.androidScheme, 'https', 'con https el origen es https://localhost (localStorage y APIs seguras)');
  assert.ok(!cfg.server.url, 'server.url cargaría la web remota en lugar de los archivos del APK');
});

ok('android: appId coherente en build.gradle, strings.xml y versión tomada de package.json', () => {
  const g = leer('android', 'app', 'build.gradle');
  assert.ok(g.includes('namespace = "' + cfg.appId + '"') && g.includes('applicationId "' + cfg.appId + '"'), 'appId distinto en build.gradle');
  assert.ok(/file\('\.\.\/\.\.\/package\.json'\)/.test(g) && /versionName paquete\.version/.test(g), 'la versión del APK debe salir de package.json');
  const v = pkg.version.split('.').map(Number);
  assert.ok(v.length === 3 && v.every(Number.isInteger), 'package.json: la versión debe ser MAYOR.MENOR.PARCHE para derivar versionCode');
  const s = leer('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  assert.ok(s.includes('<string name="app_name">' + cfg.appName + '</string>'));
});

ok('android: solo el permiso INTERNET (la app no pide cámara, almacenamiento, ubicación…)', () => {
  const m = leer('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const permisos = [...m.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(x => x[1]);
  assert.deepStrictEqual(permisos, ['android.permission.INTERNET']);
});

ok('android: la firma de release solo se lee de variables de entorno o keystore.properties (sin contraseñas en el repositorio)', () => {
  const g = leer('android', 'app', 'build.gradle');
  for (const v of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) assert.ok(g.includes("'" + v + "'"), 'build.gradle no lee ' + v);
  assert.ok(g.includes("rootProject.file('keystore.properties')"), 'build.gradle no contempla keystore.properties');
  // ninguna contraseña ni ruta de keystore escrita a mano: las asignaciones deben ser variables, no literales
  for (const m of g.matchAll(/^\s*(storePassword|keyPassword|keyAlias|storeFile)\b\s*[=(]?\s*(['"][^'"]*['"])/gm)) assert.fail('literal en build.gradle: ' + m[0].trim());
  assert.ok(/if \(hayFirma\) signingConfig signingConfigs\.release/.test(g), 'sin variables de firma la release debe quedar sin firmar');
});

function dimsPng(f) { const b = fs.readFileSync(path.join(raiz, f)); assert.strictEqual(b.slice(1, 4).toString(), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
ok('android: iconos por densidad con el tamaño correcto y fondo adaptativo del color de la app', () => {
  const res = 'android/app/src/main/res/';
  const clasico = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }, capa = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const d of Object.keys(clasico)) {
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png']) assert.deepStrictEqual(dimsPng(res + 'mipmap-' + d + '/' + f), [clasico[d], clasico[d]], d + '/' + f);
    assert.deepStrictEqual(dimsPng(res + 'mipmap-' + d + '/ic_launcher_foreground.png'), [capa[d], capa[d]], d + ' foreground');
  }
  assert.ok(/#0E1B24/i.test(leer('android/app/src/main/res/values/ic_launcher_background.xml')));
  assert.ok(!fs.existsSync(path.join(raiz, res, 'drawable-v24', 'ic_launcher_foreground.xml')), 'la capa vectorial de plantilla taparía el icono propio');
});

// capacitor.plugins.json lo genera `cap sync` (Git lo ignora): en un clon limpio o en CI hay que generarlo para comprobar el registro
cp.execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build-android-web.js')], { stdio: 'pipe' });
cp.execFileSync(process.execPath, [path.join(raiz, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], { stdio: 'pipe', cwd: raiz });

ok('plugins: Filesystem y Share instalados y registrados (el guardado de Excel los necesita)', () => {
  for (const p of ['@capacitor/core', '@capacitor/android', '@capacitor/cli', '@capacitor/filesystem', '@capacitor/share']) assert.ok(pkg.devDependencies[p], 'falta ' + p);
  const reg = JSON.parse(leer('android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json')).map(x => x.pkg);
  assert.ok(reg.includes('@capacitor/filesystem') && reg.includes('@capacitor/share'), 'capacitor.plugins.json sin Filesystem/Share: ejecuta npm run android:sync');
  assert.ok(fs.existsSync(path.join(raiz, 'package-lock.json')), 'sin package-lock.json el workflow (npm ci) no es reproducible');
});

cp.execFileSync('node', [path.join(raiz, 'scripts', 'build-android-web.js')], { stdio: 'pipe' });
const app = (...p) => path.join(raiz, 'dist', 'app', ...p);

ok('build:android-web: contenido del APK (sin service worker, sin ejemplos, con licencias y versión estampada)', () => {
  assert.ok(fs.existsSync(app('index.html')) && fs.existsSync(app('vendor', 'xlsx.full.min.js')));
  assert.ok(!fs.existsSync(app('sw.js')), 'el APK no debe llevar service worker');
  assert.ok(!fs.existsSync(app('examples')) && !fs.existsSync(app('optimizador-tripulaciones-remo.html')));
  assert.ok(fs.existsSync(app('vendor', 'LICENSE-sheetjs.txt')) && fs.existsSync(app('vendor', 'fonts', 'LICENSE-IBM-Plex-OFL.txt')), 'licencias de terceros');
  const html = fs.readFileSync(app('index.html'), 'utf8');
  const info = JSON.parse(/<script id="buildInfo" type="application\/json">(.*?)<\/script>/.exec(html)[1]);
  assert.ok(/^[0-9a-f]{10}$/.test(info.version) && info.pkg === pkg.version);
  assert.ok(html.includes('isNativePlatform'), 'index.html debe detectar la app nativa para no registrar el service worker');
  assert.ok(!/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/i.test(html), 'referencias externas en la app');
});

console.log('Android: ' + n + ' pruebas OK');
