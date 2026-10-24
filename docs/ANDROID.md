# App Android (APK y AAB)

La app Android es la misma aplicación empaquetada con [Capacitor](https://capacitorjs.com): un contenedor que abre los archivos web **incluidos en el propio APK** (no carga nada de internet). Funciona sin conexión desde el primer arranque.

> **Estado de la verificación.** Las pruebas automáticas cubren la configuración, los recursos, el contenido del APK y el guardado de Excel con los plugins simulados, y el APK de depuración y el de release se han compilado y firmado en un entorno de pruebas. **No se ha probado en un dispositivo ni en un emulador, y la firma por GitHub Actions con tus secretos no se ha ejecutado todavía.** Antes de repartirlo, haz la [prueba manual](#prueba-manual-antes-de-distribuir).

## Qué cambia respecto a la PWA

| | PWA (GitHub Pages) | App Android |
|---|---|---|
| Instalación | Desde el navegador | Instalando el `.apk` |
| Actualizaciones | Aviso «Hay una versión nueva» | Instalar un APK nuevo encima del anterior (misma clave de firma y `versionCode` mayor) |
| Datos guardados | Almacenamiento del navegador | **Almacenamiento propio de la app: no se comparte con la PWA ni con el navegador.** El Excel es el medio para moverlos |
| Exportar a Excel | Descarga del navegador | Se escribe en la caché de la app y se abre el selector de compartir del sistema |
| Importar Excel | Selector de archivos | Selector de archivos del sistema |
| Service worker | Sí | No: los archivos ya están en el APK; el código lo desactiva (y retira cualquiera existente) en la app nativa |

El pie muestra `v<paquete> · build <commit> · <fecha>` igual que en la PWA.

## Funciones nativas

Solo dos, y solo para guardar el Excel (`guardarXlsx` en `index.html`): `@capacitor/filesystem` escribe el archivo (base64) en la caché de la app y `@capacitor/share` abre el selector de compartir. Afecta a la exportación de la tripulación y a las plantillas de remeros y de barcos. En navegador sigue siendo la descarga directa. Permisos: solo `INTERNET` (de la plantilla de Capacitor; la app no hace peticiones de red); un test impide añadir otros sin darse cuenta.

## Obtener el APK y el AAB

### Con GitHub Actions (recomendado)

Workflow `.github/workflows/android.yml`. Se ejecuta al crear una etiqueta `vX.Y.Z` o a mano (*Actions → Android → Run workflow*):

1. Comprueba que la etiqueta coincide con `package.json` y que no hay keystores versionados.
2. Ejecuta `npm ci` y `npm test`.
3. Si están los **4 secretos** de firma, compila `release` y produce `Optimizador-Tripulaciones-Remo-vX.Y.Z.apk` y `.aab` firmados, y verifica la firma (`apksigner`, `jarsigner`). Si falta alguno, compila un **APK de depuración** (`…-debug.apk`) y lo avisa en el log.
4. Sube `dist/release` como artefacto (`binarios`); con etiqueta, además crea la Release con los binarios, la versión autónoma y `SHA256SUMS.txt`.

### En tu equipo

Requisitos: Node ≥ 22, JDK 21, SDK de Android con `platforms;android-36` y `build-tools;36.0.0`, y `ANDROID_HOME` definido.

```bash
npm ci
npm run android:debug     # android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release   # APK y AAB de release; firmados solo si hay datos de firma (ver abajo)
```

`scripts/gradle.js` lanza Gradle con `gradlew.bat` en Windows y `sh gradlew` en el resto, así que no depende del bit de ejecución. `android:sync` (incluido en ambos) reconstruye `dist/app` y lo copia al proyecto Android; si solo cambias código web basta con él y volver a compilar.

## Firma de release

Android solo instala una versión nueva **encima** de la anterior si ambas están firmadas con la misma clave. El APK de depuración usa una clave local distinta en cada máquina: sirve para probar, no para repartir.

El `build.gradle` firma `release` únicamente si recibe los cuatro datos, por **variables de entorno** (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) o por `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`; está en `.gitignore`). Sin ellos produce un release sin firmar. Nada de esto se escribe en archivos versionados.

### Crear la clave (una sola vez, por ti)

```bash
keytool -genkeypair -v -keystore release.keystore -alias <alias> -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore      # salida para el secreto ANDROID_KEYSTORE_BASE64 (en macOS: base64 -i release.keystore)
```

En GitHub: *Settings → Secrets and variables → Actions → New repository secret*:

| Secreto | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | el base64 del keystore |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del keystore |
| `ANDROID_KEY_ALIAS` | el alias que usaste |
| `ANDROID_KEY_PASSWORD` | contraseña de la clave |

- **Copia de seguridad fuera del PC:** guarda `release.keystore`, el alias y las dos contraseñas en un gestor de contraseñas o un almacenamiento seguro distinto del ordenador. Si se pierden no podrás publicar actualizaciones instalables encima; habría que desinstalar la app, con la pérdida de sus datos locales.
- No subas el keystore ni sus contraseñas al repositorio, a un issue ni a un chat. El CI falla si encuentra un `.keystore`, `.jks`, `.p12` o `keystore.properties` versionado; si ocurriera, trata la clave como comprometida.
- Contraseñas y keystore son solo tuyos: nadie (ni el asistente que preparó el repositorio) debe pedírtelos.

## Instalar en el móvil

1. Descarga el `.apk` de la [última Release](https://github.com/lsantome/Optimizador-Tripulaciones-Remo/releases/latest) en el móvil, o pásalo por Drive/cable.
2. Ábrelo; Android pedirá permitir «instalar apps desconocidas» a la aplicación desde la que lo abras.
3. Puede aparecer un aviso de Play Protect por ser un APK fuera de Google Play; es normal en instalaciones directas.
4. Comprueba el SHA-256 con `SHA256SUMS.txt` si quieres verificar la descarga.

Requiere Android 7.0 o superior (API 24).

**Si ya instalaste el APK de depuración que se envió antes de la 1.4.0:** está firmado con otra clave y Android no dejará instalar encima el de release. Desinstálalo primero; **se pierden los datos guardados en esa instalación**, así que exporta antes a Excel.

## Versiones

`versionName` es la `version` de `package.json` y `versionCode` se deriva de ella (`MAYOR·10000 + MENOR·100 + PARCHE`; 1.4.0 → 10400). Para cada APK nuevo que quieras instalar encima de otro, sube la versión en `package.json` (y el `CHANGELOG.md`); con el mismo `versionCode` Android no lo trata como actualización.

## Publicar una versión

1. Rama → cambios → `npm test` en local → pull request → merge a `main`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` (debe coincidir con `package.json`).
3. Espera a que `android.yml` termine en verde y descarga el APK de la Release.
4. Haz la prueba manual en un móvil real.

## Detalles del proyecto

- **Identificador:** `io.github.lsantome.tripulacionesremo` (`capacitor.config.json`). No lo cambies una vez repartido el APK: Android lo trataría como otra aplicación.
- **Icono y pantalla de arranque:** se generan desde `icons/icon-maskable-512.png` con `python3 scripts/android-assets.py` (Pillow); solo hace falta si cambias el icono.
- **`android/`** está versionado (proyecto de `cap add android` con ajustes propios: versión desde `package.json`, firma por variables, iconos). Lo que depende de `node_modules` se regenera con `npm run android:sync`.

## Prueba manual antes de distribuir

Sobre el APK instalado (con el móvil sin conexión):

1. Abre la app: se ve completa, con las fuentes y el pie con la versión.
2. Elige un barco, carga el ejemplo, optimiza y arrastra una ficha.
3. **Exportar a Excel:** aparece el selector de compartir; guarda el archivo y ábrelo en una hoja de cálculo.
4. **Descargar plantilla** (remeros y barcos): igual.
5. **Importar** un Excel de tripulación desde Drive o Descargas.
6. Cierra y vuelve a abrir: los datos guardados siguen ahí. Gira el móvil y usa el botón atrás.

## Alternativa descartada: TWA (Bubblewrap / PWABuilder)

Una «Trusted Web Activity» abre la web publicada y se actualiza sola, pero exige servir `https://lsantome.github.io/.well-known/assetlinks.json` en la **raíz del dominio**, algo que una página de proyecto no controla (haría falta un repositorio `lsantome.github.io` o un dominio propio). Sin esa verificación se ve la barra de direcciones de Chrome, depende de conexión en la primera carga y comparte datos con la PWA. Si más adelante tienes dominio propio, es una opción razonable.
