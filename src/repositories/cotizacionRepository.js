/* ========================================
   COTIZACION REPOSITORY
   Conexión a Firebase para gestión de cotizaciones
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
    limit,
    startAfter
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class CotizacionRepository extends BaseRepository {
    
    constructor() {
        super('cotizacionPdf', 60000);
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
     * Crea una nueva cotización
     */
    async createCotizacion(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Cotización creada:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando cotización:', error);
            throw new Error('Error al crear la cotización: ' + error.message);
        }
    }

    /**
     * Obtiene todas las cotizaciones
     */
    async getAllCotizaciones() {
        try {
            // ✅ Usar orderBy con createdAt si existe, o fallback a fechaCreacion
            // Para simplificar, obtenemos todos los documentos sin orderBy y ordenamos en JS
            const snapshot = await getDocs(this._getCollection());
            
            const cotizaciones = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                cotizaciones.push({
                    id: doc.id,
                    ...data
                });
            });
            
            // ✅ Ordenar por fecha de creación (usando createdAt o fechaCreacion)
            cotizaciones.sort((a, b) => {
                const fechaA = a.createdAt || a.fechaCreacion || '';
                const fechaB = b.createdAt || b.fechaCreacion || '';
                return fechaB.localeCompare(fechaA); // Descendente
            });
            
            console.log(`📊 Cotizaciones obtenidas: ${cotizaciones.length}`);
            return cotizaciones;
        } catch (error) {
            console.error('❌ Error obteniendo cotizaciones:', error);
            throw new Error('Error al obtener las cotizaciones');
        }
    }

    /**
     * Obtiene una cotización por ID
     */
    async getCotizacionById(cotizacionId) {
        try {
            return await this.getById(cotizacionId);
        } catch (error) {
            console.error('❌ Error obteniendo cotización:', error);
            return null;
        }
    }

    /**
     * Actualiza una cotización
     */
    async updateCotizacion(cotizacionId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, cotizacionId);
            await updateDoc(docRef, {
                ...data,
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Cotización actualizada:', cotizacionId);
        } catch (error) {
            console.error('❌ Error actualizando cotización:', error);
            throw new Error('Error al actualizar la cotización: ' + error.message);
        }
    }

    /**
     * Elimina una cotización
     */
    async deleteCotizacion(cotizacionId) {
        try {
            const docRef = doc(db, this.collectionName, cotizacionId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Cotización eliminada:', cotizacionId);
        } catch (error) {
            console.error('❌ Error eliminando cotización:', error);
            throw new Error('Error al eliminar la cotización');
        }
    }

    /**
     * Obtiene cotizaciones por cliente
     */
    async getCotizacionesByCliente(clienteId) {
        try {
            const q = query(
                this._getCollection(),
                where('clienteId', '==', clienteId)
            );
            const snapshot = await getDocs(q);
            
            const cotizaciones = [];
            snapshot.forEach(doc => {
                cotizaciones.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Ordenar por fecha
            cotizaciones.sort((a, b) => {
                const fechaA = a.createdAt || a.fechaCreacion || '';
                const fechaB = b.createdAt || b.fechaCreacion || '';
                return fechaB.localeCompare(fechaA);
            });
            
            return cotizaciones;
        } catch (error) {
            console.error('❌ Error obteniendo cotizaciones por cliente:', error);
            return [];
        }
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
     * Obtiene estadísticas de cotizaciones
     */
    async getCotizacionStats() {
        try {
            const snapshot = await getDocs(this._getCollection());
            let total = 0;
            let enProceso = 0;
            let vendidas = 0;
            let rechazadas = 0;
            let totalMonto = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                total++;
                totalMonto += data.totalFinal || 0;
                
                // ✅ Usar estatus o estado según esté disponible
                const estatus = data.estatus || data.estado || 'en proceso';
                if (estatus === 'en proceso' || estatus === 'completada') enProceso++;
                else if (estatus === 'vendida') vendidas++;
                else if (estatus === 'rechazada') rechazadas++;
                // Los borradores no se cuentan en las estadísticas principales
            });
            
            return {
                total,
                enProceso,
                vendidas,
                rechazadas,
                totalMonto
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0, enProceso: 0, vendidas: 0, rechazadas: 0, totalMonto: 0 };
        }
    }
}

export default CotizacionRepository;