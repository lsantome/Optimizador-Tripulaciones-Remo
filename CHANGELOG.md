# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); las versiones siguen [SemVer](https://semver.org/lang/es/).
La versión de `package.json` es la fuente de verdad: la etiqueta de Git `vX.Y.Z` debe coincidir con ella (el workflow de Android lo comprueba).

## [1.6.0] - 2026-11-09

### Changed
- **Las posiciones de cada remero son por tipo de barco.** Antes había una sola lista de posiciones válida para todos los barcos, así que quien tenía restringido el proel, el 5 o el 6 de la trainera quedaba excluido (o con un resultado sin sentido) en trainerilla y batel, y un «4» valía lo mismo en cualquier barco aunque en un batel sea un remero ligero y en una trainera pueda ser el más pesado. Ahora cada persona guarda tres listas (trainera, trainerilla, batel); cada tipo usa la suya y nunca se copian de un tipo a otro. Vacío = sin restricción en ese tipo. La columna de la plantilla y su desplegable muestran las del barco activo. **La trainera da los mismos resultados que antes.**
- **Excel de tripulación:** nuevo orden de columnas `Nombre · Peso · Potencia · Posiciones trainera · Posiciones trainerilla · Posiciones batel`, localizadas por la cabecera. Un código que no existe en el tipo (p. ej. `5` en batel) rechaza la fila y el aviso nombra el tipo. La plantilla de ejemplo se ha regenerado.
- **Alineación guardada: formato de datos 2** (una columna de posiciones por tipo). Los archivos del formato 1 (1.5.x) se siguen abriendo y se avisa del reparto de posiciones; los de formato 2 no se abren con versiones anteriores de la app.

### Added
- **Migración automática** de lo guardado en el formato anterior (lista plana), que se persiste al abrir la app: `T` pasa a los tres tipos; proel y bancadas con banda a trainera; las bancadas numéricas al tipo individual que estuviera activo (trainerilla si era la trainera). **Revisa las posiciones de trainerilla y batel si ya las usabas.**
- Los Excel de tripulación del formato anterior (una sola columna de posiciones) se siguen importando con el mismo reparto, con un aviso.
- Pruebas: migración, independencia entre tipos, importación por tipo y rechazo de códigos de otro tipo, apertura del formato 1 de la alineación guardada e ida y vuelta con restricciones distintas por tipo.

## [1.5.1] - 2026-11-09

### Changed
- **La app arranca sin tripulación precargada.** Antes, sin datos guardados, cargaba la plantilla de ejemplo al abrirse. Ahora el banco empieza vacío y los datos ficticios se cargan a petición con el botón de Configuración, que pasa a llamarse **«Cargar tripulación de ejemplo»** (antes «Cargar ejemplo»). Quien ya tenga datos guardados no nota ningún cambio. Los tres tipos de barco siguen disponibles en el selector.
- **Confirmación antes de perder la plantilla:** «Cargar tripulación de ejemplo» y «Vaciar» preguntan antes de sustituir o borrar la plantilla cuando ya hay remeros; con la plantilla vacía no preguntan. (Importar un Excel sigue sustituyendo la plantilla sin preguntar, como antes.)

### Added
- **Aviso en el primer arranque:** mientras no hay remeros, la pestaña Tripulación muestra «Todavía no hay remeros» con un botón **Ir a Configuración**; desaparece al cargar o importar la plantilla.

## [1.5.0] - 2026-11-09

### Added
- **Abrir alineación guardada** (botón junto a *Exportar a Excel* en el modo manual): vuelve a cargar un Excel exportado por la app —plantilla completa con posiciones y disponibilidad, barco, ajustes que afectan al cálculo y asignación— y deja la tripulación en modo manual para seguir editando. Reemplaza lo actual tras pedir confirmación; valida el archivo y, si no es válido, explica por qué sin tocar nada.
- La exportación incluye una hoja **«Datos (no editar)»** en formato por filas (marca, versión del formato, ajustes, remeros y puestos). Las hojas Tripulación, Desglose y Resumen no cambian. Solo se pueden reabrir los archivos exportados desde esta versión.
- Pruebas de ida y vuelta (asignación y métricas idénticas en trainera, trainerilla y batel; barco del maestro) y de rechazo de archivos manipulados, de formato futuro o sin la hoja de datos.

### Changed
- Los archivos exportados llevan la fecha en el nombre (`tripulacion_manual_AAAA-MM-DD.xlsx`) para no pisar versiones anteriores.
- En la app nativa, el estado de la exportación desde el modo manual se muestra junto al botón.
- README y guías: el Excel exportado ya no se presenta como copia de seguridad de la plantilla (no la incluye en el formato de importación).

