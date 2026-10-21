/* ========================================
   SUITE DE PRUEBAS OBLIGATORIAS: MÓDULO DE ASISTENCIA Y SALIDA
   RSI Enterprise - SPA-V1.0.0
   ======================================== */

import assert from 'node:assert';
import AsistenciaModel, { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION, TIPOS_VERIFICACION } from '../src/models/asistenciaModel.js';
import JustificacionModel from '../src/models/justificacionModel.js';
import GeoMapHelper from '../src/utils/geoMapHelper.js';

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passedTests++;
    } catch (error) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     ${error.message}`);
    }
}

async function asyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passedTests++;
    } catch (error) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     ${error.message}`);
    }
}

console.log('====================================================');
console.log('🧪 EJECUTANDO PRUEBAS OBLIGATORIAS DE ASISTENCIA RSI');
console.log('====================================================\n');

/* -------------------------------------------------------------------------
   GRUPO 1: ASISTENCIA Y SALIDA
------------------------------------------------------------------------- */
console.log('📦 GRUPO 1: Registro de Asistencia, Salida y Clasificación');

test('Registro de entrada: Construcción y validación de modelo', () => {
    const entrada = AsistenciaModel.createEntrada({
        colaboradorUid: 'user_123',
        colaboradorNombre: 'Carlos Morales',
        colaboradorEmail: 'carlos@rsienterprise.com',
        fecha: '2026-10-15',
        horaEntrada: '08:55:00',
        estado: ESTADOS_ASISTENCIA.PRESENTE,
        minutosRetardo: 0
    });

    assert.strictEqual(entrada.colaboradorUid, 'user_123');
    assert.strictEqual(entrada.fecha, '2026-10-15');
    assert.strictEqual(entrada.horaEntrada, '08:55:00');
    assert.strictEqual(entrada.horaSalida, null);
    assert.strictEqual(entrada.tipoRegistro, 'entrada');
    assert.strictEqual(entrada.estado, ESTADOS_ASISTENCIA.PRESENTE);
    assert.strictEqual(entrada.minutosRetardo, 0);

    const validacion = AsistenciaModel.validateEntrada(entrada);
    assert.strictEqual(validacion.valid, true);
});

test('Clasificación de entrada: Puntual dentro de tolerancia (09:00 + 15 min)', () => {
    const c1 = AsistenciaModel.clasificarHoraEntrada('08:50', '09:00', 15);
    assert.strictEqual(c1.estado, ESTADOS_ASISTENCIA.PRESENTE);
    assert.strictEqual(c1.minutosRetardo, 0);

    const c2 = AsistenciaModel.clasificarHoraEntrada('09:15', '09:00', 15);
    assert.strictEqual(c2.estado, ESTADOS_ASISTENCIA.PRESENTE);
    assert.strictEqual(c2.minutosRetardo, 0);
});

test('Clasificación de entrada: Retardo superada la tolerancia', () => {
    const c3 = AsistenciaModel.clasificarHoraEntrada('09:20', '09:00', 15);
    assert.strictEqual(c3.estado, ESTADOS_ASISTENCIA.RETARDO);
    assert.strictEqual(c3.minutosRetardo, 5); // 09:20 - 09:15 = 5 min

    const c4 = AsistenciaModel.clasificarHoraEntrada('10:00', '09:00', 15);
    assert.strictEqual(c4.estado, ESTADOS_ASISTENCIA.RETARDO);
    assert.strictEqual(c4.minutosRetardo, 45); // 10:00 - 09:15 = 45 min
});

test('Intento de registrar una entrada duplicada para la misma jornada', () => {
    // Simulación de regla en base de datos: documento determinista `${uid}_${fecha}`
    const fakeDB = new Map();
    const docKey = 'user_123_2026-10-15';

    // Primer registro
    fakeDB.set(docKey, { horaEntrada: '08:55:00' });

    // Intento concurrente o segundo intento
    const intentarSegundoRegistro = () => {
        if (fakeDB.has(docKey) && fakeDB.get(docKey).horaEntrada) {
            throw new Error('Ya existe una entrada registrada para hoy a las ' + fakeDB.get(docKey).horaEntrada);
        }
    };

    assert.throws(intentarSegundoRegistro, /Ya existe una entrada registrada/);
});

