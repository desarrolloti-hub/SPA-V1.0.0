/* ========================================
   ASISTENCIA SERVICE - RSI ENTERPRISE
   Lógica de negocio para asistencias, salidas y cálculo de periodos
   ======================================== */

import AsistenciaRepository from '../repositories/asistenciaRepository.js';
import JustificacionRepository from '../repositories/justificacionRepository.js';
import NewCollaboratorRepository from '../repositories/partnerRepository.js';
import AsistenciaModel, { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION } from '../models/asistenciaModel.js';
import GeoMapHelper from '../utils/geoMapHelper.js';
import BiometricAuthHelper from '../utils/biometricAuth.js';
import AuthService from './authService.js';
import { db, doc, getDoc } from '../config/firebaseConfig.js';

export class AsistenciaService {
    constructor() {
        this.asistenciaRepo = new AsistenciaRepository();
        this.justificacionRepo = new JustificacionRepository();
        this.partnerRepo = new NewCollaboratorRepository();
        this.authService = new AuthService();
        this.zonaHoraria = 'America/Mexico_City';
        this.defaultConfig = {
            horaEntradaOficial: '09:00',
            toleranciaMinutos: 15,
            horaSalidaOficial: '18:00',
            zonaHoraria: 'America/Mexico_City'
        };
    }

    /**
     * Obtiene la sesión actual del usuario autenticado
     */
    _getSession() {
        return this.authService.getSession();
    }

    /**
     * Comprueba si el usuario tiene rol administrativo (admin)
     */
    _isAdmin(session = null) {
        const user = session || this._getSession();
        return user && (user.rol === 'admin' || user.tipoColaborador === 'administrador');
    }

    /**
     * Obtiene la fecha y hora actuales en la zona horaria de la organización (America/Mexico_City)
     */
    getFechaHoraActual() {
        const now = new Date();
        const opcionesFecha = { timeZone: this.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' };
        const opcionesHora = { timeZone: this.zonaHoraria, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

        const formatterFecha = new Intl.DateTimeFormat('en-CA', opcionesFecha); // Devuelve YYYY-MM-DD
        const formatterHora = new Intl.DateTimeFormat('es-MX', opcionesHora); // Devuelve HH:mm:ss

        const fecha = formatterFecha.format(now);
        const hora = formatterHora.format(now);

        return {
            fecha,
            hora,
            timestamp: now.toISOString(),
            ahora: now
        };
    }

    /**
     * Carga la configuración de horarios de la organización desde Firestore (o defaults)
     */
    async getConfiguracion() {
        try {
            const configRef = doc(db, 'configuracion', 'asistencia');
            const docSnap = await getDoc(configRef);
            if (docSnap.exists()) {
                return {
                    ...this.defaultConfig,
                    ...docSnap.data()
                };
            }
        } catch (error) {
            console.warn('⚠️ Usando configuración predeterminada de horarios:', error.message);
        }
        return this.defaultConfig;
    }

    /**
     * Obtiene el estado de asistencia de hoy para el colaborador en sesión
     */
    async getEstadoHoy() {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('No hay una sesión activa de colaborador.');
        }

        const { fecha, hora } = this.getFechaHoraActual();
        const config = await this.getConfiguracion();
        const asistencia = await this.asistenciaRepo.getAsistenciaHoy(session.uid, fecha);

        return {
            fechaActual: fecha,
            horaActual: hora,
            config,
            asistencia,
            haRegistradoEntrada: !!(asistencia && asistencia.horaEntrada),
            haRegistradoSalida: !!(asistencia && asistencia.horaSalida),
            colaborador: {
                uid: session.uid,
                nombreCompleto: session.nombreCompleto || session.displayName || 'Colaborador',
                email: session.email || session.emailEmpresarial || '',
                fotoPerfil: session.fotoPerfil || null,
                areaNombre: session.areaNombre || 'General',
                subareaNombre: session.subareaNombre || ''
            }
        };
    }

    /**
     * Ejecuta el flujo completo de registro de Entrada
     * @param {Object} [opciones={}]
     * @param {boolean} [opciones.omitirBiometria=false]
     */
    async registrarEntrada(opciones = {}) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para registrar su asistencia.' };
        }

        const { fecha, hora } = this.getFechaHoraActual();

        // 1. Verificar si ya existe registro de entrada para hoy
        const asistenciaExistente = await this.asistenciaRepo.getAsistenciaHoy(session.uid, fecha);
        if (asistenciaExistente && asistenciaExistente.horaEntrada) {
            return {
                success: false,
                error: `Ya tienes registrada tu entrada de hoy a las ${asistenciaExistente.horaEntrada}. No es posible registrar múltiples entradas.`
            };
        }

