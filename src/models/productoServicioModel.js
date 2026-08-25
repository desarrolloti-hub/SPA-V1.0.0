/* ========================================
   PRODUCTO/SERVICIO MODEL
   Estructura de datos para Productos y Servicios
   ======================================== */

export class ProductoServicioModel {
    
    /**
     * Crea un nuevo objeto Producto/Servicio para Firestore
     * @param {Object} data - Datos del producto/servicio
     * @param {string} uid - UID del usuario que crea
     * @param {Object} userData - Datos del usuario (nombre, email, uid)
     */
    static create(data, uid, userData) {
        const now = new Date().toISOString();
        
        return {
            // Datos principales
            nombre: data.nombre || '',
            precioUnitario: parseFloat(data.precioUnitario) || 0,
            categoriaId: data.categoriaId || '',
            
            // ✅ Imagen
            imagenBase64: data.imagenBase64 || '',
            imagenNombre: data.imagenNombre || '',
            
            // Estado
            activo: data.activo !== undefined ? data.activo : true,
            
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
     * @param {Object} data - Datos a actualizar
     * @param {string} uid - UID del usuario que modifica
     * @param {Object} userData - Datos del usuario (nombre, email, uid)
     */
    static update(data, uid, userData) {
        return {
            ...data,
            nombre: data.nombre || '',
            precioUnitario: parseFloat(data.precioUnitario) || 0,
            categoriaId: data.categoriaId || '',
            // ✅ Imagen - se mantiene o se actualiza
            imagenBase64: data.imagenBase64 || '',
            imagenNombre: data.imagenNombre || '',
            activo: data.activo !== undefined ? data.activo : true,
            modificadoPor: {
                uid: uid || '',
                nombre: userData?.nombre || '',
                email: userData?.email || ''
            },
            fechaActualizacion: new Date().toISOString()
        };
    }

    /**
     * Valida los datos del producto/servicio
     */
    static validate(data) {
        const errors = {};

        if (!data.nombre || data.nombre.trim().length === 0) {
            errors.nombre = 'El nombre es requerido';
        }

        if (!data.precioUnitario || parseFloat(data.precioUnitario) <= 0) {
            errors.precioUnitario = 'El precio debe ser mayor a 0';
        }

        if (!data.categoriaId || data.categoriaId.trim().length === 0) {
            errors.categoriaId = 'La categoría es requerida';
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
            nombre: data.nombre || '-',
            precioUnitario: data.precioUnitario || 0,
            categoriaId: data.categoriaId || '',
            // ✅ Imagen para mostrar
            imagenBase64: data.imagenBase64 || '',
            imagenNombre: data.imagenNombre || '',
            activo: data.activo !== undefined ? data.activo : true,
            creadoPor: data.creadoPor?.nombre || 'Sistema',
            creadoPorUid: data.creadoPor?.uid || '',
            modificadoPor: data.modificadoPor?.nombre || 'Sistema',
            modificadoPorUid: data.modificadoPor?.uid || '',
            fechaCreacion: data.fechaCreacion || '',
            fechaActualizacion: data.fechaActualizacion || ''
        };
    }
}

export default ProductoServicioModel;