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

export class AreaRepository {
    
    /**
     * Obtiene el UID del usuario desde localStorage
     * @returns {string|null} - UID del usuario
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
     * Obtiene la colección de áreas
     * @returns {Object} - Referencia a la colección
     */
    _getCollection() {
        return collection(db, 'areas');
    }

    /**
     * Crea una nueva área
     * @param {Object} areaData - Datos del área
     * @returns {Promise<string>} - ID del documento creado
     */
    async createArea(areaData) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), areaData);
            console.log('✅ Área creada:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando área:', error);
            throw new Error('Error al crear el área: ' + error.message);
        }
    }

    /**
     * Obtiene todas las áreas
     * @returns {Promise<Array>} - Lista de áreas
     */
    async getAllAreas() {
        try {
            const q = query(this._getCollection());
            const snapshot = await getDocs(q);
            
            const areas = [];
            snapshot.forEach(doc => {
                areas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return areas;
        } catch (error) {
            console.error('❌ Error obteniendo áreas:', error);
            throw new Error('Error al obtener las áreas');
        }
    }

    /**
     * Obtiene un área por ID
     * @param {string} areaId - ID del área
     * @returns {Promise<Object|null>} - Datos del área
     */
    async getAreaById(areaId) {
        try {
            const docRef = doc(db, 'areas', areaId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return null;
            }
            
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        } catch (error) {
            console.error('❌ Error obteniendo área:', error);
            return null;
        }
    }

    /**
     * Obtiene un área por nombre
     * @param {string} nombreArea - Nombre del área
     * @returns {Promise<Object|null>} - Datos del área
     */
    async getAreaByNombre(nombreArea) {
        try {
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
     * @param {string} areaId - ID del área
     * @param {Object} data - Datos a actualizar
     * @returns {Promise<void>}
     */
    async updateArea(areaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, 'areas', areaId);
            await updateDoc(docRef, {
                ...data,
                modificadoPor: uid,
                fechaModificacion: new Date().toISOString()
            });
            
            console.log('✅ Área actualizada:', areaId);
        } catch (error) {
            console.error('❌ Error actualizando área:', error);
            throw new Error('Error al actualizar el área: ' + error.message);
        }
    }

    /**
     * Elimina un área
     * @param {string} areaId - ID del área
     * @returns {Promise<void>}
     */
    async deleteArea(areaId) {
        try {
            const docRef = doc(db, 'areas', areaId);
            await deleteDoc(docRef);
            console.log('✅ Área eliminada:', areaId);
        } catch (error) {
            console.error('❌ Error eliminando área:', error);
            throw new Error('Error al eliminar el área');
        }
    }

    /**
     * Agrega una subárea a un área
     * @param {string} areaId - ID del área
     * @param {Object} subareaData - Datos de la subárea
     * @returns {Promise<string>} - ID de la subárea creada
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
            console.log('✅ Subárea agregada:', subareaId);
            return subareaId;
        } catch (error) {
            console.error('❌ Error agregando subárea:', error);
            throw new Error('Error al agregar la subárea: ' + error.message);
        }
    }

    /**
     * Agrega un módulo a una subárea
     * @param {string} areaId - ID del área
     * @param {string} subareaId - ID de la subárea
     * @param {Object} moduloData - Datos del módulo
     * @returns {Promise<void>}
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

            // Inicializar modulos si no existe
            if (!subareas[subareaId].modulos) {
                subareas[subareaId].modulos = {};
            }

            // Agregar el módulo
            const moduloNombre = moduloData.nombreModulo;
            subareas[subareaId].modulos[moduloNombre] = {
                ...moduloData,
                modificadoPor: uid,
                fechaModificacion: new Date().toISOString()
            };

            await this.updateArea(areaId, { subareas });
            console.log('✅ Módulo agregado:', moduloNombre);
        } catch (error) {
            console.error('❌ Error agregando módulo:', error);
            throw new Error('Error al agregar el módulo: ' + error.message);
        }
    }

    /**
     * Verifica si existe un área con el mismo nombre
     * @param {string} nombreArea - Nombre del área
     * @param {string} excludeId - ID a excluir (para edición)
     * @returns {Promise<boolean>}
     */
    async existsAreaNombre(nombreArea, excludeId = null) {
        try {
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
     * Genera un ID único
     * @returns {string} - ID generado
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