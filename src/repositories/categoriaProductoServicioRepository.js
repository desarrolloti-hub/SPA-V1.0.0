/* ========================================
   CATEGORÍA PRODUCTO/SERVICIO REPOSITORY
   Conexión a Firebase para gestión de categorías
   ======================================== */

import { 
    db,
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class CategoriaProductoServicioRepository extends BaseRepository {
    
    constructor() {
        super('categoriasProductoServicio', 60000);
    }

    /**
     * Obtiene el usuario actual desde localStorage
     */
    _getCurrentUser() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const sessionData = JSON.parse(session);
            return {
                uid: sessionData.uid || '',
                nombre: sessionData.nombreCompleto || sessionData.displayName || '',
                email: sessionData.email || ''
            };
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene el UID del usuario actual
     */
    _getCurrentUserUid() {
        const user = this._getCurrentUser();
        return user?.uid || null;
    }

    /**
     * Obtiene los datos del usuario actual
     */
    _getCurrentUserData() {
        return this._getCurrentUser();
    }

    /**
     * Crea una nueva categoría
     */
    async createCategoria(data) {
        try {
            const uid = this._getCurrentUserUid();
            const userData = this._getCurrentUserData();
            
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Categoría creada:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando categoría:', error);
            throw new Error('Error al crear la categoría: ' + error.message);
        }
    }

    /**
     * Obtiene todas las categorías
     */
    async getAllCategorias() {
        try {
            const q = query(
                this._getCollection(), 
                orderBy('nombreCategoria', 'asc')
            );
            const snapshot = await getDocs(q);
            
            const items = [];
            snapshot.forEach(doc => {
                items.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return items;
        } catch (error) {
            console.error('❌ Error obteniendo categorías:', error);
            throw new Error('Error al obtener las categorías');
        }
    }

    /**
     * Obtiene una categoría por ID
     */
    async getCategoriaById(id) {
        try {
            return await this.getById(id);
        } catch (error) {
            console.error('❌ Error obteniendo categoría:', error);
            return null;
        }
    }

    /**
     * Actualiza una categoría
     */
    async updateCategoria(id, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                ...data,
                fechaActualizacion: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Categoría actualizada:', id);
        } catch (error) {
            console.error('❌ Error actualizando categoría:', error);
            throw new Error('Error al actualizar la categoría: ' + error.message);
        }
    }

    /**
     * Elimina una categoría
     */
    async deleteCategoria(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Categoría eliminada:', id);
        } catch (error) {
            console.error('❌ Error eliminando categoría:', error);
            throw new Error('Error al eliminar la categoría');
        }
    }

    /**
     * Obtiene el nombre de una categoría por ID (con caché)
     */
    async getCategoriaNombre(id) {
        if (!id) return 'Sin categoría';
        
        const cacheKey = this._getCacheKey('categoriaNombre', { id });
        const cached = this._getFromCache('single', cacheKey);
        if (cached) return cached;
        
        try {
            const categoria = await this.getCategoriaById(id);
            const nombre = categoria?.nombreCategoria || 'Sin categoría';
            this._setCache('single', cacheKey, nombre);
            return nombre;
        } catch (error) {
            console.error('❌ Error obteniendo nombre de categoría:', error);
            return 'Sin categoría';
        }
    }

    /**
     * Obtiene estadísticas de categorías
     */
    async getCategoriaStats() {
        try {
            const snapshot = await getDocs(this._getCollection());
            let total = 0;
            
            snapshot.forEach(() => {
                total++;
            });
            
            return {
                total
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0 };
        }
    }

    /**
     * Busca categorías por nombre
     */
    async searchCategorias(searchTerm) {
        try {
            const allItems = await this.getAllCategorias();
            const termLower = searchTerm.toLowerCase();
            
            return allItems.filter(item => {
                const nombre = (item.nombreCategoria || '').toLowerCase();
                return nombre.includes(termLower);
            });
        } catch (error) {
            console.error('❌ Error buscando categorías:', error);
            return [];
        }
    }
}

export default CategoriaProductoServicioRepository;