/* ==========================================================================
   ECOMMERCE CATEGORIAS CONTROLLER - RSI Enterprise
   Controlador para el panel administrativo de Categorías
   ========================================================================== */

import { CategoriaService } from '../../services/categoriaService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceCategoriasController {
    constructor() {
        this.categoriaService = new CategoriaService();
        this.categorias = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.bindEvents();
        await this.cargarCategorias();
    }

    bindEvents() {
        const btnRecargar = document.getElementById('btnRecargarCategorias');
        if (btnRecargar) {
            btnRecargar.addEventListener('click', () => this.cargarCategorias(true));
        }

        const inputBuscar = document.getElementById('inputBuscarCategoria');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.searchTerm = (e.target.value || '').toLowerCase().trim();
                this.renderTabla();
            });
        }

        const filterBtns = document.querySelectorAll('.filter-cat-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
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

    async cargarCategorias(forceRefresh = false) {
        const tbody = document.getElementById('categoriasTbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 10px;">Cargando categorías...</p>
                    </td>
                </tr>
            `;
        }

        try {
            this.categorias = await this.categoriaService.getAllCategorias(forceRefresh);
            this.actualizarMetricas();
            this.renderTabla();
        } catch (error) {
            console.error('❌ Error cargando categorías:', error);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle fa-2x"></i>
                            <p style="margin-top: 8px;">Error al cargar las categorías: ${error.message}</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    actualizarMetricas() {
        const total = this.categorias.length;
        const activas = this.categorias.filter(c => c.activo !== false).length;
        const inactivas = total - activas;
        const prods = this.categorias.reduce((acc, c) => acc + (typeof c.productosCount === 'number' ? c.productosCount : 0), 0);

        const elTotal = document.getElementById('statTotalCategorias');
        const elAct = document.getElementById('statActivas');
        const elInact = document.getElementById('statInactivas');
        const elProds = document.getElementById('statTotalProductosEnCats');

        if (elTotal) elTotal.textContent = total;
        if (elAct) elAct.textContent = activas;
        if (elInact) elInact.textContent = inactivas;
        if (elProds) elProds.textContent = prods;
    }

    renderTabla() {
        const tbody = document.getElementById('categoriasTbody');
        if (!tbody) return;

        let filtered = this.categorias;

        if (this.currentFilter === 'active') {
            filtered = filtered.filter(c => c.activo !== false);
        } else if (this.currentFilter === 'inactive') {
            filtered = filtered.filter(c => c.activo === false);
        }

        if (this.searchTerm) {
            filtered = filtered.filter(c => {
                const n = (c.nombre || '').toLowerCase();
                const d = (c.descripcion || '').toLowerCase();
                const s = (c.slug || '').toLowerCase();
                return n.includes(this.searchTerm) || d.includes(this.searchTerm) || s.includes(this.searchTerm);
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-folder-open fa-2x" style="margin-bottom: 8px;"></i>
                        <p style="margin: 0; font-weight: 500;">No se encontraron categorías ${this.searchTerm ? 'con ese criterio' : 'registradas'}.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(cat => {
            const isActivo = cat.activo !== false;
            const prods = typeof cat.productosCount === 'number' ? cat.productosCount : 0;
            const imgHtml = cat.imagen 
                ? `<img src="${cat.imagen}" alt="${cat.nombre}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid var(--rsi-border-color);" />`
                : `<div style="width: 48px; height: 48px; border-radius: 8px; background: rgba(197, 160, 89, 0.1); color: var(--rsi-gold); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;"><i class="fas fa-tags"></i></div>`;

            return `
                <tr style="border-bottom: 1px solid var(--rsi-border-color, #e2e8f0);">
                    <td style="text-align: center; font-weight: 700; color: var(--rsi-gray-500);">${cat.orden || 1}</td>
                    <td style="text-align: center;">${imgHtml}</td>
                    <td>
                        <strong style="color: var(--rsi-text-primary); font-size: 0.95rem;">${cat.nombre || 'Sin nombre'}</strong>
                        <div style="font-size: 0.8rem; color: var(--rsi-gray-400); margin-top: 2px;">
                            <code>/${cat.slug || ''}</code>
                        </div>
                    </td>
                    <td style="color: var(--rsi-gray-500); font-size: 0.85rem; max-width: 250px;">
                        ${cat.descripcion || '<em style="color: var(--rsi-gray-400);">Sin descripción</em>'}
                    </td>
                    <td style="text-align: center;">
                        <span class="rsi-badge ${prods > 0 ? 'rsi-badge-primary' : 'rsi-badge-secondary'}" style="font-size: 0.8rem;">
                            <i class="fas fa-box"></i> ${prods}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-toggle-cat" data-id="${cat.id}" data-activo="${isActivo}" style="background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px;" title="Clic para alternar estado">
                            <span class="rsi-badge ${isActivo ? 'rsi-badge-success' : 'rsi-badge-danger'}" style="font-size: 0.75rem;">
                                <i class="fas ${isActivo ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isActivo ? 'Activa' : 'Inactiva'}
                            </span>
                        </button>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <a href="/ecommerce/categoria-form?id=${cat.id}" class="rsi-btn-crud rsi-btn-crud-outline" data-link style="padding: 6px 10px; font-size: 0.85rem;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-eliminar-cat" data-id="${cat.id}" data-nombre="${cat.nombre}" data-prods="${prods}" style="padding: 6px 10px; font-size: 0.85rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Eventos en botones de la tabla
        tbody.querySelectorAll('.btn-toggle-cat').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const actual = btn.dataset.activo === 'true';
                this.cambiarEstado(id, !actual);
            });
        });

        tbody.querySelectorAll('.btn-eliminar-cat').forEach(btn => {
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
            const res = await this.categoriaService.toggleActivo(id, nuevoEstado);
            if (!res.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: res.error || 'No se pudo cambiar el estado.'
                });
                return;
            }
            await this.cargarCategorias(true);
        } catch (error) {
            console.error('❌ Error cambiando estado de categoría:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async confirmarEliminar(id, nombre, productosCount) {
        if (productosCount > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No es posible eliminar',
                html: `La categoría <strong>"${nombre}"</strong> tiene <strong>${productosCount}</strong> producto(s) asociado(s).<br><br>Para proteger el catálogo público, reasigna o elimina los productos antes de borrar la categoría, o simplemente desactívala.`,
                confirmButtonColor: '#c5a059',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar categoría?',
            html: `¿Estás seguro de que deseas eliminar permanentemente <strong>"${nombre}"</strong>?<br><small style="color: #ef4444;">Esta acción no se puede deshacer.</small>`,
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
                text: 'Borrando categoría e imagen asociada.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.categoriaService.deleteCategoria(id);
            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error });
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '¡Eliminada!',
                text: 'La categoría fue eliminada correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            await this.cargarCategorias(true);
        } catch (error) {
            console.error('❌ Error eliminando categoría:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const ecommerceCategoriasController = () => {
    const ctrl = new EcommerceCategoriasController();
    ctrl.init();
    return ctrl;
};

export default ecommerceCategoriasController;
