/* ========================================
   TICKET VIEW CONTROLLER
   Controlador para ver detalle del ticket
   ======================================== */

import TicketService from '../../services/ticketService.js';
import TicketModel from '../../models/ticketModel.js';

let service = null;
let ticketId = null;
let ticketData = null;
let colaboradoresMap = {};
let eventListeners = [];

/**
 * Controlador principal
 */
export async function ticketViewController() {
    console.log('👁️ Ticket View Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new TicketService();
    
    const urlParams = new URLSearchParams(window.location.search);
    ticketId = urlParams.get('id');
    
    if (!ticketId) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se especificó un ID de ticket',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            window.location.href = '/partner/crudTickets';
        });
        return;
    }
    
    await loadColaboradores();
    await loadTicketData();
    initBackButton();
    initEditButton();
}

async function loadColaboradores() {
    try {
        const colaboradores = await service.getColaboradoresForSelect();
        colaboradoresMap = {};
        colaboradores.forEach(col => {
            colaboradoresMap[col.id] = col;
        });
        console.log(`✅ ${colaboradores.length} colaboradores cargados`);
    } catch (error) {
        console.error('❌ Error cargando colaboradores:', error);
        colaboradoresMap = {};
    }
}

async function loadTicketData() {
    try {
        showLoading(true);
        ticketData = await service.getTicketById(ticketId, true);
        
        if (!ticketData) {
            throw new Error('Ticket no encontrado');
        }
        
        console.log('📋 Datos del ticket:', ticketData);
        
        renderTicketData();
        renderHistorial();
        
        showLoading(false);
        
    } catch (error) {
        console.error('❌ Error cargando ticket:', error);
        showLoading(false);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo cargar el ticket',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            window.location.href = '/partner/crudTickets';
        });
    }
}

function renderTicketData() {
    if (!ticketData) return;
    
    document.getElementById('viewTitulo').textContent = ticketData.titulo || 'Sin título';
    document.getElementById('viewIdTicket').textContent = ticketData.idTicket || 'N/A';
    
    const estadoBadge = getEstadoBadge(ticketData.estado);
    document.getElementById('viewEstado').outerHTML = estadoBadge;
    
    const prioridadBadge = getPrioridadBadge(ticketData.prioridad);
    document.getElementById('viewPrioridad').outerHTML = prioridadBadge;
    
    const tipoBadge = getTipoBadge(ticketData.tipo);
    document.getElementById('viewTipo').outerHTML = tipoBadge;
    
    document.getElementById('viewTituloValue').textContent = ticketData.titulo || '-';
    document.getElementById('viewDescripcion').textContent = ticketData.descripcion || 'Sin descripción';
    document.getElementById('viewIdTicketValue').textContent = ticketData.idTicket || '-';
    document.getElementById('viewTipoValue').textContent = ticketData.tipo === 'operativo' ? 'Operativo' : 'Administración';
    document.getElementById('viewEstadoValue').innerHTML = estadoBadge;
    document.getElementById('viewPrioridadValue').innerHTML = prioridadBadge;
    document.getElementById('viewArea').textContent = ticketData.area || 'Sin asignar';
    document.getElementById('viewResponsable').textContent = ticketData.responsableNombre || 'Sin asignar';
    document.getElementById('viewCreadoPor').textContent = ticketData.creadoPorNombre || 'Sistema';
    document.getElementById('viewModificadoPor').textContent = ticketData.modificadoPor || ticketData.creadoPor || 'Sistema';
    
    document.getElementById('viewFechaCreacion').textContent = formatDate(ticketData.fechaCreacion);
    document.getElementById('viewFechaActualizacion').textContent = formatDate(ticketData.fechaActualizacion);
    document.getElementById('viewFechaInicio').textContent = formatDate(ticketData.fechaInicio) || 'No definida';
    document.getElementById('viewFechaFin').textContent = formatDate(ticketData.fechaFin) || 'No definida';
    
    if (ticketData.tipo === 'operativo') {
        document.getElementById('viewOperativoFields').style.display = 'block';
        document.getElementById('viewAdminFields').style.display = 'none';
        
        document.getElementById('viewCliente').textContent = ticketData.clienteNombre || 'N/A';
        document.getElementById('viewRfc').textContent = ticketData.rfc || 'N/A';
        document.getElementById('viewAtencionA').textContent = ticketData.atencionA || 'N/A';
        document.getElementById('viewCorreo').textContent = ticketData.correo || 'N/A';
        document.getElementById('viewOrdenServicio').textContent = ticketData.ordenServicio || 'N/A';
        document.getElementById('viewProyecto').textContent = ticketData.proyecto || 'N/A';
        document.getElementById('viewServicio').textContent = ticketData.servicio || 'N/A';
        document.getElementById('viewSistemas').textContent = (ticketData.sistemas || []).join(', ') || 'Ninguno';
        document.getElementById('viewCotizacion').textContent = ticketData.cotizacionNumero || 'No asociada';
    } else {
        document.getElementById('viewOperativoFields').style.display = 'none';
        document.getElementById('viewAdminFields').style.display = 'block';
        document.getElementById('viewFechaEstimada').textContent = formatDate(ticketData.fechaFinalizacionEstimada) || 'No definida';
    }
    
    renderColaboradores();
}

