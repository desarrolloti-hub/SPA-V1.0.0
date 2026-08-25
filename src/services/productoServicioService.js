/* ========================================
   PRODUCTO/SERVICIO SERVICE
   Lógica de negocio para gestión de productos y servicios
   ======================================== */

import ProductoServicioRepository from '../repositories/productoServicioRepository.js';
import ProductoServicioModel from '../models/productoServicioModel.js';

export class ProductoServicioService {
    
    constructor() {
        this.repository = new ProductoServicioRepository();
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
     * Valida los datos del producto/servicio
     */
    validateProductoServicio(data) {
        return ProductoServicioModel.validate(data);
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

            const validation = this.validateProductoServicio(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            // ✅ El modelo ahora incluye imagenBase64 e imagenNombre
            const productData = ProductoServicioModel.create(data, uid, userData);
            
            // ✅ Log para verificar que la imagen está en el modelo
            console.log('📸 ProductData - imagenBase64:', productData.imagenBase64 ? '✅ Presente (longitud: ' + productData.imagenBase64.length + ')' : '❌ No presente');
            console.log('📸 ProductData - imagenNombre:', productData.imagenNombre || '❌ No presente');

            const docId = await this.repository.createProductoServicio(productData);

            return {
                success: true,
                id: docId,
                message: 'Producto/Servicio creado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createProductoServicio:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los productos/servicios
     */
    async getAllProductosServicios() {
        try {
            const items = await this.repository.getAllProductosServicios();
            return items.map(item => ProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en getAllProductosServicios:', error);
            throw error;
        }
    }

    /**
     * Obtiene productos/servicios activos
     */
    async getActiveProductosServicios() {
        try {
            const items = await this.repository.getActiveProductosServicios();
            return items.map(item => ProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en getActiveProductosServicios:', error);
            return [];
        }
    }

    /**
     * Obtiene productos/servicios por categoría
     */
    async getProductosServiciosByCategoria(categoriaId) {
        try {
            const items = await this.repository.getProductosServiciosByCategoria(categoriaId);
            return items.map(item => ProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en getProductosServiciosByCategoria:', error);
            return [];
        }
    }

    /**
     * Obtiene un producto/servicio por ID
     */
    async getProductoServicioById(id) {
        try {
            const item = await this.repository.getProductoServicioById(id);
            return item ? ProductoServicioModel.toDisplay(item) : null;
        } catch (error) {
            console.error('❌ Error en getProductoServicioById:', error);
            return null;
        }
    }

    /**
     * Obtiene datos crudos de un producto/servicio por ID (para edición)
     */
    async getProductoServicioRawById(id) {
        try {
            return await this.repository.getProductoServicioById(id);
        } catch (error) {
            console.error('❌ Error en getProductoServicioRawById:', error);
            return null;
        }
    }

    /**
     * Actualiza un producto/servicio
     */
    async updateProductoServicio(id, data) {
        try {
            const uid = this._getCurrentUserUid();
            const userData = this._getCurrentUserData();
            
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateProductoServicio(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            // Obtener el producto actual para mantener datos que no se envían
            const currentItem = await this.repository.getProductoServicioById(id);
            if (!currentItem) {
                throw new Error('Producto/Servicio no encontrado');
            }

            // ✅ Si no se envía nueva imagen, mantener la existente
            const updateData = {
                ...currentItem,
                ...data,
                // Si no hay imagenBase64 en data, mantener la del currentItem
                imagenBase64: data.imagenBase64 || currentItem.imagenBase64 || '',
                imagenNombre: data.imagenNombre || currentItem.imagenNombre || ''
            };

            const finalUpdateData = ProductoServicioModel.update(
                updateData,
                uid,
                userData
            );

            // ✅ Log para verificar que la imagen está en la actualización
            console.log('📸 FinalUpdateData - imagenBase64:', finalUpdateData.imagenBase64 ? '✅ Presente (longitud: ' + finalUpdateData.imagenBase64.length + ')' : '❌ No presente');
            console.log('📸 FinalUpdateData - imagenNombre:', finalUpdateData.imagenNombre || '❌ No presente');

            await this.repository.updateProductoServicio(id, finalUpdateData);

            return {
                success: true,
                message: 'Producto/Servicio actualizado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateProductoServicio:', error);
            throw error;
        }
    }

    /**
     * Elimina un producto/servicio
     */
    async deleteProductoServicio(id) {
        try {
            await this.repository.deleteProductoServicio(id);
            return {
                success: true,
                message: 'Producto/Servicio eliminado exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en deleteProductoServicio:', error);
            throw error;
        }
    }

    /**
     * Cambia el estado activo/inactivo
     */
    async toggleActivo(id, activo) {
        try {
            await this.repository.toggleActivo(id, activo);
            return {
                success: true,
                message: `Producto/Servicio ${activo ? 'activado' : 'desactivado'} exitosamente`
            };
        } catch (error) {
            console.error('❌ Error en toggleActivo:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de productos/servicios
     */
    async getProductoServicioStats() {
        try {
            return await this.repository.getProductoServicioStats();
        } catch (error) {
            console.error('❌ Error en getProductoServicioStats:', error);
            return { total: 0, activos: 0, inactivos: 0, totalPrecio: 0, promedioPrecio: 0 };
        }
    }

    /**
     * Busca productos/servicios por nombre
     */
    async searchProductosServicios(searchTerm) {
        try {
            const items = await this.repository.searchProductosServicios(searchTerm);
            return items.map(item => ProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en searchProductosServicios:', error);
            return [];
        }
    }

    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default ProductoServicioService;