// src/config/firebaseConfig.js
/* ========================================
   FIREBASE CONFIG - Módulo ES6
   Compatible con Firebase v9+ (modular)
   ======================================== */

// ✅ Importar Firebase v9+ (modular)
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    startAfter,
    startAt,
    endAt,
    setDoc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';

import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    sendPasswordResetEmail, 
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';

import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    getMetadata
} from 'firebase/storage';

// 🔥 NUEVO: Importar funciones de Messaging
import { 
    getMessaging, 
    getToken, 
    onMessage,
    isSupported
} from 'firebase/messaging';

// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBJy992gkvsT77-_fMp_O_z99wtjZiK77Y",
    authDomain: "rsienterprise.firebaseapp.com",
    databaseURL: "https://rsienterprise-default-rtdb.firebaseio.com",
    projectId: "rsienterprise",
    storageBucket: "rsienterprise.firebasestorage.app",
    messagingSenderId: "1063117165770",
    appId: "1:1063117165770:web:8555f26b25ae80bc42d033",
    measurementId: "G-38F2DBG9HE"
};

// ==========================================
// INICIALIZAR FIREBASE (solo una vez)
// ==========================================

// Inicializar la app
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// 🔥 NUEVO: Inicializar Messaging (solo en navegador)
let messaging = null;
if (typeof window !== 'undefined') {
    // Verificar si el navegador soporta messaging
    try {
        messaging = getMessaging(app);
        console.log('✅ Firebase Messaging inicializado');
    } catch (error) {
        console.warn('⚠️ Firebase Messaging no soportado en este entorno:', error);
    }
}

console.log('✅ Firebase inicializado correctamente');

// ==========================================
// EXPORTAR SERVICIOS Y FUNCIONES
// ==========================================

// Exportar servicios principales
export { db, auth, storage, app, messaging };

// ✅ Exportar TODAS las funciones de Firestore
export {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    startAt,
    endAt,
    Timestamp,
    writeBatch
};

// ✅ Exportar funciones de Auth
export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    sendEmailVerification
};

// ✅ Exportar funciones de Storage (incluyendo getMetadata)
export {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    getMetadata
};

// 🔥 NUEVO: Exportar funciones de Messaging
export {
    getToken,
    onMessage,
    isSupported
};

// ==========================================
// EXPORTAR POR DEFECTO
// ==========================================

export default {
    app,
    db,
    auth,
    storage,
    messaging, // 🔥 Nuevo
    // Firestore
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    startAt,
    endAt,
    Timestamp,
    writeBatch,
    // Auth
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    sendEmailVerification,
    // Storage
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    getMetadata,
    // Messaging 🔥 Nuevo
    getToken,
    onMessage,
    isSupported
};