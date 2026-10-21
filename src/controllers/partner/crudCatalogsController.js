/* ========================================
   CRUD CATALOGS CONTROLLER
   Gestión de catálogos (listado, ver, deshabilitar)
   ======================================== */

import CatalogService from '../../services/catalogService.js';
import { openShareCatalogModal } from '../../utils/shareCatalogHelper.js';

// ==========================================
// ESTADO
// ==========================================
let service = null;
let eventListeners = [];

let allCatalogs = [];       // catálogos ya paginados + contados (página actual)
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let totalItems = 0;
let currentFilter = 'all';  // 'all' | 'active' | 'inactive'
let currentSearch = '';
let searchDebounceTimer = null;
let pendingDetailCatalogId = null;

// ==========================================
// ENTRY POINT
// ==========================================

export async function crudCatalogsController() {
    console.log('📚 CRUD Catalogs Controller iniciado');

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    service = new CatalogService();

    initRefreshButton();
    initNewButton();
    initSearch();
    initFilterTabs();
    initPagination();
    initDetailModal();

    await loadCatalogs();
    await loadStats();

    console.log('✅ CRUD Catalogs Controller listo');
}

// ==========================================
// CARGA DE DATOS
// ==========================================

async function loadCatalogs() {
    showLoading(true);
    hideEmptyState();
    hideGrid();

    try {
        const result = await service.getCatalogsPaginated({
            status: currentFilter,
            page: currentPage,
            pageSize,
            searchTerm: currentSearch
        });

        allCatalogs = result.data || [];
        currentPage = result.page || 1;
        totalPages = result.totalPages || 1;
        totalItems = result.total || 0;

        // Actualizar contador del header
        const countEl = document.getElementById('catalogCount');
        if (countEl) countEl.textContent = totalItems;

        if (totalItems === 0) {
            showLoading(false);
            showEmptyState();
            updatePaginationUI();
            return;
        }

        renderGrid();
        showLoading(false);
        showGrid();
        updatePaginationUI();

    } catch (error) {
        console.error('❌ Error cargando catálogos:', error);
        showLoading(false);
        showEmptyState(
            'Error al cargar',
            'No se pudieron cargar los catálogos. Intenta de nuevo.'
        );
    }
}

async function loadStats() {
    try {
        const stats = await service.getCatalogStats(true);
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statActivos').textContent = stats.activos;
        document.getElementById('statInactivos').textContent = stats.inactivos;
        document.getElementById('statProductos').textContent = stats.totalProductos;
    } catch (error) {
        console.error('❌ Error cargando stats:', error);
    }
}

// ==========================================
// RENDERIZADO DEL GRID
// ==========================================

function renderGrid() {
    const grid = document.getElementById('catalogsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    allCatalogs.forEach(catalog => {
        const card = createCatalogCard(catalog);
        grid.appendChild(card);
    });

    // Listener de acciones dentro del grid
    grid.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            const id = btn.dataset.id;

            if (action === 'view') handleView(id);
            else if (action === 'share') handleShare(id);
            else if (action === 'edit') handleEdit(id);
            else if (action === 'disable') handleDisable(id);
            else if (action === 'enable') handleEnable(id);
        });
    });
}

