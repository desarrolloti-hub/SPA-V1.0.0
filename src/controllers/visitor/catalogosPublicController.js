/* ========================================
   CATALOGS PUBLIC CONTROLLER
   Vista de solo lectura para el usuario final
   ======================================== */

import CatalogService from '../../services/catalogService.js';
import { openShareCatalogModal } from '../../utils/shareCatalogHelper.js';

// ==========================================
// ESTADO
// ==========================================
let service = null;
let eventListeners = [];

let allCatalogs = [];
let currentPage = 1;
let pageSize = 12;
let totalPages = 1;
let totalItems = 0;
let currentSearch = '';
let searchDebounceTimer = null;

// ==========================================
// ENTRY POINT
// ==========================================

export async function catalogsPublicController() {
    console.log('🌐 Catalogs Public Controller iniciado');

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    service = new CatalogService();

    initSearch();
    initPagination();

    await loadCatalogs();
}

// ==========================================
// CARGA
// ==========================================

async function loadCatalogs() {
    showLoading();
    hideEmpty();
    hideGrid();
    hidePagination();

    try {
        const result = await service.getCatalogsPaginated({
            status: 'active',
            page: currentPage,
            pageSize,
            searchTerm: currentSearch
        });

        const data = result?.data ?? result?.items ?? (Array.isArray(result) ? result : []);
        allCatalogs = Array.isArray(data) ? data : [];
        currentPage = result?.page ?? 1;
        totalPages = result?.totalPages ?? 1;
        totalItems = result?.total ?? allCatalogs.length;

        if (allCatalogs.length === 0) {
            showEmpty();
            return;
        }

        renderGrid();
        showGrid();
        updatePaginationUI();

    } catch (error) {
        console.error('❌ Error cargando catálogos:', error);
        showEmpty(
            'Error al cargar',
            'No pudimos cargar los catálogos. Intenta de nuevo más tarde.'
        );

    } finally {
        // 🔥 FUERZA BRUTA: eliminar el loading del DOM (y cualquier otro)
        destroyAllLoadings();
    }
}

// ==========================================
// 🔥 FIX DEFINITIVO: DESTRUIR LOADINGS
// ==========================================

/**
 * Elimina del DOM cualquier elemento de loading.
 * No depende de clases, CSS, ni caché. Si existe, lo borra.
 */
function destroyAllLoadings() {
    // 1. Por ID específico
    const byId = document.getElementById('publicLoading');
    if (byId) byId.remove();

    // 2. Por clase específica
    document.querySelectorAll('.rsi-public-loading').forEach(el => el.remove());

    // 3. Por cualquier variante de "loading" (por si el router mete otro)
    document.querySelectorAll('[id*="publicLoading"], [id*="public-loading"]').forEach(el => el.remove());

    console.log('🔥 destroyAllLoadings: loadings eliminados del DOM');
}

// ==========================================
// RENDER
// ==========================================

function renderGrid() {
    const grid = document.getElementById('publicGrid');
    if (!grid) return;

    grid.innerHTML = '';

    allCatalogs.forEach(catalog => {
        grid.appendChild(createCatalogCard(catalog));
    });

    grid.querySelectorAll('[data-catalog-id]').forEach(card => {
        const handler = (e) => {
            if (e.target.closest('a') || e.target.closest('.btn-share-catalog-public')) return;
            const id = card.dataset.catalogId;
            goToDetail(id);
        };
        card.addEventListener('click', handler);
        eventListeners.push({ element: card, event: 'click', handler });
    });

    grid.querySelectorAll('.btn-share-catalog-public').forEach(btn => {
        const shareHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            const catalog = allCatalogs.find(c => c.id === id);
            if (catalog) {
                openShareCatalogModal(catalog);
            }
        };
        btn.addEventListener('click', shareHandler);
        eventListeners.push({ element: btn, event: 'click', handler: shareHandler });
    });
}

