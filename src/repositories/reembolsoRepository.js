/* ========================================
   REEMBOLSO REPOSITORY - RSI ENTERPRISE
   Acceso a datos en Firestore con caché y transacciones atómicas
   para solicitudes de reembolso y devoluciones totales o parciales
   ======================================== */

import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    runTransaction
} from '../config/firebaseConfig.js';
import BaseRepository from './BaseRepository.js';
import { ReembolsoModel, ESTADOS_REEMBOLSO, TIPOS_DEVOLUCION, METODOS_DEVOLUCION } from '../models/reembolsoModel.js';

export class ReembolsoRepository extends BaseRepository {
    constructor() {
        super('reembolsos', 60000);
    }

    /**
     * Crea un nuevo reembolso asignando un folio secuencial atómico (RMB-RSI-XXX)
     * @param {Object} reembolsoData - Datos normalizados por ReembolsoModel.create()
     * @returns {Promise<{ success: boolean, id?: string, folio?: string, data?: Object, error?: string }>}
     */
    async crearReembolsoTransaccional(reembolsoData) {
        try {
            const contadorRef = doc(db, 'contadoresCotizaciones', 'reembolsos');
            const nuevoDocRef = doc(collection(db, this.collectionName));

            const resultado = await runTransaction(db, async (transaction) => {
                const contadorSnap = await transaction.get(contadorRef);
                const actual = contadorSnap.exists() ? (contadorSnap.data().count || 0) : 0;
                const siguiente = actual + 1;
                const nowIso = new Date().toISOString();

                if (contadorSnap.exists()) {
                    transaction.update(contadorRef, { count: siguiente, updatedAt: nowIso });
                } else {
                    transaction.set(contadorRef, { count: siguiente, updatedAt: nowIso });
                }

                const folio = `RMB-RSI-${String(siguiente).padStart(3, '0')}`;
                const payloadFinal = {
                    ...reembolsoData,
                    folio,
                    createdAt: nowIso,
                    updatedAt: nowIso
                };

                transaction.set(nuevoDocRef, payloadFinal);

                return {
                    id: nuevoDocRef.id,
                    folio,
                    data: { id: nuevoDocRef.id, ...payloadFinal }
                };
            });

            this.clearCache();
            return {
                success: true,
                id: resultado.id,
                folio: resultado.folio,
                data: resultado.data
            };
        } catch (error) {
            console.error('❌ Error creando reembolso en Firestore:', error);
            return {
                success: false,
                error: error.message || 'No se pudo guardar el reembolso en la base de datos.'
            };
        }
    }

