/* ========================================
   CATALOG REPOSITORY
   Conexión a Firestore para catálogos y productos
   ======================================== */

import { 
    db,
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class CatalogRepository extends BaseRepository {
    
    constructor() {
        super('catalogos', 60000);
        this.productsCollectionName = 'productosCatalogo';
    }

    // ==========================================
    // CATÁLOGOS
    // ==========================================

    async createCatalog(data) {
        try {
            const col = this._getCollection();
            const docRef = await addDoc(col, data);
            this.clearCache();
            console.log('✅ Catálogo creado:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando catálogo:', error);
            throw new Error('Error al crear el catálogo: ' + error.message);
        }
    }

    async getAllCatalogs(forceRefresh = false) {
        const filters = [
            { field: 'status', operator: '==', value: 'active' }
        ];
        return await this.getAll(filters, 'createdAt', 'desc', forceRefresh);
    }

    async getCatalogById(docId, forceRefresh = false) {
        return await this.getById(docId, forceRefresh);
    }

    async updateCatalog(docId, data) {
        try {
            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, data);
            this.clearCache();
            console.log('✅ Catálogo actualizado:', docId);
        } catch (error) {
            console.error('❌ Error actualizando catálogo:', error);
            throw new Error('Error al actualizar el catálogo: ' + error.message);
        }
    }

    // ==========================================
// MÉTODOS ADICIONALES PARA EL CRUD
// ==========================================

/**
 * Obtiene catálogos con filtro de estatus y paginación
 * @param {Object} opts - { status: 'all'|'active'|'inactive', page, pageSize, searchTerm }
 */
async getCatalogsPaginated({ status = 'all', page = 1, pageSize = 10, searchTerm = '' } = {}) {
    try {
        // Traer todos (con caché)
        let allCatalogs = await this.getAllRaw(true);

        // Filtrar por status
        if (status !== 'all') {
            allCatalogs = allCatalogs.filter(c => c.status === status);
        }

        // Filtrar por búsqueda
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            allCatalogs = allCatalogs.filter(c => {
                const titulo = (c.titulo || '').toLowerCase();
                const desc = (c.descripcion || '').toLowerCase();
                return titulo.includes(term) || desc.includes(term);
            });
        }

        // Ordenar por createdAt desc
        allCatalogs.sort((a, b) => {
            const da = a.createdAt || '';
            const db_ = b.createdAt || '';
            return db_.localeCompare(da);
        });

        // Paginar
        const total = allCatalogs.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, total);

        // Contar productos por catálogo (en paralelo)
        const paginated = allCatalogs.slice(start, end);
        const withCounts = await Promise.all(
            paginated.map(async (catalog) => {
                const productCount = await this.countProductsByCatalog(catalog.id);
                return { ...catalog, _productCount: productCount };
            })
        );

        return {
            data: withCounts,
            total,
            page,
            pageSize,
            totalPages,
            hasMore: end < total
        };
    } catch (error) {
        console.error('❌ Error en getCatalogsPaginated:', error);
        return { data: [], total: 0, page: 1, pageSize, totalPages: 1, hasMore: false };
    }
}

/**
 * Trae TODOS los catálogos (activos e inactivos) sin filtro
 * Necesario para el CRUD completo
 */
