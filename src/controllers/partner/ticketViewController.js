import CotizacionService from '../../services/cotizacionService.js';
/* ========================================
   TICKET VIEW CONTROLLER
   Controlador para ver detalle del ticket
   ======================================== */

import TicketService from '../../services/ticketService.js';
import TicketModel from '../../models/ticketModel.js';
import AuthService from '../../services/authService.js';
import GeoMapHelper from '../../utils/geoMapHelper.js';
import { abrirPDFReporteFotograficoTicket } from '../../utils/ticketPdfGenerator.js';
import { enableImageZoomInContainer, triggerImageZoom } from '../../utils/imageZoom.js';

let service = null;
let authService = null;
let ticketId = null;
let ticketData = null;
let colaboradoresMap = {};
let eventListeners = [];

/**
 * Controlador principal
 */
export async function ticketViewController() {
    console.log('Ticket View Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new TicketService();
    authService = new AuthService();
    
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
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudTickets');
            } else {
                window.location.href = '/partner/crudTickets';
            }
        });
        return;
    }
    
    await loadColaboradores();
    await loadTicketData();
    initBackButton();
    initReporteFotograficoButton();
    initEditButton();
}

async function loadColaboradores() {
    try {
        const colaboradores = await service.getColaboradoresForSelect();
        colaboradoresMap = {};
        colaboradores.forEach(col => {
            if (col.id) colaboradoresMap[col.id] = col;
            if (col.uid) colaboradoresMap[col.uid] = col;
            if (col.docId) colaboradoresMap[col.docId] = col;
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

        // Validación de permisos de acceso: todos los usuarios con sesión activa pueden ver los tickets
        const session = authService.getSession();
        if (!session || !session.uid) {
            showLoading(false);
            await Swal.fire({
                icon: 'warning',
                title: 'Sesión Requerida',
                text: 'Debes iniciar sesión para consultar este ticket',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/login');
            } else {
                window.location.href = '/login';
            }
            return;
        }
        
        console.log('📋 Datos del ticket:', ticketData);

        // Completar colaboradores en colaboradoresMap si hay alguno faltante
        const colabIds = ticketData.colaboradoresIds || [];
        for (const cId of colabIds) {
            if (!colaboradoresMap[cId]) {
                try {
                    const directCol = await service.partnerRepository.getCollaboratorByUid(cId);
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
                        colaboradoresMap[cId] = mapped;
                        if (mapped.id) colaboradoresMap[mapped.id] = mapped;
                        if (mapped.uid) colaboradoresMap[mapped.uid] = mapped;
                        if (mapped.docId) colaboradoresMap[mapped.docId] = mapped;
                    }
                } catch (e) {
                    console.warn('⚠️ No se pudo obtener colaborador por UID en ticketView:', cId);
                }
            }
        }
        
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
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudTickets');
            } else {
                window.location.href = '/partner/crudTickets';
            }
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
    const respColab = ticketData.responsableId ? (colaboradoresMap[ticketData.responsableId] || null) : null;
    const respFoto = respColab?.fotoPerfil || null;
    const respEl = document.getElementById('viewResponsable');
    if (respEl) {
        if (respFoto && ticketData.responsableNombre) {
            respEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${respFoto}" alt="${ticketData.responsableNombre}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--rsi-gray-300);" onerror="this.remove();" />
                    <span>${ticketData.responsableNombre}</span>
                </div>
            `;
        } else {
            respEl.textContent = ticketData.responsableNombre || 'Sin asignar';
        }
    }
    document.getElementById('viewCreadoPor').textContent = ticketData.creadoPorNombre || 'Sistema';
    document.getElementById('viewModificadoPor').textContent = ticketData.modificadoPor || ticketData.creadoPor || 'Sistema';
    
    document.getElementById('viewFechaCreacion').textContent = formatDate(ticketData.fechaCreacion);
    document.getElementById('viewFechaActualizacion').textContent = formatDate(ticketData.fechaActualizacion);
    document.getElementById('viewFechaInicio').textContent = formatDate(ticketData.fechaInicio) || 'No definida';
    document.getElementById('viewFechaFin').textContent = formatDate(ticketData.fechaFin || ticketData.fechaFinalizacion) || 'No definida';
    
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
        const cotizacionEl = document.getElementById('viewCotizacion');
        if (cotizacionEl) {
            if (ticketData.cotizacionNumero) {
                cotizacionEl.innerHTML = `
                    <span style="font-weight: 600; color: var(--rsi-primary);"><i class="fas fa-file-invoice"></i> ${ticketData.cotizacionNumero}</span>
                    <button type="button" class="rsi-btn-icon" id="btnVerCotizacionDesdeTicketView" style="margin-left: 8px; font-size: 0.85rem;" title="Ver cotización">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button type="button" class="rsi-btn-icon" id="btnDesvincularCotizacionDesdeTicketView" style="margin-left: 4px; font-size: 0.85rem; color: #ef4444;" title="Desvincular cotización">
                        <i class="fas fa-unlink"></i>
                    </button>
                `;
                document.getElementById('btnVerCotizacionDesdeTicketView')?.addEventListener('click', () => {
                    const url = ticketData.cotizacionId ? `/partner/cotizacion?id=${ticketData.cotizacionId}` : '/partner/crudCotizaciones';
                    if (window.navigateTo) window.navigateTo(url);
                    else window.location.href = url;
                });
                document.getElementById('btnDesvincularCotizacionDesdeTicketView')?.addEventListener('click', async () => {
                    const confirm = await Swal.fire({
                        title: '¿Desvincular cotización?',
                        text: `Se desvinculará la cotización ${ticketData.cotizacionNumero} de este ticket.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, desvincular',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#dc2626'
                    });
                    if (confirm.isConfirmed) {
                        await service.desvincularCotizacion(ticketData.id, ticketData.cotizacionId);
                        ticketData.cotizacionNumero = '';
                        ticketData.cotizacionId = null;
                        await loadTicket();
                        Swal.fire({ icon: 'success', title: 'Cotización desvinculada', timer: 1500, showConfirmButton: false });
                    }
                });
            } else {
                cotizacionEl.innerHTML = `
                    <span style="color: var(--rsi-gray-400);">No asociada</span>
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-outline" id="btnVincularCotizacionDesdeTicketView" style="margin-left: 8px; padding: 2px 8px; font-size: 0.75rem;">
                        <i class="fas fa-link"></i> Vincular
                    </button>
                `;
                document.getElementById('btnVincularCotizacionDesdeTicketView')?.addEventListener('click', async () => {
                    try {
                        const cotiService = new CotizacionService();
                        const cotizaciones = await cotiService.getAllCotizaciones();
                        if (!cotizaciones || cotizaciones.length === 0) {
                            Swal.fire({ icon: 'info', title: 'Sin cotizaciones', text: 'No hay cotizaciones para vincular.' });
                            return;
                        }
                        const optionsHtml = cotizaciones.map(c => `<option value="${c.id}" data-num="${c.cotizacionNumero}">${c.cotizacionNumero || 'S/N'} - ${c.clienteNombre || 'Sin cliente'}</option>`).join('');
                        const { value: sel } = await Swal.fire({
                            title: 'Vincular Cotización',
                            html: `<select id="swalCotiViewSel" class="swal2-input"><option value="">-- Selecciona cotización --</option>${optionsHtml}</select>`,
                            showCancelButton: true,
                            confirmButtonText: 'Vincular',
                            confirmButtonColor: '#1c1948',
                            preConfirm: () => {
                                const el = document.getElementById('swalCotiViewSel');
                                if (!el.value) { Swal.showValidationMessage('Selecciona una cotización'); return false; }
                                return { id: el.value, num: el.options[el.selectedIndex].dataset.num };
                            }
                        });
                        if (sel) {
                            await service.vincularCotizacion(ticketData.id, sel.id, sel.num);
                            await loadTicket();
                            Swal.fire({ icon: 'success', title: 'Vinculada con éxito', timer: 1500, showConfirmButton: false });
                        }
                    } catch (e) {
                        Swal.fire({ icon: 'error', title: 'Error', text: e.message });
                    }
                });
            }
        }
    } else {
        document.getElementById('viewOperativoFields').style.display = 'none';
        document.getElementById('viewAdminFields').style.display = 'block';
        document.getElementById('viewFechaEstimada').textContent = formatDate(ticketData.fechaFinalizacionEstimada) || 'No definida';
    }
    
    renderColaboradores();
    renderActividadesDesarrolladas();
    renderEvidencias();
    renderComentarios();
}