## [1.4.1] - 2026-11-01

### Changed
- **Tema claro por defecto** (antes oscuro). Quien ya haya elegido un tema lo conserva: lo guardado en el dispositivo manda sobre el valor por defecto. El interruptor de la barra superior sigue alternando entre claro y oscuro.

## [1.4.0] - 2026-10-24

### Added
- **App Android (APK y AAB) con Capacitor** (`android/`, `capacitor.config.json`): funciona sin conexión; `appId` `io.github.lsantome.tripulacionesremo`, mínimo Android 7.0. Iconos adaptativos y pantalla de arranque con el icono de la app (`scripts/android-assets.py`). `versionName` sale de `package.json` y `versionCode` es `mayor·10000 + menor·100 + parche`.
- **Guardado de Excel en la app nativa:** las descargas por `<a download>`/blob no funcionan en el WebView, así que `guardarXlsx` escribe el archivo en la caché con `@capacitor/filesystem` y abre el selector de compartir (`@capacitor/share`). En navegador sigue siendo la descarga directa. Afecta a la exportación de la tripulación y a las dos plantillas.
- Scripts `build:android-web`, `android:sync`, `android:debug` y `android:release` (APK y AAB), más `check:site` (comprobaciones del sitio generado). `scripts/gradle.js` lanza Gradle en Windows y Linux.
- Workflow `android.yml`: con los 4 secretos de firma genera APK y AAB de release firmados; sin ellos, un APK de depuración con aviso. Comprueba que la etiqueta coincide con `package.json` y falla si hay un keystore versionado. En etiqueta adjunta los binarios, la versión autónoma y `SHA256SUMS.txt` a la Release.
- Pruebas del estándar (`tests/estandar.js`, `tests/android.js`, guardado de Excel en `tests/harness.js`): service worker que solo borra sus cachés, claves con prefijo, ausencia de secretos, coherencia de workflows y de Android.
- `.gitignore` (claves, keystores, binarios, salidas de compilación), `CLAUDE.md` y `docs/ANDROID.md`.

### Changed
- **Pie de la app:** `v1.4.0 · build abc1234 · 2026-10-24` (versión, hash corto del commit y fecha); sin compilar muestra `desarrollo`. El tooltip añade el código de la caché. La caché del service worker sigue nombrándose con el hash de contenido (`oar-<hash>`), de modo que un commit de documentación no provoca «Hay una versión nueva».
- **Claves de `localStorage`:** prefijo `trainera:` → `optimizador:` (el antiguo es genérico y puede colisionar con otras apps del mismo origen). Al leer, si falta la clave nueva se copia la antigua; la antigua no se borra.
- `pages.yml` reescrito: Node 22, `npm ci`, comprobaciones del sitio, permisos mínimos por job y despliegue solo desde `main`. La Release pasa a crearse desde `android.yml`.
- Paquete y versión autónoma renombrados a `optimizador-tripulaciones-remo` (el repositorio ya se llama así). El `id` del manifest **no** cambia (`optimizador-alineacion-remo`): es la identidad de la app, no el nombre del repositorio.
- README: URL real de la aplicación (`https://lsantome.github.io/Optimizador-Tripulaciones-Remo/`); la anterior (`App-tripulaciones`) ya no existe.
- En la app nativa no se registra el service worker (y se retira cualquiera existente): los archivos van en el APK y una caché cache-first taparía las versiones nuevas.

### Security
- `.gitignore` con claves y binarios; la firma de release solo se lee de variables de entorno o de `android/keystore.properties` (ignorado); el CI falla si hay un keystore versionado.

## [1.3.1] - 2026-10-19

### Added
- **Versión visible en la app:** el pie muestra la versión, un identificador de compilación y la fecha. El identificador es el mismo que usa el service worker para su caché (sha256 de `sw.js` + archivos precacheados); la fecha no entra en el hash, así que un despliegue sin cambios de código no provoca aviso de «versión nueva». La versión autónoma lleva la misma identidad que la PWA.
- `scripts/version.js` (identidad compartida de la compilación) y pruebas: el hash del pie coincide con el del service worker y con el autónomo.

### Changed
- `npm run build:pwa` genera también la versión autónoma en el mismo proceso. `SOURCE_DATE_EPOCH` fija la fecha para compilaciones reproducibles.

## [1.3.0] - 2026-10-19

