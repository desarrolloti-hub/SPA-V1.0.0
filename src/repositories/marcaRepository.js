/* ==========================================================================
   MARCA REPOSITORY - RSI Enterprise
   Persistencia en Firestore y caché para Marcas Comerciales Ecommerce
   ========================================================================== */

import { BaseRepository } from './baseRepository.js';
import { 
    db, 
    collection, 
    doc, 
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs, 
    query, 
    where, 
    orderBy 
} from '../config/firebaseConfig.js';

export class MarcaRepository extends BaseRepository {
    constructor() {
        super('ecommerceMarcas', 60000); // 60s TTL
    }

    /**
     * Crea una nueva marca en Firestore
     * @param {Object} data 
     * @returns {Promise<string>} ID del documento creado
     */
    async create(data) {
        try {
            const colRef = collection(db, this.collectionName);
            const docRef = await addDoc(colRef, data);
            this.clearCache();
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando marca en Firestore:', error);
            throw error;
        }
    }

    /**
     * Actualiza una marca existente
     * @param {string} id 
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async update(id, data) {
        try {
            if (!id) throw new Error('ID requerido para actualizar marca');
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, data);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando marca ${id}:`, error);
            throw error;
        }
    }

    /**
     * Elimina una marca de Firestore
     * @param {string} id 
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        try {
            if (!id) throw new Error('ID requerido para eliminar marca');
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando marca ${id}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene todas las marcas ordenadas alfabéticamente
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllMarcas(forceRefresh = false) {
        try {
            const cacheKey = this._getCacheKey('all_marcas');
            if (!forceRefresh) {
                const cached = this._getFromCache('list', cacheKey);
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const snapshot = await getDocs(colRef);
            
            const list = [];
            snapshot.forEach(docSnap => {
                list.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            // Ordenar por nombre ascendente
            list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

            this._setCache('list', cacheKey, list);
            return list;
        } catch (error) {
            console.error('❌ Error en MarcaRepository.getAllMarcas:', error);
            throw error;
        }
    }

    /**
     * Busca si existe una marca con el mismo slug (para evitar duplicados)
     * @param {string} slug 
     * @param {string} [excludeId=null] 
     * @returns {Promise<Object|null>}
     */
    async findBySlug(slug, excludeId = null) {
        try {
            const colRef = collection(db, this.collectionName);
            const q = query(colRef, where('slug', '==', slug));
            const snapshot = await getDocs(q);

            for (const docSnap of snapshot.docs) {
                if (!excludeId || docSnap.id !== excludeId) {
                    return { id: docSnap.id, ...docSnap.data() };
                }
            }
            return null;
        } catch (error) {
            console.error('❌ Error buscando marca por slug:', error);
            return null;
        }
    }

    /**
     * Ajusta el contador de productos asociados a una marca
     * @param {string} marcaId 
     * @param {number} delta 
     */
    async adjustProductosCount(marcaId, delta) {
        if (!marcaId) return;
        try {
            const m = await this.getById(marcaId, true);
            if (!m) return;
            const current = typeof m.productosCount === 'number' ? m.productosCount : 0;
            const nuevo = Math.max(0, current + delta);
            await this.update(marcaId, { productosCount: nuevo });
            this.clearCache();
        } catch (error) {
            console.error(`❌ Error actualizando productosCount para marca ${marcaId}:`, error);
        }
    }
}

export default MarcaRepository;