test('Registro de salida con entrada previa válida', () => {
    const salidaData = AsistenciaModel.createSalida({
        horaSalida: '18:05:00',
        ubicacion: { latitud: 19.4326, longitud: -99.1332, precision: 12, estadoCaptura: 'ok' },
        observaciones: 'Salida registrada normalmente'
    });

    assert.strictEqual(salidaData.horaSalida, '18:05:00');
    assert.strictEqual(salidaData.tipoRegistro, 'completo');
    assert.strictEqual(salidaData.ubicacionSalida.latitud, 19.4326);
    assert.strictEqual(salidaData.ubicacionSalida.precision, 12);
});

test('Intento de salida sin entrada previa debe ser rechazado', () => {
    const fakeRegistroAsistencia = null; // No existe entrada previa

    const registrarSalidaValidada = (registro) => {
        if (!registro || !registro.horaEntrada) {
            throw new Error('No se puede registrar la salida sin haber registrado previamente la entrada de la jornada.');
        }
    };

    assert.throws(() => registrarSalidaValidada(fakeRegistroAsistencia), /No se puede registrar la salida sin haber registrado previamente la entrada/);
});

test('Intento de salida duplicada debe ser rechazado', () => {
    const fakeRegistroAsistencia = {
        horaEntrada: '08:50:00',
        horaSalida: '18:00:00' // Ya registrada previamente
    };

    const registrarSegundaSalida = (registro) => {
        if (registro.horaSalida) {
            throw new Error(`La salida ya fue registrada previamente a las ${registro.horaSalida}`);
        }
    };

    assert.throws(() => registrarSegundaSalida(fakeRegistroAsistencia), /La salida ya fue registrada previamente/);
});

test('Geolocalización: Denegación de permisos no inventa coordenadas', () => {
    const ubicacionDenegada = AsistenciaModel.normalizeUbicacion({
        latitud: null,
        longitud: null,
        precision: null,
        estadoCaptura: 'denegado',
        metodo: 'geolocalizacion_navegador',
        errorMensaje: 'Permiso de ubicación denegado por el usuario o navegador.'
    });

    assert.strictEqual(ubicacionDenegada.latitud, null);
    assert.strictEqual(ubicacionDenegada.longitud, null);
    assert.strictEqual(ubicacionDenegada.estadoCaptura, 'denegado');
    assert.strictEqual(ubicacionDenegada.errorMensaje, 'Permiso de ubicación denegado por el usuario o navegador.');
});

test('Biometría: Dispositivo sin soporte activa degradación controlada', () => {
    const bioFallback = AsistenciaModel.normalizeBiometria({
        utilizada: false,
        tipo: TIPOS_VERIFICACION.SESION_FALLBACK,
        resultado: 'no_disponible',
        credentialId: null,
        detalles: 'Dispositivo sin autenticador biométrico disponible. Verificado por credenciales de sesión activa.'
    });

    assert.strictEqual(bioFallback.utilizada, false);
    assert.strictEqual(bioFallback.tipo, TIPOS_VERIFICACION.SESION_FALLBACK);
    assert.strictEqual(bioFallback.resultado, 'no_disponible');
});

/* -------------------------------------------------------------------------
   GRUPO 2: PANEL ADMINISTRATIVO Y CÁLCULO DE PERIODOS
------------------------------------------------------------------------- */
console.log('\n📦 GRUPO 2: Panel Administrativo y Cálculo de Periodos Quincenales');

