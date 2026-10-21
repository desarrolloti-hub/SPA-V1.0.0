/* ==========================================================================
   PRODUCTS CONTROLLER (PUBLIC VISITOR) - RSI Enterprise
   Controlador para el Catálogo Comercial Público de Productos con Buscador en Vivo
   ========================================================================== */

import { EcommerceProductService } from '../../services/ecommerceProductService.js';
import { CategoriaService } from '../../services/categoriaService.js';
import { MarcaService } from '../../services/marcaService.js';

export class ProductsController {
    constructor() {
        this.productService = new EcommerceProductService();
        this.categoriaService = new CategoriaService();
        this.marcaService = new MarcaService();

        this.products = [];
        this.categorias = [];
        this.marcas = [];

        this.activeCategory = 'all';
        this.activeMarca = 'all';
        this.searchTerm = '';
        this.sortOrder = 'featured';

        this.isInitialized = false;
        this.outsideClickListener = null;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        // Leer parámetros URL
        const urlParams = new URLSearchParams(window.location.search);
        const catParam = urlParams.get('categoria');
        const marcaParam = urlParams.get('marca');
        const qParam = urlParams.get('q');

        if (catParam) this.activeCategory = catParam;
        if (marcaParam) this.activeMarca = marcaParam;
        if (qParam) this.searchTerm = qParam.toLowerCase().trim();

        this.bindEvents();

        await Promise.all([
            this.cargarCategoriasYMarcas(),
            this.cargarProductos()
        ]);
    }

