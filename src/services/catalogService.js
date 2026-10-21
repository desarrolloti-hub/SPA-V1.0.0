/* ========================================
   CATALOG SERVICE
   Lógica de negocio para catálogos y productos
   ======================================== */

import CatalogRepository from '../repositories/catalogRepository.js';
import StorageRepository from '../repositories/storageRepository.js';
import CatalogModel from '../models/catalogModel.js';
import ProductModel from '../models/productModel.js';

export class CatalogService {
    
    constructor() {
        this.repository = new CatalogRepository();
        this.storage = new StorageRepository();
    }

    // ==========================================
    // HELPERS
    // ==========================================

    /**
     * Obtiene el usuario actual desde localStorage
     * @returns {{ uid: string, nombre: string } | null}
     */
    _getCurrentUser() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const s = JSON.parse(session);
            return {
                uid: s.uid || '',
                nombre: s.nombreCompleto || s.displayName || s.email || 'Usuario'
            };
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Verifica que haya usuario logueado o lanza error
     */
    _requireUser() {
        const user = this._getCurrentUser();
        if (!user || !user.uid) {
            throw new Error('No se pudo identificar al usuario');
        }
        return user;
    }

    // ==========================================
    // CATÁLOGOS - CRUD
    // ==========================================

    /**
     * Crea un nuevo catálogo
     * @param {Object} data - { titulo, descripcion, imagenPortadaFile?: File }
     * @returns {Promise<{ success: boolean, docId: string, message: string }>}
     */
    async createCatalog(data) {
        // 1. Validar
        const validation = CatalogModel.validate(data);
        if (!validation.valid) {
            throw new Error(JSON.stringify(validation.errors));
        }

        const user = this._requireUser();

        // 2. Subir imagen a Storage (si existe)
        let imagenPortada = '';
        let imagenPortadaPath = '';

        if (data.imagenPortadaFile) {
            const uploaded = await this.storage.uploadImage(
                data.imagenPortadaFile,
                'catalogos/portadas',
                'portada'
            );
            imagenPortada = uploaded.url;
            imagenPortadaPath = uploaded.path;
        }

        // 3. Preparar y guardar
        const catalogData = CatalogModel.create({
            ...data,
            imagenPortada,
            imagenPortadaPath
        }, user);

        const docId = await this.repository.createCatalog(catalogData);

        return {
            success: true,
            docId,
            message: 'Catálogo creado exitosamente'
        };
    }

    /**
     * Obtiene todos los catálogos activos
     */
    async getAllCatalogs(forceRefresh = false) {
        return await this.repository.getAllCatalogs(forceRefresh);
    }

    /**
     * Obtiene un catálogo por ID
     */
    async getCatalogById(docId, forceRefresh = false) {
        return await this.repository.getCatalogById(docId, forceRefresh);
    }

    /**
     * Obtiene un catálogo con todos sus productos
     */
    async getCatalogWithProducts(catalogId, productsStatus = 'active') {
        const [catalog, products] = await Promise.all([
            this.repository.getCatalogById(catalogId, true),
            this.repository.getProductsByCatalog(catalogId, true, productsStatus)
        ]);
        return { catalog, products };
    }

    /**
     * Actualiza un catálogo
     * @param {string} docId
     * @param {Object} data - { titulo, descripcion, imagenPortadaFile?, imagenPortadaActual?, imagenPortadaPathActual? }
     */
    async updateCatalog(docId, data) {
        const validation = CatalogModel.validate(data);
        if (!validation.valid) {
            throw new Error(JSON.stringify(validation.errors));
        }

        const user = this._requireUser();

        // Manejar imagen
        let imagenPortada = data.imagenPortadaActual || '';
        let imagenPortadaPath = data.imagenPortadaPathActual || '';

        if (data.imagenPortadaFile) {
            // Subir nueva
            const uploaded = await this.storage.uploadImage(
                data.imagenPortadaFile,
                'catalogos/portadas',
                'portada'
            );

            // Eliminar la anterior
            if (imagenPortadaPath) {
                await this.storage.deleteImage(imagenPortadaPath);
            }

            imagenPortada = uploaded.url;
            imagenPortadaPath = uploaded.path;
        }

        const updateData = CatalogModel.prepareUpdate({
            ...data,
            imagenPortada,
            imagenPortadaPath
        }, user);

        await this.repository.updateCatalog(docId, updateData);

        return {
            success: true,
            message: 'Catálogo actualizado exitosamente'
        };
    }

    /**
     * Deshabilita un catálogo y todos sus productos
     */
    async disableCatalog(catalogId) {
        const user = this._requireUser();
        const disableData = CatalogModel.prepareDisable(user);
        await this.repository.disableCatalog(catalogId, disableData);

        return {
            success: true,
            message: 'Catálogo deshabilitado exitosamente'
        };
    }

