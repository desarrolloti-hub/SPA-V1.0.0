/* ========================================
   CONTADOR COTIZACION SERVICE
   Lógica de negocio para gestión de contadores
   ======================================== */

import ContadorCotizacionRepository from '../repositories/contadorCotizacionRepository.js';
import ContadorCotizacionModel from '../models/contadorCotizacionModel.js';

export class ContadorCotizacionService {
    
    constructor() {
        this.repository = new ContadorCotizacionRepository();
    }

    /**
     * Obtiene el contador de un tipo específico
     */
    async getContador(tipo) {
        try {
            return await this.repository.getContador(tipo);
        } catch (error) {
            console.error('❌ Error en getContador:', error);
            return { tipo, count: 0 };
        }
    }

    /**
     * Incrementa el contador de un tipo específico
     */
    async incrementContador(tipo) {
        try {
            const validation = ContadorCotizacionModel.validate({ tipo, count: 1 });
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }
            return await this.repository.incrementContador(tipo);
        } catch (error) {
            console.error('❌ Error en incrementContador:', error);
            throw error;
        }
    }

    /**
     * Obtiene el siguiente número de cotización para un tipo
     * Formato: RSI-YYYYMMDD-TIPO-NUMERO
     */
    async getSiguienteNumeroCotizacion(tipo) {
        try {
            const nuevoContador = await this.incrementContador(tipo);
            const hoy = new Date();
            const fechaStr = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
            const tipoUpper = tipo.toUpperCase();
            return `RSI-${fechaStr}-${tipoUpper}-${nuevoContador}`;
        } catch (error) {
            console.error('❌ Error generando número de cotización:', error);
            throw error;
        }
    }

    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default ContadorCotizacionService;