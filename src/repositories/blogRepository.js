/* ========================================
   BLOG REPOSITORY - RSI Enterprise México
   Acceso a datos de Firestore con caché TTL
   ======================================== */

import {
    db,
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
    increment
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class BlogRepository extends BaseRepository {

    constructor() {
        super('blogs', 60000); // 60 segundos de caché TTL
    }

    /**
     * Obtiene todos los blogs (para el panel de administración / partner)
     * @param {boolean} forceRefresh
     * @returns {Promise<Array<Object>>}
     */
    async getAllBlogs(forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cached = this._getCachedData('all_blogs');
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const q = query(colRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const blogs = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            this._setCachedData('all_blogs', blogs);
            return blogs;
        } catch (error) {
            console.error('❌ Error en BlogRepository.getAllBlogs:', error);
            // Fallback si falta índice de ordenación
            try {
                const snapshotFallback = await getDocs(collection(db, this.collectionName));
                return snapshotFallback.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (fbErr) {
                console.error('❌ Error en fallback de blogs:', fbErr);
                return [];
            }
        }
    }

    /**
     * Obtiene únicamente los blogs publicados (para el portal público de visitantes)
     * @param {boolean} forceRefresh
     * @returns {Promise<Array<Object>>}
     */
    async getPublishedBlogs(forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cached = this._getCachedData('published_blogs');
                if (cached) return cached;
            }

            const colRef = collection(db, this.collectionName);
            const q = query(
                colRef,
                where('status', '==', 'published'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            const blogs = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            this._setCachedData('published_blogs', blogs);
            return blogs;
        } catch (error) {
            console.error('❌ Error en BlogRepository.getPublishedBlogs:', error);
            // Fallback sin orderBy por si se consulta antes de sincronizar índices
            try {
                const colRef = collection(db, this.collectionName);
                const qFallback = query(colRef, where('status', '==', 'published'));
                const snapshotFallback = await getDocs(qFallback);
                const list = snapshotFallback.docs.map(d => ({ id: d.id, ...d.data() }));
                return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            } catch (fbErr) {
                console.error('❌ Error en fallback de blogs publicados:', fbErr);
                return [];
            }
        }
    }

    /**
     * Obtiene un blog por su ID de documento
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getBlogById(id) {
        try {
            if (!id) return null;
            const docRef = doc(db, this.collectionName, id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return null;
            return { id: docSnap.id, ...docSnap.data() };
        } catch (error) {
            console.error('❌ Error en BlogRepository.getBlogById:', error);
            return null;
        }
    }

    /**
     * Obtiene un blog por su slug amigable (título sin espacios)
     * @param {string} slug
     * @returns {Promise<Object|null>}
     */
    async getBlogBySlug(slug) {
        try {
            if (!slug) return null;
            const colRef = collection(db, this.collectionName);
            const q = query(colRef, where('slug', '==', slug), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;
            const firstDoc = snapshot.docs[0];
            return { id: firstDoc.id, ...firstDoc.data() };
        } catch (error) {
            console.error(`❌ Error en BlogRepository.getBlogBySlug (${slug}):`, error);
            return null;
        }
    }

    /**
     * Crea un nuevo documento de blog
     * @param {Object} blogData
     * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
     */
    async createBlog(blogData) {
        try {
            const colRef = collection(db, this.collectionName);
            const docRef = await addDoc(colRef, blogData);
            this.clearCache();
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('❌ Error creando blog:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Actualiza un blog existente
     * @param {string} id
     * @param {Object} updateData
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async updateBlog(id, updateData) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, updateData);
            this.clearCache();
            return { success: true };
        } catch (error) {
            console.error(`❌ Error actualizando blog ${id}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Elimina un blog de Firestore
     * @param {string} id
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async deleteBlog(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            await deleteDoc(docRef);
            this.clearCache();
            return { success: true };
        } catch (error) {
            console.error(`❌ Error eliminando blog ${id}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Incrementa el contador de vistas de un artículo
     * @param {string} id
     */
    async incrementVistas(id) {
        try {
            if (!id) return;
            const docRef = doc(db, this.collectionName, id);
            await updateDoc(docRef, {
                vistas: increment(1)
            });
        } catch (error) {
            // Silencioso para no interrumpir lectura
            console.warn('⚠️ No se pudo incrementar contador de vistas:', error);
        }
    }
}

export default BlogRepository;
