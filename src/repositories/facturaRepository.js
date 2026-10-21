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
    orderBy,
    limit
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
     * @param {string} facturaId - ID del documento
     * @param {boolean} forceRefresh - Forzar lectura omitiendo caché
     */
    async getFacturaById(facturaId, forceRefresh = false) {
        try {
            return await this.getById(facturaId, forceRefresh);
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
     * Obtiene una factura por su folio/número de factura
     * @param {string} facturaNumero - Número de factura (ej. 'FAC-20261012-001')
     * @returns {Promise<Object|null>}
     */
    async getFacturaByFolio(facturaNumero) {
        if (!facturaNumero) return null;
        try {
            const q = query(
                this._getCollection(),
                where('facturaNumero', '==', facturaNumero),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            const docSnap = snapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        } catch (error) {
            console.error('❌ Error buscando factura por folio:', error);
            return null;
        }
    }

    /**
     * Obtiene una factura por su ID de Facturama
     * @param {string} facturamaId - ID asignado por Facturama
     * @returns {Promise<Object|null>}
     */
    async getFacturaByFacturamaId(facturamaId) {
        if (!facturamaId) return null;
        try {
            const q = query(
                this._getCollection(),
                where('facturamaId', '==', facturamaId),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            const docSnap = snapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        } catch (error) {
            console.error('❌ Error buscando factura por Facturama ID:', error);
            return null;
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
     * Actualiza el estado fiscal y los metadatos de cancelación de una factura
     * @param {string} facturaId - ID del documento en Firestore
     * @param {Object} data - Datos de cancelación y estatus resultante
     */
    async updateCancelacionFactura(facturaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = doc(db, this.collectionName, facturaId);
            const updatePayload = {
                estatus: data.estatus || 'cancelada',
                cancelacion: {
                    solicitada: true,
                    fechaSolicitud: data.fechaSolicitud || new Date().toISOString(),
                    motivo: data.motivo || '',
                    folioSustitucion: data.folioSustitucion || '',
                    status: data.status || '',
                    mensaje: data.mensaje || '',
                    acuseXmlUrl: data.acuseXmlUrl || '',
                    acuseXmlPath: data.acuseXmlPath || '',
                    solicitadoPor: uid
                },
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(docRef, updatePayload);
            this.clearCache();
            console.log(`✅ Cancelación registrada para factura ${facturaId} (estatus: ${updatePayload.estatus})`);
            return true;
        } catch (error) {
            console.error('❌ Error registrando cancelación de factura:', error);
            throw new Error('Error al registrar la cancelación de la factura: ' + error.message);
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