// Pruebas de humo: extrae el <script> principal de index.html y ejecuta la lógica sin navegador.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let src = scripts.sort((a, b) => b.length - a.length)[0];
const cut = src.indexOf('function renderBanco()');
assert(cut > 0, 'No se encontró renderBanco(): ajusta el punto de corte en tests/harness.js');
src = src.slice(0, cut);

// Arranque sin datos: cargarDatos no debe precargar la plantilla de ejemplo (solo el botón «Cargar tripulación de ejemplo»)
const cuerpoCargarDatos = /async function cargarDatos\(\)\{[\s\S]*?\n\}\n/.exec(src);
assert(cuerpoCargarDatos, 'No se encontró cargarDatos() en index.html');
assert(!/cargarEjemplo\(/.test(cuerpoCargarDatos[0]), 'cargarDatos() no debe precargar la plantilla de ejemplo');
assert(/id="btnExample"[^>]*>Cargar tripulación de ejemplo</.test(html), 'el botón de ejemplo debe llamarse «Cargar tripulación de ejemplo»');

const test = `
  const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')');

  // ---------- trainera: posiciones idénticas a la versión de un solo barco ----------
  const viejo = {proel:0.06, b1:0.82, b2:0.69, b3:0.56, b4:0.43, b5:0.30, b6:0.17, patron:0.95};
  const tr = construirSlots('trainera', 12);
  assert(tr.length === 14, 'trainera debe tener 14 puestos');
  tr.forEach(s => { const k = s.id === 'proel' ? 'proel' : (s.id === 'patron' ? 'patron' : s.id.slice(0,2)); near(s.x, viejo[k], 1e-9, 'x de ' + s.id); });

  // ---------- puestos por tipo ----------
  const esperado = {trainera:[14,13], trainerilla:[7,6], batel:[5,4]}; // [puestos, plazas de remo]
  Object.keys(esperado).forEach(k => {
    const sl = construirSlots(k, TIPOS_BARCO[k].eslora);
    assert(sl.length === esperado[k][0], k + ': puestos ' + sl.length);
    assert(sl.filter(s => s.role !== 'patron').length === esperado[k][1], k + ': plazas de remo');
    assert((k === 'trainera') === sl.some(s => s.role === 'proel'), k + ': el proel solo existe en trainera');
    sl.forEach(s => assert(s.x > 0 && s.x < 1, k + ': x fuera de (0,1) en ' + s.id));
    // tripulación nominal (remeros 80 kg, proel 80, patrón 60, casco mínimo) => CG cerca del centro
    const t = TIPOS_BARCO[k];
    let m = t.peso * 0.5, w = t.peso;
    sl.forEach(s => { const p = s.role === 'patron' ? 60 : 80; m += p * s.x; w += p; });
    near(m / w, 0.5, 0.012, k + ': CG nominal');
    const cb = w / (DENSIDAD_AGUA_MAR * t.eslora * t.manga * t.calado);
    assert(cb > 0.35 && cb < 0.5, k + ': Cb nominal fuera de rango ' + cb);
  });

  // ---------- optimizador y métricas en cada tipo ----------
  Object.keys(esperado).forEach(k => {
    state.config.tipoBarco = k; state.config.barcoId = '';
    Object.assign(state.config, {eslora: TIPOS_BARCO[k].eslora, manga: TIPOS_BARCO[k].manga, calado: TIPOS_BARCO[k].calado, pesoCasco: TIPOS_BARCO[k].peso});
    state.asignacionManual = {};
    reconstruirSlots();
    cargarEjemplo(false);
    const r = optimizarTop3();
    assert(r.length === 3, k + ': optimizarTop3 debe devolver 3, devolvió ' + r.length);
    const asig = r[0].asignacion;
    assert(Object.keys(asig).every(id => SLOTS.some(s => s.id === id)), k + ': asignación con puestos inexistentes');
    assert(Object.keys(asig).length === SLOTS.length, k + ': deben cubrirse todos los puestos');
    const ev = evaluar(asig, calcularPotenciaRef());
    assert(isFinite(ev.xcg) && isFinite(ev.imbalancePeso), k + ': métricas no finitas');
    const as = calcularAsiento(ev); assert(isFinite(as.anguloDeg), k + ': asiento no finito');
    const tab = calcularTablaUnificada(asig);
    const sumaPesos = tab.total.peso;
    near(sumaPesos, ev.pesoTripulacion, 1e-6, k + ': la tabla de cuadrantes debe sumar el peso de la tripulación');
    assert((k === 'trainera') === (tab.proel !== null), k + ': proel en la tabla');
  });

  // ---------- bancadas individuales sobre el eje (trainerilla y batel) ----------
  [['trainerilla', 6], ['batel', 4]].forEach(([k, n]) => {
    const sl = construirSlots(k, TIPOS_BARCO[k].eslora, 'babor');
    const rem = sl.filter(s => s.role === 'remero');
    assert(rem.length === n && rem.every(s => s.eje), k + ': ' + n + ' bancadas individuales');
    assert(rem.filter(s => s.banda === 'babor').length === n / 2 && rem.filter(s => s.banda === 'estribor').length === n / 2, k + ': banda de remada alterna y equilibrada');
    assert(rem[0].banda === 'babor' && rem[1].banda === 'estribor', k + ': la bancada 1 rema por la banda de inicio');
    assert(construirSlots(k, TIPOS_BARCO[k].eslora, 'estribor')[0].banda === 'estribor', k + ': banda de inicio configurable');
    // separación de 1,2 m entre bancadas consecutivas
    near((rem[0].x - rem[1].x) * TIPOS_BARCO[k].eslora, 1.2, 1e-4, k + ': separación entre bancadas');
    // en la trainera no hay remeros sobre el eje
  });
  assert(construirSlots('trainera', 12).filter(s => s.eje).length === 0, 'la trainera no tiene bancadas individuales');

  // peso sin desequilibrio lateral; potencia por banda de remada
  ['trainerilla', 'batel'].forEach(k => {
    state.config.tipoBarco = k; state.config.bandaInicio = 'babor';
    Object.assign(state.config, {eslora: TIPOS_BARCO[k].eslora, pesoCasco: TIPOS_BARCO[k].peso, prioridad: 'vatios'});
    state.asignacionManual = {}; reconstruirSlots();
    state.remeros = [];
    const asig = {};
    SLOTS.forEach((s, i) => {
      const p = {id: 'x' + i, nombre: 'P' + i, peso: s.role === 'patron' ? 60 : 70 + 10 * i, potencia: s.role === 'patron' ? undefined : 200 + 20 * i, posiciones: s.role === 'patron' ? posTodos(['patron']) : posicionesVacias(), disponible: true};
      state.remeros.push(p); asig[s.id] = p.id;
    });
    const ev = evaluar(asig, calcularPotenciaRef());
    assert(ev.imbalancePeso === 0 && ev.bandaFracPeso === 0, k + ': peso sobre el eje no desequilibra bandas');
    assert(ev.costPareja === 0, k + ': no hay coste de pareja');
    let pb = 0, pe = 0;
    SLOTS.filter(s => s.role === 'remero').forEach(s => { const pot = state.remeros.find(r => r.id === asig[s.id]).potencia; if (s.banda === 'babor') pb += pot; else pe += pot; });
    near(ev.imbalancePotencia, Math.abs(pb - pe) / (pb + pe), 1e-9, k + ': desequilibrio de potencia por banda de remada');
    assert(ev.wkgBab > 0 && ev.wkgEst > 0, k + ': W/kg por banda con remeros sobre el eje');
    const tb = calcularTablaUnificada(asig);
    assert(tb.individual === true, k + ': tabla marcada como individual');
    near(tb.total.peso, ev.pesoTripulacion, 1e-6, k + ': la tabla suma todo el peso');
    near(tb.colBabor.peso + tb.colEstribor.peso, 0, 1e-9, k + ': ningún peso en columnas de banda');
    near(tb.total.potencia, ev.potenciaTotal, 1e-6, k + ': la tabla suma toda la potencia');
    // cambiar la banda de inicio invierte el desequilibrio de potencia
    state.config.bandaInicio = 'estribor'; reconstruirSlots();
    const ev2 = evaluar(asig, calcularPotenciaRef());
    near(ev2.bandaFracPotencia, -ev.bandaFracPotencia, 1e-9, k + ': invertir la banda de inicio invierte el signo');
    state.config.prioridad = 'peso'; state.config.bandaInicio = 'babor';
  });

  // ---------- reglas de dominio ----------
  assert(!puedeRemar({posiciones: posTodos(['patron'])}), 'un patrón puro no debe remar');

  // ---------- importación de tripulación ----------
  const tipoAntesImport = state.config.tipoBarco; state.config.tipoBarco = 'batel'; // el formato anterior reparte las bancadas numéricas según el tipo activo
  const numerico = procesarFilasExcel([['n','p','pos','w'],['N',70,'1,3',250],['M',70,3,250]]);
  assert(numerico.formatoAnterior === true, 'una cabecera sin columnas por tipo es el formato anterior');
  assert(numerico.remeros[0].posiciones.batel.join() === 'e1,e3' && numerico.remeros[1].posiciones.batel.join() === 'e3', 'posiciones numéricas de bancadas individuales');
  assert(numerico.remeros[0].posiciones.trainera.length === 0 && numerico.remeros[0].posiciones.trainerilla.length === 0, 'formato anterior: las bancadas numéricas solo van al tipo activo');
  state.config.tipoBarco = tipoAntesImport;
  const ok = procesarFilasExcel([['n','p','pos','w'],['A',80,'1B,2E',300],['B',70,'T','']]);
  assert(ok.remeros.length === 2 && ok.errores.length === 0, 'import válido falló');
  const vacio = procesarFilasExcel([['n','p','pos','w'],['E',80,'',300]]);
  assert(vacio.remeros.length === 1 && ORDEN_TIPOS.every(k => vacio.remeros[0].posiciones[k].length === 0) && vacio.errores.length === 0, 'posiciones vacías deben importarse sin restricción');
  const mal = procesarFilasExcel([['n','p','pos','w'],['C',80,'ZZ',300],['',70,'T',''],['D',0,'1B','']]);
  assert(mal.remeros.length === 0 && mal.errores.length === 3, 'import inválido debe dar 3 errores');

  // ---------- maestro de barcos ----------
  const cab = ['tipo','nombre','eslora','manga','puntal','calado','peso'];
  const mb = procesarFilasBarcos([cab,
    ['Trainera', 'Barco A', 12.1, 1.72, 0.95, 0.15, 205],
    ['  TRAINERILLA ', 'Barco B', '9,5', '1,1', '', '', ''],
    ['batel', 'Barco C', '', '', '', '', 65],
    ['bote', 'X', 1, 1, 1, 1, 1],
    ['batel', '', 7, 1, 0.5, 0.1, 70],
    ['trainera', 'Barco D', -3, 1.7, 0.9, 0.15, 200],
    ['trainera', 'Barco E', 120, 1.72, 0.95, 0.15, 200],
    ['', '', '', '', '', '', '']]);
  assert(mb.barcos.length === 4, 'maestro: debe importar A, B, C y E; importó ' + mb.barcos.length);
  assert(mb.errores.length === 3, 'maestro: 3 errores (tipo, nombre, dimensión); hubo ' + mb.errores.length + ': ' + mb.errores.join(' | '));
  const B = mb.barcos.find(b => b.nombre === 'Barco B');
  assert(B.tipo === 'trainerilla' && B.eslora === 9.5 && B.manga === 1.1 && B.peso === TIPOS_BARCO.trainerilla.peso && B.calado === TIPOS_BARCO.trainerilla.calado, 'maestro: coma decimal y valores por defecto');
  assert(mb.avisos.some(a => a.includes('Barco C') && a.includes('mínimo')), 'maestro: aviso de peso bajo mínimo');
  assert(mb.avisos.some(a => a.includes('Barco E') && a.includes('unidades')), 'maestro: aviso de dimensión sospechosa');

  // ---------- selección de barco del maestro ----------
  state.barcos = mb.barcos;
  state.config.barcoId = '';
  state.config.tipoBarco = 'trainera';
  const dummy = {getElementById: () => null};
  // cambio manual de tipo sin DOM: replicamos lo esencial de seleccionarBarcoMaestro
  const C = mb.barcos.find(b => b.nombre === 'Barco C');
  state.config.tipoBarco = C.tipo; state.config.barcoId = C.id; cargarValoresBarco(C); reconstruirSlots();
  assert(SLOTS.length === 5 && nombreBarcoActivo() === 'Barco C' && state.config.pesoCasco === 65, 'selección de barco del maestro');
  state.config.eslora = 7.5; reconstruirSlots();
  assert(SLOTS.length === 5 && SLOTS.every(s => s.x > 0 && s.x < 1), 'cambiar la eslora conserva los puestos');

  // ---------- plantillas Excel descargables: deben poder reimportarse sin errores ----------
  const leer = f => { const w = XLSX.readFile(f); return XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], {header:1, defval:''}); };
  descargarPlantillaBarcos();
  const rb = procesarFilasBarcos(leer('plantilla_barcos.xlsx'));
  assert(rb.barcos.length === 3 && rb.errores.length === 0 && rb.avisos.length === 0, 'la plantilla de barcos debe reimportarse limpia: ' + rb.errores.join('|') + rb.avisos.join('|'));
  ORDEN_TIPOS.forEach(k => { const b = rb.barcos.find(x => x.tipo === k); assert(b && b.eslora === TIPOS_BARCO[k].eslora && b.peso === TIPOS_BARCO[k].peso, 'plantilla de barcos: valores de ' + k); });
  descargarPlantillaExcel();
  const rc = procesarFilasExcel(leer('plantilla_alineacion_remo.xlsx'));
  assert(rc.remeros.length === 5 && rc.errores.length === 0 && rc.formatoAnterior === false, 'la plantilla de tripulación debe reimportarse limpia: ' + rc.errores.join('|'));
  const rcPor = n => rc.remeros.find(r => r.nombre === n).posiciones;
  assert(rcPor('Jon Aramburu').trainera.join() === 'b3_est,b4_est,b5_est' && rcPor('Jon Aramburu').batel.length === 0, 'plantilla: las posiciones de trainera no pasan a batel');
  assert(rcPor('Eneko Bilbao').batel.join() === 'e4' && rcPor('Eneko Bilbao').trainera.length === 0, 'plantilla: una restricción solo de batel');
  assert(ORDEN_TIPOS.every(k => rcPor('Iñaki Sagastume')[k].join() === 'patron'), 'plantilla: el patrón lo es en los tres tipos');

  // ---------- alineación reimportable: exportar -> abrir debe devolver exactamente lo mismo ----------
  assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fechaArchivo()), 'fechaArchivo debe ser AAAA-MM-DD');
  const rtNumericos = ev => Object.keys(ev).filter(k => typeof ev[k] === 'number' || ev[k] === null).reduce((o, k) => { o[k] = ev[k]; return o; }, {});
  const rtPorPuesto = asig => Object.keys(asig).sort().map(sid => { const p = buscarPersona(asig[sid]); return sid + '=' + p.nombre + '|' + p.peso + '|' + p.potencia + '|' + ORDEN_TIPOS.map(t => p.posiciones[t].join('+')).join('/') + '|' + p.disponible; });
  const rtAjustes = () => JSON.stringify(Object.keys(AJUSTES_TEXTO).concat(AJUSTES_NUM.map(a => a[0])).map(k => [k, state.config[k]]));
  const rtEditar = (wb, fn) => { const aoa = XLSX.utils.sheet_to_json(wb.Sheets[HOJA_DATOS], {header:1, defval:''}); fn(aoa); wb.Sheets[HOJA_DATOS] = XLSX.utils.aoa_to_sheet(aoa); return wb; };
  const rtLibro = nombre => XLSX.readFile(nombre);
  const rtBarcosPrevios = state.barcos, rtConfigPrevia = JSON.parse(JSON.stringify(state.config)); // este bloque cambia el estado compartido: se restaura al terminar
  ORDEN_TIPOS.forEach(k => {
    state.config.tipoBarco = k; state.config.barcoId = ''; cargarValoresBarco(TIPOS_BARCO[k]);
    state.config.prioridad = 'wkg'; state.config.wBanda = 1.7; state.config.categoria = 'senior_f'; state.config.bandaInicio = 'estribor';
    state.config.proelBanda = 'estribor'; state.config.xTrimObjetivo = 0.47; state.config.pesoMedioObjetivo = 79; state.config.calado = 0.21;
    reconstruirSlots(); cargarEjemplo(false);
    state.remeros[3].disponible = false; state.remeros[4].posiciones = {trainera: ['b2_bab', 'b2_est'], trainerilla: ['e1', 'e5'], batel: ['e2']}; // restricciones distintas en cada tipo: todas deben viajar en el archivo
    const asig = optimizarTop3()[0].asignacion, ev1 = rtNumericos(evaluar(asig, calcularPotenciaRef()));
    const antes = rtPorPuesto(asig).join(';'), ajustes1 = rtAjustes(), nRem = state.remeros.length;
    exportarTripulacionExcel(asig, 'rt_' + k + '.xlsx');
    const wb = rtLibro('rt_' + k + '.xlsx');
    assert(wb.SheetNames.join() === 'Tripulación,Desglose,Resumen,' + HOJA_DATOS, k + ': hojas de la exportación: ' + wb.SheetNames.join());
    const rd = leerAlineacionGuardada(wb);
    assert(!rd.error, k + ': el archivo exportado debe poder abrirse: ' + rd.error);
    // se borra todo y se pone otro barco/ajustes para comprobar que lo restaura el archivo y no el estado previo
    state.remeros = []; state.asignacionManual = {}; state.resultadosAuto = [];
    state.config.tipoBarco = 'trainera'; cargarValoresBarco(TIPOS_BARCO.trainera);
    Object.assign(state.config, {prioridad: 'peso', wBanda: 1, categoria: 'senior_m', bandaInicio: 'babor', proelBanda: 'babor', xTrimObjetivo: 0.5, pesoMedioObjetivo: 82});
    reconstruirSlots();
    aplicarAlineacionGuardada(rd.datos);
    assert(state.remeros.length === nRem, k + ': se pierden remeros (' + state.remeros.length + ' de ' + nRem + ')');
    assert(rtAjustes() === ajustes1, k + ': ajustes distintos tras abrir');
    assert(rtPorPuesto(state.asignacionManual).join(';') === antes, k + ': la asignación (nombre, peso, potencia, posiciones, disponibilidad) cambia tras abrir');
    assert.deepStrictEqual(rtNumericos(evaluar(state.asignacionManual, calcularPotenciaRef())), ev1);
    assert(state.remeros.filter(r => r.disponible === false).length === 1, k + ': la disponibilidad debe conservarse');
  });
  console.log('OK: exportar y abrir una alineación devuelve la misma asignación y las mismas métricas (3 tipos de barco)');

  // barco del maestro: se vuelve a seleccionar o se añade
  state.config.tipoBarco = 'batel'; state.config.barcoId = ''; cargarValoresBarco(TIPOS_BARCO.batel); reconstruirSlots(); cargarEjemplo(false);
  state.barcos = [{id: 'bX', tipo: 'batel', nombre: 'Barco X', eslora: 8.5, manga: 1.2, puntal: 0.6, calado: 0.12, peso: 70}];
  state.config.barcoId = 'bX'; cargarValoresBarco(state.barcos[0]); reconstruirSlots();
  const rtAsig = optimizarTop3()[0].asignacion;
  exportarTripulacionExcel(rtAsig, 'rt_maestro.xlsx');
  const rm = leerAlineacionGuardada(rtLibro('rt_maestro.xlsx'));
  assert(!rm.error && rm.datos.barcoNombre === 'Barco X', 'el nombre del barco del maestro debe viajar en el archivo');
  state.barcos = []; state.config.barcoId = '';
  const av1 = aplicarAlineacionGuardada(rm.datos);
  assert(state.barcos.length === 1 && nombreBarcoActivo() === 'Barco X' && state.barcos[0].eslora === 8.5 && av1.length === 1, 'si el barco no está en el maestro se añade');
  const av2 = aplicarAlineacionGuardada(rm.datos);
  assert(state.barcos.length === 1 && nombreBarcoActivo() === 'Barco X' && av2.length === 0, 'si ya existe con las mismas dimensiones se selecciona sin duplicar');
  state.barcos[0].eslora = 9;
  assert(aplicarAlineacionGuardada(rm.datos).length === 1 && state.config.eslora === 8.5, 'si existe con otras dimensiones, manda el archivo y se avisa');

  // archivos que NO deben abrirse (y el estado no se toca)
  const rtBase = rtLibro('rt_trainera.xlsx'), rtEstado = JSON.stringify([state.remeros.length, state.config, Object.keys(state.asignacionManual)]);
  const rtFalla = (nombre, wbMalo, trozo) => { const r = leerAlineacionGuardada(wbMalo); assert(r.error && r.error.indexOf(trozo) !== -1, nombre + ': se esperaba un error con «' + trozo + '», pero fue: ' + (r.error || 'ninguno')); };
  const rtCopia = () => rtLibro('rt_trainera.xlsx');
  const rtSin = rtCopia(); delete rtSin.Sheets[HOJA_DATOS]; rtSin.SheetNames.pop();
  rtFalla('sin hoja de datos', rtSin, 'no tiene la hoja');
  rtFalla('marca alterada', rtEditar(rtCopia(), a => { a[0][0] = 'OTRA-COSA'; }), 'formato esperado');
  rtFalla('formato futuro', rtEditar(rtCopia(), a => { a[0][1] = 99; }), 'más nueva');
  rtFalla('valor de ajuste inválido', rtEditar(rtCopia(), a => { a.find(f => f[1] === 'prioridad')[2] = 'inventada'; }), 'prioridad');
  rtFalla('dimensión negativa', rtEditar(rtCopia(), a => { a.find(f => f[1] === 'eslora')[2] = -3; }), 'eslora');
  rtFalla('peso no numérico', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'REMERO')[3] = 'mucho'; }), 'peso no válido');
  rtFalla('posiciones desconocidas', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'REMERO')[5] = '9Z'; }), 'posiciones no válidas para trainera');
  rtFalla('código de otro tipo de barco', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'REMERO')[7] = '5'; }), 'posiciones no válidas para batel');
  rtFalla('puesto inexistente', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'PUESTO')[1] = 'e5'; }), 'no existe');
  rtFalla('remero inexistente en un puesto', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'PUESTO')[2] = 999; }), 'no existe');
  rtFalla('mismo remero en dos puestos', rtEditar(rtCopia(), a => { const p = a.filter(f => f[0] === 'PUESTO'); p[1][2] = p[0][2]; }), 'dos puestos');
  rtFalla('falta un ajuste', rtEditar(rtCopia(), a => { a.splice(a.findIndex(f => f[1] === 'calado'), 1); }), 'calado');
  rtFalla('sin remeros', rtEditar(rtCopia(), a => { for(let i = a.length - 1; i > 0; i--) if(a[i][0] === 'REMERO' || a[i][0] === 'PUESTO') a.splice(i, 1); }), 'ningún remero');
  assert(JSON.stringify([state.remeros.length, state.config, Object.keys(state.asignacionManual)]) === rtEstado, 'leer un archivo no válido no debe modificar el estado');
  console.log('OK: archivos no válidos rechazados con mensaje claro y sin tocar el estado');
  state.barcos = rtBarcosPrevios; Object.assign(state.config, rtConfigPrevia); reconstruirSlots(); state.asignacionManual = {}; state.resultadosAuto = [];

  // ---------- posiciones por tipo de barco: cada tipo tiene las suyas ----------
  { const tipoPrev = state.config.tipoBarco;
    const usar = k => { state.config.tipoBarco = k; reconstruirSlots(); };
    // migración del formato antiguo (lista plana)
    const m1 = migrarPosicionesLegacy(['patron', 'b3_est', 'proel'], 'trainera');
    assert(m1.trainera.join() === 'patron,b3_est,proel' && m1.trainerilla.join() === 'patron' && m1.batel.join() === 'patron', 'migración: el patrón vale en los tres tipos y proel/bancadas con banda solo en trainera');
    const m2 = migrarPosicionesLegacy(['e2', 'e5'], 'batel');
    assert(m2.batel.join() === 'e2' && m2.trainerilla.join() === 'e5' && m2.trainera.length === 0, 'migración: una bancada que no existe en el batel activo va a trainerilla, no se pierde ni se copia');
    const m3 = migrarPosicionesLegacy(['e1', 'e5'], 'trainera');
    assert(m3.trainerilla.join() === 'e1,e5' && m3.batel.length === 0, 'migración: con trainera activa las bancadas individuales van a trainerilla');
    assert(ORDEN_TIPOS.every(k => migrarPosicionesLegacy(['zz', 3, null], 'batel')[k].length === 0 && migrarPosicionesLegacy(undefined, 'batel')[k].length === 0), 'migración: basura y vacío no crean restricciones');
    // datos corruptos o antiguos se normalizan al leerlos
    const viejo = {posiciones: ['b2_bab', 'e1']};
    usar('trainera');
    assert(esCompatible(viejo, 'b2_bab') && !esCompatible(viejo, 'b1_bab'), 'una lista antigua se lee como restricción de trainera');
    assert(!Array.isArray(viejo.posiciones) && viejo.posiciones.trainerilla.join() === 'e1', 'la lista antigua queda migrada al leerla');
    const roto = {posiciones: {trainera: ['e1', 'b1_bab', 'b1_bab'], batel: 'x'}};
    normalizarPosiciones(roto);
    assert(roto.posiciones.trainera.join() === 'b1_bab' && roto.posiciones.batel.length === 0 && roto.posiciones.trainerilla.length === 0, 'normalizar descarta ids que no existen en el tipo, duplicados y listas no válidas');
    // independencia: editar un tipo no toca los demás
    const r = {id: 'z', nombre: 'Z', peso: 80, disponible: true, posiciones: posTrainera(['b3_est'])};
    assert(esCompatible(r, 'b3_est') && !esCompatible(r, 'b1_bab') && contarCompatibles(r) === 1, 'restringido en trainera: un solo puesto');
    usar('batel');
    assert(contarCompatibles(r) === SLOTS_REMERO.length, 'sin restricción en batel: puede ir en cualquier bancada aunque en trainera esté restringido');
    ponerPos(r, ['e4']);
    assert(contarCompatibles(r) === 1 && esCompatible(r, 'e4') && !esCompatible(r, 'e1'), 'restringido en batel a la bancada 4');
    assert(r.posiciones.trainera.join() === 'b3_est' && r.posiciones.trainerilla.length === 0, 'editar el batel no toca trainera ni trainerilla');
    usar('trainerilla');
    assert(contarCompatibles(r) === SLOTS_REMERO.length, 'trainerilla no hereda la restricción del batel');
    // patrón por tipo
    ponerPos(r, ['patron']);
    assert(esCompatible(r, 'patron') && !puedeRemar(r), 'patrón puro en trainerilla');
    usar('batel');
    assert(!esCompatible(r, 'patron') && puedeRemar(r), 'el patrón de trainerilla no lo es en batel si no se marca');
    // el optimizador respeta la lista del tipo activo
    usar('batel'); state.config.prioridad = 'peso';
    state.remeros = []; for(let i = 0; i < 6; i++) state.remeros.push({id: 'o' + i, nombre: 'O' + i, peso: 70 + 4 * i, potencia: 250, disponible: true, posiciones: posicionesVacias()});
    state.remeros.push({id: 'pa', nombre: 'Pa', peso: 60, disponible: true, posiciones: posTodos(['patron'])});
    state.remeros[5].posiciones.batel = ['e4']; state.remeros[5].posiciones.trainera = ['proel'];
    state.asignacionManual = {}; state.resultadosAuto = [];
    optimizarTop3().forEach(o => assert(o.asignacion.e4 === 'o5' || !Object.values(o.asignacion).includes('o5'), 'el optimizador de batel debe respetar la restricción de batel (y no la de trainera)'));
    state.config.tipoBarco = tipoPrev; reconstruirSlots(); state.asignacionManual = {}; state.resultadosAuto = [];
    // Excel de plantilla en el formato actual: columnas por tipo, localizadas por la cabecera
    const cab = ['Nombre', 'Peso', 'Potencia (W)', 'Posiciones trainera', 'Posiciones trainerilla', 'Posiciones batel'];
    const nuevoFmt = procesarFilasExcel([cab, ['A', 80, 300, '3E,4E', '1,2', '4'], ['B', 70, '', '', '', ''], ['C', 75, 250, 'T', 'T', 'T']]);
    assert(nuevoFmt.formatoAnterior === false && nuevoFmt.errores.length === 0 && nuevoFmt.remeros.length === 3, 'formato por tipo: importación limpia ' + nuevoFmt.errores.join('|'));
    const pa = nuevoFmt.remeros[0];
    assert(pa.posiciones.trainera.join() === 'b3_est,b4_est' && pa.posiciones.trainerilla.join() === 'e1,e2' && pa.posiciones.batel.join() === 'e4' && pa.potencia === 300, 'formato por tipo: cada columna a su tipo');
    assert(nuevoFmt.remeros[1].potencia === undefined && ORDEN_TIPOS.every(k => nuevoFmt.remeros[2].posiciones[k].join() === 'patron'), 'formato por tipo: potencia vacía y patrón en los tres');
    const malPorTipo = procesarFilasExcel([cab, ['D', 80, '', '1', '', ''], ['E', 80, '', '', '5', ''], ['F', 80, '', '', '', '5'], ['G', 80, '', '', '', '1B']]);
    assert(malPorTipo.remeros.length === 1 && malPorTipo.remeros[0].nombre === 'E' && malPorTipo.errores.length === 3, 'un código que no existe en ese tipo rechaza la fila: ' + malPorTipo.errores.join('|'));
    assert(/trainera/.test(malPorTipo.errores[0]) && /batel/.test(malPorTipo.errores[1]) && /batel/.test(malPorTipo.errores[2]), 'el error nombra el tipo de barco');
    const otroOrden = procesarFilasExcel([['n', 'p', 'Posiciones batel', 'Potencia (W)'], ['A', 80, '3', 280]]);
    assert(otroOrden.remeros[0].posiciones.batel.join() === 'e3' && otroOrden.remeros[0].potencia === 280 && otroOrden.remeros[0].posiciones.trainera.length === 0, 'las columnas se localizan por la cabecera, no por su posición');
    // alineación guardada en formato 1 (una sola columna de posiciones): se sigue abriendo
    const wb2 = XLSX.readFile('rt_trainera.xlsx');
    const f1 = rtEditar(wb2, a => { a[0][1] = 1; a.filter(f => f[0] === 'REMERO').forEach(f => { const disp = f[8]; f[6] = disp; f[7] = ''; f[8] = ''; }); });
    const r1 = leerAlineacionGuardada(f1);
    assert(!r1.error, 'el formato 1 debe seguir abriéndose: ' + r1.error);
    assert(r1.avisos.some(x => /formato anterior/i.test(x)), 'abrir un formato 1 avisa del reparto de posiciones');
    const jon = r1.datos.remeros.find(x => x.nombre === 'Jon Aramburu'), nagore = r1.datos.remeros.find(x => x.nombre === 'Nagore Uranga');
    assert(jon.posiciones.trainera.join() === 'b3_est,b4_est,b5_est' && jon.posiciones.batel.length === 0, 'formato 1: la lista se reparte con el tipo del propio archivo');
    assert(ORDEN_TIPOS.every(k => nagore.posiciones[k].join() === 'patron'), 'formato 1: el patrón vale en los tres tipos');
    assert(r1.datos.remeros.filter(x => x.disponible === false).length === 1, 'formato 1: la disponibilidad sigue en su columna');
    console.log('OK: posiciones por tipo de barco (migración, independencia entre tipos, Excel por tipo, formato 1 de la alineación)');
    state.config.tipoBarco = tipoPrev; reconstruirSlots(); }

  // ---------- confirmación antes de sustituir o borrar la plantilla (solo si ya hay remeros) ----------
  { const rtRem = state.remeros; let preguntas = 0, respuesta = true;
    window.confirm = () => { preguntas++; return respuesta; };
    state.remeros = [];
    assert(confirmarSiHayRemeros('x') === true && preguntas === 0, 'con la plantilla vacía no debe preguntar');
    state.remeros = [{id: 'a', nombre: 'A', peso: 80, posiciones: posicionesVacias(), disponible: true}];
    respuesta = false; assert(confirmarSiHayRemeros('x') === false && preguntas === 1, 'con remeros debe preguntar y respetar «Cancelar»');
    respuesta = true; assert(confirmarSiHayRemeros('x') === true && preguntas === 2, 'con remeros debe preguntar y respetar «Aceptar»');
    delete window.confirm; state.remeros = rtRem; }
  console.log('OK: confirmación antes de sustituir o borrar la plantilla');

  // ---------- vista básica / avanzada: solo cambia lo mostrado, nunca el cálculo ----------
  const usarTipo = k => { state.config.tipoBarco = k; state.config.barcoId = ''; cargarValoresBarco(TIPOS_BARCO[k]); reconstruirSlots(); }; // sin DOM, como seleccionarBarcoPredefinido
  assert(state.config.modoAvanzado === false, 'la vista por defecto es la básica');
  assert(state.config.tema === 'claro', 'el tema por defecto es el claro');
  ORDEN_TIPOS.forEach(k => {
    usarTipo(k); cargarEjemplo(false);
    const asig = optimizarTop3()[0].asignacion, ref = calcularPotenciaRef();
    state.config.prioridad = 'vatios';
    state.config.modoAvanzado = false;
    const evB = evaluar(asig, ref), htmlB = renderMetricsHTML(evB, asig);
    state.config.modoAvanzado = true;
    const evA = evaluar(asig, ref), htmlA = renderMetricsHTML(evA, asig);
    state.config.modoAvanzado = false; state.config.prioridad = 'peso';
    assert(JSON.stringify(evB) === JSON.stringify(evA), k + ': el modo avanzado no debe cambiar el cálculo');
    ['Asiento estimado', 'Dispersión de masas', 'Desequilibrio bandas — W/kg'].forEach(t => {
      assert(!htmlB.includes(t), k + ': «' + t + '» no debe verse en la vista básica');
      assert(htmlA.includes(t), k + ': «' + t + '» debe verse en la vista avanzada');
    });
    ['Desplazamiento del CG', 'Peso medio', 'Potencia total', 'Desequilibrio bandas — vatios'].forEach(t => {
      assert(htmlB.includes(t) && htmlA.includes(t), k + ': «' + t + '» debe verse siempre');
    });
    assert(!htmlB.includes('Desvío de trimado') && !htmlA.includes('Desvío de trimado'), k + ': el nombre antiguo no debe aparecer');
    assert(!/Cb impl/.test(htmlB + htmlA), k + ': la cifra de Cb ya no se muestra en las tarjetas');
    const puntos = h => (h.match(/r="6\.5"/g) || []).length;
    assert(puntos(htmlA) === puntos(htmlB) + 1, k + ': el punto de W/kg del círculo solo aparece en avanzado (' + puntos(htmlB) + ' vs ' + puntos(htmlA) + ')');
  });

  // ---------- aviso de coherencia de dimensiones (coeficiente de bloque con tripulación nominal) ----------
  ORDEN_TIPOS.forEach(k => {
    usarTipo(k);
    const cb = cbNominal();
    assert(cb > CB_RANGO_RAZONABLE[0] && cb < CB_RANGO_RAZONABLE[1] && avisoCb() === '', k + ': las dimensiones por defecto no deben dar aviso (Cb ' + cb + ')');
    state.config.eslora = TIPOS_BARCO[k].eslora * 100; // eslora tecleada en cm por error
    assert(avisoCb().includes('coeficiente de bloque'), k + ': una eslora absurda debe avisar');
    state.config.eslora = TIPOS_BARCO[k].eslora; state.config.calado = 0;
    assert(avisoCb().includes('faltan'), k + ': sin calado debe avisar de que no se puede comprobar');
    state.config.calado = TIPOS_BARCO[k].calado;
  });
  usarTipo('trainera');
  console.log('OK: vista básica/avanzada y aviso de Cb');

  // ---------- persistencia: localStorage como respaldo ----------
  (async () => {
    // ---------- guardado de Excel: navegador (writeFile) frente a app Android (Filesystem + Share de Capacitor) ----------
    const wbPrueba = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbPrueba, XLSX.utils.aoa_to_sheet([['Nombre', 'Peso'], ['Ander', 82]]), 'Hoja');
    const writeFileOriginal = XLSX.writeFile;
    let aWriteFile = [];
    XLSX.writeFile = (w, n) => { aWriteFile.push(n); };
    assert(esAppNativa() === false, 'sin window.Capacitor no es app nativa');
    await guardarXlsx(wbPrueba, 'web.xlsx');
    assert(aWriteFile.join() === 'web.xlsx', 'en navegador debe usar XLSX.writeFile');
    let escritos = [], compartidos = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      Filesystem: { writeFile: async o => { escritos.push(o); return { uri: 'file:///cache/' + o.path }; } },
      Share: { share: async o => { compartidos.push(o); return {}; } } } };
    aWriteFile = [];
    await guardarXlsx(wbPrueba, 'nativa.xlsx');
    assert(aWriteFile.length === 0, 'en la app nativa no debe usar XLSX.writeFile (no hay descarga por blob)');
    assert(escritos.length === 1 && escritos[0].path === 'nativa.xlsx' && escritos[0].directory === 'CACHE', 'Filesystem.writeFile mal invocado');
    assert(escritos[0].encoding === undefined, 'sin encoding: Filesystem interpreta data como base64');
    const leido = XLSX.read(escritos[0].data, { type: 'base64' });
    assert(leido.SheetNames[0] === 'Hoja' && leido.Sheets.Hoja.B2.v === 82, 'el base64 enviado no es el libro de Excel');
    assert(compartidos.length === 1 && compartidos[0].url === 'file:///cache/nativa.xlsx', 'Share.share debe recibir la URI escrita');
    // el usuario cierra el selector: sin error visible; un fallo real sí queda reflejado
    window.Capacitor.Plugins.Share.share = async () => { throw new Error('Share canceled'); };
    await guardarXlsx(wbPrueba, 'cancelado.xlsx');
    window.Capacitor.Plugins.Filesystem.writeFile = async () => { throw new Error('sin espacio'); };
    await guardarXlsx(wbPrueba, 'fallo.xlsx'); // no debe lanzar
    delete window.Capacitor.Plugins.Share;
    await guardarXlsx(wbPrueba, 'sinplugin.xlsx'); // plugin ausente: avisa, no lanza
    delete window.Capacitor; XLSX.writeFile = writeFileOriginal;
    console.log('OK: guardado de Excel en navegador y en app nativa');

    // ---------- claves de almacenamiento: prefijo propio y migración desde 'trainera:' ----------
    __mem['trainera:clave-migracion'] = 'valor-antiguo';
    assert(await storageGet('clave-migracion') === 'valor-antiguo', 'debe leer la clave antigua si no existe la nueva');
    assert(__mem['optimizador:clave-migracion'] === 'valor-antiguo', 'debe copiarla al prefijo nuevo');
    assert(__mem['trainera:clave-migracion'] === 'valor-antiguo', 'no debe borrar la antigua (podría ser de otra app)');
    __mem['optimizador:clave-migracion'] = 'valor-nuevo';
    assert(await storageGet('clave-migracion') === 'valor-nuevo', 'la clave nueva tiene prioridad sobre la antigua');
    await storageSet('otra', 'x');
    assert(__mem['optimizador:otra'] === 'x' && !('trainera:otra' in __mem), 'las claves nuevas se escriben solo con el prefijo nuevo');
    console.log('OK: claves de almacenamiento con prefijo propio y migración');

    cargarEjemplo(false);
    const n = state.remeros.length;
    await guardarRemeros();
    assert(__mem['optimizador:plantilla-remeros'], 'no se escribió en localStorage');
    state.remeros = [];
    const raw = await storageGet('plantilla-remeros');
    assert(JSON.parse(raw).length === n, 'la plantilla recuperada no coincide');
    await guardarBarcos();
    assert(JSON.parse(__mem['optimizador:maestro-barcos']).length === 4, 'el maestro no se guardó');
    window.storage = { get: async () => { throw new Error('boom'); }, set: async () => { throw new Error('boom'); } };
    assert(await storageGet('x') === null, 'un fallo de window.storage debe devolver null');
    console.log('OK: persistencia localStorage');
  })().then(() => console.log('OK: todas las comprobaciones pasaron'));
`;
const sandbox = `
  const assert = require('assert');
  const document = {getElementById:()=>null, querySelectorAll:()=>[], addEventListener:()=>{}, documentElement:{setAttribute(){}}};
  const window = {};
  const XLSX = require(${JSON.stringify(path.join(__dirname, '..', 'vendor', 'xlsx.full.min.js'))});
  XLSX.writeFile = (wb, nombre) => require('fs').writeFileSync(nombre, XLSX.write(wb, {type:'buffer', bookType:'xlsx'})); // writeFile de SheetJS no funciona en este entorno de pruebas
  XLSX.readFile = nombre => XLSX.read(require('fs').readFileSync(nombre), {type:'buffer'});
  process.chdir(${JSON.stringify(os.tmpdir())});
  const __mem = {}; const localStorage = {getItem:k=>(k in __mem?__mem[k]:null), setItem:(k,v)=>{__mem[k]=String(v);}};
  ${src.replace(/^\s*\(function\(\)\s*\{/, '').replace(/^\s*\(\s*\(\)\s*=>\s*\{/, '')}
  ${test}
`;
const tmp = path.join(os.tmpdir(), 'optimizador_test.js');
fs.writeFileSync(tmp, sandbox);
require('child_process').execFileSync('node', [tmp], {stdio: 'inherit'});