function createCatalogCard(catalog) {
    const card = document.createElement('div');
    card.className = 'rsi-catalog-card';
    if (catalog.status === 'inactive') card.classList.add('rsi-catalog-card-inactive');

    const statusBadge = catalog.status === 'active'
        ? `<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Activo</span>`
        : `<span class="rsi-badge rsi-badge-gray"><i class="fas fa-ban"></i> Deshabilitado</span>`;

    const portada = catalog.imagenPortada
        ? `<img src="${escapeHtml(catalog.imagenPortada)}" alt="${escapeHtml(catalog.titulo)}">`
        : `<div class="rsi-catalog-card-placeholder"><i class="fas fa-image"></i></div>`;

    const productCount = catalog._productCount ?? 0;

    card.innerHTML = `
        <div class="rsi-catalog-card-cover">
            ${portada}
            <div class="rsi-catalog-card-status">${statusBadge}</div>
        </div>
        <div class="rsi-catalog-card-body">
            <h3>${escapeHtml(catalog.titulo || 'Sin título')}</h3>
            <p>${escapeHtml(catalog.descripcion || 'Sin descripción')}</p>
            <div class="rsi-catalog-card-meta">
                <span><i class="fas fa-box"></i> ${productCount} producto${productCount === 1 ? '' : 's'}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(catalog.createdAt)}</span>
            </div>
            <div class="rsi-catalog-card-audit">
                <small>
                    <i class="fas fa-user"></i>
                    Creado por ${escapeHtml(catalog.creadoPorNombre || 'N/D')}
                </small>
                ${catalog.editadoPorNombre 
                    ? `<small><i class="fas fa-user-edit"></i> Editado por ${escapeHtml(catalog.editadoPorNombre)}</small>` 
                    : ''}
                ${catalog.deshabilitadoPorNombre 
                    ? `<small><i class="fas fa-user-slash"></i> Deshabilitado por ${escapeHtml(catalog.deshabilitadoPorNombre)}</small>` 
                    : ''}
            </div>
        </div>
        <div class="rsi-catalog-card-actions">
            <button class="rsi-btn-icon" data-action="view" data-id="${catalog.id}" title="Ver detalle">
                <i class="fas fa-eye"></i>
            </button>
            <button class="rsi-btn-icon rsi-btn-primary" data-action="share" data-id="${catalog.id}" title="Compartir catálogo (/verCatalogo)">
                <i class="fas fa-share-alt"></i>
            </button>
            ${catalog.status === 'active' 
                ? `
                    <button class="rsi-btn-icon" data-action="edit" data-id="${catalog.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="rsi-btn-icon rsi-btn-danger" data-action="disable" data-id="${catalog.id}" title="Deshabilitar">
                        <i class="fas fa-ban"></i>
                    </button>
                `
                : `
                    <button class="rsi-btn-icon rsi-btn-success" data-action="enable" data-id="${catalog.id}" title="Reactivar">
                        <i class="fas fa-undo"></i>
                    </button>
                `
            }
        </div>
    `;

    return card;
}

// ==========================================
// ACCIONES
// ==========================================

function handleView(catalogId) {
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(`/partner/verCatalogo?id=${catalogId}`);
    } else {
        window.location.href = `/partner/verCatalogo?id=${catalogId}`;
    }
}

function handleShare(catalogId) {
    const catalog = allCatalogs.find(c => c.id === catalogId);
    if (!catalog) return;
    openShareCatalogModal(catalog);
}

function handleEdit(catalogId) {
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(`/partner/catalogo?id=${catalogId}`);
    } else {
        window.location.href = `/partner/catalogo?id=${catalogId}`;
    }
}

async function handleDisable(catalogId) {
    const catalog = allCatalogs.find(c => c.id === catalogId);
    if (!catalog) return;

    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Deshabilitar catálogo?',
        html: `
            <p>El catálogo <strong>${escapeHtml(catalog.titulo)}</strong> y sus productos dejarán de mostrarse.</p>
            <p style="font-size: 0.85rem; color: #666;">Esta acción se puede revertir.</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, deshabilitar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (!result.isConfirmed) return;

    try {
        await service.disableCatalog(catalogId);
        await loadCatalogs();
        await loadStats();

        Swal.fire({
            icon: 'success',
            title: 'Catálogo deshabilitado',
            timer: 1400,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('❌ Error deshabilitando:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo deshabilitar el catálogo',
            confirmButtonColor: '#d33'
        });
    }
}

async function handleEnable(catalogId) {
    const catalog = allCatalogs.find(c => c.id === catalogId);
    if (!catalog) return;

    const result = await Swal.fire({
        icon: 'question',
        title: '¿Reactivar catálogo?',
        html: `<p>El catálogo <strong>${escapeHtml(catalog.titulo)}</strong> volverá a estar activo.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, reactivar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948'
    });

    if (!result.isConfirmed) return;

    try {
        await service.enableCatalog(catalogId);
        await loadCatalogs();
        await loadStats();

        Swal.fire({
            icon: 'success',
            title: 'Catálogo reactivado',
            timer: 1400,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('❌ Error reactivando:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo reactivar el catálogo',
            confirmButtonColor: '#d33'
        });
    }
}

// ==========================================
// MODAL DE DETALLE
// ==========================================

function initDetailModal() {
    const modal = document.getElementById('detailModal');
    const closeBtn = document.getElementById('closeDetailModal');
    const closeFooter = document.getElementById('closeDetailFooter');
    const editBtn = document.getElementById('editFromDetail');

    if (!modal) return;

    const closeHandler = () => { modal.style.display = 'none'; pendingDetailCatalogId = null; };
    closeBtn?.addEventListener('click', closeHandler);
    closeFooter?.addEventListener('click', closeHandler);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeHandler(); });

    editBtn?.addEventListener('click', () => {
        if (pendingDetailCatalogId) handleEdit(pendingDetailCatalogId);
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeHandler();
    });
}

