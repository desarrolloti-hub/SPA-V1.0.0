/* ========================================
   TICKET SERVICE
   Lógica de negocio para gestión de tickets
   ======================================== */

import TicketRepository from '../repositories/ticketRepository.js';
import TicketModel from '../models/ticketModel.js';
import ClienteRepository from '../repositories/clienteRepository.js';
import PartnerRepository from '../repositories/partnerRepository.js';
import StorageService from './storageService.js';
import GeoMapHelper from '../utils/geoMapHelper.js';
import TicketWatermarkHelper from '../utils/ticketWatermark.js';
import { generarPDFReporteFotograficoTicket } from '../utils/ticketPdfGenerator.js';

// URL de la Cloud Function para notificaciones y correos
const NOTIFICACIONES_API_URL = "https://us-central1-rsienterprise.cloudfunctions.net/enviarNotificacion";
const TICKET_EMAIL_API_URL = "https://us-central1-rsienterprise.cloudfunctions.net/enviarTicketEmail";

export class TicketService {
    
    constructor() {
        this.repository = new TicketRepository();
        this.clienteRepository = new ClienteRepository();
        this.partnerRepository = new PartnerRepository();
        this.storageService = new StorageService();
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
     * Obtiene un ticket por ID (soporta docId de Firestore o idTicket de negocio)
     */
    async getTicketById(ticketId, forceRefresh = false) {
        try {
            if (!ticketId) return null;
            let ticket = await this.repository.getTicketById(ticketId, forceRefresh);
            if (!ticket) {
                // Fallback de conveniencia: buscar por idTicket (ej. Ticket-RSI-1234567890)
                ticket = await this.repository.getTicketByIdTicket(ticketId);
            }
            return ticket;
        } catch (error) {
            console.error('❌ Error en getTicketById:', error);
            return null;
        }
    }

    /**
     * Verifica si el usuario actual tiene permisos para acceder a un ticket
     * @param {Object} user - Objeto de sesión del usuario (uid, rol, etc.)
     * @param {Object} ticket - Objeto de datos del ticket
     * @returns {boolean}
     */
    canUserAccessTicket(user, ticket) {
        if (!user || (!user.uid && !user.id) || !ticket) return false;

        // Todos los colaboradores autenticados tienen acceso para visualizar cualquier ticket
        return true;
    }

    /**
     * Verifica si el usuario puede asignar colaboradores a tickets
     * @param {Object} user - Objeto de sesión del usuario
     * @returns {boolean}
     */
    canUserAssignTicket(user) {
        if (!user || !user.uid) return false;
        return user.rol === 'admin' || user.rol === 'administrador' || user.rol === 'partner';
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

            // ✅ Enviar notificaciones a colaboradores asignados
            if (data.colaboradoresIds && data.colaboradoresIds.length > 0) {
                await this.enviarNotificacionesAsignacion(
                    data.colaboradoresIds,
                    idTicket,
                    data.titulo,
                    data.prioridad || 'media',
                    tipo,
                    {
                        descripcion: data.descripcion,
                        clienteNombre: data.clienteNombre,
                        area: data.area
                    }
                );
                await this.repository.marcarNotificacionesEnviadas(result.docId, data.colaboradoresIds);
            }

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

            // ✅ Detectar cambios específicos
            const cambios = await this._detectarCambios(ticketActual, data);
            const hasChanges = Object.keys(cambios).length > 0;

            // Si no hay cambios, no hacer nada
            if (!hasChanges) {
                return {
                    success: true,
                    message: 'No se detectaron cambios en el ticket'
                };
            }

            // ✅ Preparar datos de actualización - CORREGIDO
            const updateData = {
                titulo: data.titulo?.trim() || ticketActual.titulo,
                descripcion: data.descripcion?.trim() || ticketActual.descripcion,
                prioridad: data.prioridad || ticketActual.prioridad,
                estado: data.estado || ticketActual.estado,
                // ✅ CORREGIDO: Permitir array vacío
                colaboradoresIds: data.colaboradoresIds !== undefined ? data.colaboradoresIds : ticketActual.colaboradoresIds,
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

            console.log('📝 Actualizando ticket con:', updateData);

            await this.repository.updateTicket(ticketId, updateData);

            // ✅ Crear descripción detallada de los cambios
            const descripcionCambios = this._formatearCambios(cambios);
            
            // ✅ Agregar evento de edición al historial con detalles
            await this.repository.addHistorialEvent(
                ticketId,
                'edicion',
                nombre,
                uid,
                `Ticket editado por ${nombre}. Cambios: ${descripcionCambios}`
            );

            // Verificar si cambiaron los colaboradores
            const colaboradoresAnteriores = ticketActual.colaboradoresIds || [];
            const nuevosColaboradores = data.colaboradoresIds || [];
            
            // ✅ Colaboradores que se agregaron
            const colaboradoresAgregados = nuevosColaboradores.filter(
                id => !colaboradoresAnteriores.includes(id)
            );

            // ✅ Colaboradores que se eliminaron
            const colaboradoresEliminados = colaboradoresAnteriores.filter(
                id => !nuevosColaboradores.includes(id)
            );

            console.log('📊 Cambios en colaboradores:', {
                agregados: colaboradoresAgregados,
                eliminados: colaboradoresEliminados
            });

            // Enviar notificaciones solo a los nuevos colaboradores
            if (colaboradoresAgregados.length > 0) {
                await this.enviarNotificacionesAsignacion(
                    colaboradoresAgregados,
                    ticketActual.idTicket,
                    data.titulo || ticketActual.titulo,
                    data.prioridad || ticketActual.prioridad,
                    ticketActual.tipo,
                    {
                        descripcion: data.descripcion || ticketActual.descripcion,
                        clienteNombre: data.clienteNombre || ticketActual.clienteNombre,
                        area: data.area || ticketActual.area
                    }
                );
                await this.repository.marcarNotificacionesEnviadas(ticketId, data.colaboradoresIds);
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
 * ✅ Detecta los cambios entre el ticket original y los nuevos datos
 */
async _detectarCambios(ticketActual, data) {
    const cambios = {};
    
    // Campos a comparar
    const campos = [
        'titulo', 'descripcion', 'prioridad', 'estado', 
        'area', 'fechaInicio', 'fechaFin', 'responsableNombre'
    ];
    
    if (ticketActual.tipo === 'operativo') {
        campos.push('clienteId', 'clienteNombre', 'rfc', 'atencionA', 'correo', 'ordenServicio', 'proyecto', 'servicio');
    } else {
        campos.push('fechaFinalizacionEstimada');
    }
    
    // ✅ Comparar campos normales
    campos.forEach(campo => {
        const valorOriginal = ticketActual[campo] || '';
        const valorNuevo = data[campo] || '';
        
        if (String(valorOriginal).trim() !== String(valorNuevo).trim()) {
            cambios[campo] = {
                original: valorOriginal,
                nuevo: valorNuevo
            };
        }
    });
    
    // ✅ Comparar sistemas (array)
    const sistemasOriginal = ticketActual.sistemas || [];
    const sistemasNuevo = data.sistemas || [];
    if (JSON.stringify(sistemasOriginal) !== JSON.stringify(sistemasNuevo)) {
        cambios.sistemas = {
            original: sistemasOriginal.join(', '),
            nuevo: sistemasNuevo.join(', ')
        };
    }
    
    // ✅ Comparar colaboradores (array) - CORREGIDO
    const colabOriginal = ticketActual.colaboradoresIds || [];
    const colabNuevo = data.colaboradoresIds || [];
    
    // Verificar si hay cambios
    const colabOriginalStr = JSON.stringify(colabOriginal);
    const colabNuevoStr = JSON.stringify(colabNuevo);
    
    if (colabOriginalStr !== colabNuevoStr) {
        // Obtener nombres de los colaboradores
        const nombresOriginal = await this._getNombresColaboradores(colabOriginal);
        const nombresNuevo = await this._getNombresColaboradores(colabNuevo);
        
        // ✅ Detectar colaboradores agregados y eliminados
        const agregados = colabNuevo.filter(id => !colabOriginal.includes(id));
        const eliminados = colabOriginal.filter(id => !colabNuevo.includes(id));
        
        let descripcionCambio = '';
        if (agregados.length > 0 && eliminados.length > 0) {
            const nombresAgregados = await this._getNombresColaboradores(agregados);
            const nombresEliminados = await this._getNombresColaboradores(eliminados);
            descripcionCambio = `Se agregaron: ${nombresAgregados.join(', ')}; Se eliminaron: ${nombresEliminados.join(', ')}`;
        } else if (agregados.length > 0) {
            const nombresAgregados = await this._getNombresColaboradores(agregados);
            descripcionCambio = `Se agregaron: ${nombresAgregados.join(', ')}`;
        } else if (eliminados.length > 0) {
            const nombresEliminados = await this._getNombresColaboradores(eliminados);
            descripcionCambio = `Se eliminaron: ${nombresEliminados.join(', ')}`;
        }
        
        cambios.colaboradoresIds = {
            original: nombresOriginal.join(', '),
            nuevo: nombresNuevo.join(', '),
            descripcion: descripcionCambio,
            // Guardar IDs para referencia
            _originalIds: colabOriginal,
            _nuevoIds: colabNuevo
        };
    }
    
    return cambios;
}

/**
 * ✅ Obtiene los nombres de los colaboradores a partir de sus UIDs
 */
async _getNombresColaboradores(colaboradoresIds) {
    if (!colaboradoresIds || colaboradoresIds.length === 0) {
        return [];
    }
    
    const nombres = [];
    for (const id of colaboradoresIds) {
        try {
            // Buscar colaborador por UID
            const colaborador = await this.partnerRepository.getCollaboratorByUid(id);
            if (colaborador) {
                nombres.push(colaborador.nombreCompleto || colaborador.nombre || id);
            } else {
                // Si no se encuentra, mostrar el ID
                nombres.push(`ID: ${id}`);
            }
        } catch (error) {
            console.error(`❌ Error obteniendo nombre para ${id}:`, error);
            nombres.push(`ID: ${id}`);
        }
    }
    return nombres;
}

    /**
     * ✅ Formatea los cambios en un string legible
     */
    _formatearCambios(cambios) {
        const labels = {
            'titulo': 'Título',
            'descripcion': 'Descripción',
            'prioridad': 'Prioridad',
            'estado': 'Estado',
            'area': 'Área',
            'fechaInicio': 'Fecha de inicio',
            'fechaFin': 'Fecha de fin',
            'responsableNombre': 'Responsable',
            'clienteId': 'Cliente',
            'clienteNombre': 'Nombre del cliente',
            'rfc': 'RFC',
            'atencionA': 'Atención a',
            'correo': 'Correo',
            'ordenServicio': 'Orden de servicio',
            'proyecto': 'Proyecto',
            'servicio': 'Servicio',
            'fechaFinalizacionEstimada': 'Fecha estimada de finalización',
            'sistemas': 'Sistemas',
            'colaboradoresIds': 'Colaboradores asignados'
        };
        
        const items = Object.entries(cambios).map(([campo, cambio]) => {
            const label = labels[campo] || campo;
            
            // ✅ Si es colaboradoresIds, usar la descripción detallada si existe
            if (campo === 'colaboradoresIds' && cambio.descripcion) {
                return `${label}: ${cambio.descripcion}`;
            }
            
            // Para otros campos
            const original = cambio.original || '';
            const nuevo = cambio.nuevo || '';
            return `${label}: "${original}" → "${nuevo}"`;
        });
        
        return items.join('; ');
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
     * Obtiene exclusivamente los tickets propios asignados al colaborador mediante consulta indexada
     * @param {string|Object} colaboradorOrId - UID/ID del colaborador u objeto de sesión/usuario
     * @param {boolean} forceRefresh - Si debe invalidar caché antes de consultar
     */
    async getTicketsByColaborador(colaboradorOrId, forceRefresh = false) {
        try {
            const candidateIds = new Set();

            if (typeof colaboradorOrId === 'string' && colaboradorOrId.trim()) {
                candidateIds.add(colaboradorOrId.trim());
            } else if (colaboradorOrId && typeof colaboradorOrId === 'object') {
                if (colaboradorOrId.uid) candidateIds.add(String(colaboradorOrId.uid).trim());
                if (colaboradorOrId.id) candidateIds.add(String(colaboradorOrId.id).trim());
                if (colaboradorOrId.docId) candidateIds.add(String(colaboradorOrId.docId).trim());
            }

            // Complementar con la sesión activa si corresponde al mismo usuario
            try {
                const rawSession = localStorage.getItem('rsi_session');
                if (rawSession) {
                    const sessionData = JSON.parse(rawSession);
                    if (sessionData && (candidateIds.size === 0 || candidateIds.has(sessionData.uid) || candidateIds.has(sessionData.id))) {
                        if (sessionData.uid) candidateIds.add(String(sessionData.uid).trim());
                        if (sessionData.id) candidateIds.add(String(sessionData.id).trim());
                    }
                }
            } catch {
                // Ignorar error de lectura de localStorage
            }

            const idsArray = Array.from(candidateIds).filter(Boolean);
            if (idsArray.length === 0) {
                return [];
            }

            return await this.repository.getTicketsByColaborador(idsArray, forceRefresh);
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
     * Envía notificaciones por correo electrónico a colaboradores asignados
     */
    async enviarEmailsAsignacion(colaboradoresIds, ticketData) {
        try {
            if (!colaboradoresIds || colaboradoresIds.length === 0) return;

            const ticketId = ticketData.idTicket || ticketData.id;
            const baseUrl = 'https://rsienterprise.com';
            const ticketUrl = `${baseUrl}/partner/ticketAtencion?id=${ticketId}`;

            for (const colaboradorId of colaboradoresIds) {
                try {
                    const colaborador = await this.partnerRepository.getCollaboratorByUid(colaboradorId);
                    if (!colaborador) continue;

                    const email = colaborador.emailEmpresarial || colaborador.email;
                    if (!email) {
                        console.warn(`⚠️ Colaborador ${colaborador.nombreCompleto || colaboradorId} no tiene email registrado`);
                        continue;
                    }

                    const colaboradorNombre = colaborador.nombreCompleto || colaborador.nombre || 'Colaborador';

                    console.log(`📧 Enviando email de asignación de ticket a ${email} (${colaboradorNombre})`);

                    const response = await fetch(TICKET_EMAIL_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email,
                            colaboradorNombre,
                            ticketData: {
                                idTicket: ticketData.idTicket,
                                titulo: ticketData.titulo,
                                prioridad: ticketData.prioridad,
                                tipo: ticketData.tipo,
                                descripcion: ticketData.descripcion,
                                clienteNombre: ticketData.clienteNombre,
                                area: ticketData.area,
                                fechaCreacion: ticketData.fechaCreacion || new Date().toISOString()
                            },
                            ticketUrl
                        })
                    });

                    if (response.ok) {
                        const resJson = await response.json();
                        console.log(`✅ Correo de ticket enviado a ${email}:`, resJson.messageId || 'OK');
                    } else {
                        const errText = await response.text();
                        console.warn(`⚠️ Error en respuesta de email para ${email}:`, errText);
                    }

                } catch (colabError) {
                    console.error(`❌ Error enviando email a colaborador ${colaboradorId}:`, colabError);
                }
            }

        } catch (error) {
            console.error('❌ Error general enviando emails de asignación:', error);
        }
    }

    /**
     * Envía notificaciones push (FCM) y email a colaboradores asignados
     */
    async enviarNotificacionesAsignacion(colaboradoresIds, idTicket, titulo, prioridad, tipo, extraData = {}) {
        try {
            if (!colaboradoresIds || colaboradoresIds.length === 0) return;
            console.log(`📤 Enviando notificaciones (Push + Email) a ${colaboradoresIds.length} colaboradores`);

            const prioridadLabel = {
                'alta': 'Alta',
                'media': 'Media',
                'baja': 'Baja'
            }[prioridad] || prioridad;

            // 1. Notificación Push (FCM)
            try {
                const tokens = await this.obtenerTokensFCM(colaboradoresIds);

                if (tokens && tokens.length > 0) {
                    const tituloNotificacion = `Nuevo ticket asignado: ${idTicket}`;
                    const mensaje = `[${prioridadLabel}] ${titulo}`;

                    // Datos necesarios para abrir el ticket específico
                    const ticketUrl = `https://rsienterprise.com/partner/ticketAtencion?id=${idTicket}`;

                    const data = {
                        ticketId: idTicket,
                        url: ticketUrl,
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
                        console.warn(`⚠️ HTTP ${response.status} en push FCM: ${errorText}`);
                    } else {
                        const result = await response.json();
                        console.log('📬 Respuesta de push FCM:', result);
                    }
                } else {
                    console.log('ℹ️ No hay tokens FCM disponibles para notificar');
                }
            } catch (pushError) {
                console.error('❌ Error enviando notificación push:', pushError);
            }

            // 2. Notificación por Correo Electrónico
            try {
                await this.enviarEmailsAsignacion(colaboradoresIds, {
                    idTicket,
                    titulo,
                    prioridad,
                    tipo,
                    ...extraData
                });
            } catch (emailError) {
                console.error('❌ Error enviando correos de asignación:', emailError);
            }

        } catch (error) {
            console.error('❌ Error general en enviarNotificacionesAsignacion:', error);
        }
    }

    /**
     * Obtiene tokens FCM (soporta multi-device y token legacy) usando el repositorio de partners
     */
    async obtenerTokensFCM(colaboradoresIds) {
        try {
            const tokens = [];

            for (const colaboradorId of colaboradoresIds) {
                try {
                    // Buscar colaborador por UID
                    const colaborador = await this.partnerRepository.getCollaboratorByUid(colaboradorId);
                    
                    if (!colaborador) {
                        console.warn(`⚠️ Colaborador no encontrado: ${colaboradorId}`);
                        continue;
                    }
                    
                    // Verificar estado de notificaciones
                    const estado = await this.partnerRepository.getUserNotificationStatus(colaboradorId);
                    
                    if (estado && estado.notificationsEnabled !== false) {
                        // Multi-device tokens
                        if (Array.isArray(estado.fcmTokens) && estado.fcmTokens.length > 0) {
                            estado.fcmTokens.forEach(t => {
                                if (t && !tokens.includes(t)) {
                                    tokens.push(t);
                                }
                            });
                            console.log(`✅ ${estado.fcmTokens.length} tokens multi-device para ${colaborador.nombreCompleto || colaboradorId}`);
                        } else if (estado.fcmToken) {
                            if (!tokens.includes(estado.fcmToken)) {
                                tokens.push(estado.fcmToken);
                            }
                            console.log(`✅ Token legacy para ${colaborador.nombreCompleto || colaboradorId}`);
                        }
                    } else {
                        console.log(`⚠️ Sin token o notificaciones desactivadas para ${colaboradorId}`);
                    }

                } catch (error) {
                    console.error(`❌ Error procesando colaborador ${colaboradorId}:`, error);
                }
            }

            console.log(`✅ ${tokens.length} tokens FCM obtenidos de ${colaboradoresIds.length} colaboradores`);
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
            // Obtener todos los colaboradores activos de usersRSI
            const colaboradores = await this.partnerRepository.getAll([], 'createdAt', 'desc', true);
            
            return colaboradores
                .filter(col => col.status !== 'inactive')
                .map(col => {
                return {
                    // ✅ Usar UID como ID principal
                    id: col.uid || col.id,  // Priorizar uid
                    uid: col.uid || '',
                    docId: col.id,  // Guardar docId por si se necesita
                    nombre: col.nombreCompleto || col.nombre || col.displayName || 'Sin nombre',
                    area: col.areaNombre || col.area || '',
                    email: col.emailEmpresarial || col.email || '',
                    fotoPerfil: col.fotoPerfil || col.foto || col.photoURL || col.imagenBase64 || null
                };
            });
        } catch (error) {
            console.error('❌ Error obteniendo colaboradores:', error);
            return [];
        }
    }

    /**
     * 🔍 Método de depuración para verificar el estado de las notificaciones
     */
    async debugNotificationStatus(ticketId) {
        try {
            console.log('🔍 ===== DEBUG DE NOTIFICACIONES =====');
            
            // 1. Obtener el ticket
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                console.error('❌ Ticket no encontrado');
                return;
            }
            
            console.log(`📋 Ticket: ${ticket.idTicket}`);
            console.log(`👥 Colaboradores IDs:`, ticket.colaboradoresIds);
            
            // 2. Verificar cada colaborador
            for (const colId of ticket.colaboradoresIds || []) {
                console.log(`\n👤 Colaborador: ${colId}`);
                
                // Buscar por UID
                const col = await this.partnerRepository.getCollaboratorByUid(colId);
                if (!col) {
                    console.log(`  ❌ No encontrado en Firestore`);
                    continue;
                }
                
                console.log(`  ✅ Nombre: ${col.nombreCompleto}`);
                console.log(`  📧 Email: ${col.emailEmpresarial}`);
                
                // Verificar estado de notificaciones
                const estado = await this.partnerRepository.getUserNotificationStatus(colId);
                console.log(`  📱 Estado:`, {
                    fcmToken: estado?.fcmToken ? `${estado.fcmToken.substring(0, 30)}...` : '❌ No tiene',
                    notificationsEnabled: estado?.notificationsEnabled,
                    fcmPlatform: estado?.fcmPlatform,
                    fcmTokenUpdatedAt: estado?.fcmTokenUpdatedAt
                });
                
                // 3. Intentar enviar una notificación de prueba
                if (estado?.fcmToken && estado.notificationsEnabled) {
                    console.log(`  📤 Enviando notificación de prueba...`);
                    try {
                        const response = await fetch(NOTIFICACIONES_API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tokens: [estado.fcmToken],
                                titulo: 'Prueba de Notificación',
                                mensaje: `Esta es una prueba para ${col.nombreCompleto}`,
                                data: { ticketId: ticket.idTicket, url: `https://rsienterprise.com/partner/ticketAtencion?id=${ticket.idTicket}`, test: 'true' }
                            })
                        });
                        
                        const result = await response.json();
                        console.log(`  📬 Respuesta:`, result);
                    } catch (error) {
                        console.error(`  ❌ Error enviando prueba:`, error.message);
                    }
                }
            }
            
            console.log('🔍 ===== FIN DEBUG =====');
        } catch (error) {
            console.error('❌ Error en debug:', error);
        }
    }

