/* ==========================================================================
   BUYER CART CONTROLLER - RSI Enterprise
   Controlador para el Carrito de Compras del Comprador
   ========================================================================== */

import { CartService } from '../../services/cartService.js';
import AuthService from '../../services/authService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class BuyerCartController {
    constructor() {
        this.cartService = new CartService();
        this.authService = new AuthService();
        this.cartData = { items: [], subtotal: 0, iva: 0, total: 0, count: 0 };
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.bindEvents();
        await this.cargarCarrito();
    }

    bindEvents() {
        const btnVaciar = document.getElementById('btnVaciarCarrito');
        if (btnVaciar) {
            btnVaciar.addEventListener('click', () => this.confirmarVaciarCarrito());
        }

        const btnCheckout = document.getElementById('btnCheckout');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => this.handleCheckout());
        }

        // Escuchar actualizaciones externas
        document.addEventListener('cart:updated', (e) => {
            if (e.detail) {
                this.cartData = e.detail;
                this.renderCarrito();
            }
        });
    }

    async cargarCarrito() {
        try {
            this.cartData = await this.cartService.getCart();
            this.renderCarrito();
        } catch (error) {
            console.error('❌ Error cargando carrito:', error);
        }
    }

    renderCarrito() {
        const emptyState = document.getElementById('cartEmptyState');
        const tableContainer = document.getElementById('cartTableContainer');
        const summaryCol = document.getElementById('cartSummaryCol');
        const tbody = document.getElementById('cartTbody');

        const items = this.cartData.items || [];

        if (items.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (tableContainer) tableContainer.style.display = 'none';
            if (summaryCol) summaryCol.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        if (summaryCol) summaryCol.style.display = 'block';

        if (tbody) {
            tbody.innerHTML = items.map(it => {
                const precioFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(it.precio || 0);
                const subtotalFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(it.subtotal || 0);

                return `
                    <tr style="border-bottom: 1px solid var(--rsi-border-color, #e2e8f0);">
                        <td style="text-align: center;">
                            <img src="${it.imagen || '/assets/images/placeholder.jpg'}" alt="${it.nombre}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; border: 1px solid var(--rsi-border-color);" />
                        </td>
                        <td>
                            <a href="/productDetail?id=${it.productoId}" data-link style="font-weight: 700; color: var(--rsi-text-primary); text-decoration: none; font-size: 0.95rem;">
                                ${it.nombre}
                            </a>
                            <div style="font-size: 0.8rem; color: var(--rsi-gray-400); margin-top: 2px;">
                                ${it.modelo ? `Mod: <code>${it.modelo}</code>` : ''}
                            </div>
                        </td>
                        <td style="text-align: right; font-weight: 600; color: var(--rsi-gray-600); font-size: 0.9rem;">
                            ${precioFormatted}
                        </td>
                        <td style="text-align: center;">
                            <div style="display: inline-flex; align-items: center; border: 1px solid var(--rsi-border-color); border-radius: 6px; overflow: hidden; background: var(--rsi-bg-body);">
                                <button type="button" class="btn-qty-minus" data-id="${it.productoId}" style="padding: 4px 8px; border: none; background: none; cursor: pointer; font-weight: 700;">-</button>
                                <span style="min-width: 28px; text-align: center; font-size: 0.85rem; font-weight: 600;">${it.cantidad}</span>
                                <button type="button" class="btn-qty-plus" data-id="${it.productoId}" style="padding: 4px 8px; border: none; background: none; cursor: pointer; font-weight: 700;">+</button>
                            </div>
                        </td>
                        <td style="text-align: right; font-weight: 800; color: var(--rsi-gold, #c5a059); font-size: 0.95rem;">
                            ${subtotalFormatted}
                        </td>
                        <td style="text-align: center;">
                            <button type="button" class="btn-remove-item" data-id="${it.productoId}" data-nombre="${it.nombre}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 6px; font-size: 0.9rem;" title="Eliminar del carrito">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Eventos en botones de la tabla
            tbody.querySelectorAll('.btn-qty-minus').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const item = items.find(it => it.productoId === id);
                    if (item && item.cantidad > 1) {
                        await this.cartService.updateQuantity(id, item.cantidad - 1);
                        await this.cargarCarrito();
                    } else if (item && item.cantidad === 1) {
                        await this.cartService.removeItem(id);
                        await this.cargarCarrito();
                    }
                });
            });

            tbody.querySelectorAll('.btn-qty-plus').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const item = items.find(it => it.productoId === id);
                    if (item) {
                        await this.cartService.updateQuantity(id, item.cantidad + 1);
                        await this.cargarCarrito();
                    }
                });
            });

            tbody.querySelectorAll('.btn-remove-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    await this.cartService.removeItem(id);
                    await this.cargarCarrito();
                });
            });
        }

        // Actualizar resumen
        const subtotalEl = document.getElementById('summarySubtotal');
        const ivaEl = document.getElementById('summaryIva');
        const totalEl = document.getElementById('summaryTotal');

        if (subtotalEl) subtotalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.cartData.subtotal || 0);
        if (ivaEl) ivaEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.cartData.iva || 0);
        if (totalEl) totalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.cartData.total || 0);
    }

    async confirmarVaciarCarrito() {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Vaciar carrito?',
            text: 'Se eliminarán todos los productos que has seleccionado.',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, vaciar',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            await this.cartService.clearCart();
            await this.cargarCarrito();
        }
    }

    async handleCheckout() {
        const session = this.authService.getSession();
        if (!session) {
            await Swal.fire({
                icon: 'info',
                title: 'Inicia sesión para continuar',
                text: 'Para tramitar tu pedido o cotización formal, por favor ingresa con tu cuenta o regístrate en segundos.',
                confirmButtonColor: '#c5a059',
                confirmButtonText: 'Iniciar Sesión'
            });
            window.history.pushState({}, '', '/login?returnUrl=/buyer/cart');
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        // Proceder a generar cotización formal o solicitud de compra
        Swal.fire({
            icon: 'success',
            title: '¡Solicitud de pedido lista!',
            html: `Tu pedido por un total de <strong>${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.cartData.total || 0)}</strong> está listo.<br><br>Un asesor comercial de RSI Enterprise te contactará de inmediato con la cotización formal foliada y opciones de facturación.`,
            confirmButtonColor: '#c5a059',
            confirmButtonText: 'Aceptar'
        });
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const buyerCartController = () => {
    const ctrl = new BuyerCartController();
    ctrl.init();
    return ctrl;
};

export default buyerCartController;
