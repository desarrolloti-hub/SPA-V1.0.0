/* ========================================
   NEW COLLABORATOR REPOSITORY
   Solo conexión a Firebase
   ======================================== */

// ✅ Importar desde firebaseConfig (modular)
import { 
    db, 
    auth,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    createUserWithEmailAndPassword  // ✅ Función importada correctamente
} from '../config/firebaseConfig.js';

export class NewCollaboratorRepository {
    
    /**
     * Crea un nuevo usuario en Firebase Auth
     * @param {string} email - Correo electrónico
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} - UserCredential de Firebase
     */
    async createAuthUser(email, password) {
        try {
            // ✅ Usar la función importada directamente
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('✅ Usuario creado en Auth:', userCredential.user.uid);
            return userCredential;
        } catch (error) {
            console.error('❌ Error creando usuario en Auth:', error);
            
            // Manejar errores específicos de Firebase Auth
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
     * Guarda los datos del colaborador en Firestore
     * @param {string} uid - UID del usuario autenticado
     * @param {Object} data - Datos del colaborador
     * @returns {Promise<string>} - ID del documento creado
     */
    async saveCollaboratorData(uid, data) {
        try {
            const collaboratorData = {
                ...data,
                uid: uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active'
            };

            // ✅ Usar collection y addDoc correctamente
            const usersCollection = collection(db, 'usersRSI');
            const docRef = await addDoc(usersCollection, collaboratorData);
            
            console.log('✅ Colaborador guardado en Firestore:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error guardando colaborador en Firestore:', error);
            throw new Error('Error al guardar los datos del colaborador: ' + error.message);
        }
    }

    /**
     * Verifica si un email ya está registrado
     * @param {string} email - Correo a verificar
     * @returns {Promise<boolean>}
     */
    async checkEmailExists(email) {
        try {
            // ✅ Usar query y where correctamente
            const usersCollection = collection(db, 'usersRSI');
            const q = query(usersCollection, where('emailEmpresarial', '==', email));
            const snapshot = await getDocs(q);
            
            return !snapshot.empty;
        } catch (error) {
            console.error('❌ Error verificando email:', error);
            return false;
        }
    }

    /**
     * Obtiene un colaborador por su UID
     * @param {string} uid - UID del usuario
     * @returns {Promise<Object|null>}
     */
    async getCollaboratorByUid(uid) {
        try {
            const usersCollection = collection(db, 'usersRSI');
            const q = query(usersCollection, where('uid', '==', uid));
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
            console.error('❌ Error obteniendo colaborador:', error);
            return null;
        }
    }
}

export default NewCollaboratorRepository;