function renderColaboradores() {
    const container = document.getElementById('viewColaboradores');
    if (!container) return;
    
    const colaboradoresIds = ticketData.colaboradoresIds || [];
    
    if (colaboradoresIds.length === 0) {
        container.innerHTML = '<span style="color: var(--rsi-gray-500);">Sin colaboradores asignados</span>';
        return;
    }
    
    const getInitials = (nombre) => {
        if (!nombre) return '?';
        const parts = nombre.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return nombre.substring(0, 2).toUpperCase();
    };
    
    const html = colaboradoresIds.map((id, index) => {
        const col = colaboradoresMap[id] || null;
        const nombre = col ? col.nombre : 'Desconocido';
        const foto = col ? col.fotoPerfil : null;
        const iniciales = getInitials(nombre);
        const isResponsable = index === 0;
        
        return `
            <span class="rsi-view-colaborador">
                <span class="rsi-avatar-mini">
                    ${foto 
                        ? `<img src="${foto}" alt="${nombre}" onerror="this.style.display='none';this.parentElement.classList.add('fallback');this.parentElement.textContent='${iniciales}'">` 
                        : iniciales
                    }
                </span>
                ${nombre}
                ${isResponsable ? '<span class="rsi-colaborador-role">Responsable</span>' : ''}
            </span>
        `;
    }).join('');
    
    container.innerHTML = html;
}

/**
 * ✅ Renderiza el historial - ASCENDENTE (más antiguo primero)
 * INICIO = Evento más antiguo (creación) - ARRIBA
 * FIN = Evento más reciente (última acción) - ABAJO
 */
