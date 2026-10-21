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

    /**
     * Busca claves y conceptos en el catálogo SAT
     * Soporta búsqueda por clave exacta, prefijo de clave, descripción y fallback
     * @param {string} searchTerm
     * @param {number} maxResults
     * @returns {Promise<Array<{clave: string, descripcion: string, id: string}>>}
     */
    async searchSatCatalog(searchTerm, maxResults = 15) {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        try {
            const cleanTerm = searchTerm.trim();
            const numericTerm = cleanTerm.replace(/[^0-9]/g, '');
            const colRef = collection(db, 'catalogoSAT');
            let results = [];

            // 1. Clave exacta
            if (numericTerm.length >= 1) {
                const exactQuery = query(
                    colRef,
                    where('c_ClaveProdServ', '==', numericTerm),
                    limit(1)
                );
                const exactSnapshot = await getDocs(exactQuery);
                exactSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    results.push({
                        clave: data.c_ClaveProdServ || docSnap.id,
                        descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                        id: docSnap.id
                    });
                });

                if (results.length > 0) {
                    return results;
                }
            }

            // 2. Prefijo de clave
            if (numericTerm.length >= 2) {
                const prefixQuery = query(
                    colRef,
                    where('c_ClaveProdServ', '>=', numericTerm),
                    where('c_ClaveProdServ', '<=', numericTerm + '\uf8ff'),
                    limit(maxResults)
                );
                const prefixSnapshot = await getDocs(prefixQuery);
                prefixSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const clave = data.c_ClaveProdServ || docSnap.id;
                    if (!results.some(r => r.clave === clave)) {
                        results.push({
                            clave: clave,
                            descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                            id: docSnap.id
                        });
                    }
                });

                if (results.length > 0) {
                    return results.slice(0, maxResults);
                }
            }

            // 3. Prefijo de descripción
            if (cleanTerm.length >= 2) {
                const descQuery = query(
                    colRef,
                    where('Descripción', '>=', cleanTerm),
                    where('Descripción', '<=', cleanTerm + '\uf8ff'),
                    limit(maxResults)
                );
                const descSnapshot = await getDocs(descQuery);
                descSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const clave = data.c_ClaveProdServ || docSnap.id;
                    if (!results.some(r => r.clave === clave)) {
                        results.push({
                            clave: clave,
                            descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                            id: docSnap.id
                        });
                    }
                });

                if (results.length > 0) {
                    return results.slice(0, maxResults);
                }
            }

            // 4. Búsqueda flexible / fallback
            const flexQuery = query(colRef, limit(50));
            const flexSnapshot = await getDocs(flexQuery);
            const termLower = cleanTerm.toLowerCase();
            const flexResults = [];

            flexSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const clave = String(data.c_ClaveProdServ || docSnap.id);
                const descripcion = data.Descripción || data.Descripcion || data.nombre || '';

                if (descripcion.toLowerCase().includes(termLower) ||
                    clave.includes(numericTerm) ||
                    clave.includes(cleanTerm)) {
                    flexResults.push({
                        clave: clave,
                        descripcion: descripcion,
                        id: docSnap.id
                    });
                }
            });

            if (flexResults.length === 0 && cleanTerm.length >= 2) {
                try {
                    const docSnap = await getDoc(doc(db, 'catalogoSAT', cleanTerm));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        flexResults.push({
                            clave: String(data.c_ClaveProdServ || docSnap.id),
                            descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                            id: docSnap.id
                        });
                    }
                } catch (e) {}
            }

            flexResults.sort((a, b) => a.clave.localeCompare(b.clave));
            return flexResults.slice(0, maxResults);

        } catch (error) {
            console.error('❌ Error buscando en catálogo SAT:', error);
            try {
                return await this._fallbackSatSearch(searchTerm, maxResults);
            } catch (fallbackErr) {
                console.error('❌ Error en fallback de catálogo SAT:', fallbackErr);
                return [];
            }
        }
    }

    /**
     * Búsqueda fallback para catálogo SAT sin índices
     */
    async _fallbackSatSearch(searchTerm, maxResults = 15) {
        const colRef = collection(db, 'catalogoSAT');
        const q = query(colRef, limit(40));
        const snapshot = await getDocs(q);
        const termLower = searchTerm.toLowerCase().trim();
        const numericTerm = termLower.replace(/[^0-9]/g, '');
        const results = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const clave = String(data.c_ClaveProdServ || docSnap.id);
            const descripcion = data.Descripción || data.Descripcion || data.nombre || '';
            const descLower = descripcion.toLowerCase();

            if ((numericTerm && (clave === numericTerm || clave.includes(numericTerm))) ||
                descLower.includes(termLower)) {
                results.push({
                    clave: clave,
                    descripcion: descripcion,
                    id: docSnap.id
                });
            }
        });

        if (results.length === 0) {
            try {
                const docSnap = await getDoc(doc(db, 'catalogoSAT', searchTerm));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    results.push({
                        clave: String(data.c_ClaveProdServ || docSnap.id),
                        descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                        id: docSnap.id
                    });
                }
            } catch (e) {}
        }

        return results.slice(0, maxResults);
    }

    /**
     * Obtiene un producto/clave del catálogo SAT por clave exacta
     * @param {string} clave
     * @returns {Promise<{clave: string, descripcion: string, id: string}|null>}
     */
    async getSatProductByClave(clave) {
        if (!clave) return null;
        try {
            const cleanClave = String(clave).replace(/[^0-9]/g, '');
            const colRef = collection(db, 'catalogoSAT');
            const q = query(colRef, where('c_ClaveProdServ', '==', cleanClave), limit(1));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const docSnap = snapshot.docs[0];
                const data = docSnap.data();
                return {
                    clave: data.c_ClaveProdServ || docSnap.id,
                    descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                    id: docSnap.id
                };
            }

            // Buscar por ID del doc
            const docSnap = await getDoc(doc(db, 'catalogoSAT', cleanClave));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    clave: data.c_ClaveProdServ || docSnap.id,
                    descripcion: data.Descripción || data.Descripcion || data.nombre || '',
                    id: docSnap.id
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error obteniendo producto SAT por clave:', error);
            return null;
        }
    }
}

export default ProductoServicioRepository;