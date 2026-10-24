/* ========================================
   BLOG MODEL - RSI Enterprise México
   Estructura de datos y lógica de entidad para Blogs
   ======================================== */

/**
 * @typedef {Object} Blog
 * @property {string} id - ID autogenerado en Firestore
 * @property {string} titulo - Título principal del blog
 * @property {string} slug - Parámetro URL único sin espacios ni caracteres especiales
 * @property {string} resumen - Extracto descriptivo para carátulas y SEO
 * @property {string} contenidoHtml - Contenido enriquecido en formato HTML (con texto e imágenes)
 * @property {string} imagenPortada - URL pública en Firebase Storage
 * @property {string} imagenPortadaPath - Ruta interna del bucket de Storage
 * @property {string} categoria - Categoría temática del artículo
 * @property {Array<string>} tags - Etiquetas clave
 * @property {string} status - 'published' | 'draft' | 'inactive'
 * @property {string} autorNombre - Nombre del redactor / colaborador
 * @property {string} autorUid - UID del redactor
 * @property {string} fechaPublicacion - Fecha oficial de publicación (ISO)
 * @property {number} vistas - Contador de lecturas
 * @property {string} tiempoLectura - Estimación (ej. '4 min de lectura')
 * @property {string} createdAt - Fecha de creación
 * @property {string} updatedAt - Fecha de última actualización
 */

export class BlogModel {

    static STATUS = {
        PUBLISHED: 'published',
        DRAFT: 'draft',
        INACTIVE: 'inactive'
    };

    static CATEGORIAS = [
        'Videovigilancia CCTV',
        'Control de Acceso',
        'Redes y Telecomunicaciones',
        'Ciberseguridad',
        'Automatización y Domótica',
        'Ingeniería y Mantenimiento',
        'Novedades y Consejos'
    ];

    /**
     * Convierte un texto en un slug URL sin espacios ni acentos
     * Ejemplo: "Cámaras CCTV con Inteligencia Artificial" -> "camaras-cctv-con-inteligencia-artificial"
     * @param {string} text - Texto base
     * @returns {string} - Slug URL válido
     */
    static generateSlug(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .trim()
            .normalize('NFD') // Separa letras de acentos
            .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
            .replace(/[^a-z0-9\s-]/g, '') // Elimina caracteres no alfanuméricos
            .replace(/\s+/g, '-') // Reemplaza espacios por guiones
            .replace(/-+/g, '-') // Elimina guiones repetidos
            .replace(/^-+|-+$/g, ''); // Quita guiones iniciales o finales
    }