    /**
     * Reactiva un catálogo y sus productos
     */
    async enableCatalog(catalogId) {
        const user = this._requireUser();
        const enableData = CatalogModel.prepareEnable(user);
        await this.repository.enableCatalog(catalogId, enableData);

        return {
            success: true,
            message: 'Catálogo reactivado exitosamente'
        };
    }

    // ==========================================
    // CATÁLOGOS - LISTADO Y ESTADÍSTICAS
    // ==========================================

    /**
     * Listado paginado con filtros
     * @param {Object} opts - { status, page, pageSize, searchTerm }
     */
    async getCatalogsPaginated(opts = {}) {
        return await this.repository.getCatalogsPaginated(opts);
    }

    /**
     * Estadísticas globales
     */
    async getCatalogStats(forceRefresh = false) {
        return await this.repository.getCatalogStats(forceRefresh);
    }

    // ==========================================
    // PRODUCTOS - CRUD
    // ==========================================

    /**
     * Obtiene productos de un catálogo
     */
    async getProductsByCatalog(catalogId, forceRefresh = false, statusFilter = 'active') {
        return await this.repository.getProductsByCatalog(catalogId, forceRefresh, statusFilter);
    }

    /**
     * Obtiene un producto por ID
     */
    async getProductById(productId, forceRefresh = false) {
        return await this.repository.getProductById(productId, forceRefresh);
    }

    /**
     * Crea un producto en un catálogo
     * @param {string} catalogId
     * @param {Object} data - { nombre, descripcion, precio, imagenFile?: File }
     */
    async createProduct(catalogId, data) {
        const validation = ProductModel.validate(data);
        if (!validation.valid) {
            throw new Error(JSON.stringify(validation.errors));
        }

        const user = this._requireUser();

        // Subir imagen
        let imagen = '';
        let imagenPath = '';

        if (data.imagenFile) {
            const uploaded = await this.storage.uploadImage(
                data.imagenFile,
                `catalogos/${catalogId}/productos`,
                'producto'
            );
            imagen = uploaded.url;
            imagenPath = uploaded.path;
        }

        // Calcular orden
        const existing = await this.repository.getProductsByCatalog(catalogId, true, 'all');
        const orden = existing.length > 0 
            ? Math.max(...existing.map(p => p.orden || 0)) + 1 
            : 1;

        const productData = ProductModel.create({
            ...data,
            imagen,
            imagenPath
        }, catalogId, orden, user);

        const productId = await this.repository.createProduct(productData);

        return {
            success: true,
            productId,
            message: 'Producto agregado exitosamente'
        };
    }

    /**
     * Actualiza un producto
     */
    async updateProduct(productId, data) {
        const validation = ProductModel.validate(data);
        if (!validation.valid) {
            throw new Error(JSON.stringify(validation.errors));
        }

        const user = this._requireUser();

        // Manejar imagen
        let imagen = data.imagenActual || '';
        let imagenPath = data.imagenPathActual || '';

        if (data.imagenFile) {
            const uploaded = await this.storage.uploadImage(
                data.imagenFile,
                `catalogos/${data.catalogId}/productos`,
                'producto'
            );

            if (imagenPath) {
                await this.storage.deleteImage(imagenPath);
            }

            imagen = uploaded.url;
            imagenPath = uploaded.path;
        }

        const updateData = ProductModel.prepareUpdate({
            ...data,
            imagen,
            imagenPath
        }, user);

        await this.repository.updateProduct(productId, updateData);

        return {
            success: true,
            message: 'Producto actualizado exitosamente'
        };
    }

    /**
     * Deshabilita un producto
     */
    async disableProduct(productId) {
        const user = this._requireUser();
        const disableData = ProductModel.prepareDisable(user);
        await this.repository.disableProduct(productId, disableData);

        return {
            success: true,
            message: 'Producto deshabilitado exitosamente'
        };
    }

    /**
     * Reactiva un producto
     */
    async enableProduct(productId) {
        const user = this._requireUser();
        const enableData = ProductModel.prepareEnable(user);
        await this.repository.enableProduct(productId, enableData);

        return {
            success: true,
            message: 'Producto reactivado exitosamente'
        };
    }

    /**
     * Cuenta productos activos de un catálogo
     */
    async countProductsByCatalog(catalogId) {
        return await this.repository.countProductsByCatalog(catalogId);
    }

    // ==========================================
    // MANTENIMIENTO
    // ==========================================

    /**
     * Limpia toda la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default CatalogService;