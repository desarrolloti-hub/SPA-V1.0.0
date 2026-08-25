/* ========================================
   TICKETS CRUD CONTROLLER
   Controlador para la gestión de tickets
   ======================================== */

import TicketService from '../../services/ticketService.js';
import TicketModel from '../../models/ticketModel.js';

let service = null;
let currentPage = 1;
const pageSize = 15;
let totalPages = 1;
let totalItems = 0;
let searchTerm = '';
let ticketsData = [];
let colaboradoresMap = {};
let eventListeners = [];

/**
 * Controlador principal
 */
export async function ticketsCrudController() {
    console.log('📋 Tickets CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new TicketService();
    
    // Exponer funciones globalmente
    window.cancelarTicket = cancelarTicket;
    window.reactivarTicket = reactivarTicket;
    
    // Cargar colaboradores primero
    await loadColaboradores();
    
    // Inicializar eventos
    initSearch();
    initRefresh();
    initPagination();
    initStats();
    
    // Cargar datos
    await loadTickets();
}

/**
 * Carga los colaboradores y los guarda en un mapa para acceso rápido
 */
async function loadColaboradores() {
    try {
        const colaboradores = await service.getColaboradoresForSelect();
        colaboradoresMap = {};
        colaboradores.forEach(col => {
            colaboradoresMap[col.id] = col;
        });
        window._colaboradoresGlobal = colaboradores;
        console.log(`✅ ${colaboradores.length} colaboradores cargados para el CRUD`);
    } catch (error) {
        console.error('❌ Error cargando colaboradores:', error);
        colaboradoresMap = {};
        window._colaboradoresGlobal = [];
    }
}

/**
 * Inicializa el buscador
 */
function initSearch() {
    const searchInput = document.getElementById('searchTicket');
    const searchBtn = document.getElementById('searchTicketBtn');
    const clearBtn = document.getElementById('clearSearchBtn');
    const clearResults = document.getElementById('clearSearchResults');
    const resultsInfo = document.getElementById('searchResultsInfo');
    const resultsText = document.getElementById('searchResultsText');
    
    if (!searchInput) return;
    
    const performSearch = () => {
        searchTerm = searchInput.value.trim();
        currentPage = 1;
        
        if (searchTerm.length > 0) {
            resultsText.textContent = `🔍 Resultados para: "${searchTerm}"`;
            resultsInfo.style.display = 'flex';
            clearBtn.style.display = 'flex';
        } else {
            resultsInfo.style.display = 'none';
            clearBtn.style.display = 'none';
        }
        
        loadTickets();
    };
    
    if (searchBtn) {
        const handler = () => performSearch();
        searchBtn.addEventListener('click', handler);
        eventListeners.push({ element: searchBtn, event: 'click', handler });
    }
    
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    };
    searchInput.addEventListener('keydown', keyHandler);
    eventListeners.push({ element: searchInput, event: 'keydown', handler: keyHandler });
    
    if (clearBtn) {
        const clearHandler = () => {
            searchInput.value = '';
            searchTerm = '';
            currentPage = 1;
            resultsInfo.style.display = 'none';
            clearBtn.style.display = 'none';
            loadTickets();
            searchInput.focus();
        };
        clearBtn.addEventListener('click', clearHandler);
        eventListeners.push({ element: clearBtn, event: 'click', handler: clearHandler });
    }
    
    if (clearResults) {
        const clearResultsHandler = () => {
            searchInput.value = '';
            searchTerm = '';
            currentPage = 1;
            resultsInfo.style.display = 'none';
            clearBtn.style.display = 'none';
            loadTickets();
            searchInput.focus();
        };
        clearResults.addEventListener('click', clearResultsHandler);
        eventListeners.push({ element: clearResults, event: 'click', handler: clearResultsHandler });
    }
}

/**
 * Inicializa el botón de refrescar
 */
