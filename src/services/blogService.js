/* ========================================
   BLOG SERVICE - RSI Enterprise México
   Lógica de negocio y orquestación para Blogs
   ======================================== */

import { BlogRepository } from '../repositories/blogRepository.js';
import { StorageService } from './storageService.js';
import { BlogModel } from '../models/blogModel.js';

export class BlogService {

    constructor() {
        this.repository = new BlogRepository();
        this.storage = new StorageService();
    }

    // ==========================================
    // HELPERS DE SESIÓN
    // ==========================================

    /**
     * Obtiene los datos del usuario logueado desde localStorage
     * @returns {{ uid: string, nombre: string, email: string, rol: string } | null}
     */
    _getCurrentUser() {
        try {
            const raw = localStorage.getItem('rsi_session');
            if (!raw) return null;
            const session = JSON.parse(raw);
            return {
                uid: session.uid || '',
                nombre: session.nombreCompleto || session.displayName || session.nombre || session.email || 'Colaborador RSI',
                email: session.email || '',
                rol: session.rol || 'partner'
            };
        } catch (error) {
            console.error('❌ Error obteniendo sesión en BlogService:', error);
            return null;
        }
    }

    /**
     * Verifica que exista sesión activa
     * @returns {{ uid: string, nombre: string, email: string, rol: string }}
     */
    _requireUser() {
        const user = this._getCurrentUser();
        if (!user || !user.uid) {
            throw new Error('Sesión no válida o expirada. Por favor inicie sesión nuevamente.');
        }
        return user;
    }

    // ==========================================
    // CONSULTAS
    // ==========================================

    /**
     * Obtiene todos los blogs para administración
     * @param {boolean} forceRefresh
     * @returns {Promise<Array<Object>>}
     */
    async getAllBlogs(forceRefresh = false) {
        try {
            const blogs = await this.repository.getAllBlogs(forceRefresh);
            return blogs.map(b => BlogModel.toDisplay(b));
        } catch (error) {
            console.error('❌ Error en BlogService.getAllBlogs:', error);
            throw error;
        }
    }

    /**
     * Obtiene blogs publicados para visitantes
     * @param {boolean} forceRefresh
     * @returns {Promise<Array<Object>>}
     */
    async getPublishedBlogs(forceRefresh = false) {
        try {
            const blogs = await this.repository.getPublishedBlogs(forceRefresh);
            return blogs.map(b => BlogModel.toDisplay(b));
        } catch (error) {
            console.error('❌ Error en BlogService.getPublishedBlogs:', error);
            throw error;
        }
    }

    /**
     * Obtiene un blog por su ID de Firestore
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getBlogById(id) {
        if (!id) return null;
        try {
            const blog = await this.repository.getBlogById(id);
            return blog ? BlogModel.toDisplay(blog) : null;
        } catch (error) {
            console.error(`❌ Error en BlogService.getBlogById (${id}):`, error);
            throw error;
        }
    }

    /**
     * Obtiene un blog por su slug (parámetro de URL)
     * @param {string} slug
     * @returns {Promise<Object|null>}
     */
    async getBlogBySlug(slug) {
        if (!slug) return null;
        try {
            const blog = await this.repository.getBlogBySlug(slug);
            return blog ? BlogModel.toDisplay(blog) : null;
        } catch (error) {
            console.error(`❌ Error en BlogService.getBlogBySlug (${slug}):`, error);
            throw error;
        }
    }

    // ==========================================
    // OPERACIONES CRUD
    // ==========================================

    /**
     * Sube una imagen para insertar dentro del contenido HTML
     * @param {File|Blob} file
     * @param {string} slug
     * @returns {Promise<{success: boolean, url: string|null, error: string|null}>}
     */
    async uploadInlineImage(file, slug = 'articulo') {
        this._requireUser();
        if (!file) {
            return { success: false, url: null, error: 'No se seleccionó ningún archivo de imagen.' };
        }
        return await this.storage.uploadBlogContentImage(file, slug);
    }

