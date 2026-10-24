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
 * @property {string} estado - 'pendiente' | 'en_proceso' | 'finalizado' | 'abandonado' | 'cancelado'
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
        ABANDONADO: 'abandonado',
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
     * Obtiene la fecha actual en formato YYYY-MM-DD en la zona horaria de México (America/Mexico_City)
     * @returns {string} Fecha actual 'YYYY-MM-DD'
     */
    static getTodayString() {
        try {
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
        } catch (e) {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    /**
     * Crea un nuevo objeto Ticket para Firestore
     * @param {Object} data - Datos del ticket
     * @param {string} idTicket - ID auto-generado
     * @param {string} creadoPor - UID del usuario que crea
     * @param {string} creadoPorNombre - Nombre del creador
     * @param {string} tipo - 'operativo' o 'administracion'
     * @returns {Object} - Objeto Ticket formateado
     */
    static create(data, idTicket, creadoPor, creadoPorNombre, tipo) {
        const now = new Date().toISOString();

        const tipoValido = Object.values(this.TIPOS).includes(tipo) ? tipo : this.TIPOS.OPERATIVO;

        // Asegurar que idTicket no sea null
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
            fechaUltimaNotificacion: null,
            aceptaciones: data.aceptaciones || {},
            comentarios: Array.isArray(data.comentarios) ? data.comentarios : [],
            evidencias: {
                antes: Array.isArray(data.evidencias?.antes) ? data.evidencias.antes : [],
                durante: Array.isArray(data.evidencias?.durante) ? data.evidencias.durante : [],
                despues: Array.isArray(data.evidencias?.despues) ? data.evidencias.despues : []
            },
            actividadesDesarrolladas: data.actividadesDesarrolladas || ''
        };

        // Campos específicos según tipo
        if (tipoValido === this.TIPOS.OPERATIVO) {
            ticket.clienteId = data.clienteId || null;
            ticket.clienteNombre = data.clienteNombre || '';
            ticket.rfc = data.rfc || '';
            ticket.atencionA = data.atencionA || '';
            ticket.correo = data.correo || '';
            ticket.ordenServicio = data.ordenServicio || '';
            ticket.proyecto = data.proyecto || '';
            ticket.servicio = data.servicio || '';
            ticket.sistemas = data.sistemas || [];
            ticket.cotizacionId = data.cotizacionId || null;
            ticket.cotizacionNumero = data.cotizacionNumero || '';
            ticket.fechaFinalizacionEstimada = null;
        } else {
            ticket.clienteId = null;
            ticket.clienteNombre = '';
            ticket.rfc = '';
            ticket.atencionA = '';
            ticket.correo = '';
            ticket.ordenServicio = '';
            ticket.proyecto = '';
            ticket.servicio = '';
            ticket.sistemas = [];
            ticket.cotizacionId = null;
            ticket.cotizacionNumero = '';
            ticket.fechaFinalizacionEstimada = data.fechaFinalizacionEstimada || null;
        }

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

        // Validación de fechas en hora local de México (permite hoy y fechas futuras, solo rechaza anteriores)
        const hoyStr = this.getTodayString();
        const inicioStr = (data.fechaInicio || '').split('T')[0];
        const finStr = (data.fechaFin || '').split('T')[0];

        if (inicioStr && inicioStr < hoyStr) {
            errors.fechaInicio = 'La fecha de inicio no puede ser anterior a hoy';
        }

        if (finStr) {
            if (finStr < hoyStr) {
                errors.fechaFin = 'La fecha de finalización no puede ser anterior a hoy';
            }
            if (inicioStr && finStr < inicioStr) {
                errors.fechaFin = 'La fecha de finalización no puede ser anterior a la fecha de inicio';
            }
        }

        // Validaciones específicas por tipo
        if (tipo === this.TIPOS.OPERATIVO) {
            if (!data.clienteId) {
                errors.cliente = 'Debe seleccionar un cliente';
            }
        }

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
            'abandonado': 'Abandonado',
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
            'abandonado': '#6c757d',
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
     * Normaliza la estructura de evidencias (antes, durante, despues) de un ticket
     * @param {Object} ticket
     * @returns {{ antes: Array, durante: Array, despues: Array }}
     */
    static normalizeEvidencias(ticket) {
        const raw = ticket?.evidencias || {};
        if (Array.isArray(raw)) {
            return {
                antes: raw.filter(e => e && e.etapa === 'antes'),
                durante: raw.filter(e => e && e.etapa === 'durante'),
                despues: raw.filter(e => e && e.etapa === 'despues')
            };
        }
        return {
            antes: Array.isArray(raw.antes) ? raw.antes : [],
            durante: Array.isArray(raw.durante) ? raw.durante : [],
            despues: Array.isArray(raw.despues) ? raw.despues : []
        };
    }

    /**
     * Normaliza las aceptaciones del ticket a un arreglo uniforme
     * @param {Object} ticket
     * @returns {Array<Object>}
     */
    static normalizeAceptaciones(ticket) {
        const raw = ticket?.aceptaciones;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.filter(Boolean);
        if (typeof raw === 'object') {
            return Object.entries(raw).map(([key, val]) => ({
                id: val?.id || `acc_${key}`,
                colaboradorId: val?.colaboradorId || key,
                uid: val?.uid || key,
                nombre: val?.nombre || val?.usuario || 'Colaborador',
                puesto: val?.puesto || '',
                fechaAceptacion: val?.fechaAceptacion || val?.timestamp || null,
                comentario: val?.comentario || '',
                ubicacion: val?.ubicacion || null
            }));
        }
        return [];
    }

    /**
     * Valida que el ticket cumpla todos los requisitos para poder cerrarse/finalizarse:
     * - Aceptación registrada
     * - Evidencia fotográfica del ANTES (>= 1)
     * - Evidencia fotográfica del DURANTE (>= 1)
     * - Evidencia fotográfica del DESPUÉS (>= 1)
     * - Actividades desarrolladas descritas (>= 5 caracteres)
     * - Evidencias fotográficas subidas por TODAS las personas asignadas al ticket
     *
     * @param {Object} ticket - Datos actuales del ticket
     * @param {string} [actividadesOverride] - Texto de actividades desarrolladas en captura
     * @param {Array<string>} [userIds] - IDs del colaborador actual
     * @returns {{ valid: boolean, errors: Array<string>, missing: Array<string>, checks: Object }}
     */
    static validateForCierre(ticket, actividadesOverride = undefined, userIds = []) {
        const evidencias = this.normalizeEvidencias(ticket);
        const aceptaciones = this.normalizeAceptaciones(ticket);
        const todasEvidencias = [...evidencias.antes, ...evidencias.durante, ...evidencias.despues];

        const hasUserAccepted = userIds && userIds.length > 0
            ? aceptaciones.some(a => userIds.includes(a.colaboradorId) || (a.uid && userIds.includes(a.uid)))
            : aceptaciones.length > 0;

        const hasAntes = evidencias.antes.length > 0;
        const hasDurante = evidencias.durante.length > 0;
        const hasDespues = evidencias.despues.length > 0;

        const actividades = (actividadesOverride !== undefined ? actividadesOverride : (ticket?.actividadesDesarrolladas || '')).trim();
        const hasActividades = actividades.length >= 5;

        // Validación estricta: Todas las personas asignadas deben haber subido evidencias de sus actividades desarrolladas
        const asignadosIds = Array.isArray(ticket?.colaboradoresIds) ? ticket.colaboradoresIds : [];
        const colaboradoresDetalle = Array.isArray(ticket?.colaboradores) ? ticket.colaboradores : [];
        
        const faltantesEvidencias = [];
        const detalleColaboradores = [];

        asignadosIds.forEach(colabId => {
            const cInfo = colaboradoresDetalle.find(c => c.id === colabId || c.uid === colabId);
            const nombreColab = cInfo?.nombre || (asignadosIds.length === 1 && ticket.responsableNombre ? ticket.responsableNombre : `Colaborador (${colabId})`);
            
            const count = todasEvidencias.filter(e => 
                (e.subidoPorId && (e.subidoPorId === colabId || e.subidoPorUid === colabId)) ||
                (e.subidoPorUid && (e.subidoPorUid === colabId || e.subidoPorId === colabId))
            ).length;

            const tiene = count > 0;
            detalleColaboradores.push({
                id: colabId,
                nombre: nombreColab,
                tieneEvidencia: tiene,
                totalEvidencias: count
            });

            if (!tiene) {
                faltantesEvidencias.push(nombreColab);
            }
        });

        const missing = [];
        if (!hasUserAccepted) {
            missing.push('Aceptar formalmente el ticket antes de cerrarlo.');
        }
        if (!hasAntes) {
            missing.push('Subir al menos 1 evidencia fotográfica del ANTES (con marca de agua).');
        }
        if (!hasDurante) {
            missing.push('Subir al menos 1 evidencia fotográfica del DURANTE (con marca de agua).');
        }
        if (!hasDespues) {
            missing.push('Subir al menos 1 evidencia fotográfica del DESPUÉS (con marca de agua).');
        }
        if (!hasActividades) {
            missing.push('Describir las actividades desarrolladas en el ticket.');
        }
        if (faltantesEvidencias.length > 0) {
            missing.push(`Todos los colaboradores asignados deben subir evidencias de sus actividades desarrolladas. Faltan por subir evidencia: ${faltantesEvidencias.join(', ')}.`);
        }

        return {
            valid: missing.length === 0,
            errors: missing,
            missing,
            checks: {
                aceptado: hasUserAccepted,
                antes: hasAntes,
                durante: hasDurante,
                despues: hasDespues,
                actividades: hasActividades,
                colaboradoresEvidencias: {
                    cumpleTodos: faltantesEvidencias.length === 0,
                    faltantes: faltantesEvidencias,
                    detalle: detalleColaboradores
                }
            }
        };
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
