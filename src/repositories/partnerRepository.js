/* ========================================
   PARTNER REPOSITORY
   Conexión a Firebase con caché y paginación
   ======================================== */

import { 
    db, 
    auth,
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
    limit,
    startAfter,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    updateProfile
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class NewCollaboratorRepository extends BaseRepository {
    
    constructor() {
        super('usersRSI', 60000);
        this.auth = auth;
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
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
     * Crea un nuevo usuario en Firebase Auth con verificación de email
     */
    async createAuthUser(email, password, displayName = '') {
        try {
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            
            if (displayName) {
                await updateProfile(user, { displayName });
            }
            
            await sendEmailVerification(user);
            console.log('✅ Email de verificación enviado a:', email);
            console.log('✅ Usuario creado en Auth:', user.uid);
            return userCredential;
        } catch (error) {
            console.error('❌ Error creando usuario en Auth:', error);
            
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('El correo electrónico ya está registrado');
            }
            if (error.code === 'auth/weak-password') {
                throw new Error('La contraseña es demasiado débil (mínimo 6 caracteres)');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('El correo electrónico no es válido');
            }
            throw error;
        }
    }

    /**
 * ✅ Obtiene un colaborador por su UID (Firebase Auth UID)
 */
async getCollaboratorByUid(uid, forceRefresh = false) {
    try {
        // Verificar caché
        if (!forceRefresh && this.cache.byUid && this.cache.byUid[uid]) {
            console.log(`📦 Usando caché para colaborador con UID: ${uid}`);
            return this.cache.byUid[uid];
        }

        const usersCollection = this._getCollection();
        const q = query(usersCollection, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            console.warn(`⚠️ Colaborador no encontrado con UID: ${uid}`);
            return null;
        }

        const doc = snapshot.docs[0];
        const collaborator = {
            id: doc.id,
            ...doc.data()
        };

        // Guardar en caché
        if (!this.cache.byUid) this.cache.byUid = {};
        this.cache.byUid[uid] = collaborator;

        console.log(`✅ Colaborador encontrado con UID: ${uid}`);
        return collaborator;
    } catch (error) {
        console.error(`❌ Error obteniendo colaborador por UID ${uid}:`, error);
        return null;
    }
}

/**
 * ✅ Obtiene un colaborador por su docId (ID del documento en Firestore)
 */
async getCollaboratorByDocId(docId, forceRefresh = false) {
    try {
        if (!forceRefresh && this.cache.byDocId && this.cache.byDocId[docId]) {
            console.log(`📦 Usando caché para colaborador con docId: ${docId}`);
            return this.cache.byDocId[docId];
        }

        const docRef = doc(db, this.collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.warn(`⚠️ Colaborador no encontrado con docId: ${docId}`);
            return null;
        }

        const collaborator = {
            id: docSnap.id,
            ...docSnap.data()
        };

        if (!this.cache.byDocId) this.cache.byDocId = {};
        this.cache.byDocId[docId] = collaborator;

        console.log(`✅ Colaborador encontrado con docId: ${docId}`);
        return collaborator;
    } catch (error) {
        console.error(`❌ Error obteniendo colaborador por docId ${docId}:`, error);
        return null;
    }
}

    /**
     * Guarda los datos del colaborador en Firestore y limpia caché
     */
    async saveCollaboratorData(uid, data) {
        try {
            const usersCollection = this._getCollection();
            const docRef = await addDoc(usersCollection, data);
            this.clearCache();
            console.log('✅ Colaborador guardado en Firestore:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error guardando colaborador en Firestore:', error);
            throw new Error('Error al guardar los datos del colaborador: ' + error.message);
        }
    }

    /**
     * Verifica si un email ya está registrado
     */
    async checkEmailExists(email) {
        try {
            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('emailEmpresarial', '==', email));
            const snapshot = await getDocs(q);
            return !snapshot.empty;
        } catch (error) {
            console.error('❌ Error verificando email:', error);
            return false;
        }
    }

    /**
     * 🔥 Obtiene colaboradores con paginación
     */
    async getCollaboratorsPaginated(pageSize = 20, page = 1, searchTerm = '') {
        const filters = [
            { field: 'rol', operator: '==', value: 'partner' }
        ];
        
        if (searchTerm && searchTerm.length > 0) {
            return await this.searchCollaboratorsPaginated(searchTerm, pageSize, page);
        }
        
        return await this.getPaginatedWithCache(pageSize, page, filters, 'createdAt', 'desc');
    }

    /**
     * 🔥 Búsqueda paginada de colaboradores
     */
    async searchCollaboratorsPaginated(searchTerm, pageSize = 20, page = 1) {
        const cacheKey = this._getCacheKey('search', { 
            term: searchTerm,
            page,
            pageSize
        });
        
        const cached = this._getFromCache('search', cacheKey);
        if (cached) return cached;

        try {
            const usersCollection = this._getCollection();
            const termLower = searchTerm.toLowerCase();
            
            const allData = await this.getAllCollaborators(true);
            
            const filtered = allData.filter(c => {
                const nombre = (c.nombreCompleto || '').toLowerCase();
                const email = (c.emailEmpresarial || '').toLowerCase();
                return nombre.includes(termLower) || email.includes(termLower);
            });
            
            const total = filtered.length;
            const start = (page - 1) * pageSize;
            const end = Math.min(start + pageSize, total);
            
            const result = {
                data: filtered.slice(start, end),
                total: total,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(total / pageSize),
                hasMore: end < total
            };
            
            this._setCache('search', cacheKey, result);
            return result;
        } catch (error) {
            console.error('❌ Error en búsqueda paginada:', error);
            return await this.getPaginatedWithCache(pageSize, page, 
                [{ field: 'rol', operator: '==', value: 'partner' }], 
                'createdAt', 'desc'
            );
        }
    }

    /**
     * Obtiene todos los colaboradores (con caché)
     */
    async getAllCollaborators(forceRefresh = false) {
        const filters = [
            { field: 'rol', operator: '==', value: 'partner' }
        ];
        return await this.getAll(filters, 'createdAt', 'desc', forceRefresh);
    }

    /**
     * Obtiene un colaborador por ID del documento (con caché)
     */
    async getCollaboratorById(docId, forceRefresh = false) {
        return await this.getById(docId, forceRefresh);
    }

    /**
     * Actualiza un colaborador y limpia caché
     */
    async updateCollaborator(docId, data) {
        try {
            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            this.clearCache();
            console.log('✅ Colaborador actualizado:', docId);
        } catch (error) {
            console.error('❌ Error actualizando colaborador:', error);
            throw new Error('Error al actualizar el colaborador: ' + error.message);
        }
    }

    /**
     * Elimina un colaborador (soft delete)
     */
    async deleteCollaborator(docId) {
        try {
            const docRef = doc(db, this.collectionName, docId);
            await updateDoc(docRef, {
                status: 'inactive',
                updatedAt: new Date().toISOString()
            });
            this.clearCache();
            console.log('✅ Colaborador deshabilitado:', docId);
        } catch (error) {
            console.error('❌ Error deshabilitando colaborador:', error);
            throw new Error('Error al deshabilitar el colaborador: ' + error.message);
        }
    }

    /**
     * Elimina permanentemente un colaborador
     */
    async deleteCollaboratorPermanently(docId) {
        try {
            const docRef = doc(db, this.collectionName, docId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Colaborador eliminado permanentemente:', docId);
        } catch (error) {
            console.error('❌ Error eliminando colaborador:', error);
            throw new Error('Error al eliminar el colaborador: ' + error.message);
        }
    }

    /**
     * 🔥 Obtiene estadísticas de colaboradores
     */
    async getCollaboratorStats() {
        const filters = [
            { field: 'rol', operator: '==', value: 'partner' }
        ];
        return await this.getStatsWithCache(filters);
    }

    // ==========================================
    // 🔥 NUEVOS MÉTODOS PARA NOTIFICACIONES
    // ==========================================

    /**
     * 🔥 Guarda el token FCM en el documento del usuario (soporta múltiples dispositivos)
     */
    async saveFCMToken(uid, fcmToken, platform = 'web') {
        try {
            if (!uid || !fcmToken) return false;

            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                console.warn(`⚠️ Usuario no encontrado con UID ${uid} para guardar token FCM`);
                return false;
            }

            const docRef = snapshot.docs[0].ref;
            const currentData = snapshot.docs[0].data();
            
            // Consolidar array de tokens
            let tokens = currentData.fcmTokens || [];
            if (!Array.isArray(tokens)) {
                tokens = currentData.fcmToken ? [currentData.fcmToken] : [];
            }
            
            // Agregar nuevo token sin duplicar
            if (!tokens.includes(fcmToken)) {
                tokens.push(fcmToken);
            }
            
            await updateDoc(docRef, {
                fcmToken: fcmToken,
                fcmTokens: tokens,
                fcmPlatform: platform,
                notificationsEnabled: true,
                fcmTokenUpdatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Token FCM guardado en usuario:', uid, `(Total dispositivos: ${tokens.length})`);
            return true;
        } catch (error) {
            console.error('❌ Error guardando FCM token:', error);
            throw error;
        }
    }

    /**
     * 🔥 Desvincula un token FCM específico del usuario (ej. al cerrar sesión en este dispositivo)
     */
    async removeFCMToken(uid, tokenToRemove) {
        try {
            if (!uid || !tokenToRemove) return false;

            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return false;

            const docRef = snapshot.docs[0].ref;
            const currentData = snapshot.docs[0].data();
            
            let tokens = currentData.fcmTokens || [];
            if (!Array.isArray(tokens)) {
                tokens = currentData.fcmToken ? [currentData.fcmToken] : [];
            }
            
            // Filtrar únicamente el token de este dispositivo
            tokens = tokens.filter(t => t !== tokenToRemove);
            
            const updatePayload = {
                fcmTokens: tokens,
                fcmToken: tokens.length > 0 ? tokens[tokens.length - 1] : '',
                fcmTokenUpdatedAt: new Date().toISOString()
            };
            
            if (tokens.length === 0) {
                updatePayload.notificationsEnabled = false;
            }
            
            await updateDoc(docRef, updatePayload);
            this.clearCache();
            console.log(`✅ Token de dispositivo desvinculado para usuario ${uid}. Quedan ${tokens.length} dispositivos.`);
            return true;
        } catch (error) {
            console.error('❌ Error desvinculando token FCM:', error);
            return false;
        }
    }

    /**
     * 🔥 Remueve un token inválido de cualquier usuario en Firestore
     */
    async removeInvalidToken(invalidToken) {
        try {
            if (!invalidToken) return;

            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('fcmTokens', 'array-contains', invalidToken));
            const snapshot = await getDocs(q);
            
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const tokens = (data.fcmTokens || []).filter(t => t !== invalidToken);
                await updateDoc(docSnap.ref, {
                    fcmTokens: tokens,
                    fcmToken: tokens.length > 0 ? tokens[tokens.length - 1] : '',
                    fcmTokenUpdatedAt: new Date().toISOString()
                });
                console.log(`🗑️ Token inválido removido de usuario ${docSnap.id}`);
            }
            this.clearCache();
        } catch (error) {
            console.warn('⚠️ No se pudo remover token inválido:', error.message);
        }
    }

    /**
     * 🔥 Guarda la ubicación en el documento del usuario
     */
    async saveUserLocation(uid, location) {
        try {
            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                throw new Error('Usuario no encontrado');
            }

            const docRef = snapshot.docs[0].ref;
            
            await updateDoc(docRef, {
                location: location,
                locationEnabled: !!location,
                locationUpdatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Ubicación guardada en usuario:', uid);
            return true;
        } catch (error) {
            console.error('❌ Error guardando ubicación:', error);
            throw error;
        }
    }

    /**
     * 🔥 Obtiene el estado de notificaciones del usuario
     */
    async getUserNotificationStatus(uid) {
        try {
            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return null;
            }

            const data = snapshot.docs[0].data();
            const tokens = Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0
                ? data.fcmTokens
                : (data.fcmToken ? [data.fcmToken] : []);

            return {
                fcmToken: data.fcmToken || (tokens[0] || null),
                fcmTokens: tokens,
                notificationsEnabled: data.notificationsEnabled || false,
                locationEnabled: data.locationEnabled || false,
                fcmPlatform: data.fcmPlatform || null,
                location: data.location || null,
                fcmTokenUpdatedAt: data.fcmTokenUpdatedAt || null,
                locationUpdatedAt: data.locationUpdatedAt || null
            };
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            return null;
        }
    }

    /**
     * 🔥 Desactiva las notificaciones del usuario (todos los dispositivos)
     */
    async disableNotifications(uid) {
        try {
            const usersCollection = this._getCollection();
            const q = query(usersCollection, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                throw new Error('Usuario no encontrado');
            }

            const docRef = snapshot.docs[0].ref;
            
            await updateDoc(docRef, {
                fcmToken: '',
                fcmTokens: [],
                notificationsEnabled: false,
                fcmTokenUpdatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Notificaciones desactivadas para:', uid);
            return true;
        } catch (error) {
            console.error('❌ Error desactivando notificaciones:', error);
            throw error;
        }
    }
}

export default NewCollaboratorRepository;