        // 2. Capturar geolocalización
        console.log('📍 Solicitando ubicación del dispositivo para entrada...');
        const resultadoGeo = await GeoMapHelper.obtenerPosicionActual();

        // 3. Verificación biométrica (WebAuthn / Passkeys)
        let resultadoBio = null;
        if (!opciones.omitirBiometria) {
            console.log('🔐 Solicitando verificación biométrica segura del dispositivo...');
            resultadoBio = await BiometricAuthHelper.verificarIdentidad({
                colaboradorUid: session.uid,
                colaboradorNombre: session.nombreCompleto || session.displayName,
                colaboradorEmail: session.emailEmpresarial || session.email
            });
        } else {
            resultadoBio = {
                utilizada: false,
                tipo: 'sesion_segura_fallback',
                resultado: 'omitido',
                credentialId: null,
                detalles: 'Biometría omitida por selección del usuario. Registrado por sesión activa.'
            };
        }

        // 4. Clasificar entrada (puntual o retardo)
        const config = await this.getConfiguracion();
        const clasificacion = AsistenciaModel.clasificarHoraEntrada(
            hora,
            config.horaEntradaOficial,
            config.toleranciaMinutos
        );

        // 5. Construir modelo de entrada
        const payloadEntrada = AsistenciaModel.createEntrada({
            colaboradorUid: session.uid,
            colaboradorNombre: session.nombreCompleto || session.displayName || 'Colaborador',
            colaboradorEmail: session.emailEmpresarial || session.email || '',
            colaboradorFoto: session.fotoPerfil || null,
            areaId: session.areaId || '',
            areaNombre: session.areaNombre || '',
            subareaNombre: session.subareaNombre || '',
            fecha,
            horaEntrada: hora,
            estado: clasificacion.estado,
            minutosRetardo: clasificacion.minutosRetardo,
            ubicacion: resultadoGeo,
            verificacionBiometrica: resultadoBio,
            observaciones: clasificacion.estado === ESTADOS_ASISTENCIA.RETARDO
                ? `Registro con retardo de ${clasificacion.minutosRetardo} minutos sobre el horario oficial (${config.horaEntradaOficial})`
                : 'Asistencia registrada puntualmente'
        });

        // 6. Persistir en Firestore de forma atómica
        const resultadoGuardado = await this.asistenciaRepo.registrarEntrada(payloadEntrada);

        if (resultadoGuardado.success) {
            return {
                success: true,
                asistencia: payloadEntrada,
                clasificacion,
                mensaje: clasificacion.estado === ESTADOS_ASISTENCIA.RETARDO
                    ? `Entrada registrada a las ${hora}. Presentas un retardo de ${clasificacion.minutosRetardo} minutos.`
                    : `¡Excelente día! Entrada puntual registrada a las ${hora}.`
            };
        }

