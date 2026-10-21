/* ==========================================================================
   CARRUSEL MODEL - RSI Enterprise
   Modelo y validación para las diapositivas (slides) del carrusel de inicio.
   ========================================================================== */

export class CarruselModel {
    /**
     * Valida los datos requeridos de una diapositiva del carrusel
     * @param {Object} data 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Los datos del slide son requeridos.'] };
        }

        if (!data.image || typeof data.image !== 'string' || !data.image.trim()) {
            errors.push('La imagen del slide es obligatoria (sube un archivo o ingresa una URL).');
        }

        // Si incluye botón, validar que al menos tenga texto y link
        if (data.hasButton) {
            const btnText = data.button?.text || data.buttonText;
            const btnLink = data.button?.link || data.buttonLink;
            if (!btnText || !btnText.trim()) {
                errors.push('Si activas el botón, debes ingresar el texto del botón.');
            }
            if (!btnLink || !btnLink.trim()) {
                errors.push('Si activas el botón, debes ingresar el enlace o destino.');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Construye un nuevo objeto de diapositiva normalizado
     * @param {Object} data 
     * @param {Object} [user={}] 
     * @returns {Object}
     */
    static create(data, user = {}) {
        const now = new Date().toISOString();
        const hasButton = Boolean(data.hasButton && (data.button?.text || data.buttonText));

        let buttonObj = null;
        if (hasButton) {
            buttonObj = {
                text: (data.button?.text || data.buttonText || '').trim(),
                link: (data.button?.link || data.buttonLink || '').trim(),
                icon: (data.button?.icon || data.buttonIcon || 'fas fa-arrow-right').trim()
            };
        }

        return {
            image: (data.image || '').trim(),
            imagePath: data.imagePath || null,
            title: (data.title || '').trim() || null,
            description: (data.description || '').trim() || null,
            hasButton: hasButton,
            button: buttonObj,
            orden: typeof data.orden === 'number' ? data.orden : parseInt(data.orden, 10) || 1,
            activo: data.activo !== false,
            creadoPor: user.uid || 'admin',
            creadoPorNombre: user.nombre || user.displayName || 'Administrador',
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Prepara los campos a actualizar
     * @param {Object} current 
     * @param {Object} updateData 
     * @param {Object} [user={}] 
     * @returns {Object}
     */
    static update(current, updateData, user = {}) {
        const hasButton = updateData.hasButton !== undefined 
            ? Boolean(updateData.hasButton) 
            : current.hasButton;

        let buttonObj = null;
        if (hasButton) {
            buttonObj = {
                text: (updateData.button?.text || updateData.buttonText || current.button?.text || '').trim(),
                link: (updateData.button?.link || updateData.buttonLink || current.button?.link || '').trim(),
                icon: (updateData.button?.icon || updateData.buttonIcon || current.button?.icon || 'fas fa-arrow-right').trim()
            };
        }

        return {
            ...current,
            image: (updateData.image !== undefined ? updateData.image : current.image).trim(),
            imagePath: updateData.imagePath !== undefined ? updateData.imagePath : (current.imagePath || null),
            title: updateData.title !== undefined ? (updateData.title ? updateData.title.trim() : null) : current.title,
            description: updateData.description !== undefined ? (updateData.description ? updateData.description.trim() : null) : current.description,
            hasButton: hasButton,
            button: buttonObj,
            orden: updateData.orden !== undefined ? parseInt(updateData.orden, 10) || current.orden : current.orden,
            activo: updateData.activo !== undefined ? Boolean(updateData.activo) : current.activo,
            updatedAt: new Date().toISOString(),
            modificadoPor: user.uid || 'admin',
            modificadoPorNombre: user.nombre || user.displayName || 'Administrador'
        };
    }

    /**
     * Adapta el documento de Firestore al formato de renderizado que espera el carrusel de inicio
     * @param {Object} slide 
     * @returns {Object}
     */
    static toCarouselSlide(slide) {
        if (!slide || !slide.image) return null;

        const result = {
            image: slide.image
        };

        if (slide.title && slide.title.trim()) {
            result.title = slide.title.trim();
        }

        if (slide.description && slide.description.trim()) {
            result.description = slide.description.trim();
        }

        if (slide.hasButton && slide.button && slide.button.text) {
            result.button = {
                text: slide.button.text,
                link: slide.button.link || '#',
                icon: slide.button.icon || 'fas fa-arrow-right'
            };
        }

        return result;
    }
}

export default CarruselModel;
