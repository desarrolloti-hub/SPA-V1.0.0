/* ========================================
   COTIZACION SERVICE
   Lógica de negocio para gestión de cotizaciones
   ======================================== */

import CotizacionRepository from '../repositories/cotizacionRepository.js';
import CotizacionModel from '../models/cotizacionModel.js';

export class CotizacionService {
    
    constructor() {
        this.repository = new CotizacionRepository();
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
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
     * Valida los datos de la cotización
     * @param {Object} data - Datos a validar
     * @param {boolean} isCompletada - Si es una cotización completada (true = validación completa, false = validación parcial)
     */
    validateCotizacion(data, isCompletada = false) {
        // ✅ Pasar el flag al modelo
        return CotizacionModel.validate(data, isCompletada);
    }

    /**
     * Crea una nueva cotización
     * @param {Object} data - Datos de la cotización
     * @param {boolean} isCompletada - Si es una cotización completada
     */
    async createCotizacion(data, isCompletada = false) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            // ✅ Pasar el flag a la validación
            const validation = this.validateCotizacion(data, isCompletada);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const cotizacionData = CotizacionModel.create(data, uid, uid);
            const docId = await this.repository.createCotizacion(cotizacionData);

            return {
                success: true,
                id: docId,
                message: 'Cotización creada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createCotizacion:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las cotizaciones
     */
    async getAllCotizaciones() {
        try {
            return await this.repository.getAllCotizaciones();
        } catch (error) {
            console.error('❌ Error en getAllCotizaciones:', error);
            throw error;
        }
    }

    /**
     * Obtiene una cotización por ID
     */
    async getCotizacionById(cotizacionId) {
        try {
            return await this.repository.getCotizacionById(cotizacionId);
        } catch (error) {
            console.error('❌ Error en getCotizacionById:', error);
            return null;
        }
    }

    /**
     * Actualiza una cotización
     * @param {string} cotizacionId - ID de la cotización
     * @param {Object} data - Datos a actualizar
     * @param {boolean} isCompletada - Si es una cotización completada (true = validación completa, false = validación parcial)
     */
    async updateCotizacion(cotizacionId, data, isCompletada = false) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            // ✅ Si la data solo tiene pdfUrl, NO validar nada (es una actualización parcial)
            const isOnlyPdfUrl = Object.keys(data).length === 1 && data.pdfUrl !== undefined;
            
            let validation;
            if (isOnlyPdfUrl) {
                // ✅ Para actualización solo de PDF, no validar nada
                validation = { valid: true, errors: {} };
            } else {
                // ✅ Pasar el flag a la validación
                validation = this.validateCotizacion(data, isCompletada);
            }
            
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const updateData = {
                ...data,
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            };

            await this.repository.updateCotizacion(cotizacionId, updateData);

            return {
                success: true,
                message: 'Cotización actualizada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateCotizacion:', error);
            throw error;
        }
    }

    /**
     * Elimina una cotización
     */
    async deleteCotizacion(cotizacionId) {
        try {
            await this.repository.deleteCotizacion(cotizacionId);
            return {
                success: true,
                message: 'Cotización eliminada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en deleteCotizacion:', error);
            throw error;
        }
    }

    /**
     * Obtiene cotizaciones por cliente
     */
    async getCotizacionesByCliente(clienteId) {
        try {
            return await this.repository.getCotizacionesByCliente(clienteId);
        } catch (error) {
            console.error('❌ Error en getCotizacionesByCliente:', error);
            return [];
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        return await this.repository.getUserName(uid);
    }

    /**
     * Obtiene estadísticas de cotizaciones
     */
    async getCotizacionStats() {
        try {
            return await this.repository.getCotizacionStats();
        } catch (error) {
            console.error('❌ Error en getCotizacionStats:', error);
            return { total: 0, enProceso: 0, vendidas: 0, rechazadas: 0, totalMonto: 0 };
        }
    }

    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default CotizacionService;