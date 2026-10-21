/* ==========================================================================
   ECOMMERCE PRODUCT MODEL - RSI Enterprise
   Modelo de datos y validaciones para Productos del Catálogo Ecommerce
   ========================================================================== */

export class EcommerceProductModel {
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
     * Valida los datos mínimos requeridos de un producto
     * @param {Object} data 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Los datos del producto son obligatorios.'] };
        }

        const nombre = (data.nombre || '').trim();
        if (!nombre) {
            errors.push('El nombre del producto es obligatorio.');
        } else if (nombre.length < 3) {
            errors.push('El nombre debe tener al menos 3 caracteres.');
        }

        if (!data.categoriaId) {
            errors.push('Debes seleccionar una categoría para el producto.');
        }

        if (!data.marcaId) {
            errors.push('Debes seleccionar una marca para el producto.');
        }

        const precio = parseFloat(data.precio);
        if (isNaN(precio) || precio < 0) {
            errors.push('El precio debe ser un número positivo o cero.');
        }

        const stock = parseInt(data.stock, 10);
        if (isNaN(stock) || stock < 0) {
            errors.push('El stock disponible debe ser un número entero mayor o igual a cero.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Construye un objeto normalizado para inserción en Firestore
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
            descripcion: (data.descripcion || '').trim() || '',
            caracteristicas: Array.isArray(data.caracteristicas) ? data.caracteristicas : [],
            modelo: (data.modelo || '').trim() || '',
            codigoInterno: (data.codigoInterno || '').trim() || '',
            
            // Relaciones de catálogo
            categoriaId: data.categoriaId || '',
            categoriaNombre: (data.categoriaNombre || '').trim() || '',
            marcaId: data.marcaId || '',
            marcaNombre: (data.marcaNombre || '').trim() || '',

            // Precios y existencias
            precio: parseFloat(data.precio) || 0,
            moneda: 'MXN',
            stock: parseInt(data.stock, 10) || 0,

            // Homologación fiscal SAT
            claveSat: (data.claveSat || '43211500').trim(),
            descripcionSat: (data.descripcionSat || 'Equipos de seguridad y telecomunicaciones').trim(),
            claveUnidadSat: (data.claveUnidadSat || 'H87').trim(),

            // Archivos multimedia y fichas técnicas
            imagenes: Array.isArray(data.imagenes) ? data.imagenes : [],
            imagenPrincipal: data.imagenPrincipal || (data.imagenes?.[0]?.url || null),
            fichaTecnicaPdf: data.fichaTecnicaPdf || null, // { url, path, nombre, tamano }

            // Estado y visibilidad
            estado: ['borrador', 'publicado', 'desactivado'].includes(data.estado) ? data.estado : 'publicado',
            destacado: Boolean(data.destacado),

            // Trazabilidad
            creadoPor: user.uid || 'admin',
            creadoPorNombre: user.nombre || user.displayName || 'Administrador',
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Construye objeto sanitizado de actualización
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

        if (data.descripcion !== undefined) updateData.descripcion = (data.descripcion || '').trim();
        if (data.caracteristicas !== undefined) updateData.caracteristicas = Array.isArray(data.caracteristicas) ? data.caracteristicas : [];
        if (data.modelo !== undefined) updateData.modelo = (data.modelo || '').trim();
        if (data.codigoInterno !== undefined) updateData.codigoInterno = (data.codigoInterno || '').trim();

        if (data.categoriaId !== undefined) updateData.categoriaId = data.categoriaId;
        if (data.categoriaNombre !== undefined) updateData.categoriaNombre = (data.categoriaNombre || '').trim();
        if (data.marcaId !== undefined) updateData.marcaId = data.marcaId;
        if (data.marcaNombre !== undefined) updateData.marcaNombre = (data.marcaNombre || '').trim();

        if (data.precio !== undefined) updateData.precio = parseFloat(data.precio) || 0;
        if (data.stock !== undefined) updateData.stock = parseInt(data.stock, 10) || 0;

        if (data.claveSat !== undefined) updateData.claveSat = (data.claveSat || '').trim();
        if (data.descripcionSat !== undefined) updateData.descripcionSat = (data.descripcionSat || '').trim();
        if (data.claveUnidadSat !== undefined) updateData.claveUnidadSat = (data.claveUnidadSat || '').trim();

        if (data.imagenes !== undefined) {
            updateData.imagenes = data.imagenes;
            const principal = data.imagenes.find(img => img.principal) || data.imagenes[0];
            updateData.imagenPrincipal = principal ? principal.url : null;
        }

        if (data.imagenPrincipal !== undefined) updateData.imagenPrincipal = data.imagenPrincipal;
        if (data.fichaTecnicaPdf !== undefined) updateData.fichaTecnicaPdf = data.fichaTecnicaPdf;

        if (data.estado !== undefined && ['borrador', 'publicado', 'desactivado'].includes(data.estado)) {
            updateData.estado = data.estado;
        }

        if (data.destacado !== undefined) updateData.destacado = Boolean(data.destacado);

        return updateData;
    }
}

export default EcommerceProductModel;
