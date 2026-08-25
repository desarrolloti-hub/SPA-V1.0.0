/* ========================================
   PRODUCTOS/SERVICIOS CRUD CONTROLLER
   Controlador para listar y gestionar productos y servicios
   ======================================== */

import ProductoServicioService from '../../services/productoServicioService.js';
import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';

let service = null;
let categoriaService = null;
let eventListeners = [];
let productosData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;
let categoriasCache = {};

/**
 * Inicializa el controlador CRUD de productos/servicios
 */
export async function productosServiciosCrudController() {
    console.log('📋 Productos/Servicios CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new ProductoServicioService();
    categoriaService = new CategoriaProductoServicioService();
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    categoriasCache = {};
    
    initProductosServiciosEvents();
    initPagination();
    initSearch();
    initClearSearch();
    initRefresh();
    
    // Cargar caché de categorías
    await loadCategoriasCache();
    
    await loadProductosServiciosTable();
    await loadStats();
    
    console.log('✅ Productos/Servicios CRUD Controller listo');
}

/**
 * Carga el caché de categorías para mostrar nombres
 */
async function loadCategoriasCache() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasCache = {};
        categorias.forEach(cat => {
            categoriasCache[cat.id] = cat.nombreCategoria;
        });
        console.log(`✅ Caché de categorías cargado: ${Object.keys(categoriasCache).length} categorías`);
    } catch (error) {
        console.error('❌ Error cargando caché de categorías:', error);
        categoriasCache = {};
    }
}

/**
 * Obtiene el nombre de una categoría por su ID
 */
function getCategoriaNombre(categoriaId) {
    if (!categoriaId) return 'Sin categoría';
    return categoriasCache[categoriaId] || 'Sin categoría';
}

/**
 * Inicializa los eventos principales
 */
