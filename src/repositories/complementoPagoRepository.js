/* ==========================================================================
   COMPLEMENTO PAGO REPOSITORY - RSI Enterprise
   Capa de persistencia y caché en memoria para complementos de pago (REP 2.0)
   ========================================================================== */

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

export class ComplementoPagoRepository extends BaseRepository {

    constructor() {
        super('complementos_pago', 60000); // 60 segundos de TTL
    }

    /**
     * Obtiene todos los complementos de pago asociados a una factura específica
     * @param {string} facturaId
     * @returns {Promise<Array<Object>>}
     */
    async getComplementosByFacturaId(facturaId) {
        try {
            if (!facturaId) return [];
            const colRef = collection(db, this.collectionName);
            const q = query(
                colRef,
                where('facturaId', '==', facturaId),
                where('estado', '==', 'activa')
            );
            const snapshot = await getDocs(q);

            const results = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            // Ordenar por número de parcialidad ascendente
            results.sort((a, b) => (a.parcialidad || 0) - (b.parcialidad || 0));
            return results;
        } catch (error) {
            console.error('❌ Error en getComplementosByFacturaId:', error);
            throw error;
        }
    }

    /**
     * Obtiene un complemento de pago por su ID
     * @param {string} id
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Object|null>}
     */
    async getComplementoById(id, forceRefresh = false) {
        try {
            if (!id) return null;
            if (!forceRefresh) {
                const cached = this.getCache(id);
                if (cached) return cached;
            }

            const docRef = doc(db, this.collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) return null;

            const data = { id: docSnap.id, ...docSnap.data() };
            this.setCache(id, data);
            return data;
        } catch (error) {
            console.error(`❌ Error en getComplementoById (${id}):`, error);
            throw error;
        }
    }

    /**
     * Crea un nuevo documento de complemento de pago en Firestore
     * @param {Object} data
     * @returns {Promise<string>} docId
     */
    async createComplemento(data) {
        try {
            const colRef = collection(db, this.collectionName);
            const docRef = await addDoc(colRef, data);
            this.clearCache();
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando complemento de pago:', error);
            throw error;
        }
    }

    /**
     * Actualiza un complemento de pago existente
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<boolean>}
     */
    async updateComplemento(id, data) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            this.invalidateCache(id);
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando complemento de pago (${id}):`, error);
            throw error;
        }
    }

    /**
     * Obtiene el siguiente folio consecutivo para la serie PAG
     * @returns {Promise<number>}
     */
    async getNextFolio() {
        try {
            const counterRef = doc(db, 'contadores', 'contadorComplementosPago');
            return await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const actual = counterDoc.exists() ? (counterDoc.data().count || 0) : 0;
                const siguiente = actual + 1;
                transaction.set(counterRef, {
                    count: siguiente,
                    serie: 'PAG',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                return siguiente;
            });
        } catch (error) {
            console.warn('⚠️ No se pudo obtener folio atómico de contador, calculando por consulta:', error);
            const colRef = collection(db, this.collectionName);
            const q = query(colRef, orderBy('createdAt', 'desc'), limit(1));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return 1;
            const last = snapshot.docs[0].data();
            const lastFolio = parseInt(last.folio, 10);
            return !isNaN(lastFolio) ? lastFolio + 1 : 1;
        }
    }

    /**
     * Obtiene todos los complementos de pago
     * @returns {Promise<Array<Object>>}
     */
    async getAllComplementos() {
        try {
            const colRef = collection(db, this.collectionName);
            const q = query(colRef, orderBy('createdAt', 'desc'), limit(200));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
        } catch (error) {
            console.error('❌ Error obteniendo todos los complementos:', error);
            throw error;
        }
    }
}

export default ComplementoPagoRepository;
