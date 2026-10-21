/* ========================================
   VEHICULOS CRUD CONTROLLER - RSI ENTERPRISE
   Controlador para administración del parque vehicular
   ======================================== */

import VehiculoService from '../../services/vehiculoService.js';

export class VehiculosCrudController {
    constructor() {
        this.service = new VehiculoService();
        this.vehiculos = [];
        this.editingId = null;
    }

    async init() {
        console.log('🚗 Inicializando VehiculosCrudController...');
        this.cacheDOM();
        this.bindEvents();
        await this.cargarVehiculos();
    }

    cacheDOM() {
        this.dom = {
            tableBody: document.getElementById('vehiculosTableBody'),
            tableWrapper: document.getElementById('vehiculosTableWrapper'),
            loadingState: document.getElementById('loadingStateVehiculos'),
            emptyState: document.getElementById('emptyStateVehiculos'),
            btnEmptyNuevo: document.getElementById('btnEmptyNuevoVehiculo'),
            vehiculoCount: document.getElementById('vehiculoCount'),
            searchInput: document.getElementById('vehSearchInput'),
            clearSearchBtn: document.getElementById('clearSearchBtn'),
            filterEstado: document.getElementById('filterEstado'),
            filterActivo: document.getElementById('filterActivo'),
            btnRefresh: document.getElementById('btnRefreshVehiculos'),
            btnNuevo: document.getElementById('btnNuevoVehiculo'),
            // Stats
            statTotal: document.getElementById('statTotalVehiculos'),
            statDisponibles: document.getElementById('statDisponibles'),
            statEnSalida: document.getElementById('statEnSalida'),
            statPorFirmar: document.getElementById('statPorFirmar')
        };
    }

    bindEvents() {
        if (this.dom.searchInput) {
            let debounceTimer;
            this.dom.searchInput.addEventListener('input', () => {
                if (this.dom.clearSearchBtn) {
                    this.dom.clearSearchBtn.style.display = this.dom.searchInput.value ? 'inline-flex' : 'none';
                }
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.filtrarVehiculos(), 300);
            });
        }

        if (this.dom.clearSearchBtn) {
            this.dom.clearSearchBtn.addEventListener('click', () => {
                if (this.dom.searchInput) this.dom.searchInput.value = '';
                this.dom.clearSearchBtn.style.display = 'none';
                this.filtrarVehiculos();
            });
        }

        if (this.dom.filterEstado) {
            this.dom.filterEstado.addEventListener('change', () => this.filtrarVehiculos());
        }

