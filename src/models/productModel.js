/* ========================================
   PRODUCT MODEL
   Estructura de datos para Productos de Catálogo
   ======================================== */

/**
 * Modelo de Producto
 * @typedef {Object} Product
 * @property {string} catalogId
 * @property {string} nombre
 * @property {string} descripcion
 * @property {string} imagen
 * @property {string} imagenPath
 * @property {number|null} precio
 * @property {number} orden
 * @property {string} status
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

export class ProductModel {
    
    /**
     * Crea un nuevo objeto Producto para Firestore
     * @param {Object} data
     * @param {string} catalogId
     * @param {number} orden
     * @param {Object} user - { uid, nombre }
     */
    static create(data, catalogId, orden, user) {
        const now = new Date().toISOString();
        
        return {
            catalogId: catalogId,
            nombre: data.nombre?.trim() || '',
            descripcion: data.descripcion?.trim() || '',
            imagen: data.imagen || '',
            imagenPath: data.imagenPath || '',
            precio: ProductModel._normalizePrice(data.precio),
            orden: orden,
            status: 'active',

            // 🔥 Auditoría de creación
            creadoPor: user?.uid || '',
            creadoPorNombre: user?.nombre || '',
            createdAt: now,

            editadoPor: null,
            editadoPorNombre: null,
            updatedAt: now,

            deshabilitadoPor: null,
            deshabilitadoPorNombre: null,
            deshabilitadoAt: null
        };
    }

    /**
     * Prepara datos para actualización
     */
    static prepareUpdate(data, user) {
        return {
            nombre: data.nombre?.trim() || '',
            descripcion: data.descripcion?.trim() || '',
            imagen: data.imagen || '',
            imagenPath: data.imagenPath || '',
            precio: ProductModel._normalizePrice(data.precio),

            // 🔥 Auditoría de edición
            editadoPor: user?.uid || '',
            editadoPorNombre: user?.nombre || '',
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Prepara datos para deshabilitar
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
     * Valida los datos del producto
     */
    static validate(data) {
        const errors = {};

        if (!data.nombre || data.nombre.trim().length < 2) {
            errors.nombre = 'El nombre es requerido (mínimo 2 caracteres)';
        } else if (data.nombre.length > 150) {
            errors.nombre = 'El nombre no puede exceder 150 caracteres';
        }

        if (data.descripcion && data.descripcion.length > 1000) {
            errors.descripcion = 'La descripción no puede exceder 1000 caracteres';
        }

        if (data.precio !== null && data.precio !== undefined && data.precio !== '') {
            const precio = Number(data.precio);
            if (isNaN(precio) || precio < 0) {
                errors.precio = 'El precio debe ser un número positivo';
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Normaliza el precio
     */
    static _normalizePrice(precio) {
        if (precio === null || precio === undefined || precio === '') return null;
        const n = Number(precio);
        return isNaN(n) ? null : n;
    }
}

export default ProductModel;