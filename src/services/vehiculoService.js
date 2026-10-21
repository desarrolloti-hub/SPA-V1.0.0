/* ========================================
   VEHICULO SERVICE - RSI ENTERPRISE
   Lógica de negocio y orquestación para el parque vehicular
   ======================================== */

import VehiculoRepository from '../repositories/vehiculoRepository.js';
import ChecklistVehiculoRepository from '../repositories/checklistVehiculoRepository.js';
import StorageService from './storageService.js';
import VehiculoModel from '../models/vehiculoModel.js';

export class VehiculoService {
    constructor() {
        this.vehiculoRepository = new VehiculoRepository();
        this.checklistRepository = new ChecklistVehiculoRepository();
        this.storageService = new StorageService();
    }

    _getCurrentUser() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            return JSON.parse(session);
        } catch {
            return null;
        }
    }

    _getCurrentUserUid() {
        const u = this._getCurrentUser();
        return u ? (u.uid || u.id) : null;
    }

    /**
     * Obtiene el listado completo de vehículos con filtros opcionales
     * @param {Object} [filtros] - { estado, marca, activo, busqueda }
     * @param {boolean} [forceRefresh]
     * @returns {Promise<Array>}
     */
    async getVehiculos(filtros = {}, forceRefresh = false) {
        try {
            const repoFilters = [];
            if (filtros.activo !== undefined && filtros.activo !== 'todos') {
                repoFilters.push({ field: 'activo', operator: '==', value: filtros.activo === 'true' || filtros.activo === true });
            }
            if (filtros.estado && filtros.estado !== 'todos') {
                repoFilters.push({ field: 'estadoOperativo', operator: '==', value: filtros.estado });
            }

            let vehiculos = await this.vehiculoRepository.getAllVehiculos(repoFilters, forceRefresh);

            // Búsqueda en memoria por placas, número económico, marca, modelo o responsable
            if (filtros.busqueda && filtros.busqueda.trim()) {
                const term = filtros.busqueda.trim().toLowerCase();
                vehiculos = vehiculos.filter(v => {
                    const placas = (v.placas || '').toLowerCase();
                    const numEco = (v.numeroEconomico || '').toLowerCase();
                    const marca = (v.marca || '').toLowerCase();
                    const modelo = (v.modelo || '').toLowerCase();
                    const responsable = (v.responsableActualNombre || '').toLowerCase();
                    return placas.includes(term) || numEco.includes(term) || marca.includes(term) || modelo.includes(term) || responsable.includes(term);
                });
            }

            return vehiculos;
        } catch (error) {
            console.error('❌ Error en getVehiculos:', error);
            throw error;
        }
    }

    /**
     * Obtiene la ficha de detalle de un automóvil con su historial completo de checklists
     * @param {string} vehiculoId
     * @returns {Promise<{ vehiculo: Object, historial: Array }>}
     */
    async getVehiculoDetalleConHistorial(vehiculoId) {
        try {
            const vehiculo = await this.vehiculoRepository.getVehiculoById(vehiculoId, true);
            if (!vehiculo) {
                return { vehiculo: null, historial: [] };
            }

            const historial = await this.checklistRepository.getChecklistsByVehiculo(vehiculoId);
            return {
                vehiculo,
                historial
            };
        } catch (error) {
            console.error('❌ Error obteniendo ficha de vehículo con historial:', error);
            throw error;
        }
    }

    /**
     * Obtiene los datos de un vehículo por su ID
     * @param {string} id
     * @param {boolean} [forceRefresh]
     * @returns {Promise<Object|null>}
     */
    async getVehiculoById(id, forceRefresh = false) {
        try {
            return await this.vehiculoRepository.getVehiculoById(id, forceRefresh);
        } catch (error) {
            console.error('❌ Error en getVehiculoById:', error);
            throw error;
        }
    }

    /**
     * Registra un nuevo vehículo en el parque vehicular con fotografía opcional
     * @param {Object} data
     * @param {File|Blob} [imagenFile]
     * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
     */
    async registrarVehiculo(data, imagenFile = null) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                return { success: false, error: 'No hay una sesión activa de usuario.' };
            }

            // Validar modelo
            const validation = VehiculoModel.validate(data);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            // Validar duplicidad de placas
            const placasExiste = await this.vehiculoRepository.checkPlacasExists(data.placas);
            if (placasExiste) {
                return { success: false, error: `Ya existe un vehículo registrado con las placas ${data.placas.toUpperCase()}.` };
            }

            // Validar duplicidad de número económico
            const numEcoExiste = await this.vehiculoRepository.checkNumeroEconomicoExists(data.numeroEconomico);
            if (numEcoExiste) {
                return { success: false, error: `Ya existe un vehículo con el número económico ${data.numeroEconomico.toUpperCase()}.` };
            }

            // Subir imagen principal a Storage si fue provista
            if (imagenFile) {
                const imgRes = await this.storageService.uploadVehiculoImagenPrincipal(imagenFile, data.placas);
                if (imgRes.success) {
                    data.imagenUrl = imgRes.url;
                    data.imagenPath = imgRes.path;
                } else {
                    console.warn('⚠️ No se pudo subir la foto del vehículo, se registrará sin imagen:', imgRes.error);
                }
            }

            const vehiculoPayload = VehiculoModel.create(data, uid);
            const docId = await this.vehiculoRepository.createVehiculo(vehiculoPayload);

            return {
                success: true,
                id: docId,
                message: 'Vehículo registrado exitosamente en el parque vehicular.'
            };
        } catch (error) {
            console.error('❌ Error en registrarVehiculo:', error);
            return { success: false, error: error.message || 'Error al guardar el vehículo' };
        }
    }

    /**
     * Actualiza los datos generales de un vehículo y su fotografía
     * @param {string} id
     * @param {Object} updateData
     * @param {File|Blob} [imagenFile]
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async actualizarVehiculo(id, updateData, imagenFile = null) {
        try {
            const uid = this._getCurrentUserUid();
            const vehiculoActual = await this.vehiculoRepository.getVehiculoById(id, true);
            if (!vehiculoActual) {
                return { success: false, error: 'El vehículo a actualizar no existe.' };
            }

            // Validar modelo
            const validation = VehiculoModel.validate({ ...vehiculoActual, ...updateData });
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            // Validar duplicidad de placas excluyendo este doc
            if (updateData.placas) {
                const placasExiste = await this.vehiculoRepository.checkPlacasExists(updateData.placas, id);
                if (placasExiste) {
                    return { success: false, error: `Ya existe otro vehículo con las placas ${updateData.placas.toUpperCase()}.` };
                }
            }

            // Validar duplicidad de número económico excluyendo este doc
            if (updateData.numeroEconomico) {
                const numEcoExiste = await this.vehiculoRepository.checkNumeroEconomicoExists(updateData.numeroEconomico, id);
                if (numEcoExiste) {
                    return { success: false, error: `Ya existe otro vehículo con el número económico ${updateData.numeroEconomico.toUpperCase()}.` };
                }
            }

            // Si se solicitó eliminar la imagen existente
            if (updateData.eliminarImagen && vehiculoActual.imagenPath) {
                await this.storageService.deleteEvidencia(vehiculoActual.imagenPath);
                updateData.imagenUrl = null;
                updateData.imagenPath = null;
            }

            // Si se subió una nueva imagen
            if (imagenFile) {
                const imgRes = await this.storageService.uploadVehiculoImagenPrincipal(imagenFile, updateData.placas || vehiculoActual.placas);
                if (imgRes.success) {
                    // Borrar foto previa para no acumular archivos huérfanos
                    if (vehiculoActual.imagenPath) {
                        await this.storageService.deleteEvidencia(vehiculoActual.imagenPath);
                    }
                    updateData.imagenUrl = imgRes.url;
                    updateData.imagenPath = imgRes.path;
                }
            }

            const payload = VehiculoModel.update(vehiculoActual, updateData, uid);
            await this.vehiculoRepository.updateVehiculo(id, payload);

            return {
                success: true,
                message: 'Vehículo actualizado correctamente.'
            };
        } catch (error) {
            console.error('❌ Error actualizando vehículo:', error);
            return { success: false, error: error.message || 'Error al actualizar el vehículo' };
        }
    }

    /**
     * Activa o desactiva un vehículo sin eliminar su historial
     * @param {string} id
     * @param {boolean} nuevoEstadoActivo
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async toggleActivoVehiculo(id, nuevoEstadoActivo) {
        try {
            const uid = this._getCurrentUserUid();
            const vehiculoActual = await this.vehiculoRepository.getVehiculoById(id, true);
            if (!vehiculoActual) {
                return { success: false, error: 'Vehículo no encontrado.' };
            }

            if (vehiculoActual.estadoOperativo === 'en_salida' && !nuevoEstadoActivo) {
                return { success: false, error: 'No es posible desactivar un vehículo que se encuentra actualmente en salida.' };
            }

            const updateData = {
                activo: nuevoEstadoActivo,
                estadoOperativo: nuevoEstadoActivo ? (vehiculoActual.estadoOperativo === 'inactivo' ? 'disponible' : vehiculoActual.estadoOperativo) : 'inactivo',
                updatedAt: new Date().toISOString(),
                updatedBy: uid || 'sistema'
            };

            await this.vehiculoRepository.updateVehiculo(id, updateData);

            return {
                success: true,
                message: `Vehículo ${nuevoEstadoActivo ? 'activado' : 'desactivado'} correctamente.`
            };
        } catch (error) {
            console.error('❌ Error cambiando estado activo del vehículo:', error);
            return { success: false, error: error.message || 'Error al cambiar estado' };
        }
    }
}

export default VehiculoService;