function renderHistorial() {
    const container = document.getElementById('timelineContainer');
    const countBadge = document.getElementById('historialCount');
    
    if (!container) return;
    
    const historial = ticketData.historial || {};
    
    // ✅ Obtener keys y eliminar duplicados por timestamp
    const eventosKeys = Object.keys(historial);
    
    // ✅ Eliminar duplicados (si hay dos eventos con el mismo timestamp, solo guardar uno)
    const uniqueEvents = {};
    eventosKeys.forEach(key => {
        if (!uniqueEvents[key]) {
            uniqueEvents[key] = historial[key];
        }
    });
    
    const eventos = Object.keys(uniqueEvents);
    
    if (countBadge) {
        countBadge.textContent = `${eventos.length} eventos`;
    }
    
    if (eventos.length === 0) {
        container.innerHTML = `
            <div class="rsi-timeline-empty">
                <i class="fas fa-inbox"></i>
                <p>No hay eventos registrados en el historial</p>
            </div>
        `;
        return;
    }
    
    // ✅ ORDEN ASCENDENTE: más antiguo primero (INICIO arriba, FIN abajo)
    const eventosOrdenados = eventos.sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
    });
    
    const totalEventos = eventosOrdenados.length;
    
    const html = eventosOrdenados.map((timestamp, index) => {
        const evento = uniqueEvents[timestamp];
        const tipo = evento.evento || 'desconocido';
        const label = getEventoLabel(tipo);
        const fecha = new Date(timestamp).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const usuario = evento.usuario || 'Sistema';
        const descripcion = evento.descripcion || '';
        
        // ✅ Primer evento (más antiguo = creación) = INICIO
        // ✅ Último evento (más reciente) = FIN
        const isFirst = index === 0;
        const isLast = index === totalEventos - 1;
        
        const iconClass = getEventoIconClass(tipo);
        const color = getEventoColor(tipo);
        
        // Clase para parpadeo en INICIO y FIN
        const pulseClass = (isFirst || isLast) ? 'pulse' : '';
        
        // ✅ Etiqueta INICIO o FIN
        let labelTag = '';
        if (isFirst) {
            labelTag = `<span class="rsi-timeline-label-tag rsi-timeline-label-first"><i class="fas fa-flag-checkered"></i> INICIO</span>`;
        }
        if (isLast) {
            labelTag = `<span class="rsi-timeline-label-tag rsi-timeline-label-last"><i class="fas fa-arrow-up"></i> FIN</span>`;
        }
        
        return `
            <div class="rsi-timeline-item ${isLast ? 'last' : ''}">
                <span class="rsi-timeline-icon ${pulseClass}" style="background: ${color};">
                    <i class="fas ${iconClass}"></i>
                </span>
                <div class="rsi-timeline-content">
                    <div class="rsi-timeline-content-header">
                        <div class="rsi-timeline-event">
                            <i class="fas ${iconClass}" style="color: ${color};"></i>
                            <strong>${label}</strong>
                            ${labelTag}
                        </div>
                        <span class="rsi-timeline-date">${fecha}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--rsi-text-primary); margin-top: 4px;">
                        <strong>${usuario}</strong>
                        ${descripcion ? `- ${descripcion}` : ''}
                    </div>
                    ${evento.detalles ? `<div class="rsi-timeline-details">${evento.detalles}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function formatDate(dateString) {
    if (!dateString) return null;
    try {
        return new Date(dateString).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function getEstadoBadge(estado) {
    const estadoLabels = {
        'pendiente': 'Pendiente',
        'en_proceso': 'En Proceso',
        'finalizado': 'Finalizado',
        'cancelado': 'Cancelado'
    };
    const label = estadoLabels[estado] || estado || 'Desconocido';
    const className = estado || 'pendiente';
    return `<span class="rsi-badge-status ${className}">${label}</span>`;
}

function getPrioridadBadge(prioridad) {
    const prioridadLabels = {
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja'
    };
    const label = prioridadLabels[prioridad] || prioridad || 'Media';
    const className = prioridad || 'media';
    
    const iconos = {
        'alta': 'fa-circle-exclamation',
        'media': 'fa-circle',
        'baja': 'fa-circle-check'
    };
    const icon = iconos[prioridad] || 'fa-circle';
    
    return `<span class="rsi-badge-prioridad ${className}"><i class="fas ${icon}"></i> ${label}</span>`;
}

function getTipoBadge(tipo) {
    const tipoLabels = {
        'operativo': 'Operativo',
        'administracion': 'Administración'
    };
    const label = tipoLabels[tipo] || tipo || 'Operativo';
    const className = tipo || 'operativo';
    
    const iconos = {
        'operativo': 'fa-tools',
        'administracion': 'fa-building'
    };
    const icon = iconos[tipo] || 'fa-ticket';
    
    return `<span class="rsi-badge-tipo ${className}"><i class="fas ${icon}"></i> ${label}</span>`;
}

function getEventoColor(evento) {
    const colores = {
        'creacion': '#1c1948',      // Morado RSI
        'edicion': '#17a2b8',        // Azul
        'asignacion': '#4a9eff',     // Azul claro
        'aceptacion': '#28a745',     // Verde
        'evidencia': '#fd7e14',      // Naranja
        'cierre': '#dc3545',         // Rojo
        'estado_pendiente': '#ffc107', // Amarillo
        'estado_en_proceso': '#17a2b8', // Azul
        'cancelacion': '#dc3545',    // Rojo
        'reactivacion': '#28a745'    // Verde
    };
    return colores[evento] || '#6c757d';
}

function getEventoLabel(evento) {
    const labels = {
        'creacion': 'Creación del Ticket',
        'edicion': 'Edición del Ticket',
        'asignacion': 'Asignación de Colaboradores',
        'aceptacion': 'Aceptación del Ticket',
        'evidencia': 'Evidencia Subida',
        'cierre': 'Cierre del Ticket',
        'estado_pendiente': 'Cambio a Pendiente',
        'estado_en_proceso': 'Cambio a En Proceso',
        'cancelacion': 'Cancelación del Ticket',
        'reactivacion': 'Reactivación del Ticket'
    };
    return labels[evento] || evento;
}

function getEventoIconClass(evento) {
    const iconos = {
        'creacion': 'fa-plus-circle',
        'edicion': 'fa-pen',
        'asignacion': 'fa-user-plus',
        'aceptacion': 'fa-check-circle',
        'evidencia': 'fa-paperclip',
        'cierre': 'fa-lock',
        'estado_pendiente': 'fa-clock',
        'estado_en_proceso': 'fa-sync-alt',
        'cancelacion': 'fa-times-circle',
        'reactivacion': 'fa-undo-alt'
    };
    return iconos[evento] || 'fa-circle';
}

function showLoading(show) {
    const overlay = document.getElementById('loadingSpinner');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function initBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (!backBtn) return;
    
    const handler = () => {
        window.location.href = '/partner/crudTickets';
    };
    backBtn.addEventListener('click', handler);
    eventListeners.push({ element: backBtn, event: 'click', handler });
}

function initEditButton() {
    const editBtn = document.getElementById('editBtn');
    if (!editBtn) return;
    
    const handler = () => {
        if (ticketData && ticketData.id) {
            window.location.href = `/partner/ticket?id=${ticketData.id}`;
        } else {
            window.location.href = '/partner/crudTickets';
        }
    };
    editBtn.addEventListener('click', handler);
    eventListeners.push({ element: editBtn, event: 'click', handler });
}

export function destroyTicketViewController() {
    console.log('🧹 Destroying TicketViewController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    ticketData = null;
    colaboradoresMap = {};
}

export default ticketViewController;