async getAllRaw(forceRefresh = false) {
    const cacheKey = this._getCacheKey('allCatalogs', {});
    
    if (!forceRefresh) {
        const cached = this._getFromCache('allCatalogs', cacheKey);
        if (cached) return cached;
    }

    try {
        const col = this._getCollection();
        const q = query(col, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        this._setCache('allCatalogs', cacheKey, data);
        return data;
    } catch (error) {
        console.error('❌ Error en getAllRaw:', error);
        return [];
    }
}


// En CatalogRepository
async enableCatalog(catalogId, enableData) {
    try {
        const catalogRef = doc(db, this.collectionName, catalogId);
        await updateDoc(catalogRef, enableData);

        // Reactivar productos en cascada
        const productsCol = collection(db, this.productsCollectionName);
        const q = query(
            productsCol,
            where('catalogId', '==', catalogId)
        );
        const snapshot = await getDocs(q);

        const promises = snapshot.docs.map(productDoc => {
            const productRef = doc(db, this.productsCollectionName, productDoc.id);
            return updateDoc(productRef, {
                status: 'active',
                deshabilitadoPor: null,
                deshabilitadoPorNombre: null,
                deshabilitadoAt: null,
                updatedAt: new Date().toISOString()
            });
        });
        await Promise.all(promises);

        this.clearCache();
        this._clearCacheByPrefix('products');
        console.log(`✅ Catálogo ${catalogId} reactivado con ${snapshot.size} productos`);
    } catch (error) {
        console.error('❌ Error reactivando catálogo:', error);
        throw new Error('Error al reactivar el catálogo: ' + error.message);
    }
}

async enableProduct(productId, enableData) {
    try {
        const docRef = doc(db, this.productsCollectionName, productId);
        await updateDoc(docRef, enableData);
        this._clearCacheByPrefix('products');
        console.log('✅ Producto reactivado:', productId);
    } catch (error) {
        console.error('❌ Error reactivando producto:', error);
        throw new Error('Error al reactivar el producto: ' + error.message);
    }
}
/**
 * Estadísticas globales de catálogos
 */
async getCatalogStats(forceRefresh = false) {
    try {
        const all = await this.getAllRaw(forceRefresh);

        const total = all.length;
        const activos = all.filter(c => c.status === 'active').length;
        const inactivos = all.filter(c => c.status === 'inactive').length;

        // Contar productos totales (solo de activos)
        let totalProductos = 0;
        const activosList = all.filter(c => c.status === 'active');
        const counts = await Promise.all(
            activosList.map(c => this.countProductsByCatalog(c.id))
        );
        totalProductos = counts.reduce((sum, n) => sum + n, 0);

        return { total, activos, inactivos, totalProductos };
    } catch (error) {
        console.error('❌ Error en getCatalogStats:', error);
        return { total: 0, activos: 0, inactivos: 0, totalProductos: 0 };
    }
}

    /**
     * Deshabilita un catálogo (soft delete)
     * 🔥 También deshabilita sus productos
     */
    async disableCatalog(catalogId, disableData) {
        try {
            // 1. Deshabilitar catálogo
            const catalogRef = doc(db, this.collectionName, catalogId);
            await updateDoc(catalogRef, disableData);

            // 2. Deshabilitar productos en cascada
            const productsCol = collection(db, this.productsCollectionName);
            const q = query(
                productsCol,
                where('catalogId', '==', catalogId),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);

            const promises = snapshot.docs.map(productDoc => {
                const productRef = doc(db, this.productsCollectionName, productDoc.id);
                return updateDoc(productRef, disableData);
            });
            await Promise.all(promises);

            this.clearCache();
            this._clearCacheByPrefix('products');
            console.log(`✅ Catálogo ${catalogId} deshabilitado con ${snapshot.size} productos`);
        } catch (error) {
            console.error('❌ Error deshabilitando catálogo:', error);
            throw new Error('Error al deshabilitar el catálogo: ' + error.message);
        }
    }

    // ==========================================
    // PRODUCTOS
    // ==========================================

    async getProductsByCatalog(catalogId, forceRefresh = false) {
        const cacheKey = this._getCacheKey('products', { catalogId });
        
        if (!forceRefresh) {
            const cached = this._getFromCache('products', cacheKey);
            if (cached) return cached;
        }

        try {
            const productsCol = collection(db, this.productsCollectionName);
            const q = query(
                productsCol,
                where('catalogId', '==', catalogId),
                where('status', '==', 'active')
            );
            
            const snapshot = await getDocs(q);
            const products = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // Ordenar en cliente (evita índice compuesto)
            products.sort((a, b) => (a.orden || 0) - (b.orden || 0));

            this._setCache('products', cacheKey, products);
            return products;
        } catch (error) {
            console.error('❌ Error obteniendo productos:', error);
            return [];
        }
    }

    /**
     * Obtiene un producto por su ID
     * @param {string} productId - ID del producto
     * @param {boolean} forceRefresh - Forzar omisión de caché
     * @returns {Promise<Object|null>}
     */
    async getProductById(productId, forceRefresh = false) {
        const cacheKey = this._getCacheKey('product', { productId });
        if (!forceRefresh) {
            const cached = this._getFromCache('product', cacheKey);
            if (cached) return cached;
        }
        try {
            const docRef = doc(db, this.productsCollectionName, productId);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return null;
            const product = { id: docSnap.id, ...docSnap.data() };
            this._setCache('product', cacheKey, product);
            return product;
        } catch (error) {
            console.error('❌ Error obteniendo producto por ID:', error);
            throw new Error('Error al obtener el producto: ' + error.message);
        }
    }

    async createProduct(data) {
        try {
            const productsCol = collection(db, this.productsCollectionName);
            const docRef = await addDoc(productsCol, data);
            this._clearCacheByPrefix('products');
            console.log('✅ Producto creado:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando producto:', error);
            throw new Error('Error al crear el producto: ' + error.message);
        }
    }

    async updateProduct(productId, data) {
        try {
            const docRef = doc(db, this.productsCollectionName, productId);
            await updateDoc(docRef, data);
            this._clearCacheByPrefix('products');
            console.log('✅ Producto actualizado:', productId);
        } catch (error) {
            console.error('❌ Error actualizando producto:', error);
            throw new Error('Error al actualizar el producto: ' + error.message);
        }
    }

    /**
     * Deshabilita un producto (soft delete)
     */
    async disableProduct(productId, disableData) {
        try {
            const docRef = doc(db, this.productsCollectionName, productId);
            await updateDoc(docRef, disableData);
            this._clearCacheByPrefix('products');
            console.log('✅ Producto deshabilitado:', productId);
        } catch (error) {
            console.error('❌ Error deshabilitando producto:', error);
            throw new Error('Error al deshabilitar el producto: ' + error.message);
        }
    }

    async countProductsByCatalog(catalogId) {
        try {
            const productsCol = collection(db, this.productsCollectionName);
            const q = query(
                productsCol,
                where('catalogId', '==', catalogId),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) {
            console.error('❌ Error contando productos:', error);
            return 0;
        }
    }
}



export default CatalogRepository;