# Contribuir a Optimizador de alineación de remo

## Flujo de trabajo

- **`main` despliega GitHub Pages: no se trabaja sobre ella.** Crea una rama (`feat/…`, `fix/…`, `docs/…`, `chore/…`), abre un pull request y espera a que `pages.yml` pase en verde.
- Commits pequeños y atómicos, en español, con el formato `tipo: resumen` (`feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`). No se reescribe el historial publicado.
- Cada cambio visible para el usuario se anota en `CHANGELOG.md` (formato Keep a Changelog) y, si es una versión nueva, se sube `version` en `package.json`: debe coincidir con la última entrada del changelog (lo comprueba `npm test`) y con la etiqueta `vX.Y.Z`.
- Nunca se suben contraseñas, keystores ni `keystore.properties`. Los secretos de firma viven solo en *Settings → Secrets* de GitHub.

## Código

- Todo el código propio vive en `index.html` (el build solo empaqueta), en la raíz del repositorio. Los bloques entre `<!-- PWA:START -->` y `<!-- PWA:END -->` se eliminan en la versión autónoma: no metas ahí nada que la app necesite para funcionar. Mantén el JS en la IIFE y el estilo existente.
- La versión que muestra el pie (`v<paquete> · build <commit> · <fecha>`) la estampan los scripts de build en la línea `buildInfo` de `index.html` (marcada con `@build`): no la edites a mano ni cambies ese marcador sin actualizar `scripts/version.js` y `tests/pwa.js`. La caché del service worker (`oar-<hash>`) usa un hash del contenido, no el commit.
- Las claves de almacenamiento llevan el prefijo `optimizador:` (`PREFIJO_LS`); `trainera:` solo se lee para migrar. Nunca borres claves ajenas ni las antiguas.
- El service worker solo puede borrar cachés con su prefijo `oar-`: `https://lsantome.github.io` lo comparten otras apps.
- Android: `index.html` es también la única fuente web del APK (`npm run build:android-web` → `dist/app`). Lo que dependa del navegador (descargas, `<a download>`, `window.open`) no funciona igual en el WebView de Capacitor: ver `guardarXlsx` y [docs/ANDROID.md](docs/ANDROID.md).
- Cambios de física (pesos, GML, penalizaciones): explica el porqué en el PR y actualiza `docs/MODELO.md`.
- Reglas de dominio que no deben romperse: el patrón nunca usa potencia; el proel (solo trainera) no cuenta en bandas; la trainera debe dar los mismos resultados que antes de la multiembarcación.
- Las constantes de cada tipo de barco están en `TIPOS_BARCO` (`index.html`). Los datos de trainerilla y batel marcados como hipótesis se pueden sustituir por cotas reales.

## Antes de abrir un PR

```bash
npm ci
npm test               # lógica, PWA, Android y estándar del repositorio
npm run build:pwa && npm run check:site
```

Más una prueba manual de los dos modos y de importar/exportar Excel. Si tocas Android, `npm run android:debug` (necesita JDK 21 y el SDK).

## Issues

Usa las plantillas; adjunta captura y, si procede, el Excel (sin datos personales reales).