        return resultadoGuardado;
    }

    /**
     * Ejecuta el flujo completo de registro de Salida
     */
    async registrarSalida() {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para registrar su salida.' };
        }

        const { fecha, hora } = this.getFechaHoraActual();

        // 1. Validar que exista una entrada previa válida
        const asistencia = await this.asistenciaRepo.getAsistenciaHoy(session.uid, fecha);
        if (!asistencia || !asistencia.horaEntrada) {
            return {
                success: false,
                error: 'No se puede registrar la salida sin haber registrado previamente la entrada de la jornada.'
            };
        }

        if (asistencia.horaSalida) {
            return {
                success: false,
                error: `La salida ya fue registrada previamente a las ${asistencia.horaSalida}.`
            };
        }

        // 2. Capturar geolocalización consentida
        console.log('📍 Capturando ubicación para registro de salida...');
        const resultadoGeo = await GeoMapHelper.obtenerPosicionActual();

        // 3. Crear modelo de salida
        const payloadSalida = AsistenciaModel.createSalida({
            horaSalida: hora,
            ubicacion: resultadoGeo,
            observaciones: 'Salida de jornada laboral registrada'
        });

        // 4. Actualizar atómicamente
        const resultado = await this.asistenciaRepo.registrarSalida(session.uid, fecha, payloadSalida);

        if (resultado.success) {
            return {
                success: true,
                horaSalida: hora,
                mensaje: `Salida de la jornada registrada exitosamente a las ${hora}. ¡Buen descanso!`
            };
        }

        return resultado;
    }

    /**
     * Obtiene el historial personal del colaborador en sesión exclusivamente para el mes solicitado
     * (por defecto el mes en curso), utilizando los índices compuestos de Firestore.
     * Un nuevo mes no muestra registros de meses anteriores a menos que el usuario seleccione un filtro de mes/año.
     * @param {Object|number} [opciones={}] - { anio, mes, estado }
     */
    async getMiHistorial(opciones = {}) {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('Sesión no encontrada');
        }

        const { fecha: fechaActualHoy } = this.getFechaHoraActual();
        const [anioHoyStr, mesHoyStr, diaHoyStr] = fechaActualHoy.split('-');
        const anioHoy = parseInt(anioHoyStr, 10);
        const mesHoy = parseInt(mesHoyStr, 10);
        const diaHoy = parseInt(diaHoyStr, 10);

        const esObjetoOpciones = opciones && typeof opciones === 'object' && !Array.isArray(opciones);
        const anioTarget = esObjetoOpciones && opciones.anio ? parseInt(opciones.anio, 10) : anioHoy;
        const mesTarget = esObjetoOpciones && opciones.mes ? parseInt(opciones.mes, 10) : mesHoy;
        const estadoFiltro = esObjetoOpciones && opciones.estado ? opciones.estado : 'todos';

        const mesPad = String(mesTarget).padStart(2, '0');
        const ultimoDiaMes = new Date(anioTarget, mesTarget, 0).getDate();
        const fechaInicioMes = `${anioTarget}-${mesPad}-01`;
        const fechaFinMes = `${anioTarget}-${mesPad}-${String(ultimoDiaMes).padStart(2, '0')}`;

        // Consultar exclusivamente el mes seleccionado usando los índices compuestos
        const [registros, justificaciones] = await Promise.all([
            this.asistenciaRepo.getHistorialColaboradorPorMes(session.uid, anioTarget, mesTarget),
            this.justificacionRepo.getJustificacionesPorPeriodo({
                fechaInicio: fechaInicioMes,
                fechaFin: fechaFinMes,
                colaboradorUid: session.uid
            })
        ]);

        const justPorFecha = new Map();
        (justificaciones || []).forEach(j => {
            if (j.fechaInasistencia && j.fechaInasistencia >= fechaInicioMes && j.fechaInasistencia <= fechaFinMes) {
                if (!justPorFecha.has(j.fechaInasistencia)) {
                    justPorFecha.set(j.fechaInasistencia, j);
                }
            }
        });

        const mapaPorFecha = new Map();
        (registros || []).forEach(r => {
            if (!r.fecha || r.fecha < fechaInicioMes || r.fecha > fechaFinMes) return;
            const just = justPorFecha.get(r.fecha);
            const esAsistenciaReal = Boolean(r.horaEntrada || r.estado === ESTADOS_ASISTENCIA.PRESENTE || r.estado === ESTADOS_ASISTENCIA.RETARDO);
            mapaPorFecha.set(r.fecha, {
                ...r,
                justificacionId: esAsistenciaReal ? null : (r.justificacionId || just?.id || null),
                estadoJustificacion: esAsistenciaReal
                    ? ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION
                    : (just?.estado || r.estadoJustificacion || ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION),
                autorizadoPor: just?.autorizadoPor || just?.revisadoPorNombre || r.autorizadoPor || r.revisadoPorNombre || ''
            });
        });

        // Incluir justificaciones de inasistencia dentro del mes consultado
        justPorFecha.forEach((just, fechaInas) => {
            if (!mapaPorFecha.has(fechaInas)) {
                mapaPorFecha.set(fechaInas, {
                    id: `${session.uid}_${fechaInas}`,
                    colaboradorUid: session.uid,
                    fecha: fechaInas,
                    horaEntrada: null,
                    horaSalida: null,
                    estado: ESTADOS_ASISTENCIA.INASISTENCIA,
                    minutosRetardo: 0,
                    justificacionId: just.id,
                    estadoJustificacion: just.estado || ESTADOS_JUSTIFICACION.PENDIENTE,
                    autorizadoPor: just.autorizadoPor || just.revisadoPorNombre || ''
                });
            }
        });

        // Completar días hábiles transcurridos dentro del mes consultado sin asistencia como Inasistencia
        const esMesActual = anioTarget === anioHoy && mesTarget === mesHoy;
        const esMesPasado = (anioTarget < anioHoy) || (anioTarget === anioHoy && mesTarget < mesHoy);

        if (esMesActual || esMesPasado) {
            const limiteDia = esMesActual ? diaHoy : ultimoDiaMes;
            for (let d = 1; d <= limiteDia; d++) {
                const f = `${anioTarget}-${mesPad}-${String(d).padStart(2, '0')}`;
                if (mapaPorFecha.has(f)) continue;
                if (f === fechaActualHoy) continue; // Hoy se gestiona en las tarjetas superiores mientras transcurre el día

                const dt = new Date(anioTarget, mesTarget - 1, d, 12, 0, 0);
                const dow = dt.getDay();
                if (dow === 0 || dow === 6) continue;

                mapaPorFecha.set(f, {
                    id: `${session.uid}_${f}`,
                    colaboradorUid: session.uid,
                    fecha: f,
                    horaEntrada: null,
                    horaSalida: null,
                    estado: ESTADOS_ASISTENCIA.INASISTENCIA,
                    minutosRetardo: 0,
                    justificacionId: null,
                    estadoJustificacion: ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION,
                    autorizadoPor: ''
                });
            }
        }

        let listaFinal = Array.from(mapaPorFecha.values());
        if (estadoFiltro && estadoFiltro !== 'todos') {
            listaFinal = listaFinal.filter(item => item.estado === estadoFiltro);
        }

        listaFinal.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        return listaFinal;
    }

    /**
     * Devuelve exclusivamente los días del mes consultado (por defecto el mes actual)
     * en los que el colaborador autenticado NO asistió (inasistencias) y que son elegibles para justificar.
     * @param {Object|number} [opciones={}] - { anio, mes }
     */
    async getDiasInasistenciaJustificables(opciones = {}) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return [];
        }

        const { fecha: fechaActualHoy } = this.getFechaHoraActual();
        const [yHoy, mHoy, dHoy] = fechaActualHoy.split('-').map(n => parseInt(n, 10));

        const esObj = opciones && typeof opciones === 'object' && !Array.isArray(opciones);
        const anioTarget = esObj && opciones.anio ? parseInt(opciones.anio, 10) : yHoy;
        const mesTarget = esObj && opciones.mes ? parseInt(opciones.mes, 10) : mHoy;

        const mesPad = String(mesTarget).padStart(2, '0');
        const ultimoDiaMes = new Date(anioTarget, mesTarget, 0).getDate();
        const fechaInicioMes = `${anioTarget}-${mesPad}-01`;
        const fechaFinMes = `${anioTarget}-${mesPad}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const [registros, justificaciones] = await Promise.all([
            this.asistenciaRepo.getHistorialColaboradorPorMes(session.uid, anioTarget, mesTarget),
            this.justificacionRepo.getJustificacionesPorPeriodo({
                fechaInicio: fechaInicioMes,
                fechaFin: fechaFinMes,
                colaboradorUid: session.uid
            })
        ]);

        const fechasConAsistencia = new Set();
        const mapaRegistros = new Map();
        (registros || []).forEach(r => {
            if (!r.fecha) return;
            mapaRegistros.set(r.fecha, r);
            if (r.horaEntrada || r.estado === ESTADOS_ASISTENCIA.PRESENTE || r.estado === ESTADOS_ASISTENCIA.RETARDO) {
                fechasConAsistencia.add(r.fecha);
            }
        });

        const justPorFecha = new Map();
        (justificaciones || []).forEach(j => {
            if (j.fechaInasistencia && !justPorFecha.has(j.fechaInasistencia)) {
                justPorFecha.set(j.fechaInasistencia, j);
            }
        });

        const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const esMesActual = anioTarget === yHoy && mesTarget === mHoy;
        const esMesFuturo = (anioTarget > yHoy) || (anioTarget === yHoy && mesTarget > mHoy);
        if (esMesFuturo) return [];

        const diaMaximo = esMesActual ? dHoy : ultimoDiaMes;
        const candidatos = [];

        for (let d = diaMaximo; d >= 1; d--) {
            const dd = String(d).padStart(2, '0');
            const fechaStr = `${anioTarget}-${mesPad}-${dd}`;
            const dt = new Date(anioTarget, mesTarget - 1, d, 12, 0, 0);
            const dow = dt.getDay();

            // Si asistió ese día (tiene horaEntrada o estado presente/retardo), NO se puede justificar
            if (fechasConAsistencia.has(fechaStr)) continue;

            const regExistente = mapaRegistros.get(fechaStr);
            const justExistente = justPorFecha.get(fechaStr);
            const estadoJust = justExistente?.estado || regExistente?.estadoJustificacion || ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION;

            // Si ya tiene justificación pendiente o aprobada, no volver a listar para justificar
            if (estadoJust === ESTADOS_JUSTIFICACION.PENDIENTE || estadoJust === ESTADOS_JUSTIFICACION.APROBADA) {
                continue;
            }

            // Solo días hábiles (Lunes a Viernes) o días que tengan un registro explícito de inasistencia
            const esInasistenciaExplicita = regExistente && regExistente.estado === ESTADOS_ASISTENCIA.INASISTENCIA;
            if ((dow === 0 || dow === 6) && !esInasistenciaExplicita) {
                continue;
            }

            const etiquetaDia = `${diasSemanaNombres[dow]} ${dd}/${mesesNombres[mesTarget - 1]}/${anioTarget}`;
            const sufijo = fechaStr === fechaActualHoy
                ? ' (Hoy — Sin asistencia registrada)'
                : (estadoJust === ESTADOS_JUSTIFICACION.RECHAZADA ? ' (Inasistencia — Justificación previa rechazada)' : ' (Inasistencia — Sin registro de entrada)');

            candidatos.push({
                fecha: fechaStr,
                etiqueta: `${etiquetaDia}${sufijo}`,
                asistenciaId: regExistente?.id || `${session.uid}_${fechaStr}`,
                estadoJustificacion: estadoJust
            });
        }

        return candidatos;
    }

    /**
     * Consulta asistencias para el panel administrativo / general de asistencias.
     * Construye la matriz quincenal de colaboradores vs días de la 1ª o 2ª quincena,
     * enriquece horarios de entrada/salida y justificaciones de inasistencias, y genera
     * el expediente específico cuando se selecciona un colaborador en particular.
     */
    async getAsistenciasAdmin({
        colaboradorUid = 'todos',
        anio,
        mes,
        quincena = 'primera',
        estado = 'todos',
        estadoJustificacion = 'todos'
    }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('Debe iniciar sesión para consultar los registros de asistencia.');
        }

        const anioNum = parseInt(anio, 10) || new Date().getFullYear();
        const mesNum = parseInt(mes, 10) || (new Date().getMonth() + 1);
        const mesPad = String(mesNum).padStart(2, '0');
        const ultimoDiaMes = new Date(anioNum, mesNum, 0).getDate();

        let diaInicio = 1;
        let diaFin = ultimoDiaMes;
        if (quincena === 'primera') {
            diaInicio = 1;
            diaFin = 15;
        } else if (quincena === 'segunda') {
            diaInicio = 16;
            diaFin = ultimoDiaMes;
        }

        const fechaInicioStr = `${anioNum}-${mesPad}-${String(diaInicio).padStart(2, '0')}`;
        const fechaFinStr = `${anioNum}-${mesPad}-${String(diaFin).padStart(2, '0')}`;
        const { fecha: fechaActualHoy } = this.getFechaHoraActual();

        const nombresMeses = [
            '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const diasSemanaCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const mesNombre = nombresMeses[mesNum] || `Mes ${mesNum}`;
        const periodoTexto = quincena === 'primera'
            ? `1ª Quincena (01 al 15 de ${mesNombre} ${anioNum})`
            : (quincena === 'segunda'
                ? `2ª Quincena (16 al ${ultimoDiaMes} de ${mesNombre} ${anioNum})`
                : `Mes Completo (01 al ${ultimoDiaMes} de ${mesNombre} ${anioNum})`);

        // Construir arreglo de días de la quincena para las columnas de la tabla matriz
        const diasPeriodo = [];
        for (let d = diaInicio; d <= diaFin; d++) {
            const diaPad = String(d).padStart(2, '0');
            const fechaDia = `${anioNum}-${mesPad}-${diaPad}`;
            const dtObj = new Date(anioNum, mesNum - 1, d, 12, 0, 0);
            const dow = dtObj.getDay();
            diasPeriodo.push({
                dia: d,
                diaPad,
                fecha: fechaDia,
                nombreDiaCorto: diasSemanaCortos[dow],
                esFinDeSemana: dow === 0 || dow === 6,
                esFuturo: fechaDia > fechaActualHoy,
                esHoy: fechaDia === fechaActualHoy
            });
        }

        // 1. Consultar todos los colaboradores (partners) y filtrar activos
        const todosColaboradores = await this.partnerRepo.getAllCollaborators(true);
        const colaboradoresActivos = (todosColaboradores || [])
            .filter(c => c.status !== 'inactive' && c.status !== 'inactivo')
            .sort((a, b) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '', 'es'));

        const colaboradoresMap = new Map();
        colaboradoresActivos.forEach(c => {
            if (c.uid) colaboradoresMap.set(c.uid, c);
            if (c.id) colaboradoresMap.set(c.id, c);
        });

        // 2. Consultar asistencias y justificaciones del periodo
        const [asistenciasRaw, justificacionesRaw] = await Promise.all([
            this.asistenciaRepo.getAsistenciasPorPeriodo({
                colaboradorUid,
                anio: anioNum,
                mes: mesNum,
                quincena,
                estado: 'todos',
                estadoJustificacion: 'todos'
            }),
            this.justificacionRepo.getJustificacionesPorPeriodo({
                fechaInicio: fechaInicioStr,
                fechaFin: fechaFinStr,
                colaboradorUid
            })
        ]);

        // Si existen registros en asistencias/justificaciones de algún colaborador no listado aún, agregarlo al mapa
        asistenciasRaw.forEach(a => {
            if (a.colaboradorUid && !colaboradoresMap.has(a.colaboradorUid)) {
                const extraColab = {
                    uid: a.colaboradorUid,
                    id: a.colaboradorUid,
                    nombreCompleto: a.colaboradorNombre || 'Colaborador',
                    emailEmpresarial: a.colaboradorEmail || '',
                    fotoPerfil: a.colaboradorFoto || null,
                    areaNombre: a.areaNombre || 'General',
                    subareaNombre: a.subareaNombre || ''
                };
                colaboradoresMap.set(a.colaboradorUid, extraColab);
                colaboradoresActivos.push(extraColab);
            }
        });

        // 3. Indexar justificaciones por ID y por clave colaboradorUid_fecha
        const justById = new Map();
        const justByColabFecha = new Map();
        justificacionesRaw.forEach(j => {
            if (j.id) justById.set(j.id, j);
            if (j.colaboradorUid && j.fechaInasistencia) {
                const key = `${j.colaboradorUid}_${j.fechaInasistencia}`;
                if (!justByColabFecha.has(key)) {
                    justByColabFecha.set(key, j);
                }
            }
        });

        // Indexar asistencias por clave colaboradorUid_fecha
        const asisByColabFecha = new Map();
        asistenciasRaw.forEach(a => {
            if (a.colaboradorUid && a.fecha) {
                const colab = colaboradoresMap.get(a.colaboradorUid);
                const uidNorm = colab ? (colab.uid || colab.id) : a.colaboradorUid;
                asisByColabFecha.set(`${uidNorm}_${a.fecha}`, a);
                asisByColabFecha.set(`${a.colaboradorUid}_${a.fecha}`, a);
            }
        });

        const recortarHora = (h) => {
            if (!h) return null;
            const partes = String(h).split(':');
            return partes.length >= 2 ? `${partes[0]}:${partes[1]}` : h;
        };

        // Determinar lista de colaboradores a procesar según filtro colaboradorUid
        const colaboradoresEvaluados = (colaboradorUid && colaboradorUid !== 'todos')
            ? colaboradoresActivos.filter(c => c.uid === colaboradorUid || c.id === colaboradorUid)
            : colaboradoresActivos;

        let matrizColaboradores = [];
        let todosRegistrosDias = [];

        let globalPuntuales = 0;
        let globalRetardos = 0;
        let globalInasistencias = 0;
        let globalJustPendientes = 0;
        let globalJustAprobadas = 0;
        let globalJustRechazadas = 0;

        colaboradoresEvaluados.forEach(colab => {
            const uidColab = colab.uid || colab.id;
            const diasMap = {};

            let puntuales = 0;
            let retardos = 0;
            let minutosRetardoTotal = 0;
            let inasistencias = 0;
            let minutosTrabajadosTotal = 0;
            let totalJustificaciones = 0;
            let justAprobadas = 0;
            let justPendientes = 0;
            let justRechazadas = 0;

            diasPeriodo.forEach(diaInfo => {
                const { fecha: fechaDia, dia, nombreDiaCorto, esFinDeSemana, esFuturo } = diaInfo;
                const asisDoc = asisByColabFecha.get(`${uidColab}_${fechaDia}`)
                    || (colab.id ? asisByColabFecha.get(`${colab.id}_${fechaDia}`) : null)
                    || null;
                const justDoc = (asisDoc?.justificacionId && justById.get(asisDoc.justificacionId))
                    || justByColabFecha.get(`${uidColab}_${fechaDia}`)
                    || (colab.id ? justByColabFecha.get(`${colab.id}_${fechaDia}`) : null)
                    || null;

                const tieneEntrada = Boolean(asisDoc && asisDoc.horaEntrada);
                const horasObj = AsistenciaModel.calcularHorasTrabajadas(asisDoc?.horaEntrada || null, asisDoc?.horaSalida || null);

                let estadoCelda = 'futuro';
                if (tieneEntrada) {
                    estadoCelda = asisDoc.estado === ESTADOS_ASISTENCIA.RETARDO
                        ? ESTADOS_ASISTENCIA.RETARDO
                        : ESTADOS_ASISTENCIA.PRESENTE;
                } else if (asisDoc && asisDoc.estado === ESTADOS_ASISTENCIA.INASISTENCIA) {
                    estadoCelda = ESTADOS_ASISTENCIA.INASISTENCIA;
                } else if (justDoc) {
                    estadoCelda = ESTADOS_ASISTENCIA.INASISTENCIA;
                } else if (esFuturo) {
                    estadoCelda = 'futuro';
                } else if (esFinDeSemana) {
                    estadoCelda = 'descanso';
                } else {
                    // Día hábil pasado o de hoy sin entrada registrada -> Inasistencia
                    estadoCelda = ESTADOS_ASISTENCIA.INASISTENCIA;
                }

                // Regla de negocio: Se justifican SOLO las inasistencias
                const esInasistencia = estadoCelda === ESTADOS_ASISTENCIA.INASISTENCIA;
                const justIdFinal = esInasistencia ? (justDoc?.id || asisDoc?.justificacionId || null) : null;
                const estadoJustFinal = esInasistencia
                    ? (justDoc?.estado || asisDoc?.estadoJustificacion || ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION)
                    : ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION;
                const haJustificado = Boolean(
                    esInasistencia && (
                        justIdFinal ||
                        (estadoJustFinal && estadoJustFinal !== ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION)
                    )
                );

                const minRetardo = tieneEntrada ? (asisDoc?.minutosRetardo || 0) : 0;

                if (estadoCelda === ESTADOS_ASISTENCIA.PRESENTE) {
                    puntuales++;
                    globalPuntuales++;
                } else if (estadoCelda === ESTADOS_ASISTENCIA.RETARDO) {
                    retardos++;
                    globalRetardos++;
                } else if (estadoCelda === ESTADOS_ASISTENCIA.INASISTENCIA) {
                    inasistencias++;
                    globalInasistencias++;
                }

                minutosRetardoTotal += minRetardo;
                minutosTrabajadosTotal += horasObj.minutosTotales;

                if (haJustificado) {
                    totalJustificaciones++;
                    if (estadoJustFinal === ESTADOS_JUSTIFICACION.APROBADA) {
                        justAprobadas++;
                        globalJustAprobadas++;
                    } else if (estadoJustFinal === ESTADOS_JUSTIFICACION.PENDIENTE) {
                        justPendientes++;
                        globalJustPendientes++;
                    } else if (estadoJustFinal === ESTADOS_JUSTIFICACION.RECHAZADA) {
                        justRechazadas++;
                        globalJustRechazadas++;
                    }
                }

                const celdaObj = {
                    id: asisDoc?.id || `${uidColab}_${fechaDia}`,
                    colaboradorUid: uidColab,
                    colaboradorNombre: colab.nombreCompleto || 'Colaborador',
                    colaboradorEmail: colab.emailEmpresarial || colab.emailPersonal || '',
                    colaboradorFoto: colab.fotoPerfil || null,
                    areaNombre: colab.areaNombre || 'General',
                    subareaNombre: colab.subareaNombre || '',
                    telefonoMovil: colab.telefonoMovil || '',
                    fecha: fechaDia,
                    dia,
                    nombreDiaCorto,
                    esFinDeSemana,
                    esFuturo,
                    quincenaLabel: dia <= 15 ? '1ª Quincena' : '2ª Quincena',
                    tieneRegistro: Boolean(asisDoc || justDoc),
                    horaEntrada: asisDoc?.horaEntrada || null,
                    horaEntradaCorta: recortarHora(asisDoc?.horaEntrada),
                    horaSalida: asisDoc?.horaSalida || null,
                    horaSalidaCorta: recortarHora(asisDoc?.horaSalida),
                    horasTrabajadas: horasObj.texto,
                    minutosTrabajados: horasObj.minutosTotales,
                    estado: estadoCelda,
                    minutosRetardo: minRetardo,
                    haJustificado,
                    justificacionId: justIdFinal,
                    estadoJustificacion: estadoJustFinal,
                    justificacionMotivo: justDoc?.motivo || asisDoc?.justificacionMotivo || '',
                    justificacionEvidenciaUrl: justDoc?.evidenciaUrl || null,
                    justificacionComentarioRevision: justDoc?.comentarioRevision || asisDoc?.resolucionRevision?.comentario || '',
                    justificacionAutorizadoPor: justDoc?.autorizadoPor || justDoc?.revisadoPorNombre || asisDoc?.autorizadoPor || asisDoc?.revisadoPorNombre || asisDoc?.resolucionRevision?.revisadoPorNombre || '',
                    ubicacionEntrada: asisDoc?.ubicacionEntrada || null,
                    ubicacionSalida: asisDoc?.ubicacionSalida || null,
                    observaciones: asisDoc?.observaciones || ''
                };

                diasMap[fechaDia] = celdaObj;

                // Solo agregar a la lista plana de días evaluables (excluyendo futuros y descansos sin actividad)
                if (estadoCelda !== 'futuro' && estadoCelda !== 'descanso') {
                    todosRegistrosDias.push(celdaObj);
                }
            });

            const hrsTotales = Math.floor(minutosTrabajadosTotal / 60);
            const minsTotales = minutosTrabajadosTotal % 60;

            matrizColaboradores.push({
                colaborador: {
                    uid: uidColab,
                    nombreCompleto: colab.nombreCompleto || colab.emailEmpresarial || 'Colaborador',
                    emailEmpresarial: colab.emailEmpresarial || colab.emailPersonal || '',
                    fotoPerfil: colab.fotoPerfil || null,
                    areaNombre: colab.areaNombre || 'General',
                    subareaNombre: colab.subareaNombre || '',
                    telefonoMovil: colab.telefonoMovil || ''
                },
                dias: diasMap,
                resumen: {
                    totalDiasEvaluados: puntuales + retardos + inasistencias,
                    puntuales,
                    retardos,
                    minutosRetardoTotal,
                    inasistencias,
                    horasTrabajadasTexto: `${hrsTotales}h ${String(minsTotales).padStart(2, '0')}m`,
                    minutosTrabajadosTotal,
                    totalJustificaciones,
                    justificacionesAprobadas: justAprobadas,
                    justificacionesPendientes: justPendientes,
                    justificacionesRechazadas: justRechazadas
                }
            });
        });

        // 4. Si hay filtros de estado o estadoJustificacion, filtrar las filas de la matriz y los registros
        if (estado !== 'todos' || estadoJustificacion !== 'todos') {
            matrizColaboradores = matrizColaboradores.filter(fila => {
                return Object.values(fila.dias).some(c => {
                    if (c.estado === 'futuro' || c.estado === 'descanso') return false;
                    if (estado !== 'todos' && c.estado !== estado) return false;
                    if (estadoJustificacion !== 'todos' && c.estadoJustificacion !== estadoJustificacion) return false;
                    return true;
                });
            });

            todosRegistrosDias = todosRegistrosDias.filter(c => {
                if (estado !== 'todos' && c.estado !== estado) return false;
                if (estadoJustificacion !== 'todos' && c.estadoJustificacion !== estadoJustificacion) return false;
                return true;
            });
        }

        // 5. Si se seleccionó un colaborador en específico, armar su expediente detallado
        let detalleColaborador = null;
        if (colaboradorUid && colaboradorUid !== 'todos' && matrizColaboradores.length > 0) {
            const filaColab = matrizColaboradores[0];
            const registrosColab = Object.values(filaColab.dias)
                .filter(c => c.estado !== 'futuro' && c.estado !== 'descanso')
                .filter(c => {
                    if (estado !== 'todos' && c.estado !== estado) return false;
                    if (estadoJustificacion !== 'todos' && c.estadoJustificacion !== estadoJustificacion) return false;
                    return true;
                })
                .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

            detalleColaborador = {
                colaborador: filaColab.colaborador,
                periodoTexto,
                quincena,
                anio: anioNum,
                mes: mesNum,
                estadisticas: {
                    totalRegistros: filaColab.resumen.totalDiasEvaluados,
                    ...filaColab.resumen
                },
                registrosDetallados: registrosColab,
                justificaciones: justificacionesRaw
            };
        }

        const metricas = {
            totalColaboradoresActivos: colaboradorUid && colaboradorUid !== 'todos' ? 1 : colaboradoresActivos.length,
            totalRegistros: todosRegistrosDias.length,
            totalAsistencias: globalPuntuales,
            totalRetardos: globalRetardos,
            totalInasistencias: globalInasistencias,
            justificacionesPendientes: globalJustPendientes,
            justificacionesAprobadas: globalJustAprobadas,
            justificacionesRechazadas: globalJustRechazadas
        };

        return {
            asistencias: todosRegistrosDias,
            matrizColaboradores,
            diasPeriodo,
            colaboradores: colaboradoresActivos,
            metricas,
            detalleColaborador,
            periodoTexto
        };
    }

    /**
     * Helper para obtener la lista de colaboradores elegibles para filtros
     */
    async getColaboradoresFiltro() {
        const session = this._getSession();
        if (!session || !session.uid) {
            return [];
        }
        const todos = await this.partnerRepo.getAllCollaborators(true);
        return (todos || [])
            .filter(c => c.status !== 'inactive' && c.status !== 'inactivo')
            .sort((a, b) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '', 'es'));
    }
}

export default AsistenciaService;
