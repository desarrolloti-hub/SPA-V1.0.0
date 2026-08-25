/* ========================================
   FACTURA REPOSITORY
   Conexión a Firebase para gestión de facturas
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
    orderBy
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class FacturaRepository extends BaseRepository {
    
    constructor() {
        super('facturas', 60000);
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
     * Crea una nueva factura
     */
    async createFactura(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Factura creada:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando factura:', error);
            throw new Error('Error al crear la factura: ' + error.message);
        }
    }

    /**
     * Obtiene todas las facturas
     */
    async getAllFacturas() {
        try {
            const snapshot = await getDocs(this._getCollection());
            
            const facturas = [];
            snapshot.forEach(doc => {
                facturas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Ordenar en JavaScript
            facturas.sort((a, b) => {
                const fechaA = a.createdAt || '';
                const fechaB = b.createdAt || '';
                return fechaB.localeCompare(fechaA);
            });
            
            return facturas;
        } catch (error) {
            console.error('❌ Error obteniendo facturas:', error);
            throw new Error('Error al obtener las facturas');
        }
    }

    /**
     * Obtiene una factura por ID
     */
    async getFacturaById(facturaId) {
        try {
            return await this.getById(facturaId);
        } catch (error) {
            console.error('❌ Error obteniendo factura:', error);
            return null;
        }
    }

    /**
     * Obtiene facturas por cotización
     */
    async getFacturasByCotizacion(cotizacionId) {
        try {
            const q = query(
                this._getCollection(),
                where('cotizacionId', '==', cotizacionId)
            );
            const snapshot = await getDocs(q);
            
            const facturas = [];
            snapshot.forEach(doc => {
                facturas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Ordenar en JavaScript
            facturas.sort((a, b) => {
                const fechaA = a.createdAt || '';
                const fechaB = b.createdAt || '';
                return fechaB.localeCompare(fechaA);
            });
            
            return facturas;
        } catch (error) {
            console.error('❌ Error obteniendo facturas por cotización:', error);
            return [];
        }
    }

    /**
     * Actualiza una factura
     */
    async updateFactura(facturaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, facturaId);
            await updateDoc(docRef, {
                ...data,
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log('✅ Factura actualizada:', facturaId);
        } catch (error) {
            console.error('❌ Error actualizando factura:', error);
            throw new Error('Error al actualizar la factura: ' + error.message);
        }
    }

    /**
     * Elimina una factura
     */
    async deleteFactura(facturaId) {
        try {
            const docRef = doc(db, this.collectionName, facturaId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Factura eliminada:', facturaId);
        } catch (error) {
            console.error('❌ Error eliminando factura:', error);
            throw new Error('Error al eliminar la factura');
        }
    }

    /**
     * Cambia el estatus de una factura
     */
    async updateEstatus(facturaId, estatus) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, facturaId);
            await updateDoc(docRef, {
                estatus: estatus,
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            });
            
            this.clearCache();
            console.log(`✅ Factura ${estatus}:`, facturaId);
        } catch (error) {
            console.error('❌ Error cambiando estatus:', error);
            throw new Error('Error al cambiar el estatus de la factura');
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        
        try {
            const usersRef = this._getUsersCollection();
            const q = query(usersRef, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            let name = 'Usuario desconocido';
            if (!snapshot.empty) {
                const userData = snapshot.docs[0].data();
                name = userData.nombreCompleto || userData.displayName || userData.email || 'Usuario';
            }
            
            return name;
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            return 'Usuario desconocido';
        }
    }

    /**
     * Obtiene estadísticas de facturas
     */
    async getFacturaStats() {
        try {
            const snapshot = await getDocs(this._getCollection());
            let total = 0;
            let borradores = 0;
            let pendientes = 0;
            let timbradas = 0;
            let canceladas = 0;
            let totalMonto = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                total++;
                totalMonto += data.totalFinal || 0;
                
                const estatus = data.estatus || 'borrador';
                if (estatus === 'borrador') borradores++;
                else if (estatus === 'pendiente') pendientes++;
                else if (estatus === 'timbrada') timbradas++;
                else if (estatus === 'cancelada') canceladas++;
            });
            
            return {
                total,
                borradores,
                pendientes,
                timbradas,
                canceladas,
                totalMonto
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0, borradores: 0, pendientes: 0, timbradas: 0, canceladas: 0, totalMonto: 0 };
        }
    }
}

export default FacturaRepository;