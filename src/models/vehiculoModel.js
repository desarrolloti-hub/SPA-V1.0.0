/* ========================================
   VEHICULO MODEL - RSI ENTERPRISE
   Modelo y validación para el parque vehicular
   ======================================== */

export class VehiculoModel {
    /**
     * Estados operativos permitidos para un vehículo
     */
    static ESTADOS = {
        DISPONIBLE: 'disponible',
        EN_SALIDA: 'en_salida',
        SALIDA_PENDIENTE: 'salida_pendiente',
        MANTENIMIENTO: 'mantenimiento',
        INACTIVO: 'inactivo'
    };

    /**
     * Etiquetas legibles para los estados operativos
     */
    static ESTADO_LABELS = {
        disponible: 'Disponible',
        en_salida: 'En Salida / En Ruta',
        salida_pendiente: 'Salida Pendiente de Aceptación',
        mantenimiento: 'En Mantenimiento',
        inactivo: 'Inactivo / Fuera de Servicio'
    };

    /**
     * Crea un objeto de vehículo normalizado para persistencia
     * @param {Object} data
     * @param {string} userId - UID del usuario creador
     * @returns {Object}
     */
    static create(data, userId) {
        const now = new Date().toISOString();
        const numeroEconomico = (data.numeroEconomico || '').trim().toUpperCase();
        const placas = (data.placas || '').trim().toUpperCase().replace(/[\s-]/g, '');

        return {
            numeroEconomico,
            placas,
            marca: (data.marca || '').trim(),
            modelo: (data.modelo || '').trim(),
            anio: parseInt(data.anio, 10) || new Date().getFullYear(),
            color: (data.color || '').trim(),
            numeroSerie: (data.numeroSerie || '').trim().toUpperCase(),
            kilometrajeActual: Math.max(0, parseFloat(data.kilometrajeActual) || 0),
            combustibleNivel: data.combustibleNivel || '1/2',
            estadoOperativo: data.estadoOperativo || this.ESTADOS.DISPONIBLE,
            tipoVehiculo: data.tipoVehiculo || 'Automóvil',
            observaciones: (data.observaciones || '').trim(),
            imagenUrl: data.imagenUrl || null,
            imagenPath: data.imagenPath || null,
            activo: data.activo !== false,
            createdAt: now,
            createdBy: userId || 'sistema',
            updatedAt: now,
            updatedBy: userId || 'sistema',
            ultimaSalidaFolio: null,
            ultimaSalidaFecha: null,
            responsableActualUid: null,
            responsableActualNombre: null
        };
    }

    /**
     * Prepara el objeto de actualización de un vehículo
     * @param {Object} currentData
     * @param {Object} updateData
     * @param {string} userId - UID del usuario modificador
     * @returns {Object}
     */
    static update(currentData, updateData, userId) {
        const now = new Date().toISOString();
        const placas = updateData.placas !== undefined 
            ? (updateData.placas || '').trim().toUpperCase().replace(/[\s-]/g, '')
            : currentData.placas;
        const numeroEconomico = updateData.numeroEconomico !== undefined 
            ? (updateData.numeroEconomico || '').trim().toUpperCase()
            : currentData.numeroEconomico;

        return {
            ...currentData,
            numeroEconomico,
            placas,
            marca: updateData.marca !== undefined ? (updateData.marca || '').trim() : currentData.marca,
            modelo: updateData.modelo !== undefined ? (updateData.modelo || '').trim() : currentData.modelo,
            anio: updateData.anio !== undefined ? (parseInt(updateData.anio, 10) || currentData.anio) : currentData.anio,
            color: updateData.color !== undefined ? (updateData.color || '').trim() : currentData.color,
            numeroSerie: updateData.numeroSerie !== undefined ? (updateData.numeroSerie || '').trim().toUpperCase() : (currentData.numeroSerie || ''),
            kilometrajeActual: updateData.kilometrajeActual !== undefined 
                ? Math.max(0, parseFloat(updateData.kilometrajeActual) || 0)
                : currentData.kilometrajeActual,
            combustibleNivel: updateData.combustibleNivel || currentData.combustibleNivel || '1/2',
            estadoOperativo: updateData.estadoOperativo || currentData.estadoOperativo || this.ESTADOS.DISPONIBLE,
            tipoVehiculo: updateData.tipoVehiculo || currentData.tipoVehiculo || 'Automóvil',
            observaciones: updateData.observaciones !== undefined ? (updateData.observaciones || '').trim() : (currentData.observaciones || ''),
            imagenUrl: updateData.imagenUrl !== undefined ? updateData.imagenUrl : (currentData.imagenUrl || null),
            imagenPath: updateData.imagenPath !== undefined ? updateData.imagenPath : (currentData.imagenPath || null),
            activo: updateData.activo !== undefined ? (updateData.activo !== false) : currentData.activo,
            updatedAt: now,
            updatedBy: userId || 'sistema'
        };
    }

    /**
     * Valida los datos requeridos para registrar o editar un vehículo
     * @param {Object} data
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        if (!data.numeroEconomico || !data.numeroEconomico.trim()) {
            errors.push('El número económico o identificador interno es obligatorio.');
        }

        if (!data.placas || !data.placas.trim()) {
            errors.push('Las placas del vehículo son obligatorias.');
        }

        if (!data.marca || !data.marca.trim()) {
            errors.push('La marca del vehículo es obligatoria.');
        }

        if (!data.modelo || !data.modelo.trim()) {
            errors.push('El modelo del vehículo es obligatorio.');
        }

        const anio = parseInt(data.anio, 10);
        const currentYear = new Date().getFullYear() + 1;
        if (!anio || isNaN(anio) || anio < 1980 || anio > currentYear) {
            errors.push(`El año del vehículo debe ser un valor válido entre 1980 y ${currentYear}.`);
        }

        const km = parseFloat(data.kilometrajeActual);
        if (isNaN(km) || km < 0) {
            errors.push('El kilometraje actual debe ser un número mayor o igual a cero.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export default VehiculoModel;
