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
    GoogleAuthProvider,
    signInWithPopup,
    doc,
    setDoc,
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
     * Envía correo de restablecimiento de contraseña
     * @param {string} email - Correo electrónico
     * @returns {Promise<boolean>}
     */
    async sendPasswordResetEmail(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            console.log('✅ Correo de restablecimiento enviado a:', email);
            return true;
        } catch (error) {
            console.error('❌ Error enviando correo de restablecimiento:', error);
            if (error.code === 'auth/user-not-found') {
                throw new Error('No existe ningún usuario registrado con este correo');
            }
            if (error.code === 'auth/invalid-email') {
                throw new Error('Correo electrónico inválido');
            }
            throw new Error('Error al enviar correo de recuperación: ' + error.message);
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

    /**
     * Inicia sesión o registro con Google Popup
     */
    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            return await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('❌ Error en Google Login:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Ventana de autenticación cerrada.');
            }
            throw new Error(error.message || 'Error al autenticar con Google');
        }
    }

    /**
     * Crea un usuario con email y contraseña
     */
    async createUserWithEmail(email, password) {
        return await createUserWithEmailAndPassword(auth, email, password);
    }

    /**
     * Guarda o actualiza los datos del usuario en usersRSI
     */
    async setUserData(uid, userData) {
        try {
            const userRef = doc(db, 'usersRSI', uid);
            await setDoc(userRef, userData, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error guardando datos de usuario:', error);
            throw error;
        }
    }
}

export default AuthRepository;
