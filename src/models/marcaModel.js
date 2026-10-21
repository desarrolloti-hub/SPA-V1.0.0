/* ==========================================================================
   MARCA MODEL - RSI Enterprise (Ecommerce)
   Modelo de datos y validaciones para Marcas Comerciales
   ========================================================================== */

export class MarcaModel {
    /**
     * Genera un slug normalizado a partir de un texto
     * @param {string} text 
     * @returns {string}
     */
    static slugify(text) {
        if (!text) return '';
        return text
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    /**
     * Valida los datos requeridos de una marca
     * @param {Object} data 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Los datos de la marca son requeridos.'] };
        }

        const nombre = (data.nombre || '').trim();
        if (!nombre) {
            errors.push('El nombre de la marca es obligatorio.');
        } else if (nombre.length < 2) {
            errors.push('El nombre de la marca debe tener al menos 2 caracteres.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Construye un objeto de marca normalizado para creación
     * @param {Object} data 
     * @param {Object} [user={}] 
     * @returns {Object}
     */
    static create(data, user = {}) {
        const now = new Date().toISOString();
        const nombre = (data.nombre || '').trim();
        const slug = this.slugify(data.slug || nombre);

        return {
            nombre,
            slug,
            descripcion: (data.descripcion || '').trim() || null,
            logo: data.logo || null,
            logoPath: data.logoPath || null,
            activo: data.activo !== false,
            productosCount: 0,
            creadoPor: user.uid || 'admin',
            creadoPorNombre: user.nombre || user.displayName || 'Administrador',
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Construye un objeto con los campos a actualizar
     * @param {Object} data 
     * @param {Object} [user={}] 
     * @returns {Object}
     */
    static update(data, user = {}) {
        const updateData = {
            updatedAt: new Date().toISOString(),
            actualizadoPor: user.uid || 'admin'
        };

        if (data.nombre !== undefined) {
            updateData.nombre = (data.nombre || '').trim();
            updateData.slug = this.slugify(data.slug || updateData.nombre);
        }

        if (data.descripcion !== undefined) {
            updateData.descripcion = (data.descripcion || '').trim() || null;
        }

        if (data.logo !== undefined) {
            updateData.logo = data.logo || null;
        }

        if (data.logoPath !== undefined) {
            updateData.logoPath = data.logoPath || null;
        }

        if (data.activo !== undefined) {
            updateData.activo = Boolean(data.activo);
        }

        if (typeof data.productosCount === 'number') {
            updateData.productosCount = data.productosCount;
        }

        return updateData;
    }
}

export default MarcaModel;
