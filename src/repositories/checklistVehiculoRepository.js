/* ========================================
   CHECKLIST VEHICULO REPOSITORY - RSI ENTERPRISE
   Persistencia, asignación consecutiva y transacciones atómicas
   para checklists de salida vehicular
   ======================================== */

import { 
    db,
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    runTransaction
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class ChecklistVehiculoRepository extends BaseRepository {
    constructor() {
        super('checklists_vehiculos', 60000);
        this.contadorRef = doc(db, 'contadores', 'checklists_vehiculos');
    }

    _getCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Genera un folio consecutivo atómico para el checklist de salida
     * @returns {Promise<{ contador: number, folio: string }>}
     */
    async generarFolioAtomic() {
        try {
            const nuevoContador = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(this.contadorRef);
                let count = 1;
                if (!docSnap.exists()) {
                    transaction.set(this.contadorRef, { count: count, updatedAt: new Date().toISOString() });
                } else {
                    count = (docSnap.data().count || 0) + 1;
                    transaction.update(this.contadorRef, { count: count, updatedAt: new Date().toISOString() });
                }
                return count;
            });

            const padNumber = String(nuevoContador).padStart(4, '0');
            return {
                contador: nuevoContador,
                folio: `SAL-RSI-${padNumber}`
            };
        } catch (error) {
            console.error('❌ Error generando folio atómico de salida vehicular:', error);
            const fallback = Date.now().toString().slice(-6);
            return {
                contador: Date.now(),
                folio: `SAL-RSI-${fallback}`
            };
        }
    }

    /**
     * Guarda un nuevo checklist de salida vehicular y aparta el estado del auto a 'salida_pendiente'
     * @param {Object} checklistData
     * @returns {Promise<{ docId: string, folio: string }>}
     */
    async createChecklistSalida(checklistData) {
        try {
            const vehiculoRef = doc(db, 'vehiculos', checklistData.vehiculoId);

            // Operación con transacción para verificar disponibilidad y actualizar vehículo
            const result = await runTransaction(db, async (transaction) => {
                const vehiculoDoc = await transaction.get(vehiculoRef);
                if (!vehiculoDoc.exists()) {
                    throw new Error('El vehículo seleccionado no existe en la base de datos.');
                }

                const vehiculoData = vehiculoDoc.data();
                if (!vehiculoData.activo) {
                    throw new Error('El vehículo seleccionado se encuentra inactivo.');
                }

                if (vehiculoData.estadoOperativo === 'en_salida') {
                    throw new Error('El vehículo ya se encuentra en ruta / fuera de instalaciones.');
                }

                if (vehiculoData.estadoOperativo === 'mantenimiento') {
                    throw new Error('El vehículo se encuentra en mantenimiento.');
                }

                if (vehiculoData.estadoOperativo === 'salida_pendiente') {
                    throw new Error('El vehículo ya tiene una salida pendiente de aceptación por firmar.');
                }

                // Generar nuevo documento de checklist
                const newDocRef = doc(this._getCollection());
                transaction.set(newDocRef, checklistData);

                // Actualizar vehículo a salida pendiente
                transaction.update(vehiculoRef, {
                    estadoOperativo: 'salida_pendiente',
                    ultimaSalidaFolio: checklistData.folio,
                    ultimaSalidaFecha: checklistData.createdAt,
                    responsableActualUid: checklistData.receptorUid,
                    responsableActualNombre: checklistData.receptorNombre,
                    updatedAt: new Date().toISOString(),
                    updatedBy: checklistData.inspectorUid
                });

                return {
                    docId: newDocRef.id,
                    folio: checklistData.folio
                };
            });

            this.clearCache();
            return result;
        } catch (error) {
            console.error('❌ Error en createChecklistSalida:', error);
            throw error;
        }
    }

    /**
     * Obtiene un checklist por su ID de documento
     * @param {string} id
     * @param {boolean} forceRefresh
     * @returns {Promise<Object|null>}
     */
    async getChecklistById(id, forceRefresh = false) {
        return await this.getById(id, forceRefresh);
    }

    /**
     * Obtiene todos los checklists de un vehículo
     * @param {string} vehiculoId
     * @returns {Promise<Array>}
     */
    async getChecklistsByVehiculo(vehiculoId) {
        try {
            const q = query(
                this._getCollection(),
                where('vehiculoId', '==', vehiculoId)
            );
            const snapshot = await getDocs(q);
            const items = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (error) {
            console.error('❌ Error obteniendo historial de vehículo:', error);
            return [];
        }
    }

    /**
     * Obtiene checklists pendientes de aceptación para un colaborador específico (receptor)
     * @param {string} receptorUid
     * @returns {Promise<Array>}
     */
    async getChecklistsPendientesReceptor(receptorUid) {
        try {
            if (!receptorUid) return [];
            const q = query(
                this._getCollection(),
                where('receptorUid', '==', receptorUid),
                where('estado', '==', 'pendiente_aceptacion')
            );
            const snapshot = await getDocs(q);
            const items = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (error) {
            console.error('❌ Error obteniendo checklists pendientes del receptor:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los checklists de salida asignados a un colaborador específico
     * @param {string} receptorUid
     * @returns {Promise<Array>}
     */
    async getChecklistsByReceptor(receptorUid) {
        try {
            if (!receptorUid) return [];
            const q = query(
                this._getCollection(),
                where('receptorUid', '==', receptorUid)
            );
            const snapshot = await getDocs(q);
            const items = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (error) {
            console.error('❌ Error obteniendo checklists del receptor:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los checklists ordenados cronológicamente
     * @param {boolean} forceRefresh
     * @returns {Promise<Array>}
     */
    async getAllChecklists(forceRefresh = false) {
        try {
            const snapshot = await getDocs(this._getCollection());
            const items = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (error) {
            console.error('❌ Error obteniendo todos los checklists:', error);
            return [];
        }
    }

    /**
     * Firma y acepta electrónicamente una salida de vehículo mediante transacción atómica
     * Transiciona el checklist a 'aceptada' y el vehículo a 'en_salida'
     * @param {string} checklistId
     * @param {Object} firmaPayload - { firmaUrl, firmaPath, declaracionAceptada, observacionesReceptor, receptorUid, receptorNombre }
     * @returns {Promise<boolean>}
     */
    async firmarAceptacionAtomic(checklistId, firmaPayload) {
        try {
            const checklistRef = doc(db, this.collectionName, checklistId);

            await runTransaction(db, async (transaction) => {
                const checkDoc = await transaction.get(checklistRef);
                if (!checkDoc.exists()) {
                    throw new Error('La inspección de salida vehicular no existe.');
                }

                const checkData = checkDoc.data();
                if (checkData.estado !== 'pendiente_aceptacion') {
                    throw new Error(`Esta salida ya se encuentra en estado: ${checkData.estado}`);
                }

                // Verificar que quien firma sea el receptor asignado
                if (checkData.receptorUid !== firmaPayload.receptorUid) {
                    throw new Error('Solo el colaborador asignado como receptor puede firmar esta salida.');
                }

                const vehiculoRef = doc(db, 'vehiculos', checkData.vehiculoId);
                const vehiculoDoc = await transaction.get(vehiculoRef);
                if (!vehiculoDoc.exists()) {
                    throw new Error('El vehículo asociado a la salida no fue encontrado.');
                }

                const now = new Date().toISOString();

                // 1. Actualizar checklist
                transaction.update(checklistRef, {
                    estado: 'aceptada',
                    aceptacion: {
                        firmado: true,
                        firmaUrl: firmaPayload.firmaUrl,
                        firmaPath: firmaPayload.firmaPath,
                        fechaHoraFirma: now,
                        firmadoPorUid: firmaPayload.receptorUid,
                        firmadoPorNombre: firmaPayload.receptorNombre,
                        declaracionAceptada: true,
                        observacionesReceptor: (firmaPayload.observacionesReceptor || '').trim()
                    },
                    updatedAt: now
                });

                // 2. Actualizar vehículo a 'en_salida' con su kilometraje de salida
                transaction.update(vehiculoRef, {
                    estadoOperativo: 'en_salida',
                    kilometrajeActual: checkData.kilometrajeSalida,
                    combustibleNivel: checkData.nivelCombustibleSalida,
                    responsableActualUid: checkData.receptorUid,
                    responsableActualNombre: checkData.receptorNombre,
                    ultimaSalidaFolio: checkData.folio,
                    ultimaSalidaFecha: checkData.createdAt,
                    updatedAt: now,
                    updatedBy: firmaPayload.receptorUid
                });
            });

            this.clearCache();
            return true;
        } catch (error) {
            console.error('❌ Error en firmarAceptacionAtomic:', error);
            throw error;
        }
    }

    /**
     * Rechaza o cancela una salida vehicular
     * @param {string} checklistId
     * @param {string} motivo
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async cancelarSalidaAtomic(checklistId, motivo, userId) {
        try {
            const checklistRef = doc(db, this.collectionName, checklistId);

            await runTransaction(db, async (transaction) => {
                const checkDoc = await transaction.get(checklistRef);
                if (!checkDoc.exists()) throw new Error('Checklist no encontrado.');

                const checkData = checkDoc.data();
                const now = new Date().toISOString();

                transaction.update(checklistRef, {
                    estado: 'cancelada',
                    motivoCancelacion: motivo || 'Cancelada por el usuario',
                    canceladaPorUid: userId,
                    updatedAt: now
                });

                // Devolver vehículo a disponible si estaba en salida pendiente
                const vehiculoRef = doc(db, 'vehiculos', checkData.vehiculoId);
                const vehiculoDoc = await transaction.get(vehiculoRef);
                if (vehiculoDoc.exists() && vehiculoDoc.data().estadoOperativo === 'salida_pendiente') {
                    transaction.update(vehiculoRef, {
                        estadoOperativo: 'disponible',
                        responsableActualUid: null,
                        responsableActualNombre: null,
                        updatedAt: now,
                        updatedBy: userId
                    });
                }
            });

            this.clearCache();
            return true;
        } catch (error) {
            console.error('❌ Error cancelando salida:', error);
            throw error;
        }
    }
}

export default ChecklistVehiculoRepository;