function renderColaboradores() {
    const container = document.getElementById('viewColaboradores');
    if (!container) return;
    
    const colaboradoresIds = ticketData.colaboradoresIds || [];
    const aceptaciones = TicketModel.normalizeAceptaciones(ticketData);
    
    if (colaboradoresIds.length === 0 && aceptaciones.length === 0) {
        container.innerHTML = '<span style="color: var(--rsi-text-secondary);">Sin colaboradores asignados</span>';
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
        const nombre = col ? col.nombre : (index === 0 && ticketData.responsableNombre ? ticketData.responsableNombre : 'Colaborador');
        const area = col ? (col.area || '') : '';
        const iniciales = getInitials(nombre);
        const isResponsable = index === 0;
        const candidateIds = [id, col?.id, col?.uid, col?.docId].filter(Boolean);
        const acc = aceptaciones.find(a =>
            candidateIds.includes(a.colaboradorId) || (a.uid && candidateIds.includes(a.uid))
        );
        const hasAccepted = Boolean(acc);
        const hasGeo = acc?.ubicacion?.latitud != null && acc?.ubicacion?.longitud != null;
        
        const fotoPerfil = col?.fotoPerfil || acc?.fotoPerfil || null;
        const hasPhoto = Boolean(fotoPerfil);

        return `
            <div class="ta-collab-item ${hasAccepted ? 'accepted' : 'pending'}">
                <div class="ta-collab-profile">
                    <div class="ta-collab-avatar ${hasPhoto ? 'has-photo' : ''}">
                        ${hasPhoto ? `<img src="${fotoPerfil}" alt="${nombre}" onerror="this.parentElement.classList.remove('has-photo'); this.remove();" />` : ''}
                        <span>${iniciales}</span>
                    </div>
                    <div class="ta-collab-meta">
                        <h4>
                            ${nombre}
                            ${isResponsable ? '<span class="ta-status-pill accepted" style="font-size:0.65rem;"><i class="fas fa-star"></i> Responsable</span>' : ''}
                        </h4>
                        <span>${area || 'Asignado'}</span>
                        ${acc?.comentario ? `<span style="margin-top:0.2rem; color: var(--rsi-text-primary); font-style: italic;">"${acc.comentario}"</span>` : ''}
                    </div>
                </div>
                <div class="ta-collab-status">
                    ${hasAccepted ? `
                        <span class="ta-status-pill accepted"><i class="fas fa-check-circle"></i> Aceptado</span>
                        <span style="font-size: 0.72rem; color: var(--rsi-text-secondary);">${formatDateTime(acc.fechaAceptacion)}</span>
                        ${hasGeo ? `<button type="button" class="ta-geo-btn" data-view-acc-id="${acc.id}"><i class="fas fa-map-marker-alt"></i> Ver GPS</button>` : ''}
                    ` : `
                        <span class="ta-status-pill pending"><i class="fas fa-hourglass-half"></i> Pendiente de aceptar</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;

    container.querySelectorAll('[data-view-acc-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const accId = btn.getAttribute('data-view-acc-id');
            const targetAcc = aceptaciones.find(a => a.id === accId);
            if (targetAcc?.ubicacion) {
                GeoMapHelper.mostrarModalMapa(
                    targetAcc.ubicacion,
                    `Aceptación: ${targetAcc.nombre}`,
                    formatDateTime(targetAcc.fechaAceptacion)
                );
            }
        });
    });
}

