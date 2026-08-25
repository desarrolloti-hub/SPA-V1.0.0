/* ========================================
   BASE REPOSITORY
   Caché simple sin índices complejos
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

   // baseRepository.js - Método clearCache corregido

/**
 * Limpia la caché
 */
clearCache() {
    // Limpiar caché de búsqueda
    if (this.cache.search) {
        this.cache.search = {};
    }
    // Limpiar caché por ID
    if (this.cache.byId) {
        this.cache.byId = {};
    }
    // Limpiar caché general
    if (this.cache.all) {
        this.cache.all = null;
    }
    // Limpiar cualquier otra caché
    if (this.cache) {
        Object.keys(this.cache).forEach(key => {
            if (key !== 'search' && key !== 'byId' && key !== 'all') {
                this.cache[key] = null;
            }
        });
    }
    console.log('🗑️ Caché limpiada');
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
     * Obtiene todos los documentos con filtros
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
                
                filters.forEach(filter => {
                    q = query(q, where(filter.field, filter.operator, filter.value));
                });
                
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
                // Fallback: obtener todo sin filtros
                const snapshot = await getDocs(this._getCollection());
                const results = [];
                snapshot.forEach(doc => {
                    results.push({ id: doc.id, ...doc.data() });
                });
                
                // Filtrar en memoria
                let filtered = results;
                filters.forEach(filter => {
                    filtered = filtered.filter(item => {
                        const value = item[filter.field];
                        if (filter.operator === '==') {
                            return value === filter.value;
                        }
                        return true;
                    });
                });
                
                // Ordenar en memoria
                if (orderByField) {
                    filtered.sort((a, b) => {
                        const valA = a[orderByField] || '';
                        const valB = b[orderByField] || '';
                        if (orderDirection === 'asc') {
                            return valA > valB ? 1 : -1;
                        } else {
                            return valA < valB ? 1 : -1;
                        }
                    });
                }
                
                this._setCache('list', cacheKey, filtered);
                return filtered;
            }
        });
    }

    /**
     * Obtiene listas con caché por página
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