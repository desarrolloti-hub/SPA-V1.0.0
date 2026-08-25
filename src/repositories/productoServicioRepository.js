/* ========================================
   PRODUCTO/SERVICIO REPOSITORY
   Conexión a Firebase para gestión de productos y servicios
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
    orderBy,
    limit,
    startAfter
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class ProductoServicioRepository extends BaseRepository {
    
    constructor() {
        super('productosServiciosCotizaciones', 60000);
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
     * Crea un nuevo producto/servicio
     */
    async createProductoServicio(data) {
        try {
            const uid = this._getCurrentUserUid();
            const userData = this._getCurrentUserData();
            
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            // ✅ Log para verificar que la imagen llega
            console.log('📸 Datos a guardar - imagenBase64:', data.imagenBase64 ? '✅ Presente (longitud: ' + data.imagenBase64.length + ')' : '❌ No presente');
            console.log('📸 Datos a guardar - imagenNombre:', data.imagenNombre || '❌ No presente');

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Producto/Servicio creado:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando producto/servicio:', error);
            throw new Error('Error al crear el producto/servicio: ' + error.message);
        }
    }

    /**
     * Obtiene todos los productos/servicios
     */
    async getAllProductosServicios() {
        try {
            const q = query(
                this._getCollection(), 
                orderBy('fechaCreacion', 'desc')
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
            console.error('❌ Error obteniendo productos/servicios:', error);
            throw new Error('Error al obtener los productos/servicios');
        }
    }

    /**
     * Obtiene productos/servicios activos
     */
    async getActiveProductosServicios() {
        try {
            const q = query(
                this._getCollection(),
                where('activo', '==', true),
                orderBy('nombre', 'asc')
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
            console.error('❌ Error obteniendo productos/servicios activos:', error);
            return [];
        }
    }

    /**
     * Obtiene productos/servicios por categoría
     */
    async getProductosServiciosByCategoria(categoriaId) {
        try {
            const q = query(
                this._getCollection(),
                where('categoriaId', '==', categoriaId),
                where('activo', '==', true),
                orderBy('nombre', 'asc')
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
            console.error('❌ Error obteniendo productos por categoría:', error);
            return [];
        }
    }

    /**
     * Obtiene un producto/servicio por ID
     */
    async getProductoServicioById(id) {
        try {
            return await this.getById(id);
        } catch (error) {
            console.error('❌ Error obteniendo producto/servicio:', error);
            return null;
        }
    }

    /**
     * Actualiza un producto/servicio
     */
    async updateProductoServicio(id, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            // ✅ Log para verificar que la imagen llega en actualización
            console.log('📸 Datos a actualizar - imagenBase64:', data.imagenBase64 ? '✅ Presente (longitud: ' + data.imagenBase64.length + ')' : '❌ No presente');
            console.log('📸 Datos a actualizar - imagenNombre:', data.imagenNombre || '❌ No presente');

            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                ...data,
                fechaActualizacion: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Producto/Servicio actualizado:', id);
        } catch (error) {
            console.error('❌ Error actualizando producto/servicio:', error);
            throw new Error('Error al actualizar el producto/servicio: ' + error.message);
        }
    }

    /**
     * Elimina un producto/servicio
     */
    async deleteProductoServicio(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Producto/Servicio eliminado:', id);
        } catch (error) {
            console.error('❌ Error eliminando producto/servicio:', error);
            throw new Error('Error al eliminar el producto/servicio');
        }
    }

    /**
     * Cambia el estado activo/inactivo
     */
    async toggleActivo(id, activo) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                activo: activo,
                fechaActualizacion: new Date().toISOString()
            });
            
            this.clearCache();
            console.log(`✅ Producto/Servicio ${activo ? 'activado' : 'desactivado'}:`, id);
        } catch (error) {
            console.error('❌ Error cambiando estado:', error);
            throw new Error('Error al cambiar el estado del producto/servicio');
        }
    }

    /**
     * Obtiene estadísticas de productos/servicios
     */
    async getProductoServicioStats() {
        try {
            const snapshot = await getDocs(this._getCollection());
            let total = 0;
            let activos = 0;
            let inactivos = 0;
            let totalPrecio = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                total++;
                totalPrecio += data.precioUnitario || 0;
                
                if (data.activo !== false) {
                    activos++;
                } else {
                    inactivos++;
                }
            });
            
            return {
                total,
                activos,
                inactivos,
                totalPrecio,
                promedioPrecio: total > 0 ? totalPrecio / total : 0
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0, activos: 0, inactivos: 0, totalPrecio: 0, promedioPrecio: 0 };
        }
    }

    /**
     * Busca productos/servicios por nombre
     */
    async searchProductosServicios(searchTerm) {
        try {
            const allItems = await this.getAllProductosServicios();
            const termLower = searchTerm.toLowerCase();
            
            return allItems.filter(item => {
                const nombre = (item.nombre || '').toLowerCase();
                return nombre.includes(termLower);
            });
        } catch (error) {
            console.error('❌ Error buscando productos:', error);
            return [];
        }
    }
}

export default ProductoServicioRepository;