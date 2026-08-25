/* ========================================
   TICKET MODEL
   Estructura de datos para Tickets de Operaciones
   ======================================== */

/**
 * @typedef {Object} Ticket
 * @property {string} idTicket - ID auto-generado del ticket (Ticket-RSI-XXX)
 * @property {string} titulo - Título del ticket
 * @property {string} descripcion - Descripción detallada
 * @property {string} tipo - 'operativo' | 'administracion'
 * @property {string} estado - 'pendiente' | 'en_proceso' | 'finalizado' | 'cancelado'
 * @property {string} prioridad - 'alta' | 'media' | 'baja'
 * @property {string} area - Área responsable
 * @property {Array<string>} colaboradoresIds - IDs de colaboradores asignados
 * @property {string} responsableNombre - Nombre del responsable principal
 * @property {string} fechaCreacion - Fecha de creación (ISO)
 * @property {string} fechaActualizacion - Fecha de última actualización (ISO)
 * @property {string} fechaInicio - Fecha de inicio del ticket
 * @property {string} fechaFin - Fecha de finalización del ticket
 * @property {string} creadoPor - UID del usuario que creó el ticket
 * @property {string} creadoPorNombre - Nombre del creador
 * @property {string} modificadoPor - UID del usuario que modificó
 * @property {Object} historial - Mapa de eventos del ticket
 * 
 * Campos específicos para operativo:
 * @property {string} clienteId - ID del cliente
 * @property {string} clienteNombre - Nombre del cliente
 * @property {string} direccionFiscal - Dirección fiscal
 * @property {string} rfc - RFC del cliente
 * @property {string} atencionA - Persona de contacto
 * @property {string} correo - Correo del cliente
 * @property {string} ordenServicio - Orden de servicio
 * @property {string} proyecto - Proyecto
 * @property {string} servicio - Servicio
 * @property {Array<string>} sistemas - Sistemas aplicables
 * @property {string} cotizacionId - ID de cotización asociada
 * @property {string} cotizacionNumero - Número de cotización
 * 
 * Campos específicos para administración:
 * @property {string} fechaFinalizacionEstimada - Fecha estimada de finalización
 */

export class TicketModel {
    
    /**
     * Tipos de ticket válidos
     */
    static TIPOS = {
        OPERATIVO: 'operativo',
        ADMINISTRACION: 'administracion'
    };

    /**
     * Estados válidos del ticket
     */
    static ESTADOS = {
        PENDIENTE: 'pendiente',
        EN_PROCESO: 'en_proceso',
        FINALIZADO: 'finalizado',
        CANCELADO: 'cancelado'
    };

    /**
     * Prioridades válidas
     */
    static PRIORIDADES = {
        ALTA: 'alta',
        MEDIA: 'media',
        BAJA: 'baja'
    };

    /**
     * Sistemas disponibles
     */
    static SISTEMAS = {
        CCTV: 'CCTV',
        DH: 'DH',
        CA: 'CA',
        AI: 'AI',
        MULTIMEDIA: 'MULTIMEDIA',
        OTRO: 'OTRO'
    };

    /**
     * Crea un nuevo objeto Ticket para Firestore
     * @param {Object} data - Datos del ticket
     * @param {string} idTicket - ID auto-generado
     * @param {string} creadoPor - UID del usuario que crea
     * @param {string} creadoPorNombre - Nombre del creador
     * @param {string} tipo - 'operativo' o 'administracion'
     * @returns {Object} - Objeto Ticket formateado
     */
    /**
     * Crea un nuevo objeto Ticket para Firestore
     */
    static create(data, idTicket, creadoPor, creadoPorNombre, tipo) {
        const now = new Date().toISOString();
        const nowTimestamp = new Date();

        const tipoValido = Object.values(this.TIPOS).includes(tipo) ? tipo : this.TIPOS.OPERATIVO;

        // ✅ Asegurar que idTicket no sea null
        const ticketId = idTicket || `Ticket-RSI-${Date.now()}`;

        const ticket = {
            idTicket: ticketId,
            titulo: data.titulo?.trim() || '',
            descripcion: data.descripcion?.trim() || '',
            tipo: tipoValido,
            estado: data.estado || this.ESTADOS.PENDIENTE,
            prioridad: data.prioridad || this.PRIORIDADES.MEDIA,
            area: data.area || '',
            colaboradoresIds: data.colaboradoresIds || [],
            responsableNombre: data.responsableNombre || '',
            fechaCreacion: now,
            fechaActualizacion: now,
            fechaInicio: data.fechaInicio || null,
            fechaFin: data.fechaFin || null,
            creadoPor: creadoPor || '',
            creadoPorNombre: creadoPorNombre || '',
            modificadoPor: creadoPor || '',
            // ✅ Historial con un SOLO evento de creación
            historial: {
                [now]: {
                    evento: 'creacion',
                    usuario: creadoPorNombre || 'Sistema',
                    usuarioId: creadoPor || '',
                    descripcion: `Ticket creado con ID: ${ticketId}`,
                    timestamp: now
                }
            },
            notificacionesEnviadas: false,
            fechaUltimaNotificacion: null
        };

        // Campos específicos según tipo...
        // (resto del código igual)
        
        return ticket;
    }

    /**
     * Crea un evento de historial
     * @param {string} evento - Tipo de evento ('creacion', 'edicion', 'asignacion', 'aceptacion', 'evidencia', 'cierre')
     * @param {string} usuario - Nombre del usuario
     * @param {string} usuarioId - UID del usuario
     * @param {string} descripcion - Descripción del evento
     * @returns {Object} - Evento formateado
     */
    static createHistorialEvent(evento, usuario, usuarioId, descripcion) {
        const now = new Date().toISOString();
        return {
            [now]: {
                evento: evento,
                usuario: usuario || 'Sistema',
                usuarioId: usuarioId || '',
                descripcion: descripcion || '',
                timestamp: now
            }
        };
    }