    /**
     * Resuelve el contexto completo del colaborador autenticado actual
     */
    async _resolveCurrentCollaboratorContext() {
        try {
            const sessionRaw = localStorage.getItem('rsi_session');
            const session = sessionRaw ? JSON.parse(sessionRaw) : {};
            const uid = session.uid || null;
            let collaboratorId = session.collaboratorId || session.id || session.docId || null;
            let nombre = session.nombreCompleto || session.displayName || session.email || 'Colaborador';
            let puesto = session.puesto || session.cargo || '';
            let rol = (session.role || session.rol || 'partner').toLowerCase();

            if (uid || collaboratorId) {
                let colDoc = null;
                if (collaboratorId && typeof this.partnerRepository.getCollaboratorById === 'function') {
                    colDoc = await this.partnerRepository.getCollaboratorById(collaboratorId);
                }
                if (!colDoc && uid && typeof this.partnerRepository.getCollaboratorByUid === 'function') {
                    colDoc = await this.partnerRepository.getCollaboratorByUid(uid);
                }
                if (colDoc) {
                    collaboratorId = colDoc.id || collaboratorId;
                    nombre = colDoc.nombreCompleto || colDoc.nombre || `${colDoc.nombres || ''} ${colDoc.apellidos || ''}`.trim() || nombre;
                    puesto = colDoc.puestoNombre || colDoc.puesto || colDoc.areaNombre || colDoc.area || puesto;
                }
            }

            return {
                uid,
                collaboratorId: collaboratorId || uid,
                userIds: [...new Set([collaboratorId, uid].filter(Boolean))],
                nombre,
                puesto,
                rol
            };
        } catch (error) {
            console.error('Error resolviendo contexto de colaborador:', error);
            const uid = this._getCurrentUserUid();
            return {
                uid,
                collaboratorId: uid,
                userIds: uid ? [uid] : [],
                nombre: this._getCurrentUserName(),
                puesto: '',
                rol: 'partner'
            };
        }
    }

