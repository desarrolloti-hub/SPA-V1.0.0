/* ========================================
   MIS SALIDAS CONTROLLER - RSI ENTERPRISE
   Controlador para consultar salidas asignadas y firmar la aceptación
   ======================================== */

import ChecklistVehiculoService from '../../services/checklistVehiculoService.js';
import AuthService from '../../services/authService.js';
import { DigitalSignatureCanvas } from '../../utils/digitalSignatureCanvas.js';

export class MisSalidasController {
    constructor() {
        this.service = new ChecklistVehiculoService();
        this.authService = new AuthService();
        this.salidas = [];
        this.signaturePad = null;
        this.salidaSeleccionadaParaFirmar = null;
    }

    async init() {
        console.log('✍️ Inicializando MisSalidasController...');

        const session = this.authService.getSession();
        if (!session || !session.uid) {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/login?returnUrl=/partner/mis-salidas');
            } else {
                window.location.href = '/login?returnUrl=/partner/mis-salidas';
            }
            return;
        }

        this.cacheDOM();
        this.bindEvents();
        await this.cargarSalidas();

        // Si viene un checklistId en la URL, abrir directamente el modal de firma
        const params = new URLSearchParams(window.location.search);
        const checklistId = params.get('firmarId');
        if (checklistId) {
            setTimeout(() => this.abrirModalFirmar(checklistId), 300);
        }
    }

    cacheDOM() {
        this.dom = {
            tableBody: document.getElementById('misSalidasTableBody'),
            tableWrapper: document.getElementById('misSalidasTableWrapper'),
            loadingState: document.getElementById('loadingStateMisSalidas'),
            emptyState: document.getElementById('emptyStateMisSalidas'),
            emptyStateMsg: document.getElementById('emptyStateMisSalidasMsg'),
            countBadge: document.getElementById('misSalidasCount'),
            searchInput: document.getElementById('misSalidasSearchInput'),
            filterEstado: document.getElementById('filtroEstadoMisSalidas'),
            btnRefresh: document.getElementById('btnRefreshMisSalidas'),
            // Stats
            statTotal: document.getElementById('statMisTotal'),
            statPendientes: document.getElementById('statMisPendientes'),
            statEnRuta: document.getElementById('statMisEnRuta'),
            statConcluidas: document.getElementById('statMisConcluidas'),
            // Modal Firmar
            modalFirmar: document.getElementById('modalFirmarSalida'),
            modalFirmarTitle: document.getElementById('modalFirmarTitle'),
            firmaSalidaResumen: document.getElementById('firmaSalidaResumen'),
            canvasFirma: document.getElementById('canvasFirmaReceptor'),
            btnClearFirma: document.getElementById('btnClearFirmaCanvas'),
            observacionesReceptor: document.getElementById('firmaObservacionesReceptor'),
            chkDeclaracion: document.getElementById('chkDeclaracionAceptacion'),
            btnCloseModalFirmar: document.getElementById('btnCloseModalFirmar'),
            btnCancelModalFirmar: document.getElementById('btnCancelModalFirmar'),
            btnConfirmarFirma: document.getElementById('btnConfirmarFirma'),
            // Modal Detalle
            modalDetalle: document.getElementById('modalDetalleSalidaPropia'),
            modalDetalleTitle: document.getElementById('modalDetallePropiaTitle'),
            modalDetalleContent: document.getElementById('modalDetallePropiaContent'),
            btnCloseModalDetalle: document.getElementById('btnCloseModalDetallePropia'),
            btnCerrarModalDetalle: document.getElementById('btnCerrarModalDetallePropia')
        };
    }

    bindEvents() {
        if (this.dom.searchInput) {
            let debounceTimer;
            this.dom.searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.filtrarSalidas(), 300);
            });
        }

        if (this.dom.filterEstado) {
            this.dom.filterEstado.addEventListener('change', () => this.filtrarSalidas());
        }

        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.addEventListener('click', () => this.cargarSalidas());
        }

        // Modal Firmar eventos
        if (this.dom.btnClearFirma) {
            this.dom.btnClearFirma.addEventListener('click', () => {
                if (this.signaturePad) this.signaturePad.clear();
            });
        }

        if (this.dom.btnCloseModalFirmar) {
            this.dom.btnCloseModalFirmar.addEventListener('click', () => this.cerrarModalFirmar());
        }

        if (this.dom.btnCancelModalFirmar) {
            this.dom.btnCancelModalFirmar.addEventListener('click', () => this.cerrarModalFirmar());
        }

        if (this.dom.btnConfirmarFirma) {
            this.dom.btnConfirmarFirma.addEventListener('click', () => this.procesarFirma());
        }

        // Modal Detalle eventos
        if (this.dom.btnCloseModalDetalle) {
            this.dom.btnCloseModalDetalle.addEventListener('click', () => this.cerrarModalDetalle());
        }

        if (this.dom.btnCerrarModalDetalle) {
            this.dom.btnCerrarModalDetalle.addEventListener('click', () => this.cerrarModalDetalle());
        }

        // Delegación de eventos en tabla
        if (this.dom.tableBody) {
            this.dom.tableBody.addEventListener('click', (e) => {
                const btnFirmar = e.target.closest('.btn-abrir-firma-salida');
                if (btnFirmar) {
                    const id = btnFirmar.dataset.id;
                    this.abrirModalFirmar(id);
                    return;
                }

                const btnVer = e.target.closest('.btn-ver-salida-propia');
                if (btnVer) {
                    const id = btnVer.dataset.id;
                    this.abrirModalDetalle(id);
                    return;
                }
            });
        }
    }

    async cargarSalidas() {
        try {
            if (this.dom.loadingState) this.dom.loadingState.style.display = 'flex';
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';

            this.salidas = await this.service.getMisSalidasVehiculares();

            this.actualizarMetricas();
            this.filtrarSalidas();
        } catch (error) {
            console.error('❌ Error al cargar mis salidas:', error);
            if (this.dom.tableBody) {
                this.dom.tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--rsi-danger); padding: var(--rsi-spacing-lg);">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar las salidas: ${error.message}
                        </td>
                    </tr>
                `;
            }
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'block';
        } finally {
            if (this.dom.loadingState) this.dom.loadingState.style.display = 'none';
        }
    }

    actualizarMetricas() {
        const total = this.salidas.length;
        const pendientes = this.salidas.filter(s => s.estado === 'pendiente_aceptacion').length;
        const enRuta = this.salidas.filter(s => s.estado === 'aceptada').length;
        const concluidas = this.salidas.filter(s => s.estado === 'concluida').length;

        if (this.dom.statTotal) this.dom.statTotal.textContent = total;
        if (this.dom.statPendientes) this.dom.statPendientes.textContent = pendientes;
        if (this.dom.statEnRuta) this.dom.statEnRuta.textContent = enRuta;
        if (this.dom.statConcluidas) this.dom.statConcluidas.textContent = concluidas;
    }

    filtrarSalidas() {
        const term = (this.dom.searchInput?.value || '').trim().toLowerCase();
        const estado = this.dom.filterEstado?.value || 'todos';

        let filtrados = [...this.salidas];

        if (estado !== 'todos') {
            filtrados = filtrados.filter(s => s.estado === estado);
        }

        if (term) {
            filtrados = filtrados.filter(s => {
                const folio = (s.folio || '').toLowerCase();
                const placas = (s.vehiculoPlacas || '').toLowerCase();
                const eco = (s.vehiculoNumEconomico || '').toLowerCase();
                const marca = (s.vehiculoInfo?.marca || '').toLowerCase();
                const modelo = (s.vehiculoInfo?.modelo || '').toLowerCase();
                const insp = (s.inspectorNombre || '').toLowerCase();
                return folio.includes(term) || placas.includes(term) || eco.includes(term) || marca.includes(term) || modelo.includes(term) || insp.includes(term);
            });
        }

        this.renderTable(filtrados);
    }

    renderTable(lista) {
        if (this.dom.countBadge) {
            this.dom.countBadge.textContent = lista ? lista.length : 0;
        }

        if (!lista || lista.length === 0) {
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) {
                this.dom.emptyState.style.display = 'block';
                const estadoVal = this.dom.filterEstado?.value;
                if (estadoVal === 'pendiente_aceptacion') {
                    if (this.dom.emptyStateMsg) this.dom.emptyStateMsg.textContent = '¡Excelente! No tienes salidas vehiculares pendientes de firma en este momento.';
                } else {
                    if (this.dom.emptyStateMsg) this.dom.emptyStateMsg.textContent = 'No se encontraron salidas vehiculares registradas para tu cuenta con los filtros actuales.';
                }
            }
            if (this.dom.tableBody) this.dom.tableBody.innerHTML = '';
            return;
        }

        if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';
        if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'block';

        const estadoBadges = {
            pendiente_aceptacion: '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-clock"></i> Pendiente de Firma</span>',
            aceptada: '<span class="rsi-badge rsi-badge-primary"><i class="fas fa-route"></i> En Ruta / Aceptada</span>',
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
                const esPendiente = item.estado === 'pendiente_aceptacion';

                return `
                    <tr style="${esPendiente ? 'background: rgba(245, 158, 11, 0.04);' : ''}">
                        <td>
                            <strong style="color: var(--rsi-text-gold); font-family: monospace; font-size: 0.95rem;">
                                ${item.folio || 'S/F'}
                            </strong>
                        </td>
                        <td>
                            <div style="font-weight: 600; color: var(--rsi-text-primary);">
                                ${item.vehiculoInfo?.marca || ''} ${item.vehiculoInfo?.modelo || ''}
                            </div>
                            <div style="font-size: 0.78rem; color: var(--rsi-text-secondary); margin-top: 2px;">
                                <span class="rsi-badge rsi-badge-outline" style="font-family: monospace; font-weight: 700; padding: 1px 6px;">
                                    ${item.vehiculoPlacas || 'S/P'}
                                </span>
                                ${item.vehiculoNumEconomico ? `<span style="margin-left: 6px;">Eco: <strong>${item.vehiculoNumEconomico}</strong></span>` : ''}
                            </div>
                        </td>
                        <td>
                            <span style="font-size: 0.88rem; color: var(--rsi-text-primary);">${item.inspectorNombre || 'Inspector'}</span>
                        </td>
                        <td>
                            <span style="font-family: monospace; font-weight: 600;">${km} km</span>
                            <div style="font-size: 0.75rem; color: var(--rsi-text-muted);">Combustible: ${item.nivelCombustibleSalida || '1/2'}</div>
                        </td>
                        <td>
                            <span style="font-size: 0.82rem; color: var(--rsi-text-muted);">${fechaStr}</span>
                        </td>
                        <td>
                            ${badge}
                        </td>
                        <td>
                            <div class="rsi-table-actions" style="justify-content: center; gap: 8px;">
                                ${esPendiente ? `
                                    <button type="button" class="rsi-btn-action rsi-btn-action-primary btn-abrir-firma-salida" data-id="${item.id}" style="padding: 6px 12px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;" title="Firmar y Recibir Automóvil">
                                        <i class="fas fa-signature"></i> Firmar Salida
                                    </button>
                                ` : ''}
                                <button type="button" class="rsi-btn-icon rsi-btn-icon-view btn-ver-salida-propia" data-id="${item.id}" title="Ver Inspección y Fotos">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    abrirModalFirmar(checklistId) {
        const item = this.salidas.find(s => s.id === checklistId);
        if (!item) return;

        this.salidaSeleccionadaParaFirmar = item;

        if (this.dom.modalFirmarTitle) {
            this.dom.modalFirmarTitle.innerHTML = `<i class="fas fa-file-signature"></i> Firmar Salida: ${item.folio} (${item.vehiculoPlacas})`;
        }

        if (this.dom.firmaSalidaResumen) {
            this.dom.firmaSalidaResumen.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; font-size: 0.88rem;">
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Vehículo:</span>
                        <strong>${item.vehiculoInfo?.marca || ''} ${item.vehiculoInfo?.modelo || ''}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Placas / No. Eco:</span>
                        <strong style="color: var(--rsi-text-gold); font-family: monospace;">${item.vehiculoPlacas} ${item.vehiculoNumEconomico ? `(${item.vehiculoNumEconomico})` : ''}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Odómetro Inicial:</span>
                        <strong style="font-family: monospace;">${(item.kilometrajeSalida || 0).toLocaleString()} km</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Inspector que entrega:</span>
                        <span>${item.inspectorNombre || 'Inspector'}</span>
                    </div>
                </div>
            `;
        }

        if (this.dom.observacionesReceptor) this.dom.observacionesReceptor.value = '';
        if (this.dom.chkDeclaracion) this.dom.chkDeclaracion.checked = false;

        if (this.dom.modalFirmar) {
            this.dom.modalFirmar.style.display = 'flex';
        }

        // Inicializar canvas de firma
        if (this.dom.canvasFirma) {
            setTimeout(() => {
                if (this.signaturePad) {
                    this.signaturePad.destroy();
                }
                this.signaturePad = new DigitalSignatureCanvas(this.dom.canvasFirma, {
                    strokeColor: '#0F172A',
                    lineWidth: 2.5
                });
            }, 100);
        }
    }

    cerrarModalFirmar() {
        if (this.dom.modalFirmar) {
            this.dom.modalFirmar.style.display = 'none';
        }
        if (this.signaturePad) {
            this.signaturePad.clear();
        }
        this.salidaSeleccionadaParaFirmar = null;
    }

    async procesarFirma() {
        if (!this.salidaSeleccionadaParaFirmar) return;

        if (!this.signaturePad || this.signaturePad.isEmpty()) {
            Swal.fire({
                icon: 'warning',
                title: 'Firma requerida',
                text: 'Por favor dibuja tu firma manuscrita en el lienzo para poder aceptar la salida.',
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        if (!this.dom.chkDeclaracion || !this.dom.chkDeclaracion.checked) {
            Swal.fire({
                icon: 'warning',
                title: 'Declaración de conformidad requerida',
                text: 'Debes marcar la casilla aceptando la responsabilidad y revisión de la unidad.',
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        Swal.fire({
            title: 'Procesando firma y aceptando salida...',
            text: 'Subiendo firma digital a Storage y actualizando el estado de la unidad...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const firmaBlob = await this.signaturePad.toBlob();
            const firmaDataUrl = this.signaturePad.toDataURL();
            const observaciones = this.dom.observacionesReceptor?.value || '';

            const res = await this.service.firmarAceptacionSalida(this.salidaSeleccionadaParaFirmar.id, {
                firmaBlob,
                firmaDataUrl,
                declaracionAceptada: true,
                observacionesReceptor: observaciones
            });

            if (res.success) {
                this.cerrarModalFirmar();
                await this.cargarSalidas();
                Swal.fire({
                    icon: 'success',
                    title: '¡Salida Firmada y Aceptada!',
                    text: res.message,
                    confirmButtonColor: '#D4AF37'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo firmar la salida',
                    text: res.error || 'Ocurrió un error al procesar la firma.',
                    confirmButtonColor: '#D4AF37'
                });
            }
        } catch (error) {
            console.error('❌ Error procesando firma:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de procesamiento',
                text: error.message,
                confirmButtonColor: '#D4AF37'
            });
        }
    }

    abrirModalDetalle(checklistId) {
        const item = this.salidas.find(s => s.id === checklistId);
        if (!item || !this.dom.modalDetalle || !this.dom.modalDetalleContent) return;

        if (this.dom.modalDetalleTitle) {
            this.dom.modalDetalleTitle.innerHTML = `<i class="fas fa-clipboard-check"></i> Salida ${item.folio || ''} — ${item.vehiculoPlacas || ''}`;
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

        this.dom.modalDetalleContent.innerHTML = `
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
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Inspector:</span>
                        <strong>${item.inspectorNombre || '-'}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Odómetro Inicial:</span>
                        <strong style="font-family: monospace;">${(item.kilometrajeSalida || 0).toLocaleString()} km</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Fecha Registro:</span>
                        <span>${fechaStr}</span>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--rsi-text-muted); display: block;">Combustible:</span>
                        <span>${item.nivelCombustibleSalida || '1/2'}</span>
                    </div>
                </div>
            </div>

            <!-- Daños u Observaciones detectadas -->
            <div style="margin-bottom: var(--rsi-spacing-lg);">
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-circle" style="color: var(--rsi-warning);"></i> Observaciones de Inspección
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
                        <i class="fas fa-check-circle" style="color: var(--rsi-success);"></i> No se registraron anomalías en la inspección.
                    </div>
                `}
            </div>

            <!-- Evidencias Fotográficas -->
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
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Estado de Firma -->
            <div>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-signature" style="color: var(--rsi-primary);"></i> Estado de Firma y Aceptación
                </h4>
                ${aceptacion.firmado && aceptacion.firmaUrl ? `
                    <div style="display: flex; gap: var(--rsi-spacing-lg); align-items: center; background: var(--rsi-bg-card); border: 1.5px solid var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-md); flex-wrap: wrap;">
                        <img src="${aceptacion.firmaUrl}" alt="Firma Electrónica" style="max-height: 90px; border: 1px dashed var(--rsi-border-color); border-radius: var(--rsi-radius-sm); background: #ffffff; padding: 4px;" />
                        <div style="font-size: 0.88rem; flex: 1;">
                            <p style="margin: 0 0 4px 0;"><strong>Firmado por:</strong> ${aceptacion.firmadoPorNombre || item.receptorNombre}</p>
                            <p style="margin: 0 0 4px 0; color: var(--rsi-text-secondary); font-size: 0.82rem;"><strong>Fecha y Hora:</strong> ${aceptacion.fechaHoraFirma ? new Date(aceptacion.fechaHoraFirma).toLocaleString('es-MX') : '-'}</p>
                            ${aceptacion.observacionesReceptor ? `<p style="margin: 4px 0; font-size: 0.82rem;"><strong>Nota:</strong> ${aceptacion.observacionesReceptor}</p>` : ''}
                            <span class="rsi-badge rsi-badge-success" style="margin-top: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas fa-check-double"></i> SALIDA ACEPTADA
                            </span>
                        </div>
                    </div>
                ` : `
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--rsi-radius-md); padding: 12px 16px; font-size: 0.88rem; color: var(--rsi-warning-text); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-clock" style="font-size: 1.2rem; color: var(--rsi-warning);"></i>
                            <span>Esta salida aún no ha sido firmada.</span>
                        </div>
                        <button type="button" class="rsi-btn-action rsi-btn-action-primary btn-abrir-firma-salida" data-id="${item.id}" style="padding: 6px 14px; font-size: 0.85rem;">
                            <i class="fas fa-signature"></i> Firmar Ahora
                        </button>
                    </div>
                `}
            </div>
        `;

        this.dom.modalDetalle.style.display = 'flex';
    }

    cerrarModalDetalle() {
        if (this.dom.modalDetalle) {
            this.dom.modalDetalle.style.display = 'none';
        }
    }
}

export async function misSalidasController() {
    const controller = new MisSalidasController();
    await controller.init();
}

export default misSalidasController;