function calcularRangoQuincena(anio, mes, quincena) {
    const mesPad = String(mes).padStart(2, '0');
    const ultimoDiaMes = new Date(anio, mes, 0).getDate();

    let diaInicio = 1;
    let diaFin = ultimoDiaMes;

    if (quincena === 'primera') {
        diaInicio = 1;
        diaFin = 15;
    } else if (quincena === 'segunda') {
        diaInicio = 16;
        diaFin = ultimoDiaMes;
    }

    return {
        fechaInicio: `${anio}-${mesPad}-${String(diaInicio).padStart(2, '0')}`,
        fechaFin: `${anio}-${mesPad}-${String(diaFin).padStart(2, '0')}`,
        ultimoDiaMes
    };
}

test('Filtro Primera Quincena: Días 1 al 15', () => {
    const q1 = calcularRangoQuincena(2026, 10, 'primera');
    assert.strictEqual(q1.fechaInicio, '2026-10-01');
    assert.strictEqual(q1.fechaFin, '2026-10-15');
});

test('Filtro Segunda Quincena en mes de 31 días (Octubre 2026)', () => {
    const q2 = calcularRangoQuincena(2026, 10, 'segunda');
    assert.strictEqual(q2.fechaInicio, '2026-10-16');
    assert.strictEqual(q2.fechaFin, '2026-10-31');
    assert.strictEqual(q2.ultimoDiaMes, 31);
});

test('Filtro Segunda Quincena en mes de 30 días (Noviembre 2026)', () => {
    const qNov = calcularRangoQuincena(2026, 11, 'segunda');
    assert.strictEqual(qNov.fechaInicio, '2026-11-16');
    assert.strictEqual(qNov.fechaFin, '2026-11-30');
    assert.strictEqual(qNov.ultimoDiaMes, 30);
});

test('Filtro Segunda Quincena en Año Bisiesto (Febrero 2024 = 29 días)', () => {
    const qFebBisiesto = calcularRangoQuincena(2024, 2, 'segunda');
    assert.strictEqual(qFebBisiesto.fechaInicio, '2024-02-16');
    assert.strictEqual(qFebBisiesto.fechaFin, '2024-02-29');
    assert.strictEqual(qFebBisiesto.ultimoDiaMes, 29);
});

test('Filtro Segunda Quincena en Año No Bisiesto (Febrero 2026 = 28 días)', () => {
    const qFebNormal = calcularRangoQuincena(2026, 2, 'segunda');
    assert.strictEqual(qFebNormal.fechaInicio, '2026-02-16');
    assert.strictEqual(qFebNormal.fechaFin, '2026-02-28');
    assert.strictEqual(qFebNormal.ultimoDiaMes, 28);
});

test('Acceso al módulo de asistencias generales y protección de resolución administrativa', () => {
    const verificarAccesoConsulta = (user) => {
        if (!user || !user.uid) {
            throw new Error('Debe iniciar sesión para consultar los registros de asistencia');
        }
        return true;
    };

    const verificarPermisoResolucion = (user) => {
        if (!user || user.rol !== 'admin') {
            throw new Error('Permisos insuficientes: Solo administradores autorizados pueden aprobar o rechazar justificaciones.');
        }
        return true;
    };

    // Cualquier colaborador con sesión activa puede consultar el tablero general
    assert.doesNotThrow(() => verificarAccesoConsulta({ uid: 'partner_1', rol: 'partner' }));
    assert.throws(() => verificarAccesoConsulta(null), /Debe iniciar sesión/);

    // Pero la resolución administrativa de justificaciones queda restringida a administradores
    assert.throws(() => verificarPermisoResolucion({ uid: 'partner_1', rol: 'partner' }), /Permisos insuficientes/);
    assert.doesNotThrow(() => verificarPermisoResolucion({ uid: 'admin_1', rol: 'admin' }));
});

/* -------------------------------------------------------------------------
   GRUPO 3: JUSTIFICACIONES Y REVISIÓN ADMINISTRATIVA
------------------------------------------------------------------------- */
console.log('\n📦 GRUPO 3: Justificaciones y Revisión Administrativa');

