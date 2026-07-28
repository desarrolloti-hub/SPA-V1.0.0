/* ========================================
   AREA SERVICE
   Lógica de negocio para gestión de áreas
   ======================================== */

import AreaRepository from '../repositories/areaRepository.js';
import AreaModel from '../models/areaModel.js';

export class AreaService {
    
    constructor() {
        this.repository = new AreaRepository();
    }

    /**
     * Obtiene el UID del usuario desde localStorage
     * @returns {string|null} - UID del usuario
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            
            const sessionData = JSON.parse(session);
            return sessionData.uid || null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     * @param {string} uid - UID del usuario
     * @returns {Promise<string>} - Nombre del usuario
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        return await this.repository.getUserName(uid);
    }

    /**
     * Obtiene múltiples nombres de usuarios en lote
     * @param {string[]} uids - Array de UIDs
     * @returns {Promise<Object>} - Mapa de uid -> nombre
     */
    async getUsersNames(uids) {
        if (!uids || uids.length === 0) return {};
        return await this.repository.getUsersNames(uids);
    }

    /**
     * Valida los datos de un área usando el Model
     * @param {Object} data - Datos del área
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateArea(data) {
        const errors = {};

        if (!data.nombreArea || data.nombreArea.trim().length < 2) {
            errors.nombreArea = 'El nombre del área es requerido (mínimo 2 caracteres)';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida los datos de una subárea usando el Model
     * @param {Object} data - Datos de la subárea
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateSubarea(data) {
        const errors = {};

        if (!data.nombreSubarea || data.nombreSubarea.trim().length < 2) {
            errors.nombreSubarea = 'El nombre de la subárea es requerido (mínimo 2 caracteres)';
        }

        if (!data.modulos || !Array.isArray(data.modulos) || data.modulos.length === 0) {
            errors.modulos = 'La subárea debe tener al menos un módulo';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida los datos de un módulo usando el Model
     * @param {Object} data - Datos del módulo
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateModulo(data) {
        const errors = {};

        if (!data.nombreModulo || data.nombreModulo.trim().length < 2) {
            errors.nombreModulo = 'El nombre del módulo es requerido (mínimo 2 caracteres)';
        }

        if (!data.permisos || !Array.isArray(data.permisos) || data.permisos.length === 0) {
            errors.permisos = 'Debe seleccionar al menos un permiso';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Crea un área completa con todas sus subáreas y módulos
     * @param {Object} data - Datos completos del área
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async createFullArea(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado. Inicie sesión nuevamente.');
            }

            // Validar área
            const areaValidation = this.validateArea(data);
            if (!areaValidation.valid) {
                throw new Error(JSON.stringify(areaValidation.errors));
            }

            // Validar subáreas
            if (!data.subareas || !Array.isArray(data.subareas) || data.subareas.length === 0) {
                throw new Error('Debe tener al menos una subárea');
            }

            for (const subarea of data.subareas) {
                const subareaValidation = this.validateSubarea(subarea);
                if (!subareaValidation.valid) {
                    throw new Error(JSON.stringify(subareaValidation.errors));
                }

                for (const modulo of subarea.modulos) {
                    const moduloValidation = this.validateModulo(modulo);
                    if (!moduloValidation.valid) {
                        throw new Error(JSON.stringify(moduloValidation.errors));
                    }
                }
            }

            // Verificar si el nombre del área ya existe
            const exists = await this.repository.existsAreaNombre(data.nombreArea.trim());
            if (exists) {
                throw new Error('Ya existe un área con ese nombre');
            }

            // Formatear todos los datos usando el Model
            const formattedData = AreaModel.formatAreaForFirestore({
                nombreArea: data.nombreArea.trim(),
                subareas: data.subareas
            }, uid);

            // Guardar en Firestore
            const docId = await this.repository.createArea(formattedData);

            return {
                success: true,
                id: docId,
                message: `Área "${data.nombreArea}" creada con ${data.subareas.length} subárea(s)`,
                data: formattedData
            };

        } catch (error) {
            console.error('❌ Error en createFullArea:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las áreas
     * @returns {Promise<Array>} - Lista de áreas
     */
    async getAllAreas() {
        try {
            return await this.repository.getAllAreas();
        } catch (error) {
            console.error('❌ Error en getAllAreas:', error);
            throw error;
        }
    }

    /**
     * Obtiene un área por ID
     * @param {string} areaId - ID del área
     * @returns {Promise<Object|null>} - Datos del área
     */
    async getAreaById(areaId) {
        try {
            return await this.repository.getAreaById(areaId);
        } catch (error) {
            console.error('❌ Error en getAreaById:', error);
            return null;
        }
    }

    /**
     * Actualiza un área
     * @param {string} areaId - ID del área
     * @param {Object} data - Datos a actualizar
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async updateArea(areaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateArea(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const exists = await this.repository.existsAreaNombre(
                data.nombreArea.trim(),
                areaId
            );
            if (exists) {
                throw new Error('Ya existe un área con ese nombre');
            }

            await this.repository.updateArea(areaId, {
                nombreArea: data.nombreArea.trim()
            });

            return {
                success: true,
                message: 'Área actualizada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateArea:', error);
            throw error;
        }
    }

    /**
     * Elimina un área
     * @param {string} areaId - ID del área
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async deleteArea(areaId) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            await this.repository.deleteArea(areaId);

            return {
                success: true,
                message: 'Área eliminada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en deleteArea:', error);
            throw error;
        }
    }

    /**
     * Agrega una subárea a un área
     * @param {string} areaId - ID del área
     * @param {Object} data - Datos de la subárea
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async addSubarea(areaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateSubarea(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const subareaData = AreaModel.formatSubareaForFirestore(data, uid);
            const subareaId = await this.repository.addSubarea(areaId, subareaData);

            return {
                success: true,
                id: subareaId,
                message: 'Subárea agregada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en addSubarea:', error);
            throw error;
        }
    }

    /**
     * Agrega un módulo a una subárea
     * @param {string} areaId - ID del área
     * @param {string} subareaId - ID de la subárea
     * @param {Object} data - Datos del módulo
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async addModuloToSubarea(areaId, subareaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateModulo(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const moduloData = AreaModel.createModulo({
                nombreModulo: data.nombreModulo.trim(),
                permisos: data.permisos
            }, uid);

            await this.repository.addModuloToSubarea(areaId, subareaId, moduloData);

            return {
                success: true,
                message: `Módulo "${data.nombreModulo}" agregado exitosamente`
            };

        } catch (error) {
            console.error('❌ Error en addModuloToSubarea:', error);
            throw error;
        }
    }

    /**
     * Obtiene una subárea específica
     * @param {string} areaId - ID del área
     * @param {string} subareaId - ID de la subárea
     * @returns {Promise<Object|null>} - Datos de la subárea
     */
    async getSubarea(areaId, subareaId) {
        try {
            const area = await this.repository.getAreaById(areaId);
            if (!area) return null;

            const subareas = area.subareas || {};
            return subareas[subareaId] || null;
        } catch (error) {
            console.error('❌ Error en getSubarea:', error);
            return null;
        }
    }
}

export default AreaService;