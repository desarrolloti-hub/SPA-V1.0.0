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
        
        // Si hay término de búsqueda, usar búsqueda
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
            
            // Búsqueda en memoria (para conjuntos pequeños)
            // Para conjuntos grandes, usar índices compuestos
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
            // Fallback: paginación normal sin búsqueda
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
}

export default NewCollaboratorRepository;