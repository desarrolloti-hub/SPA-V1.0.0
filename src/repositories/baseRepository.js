/* ========================================
   BASE REPOSITORY
   Caché inteligente con soporte para índices
   ======================================== */

import { 
    db, 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter 
} from '../config/firebaseConfig.js';

export class BaseRepository {
    
    constructor(collectionName, cacheTTL = 60000) {
        this.collectionName = collectionName;
        this.cacheTTL = cacheTTL;
        this.cache = {
            single: new Map(),
            list: new Map(),
            search: new Map(),
            stats: new Map()
        };
        this.pendingRequests = new Map();
    }

    /**
     * Obtiene el UID del usuario actual para el contexto de caché
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return 'anonymous';
            const sessionData = JSON.parse(session);
            return sessionData.uid || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }

    /**
     * Genera clave de caché con contexto de usuario
     */
    _getCacheKey(type, params = {}) {
        const uid = this._getCurrentUserUid();
        return `${uid}:${this.collectionName}:${type}:${JSON.stringify(params)}`;
    }

    /**
     * Obtiene de caché si es válido
     */
    _getFromCache(type, key) {
        const cache = this.cache[type] || this.cache.list;
        const cached = cache.get(key);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }
        return null;
    }

    /**
     * Guarda en caché
     */
    _setCache(type, key, data) {
        const cache = this.cache[type] || this.cache.list;
        cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Limpia la caché
     */
    clearCache(type = null) {
        if (type && this.cache[type]) {
            this.cache[type].clear();
        } else {
            Object.keys(this.cache).forEach(key => {
                this.cache[key].clear();
            });
        }
        this.pendingRequests.clear();
    }

    /**
     * Limpia caché de un usuario específico
     */
    clearUserCache(uid) {
        const prefix = `${uid}:${this.collectionName}:`;
        Object.keys(this.cache).forEach(type => {
            const cache = this.cache[type];
            for (const key of cache.keys()) {
                if (key.startsWith(prefix)) {
                    cache.delete(key);
                }
            }
        });
    }

    /**
     * Evita duplicación de requests
     */
    async _deduplicateRequest(key, requestFn) {
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }
        
        const promise = requestFn().finally(() => {
            this.pendingRequests.delete(key);
        });
        this.pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * Obtiene la colección
     */
    _getCollection() {
        return collection(db, this.collectionName);
    }

    /**
     * Obtiene documento por ID con caché
     */
    async getById(id, forceRefresh = false) {
        const cacheKey = this._getCacheKey('single', { id });
        
        if (!forceRefresh) {
            const cached = this._getFromCache('single', cacheKey);
            if (cached) return cached;
        }

        return this._deduplicateRequest(`single:${id}`, async () => {
            try {
                const docRef = doc(db, this.collectionName, id);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) return null;
                
                const data = { id: docSnap.id, ...docSnap.data() };
                this._setCache('single', cacheKey, data);
                return data;
            } catch (error) {
                console.error(`❌ Error obteniendo documento ${id}:`, error);
                return null;
            }
        });
    }

    /**
     * 🔥 Obtiene todos los documentos con filtros (usa índices compuestos)
     */
    async getAll(filters = [], orderByField = null, orderDirection = 'asc', forceRefresh = false) {
        const cacheKey = this._getCacheKey('list', { 
            filters: JSON.stringify(filters), 
            orderBy: orderByField, 
            direction: orderDirection,
            all: true
        });
        
        if (!forceRefresh) {
            const cached = this._getFromCache('list', cacheKey);
            if (cached) return cached;
        }

        return this._deduplicateRequest(`all:${cacheKey}`, async () => {
            try {
                let q = query(this._getCollection());
                
                // 🔥 Aplicar filtros (usa índices compuestos)
                filters.forEach(filter => {
                    q = query(q, where(filter.field, filter.operator, filter.value));
                });
                
                // 🔥 Aplicar orden (usa índices compuestos)
                if (orderByField) {
                    q = query(q, orderBy(orderByField, orderDirection));
                }
                
                const snapshot = await getDocs(q);
                const results = [];
                snapshot.forEach(doc => {
                    results.push({ id: doc.id, ...doc.data() });
                });
                
                this._setCache('list', cacheKey, results);
                return results;
            } catch (error) {
                console.error(`❌ Error obteniendo documentos:`, error);
                throw error;
            }
        });
    }

    /**
     * 🔥 Obtiene documentos con paginación usando índices
     */
    async getPaginatedWithCache(pageSize = 20, page = 1, filters = [], orderByField = null, orderDirection = 'asc') {
        const cacheKey = this._getCacheKey('list', { 
            page, 
            pageSize, 
            filters: JSON.stringify(filters),
            orderBy: orderByField,
            direction: orderDirection
        });
        
        const cached = this._getFromCache('list', cacheKey);
        if (cached) return cached;

        return this._deduplicateRequest(`list:${cacheKey}`, async () => {
            try {
                // 🔥 Obtener todos los datos con los filtros
                const allData = await this.getAll(filters, orderByField, orderDirection, true);
                const total = allData.length;
                const start = (page - 1) * pageSize;
                const end = Math.min(start + pageSize, total);
                
                const result = {
                    data: allData.slice(start, end),
                    total: total,
                    page: page,
                    pageSize: pageSize,
                    totalPages: Math.ceil(total / pageSize),
                    hasMore: end < total
                };
                
                this._setCache('list', cacheKey, result);
                return result;
            } catch (error) {
                console.error(`❌ Error en paginación:`, error);
                throw error;
            }
        });
    }

    /**
     * 🔥 Búsqueda eficiente con índices compuestos
     */
    async searchWithIndex(searchField, searchTerm, filters = [], limitCount = 20) {
        const cacheKey = this._getCacheKey('search', { 
            field: searchField,
            term: searchTerm,
            filters: JSON.stringify(filters),
            limit: limitCount
        });
        
        const cached = this._getFromCache('search', cacheKey);
        if (cached) return cached;

        return this._deduplicateRequest(`search:${cacheKey}`, async () => {
            try {
                let q = query(this._getCollection());
                
                // 🔥 Aplicar filtros base
                filters.forEach(filter => {
                    q = query(q, where(filter.field, filter.operator, filter.value));
                });
                
                // 🔥 Búsqueda por rango (usa índice compuesto)
                if (searchTerm && searchTerm.length >= 2) {
                    const termLower = searchTerm.toLowerCase();
                    const termEnd = termLower + '\uf8ff';
                    
                    q = query(
                        q,
                        where(searchField, '>=', termLower),
                        where(searchField, '<=', termEnd),
                        orderBy(searchField),
                        limit(limitCount)
                    );
                } else {
                    q = query(q, limit(limitCount));
                }
                
                const snapshot = await getDocs(q);
                const results = [];
                snapshot.forEach(doc => {
                    results.push({ id: doc.id, ...doc.data() });
                });
                
                this._setCache('search', cacheKey, results);
                return results;
            } catch (error) {
                console.error('❌ Error en búsqueda con índice:', error);
                // Fallback a búsqueda en memoria
                return this.searchInMemory(searchTerm, filters, limitCount);
            }
        });
    }

    /**
     * 🔥 Fallback: Búsqueda en memoria (sin índices)
     */
    async searchInMemory(searchTerm, filters = [], limitCount = 20) {
        try {
            const allData = await this.getAll(filters, null, null, true);
            const termLower = searchTerm.toLowerCase();
            
            const results = allData.filter(item => {
                const nombre = (item.nombreArea || item.nombreCompleto || '').toLowerCase();
                return nombre.includes(termLower);
            }).slice(0, limitCount);
            
            return results;
        } catch (error) {
            console.error('❌ Error en búsqueda en memoria:', error);
            return [];
        }
    }

    /**
     * Obtiene estadísticas con caché
     */
    async getStatsWithCache(filters = []) {
        const cacheKey = this._getCacheKey('stats', { 
            filters: JSON.stringify(filters) 
        });
        
        const cached = this._getFromCache('stats', cacheKey);
        if (cached) return cached;

        return this._deduplicateRequest(`stats:${cacheKey}`, async () => {
            try {
                const allData = await this.getAll(filters, null, null, true);
                const stats = {
                    total: allData.length,
                    active: 0,
                    inactive: 0,
                    verified: 0,
                    unverified: 0
                };
                
                allData.forEach(item => {
                    if (item.status !== 'inactive') stats.active++;
                    else stats.inactive++;
                    if (item.emailVerified) stats.verified++;
                    else stats.unverified++;
                });
                
                this._setCache('stats', cacheKey, stats);
                return stats;
            } catch (error) {
                console.error('❌ Error obteniendo estadísticas:', error);
                return { total: 0, active: 0, inactive: 0, verified: 0, unverified: 0 };
            }
        });
    }
}

export default BaseRepository;