    /**
     * Estima el tiempo de lectura según el conteo de palabras del contenido HTML
     * @param {string} htmlContent - Contenido HTML
     * @returns {string} - Tiempo legible (ej. "3 min de lectura")
     */
    static calculateReadTime(htmlContent = '') {
        const cleanText = (htmlContent || '').replace(/<[^>]*>/g, ' ').trim();
        const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.ceil(wordCount / 200));
        return `${minutes} min de lectura`;
    }

    /**
     * Crea un nuevo objeto Blog para Firestore
     * @param {Object} data - Datos del formulario
     * @param {Object} user - Datos del usuario autenticado { uid, nombre }
     * @returns {Object}
     */
    static create(data, user) {
        const now = new Date().toISOString();
        const titulo = data.titulo?.trim() || '';
        const slug = (data.slug?.trim() ? this.generateSlug(data.slug) : this.generateSlug(titulo)) || `articulo-${Date.now()}`;
        const contenido = data.contenidoHtml || '';

        return {
            titulo,
            slug,
            resumen: data.resumen?.trim() || '',
            contenidoHtml: contenido,
            imagenPortada: data.imagenPortada || '',
            imagenPortadaPath: data.imagenPortadaPath || '',
            categoria: data.categoria || this.CATEGORIAS[0],
            tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
            status: data.status === this.STATUS.DRAFT ? this.STATUS.DRAFT : this.STATUS.PUBLISHED,
            autorNombre: user?.nombre || 'Equipo RSI Enterprise',
            autorUid: user?.uid || '',
            fechaPublicacion: data.status === this.STATUS.DRAFT ? null : now,
            vistas: 0,
            tiempoLectura: this.calculateReadTime(contenido),
            creadoPor: user?.uid || '',
            creadoPorNombre: user?.nombre || '',
            createdAt: now,
            updatedAt: now,
            editadoPor: null,
            editadoPorNombre: null
        };
    }

    /**
     * Prepara objeto para actualización de blog
     * @param {Object} data - Datos a actualizar
     * @param {Object} user - Datos del usuario autenticado
     * @returns {Object}
     */
    static prepareUpdate(data, user) {
        const now = new Date().toISOString();
        const titulo = data.titulo?.trim() || '';
        const slug = (data.slug?.trim() ? this.generateSlug(data.slug) : this.generateSlug(titulo)) || `articulo-${Date.now()}`;
        const contenido = data.contenidoHtml || '';

        const updateObj = {
            titulo,
            slug,
            resumen: data.resumen?.trim() || '',
            contenidoHtml: contenido,
            categoria: data.categoria || this.CATEGORIAS[0],
            tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
            status: data.status || this.STATUS.PUBLISHED,
            tiempoLectura: this.calculateReadTime(contenido),
            updatedAt: now,
            editadoPor: user?.uid || '',
            editadoPorNombre: user?.nombre || ''
        };

        if (data.imagenPortada !== undefined) {
            updateObj.imagenPortada = data.imagenPortada;
            updateObj.imagenPortadaPath = data.imagenPortadaPath || '';
        }

        if (data.status === this.STATUS.PUBLISHED && !data.fechaPublicacion) {
            updateObj.fechaPublicacion = now;
        }

        return updateObj;
    }

    /**
     * Valida los datos requeridos de un blog
     * @param {Object} data
     * @returns {{ valid: boolean, errors: Object }}
     */
    static validate(data) {
        const errors = {};

        if (!data.titulo || data.titulo.trim().length < 5) {
            errors.titulo = 'El título es obligatorio (mínimo 5 caracteres).';
        }

        if (!data.resumen || data.resumen.trim().length < 15) {
            errors.resumen = 'El resumen o extracto es obligatorio (mínimo 15 caracteres) para la carátula y motores de búsqueda.';
        }

        if (!data.contenidoHtml || data.contenidoHtml.trim().length < 30) {
            errors.contenidoHtml = 'El contenido del blog es obligatorio (mínimo 30 caracteres de texto formateado).';
        }

        if (!data.categoria) {
            errors.categoria = 'Selecciona una categoría válida.';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Formatea un blog para presentación en vista
     * @param {Object} blog
     * @returns {Object}
     */
    static toDisplay(blog) {
        if (!blog) return null;
        const fecha = blog.fechaPublicacion || blog.createdAt;
        let fechaDisplay = 'Reciente';
        if (fecha) {
            try {
                fechaDisplay = new Intl.DateTimeFormat('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }).format(new Date(fecha));
            } catch (e) {
                fechaDisplay = fecha.split('T')[0];
            }
        }

        return {
            ...blog,
            fechaDisplay,
            tiempoLecturaDisplay: blog.tiempoLectura || this.calculateReadTime(blog.contenidoHtml),
            statusLabel: blog.status === this.STATUS.PUBLISHED ? 'Publicado' : (blog.status === this.STATUS.DRAFT ? 'Borrador' : 'Inactivo'),
            statusColor: blog.status === this.STATUS.PUBLISHED ? 'var(--rsi-success, #28a745)' : (blog.status === this.STATUS.DRAFT ? 'var(--rsi-warning, #ffc107)' : 'var(--rsi-danger, #dc3545)')
        };
    }
}

export default BlogModel;
