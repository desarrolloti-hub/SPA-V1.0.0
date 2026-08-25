/* ========================================
   CATEGORÍA PRODUCTO/SERVICIO SERVICE
   Lógica de negocio para gestión de categorías
   ======================================== */

import CategoriaProductoServicioRepository from '../repositories/categoriaProductoServicioRepository.js';
import CategoriaProductoServicioModel from '../models/categoriaProductoServicioModel.js';

export class CategoriaProductoServicioService {
    
    constructor() {
        this.repository = new CategoriaProductoServicioRepository();
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
     * Valida los datos de la categoría
     */
    validateCategoria(data) {
        return CategoriaProductoServicioModel.validate(data);
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

            const validation = this.validateCategoria(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const categoriaData = CategoriaProductoServicioModel.create(data, uid, userData);
            const docId = await this.repository.createCategoria(categoriaData);

            return {
                success: true,
                id: docId,
                message: 'Categoría creada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createCategoria:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las categorías
     */
    async getAllCategorias() {
        try {
            const items = await this.repository.getAllCategorias();
            return items.map(item => CategoriaProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en getAllCategorias:', error);
            throw error;
        }
    }

    /**
     * Obtiene una categoría por ID (para mostrar)
     */
    async getCategoriaById(id) {
        try {
            const item = await this.repository.getCategoriaById(id);
            return item ? CategoriaProductoServicioModel.toDisplay(item) : null;
        } catch (error) {
            console.error('❌ Error en getCategoriaById:', error);
            return null;
        }
    }

    /**
     * Obtiene una categoría por ID (datos crudos para edición)
     */
    async getCategoriaRawById(id) {
        try {
            return await this.repository.getCategoriaById(id);
        } catch (error) {
            console.error('❌ Error en getCategoriaRawById:', error);
            return null;
        }
    }

    /**
     * Obtiene el nombre de una categoría por ID
     */
    async getCategoriaNombre(id) {
        return await this.repository.getCategoriaNombre(id);
    }

    /**
     * Actualiza una categoría
     */
    async updateCategoria(id, data) {
        try {
            const uid = this._getCurrentUserUid();
            const userData = this._getCurrentUserData();
            
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateCategoria(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const currentItem = await this.repository.getCategoriaById(id);
            if (!currentItem) {
                throw new Error('Categoría no encontrada');
            }

            const updateData = CategoriaProductoServicioModel.update(
                { ...currentItem, ...data },
                uid,
                userData
            );

            await this.repository.updateCategoria(id, updateData);

            return {
                success: true,
                message: 'Categoría actualizada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateCategoria:', error);
            throw error;
        }
    }

    /**
     * Elimina una categoría
     */
    async deleteCategoria(id) {
        try {
            await this.repository.deleteCategoria(id);
            return {
                success: true,
                message: 'Categoría eliminada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en deleteCategoria:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de categorías
     */
    async getCategoriaStats() {
        try {
            return await this.repository.getCategoriaStats();
        } catch (error) {
            console.error('❌ Error en getCategoriaStats:', error);
            return { total: 0 };
        }
    }

    /**
     * Busca categorías por nombre
     */
    async searchCategorias(searchTerm) {
        try {
            const items = await this.repository.searchCategorias(searchTerm);
            return items.map(item => CategoriaProductoServicioModel.toDisplay(item));
        } catch (error) {
            console.error('❌ Error en searchCategorias:', error);
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

export default CategoriaProductoServicioService;