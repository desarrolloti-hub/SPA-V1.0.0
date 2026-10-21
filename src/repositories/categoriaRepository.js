/* ==========================================================================
   CATEGORIA REPOSITORY - RSI Enterprise
   Persistencia en Firestore y caché para Categorías Ecommerce
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

export class CategoriaRepository extends BaseRepository {
    constructor() {
        super('ecommerceCategorias', 60000); // 60s TTL
    }

    /**
     * Crea una nueva categoría en Firestore
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
            console.error('❌ Error creando categoría en Firestore:', error);
            throw error;
        }
    }

    /**
     * Actualiza una categoría existente
     * @param {string} id 
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async update(id, data) {
        try {
            if (!id) throw new Error('ID requerido para actualizar categoría');
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, data);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando categoría ${id}:`, error);
            throw error;
        }
    }

    /**
     * Elimina una categoría de Firestore
     * @param {string} id 
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        try {
            if (!id) throw new Error('ID requerido para eliminar categoría');
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando categoría ${id}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene todas las categorías ordenadas por orden ascendente
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllCategorias(forceRefresh = false) {
        try {
            const cacheKey = this._getCacheKey('all_categorias');
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

            // Ordenar por orden asc, luego por nombre asc
            list.sort((a, b) => {
                const ordA = typeof a.orden === 'number' ? a.orden : 999;
                const ordB = typeof b.orden === 'number' ? b.orden : 999;
                if (ordA !== ordB) return ordA - ordB;
                return (a.nombre || '').localeCompare(b.nombre || '');
            });

            this._setCache('list', cacheKey, list);
            return list;
        } catch (error) {
            console.error('❌ Error en CategoriaRepository.getAllCategorias:', error);
            throw error;
        }
    }

    /**
     * Busca si existe una categoría con el mismo slug (para evitar duplicados)
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
            console.error('❌ Error buscando categoría por slug:', error);
            return null;
        }
    }

    /**
     * Actualiza el contador de productos asociados a una categoría
     * @param {string} categoriaId 
     * @param {number} delta - (+1 o -1)
     */
    async adjustProductosCount(categoriaId, delta) {
        if (!categoriaId) return;
        try {
            const cat = await this.getById(categoriaId, true);
            if (!cat) return;
            const current = typeof cat.productosCount === 'number' ? cat.productosCount : 0;
            const nuevo = Math.max(0, current + delta);
            await this.update(categoriaId, { productosCount: nuevo });
            this.clearCache();
        } catch (error) {
            console.error(`❌ Error actualizando productosCount para categoría ${categoriaId}:`, error);
        }
    }
}

export default CategoriaRepository;
