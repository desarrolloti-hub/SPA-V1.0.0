/* ========================================
   CLIENTE REPOSITORY
   Conexión a Firebase para gestión de clientes
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

export class ClienteRepository extends BaseRepository {
    
    constructor() {
        super('clientesRSI', 60000);
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
     * Crea un nuevo cliente
     */
    async createCliente(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Cliente creado:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando cliente:', error);
            throw new Error('Error al crear el cliente: ' + error.message);
        }
    }

    /**
     * Obtiene todos los clientes
     */
    async getAllClientes() {
        try {
            const snapshot = await getDocs(this._getCollection());
            const clientes = [];
            snapshot.forEach(doc => {
                clientes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return clientes;
        } catch (error) {
            console.error('❌ Error obteniendo clientes:', error);
            throw new Error('Error al obtener los clientes');
        }
    }

    /**
     * Obtiene un cliente por ID
     */
    async getClienteById(clienteId) {
        try {
            return await this.getById(clienteId);
        } catch (error) {
            console.error('❌ Error obteniendo cliente:', error);
            return null;
        }
    }

    /**
     * Obtiene un cliente por RFC
     */
    async getClienteByRfc(rfc) {
        try {
            const q = query(
                this._getCollection(),
                where('rfc', '==', rfc.toUpperCase())
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return null;
            
            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('❌ Error obteniendo cliente por RFC:', error);
            return null;
        }
    }

    /**
     * ✅ Actualiza un cliente (con auditoría)
     */
    async updateCliente(clienteId, data) {
        try {
            const docRef = doc(db, this.collectionName, clienteId);
            
            // ✅ Asegurar que modificadoPor y updatedAt estén en los datos
            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            
            // Si no viene modificadoPor, obtenerlo del usuario actual
            if (!updateData.modificadoPor) {
                updateData.modificadoPor = this._getCurrentUserUid() || '';
            }
            
            await updateDoc(docRef, updateData);
            
            this.clearCache();
            console.log('✅ Cliente actualizado:', clienteId);
            console.log('📝 Datos actualizados:', updateData);
        } catch (error) {
            console.error('❌ Error actualizando cliente:', error);
            throw new Error('Error al actualizar el cliente: ' + error.message);
        }
    }

    /**
     * ✅ Elimina un cliente (soft delete) con auditoría
     */
    async deleteCliente(clienteId, uid = null) {
        try {
            const userId = uid || this._getCurrentUserUid();
            const docRef = doc(db, this.collectionName, clienteId);
            await updateDoc(docRef, {
                status: 'inactive',
                modificadoPor: userId,
                updatedAt: new Date().toISOString()
            });
            this.clearCache();
            console.log('✅ Cliente deshabilitado:', clienteId);
        } catch (error) {
            console.error('❌ Error deshabilitando cliente:', error);
            throw new Error('Error al deshabilitar el cliente: ' + error.message);
        }
    }

    /**
     * ✅ Marca un cliente como validado por SAT con auditoría
     */
    async validarClienteSAT(clienteId, uid = null) {
        try {
            const userId = uid || this._getCurrentUserUid();
            const docRef = doc(db, this.collectionName, clienteId);
            await updateDoc(docRef, {
                validadoSAT: true,
                fechaValidacionSAT: new Date().toISOString(),
                modificadoPor: userId,
                updatedAt: new Date().toISOString()
            });
            this.clearCache();
            console.log('✅ Cliente validado por SAT:', clienteId);
        } catch (error) {
            console.error('❌ Error validando cliente SAT:', error);
            throw new Error('Error al validar el cliente contra el SAT: ' + error.message);
        }
    }

    /**
     * Elimina permanentemente un cliente
     */
    async deleteClientePermanently(clienteId) {
        try {
            const docRef = doc(db, this.collectionName, clienteId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Cliente eliminado permanentemente:', clienteId);
        } catch (error) {
            console.error('❌ Error eliminando cliente:', error);
            throw new Error('Error al eliminar el cliente: ' + error.message);
        }
    }

    /**
     * Verifica si existe un cliente con el mismo RFC
     */
    async existsClienteByRfc(rfc, excludeId = null) {
        try {
            const q = query(
                this._getCollection(),
                where('rfc', '==', rfc.toUpperCase())
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return false;
            
            if (excludeId) {
                let found = false;
                snapshot.forEach(doc => {
                    if (doc.id !== excludeId) {
                        found = true;
                    }
                });
                return found;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error verificando RFC:', error);
            return false;
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        
        try {
            const usersRef = collection(db, 'usersRSI');
            const q = query(usersRef, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return 'Usuario desconocido';
            }
            
            const userData = snapshot.docs[0].data();
            return userData.nombreCompleto || userData.displayName || userData.email || 'Usuario';
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            return 'Usuario desconocido';
        }
    }
}

export default ClienteRepository;