/* ========================================
   CHECKLISTS CRUD CONTROLLER - RSI ENTERPRISE
   Historial general de salidas vehiculares e inspecciones
   ======================================== */

import ChecklistVehiculoService from '../../services/checklistVehiculoService.js';

export class ChecklistsCrudController {
    constructor() {
        this.service = new ChecklistVehiculoService();
        this.checklists = [];
        this.currentUid = null;
    }

    async init() {
        console.log('📜 Inicializando ChecklistsCrudController...');
        try {
            const sess = JSON.parse(localStorage.getItem('rsi_session') || '{}');
            this.currentUid = sess.uid || sess.id || null;
        } catch {
            this.currentUid = null;
        }
        this.cacheDOM();
        this.bindEvents();
        await this.cargarHistorial();
    }

    cacheDOM() {
        this.dom = {
            tableBody: document.getElementById('checklistsTableBody'),
            tableWrapper: document.getElementById('checklistsTableWrapper'),
            loadingState: document.getElementById('loadingStateChecklists'),
            emptyState: document.getElementById('emptyStateChecklists'),
            chkCount: document.getElementById('chkCount'),
            searchInput: document.getElementById('chkSearchInput'),
            filterEstado: document.getElementById('filterChkEstado'),
            btnRefresh: document.getElementById('btnRefreshChecklists'),
            // Modal Detalle
            modal: document.getElementById('modalGeneralChecklistDetalle'),
            modalTitle: document.getElementById('modalGenChecklistTitle'),
            modalContent: document.getElementById('modalGenChecklistContent'),
            btnCloseModal: document.getElementById('btnCloseModalGenChecklist'),
            btnCerrarModal: document.getElementById('btnCerrarModalGenChecklist')
        };
    }

