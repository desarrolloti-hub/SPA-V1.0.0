/* ========================================
   AUTH REPOSITORY
   Autenticación con Firebase
   ======================================== */

import { 
    auth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    db,
    collection,
    getDocs,
    query,
    where
} from '../config/firebaseConfig.js';

export class AuthRepository {
    
    /**
     * Inicia sesión con email y contraseña
     * @param {string} email - Correo electrónico
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} - UserCredential de Firebase
     */
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Usuario autenticado:', userCredential.user.uid);
            return userCredential;
        } catch (error) {
            console.error('❌ Error en login:', error);
            
            // Manejar errores específicos
            if (error.code === 'auth/user-not-found') {
                throw new Error('Usuario no encontrado');
            }
            if (error.code === 'auth/wrong-password') {
                throw new Error('Contraseña incorrecta');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('Correo electrónico inválido');
            }
            if (error.code === 'auth/too-many-requests') {
                throw new Error('Demasiados intentos. Intenta más tarde');
            }
            
            throw new Error('Error al iniciar sesión: ' + error.message);
        }
    }

    /**
     * Cierra sesión
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            await signOut(auth);
            console.log('✅ Sesión cerrada');
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
            throw new Error('Error al cerrar sesión');
        }
    }

    /**
     * Obtiene el usuario actual
     * @returns {Promise<Object|null>}
     */
    getCurrentUser() {
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    /**
     * Obtiene los datos del usuario desde Firestore
     * @param {string} uid - UID del usuario
     * @returns {Promise<Object|null>}
     */
    async getUserData(uid) {
        try {
            const usersRef = collection(db, 'usersRSI');
            const q = query(usersRef, where('uid', '==', uid));
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
            console.error('❌ Error obteniendo datos del usuario:', error);
            return null;
        }
    }

    /**
     * Verifica si un email existe en Firestore
     * @param {string} email - Correo a verificar
     * @returns {Promise<boolean>}
     */
    async emailExists(email) {
        try {
            const usersRef = collection(db, 'usersRSI');
            const q = query(usersRef, where('emailEmpresarial', '==', email));
            const snapshot = await getDocs(q);
            return !snapshot.empty;
        } catch (error) {
            console.error('❌ Error verificando email:', error);
            return false;
        }
    }
}

export default AuthRepository;