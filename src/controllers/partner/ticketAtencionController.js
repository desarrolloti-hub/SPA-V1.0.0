/* ==========================================================================
   TICKET ATENCIÓN CONTROLLER - RSI Enterprise
   Vista operativa de colaborador para aceptar el ticket, registrar
   comentarios, subir evidencias con marca de agua (Antes, Durante, Después),
   documentar actividades desarrolladas y cerrar el ticket.
   ========================================================================== */

import TicketService from '../../services/ticketService.js';
import TicketModel from '../../models/ticketModel.js';
import GeoMapHelper from '../../utils/geoMapHelper.js';
import TicketWatermarkHelper from '../../utils/ticketWatermark.js';
import { abrirPDFReporteFotograficoTicket } from '../../utils/ticketPdfGenerator.js';
import { enableImageZoomInContainer, triggerImageZoom } from '../../utils/imageZoom.js';

export class TicketAtencionController {
    constructor() {
        this.service = new TicketService();
        this.ticketId = null;
        this.ticket = null;
        this.collabContext = null;
        this.activeStage = 'antes';

        // Estado del modal de cámara / marca de agua
        this.cameraStream = null;
        this.cameraFacingMode = 'environment';
        this.pendingStage = 'antes';
        this.pendingWatermarkResult = null;
        this.usedLiveCamera = false;

        this._boundCleanup = () => this.stopCameraStream();
    }

    async init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.ticketId = urlParams.get('id');

