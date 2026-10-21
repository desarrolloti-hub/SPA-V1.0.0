/* ==========================================================================
   ECOMMERCE MARCAS CONTROLLER - RSI Enterprise
   Controlador para el panel administrativo de Marcas Comerciales
   ========================================================================== */

import { MarcaService } from '../../services/marcaService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceMarcasController {
    constructor() {
        this.marcaService = new MarcaService();
        this.marcas = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.bindEvents();
        await this.cargarMarcas();
    }

    bindEvents() {
        const btnRecargar = document.getElementById('btnRecargarMarcas');
        if (btnRecargar) {
            btnRecargar.addEventListener('click', () => this.cargarMarcas(true));
        }

        const inputBuscar = document.getElementById('inputBuscarMarca');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.searchTerm = (e.target.value || '').toLowerCase().trim();
                this.renderTabla();
            });
        }

        const filterBtns = document.querySelectorAll('.filter-marca-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.remove('is-active', 'rsi-btn-crud-secondary');
                    b.classList.add('rsi-btn-crud-outline');
                });
                btn.classList.add('is-active', 'rsi-btn-crud-secondary');
                btn.classList.remove('rsi-btn-crud-outline');

                this.currentFilter = btn.dataset.filter || 'all';
                this.renderTabla();
            });
        });
    }

    async cargarMarcas(forceRefresh = false) {
        const tbody = document.getElementById('marcasTbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 10px;">Cargando marcas...</p>
                    </td>
                </tr>
            `;
        }

        try {
            this.marcas = await this.marcaService.getAllMarcas(forceRefresh);
            this.actualizarMetricas();
            this.renderTabla();
        } catch (error) {
            console.error('❌ Error cargando marcas:', error);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle fa-2x"></i>
                            <p style="margin-top: 8px;">Error al cargar las marcas: ${error.message}</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    actualizarMetricas() {
        const total = this.marcas.length;
        const activas = this.marcas.filter(m => m.activo !== false).length;
        const inactivas = total - activas;
        const prods = this.marcas.reduce((acc, m) => acc + (typeof m.productosCount === 'number' ? m.productosCount : 0), 0);

        const elTotal = document.getElementById('statTotalMarcas');
        const elAct = document.getElementById('statMarcasActivas');
        const elInact = document.getElementById('statMarcasInactivas');
        const elProds = document.getElementById('statTotalProdsEnMarcas');

        if (elTotal) elTotal.textContent = total;
        if (elAct) elAct.textContent = activas;
        if (elInact) elInact.textContent = inactivas;
        if (elProds) elProds.textContent = prods;
    }

    renderTabla() {
        const tbody = document.getElementById('marcasTbody');
        if (!tbody) return;

        let filtered = this.marcas;

        if (this.currentFilter === 'active') {
            filtered = filtered.filter(m => m.activo !== false);
        } else if (this.currentFilter === 'inactive') {
            filtered = filtered.filter(m => m.activo === false);
        }

        if (this.searchTerm) {
            filtered = filtered.filter(m => {
                const n = (m.nombre || '').toLowerCase();
                const d = (m.descripcion || '').toLowerCase();
                const s = (m.slug || '').toLowerCase();
                return n.includes(this.searchTerm) || d.includes(this.searchTerm) || s.includes(this.searchTerm);
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-certificate fa-2x" style="margin-bottom: 8px; opacity: 0.4;"></i>
                        <p style="margin: 0; font-weight: 500;">No se encontraron marcas ${this.searchTerm ? 'con ese criterio' : 'registradas'}.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(marca => {
            const isActivo = marca.activo !== false;
            const prods = typeof marca.productosCount === 'number' ? marca.productosCount : 0;
            const logoHtml = marca.logo 
                ? `<img src="${marca.logo}" alt="${marca.nombre}" style="max-width: 65px; max-height: 40px; object-fit: contain; padding: 2px;" />`
                : `<div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(197, 160, 89, 0.1); color: var(--rsi-gold); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin: auto;"><i class="fas fa-certificate"></i></div>`;

            return `
                <tr style="border-bottom: 1px solid var(--rsi-border-color, #e2e8f0);">
                    <td style="text-align: center;">${logoHtml}</td>
                    <td>
                        <strong style="color: var(--rsi-text-primary); font-size: 0.95rem;">${marca.nombre || 'Sin nombre'}</strong>
                        <div style="font-size: 0.8rem; color: var(--rsi-gray-400); margin-top: 2px;">
                            <code>/${marca.slug || ''}</code>
                        </div>
                    </td>
                    <td style="color: var(--rsi-gray-500); font-size: 0.85rem; max-width: 250px;">
                        ${marca.descripcion || '<em style="color: var(--rsi-gray-400);">Sin descripción</em>'}
                    </td>
                    <td style="text-align: center;">
                        <span class="rsi-badge ${prods > 0 ? 'rsi-badge-primary' : 'rsi-badge-secondary'}" style="font-size: 0.8rem;">
                            <i class="fas fa-box"></i> ${prods}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-toggle-marca" data-id="${marca.id}" data-activo="${isActivo}" style="background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px;" title="Clic para alternar estado">
                            <span class="rsi-badge ${isActivo ? 'rsi-badge-success' : 'rsi-badge-danger'}" style="font-size: 0.75rem;">
                                <i class="fas ${isActivo ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isActivo ? 'Activa' : 'Inactiva'}
                            </span>
                        </button>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <a href="/ecommerce/marca-form?id=${marca.id}" class="rsi-btn-crud rsi-btn-crud-outline" data-link style="padding: 6px 10px; font-size: 0.85rem;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-eliminar-marca" data-id="${marca.id}" data-nombre="${marca.nombre}" data-prods="${prods}" style="padding: 6px 10px; font-size: 0.85rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-toggle-marca').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const actual = btn.dataset.activo === 'true';
                this.cambiarEstado(id, !actual);
            });
        });

        tbody.querySelectorAll('.btn-eliminar-marca').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const nombre = btn.dataset.nombre;
                const prods = parseInt(btn.dataset.prods, 10) || 0;
                this.confirmarEliminar(id, nombre, prods);
            });
        });
    }

    async cambiarEstado(id, nuevoEstado) {
        try {
            const res = await this.marcaService.toggleActivo(id, nuevoEstado);
            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo cambiar el estado.' });
                return;
            }
            await this.cargarMarcas(true);
        } catch (error) {
            console.error('❌ Error cambiando estado de marca:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async confirmarEliminar(id, nombre, productosCount) {
        if (productosCount > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No es posible eliminar',
                html: `La marca <strong>"${nombre}"</strong> tiene <strong>${productosCount}</strong> producto(s) asociado(s).<br><br>Para proteger el catálogo público, reasigna o elimina los productos antes de borrar la marca, o desactívala temporalmente.`,
                confirmButtonColor: '#c5a059',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar marca?',
            html: `¿Estás seguro de que deseas eliminar permanentemente la marca <strong>"${nombre}"</strong>?<br><small style="color: #ef4444;">Esta acción no se puede deshacer.</small>`,
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirm.isConfirmed) return;

        try {
            Swal.fire({
                title: 'Eliminando...',
                text: 'Borrando marca y logotipo asociado.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.marcaService.deleteMarca(id);
            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error });
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '¡Eliminada!',
                text: 'La marca fue eliminada correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            await this.cargarMarcas(true);
        } catch (error) {
            console.error('❌ Error eliminando marca:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const ecommerceMarcasController = () => {
    const ctrl = new EcommerceMarcasController();
    ctrl.init();
    return ctrl;
};

export default ecommerceMarcasController;
