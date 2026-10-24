#!/usr/bin/env node
// Lanza el wrapper de Gradle del proyecto Android de forma portable (Windows, Linux, macOS):
//   node scripts/gradle.js assembleDebug
// En Windows usa gradlew.bat; en el resto, `sh gradlew` (funciona aunque el repositorio haya perdido el bit de ejecución).
const { spawnSync } = require('child_process');
const path = require('path');
const win = process.platform === 'win32';
const args = process.argv.slice(2);
if (!args.length) { console.error('Uso: node scripts/gradle.js <tarea de Gradle> [opciones]'); process.exit(2); }
const r = win
  ? spawnSync('gradlew.bat', args, { cwd: path.join(__dirname, '..', 'android'), stdio: 'inherit', shell: true })
  : spawnSync('sh', ['gradlew', ...args], { cwd: path.join(__dirname, '..', 'android'), stdio: 'inherit' });
if (r.error) { console.error(r.error.message); process.exit(1); }
process.exit(r.status === null ? 1 : r.status);
