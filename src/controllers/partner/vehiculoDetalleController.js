/* ========================================
   VEHICULO DETALLE CONTROLLER - RSI ENTERPRISE
   Ficha técnica individual e historial completo de inspecciones
   ======================================== */

import VehiculoService from '../../services/vehiculoService.js';
import ChecklistVehiculoService from '../../services/checklistVehiculoService.js';

export class VehiculoDetalleController {
    constructor() {
        this.vehiculoService = new VehiculoService();
        this.checklistService = new ChecklistVehiculoService();
        this.vehiculoId = null;
        this.vehiculo = null;
        this.historial = [];
    }

    async init() {
        console.log('🔍 Inicializando VehiculoDetalleController...');
        this.cacheDOM();

        const params = new URLSearchParams(window.location.search);
        this.vehiculoId = params.get('id');

        if (!this.vehiculoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Vehículo no especificado',
                text: 'Redirigiendo al parque vehicular...',
                confirmButtonColor: '#D4AF37'
            }).then(() => {
                window.location.hash = '';
                window.history.pushState({}, '', '/partner/vehiculos');
                window.dispatchEvent(new CustomEvent('route:changed'));
            });
            return;
        }

        this.bindEvents();
        await this.cargarDetalle();
    }

    cacheDOM() {
        this.dom = {
            headerActions: document.getElementById('detailHeaderActions'),
            badgeEstado: document.getElementById('detailBadgeEstado'),
            badgeEco: document.getElementById('detailBadgeEco'),
            badgePlacas: document.getElementById('detailBadgePlacas'),
            titulo: document.getElementById('detailTituloVehiculo'),
            vehiculoImg: document.getElementById('detailVehiculoImg'),
            iconFallback: document.getElementById('detailIconFallback'),
            subInfo: document.getElementById('detailSubInfo'),
            kmActual: document.getElementById('detailKmActual'),
            combustible: document.getElementById('detailCombustible'),
            conductorActual: document.getElementById('detailConductorActual'),
            totalSalidas: document.getElementById('detailTotalSalidas'),
            // Specs
            specMarca: document.getElementById('specMarca'),
            specModelo: document.getElementById('specModelo'),
            specAnio: document.getElementById('specAnio'),
            specColor: document.getElementById('specColor'),
            specVIN: document.getElementById('specVIN'),
            specTipo: document.getElementById('specTipo'),
            specFechaRegistro: document.getElementById('specFechaRegistro'),
            specObservaciones: document.getElementById('specObservaciones'),
            // History
            historyCounter: document.getElementById('historyCounter'),
            historyList: document.getElementById('vehiculoHistoryList'),
            // Modal
            modal: document.getElementById('modalChecklistDetalle'),
            modalTitle: document.getElementById('modalChecklistTitle'),
            modalContent: document.getElementById('modalChecklistContent'),
            btnCloseModal: document.getElementById('btnCloseModalChecklistDetalle'),
            btnCerrarModal: document.getElementById('btnCerrarModalChecklistDetalle')
        };
    }

    bindEvents() {
        if (this.dom.btnCloseModal) {
            this.dom.btnCloseModal.addEventListener('click', () => this.cerrarModal());
        }

        if (this.dom.btnCerrarModal) {
            this.dom.btnCerrarModal.addEventListener('click', () => this.cerrarModal());
        }

        if (this.dom.historyList) {
            this.dom.historyList.addEventListener('click', (e) => {
                const btnView = e.target.closest('.btn-ver-checklist-modal');
                if (btnView) {
                    const checklistId = btnView.dataset.id;
                    this.abrirModalChecklist(checklistId);
                }
            });
        }
    }

    async cargarDetalle() {
        try {
            const data = await this.vehiculoService.getVehiculoDetalleConHistorial(this.vehiculoId);
            this.vehiculo = data.vehiculo;
            this.historial = data.historial || [];

            if (!this.vehiculo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Automóvil no encontrado',
                    text: 'El vehículo solicitado no existe o fue removido.',
                    confirmButtonColor: '#D4AF37'
                });
                return;
            }

            this.renderFichaTecnica();
            this.renderHistorial();
        } catch (error) {
            console.error('❌ Error cargando detalle de vehículo:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de carga',
                text: error.message,
                confirmButtonColor: '#D4AF37'
            });
        }
    }

    renderFichaTecnica() {
        const v = this.vehiculo;

        const estadoBadgeClasses = {
            disponible: 'activo',
            en_salida: 'activo',
            salida_pendiente: 'activo',
            mantenimiento: 'inactivo',
            inactivo: 'inactivo'
        };

        const estadoLabels = {
            disponible: 'Disponible',
            en_salida: 'En Ruta',
            salida_pendiente: 'Por Firmar',
            mantenimiento: 'Mantenimiento',
            inactivo: 'Inactivo'
        };

        if (this.dom.badgeEstado) {
            this.dom.badgeEstado.className = `rsi-badge-status ${estadoBadgeClasses[v.estadoOperativo] || 'inactivo'}`;
            this.dom.badgeEstado.textContent = estadoLabels[v.estadoOperativo] || v.estadoOperativo;
        }

        if (this.dom.badgeEco) this.dom.badgeEco.textContent = `No. Eco: ${v.numeroEconomico || 'S/N'}`;
        if (this.dom.badgePlacas) this.dom.badgePlacas.textContent = `Placas: ${v.placas || 'S/P'}`;
        if (this.dom.titulo) this.dom.titulo.textContent = `${v.marca} ${v.modelo} ${v.anio ? `(${v.anio})` : ''}`;

        // Fotografía del vehículo
        if (v.imagenUrl && this.dom.vehiculoImg) {
            this.dom.vehiculoImg.src = v.imagenUrl;
            this.dom.vehiculoImg.alt = `${v.marca} ${v.modelo}`;
            this.dom.vehiculoImg.style.display = 'block';
            if (this.dom.iconFallback) this.dom.iconFallback.style.display = 'none';
        } else {
            if (this.dom.vehiculoImg) this.dom.vehiculoImg.style.display = 'none';
            if (this.dom.iconFallback) this.dom.iconFallback.style.display = 'flex';
        }

        if (this.dom.kmActual) this.dom.kmActual.textContent = `${(v.kilometrajeActual || 0).toLocaleString()} km`;
        if (this.dom.combustible) this.dom.combustible.textContent = v.combustibleNivel || '1/2';
        if (this.dom.conductorActual) this.dom.conductorActual.textContent = v.responsableActualNombre || 'Sin conductor asignado';
        if (this.dom.totalSalidas) this.dom.totalSalidas.textContent = this.historial.length;

        // Specs
        if (this.dom.specMarca) this.dom.specMarca.textContent = v.marca || '-';
        if (this.dom.specModelo) this.dom.specModelo.textContent = v.modelo || '-';
        if (this.dom.specAnio) this.dom.specAnio.textContent = v.anio || '-';
        if (this.dom.specColor) this.dom.specColor.textContent = v.color || '-';
        if (this.dom.specVIN) this.dom.specVIN.textContent = v.numeroSerie || 'No especificado';
        if (this.dom.specTipo) this.dom.specTipo.textContent = v.tipoVehiculo || 'Automóvil';
        if (this.dom.specFechaRegistro) {
            this.dom.specFechaRegistro.textContent = v.createdAt ? new Date(v.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        }
        if (this.dom.specObservaciones) {
            this.dom.specObservaciones.textContent = v.observaciones || 'Sin observaciones permanentes registradas para esta unidad.';
        }

        // Acciones superiores
        if (this.dom.headerActions) {
            if (v.activo && v.estadoOperativo === 'disponible') {
                this.dom.headerActions.innerHTML = `
                    <a href="/partner/checklist-salida?vehiculoId=${v.id}" class="rsi-btn-action rsi-btn-action-primary" data-link>
                        <i class="fas fa-clipboard-check"></i> Generar Salida para este Automóvil
                    </a>
                `;
            } else {
                this.dom.headerActions.innerHTML = '';
            }
        }
    }

    renderHistorial() {
        if (!this.dom.historyList) return;

        if (this.dom.historyCounter) {
            this.dom.historyCounter.textContent = `${this.historial.length} ${this.historial.length === 1 ? 'movimiento' : 'movimientos'}`;
        }

        if (!this.historial || this.historial.length === 0) {
            this.dom.historyList.innerHTML = `
                <div style="text-align: center; padding: var(--rsi-spacing-xl); color: var(--rsi-text-muted);">
                    <i class="fas fa-clipboard-list" style="font-size: 2.5rem; margin-bottom: 12px; color: var(--rsi-border-color);"></i>
                    <p style="font-size: 1rem; font-weight: 500; margin: 0;">Este automóvil no cuenta con salidas ni checklists registrados aún.</p>
                </div>
            `;
            return;
        }

        const estadoBadges = {
            pendiente_aceptacion: { label: 'Por Firmar', cls: 'rsi-badge-warning' },
            aceptada: { label: 'Aceptada / En Ruta', cls: 'rsi-badge-primary' },
            concluida: { label: 'Concluida', cls: 'rsi-badge-success' },
            cancelada: { label: 'Cancelada', cls: 'rsi-badge-secondary' }
        };

        this.dom.historyList.innerHTML = this.historial.map(item => {
            const st = estadoBadges[item.estado] || { label: item.estado, cls: 'rsi-badge-secondary' };
            const fechaStr = item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }) : '-';
            const km = (item.kilometrajeSalida || 0).toLocaleString();
            const fotosCount = Array.isArray(item.evidencias) ? item.evidencias.length : 0;
            const firmada = item.aceptacion && item.aceptacion.firmado;

            return `
                <div class="rsi-timeline-item ${firmada ? 'creacion' : 'modificacion'}">
                    <div style="background: var(--rsi-bg-card); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-md); padding: var(--rsi-spacing-md); width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                            <div>
                                <strong style="font-family: monospace; color: var(--rsi-text-gold); font-size: 0.95rem;">${item.folio || 'S/F'}</strong>
                                <span class="rsi-badge ${st.cls}" style="margin-left: 6px;">${st.label}</span>
                            </div>
                            <span style="font-size: 0.8rem; color: var(--rsi-text-muted);">
                                <i class="fas fa-calendar-alt"></i> ${fechaStr}
                            </span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.88rem; margin-bottom: 12px;">
                            <div>
                                <span style="color: var(--rsi-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 600; display: block;">Inspector:</span>
                                <strong>${item.inspectorNombre || 'Inspector'}</strong>
                            </div>
                            <div>
                                <span style="color: var(--rsi-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 600; display: block;">Conductor Asignado:</span>
                                <strong style="color: var(--rsi-text-gold);">${item.receptorNombre || 'Colaborador'}</strong>
                            </div>
                            <div>
                                <span style="color: var(--rsi-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 600; display: block;">Condiciones Salida:</span>
                                <span>Odómetro: <strong>${km} km</strong> · Combustible: <strong>${item.nivelCombustibleSalida || '-'}</strong></span>
                            </div>
                            <div>
                                <span style="color: var(--rsi-text-muted); font-size: 0.78rem; text-transform: uppercase; font-weight: 600; display: block;">Evidencias y Firma:</span>
                                <span><i class="fas fa-camera"></i> ${fotosCount} fotos · ${firmada ? '<span style="color: var(--rsi-success); font-weight: 600;"><i class="fas fa-check"></i> Firmada</span>' : '<span style="color: var(--rsi-warning); font-weight: 600;"><i class="fas fa-clock"></i> Pendiente</span>'}</span>
                            </div>
                        </div>

                        ${item.motivoSalida ? `
                            <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--rsi-text-secondary); background: var(--rsi-bg-secondary); padding: 6px 10px; border-radius: var(--rsi-radius-sm);">
                                <strong>Motivo:</strong> ${item.motivoSalida} ${item.destinoSalida ? `· <em>Destino: ${item.destinoSalida}</em>` : ''}
                            </p>
                        ` : ''}

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="rsi-btn-action rsi-btn-action-outline rsi-btn-sm btn-ver-checklist-modal" data-id="${item.id}">
                                <i class="fas fa-clipboard-check"></i> Ver Inspección y Evidencias
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async abrirModalChecklist(id) {
        const item = this.historial.find(h => h.id === id);
        if (!item || !this.dom.modal || !this.dom.modalContent) return;

        if (this.dom.modalTitle) {
            this.dom.modalTitle.innerHTML = `<i class="fas fa-file-signature"></i> Inspección ${item.folio || ''} — ${item.vehiculoPlacas || ''}`;
        }

        const fechaStr = item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium' }) : '-';
        const respuestas = item.respuestasChecklist || {};
        const evidencias = item.evidencias || [];
        const aceptacion = item.aceptacion || {};

        let respuestasHtml = '';
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

            <!-- Daños u Observaciones detectadas -->
            <div style="margin-bottom: var(--rsi-spacing-lg);">
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-circle" style="color: var(--rsi-warning);"></i> Hallazgos y Observaciones Detectadas
                </h4>
                ${itemsConObs.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${itemsConObs.map(obs => `
                            <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid var(--rsi-warning); padding: 8px 12px; border-radius: var(--rsi-radius-sm); font-size: 0.88rem;">
                                <strong>${obs.label || obs.key}:</strong>
                                <span style="color: var(--rsi-text-primary); margin-left: 6px;">${obs.observacion || 'Sin descripción'}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: var(--rsi-radius-md); padding: 10px 14px; font-size: 0.88rem; color: var(--rsi-success-text); display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: var(--rsi-success);"></i> Todos los puntos de inspección fueron calificados como correctos sin anomalías registradas.
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

            <!-- Firma Digital del Receptor -->
            <div>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--rsi-text-primary); margin-bottom: var(--rsi-spacing-sm); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-signature" style="color: var(--rsi-primary);"></i> Aceptación y Firma Electrónica
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
                        <span>Esta salida vehicular aún no ha sido firmada por el conductor asignado (${item.receptorNombre}). El colaborador debe ingresar a su perfil para firmar de conformidad.</span>
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
}

export async function vehiculoDetalleController() {
    const controller = new VehiculoDetalleController();
    await controller.init();
}

export default vehiculoDetalleController;