### Added
- **Vista básica / avanzada** (interruptor en la barra superior, se recuerda entre sesiones). Solo cambia lo mostrado; el cálculo y las alineaciones propuestas no cambian. En básico se ocultan: desequilibrio por W/kg (y su punto en el círculo), asiento estimado, dispersión de masas, los cuatro deslizadores de pesos del optimizador y los parámetros avanzados.
- Aviso ⚠ en el panel Barco cuando, con la tripulación nominal, el coeficiente de bloque sale fuera de 0,20–0,60 (o faltan eslora, manga o calado).
- Pruebas: la vista no cambia el cálculo, qué se ve en cada vista y el aviso de coherencia por tipo de barco.

### Changed
- «Desvío de trimado» → «Desplazamiento del CG» (respecto a la referencia), «Trimado objetivo» → «Referencia de CG», «Momento de cabeceo» → «Dispersión de masas (cabeceo)», con textos que indican que son heurísticas no validadas. La exportación a Excel usa los nombres nuevos.
- Se retira la cifra del coeficiente de bloque de la tarjeta de asiento.
- README: enlace a la aplicación publicada.

## [1.2.0] - 2026-10-17

### Added
- **PWA:** `manifest.webmanifest`, iconos (192, 512, maskable, apple-touch) y `sw.js` con precaché versionado por hash del contenido. Instalable y con modo offline completo bajo la subruta de GitHub Pages. Aviso de nueva versión con botón *Actualizar* (no recarga sola).
- `npm run build:pwa` genera `dist/site` (PWA + versión autónoma + ejemplos); el workflow de Pages lo despliega.
- Pruebas (`tests/pwa.js`): manifest, iconos, rutas relativas, precaché, determinismo de la versión y limpieza del autónomo.

### Fixed
- **Identidad:** `id` del manifest = `optimizador-alineacion-remo`. Con `./` Chrome lo resolvía a la raíz del dominio y chocaba con otras PWA de `<usuario>.github.io` (Chrome pedía «Revisar actualizaciones de logotipo y nombre»). Prueba añadida.

## [1.1.0] - 2026-10-17

### Added
- **Versión autónoma:** `npm run build` genera un único archivo (~1,2 MB) con SheetJS e IBM Plex incrustados y sin referencias externas (el build lo comprueba).
- **Multiembarcación:** trainera, trainerilla y batel con valores predefinidos editables (eslora, manga, puntal, calado, peso del casco). Los puestos, el optimizador, el esquema, las métricas y la exportación se adaptan al tipo (proel solo en trainera).
- **Maestro de barcos:** plantilla Excel descargable (`plantilla_barcos.xlsx`), importación con validación y avisos, selector de barco y persistencia.
- **Trainerilla (6) y batel (4): bancadas individuales sobre el eje**, con banda de remada alterna (configurable la de la bancada 1). El peso no desequilibra lateralmente; la potencia cuenta por banda de remada. Posiciones en Excel como números (`1,2,5`).
- Hipótesis documentadas: calado, separación entre bancadas y banda de remada de trainerilla y batel (ver `docs/MODELO.md`). La trainera da resultados idénticos a la versión anterior.

### Changed
- El panel de dimensiones pasa de Configuración a un panel «Barco» en Tripulación; el peso del casco sale de los parámetros avanzados.
- «Todas» en las posiciones de un remero pasa a significar «sin restricción» (vacío), válido para cualquier barco.
- Zona popa/proa por posición respecto al centro del casco (igual que antes en la trainera).
- Leyenda «Proel» oculta en barcos sin proel; la nota del Excel de tripulación explica los códigos numéricos de trainerilla y batel.

## [1.0.0] - 2026-10-17

Las fechas de 1.0.0 a 1.2.0 son las de su primera subida a este repositorio.

### Added
- Primera versión pública: optimizador automático (3 propuestas), modo manual, equilibrios de peso/vatios/W-kg, tabla de cuadrantes, trimado y asiento estimado, mapa de calor, modo claro/oscuro, importación/exportación Excel.
- Persistencia con `localStorage` como respaldo cuando no existe `window.storage` (claves con prefijo `trainera:`); fallos de almacenamiento no rompen la app.
- SheetJS 0.18.5 e IBM Plex incluidos en `vendor/` (sin CDN, funciona sin conexión).

### Changed
- Proyecto renombrado a «Optimizador de alineación de remo»; la plantilla Excel pasa a llamarse `plantilla_alineacion_remo.xlsx`.
- Importación Excel: posiciones vacías = remero sin restricción (coherente con la app; la exportación ya escribía vacío).

### Fixed
- Plantilla Excel descargable: la fila de ejemplo sin posiciones se habría rechazado al reimportarla.
