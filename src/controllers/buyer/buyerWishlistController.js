/* ==========================================================================
   BUYER WISHLIST CONTROLLER - RSI Enterprise
   Controlador para la Lista de Deseos (Favoritos) del Comprador
   ========================================================================== */

import { WishlistService } from '../../services/wishlistService.js';
import { CartService } from '../../services/cartService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class BuyerWishlistController {
    constructor() {
        this.wishlistService = new WishlistService();
        this.cartService = new CartService();
        this.items = [];
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        await this.cargarFavoritos();
    }

    async cargarFavoritos() {
        try {
            this.items = await this.wishlistService.getWishlist();
            this.renderGrid();
        } catch (error) {
            console.error('❌ Error cargando lista de deseos:', error);
        }
    }

    renderGrid() {
        const grid = document.getElementById('wishlistProductsGrid');
        const empty = document.getElementById('wishlistEmptyState');

        if (!grid) return;

        if (this.items.length === 0) {
            grid.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (empty) empty.style.display = 'none';

        grid.innerHTML = this.items.map(prod => {
            const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.precio || 0);

            return `
                <article class="rsi-product-card">
                    <div class="rsi-product-image">
                        <img src="${prod.imagen || '/assets/images/placeholder.jpg'}" alt="${prod.nombre}" loading="lazy">
                        <button type="button" class="btn-remove-wishlist" data-id="${prod.productoId}" style="position: absolute; top: 12px; right: 12px; z-index: 3; background: rgba(0,0,0,0.6); color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;" title="Quitar de favoritos">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div class="rsi-product-body">
                        <span class="rsi-product-category">${prod.categoriaNombre || 'Seguridad'}</span>
                        <h3 class="rsi-product-name" style="margin-bottom: 6px;">${prod.nombre}</h3>
                        ${prod.modelo ? `<div style="font-size: 0.8rem; color: var(--rsi-gray-400); margin-bottom: 8px;">Modelo: <code>${prod.modelo}</code></div>` : ''}
                        <div class="rsi-product-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--rsi-border-color, #e2e8f0); padding-top: 12px; margin-top: 12px;">
                            <span class="rsi-product-price">${precioFormatted}</span>
                            <div style="display: flex; gap: 6px;">
                                <button type="button" class="rsi-btn-crud rsi-btn-crud-primary btn-move-to-cart" data-id="${prod.productoId}" style="padding: 6px 12px; font-size: 0.85rem;" title="Mover al carrito">
                                    <i class="fas fa-cart-plus"></i> Al Carrito
                                </button>
                                <a href="/productDetail?id=${prod.productoId}" class="rsi-btn-crud rsi-btn-crud-outline" data-link style="padding: 6px 10px; font-size: 0.85rem;">
                                    <i class="fas fa-chevron-right"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Listeners
        grid.querySelectorAll('.btn-remove-wishlist').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                this.items = await this.wishlistService.removeItem(id);
                this.renderGrid();
            });
        });

        grid.querySelectorAll('.btn-move-to-cart').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const prod = this.items.find(p => p.productoId === id);
                if (prod) {
                    await this.cartService.addItem({
                        id: prod.productoId,
                        nombre: prod.nombre,
                        modelo: prod.modelo,
                        precio: prod.precio,
                        imagenPrincipal: prod.imagen
                    }, 1);

                    this.items = await this.wishlistService.removeItem(id);
                    this.renderGrid();

                    Swal.fire({
                        icon: 'success',
                        title: '¡Movido al carrito!',
                        text: `${prod.nombre} está ahora en tu pedido.`,
                        timer: 1600,
                        showConfirmButton: false
                    });
                }
            });
        });
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const buyerWishlistController = () => {
    const ctrl = new BuyerWishlistController();
    ctrl.init();
    return ctrl;
};

export default buyerWishlistController;
