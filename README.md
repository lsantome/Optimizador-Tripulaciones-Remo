# Optimizador de alineación de remo

Herramienta web (HTML sin servidor; también **PWA instalable y con modo offline**, y **app Android (APK)**) para **proponer y evaluar alineaciones de trainera, trainerilla y batel** según el reparto de pesos y, opcionalmente, de potencia.

> **App:** https://lsantome.github.io/Optimizador-Tripulaciones-Remo/ — instalable como aplicación y con modo sin conexión (ver [PWA](#pwa-instalable-y-sin-conexion)). Para Android hay un APK en las [Releases](https://github.com/lsantome/Optimizador-Tripulaciones-Remo/releases) (ver [Instalación](#instalación)).

## Qué hace

- **Multiembarcación:** trainera (13 remeros + patrón), trainerilla (6 + patrón) y batel (4 + patrón; ambos con **bancadas individuales sobre el eje**), con dimensiones y peso predefinidos y editables. Opcionalmente, un **maestro de barcos** importado desde Excel.

- **Vista básica y avanzada:** por defecto solo se muestra lo defendible (peso, potencia, bandas, desplazamiento del CG). El modo avanzado añade el asiento estimado, la dispersión de masas, el desequilibrio por W/kg y los pesos del optimizador, que son heurísticas sin validar. No cambia los resultados.

- **Modo automático:** optimizador (recocido simulado) que devuelve hasta **3 alineaciones** distintas.
  Prioridad seleccionable: *solo peso* (por defecto), *vatios absolutos* o *W/kg*.
- **Modo manual:** arrastra fichas a los puestos y mira las métricas en vivo.
- **Equilibrios** de peso, potencia absoluta y W/kg entre **babor/estribor** y **proa/popa**, con gráfico circular y tabla de cuadrantes.
- **Trimado** (momento respecto al centro) y **asiento longitudinal estimado** a partir de eslora, manga y calado.
- **Mapa de calor** opcional (peso o potencia) sobre el esquema del barco.
- **Importar/exportar Excel**; modo claro/oscuro.

Reglas de dominio: el **patrón nunca aporta potencia** y su peso no cuenta en el desequilibrio de bandas; el **proel** va sobre el eje, su peso no cuenta en bandas, pero su potencia se suma a babor (o estribor, configurable).

## Uso rápido

1. Abre en el navegador (doble clic) la **versión autónoma** `optimizador-tripulaciones-remo.html` (un solo archivo, sin dependencias ni carpetas), o `index.html` con su carpeta `vendor/`, o usa la versión de Pages.
2. *Configuración* → carga el ejemplo o importa tu Excel de tripulación ([`examples/plantilla_alineacion_remo.xlsx`](examples/plantilla_alineacion_remo.xlsx)). Opcional: importa tu maestro de barcos ([`examples/plantilla_barcos.xlsx`](examples/plantilla_barcos.xlsx)).
3. *Tripulación* → elige el **barco** (predefinido o del maestro) y ajusta sus dimensiones si hace falta → *Automático* → **Optimizar alineación**, o *Manual* para montarla a mano.

Guía completa: **[docs/GUIA_DE_USO.md](docs/GUIA_DE_USO.md)**. Modelo físico y límites: **[docs/MODELO.md](docs/MODELO.md)**.

## Instalación

