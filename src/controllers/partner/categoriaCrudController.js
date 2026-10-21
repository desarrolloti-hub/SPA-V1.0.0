/* ========================================
   CATEGORÍAS CRUD CONTROLLER
   Controlador para listar y gestionar categorías de productos/servicios
   ======================================== */

import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';

let service = null;
let eventListeners = [];
let categoriasData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;

/**
 * Inicializa el controlador CRUD de categorías
 */
export async function categoriasCrudController() {
    console.log('📋 Categorías CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new CategoriaProductoServicioService();
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    
    initCategoriasEvents();
    initPagination();
    initSearch();
    initClearSearch();
    initRefresh();
    
    await loadCategoriasTable();
    await loadStats();
    
    console.log('✅ Categorías CRUD Controller listo');
}

/**
 * Inicializa los eventos principales
 */
function initCategoriasEvents() {
    const tableBody = document.getElementById('categoriasTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        const deleteBtn = e.target.closest('.btn-delete-categoria');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            await handleDeleteCategoria(id);
            return;
        }
        
        const editBtn = e.target.closest('.btn-edit-categoria');
        if (editBtn) {
            const id = editBtn.dataset.id;
            handleEditCategoria(id);
            return;
        }
        
        const viewBtn = e.target.closest('.btn-view-categoria');
        if (viewBtn) {
            const id = viewBtn.dataset.id;
            handleViewCategoria(id);
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchCategoria');
    const searchBtn = document.getElementById('searchCategoriaBtn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            await performSearch();
        });
        eventListeners.push({ element: searchBtn, event: 'click', handler: performSearch });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await performSearch();
            }
        });
        eventListeners.push({ element: searchInput, event: 'keypress', handler: performSearch });
        
        searchInput.addEventListener('input', () => {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
            }
        });
        eventListeners.push({ element: searchInput, event: 'input', handler: () => {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
            }
        }});
    }
}

/**
 * Realiza la búsqueda
 */
async function performSearch() {
    const searchInput = document.getElementById('searchCategoria');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadCategoriasTable();
    await loadStats();
    updateSearchInfo();
}

/**
 * Actualiza la información de búsqueda
 */
function updateSearchInfo() {
    const searchInfo = document.getElementById('searchResultsInfo');
    const searchText = document.getElementById('searchResultsText');
    
    if (!searchInfo || !searchText) return;
    
    if (isSearching && searchTerm.length > 0) {
        searchInfo.style.display = 'flex';
        searchText.innerHTML = `
            <i class="fas fa-search"></i> 
            Resultados para: <strong>"${searchTerm}"</strong> 
            (${totalItems} ${totalItems === 1 ? 'coincidencia' : 'coincidencias'})
        `;
    } else {
        searchInfo.style.display = 'none';
    }
}

/**
 * Inicializa el limpiar búsqueda
 */
function initClearSearch() {
    const clearBtn = document.getElementById('clearSearchBtn');
    const clearResultsBtn = document.getElementById('clearSearchResults');
    const searchInput = document.getElementById('searchCategoria');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadCategoriasTable();
            await loadStats();
            updateSearchInfo();
        });
        eventListeners.push({ element: clearBtn, event: 'click', handler: () => {} });
    }
    
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadCategoriasTable();
            await loadStats();
            updateSearchInfo();
        });
        eventListeners.push({ element: clearResultsBtn, event: 'click', handler: () => {} });
    }
}

/**
 * Inicializa la paginación
 */
function initPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await loadCategoriasTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
        eventListeners.push({ element: prevBtn, event: 'click', handler: () => {} });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await loadCategoriasTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
        eventListeners.push({ element: nextBtn, event: 'click', handler: () => {} });
    }
}

/**
 * Inicializa el refresco
 */
function initRefresh() {
    const refreshBtn = document.getElementById('refreshCategorias');
    if (!refreshBtn) return;

    const handler = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            service.clearCache?.();
            currentPage = 1;
            searchTerm = '';
            isSearching = false;
            
            const searchInput = document.getElementById('searchCategoria');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            await loadCategoriasTable();
            await loadStats();
            updateSearchInfo();
            
            refreshBtn.style.color = 'var(--rsi-success)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 500);
            
        } catch (error) {
            console.error('❌ Error actualizando:', error);
            refreshBtn.style.color = 'var(--rsi-danger)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 500);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        }
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
}

// =================================================================================
// FUNCIONES DE UTILIDAD
// =================================================================================

function mostrarLoading(mostrar) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = mostrar ? 'flex' : 'none';
    }
}

function mostrarAlerta(mensaje, tipo = 'info') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            title: mensaje,
            icon: tipo,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: 'var(--card-bg)',
            color: 'var(--text-color)'
        });
    } else {
        console.log(`[ALERTA ${tipo}]: ${mensaje}`);
    }
}

/**
 * Formatea una fecha
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

/**
 * Carga las estadísticas
 */
