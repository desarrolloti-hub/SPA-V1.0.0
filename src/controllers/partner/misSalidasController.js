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
        this.salidaSeleccionadaParaRetorno = null;
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
            btnCerrarModalDetalle: document.getElementById('btnCerrarModalDetallePropia'),
            // Modal Retorno
            modalRetorno: document.getElementById('modalRetornarVehiculo'),
            modalRetornoTitle: document.getElementById('modalRetornoTitle'),
            retornoSalidaResumen: document.getElementById('retornoSalidaResumen'),
            retornoKilometraje: document.getElementById('retornoKilometraje'),
            retornoCombustible: document.getElementById('retornoCombustible'),
            retornoObservaciones: document.getElementById('retornoObservaciones'),
            retornoKmAyuda: document.getElementById('retornoKmAyuda'),
            btnCloseModalRetorno: document.getElementById('btnCloseModalRetorno'),
            btnCancelModalRetorno: document.getElementById('btnCancelModalRetorno'),
            btnConfirmarRetorno: document.getElementById('btnConfirmarRetorno')
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

        // Modal Retorno eventos
        if (this.dom.btnCloseModalRetorno) {
            this.dom.btnCloseModalRetorno.addEventListener('click', () => this.cerrarModalRetorno());
        }

        if (this.dom.btnCancelModalRetorno) {
            this.dom.btnCancelModalRetorno.addEventListener('click', () => this.cerrarModalRetorno());
        }

        if (this.dom.btnConfirmarRetorno) {
            this.dom.btnConfirmarRetorno.addEventListener('click', () => this.procesarRetorno());
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

                const btnRetorno = e.target.closest('.btn-abrir-retorno');
                if (btnRetorno) {
                    const id = btnRetorno.dataset.id;
                    this.abrirModalRetorno(id);
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
                const esAceptada = item.estado === 'aceptada';

                return `
                    <tr style="${esPendiente ? 'background: rgba(245, 158, 11, 0.04);' : ''}">
                        <td data-label="Folio">
                            <strong style="color: var(--rsi-text-gold); font-family: monospace; font-size: 0.95rem;">
                                ${item.folio || 'S/F'}
                            </strong>
                        </td>
                        <td data-label="Vehículo">
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
                        <td data-label="Inspector">
                            <span style="font-size: 0.88rem; color: var(--rsi-text-primary);">${item.inspectorNombre || 'Inspector'}</span>
                        </td>
                        <td data-label="Odómetro Salida">
                            <span style="font-family: monospace; font-weight: 600;">${km} km</span>
                            <div style="font-size: 0.75rem; color: var(--rsi-text-muted);">Combustible: ${item.nivelCombustibleSalida || '1/2'}</div>
                            ${item.retorno?.kilometrajeRetorno ? `
                                <div style="font-size: 0.75rem; color: var(--rsi-success); font-family: monospace; margin-top: 2px;">
                                    <i class="fas fa-undo"></i> Llegada: ${item.retorno.kilometrajeRetorno.toLocaleString()} km
                                </div>
                            ` : ''}
                        </td>
                        <td data-label="Fecha Registro">
                            <span style="font-size: 0.82rem; color: var(--rsi-text-muted);">${fechaStr}</span>
                        </td>
                        <td data-label="Estado">
                            ${badge}
                        </td>
                        <td data-label="Acciones" style="text-align: center;">
                            <div class="rsi-table-actions">
                                ${esPendiente ? `
                                    <button type="button" class="rsi-btn-icon rsi-btn-icon-warning btn-abrir-firma-salida" data-id="${item.id}" title="Firmar Salida">
                                        <i class="fas fa-file-signature"></i>
                                    </button>
                                ` : ''}
                                ${esAceptada ? `
                                    <button type="button" class="rsi-btn-icon rsi-btn-icon-return btn-abrir-retorno" data-id="${item.id}" title="Regresar Vehículo">
                                        <i class="fas fa-undo"></i>
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

    abrirModalRetorno(checklistId) {
        const item = this.salidas.find(s => s.id === checklistId);
        if (!item) return;

        this.salidaSeleccionadaParaRetorno = item;

        if (this.dom.modalRetornoTitle) {
            this.dom.modalRetornoTitle.innerHTML = `<i class="fas fa-undo"></i> Registrar Regreso de Vehículo: ${item.folio} (${item.vehiculoPlacas})`;
        }

        if (this.dom.retornoSalidaResumen) {
            this.dom.retornoSalidaResumen.innerHTML = `
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
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Odómetro Inicial Salida:</span>
                        <strong style="font-family: monospace;">${(item.kilometrajeSalida || 0).toLocaleString()} km</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Combustible Salida:</span>
                        <span>${item.nivelCombustibleSalida || '1/2'}</span>
                    </div>
                </div>
            `;
        }

        const kmMin = item.kilometrajeSalida || 0;
        if (this.dom.retornoKilometraje) {
            this.dom.retornoKilometraje.value = kmMin;
            this.dom.retornoKilometraje.min = kmMin;
        }

        if (this.dom.retornoKmAyuda) {
            this.dom.retornoKmAyuda.textContent = `Mínimo permitido: ${kmMin.toLocaleString()} km (odómetro de salida).`;
        }

        if (this.dom.retornoCombustible) {
            this.dom.retornoCombustible.value = item.nivelCombustibleSalida || '1/2';
        }

        if (this.dom.retornoObservaciones) {
            this.dom.retornoObservaciones.value = '';
        }

        if (this.dom.modalRetorno) {
            this.dom.modalRetorno.style.display = 'flex';
        }
    }

    cerrarModalRetorno() {
        if (this.dom.modalRetorno) {
            this.dom.modalRetorno.style.display = 'none';
        }
        this.salidaSeleccionadaParaRetorno = null;
    }

    async procesarRetorno() {
        if (!this.salidaSeleccionadaParaRetorno) return;

        const item = this.salidaSeleccionadaParaRetorno;
        const kmSalida = item.kilometrajeSalida || 0;
        const kmRetornoVal = parseFloat(this.dom.retornoKilometraje?.value);

        if (isNaN(kmRetornoVal) || kmRetornoVal < 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Odómetro requerido',
                text: 'Por favor ingresa un odómetro numérico válido para registrar el regreso del vehículo.',
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        if (kmRetornoVal < kmSalida) {
            Swal.fire({
                icon: 'warning',
                title: 'Odómetro inválido',
                text: `El odómetro de llegada (${kmRetornoVal.toLocaleString()} km) no puede ser menor al de salida (${kmSalida.toLocaleString()} km).`,
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        const combustibleRetorno = this.dom.retornoCombustible?.value || '1/2';
        const observaciones = (this.dom.retornoObservaciones?.value || '').trim();
        const kmRecorridos = Math.max(0, kmRetornoVal - kmSalida);

        const confirmResult = await Swal.fire({
            title: '¿Confirmar retorno del vehículo?',
            html: `
                <div style="text-align: left; font-size: 0.9rem; line-height: 1.6;">
                    <p style="margin: 0 0 6px 0;"><strong>Vehículo:</strong> ${item.vehiculoInfo?.marca || ''} ${item.vehiculoInfo?.modelo || ''} (${item.vehiculoPlacas})</p>
                    <p style="margin: 0 0 6px 0;"><strong>Odómetro de Llegada:</strong> <span style="font-family: monospace; font-weight: 700; color: #d4af37;">${kmRetornoVal.toLocaleString()} km</span> (+${kmRecorridos.toLocaleString()} km recorridos)</p>
                    <p style="margin: 0 0 6px 0;"><strong>Nivel de Combustible:</strong> ${combustibleRetorno}</p>
                    <p style="margin: 0; color: #16a34a; font-weight: 600;"><i class="fas fa-check-circle"></i> La unidad quedará disponible de inmediato en el parque vehicular.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#64748b',
            confirmButtonText: '<i class="fas fa-undo"></i> Sí, registrar regreso',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmResult.isConfirmed) return;

        Swal.fire({
            title: 'Registrando retorno del vehículo...',
            text: 'Actualizando estado a Disponible y concluyendo la salida operativa...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await this.service.registrarRetornoVehiculo(item.id, {
                kilometrajeRetorno: kmRetornoVal,
                nivelCombustibleRetorno: combustibleRetorno,
                observacionesRetorno: observaciones
            });

            if (res.success) {
                this.cerrarModalRetorno();
                await this.cargarSalidas();
                Swal.fire({
                    icon: 'success',
                    title: '¡Vehículo Regresado con Éxito!',
                    text: res.message,
                    confirmButtonColor: '#D4AF37'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo registrar el retorno',
                    text: res.error || 'Ocurrió un error al procesar el retorno del vehículo.',
                    confirmButtonColor: '#D4AF37'
                });
            }
        } catch (error) {
            console.error('❌ Error procesando retorno de vehículo:', error);
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

            <!-- Retorno y Devolución del Vehículo (si concluida) -->
            ${item.retorno && item.retorno.completado ? `
                <div style="margin-top: var(--rsi-spacing-lg);">
                    <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: var(--rsi-success);"></i> Devolución y Retorno del Vehículo
                    </h4>
                    <div style="background: rgba(34, 197, 94, 0.08); border: 1.5px solid rgba(34, 197, 94, 0.3); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-md);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.88rem;">
                            <div>
                                <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Fecha y Hora Retorno:</span>
                                <strong>${item.retorno.fechaHoraRetorno ? new Date(item.retorno.fechaHoraRetorno).toLocaleString('es-MX') : '-'}</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Odómetro Llegada:</span>
                                <strong style="font-family: monospace; color: var(--rsi-text-gold); font-size: 0.95rem;">${(item.retorno.kilometrajeRetorno || 0).toLocaleString()} km</strong>
                                <small style="display: block; color: var(--rsi-text-secondary);">(Recorrido: +${Math.max(0, (item.retorno.kilometrajeRetorno || 0) - (item.kilometrajeSalida || 0)).toLocaleString()} km)</small>
                            </div>
                            <div>
                                <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Combustible Llegada:</span>
                                <strong>${item.retorno.nivelCombustibleRetorno || '-'}</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--rsi-text-muted); display: block;">Regresado por:</span>
                                <strong>${item.retorno.retornadoPorNombre || item.receptorNombre || '-'}</strong>
                            </div>
                        </div>
                        ${item.retorno.observacionesRetorno ? `
                            <div style="margin-top: 10px; font-size: 0.85rem; border-top: 1px dashed rgba(34, 197, 94, 0.3); padding-top: 8px;">
                                <strong>Observaciones al entregar:</strong> ${item.retorno.observacionesRetorno}
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
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
