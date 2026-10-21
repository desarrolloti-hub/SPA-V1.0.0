/* ==========================================================================
   CART SERVICE - RSI Enterprise (Ecommerce)
   Servicio para Carrito de Compras sincronizado con Firestore y LocalStorage
   ========================================================================== */

import { db, doc, getDoc, setDoc } from '../config/firebaseConfig.js';

export class CartService {
    constructor() {
        this.collectionName = 'ecommerceCarritos';
        this.storageKey = 'rsi_cart_guest';
        this.initEventListeners();
    }

    _getUserUid() {
        try {
            const raw = localStorage.getItem('rsi_session');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.uid || null;
        } catch {
            return null;
        }
    }

    initEventListeners() {
        // Escuchar eventos globales de agregado
        document.addEventListener('cart:add', async (e) => {
            const { productoId, cantidad = 1, producto = null } = e.detail || {};
            if (producto) {
                await this.addItem(producto, cantidad);
            } else if (productoId) {
                await this.addItemById(productoId, cantidad);
            }
        });
    }

    /**
     * Obtiene los items del carrito actual
     * @returns {Promise<{items: Array<Object>, subtotal: number, iva: number, total: number}>}
     */
    async getCart() {
        const uid = this._getUserUid();

        if (!uid) {
            // Usuario invitado (localStorage)
            return this._getGuestCart();
        }

        try {
            const docRef = doc(db, this.collectionName, uid);
            const snap = await getDoc(docRef);

            let items = [];
            if (snap.exists()) {
                items = snap.data().items || [];
            } else {
                // Verificar si hay items como invitado para sincronizar
                const guestCart = this._getGuestCart();
                if (guestCart.items.length > 0) {
                    items = guestCart.items;
                    await setDoc(docRef, { items, updatedAt: new Date().toISOString() });
                    localStorage.removeItem(this.storageKey);
                }
            }

            return this._calculateTotals(items);
        } catch (error) {
            console.error('❌ Error obteniendo carrito de Firestore:', error);
            return this._getGuestCart();
        }
    }

    _getGuestCart() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            const items = raw ? JSON.parse(raw) : [];
            return this._calculateTotals(items);
        } catch {
            return { items: [], subtotal: 0, iva: 0, total: 0, count: 0 };
        }
    }

    _calculateTotals(items) {
        const cleanItems = Array.isArray(items) ? items : [];
        let subtotal = 0;

        cleanItems.forEach(item => {
            const price = parseFloat(item.precio) || 0;
            const qty = parseInt(item.cantidad, 10) || 1;
            item.subtotal = price * qty;
            subtotal += item.subtotal;
        });

        const iva = subtotal * 0.16; // 16% IVA México
        const total = subtotal + iva;
        const count = cleanItems.reduce((acc, it) => acc + (parseInt(it.cantidad, 10) || 1), 0);

        return {
            items: cleanItems,
            subtotal,
            iva,
            total,
            count
        };
    }

    /**
     * Agrega un producto al carrito
     */
    async addItem(producto, cantidad = 1) {
        const cart = await this.getCart();
        const items = [...cart.items];

        const existingIdx = items.findIndex(it => it.productoId === producto.id);
        const qtyToAdd = Math.max(1, parseInt(cantidad, 10) || 1);

        if (existingIdx !== -1) {
            items[existingIdx].cantidad += qtyToAdd;
        } else {
            items.push({
                productoId: producto.id,
                nombre: producto.nombre,
                modelo: producto.modelo || '',
                codigoInterno: producto.codigoInterno || '',
                precio: parseFloat(producto.precio) || 0,
                imagen: producto.imagenPrincipal || producto.imagenes?.[0]?.url || '/assets/images/placeholder.jpg',
                cantidad: qtyToAdd,
                agregadoAt: new Date().toISOString()
            });
        }

        await this._saveCart(items);
        return this.getCart();
    }

    async addItemById(productoId, cantidad = 1) {
        // En caso de que solo tengamos el id, consultar el producto
        try {
            const docRef = doc(db, 'ecommerceProductos', productoId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                await this.addItem({ id: snap.id, ...snap.data() }, cantidad);
            }
        } catch (error) {
            console.error('❌ Error agregando al carrito por ID:', error);
        }
    }

    /**
     * Actualiza la cantidad de un ítem
     */
    async updateQuantity(productoId, cantidad) {
        const cart = await this.getCart();
        let items = [...cart.items];

        const qty = parseInt(cantidad, 10);
        if (qty <= 0) {
            items = items.filter(it => it.productoId !== productoId);
        } else {
            const target = items.find(it => it.productoId === productoId);
            if (target) {
                target.cantidad = qty;
            }
        }

        await this._saveCart(items);
        return this.getCart();
    }

    /**
     * Elimina un producto del carrito
     */
    async removeItem(productoId) {
        const cart = await this.getCart();
        const items = cart.items.filter(it => it.productoId !== productoId);
        await this._saveCart(items);
        return this.getCart();
    }

    /**
     * Vacía todo el carrito
     */
    async clearCart() {
        await this._saveCart([]);
        return this.getCart();
    }

    async _saveCart(items) {
        const uid = this._getUserUid();

        if (!uid) {
            localStorage.setItem(this.storageKey, JSON.stringify(items));
        } else {
            try {
                const docRef = doc(db, this.collectionName, uid);
                await setDoc(docRef, {
                    items,
                    updatedAt: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Error guardando carrito en Firestore:', error);
                localStorage.setItem(this.storageKey, JSON.stringify(items));
            }
        }

        const totals = this._calculateTotals(items);
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: totals }));
        this._updateCartBadges(totals.count);
    }

    _updateCartBadges(count) {
        document.querySelectorAll('.rsi-cart-badge').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
}

export const cartService = new CartService();
export default cartService;