function createCatalogCard(catalog) {
    const card = document.createElement('article');
    card.className = 'rsi-public-card';
    card.dataset.catalogId = catalog.id;

    const cover = catalog.imagenPortada
        ? `<img src="${escapeHtml(catalog.imagenPortada)}" alt="${escapeHtml(catalog.titulo)}" loading="lazy">`
        : `<div class="rsi-public-card-placeholder">
               <i class="fas fa-folder-open"></i>
           </div>`;

    const productCount = catalog._productCount ?? 0;
    const productLabel = productCount === 1 ? 'producto' : 'productos';

    card.innerHTML = `
        <div class="rsi-public-card-cover">
            ${cover}
        </div>
        <div class="rsi-public-card-body">
            <h3>${escapeHtml(catalog.titulo || 'Sin título')}</h3>
            <p>${escapeHtml(catalog.descripcion || 'Sin descripción')}</p>
            <div class="rsi-public-card-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <span class="rsi-public-card-count">
                    <i class="fas fa-box"></i>
                    ${productCount} ${productLabel}
                </span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" class="btn-share-catalog-public" data-id="${catalog.id}" style="background: rgba(37, 211, 102, 0.12); color: #25D366; border: 1px solid rgba(37, 211, 102, 0.3); border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;" title="Compartir catálogo">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <span class="rsi-public-card-cta" style="margin: 0;">
                        Ver <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        </div>
    `;

    return card;
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function goToDetail(catalogId) {
    const url = `/verCatalogo?id=${catalogId}`;
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(url);
    } else {
        window.location.href = url;
    }
}

// ==========================================
// BÚSQUEDA
// ==========================================

function initSearch() {
    const input = document.getElementById('publicSearch');
    const clearBtn = document.getElementById('publicSearchClear');
    if (!input) return;

    const inputHandler = () => {
        if (clearBtn) {
            clearBtn.classList.toggle('is-hidden', !input.value);
        }

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentSearch = input.value.trim();
            currentPage = 1;
            loadCatalogs();
        }, 350);
    };
    input.addEventListener('input', inputHandler);
    eventListeners.push({ element: input, event: 'input', handler: inputHandler });

    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchDebounceTimer);
            currentSearch = input.value.trim();
            currentPage = 1;
            loadCatalogs();
        }
    };
    input.addEventListener('keydown', keyHandler);
    eventListeners.push({ element: input, event: 'keydown', handler: keyHandler });

    if (clearBtn) {
        const clearHandler = () => {
            input.value = '';
            clearBtn.classList.add('is-hidden');
            currentSearch = '';
            currentPage = 1;
            loadCatalogs();
        };
        clearBtn.addEventListener('click', clearHandler);
        eventListeners.push({ element: clearBtn, event: 'click', handler: clearHandler });
    }
}

// ==========================================
// PAGINACIÓN
// ==========================================

function initPagination() {
    const prev = document.getElementById('publicPrev');
    const next = document.getElementById('publicNext');

    if (prev) {
        const handler = () => {
            if (currentPage > 1) {
                currentPage--;
                loadCatalogs();
                scrollToTop();
            }
        };
        prev.addEventListener('click', handler);
        eventListeners.push({ element: prev, event: 'click', handler });
    }

    if (next) {
        const handler = () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadCatalogs();
                scrollToTop();
            }
        };
        next.addEventListener('click', handler);
        eventListeners.push({ element: next, event: 'click', handler });
    }
}

function updatePaginationUI() {
    const container = document.getElementById('publicPagination');
    const info = document.getElementById('publicPageInfo');
    const prev = document.getElementById('publicPrev');
    const next = document.getElementById('publicNext');

    if (!container || !info || !prev || !next) return;

    if (totalPages <= 1) {
        container.classList.add('is-hidden');
        return;
    }

    container.classList.remove('is-hidden');
    info.textContent = `Página ${currentPage} de ${totalPages}`;

    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= totalPages;
}

function hidePagination() {
    const container = document.getElementById('publicPagination');
    if (container) container.classList.add('is-hidden');
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// ESTADOS DE UI
// ==========================================

function showLoading() {
    const el = document.getElementById('publicLoading');
    if (el) {
        el.classList.remove('is-hidden');
        el.style.display = 'flex';
    }
}

function showGrid() {
    const el = document.getElementById('publicGrid');
    if (el) el.classList.remove('is-hidden');
}

function hideGrid() {
    const el = document.getElementById('publicGrid');
    if (el) el.classList.add('is-hidden');
}

function showEmpty(title, text) {
    const el = document.getElementById('publicEmpty');
    const t = document.getElementById('publicEmptyTitle');
    const p = document.getElementById('publicEmptyText');
    if (!el) return;

    if (title && t) t.textContent = title;
    if (text && p) p.textContent = text;

    el.classList.remove('is-hidden');
}

function hideEmpty() {
    const el = document.getElementById('publicEmpty');
    if (el) el.classList.add('is-hidden');
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

// ==========================================
// DESTROY
// ==========================================

export function destroyCatalogsPublicController() {
    console.log('🧹 Destroying CatalogsPublicController');
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    service = null;
    allCatalogs = [];
    currentPage = 1;
    totalPages = 1;
    totalItems = 0;
    currentSearch = '';
    clearTimeout(searchDebounceTimer);
}

export default catalogsPublicController;