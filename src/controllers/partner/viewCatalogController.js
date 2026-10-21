/* ========================================
   VIEW CATALOG CONTROLLER
   Vista de detalle del catálogo
   ======================================== */

import CatalogService from '../../services/catalogService.js';
import { openShareCatalogModal } from '../../utils/shareCatalogHelper.js';

// ==========================================
// ESTADO
// ==========================================
let service = null;
let eventListeners = [];
let catalogId = null;
let catalogData = null;
let allProducts = [];
let filteredProducts = [];
let searchDebounceTimer = null;

// ==========================================
// ENTRY POINT
// ==========================================

export async function viewCatalogController() {
    console.log('👁️ View Catalog Controller iniciado');

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    service = new CatalogService();

    // Obtener ID desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    catalogId = urlParams.get('id');

    if (!catalogId) {
        showError('No se especificó ningún catálogo.');
        return;
    }

    await loadCatalog();

    initSearch();
    initEditButton();
    initShareButton();
    initKeyboardShortcuts();
}

// ==========================================
// CARGA
// ==========================================

async function loadCatalog() {
    showLoading();

    try {
        // Cargar catálogo y productos en paralelo
        const [catalog, products] = await Promise.all([
            service.getCatalogById(catalogId, true),
            service.getProductsByCatalog(catalogId, true, 'active')
        ]);

        if (!catalog) {
            showError('El catálogo no existe o fue eliminado.');
            return;
        }

        catalogData = catalog;
        allProducts = products || [];
        filteredProducts = [...allProducts];

        renderHero();
        renderInfoBar();
        renderProducts();

        showContent();

    } catch (error) {
        console.error('❌ Error cargando catálogo:', error);
        showError(error.message || 'Error al cargar el catálogo.');
    }
}

// ==========================================
// RENDER - HERO
// ==========================================

function renderHero() {
    const hero = document.getElementById('viewHero');
    const title = document.getElementById('viewTitle');
    const description = document.getElementById('viewDescription');
    const badge = document.getElementById('viewStatusBadge');
    const count = document.getElementById('viewProductCount');
    const createdDate = document.getElementById('viewCreatedDate');

    // Imagen de fondo
    if (catalogData.imagenPortada) {
        hero.style.backgroundImage = `url('${catalogData.imagenPortada}')`;
        hero.classList.add('rsi-view-hero-with-image');
    }

    // Título y descripción
    title.textContent = catalogData.titulo || 'Sin título';
    description.textContent = catalogData.descripcion || 'Sin descripción';

    // Badge de estado
    badge.innerHTML = catalogData.status === 'active'
        ? `<span class="rsi-badge rsi-badge-success">
               <i class="fas fa-check-circle"></i> Activo
           </span>`
        : `<span class="rsi-badge rsi-badge-gray">
               <i class="fas fa-ban"></i> Deshabilitado
           </span>`;

    // Contador y fecha
    count.textContent = allProducts.length;
    createdDate.textContent = formatDate(catalogData.createdAt);
}

// ==========================================
// RENDER - INFO BAR
// ==========================================

function renderInfoBar() {
    document.getElementById('viewCreatedBy').textContent = 
        catalogData.creadoPorNombre || 'N/D';

    // Editado por
    if (catalogData.editadoPorNombre) {
        document.getElementById('viewEditedByContainer').style.display = 'flex';
        document.getElementById('viewEditedBy').textContent = 
            `${catalogData.editadoPorNombre} · ${formatDate(catalogData.updatedAt)}`;
    }

    // Deshabilitado por
    if (catalogData.deshabilitadoPorNombre) {
        document.getElementById('viewDisabledByContainer').style.display = 'flex';
        document.getElementById('viewDisabledBy').textContent = 
            `${catalogData.deshabilitadoPorNombre} · ${formatDate(catalogData.deshabilitadoAt)}`;
    }
}

// ==========================================
// RENDER - PRODUCTOS
// ==========================================