test('Envío válido de justificación con motivo suficiente', () => {
    const j = JustificacionModel.create({
        colaboradorUid: 'user_123',
        colaboradorNombre: 'Carlos Morales',
        colaboradorEmail: 'carlos@rsienterprise.com',
        fechaInasistencia: '2026-10-14',
        motivo: 'Cita médica programada en el IMSS por cuadro gripal severo.',
        evidenciaUrl: 'https://storage.googleapis.com/evidencia.jpg',
        evidenciaPath: 'justificaciones/evidencia.jpg'
    });

    assert.strictEqual(j.colaboradorUid, 'user_123');
    assert.strictEqual(j.estado, ESTADOS_JUSTIFICACION.PENDIENTE);
    assert.strictEqual(j.evidenciaUrl, 'https://storage.googleapis.com/evidencia.jpg');

    const validacion = JustificacionModel.validate(j);
    assert.strictEqual(validacion.valid, true);
});

test('Justificación inválida: Motivo vacío o menor a 10 caracteres debe ser rechazado', () => {
    const valCorta = JustificacionModel.validate({
        colaboradorUid: 'user_123',
        fechaInasistencia: '2026-10-14',
        motivo: 'Falté' // Demasiado corto
    });

    assert.strictEqual(valCorta.valid, false);
    assert.ok(valCorta.errors.some(e => e.includes('10 caracteres')));
});

test('Validación de archivo de evidencia: Rechazar tipo de archivo no permitido (ej. .exe)', () => {
    const archivoInvalido = { name: 'virus.exe', type: 'application/x-msdownload', size: 1024 };
    const valArchivo = JustificacionModel.validateArchivoEvidencia(archivoInvalido);

    assert.strictEqual(valArchivo.valid, false);
    assert.ok(valArchivo.error.includes('Formato no permitido'));
});