function initProductosServiciosEvents() {
    const tableBody = document.getElementById('productosTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        // ✅ BOTÓN VER - Redirige a la vista de detalle
        const viewBtn = e.target.closest('.btn-view-producto');
        if (viewBtn) {
            const id = viewBtn.dataset.id;
            handleViewProducto(id);
            return;
        }
        
        // ✅ BOTÓN EDITAR - Redirige a la vista de edición
        const editBtn = e.target.closest('.btn-edit-producto');
        if (editBtn) {
            const id = editBtn.dataset.id;
            handleEditProducto(id);
            return;
        }
        
        // ✅ BOTÓN ELIMINAR
        const deleteBtn = e.target.closest('.btn-delete-producto');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            await handleDeleteProducto(id);
            return;
        }
        
        // ✅ BOTÓN TOGGLE (Activar/Desactivar)
        const toggleBtn = e.target.closest('.btn-toggle-producto');
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const currentState = toggleBtn.dataset.activo === 'true';
            await handleToggleActivo(id, !currentState);
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * ✅ Maneja la visualización del producto
 */
function handleViewProducto(id) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/productoServicioView?id=${id}`);
        } else {
            window.location.href = `/partner/productoServicioView?id=${id}`;
        }
    } catch (error) {
        console.error('❌ Error viendo producto:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al ver el producto',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * ✅ Maneja la edición del producto
 */
function handleEditProducto(id) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/productosServicios?id=${id}`);
        } else {
            window.location.href = `/partner/productosServicios?id=${id}`;
        }
    } catch (error) {
        console.error('❌ Error editando producto:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar el producto',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchProducto');
    const searchBtn = document.getElementById('searchProductoBtn');
    
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
    const searchInput = document.getElementById('searchProducto');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadProductosServiciosTable();
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
    const searchInput = document.getElementById('searchProducto');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadProductosServiciosTable();
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
            await loadProductosServiciosTable();
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
                await loadProductosServiciosTable();
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
                await loadProductosServiciosTable();
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
    const refreshBtn = document.getElementById('refreshProductos');
    if (!refreshBtn) return;

    const handler = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            service.clearCache?.();
            currentPage = 1;
            searchTerm = '';
            isSearching = false;
            
            const searchInput = document.getElementById('searchProducto');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            // Recargar caché de categorías
            await loadCategoriasCache();
            
            await loadProductosServiciosTable();
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
 * Formatea moneda
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
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
 * Obtiene el badge de estado
 */
function getEstadoBadge(activo) {
    if (activo !== false) {
        return `<span class="rsi-badge-status activo">
            <i class="fas fa-check-circle"></i>
            Activo
        </span>`;
    } else {
        return `<span class="rsi-badge-status inactivo">
            <i class="fas fa-times-circle"></i>
            Inactivo
        </span>`;
    }
}

/**
 * Carga las estadísticas
 */
async function loadStats() {
    try {
        const stats = await service.getProductoServicioStats();
        
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statActivos').textContent = stats.activos;
        document.getElementById('statInactivos').textContent = stats.inactivos;
        document.getElementById('statTotalPrecio').textContent = formatCurrency(stats.totalPrecio);
        document.getElementById('statPromedioPrecio').textContent = formatCurrency(stats.promedioPrecio);
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

/**
 * Carga y muestra los productos en la tabla
 */
async function loadProductosServiciosTable() {
    const tableBody = document.getElementById('productosTableBody');
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
        
        let items = await service.getAllProductosServicios();
        
        // Filtrar por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            items = items.filter(item => {
                const nombre = (item.nombre || '').toLowerCase();
                const categoria = getCategoriaNombre(item.categoriaId).toLowerCase();
                return nombre.includes(termLower) || categoria.includes(termLower);
            });
        }
        
        productosData = items;
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
                        : 'No hay productos o servicios registrados';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay productos que coincidan con "${searchTerm}"` 
                        : 'Comienza agregando tu primer producto o servicio.';
                }
                const emptyBtn = emptyState.querySelector('a');
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
            const nombreCorto = item.nombre.length > 50 ? item.nombre.substring(0, 50) + '...' : item.nombre;
            const nombreCategoria = getCategoriaNombre(item.categoriaId);
            
            // Mostrar imagen si existe (miniatura)
            const hasImage = item.imagenBase64 && item.imagenBase64.length > 0;
            const imagenHtml = hasImage 
                ? `<img src="${item.imagenBase64}" alt="${item.nombre}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px;">`
                : `<div style="width: 30px; height: 30px; background: var(--rsi-gray-200); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--rsi-gray-400);"><i class="fas fa-image"></i></div>`;
            
            rowsHtml += `
                <tr>
                    <td data-label="Imagen">
                        ${imagenHtml}
                    </td>
                    <td data-label="Nombre">
                        <div class="rsi-descripcion-container">
                            <span class="rsi-descripcion-texto" style="color: var(--rsi-text);">${nombreCorto}</span>
                            ${item.nombre.length > 50 ? `<div class="rsi-descripcion-tooltip">${item.nombre}</div>` : ''}
                        </div>
                    </td>
                    <td data-label="Precio">
                        <span style="font-weight: 700; color: var(--rsi-primary);">
                            ${formatCurrency(item.precioUnitario)}
                        </span>
                    </td>
                    <td data-label="Categoría">
                        <span class="rsi-badge rsi-badge-secondary" style="font-size: 0.75rem;">
                            ${nombreCategoria}
                        </span>
                    </td>
                    <td data-label="Estado">
                        ${getEstadoBadge(item.activo)}
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
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-producto" data-id="${item.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-producto" data-id="${item.id}" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-toggle btn-toggle-producto" 
                                    data-id="${item.id}" 
                                    data-activo="${item.activo !== false}"
                                    title="${item.activo !== false ? 'Desactivar' : 'Activar'}">
                                <i class="fas ${item.activo !== false ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-delete btn-delete-producto" data-id="${item.id}" title="Eliminar">
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
        console.error('❌ Error cargando productos:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al cargar los productos: ' + error.message,
                confirmButtonText: 'Reintentar',
                confirmButtonColor: '#d33'
            });
        }
    }
}

/**
 * Maneja la eliminación de un producto
 */
async function handleDeleteProducto(id) {
    const item = productosData.find(p => p.id === id);
    if (!item) return;

    const result = await Swal.fire({
        title: '¿Eliminar producto/servicio?',
        html: `
            <div style="text-align: left;">
                <p><strong>Nombre:</strong> ${item.nombre}</p>
                <p><strong>Precio:</strong> ${formatCurrency(item.precioUnitario)}</p>
                <p><strong>Categoría:</strong> ${getCategoriaNombre(item.categoriaId)}</p>
                <p style="color: var(--rsi-danger); margin-top: var(--rsi-spacing-md);">
                    ⚠️ Esta acción no se puede deshacer.
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
        await service.deleteProductoServicio(id);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminado!',
            text: `"${item.nombre}" ha sido eliminado.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadProductosServiciosTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error eliminando producto:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar el producto',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja el cambio de estado activo/inactivo
 */
async function handleToggleActivo(id, nuevoEstado) {
    try {
        await service.toggleActivo(id, nuevoEstado);
        
        mostrarAlerta(
            `Producto ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`,
            'success'
        );
        
        await loadProductosServiciosTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error cambiando estado:', error);
        mostrarAlerta('Error al cambiar el estado: ' + error.message, 'error');
    }
}

/**
 * Limpia eventos
 */
export function destroyProductosServiciosCrudController() {
    console.log('🧹 Destroying ProductosServiciosCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    categoriaService = null;
    productosData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    categoriasCache = {};
}

export default productosServiciosCrudController;