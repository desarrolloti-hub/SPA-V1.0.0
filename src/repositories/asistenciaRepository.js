/* ========================================
   ASISTENCIA REPOSITORY - RSI ENTERPRISE
   Acceso a datos de asistencias con caché y transacciones atómicas
   ======================================== */

import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    runTransaction
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';
import { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION } from '../models/asistenciaModel.js';

export class AsistenciaRepository extends BaseRepository {
    constructor() {
        super('asistencias', 30000); // 30 segundos de TTL de caché
    }

    /**
     * Genera un ID determinista o único para la jornada del colaborador
     * Garantiza unicidad a nivel de documento
     */
    _getDocId(colaboradorUid, fecha) {
        return `${colaboradorUid}_${fecha}`;
    }

    /**
     * Obtiene el registro de asistencia de un colaborador para una fecha específica
     * @param {string} colaboradorUid
     * @param {string} fecha - YYYY-MM-DD
     * @returns {Promise<Object|null>}
     */
    async getAsistenciaHoy(colaboradorUid, fecha, forceRefresh = false) {
        try {
            const docId = this._getDocId(colaboradorUid, fecha);
            const docRef = doc(db, this.collectionName, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                };
            }

            // Fallback por query en caso de registros con IDs aleatorios previos
            const colRef = this._getCollection();
            const q = query(
                colRef,
                where('colaboradorUid', '==', colaboradorUid),
                where('fecha', '==', fecha)
            );
            const querySnap = await getDocs(q);

            if (!querySnap.empty) {
                const first = querySnap.docs[0];
                return {
                    id: first.id,
                    ...first.data()
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error obteniendo asistencia del día:', error);
            throw error;
        }
    }

    /**
     * Registra la entrada de forma atómica previniendo duplicados concurrentes
     * @param {Object} asistenciaData
     * @returns {Promise<{ success: boolean, id: string, message: string }>}
     */
    async registrarEntrada(asistenciaData) {
        try {
            const { colaboradorUid, fecha } = asistenciaData;
            const docId = this._getDocId(colaboradorUid, fecha);
            const docRef = doc(db, this.collectionName, docId);

            const result = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.horaEntrada) {
                        throw new Error(`Ya existe una entrada registrada para hoy a las ${data.horaEntrada}`);
                    }
                }

                // Guardar nuevo registro con ID determinista
                transaction.set(docRef, {
                    ...asistenciaData,
                    id: docId
                });

                return { id: docId };
            });

            this.clearCache();
            return {
                success: true,
                id: result.id,
                message: 'Entrada registrada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error registrando entrada:', error);
            return {
                success: false,
                error: error.message || 'Error al registrar la entrada'
            };
        }
    }

    /**
     * Registra la salida de la jornada laboral de forma atómica
     * @param {string} colaboradorUid
     * @param {string} fecha
     * @param {Object} salidaData
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async registrarSalida(colaboradorUid, fecha, salidaData) {
        try {
            const docId = this._getDocId(colaboradorUid, fecha);
            const docRef = doc(db, this.collectionName, docId);

            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);

                if (!docSnap.exists()) {
                    throw new Error('No se encontró un registro de entrada para la jornada de hoy. Debe registrar su entrada primero.');
                }

                const data = docSnap.data();
                if (data.horaSalida) {
                    throw new Error(`La salida ya fue registrada previamente a las ${data.horaSalida}`);
                }

                transaction.update(docRef, {
                    ...salidaData,
                    updatedAt: new Date().toISOString()
                });
            });

            this.clearCache();
            return {
                success: true,
                message: 'Salida registrada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error registrando salida:', error);
            return {
                success: false,
                error: error.message || 'Error al registrar la salida'
            };
        }
    }

    /**
     * Obtiene el historial individual de un colaborador exclusivamente para un mes y año dados,
     * utilizando el índice compuesto (colaboradorUid ASC, fecha DESC).
     * @param {string} colaboradorUid
     * @param {number} anio
     * @param {number} mes - 1 a 12
     */
    async getHistorialColaboradorPorMes(colaboradorUid, anio, mes) {
        const anioNum = parseInt(anio, 10);
        const mesNum = parseInt(mes, 10);
        const mesPad = String(mesNum).padStart(2, '0');
        const ultimoDiaMes = new Date(anioNum, mesNum, 0).getDate();
        const fechaInicioStr = `${anioNum}-${mesPad}-01`;
        const fechaFinStr = `${anioNum}-${mesPad}-${String(ultimoDiaMes).padStart(2, '0')}`;

        try {
            const colRef = this._getCollection();
            const q = query(
                colRef,
                where('colaboradorUid', '==', colaboradorUid),
                where('fecha', '>=', fechaInicioStr),
                where('fecha', '<=', fechaFinStr),
                orderBy('fecha', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
        } catch (error) {
            console.warn('⚠️ Fallback en getHistorialColaboradorPorMes (índice compuesto en construcción o pendiente):', error.message);
            try {
                const colRef = this._getCollection();
                const qFallback = query(colRef, where('colaboradorUid', '==', colaboradorUid));
                const snap = await getDocs(qFallback);
                return snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(item => item.fecha >= fechaInicioStr && item.fecha <= fechaFinStr)
                    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
            } catch (errFallback) {
                console.error('❌ Error en fallback de historial mensual:', errFallback);
                return [];
            }
        }
    }

    /**
     * Obtiene el historial individual de un colaborador ordenado por fecha
     * @param {string} colaboradorUid
     * @param {number} limite
     */
    async getHistorialColaborador(colaboradorUid, limite = 30) {
        try {
            const colRef = this._getCollection();
            const q = query(
                colRef,
                where('colaboradorUid', '==', colaboradorUid),
                orderBy('fecha', 'desc')
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            return data.slice(0, limite);
        } catch (error) {
            console.error('❌ Error obteniendo historial de colaborador:', error);
            // Si falta índice compuesto en Firestore, degradar a ordenación en memoria
            try {
                const colRef = this._getCollection();
                const qFallback = query(colRef, where('colaboradorUid', '==', colaboradorUid));
                const snap = await getDocs(qFallback);
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
                return items.slice(0, limite);
            } catch (errFallback) {
                console.error('❌ Error en fallback de historial:', errFallback);
                return [];
            }
        }
    }

    /**
     * Consulta asistencias por periodo quincenal/mensual con filtros
     * @param {Object} filtros
     * @param {string|null} filtros.colaboradorUid - UID del colaborador o null para todos
     * @param {number} filtros.anio - Año (ej: 2026)
     * @param {number} filtros.mes - Mes (1-12)
     * @param {string} filtros.quincena - 'primera' (1-15), 'segunda' (16-fin), o 'todas'
     * @param {string} filtros.estado - 'todos' o estado específico
     * @param {string} filtros.estadoJustificacion - 'todos' o estado de justificación
     * @returns {Promise<Array<Object>>}
     */
    async getAsistenciasPorPeriodo({
        colaboradorUid = null,
        anio,
        mes,
        quincena = 'todas',
        estado = 'todos',
        estadoJustificacion = 'todos'
    }) {
        try {
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

            const fechaInicioStr = `${anio}-${mesPad}-${String(diaInicio).padStart(2, '0')}`;
            const fechaFinStr = `${anio}-${mesPad}-${String(diaFin).padStart(2, '0')}`;

            console.log(`📅 Consultando asistencias del periodo: ${fechaInicioStr} al ${fechaFinStr} (Quincena: ${quincena})`);

            const colRef = this._getCollection();
            const constraints = [];

            if (colaboradorUid && colaboradorUid !== 'todos') {
                constraints.push(where('colaboradorUid', '==', colaboradorUid));
            }
            constraints.push(
                where('fecha', '>=', fechaInicioStr),
                where('fecha', '<=', fechaFinStr)
            );

            let snapshot;
            try {
                const q = query(colRef, ...constraints, orderBy('fecha', 'desc'));
                snapshot = await getDocs(q);
            } catch (queryErr) {
                console.warn('⚠️ Consulta con rango requiere índice, ejecutando consulta alternativa:', queryErr.message);
                const allSnap = await getDocs(colRef);
                snapshot = allSnap;
            }

            let resultados = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // Filtrar en memoria para asegurar coherencia y soportar filtros combinados
            resultados = resultados.filter(item => {
                if (item.fecha < fechaInicioStr || item.fecha > fechaFinStr) return false;
                if (colaboradorUid && colaboradorUid !== 'todos' && item.colaboradorUid !== colaboradorUid) return false;
                if (estado && estado !== 'todos' && item.estado !== estado) return false;
                if (estadoJustificacion && estadoJustificacion !== 'todos' && item.estadoJustificacion !== estadoJustificacion) return false;
                return true;
            });

            // Ordenar por fecha desc, luego horaEntrada desc
            resultados.sort((a, b) => {
                const cmpFecha = (b.fecha || '').localeCompare(a.fecha || '');
                if (cmpFecha !== 0) return cmpFecha;
                return (b.horaEntrada || '').localeCompare(a.horaEntrada || '');
            });

            return resultados;
        } catch (error) {
            console.error('❌ Error obteniendo asistencias por periodo:', error);
            return [];
        }
    }

    /**
     * Calcula los indicadores del periodo consultado
     */
    calcularMetricas(asistencias = [], totalColaboradoresActivos = 0) {
        let totalAsistencias = 0;
        let totalRetardos = 0;
        let totalInasistencias = 0;
        let justificacionesPendientes = 0;
        let justificacionesAprobadas = 0;
        let justificacionesRechazadas = 0;

        asistencias.forEach(a => {
            if (a.estado === ESTADOS_ASISTENCIA.PRESENTE) totalAsistencias++;
            if (a.estado === ESTADOS_ASISTENCIA.RETARDO) totalRetardos++;
            if (a.estado === ESTADOS_ASISTENCIA.INASISTENCIA) totalInasistencias++;

            if (a.estadoJustificacion === ESTADOS_JUSTIFICACION.PENDIENTE) justificacionesPendientes++;
            if (a.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA) justificacionesAprobadas++;
            if (a.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA) justificacionesRechazadas++;
        });

        return {
            totalColaboradoresActivos,
            totalRegistros: asistencias.length,
            totalAsistencias,
            totalRetardos,
            totalInasistencias,
            justificacionesPendientes,
            justificacionesAprobadas,
            justificacionesRechazadas
        };
    }
}

export default AsistenciaRepository;
