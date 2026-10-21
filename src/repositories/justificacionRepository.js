/* ========================================
   JUSTIFICACION REPOSITORY - RSI ENTERPRISE
   Acceso a datos y resolución de justificaciones de inasistencia
   ======================================== */

import {
    db,
    collection,
    doc,
    addDoc,
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

export class JustificacionRepository extends BaseRepository {
    constructor() {
        super('justificaciones', 30000);
    }

    /**
     * Registra una nueva justificación vinculándola al registro de asistencia
     * @param {Object} justificacionData
     * @returns {Promise<{ success: boolean, id: string, message: string }>}
     */
    async crearJustificacion(justificacionData) {
        try {
            const { colaboradorUid, fechaInasistencia } = justificacionData;
            const asistenciaDocId = `${colaboradorUid}_${fechaInasistencia}`;
            const asistenciaRef = doc(db, 'asistencias', asistenciaDocId);
            const justificacionesCol = this._getCollection();

            const docRef = await addDoc(justificacionesCol, {
                ...justificacionData,
                asistenciaId: asistenciaDocId
            });

            const justificacionId = docRef.id;

            // Actualizar o crear registro de asistencia correspondiente como inasistencia justificada pendiente
            try {
                await runTransaction(db, async (transaction) => {
                    const asisSnap = await transaction.get(asistenciaRef);
                    if (asisSnap.exists()) {
                        transaction.update(asistenciaRef, {
                            justificacionId: justificacionId,
                            estadoJustificacion: ESTADOS_JUSTIFICACION.PENDIENTE,
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        // Si no existía registro de asistencia para ese día, crearlo como inasistencia
                        transaction.set(asistenciaRef, {
                            id: asistenciaDocId,
                            colaboradorUid: colaboradorUid,
                            colaboradorNombre: justificacionData.colaboradorNombre || 'Colaborador',
                            colaboradorEmail: justificacionData.colaboradorEmail || '',
                            fecha: fechaInasistencia,
                            horaEntrada: null,
                            horaSalida: null,
                            entradaTimestamp: null,
                            salidaTimestamp: null,
                            estado: ESTADOS_ASISTENCIA.INASISTENCIA,
                            minutosRetardo: 0,
                            tipoRegistro: 'inasistencia',
                            justificacionId: justificacionId,
                            estadoJustificacion: ESTADOS_JUSTIFICACION.PENDIENTE,
                            observaciones: 'Inasistencia con justificación pendiente de revisión',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                });
            } catch (transErr) {
                console.warn('⚠️ No se pudo actualizar asistencia vinculada:', transErr.message);
            }

            this.clearCache();
            return {
                success: true,
                id: justificacionId,
                message: 'Justificación enviada correctamente para revisión'
            };
        } catch (error) {
            console.error('❌ Error creando justificación:', error);
            return {
                success: false,
                error: error.message || 'Error al guardar la justificación'
            };
        }
    }

    /**
     * Obtiene las justificaciones de un colaborador
     * @param {string} colaboradorUid
     */
    async getJustificacionesPorColaborador(colaboradorUid) {
        try {
            const colRef = this._getCollection();
            const q = query(
                colRef,
                where('colaboradorUid', '==', colaboradorUid),
                orderBy('fechaInasistencia', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
        } catch (error) {
            console.warn('⚠️ Fallback en consulta de justificaciones de colaborador:', error.message);
            const colRef = this._getCollection();
            const q = query(colRef, where('colaboradorUid', '==', colaboradorUid));
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            items.sort((a, b) => (b.fechaInasistencia || '').localeCompare(a.fechaInasistencia || ''));
            return items;
        }
    }

    /**
     * Obtiene las justificaciones dentro de un rango de fechas (y opcionalmente por colaborador)
     * @param {Object} params
     * @param {string} params.fechaInicio - YYYY-MM-DD
     * @param {string} params.fechaFin - YYYY-MM-DD
     * @param {string} [params.colaboradorUid='todos']
     * @returns {Promise<Array<Object>>}
     */
    async getJustificacionesPorPeriodo({ fechaInicio, fechaFin, colaboradorUid = 'todos' }) {
        try {
            const colRef = this._getCollection();
            let snapshot;

            try {
                const constraints = [];
                if (colaboradorUid && colaboradorUid !== 'todos') {
                    constraints.push(where('colaboradorUid', '==', colaboradorUid));
                }
                constraints.push(
                    where('fechaInasistencia', '>=', fechaInicio),
                    where('fechaInasistencia', '<=', fechaFin),
                    orderBy('fechaInasistencia', 'desc')
                );
                const q = query(colRef, ...constraints);
                snapshot = await getDocs(q);
            } catch (idxErr) {
                console.warn('⚠️ Fallback en consulta de justificaciones por periodo:', idxErr.message);
                snapshot = await getDocs(colRef);
            }

            let items = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            items = items.filter(j => {
                const fecha = j.fechaInasistencia || '';
                if (fechaInicio && fecha < fechaInicio) return false;
                if (fechaFin && fecha > fechaFin) return false;
                if (colaboradorUid && colaboradorUid !== 'todos' && j.colaboradorUid !== colaboradorUid) return false;
                return true;
            });

            items.sort((a, b) => (b.fechaInasistencia || '').localeCompare(a.fechaInasistencia || ''));
            return items;
        } catch (error) {
            console.error('❌ Error obteniendo justificaciones por periodo:', error);
            return [];
        }
    }

    /**
     * Obtiene una justificación por su ID
     */
    async getJustificacionPorId(id) {
        return await this.getById(id, true);
    }

    /**
     * Resuelve administrativamente una justificación (Aprobar / Rechazar)
     * @param {string} justificacionId
     * @param {Object} resolucion
     * @param {string} resolucion.estado - 'aprobada' | 'rechazada'
     * @param {string} resolucion.revisorUid
     * @param {string} resolucion.revisorNombre
     * @param {string} resolucion.comentario
     */
    async resolverJustificacion(justificacionId, { estado, revisorUid, revisorNombre, revisorEmail = '', revisorRol = '', comentario = '' }) {
        try {
            if (![ESTADOS_JUSTIFICACION.APROBADA, ESTADOS_JUSTIFICACION.RECHAZADA].includes(estado)) {
                throw new Error('Estado de resolución inválido. Debe ser aprobada o rechazada.');
            }

            const justRef = doc(db, this.collectionName, justificacionId);
            const now = new Date().toISOString();
            const nombreAutorizador = revisorNombre || revisorEmail || 'Colaborador Autorizado';

            await runTransaction(db, async (transaction) => {
                // 1. Ejecutar todas las lecturas (reads) antes de cualquier escritura (write)
                const justSnap = await transaction.get(justRef);
                if (!justSnap.exists()) {
                    throw new Error('No se encontró el registro de justificación');
                }

                const data = justSnap.data();
                const asistenciaDocId = data.asistenciaId || (data.colaboradorUid && data.fechaInasistencia ? `${data.colaboradorUid}_${data.fechaInasistencia}` : null);
                let asisRef = null;
                let asisSnap = null;

                if (asistenciaDocId) {
                    asisRef = doc(db, 'asistencias', asistenciaDocId);
                    asisSnap = await transaction.get(asisRef);
                }

                // 2. Preparar datos y ejecutar escrituras (writes)
                const historial = Array.isArray(data.historialRevisiones) ? [...data.historialRevisiones] : [];
                historial.push({
                    accion: estado,
                    realizadoPor: nombreAutorizador,
                    realizadoPorEmail: revisorEmail || '',
                    revisorUid: revisorUid,
                    rol: revisorRol || '',
                    fecha: now,
                    comentario: comentario || ''
                });

                transaction.update(justRef, {
                    estado: estado,
                    revisadoPorUid: revisorUid,
                    revisadoPorNombre: nombreAutorizador,
                    revisadoPorEmail: revisorEmail || '',
                    autorizadoPor: nombreAutorizador,
                    autorizadoPorUid: revisorUid,
                    autorizadoPorEmail: revisorEmail || '',
                    fechaRevision: now,
                    comentarioRevision: comentario || '',
                    historialRevisiones: historial,
                    updatedAt: now
                });

                const resolucionData = {
                    estado,
                    revisadoPorUid: revisorUid,
                    revisadoPorNombre: nombreAutorizador,
                    revisadoPorEmail: revisorEmail || '',
                    autorizadoPor: nombreAutorizador,
                    fecha: now,
                    comentario: comentario || ''
                };

                if (asisRef && asisSnap && asisSnap.exists()) {
                    transaction.update(asisRef, {
                        justificacionId: justificacionId,
                        estadoJustificacion: estado,
                        revisadoPorUid: revisorUid,
                        revisadoPorNombre: nombreAutorizador,
                        autorizadoPor: nombreAutorizador,
                        resolucionRevision: resolucionData,
                        updatedAt: now
                    });
                } else if (asisRef && data.colaboradorUid && data.fechaInasistencia) {
                    transaction.set(asisRef, {
                        id: asistenciaDocId,
                        colaboradorUid: data.colaboradorUid,
                        colaboradorNombre: data.colaboradorNombre || 'Colaborador',
                        colaboradorEmail: data.colaboradorEmail || '',
                        fecha: data.fechaInasistencia,
                        horaEntrada: null,
                        horaSalida: null,
                        entradaTimestamp: null,
                        salidaTimestamp: null,
                        estado: ESTADOS_ASISTENCIA.INASISTENCIA,
                        minutosRetardo: 0,
                        tipoRegistro: 'inasistencia',
                        justificacionId: justificacionId,
                        estadoJustificacion: estado,
                        revisadoPorUid: revisorUid,
                        revisadoPorNombre: nombreAutorizador,
                        autorizadoPor: nombreAutorizador,
                        resolucionRevision: resolucionData,
                        observaciones: `Inasistencia con justificación ${estado} por ${nombreAutorizador}`,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            });

            this.clearCache();
            return {
                success: true,
                autorizadoPor: nombreAutorizador,
                message: `Justificación ${estado === ESTADOS_JUSTIFICACION.APROBADA ? 'aprobada' : 'rechazada'} exitosamente (Permiso registrado por: ${nombreAutorizador}).`
            };
        } catch (error) {
            console.error('❌ Error resolviendo justificación:', error);
            return {
                success: false,
                error: error.message || 'Error al procesar la resolución de la justificación'
            };
        }
    }
}

export default JustificacionRepository;
