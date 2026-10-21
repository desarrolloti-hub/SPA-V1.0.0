/* ========================================
   CATALOG MODEL
   Estructura de datos para Catálogos
   ======================================== */

/**
 * Modelo de Catálogo
 * @typedef {Object} Catalog
 * @property {string} titulo
 * @property {string} descripcion
 * @property {string} imagenPortada
 * @property {string} imagenPortadaPath
 * @property {string} status - 'active' | 'inactive'
 * @property {string} creadoPor
 * @property {string} creadoPorNombre
 * @property {string} createdAt
 * @property {string|null} editadoPor
 * @property {string|null} editadoPorNombre
 * @property {string} updatedAt
 * @property {string|null} deshabilitadoPor
 * @property {string|null} deshabilitadoPorNombre
 * @property {string|null} deshabilitadoAt
 */

export class CatalogModel {
    
    /**
     * Crea un nuevo objeto Catálogo para Firestore
     * @param {Object} data - { titulo, descripcion, imagenPortada, imagenPortadaPath }
     * @param {Object} user - { uid, nombre }
     * @returns {Object}
     */
    static create(data, user) {
        const now = new Date().toISOString();
        
        return {
            titulo: data.titulo?.trim() || '',
            descripcion: data.descripcion?.trim() || '',
            imagenPortada: data.imagenPortada || '',
            imagenPortadaPath: data.imagenPortadaPath || '',
            status: 'active',

            // 🔥 Auditoría de creación
            creadoPor: user?.uid || '',
            creadoPorNombre: user?.nombre || '',
            createdAt: now,

            // Campos de edición (vacíos al crear)
            editadoPor: null,
            editadoPorNombre: null,
            updatedAt: now,

            // Campos de deshabilitación (vacíos al crear)
            deshabilitadoPor: null,
            deshabilitadoPorNombre: null,
            deshabilitadoAt: null
        };
    }

    /**
     * Prepara datos para actualización (no toca auditoría de creación)
     * @param {Object} data
     * @param {Object} user - { uid, nombre }
     * @returns {Object}
     */
    static prepareUpdate(data, user) {
        return {
            titulo: data.titulo?.trim() || '',
            descripcion: data.descripcion?.trim() || '',
            imagenPortada: data.imagenPortada || '',
            imagenPortadaPath: data.imagenPortadaPath || '',

            // 🔥 Auditoría de edición
            editadoPor: user?.uid || '',
            editadoPorNombre: user?.nombre || '',
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Prepara datos para deshabilitar (soft delete)
     * @param {Object} user - { uid, nombre }
     * @returns {Object}
     */
    static prepareDisable(user) {
        return {
            status: 'inactive',
            deshabilitadoPor: user?.uid || '',
            deshabilitadoPorNombre: user?.nombre || '',
            deshabilitadoAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Prepara datos para reactivar
     * @param {Object} user - { uid, nombre }
     * @returns {Object}
     */
    static prepareEnable(user) {
        return {
            status: 'active',
            deshabilitadoPor: null,
            deshabilitadoPorNombre: null,
            deshabilitadoAt: null,
            editadoPor: user?.uid || '',
            editadoPorNombre: user?.nombre || '',
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Valida los datos del catálogo
     * @param {Object} data
     * @returns {{ valid: boolean, errors: Object }}
     */
    static validate(data) {
        const errors = {};

        if (!data.titulo || data.titulo.trim().length < 3) {
            errors.titulo = 'El título es requerido (mínimo 3 caracteres)';
        } else if (data.titulo.length > 100) {
            errors.titulo = 'El título no puede exceder 100 caracteres';
        }

        if (data.descripcion && data.descripcion.length > 500) {
            errors.descripcion = 'La descripción no puede exceder 500 caracteres';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
}

export default CatalogModel;