async function loadStats() {
    try {
        const stats = await service.getCategoriaStats();
        document.getElementById('statTotal').textContent = stats.total;
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

/**
 * Carga y muestra las categorías en la tabla
 */
async function loadCategoriasTable() {
    const tableBody = document.getElementById('categoriasTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const itemCount = document.getElementById('itemCount');
    const paginationContainer = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const emptyStateTitle = document.getElementById('emptyStateTitle');
    const emptyStateText = document.getElementById('emptyStateText');
    
    if (!tableBody) return;

    try {
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        
        let items = await service.getAllCategorias();
        
        // Filtrar por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            items = items.filter(item => {
                const nombre = (item.nombreCategoria || '').toLowerCase();
                return nombre.includes(termLower);
            });
        }
        
        categoriasData = items;
        totalItems = items.length;
        totalPages = Math.ceil(totalItems / pageSize);
        
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const paginatedItems = items.slice(start, end);

        if (loadingState) loadingState.style.display = 'none';

        if (paginatedItems.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay categorías registradas';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay categorías que coincidan con "${searchTerm}"` 
                        : 'Comienza agregando tu primera categoría.';
                }
                const emptyBtn = emptyState.querySelector('button');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (itemCount) itemCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (itemCount) itemCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        let rowsHtml = '';
        for (const item of paginatedItems) {
            const tieneImagen = item.imagenBase64 && item.imagenBase64.length > 0;
            
            rowsHtml += `
                <tr>
                    <td data-label="Nombre">
                        <div style="display: flex; align-items: center; gap: var(--rsi-spacing-sm);">
                            ${tieneImagen ? `
                                <img src="${item.imagenBase64}" alt="${item.nombreCategoria}" 
                                     style="width: 32px; height: 32px; object-fit: cover; border-radius: var(--rsi-radius-sm);">
                            ` : `
                                <div style="width: 32px; height: 32px; background: var(--rsi-gray-200); border-radius: var(--rsi-radius-sm); 
                                            display: flex; align-items: center; justify-content: center; color: var(--rsi-gray-500);">
                                    <i class="fas fa-tag"></i>
                                </div>
                            `}
                            <span style="font-weight: 500;">${item.nombreCategoria}</span>
                        </div>
                    </td>
                    <td data-label="Creado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem;">${item.creadoPor || 'Sistema'}</span>
                            <small style="color: var(--rsi-gray-500); font-size: 0.7rem;">
                                ${formatDate(item.fechaCreacion)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Modificado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem;">${item.modificadoPor || 'Sistema'}</span>
                            <small style="color: var(--rsi-gray-500); font-size: 0.7rem;">
                                ${formatDate(item.fechaActualizacion)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-categoria" data-id="${item.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-categoria" data-id="${item.id}" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-delete btn-delete-categoria" data-id="${item.id}" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al cargar las categorías: ' + error.message,
                confirmButtonText: 'Reintentar',
                confirmButtonColor: '#d33'
            });
        }
    }
}

/**
 * Maneja la eliminación de una categoría
 */
async function handleDeleteCategoria(id) {
    const item = categoriasData.find(c => c.id === id);
    if (!item) return;

    const result = await Swal.fire({
        title: '¿Eliminar categoría?',
        html: `
            <div style="text-align: left;">
                <p><strong>Categoría:</strong> ${item.nombreCategoria}</p>
                <p style="color: var(--rsi-danger); margin-top: var(--rsi-spacing-md);">
                    ⚠️ Esta acción no se puede deshacer.
                </p>
                <p style="color: var(--rsi-warning); font-size: 0.9rem;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Los productos asociados a esta categoría quedarán sin categoría.
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        await service.deleteCategoria(id);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminada!',
            text: `La categoría "${item.nombreCategoria}" ha sido eliminada.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadCategoriasTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error eliminando categoría:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar la categoría',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de una categoría
 */
async function handleViewCategoria(id) {
    try {
        const item = categoriasData.find(c => c.id === id);
        if (!item) {
            throw new Error('Categoría no encontrada');
        }

        const tieneImagen = item.imagenBase64 && item.imagenBase64.length > 0;

        Swal.fire({
            title: item.nombreCategoria,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: flex; justify-content: center; margin-bottom: var(--rsi-spacing-md);">
                        ${tieneImagen ? `
                            <img src="${item.imagenBase64}" alt="${item.nombreCategoria}" 
                                 style="max-width: 200px; max-height: 200px; object-fit: contain; border-radius: var(--rsi-radius-md);">
                        ` : `
                            <div style="width: 100px; height: 100px; background: var(--rsi-gray-200); border-radius: var(--rsi-radius-md); 
                                        display: flex; align-items: center; justify-content: center; color: var(--rsi-gray-500); font-size: 3rem;">
                                <i class="fas fa-tag"></i>
                            </div>
                        `}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 0; font-weight: 500;">${item.creadoPor || 'Sistema'}</p>
                            <p style="font-size: 0.85rem; color: var(--rsi-gray-500); margin: 0;">${formatDate(item.fechaCreacion)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Modificado por</span>
                            <p style="margin: 0; font-weight: 500;">${item.modificadoPor || 'Sistema'}</p>
                            <p style="font-size: 0.85rem; color: var(--rsi-gray-500); margin: 0;">${formatDate(item.fechaActualizacion)}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '550px'
        });

    } catch (error) {
        console.error('❌ Error viendo categoría:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cargar los detalles',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la edición de una categoría (redirige a vista de edición)
 */
async function handleEditCategoria(id) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/commercial/categoria/editar?id=${id}`);
        } else {
            window.location.href = `/commercial/categoria/editar?id=${id}`;
        }
    } catch (error) {
        console.error('❌ Error editando categoría:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar la categoría',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyCategoriasCrudController() {
    console.log('🧹 Destroying CategoriasCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    categoriasData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
}

export default categoriasCrudController;