function renderActividadesDesarrolladas() {
    const container = document.getElementById('viewActividadesDesarrolladas');
    if (!container) return;

    const texto = (ticketData.actividadesDesarrolladas || '').trim();
    if (!texto) {
        container.innerHTML = '<span style="color: var(--rsi-text-secondary);">Aún no se han registrado actividades desarrolladas para este ticket.</span>';
        return;
    }

    const meta = ticketData.ultimaActualizacionActividadesFecha
        ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--rsi-text-secondary);">
               <i class="fas fa-user-edit"></i> Actualizado por <strong>${ticketData.ultimaActualizacionActividadesPor || 'Colaborador'}</strong> el ${formatDateTime(ticketData.ultimaActualizacionActividadesFecha)}
           </div>`
        : '';

    container.innerHTML = `<div>${texto}</div>${meta}`;
}

function renderEvidencias() {
    const container = document.getElementById('viewEvidenciasContainer');
    if (!container) return;

    const evidencias = TicketModel.normalizeEvidencias(ticketData);
    const stages = [
        { key: 'antes', label: '1. Evidencias del Antes', chip: 'Antes', icon: 'fa-hourglass-start' },
        { key: 'durante', label: '2. Evidencias del Durante', chip: 'Durante', icon: 'fa-tools' },
        { key: 'despues', label: '3. Evidencias del Después', chip: 'Después', icon: 'fa-check-double' }
    ];

    container.innerHTML = stages.map(({ key, label, chip, icon }) => {
        const items = evidencias[key] || [];
        return `
            <div style="background: var(--rsi-bg-secondary); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-md);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--rsi-spacing-sm);">
                    <strong style="color: var(--rsi-text-primary); font-size: 0.92rem;">
                        <i class="fas ${icon}" style="color: var(--rsi-primary);"></i> ${label}
                    </strong>
                    <span class="ta-status-pill ${items.length > 0 ? 'accepted' : 'pending'}">
                        ${items.length} foto${items.length === 1 ? '' : 's'}
                    </span>
                </div>
                ${items.length === 0 ? `
                    <p style="margin: 0; font-size: 0.82rem; color: var(--rsi-text-secondary);">
                        Sin evidencias subidas en esta etapa.
                    </p>
                ` : `
                    <div class="ta-evidence-grid">
                        ${items.map(ev => {
                            const hasGeo = ev.ubicacion?.latitud != null && ev.ubicacion?.longitud != null;
                            const previewTitle = `Evidencia ${chip} — ${ev.subidoPorNombre || 'Colaborador'} (${ev.fechaHora || formatDateTime(ev.fechaSubida)})`;
                            return `
                                <article class="ta-evidence-card">
                                    <div class="ta-evidence-thumb-wrap" data-preview-title="${previewTitle}" title="Haz clic para abrir en pantalla completa y hacer zoom">
                                        <img src="${ev.url}" alt="${previewTitle}" class="ta-evidence-thumb" loading="lazy" />
                                        <span class="ta-evidence-stage-chip ${key}">${chip}</span>
                                    </div>
                                    <div class="ta-evidence-body">
                                        <div class="ta-evidence-author">
                                            <i class="fas fa-user-check"></i> ${ev.subidoPorNombre || 'Colaborador'}
                                        </div>
                                        <div class="ta-evidence-date">
                                            <i class="fas fa-clock"></i> ${ev.fechaHora || formatDateTime(ev.fechaSubida)}
                                        </div>
                                        ${ev.descripcion ? `<p class="ta-evidence-desc">${ev.descripcion}</p>` : ''}
                                        <div class="ta-evidence-footer">
                                            ${hasGeo ? `
                                                <button type="button" class="ta-geo-btn" data-view-ev-stage="${key}" data-view-ev-id="${ev.id}">
                                                    <i class="fas fa-map-marker-alt"></i> Ver GPS
                                                </button>
                                            ` : `<span style="font-size:0.7rem; color: var(--rsi-text-muted);">Sin GPS</span>`}
                                            <button type="button" class="ta-geo-btn" data-zoom-ev-btn="true" title="Abrir en pantalla completa y hacer zoom">
                                                <i class="fas fa-expand"></i> Pantalla Completa / Zoom
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    }).join('');

    enableImageZoomInContainer(container);

    container.querySelectorAll('[data-zoom-ev-btn]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.ta-evidence-card');
            const img = card?.querySelector('img.ta-evidence-thumb');
            if (img) {
                triggerImageZoom(img, 'toggle');
            }
        });
    });

    container.querySelectorAll('[data-view-ev-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const st = btn.getAttribute('data-view-ev-stage');
            const evId = btn.getAttribute('data-view-ev-id');
            const evObj = (evidencias[st] || []).find(x => x.id === evId);
            if (evObj?.ubicacion) {
                GeoMapHelper.mostrarModalMapa(
                    evObj.ubicacion,
                    `Evidencia (${evObj.subidoPorNombre || 'Colaborador'})`,
                    evObj.fechaHora || formatDateTime(evObj.fechaSubida)
                );
            }
        });
    });
}