    /**
     * Crea un nuevo blog
     * @param {Object} rawData - Datos del formulario
     * @param {File|null} coverFile - Archivo de imagen de portada
     * @returns {Promise<{success: boolean, id?: string, slug?: string, error?: string}>}
     */
    async createBlog(rawData, coverFile = null) {
        try {
            const user = this._requireUser();

            // Preparar y validar datos de modelo
            const blogData = BlogModel.create(rawData, user);

            // Verificar unicidad del slug
            const isAvailable = await this.repository.isSlugAvailable(blogData.slug);
            if (!isAvailable) {
                blogData.slug = `${blogData.slug}-${Date.now().toString().slice(-4)}`;
            }

            // Subir carátula si se proporcionó archivo
            if (coverFile) {
                const uploadRes = await this.storage.uploadBlogCover(coverFile, blogData.slug);
                if (!uploadRes.success) {
                    return { success: false, error: `Error subiendo carátula: ${uploadRes.error}` };
                }
                blogData.imagenPortada = uploadRes.url;
                blogData.imagenPortadaPath = uploadRes.path;
            }

            // Validar esquema
            const validation = BlogModel.validate(blogData);
            if (!validation.isValid) {
                return { success: false, error: validation.errors.join(' | ') };
            }

            const docId = await this.repository.createBlog(blogData);

            return {
                success: true,
                id: docId,
                slug: blogData.slug,
                message: 'Blog publicado / guardado exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en BlogService.createBlog:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Actualiza un blog existente
     * @param {string} id - ID del blog
     * @param {Object} rawData - Datos actualizados
     * @param {File|null} coverFile - Nueva imagen de portada (opcional)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async updateBlog(id, rawData, coverFile = null) {
        try {
            this._requireUser();

            if (!id) {
                return { success: false, error: 'ID de blog no especificado.' };
            }

            const existing = await this.repository.getBlogById(id);
            if (!existing) {
                return { success: false, error: 'El blog a actualizar no existe.' };
            }

            const updateData = BlogModel.prepareUpdate(rawData, existing);

            // Si el slug cambió, verificar que no choque con otro blog
            if (updateData.slug && updateData.slug !== existing.slug) {
                const isAvailable = await this.repository.isSlugAvailable(updateData.slug, id);
                if (!isAvailable) {
                    updateData.slug = `${updateData.slug}-${Date.now().toString().slice(-4)}`;
                }
            }

            // Subir nueva carátula si se adjuntó archivo
            if (coverFile) {
                const targetSlug = updateData.slug || existing.slug;
                const uploadRes = await this.storage.uploadBlogCover(coverFile, targetSlug);
                if (!uploadRes.success) {
                    return { success: false, error: `Error subiendo nueva carátula: ${uploadRes.error}` };
                }

                // Borrar carátula anterior si existía
                if (existing.imagenPortadaPath) {
                    await this.storage.deleteBlogFile(existing.imagenPortadaPath);
                }

                updateData.imagenPortada = uploadRes.url;
                updateData.imagenPortadaPath = uploadRes.path;
            }

            // Validar campos actualizados
            const validation = BlogModel.validate({ ...existing, ...updateData });
            if (!validation.isValid) {
                return { success: false, error: validation.errors.join(' | ') };
            }

            await this.repository.updateBlog(id, updateData);

            return {
                success: true,
                id,
                slug: updateData.slug || existing.slug,
                message: 'Blog actualizado correctamente.'
            };
        } catch (error) {
            console.error(`❌ Error en BlogService.updateBlog (${id}):`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cambia el estatus de un blog
     * @param {string} id
     * @param {'published'|'draft'|'inactive'} newStatus
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async changeStatus(id, newStatus) {
        try {
            this._requireUser();
            if (!Object.values(BlogModel.STATUS).includes(newStatus)) {
                return { success: false, error: `Estatus inválido: ${newStatus}` };
            }

            await this.repository.updateBlog(id, {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });

            return { success: true, message: `Estatus actualizado a ${newStatus}.` };
        } catch (error) {
            console.error(`❌ Error en BlogService.changeStatus:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina un blog y su carátula asociada en Storage
     * @param {string} id
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteBlog(id) {
        try {
            this._requireUser();
            const existing = await this.repository.getBlogById(id);
            if (!existing) {
                return { success: false, error: 'El blog a eliminar no existe.' };
            }

            await this.repository.deleteBlog(id);

            // Eliminar imagen de portada asociada si existe
            if (existing.imagenPortadaPath) {
                await this.storage.deleteBlogFile(existing.imagenPortadaPath);
            }

            return { success: true, message: 'Blog eliminado exitosamente.' };
        } catch (error) {
            console.error(`❌ Error en BlogService.deleteBlog (${id}):`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Incrementa el contador de vistas de un artículo
     * @param {string} id
     */
    async incrementVistas(id) {
        try {
            if (!id) return;
            await this.repository.incrementVistas(id);
        } catch (error) {
            // No bloquear la lectura por un fallo de contador
            console.warn(`⚠️ No se pudo incrementar contador de vistas para blog ${id}:`, error.message);
        }
    }
}

export default BlogService;
