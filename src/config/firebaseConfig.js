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
    startAfter,        // ✅ AGREGAR startAfter
    startAt,           // ✅ AGREGAR startAt
    endAt,             // ✅ AGREGAR endAt
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
    deleteObject 
} from 'firebase/storage';

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

console.log('✅ Firebase inicializado correctamente');

// ==========================================
// EXPORTAR SERVICIOS Y FUNCIONES
// ==========================================

// Exportar servicios principales
export { db, auth, storage, app };

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
    startAfter,      // ✅ Exportar startAfter
    startAt,         // ✅ Exportar startAt
    endAt,           // ✅ Exportar endAt
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

// Exportar funciones de Storage
export {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
};

// ==========================================
// EXPORTAR POR DEFECTO
// ==========================================

export default {
    app,
    db,
    auth,
    storage,
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
    startAfter,      // ✅ Exportar startAfter
    startAt,         // ✅ Exportar startAt
    endAt,           // ✅ Exportar endAt
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
    deleteObject
};