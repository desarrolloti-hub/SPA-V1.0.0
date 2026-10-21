/* ========================================
   VIEW CATALOG PUBLIC CONTROLLER
   Detalle público del catálogo
   ======================================== */

import CatalogService from '../../services/catalogService.js';
import { openShareCatalogModal, updateCatalogSocialMetaTags } from '../../utils/shareCatalogHelper.js';

// WhatsApp
const WHATSAPP_NUMBER = '525551391533';

// ==========================================
// ESTADO
// ==========================================
let service = null;
let eventListeners = [];
let observerInstance = null;

let catalogId = null;
let catalogData = null;
let allProducts = [];

// ==========================================
// ENTRY POINT
// ==========================================

export async function viewCatalogPublicController() {
    console.log('👁️ View Catalog Public Controller iniciado');

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    service = new CatalogService();

    const urlParams = new URLSearchParams(window.location.search);
    catalogId = urlParams.get('id');

    if (!catalogId) {
        showError('No se especificó ningún catálogo.');
        return;
    }

    await loadCatalog();
}

// ==========================================
// CARGA
// ==========================================

async function loadCatalog() {
    showState('loading');

    try {
        const [catalog, products] = await Promise.all([
            service.getCatalogById(catalogId, true),
            service.getProductsByCatalog(catalogId, true, 'active')
        ]);

        if (!catalog) {
            showError('El catálogo no existe o fue eliminado.');
            return;
        }

        catalogData = catalog;
        allProducts = Array.isArray(products) ? products : [];

        console.log(`📦 Catálogo "${catalog.titulo}" con ${allProducts.length} productos`);

        // Actualizar metadatos Open Graph y Twitter Cards con la portada del catálogo
        updateCatalogSocialMetaTags(catalog);

        renderHero();
        initShareButton();

        if (allProducts.length === 0) {
            showState('noProducts');
            return;
        }

        renderProducts();
        showState('content');
        initScrollReveal();

    } catch (error) {
        console.error('❌ Error cargando catálogo:', error);
        showError(error.message || 'Error al cargar el catálogo.');
    }
}

// ==========================================
// HERO
// ==========================================

function renderHero() {
    const bg = document.getElementById('vcHeroBg');
    const title = document.getElementById('vcHeroTitle');
    const desc = document.getElementById('vcHeroDescription');
    const meta = document.getElementById('vcHeroMeta');

    if (catalogData.imagenPortada) {
        bg.style.backgroundImage = `url('${catalogData.imagenPortada}')`;
    }

    title.textContent = catalogData.titulo || 'Sin título';
    desc.textContent = catalogData.descripcion || 'Sin descripción';

    const count = allProducts.length;
    const label = count === 1 ? 'producto' : 'productos';

    meta.innerHTML = `
        <span>
            <i class="fas fa-box"></i>
            <strong>${count}</strong> ${label}
        </span>
        <span>
            <i class="fas fa-calendar"></i>
            ${formatDate(catalogData.createdAt)}
        </span>
    `;
}

function initShareButton() {
    const shareBtn = document.getElementById('btnShareCurrentCatalog');
    if (!shareBtn) return;

    const handler = (e) => {
        e.preventDefault();
        openShareCatalogModal(catalogData);
    };

    shareBtn.addEventListener('click', handler);
    eventListeners.push({ element: shareBtn, event: 'click', handler });
}

// ==========================================
// PRODUCTOS (alternados)
// ==========================================

function renderProducts() {
    const container = document.getElementById('vcProductsList');
    if (!container) return;

    container.innerHTML = '';

    allProducts.forEach((product, index) => {
        container.appendChild(createProductItem(product, index));
    });
}

function createProductItem(product, index) {
    const item = document.createElement('article');
    item.className = 'rsi-vc-product-item';

    // Alternar: pares → normal, impares → reverse
    if (index % 2 === 1) {
        item.classList.add('rsi-vc-product-reverse');
    }

    const number = String(index + 1).padStart(2, '0');

    const image = product.imagen
        ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy">`
        : `<div class="rsi-vc-product-placeholder"><i class="fas fa-image"></i></div>`;

    const price = (product.precio !== null && product.precio !== undefined)
        ? `<div class="rsi-vc-product-price">
               <i class="fas fa-tag"></i> $${formatPrice(product.precio)}
           </div>`
        : '';

    const waMessage = encodeURIComponent(
        `Hola, me interesa el producto "${product.nombre}" del catálogo "${catalogData.titulo}".`
    );

    item.innerHTML = `
        <div class="rsi-vc-product-image">
            ${image}
        </div>
        <div class="rsi-vc-product-content">
            <span class="rsi-vc-product-number">${number}</span>
            <h3 class="rsi-vc-product-title">${escapeHtml(product.nombre)}</h3>
            <p class="rsi-vc-product-description">${escapeHtml(product.descripcion || 'Sin descripción')}</p>
            ${price}
            <div>
                <a
                    href="https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rsi-vc-product-btn"
                >
                    <i class="fab fa-whatsapp"></i> Contactar para más información
                </a>
            </div>
        </div>
    `;

    return item;
}

// ==========================================
// SCROLL REVEAL
// ==========================================

function initScrollReveal() {
    const items = document.querySelectorAll('.rsi-vc-product-item');
    if (items.length === 0) return;

    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
        items.forEach(item => item.classList.add('is-visible'));
        return;
    }

    observerInstance = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observerInstance.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -80px 0px'
        }
    );

    items.forEach((item, index) => {
        item.style.transitionDelay = `${Math.min(index * 0.08, 0.4)}s`;
        observerInstance.observe(item);
    });

    console.log(`✨ Scroll reveal activado en ${items.length} productos`);
}

// ==========================================
// CONTROL DE ESTADOS
// ==========================================

/**
 * @param {'loading' | 'error' | 'content' | 'noProducts'} state
 */
function showState(state) {
    const loading = document.getElementById('vcLoading');
    const error = document.getElementById('vcError');
    const content = document.getElementById('vcContent');
    const noProducts = document.getElementById('vcNoProducts');

    if (loading) loading.classList.add('is-hidden');
    if (error) error.classList.add('is-hidden');
    if (content) content.classList.add('is-hidden');
    if (noProducts) noProducts.classList.add('is-hidden');

    if (state === 'loading' && loading) loading.classList.remove('is-hidden');
    else if (state === 'error' && error) error.classList.remove('is-hidden');
    else if (state === 'content' && content) content.classList.remove('is-hidden');
    else if (state === 'noProducts') {
        if (content) content.classList.remove('is-hidden');
        if (noProducts) noProducts.classList.remove('is-hidden');
    }
}

function showError(message) {
    const text = document.getElementById('vcErrorText');
    if (text) text.textContent = message;
    showState('error');
}

// ==========================================
// UTILS
// ==========================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(iso) {
    if (!iso) return 'N/D';
    try {
        return new Date(iso).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    } catch {
        return 'N/D';
    }
}

function formatPrice(precio) {
    const n = Number(precio);
    if (isNaN(n)) return '0.00';
    return n.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ==========================================
// DESTROY
// ==========================================

export function destroyViewCatalogPublicController() {
    console.log('🧹 Destroying ViewCatalogPublicController');

    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];

    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }

    service = null;
    catalogId = null;
    catalogData = null;
    allProducts = [];
}

export default viewCatalogPublicController;