    /**
     * Registra una devolución (Total o Parcial) de forma transaccional atómica
     * @param {string} reembolsoId - ID del documento en Firestore
     * @param {Object} params
     * @returns {Promise<{ success: boolean, data?: Object, message?: string, error?: string }>}
     */
    async registrarDevolucionTransaccional(reembolsoId, {
        tipoDevolucion = TIPOS_DEVOLUCION.TOTAL,
        montoDevolver = 0,
        metodoPago = 'transferencia',
        referenciaPago = '',
        comentario = '',
        comprobanteUrl = null,
        comprobantePath = null,
        comprobanteNombre = null,
        realizadoPorUid,
        realizadoPorNombre,
        realizadoPorEmail = '',
        realizadoPorRol = ''
    }) {
        try {
            const docRef = doc(db, this.collectionName, reembolsoId);

            const resultado = await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(docRef);
                if (!snap.exists()) {
                    throw new Error('El reembolso seleccionado no existe.');
                }

                const actual = snap.data();
                if (actual.estado === ESTADOS_REEMBOLSO.RECHAZADO) {
                    throw new Error('No se puede devolver un reembolso que fue rechazado.');
                }

                const montoSolicitado = ReembolsoModel.roundCurrency(actual.montoSolicitado || 0);
                const montoReembolsadoPrevio = ReembolsoModel.roundCurrency(actual.montoReembolsado || 0);
                const saldoAnterior = Math.max(0, ReembolsoModel.roundCurrency(montoSolicitado - montoReembolsadoPrevio));

                if (saldoAnterior <= 0.009 || actual.estado === ESTADOS_REEMBOLSO.LIQUIDADO) {
                    throw new Error('Este reembolso ya fue devuelto al 100%.');
                }

                const montoAplicar = tipoDevolucion === TIPOS_DEVOLUCION.TOTAL
                    ? saldoAnterior
                    : ReembolsoModel.roundCurrency(montoDevolver);

                if (!montoAplicar || montoAplicar <= 0) {
                    throw new Error('El monto a devolver debe ser mayor a $0.00 MXN.');
                }

                if (montoAplicar > saldoAnterior + 0.009) {
                    throw new Error(`El monto a devolver ($${montoAplicar.toFixed(2)}) supera el saldo pendiente ($${saldoAnterior.toFixed(2)}).`);
                }

                const montoEfectivo = Math.min(montoAplicar, saldoAnterior);
                const nuevoMontoReembolsado = ReembolsoModel.roundCurrency(montoReembolsadoPrevio + montoEfectivo);
                const nuevoSaldoPendiente = Math.max(0, ReembolsoModel.roundCurrency(montoSolicitado - nuevoMontoReembolsado));
                const porcentajeReembolsado = montoSolicitado > 0
                    ? Math.min(100, Math.round((nuevoMontoReembolsado / montoSolicitado) * 100))
                    : 100;

                const quedaLiquidado = nuevoSaldoPendiente <= 0.009;
                const nuevoEstado = quedaLiquidado
                    ? ESTADOS_REEMBOLSO.LIQUIDADO
                    : ESTADOS_REEMBOLSO.PARCIAL;

                const nowIso = new Date().toISOString();
                const historialPrevio = Array.isArray(actual.historialDevoluciones)
                    ? actual.historialDevoluciones
                    : [];

                const esPagoUnicoTotal = historialPrevio.length === 0 && quedaLiquidado;
                const tipoMovimiento = esPagoUnicoTotal ? TIPOS_DEVOLUCION.TOTAL : (quedaLiquidado ? 'liquidacion_restante' : TIPOS_DEVOLUCION.PARCIAL);
                const tipoDevolucionActual = esPagoUnicoTotal ? TIPOS_DEVOLUCION.TOTAL : TIPOS_DEVOLUCION.PARCIAL;

                const movimiento = {
                    id: `DEV-${Date.now()}`,
                    numeroAbono: historialPrevio.length + 1,
                    tipo: tipoDevolucion === TIPOS_DEVOLUCION.TOTAL && esPagoUnicoTotal ? TIPOS_DEVOLUCION.TOTAL : TIPOS_DEVOLUCION.PARCIAL,
                    subtipo: tipoMovimiento,
                    monto: montoEfectivo,
                    saldoAnterior,
                    saldoRestante: nuevoSaldoPendiente,
                    metodoPago: METODOS_DEVOLUCION[metodoPago] ? metodoPago : 'transferencia',
                    metodoPagoNombre: METODOS_DEVOLUCION[metodoPago] || METODOS_DEVOLUCION.transferencia,
                    referenciaPago: (referenciaPago || '').trim(),
                    comentario: (comentario || '').trim() || (quedaLiquidado ? 'Liquidación de reembolso' : 'Devolución parcial (abono)'),
                    comprobanteUrl: comprobanteUrl || null,
                    comprobantePath: comprobantePath || null,
                    comprobanteNombre: comprobanteNombre || null,
                    fecha: nowIso,
                    realizadoPorUid: realizadoPorUid || 'unknown',
                    realizadoPorNombre: realizadoPorNombre || 'Colaborador Autorizado',
                    realizadoPorEmail: realizadoPorEmail || '',
                    realizadoPorRol: realizadoPorRol || ''
                };

                const nuevoHistorial = [...historialPrevio, movimiento];

                const camposActualizados = {
                    montoReembolsado: nuevoMontoReembolsado,
                    saldoPendiente: nuevoSaldoPendiente,
                    porcentajeReembolsado,
                    tipoDevolucionActual,
                    estado: nuevoEstado,
                    historialDevoluciones: nuevoHistorial,
                    ultimoRevisorUid: realizadoPorUid || null,
                    ultimoRevisorNombre: realizadoPorNombre || null,
                    ultimoRevisorEmail: realizadoPorEmail || null,
                    fechaUltimaResolucion: nowIso,
                    comentarioResolucion: movimiento.comentario,
                    updatedAt: nowIso
                };

                transaction.update(docRef, camposActualizados);

                return {
                    id: reembolsoId,
                    ...actual,
                    ...camposActualizados,
                    ultimoMovimiento: movimiento
                };
            });