function renderComentarios() {
    const container = document.getElementById('viewComentariosContainer');
    if (!container) return;

    const comentarios = Array.isArray(ticketData.comentarios) ? [...ticketData.comentarios] : [];
    comentarios.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    if (comentarios.length === 0) {
        container.innerHTML = '<span style="color: var(--rsi-text-secondary); font-size: 0.88rem;">Sin comentarios registrados en este ticket.</span>';
        return;
    }

    container.innerHTML = comentarios.map(c => `
        <div class="ta-comment-item">
            <div class="ta-comment-header">
                <span class="ta-comment-author">
                    <i class="fas fa-user-circle"></i> ${c.autorNombre || 'Colaborador'}
                    ${c.puesto ? `<small style="color: var(--rsi-text-secondary); font-weight: normal;">(${c.puesto})</small>` : ''}
                </span>
                <span class="ta-comment-date">${formatDateTime(c.fecha)}</span>
            </div>
            <p class="ta-comment-text">${c.texto || ''}</p>
        </div>
    `).join('');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return dateString;
    }
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
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/partner/crudTickets');
        } else {
            window.location.href = '/partner/crudTickets';
        }
    };
    backBtn.addEventListener('click', handler);
    eventListeners.push({ element: backBtn, event: 'click', handler });
}

