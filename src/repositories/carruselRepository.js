/* ==========================================================================
   CARRUSEL REPOSITORY - RSI Enterprise
   Capa de persistencia y caché para las diapositivas del carrusel de inicio.
   ========================================================================== */

import { BaseRepository } from './baseRepository.js';
import { 
    db, 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDoc,
    getDocs, 
    query, 
    where, 
    orderBy,
    writeBatch
} from '../config/firebaseConfig.js';

export class CarruselRepository extends BaseRepository {
    constructor() {
        super('carrusel', 60000); // 60s cache TTL
    }

    /**
     * Obtiene todos los slides ordenados por orden ascendente
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllSlides(forceRefresh = false) {
        try {
            const cacheKey = this._getCacheKey('all_slides');
            if (!forceRefresh) {
                const cached = this._getFromCache('list', cacheKey);
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const snapshot = await getDocs(colRef);
            
            const slides = [];
            snapshot.forEach(docSnap => {
                slides.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            // Ordenar en memoria por campo 'orden' ascendente
            slides.sort((a, b) => {
                const ordenA = typeof a.orden === 'number' ? a.orden : 999;
                const ordenB = typeof b.orden === 'number' ? b.orden : 999;
                return ordenA - ordenB;
            });

            this._setCache('list', cacheKey, slides);
            return slides;
        } catch (error) {
            console.error('❌ Error obteniendo slides en CarruselRepository:', error);
            throw error;
        }
    }

    /**
     * Obtiene únicamente los slides activos para el Home
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getActiveSlides(forceRefresh = false) {
        try {
            const all = await this.getAllSlides(forceRefresh);
            return all.filter(s => s.activo !== false);
        } catch (error) {
            console.error('❌ Error obteniendo slides activos:', error);
            return [];
        }
    }

    /**
     * Obtiene un slide por ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getSlideById(id) {
        try {
            if (!id) return null;
            const docRef = doc(db, this.collectionName, id);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return null;
            return {
                id: snap.id,
                ...snap.data()
            };
        } catch (error) {
            console.error(`❌ Error obteniendo slide ${id}:`, error);
            return null;
        }
    }

    /**
     * Crea un nuevo slide en Firestore
     * @param {Object} data 
     * @returns {Promise<string>}
     */
    async createSlide(data) {
        try {
            const colRef = collection(db, this.collectionName);
            const docRef = await addDoc(colRef, data);
            this.clearCache();
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando slide en CarruselRepository:', error);
            throw error;
        }
    }

    /**
     * Actualiza un slide existente
     * @param {string} id 
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async updateSlide(id, data) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, data);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando slide ${id}:`, error);
            throw error;
        }
    }

    /**
     * Elimina un slide de Firestore
     * @param {string} id 
     * @returns {Promise<boolean>}
     */
    async deleteSlide(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando slide ${id}:`, error);
            throw error;
        }
    }

    /**
     * Cambia el estado activo/inactivo de un slide
     * @param {string} id 
     * @param {boolean} activo 
     * @returns {Promise<boolean>}
     */
    async toggleActivo(id, activo) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                activo: Boolean(activo),
                updatedAt: new Date().toISOString()
            });
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error toggling activo para slide ${id}:`, error);
            throw error;
        }
    }

    /**
     * Actualiza en lote el orden de múltiples slides
     * @param {Array<{ id: string, orden: number }>} items 
     * @returns {Promise<boolean>}
     */
    async updateOrdenBatch(items) {
        try {
            const batch = writeBatch(db);
            const now = new Date().toISOString();

            items.forEach(item => {
                const docRef = doc(db, this.collectionName, item.id);
                batch.update(docRef, {
                    orden: item.orden,
                    updatedAt: now
                });
            });

            await batch.commit();
            this.clearCache();
            return true;
        } catch (error) {
            console.error('❌ Error actualizando orden de slides:', error);
            throw error;
        }
    }
}

export default CarruselRepository;
