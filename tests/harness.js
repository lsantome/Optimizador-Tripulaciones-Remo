// Pruebas de humo: extrae el <script> principal de index.html y ejecuta la lógica sin navegador.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let src = scripts.sort((a, b) => b.length - a.length)[0];
const cut = src.indexOf('function renderBanco()');
assert(cut > 0, 'No se encontró renderBanco(): ajusta el punto de corte en tests/harness.js');
src = src.slice(0, cut);

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
      const p = {id: 'x' + i, nombre: 'P' + i, peso: s.role === 'patron' ? 60 : 70 + 10 * i, potencia: s.role === 'patron' ? undefined : 200 + 20 * i, posiciones: s.role === 'patron' ? ['patron'] : [], disponible: true};
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
  assert(!puedeRemar({posiciones:['patron']}), 'un patrón puro no debe remar');

  // ---------- importación de tripulación ----------
  const numerico = procesarFilasExcel([['n','p','pos','w'],['N',70,'1,3',250],['M',70,3,250]]);
  assert(numerico.remeros[0].posiciones.join() === 'e1,e3' && numerico.remeros[1].posiciones.join() === 'e3', 'posiciones numéricas de bancadas individuales');
  const ok = procesarFilasExcel([['n','p','pos','w'],['A',80,'1B,2E',300],['B',70,'T','']]);
  assert(ok.remeros.length === 2 && ok.errores.length === 0, 'import válido falló');
  const vacio = procesarFilasExcel([['n','p','pos','w'],['E',80,'',300]]);
  assert(vacio.remeros.length === 1 && vacio.remeros[0].posiciones.length === 0 && vacio.errores.length === 0, 'posiciones vacías deben importarse sin restricción');
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
  assert(rc.remeros.length === 4 && rc.errores.length === 0, 'la plantilla de tripulación debe reimportarse limpia: ' + rc.errores.join('|'));

  // ---------- alineación reimportable: exportar -> abrir debe devolver exactamente lo mismo ----------
  assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fechaArchivo()), 'fechaArchivo debe ser AAAA-MM-DD');
  const rtNumericos = ev => Object.keys(ev).filter(k => typeof ev[k] === 'number' || ev[k] === null).reduce((o, k) => { o[k] = ev[k]; return o; }, {});
  const rtPorPuesto = asig => Object.keys(asig).sort().map(sid => { const p = buscarPersona(asig[sid]); return sid + '=' + p.nombre + '|' + p.peso + '|' + p.potencia + '|' + p.posiciones.join('+') + '|' + p.disponible; });
  const rtAjustes = () => JSON.stringify(Object.keys(AJUSTES_TEXTO).concat(AJUSTES_NUM.map(a => a[0])).map(k => [k, state.config[k]]));
  const rtEditar = (wb, fn) => { const aoa = XLSX.utils.sheet_to_json(wb.Sheets[HOJA_DATOS], {header:1, defval:''}); fn(aoa); wb.Sheets[HOJA_DATOS] = XLSX.utils.aoa_to_sheet(aoa); return wb; };
  const rtLibro = nombre => XLSX.readFile(nombre);
  const rtBarcosPrevios = state.barcos, rtConfigPrevia = JSON.parse(JSON.stringify(state.config)); // este bloque cambia el estado compartido: se restaura al terminar
  ORDEN_TIPOS.forEach(k => {
    state.config.tipoBarco = k; state.config.barcoId = ''; cargarValoresBarco(TIPOS_BARCO[k]);
    state.config.prioridad = 'wkg'; state.config.wBanda = 1.7; state.config.categoria = 'senior_f'; state.config.bandaInicio = 'estribor';
    state.config.proelBanda = 'estribor'; state.config.xTrimObjetivo = 0.47; state.config.pesoMedioObjetivo = 79; state.config.calado = 0.21;
    reconstruirSlots(); cargarEjemplo(false);
    state.remeros[3].disponible = false; state.remeros[4].posiciones = ['b2_bab', 'b2_est', 'e1', 'e2'].filter(id => SLOTS.some(sl => sl.id === id));
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
  rtFalla('posiciones desconocidas', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'REMERO')[5] = '9Z'; }), 'posiciones no reconocidas');
  rtFalla('puesto inexistente', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'PUESTO')[1] = 'e5'; }), 'no existe');
  rtFalla('remero inexistente en un puesto', rtEditar(rtCopia(), a => { a.find(f => f[0] === 'PUESTO')[2] = 999; }), 'no existe');
  rtFalla('mismo remero en dos puestos', rtEditar(rtCopia(), a => { const p = a.filter(f => f[0] === 'PUESTO'); p[1][2] = p[0][2]; }), 'dos puestos');
  rtFalla('falta un ajuste', rtEditar(rtCopia(), a => { a.splice(a.findIndex(f => f[1] === 'calado'), 1); }), 'calado');
  rtFalla('sin remeros', rtEditar(rtCopia(), a => { for(let i = a.length - 1; i > 0; i--) if(a[i][0] === 'REMERO' || a[i][0] === 'PUESTO') a.splice(i, 1); }), 'ningún remero');
  assert(JSON.stringify([state.remeros.length, state.config, Object.keys(state.asignacionManual)]) === rtEstado, 'leer un archivo no válido no debe modificar el estado');
  console.log('OK: archivos no válidos rechazados con mensaje claro y sin tocar el estado');
  state.barcos = rtBarcosPrevios; Object.assign(state.config, rtConfigPrevia); reconstruirSlots(); state.asignacionManual = {}; state.resultadosAuto = [];

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
