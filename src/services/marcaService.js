/* ==========================================================================
   MARCA SERVICE - RSI Enterprise (Ecommerce)
   Lógica de negocio y orquestación para Marcas Comerciales
   ========================================================================== */

import { MarcaModel } from '../models/marcaModel.js';
import { MarcaRepository } from '../repositories/marcaRepository.js';
import { StorageService } from './storageService.js';

export class MarcaService {
    constructor() {
        this.repository = new MarcaRepository();
        this.storageService = new StorageService();
    }

    _getCurrentUser() {
        try {
            const raw = localStorage.getItem('rsi_session');
            return raw ? JSON.parse(raw) : { uid: 'admin', rol: 'admin', nombre: 'Administrador' };
        } catch {
            return { uid: 'admin', rol: 'admin', nombre: 'Administrador' };
        }
    }

    /**
     * Lista todas las marcas
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllMarcas(forceRefresh = false) {
        return await this.repository.getAllMarcas(forceRefresh);
    }

    /**
     * Obtiene una marca por su ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getMarcaById(id) {
        if (!id) return null;
        return await this.repository.getById(id, true);
    }

    /**
     * Crea una nueva marca
     * @param {Object} data 
     * @param {File|Blob|null} logoFile 
     * @returns {Promise<{success: boolean, id?: string, message?: string, error?: string}>}
     */
    async createMarca(data, logoFile = null) {
        try {
            const validation = MarcaModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = MarcaModel.slugify(data.nombre);

            // Evitar duplicados por slug
            const exists = await this.repository.findBySlug(slug);
            if (exists) {
                return { success: false, error: `Ya existe una marca con el nombre "${data.nombre}".` };
            }

            let logoUrl = data.logo || null;
            let logoPath = null;

            if (logoFile) {
                const uploadRes = await this.storageService.uploadMarcaLogo(logoFile, slug);
                if (!uploadRes.success) {
                    return { success: false, error: `Error subiendo logotipo: ${uploadRes.error}` };
                }
                logoUrl = uploadRes.url;
                logoPath = uploadRes.path;
            }

            const newRecord = MarcaModel.create({
                ...data,
                slug,
                logo: logoUrl,
                logoPath
            }, user);

            const docId = await this.repository.create(newRecord);
            this.repository.clearCache();

            return {
                success: true,
                id: docId,
                message: 'Marca creada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en MarcaService.createMarca:', error);
            return { success: false, error: error.message || 'Error al crear la marca.' };
        }
    }

    /**
     * Actualiza una marca existente
     * @param {string} id 
     * @param {Object} data 
     * @param {File|Blob|null} logoFile 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async updateMarca(id, data, logoFile = null) {
        try {
            if (!id) return { success: false, error: 'ID de marca no especificado.' };

            const existing = await this.repository.getById(id, true);
            if (!existing) return { success: false, error: 'La marca no existe.' };

            const validation = MarcaModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = MarcaModel.slugify(data.nombre);

            const duplicate = await this.repository.findBySlug(slug, id);
            if (duplicate) {
                return { success: false, error: `Ya existe otra marca con el nombre "${data.nombre}".` };
            }

            let logoUrl = data.logo !== undefined ? data.logo : existing.logo;
            let logoPath = existing.logoPath;

            if (logoFile) {
                const uploadRes = await this.storageService.uploadMarcaLogo(logoFile, slug || id);
                if (!uploadRes.success) {
                    return { success: false, error: `Error al subir el nuevo logo: ${uploadRes.error}` };
                }

                if (existing.logoPath && existing.logoPath !== uploadRes.path) {
                    await this.storageService.deleteMarcaLogo(existing.logoPath);
                }

                logoUrl = uploadRes.url;
                logoPath = uploadRes.path;
            }

            const updateData = MarcaModel.update({
                ...data,
                slug,
                logo: logoUrl,
                logoPath
            }, user);

            await this.repository.update(id, updateData);
            this.repository.clearCache();

            return {
                success: true,
                message: 'Marca actualizada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en MarcaService.updateMarca:', error);
            return { success: false, error: error.message || 'Error al actualizar la marca.' };
        }
    }

    /**
     * Cambia el estado activo/inactivo de una marca
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
                message: `Marca ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`
            };
        } catch (error) {
            console.error('❌ Error en MarcaService.toggleActivo:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina una marca asegurando la integridad referencial
     * @param {string} id 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async deleteMarca(id) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };

            const m = await this.repository.getById(id, true);
            if (!m) return { success: false, error: 'La marca no existe.' };

            const prodCount = typeof m.productosCount === 'number' ? m.productosCount : 0;
            if (prodCount > 0) {
                return {
                    success: false,
                    error: `No se puede eliminar la marca "${m.nombre}" porque tiene ${prodCount} producto(s) asociado(s). Reasigna los productos primero o desactiva la marca.`
                };
            }

            if (m.logoPath) {
                await this.storageService.deleteMarcaLogo(m.logoPath);
            }

            await this.repository.delete(id);
            this.repository.clearCache();

            return {
                success: true,
                message: 'Marca eliminada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en MarcaService.deleteMarca:', error);
            return { success: false, error: error.message || 'Error al eliminar la marca.' };
        }
    }
}

export default MarcaService;