    /**
     * Agrega un evento al historial
     * @param {Object} ticket - Ticket existente
     * @param {string} evento - Tipo de evento
     * @param {string} usuario - Nombre del usuario
     * @param {string} usuarioId - UID del usuario
     * @param {string} descripcion - Descripción del evento
     * @returns {Object} - Ticket con historial actualizado
     */
    static addHistorialEvent(ticket, evento, usuario, usuarioId, descripcion) {
        const now = new Date().toISOString();
        const nuevoEvento = {
            [now]: {
                evento: evento,
                usuario: usuario || 'Sistema',
                usuarioId: usuarioId || '',
                descripcion: descripcion || '',
                timestamp: now
            }
        };

        return {
            ...ticket,
            historial: {
                ...(ticket.historial || {}),
                ...nuevoEvento
            },
            fechaActualizacion: now,
            modificadoPor: usuarioId || ticket.modificadoPor
        };
    }

    /**
     * Valida los datos del ticket
     * @param {Object} data - Datos a validar
     * @param {string} tipo - 'operativo' o 'administracion'
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    static validate(data, tipo) {
        const errors = {};

        // Validaciones comunes
        if (!data.titulo || data.titulo.trim().length < 3) {
            errors.titulo = 'El título es requerido (mínimo 3 caracteres)';
        }

        if (!data.descripcion || data.descripcion.trim().length < 10) {
            errors.descripcion = 'La descripción es requerida (mínimo 10 caracteres)';
        }

        if (!data.colaboradoresIds || data.colaboradoresIds.length === 0) {
            errors.colaboradores = 'Debe asignar al menos un colaborador';
        }

        if (!data.prioridad || !Object.values(this.PRIORIDADES).includes(data.prioridad)) {
            errors.prioridad = 'Seleccione una prioridad válida';
        }

        // Validación de fechas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (data.fechaInicio) {
            const fechaInicio = new Date(data.fechaInicio);
            fechaInicio.setHours(0, 0, 0, 0);
            
            if (fechaInicio < hoy) {
                errors.fechaInicio = 'La fecha de inicio no puede ser anterior a hoy';
            }
        }

        if (data.fechaFin) {
            const fechaFin = new Date(data.fechaFin);
            fechaFin.setHours(0, 0, 0, 0);
            
            if (fechaFin < hoy) {
                errors.fechaFin = 'La fecha de finalización no puede ser anterior a hoy';
            }
            
            if (data.fechaInicio) {
                const fechaInicio = new Date(data.fechaInicio);
                fechaInicio.setHours(0, 0, 0, 0);
                if (fechaFin < fechaInicio) {
                    errors.fechaFin = 'La fecha de finalización no puede ser anterior a la fecha de inicio';
                }
            }
        }

        // ✅ Validaciones específicas por tipo - SOLO para operativo
        if (tipo === this.TIPOS.OPERATIVO) {
            if (!data.clienteId) {
                errors.cliente = 'Debe seleccionar un cliente';
            }
        }
        // ✅ Para administración NO se valida cliente

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida un email
     * @param {string} email
     * @returns {boolean}
     */
    static _isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Obtiene el estado del ticket en formato legible
     * @param {string} estado
     * @returns {string}
     */
    static getEstadoLabel(estado) {
        const labels = {
            'pendiente': 'Pendiente',
            'en_proceso': 'En Proceso',
            'finalizado': 'Finalizado',
            'cancelado': 'Cancelado'
        };
        return labels[estado] || estado;
    }

    /**
     * Obtiene la prioridad en formato legible
     * @param {string} prioridad
     * @returns {string}
     */
    static getPrioridadLabel(prioridad) {
        const labels = {
            'alta': 'Alta',
            'media': 'Media',
            'baja': 'Baja'
        };
        return labels[prioridad] || prioridad;
    }

    /**
     * Obtiene el color asociado al estado
     * @param {string} estado
     * @returns {string}
     */
    static getEstadoColor(estado) {
        const colors = {
            'pendiente': '#ffc107',
            'en_proceso': '#17a2b8',
            'finalizado': '#28a745',
            'cancelado': '#dc3545'
        };
        return colors[estado] || '#6c757d';
    }

    /**
     * Obtiene el color asociado a la prioridad
     * @param {string} prioridad
     * @returns {string}
     */
    static getPrioridadColor(prioridad) {
        const colors = {
            'alta': '#dc3545',
            'media': '#ffc107',
            'baja': '#28a745'
        };
        return colors[prioridad] || '#6c757d';
    }

    /**
     * Convierte un ticket a formato para vista
     * @param {Object} ticket
     * @returns {Object}
     */
    static toDisplay(ticket) {
        return {
            ...ticket,
            estadoLabel: this.getEstadoLabel(ticket.estado),
            prioridadLabel: this.getPrioridadLabel(ticket.prioridad),
            estadoColor: this.getEstadoColor(ticket.estado),
            prioridadColor: this.getPrioridadColor(ticket.prioridad),
            fechaCreacionDisplay: ticket.fechaCreacion ? new Date(ticket.fechaCreacion).toLocaleDateString('es-MX') : '',
            fechaActualizacionDisplay: ticket.fechaActualizacion ? new Date(ticket.fechaActualizacion).toLocaleDateString('es-MX') : '',
            sistemasDisplay: (ticket.sistemas || []).join(', ')
        };
    }
}

export default TicketModel;