        if (this.dom.filterActivo) {
            this.dom.filterActivo.addEventListener('change', () => this.cargarVehiculos());
        }

        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.addEventListener('click', () => this.cargarVehiculos(true));
        }

        // Delegación de eventos en el cuerpo de la tabla
        if (this.dom.tableBody) {
            this.dom.tableBody.addEventListener('click', (e) => {
                const btnToggle = e.target.closest('.btn-toggle-vehiculo');
                if (btnToggle) {
                    const id = btnToggle.dataset.id;
                    const activo = btnToggle.dataset.activo === 'true';
                    this.confirmarToggleActivo(id, !activo);
                    return;
                }
            });
        }
    }

    async cargarVehiculos(forceRefresh = false) {
        try {
            if (this.dom.loadingState) this.dom.loadingState.style.display = 'flex';
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';

            const activoFiltro = this.dom.filterActivo ? this.dom.filterActivo.value : 'true';
            this.vehiculos = await this.service.getVehiculos({ activo: activoFiltro }, forceRefresh);

            this.actualizarMetricas();
            this.filtrarVehiculos();
        } catch (error) {
            console.error('❌ Error al cargar vehículos:', error);
            if (this.dom.tableBody) {
                this.dom.tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; color: var(--rsi-danger); padding: var(--rsi-spacing-lg);">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar los vehículos: ${error.message}
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
        const total = this.vehiculos.length;
        const disponibles = this.vehiculos.filter(v => v.activo && v.estadoOperativo === 'disponible').length;
        const enSalida = this.vehiculos.filter(v => v.activo && v.estadoOperativo === 'en_salida').length;
        const porFirmar = this.vehiculos.filter(v => v.activo && v.estadoOperativo === 'salida_pendiente').length;

        if (this.dom.statTotal) this.dom.statTotal.textContent = total;
        if (this.dom.statDisponibles) this.dom.statDisponibles.textContent = disponibles;
        if (this.dom.statEnSalida) this.dom.statEnSalida.textContent = enSalida;
        if (this.dom.statPorFirmar) this.dom.statPorFirmar.textContent = porFirmar;
    }

    filtrarVehiculos() {
        const term = (this.dom.searchInput?.value || '').trim().toLowerCase();
        const estado = this.dom.filterEstado?.value || 'todos';

        let filtrados = [...this.vehiculos];

        if (estado !== 'todos') {
            filtrados = filtrados.filter(v => v.estadoOperativo === estado);
        }

        if (term) {
            filtrados = filtrados.filter(v => {
                const placas = (v.placas || '').toLowerCase();
                const eco = (v.numeroEconomico || '').toLowerCase();
                const marca = (v.marca || '').toLowerCase();
                const modelo = (v.modelo || '').toLowerCase();
                const resp = (v.responsableActualNombre || '').toLowerCase();
                return placas.includes(term) || eco.includes(term) || marca.includes(term) || modelo.includes(term) || resp.includes(term);
            });
        }

        this.renderVehiculos(filtrados);
    }

    renderVehiculos(lista) {
        if (this.dom.vehiculoCount) {
            this.dom.vehiculoCount.textContent = lista ? lista.length : 0;
        }

        if (!lista || lista.length === 0) {
            if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'none';
            if (this.dom.emptyState) this.dom.emptyState.style.display = 'block';
            if (this.dom.tableBody) this.dom.tableBody.innerHTML = '';
            return;
        }

        if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';
        if (this.dom.tableWrapper) this.dom.tableWrapper.style.display = 'block';

        const estadoBadgeClasses = {
            disponible: 'rsi-badge-success',
            en_salida: 'rsi-badge-primary',
            salida_pendiente: 'rsi-badge-warning',
            mantenimiento: 'rsi-badge-danger',
            inactivo: 'rsi-badge-secondary'
        };

        const estadoLabels = {
            disponible: 'Disponible',
            en_salida: 'En Ruta',
            salida_pendiente: 'Por Firmar',
            mantenimiento: 'Mantenimiento',
            inactivo: 'Inactivo'
        };

        if (this.dom.tableBody) {
            this.dom.tableBody.innerHTML = lista.map(v => {
                const badgeCls = estadoBadgeClasses[v.estadoOperativo] || 'rsi-badge-secondary';
                const estadoLbl = estadoLabels[v.estadoOperativo] || v.estadoOperativo;
                const km = (v.kilometrajeActual || 0).toLocaleString();
                const conductor = v.responsableActualNombre || 'Sin asignar';

                return `
                    <tr class="${!v.activo ? 'rsi-row-inactive' : ''}">
                        <td>
                            <strong style="color: var(--rsi-text-gold); font-family: monospace; font-size: 0.95rem;">
                                ${v.numeroEconomico || 'S/N'}
                            </strong>
                        </td>
                        <td>
                            <span class="rsi-badge rsi-badge-outline" style="font-family: monospace; font-weight: 700; letter-spacing: 0.5px;">
                                ${v.placas || 'S/P'}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${v.imagenUrl ? `
                                    <img src="${v.imagenUrl}" alt="${v.marca} ${v.modelo}" style="width: 44px; height: 32px; object-fit: cover; border-radius: var(--rsi-radius-sm); border: 1px solid var(--rsi-border-color); flex-shrink: 0;" />
                                ` : `
                                    <div style="width: 44px; height: 32px; border-radius: var(--rsi-radius-sm); background: var(--rsi-bg-secondary); border: 1px solid var(--rsi-border-color); display: flex; align-items: center; justify-content: center; color: var(--rsi-primary); flex-shrink: 0;">
                                        <i class="fas fa-car" style="font-size: 0.85rem;"></i>
                                    </div>
                                `}
                                <div>
                                    <div style="font-weight: 600; color: var(--rsi-text-primary);">
                                        ${v.marca} ${v.modelo}
                                    </div>
                                    <div style="font-size: 0.78rem; color: var(--rsi-text-secondary);">
                                        ${v.tipoVehiculo || 'Automóvil'} ${v.numeroSerie ? `· VIN: ${v.numeroSerie}` : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span style="font-size: 0.88rem; color: var(--rsi-text-secondary);">
                                ${v.anio || '-'} ${v.color ? `· ${v.color}` : ''}
                            </span>
                        </td>
                        <td>
                            <span style="font-weight: 600; font-family: monospace;">
                                ${km} km
                            </span>
                        </td>
                        <td>
                            <span class="rsi-badge rsi-badge-secondary" style="font-size: 0.75rem;">
                                <i class="fas fa-gas-pump" style="font-size: 0.7rem; margin-right: 3px;"></i> ${v.combustibleNivel || '1/2'}
                            </span>
                        </td>
                        <td>
                            <span style="font-size: 0.88rem; color: var(--rsi-text-primary); font-weight: 500;" title="${conductor}">
                                ${conductor}
                            </span>
                        </td>
                        <td>
                            <span class="rsi-badge ${badgeCls}">
                                ${estadoLbl}
                            </span>
                        </td>
                        <td>
                            <div class="rsi-table-actions">
                                <a href="/partner/vehiculoDetalle?id=${v.id}" class="rsi-btn-icon rsi-btn-icon-view" data-link title="Ver Ficha e Historial">
                                    <i class="fas fa-eye"></i>
                                </a>
                                ${v.activo && v.estadoOperativo === 'disponible' ? `
                                    <a href="/partner/checklist-salida?vehiculoId=${v.id}" class="rsi-btn-icon rsi-btn-icon-success" data-link title="Registrar Salida">
                                        <i class="fas fa-clipboard-check"></i>
                                    </a>
                                ` : ''}
                                <a href="/partner/vehiculo-form?id=${v.id}" class="rsi-btn-icon rsi-btn-icon-edit" data-link title="Editar Automóvil">
                                    <i class="fas fa-edit"></i>
                                </a>
                                <button type="button" class="rsi-btn-icon ${v.activo ? 'rsi-btn-icon-delete' : 'rsi-btn-icon-success'} btn-toggle-vehiculo" data-id="${v.id}" data-activo="${v.activo}" title="${v.activo ? 'Desactivar' : 'Activar'}">
                                    <i class="fas ${v.activo ? 'fa-ban' : 'fa-check'}"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    async confirmarToggleActivo(id, nuevoEstado) {
        const accion = nuevoEstado ? 'activar' : 'desactivar';
        const result = await Swal.fire({
            title: `¿Deseas ${accion} este automóvil?`,
            text: nuevoEstado
                ? 'El automóvil volverá a estar disponible para asignaciones operativas.'
                : 'El automóvil no podrá ser seleccionado para nuevas salidas. Su historial de checklists se conservará intacto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: nuevoEstado ? '#22c55e' : '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: `Sí, ${accion}`,
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        Swal.fire({
            title: 'Procesando...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await this.service.toggleActivoVehiculo(id, nuevoEstado);
        if (res.success) {
            await this.cargarVehiculos(true);
            Swal.fire({
                icon: 'success',
                title: 'Estado Actualizado',
                text: res.message,
                confirmButtonColor: '#D4AF37'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo cambiar el estado',
                text: res.error,
                confirmButtonColor: '#D4AF37'
            });
        }
    }
}

export async function vehiculosCrudController() {
    const controller = new VehiculosCrudController();
    await controller.init();
}

export default vehiculosCrudController;
