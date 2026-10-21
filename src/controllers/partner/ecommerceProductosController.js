/* ==========================================================================
   ECOMMERCE PRODUCTOS CONTROLLER - RSI Enterprise
   Controlador para el panel administrativo del catálogo de Productos
   ========================================================================== */

import { EcommerceProductService } from '../../services/ecommerceProductService.js';
import { CategoriaService } from '../../services/categoriaService.js';
import { MarcaService } from '../../services/marcaService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceProductosController {
    constructor() {
        this.productService = new EcommerceProductService();
        this.categoriaService = new CategoriaService();
        this.marcaService = new MarcaService();

        this.productos = [];
        this.categorias = [];
        this.marcas = [];

        this.searchTerm = '';
        this.selectedCategoria = 'all';
        this.selectedMarca = 'all';
        this.selectedEstado = 'all';

        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.bindEvents();
        await Promise.all([
            this.cargarFiltros(),
            this.cargarProductos()
        ]);
    }

    bindEvents() {
        const btnRecargar = document.getElementById('btnRecargarProductos');
        if (btnRecargar) {
            btnRecargar.addEventListener('click', () => this.cargarProductos(true));
        }

        const inputBuscar = document.getElementById('inputBuscarProducto');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.searchTerm = (e.target.value || '').toLowerCase().trim();
                this.renderTabla();
            });
        }

        const selCat = document.getElementById('selectFiltroCategoria');
        if (selCat) {
            selCat.addEventListener('change', (e) => {
                this.selectedCategoria = e.target.value;
                this.renderTabla();
            });
        }

        const selMarca = document.getElementById('selectFiltroMarca');
        if (selMarca) {
            selMarca.addEventListener('change', (e) => {
                this.selectedMarca = e.target.value;
                this.renderTabla();
            });
        }

        const selEstado = document.getElementById('selectFiltroEstado');
        if (selEstado) {
            selEstado.addEventListener('change', (e) => {
                this.selectedEstado = e.target.value;
                this.renderTabla();
            });
        }
    }

    async cargarFiltros() {
        try {
            const [cats, marcas] = await Promise.all([
                this.categoriaService.getAllCategorias(),
                this.marcaService.getAllMarcas()
            ]);

            this.categorias = cats;
            this.marcas = marcas;

            const selCat = document.getElementById('selectFiltroCategoria');
            if (selCat) {
                selCat.innerHTML = `<option value="all">Todas las Categorías</option>` +
                    cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            }

            const selMarca = document.getElementById('selectFiltroMarca');
            if (selMarca) {
                selMarca.innerHTML = `<option value="all">Todas las Marcas</option>` +
                    marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
            }
        } catch (error) {
            console.error('❌ Error cargando filtros de categorías/marcas:', error);
        }
    }

    async cargarProductos(forceRefresh = false) {
        const tbody = document.getElementById('productosTbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 10px;">Cargando productos...</p>
                    </td>
                </tr>
            `;
        }

        try {
            this.productos = await this.productService.getAllProducts(forceRefresh);
            this.actualizarMetricas();
            this.renderTabla();
        } catch (error) {
            console.error('❌ Error cargando productos:', error);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 30px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle fa-2x"></i>
                            <p style="margin-top: 8px;">Error al cargar productos: ${error.message}</p>
                        </td>
                    </tr>
                `;
            }
        }
    }

    actualizarMetricas() {
        const total = this.productos.length;
        const pub = this.productos.filter(p => p.estado === 'publicado').length;
        const bor = this.productos.filter(p => p.estado === 'borrador').length;
        const des = this.productos.filter(p => p.estado === 'desactivado').length;

        const elTot = document.getElementById('statTotalProductos');
        const elPub = document.getElementById('statPublicados');
        const elBor = document.getElementById('statBorradores');
        const elDes = document.getElementById('statDesactivados');

        if (elTot) elTot.textContent = total;
        if (elPub) elPub.textContent = pub;
        if (elBor) elBor.textContent = bor;
        if (elDes) elDes.textContent = des;
    }

    renderTabla() {
        const tbody = document.getElementById('productosTbody');
        if (!tbody) return;

        let filtered = this.productos;

        if (this.selectedCategoria !== 'all') {
            filtered = filtered.filter(p => p.categoriaId === this.selectedCategoria);
        }

        if (this.selectedMarca !== 'all') {
            filtered = filtered.filter(p => p.marcaId === this.selectedMarca);
        }

        if (this.selectedEstado !== 'all') {
            filtered = filtered.filter(p => p.estado === this.selectedEstado);
        }

        if (this.searchTerm) {
            filtered = filtered.filter(p => {
                const n = (p.nombre || '').toLowerCase();
                const m = (p.modelo || '').toLowerCase();
                const c = (p.codigoInterno || '').toLowerCase();
                const s = (p.claveSat || '').toLowerCase();
                return n.includes(this.searchTerm) || m.includes(this.searchTerm) || c.includes(this.searchTerm) || s.includes(this.searchTerm);
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--rsi-gray-400);">
                        <i class="fas fa-box-open fa-2x" style="margin-bottom: 8px; opacity: 0.4;"></i>
                        <p style="margin: 0; font-weight: 500;">No se encontraron productos con los filtros seleccionados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(prod => {
            const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.precio || 0);
            const imgPrincipal = prod.imagenPrincipal || prod.imagenes?.[0]?.url;
            const imgHtml = imgPrincipal
                ? `<img src="${imgPrincipal}" alt="${prod.nombre}" style="width: 44px; height: 44px; object-fit: contain; border-radius: 6px; border: 1px solid var(--rsi-border-color);" />`
                : `<div style="width: 44px; height: 44px; border-radius: 6px; background: rgba(197, 160, 89, 0.1); color: var(--rsi-gold); display: flex; align-items: center; justify-content: center;"><i class="fas fa-box"></i></div>`;

            // Badge de estado
            let badgeClass = 'rsi-badge-primary';
            if (prod.estado === 'borrador') badgeClass = 'rsi-badge-gold';
            if (prod.estado === 'desactivado') badgeClass = 'rsi-badge-danger';

            const fichaHtml = prod.fichaTecnicaPdf?.url
                ? `<a href="${prod.fichaTecnicaPdf.url}" target="_blank" title="Descargar Ficha Técnica PDF" style="color: #ef4444; font-size: 1.1rem;"><i class="fas fa-file-pdf"></i></a>`
                : `<span style="color: var(--rsi-gray-400); font-size: 0.85rem;">—</span>`;

            return `
                <tr style="border-bottom: 1px solid var(--rsi-border-color, #e2e8f0);">
                    <td style="text-align: center;">${imgHtml}</td>
                    <td>
                        <strong style="color: var(--rsi-text-primary); font-size: 0.95rem;">${prod.nombre}</strong>
                        ${prod.destacado ? '<span class="rsi-badge rsi-badge-gold" style="font-size: 0.65rem; margin-left: 6px;"><i class="fas fa-star"></i> Destacado</span>' : ''}
                        <div style="font-size: 0.8rem; color: var(--rsi-gray-400); margin-top: 2px;">
                            ${prod.modelo ? `Mod: <code>${prod.modelo}</code> • ` : ''}
                            ${prod.codigoInterno ? `SKU: ${prod.codigoInterno}` : ''}
                        </div>
                    </td>
                    <td>
                        <span style="font-weight: 500; font-size: 0.9rem;">${prod.categoriaNombre || 'Sin categoría'}</span>
                        <div style="font-size: 0.8rem; color: var(--rsi-gray-500);">
                            <i class="fas fa-certificate" style="font-size: 0.75rem;"></i> ${prod.marcaNombre || 'Sin marca'}
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: var(--rsi-gold, #c5a059); font-size: 0.95rem;">
                        ${precioFormatted}
                    </td>
                    <td style="text-align: center;">
                        <span class="rsi-badge ${prod.stock > 0 ? 'rsi-badge-success' : 'rsi-badge-danger'}" style="font-size: 0.8rem;">
                            ${prod.stock || 0}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        ${fichaHtml}
                    </td>
                    <td style="text-align: center;">
                        <select class="rsi-input select-estado-prod" data-id="${prod.id}" style="font-size: 0.75rem; padding: 4px 6px; border-radius: 6px; font-weight: 600;">
                            <option value="publicado" ${prod.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
                            <option value="borrador" ${prod.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                            <option value="desactivado" ${prod.estado === 'desactivado' ? 'selected' : ''}>Desactivado</option>
                        </select>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <a href="/productDetail?id=${prod.id}" target="_blank" class="rsi-btn-crud rsi-btn-crud-outline" style="padding: 6px 10px; font-size: 0.85rem;" title="Ver en tienda pública">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="/ecommerce/producto-form?id=${prod.id}" class="rsi-btn-crud rsi-btn-crud-outline" data-link style="padding: 6px 10px; font-size: 0.85rem;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-eliminar-prod" data-id="${prod.id}" data-nombre="${prod.nombre}" style="padding: 6px 10px; font-size: 0.85rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.select-estado-prod').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = select.dataset.id;
                const nuevo = e.target.value;
                this.cambiarEstado(id, nuevo);
            });
        });

        tbody.querySelectorAll('.btn-eliminar-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const nombre = btn.dataset.nombre;
                this.confirmarEliminar(id, nombre);
            });
        });
    }

    async cambiarEstado(id, nuevoEstado) {
        try {
            const res = await this.productService.setEstado(id, nuevoEstado);
            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo cambiar el estado.' });
                return;
            }
            await this.cargarProductos(true);
        } catch (error) {
            console.error('❌ Error cambiando estado de producto:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async confirmarEliminar(id, nombre) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar producto?',
            html: `¿Estás seguro de que deseas eliminar permanentemente <strong>"${nombre}"</strong> y todos sus archivos multimedia?<br><small style="color: #ef4444;">Esta acción no se puede deshacer.</small>`,
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
                text: 'Borrando producto, imágenes y ficha técnica.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await this.productService.deleteProduct(id);
            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error });
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '¡Eliminado!',
                text: 'El producto fue eliminado correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            await this.cargarProductos(true);
        } catch (error) {
            console.error('❌ Error eliminando producto:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const ecommerceProductosController = () => {
    const ctrl = new EcommerceProductosController();
    ctrl.init();
    return ctrl;
};

export default ecommerceProductosController;
