/* ==========================================================================
   WISHLIST SERVICE - RSI Enterprise (Ecommerce)
   Servicio para Lista de Deseos (Favoritos) sincronizado con Firestore
   ========================================================================== */

import { db, doc, getDoc, setDoc } from '../config/firebaseConfig.js';

export class WishlistService {
    constructor() {
        this.collectionName = 'ecommerceFavoritos';
        this.storageKey = 'rsi_wishlist_guest';
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
        document.addEventListener('wishlist:toggle', async (e) => {
            const { producto } = e.detail || {};
            if (producto) {
                await this.toggleItem(producto);
            }
        });
    }

    /**
     * Obtiene los productos favoritos
     * @returns {Promise<Array<Object>>}
     */
    async getWishlist() {
        const uid = this._getUserUid();

        if (!uid) {
            return this._getGuestWishlist();
        }

        try {
            const docRef = doc(db, this.collectionName, uid);
            const snap = await getDoc(docRef);

            let items = [];
            if (snap.exists()) {
                items = snap.data().items || [];
            } else {
                const guestItems = this._getGuestWishlist();
                if (guestItems.length > 0) {
                    items = guestItems;
                    await setDoc(docRef, { items, updatedAt: new Date().toISOString() });
                    localStorage.removeItem(this.storageKey);
                }
            }

            return items;
        } catch (error) {
            console.error('❌ Error obteniendo favoritos de Firestore:', error);
            return this._getGuestWishlist();
        }
    }

    _getGuestWishlist() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    /**
     * Alterna si un producto está en favoritos
     */
    async toggleItem(producto) {
        const items = await this.getWishlist();
        const existingIdx = items.findIndex(it => it.productoId === producto.id);

        let added = false;
        if (existingIdx !== -1) {
            items.splice(existingIdx, 1);
        } else {
            items.push({
                productoId: producto.id,
                nombre: producto.nombre,
                modelo: producto.modelo || '',
                precio: parseFloat(producto.precio) || 0,
                categoriaNombre: producto.categoriaNombre || '',
                marcaNombre: producto.marcaNombre || '',
                imagen: producto.imagenPrincipal || producto.imagenes?.[0]?.url || '/assets/images/placeholder.jpg',
                agregadoAt: new Date().toISOString()
            });
            added = true;
        }

        await this._saveWishlist(items);
        return { items, added };
    }

    async isInWishlist(productoId) {
        const items = await this.getWishlist();
        return items.some(it => it.productoId === productoId);
    }

    async removeItem(productoId) {
        const items = await this.getWishlist();
        const filtered = items.filter(it => it.productoId !== productoId);
        await this._saveWishlist(filtered);
        return filtered;
    }

    async _saveWishlist(items) {
        const uid = this._getUserUid();

        if (!uid) {
            localStorage.setItem(this.storageKey, JSON.stringify(items));
        } else {
            try {
                const docRef = doc(db, this.collectionName, uid);
                await setDoc(docRef, { items, updatedAt: new Date().toISOString() });
            } catch (error) {
                console.error('❌ Error guardando favoritos en Firestore:', error);
                localStorage.setItem(this.storageKey, JSON.stringify(items));
            }
        }

        document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { items, count: items.length } }));
        this._updateWishlistBadges(items.length);
    }

    _updateWishlistBadges(count) {
        document.querySelectorAll('.rsi-wishlist-badge').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
}

export const wishlistService = new WishlistService();
export default wishlistService;