async function openDetailModal(catalog) {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!modal || !body) return;

    pendingDetailCatalogId = catalog.id;

    // Render inicial con loading
    body.innerHTML = `
        <div class="rsi-loading-state" style="padding: 2rem;">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando detalle...</p>
        </div>
    `;
    modal.style.display = 'flex';

    try {
        // Cargar productos
        const products = await service.getProductsByCatalog(catalog.id, true);

        const statusBadge = catalog.status === 'active'
            ? `<span class="rsi-badge rsi-badge-success">Activo</span>`
            : `<span class="rsi-badge rsi-badge-gray">Deshabilitado</span>`;

        body.innerHTML = `
            <div class="rsi-detail-section">
                ${catalog.imagenPortada 
                    ? `<img src="${escapeHtml(catalog.imagenPortada)}" alt="Portada" class="rsi-detail-cover">` 
                    : ''}
                <h2 style="margin: 0.5rem 0;">${escapeHtml(catalog.titulo)}</h2>
                <div style="margin-bottom: 1rem;">${statusBadge}</div>
                <p style="color: #666;">${escapeHtml(catalog.descripcion || 'Sin descripción')}</p>
            </div>

            <div class="rsi-detail-section">
                <h4><i class="fas fa-box-open"></i> Productos (${products.length})</h4>
                ${products.length === 0 
                    ? '<p style="color: #999; font-style: italic;">Sin productos registrados.</p>'
                    : `<div class="rsi-detail-products">
                        ${products.map(p => `
                            <div class="rsi-detail-product">
                                <div class="rsi-detail-product-img">
                                    ${p.imagen 
                                        ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}">` 
                                        : `<div class="rsi-detail-product-placeholder"><i class="fas fa-image"></i></div>`}
                                </div>
                                <div class="rsi-detail-product-info">
                                    <strong>${escapeHtml(p.nombre)}</strong>
                                    <small>${escapeHtml(p.descripcion || 'Sin descripción')}</small>
                                    ${p.precio !== null && p.precio !== undefined 
                                        ? `<span class="rsi-detail-price">$${Number(p.precio).toFixed(2)}</span>` 
                                        : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>

            <div class="rsi-detail-section">
                <h4><i class="fas fa-history"></i> Auditoría</h4>
                <div class="rsi-audit-list">
                    <div class="rsi-audit-row">
                        <i class="fas fa-user-plus"></i>
                        <div>
                            <strong>Creado por:</strong> ${escapeHtml(catalog.creadoPorNombre || 'N/D')}
                            <small>${formatDateTime(catalog.createdAt)}</small>
                        </div>
                    </div>
                    ${catalog.editadoPorNombre ? `
                        <div class="rsi-audit-row">
                            <i class="fas fa-user-edit"></i>
                            <div>
                                <strong>Editado por:</strong> ${escapeHtml(catalog.editadoPorNombre)}
                                <small>${formatDateTime(catalog.updatedAt)}</small>
                            </div>
                        </div>
                    ` : ''}
                    ${catalog.deshabilitadoPorNombre ? `
                        <div class="rsi-audit-row rsi-audit-danger">
                            <i class="fas fa-user-slash"></i>
                            <div>
                                <strong>Deshabilitado por:</strong> ${escapeHtml(catalog.deshabilitadoPorNombre)}
                                <small>${formatDateTime(catalog.deshabilitadoAt)}</small>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('❌ Error cargando detalle:', error);
        body.innerHTML = `<p style="color: #d33;">Error al cargar el detalle: ${escapeHtml(error.message)}</p>`;
    }
}

// ==========================================
// BÚSQUEDA
// ==========================================

function initSearch() {
    const input = document.getElementById('searchCatalog');
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchBtn = document.getElementById('searchCatalogBtn');
    const clearResults = document.getElementById('clearSearchResults');

    if (!input) return;

    // Debounce en input
    const inputHandler = () => {
        clearBtn.style.display = input.value ? 'block' : 'none';

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentSearch = input.value.trim();
            currentPage = 1;
            loadCatalogs();
            updateSearchInfo();
        }, 400);
    };
    input.addEventListener('input', inputHandler);
    eventListeners.push({ element: input, event: 'input', handler: inputHandler });

    // Enter
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchDebounceTimer);
            currentSearch = input.value.trim();
            currentPage = 1;
            loadCatalogs();
            updateSearchInfo();
        }
    };
    input.addEventListener('keydown', keyHandler);
    eventListeners.push({ element: input, event: 'keydown', handler: keyHandler });

    // Limpiar input
    if (clearBtn) {
        const clearHandler = () => {
            input.value = '';
            clearBtn.style.display = 'none';
            currentSearch = '';
            currentPage = 1;
            loadCatalogs();
            updateSearchInfo();
        };
        clearBtn.addEventListener('click', clearHandler);
        eventListeners.push({ element: clearBtn, event: 'click', handler: clearHandler });
    }

    // Botón buscar
    if (searchBtn) {
        const searchHandler = () => {
            clearTimeout(searchDebounceTimer);
            currentSearch = input.value.trim();
            currentPage = 1;
            loadCatalogs();
            updateSearchInfo();
        };
        searchBtn.addEventListener('click', searchHandler);
        eventListeners.push({ element: searchBtn, event: 'click', handler: searchHandler });
    }

    // Limpiar resultados
    if (clearResults) {
        const clearResultsHandler = () => {
            input.value = '';
            clearBtn.style.display = 'none';
            currentSearch = '';
            currentPage = 1;
            loadCatalogs();
            updateSearchInfo();
        };
        clearResults.addEventListener('click', clearResultsHandler);
        eventListeners.push({ element: clearResults, event: 'click', handler: clearResultsHandler });
    }
}

function updateSearchInfo() {
    const info = document.getElementById('searchResultsInfo');
    const text = document.getElementById('searchResultsText');
    if (!info || !text) return;

    if (currentSearch) {
        info.style.display = 'flex';
        text.innerHTML = `<i class="fas fa-filter"></i> ${totalItems} resultado${totalItems === 1 ? '' : 's'} para "<strong>${escapeHtml(currentSearch)}</strong>"`;
    } else {
        info.style.display = 'none';
    }
}

// ==========================================
// FILTROS POR ESTATUS
// ==========================================

function initFilterTabs() {
    const tabs = document.querySelectorAll('.rsi-filter-tab');
    tabs.forEach(tab => {
        const handler = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentFilter = tab.dataset.filter || 'all';
            currentPage = 1;
            loadCatalogs();
        };
        tab.addEventListener('click', handler);
        eventListeners.push({ element: tab, event: 'click', handler });
    });
}

// ==========================================
// PAGINACIÓN
// ==========================================

function initPagination() {
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');

    if (prev) {
        const handler = () => {
            if (currentPage > 1) {
                currentPage--;
                loadCatalogs();
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
            }
        };
        next.addEventListener('click', handler);
        eventListeners.push({ element: next, event: 'click', handler });
    }
}

function updatePaginationUI() {
    const container = document.getElementById('paginationContainer');
    const info = document.getElementById('pageInfo');
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');

    if (!container || !info || !prev || !next) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    info.textContent = `Página ${currentPage} de ${totalPages} (${totalItems} item${totalItems === 1 ? '' : 's'})`;

    prev.disabled = currentPage <= 1;
    next.disabled = currentPage >= totalPages;
}

// ==========================================
// REFRESH / NUEVO
// ==========================================

function initRefreshButton() {
    const btn = document.getElementById('refreshCatalogs');
    if (!btn) return;

    const handler = async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';

        try {
            service.clearCache();
            await loadCatalogs();
            await loadStats();
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        }
    };
    btn.addEventListener('click', handler);
    eventListeners.push({ element: btn, event: 'click', handler });
}

function initNewButton() {
    // El botón "Nuevo Catálogo" es un <a>, navega directo.
    // No necesita listener JS.
}

// ==========================================
// ESTADOS DE UI
// ==========================================

function showLoading(show) {
    const el = document.getElementById('loadingState');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function showGrid() {
    const el = document.getElementById('catalogsGrid');
    if (el) el.style.display = 'grid';
}

function hideGrid() {
    const el = document.getElementById('catalogsGrid');
    if (el) el.style.display = 'none';
}

function showEmptyState(title, text) {
    const el = document.getElementById('emptyState');
    const t = document.getElementById('emptyStateTitle');
    const p = document.getElementById('emptyStateText');
    if (!el) return;

    if (title) t.textContent = title;
    if (text) p.textContent = text;
    el.style.display = 'flex';
}

function hideEmptyState() {
    const el = document.getElementById('emptyState');
    if (el) el.style.display = 'none';
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
        const d = new Date(iso);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return 'N/D';
    }
}

function formatDateTime(iso) {
    if (!iso) return 'N/D';
    try {
        const d = new Date(iso);
        return d.toLocaleString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return 'N/D';
    }
}

// ==========================================
// DESTROY
// ==========================================

export function destroyCrudCatalogsController() {
    console.log('🧹 Destroying CrudCatalogsController');
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    service = null;
    allCatalogs = [];
    currentPage = 1;
    totalPages = 1;
    totalItems = 0;
    currentFilter = 'all';
    currentSearch = '';
    clearTimeout(searchDebounceTimer);
}

export default crudCatalogsController;