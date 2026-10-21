/* ==========================================================================
   BUYER DASHBOARD CONTROLLER - RSI Enterprise
   Controlador para el panel privado del cliente/comprador
   ========================================================================== */

import AuthService from '../../services/authService.js';
import { CartService } from '../../services/cartService.js';
import { WishlistService } from '../../services/wishlistService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class BuyerDashboardController {
    constructor() {
        this.authService = new AuthService();
        this.cartService = new CartService();
        this.wishlistService = new WishlistService();
        this.session = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.session = this.authService.getSession();
        if (!this.session) {
            window.history.pushState({}, '', '/login');
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        this.renderUserData();
        this.bindEvents();

        await Promise.all([
            this.cargarDatosCarrito(),
            this.cargarDatosFavoritos()
        ]);
    }

    renderUserData() {
        const nameEl = document.getElementById('buyerGreetingName');
        const roleEl = document.getElementById('statBuyerRole');

        if (nameEl) {
            nameEl.textContent = this.session.displayName || this.session.nombreCompleto || this.session.email.split('@')[0];
        }

        if (roleEl) {
            const rolStr = this.session.rol === 'admin' ? 'Administrador' : (this.session.rol === 'partner' ? 'Colaborador' : 'Cliente Verificado');
            roleEl.textContent = rolStr;
        }
    }

    bindEvents() {
        const btnLogout = document.getElementById('btnBuyerLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                const confirm = await Swal.fire({
                    icon: 'question',
                    title: '¿Cerrar sesión?',
                    text: 'Tendrás que volver a ingresar para ver tus pedidos guardados.',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, salir',
                    cancelButtonText: 'Cancelar'
                });

                if (confirm.isConfirmed) {
                    await this.authService.logout(true);
                }
            });
        }
    }

    async cargarDatosCarrito() {
        try {
            const cart = await this.cartService.getCart();
            const countEl = document.getElementById('statBuyerCartCount');
            const totalEl = document.getElementById('statBuyerTotalCart');

            if (countEl) countEl.textContent = cart.count || 0;
            if (totalEl) {
                totalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cart.total || 0);
            }
        } catch (error) {
            console.error('❌ Error cargando carrito en buyer dashboard:', error);
        }
    }

    async cargarDatosFavoritos() {
        try {
            const items = await this.wishlistService.getWishlist();
            const countEl = document.getElementById('statBuyerWishlistCount');
            const gridEl = document.getElementById('buyerRecentWishlistGrid');

            if (countEl) countEl.textContent = items.length;

            if (gridEl) {
                if (items.length === 0) {
                    gridEl.innerHTML = `
                        <p style="color: var(--rsi-gray-400); font-size: 0.9rem; grid-column: 1 / -1; text-align: center; padding: 30px 0;">
                            No tienes productos guardados en favoritos todavía. ¡Explora el catálogo y agrega los que te gusten!
                        </p>
                    `;
                    return;
                }

                const recent = items.slice(0, 4);
                gridEl.innerHTML = recent.map(prod => `
                    <div style="background: var(--rsi-bg-body); border-radius: 10px; overflow: hidden; border: 1px solid var(--rsi-border-color); padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                            <img src="${prod.imagen || '/assets/images/placeholder.jpg'}" alt="${prod.nombre}" style="max-height: 100%; max-width: 100%; object-fit: contain;" />
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--rsi-gray-400);">${prod.categoriaNombre || 'Seguridad'}</span>
                            <h4 style="margin: 2px 0 6px; font-size: 0.9rem; font-weight: 700; color: var(--rsi-text-primary);">${prod.nombre}</h4>
                            <div style="font-weight: 800; color: var(--rsi-gold, #c5a059); font-size: 1rem; margin-bottom: 8px;">
                                ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.precio || 0)}
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <a href="/productDetail?id=${prod.productoId}" class="rsi-btn-crud rsi-btn-crud-primary" data-link style="flex: 1; padding: 6px; font-size: 0.8rem; justify-content: center;">
                                    Ver Detalle
                                </a>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('❌ Error cargando favoritos en buyer dashboard:', error);
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const buyerDashboardController = () => {
    const ctrl = new BuyerDashboardController();
    ctrl.init();
    return ctrl;
};

export default buyerDashboardController;
