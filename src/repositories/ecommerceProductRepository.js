/* ==========================================================================
   ECOMMERCE PRODUCT REPOSITORY - RSI Enterprise
   Persistencia en Firestore y caché para Productos Ecommerce
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
    orderBy, 
    limit as firestoreLimit 
} from '../config/firebaseConfig.js';

export class EcommerceProductRepository extends BaseRepository {
    constructor() {
        super('ecommerceProductos', 60000); // 60s TTL
    }

    /**
     * Crea un nuevo producto en Firestore
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
            console.error('❌ Error creando producto en Firestore:', error);
            throw error;
        }
    }

    /**
     * Actualiza un producto existente
     * @param {string} id 
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async update(id, data) {
        try {
            if (!id) throw new Error('ID requerido para actualizar producto');
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, data);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando producto ${id}:`, error);
            throw error;
        }
    }

    /**
     * Elimina un producto de Firestore
     * @param {string} id 
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        try {
            if (!id) throw new Error('ID requerido para eliminar producto');
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando producto ${id}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene todos los productos (administración)
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllProducts(forceRefresh = false) {
        try {
            const cacheKey = this._getCacheKey('all_products');
            if (!forceRefresh) {
                const cached = this._getFromCache('list', cacheKey);
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const snapshot = await getDocs(colRef);

            const list = [];
            snapshot.forEach(docSnap => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Ordenar por fecha de creación desc
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            this._setCache('list', cacheKey, list);
            return list;
        } catch (error) {
            console.error('❌ Error en EcommerceProductRepository.getAllProducts:', error);
            throw error;
        }
    }

    /**
     * Obtiene los productos activos para catálogo público
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getPublishedProducts(forceRefresh = false) {
        try {
            const cacheKey = this._getCacheKey('published_products');
            if (!forceRefresh) {
                const cached = this._getFromCache('list', cacheKey);
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const q = query(colRef, where('estado', '==', 'publicado'));
            const snapshot = await getDocs(q);

            const list = [];
            snapshot.forEach(docSnap => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });

            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            this._setCache('list', cacheKey, list);
            return list;
        } catch (error) {
            console.error('❌ Error en getPublishedProducts:', error);
            // Fallback en memoria si falta índice
            const all = await this.getAllProducts(forceRefresh);
            return all.filter(p => p.estado === 'publicado');
        }
    }

    /**
     * Busca por slug para validar unicidad o recuperar detalle
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
            console.error('❌ Error buscando producto por slug:', error);
            return null;
        }
    }

    /**
     * Obtiene productos relacionados (misma categoría > misma marca)
     * @param {string} currentProductId 
     * @param {string} categoriaId 
     * @param {string} marcaId 
     * @param {number} maxCount 
     * @returns {Promise<Array<Object>>}
     */
    async getRelatedProducts(currentProductId, categoriaId, marcaId, maxCount = 4) {
        try {
            const published = await this.getPublishedProducts();
            const candidates = published.filter(p => p.id !== currentProductId);

            // 1. Misma categoría
            const sameCat = candidates.filter(p => p.categoriaId === categoriaId);
            // 2. Misma marca
            const sameMarca = candidates.filter(p => p.marcaId === marcaId && p.categoriaId !== categoriaId);
            // 3. Otros productos publicados
            const others = candidates.filter(p => p.categoriaId !== categoriaId && p.marcaId !== marcaId);

            const combined = [...sameCat, ...sameMarca, ...others];
            return combined.slice(0, maxCount);
        } catch (error) {
            console.error('❌ Error obteniendo productos relacionados:', error);
            return [];
        }
    }
}

export default EcommerceProductRepository;
