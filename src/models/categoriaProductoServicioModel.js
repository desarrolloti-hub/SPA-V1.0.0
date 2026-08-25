/* ========================================
   CATEGORÍA PRODUCTO/SERVICIO MODEL
   Estructura de datos para categorías de productos y servicios
   ======================================== */

export class CategoriaProductoServicioModel {
    
    /**
     * Crea una nueva categoría para Firestore
     * @param {Object} data - Datos de la categoría
     * @param {string} uid - UID del usuario que crea
     * @param {Object} userData - Datos del usuario (nombre, email, uid)
     */
    static create(data, uid, userData) {
        const now = new Date().toISOString();
        
        return {
            // Datos principales
            nombreCategoria: data.nombreCategoria || '',
            imagenBase64: data.imagenBase64 || '',
            
            // Auditoría - creadoPor como mapa con datos del usuario
            creadoPor: {
                uid: uid || '',
                nombre: userData?.nombre || '',
                email: userData?.email || ''
            },
            modificadoPor: {
                uid: uid || '',
                nombre: userData?.nombre || '',
                email: userData?.email || ''
            },
            fechaCreacion: now,
            fechaActualizacion: now
        };
    }

    /**
     * Actualiza los campos de auditoría para modificación
     */
    static update(data, uid, userData) {
        return {
            ...data,
            nombreCategoria: data.nombreCategoria || '',
            imagenBase64: data.imagenBase64 || '',
            modificadoPor: {
                uid: uid || '',
                nombre: userData?.nombre || '',
                email: userData?.email || ''
            },
            fechaActualizacion: new Date().toISOString()
        };
    }

    /**
     * Valida los datos de la categoría
     */
    static validate(data) {
        const errors = {};

        if (!data.nombreCategoria || data.nombreCategoria.trim().length === 0) {
            errors.nombreCategoria = 'El nombre de la categoría es requerido';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Convierte a formato para mostrar en tabla
     */
    static toDisplay(data) {
        return {
            id: data.id,
            nombreCategoria: data.nombreCategoria || '-',
            imagenBase64: data.imagenBase64 || '',
            creadoPor: data.creadoPor?.nombre || 'Sistema',
            creadoPorUid: data.creadoPor?.uid || '',
            modificadoPor: data.modificadoPor?.nombre || 'Sistema',
            modificadoPorUid: data.modificadoPor?.uid || '',
            fechaCreacion: data.fechaCreacion || '',
            fechaActualizacion: data.fechaActualizacion || ''
        };
    }
}

export default CategoriaProductoServicioModel;