function initReporteFotograficoButton() {
    const buttons = [
        document.getElementById('btnReporteFotograficoTop'),
        document.getElementById('reporteFotograficoBtn')
    ].filter(Boolean);

    if (buttons.length === 0) return;

    const handler = async () => {
        if (!ticketData) return;

        // Validar que el ticket esté cerrado (finalizado o abandonado)
        if (ticketData.estado !== 'finalizado' && ticketData.estado !== 'abandonado') {
            await Swal.fire({
                icon: 'warning',
                title: 'Ticket en proceso',
                text: 'El reporte fotográfico PDF de este ticket no se puede generar si no se ha cerrado el ticket.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            return;
        }

        // Si ya existe el reporte fotográfico almacenado en Storage, abrirlo directamente sin volver a generarlo
        if (ticketData.reporteFotograficoUrl) {
            window.open(ticketData.reporteFotograficoUrl, '_blank');
            return;
        }

        try {
            Swal.fire({
                title: 'Generando y almacenando Reporte Fotográfico PDF...',
                text: 'Procesando fotografías de evidencia y guardando el reporte en Firebase Storage.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await service.generarYGuardarReporteFotografico(ticketData.id || ticketId);
            if (!res.success) {
                throw new Error(res.error || 'No se pudo generar el reporte fotográfico.');
            }

            if (res.pdfUrl) {
                ticketData.reporteFotograficoUrl = res.pdfUrl;
                ticketData.reporteFotograficoPath = res.pdfPath;
            }

            Swal.close();

            const targetUrl = res.pdfUrl || (res.pdfBlob ? URL.createObjectURL(res.pdfBlob) : null);
            if (targetUrl) {
                const win = window.open(targetUrl, '_blank');
                if (!win && res.pdfBlob) {
                    const folio = (ticketData?.idTicket || ticketId || 'Ticket').replace(/[^a-zA-Z0-9_-]/g, '_');
                    const blobUrl = URL.createObjectURL(res.pdfBlob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `Reporte-Fotografico-${folio}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                }
            }

            if (!res.alreadyExists) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Reporte Fotográfico PDF almacenado en Storage',
                    showConfirmButton: false,
                    timer: 2500
                });
            }
        } catch (error) {
            console.error('❌ Error generando reporte fotográfico PDF:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al generar PDF',
                text: error.message || 'No se pudo generar el reporte fotográfico en PDF.',
                confirmButtonColor: '#d33'
            });
        }
    };

    buttons.forEach(btn => {
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

function initEditButton() {
    const editBtn = document.getElementById('editBtn');
    if (!editBtn) return;
    
    const handler = () => {
        const dest = (ticketData && ticketData.id) 
            ? `/partner/ticket?id=${ticketData.id}` 
            : '/partner/crudTickets';
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(dest);
        } else {
            window.location.href = dest;
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