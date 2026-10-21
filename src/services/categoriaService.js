/* ==========================================================================
   CATEGORIA SERVICE - RSI Enterprise (Ecommerce)
   Lógica de negocio y orquestación para la administración de Categorías
   ========================================================================== */

import { CategoriaModel } from '../models/categoriaModel.js';
import { CategoriaRepository } from '../repositories/categoriaRepository.js';
import { StorageService } from './storageService.js';

export class CategoriaService {
    constructor() {
        this.repository = new CategoriaRepository();
        this.storageService = new StorageService();
    }

    /**
     * Obtiene el usuario actual desde rsi_session
     */
    _getCurrentUser() {
        try {
            const raw = localStorage.getItem('rsi_session');
            return raw ? JSON.parse(raw) : { uid: 'admin', rol: 'admin', nombre: 'Administrador' };
        } catch {
            return { uid: 'admin', rol: 'admin', nombre: 'Administrador' };
        }
    }

    /**
     * Lista todas las categorías
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllCategorias(forceRefresh = false) {
        return await this.repository.getAllCategorias(forceRefresh);
    }

    /**
     * Obtiene una categoría por su ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getCategoriaById(id) {
        if (!id) return null;
        return await this.repository.getById(id, true);
    }

    /**
     * Crea una nueva categoría
     * @param {Object} data 
     * @param {File|Blob|null} imageFile 
     * @returns {Promise<{success: boolean, id?: string, message?: string, error?: string}>}
     */
    async createCategoria(data, imageFile = null) {
        try {
            const validation = CategoriaModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = CategoriaModel.slugify(data.nombre);

            // Verificar duplicados por slug
            const exists = await this.repository.findBySlug(slug);
            if (exists) {
                return { success: false, error: `Ya existe una categoría con el nombre "${data.nombre}".` };
            }

            let imagenUrl = data.imagen || null;
            let imagenPath = null;

            // Subir imagen a Storage si se proporcionó un archivo
            if (imageFile) {
                const uploadRes = await this.storageService.uploadCategoriaImage(imageFile, slug);
                if (!uploadRes.success) {
                    return { success: false, error: `Error subiendo imagen: ${uploadRes.error}` };
                }
                imagenUrl = uploadRes.url;
                imagenPath = uploadRes.path;
            }

            const newRecord = CategoriaModel.create({
                ...data,
                slug,
                imagen: imagenUrl,
                imagenPath
            }, user);

            const docId = await this.repository.create(newRecord);
            this.repository.clearCache();

            return {
                success: true,
                id: docId,
                message: 'Categoría creada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en CategoriaService.createCategoria:', error);
            return { success: false, error: error.message || 'Error al crear la categoría.' };
        }
    }

    /**
     * Actualiza una categoría existente
     * @param {string} id 
     * @param {Object} data 
     * @param {File|Blob|null} imageFile 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async updateCategoria(id, data, imageFile = null) {
        try {
            if (!id) {
                return { success: false, error: 'ID de categoría no especificado.' };
            }

            const existing = await this.repository.getById(id, true);
            if (!existing) {
                return { success: false, error: 'La categoría no existe.' };
            }

            const validation = CategoriaModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = CategoriaModel.slugify(data.nombre);

            // Verificar duplicados excluyendo el id actual
            const duplicate = await this.repository.findBySlug(slug, id);
            if (duplicate) {
                return { success: false, error: `Ya existe otra categoría con el nombre "${data.nombre}".` };
            }

            let imagenUrl = data.imagen !== undefined ? data.imagen : existing.imagen;
            let imagenPath = existing.imagenPath;

            // Si se seleccionó una nueva imagen
            if (imageFile) {
                const uploadRes = await this.storageService.uploadCategoriaImage(imageFile, slug || id);
                if (!uploadRes.success) {
                    return { success: false, error: `Error al subir la nueva imagen: ${uploadRes.error}` };
                }

                // Limpiar imagen previa de Storage si existía
                if (existing.imagenPath && existing.imagenPath !== uploadRes.path) {
                    await this.storageService.deleteCategoriaImage(existing.imagenPath);
                }

                imagenUrl = uploadRes.url;
                imagenPath = uploadRes.path;
            }

            const updateData = CategoriaModel.update({
                ...data,
                slug,
                imagen: imagenUrl,
                imagenPath
            }, user);

            await this.repository.update(id, updateData);
            this.repository.clearCache();

            return {
                success: true,
                message: 'Categoría actualizada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en CategoriaService.updateCategoria:', error);
            return { success: false, error: error.message || 'Error al actualizar la categoría.' };
        }
    }

    /**
     * Cambia el estado activo/inactivo de una categoría
     * @param {string} id 
     * @param {boolean} nuevoEstado 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async toggleActivo(id, nuevoEstado) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };
            await this.repository.update(id, {
                activo: Boolean(nuevoEstado),
                updatedAt: new Date().toISOString()
            });
            this.repository.clearCache();
            return {
                success: true,
                message: `Categoría ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`
            };
        } catch (error) {
            console.error('❌ Error en CategoriaService.toggleActivo:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina una categoría asegurando la integridad referencial
     * @param {string} id 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async deleteCategoria(id) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };

            const cat = await this.repository.getById(id, true);
            if (!cat) return { success: false, error: 'La categoría no existe.' };

            // Protección de integridad referencial: no eliminar si tiene productos asociados
            const prodCount = typeof cat.productosCount === 'number' ? cat.productosCount : 0;
            if (prodCount > 0) {
                return {
                    success: false,
                    error: `No se puede eliminar la categoría "${cat.nombre}" porque tiene ${prodCount} producto(s) asociado(s). Reasigna los productos primero o desactiva la categoría.`
                };
            }

            // Eliminar imagen de Storage si existe
            if (cat.imagenPath) {
                await this.storageService.deleteCategoriaImage(cat.imagenPath);
            }

            await this.repository.delete(id);
            this.repository.clearCache();

            return {
                success: true,
                message: 'Categoría eliminada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en CategoriaService.deleteCategoria:', error);
            return { success: false, error: error.message || 'Error al eliminar la categoría.' };
        }
    }
}

export default CategoriaService;