    bindEvents() {
        if (this.dom.searchInput) {
            let debounceTimer;
            this.dom.searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.filtrarChecklists(), 300);
            });
        }

        if (this.dom.filterEstado) {
            this.dom.filterEstado.addEventListener('change', () => this.filtrarChecklists());
        }

        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.addEventListener('click', () => this.cargarHistorial(true));
        }

        if (this.dom.btnCloseModal) {
            this.dom.btnCloseModal.addEventListener('click', () => this.cerrarModal());
        }

        if (this.dom.btnCerrarModal) {
            this.dom.btnCerrarModal.addEventListener('click', () => this.cerrarModal());
        }

        if (this.dom.tableBody) {
            this.dom.tableBody.addEventListener('click', (e) => {
                const btnView = e.target.closest('.btn-ver-detalle-chk');
                if (btnView) {
                    const id = btnView.dataset.id;
                    this.abrirModalDetalle(id);
                    return;
                }

                const btnCancel = e.target.closest('.btn-cancelar-salida');
                if (btnCancel) {
                    const id = btnCancel.dataset.id;
                    this.confirmarCancelacion(id);
                    return;
                }
            });
        }
    }

    async cargarHistorial(forceRefresh = false) {
        try {
            if (this.dom.loadingState) this.dom.loadingState.style.display = 'flex';
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';

            this.checklists = await this.service.getHistorialChecklists();
            this.filtrarChecklists();
        } catch (error) {
            console.error('❌ Error al cargar historial de checklists:', error);
            if (this.dom.tableBody) {
                this.dom.tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: var(--rsi-danger); padding: var(--rsi-spacing-lg);">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar el historial: ${error.message}
                        </td>
                    </tr>
                `;
            }
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'block';
        } finally {
            if (this.dom.loadingState) this.dom.loadingState.style.display = 'none';
        }
    }

    filtrarChecklists() {
        const term = (this.dom.searchInput?.value || '').trim().toLowerCase();
        const estado = this.dom.filterEstado?.value || 'todos';

        let filtrados = [...this.checklists];

        if (estado !== 'todos') {
            filtrados = filtrados.filter(c => c.estado === estado);
        }

        if (term) {
            filtrados = filtrados.filter(c => {
                const folio = (c.folio || '').toLowerCase();
                const placas = (c.vehiculoPlacas || '').toLowerCase();
                const eco = (c.vehiculoNumEconomico || '').toLowerCase();
                const rec = (c.receptorNombre || '').toLowerCase();
                const insp = (c.inspectorNombre || '').toLowerCase();
                return folio.includes(term) || placas.includes(term) || eco.includes(term) || rec.includes(term) || insp.includes(term);
            });
        }

        this.renderTable(filtrados);
    }

    renderTable(lista) {
        if (this.dom.chkCount) {
            this.dom.chkCount.textContent = lista ? lista.length : 0;
        }

        if (!lista || lista.length === 0) {
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) this.dom.emptyState.style.display = 'block';
            if (this.dom.tableBody) this.dom.tableBody.innerHTML = '';
            return;
        }

        if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';
        if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'block';

        const estadoBadges = {
            pendiente_aceptacion: '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-clock"></i> Por Firmar</span>',
            aceptada: '<span class="rsi-badge rsi-badge-primary"><i class="fas fa-route"></i> En Ruta</span>',
            concluida: '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Concluida</span>',
            cancelada: '<span class="rsi-badge rsi-badge-secondary"><i class="fas fa-ban"></i> Cancelada</span>'
        };

        if (this.dom.tableBody) {
            this.dom.tableBody.innerHTML = lista.map(item => {
                const fechaStr = item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                }) : '-';
                const km = (item.kilometrajeSalida || 0).toLocaleString();
                const badge = estadoBadges[item.estado] || `<span class="rsi-badge rsi-badge-secondary">${item.estado}</span>`;
                const firmada = item.aceptacion && item.aceptacion.firmado;

                return `
                    <tr>
                        <td>
                            <strong style="color: var(--rsi-text-gold); font-family: monospace; font-size: 0.95rem;">
                                ${item.folio || 'S/F'}
                            </strong>
                        </td>
                        <td>
                            <span class="rsi-badge rsi-badge-outline" style="font-family: monospace; font-weight: 700;">
                                ${item.vehiculoPlacas || 'S/P'}
                            </span>
                            <div style="font-size: 0.78rem; color: var(--rsi-text-secondary); margin-top: 3px;">
                                ${item.vehiculoNumEconomico ? `Eco: ${item.vehiculoNumEconomico} · ` : ''}${item.vehiculoInfo?.marca || ''} ${item.vehiculoInfo?.modelo || ''}
                            </div>
                        </td>
                        <td>
                            <strong style="color: var(--rsi-text-primary);">${item.receptorNombre || 'Colaborador'}</strong>
                            <div style="font-size: 0.78rem; color: var(--rsi-text-muted);">${item.receptorPuesto || ''}</div>
                        </td>
                        <td>
                            <span style="font-size: 0.88rem; color: var(--rsi-text-secondary);">${item.inspectorNombre || 'Inspector'}</span>
                        </td>
                        <td>
                            <span style="font-family: monospace; font-weight: 600;">${km} km</span>
                        </td>
                        <td>
                            <span style="font-size: 0.82rem; color: var(--rsi-text-muted);">${fechaStr}</span>
                        </td>
                        <td>
                            <div>${badge}</div>
                            <small style="font-size: 0.75rem; color: ${firmada ? 'var(--rsi-success)' : 'var(--rsi-warning)'}; display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font-weight: 600;">
                                <i class="fas ${firmada ? 'fa-signature' : 'fa-hourglass-half'}"></i>
                                ${firmada ? 'Firmado' : 'Sin firma'}
                            </small>
                        </td>
                        <td>
                            <div class="rsi-table-actions">
                                ${item.estado === 'pendiente_aceptacion' && item.receptorUid === this.currentUid ? `
                                    <a href="/partner/mis-salidas?firmarId=${item.id}" class="rsi-btn-icon rsi-btn-icon-success" data-link title="Firmar Aceptación">
                                        <i class="fas fa-signature"></i>
                                    </a>
                                ` : ''}
                                <button type="button" class="rsi-btn-icon rsi-btn-icon-view btn-ver-detalle-chk" data-id="${item.id}" title="Ver Inspección y Fotos">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${item.estado === 'pendiente_aceptacion' ? `
                                    <button type="button" class="rsi-btn-icon rsi-btn-icon-delete btn-cancelar-salida" data-id="${item.id}" title="Cancelar Salida">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    async abrirModalDetalle(id) {
        const item = this.checklists.find(c => c.id === id);
        if (!item || !this.dom.modal || !this.dom.modalContent) return;

        if (this.dom.modalTitle) {
            this.dom.modalTitle.innerHTML = `<i class="fas fa-file-signature"></i> Salida ${item.folio || ''} — ${item.vehiculoPlacas || ''}`;
        }

        const fechaStr = item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium' }) : '-';
        const respuestas = item.respuestasChecklist || {};
        const evidencias = item.evidencias || [];
        const aceptacion = item.aceptacion || {};

        const itemsConObs = [];
        Object.entries(respuestas).forEach(([key, val]) => {
            if (val.estado === 'con_observaciones') {
                itemsConObs.push({ key, ...val });
            }
        });

        this.dom.modalContent.innerHTML = `
            <div style="background: var(--rsi-bg-secondary); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-lg); margin-bottom: var(--rsi-spacing-lg);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.9rem;">
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Folio:</span>
                        <strong style="color: var(--rsi-text-gold); font-family: monospace;">${item.folio || '-'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Automóvil:</span>
                        <strong>${item.vehiculoInfo?.marca || ''} ${item.vehiculoInfo?.modelo || ''} (${item.vehiculoPlacas || ''})</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Inspector / Revisor:</span>
                        <strong>${item.inspectorNombre || '-'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Conductor Asignado:</span>
                        <strong style="color: var(--rsi-text-gold);">${item.receptorNombre || '-'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Fecha y Hora:</span>
                        <span>${fechaStr}</span>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Odómetro de Salida:</span>
                        <strong style="font-family: monospace;">${(item.kilometrajeSalida || 0).toLocaleString()} km</strong>
                    </div>
                </div>
            </div>

            <!-- Daños u Observaciones -->
            <div style="margin-bottom: var(--rsi-spacing-lg);">
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-circle" style="color: var(--rsi-warning);"></i> Hallazgos de la Inspección
                </h4>
                ${itemsConObs.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${itemsConObs.map(obs => `
                            <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid var(--rsi-warning); padding: 8px 12px; border-radius: var(--rsi-radius-sm); font-size: 0.88rem;">
                                <strong>${obs.label || obs.key}:</strong>
                                <span style="margin-left: 6px;">${obs.observacion || 'Sin descripción'}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: var(--rsi-radius-md); padding: 10px 14px; font-size: 0.88rem; color: var(--rsi-success-text); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: var(--rsi-success);"></i> Todo el checklist fue aprobado en estado correcto.
                    </div>
                `}
            </div>

            <!-- Evidencias Fotográficas con Marca de Agua -->
            <div style="margin-bottom: var(--rsi-spacing-lg);">
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-camera" style="color: var(--rsi-primary);"></i> Evidencias Fotográficas Selladas (${evidencias.length})
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                    ${evidencias.map(ev => `
                        <div style="background: var(--rsi-bg-card); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-md); overflow: hidden; box-shadow: var(--rsi-shadow-sm);">
                            <img src="${ev.url}" alt="${ev.categoriaLabel || ev.categoria}" style="width: 100%; height: 130px; object-fit: cover; display: block;" loading="lazy" />
                            <div style="padding: 8px 10px; font-size: 0.8rem;">
                                <strong style="display: block; color: var(--rsi-text-primary);">${ev.categoriaLabel || ev.categoria}</strong>
                                <small style="color: var(--rsi-text-muted);">${ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('es-MX') : ''}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Firma Digital -->
            <div>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-signature" style="color: var(--rsi-primary);"></i> Aceptación y Firma Electrónica del Conductor
                </h4>
                ${aceptacion.firmado && aceptacion.firmaUrl ? `
                    <div style="display: flex; gap: var(--rsi-spacing-lg); align-items: center; background: var(--rsi-bg-card); border: 1.5px solid var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-md); flex-wrap: wrap;">
                        <img src="${aceptacion.firmaUrl}" alt="Firma Electrónica del Receptor" style="max-height: 90px; border: 1px dashed var(--rsi-border-color); border-radius: var(--rsi-radius-sm); background: #ffffff; padding: 4px;" />
                        <div style="font-size: 0.88rem; flex: 1;">
                            <p style="margin: 0 0 4px 0;"><strong>Firmado por:</strong> ${aceptacion.firmadoPorNombre || item.receptorNombre}</p>
                            <p style="margin: 0 0 4px 0; color: var(--rsi-text-secondary); font-size: 0.82rem;"><strong>Fecha y Hora:</strong> ${aceptacion.fechaHoraFirma ? new Date(aceptacion.fechaHoraFirma).toLocaleString('es-MX') : '-'}</p>
                            ${aceptacion.observacionesReceptor ? `<p style="margin: 4px 0; font-size: 0.82rem;"><strong>Nota:</strong> ${aceptacion.observacionesReceptor}</p>` : ''}
                            <span class="rsi-badge rsi-badge-success" style="margin-top: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas fa-check-double"></i> RECEPCIÓN ACEPTADA FORMALMENTE
                            </span>
                        </div>
                    </div>
                ` : `
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--rsi-radius-md); padding: 12px 16px; font-size: 0.88rem; color: var(--rsi-warning-text); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-clock" style="font-size: 1.2rem; color: var(--rsi-warning);"></i>
                        <span>Esta salida vehicular se encuentra en espera de firma digital por parte de <strong>${item.receptorNombre}</strong>.</span>
                    </div>
                `}
            </div>
        `;

        this.dom.modal.style.display = 'flex';
    }

    cerrarModal() {
        if (this.dom.modal) {
            this.dom.modal.style.display = 'none';
        }
    }

    async confirmarCancelacion(checklistId) {
        const item = this.checklists.find(c => c.id === checklistId);
        const { value: motivo } = await Swal.fire({
            title: '¿Cancelar esta salida vehicular?',
            text: `Se cancelará el checklist ${item?.folio || ''} y el automóvil regresará a estado Disponible.`,
            input: 'textarea',
            inputPlaceholder: 'Ingresa el motivo de la cancelación...',
            inputValidator: (val) => {
                if (!val || !val.trim()) return 'Debe ingresar un motivo para cancelar la salida.';
            },
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, cancelar salida',
            cancelButtonText: 'Regresar'
        });

        if (!motivo) return;

        Swal.fire({
            title: 'Cancelando salida...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await this.service.cancelarSalida(checklistId, motivo);
        if (res.success) {
            await this.cargarHistorial(true);
            Swal.fire({
                icon: 'success',
                title: 'Salida Cancelada',
                text: res.message,
                confirmButtonColor: '#D4AF37'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: res.error,
                confirmButtonColor: '#D4AF37'
            });
        }
    }
}

export async function checklistsCrudController() {
    const controller = new ChecklistsCrudController();
    await controller.init();
}

export default checklistsCrudController;