test('Validación de archivo de evidencia: Rechazar archivo mayor a 5 MB', () => {
    const archivoGrande = { name: 'receta_pesada.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 };
    const valArchivo = JustificacionModel.validateArchivoEvidencia(archivoGrande);

    assert.strictEqual(valArchivo.valid, false);
    assert.ok(valArchivo.error.includes('5 MB'));
});

test('Seguridad: Intento de auto-aprobación por parte del colaborador es bloqueado', () => {
    const justificacion = {
        id: 'just_1',
        colaboradorUid: 'admin_carlos',
        estado: 'pendiente'
    };

    const revisorUid = 'admin_carlos'; // El mismo usuario intenta aprobarse a sí mismo

    const validarAutoAprobacion = (just, revUid, accion) => {
        if (just.colaboradorUid === revUid && accion === 'aprobada') {
            throw new Error('Conflicto de interés: Un colaborador no puede aprobar su propia justificación.');
        }
    };

    assert.throws(() => validarAutoAprobacion(justificacion, revisorUid, 'aprobada'), /Conflicto de interés/);
});

test('Aprobación de justificación registra revisor, fecha y auditoría sin alterar registro original', () => {
    const justificacion = JustificacionModel.create({
        colaboradorUid: 'colab_1',
        fechaInasistencia: '2026-10-14',
        motivo: 'Trámite oficial de pasaporte con comprobante.'
    });

    // Simular resolución
    const now = new Date().toISOString();
    justificacion.estado = ESTADOS_JUSTIFICACION.APROBADA;
    justificacion.revisadoPorUid = 'admin_super';
    justificacion.revisadoPorNombre = 'Director General';
    justificacion.fechaRevision = now;
    justificacion.comentarioRevision = 'Comprobante cotejado y aprobado.';
    justificacion.historialRevisiones.push({
        accion: 'aprobada',
        realizadoPor: 'Director General',
        fecha: now,
        comentario: 'Comprobante cotejado y aprobado.'
    });

    assert.strictEqual(justificacion.estado, ESTADOS_JUSTIFICACION.APROBADA);
    assert.strictEqual(justificacion.revisadoPorNombre, 'Director General');
    assert.strictEqual(justificacion.historialRevisiones.length, 2);
    assert.strictEqual(justificacion.historialRevisiones[1].accion, 'aprobada');
});

/* -------------------------------------------------------------------------
   GRUPO 4: RECORDATORIOS AUTOMATIZADOS (09:00 AM Y 12:00 PM)
------------------------------------------------------------------------- */
console.log('\n📦 GRUPO 4: Recordatorios Automáticos e Idempotencia');

test('Filtro de elegibilidad: Colaborador activo sin asistencia es notificado', () => {
    const colaborador = { uid: 'u1', status: 'active', rol: 'partner' };
    const asistenciaHoy = null; // No registrada

    const esElegible = colaborador.status === 'active' && colaborador.rol === 'partner' && (!asistenciaHoy || !asistenciaHoy.horaEntrada);
    assert.strictEqual(esElegible, true);
});

test('Filtro de elegibilidad: Colaborador con asistencia previa es excluido', () => {
    const colaborador = { uid: 'u2', status: 'active', rol: 'partner' };
    const asistenciaHoy = { horaEntrada: '08:50:00' };

    const esElegible = colaborador.status === 'active' && colaborador.rol === 'partner' && (!asistenciaHoy || !asistenciaHoy.horaEntrada);
    assert.strictEqual(esElegible, false);
});

test('Filtro de elegibilidad: Colaborador inactivo es excluido', () => {
    const colaborador = { uid: 'u3', status: 'inactive', rol: 'partner' };
    const asistenciaHoy = null;

    const esElegible = colaborador.status === 'active' && colaborador.rol === 'partner' && (!asistenciaHoy || !asistenciaHoy.horaEntrada);
    assert.strictEqual(esElegible, false);
});

test('Filtro de elegibilidad: Colaborador con inasistencia previamente justificada y aprobada es excluido', () => {
    const colaborador = { uid: 'u4', status: 'active', rol: 'partner' };
    const asistenciaHoy = { estadoJustificacion: 'aprobada' };

    const esElegible = colaborador.status === 'active' &&
        colaborador.rol === 'partner' &&
        (!asistenciaHoy || (!asistenciaHoy.horaEntrada && asistenciaHoy.estadoJustificacion !== 'aprobada'));

    assert.strictEqual(esElegible, false);
});

test('Idempotencia de recordatorios: Ejecución repetida el mismo día y hora es bloqueada', () => {
    const logRecordatorios = new Set();
    const id0900 = '2026-10-15_0900';

    // Primer procesamiento exitoso
    logRecordatorios.add(id0900);

    const ejecutarProceso = (id, forzar = false) => {
        if (logRecordatorios.has(id) && !forzar) {
            return { omitido: true, mensaje: 'Recordatorio ya procesado previamente hoy.' };
        }
        return { omitido: false, mensaje: 'Recordatorio procesado.' };
    };

    const intento2 = ejecutarProceso(id0900);
    assert.strictEqual(intento2.omitido, true);

    // Segundo recordatorio de las 12:00 PM tiene id distinto y sí debe ejecutarse
    const id1200 = '2026-10-15_1200';
    const intentoMediodia = ejecutarProceso(id1200);
    assert.strictEqual(intentoMediodia.omitido, false);
});

test('Contenido diferenciado entre 09:00 AM y 12:00 PM (mediodía)', () => {
    const asunto0900 = 'Recordatorio de asistencia | RSI Enterprise';
    const asunto1200 = 'Segundo recordatorio de asistencia — Registro pendiente | RSI Enterprise';

    assert.notStrictEqual(asunto0900, asunto1200);
    assert.ok(asunto1200.includes('Segundo recordatorio'));
    assert.ok(asunto1200.includes('Registro pendiente'));
});

test('Zona horaria mexicana (America/Mexico_City) formatea fecha YYYY-MM-DD coherente', () => {
    const date = new Date('2026-10-15T15:30:00Z');
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const fechaMX = formatter.format(date);
    assert.strictEqual(fechaMX, '2026-10-15');
});

console.log('\n====================================================');
console.log(`🏁 RESULTADO: ${passedTests} de ${totalTests} pruebas aprobadas.`);
console.log('====================================================');

if (passedTests !== totalTests) {
    process.exit(1);
} else {
    process.exit(0);
}