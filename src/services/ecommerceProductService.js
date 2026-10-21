/* ==========================================================================
   ECOMMERCE PRODUCT SERVICE - RSI Enterprise
   Lógica de negocio y orquestación para Productos Ecommerce
   ========================================================================== */

import { EcommerceProductModel } from '../models/ecommerceProductModel.js';
import { EcommerceProductRepository } from '../repositories/ecommerceProductRepository.js';
import { CategoriaRepository } from '../repositories/categoriaRepository.js';
import { MarcaRepository } from '../repositories/marcaRepository.js';
import { StorageService } from './storageService.js';

export class EcommerceProductService {
    constructor() {
        this.productRepo = new EcommerceProductRepository();
        this.categoriaRepo = new CategoriaRepository();
        this.marcaRepo = new MarcaRepository();
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
     * Lista todos los productos (administración)
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllProducts(forceRefresh = false) {
        return await this.productRepo.getAllProducts(forceRefresh);
    }

    /**
     * Lista productos publicados para tienda pública
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getPublishedProducts(forceRefresh = false) {
        return await this.productRepo.getPublishedProducts(forceRefresh);
    }

    /**
     * Obtiene un producto por ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getProductById(id) {
        if (!id) return null;
        return await this.productRepo.getById(id, true);
    }

    /**
     * Obtiene un producto por Slug
     * @param {string} slug 
     * @returns {Promise<Object|null>}
     */
    async getProductBySlug(slug) {
        if (!slug) return null;
        return await this.productRepo.findBySlug(slug);
    }

    /**
     * Crea un nuevo producto
     * @param {Object} data 
     * @param {Array<File>} newImageFiles 
     * @param {File|null} newPdfFile 
     * @returns {Promise<{success: boolean, id?: string, message?: string, error?: string}>}
     */
    async createProduct(data, newImageFiles = [], newPdfFile = null) {
        try {
            const validation = EcommerceProductModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = EcommerceProductModel.slugify(data.nombre);

            // Validar unicidad de slug
            const exists = await this.productRepo.findBySlug(slug);
            if (exists) {
                return { success: false, error: `Ya existe un producto con el nombre "${data.nombre}".` };
            }

            // Subir imágenes si se enviaron archivos
            const imagenesList = Array.isArray(data.imagenes) ? [...data.imagenes] : [];
            if (Array.isArray(newImageFiles) && newImageFiles.length > 0) {
                for (let i = 0; i < newImageFiles.length; i++) {
                    const file = newImageFiles[i];
                    const uploadRes = await this.storageService.uploadProductoImage(file, slug, i);
                    if (uploadRes.success) {
                        imagenesList.push({
                            url: uploadRes.url,
                            path: uploadRes.path,
                            principal: imagenesList.length === 0 && i === 0
                        });
                    }
                }
            }

            // Asegurar que exista una imagen principal seleccionada
            if (imagenesList.length > 0 && !imagenesList.some(img => img.principal)) {
                imagenesList[0].principal = true;
            }

            // Subir ficha técnica PDF si aplica
            let fichaPdfObj = data.fichaTecnicaPdf || null;
            if (newPdfFile) {
                const pdfRes = await this.storageService.uploadFichaTecnica(newPdfFile, slug);
                if (pdfRes.success) {
                    fichaPdfObj = {
                        url: pdfRes.url,
                        path: pdfRes.path,
                        nombre: pdfRes.nombre,
                        tamano: pdfRes.tamano
                    };
                }
            }

            // Crear modelo
            const newRecord = EcommerceProductModel.create({
                ...data,
                slug,
                imagenes: imagenesList,
                imagenPrincipal: imagenesList.find(img => img.principal)?.url || imagenesList[0]?.url || null,
                fichaTecnicaPdf: fichaPdfObj
            }, user);

            const docId = await this.productRepo.create(newRecord);
            this.productRepo.clearCache();

            // Incrementar contadores en categoría y marca
            if (newRecord.categoriaId) {
                await this.categoriaRepo.adjustProductosCount(newRecord.categoriaId, 1);
            }
            if (newRecord.marcaId) {
                await this.marcaRepo.adjustProductosCount(newRecord.marcaId, 1);
            }

            return {
                success: true,
                id: docId,
                message: 'Producto creado exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en EcommerceProductService.createProduct:', error);
            return { success: false, error: error.message || 'Error al crear el producto.' };
        }
    }

    /**
     * Actualiza un producto existente
     * @param {string} id 
     * @param {Object} data 
     * @param {Array<File>} newImageFiles 
     * @param {File|null} newPdfFile 
     * @param {Array<string>} pathsToDelete 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async updateProduct(id, data, newImageFiles = [], newPdfFile = null, pathsToDelete = []) {
        try {
            if (!id) return { success: false, error: 'ID de producto no especificado.' };

            const existing = await this.productRepo.getById(id, true);
            if (!existing) return { success: false, error: 'El producto no existe.' };

            const validation = EcommerceProductModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            const user = this._getCurrentUser();
            const slug = EcommerceProductModel.slugify(data.nombre);

            const duplicate = await this.productRepo.findBySlug(slug, id);
            if (duplicate) {
                return { success: false, error: `Ya existe otro producto con el nombre "${data.nombre}".` };
            }

            // Eliminar de Storage las imágenes solicitadas
            if (Array.isArray(pathsToDelete) && pathsToDelete.length > 0) {
                for (const path of pathsToDelete) {
                    await this.storageService.deleteProductoImage(path);
                }
            }

            // Gestionar lista de imágenes
            let imagenesList = Array.isArray(data.imagenes) ? [...data.imagenes] : [...(existing.imagenes || [])];
            // Filtrar eliminadas
            if (pathsToDelete.length > 0) {
                imagenesList = imagenesList.filter(img => !pathsToDelete.includes(img.path));
            }

            // Subir nuevas imágenes
            if (Array.isArray(newImageFiles) && newImageFiles.length > 0) {
                for (let i = 0; i < newImageFiles.length; i++) {
                    const file = newImageFiles[i];
                    const uploadRes = await this.storageService.uploadProductoImage(file, slug || id, Date.now() + i);
                    if (uploadRes.success) {
                        imagenesList.push({
                            url: uploadRes.url,
                            path: uploadRes.path,
                            principal: imagenesList.length === 0
                        });
                    }
                }
            }

            if (imagenesList.length > 0 && !imagenesList.some(img => img.principal)) {
                imagenesList[0].principal = true;
            }

            // Gestión de PDF
            let fichaPdfObj = existing.fichaTecnicaPdf;
            if (data.eliminarPdf && existing.fichaTecnicaPdf?.path) {
                await this.storageService.deleteFichaTecnica(existing.fichaTecnicaPdf.path);
                fichaPdfObj = null;
            }

            if (newPdfFile) {
                if (existing.fichaTecnicaPdf?.path) {
                    await this.storageService.deleteFichaTecnica(existing.fichaTecnicaPdf.path);
                }
                const pdfRes = await this.storageService.uploadFichaTecnica(newPdfFile, slug || id);
                if (pdfRes.success) {
                    fichaPdfObj = {
                        url: pdfRes.url,
                        path: pdfRes.path,
                        nombre: pdfRes.nombre,
                        tamano: pdfRes.tamano
                    };
                }
            }

            const updateData = EcommerceProductModel.update({
                ...data,
                slug,
                imagenes: imagenesList,
                imagenPrincipal: imagenesList.find(img => img.principal)?.url || imagenesList[0]?.url || null,
                fichaTecnicaPdf: fichaPdfObj
            }, user);

            await this.productRepo.update(id, updateData);
            this.productRepo.clearCache();

            // Ajustar contadores de categoría si cambió
            if (existing.categoriaId !== updateData.categoriaId) {
                if (existing.categoriaId) await this.categoriaRepo.adjustProductosCount(existing.categoriaId, -1);
                if (updateData.categoriaId) await this.categoriaRepo.adjustProductosCount(updateData.categoriaId, 1);
            }

            // Ajustar contadores de marca si cambió
            if (existing.marcaId !== updateData.marcaId) {
                if (existing.marcaId) await this.marcaRepo.adjustProductosCount(existing.marcaId, -1);
                if (updateData.marcaId) await this.marcaRepo.adjustProductosCount(updateData.marcaId, 1);
            }

            return {
                success: true,
                message: 'Producto actualizado exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en EcommerceProductService.updateProduct:', error);
            return { success: false, error: error.message || 'Error al actualizar el producto.' };
        }
    }

    /**
     * Cambia el estado de un producto (borrador, publicado, desactivado)
     * @param {string} id 
     * @param {string} nuevoEstado 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async setEstado(id, nuevoEstado) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };
            if (!['borrador', 'publicado', 'desactivado'].includes(nuevoEstado)) {
                return { success: false, error: 'Estado no válido.' };
            }

            await this.productRepo.update(id, {
                estado: nuevoEstado,
                updatedAt: new Date().toISOString()
            });
            this.productRepo.clearCache();

            return {
                success: true,
                message: `Estado cambiado a "${nuevoEstado}".`
            };
        } catch (error) {
            console.error('❌ Error en setEstado:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Alterna producto destacado
     * @param {string} id 
     * @param {boolean} destacado 
     */
    async toggleDestacado(id, destacado) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };
            await this.productRepo.update(id, {
                destacado: Boolean(destacado),
                updatedAt: new Date().toISOString()
            });
            this.productRepo.clearCache();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina un producto y sus archivos en Storage
     * @param {string} id 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async deleteProduct(id) {
        try {
            if (!id) return { success: false, error: 'ID no especificado.' };

            const prod = await this.productRepo.getById(id, true);
            if (!prod) return { success: false, error: 'El producto no existe.' };

            // Eliminar todas las imágenes de Storage
            if (Array.isArray(prod.imagenes)) {
                for (const img of prod.imagenes) {
                    if (img.path) await this.storageService.deleteProductoImage(img.path);
                }
            }

            // Eliminar ficha PDF
            if (prod.fichaTecnicaPdf?.path) {
                await this.storageService.deleteFichaTecnica(prod.fichaTecnicaPdf.path);
            }

            await this.productRepo.delete(id);
            this.productRepo.clearCache();

            // Decrementar contadores
            if (prod.categoriaId) {
                await this.categoriaRepo.adjustProductosCount(prod.categoriaId, -1);
            }
            if (prod.marcaId) {
                await this.marcaRepo.adjustProductosCount(prod.marcaId, -1);
            }

            return {
                success: true,
                message: 'Producto eliminado correctamente.'
            };
        } catch (error) {
            console.error('❌ Error en deleteProduct:', error);
            return { success: false, error: error.message || 'Error al eliminar el producto.' };
        }
    }

    /**
     * Obtiene productos relacionados
     */
    async getRelatedProducts(currentId, categoriaId, marcaId, count = 4) {
        return await this.productRepo.getRelatedProducts(currentId, categoriaId, marcaId, count);
    }
}

export default EcommerceProductService;