            if (!this.ticketId) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Ticket no especificado',
                    text: 'No se proporcionó el identificador del ticket a atender.',
                    confirmButtonColor: 'var(--rsi-primary)'
                });
                this._navigateTo('/partner/dashboard');
                return;
            }

            document.addEventListener('route:changing', this._boundCleanup, { once: true });

            this.setupEventListeners();
            this.collabContext = await this.service._resolveCurrentCollaboratorContext();
            await this.loadTicketData();
        } catch (error) {
            console.error('❌ Error inicializando TicketAtencionController:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al cargar el ticket',
                text: error.message || 'No fue posible cargar la vista de atención del ticket.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    _navigateTo(path) {
        this.stopCameraStream();
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(path);
        } else if (window.router && typeof window.router.navigate === 'function') {
            window.router.navigate(path);
        } else {
            window.location.href = path;
        }
    }

    setupEventListeners() {
        // Navegación superior
        document.getElementById('btnVolverDashboard')?.addEventListener('click', () => {
            this._navigateTo('/partner/dashboard');
        });

        document.getElementById('btnRecargarTicket')?.addEventListener('click', async () => {
            this.service.clearCache();
            await this.loadTicketData(true);
        });

        document.getElementById('btnReporteFotograficoPdf')?.addEventListener('click', () => {
            this.handleGenerarReporteFotografico();
        });

        document.getElementById('btnReporteFotograficoCard')?.addEventListener('click', () => {
            this.handleGenerarReporteFotografico();
        });

        // Aceptar Ticket
        document.getElementById('btnAceptarTicket')?.addEventListener('click', () => {
            this.handleAceptarTicket();
        });

        // Pestañas de Etapas (Antes, Durante, Después)
        document.querySelectorAll('[data-stage-tab]').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                const stage = tabBtn.getAttribute('data-stage-tab');
                this.switchStageTab(stage);
            });
        });

        // Botones para abrir directamente la cámara del dispositivo por etapa
        document.querySelectorAll('.btn-open-camera').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!(await this._ensureTicketAcceptedOrPrompt())) return;
                const stage = btn.getAttribute('data-stage') || 'antes';
                this.pendingStage = stage;
                const inputId = stage === 'antes'
                    ? 'fileInputAntes'
                    : stage === 'durante'
                        ? 'fileInputDurante'
                        : 'fileInputDespues';
                const fileInput = document.getElementById(inputId);
                if (fileInput) {
                    fileInput.setAttribute('capture', 'environment');
                    fileInput.value = '';
                    fileInput.click();
                }
            });
        });

        // Botones para seleccionar archivo o galería del dispositivo
        document.querySelectorAll('.btn-select-file').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!(await this._ensureTicketAcceptedOrPrompt())) return;
                const stage = btn.getAttribute('data-stage') || 'antes';
                this.pendingStage = stage;
                const inputId = stage === 'antes'
                    ? 'fileInputAntes'
                    : stage === 'durante'
                        ? 'fileInputDurante'
                        : 'fileInputDespues';
                const fileInput = document.getElementById(inputId);
                if (fileInput) {
                    fileInput.removeAttribute('capture');
                    fileInput.value = '';
                    fileInput.click();
                }
            });
        });

        // Listeners de inputs de archivo por etapa
        ['antes', 'durante', 'despues'].forEach(stage => {
            const inputId = stage === 'antes'
                ? 'fileInputAntes'
                : stage === 'durante'
                    ? 'fileInputDurante'
                    : 'fileInputDespues';
            const inputEl = document.getElementById(inputId);
            inputEl?.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!(await this._ensureTicketAcceptedOrPrompt())) {
                    e.target.value = '';
                    return;
                }
                this.handleFileSelectedForStage(stage, file);
            });
        });

        // Controles del Modal de Cámara y Marca de Agua
        document.getElementById('btnCloseCameraModal')?.addEventListener('click', () => {
            this.closeCameraModal();
        });

        document.getElementById('btnSwitchCamera')?.addEventListener('click', () => {
            this.cameraFacingMode = this.cameraFacingMode === 'environment' ? 'user' : 'environment';
            this.startLiveCamera();
        });

        document.getElementById('btnTakeSnapshot')?.addEventListener('click', () => {
            this.captureSnapshotFromVideo();
        });

        document.getElementById('btnRetakePhoto')?.addEventListener('click', () => {
            this.resetModalToCaptureMode();
        });

        document.getElementById('btnConfirmUploadEvidencia')?.addEventListener('click', () => {
            this.confirmAndUploadPendingEvidencia();
        });

        // Actividades desarrolladas
        const actividadesInput = document.getElementById('taActividadesInput');
        actividadesInput?.addEventListener('input', () => {
            this.renderClosureChecklist();
        });

        document.getElementById('btnGuardarActividades')?.addEventListener('click', () => {
            this.handleGuardarActividades();
        });

        // Comentarios
        document.getElementById('btnAgregarComentario')?.addEventListener('click', () => {
            this.handleAgregarComentario();
        });

        // Cerrar / Finalizar Ticket
        document.getElementById('btnCerrarTicket')?.addEventListener('click', () => {
            this.handleCerrarTicket();
        });
    }

    async loadTicketData(showToast = false) {
        const ticket = await this.service.getTicketConDetalles(this.ticketId);
        if (!ticket) {
            await Swal.fire({
                icon: 'error',
                title: 'Ticket no encontrado',
                text: 'El ticket solicitado no existe o fue eliminado.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            this._navigateTo('/partner/dashboard');
            return;
        }

        this.ticket = ticket;
        this.renderHeaderAndAcceptance();
        this.renderTicketInfo();
        this.renderCollaboratorsAcceptances();
        this.renderEvidenciasSection();
        this.renderActividadesSection();
        this.renderClosureChecklist();
        this.renderComentarios();
        this.renderHistorial();

        if (showToast) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Información del ticket actualizada',
                showConfirmButton: false,
                timer: 1800
            });
        }
    }

    _hasCurrentUserAccepted() {
        const aceptaciones = Array.isArray(this.ticket?.aceptaciones) ? this.ticket.aceptaciones : [];
        const userIds = this.collabContext?.userIds || [];
        if (userIds.length === 0) return false;
        return aceptaciones.some(a =>
            userIds.includes(a.colaboradorId) || (a.uid && userIds.includes(a.uid))
        );
    }

    _getCurrentUserAcceptance() {
        const aceptaciones = Array.isArray(this.ticket?.aceptaciones) ? this.ticket.aceptaciones : [];
        const userIds = this.collabContext?.userIds || [];
        return aceptaciones.find(a =>
            userIds.includes(a.colaboradorId) || (a.uid && userIds.includes(a.uid))
        ) || null;
    }

    /**
     * Verifica si el colaborador ya aceptó el ticket. Si no lo ha aceptado,
     * bloquea la acción y le ofrece aceptarlo de inmediato.
     */
    async _ensureTicketAcceptedOrPrompt() {
        if (this._hasCurrentUserAccepted()) return true;

        const res = await Swal.fire({
            icon: 'warning',
            title: 'Primero debes aceptar el ticket',
            text: 'No puedes agregar comentarios, subir evidencias ni registrar actividades hasta que aceptes formalmente el ticket.',
            showCancelButton: true,
            confirmButtonText: 'Aceptar Ticket Ahora',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: 'var(--rsi-primary)'
        });

        if (res.isConfirmed) {
            await this.handleAceptarTicket();
        }
        return false;
    }

    renderHeaderAndAcceptance() {
        const t = this.ticket;
        const isClosed = t.estado === 'finalizado' || t.estado === 'cancelado';

        const idEl = document.getElementById('taIdTicket');
        if (idEl) idEl.textContent = t.idTicket || t.id;

        const tipoBadge = document.getElementById('taTipoBadge');
        if (tipoBadge) {
            tipoBadge.innerHTML = `<i class="fas ${t.tipoTicket === 'solicitud' ? 'fa-building' : 'fa-tools'}"></i> <span>${t.tipoTicket === 'solicitud' ? 'Solicitud Interna' : 'Operación'}</span>`;
        }

        const prioBadge = document.getElementById('taPrioridadBadge');
        const prioLabels = { baja: 'Prioridad Baja', media: 'Prioridad Media', alta: 'Prioridad Alta', urgente: 'Urgente' };
        if (prioBadge) {
            prioBadge.className = `ta-badge prioridad-${t.prioridad || 'media'}`;
            prioBadge.innerHTML = `<i class="fas fa-flag"></i> <span>${prioLabels[t.prioridad] || 'Media'}</span>`;
        }

        const estadoBadge = document.getElementById('taEstadoBadge');
        const estadoLabels = {
            pendiente: 'Pendiente',
            en_proceso: 'En Proceso',
            espera: 'En Espera',
            finalizado: 'Finalizado',
            cancelado: 'Cancelado'
        };
        const estadoIcons = {
            pendiente: 'fa-clock',
            en_proceso: 'fa-spinner',
            espera: 'fa-pause-circle',
            finalizado: 'fa-check-circle',
            cancelado: 'fa-ban'
        };
        if (estadoBadge) {
            estadoBadge.className = `ta-badge estado-${t.estado || 'pendiente'}`;
            estadoBadge.innerHTML = `<i class="fas ${estadoIcons[t.estado] || 'fa-clock'}"></i> <span>${estadoLabels[t.estado] || t.estado}</span>`;
        }

        // Banner de aceptación
        const banner = document.getElementById('taAcceptanceBanner');
        const iconEl = document.getElementById('taAcceptanceIcon');
        const titleEl = document.getElementById('taAcceptanceTitle');
        const descEl = document.getElementById('taAcceptanceDesc');
        const actionsEl = document.getElementById('taAcceptanceActions');

        const myAcc = this._getCurrentUserAcceptance();

        if (isClosed) {
            banner.className = 'ta-acceptance-banner is-closed';
            iconEl.innerHTML = '<i class="fas fa-lock"></i>';
            titleEl.textContent = `Ticket ${t.estado === 'finalizado' ? 'Finalizado y Cerrado' : 'Cancelado'}`;
            descEl.textContent = t.fechaFinalizacion
                ? `Cerrado el ${this._formatDateTime(t.fechaFinalizacion)}${t.cerradoPorNombre ? ` por ${t.cerradoPorNombre}` : ''}.`
                : 'Este ticket ya no admite modificaciones operativas.';
            actionsEl.innerHTML = '';
        } else if (myAcc) {
            banner.className = 'ta-acceptance-banner is-accepted';
            iconEl.innerHTML = '<i class="fas fa-user-check"></i>';
            titleEl.textContent = 'Ya aceptaste este ticket';
            descEl.textContent = `Confirmado el ${this._formatDateTime(myAcc.fechaAceptacion)}. Ya puedes subir las fotos de Antes, Durante y Después, agregar comentarios y registrar tus actividades.`;
            if (myAcc.ubicacion && myAcc.ubicacion.latitud != null) {
                actionsEl.innerHTML = `
                    <button type="button" class="ta-btn ta-btn-secondary" id="btnVerMiUbicacionAceptacion">
                        <i class="fas fa-map-marked-alt"></i> Ver Ubicación de Aceptación
                    </button>
                `;
                document.getElementById('btnVerMiUbicacionAceptacion')?.addEventListener('click', () => {
                    GeoMapHelper.mostrarModalMapa(
                        myAcc.ubicacion,
                        `Aceptación de ${myAcc.nombre}`,
                        this._formatDateTime(myAcc.fechaAceptacion)
                    );
                });
            } else {
                actionsEl.innerHTML = `<span class="ta-status-pill accepted"><i class="fas fa-check"></i> En atención activa</span>`;
            }
        } else {
            banner.className = 'ta-acceptance-banner is-pending';
            iconEl.innerHTML = '<i class="fas fa-hand-point-right"></i>';
            titleEl.textContent = 'Ticket pendiente de tu aceptación (Edición bloqueada)';
            descEl.textContent = 'Debes hacer clic en "Aceptar Ticket Ahora" para desbloquear el ingreso de comentarios, fotografías de evidencia y actividades.';
            actionsEl.innerHTML = `
                <button type="button" class="ta-btn ta-btn-primary" id="btnAceptarTicket">
                    <i class="fas fa-check-circle"></i> Aceptar Ticket Ahora
                </button>
            `;
            document.getElementById('btnAceptarTicket')?.addEventListener('click', () => {
                this.handleAceptarTicket();
            });
        }
    }

    renderTicketInfo() {
        const t = this.ticket;

        const fechaHeader = document.getElementById('taFechaCreacionHeader');
        if (fechaHeader) {
            fechaHeader.textContent = `Creado: ${this._formatDateTime(t.fechaCreacion)}`;
        }

        const motivoEl = document.getElementById('taMotivoValor');
        if (motivoEl) motivoEl.textContent = t.motivoLabel || t.motivo || 'Sin especificar';

        const fechaProgEl = document.getElementById('taFechaProgramadaValor');
        if (fechaProgEl) {
            fechaProgEl.textContent = t.fechaProgramada ? this._formatDateOnly(t.fechaProgramada) : 'Atención inmediata';
        }

        const clienteLabel = document.getElementById('taClienteLabel');
        const clienteValor = document.getElementById('taClienteValor');
        const contactoLabel = document.getElementById('taContactoLabel');
        const contactoValor = document.getElementById('taContactoValor');
        const ubicacionCont = document.getElementById('taUbicacionClienteContainer');
        const direccionValor = document.getElementById('taDireccionClienteValor');
        const linkMapa = document.getElementById('taLinkMapaCliente');

        if (t.tipoTicket === 'operacion') {
            if (clienteLabel) clienteLabel.textContent = 'Cliente';
            if (clienteValor) {
                clienteValor.textContent = t.cliente?.nombreEmpresa || t.clienteNombre || 'Cliente General';
            }
            if (contactoLabel) contactoLabel.textContent = 'Contacto / Correo';
            if (contactoValor) {
                const tel = t.cliente?.telefonoContacto || t.clienteTelefono || '';
                const resp = t.cliente?.nombreResponsable || '';
                contactoValor.textContent = [resp, tel].filter(Boolean).join(' · ') || 'No especificado';
            }

            const coords = t.cliente?.coordenadas || t.coordenadas || '';
            if (coords) {
                if (ubicacionCont) ubicacionCont.style.display = 'block';
                if (direccionValor) direccionValor.textContent = coords;
                if (linkMapa) {
                    linkMapa.style.display = 'inline-flex';
                    linkMapa.href = coords.startsWith('http')
                        ? coords
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
                }
            } else {
                if (ubicacionCont) ubicacionCont.style.display = 'none';
            }
        } else {
            if (clienteLabel) clienteLabel.textContent = 'Solicitante';
            if (clienteValor) {
                clienteValor.textContent = t.solicitante?.nombreCompleto || t.creadoPorNombre || 'Interno';
            }
            if (contactoLabel) contactoLabel.textContent = 'Área Destino';
            if (contactoValor) {
                contactoValor.textContent = t.areaNombre || 'General';
            }
            if (ubicacionCont) ubicacionCont.style.display = 'none';
        }

        const descEl = document.getElementById('taDescripcionValor');
        if (descEl) {
            descEl.textContent = t.descripcion || 'Sin descripción adicional.';
        }
    }

    renderCollaboratorsAcceptances() {
        const listEl = document.getElementById('taCollabList');
        const subtitleEl = document.getElementById('taCollabSummarySubtitle');
        if (!listEl) return;

        const colaboradores = Array.isArray(this.ticket.colaboradores) ? this.ticket.colaboradores : [];
        const aceptaciones = Array.isArray(this.ticket.aceptaciones) ? this.ticket.aceptaciones : [];

        const acceptedCount = aceptaciones.length;
        if (subtitleEl) {
            subtitleEl.textContent = `${acceptedCount} de ${Math.max(colaboradores.length, acceptedCount)} colaborador(es) han aceptado el ticket`;
        }

        if (colaboradores.length === 0 && aceptaciones.length === 0) {
            listEl.innerHTML = `<div class="ta-empty-stage"><p>No hay colaboradores asignados registrados.</p></div>`;
            return;
        }

        const renderedIds = new Set();
        const itemsHtml = [];

        colaboradores.forEach((col) => {
            const colIds = [col.id, col.uid, col.collaboratorId].filter(Boolean);
            colIds.forEach(id => renderedIds.add(id));

            const acc = aceptaciones.find(a =>
                colIds.includes(a.colaboradorId) || (a.uid && colIds.includes(a.uid))
            );
            const isResp = col.esResponsable || col.id === this.ticket.responsableId;
            itemsHtml.push(this._buildCollabAcceptanceItemHtml({
                nombre: col.nombreCompleto || `${col.nombres || ''} ${col.apellidos || ''}`.trim() || 'Colaborador',
                puesto: col.puestoNombre || col.puesto || col.area || 'Asignado',
                esResponsable: isResp,
                aceptacion: acc,
                fotoPerfil: col.fotoPerfil || acc?.fotoPerfil || null
            }));
        });

        aceptaciones.forEach((acc) => {
            if (!renderedIds.has(acc.colaboradorId) && (!acc.uid || !renderedIds.has(acc.uid))) {
                itemsHtml.push(this._buildCollabAcceptanceItemHtml({
                    nombre: acc.nombre || 'Colaborador',
                    puesto: acc.puesto || 'Atención de Ticket',
                    esResponsable: false,
                    aceptacion: acc
                }));
            }
        });

        listEl.innerHTML = itemsHtml.join('');

        listEl.querySelectorAll('[data-acc-map-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                const accId = btn.getAttribute('data-acc-id');
                const targetAcc = aceptaciones.find(a => a.id === accId);
                if (targetAcc?.ubicacion) {
                    GeoMapHelper.mostrarModalMapa(
                        targetAcc.ubicacion,
                        `Aceptación: ${targetAcc.nombre}`,
                        this._formatDateTime(targetAcc.fechaAceptacion)
                    );
                }
            });
        });
    }

    _buildCollabAcceptanceItemHtml({ nombre, puesto, esResponsable, aceptacion, fotoPerfil }) {
        const initials = this._getInitials(nombre);
        const hasAccepted = Boolean(aceptacion);
        const hasGeo = aceptacion?.ubicacion?.latitud != null && aceptacion?.ubicacion?.longitud != null;
        const foto = fotoPerfil || aceptacion?.fotoPerfil || null;
        const hasPhoto = Boolean(foto);

        return `
            <div class="ta-collab-item ${hasAccepted ? 'accepted' : 'pending'}">
                <div class="ta-collab-profile">
                    <div class="ta-collab-avatar ${hasPhoto ? 'has-photo' : ''}">
                        ${hasPhoto ? `<img src="${foto}" alt="${this._escapeHtml(nombre)}" onerror="this.parentElement.classList.remove('has-photo'); this.remove();" />` : ''}
                        <span>${this._escapeHtml(initials)}</span>
                    </div>
                    <div class="ta-collab-meta">
                        <h4>
                            ${this._escapeHtml(nombre)}
                            ${esResponsable ? '<span class="ta-status-pill accepted" style="font-size:0.65rem;"><i class="fas fa-star"></i> Responsable</span>' : ''}
                        </h4>
                        <span>${this._escapeHtml(puesto)}</span>
                        ${aceptacion?.comentario ? `<span style="margin-top:0.2rem; color: var(--rsi-text-primary); font-style: italic;">"${this._escapeHtml(aceptacion.comentario)}"</span>` : ''}
                    </div>
                </div>
                <div class="ta-collab-status">
                    ${hasAccepted
                        ? `
                            <span class="ta-status-pill accepted">
                                <i class="fas fa-check-circle"></i> Aceptado
                            </span>
                            <span style="font-size: 0.72rem; color: var(--rsi-text-secondary);">
                                ${this._formatDateTime(aceptacion.fechaAceptacion)}
                            </span>
                            ${hasGeo ? `
                                <button type="button" class="ta-geo-btn" data-acc-map-index="true" data-acc-id="${this._escapeHtml(aceptacion.id)}">
                                    <i class="fas fa-map-marker-alt"></i> Ver GPS
                                </button>
                            ` : ''}
                        `
                        : `
                            <span class="ta-status-pill pending">
                                <i class="fas fa-hourglass-half"></i> Pendiente de aceptar
                            </span>
                        `
                    }
                </div>
            </div>
        `;
    }

    switchStageTab(stage) {
        if (!['antes', 'durante', 'despues'].includes(stage)) return;
        this.activeStage = stage;

        document.querySelectorAll('[data-stage-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-stage-tab') === stage);
        });

        document.querySelectorAll('[data-stage-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-stage-panel') === stage);
        });
    }

    renderEvidenciasSection() {
        const evidencias = TicketModel.normalizeEvidencias(this.ticket);
        const isClosed = this.ticket.estado === 'finalizado' || this.ticket.estado === 'cancelado';
        const hasAccepted = this._hasCurrentUserAccepted();
        const isLocked = !isClosed && !hasAccepted;

        const lockAlert = document.getElementById('taLockEvidenciasAlert');
        if (lockAlert) {
            lockAlert.style.display = isLocked ? 'flex' : 'none';
        }

        const stages = [
            { key: 'antes', label: 'Antes', tabId: 'tabStageAntes', countId: 'countStageAntes', galleryId: 'galleryStageAntes', actionsId: 'actionsStageAntes' },
            { key: 'durante', label: 'Durante', tabId: 'tabStageDurante', countId: 'countStageDurante', galleryId: 'galleryStageDurante', actionsId: 'actionsStageDurante' },
            { key: 'despues', label: 'Después', tabId: 'tabStageDespues', countId: 'countStageDespues', galleryId: 'galleryStageDespues', actionsId: 'actionsStageDespues' }
        ];

        stages.forEach(({ key, label, tabId, countId, galleryId, actionsId }) => {
            const items = evidencias[key] || [];
            const tabEl = document.getElementById(tabId);
            const countEl = document.getElementById(countId);
            const galleryEl = document.getElementById(galleryId);
            const actionsEl = document.getElementById(actionsId);

            if (tabEl) {
                tabEl.classList.toggle('completed', items.length > 0);
            }
            if (countEl) {
                countEl.innerHTML = items.length > 0
                    ? `<i class="fas fa-check"></i> ${items.length} foto${items.length === 1 ? '' : 's'}`
                    : '0 fotos (Requerido)';
            }
            if (actionsEl) {
                actionsEl.style.display = isClosed ? 'none' : 'flex';
                actionsEl.querySelectorAll('button').forEach(btn => {
                    btn.disabled = isLocked;
                });
            }

            if (!galleryEl) return;

            if (items.length === 0) {
                galleryEl.innerHTML = `
                    <div class="ta-empty-stage" style="grid-column: 1 / -1;">
                        <i class="fas fa-camera"></i>
                        <strong>Sin evidencias en la etapa "${label}"</strong>
                        <p style="margin: 6px 0 0; font-size: 0.82rem;">
                            ${isLocked
                                ? 'Acepta primero el ticket en la parte superior para desbloquear la cámara y subir fotografías.'
                                : 'Usa el botón "Tomar Foto con Cámara" para capturar la imagen con marca de agua de RSI Enterprise, fecha, hora y ubicación GPS.'}
                        </p>
                    </div>
                `;
                return;
            }

            galleryEl.innerHTML = items.map(ev => {
                const hasGeo = ev.ubicacion?.latitud != null && ev.ubicacion?.longitud != null;
                const previewTitle = `Evidencia ${label} — ${ev.subidoPorNombre || 'Colaborador'} (${ev.fechaHora || this._formatDateTime(ev.fechaSubida)})`;
                return `
                    <article class="ta-evidence-card">
                        <div class="ta-evidence-thumb-wrap" data-preview-title="${this._escapeHtml(previewTitle)}" title="Haz clic para abrir en pantalla completa y hacer zoom">
                            <img src="${this._escapeHtml(ev.url)}" alt="${this._escapeHtml(previewTitle)}" class="ta-evidence-thumb" loading="lazy" />
                            <span class="ta-evidence-stage-chip ${key}">${label}</span>
                            ${!isClosed && hasAccepted ? `
                                <button type="button" class="ta-evidence-delete-btn" data-delete-stage="${key}" data-delete-id="${this._escapeHtml(ev.id)}" title="Eliminar fotografía">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="ta-evidence-body">
                            <div class="ta-evidence-author">
                                <i class="fas fa-user-check"></i> ${this._escapeHtml(ev.subidoPorNombre || 'Colaborador')}
                            </div>
                            <div class="ta-evidence-date">
                                <i class="fas fa-clock"></i> ${this._escapeHtml(ev.fechaHora || this._formatDateTime(ev.fechaSubida))}
                            </div>
                            ${ev.descripcion ? `<p class="ta-evidence-desc">${this._escapeHtml(ev.descripcion)}</p>` : ''}
                            <div class="ta-evidence-footer">
                                ${hasGeo ? `
                                    <button type="button" class="ta-geo-btn" data-ev-geo-stage="${key}" data-ev-geo-id="${this._escapeHtml(ev.id)}">
                                        <i class="fas fa-map-marker-alt"></i> Ver GPS
                                    </button>
                                ` : `<span style="font-size:0.72rem; color: var(--rsi-text-muted);">Sin GPS</span>`}
                                <button type="button" class="ta-geo-btn" data-zoom-ev-btn="true" title="Abrir en pantalla completa y hacer zoom">
                                    <i class="fas fa-expand"></i> Pantalla Completa / Zoom
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

            enableImageZoomInContainer(galleryEl);

            galleryEl.querySelectorAll('[data-zoom-ev-btn]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const card = btn.closest('.ta-evidence-card');
                    const img = card?.querySelector('img.ta-evidence-thumb');
                    if (img) {
                        triggerImageZoom(img, 'toggle');
                    }
                });
            });

            galleryEl.querySelectorAll('[data-ev-geo-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const evId = btn.getAttribute('data-ev-geo-id');
                    const evObj = items.find(x => x.id === evId);
                    if (evObj?.ubicacion) {
                        GeoMapHelper.mostrarModalMapa(
                            evObj.ubicacion,
                            `Evidencia ${label} (${evObj.subidoPorNombre || 'Colaborador'})`,
                            evObj.fechaHora || this._formatDateTime(evObj.fechaSubida)
                        );
                    }
                });
            });

            galleryEl.querySelectorAll('[data-delete-id]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!(await this._ensureTicketAcceptedOrPrompt())) return;
                    const evId = btn.getAttribute('data-delete-id');
                    const st = btn.getAttribute('data-delete-stage');
                    await this.handleDeleteEvidencia(st, evId);
                });
            });
        });
    }

    renderActividadesSection() {
        const input = document.getElementById('taActividadesInput');
        const actions = document.getElementById('taActividadesActions');
        const btnSave = document.getElementById('btnGuardarActividades');
        const meta = document.getElementById('taActividadesMeta');
        const lockAlert = document.getElementById('taLockActividadesAlert');

        const isClosed = this.ticket.estado === 'finalizado' || this.ticket.estado === 'cancelado';
        const hasAccepted = this._hasCurrentUserAccepted();
        const isLocked = !isClosed && !hasAccepted;

        if (lockAlert) {
            lockAlert.style.display = isLocked ? 'flex' : 'none';
        }
        if (input) {
            input.value = this.ticket.actividadesDesarrolladas || '';
            input.disabled = isClosed || isLocked;
        }
        if (actions) {
            actions.style.display = isClosed ? 'none' : 'flex';
        }
        if (btnSave) {
            btnSave.disabled = isClosed || isLocked;
        }
        if (meta && this.ticket.ultimaActualizacionActividadesFecha) {
            meta.textContent = `Última actualización por ${this.ticket.ultimaActualizacionActividadesPor || 'Colaborador'} el ${this._formatDateTime(this.ticket.ultimaActualizacionActividadesFecha)}`;
        }
    }

    renderClosureChecklist() {
        const evidencias = TicketModel.normalizeEvidencias(this.ticket);
        const hasAccepted = this._hasCurrentUserAccepted();
        const countAntes = evidencias.antes.length;
        const countDurante = evidencias.durante.length;
        const countDespues = evidencias.despues.length;

        const currentActividades = document.getElementById('taActividadesInput')?.value ?? this.ticket.actividadesDesarrolladas ?? '';
        const hasActividades = currentActividades.trim().length >= 5;

        this._updateChecklistRow('chkAceptado', 'chkAceptadoPill', hasAccepted, hasAccepted ? 'Confirmado' : 'Pendiente');
        this._updateChecklistRow('chkAntes', 'chkAntesPill', countAntes > 0, `${countAntes} foto${countAntes === 1 ? '' : 's'}`);
        this._updateChecklistRow('chkDurante', 'chkDurantePill', countDurante > 0, `${countDurante} foto${countDurante === 1 ? '' : 's'}`);
        this._updateChecklistRow('chkDespues', 'chkDespuesPill', countDespues > 0, `${countDespues} foto${countDespues === 1 ? '' : 's'}`);
        this._updateChecklistRow('chkActividades', 'chkActividadesPill', hasActividades, hasActividades ? 'Completado' : 'Pendiente');

        const isClosed = this.ticket.estado === 'finalizado' || this.ticket.estado === 'cancelado';
        const formArea = document.getElementById('taCierreFormArea');
        const btnCerrar = document.getElementById('btnCerrarTicket');
        const inputCierre = document.getElementById('taComentarioCierre');

        if (formArea) {
            if (isClosed) {
                formArea.innerHTML = `
                    <div class="ta-description-box" style="border-left-color: var(--rsi-success);">
                        <strong><i class="fas fa-check-circle"></i> Ticket finalizado</strong><br/>
                        Este ticket ya fue cerrado con sus evidencias y actividades correspondientes.
                    </div>
                `;
            } else {
                if (inputCierre) inputCierre.disabled = !hasAccepted;
                if (btnCerrar) btnCerrar.disabled = !hasAccepted;
            }
        }
    }

    _updateChecklistRow(rowId, pillId, isDone, pillText) {
        const row = document.getElementById(rowId);
        const pill = document.getElementById(pillId);
        if (row) {
            row.classList.toggle('done', isDone);
            const icon = row.querySelector('.ta-check-item-left i');
            if (icon) {
                icon.className = isDone ? 'fas fa-check-circle' : 'fas fa-clock';
            }
        }
        if (pill) {
            pill.className = `ta-status-pill ${isDone ? 'accepted' : 'pending'}`;
            pill.textContent = pillText;
        }
    }

    renderComentarios() {
        const listEl = document.getElementById('taComentariosList');
        const countEl = document.getElementById('taComentariosCount');
        const formEl = document.getElementById('taCommentForm');
        const lockAlert = document.getElementById('taLockComentariosAlert');
        const commentInput = document.getElementById('taNuevoComentarioInput');
        const btnAddComment = document.getElementById('btnAgregarComentario');
        if (!listEl) return;

        const isClosed = this.ticket.estado === 'finalizado' || this.ticket.estado === 'cancelado';
        const hasAccepted = this._hasCurrentUserAccepted();
        const isLocked = !isClosed && !hasAccepted;

        if (lockAlert) {
            lockAlert.style.display = isLocked ? 'flex' : 'none';
        }
        if (formEl) {
            formEl.style.display = isClosed ? 'none' : 'flex';
        }
        if (commentInput) {
            commentInput.disabled = isClosed || isLocked;
        }
        if (btnAddComment) {
            btnAddComment.disabled = isClosed || isLocked;
        }

        const comentarios = Array.isArray(this.ticket.comentarios) ? [...this.ticket.comentarios] : [];
        comentarios.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        if (countEl) {
            countEl.textContent = `${comentarios.length} comentario${comentarios.length === 1 ? '' : 's'}`;
        }

        if (comentarios.length === 0) {
            listEl.innerHTML = `
                <div class="ta-empty-stage" style="padding: var(--rsi-spacing-md);">
                    <p style="margin: 0; font-size: 0.82rem;">Aún no hay comentarios registrados en este ticket.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = comentarios.map(c => `
            <div class="ta-comment-item">
                <div class="ta-comment-header">
                    <span class="ta-comment-author">
                        <i class="fas fa-user-circle"></i> ${this._escapeHtml(c.autorNombre || 'Colaborador')}
                        ${c.puesto ? `<small style="color: var(--rsi-text-secondary); font-weight: normal;">(${this._escapeHtml(c.puesto)})</small>` : ''}
                    </span>
                    <span class="ta-comment-date">${this._formatDateTime(c.fecha)}</span>
                </div>
                <p class="ta-comment-text">${this._escapeHtml(c.texto)}</p>
            </div>
        `).join('');
    }

    renderHistorial() {
        const listEl = document.getElementById('taHistorialList');
        if (!listEl) return;

        const historial = Array.isArray(this.ticket.historialCambios) ? [...this.ticket.historialCambios] : [];
        historial.sort((a, b) => new Date(b.fechaCambio || 0) - new Date(a.fechaCambio || 0));

        if (historial.length === 0) {
            listEl.innerHTML = `<div class="ta-empty-stage" style="padding: var(--rsi-spacing-md);"><p style="margin:0;">Sin movimientos registrados.</p></div>`;
            return;
        }

        listEl.innerHTML = historial.map((h, idx) => {
            const hasGeo = h.ubicacion?.latitud != null && h.ubicacion?.longitud != null;
            return `
                <div class="ta-comment-item">
                    <div class="ta-comment-header">
                        <span class="ta-comment-author">
                            <i class="fas fa-bolt"></i> ${this._escapeHtml(h.cambiadoPor || 'Sistema')}
                        </span>
                        <span class="ta-comment-date">${this._formatDateTime(h.fechaCambio)}</span>
                    </div>
                    <p class="ta-comment-text">${this._escapeHtml(h.motivo || `Estado: ${h.estadoNuevo}`)}</p>
                    ${hasGeo ? `
                        <div style="margin-top: 6px;">
                            <button type="button" class="ta-geo-btn" data-hist-geo-idx="${idx}">
                                <i class="fas fa-map-marker-alt"></i> Ver ubicación GPS del evento
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('[data-hist-geo-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-hist-geo-idx'));
                const item = historial[idx];
                if (item?.ubicacion) {
                    GeoMapHelper.mostrarModalMapa(
                        item.ubicacion,
                        item.motivo || 'Ubicación del evento',
                        `${item.cambiadoPor || 'Colaborador'} · ${this._formatDateTime(item.fechaCambio)}`
                    );
                }
            });
        });
    }

    /* ==========================================================================
       ACCIONES DE NEGOCIO: ACEPTAR, COMENTAR, SUBIR EVIDENCIA, ACTIVIDADES, CERRAR
       ========================================================================== */

    async handleAceptarTicket() {
        const { value: comentario, isConfirmed } = await Swal.fire({
            title: 'Aceptar Ticket para Atención',
            html: `
                <p style="font-size: 0.92rem; color: var(--rsi-text-secondary); margin-bottom: 12px;">
                    Al aceptar el ticket <strong>${this._escapeHtml(this.ticket.idTicket || this.ticketId)}</strong> se registrará tu confirmación, hora y ubicación GPS actual, y se habilitará la carga de evidencias y actividades.
                </p>
            `,
            input: 'text',
            inputLabel: 'Comentario inicial (opcional)',
            inputPlaceholder: 'Ej. Enterado, en traslado hacia el sitio...',
            showCancelButton: true,
            confirmButtonText: 'Confirmar y Aceptar Ticket',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: 'var(--rsi-primary)'
        });

        if (!isConfirmed) return;

        try {
            Swal.fire({
                title: 'Registrando aceptación y GPS...',
                text: 'Por favor espera un momento.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const result = await this.service.aceptarTicket(this.ticketId, { comentario: comentario || '' });
            if (!result.success) {
                throw new Error(result.error || 'No se pudo aceptar el ticket');
            }

            await this.loadTicketData();

            await Swal.fire({
                icon: 'success',
                title: '¡Ticket Aceptado!',
                text: 'Tu aceptación y ubicación han quedado registradas. Ya puedes ingresar comentarios, evidencias y actividades.',
                timer: 2200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error al aceptar ticket:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al aceptar ticket',
                text: error.message || 'Ocurrió un problema al registrar tu aceptación.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    async handleAgregarComentario() {
        if (!(await this._ensureTicketAcceptedOrPrompt())) return;

        const input = document.getElementById('taNuevoComentarioInput');
        const texto = input?.value?.trim() || '';
        if (!texto) {
            Swal.fire({
                icon: 'warning',
                title: 'Comentario vacío',
                text: 'Escribe un comentario antes de publicarlo.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            return;
        }

        const btn = document.getElementById('btnAgregarComentario');
        try {
            if (btn) btn.disabled = true;
            const res = await this.service.agregarComentario(this.ticketId, texto);
            if (!res.success) {
                throw new Error(res.error);
            }
            if (input) input.value = '';
            await this.loadTicketData();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Comentario publicado',
                showConfirmButton: false,
                timer: 1800
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar comentario',
                text: error.message || 'No se pudo guardar el comentario.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async handleGuardarActividades() {
        if (!(await this._ensureTicketAcceptedOrPrompt())) return;

        const input = document.getElementById('taActividadesInput');
        const texto = input?.value?.trim() || '';
        if (!texto) {
            Swal.fire({
                icon: 'warning',
                title: 'Actividades requeridas',
                text: 'Describe las actividades desarrolladas para poder guardar el avance.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            return;
        }

        const btn = document.getElementById('btnGuardarActividades');
        try {
            if (btn) btn.disabled = true;
            const res = await this.service.guardarActividadesTicket(this.ticketId, texto);
            if (!res.success) {
                throw new Error(res.error);
            }
            await this.loadTicketData();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Actividades desarrolladas guardadas',
                showConfirmButton: false,
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar actividades',
                text: error.message || 'No se pudieron guardar las actividades.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async handleCerrarTicket() {
        if (!(await this._ensureTicketAcceptedOrPrompt())) return;

        const actividadesInput = document.getElementById('taActividadesInput');
        const comentarioCierreInput = document.getElementById('taComentarioCierre');
        const actividades = actividadesInput?.value?.trim() || '';
        const comentarioFinal = comentarioCierreInput?.value?.trim() || '';

        const userIds = this.collabContext?.userIds || [];
        const validation = TicketModel.validateForCierre(this.ticket, actividades, userIds);

        if (!validation.valid) {
            await Swal.fire({
                icon: 'warning',
                title: 'Requisitos pendientes para cerrar el ticket',
                html: `
                    <div style="text-align: left; font-size: 0.92rem;">
                        <p style="margin-bottom: 8px;">Para finalizar el ticket debes completar lo siguiente:</p>
                        <ul style="padding-left: 20px; margin: 0;">
                            ${validation.errors.map(err => `<li style="margin-bottom: 6px;">${this._escapeHtml(err)}</li>`).join('')}
                        </ul>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            return;
        }

        const confirm = await Swal.fire({
            icon: 'question',
            title: '¿Finalizar y cerrar este ticket?',
            text: 'Se guardarán las actividades desarrolladas, se registrará tu ubicación GPS de cierre y el ticket pasará a estado Finalizado.',
            showCancelButton: true,
            confirmButtonText: 'Sí, Finalizar Ticket',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: 'var(--rsi-success)'
        });

        if (!confirm.isConfirmed) return;

        try {
            Swal.fire({
                title: 'Cerrando ticket...',
                text: 'Validando evidencias, actividades y ubicación GPS.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.service.cerrarTicketConEvidencias(this.ticketId, {
                actividadesDesarrolladas: actividades,
                comentarioFinal
            });

            if (!res.success) {
                throw new Error(res.error || 'No fue posible cerrar el ticket');
            }

            await this.loadTicketData();

            await Swal.fire({
                icon: 'success',
                title: '¡Ticket Finalizado Exitosamente!',
                text: 'Todas las evidencias del Antes, Durante y Después y las actividades han quedado respaldadas.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        } catch (error) {
            console.error('Error cerrando ticket:', error);
            Swal.fire({
                icon: 'error',
                title: 'No se pudo cerrar el ticket',
                text: error.message || 'Error al cerrar el ticket.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    async handleDeleteEvidencia(etapa, evidenciaId) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar esta fotografía?',
            text: 'La imagen se eliminará de Firebase Storage y de la etapa correspondiente.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: 'var(--rsi-danger)'
        });

        if (!confirm.isConfirmed) return;

        try {
            Swal.fire({
                title: 'Eliminando evidencia...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.service.eliminarEvidenciaTicket(this.ticketId, etapa, evidenciaId);
            if (!res.success) {
                throw new Error(res.error);
            }

            await this.loadTicketData();
            Swal.close();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al eliminar evidencia',
                text: error.message || 'No se pudo eliminar la evidencia.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    /* ==========================================================================
       CÁMARA EN VIVO Y PROCESAMIENTO DE MARCA DE AGUA (LOGO + FECHA/HORA + GPS)
       ========================================================================== */

    async openCameraModal(stage) {
        this.pendingStage = stage;
        this.usedLiveCamera = true;
        this._clearPendingPreview();

        const stageLabels = { antes: '1. Antes', durante: '2. Durante', despues: '3. Después' };
        const titleEl = document.getElementById('taCameraModalTitle');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-camera"></i> Capturar Evidencia: Etapa ${stageLabels[stage] || stage}`;
        }

        const modal = document.getElementById('taCameraModal');
        modal?.classList.add('open');

        this._toggleModalControlsForPreview(false);
        await this.startLiveCamera();
    }

    async startLiveCamera() {
        this.stopCameraStream();
        const videoEl = document.getElementById('taCameraVideo');
        if (!videoEl) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.closeCameraModal();
            const fallbackId = this.pendingStage === 'antes'
                ? 'fileInputAntes'
                : this.pendingStage === 'durante'
                    ? 'fileInputDurante'
                    : 'fileInputDespues';
            document.getElementById(fallbackId)?.click();
            return;
        }

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: this.cameraFacingMode },
                    width: { ideal: 1600 },
                    height: { ideal: 1200 }
                },
                audio: false
            });
            videoEl.srcObject = this.cameraStream;
            videoEl.style.display = 'block';
            await videoEl.play().catch(() => {});
        } catch (error) {
            console.warn('No se pudo abrir cámara WebRTC en vivo, abriendo selector/cámara nativa:', error);
            this.closeCameraModal();
            const fallbackId = this.pendingStage === 'antes'
                ? 'fileInputAntes'
                : this.pendingStage === 'durante'
                    ? 'fileInputDurante'
                    : 'fileInputDespues';
            document.getElementById(fallbackId)?.click();
        }
    }

    stopCameraStream() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const videoEl = document.getElementById('taCameraVideo');
        if (videoEl) {
            videoEl.srcObject = null;
        }
    }

    closeCameraModal() {
        this.stopCameraStream();
        this._clearPendingPreview();
        const modal = document.getElementById('taCameraModal');
        modal?.classList.remove('open');
    }

    _clearPendingPreview() {
        if (this.pendingWatermarkResult?.previewUrl) {
            URL.revokeObjectURL(this.pendingWatermarkResult.previewUrl);
        }
        this.pendingWatermarkResult = null;
        const previewImg = document.getElementById('taWatermarkPreviewImg');
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        const descInput = document.getElementById('taEvidenciaDescripcion');
        if (descInput) descInput.value = '';
    }

    _toggleModalControlsForPreview(isPreview) {
        const videoEl = document.getElementById('taCameraVideo');
        const previewImg = document.getElementById('taWatermarkPreviewImg');
        const descWrapper = document.getElementById('taEvidenciaDescWrapper');
        const btnSwitch = document.getElementById('btnSwitchCamera');
        const btnSnap = document.getElementById('btnTakeSnapshot');
        const btnRetake = document.getElementById('btnRetakePhoto');
        const btnConfirm = document.getElementById('btnConfirmUploadEvidencia');

        if (videoEl) videoEl.style.display = isPreview ? 'none' : 'block';
        if (previewImg) previewImg.style.display = isPreview ? 'block' : 'none';
        if (descWrapper) descWrapper.style.display = isPreview ? 'block' : 'none';
        if (btnSwitch) btnSwitch.style.display = isPreview ? 'none' : 'inline-flex';
        if (btnSnap) btnSnap.style.display = isPreview ? 'none' : 'inline-flex';
        if (btnRetake) btnRetake.style.display = isPreview ? 'inline-flex' : 'none';
        if (btnConfirm) btnConfirm.style.display = isPreview ? 'inline-flex' : 'none';
    }

    async captureSnapshotFromVideo() {
        const videoEl = document.getElementById('taCameraVideo');
        if (!videoEl || !videoEl.videoWidth) {
            Swal.fire({
                icon: 'warning',
                title: 'Cámara aún no lista',
                text: 'Espera un segundo a que cargue la señal de video antes de capturar.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
            return;
        }

        try {
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = videoEl.videoWidth;
            snapCanvas.height = videoEl.videoHeight;
            const ctx = snapCanvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, snapCanvas.width, snapCanvas.height);

            const rawBlob = await new Promise((resolve, reject) => {
                snapCanvas.toBlob(b => (b ? resolve(b) : reject(new Error('Error capturando frame'))), 'image/jpeg', 0.95);
            });

            this.stopCameraStream();
            await this.generateWatermarkPreview(rawBlob);
        } catch (error) {
            console.error('Error al capturar fotografía:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al capturar foto',
                text: error.message || 'No se pudo procesar la captura.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    async handleFileSelectedForStage(stage, file) {
        this.pendingStage = stage;
        this.usedLiveCamera = false;
        this._clearPendingPreview();

        const stageLabels = { antes: '1. Antes', durante: '2. Durante', despues: '3. Después' };
        const titleEl = document.getElementById('taCameraModalTitle');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-stamp"></i> Vista Previa con Marca de Agua: Etapa ${stageLabels[stage] || stage}`;
        }

        const modal = document.getElementById('taCameraModal');
        modal?.classList.add('open');

        await this.generateWatermarkPreview(file);
    }

    async generateWatermarkPreview(fileOrBlob) {
        const badgeEl = document.getElementById('taCameraOverlayBadge');
        if (badgeEl) {
            badgeEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Estampando logo RSI, fecha, hora y ubicación GPS...`;
        }

        try {
            const geo = await GeoMapHelper.obtenerPosicionActual();
            const result = await TicketWatermarkHelper.aplicarMarcaDeAgua({
                source: fileOrBlob,
                idTicket: this.ticket.idTicket || this.ticketId,
                etapa: this.pendingStage,
                colaboradorNombre: this.collabContext?.nombre || 'Colaborador RSI',
                ubicacion: geo
            });

            this.pendingWatermarkResult = result;

            const previewImg = document.getElementById('taWatermarkPreviewImg');
            if (previewImg) {
                previewImg.src = result.previewUrl;
                if (previewImg.parentElement) {
                    enableImageZoomInContainer(previewImg.parentElement);
                    triggerImageZoom(previewImg, 'reset');
                }
            }

            if (badgeEl) {
                badgeEl.innerHTML = `<i class="fas fa-check-circle"></i> Marca de agua aplicada (${result.fechaHora})`;
            }

            this._toggleModalControlsForPreview(true);
        } catch (error) {
            console.error('Error aplicando marca de agua:', error);
            this.closeCameraModal();
            Swal.fire({
                icon: 'error',
                title: 'Error al procesar imagen',
                text: error.message || 'No se pudo aplicar la marca de agua a la imagen.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    async resetModalToCaptureMode() {
        this._clearPendingPreview();
        if (this.usedLiveCamera) {
            this._toggleModalControlsForPreview(false);
            await this.startLiveCamera();
        } else {
            this.closeCameraModal();
            const inputId = this.pendingStage === 'antes'
                ? 'fileInputAntes'
                : this.pendingStage === 'durante'
                    ? 'fileInputDurante'
                    : 'fileInputDespues';
            document.getElementById(inputId)?.click();
        }
    }

    async confirmAndUploadPendingEvidencia() {
        if (!this.pendingWatermarkResult?.blob) return;

        const descripcion = document.getElementById('taEvidenciaDescripcion')?.value?.trim() || '';
        const btnConfirm = document.getElementById('btnConfirmUploadEvidencia');

        try {
            if (btnConfirm) btnConfirm.disabled = true;

            Swal.fire({
                title: 'Subiendo evidencia a Firebase Storage...',
                text: 'Guardando imagen con marca de agua oficial.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.service.subirEvidenciaTicket(this.ticketId, {
                watermarkedBlob: this.pendingWatermarkResult.blob,
                etapa: this.pendingStage,
                descripcion,
                ubicacion: this.pendingWatermarkResult.ubicacion,
                fechaHora: this.pendingWatermarkResult.fechaHora
            });

            if (!res.success) {
                throw new Error(res.error || 'Error al subir la evidencia');
            }

            const uploadedStage = this.pendingStage;
            this.closeCameraModal();
            await this.loadTicketData();
            this.switchStageTab(uploadedStage);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: res.message || 'Evidencia subida correctamente',
                showConfirmButton: false,
                timer: 2200
            });
        } catch (error) {
            console.error('Error subiendo evidencia:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al subir evidencia',
                text: error.message || 'No se pudo guardar la fotografía en Storage.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        } finally {
            if (btnConfirm) btnConfirm.disabled = false;
        }
    }

    async handleGenerarReporteFotografico() {
        if (!this.ticket) return;

        // Si ya existe el reporte fotográfico almacenado en Storage, abrirlo directamente sin volver a generarlo
        if (this.ticket.reporteFotograficoUrl) {
            window.open(this.ticket.reporteFotograficoUrl, '_blank');
            return;
        }

        try {
            Swal.fire({
                title: 'Generando y almacenando Reporte Fotográfico PDF...',
                text: 'Procesando fotografías y guardando el reporte en Firebase Storage.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.service.generarYGuardarReporteFotografico(this.ticketId);
            if (!res.success) {
                throw new Error(res.error || 'No se pudo generar el reporte fotográfico.');
            }

            if (res.pdfUrl) {
                this.ticket.reporteFotograficoUrl = res.pdfUrl;
                this.ticket.reporteFotograficoPath = res.pdfPath;
            }

            Swal.close();

            const targetUrl = res.pdfUrl || (res.pdfBlob ? URL.createObjectURL(res.pdfBlob) : null);
            if (targetUrl) {
                const win = window.open(targetUrl, '_blank');
                if (!win && res.pdfBlob) {
                    const folio = (this.ticket?.idTicket || this.ticketId || 'Ticket').replace(/[^a-zA-Z0-9_-]/g, '_');
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
            console.error('Error generando reporte fotográfico PDF:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al generar PDF',
                text: error.message || 'No se pudo generar el reporte fotográfico en PDF.',
                confirmButtonColor: 'var(--rsi-primary)'
            });
        }
    }

    /* ==========================================================================
       UTILIDADES DE FORMATO Y ESCAPADO
       ========================================================================== */

    _formatDateTime(isoString) {
        if (!isoString) return '-';
        try {
            const d = new Date(isoString);
            if (Number.isNaN(d.getTime())) return String(isoString);
            return new Intl.DateTimeFormat('es-MX', {
                timeZone: 'America/Mexico_City',
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(d);
        } catch {
            return String(isoString);
        }
    }

    _formatDateOnly(dateStr) {
        if (!dateStr) return '-';
        try {
            const parts = String(dateStr).split('T')[0].split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return String(dateStr);
        } catch {
            return String(dateStr);
        }
    }

    _getInitials(name = '') {
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'CO';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    _escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export async function ticketAtencionController() {
    const controller = new TicketAtencionController();
    await controller.init();
}

export default ticketAtencionController;
