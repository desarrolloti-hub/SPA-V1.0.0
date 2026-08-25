/* ========================================
   TICKET SERVICE
   Lógica de negocio para gestión de tickets
   ======================================== */

import TicketRepository from '../repositories/ticketRepository.js';
import TicketModel from '../models/ticketModel.js';
import ClienteRepository from '../repositories/clienteRepository.js';
import PartnerRepository from '../repositories/partnerRepository.js';

// URL de la Cloud Function para notificaciones
const NOTIFICACIONES_API_URL = "https://us-central1-rsienterprise.cloudfunctions.net/enviarNotificacion";

export class TicketService {
    
    constructor() {
        this.repository = new TicketRepository();
        this.clienteRepository = new ClienteRepository();
        this.partnerRepository = new PartnerRepository();
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
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
     * Obtiene el nombre del usuario actual desde localStorage
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
     * Valida los datos del ticket
     */
    validateTicket(data, tipo) {
        return TicketModel.validate(data, tipo);
    }

    /**
     * Obtiene todos los tickets
     */
    async getAllTickets(forceRefresh = false) {
        try {
            return await this.repository.getAllTickets(forceRefresh);
        } catch (error) {
            console.error('❌ Error en getAllTickets:', error);
            throw error;
        }
    }

    /**
     * Obtiene tickets paginados
     */
    async getTicketsPaginated(pageSize = 20, page = 1, filters = {}) {
        try {
            return await this.repository.getTicketsPaginated(pageSize, page, filters);
        } catch (error) {
            console.error('❌ Error en getTicketsPaginated:', error);
            throw error;
        }
    }

    /**
     * Obtiene un ticket por ID
     */
    async getTicketById(ticketId, forceRefresh = false) {
        try {
            return await this.repository.getTicketById(ticketId, forceRefresh);
        } catch (error) {
            console.error('❌ Error en getTicketById:', error);
            return null;
        }
    }

    /**
     * Obtiene un ticket por su ID (Ticket-RSI-XXX)
     */
    async getTicketByIdTicket(idTicket) {
        try {
            return await this.repository.getTicketByIdTicket(idTicket);
        } catch (error) {
            console.error('❌ Error en getTicketByIdTicket:', error);
            return null;
        }
    }

    /**
     * Crea un nuevo ticket
     */
    async createTicket(data, tipo) {
        try {
            const uid = this._getCurrentUserUid();
            const nombre = this._getCurrentUserName();

            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateTicket(data, tipo);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            // ✅ Primero obtener el ID del ticket
            const { idTicket } = await this.repository._getNextTicketId();
            
            // ✅ Luego crear el modelo con el ID correcto
            const ticketData = TicketModel.create(
                data,
                idTicket,
                uid,
                nombre,
                tipo
            );

            const result = await this.repository.createTicket(ticketData);

            return {
                success: true,
                docId: result.docId,
                idTicket: result.idTicket,
                message: 'Ticket creado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createTicket:', error);
            throw error;
        }
    }

    /**
     * Actualiza un ticket
     */
    async updateTicket(ticketId, data) {
        try {
            const uid = this._getCurrentUserUid();
            const nombre = this._getCurrentUserName();

            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const ticketActual = await this.repository.getTicketById(ticketId, true);
            if (!ticketActual) {
                throw new Error('Ticket no encontrado');
            }

            const validation = this.validateTicket(data, ticketActual.tipo);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const updateData = {
                titulo: data.titulo?.trim() || ticketActual.titulo,
                descripcion: data.descripcion?.trim() || ticketActual.descripcion,
                prioridad: data.prioridad || ticketActual.prioridad,
                estado: data.estado || ticketActual.estado,
                colaboradoresIds: data.colaboradoresIds || ticketActual.colaboradoresIds,
                responsableNombre: data.responsableNombre || ticketActual.responsableNombre,
                area: data.area || ticketActual.area,
                fechaInicio: data.fechaInicio || ticketActual.fechaInicio,
                fechaFin: data.fechaFin || ticketActual.fechaFin,
                modificadoPor: uid
            };

            if (ticketActual.tipo === 'operativo') {
                updateData.clienteId = data.clienteId || ticketActual.clienteId;
                updateData.clienteNombre = data.clienteNombre || ticketActual.clienteNombre;
                updateData.rfc = data.rfc || ticketActual.rfc;
                updateData.atencionA = data.atencionA || ticketActual.atencionA;
                updateData.correo = data.correo || ticketActual.correo;
                updateData.ordenServicio = data.ordenServicio || ticketActual.ordenServicio;
                updateData.proyecto = data.proyecto || ticketActual.proyecto;
                updateData.servicio = data.servicio || ticketActual.servicio;
                updateData.sistemas = data.sistemas || ticketActual.sistemas;
                updateData.cotizacionId = data.cotizacionId || ticketActual.cotizacionId;
                updateData.cotizacionNumero = data.cotizacionNumero || ticketActual.cotizacionNumero;
            } else {
                updateData.fechaFinalizacionEstimada = data.fechaFinalizacionEstimada || ticketActual.fechaFinalizacionEstimada;
                updateData.clienteId = null;
                updateData.clienteNombre = '';
                updateData.rfc = '';
                updateData.atencionA = '';
                updateData.correo = '';
                updateData.sistemas = [];
            }

            await this.repository.updateTicket(ticketId, updateData);

            // ✅ Agregar evento de edición al historial
            await this.repository.addHistorialEvent(
                ticketId,
                'edicion',
                nombre,
                uid,
                `Ticket editado por ${nombre}`
            );

            // Verificar si cambiaron los colaboradores
            const colaboradoresAnteriores = ticketActual.colaboradoresIds || [];
            const nuevosColaboradores = data.colaboradoresIds || [];
            
            const colaboradoresNuevos = nuevosColaboradores.filter(
                id => !colaboradoresAnteriores.includes(id)
            );

            if (colaboradoresNuevos.length > 0) {
                await this.enviarNotificacionesAsignacion(
                    colaboradoresNuevos,
                    ticketActual.idTicket,
                    data.titulo || ticketActual.titulo,
                    data.prioridad || ticketActual.prioridad,
                    ticketActual.tipo
                );
            }

            return {
                success: true,
                message: 'Ticket actualizado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateTicket:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de un ticket
     */
    async updateTicketEstado(ticketId, estado) {
        try {
            const uid = this._getCurrentUserUid();
            const nombre = this._getCurrentUserName();

            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const ticket = await this.repository.getTicketById(ticketId, true);
            if (!ticket) {
                throw new Error('Ticket no encontrado');
            }

            if (estado === 'finalizado' && ticket.estado === 'finalizado') {
                throw new Error('El ticket ya está finalizado');
            }

            if (estado === 'cancelado' && ticket.estado === 'cancelado') {
                throw new Error('El ticket ya está cancelado');
            }

            await this.repository.updateTicketEstado(ticketId, estado, uid, nombre);

            const eventoMap = {
                'pendiente': 'estado_pendiente',
                'en_proceso': 'estado_en_proceso',
                'finalizado': 'cierre',
                'cancelado': 'cancelacion'
            };

            const descripcionMap = {
                'pendiente': 'Ticket marcado como pendiente',
                'en_proceso': 'Ticket en proceso',
                'finalizado': 'Ticket finalizado',
                'cancelado': 'Ticket cancelado'
            };

            await this.repository.addHistorialEvent(
                ticketId,
                eventoMap[estado] || 'estado_cambiado',
                nombre,
                uid,
                descripcionMap[estado] || `Estado cambiado a: ${estado}`
            );

            return {
                success: true,
                message: `Ticket ${estado === 'finalizado' ? 'finalizado' : estado === 'cancelado' ? 'cancelado' : 'actualizado'} exitosamente`
            };

        } catch (error) {
            console.error('❌ Error en updateTicketEstado:', error);
            throw error;
        }
    }

    /**
     * Elimina un ticket (soft delete - cancelar)
     */
    async deleteTicket(ticketId) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const ticket = await this.repository.getTicketById(ticketId, true);
            if (!ticket) {
                throw new Error('Ticket no encontrado');
            }

            if (ticket.estado === 'cancelado') {
                throw new Error('El ticket ya está cancelado');
            }

            await this.repository.deleteTicket(ticketId, uid);

            const nombre = this._getCurrentUserName();
            await this.repository.addHistorialEvent(
                ticketId,
                'cancelacion',
                nombre,
                uid,
                `Ticket cancelado por ${nombre}`
            );

            return {
                success: true,
                message: 'Ticket cancelado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en deleteTicket:', error);
            throw error;
        }
    }

    /**
     * Reactiva un ticket cancelado
     */
    async reactivarTicket(ticketId) {
        try {
            const uid = this._getCurrentUserUid();
            const nombre = this._getCurrentUserName();

            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const ticket = await this.repository.getTicketById(ticketId, true);
            if (!ticket) {
                throw new Error('Ticket no encontrado');
            }

            if (ticket.estado !== 'cancelado') {
                throw new Error('Solo se pueden reactivar tickets cancelados');
            }

            // Cambiar estado a pendiente
            await this.repository.updateTicketEstado(ticketId, 'pendiente', uid, nombre);

            // Agregar evento al historial
            await this.repository.addHistorialEvent(
                ticketId,
                'reactivacion',
                nombre,
                uid,
                `Ticket reactivado por ${nombre}`
            );

            return {
                success: true,
                message: 'Ticket reactivado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en reactivarTicket:', error);
            throw error;
        }
    }

    /**
     * Elimina permanentemente un ticket
     */
    async deleteTicketPermanently(ticketId) {
        try {
            await this.repository.deleteTicketPermanently(ticketId);
            return {
                success: true,
                message: 'Ticket eliminado permanentemente'
            };
        } catch (error) {
            console.error('❌ Error en deleteTicketPermanently:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de tickets
     */
    async getTicketStats() {
        try {
            return await this.repository.getTicketStats();
        } catch (error) {
            console.error('❌ Error en getTicketStats:', error);
            return {
                total: 0,
                pendientes: 0,
                en_proceso: 0,
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
     * Obtiene tickets por colaborador
     */
    async getTicketsByColaborador(colaboradorId) {
        try {
            return await this.repository.getTicketsByColaborador(colaboradorId);
        } catch (error) {
            console.error('❌ Error en getTicketsByColaborador:', error);
            return [];
        }
    }

    /**
     * Obtiene tickets por cliente
     */
    async getTicketsByCliente(clienteId) {
        try {
            return await this.repository.getTicketsByCliente(clienteId);
        } catch (error) {
            console.error('❌ Error en getTicketsByCliente:', error);
            return [];
        }
    }

    /**
     * Obtiene el nombre de un colaborador
     */
    async getColaboradorNombre(colaboradorId) {
        return await this.repository.getColaboradorNombre(colaboradorId);
    }

    /**
     * Obtiene el nombre de un cliente
     */
    async getClienteNombre(clienteId) {
        return await this.repository.getClienteNombre(clienteId);
    }

    /**
     * Envía notificaciones a colaboradores asignados
     */
    async enviarNotificacionesAsignacion(colaboradoresIds, idTicket, titulo, prioridad, tipo) {
        try {
            console.log(`📤 Enviando notificaciones a ${colaboradoresIds.length} colaboradores`);

            const tokens = await this.obtenerTokensFCM(colaboradoresIds);

            if (!tokens || tokens.length === 0) {
                console.log('⚠️ No hay tokens FCM disponibles para notificar');
                return;
            }

            const prioridadLabel = {
                'alta': '🔴 Alta',
                'media': '🟡 Media',
                'baja': '🟢 Baja'
            }[prioridad] || prioridad;

            const tituloNotificacion = tipo === 'operativo' 
                ? '🎫 Nuevo Ticket Operativo' 
                : '📋 Nuevo Ticket Administración';

            const mensaje = `[${prioridadLabel}] ${titulo} - Ticket: ${idTicket}`;

            const data = {
                ticketId: idTicket,
                tipo: tipo || 'operativo',
                prioridad: prioridad || 'media',
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            };

            const response = await fetch(NOTIFICACIONES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokens: tokens,
                    titulo: tituloNotificacion,
                    mensaje: mensaje,
                    data: data
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('📬 Respuesta de notificaciones:', result);

            if (result.success) {
                console.log(`✅ Notificaciones enviadas: ${result.successCount} exitosas`);
            } else {
                console.warn('⚠️ Problemas con notificaciones:', result.error);
            }

        } catch (error) {
            console.error('❌ Error enviando notificaciones:', error);
        }
    }

    /**
     * Obtiene tokens FCM usando el repositorio de partners
     */
    async obtenerTokensFCM(colaboradoresIds) {
        try {
            const tokens = [];

            for (const colaboradorId of colaboradoresIds) {
                try {
                    const colaborador = await this.partnerRepository.getCollaboratorById(colaboradorId);
                    
                    if (!colaborador) continue;
                    
                    const email = colaborador.emailEmpresarial || colaborador.email;
                    if (!email) continue;

                    const estado = await this.partnerRepository.getUserNotificationStatus(colaborador.uid);
                    
                    if (estado && estado.fcmToken && estado.notificationsEnabled !== false) {
                        tokens.push(estado.fcmToken);
                    }

                } catch (error) {
                    console.error(`Error procesando colaborador ${colaboradorId}:`, error);
                }
            }

            console.log(`✅ ${tokens.length} tokens FCM obtenidos`);
            return tokens;

        } catch (error) {
            console.error('❌ Error obteniendo tokens FCM:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los clientes usando el repositorio de clientes
     */
    async getClientesForSelect() {
        try {
            const clientes = await this.clienteRepository.getAllClientes();
            return clientes.map(cliente => ({
                id: cliente.id,
                nombre: cliente.Nombre || cliente.razonSocial || cliente.nombreComercial || 'Sin nombre',
                rfc: cliente.RFC || cliente.rfc || '',
                direccion: cliente.DireccionCompleta || cliente.direccionFiscal || '',
                correo: cliente.Email || cliente.email || '',
                contacto: cliente.Nombre || cliente.razonSocial || ''
            }));
        } catch (error) {
            console.error('❌ Error obteniendo clientes:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los colaboradores usando el repositorio de partners
     */
    async getColaboradoresForSelect() {
        try {
            const colaboradores = await this.partnerRepository.getAllCollaborators(true);
            
            return colaboradores.map(col => {
                return {
                    id: col.id,
                    nombre: col.nombreCompleto || col.nombre || col.displayName || 'Sin nombre',
                    area: col.areaNombre || col.area || '',
                    email: col.emailEmpresarial || col.email || '',
                    fotoPerfil: col.fotoPerfil || col.photoURL || null,
                    uid: col.uid || ''
                };
            });
        } catch (error) {
            console.error('❌ Error obteniendo colaboradores:', error);
            return [];
        }
    }

    /**
     * Limpia la caché
     */
    clearCache() {
        this.repository.clearCache();
        this.partnerRepository.clearCache();
        this.clienteRepository.clearCache();
    }
}

export default TicketService;