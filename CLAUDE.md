# Instrucciones para Claude Code en este repositorio

Responde siempre en español. Aplica además el estándar de repositorios del propietario (fases 0–5; no te saltes ninguna).

## Qué es

Optimizador de alineación de remo (trainera, trainerilla, batel): una sola página `index.html` que se publica como PWA en GitHub Pages (`https://lsantome.github.io/Optimizador-Tripulaciones-Remo/`) y se empaqueta como APK/AAB con Capacitor (`android/`). No hay servidor ni peticiones de red.

## Comandos

```bash
npm ci
npm test                 # harness (lógica) + pwa + android + estandar
npm run build:pwa        # dist/site (lo que publica Pages) y dist/optimizador-tripulaciones-remo.html
npm run check:site       # valida dist/site
npm run build:android-web && npx cap sync android
npm run android:debug    # APK de depuración (JDK 21 + SDK Android)
npm run android:release  # APK + AAB; firmados solo con variables ANDROID_KEYSTORE_* / android/keystore.properties
```

## Estructura

- `index.html`: todo el código propio (HTML + CSS + JS en una IIFE). `vendor/`: terceros sin tocar. Debe quedarse en la raíz.
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA. Los bloques `<!-- PWA:START/END -->` se quitan de la versión autónoma.
- `scripts/`: `version.js` (identidad: hash de contenido, commit, fecha), `build-*.js`, `check-site.js`, `gradle.js`, `android-assets.py`.
- `tests/`: `harness.js`, `pwa.js`, `android.js`, `estandar.js`.
- `.github/workflows/`: `pages.yml` (CI + despliegue solo desde `main`) y `android.yml` (APK/AAB y Release).
- `docs/`: `GUIA_DE_USO.md`, `MODELO.md`, `ANDROID.md`.

## Reglas que no se rompen

- **No toques la lógica ni la interfaz** salvo lo que el usuario haya aprobado. Reglas de dominio: el patrón nunca usa potencia; el proel (solo trainera) no cuenta en bandas; la trainera da los mismos resultados que antes de la multiembarcación.
- **Secretos:** nunca pidas, escribas ni muestres contraseñas, claves ni el contenido de un keystore; los carga el usuario en GitHub. No versiones `*.keystore`, `*.jks`, `keystore.properties`.
- **Git:** no hagas push directo a `main` (despliega Pages) ni reescribas el historial (nada de `push --force`, `filter-repo` ni rebase de ramas publicadas). Trabaja en rama, commits atómicos en español con formato `tipo: resumen`, y propón el PR sin fusionarlo salvo orden expresa.
- **No actives Pages ni toques secretos** (pasos manuales del usuario). No borres nada del PC del usuario.
- **Identidad que no cambia:** `id` del manifest (`optimizador-alineacion-remo`), `applicationId` (`io.github.lsantome.tripulacionesremo`) y el nombre del repositorio.
- **Almacenamiento:** claves con prefijo `optimizador:` (lee `trainera:` solo para migrar, sin borrarlo). El service worker solo borra cachés `oar-*`.
- **Versión:** `package.json` es la fuente de verdad; debe coincidir con la primera entrada de `CHANGELOG.md` y con la etiqueta `vX.Y.Z`. El pie (`@build`) lo estampan los scripts: no se edita a mano.
- **Informes:** distingue *Verificado (ejecutado)* de *Pendiente de verificar por el usuario*; no afirmes que algo funciona sin haberlo ejecutado. El APK no se ha probado en dispositivo salvo que el usuario lo confirme.