    bindEvents() {
        const inputSearch = document.getElementById('inputPublicSearch');
        const btnClear = document.getElementById('btnClearSearch');
        const suggestionsBox = document.getElementById('searchSuggestionsDropdown');

        if (inputSearch) {
            if (this.searchTerm) inputSearch.value = this.searchTerm;

            inputSearch.addEventListener('input', (e) => {
                const term = (e.target.value || '').trim();
                this.searchTerm = term.toLowerCase();
                if (btnClear) btnClear.style.display = term ? 'inline-block' : 'none';

                this.actualizarSugerencias(term);
                this.renderGrid();
            });

            inputSearch.addEventListener('focus', () => {
                const term = (inputSearch.value || '').trim();
                if (term) this.actualizarSugerencias(term);
            });

            inputSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && suggestionsBox) {
                    suggestionsBox.style.display = 'none';
                }
            });
        }

        if (btnClear && inputSearch) {
            btnClear.addEventListener('click', () => {
                inputSearch.value = '';
                this.searchTerm = '';
                btnClear.style.display = 'none';
                if (suggestionsBox) suggestionsBox.style.display = 'none';
                this.renderGrid();
            });
        }

        // Cierre al hacer clic fuera del buscador
        this.outsideClickListener = (e) => {
            if (suggestionsBox && !e.target.closest('.rsi-products-search-wrapper')) {
                suggestionsBox.style.display = 'none';
            }
        };
        document.addEventListener('pointerdown', this.outsideClickListener);

        // Filtro Marca
        const selectMarca = document.getElementById('selectPublicMarca');
        if (selectMarca) {
            selectMarca.addEventListener('change', (e) => {
                this.activeMarca = e.target.value;
                this.renderGrid();
            });
        }

        // Ordenamiento
        const selectSort = document.getElementById('selectPublicSort');
        if (selectSort) {
            selectSort.addEventListener('change', (e) => {
                this.sortOrder = e.target.value;
                this.renderGrid();
            });
        }
    }

    actualizarSugerencias(term) {
        const box = document.getElementById('searchSuggestionsDropdown');
        if (!box) return;

        if (!term) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const query = term.toLowerCase();
        const matches = this.products.filter(p => {
            const n = (p.nombre || '').toLowerCase();
            const m = (p.modelo || '').toLowerCase();
            const c = (p.categoriaNombre || '').toLowerCase();
            const b = (p.marcaNombre || '').toLowerCase();
            const k = (p.codigoInterno || '').toLowerCase();
            return n.includes(query) || m.includes(query) || c.includes(query) || b.includes(query) || k.includes(query);
        }).slice(0, 6);

        if (matches.length === 0) {
            box.innerHTML = `
                <div style="padding: 14px; text-align: center; color: var(--rsi-gray-400); font-size: 0.85rem;">
                    <i class="fas fa-search" style="margin-right: 6px;"></i> Sin coincidencias para "<strong>${this.escapeHtml(term)}</strong>"
                </div>
            `;
            box.style.display = 'block';
            return;
        }

        box.innerHTML = matches.map(prod => {
            const imgUrl = prod.imagenPrincipal || prod.imagenes?.[0]?.url || '/assets/images/placeholder.jpg';
            const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.precio || 0);

            return `
                <a href="/productDetail?id=${prod.id}" class="rsi-search-suggestion-item" data-link>
                    <img src="${imgUrl}" alt="${this.escapeHtml(prod.nombre)}" class="rsi-search-suggestion-thumb" />
                    <div class="rsi-search-suggestion-info">
                        <div class="rsi-search-suggestion-title">${this.escapeHtml(prod.nombre)}</div>
                        <div class="rsi-search-suggestion-meta">
                            <span>${this.escapeHtml(prod.marcaNombre || 'RSI')}</span>
                            <span>•</span>
                            <span>${this.escapeHtml(prod.categoriaNombre || 'Seguridad')}</span>
                            ${prod.modelo ? `<span>• Mod: ${this.escapeHtml(prod.modelo)}</span>` : ''}
                        </div>
                    </div>
                    <div class="rsi-search-suggestion-price">${precioFormatted}</div>
                </a>
            `;
        }).join('');

        box.style.display = 'block';
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async cargarCategoriasYMarcas() {
        try {
            const [cats, marcas] = await Promise.all([
                this.categoriaService.getAllCategorias(),
                this.marcaService.getAllMarcas()
            ]);

            this.categorias = (cats || []).filter(c => c.activo !== false);
            this.marcas = (marcas || []).filter(m => m.activo !== false);

            this.renderCategoriasFiltros();
            this.renderMarcasSelect();
        } catch (error) {
            console.error('❌ Error cargando filtros:', error);
        }
    }

    renderCategoriasFiltros() {
        const container = document.getElementById('categoriesFiltersContainer');
        if (!container) return;

        let html = `
            <button class="rsi-filter-btn ${this.activeCategory === 'all' ? 'is-active' : ''}" data-category="all">
                <i class="fas fa-th"></i> Todos
            </button>
        `;

        this.categorias.forEach(cat => {
            const isActive = this.activeCategory === cat.slug || this.activeCategory === cat.id;
            html += `
                <button class="rsi-filter-btn ${isActive ? 'is-active' : ''}" data-category="${cat.slug || cat.id}">
                    ${cat.nombre}
                </button>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.rsi-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.rsi-filter-btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this.activeCategory = btn.dataset.category;
                this.renderGrid();
            });
        });
    }

    renderMarcasSelect() {
        const sel = document.getElementById('selectPublicMarca');
        if (!sel) return;

        let html = `<option value="all">Todas las Marcas</option>`;
        this.marcas.forEach(m => {
            const isSel = this.activeMarca === m.slug || this.activeMarca === m.id ? 'selected' : '';
            html += `<option value="${m.slug || m.id}" ${isSel}>${m.nombre}</option>`;
        });
        sel.innerHTML = html;
    }

    async cargarProductos() {
        try {
            this.products = await this.productService.getPublishedProducts();
            this.renderGrid();
        } catch (error) {
            console.error('❌ Error cargando productos para catálogo:', error);
            const grid = document.getElementById('publicProductsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle fa-2x"></i>
                        <p style="margin-top: 10px;">Error al consultar el catálogo: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    renderGrid() {
        const grid = document.getElementById('publicProductsGrid');
        const txtContador = document.getElementById('txtProductosContador');
        const txtTitulo = document.getElementById('txtCatalogoTitulo');

        if (!grid) return;

        let filtered = [...this.products];

        // 1. Filtrar por categoría
        if (this.activeCategory !== 'all') {
            const catObj = this.categorias.find(c => c.slug === this.activeCategory || c.id === this.activeCategory);
            const targetId = catObj ? catObj.id : this.activeCategory;
            filtered = filtered.filter(p => p.categoriaId === targetId || p.categoriaNombre?.toLowerCase() === catObj?.nombre?.toLowerCase());
            if (txtTitulo && catObj) txtTitulo.textContent = catObj.nombre;
        } else {
            if (txtTitulo) txtTitulo.textContent = 'Todos los productos';
        }

        // 2. Filtrar por marca
        if (this.activeMarca !== 'all') {
            const marcaObj = this.marcas.find(m => m.slug === this.activeMarca || m.id === this.activeMarca);
            const targetId = marcaObj ? marcaObj.id : this.activeMarca;
            filtered = filtered.filter(p => p.marcaId === targetId || p.marcaNombre?.toLowerCase() === marcaObj?.nombre?.toLowerCase());
        }

        // 3. Filtrar por término de búsqueda
        if (this.searchTerm) {
            filtered = filtered.filter(p => {
                const n = (p.nombre || '').toLowerCase();
                const m = (p.modelo || '').toLowerCase();
                const c = (p.categoriaNombre || '').toLowerCase();
                const b = (p.marcaNombre || '').toLowerCase();
                const k = (p.codigoInterno || '').toLowerCase();
                return n.includes(this.searchTerm) || m.includes(this.searchTerm) || c.includes(this.searchTerm) || b.includes(this.searchTerm) || k.includes(this.searchTerm);
            });
        }

        // 4. Ordenamiento
        if (this.sortOrder === 'featured') {
            filtered.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
        } else if (this.sortOrder === 'recent') {
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (this.sortOrder === 'price_asc') {
            filtered.sort((a, b) => (a.precio || 0) - (b.precio || 0));
        } else if (this.sortOrder === 'price_desc') {
            filtered.sort((a, b) => (b.precio || 0) - (a.precio || 0));
        }

        // Contador
        if (txtContador) {
            txtContador.textContent = `${filtered.length} producto${filtered.length === 1 ? '' : 's'}`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--rsi-gray-400);">
                    <i class="fas fa-search fa-2x" style="opacity: 0.3; margin-bottom: 12px;"></i>
                    <h3 style="margin: 0 0 6px; color: var(--rsi-text-primary); font-size: 1.15rem;">No se encontraron coincidencias</h3>
                    <p style="margin: 0; font-size: 0.9rem;">Prueba con otros términos de búsqueda o selecciona otra categoría.</p>
                </div>
            `;
            return;
        }

        // Renderizado compacto sin descripción y optimizado
        grid.innerHTML = filtered.map(prod => {
            const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.precio || 0);
            const imgUrl = prod.imagenPrincipal || prod.imagenes?.[0]?.url || '/assets/images/placeholder.jpg';
            const inStock = prod.stock > 0;

            return `
                <article class="rsi-product-card">
                    ${prod.destacado ? '<div class="rsi-product-badge"><i class="fas fa-star"></i> Destacado</div>' : ''}
                    <a href="/productDetail?id=${prod.id}" class="rsi-product-image" data-link>
                        <img src="${imgUrl}" alt="${this.escapeHtml(prod.nombre)}" loading="lazy">
                    </a>
                    <div class="rsi-product-body">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                            <span class="rsi-product-category">${this.escapeHtml(prod.categoriaNombre || 'Seguridad')}</span>
                            <span style="font-size: 0.72rem; color: var(--rsi-gray-500); font-weight: 600;">${this.escapeHtml(prod.marcaNombre || '')}</span>
                        </div>
                        <h3 class="rsi-product-name">
                            <a href="/productDetail?id=${prod.id}" data-link style="color: inherit; text-decoration: none;">${this.escapeHtml(prod.nombre)}</a>
                        </h3>
                        ${prod.modelo ? `<div style="font-size: 0.75rem; color: var(--rsi-gray-400); margin-bottom: 4px;">Mod: <code>${this.escapeHtml(prod.modelo)}</code></div>` : ''}
                        
                        <div class="rsi-product-footer">
                            <div>
                                <span class="rsi-product-price">${precioFormatted}</span>
                                <small style="display: block; font-size: 0.7rem; color: ${inStock ? 'var(--rsi-success, #10b981)' : '#ef4444'}; font-weight: 600;">
                                    ${inStock ? 'En existencia' : 'Agotado'}
                                </small>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button type="button" class="btn-quick-cart rsi-btn-crud rsi-btn-crud-outline" data-id="${prod.id}" title="Agregar al carrito" style="padding: 6px 10px; border-radius: 6px;">
                                    <i class="fas fa-cart-plus"></i>
                                </button>
                                <a href="/productDetail?id=${prod.id}" class="rsi-product-btn" data-link>
                                    Ver <i class="fas fa-chevron-right"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Listeners carrito
        grid.querySelectorAll('.btn-quick-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                this.agregarAlCarritoRapido(id);
            });
        });
    }

    async agregarAlCarritoRapido(productId) {
        document.dispatchEvent(new CustomEvent('cart:add', {
            detail: { productoId: productId, cantidad: 1 }
        }));
    }

    cleanup() {
        this.isInitialized = false;
        if (this.outsideClickListener) {
            document.removeEventListener('pointerdown', this.outsideClickListener);
            this.outsideClickListener = null;
        }
    }
}

export const productsController = () => {
    const ctrl = new ProductsController();
    ctrl.init();
    return ctrl;
};

export default productsController;
