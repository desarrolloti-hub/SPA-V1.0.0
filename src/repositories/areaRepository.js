/* ========================================
   AREA REPOSITORY
   Conexión a Firebase para gestión de áreas
   ======================================== */

import { 
    db,
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    Timestamp,
    writeBatch
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class AreaRepository extends BaseRepository {
    
    constructor() {
        super('areas', 60000);
    }

    /**
     * Obtiene el UID del usuario desde localStorage
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const sessionData = JSON.parse(session);
            return sessionData.uid || null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene la colección de usuarios
     */
    _getUsersCollection() {
        return collection(db, 'usersRSI');
    }

    /**
     * 🔥 Obtiene todas las áreas con sus subáreas usando índices
     */
    async getAreasForSelect(onlyActive = true) {
        const cacheKey = this._getCacheKey('select', { onlyActive });
        const cached = this._getFromCache('list', cacheKey);
        if (cached) return cached;

        try {
            // 🔥 Usar índices compuestos: nombreArea + habilitado
            const filters = [];
            if (onlyActive) {
                filters.push({ field: 'habilitado', operator: '==', value: true });
            }
            
            const areas = await this.getAll(filters, 'nombreArea', 'asc', true);
            
            // Formatear áreas con subáreas
            const formattedAreas = areas.map(area => {
                const subareas = area.subareas || {};
                const subareaKeys = Object.keys(subareas);
                
                const subareasList = subareaKeys.map(key => ({
                    id: key,
                    nombre: subareas[key].nombreSubarea || key
                }));
                
                return {
                    id: area.id,
                    nombre: area.nombreArea,
                    subareas: subareasList,
                    habilitado: area.habilitado !== false
                };
            });
            
            this._setCache('list', cacheKey, formattedAreas);
            return formattedAreas;
        } catch (error) {
            console.error('❌ Error obteniendo áreas para selects:', error);
            return [];
        }
    }

    /**
     * 🔥 Búsqueda de áreas por nombre con índices
     */
    async searchAreasByName(searchTerm, onlyActive = true) {
        const filters = [];
        if (onlyActive) {
            filters.push({ field: 'habilitado', operator: '==', value: true });
        }
        
        // 🔥 Usar índice compuesto: nombreArea + habilitado
        return await this.searchWithIndex('nombreArea', searchTerm, filters, 20);
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        
        const cacheKey = this._getCacheKey('userName', { uid });
        const cached = this._getFromCache('single', cacheKey);
        if (cached) return cached;
        
        try {
            const usersRef = this._getUsersCollection();
            // 🔥 Usar índice: uid (único por defecto)
            const q = query(usersRef, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            let name = 'Usuario desconocido';
            if (!snapshot.empty) {
                const userData = snapshot.docs[0].data();
                name = userData.nombreCompleto || userData.displayName || userData.email || 'Usuario';
            }
            
            this._setCache('single', cacheKey, name);
            return name;
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            return 'Usuario desconocido';
        }
    }

    /**
     * Obtiene múltiples nombres de usuarios en lote
     */
    async getUsersNames(uids) {
        if (!uids || uids.length === 0) return {};
        
        try {
            const usersRef = this._getUsersCollection();
            const batchSize = 10;
            const result = {};
            
            for (let i = 0; i < uids.length; i += batchSize) {
                const batch = uids.slice(i, i + batchSize);
                // 🔥 Usar índice: uid (único por defecto)
                const q = query(usersRef, where('uid', 'in', batch));
                const snapshot = await getDocs(q);
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const name = data.nombreCompleto || data.displayName || data.email || 'Usuario';
                    result[data.uid] = name;
                });
            }
            
            uids.forEach(uid => {
                if (!result[uid]) {
                    result[uid] = 'Usuario desconocido';
                }
            });
            
            return result;
        } catch (error) {
            console.error('❌ Error obteniendo usuarios:', error);
            return {};
        }
    }

    /**
     * Crea una nueva área
     */
    async createArea(areaData) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), areaData);
            this.clearCache();
            console.log('✅ Área creada:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando área:', error);
            throw new Error('Error al crear el área: ' + error.message);
        }
    }

    /**
     * 🔥 Obtiene todas las áreas (usa índices para ordenamiento)
     */
    async getAllAreas() {
        // 🔥 Usar índice: createdAt (desc)
        return await this.getAll([], 'createdAt', 'desc');
    }

    /**
     * Obtiene un área por ID
     */
    async getAreaById(areaId) {
        try {
            return await this.getById(areaId);
        } catch (error) {
            console.error('❌ Error obteniendo área:', error);
            return null;
        }
    }

    /**
     * Obtiene un área por nombre
     */
    async getAreaByNombre(nombreArea) {
        try {
            // 🔥 Usar índice: nombreArea
            const q = query(
                this._getCollection(),
                where('nombreArea', '==', nombreArea)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return null;
            }
            
            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('❌ Error obteniendo área por nombre:', error);
            return null;
        }
    }

    /**
     * Actualiza un área
     */
    async updateArea(areaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, areaId);
            await updateDoc(docRef, {
                ...data,
                modificadoPor: uid,
                fechaModificacion: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Área actualizada:', areaId);
        } catch (error) {
            console.error('❌ Error actualizando área:', error);
            throw new Error('Error al actualizar el área: ' + error.message);
        }
    }

    /**
     * Elimina un área
     */
    async deleteArea(areaId) {
        try {
            const docRef = doc(db, this.collectionName, areaId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Área eliminada:', areaId);
        } catch (error) {
            console.error('❌ Error eliminando área:', error);
            throw new Error('Error al eliminar el área');
        }
    }

    /**
     * Agrega una subárea a un área
     */
    async addSubarea(areaId, subareaData) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const area = await this.getAreaById(areaId);
            if (!area) {
                throw new Error('Área no encontrada');
            }

            const subareas = area.subareas || {};
            const subareaId = subareaData.idsubarea || this._generateId();
            
            subareas[subareaId] = {
                ...subareaData,
                idsubarea: subareaId,
                modificadoPor: uid,
                fechaModificacion: new Date().toISOString()
            };

            await this.updateArea(areaId, { subareas });
            this.clearCache();
            console.log('✅ Subárea agregada:', subareaId);
            return subareaId;
        } catch (error) {
            console.error('❌ Error agregando subárea:', error);
            throw new Error('Error al agregar la subárea: ' + error.message);
        }
    }

    /**
     * Agrega un módulo a una subárea
     */
    async addModuloToSubarea(areaId, subareaId, moduloData) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const area = await this.getAreaById(areaId);
            if (!area) {
                throw new Error('Área no encontrada');
            }

            const subareas = area.subareas || {};
            if (!subareas[subareaId]) {
                throw new Error('Subárea no encontrada');
            }

            if (!subareas[subareaId].modulos) {
                subareas[subareaId].modulos = {};
            }

            const moduloNombre = moduloData.nombreModulo;
            subareas[subareaId].modulos[moduloNombre] = {
                ...moduloData,
                modificadoPor: uid,
                fechaModificacion: new Date().toISOString()
            };

            await this.updateArea(areaId, { subareas });
            this.clearCache();
            console.log('✅ Módulo agregado:', moduloNombre);
        } catch (error) {
            console.error('❌ Error agregando módulo:', error);
            throw new Error('Error al agregar el módulo: ' + error.message);
        }
    }

    /**
     * Verifica si existe un área con el mismo nombre
     */
    async existsAreaNombre(nombreArea, excludeId = null) {
        try {
            // 🔥 Usar índice: nombreArea
            const q = query(
                this._getCollection(),
                where('nombreArea', '==', nombreArea)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return false;
            
            if (excludeId) {
                let found = false;
                snapshot.forEach(doc => {
                    if (doc.id !== excludeId) {
                        found = true;
                    }
                });
                return found;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error verificando nombre de área:', error);
            return false;
        }
    }

    /**
     * Limpia la caché (sobreescribe el método base)
     */
    clearCache(type = null) {
        super.clearCache(type);
        if (!type || type === 'list') {
            this.cache.list.delete(this._getCacheKey('select', { onlyActive: true }));
            this.cache.list.delete(this._getCacheKey('select', { onlyActive: false }));
        }
    }

    /**
     * Genera un ID único
     */
    _generateId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
}

export default AreaRepository;