- **PWA (recomendado):** abre https://lsantome.github.io/Optimizador-Tripulaciones-Remo/ y pulsa *Instalar* — Chrome/Edge: icono en la barra de direcciones; Android: menú → *Instalar aplicación*; iOS/Safari: Compartir → *Añadir a pantalla de inicio*. Tras la primera visita funciona sin conexión.
- **APK de Android:** descarga `Optimizador-Tripulaciones-Remo-v<versión>.apk` de la [última Release](https://github.com/lsantome/Optimizador-Tripulaciones-Remo/releases/latest), ábrelo en el móvil y permite «instalar apps desconocidas» a la app desde la que lo abras. Detalles, diferencias con la PWA y firma en **[docs/ANDROID.md](docs/ANDROID.md)**.
- **Versión autónoma:** `optimizador-tripulaciones-remo.html` (también en la Release): un solo archivo que se abre con doble clic, sin instalar nada.

## Formato del Excel

Una fila por persona, primera hoja, columnas en este orden: `Nombre · Peso (kg) · Posiciones · Potencia (W, opcional)`.
Posiciones separadas por comas: `T` patrón, `P` proel, `1B…6B` babor, `1E…6E` estribor (bancadas numeradas de popa a proa). En trainerilla y batel las bancadas son individuales y se numeran `1…6` / `1…4`. **Vacío = sin restricción** (cualquier puesto de remero). Detalle en la guía.

## Excel de barcos (maestro)

Columnas: `Tipo · Nombre · Eslora (m) · Manga (m) · Puntal (m) · Calado (m) · Peso del casco (kg)`. Tipo (`trainera`, `trainerilla`, `batel`) y nombre son obligatorios; lo vacío toma el valor predefinido del tipo.

## Limitaciones (léelas antes de fiarte de los números)

- **Trainerilla y batel: parte del modelo es una hipótesis.** El calado, la separación entre bancadas (1,2 m) y la banda de remada alterna no son datos medidos (ver [docs/MODELO.md](docs/MODELO.md)). Afectan al trimado y al asiento estimados. Ajusta la eslora y, si tienes cotas reales, abre un issue para incorporarlas.
- Las reglas de categoría del patrón (peso mínimo) son las mismas para los tres tipos de barco.

- **Funciona sin conexión**: SheetJS 0.18.5 (Excel) y la tipografía IBM Plex van incluidas. Hay tres formas de usarlo:
  - **Versión autónoma** (`optimizador-tripulaciones-remo.html`, ~1,2 MB): un único archivo sin dependencias externas; se genera con `npm run build` y se publica en cada release.
  - **PWA** (GitHub Pages): se instala desde el navegador y funciona sin conexión tras la primera visita (ver abajo).
  - **`index.html` + `vendor/`**: el código limpio y editable. `index.html` necesita la carpeta `vendor/` a su lado; si lo copias solo, el Excel no funcionará y la tipografía caerá a una de sistema.
  Licencias de terceros en `vendor/`.
- **SheetJS 0.18.5** (última versión publicada en npm) tiene avisos de seguridad conocidos al leer archivos no confiables; impórtalo solo con Excel de tu propia plantilla.
- **El asiento es una estimación orientativa**: usa la regla empírica GML ≈ eslora, no datos hidrostáticos del casco. No calcula escora (se corrige moviendo lateralmente a los remeros).
- El modelo de potencia es lineal por remero; no modela técnica, sincronía ni condiciones de mar.
- Los datos de ejemplo son ficticios.

## Desarrollo

Requisitos: Node ≥ 22 (JDK 21 y el SDK de Android solo para compilar el APK).

```bash
npm ci                  # instala las dependencias (Capacitor; la app web no tiene dependencias de ejecución)
npm test                # todas las pruebas: lógica, PWA, Android y estándar del repositorio
npm run build           # dist/optimizador-tripulaciones-remo.html (versión autónoma)
npm run build:pwa       # dist/site: lo que se publica en GitHub Pages (con la versión sellada)
npm run check:site      # comprueba dist/site (ficheros, sintaxis, manifest, versión sellada)
npm run build:android-web   # dist/app: la web que entra en el APK (sin service worker)
npm run android:sync    # build:android-web + cap sync android
npm run android:debug   # APK de depuración  → android/app/build/outputs/apk/debug/
npm run android:release # APK y AAB de release (firmados si hay variables/keystore.properties; ver docs/ANDROID.md)
```

Todo el código propio está en `index.html` (HTML + CSS + JS en una IIFE) en la raíz del repositorio; `vendor/` contiene dependencias de terceros sin modificar. Para trabajar con la web sirve la carpeta con cualquier servidor estático (`npx http-server .`). Ver [CONTRIBUTING.md](CONTRIBUTING.md) y [CLAUDE.md](CLAUDE.md).

## Publicar en GitHub Pages

La aplicación está en **https://lsantome.github.io/Optimizador-Tripulaciones-Remo/** (la URL distingue mayúsculas). Requiere *Settings → Pages → Source: GitHub Actions*. El workflow `.github/workflows/pages.yml` ejecuta `npm ci`, `npm test`, `npm run build:pwa` y `npm run check:site` en cada push y pull request, y **despliega solo desde `main`**.

### PWA: instalable y sin conexión

- **Archivos:** `manifest.webmanifest`, `sw.js` e `icons/`. Todas las rutas son relativas, así que funciona bajo la subruta `/<repo>/` de Pages (y en un dominio propio).
- **Sin conexión:** al primer acceso el service worker precachea la aplicación completa (HTML, SheetJS y fuentes; 18 URLs). Después abre y funciona sin red; las plantillas de Excel se generan en la propia app.
- **Actualizaciones:** la versión de la caché (`oar-<hash>`) es un hash del contenido (lo calcula `scripts/version.js`), por lo que un commit que no toca el código de la app no genera versión nueva. Cuando se publica un cambio, la app muestra «Hay una versión nueva» con el botón *Actualizar*; no recarga sola para no interrumpir un trabajo en curso. Una PWA instalada comprueba si hay versión nueva cada vez que vuelve a primer plano.
- **Comprobar qué versión tienes:** el pie de la app muestra `v<paquete> · build <commit> · <fecha>` (por ejemplo `v1.4.0 · build abc1234 · 2026-10-24`). El commit es el de la compilación: compáralo con el del último despliegue en Actions. Sin compilar (abriendo `index.html` del repositorio) pone `desarrollo`.
- **Desarrollo local:** el `sw.js` del repositorio está en modo desarrollo (no cachea nada); solo el build lo convierte en el de producción.
- La versión autónoma de un solo archivo **no** es PWA (se abre desde `file://`, donde no hay service workers); el build elimina esas partes.

## App Android (APK)

El repositorio incluye un proyecto [Capacitor](https://capacitorjs.com) (`android/`) que empaqueta la aplicación en un APK/AAB que funciona sin conexión. Cómo compilarlo, crear la clave de firma, cargar los secretos, las funciones nativas y las diferencias con la PWA: **[docs/ANDROID.md](docs/ANDROID.md)**.

## Releases

1. Sube `version` en `package.json` y añade la entrada en `CHANGELOG.md`.
2. Commit en una rama, pull request y merge a `main` (despliega la PWA).
3. Etiqueta el commit: `git tag vX.Y.Z && git push origin vX.Y.Z`. La etiqueta **debe coincidir** con `package.json` o `android.yml` falla.
4. `android.yml` compila y adjunta a la Release de GitHub el APK, el AAB, la versión autónoma y `SHA256SUMS.txt`. Sin los 4 secretos de firma, el APK es de depuración (ver [docs/ANDROID.md](docs/ANDROID.md)).

## Datos y privacidad

- **Todo es local.** La app no envía datos a ningún servidor ni hace peticiones externas (SheetJS y las fuentes van incluidos). Plantilla, ajustes y tripulación manual se guardan en el `localStorage` del dispositivo (o en `window.storage` si se abre dentro de Claude.ai), con claves de prefijo `optimizador:`; se perderían al borrar los datos del sitio o usar una ventana privada.
- **La PWA y el APK no comparten datos**, ni entre sí ni con el navegador, ni entre dispositivos: cada uno tiene su propio almacenamiento. **El Excel es la copia de seguridad y el medio para pasar los datos** de uno a otro (en el APK, *Exportar* abre el selector de compartir del móvil).
- En Pages, `https://lsantome.github.io` lo comparten todas tus apps: por eso las claves llevan prefijo propio. Hasta la 1.3.x el prefijo era `trainera:`; al abrir la 1.4 los datos se copian solos al prefijo nuevo (los antiguos no se borran).
- Algunos navegadores restringen `localStorage` con `file://`; en ese caso la app funciona sin guardar (úsala desde Pages).

### Renombrado del repositorio

El repositorio se llama **Optimizador-Tripulaciones-Remo** (antes `App-tripulaciones`); la URL antigua de Pages dejó de funcionar. Si instalaste la PWA desde ella, desinstálala (en Chrome: sin marcar «Borrar datos») e instálala desde la nueva; los datos se conservan porque el origen es el mismo. El `id` del manifest sigue siendo `optimizador-alineacion-remo`: es la identidad de la app, no el nombre del repositorio, y no debe cambiar.

## Licencia

[MIT](LICENSE). El titular del copyright en `LICENSE` sigue siendo el marcador `<TU NOMBRE O CLUB>`: sustitúyelo por el tuyo.