function initRefresh() {
    const refreshBtn = document.getElementById('refreshTickets');
    if (!refreshBtn) return;
    
    const handler = () => {
        const icon = refreshBtn.querySelector('i');
        if (icon) {
            icon.classList.add('fa-spin');
        }
        refreshBtn.disabled = true;
        
        loadTickets(true).finally(() => {
            if (icon) {
                icon.classList.remove('fa-spin');
            }
            refreshBtn.disabled = false;
        });
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
}

/**
 * Inicializa la paginación
 */
function initPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        const handler = () => {
            if (currentPage > 1) {
                currentPage--;
                loadTickets();
            }
        };
        prevBtn.addEventListener('click', handler);
        eventListeners.push({ element: prevBtn, event: 'click', handler });
    }
    
    if (nextBtn) {
        const handler = () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadTickets();
            }
        };
        nextBtn.addEventListener('click', handler);
        eventListeners.push({ element: nextBtn, event: 'click', handler });
    }
}

/**
 * Inicializa estadísticas
 */
function initStats() {
    // Las estadísticas se actualizan en loadTickets
}

/**
 * Carga los tickets desde el servicio
 */
async function loadTickets(forceRefresh = false) {
    try {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const tableWrapper = document.querySelector('.rsi-table-wrapper');
        const pagination = document.getElementById('paginationContainer');
        
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (pagination) pagination.style.display = 'none';
        
        if (searchTerm) {
            const allTickets = await service.getAllTickets(forceRefresh);
            const termLower = searchTerm.toLowerCase();
            ticketsData = allTickets.filter(t => {
                const id = (t.idTicket || '').toLowerCase();
                const titulo = (t.titulo || '').toLowerCase();
                const cliente = (t.clienteNombre || '').toLowerCase();
                const descripcion = (t.descripcion || '').toLowerCase();
                return id.includes(termLower) || 
                       titulo.includes(termLower) || 
                       cliente.includes(termLower) ||
                       descripcion.includes(termLower);
            });
            
            totalItems = ticketsData.length;
            totalPages = Math.ceil(totalItems / pageSize) || 1;
            
            const start = (currentPage - 1) * pageSize;
            const end = Math.min(start + pageSize, totalItems);
            const pageData = ticketsData.slice(start, end);
            
            renderTickets(pageData);
            
        } else {
            const response = await service.getTicketsPaginated(pageSize, currentPage);
            ticketsData = response.tickets || [];
            totalItems = response.total || 0;
            totalPages = response.totalPages || 1;
            
            renderTickets(ticketsData);
        }
        
        updateStats(ticketsData);
        
        const countBadge = document.getElementById('ticketCount');
        if (countBadge) {
            countBadge.textContent = totalItems;
        }
        
        updatePagination();
        
        if (loadingState) loadingState.style.display = 'none';
        
        if (totalItems === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                const emptyTitle = document.getElementById('emptyStateTitle');
                const emptyText = document.getElementById('emptyStateText');
                if (emptyTitle) {
                    emptyTitle.textContent = searchTerm 
                        ? 'No se encontraron resultados' 
                        : 'No hay tickets registrados';
                }
                if (emptyText) {
                    emptyText.textContent = searchTerm 
                        ? `No se encontraron tickets que coincidan con "${searchTerm}"` 
                        : 'Comienza creando tu primer ticket.';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (pagination) pagination.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (tableWrapper) tableWrapper.style.display = 'block';
            if (pagination) pagination.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('❌ Error cargando tickets:', error);
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: var(--rsi-danger);"></i>
                <p>Error al cargar los tickets: ${error.message}</p>
                <button class="rsi-btn-crud rsi-btn-crud-primary" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            `;
        }
    }
}

/**
 * Renderiza los tickets en la tabla
 */
function renderTickets(tickets) {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;
    
    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: var(--rsi-spacing-xl); color: var(--rsi-gray-500);">
                    <i class="fas fa-inbox" style="font-size: 2rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                    No hay tickets para mostrar
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = tickets.map(ticket => {
        const estadoBadge = getEstadoBadge(ticket.estado);
        const prioridadBadge = getPrioridadBadge(ticket.prioridad);
        const tipoBadge = getTipoBadge(ticket.tipo);
        const colaboradoresHtml = getColaboradoresHtml(ticket.colaboradoresIds || []);
        
        const fechaCreacion = ticket.fechaCreacion 
            ? new Date(ticket.fechaCreacion).toLocaleDateString('es-MX', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })
            : 'N/A';
        
        const creadoPor = ticket.creadoPorNombre || 'Sistema';
        const clienteNombre = ticket.tipo === 'operativo' 
            ? (ticket.clienteNombre || 'N/A')
            : 'N/A';
        
        return `
            <tr>
                <td>
                    <strong style="color: var(--rsi-primary); font-size: 0.85rem;">${ticket.idTicket || 'N/A'}</strong>
                    ${tipoBadge}
                </td>
                <td>
                    <div class="rsi-descripcion-container">
                        <span class="rsi-descripcion-texto">${ticket.titulo || 'Sin título'}</span>
                        <div class="rsi-descripcion-tooltip">
                            <strong>${ticket.titulo || 'Sin título'}</strong>
                            <br>
                            ${ticket.descripcion || 'Sin descripción'}
                        </div>
                    </div>
                </td>
                <td>${clienteNombre}</td>
                <td>${fechaCreacion}</td>
                <td>${estadoBadge}</td>
                <td>${prioridadBadge}</td>
                <td>${colaboradoresHtml}</td>
                <td>${creadoPor}</td>
                <td>
                    <div class="rsi-table-actions">
                        <button class="rsi-btn-icon rsi-btn-icon-view" onclick="window.location.href='/partner/ticketView?id=${ticket.id}'" title="Ver ticket">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="rsi-btn-icon rsi-btn-icon-edit" onclick="window.location.href='/partner/ticket?id=${ticket.id}'" title="Editar ticket">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${ticket.estado === 'cancelado' ? `
                            <button class="rsi-btn-icon rsi-btn-icon-reactivate" onclick="window.reactivarTicket('${ticket.id}', '${ticket.idTicket}')" title="Reactivar ticket">
                                <i class="fas fa-undo"></i>
                            </button>
                        ` : `
                            <button class="rsi-btn-icon rsi-btn-icon-cancel" onclick="window.cancelarTicket('${ticket.id}', '${ticket.idTicket}')" title="Cancelar ticket">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Obtiene el badge de estado
 */
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

/**
 * Obtiene el badge de prioridad
 */
function getPrioridadBadge(prioridad) {
    const prioridadLabels = {
        'alta': '🔴 Alta',
        'media': '🟡 Media',
        'baja': '🟢 Baja'
    };
    
    const label = prioridadLabels[prioridad] || prioridad || 'Media';
    const className = prioridad || 'media';
    
    return `<span class="rsi-badge-prioridad ${className}">${label}</span>`;
}

/**
 * Obtiene el badge de tipo
 */
function getTipoBadge(tipo) {
    const tipoLabels = {
        'operativo': 'Operativo',
        'administracion': 'Administración'
    };
    
    const label = tipoLabels[tipo] || tipo || 'Operativo';
    const className = tipo || 'operativo';
    
    return `<span class="rsi-badge-tipo ${className}">${label}</span>`;
}

/**
 * Obtiene el HTML de los colaboradores con nombres reales
 */
function getColaboradoresHtml(colaboradoresIds) {
    if (!colaboradoresIds || colaboradoresIds.length === 0) {
        return '<span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Sin asignar</span>';
    }
    
    const maxDisplay = 3;
    const displayCols = colaboradoresIds.slice(0, maxDisplay);
    const remaining = colaboradoresIds.length - maxDisplay;
    
    const getInitials = (nombre) => {
        if (!nombre) return '?';
        const parts = nombre.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return nombre.substring(0, 2).toUpperCase();
    };
    
    const tagsHtml = displayCols.map(id => {
        const col = colaboradoresMap[id] || null;
        const nombre = col ? col.nombre : 'Desconocido';
        const foto = col ? col.fotoPerfil : null;
        const iniciales = getInitials(nombre);
        
        return `
            <span class="rsi-colaborador-tag-mini" title="${nombre}">
                <span class="rsi-avatar-mini">
                    ${foto 
                        ? `<img src="${foto}" alt="${nombre}" onerror="this.style.display='none';this.parentElement.classList.add('fallback');this.parentElement.textContent='${iniciales}'">` 
                        : iniciales
                    }
                </span>
                ${nombre.length > 12 ? nombre.substring(0, 12) + '...' : nombre}
            </span>
        `;
    }).join('');
    
    let remainingHtml = '';
    if (remaining > 0) {
        remainingHtml = `<span class="rsi-colaborador-mas">+${remaining} más</span>`;
    }
    
    return `<div class="rsi-colaboradores-tags-mini">${tagsHtml}${remainingHtml}</div>`;
}

/**
 * Actualiza las estadísticas
 */
function updateStats(tickets) {
    const total = tickets.length;
    const pendientes = tickets.filter(t => t.estado === 'pendiente').length;
    const enProceso = tickets.filter(t => t.estado === 'en_proceso').length;
    const finalizados = tickets.filter(t => t.estado === 'finalizado').length;
    const cancelados = tickets.filter(t => t.estado === 'cancelado').length;
    
    const statTotal = document.getElementById('statTotal');
    const statPendientes = document.getElementById('statPendientes');
    const statEnProceso = document.getElementById('statEnProceso');
    const statFinalizados = document.getElementById('statFinalizados');
    const statCancelados = document.getElementById('statCancelados');
    
    if (statTotal) statTotal.textContent = total;
    if (statPendientes) statPendientes.textContent = pendientes;
    if (statEnProceso) statEnProceso.textContent = enProceso;
    if (statFinalizados) statFinalizados.textContent = finalizados;
    if (statCancelados) statCancelados.textContent = cancelados;
}

/**
 * Actualiza la paginación
 */
function updatePagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages} (${totalItems} items)`;
    }
}

/**
 * ✅ Cancela un ticket (agrega evento al historial automáticamente)
 */
async function cancelarTicket(ticketId, idTicket) {
    const result = await Swal.fire({
        title: '¿Cancelar ticket?',
        html: `
            <p>¿Estás seguro de que deseas cancelar el ticket <strong>${idTicket}</strong>?</p>
            <p style="font-size: 0.9rem; color: var(--rsi-gray-500);">Esta acción no se puede deshacer.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cancelar ticket',
        cancelButtonText: 'No, mantener'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const response = await service.deleteTicket(ticketId);
        
        if (response.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Ticket cancelado',
                text: `El ticket ${idTicket} ha sido cancelado exitosamente.`,
                confirmButtonColor: '#1c1948'
            });
            
            await loadTickets(true);
        } else {
            throw new Error(response.message || 'Error al cancelar el ticket');
        }
    } catch (error) {
        console.error('❌ Error cancelando ticket:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Ocurrió un error al cancelar el ticket.',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * ✅ Reactiva un ticket cancelado (agrega evento al historial automáticamente)
 */
async function reactivarTicket(ticketId, idTicket) {
    const result = await Swal.fire({
        title: '¿Reactivar ticket?',
        html: `
            <p>¿Estás seguro de que deseas reactivar el ticket <strong>${idTicket}</strong>?</p>
            <p style="font-size: 0.9rem; color: var(--rsi-gray-500);">El ticket volverá a estado <strong>Pendiente</strong>.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, reactivar ticket',
        cancelButtonText: 'No, mantener'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        // ✅ El service.reactivarTicket ya agrega el evento al historial
        const response = await service.reactivarTicket(ticketId);
        
        if (response.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Ticket reactivado',
                text: `El ticket ${idTicket} ha sido reactivado exitosamente.`,
                confirmButtonColor: '#1c1948'
            });
            
            await loadTickets(true);
        } else {
            throw new Error(response.message || 'Error al reactivar el ticket');
        }
    } catch (error) {
        console.error('❌ Error reactivando ticket:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Ocurrió un error al reactivar el ticket.',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyTicketsCrudController() {
    console.log('🧹 Destroying TicketsCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    delete window.cancelarTicket;
    delete window.reactivarTicket;
    
    service = null;
    colaboradoresMap = {};
}

export default ticketsCrudController;