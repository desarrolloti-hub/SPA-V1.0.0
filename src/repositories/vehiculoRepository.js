/* ========================================
   VEHICULO REPOSITORY - RSI ENTERPRISE
   Acceso a datos y persistencia para el parque vehicular
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
    limit,
    runTransaction
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class VehiculoRepository extends BaseRepository {
    constructor() {
        super('vehiculos', 60000);
    }

    /**
     * Obtiene la referencia a la colección de vehículos
     */
    _getCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Obtiene todos los vehículos con opción de filtrado
     * @param {Array} filters - Filtros [{ field, operator, value }]
     * @param {boolean} forceRefresh - Forzar actualización de caché
     * @returns {Promise<Array>}
     */
    async getAllVehiculos(filters = [], forceRefresh = false) {
        try {
            return await this.getAll(filters, 'createdAt', 'desc', forceRefresh);
        } catch (error) {
            console.error('❌ Error obteniendo vehículos:', error);
            // Fallback sin ordenamiento en caso de requerir índices compuestos
            try {
                const snapshot = await getDocs(this._getCollection());
                const items = [];
                snapshot.forEach(docSnap => {
                    items.push({ id: docSnap.id, ...docSnap.data() });
                });
                return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            } catch (err2) {
                console.error('❌ Error en fallback de vehículos:', err2);
                throw error;
            }
        }
    }

    /**
     * Obtiene un vehículo por su ID
     * @param {string} id
     * @param {boolean} forceRefresh
     * @returns {Promise<Object|null>}
     */
    async getVehiculoById(id, forceRefresh = false) {
        return await this.getById(id, forceRefresh);
    }

    /**
     * Verifica si unas placas ya están registradas en otro vehículo
     * @param {string} placas
     * @param {string|null} excludeId
     * @returns {Promise<boolean>}
     */
    async checkPlacasExists(placas, excludeId = null) {
        try {
            const cleanPlacas = (placas || '').trim().toUpperCase().replace(/[\s-]/g, '');
            if (!cleanPlacas) return false;

            const q = query(this._getCollection(), where('placas', '==', cleanPlacas));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return false;

            if (excludeId) {
                return snapshot.docs.some(d => d.id !== excludeId);
            }
            return true;
        } catch (error) {
            console.error('❌ Error verificando placas:', error);
            return false;
        }
    }

    /**
     * Verifica si un número económico ya existe
     * @param {string} numeroEconomico
     * @param {string|null} excludeId
     * @returns {Promise<boolean>}
     */
    async checkNumeroEconomicoExists(numeroEconomico, excludeId = null) {
        try {
            const cleanNum = (numeroEconomico || '').trim().toUpperCase();
            if (!cleanNum) return false;

            const q = query(this._getCollection(), where('numeroEconomico', '==', cleanNum));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return false;

            if (excludeId) {
                return snapshot.docs.some(d => d.id !== excludeId);
            }
            return true;
        } catch (error) {
            console.error('❌ Error verificando número económico:', error);
            return false;
        }
    }

    /**
     * Crea un nuevo registro de vehículo
     * @param {Object} data
     * @returns {Promise<string>} docId
     */
    async createVehiculo(data) {
        try {
            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando vehículo:', error);
            throw error;
        }
    }

    /**
     * Actualiza los datos de un vehículo
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<boolean>}
     */
    async updateVehiculo(id, data) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, data);
            this.clearCache();
            return true;
        } catch (error) {
            console.error('❌ Error actualizando vehículo:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado operativo y kilometraje de un vehículo mediante transacción atómica
     * @param {string} vehiculoId
     * @param {string} nuevoEstado
     * @param {Object} metadata
     * @returns {Promise<boolean>}
     */
    async updateEstadoOperativoAtomic(vehiculoId, nuevoEstado, metadata = {}) {
        try {
            const vehiculoRef = doc(db, this.collectionName, vehiculoId);
            await runTransaction(db, async (transaction) => {
                const vehiculoDoc = await transaction.get(vehiculoRef);
                if (!vehiculoDoc.exists()) {
                    throw new Error('El vehículo no existe.');
                }

                const currentData = vehiculoDoc.data();
                const updatePayload = {
                    estadoOperativo: nuevoEstado,
                    updatedAt: new Date().toISOString(),
                    ...metadata
                };

                if (metadata.kilometrajeActual && metadata.kilometrajeActual > (currentData.kilometrajeActual || 0)) {
                    updatePayload.kilometrajeActual = metadata.kilometrajeActual;
                }

                transaction.update(vehiculoRef, updatePayload);
            });

            this.clearCache();
            return true;
        } catch (error) {
            console.error('❌ Error actualizando estado operativo atómicamente:', error);
            throw error;
        }
    }
}

export default VehiculoRepository;
