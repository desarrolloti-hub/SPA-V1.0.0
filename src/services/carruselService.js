/* ==========================================================================
   CARRUSEL SERVICE - RSI Enterprise
   Capa de lógica de negocio para la gestión de diapositivas del carrusel de inicio.
   ========================================================================== */

import { CarruselRepository } from '../repositories/carruselRepository.js';
import { StorageService } from './storageService.js';
import { CarruselModel } from '../models/carruselModel.js';

export class CarruselService {
    constructor() {
        this.repository = new CarruselRepository();
        this.storageService = new StorageService();
    }

    /**
     * Obtiene la sesión del usuario actual
     */
    _getCurrentUser() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return { uid: 'admin', nombre: 'Administrador' };
            const parsed = JSON.parse(session);
            return {
                uid: parsed.uid || 'admin',
                nombre: parsed.displayName || parsed.nombreCompleto || parsed.nombre || 'Administrador'
            };
        } catch {
            return { uid: 'admin', nombre: 'Administrador' };
        }
    }

    /**
     * Obtiene todos los slides registrados
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getAllSlides(forceRefresh = false) {
        try {
            return await this.repository.getAllSlides(forceRefresh);
        } catch (error) {
            console.error('❌ Error en CarruselService.getAllSlides:', error);
            return [];
        }
    }

    /**
     * Obtiene los slides activos transformados para el componente Carousel
     * @param {boolean} forceRefresh 
     * @returns {Promise<Array<Object>>}
     */
    async getActiveSlides(forceRefresh = false) {
        try {
            const rawSlides = await this.repository.getActiveSlides(forceRefresh);
            return rawSlides
                .map(s => CarruselModel.toCarouselSlide(s))
                .filter(Boolean);
        } catch (error) {
            console.error('❌ Error en CarruselService.getActiveSlides:', error);
            return [];
        }
    }

    /**
     * Obtiene un slide por su ID
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async getSlideById(id) {
        try {
            return await this.repository.getSlideById(id);
        } catch (error) {
            console.error(`❌ Error obteniendo slide ${id}:`, error);
            return null;
        }
    }

    /**
     * Crea un nuevo slide
     * @param {Object} data - Datos del formulario
     * @param {File|null} imageFile - Archivo de imagen seleccionado opcional
     * @returns {Promise<{ success: boolean, id?: string, error?: string, message?: string }>}
     */
    async createSlide(data, imageFile = null) {
        try {
            const user = this._getCurrentUser();
            let finalImage = data.image || '';
            let finalImagePath = null;

            // 1. Si se subió un archivo físico de imagen, enviarlo a Firebase Storage
            if (imageFile) {
                const uploadRes = await this.storageService.uploadCarruselSlideImage(imageFile);
                if (!uploadRes.success || !uploadRes.url) {
                    return {
                        success: false,
                        error: uploadRes.error || 'Error al subir la imagen a Firebase Storage'
                    };
                }
                finalImage = uploadRes.url;
                finalImagePath = uploadRes.path;
            }

            const payloadToValidate = {
                ...data,
                image: finalImage,
                imagePath: finalImagePath
            };

            // 2. Validar estructura
            const validation = CarruselModel.validate(payloadToValidate);
            if (!validation.valid) {
                // Si ya se había subido la imagen pero falló la validación, limpiar de Storage
                if (finalImagePath) {
                    await this.storageService.deleteCarruselSlideImage(finalImagePath);
                }
                return {
                    success: false,
                    error: validation.errors.join(' ')
                };
            }

            // 3. Normalizar y guardar
            const nuevoSlide = CarruselModel.create(payloadToValidate, user);
            const docId = await this.repository.createSlide(nuevoSlide);

            return {
                success: true,
                id: docId,
                message: 'Diapositiva agregada exitosamente al carrusel.'
            };

        } catch (error) {
            console.error('❌ Error creando slide:', error);
            return {
                success: false,
                error: error.message || 'Error al registrar la diapositiva'
            };
        }
    }

    /**
     * Actualiza un slide existente
     * @param {string} id 
     * @param {Object} updateData 
     * @param {File|null} newImageFile 
     * @returns {Promise<{ success: boolean, error?: string, message?: string }>}
     */
    async updateSlide(id, updateData, newImageFile = null) {
        try {
            if (!id) throw new Error('ID de diapositiva es requerido.');

            const current = await this.repository.getSlideById(id);
            if (!current) throw new Error('La diapositiva solicitada no existe.');

            const user = this._getCurrentUser();
            let finalImage = updateData.image !== undefined ? updateData.image : current.image;
            let finalImagePath = current.imagePath || null;
            let oldImagePathToDelete = null;

            // Si se subió una nueva imagen física a Storage
            if (newImageFile) {
                const uploadRes = await this.storageService.uploadCarruselSlideImage(newImageFile, id);
                if (!uploadRes.success || !uploadRes.url) {
                    return {
                        success: false,
                        error: uploadRes.error || 'Error al subir la nueva imagen a Storage'
                    };
                }
                finalImage = uploadRes.url;
                oldImagePathToDelete = current.imagePath; // Marcar para eliminar la anterior
                finalImagePath = uploadRes.path;
            }

            const payload = {
                ...updateData,
                image: finalImage,
                imagePath: finalImagePath
            };

            // Validar
            const validation = CarruselModel.validate(payload);
            if (!validation.valid) {
                if (newImageFile && finalImagePath) {
                    await this.storageService.deleteCarruselSlideImage(finalImagePath);
                }
                return {
                    success: false,
                    error: validation.errors.join(' ')
                };
            }

            const docToSave = CarruselModel.update(current, payload, user);
            await this.repository.updateSlide(id, docToSave);

            // Eliminar imagen anterior si se reemplazó exitosamente
            if (oldImagePathToDelete) {
                await this.storageService.deleteCarruselSlideImage(oldImagePathToDelete);
            }

            return {
                success: true,
                message: 'Diapositiva actualizada correctamente.'
            };

        } catch (error) {
            console.error(`❌ Error actualizando slide ${id}:`, error);
            return {
                success: false,
                error: error.message || 'Error al actualizar la diapositiva'
            };
        }
    }

    /**
     * Elimina un slide y su imagen en Storage (si aplica)
     * @param {string} id 
     * @returns {Promise<{ success: boolean, error?: string, message?: string }>}
     */
    async deleteSlide(id) {
        try {
            if (!id) throw new Error('ID de diapositiva es requerido.');

            const current = await this.repository.getSlideById(id);
            if (current && current.imagePath) {
                await this.storageService.deleteCarruselSlideImage(current.imagePath);
            }

            await this.repository.deleteSlide(id);
            return {
                success: true,
                message: 'Diapositiva eliminada con éxito.'
            };
        } catch (error) {
            console.error(`❌ Error eliminando slide ${id}:`, error);
            return {
                success: false,
                error: error.message || 'Error al eliminar la diapositiva'
            };
        }
    }

    /**
     * Alterna el estado activo de un slide
     * @param {string} id 
     * @param {boolean} nuevoEstado 
     * @returns {Promise<{ success: boolean, error?: string, message?: string }>}
     */
    async toggleActivo(id, nuevoEstado) {
        try {
            await this.repository.toggleActivo(id, nuevoEstado);
            return {
                success: true,
                message: nuevoEstado ? 'Diapositiva activada en el inicio.' : 'Diapositiva desactivada.'
            };
        } catch (error) {
            console.error(`❌ Error alternando estado de slide ${id}:`, error);
            return {
                success: false,
                error: error.message || 'Error al cambiar estado'
            };
        }
    }

    /**
     * Reordena los slides
     * @param {Array<{ id: string, orden: number }>} items 
     * @returns {Promise<{ success: boolean, error?: string, message?: string }>}
     */
    async reordenarSlides(items) {
        try {
            await this.repository.updateOrdenBatch(items);
            return {
                success: true,
                message: 'Orden de diapositivas actualizado.'
            };
        } catch (error) {
            console.error('❌ Error reordenando slides:', error);
            return {
                success: false,
                error: error.message || 'Error al reordenar'
            };
        }
    }

    /**
     * Si la colección está vacía, importa los slides iniciales desde la configuración estática
     * @param {Array<Object>} defaultSlides 
     * @returns {Promise<{ success: boolean, count: number, error?: string }>}
     */
    async sembrarSlidesPredeterminados(defaultSlides) {
        try {
            const user = this._getCurrentUser();
            let count = 0;

            for (let i = 0; i < defaultSlides.length; i++) {
                const s = defaultSlides[i];
                const normalized = CarruselModel.create({
                    image: s.image,
                    title: s.title || null,
                    description: s.description || null,
                    hasButton: Boolean(s.button && s.button.text),
                    button: s.button || null,
                    orden: i + 1,
                    activo: true
                }, user);

                await this.repository.createSlide(normalized);
                count++;
            }

            return {
                success: true,
                count,
                message: `Se importaron ${count} diapositivas predeterminadas exitosamente.`
            };
        } catch (error) {
            console.error('❌ Error sembrando slides predeterminados:', error);
            return {
                success: false,
                count: 0,
                error: error.message || 'Error al importar diapositivas predeterminadas'
            };
        }
    }
}

export default CarruselService;
