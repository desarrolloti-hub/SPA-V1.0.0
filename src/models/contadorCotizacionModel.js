/* ========================================
   CONTADOR COTIZACION MODEL
   Estructura de datos para contadores de cotizaciones
   ======================================== */

export class ContadorCotizacionModel {
    
    /**
     * Crea un nuevo objeto Contador para Firestore
     * @param {string} tipo - Tipo de cotización (implementacion, proyecto, servicio, pruebaTI)
     * @param {number} count - Valor del contador
     */
    static create(tipo, count = 0) {
        return {
            tipo: tipo,
            count: count || 0,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Actualiza el contador
     * @param {number} count - Nuevo valor del contador
     */
    static update(count) {
        return {
            count: count,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Valida los datos del contador
     */
    static validate(data) {
        const errors = {};

        if (!data.tipo || data.tipo.trim().length === 0) {
            errors.tipo = 'El tipo es requerido';
        }

        if (typeof data.count !== 'number' || data.count < 0) {
            errors.count = 'El contador debe ser un número positivo';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
}

export default ContadorCotizacionModel;