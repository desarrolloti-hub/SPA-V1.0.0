/* ========================================
   TICKET REPOSITORY
   Conexión a Firebase para gestión de tickets
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
    startAfter,
    Timestamp,
    setDoc
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class TicketRepository extends BaseRepository {
    
    constructor() {
        super('ticketsOperaciones', 60000);
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
     * Obtiene el nombre del usuario desde localStorage
     */
    _getCurrentUserName() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return 'Sistema';
            const sessionData = JSON.parse(session);
            return sessionData.nombreCompleto || sessionData.displayName || sessionData.email || 'Usuario';
        } catch (error) {
            console.error('❌ Error obteniendo nombre de usuario:', error);
            return 'Sistema';
        }
    }

    /**
     * Obtiene el contador actual y genera un nuevo ID
     * ✅ Asegura que nunca devuelva null
     */
    async _getNextTicketId() {
        const contadorRef = doc(db, 'contadorTickets', 'contadorTicketsMesa');
        
        try {
            const docSnap = await getDoc(contadorRef);
            let nuevoContador;
            
            if (!docSnap.exists()) {
                nuevoContador = 1;
                await setDoc(contadorRef, { contador: nuevoContador });
            } else {
                nuevoContador = docSnap.data().contador + 1;
                await updateDoc(contadorRef, { contador: nuevoContador });
            }
            
            return {
                contador: nuevoContador,
                idTicket: `Ticket-RSI-${nuevoContador}`
            };
        } catch (error) {
            console.error('❌ Error generando ID de ticket:', error);
            // ✅ Fallback seguro: usar timestamp
            const timestamp = Date.now();
            return {
                contador: timestamp,
                idTicket: `Ticket-RSI-${timestamp}`
            };
        }
    }

    /**
     * Crea un nuevo ticket
     */
    async createTicket(ticketData) {
        try {
            // Asegurar que el ID del ticket esté en los datos
            const data = {
                ...ticketData,
                fechaCreacion: new Date().toISOString(),
                fechaActualizacion: new Date().toISOString()
            };

            const docRef = await addDoc(this._getCollection(), data);
            this.clearCache();
            console.log('✅ Ticket creado:', docRef.id, 'ID:', data.idTicket);
            
            return {
                docId: docRef.id,
                idTicket: data.idTicket
            };
        } catch (error) {
            console.error('❌ Error creando ticket:', error);
            throw new Error('Error al crear el ticket: ' + error.message);
        }
    }

    /**
     * Obtiene todos los tickets
     */
    async getAllTickets(forceRefresh = false) {
        try {
            if (!forceRefresh && this.cache.all) {
                console.log('📦 Usando caché de tickets');
                return this.cache.all;
            }

            const q = query(
                this._getCollection(),
                orderBy('fechaCreacion', 'desc')
            );
            const snapshot = await getDocs(q);
            
            const tickets = [];
            snapshot.forEach(doc => {
                tickets.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.cache.all = tickets;
            console.log(`✅ ${tickets.length} tickets cargados`);
            return tickets;
        } catch (error) {
            console.error('❌ Error obteniendo tickets:', error);
            throw new Error('Error al obtener los tickets');
        }
    }

    /**
     * Obtiene tickets con paginación
     */
    async getTicketsPaginated(pageSize = 20, page = 1, filters = {}) {
        try {
            let q = query(this._getCollection(), orderBy('fechaCreacion', 'desc'));
            
            // Aplicar filtros
            if (filters.tipo) {
                q = query(q, where('tipo', '==', filters.tipo));
            }
            
            if (filters.estado) {
                q = query(q, where('estado', '==', filters.estado));
            }
            
            if (filters.prioridad) {
                q = query(q, where('prioridad', '==', filters.prioridad));
            }
            
            if (filters.colaboradorId) {
                q = query(q, where('colaboradoresIds', 'array-contains', filters.colaboradorId));
            }

            // Paginación
            const startAt = (page - 1) * pageSize;
            q = query(q, limit(pageSize));

            const snapshot = await getDocs(q);
            const tickets = [];
            
            snapshot.forEach(doc => {
                tickets.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Obtener total
            const totalQuery = query(this._getCollection());
            const totalSnapshot = await getDocs(totalQuery);
            
            return {
                tickets,
                total: totalSnapshot.size,
                page,
                pageSize,
                totalPages: Math.ceil(totalSnapshot.size / pageSize)
            };
        } catch (error) {
            console.error('❌ Error obteniendo tickets paginados:', error);
            throw new Error('Error al obtener los tickets');
        }
    }

    /**
     * Obtiene un ticket por ID
     */
    async getTicketById(ticketId, forceRefresh = false) {
        try {
            if (!forceRefresh && this.cache.byId && this.cache.byId[ticketId]) {
                console.log(`📦 Usando caché para ticket ${ticketId}`);
                return this.cache.byId[ticketId];
            }

            const docRef = doc(db, this.collectionName, ticketId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return null;
            }

            const ticket = {
                id: docSnap.id,
                ...docSnap.data()
            };

            if (!this.cache.byId) this.cache.byId = {};
            this.cache.byId[ticketId] = ticket;
            
            return ticket;
        } catch (error) {
            console.error(`❌ Error obteniendo ticket ${ticketId}:`, error);
            return null;
        }
    }

    /**
     * Obtiene un ticket por su ID (Ticket-RSI-XXX)
     */
    async getTicketByIdTicket(idTicket) {
        try {
            const q = query(
                this._getCollection(),
                where('idTicket', '==', idTicket)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return null;
            
            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error(`❌ Error obteniendo ticket por ID ${idTicket}:`, error);
            return null;
        }
    }

    /**
     * Obtiene tickets por colaborador
     */
    async getTicketsByColaborador(colaboradorId) {
        try {
            const q = query(
                this._getCollection(),
                where('colaboradoresIds', 'array-contains', colaboradorId),
                orderBy('fechaCreacion', 'desc')
            );
            const snapshot = await getDocs(q);
            
            const tickets = [];
            snapshot.forEach(doc => {
                tickets.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return tickets;
        } catch (error) {
            console.error(`❌ Error obteniendo tickets del colaborador ${colaboradorId}:`, error);
            return [];
        }
    }

    /**
     * Obtiene tickets por cliente
     */
    async getTicketsByCliente(clienteId) {
        try {
            const q = query(
                this._getCollection(),
                where('clienteId', '==', clienteId),
                orderBy('fechaCreacion', 'desc')
            );
            const snapshot = await getDocs(q);
            
            const tickets = [];
            snapshot.forEach(doc => {
                tickets.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return tickets;
        } catch (error) {
            console.error(`❌ Error obteniendo tickets del cliente ${clienteId}:`, error);
            return [];
        }
    }

    /**
     * Actualiza un ticket
     */
    async updateTicket(ticketId, data) {
        try {
            const docRef = doc(db, this.collectionName, ticketId);
            
            const updateData = {
                ...data,
                fechaActualizacion: new Date().toISOString()
            };
            
            await updateDoc(docRef, updateData);
            
            // Limpiar caché
            this.clearCache();
            console.log('✅ Ticket actualizado:', ticketId);
            
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando ticket ${ticketId}:`, error);
            throw new Error('Error al actualizar el ticket: ' + error.message);
        }
    }

    /**
     * Actualiza el estado de un ticket
     */
    async updateTicketEstado(ticketId, estado, usuarioId, usuarioNombre) {
        try {
            const docRef = doc(db, this.collectionName, ticketId);
            
            const updateData = {
                estado: estado,
                fechaActualizacion: new Date().toISOString(),
                modificadoPor: usuarioId || this._getCurrentUserUid()
            };
            
            // Si se finaliza, agregar fecha de finalización
            if (estado === 'finalizado') {
                updateData.fechaFinalizacion = new Date().toISOString();
            }
            
            await updateDoc(docRef, updateData);
            
            this.clearCache();
            console.log(`✅ Ticket ${ticketId} actualizado a estado: ${estado}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error actualizando estado del ticket ${ticketId}:`, error);
            throw new Error('Error al actualizar el estado del ticket');
        }
    }

    /**
     * Agrega un evento al historial del ticket
     */
    async addHistorialEvent(ticketId, evento, usuario, usuarioId, descripcion) {
        try {
            const docRef = doc(db, this.collectionName, ticketId);
            const now = new Date().toISOString();
            
            // ✅ Obtener el ticket actual para asegurar que no haya duplicados
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                throw new Error('Ticket no encontrado');
            }
            
            // ✅ Verificar si ya existe un evento con este timestamp exacto
            const historialActual = ticket.historial || {};
            
            // ✅ Si ya existe un evento con este timestamp, agregar un sufijo
            let timestampKey = now;
            let counter = 0;
            while (historialActual[timestampKey]) {
                counter++;
                // Agregar microsegundos para evitar duplicados
                const date = new Date(now);
                date.setMilliseconds(date.getMilliseconds() + counter);
                timestampKey = date.toISOString();
            }
            
            const historialEntry = {
                [timestampKey]: {
                    evento: evento,
                    usuario: usuario || 'Sistema',
                    usuarioId: usuarioId || this._getCurrentUserUid() || '',
                    descripcion: descripcion || '',
                    timestamp: timestampKey
                }
            };
            
            const nuevoHistorial = {
                ...historialActual,
                ...historialEntry
            };
            
            await updateDoc(docRef, {
                historial: nuevoHistorial,
                fechaActualizacion: timestampKey,
                modificadoPor: usuarioId || this._getCurrentUserUid()
            });
            
            this.clearCache();
            console.log(`✅ Evento agregado al historial del ticket ${ticketId}: ${evento}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error agregando evento al historial del ticket ${ticketId}:`, error);
            throw new Error('Error al agregar evento al historial: ' + error.message);
        }
    }

    /**
     * Elimina un ticket (soft delete - cancelar)
     */
    async deleteTicket(ticketId, uid = null) {
        try {
            const userId = uid || this._getCurrentUserUid();
            const docRef = doc(db, this.collectionName, ticketId);
            await updateDoc(docRef, {
                estado: 'cancelado',
                fechaActualizacion: new Date().toISOString(),
                modificadoPor: userId
            });
            this.clearCache();
            console.log('✅ Ticket cancelado:', ticketId);
        } catch (error) {
            console.error(`❌ Error cancelando ticket ${ticketId}:`, error);
            throw new Error('Error al cancelar el ticket: ' + error.message);
        }
    }

    /**
     * Elimina permanentemente un ticket
     */
    async deleteTicketPermanently(ticketId) {
        try {
            const docRef = doc(db, this.collectionName, ticketId);
            await deleteDoc(docRef);
            this.clearCache();
            console.log('✅ Ticket eliminado permanentemente:', ticketId);
        } catch (error) {
            console.error(`❌ Error eliminando ticket ${ticketId}:`, error);
            throw new Error('Error al eliminar el ticket: ' + error.message);
        }
    }

    /**
     * Obtiene estadísticas de tickets
     */
    async getTicketStats() {
        try {
            const snapshot = await getDocs(this._getCollection());
            const tickets = [];
            snapshot.forEach(doc => tickets.push(doc.data()));
            
            const total = tickets.length;
            const pendientes = tickets.filter(t => t.estado === 'pendiente').length;
            const enProceso = tickets.filter(t => t.estado === 'en_proceso').length;
            const finalizados = tickets.filter(t => t.estado === 'finalizado').length;
            const cancelados = tickets.filter(t => t.estado === 'cancelado').length;
            
            const operativos = tickets.filter(t => t.tipo === 'operativo').length;
            const administracion = tickets.filter(t => t.tipo === 'administracion').length;
            
            const alta = tickets.filter(t => t.prioridad === 'alta').length;
            const media = tickets.filter(t => t.prioridad === 'media').length;
            const baja = tickets.filter(t => t.prioridad === 'baja').length;
            
            return {
                total,
                pendientes,
                enProceso,
                finalizados,
                cancelados,
                operativos,
                administracion,
                alta,
                media,
                baja
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return {
                total: 0,
                pendientes: 0,
                enProceso: 0,
                finalizados: 0,
                cancelados: 0,
                operativos: 0,
                administracion: 0,
                alta: 0,
                media: 0,
                baja: 0
            };
        }
    }

    /**
     * Obtiene el nombre de un colaborador por su ID
     */
    async getColaboradorNombre(colaboradorId) {
        try {
            const docRef = doc(db, 'colaboradores', colaboradorId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return 'Colaborador desconocido';
            }
            
            const data = docSnap.data();
            return data.NOMBRE || data.nombre || 'Colaborador';
        } catch (error) {
            console.error('❌ Error obteniendo colaborador:', error);
            return 'Colaborador desconocido';
        }
    }

    /**
     * Obtiene el nombre de un cliente por su ID
     */
    async getClienteNombre(clienteId) {
        try {
            const docRef = doc(db, 'clientes', clienteId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return 'Cliente desconocido';
            }
            
            const data = docSnap.data();
            return data.Nombre || data.razonSocial || data.nombreComercial || 'Cliente';
        } catch (error) {
            console.error('❌ Error obteniendo cliente:', error);
            return 'Cliente desconocido';
        }
    }

    /**
     * Marca que las notificaciones fueron enviadas
     */
    async marcarNotificacionesEnviadas(ticketId) {
        try {
            const docRef = doc(db, this.collectionName, ticketId);
            await updateDoc(docRef, {
                notificacionesEnviadas: true,
                fechaUltimaNotificacion: new Date().toISOString()
            });
            this.clearCache();
            console.log(`✅ Notificaciones marcadas como enviadas para ticket ${ticketId}`);
        } catch (error) {
            console.error(`❌ Error marcando notificaciones para ticket ${ticketId}:`, error);
        }
    }
}

export default TicketRepository;