function renderProducts() {
    const grid = document.getElementById('viewProductsGrid');
    const noProducts = document.getElementById('viewNoProducts');
    const noResults = document.getElementById('viewNoResults');
    const badge = document.getElementById('viewProductsBadge');

    grid.innerHTML = '';
    badge.textContent = filteredProducts.length;

    // Sin productos en absoluto
    if (allProducts.length === 0) {
        grid.style.display = 'none';
        noProducts.style.display = 'flex';
        noResults.style.display = 'none';
        return;
    }

    // Sin resultados de búsqueda
    if (filteredProducts.length === 0) {
        grid.style.display = 'none';
        noProducts.style.display = 'none';
        noResults.style.display = 'flex';
        return;
    }

    noProducts.style.display = 'none';
    noResults.style.display = 'none';
    grid.style.display = 'grid';

    filteredProducts.forEach(product => {
        grid.appendChild(createProductCard(product));
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'rsi-view-product-card';

    const image = product.imagen
        ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy">`
        : `<div class="rsi-view-product-placeholder">
               <i class="fas fa-image"></i>
           </div>`;

    const price = product.precio !== null && product.precio !== undefined
        ? `<div class="rsi-view-product-price">$${formatPrice(product.precio)}</div>`
        : '';

    card.innerHTML = `
        <div class="rsi-view-product-image">
            ${image}
        </div>
        <div class="rsi-view-product-body">
            <h3>${escapeHtml(product.nombre)}</h3>
            <p>${escapeHtml(product.descripcion || 'Sin descripción')}</p>
            ${price}
        </div>
    `;

    return card;
}

// ==========================================
// BÚSQUEDA
// ==========================================

function initSearch() {
    const input = document.getElementById('viewProductsSearch');
    if (!input) return;

    const handler = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            filterProducts(input.value.trim());
        }, 250);
    };

    input.addEventListener('input', handler);
    eventListeners.push({ element: input, event: 'input', handler });
}

function filterProducts(term) {
    if (!term) {
        filteredProducts = [...allProducts];
    } else {
        const t = term.toLowerCase();
        filteredProducts = allProducts.filter(p => {
            const nombre = (p.nombre || '').toLowerCase();
            const desc = (p.descripcion || '').toLowerCase();
            return nombre.includes(t) || desc.includes(t);
        });
    }
    renderProducts();
}

// ==========================================
// ACCIONES
// ==========================================

function initEditButton() {
    const btn = document.getElementById('viewEditBtn');
    if (!btn) return;

    const handler = () => {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/catalogo?id=${catalogId}`);
        } else {
            window.location.href = `/partner/catalogo?id=${catalogId}`;
        }
    };

    btn.addEventListener('click', handler);
    eventListeners.push({ element: btn, event: 'click', handler });
}

function initShareButton() {
    const btn = document.getElementById('viewShareBtn');
    if (!btn) return;

    const handler = () => {
        if (catalogData) {
            openShareCatalogModal(catalogData);
        }
    };

    btn.addEventListener('click', handler);
    eventListeners.push({ element: btn, event: 'click', handler });
}

function initKeyboardShortcuts() {
    const handler = (e) => {
        // ESC → volver al listado
        if (e.key === 'Escape') {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudCatalogs');
            } else {
                window.location.href = '/partner/crudCatalogs';
            }
        }
    };

    document.addEventListener('keydown', handler);
    eventListeners.push({ element: document, event: 'keydown', handler });
}

// ==========================================
// ESTADOS DE UI
// ==========================================

function showLoading() {
    document.getElementById('viewLoading').style.display = 'flex';
    document.getElementById('viewContent').style.display = 'none';
    document.getElementById('viewError').style.display = 'none';
}

function showContent() {
    document.getElementById('viewLoading').style.display = 'none';
    document.getElementById('viewContent').style.display = 'block';
    document.getElementById('viewError').style.display = 'none';
}

function showError(message) {
    document.getElementById('viewLoading').style.display = 'none';
    document.getElementById('viewContent').style.display = 'none';
    document.getElementById('viewError').style.display = 'flex';
    document.getElementById('viewErrorText').textContent = message;
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

export function destroyViewCatalogController() {
    console.log('🧹 Destroying ViewCatalogController');
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    service = null;
    catalogId = null;
    catalogData = null;
    allProducts = [];
    filteredProducts = [];
    clearTimeout(searchDebounceTimer);
}

export default viewCatalogController;