    /**
     * Obtiene un ticket enriquecido con detalles de colaboradores asignados,
     * aceptaciones normalizadas, evidencias (antes, durante, despues) e historial unificado.
     */
    async getTicketConDetalles(ticketId, forceRefresh = true) {
        try {
            const ticket = await this.getTicketById(ticketId, forceRefresh);
            if (!ticket) return null;

            const allColabs = await this.getColaboradoresForSelect();
            const colabsByKey = {};
            allColabs.forEach(c => {
                if (c.id) colabsByKey[c.id] = c;
                if (c.uid) colabsByKey[c.uid] = c;
                if (c.docId) colabsByKey[c.docId] = c;
            });

            const colaboradoresIds = Array.isArray(ticket.colaboradoresIds) ? ticket.colaboradoresIds : [];
            for (const colId of colaboradoresIds) {
                if (!colabsByKey[colId]) {
                    try {
                        const directCol = await this.partnerRepository.getCollaboratorByUid(colId);
                        if (directCol) {
                            const mapped = {
                                id: directCol.uid || directCol.id,
                                uid: directCol.uid || '',
                                docId: directCol.id,
                                nombre: directCol.nombreCompleto || directCol.nombre || 'Colaborador',
                                area: directCol.areaNombre || directCol.area || '',
                                email: directCol.emailEmpresarial || directCol.email || '',
                                fotoPerfil: directCol.fotoPerfil || directCol.foto || directCol.photoURL || directCol.imagenBase64 || null
                            };
                            colabsByKey[colId] = mapped;
                            if (mapped.id) colabsByKey[mapped.id] = mapped;
                            if (mapped.uid) colabsByKey[mapped.uid] = mapped;
                            if (mapped.docId) colabsByKey[mapped.docId] = mapped;
                        }
                    } catch (e) {
                        console.warn('⚠️ No se pudo obtener colaborador por UID en ticketService:', colId);
                    }
                }
            }
            const colaboradores = colaboradoresIds.map((id, idx) => {
                const found = colabsByKey[id];
                return {
                    id: found?.id || id,
                    uid: found?.uid || id,
                    collaboratorId: found?.docId || id,
                    nombreCompleto: found?.nombre || (idx === 0 && ticket.responsableNombre ? ticket.responsableNombre : `Colaborador (${id.substring(0, 6)})`),
                    puestoNombre: found?.area || '',
                    fotoPerfil: found?.fotoPerfil || null,
                    esResponsable: idx === 0
                };
            });

            const aceptaciones = TicketModel.normalizeAceptaciones(ticket);
            const evidencias = TicketModel.normalizeEvidencias(ticket);

            // Unificar historial (mapa de eventos de TicketRepository) e historialCambios (arreglo detallado)
            const historialMap = ticket.historial || {};
            const fromMap = Object.entries(historialMap).map(([ts, ev]) => ({
                fechaCambio: ev.timestamp || ts,
                cambiadoPor: ev.usuario || 'Sistema',
                cambiadoPorId: ev.usuarioId || '',
                tipoEvento: ev.evento || 'evento',
                motivo: ev.descripcion || ev.evento || '',
                ubicacion: ev.ubicacion || null
            }));

            const fromArray = Array.isArray(ticket.historialCambios) ? ticket.historialCambios : [];
            const seenKeys = new Set();
            const unifiedHistorial = [];

            [...fromArray, ...fromMap].forEach(item => {
                const key = `${item.fechaCambio || ''}_${item.tipoEvento || ''}_${item.cambiadoPor || ''}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    unifiedHistorial.push(item);
                }
            });

            const isOperativo = ticket.tipo === 'operativo' || ticket.tipoTicket === 'operacion';

            return {
                ...ticket,
                tipoTicket: isOperativo ? 'operacion' : 'solicitud',
                motivoLabel: ticket.titulo || ticket.servicio || ticket.proyecto || 'Servicio / Atención',
                fechaProgramada: ticket.fechaInicio || ticket.fechaFinalizacionEstimada || null,
                areaNombre: ticket.area || 'General',
                cliente: isOperativo ? {
                    nombreEmpresa: ticket.clienteNombre || 'Cliente General',
                    nombreResponsable: ticket.atencionA || '',
                    telefonoContacto: ticket.correo || '',
                    coordenadas: ticket.direccionFiscal || ticket.coordenadas || ''
                } : null,
                colaboradores,
                aceptaciones,
                evidencias,
                comentarios: Array.isArray(ticket.comentarios) ? ticket.comentarios : [],
                historialCambios: unifiedHistorial
            };
        } catch (error) {
            console.error('❌ Error en getTicketConDetalles:', error);
            return null;
        }
    }

    /**
     * Registra la aceptación del ticket por parte del colaborador actual,
     * capturando geolocalización y pasando el ticket a "en_proceso" si estaba "pendiente".
     */
    async aceptarTicket(ticketId, { comentario = '', ubicacion = null } = {}) {
        try {
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            if (ticket.estado === 'finalizado' || ticket.estado === 'cancelado') {
                return { success: false, error: `No se puede aceptar un ticket en estado ${ticket.estado}` };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            if (!collabCtx.uid && !collabCtx.collaboratorId) {
                return { success: false, error: 'No se encontró una sesión activa de colaborador' };
            }

            const geo = ubicacion || await GeoMapHelper.obtenerPosicionActual();
            const ubicacionData = {
                latitud: geo.latitud ?? null,
                longitud: geo.longitud ?? null,
                precision: geo.precision ?? null,
                timestamp: geo.timestamp || new Date().toISOString(),
                estadoCaptura: geo.estadoCaptura || (geo.exito ? 'capturada' : 'no_disponible'),
                metodo: geo.metodo || 'Automático'
            };

            const now = new Date().toISOString();
            const aceptaciones = TicketModel.normalizeAceptaciones(ticket);

            const existingIndex = aceptaciones.findIndex(a =>
                collabCtx.userIds.includes(a.colaboradorId) ||
                (a.uid && collabCtx.userIds.includes(a.uid))
            );

            const registroAceptacion = {
                id: existingIndex >= 0 ? aceptaciones[existingIndex].id : `acc_${Date.now()}`,
                colaboradorId: collabCtx.collaboratorId,
                uid: collabCtx.uid,
                nombre: collabCtx.nombre,
                puesto: collabCtx.puesto || '',
                fechaAceptacion: now,
                comentario: comentario ? comentario.trim() : '',
                ubicacion: ubicacionData
            };

            if (existingIndex >= 0) {
                aceptaciones[existingIndex] = registroAceptacion;
            } else {
                aceptaciones.push(registroAceptacion);
            }

            const estadoAnterior = ticket.estado || 'pendiente';
            const estadoNuevo = estadoAnterior === 'pendiente' ? 'en_proceso' : estadoAnterior;
            const motivoTexto = comentario
                ? `Ticket aceptado por ${collabCtx.nombre}: ${comentario.trim()}`
                : `Ticket aceptado por ${collabCtx.nombre}`;

            const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
            historialCambios.push({
                estadoAnterior,
                estadoNuevo,
                tipoEvento: 'aceptacion',
                cambiadoPor: collabCtx.nombre,
                cambiadoPorId: collabCtx.collaboratorId || collabCtx.uid,
                fechaCambio: now,
                motivo: motivoTexto,
                ubicacion: ubicacionData
            });

            const updatePayload = {
                aceptaciones,
                estado: estadoNuevo,
                historialCambios,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            };

            if (estadoNuevo === 'en_proceso' && !ticket.fechaInicio) {
                updatePayload.fechaInicio = now;
            }

            await this.repository.updateTicket(ticket.id, updatePayload);
            await this.repository.addHistorialEvent(
                ticket.id,
                'aceptacion',
                collabCtx.nombre,
                collabCtx.uid || collabCtx.collaboratorId,
                motivoTexto
            );
            this.repository.clearCache();

            return {
                success: true,
                aceptacion: registroAceptacion,
                estadoNuevo,
                message: 'Ticket aceptado exitosamente'
            };
        } catch (error) {
            console.error('❌ Error al aceptar ticket:', error);
            return { success: false, error: error.message || 'Error al aceptar el ticket' };
        }
    }

    /**
     * Verifica si el colaborador actual ya aceptó el ticket
     */
    _hasCollaboratorAcceptedTicket(ticket, collabCtx) {
        const aceptaciones = TicketModel.normalizeAceptaciones(ticket);
        if (!collabCtx || !Array.isArray(collabCtx.userIds) || collabCtx.userIds.length === 0) {
            return false;
        }
        return aceptaciones.some(a =>
            collabCtx.userIds.includes(a.colaboradorId) ||
            (a.uid && collabCtx.userIds.includes(a.uid))
        );
    }

    /**
     * Agrega un comentario a la bitácora del ticket
     */
    async agregarComentario(ticketId, texto) {
        try {
            if (!texto || !texto.trim()) {
                return { success: false, error: 'El comentario no puede estar vacío' };
            }

            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            if (!this._hasCollaboratorAcceptedTicket(ticket, collabCtx)) {
                return {
                    success: false,
                    error: 'Debes aceptar el ticket primero antes de poder agregar comentarios.'
                };
            }

            const now = new Date().toISOString();

            const nuevoComentario = {
                id: `com_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                autorId: collabCtx.collaboratorId,
                uid: collabCtx.uid,
                autorNombre: collabCtx.nombre,
                puesto: collabCtx.puesto || '',
                texto: texto.trim(),
                fecha: now
            };

            const comentarios = Array.isArray(ticket.comentarios) ? [...ticket.comentarios, nuevoComentario] : [nuevoComentario];
            const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
            const motivoTexto = `Comentario: ${texto.trim()}`;

            historialCambios.push({
                estadoAnterior: ticket.estado,
                estadoNuevo: ticket.estado,
                tipoEvento: 'comentario',
                cambiadoPor: collabCtx.nombre,
                cambiadoPorId: collabCtx.collaboratorId || collabCtx.uid,
                fechaCambio: now,
                motivo: motivoTexto
            });

            await this.repository.updateTicket(ticket.id, {
                comentarios,
                historialCambios,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            });
            await this.repository.addHistorialEvent(
                ticket.id,
                'edicion',
                collabCtx.nombre,
                collabCtx.uid || collabCtx.collaboratorId,
                motivoTexto
            );
            this.repository.clearCache();

            return {
                success: true,
                comentario: nuevoComentario,
                comentarios,
                message: 'Comentario agregado correctamente'
            };
        } catch (error) {
            console.error('❌ Error agregando comentario al ticket:', error);
            return { success: false, error: error.message || 'Error al guardar el comentario' };
        }
    }

    /**
     * Procesa una imagen con marca de agua institucional (logo, fecha, hora y GPS),
     * la sube a Firebase Storage y registra la evidencia en la etapa correspondiente (antes, durante, despues).
     */
    async subirEvidenciaTicket(ticketId, { fileOrBlob, watermarkedBlob = null, etapa, descripcion = '', ubicacion = null, fechaHora = null }) {
        try {
            const etapaKey = (etapa || '').toLowerCase().trim();
            if (!['antes', 'durante', 'despues'].includes(etapaKey)) {
                return { success: false, error: 'La etapa de evidencia debe ser "antes", "durante" o "despues"' };
            }

            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            if (!this._hasCollaboratorAcceptedTicket(ticket, collabCtx)) {
                return {
                    success: false,
                    error: 'Debes aceptar el ticket primero antes de poder subir evidencias fotográficas.'
                };
            }

            const geo = ubicacion || await GeoMapHelper.obtenerPosicionActual();

            let blobToUpload = watermarkedBlob;
            let finalFechaHora = fechaHora;
            let finalUbicacion = geo;

            if (!blobToUpload) {
                if (!fileOrBlob) {
                    return { success: false, error: 'No se proporcionó ninguna imagen para subir' };
                }
                const watermarkResult = await TicketWatermarkHelper.aplicarMarcaDeAgua({
                    source: fileOrBlob,
                    idTicket: ticket.idTicket || ticketId,
                    etapa: etapaKey,
                    colaboradorNombre: collabCtx.nombre,
                    ubicacion: geo
                });
                blobToUpload = watermarkResult.blob;
                finalFechaHora = watermarkResult.fechaHora;
                finalUbicacion = watermarkResult.ubicacion;
                if (watermarkResult.previewUrl) {
                    URL.revokeObjectURL(watermarkResult.previewUrl);
                }
            }

            const uploadResult = await this.storageService.uploadTicketEvidencia(
                blobToUpload,
                ticket.idTicket || ticketId,
                etapaKey
            );

            const now = new Date().toISOString();
            const nuevaEvidencia = {
                id: `ev_${etapaKey}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                etapa: etapaKey,
                url: uploadResult.url,
                path: uploadResult.path,
                descripcion: descripcion ? descripcion.trim() : '',
                subidoPorId: collabCtx.collaboratorId,
                subidoPorUid: collabCtx.uid,
                subidoPorNombre: collabCtx.nombre,
                fechaHora: finalFechaHora || now,
                fechaSubida: now,
                ubicacion: {
                    latitud: finalUbicacion?.latitud ?? null,
                    longitud: finalUbicacion?.longitud ?? null,
                    precision: finalUbicacion?.precision ?? null,
                    timestamp: finalUbicacion?.timestamp || now,
                    estadoCaptura: finalUbicacion?.estadoCaptura || (finalUbicacion?.latitud != null ? 'capturada' : 'no_disponible')
                }
            };

            const evidencias = TicketModel.normalizeEvidencias(ticket);
            evidencias[etapaKey].push(nuevaEvidencia);

            const etapaNombres = { antes: 'Antes', durante: 'Durante', despues: 'Después' };
            const motivoTexto = `Evidencia fotográfica subida (${etapaNombres[etapaKey]})${nuevaEvidencia.descripcion ? `: ${nuevaEvidencia.descripcion}` : ''}`;
            const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
            historialCambios.push({
                estadoAnterior: ticket.estado,
                estadoNuevo: ticket.estado,
                tipoEvento: 'evidencia',
                cambiadoPor: collabCtx.nombre,
                cambiadoPorId: collabCtx.collaboratorId || collabCtx.uid,
                fechaCambio: now,
                motivo: motivoTexto,
                ubicacion: nuevaEvidencia.ubicacion
            });

            await this.repository.updateTicket(ticket.id, {
                evidencias,
                historialCambios,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            });
            await this.repository.addHistorialEvent(
                ticket.id,
                'evidencia',
                collabCtx.nombre,
                collabCtx.uid || collabCtx.collaboratorId,
                motivoTexto
            );
            this.repository.clearCache();

            return {
                success: true,
                evidencia: nuevaEvidencia,
                evidencias,
                message: `Evidencia de "${etapaNombres[etapaKey]}" guardada correctamente`
            };
        } catch (error) {
            console.error('❌ Error subiendo evidencia del ticket:', error);
            return { success: false, error: error.message || 'Error al subir la evidencia fotográfica' };
        }
    }

    /**
     * Elimina una evidencia fotográfica de una etapa mientras el ticket sigue abierto
     */
    async eliminarEvidenciaTicket(ticketId, etapa, evidenciaId) {
        try {
            const etapaKey = (etapa || '').toLowerCase().trim();
            if (!['antes', 'durante', 'despues'].includes(etapaKey)) {
                return { success: false, error: 'Etapa inválida' };
            }

            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            if (ticket.estado === 'finalizado') {
                return { success: false, error: 'No se pueden eliminar evidencias de un ticket finalizado' };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            if (!this._hasCollaboratorAcceptedTicket(ticket, collabCtx)) {
                return {
                    success: false,
                    error: 'Debes aceptar el ticket primero antes de modificar evidencias.'
                };
            }

            const evidencias = TicketModel.normalizeEvidencias(ticket);
            const target = evidencias[etapaKey].find(item => item.id === evidenciaId);
            if (!target) {
                return { success: false, error: 'Evidencia no encontrada' };
            }

            if (target.path) {
                await this.storageService.deleteFile(target.path);
            }

            evidencias[etapaKey] = evidencias[etapaKey].filter(item => item.id !== evidenciaId);

            await this.repository.updateTicket(ticket.id, {
                evidencias,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            });
            this.repository.clearCache();

            return {
                success: true,
                evidencias,
                message: 'Evidencia eliminada correctamente'
            };
        } catch (error) {
            console.error('❌ Error eliminando evidencia:', error);
            return { success: false, error: error.message || 'Error al eliminar la evidencia' };
        }
    }

    /**
     * Guarda el avance de las actividades desarrolladas en el ticket (sin cerrarlo aún)
     */
    async guardarActividadesTicket(ticketId, actividadesDesarrolladas) {
        try {
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            if (!this._hasCollaboratorAcceptedTicket(ticket, collabCtx)) {
                return {
                    success: false,
                    error: 'Debes aceptar el ticket primero antes de registrar las actividades desarrolladas.'
                };
            }

            const texto = (actividadesDesarrolladas || '').trim();
            if (!texto) {
                return { success: false, error: 'Describa las actividades desarrolladas antes de guardar' };
            }

            const now = new Date().toISOString();
            const motivoTexto = `Actualización de actividades desarrolladas por ${collabCtx.nombre}`;

            const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
            historialCambios.push({
                estadoAnterior: ticket.estado,
                estadoNuevo: ticket.estado,
                tipoEvento: 'actividades',
                cambiadoPor: collabCtx.nombre,
                cambiadoPorId: collabCtx.collaboratorId || collabCtx.uid,
                fechaCambio: now,
                motivo: motivoTexto
            });

            await this.repository.updateTicket(ticket.id, {
                actividadesDesarrolladas: texto,
                ultimaActualizacionActividadesPor: collabCtx.nombre,
                ultimaActualizacionActividadesFecha: now,
                historialCambios,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            });
            await this.repository.addHistorialEvent(
                ticket.id,
                'edicion',
                collabCtx.nombre,
                collabCtx.uid || collabCtx.collaboratorId,
                motivoTexto
            );
            this.repository.clearCache();

            return {
                success: true,
                actividadesDesarrolladas: texto,
                message: 'Actividades desarrolladas guardadas correctamente'
            };
        } catch (error) {
            console.error('❌ Error guardando actividades del ticket:', error);
            return { success: false, error: error.message || 'Error al guardar las actividades desarrolladas' };
        }
    }

    /**
     * Valida que el ticket haya sido aceptado, cuente con evidencias de Antes, Durante y Después,
     * y tenga actividades desarrolladas registradas antes de cerrarlo (estado = finalizado).
     */
    async cerrarTicketConEvidencias(ticketId, { actividadesDesarrolladas, comentarioFinal = '', ubicacion = null } = {}) {
        try {
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            if (ticket.estado === 'finalizado') {
                return { success: false, error: 'El ticket ya se encuentra finalizado' };
            }

            const collabCtx = await this._resolveCurrentCollaboratorContext();
            const userIds = collabCtx.rol === 'admin' ? [] : collabCtx.userIds;

            const validation = TicketModel.validateForCierre(ticket, actividadesDesarrolladas, userIds);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    error: validation.errors.join(' ')
                };
            }

            const geo = ubicacion || await GeoMapHelper.obtenerPosicionActual();
            const ubicacionData = {
                latitud: geo.latitud ?? null,
                longitud: geo.longitud ?? null,
                precision: geo.precision ?? null,
                timestamp: geo.timestamp || new Date().toISOString(),
                estadoCaptura: geo.estadoCaptura || (geo.exito ? 'capturada' : 'no_disponible'),
                metodo: geo.metodo || 'Automático'
            };

            const now = new Date().toISOString();
            const estadoAnterior = ticket.estado || 'en_proceso';
            const textoActividades = (actividadesDesarrolladas ?? ticket.actividadesDesarrolladas ?? '').trim();

            const comentarios = Array.isArray(ticket.comentarios) ? [...ticket.comentarios] : [];
            if (comentarioFinal && comentarioFinal.trim()) {
                comentarios.push({
                    id: `com_${Date.now()}`,
                    autorId: collabCtx.collaboratorId,
                    uid: collabCtx.uid,
                    autorNombre: collabCtx.nombre,
                    puesto: collabCtx.puesto || '',
                    texto: `[Cierre de ticket] ${comentarioFinal.trim()}`,
                    fecha: now
                });
            }

            const motivoTexto = comentarioFinal && comentarioFinal.trim()
                ? `Ticket finalizado con evidencias completas. ${comentarioFinal.trim()}`
                : `Ticket finalizado con evidencias fotográficas (Antes, Durante, Después) y reporte de actividades.`;

            const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
            historialCambios.push({
                estadoAnterior,
                estadoNuevo: 'finalizado',
                tipoEvento: 'cierre',
                cambiadoPor: collabCtx.nombre,
                cambiadoPorId: collabCtx.collaboratorId || collabCtx.uid,
                fechaCambio: now,
                motivo: motivoTexto,
                ubicacion: ubicacionData
            });

            await this.repository.updateTicket(ticket.id, {
                estado: 'finalizado',
                fechaFin: now,
                fechaFinalizacion: now,
                cerradoPorNombre: collabCtx.nombre,
                cerradoPorId: collabCtx.collaboratorId || collabCtx.uid,
                actividadesDesarrolladas: textoActividades,
                ultimaActualizacionActividadesPor: collabCtx.nombre,
                ultimaActualizacionActividadesFecha: now,
                comentarios,
                historialCambios,
                modificadoPor: collabCtx.uid || collabCtx.collaboratorId
            });
            await this.repository.addHistorialEvent(
                ticket.id,
                'cierre',
                collabCtx.nombre,
                collabCtx.uid || collabCtx.collaboratorId,
                motivoTexto
            );
            this.repository.clearCache();

            // Generar y guardar automáticamente el Reporte Fotográfico PDF en Firebase Storage al cerrar el ticket
            let reporteUrl = null;
            try {
                const repRes = await this.generarYGuardarReporteFotografico(ticket.id);
                if (repRes?.success) {
                    reporteUrl = repRes.pdfUrl;
                }
            } catch (repErr) {
                console.warn('⚠️ No se pudo generar automáticamente el PDF de cierre, podrá generarse manualmente:', repErr);
            }

            return {
                success: true,
                reporteFotograficoUrl: reporteUrl,
                message: 'Ticket finalizado y cerrado exitosamente'
            };
        } catch (error) {
            console.error('❌ Error cerrando ticket con evidencias:', error);
            return { success: false, error: error.message || 'Error al cerrar el ticket' };
        }
    }

    /**
     * Obtiene el Reporte Fotográfico PDF del ticket si ya existe en Firebase Storage,
     * o lo genera y almacena por única vez si aún no ha sido creado.
     * @param {string} ticketId - ID del ticket en Firestore o idTicket
     * @returns {Promise<{success: boolean, alreadyExists?: boolean, pdfBlob?: Blob, pdfUrl?: string, pdfPath?: string, error?: string}>}
     */
    async generarYGuardarReporteFotografico(ticketId) {
        try {
            const ticket = await this.getTicketById(ticketId, true);
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            // Si ya existe el reporte fotográfico almacenado en Storage, devolverlo directamente sin volver a generarlo
            if (ticket.reporteFotograficoUrl) {
                return {
                    success: true,
                    alreadyExists: true,
                    pdfUrl: ticket.reporteFotograficoUrl,
                    pdfPath: ticket.reporteFotograficoPath || null,
                    message: 'Mostrando reporte fotográfico ya almacenado en Storage'
                };
            }

            const pdfBlob = await generarPDFReporteFotograficoTicket(ticket);
            const uploadRes = await this.storageService.uploadTicketReporteFotograficoPDF(
                pdfBlob,
                ticket.idTicket || ticket.id
            );

            const now = new Date().toISOString();
            const uid = this._getCurrentUserUid();

            if (uploadRes.success && uploadRes.url) {
                await this.repository.updateTicket(ticket.id, {
                    reporteFotograficoUrl: uploadRes.url,
                    reporteFotograficoPath: uploadRes.path,
                    reporteFotograficoFecha: now,
                    modificadoPor: uid || ticket.modificadoPor || ''
                });
                this.repository.clearCache();
            }

            return {
                success: true,
                alreadyExists: false,
                pdfBlob,
                pdfUrl: uploadRes.url || null,
                pdfPath: uploadRes.path || null,
                message: 'Reporte fotográfico generado y almacenado en Storage correctamente'
            };
        } catch (error) {
            console.error('❌ Error en generarYGuardarReporteFotografico:', error);
            return {
                success: false,
                error: error.message || 'Error al generar y almacenar el reporte fotográfico en PDF'
            };
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