            this.clearCache();

            const esTotal = resultado.estado === ESTADOS_REEMBOLSO.LIQUIDADO;
            return {
                success: true,
                data: resultado,
                message: esTotal
                    ? `Reembolso ${resultado.folio} liquidado al 100% (Saldo pendiente: $0.00 MXN).`
                    : `Devolución parcial registrada en ${resultado.folio}. Saldo restante: $${resultado.saldoPendiente.toFixed(2)} MXN.`
            };
        } catch (error) {
            console.error('❌ Error en registrarDevolucionTransaccional:', error);
            return {
                success: false,
                error: error.message || 'No se pudo procesar la devolución del reembolso.'
            };
        }
    }

    /**
     * Rechaza un reembolso pendiente almacenando quién dictaminó el rechazo
     */
    async rechazarReembolsoTransaccional(reembolsoId, {
        comentario = '',
        realizadoPorUid,
        realizadoPorNombre,
        realizadoPorEmail = '',
        realizadoPorRol = ''
    }) {
        try {
            const docRef = doc(db, this.collectionName, reembolsoId);

            const resultado = await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(docRef);
                if (!snap.exists()) {
                    throw new Error('El reembolso no existe.');
                }

                const actual = snap.data();
                if ((actual.montoReembolsado || 0) > 0) {
                    throw new Error('No se puede rechazar un reembolso que ya cuenta con devoluciones o abonos aplicados.');
                }

                const nowIso = new Date().toISOString();
                const camposActualizados = {
                    estado: ESTADOS_REEMBOLSO.RECHAZADO,
                    ultimoRevisorUid: realizadoPorUid || null,
                    ultimoRevisorNombre: realizadoPorNombre || null,
                    ultimoRevisorEmail: realizadoPorEmail || null,
                    ultimoRevisorRol: realizadoPorRol || null,
                    fechaUltimaResolucion: nowIso,
                    comentarioResolucion: (comentario || '').trim() || 'Reembolso rechazado',
                    updatedAt: nowIso
                };

                transaction.update(docRef, camposActualizados);

                return {
                    id: reembolsoId,
                    ...actual,
                    ...camposActualizados
                };
            });

            this.clearCache();
            return {
                success: true,
                data: resultado,
                message: `El reembolso ${resultado.folio} ha sido marcado como rechazado.`
            };
        } catch (error) {
            console.error('❌ Error al rechazar reembolso:', error);
            return {
                success: false,
                error: error.message || 'No se pudo rechazar el reembolso.'
            };
        }
    }

    /**
     * Obtiene los reembolsos de un colaborador acotados estrictamente a un mes y año
     * Utiliza el índice compuesto (colaboradorUid ASC, fechaRegistro DESC)
     */
    async getReembolsosColaboradorPorMes(colaboradorUid, anio, mes, forceRefresh = false) {
        const anioNum = Number(anio);
        const mesNum = Number(mes);
        const mesPad = String(mesNum).padStart(2, '0');
        const ultimoDiaMes = new Date(anioNum, mesNum, 0).getDate();
        const fechaInicio = `${anioNum}-${mesPad}-01`;
        const fechaFin = `${anioNum}-${mesPad}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const cacheKey = this._getCacheKey('list', {
            colaboradorUid,
            fechaInicio,
            fechaFin,
            type: 'reembolsos_mes_individual'
        });

        if (!forceRefresh) {
            const cached = this._getFromCache('list', cacheKey);
            if (cached) return cached;
        }

        try {
            const q = query(
                this._getCollection(),
                where('colaboradorUid', '==', colaboradorUid),
                where('fechaRegistro', '>=', fechaInicio),
                where('fechaRegistro', '<=', fechaFin),
                orderBy('fechaRegistro', 'desc')
            );
            const snap = await getDocs(q);
            const items = [];
            snap.forEach(d => items.push({ id: d.id, ...d.data() }));
            items.sort((a, b) => (b.createdAt || b.fechaRegistro || '').localeCompare(a.createdAt || a.fechaRegistro || ''));
            this._setCache('list', cacheKey, items);
            return items;
        } catch (error) {
            console.warn('⚠️ Fallback en getReembolsosColaboradorPorMes:', error.message);
            const qFallback = query(
                this._getCollection(),
                where('colaboradorUid', '==', colaboradorUid)
            );
            const snap = await getDocs(qFallback);
            const items = [];
            snap.forEach(d => {
                const data = d.data();
                const fechaRef = data.fechaRegistro || data.fechaGasto || '';
                if (fechaRef >= fechaInicio && fechaRef <= fechaFin) {
                    items.push({ id: d.id, ...data });
                }
            });
            items.sort((a, b) => (b.createdAt || b.fechaRegistro || '').localeCompare(a.createdAt || a.fechaRegistro || ''));
            this._setCache('list', cacheKey, items);
            return items;
        }
    }

    /**
     * Obtiene todos los reembolsos de un periodo para el panel administrativo
     */
    async getReembolsosPorPeriodo({
        fechaInicio = null,
        fechaFin = null,
        colaboradorUid = null,
        estado = null,
        limite = 500
    } = {}, forceRefresh = false) {
        const cacheKey = this._getCacheKey('list', {
            fechaInicio,
            fechaFin,
            colaboradorUid,
            estado,
            limite,
            type: 'reembolsos_admin_periodo'
        });

        if (!forceRefresh) {
            const cached = this._getFromCache('list', cacheKey);
            if (cached) return cached;
        }

        try {
            let constraints = [];
            if (colaboradorUid && colaboradorUid !== 'todos') {
                constraints.push(where('colaboradorUid', '==', colaboradorUid));
            }
            if (fechaInicio) {
                constraints.push(where('fechaRegistro', '>=', fechaInicio));
            }
            if (fechaFin) {
                constraints.push(where('fechaRegistro', '<=', fechaFin));
            }
            constraints.push(orderBy('fechaRegistro', 'desc'));
            constraints.push(limit(limite));

            const q = query(this._getCollection(), ...constraints);
            const snap = await getDocs(q);
            let items = [];
            snap.forEach(d => items.push({ id: d.id, ...d.data() }));

            if (estado && estado !== 'todos') {
                items = items.filter(r => r.estado === estado);
            }

            items.sort((a, b) => (b.createdAt || b.fechaRegistro || '').localeCompare(a.createdAt || a.fechaRegistro || ''));
            this._setCache('list', cacheKey, items);
            return items;
        } catch (error) {
            console.warn('⚠️ Fallback en getReembolsosPorPeriodo:', error.message);
            const snap = await getDocs(this._getCollection());
            let items = [];
            snap.forEach(d => items.push({ id: d.id, ...d.data() }));

            if (fechaInicio) {
                items = items.filter(r => (r.fechaRegistro || r.fechaGasto || '') >= fechaInicio);
            }
            if (fechaFin) {
                items = items.filter(r => (r.fechaRegistro || r.fechaGasto || '') <= fechaFin);
            }
            if (colaboradorUid && colaboradorUid !== 'todos') {
                items = items.filter(r => r.colaboradorUid === colaboradorUid);
            }
            if (estado && estado !== 'todos') {
                items = items.filter(r => r.estado === estado);
            }

            items.sort((a, b) => (b.createdAt || b.fechaRegistro || '').localeCompare(a.createdAt || a.fechaRegistro || ''));
            this._setCache('list', cacheKey, items);
            return items;
        }
    }
}

export default ReembolsoRepository;
