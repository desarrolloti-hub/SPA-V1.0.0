/* ==========================================================================
   PRODUCT DETAIL CONTROLLER - RSI Enterprise
   Controlador para la Ficha Interactiva de Detalle de Producto
   con Buscador en Vivo, Logotipo de Marca, Compartir y Relacionados
   ========================================================================== */

import { EcommerceProductService } from '../../services/ecommerceProductService.js';
import { MarcaService } from '../../services/marcaService.js';
import { openShareProductModal, updateProductSocialMetaTags } from '../../utils/shareProductHelper.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class ProductDetailController {
    constructor() {
        this.productService = new EcommerceProductService();
        this.marcaService = new MarcaService();

        this.product = null;
        this.allProducts = []; // Para el buscador en vivo
        this.quantity = 1;
        this.selectedImageUrl = null;
        this.isInitialized = false;
        this.outsideClickListener = null;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const slug = urlParams.get('slug');

        if (!productId && !slug) {
            window.history.pushState({}, '', '/products');
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        this.bindEvents();
        this.cargarCatalogoParaBuscador();

        if (productId) {
            await this.cargarProductoPorId(productId);
        } else {
            await this.cargarProductoPorSlug(slug);
        }
    }

    bindEvents() {
        // Contador de cantidad
        const btnMinus = document.getElementById('btnQtyMinus');
        const btnPlus = document.getElementById('btnQtyPlus');
        const inputQty = document.getElementById('inputQty');

        if (btnMinus && btnPlus && inputQty) {
            btnMinus.addEventListener('click', () => {
                let current = parseInt(inputQty.value, 10) || 1;
                if (current > 1) {
                    current--;
                    inputQty.value = current;
                    this.quantity = current;
                }
            });

            btnPlus.addEventListener('click', () => {
                let current = parseInt(inputQty.value, 10) || 1;
                const maxStock = this.product?.stock || 99;
                if (current < maxStock) {
                    current++;
                    inputQty.value = current;
                    this.quantity = current;
                }
            });

            inputQty.addEventListener('change', () => {
                let val = parseInt(inputQty.value, 10) || 1;
                const maxStock = this.product?.stock || 99;
                if (val < 1) val = 1;
                if (val > maxStock) val = maxStock;
                inputQty.value = val;
                this.quantity = val;
            });
        }

        // Agregar al carrito
        const btnAddCart = document.getElementById('btnAddToCart');
        if (btnAddCart) {
            btnAddCart.addEventListener('click', () => this.handleAddToCart());
        }

        // Lista de deseos
        const btnWishlist = document.getElementById('btnAddToWishlist');
        if (btnWishlist) {
            btnWishlist.addEventListener('click', () => this.handleAddToWishlist());
        }

        // Botón Compartir
        const btnShare = document.getElementById('btnShareProduct');
        if (btnShare) {
            btnShare.addEventListener('click', () => {
                if (this.product) openShareProductModal(this.product);
            });
        }

        // Buscador en vivo
        const inputSearch = document.getElementById('inputDetailSearch');
        const btnClear = document.getElementById('btnClearDetailSearch');
        const suggestionsBox = document.getElementById('detailSearchSuggestions');

        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                const term = (e.target.value || '').trim();
                if (btnClear) btnClear.style.display = term ? 'inline-block' : 'none';
                this.actualizarSugerencias(term);
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
                btnClear.style.display = 'none';
                if (suggestionsBox) suggestionsBox.style.display = 'none';
            });
        }

        // Click outside para cerrar sugerencias
        this.outsideClickListener = (e) => {
            if (suggestionsBox && !e.target.closest('.rsi-products-search-wrapper')) {
                suggestionsBox.style.display = 'none';
            }
        };
        document.addEventListener('pointerdown', this.outsideClickListener);
    }

    async cargarCatalogoParaBuscador() {
        try {
            this.allProducts = await this.productService.getPublishedProducts();
        } catch (error) {
            console.warn('⚠️ No se pudo cargar catálogo para el buscador en detalle:', error);
        }
    }

    actualizarSugerencias(term) {
        const box = document.getElementById('detailSearchSuggestions');
        if (!box) return;

        if (!term) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const query = term.toLowerCase();
        const matches = this.allProducts.filter(p => {
            const n = (p.nombre || '').toLowerCase();
            const m = (p.modelo || '').toLowerCase();
            const c = (p.categoriaNombre || '').toLowerCase();
            const b = (p.marcaNombre || '').toLowerCase();
            const k = (p.codigoInterno || '').toLowerCase();
            return n.includes(query) || m.includes(query) || c.includes(query) || b.includes(query) || k.includes(query);
        }).slice(0, 6);

        if (matches.length === 0) {
            box.innerHTML = `
                <div style="padding: 12px; text-align: center; color: var(--rsi-gray-400); font-size: 0.85rem;">
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

    async cargarProductoPorId(id) {
        try {
            const prod = await this.productService.getProductById(id);
            if (!prod) {
                this.mostrarNoEncontrado();
                return;
            }
            this.product = prod;
            this.renderDetalle();
        } catch (error) {
            console.error('❌ Error cargando producto:', error);
            this.mostrarNoEncontrado();
        }
    }

    async cargarProductoPorSlug(slug) {
        try {
            const prod = await this.productService.getProductBySlug(slug);
            if (!prod) {
                this.mostrarNoEncontrado();
                return;
            }
            this.product = prod;
            this.renderDetalle();
        } catch (error) {
            console.error('❌ Error cargando producto:', error);
            this.mostrarNoEncontrado();
        }
    }

    mostrarNoEncontrado() {
        const loading = document.getElementById('productDetailLoading');
        if (loading) {
            loading.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-box-open fa-3x" style="color: var(--rsi-gray-400); margin-bottom: 14px;"></i>
                    <h2 style="margin: 0 0 8px; font-size: 1.4rem;">Producto no encontrado</h2>
                    <p style="color: var(--rsi-gray-500); margin-bottom: 20px;">El producto solicitado no existe o fue retirado del catálogo.</p>
                    <a href="/products" class="rsi-btn-crud rsi-btn-crud-primary" data-link>Explorar catálogo</a>
                </div>
            `;
        }
    }

    async renderDetalle() {
        const p = this.product;

        const loading = document.getElementById('productDetailLoading');
        const content = document.getElementById('productDetailContent');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';

        // Breadcrumb
        const bcCat = document.getElementById('bcCategoria');
        const bcProd = document.getElementById('bcProducto');
        if (bcCat) bcCat.textContent = p.categoriaNombre || 'General';
        if (bcProd) bcProd.textContent = p.nombre;

        // Metadatos y título de la pestaña
        updateProductSocialMetaTags(p);

        // Textos del producto
        const elCat = document.getElementById('detailCategoria');
        const elTitulo = document.getElementById('detailTitulo');
        const elModelo = document.getElementById('detailModelo');
        const elSku = document.getElementById('detailSku');
        const elSat = document.getElementById('detailClaveSat');
        const elPrecio = document.getElementById('detailPrecio');
        const elStockBadge = document.getElementById('detailStockBadge');
        const elDispTexto = document.getElementById('detailDisponibilidadTexto');
        const elDesc = document.getElementById('detailDescripcion');
        const badgeDest = document.getElementById('detailBadgeDestacado');

        if (elCat) elCat.textContent = p.categoriaNombre || 'Seguridad';
        if (elTitulo) elTitulo.textContent = p.nombre;
        if (elModelo) elModelo.innerHTML = p.modelo ? `Modelo: <code>${this.escapeHtml(p.modelo)}</code>` : '';
        if (elSku) elSku.innerHTML = p.codigoInterno ? `SKU: <code>${this.escapeHtml(p.codigoInterno)}</code>` : '';
        if (elSat) elSat.innerHTML = p.claveSat ? `SAT: <code>${this.escapeHtml(p.claveSat)}</code>` : '';

        const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.precio || 0);
        if (elPrecio) elPrecio.textContent = precioFormatted;

        const inStock = p.stock > 0;
        if (elStockBadge) {
            elStockBadge.className = `rsi-badge ${inStock ? 'rsi-badge-success' : 'rsi-badge-danger'}`;
            elStockBadge.innerHTML = inStock 
                ? `<i class="fas fa-check-circle"></i> En existencia`
                : `<i class="fas fa-times-circle"></i> Agotado`;
        }

        if (elDispTexto) {
            elDispTexto.textContent = inStock ? `${p.stock} unidades para entrega inmediata` : 'Bajo pedido';
        }

        if (elDesc) {
            elDesc.textContent = p.descripcion || 'Equipo de alta calidad técnica con garantía oficial y soporte postventa especializado de RSI Enterprise.';
        }

        if (badgeDest) {
            badgeDest.style.display = p.destacado ? 'inline-block' : 'none';
        }

        // Cargar logotipo oficial de la marca
        await this.cargarMarcaVisual(p.marcaId, p.marcaNombre);

        // Galería de Imágenes
        this.renderGaleria();

        // Lista de Características
        this.renderCaracteristicas();

        // Ficha Técnica PDF
        this.renderPdfBlock();

        // Productos Relacionados con la categoría
        await this.cargarRelacionados();
    }

    async cargarMarcaVisual(marcaId, marcaNombreFallback) {
        const logoEl = document.getElementById('detailMarcaLogo');
        const nameEl = document.getElementById('detailMarcaNombre');

        if (nameEl) nameEl.textContent = marcaNombreFallback || 'RSI';

        if (!marcaId) {
            if (logoEl) logoEl.style.display = 'none';
            return;
        }

        try {
            const marca = await this.marcaService.getMarcaById(marcaId);
            if (marca) {
                if (nameEl) nameEl.textContent = marca.nombre || marcaNombreFallback || 'RSI';
                if (marca.logo && logoEl) {
                    logoEl.src = marca.logo;
                    logoEl.alt = marca.nombre || 'Marca';
                    logoEl.style.display = 'inline-block';
                } else if (logoEl) {
                    logoEl.style.display = 'none';
                }
            }
        } catch (err) {
            console.warn('⚠️ No se pudo obtener logotipo de marca:', err);
            if (logoEl) logoEl.style.display = 'none';
        }
    }

    renderGaleria() {
        const p = this.product;
        const mainImg = document.getElementById('detailMainImage');
        const thumbsRow = document.getElementById('detailThumbnailsRow');

        const images = Array.isArray(p.imagenes) && p.imagenes.length > 0 
            ? p.imagenes 
            : [{ url: p.imagenPrincipal || '/assets/images/placeholder.jpg', principal: true }];

        const principal = images.find(img => img.principal) || images[0];
        this.selectedImageUrl = principal.url;

        if (mainImg) {
            mainImg.src = this.selectedImageUrl;
            mainImg.alt = p.nombre;
        }

        if (thumbsRow) {
            if (images.length <= 1) {
                thumbsRow.style.display = 'none';
                return;
            }

            thumbsRow.style.display = 'flex';
            thumbsRow.innerHTML = images.map((img) => `
                <div class="thumb-item ${img.url === this.selectedImageUrl ? 'active' : ''}" data-url="${img.url}" style="width: 58px; height: 58px; border-radius: 8px; overflow: hidden; border: 2px solid ${img.url === this.selectedImageUrl ? 'var(--rsi-gold, #c5a059)' : 'var(--rsi-border-color, #e2e8f0)'}; cursor: pointer; flex-shrink: 0; background: #fff; padding: 3px; display: flex; align-items: center; justify-content: center;">
                    <img src="${img.url}" alt="Thumb" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                </div>
            `).join('');

            thumbsRow.querySelectorAll('.thumb-item').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    const url = thumb.dataset.url;
                    this.selectedImageUrl = url;
                    if (mainImg) mainImg.src = url;

                    thumbsRow.querySelectorAll('.thumb-item').forEach(t => {
                        t.style.borderColor = 'var(--rsi-border-color, #e2e8f0)';
                        t.classList.remove('active');
                    });
                    thumb.style.borderColor = 'var(--rsi-gold, #c5a059)';
                    thumb.classList.add('active');
                });
            });
        }
    }

    renderCaracteristicas() {
        const list = document.getElementById('detailCaracteristicasList');
        if (!list) return;

        const specs = Array.isArray(this.product.caracteristicas) && this.product.caracteristicas.length > 0
            ? this.product.caracteristicas
            : [
                'Garantía directa con RSI Enterprise México',
                'Homologación oficial y soporte técnico postventa',
                'Compatibilidad con estándares internacionales de seguridad',
                'Facturación fiscal electrónica CFDI 4.0'
            ];

        list.innerHTML = specs.map(item => `
            <li style="display: flex; align-items: flex-start; gap: 8px; color: var(--rsi-gray-600); font-size: 0.88rem; line-height: 1.4;">
                <i class="fas fa-check-circle" style="color: var(--rsi-gold, #c5a059); margin-top: 2px; flex-shrink: 0;"></i>
                <span>${this.escapeHtml(item)}</span>
            </li>
        `).join('');
    }

    renderPdfBlock() {
        const block = document.getElementById('detailPdfBlock');
        const nombreEl = document.getElementById('detailPdfNombre');
        const tamanoEl = document.getElementById('detailPdfTamano');
        const downloadBtn = document.getElementById('detailPdfDownloadBtn');

        if (!block) return;

        const pdf = this.product.fichaTecnicaPdf;
        if (pdf && pdf.url) {
            if (nombreEl) nombreEl.textContent = pdf.nombre || `${this.product.nombre} - Ficha Técnica.pdf`;
            if (tamanoEl) tamanoEl.textContent = `${((pdf.tamano || 0) / 1024).toFixed(1)} KB`;
            if (downloadBtn) downloadBtn.href = pdf.url;
            block.style.display = 'flex';
        } else {
            block.style.display = 'none';
        }
    }

    async cargarRelacionados() {
        const grid = document.getElementById('detailRelatedGrid');
        const section = document.getElementById('detailRelatedSection');
        const txtCat = document.getElementById('txtRelacionadosCategoriaNombre');

        if (!grid || !this.product) return;

        if (txtCat) txtCat.textContent = this.product.categoriaNombre || 'esta categoría';

        try {
            const related = await this.productService.getRelatedProducts(
                this.product.id,
                this.product.categoriaId,
                this.product.marcaId,
                4
            );

            if (related.length === 0) {
                if (section) section.style.display = 'none';
                return;
            }

            if (section) section.style.display = 'block';

            // Tarjetas compactas sin descripción
            grid.innerHTML = related.map(prod => {
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
                                <a href="/productDetail?id=${prod.id}" class="rsi-product-btn" data-link>
                                    Ver <i class="fas fa-chevron-right"></i>
                                </a>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        } catch (error) {
            console.error('❌ Error cargando relacionados:', error);
            if (section) section.style.display = 'none';
        }
    }

    handleAddToCart() {
        if (!this.product) return;

        document.dispatchEvent(new CustomEvent('cart:add', {
            detail: {
                productoId: this.product.id,
                cantidad: this.quantity,
                producto: this.product
            }
        }));

        Swal.fire({
            icon: 'success',
            title: '¡Agregado al carrito!',
            text: `${this.quantity}x ${this.product.nombre} se agregó correctamente a tu pedido.`,
            timer: 1600,
            showConfirmButton: false
        });
    }

    handleAddToWishlist() {
        if (!this.product) return;

        document.dispatchEvent(new CustomEvent('wishlist:toggle', {
            detail: {
                productoId: this.product.id,
                producto: this.product
            }
        }));

        const icon = document.getElementById('iconWishlist');
        if (icon) {
            const isSolid = icon.classList.contains('fas');
            if (isSolid) {
                icon.className = 'far fa-heart';
            } else {
                icon.className = 'fas fa-heart';
                icon.style.color = '#ef4444';
            }
        }
    }

    cleanup() {
        this.isInitialized = false;
        if (this.outsideClickListener) {
            document.removeEventListener('pointerdown', this.outsideClickListener);
            this.outsideClickListener = null;
        }
    }
}

export const productDetailController = () => {
    const ctrl = new ProductDetailController();
    ctrl.init();
    return ctrl;
};

export default productDetailController;
