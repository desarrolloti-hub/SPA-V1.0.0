/* ========================================
   AREA CRUD CONTROLLER
   Controlador para listar y gestionar áreas
   ======================================== */

import AreaService from '../../services/areaService.js';

let service = null;
let eventListeners = [];
let areasData = [];
let usersCache = {};
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;

/**
 * Inicializa el controlador CRUD de áreas
 */
export async function areaCrudController() {
    console.log('📋 Area CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new AreaService();
    usersCache = {};
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    
    initLoadAreas();
    initDeleteArea();
    initRefreshAreas();
    initPagination();
    initSearch();
    initClearSearch();
    
    await loadAreasTable();
    
    console.log('✅ Area CRUD Controller listo');
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchArea');
    const searchBtn = document.getElementById('searchAreaBtn');
    
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
    const searchInput = document.getElementById('searchArea');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadAreasTable();
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
    const searchInput = document.getElementById('searchArea');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadAreasTable();
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
            await loadAreasTable();
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
                await loadAreasTable();
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
                await loadAreasTable();
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
 * Inicializa la carga de áreas
 */
function initLoadAreas() {
    // La carga se hace en loadAreasTable()
}

/**
 * Inicializa el refresco de áreas
 */
function initRefreshAreas() {
    const refreshBtn = document.getElementById('refreshAreas');
    if (!refreshBtn) return;

    const handler = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            service.clearCache?.();
            usersCache = {};
            currentPage = 1;
            searchTerm = '';
            isSearching = false;
            
            const searchInput = document.getElementById('searchArea');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            await loadAreasTable();
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

/**
 * Inicializa la eliminación/habilitación de áreas (event delegation)
 */
function initDeleteArea() {
    const tableBody = document.getElementById('areasTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-area');
        if (toggleBtn) {
            const areaId = toggleBtn.dataset.id;
            await handleToggleArea(areaId);
            return;
        }
        
        const deleteBtn = e.target.closest('.btn-delete-area');
        if (deleteBtn) {
            const areaId = deleteBtn.dataset.id;
            await handleDeleteArea(areaId);
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * Obtiene el nombre de un usuario por su UID (con caché)
 */
async function getUserName(uid) {
    if (!uid) return 'Sistema';
    
    if (usersCache[uid]) {
        return usersCache[uid];
    }
    
    try {
        const name = await service.getUserName(uid);
        usersCache[uid] = name;
        return name;
    } catch (error) {
        console.error('❌ Error obteniendo usuario:', error);
        return 'Usuario desconocido';
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
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * 🔥 Carga y muestra las áreas en la tabla con paginación y búsqueda
 */
async function loadAreasTable() {
    const tableBody = document.getElementById('areasTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const areaCount = document.getElementById('areaCount');
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
        
        // 🔥 Obtener todas las áreas (con caché)
        let areas = await service.getAllAreas();
        
        // 🔥 Filtrar por búsqueda (en memoria)
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            areas = areas.filter(area => {
                const nombre = (area.nombreArea || '').toLowerCase();
                return nombre.includes(termLower);
            });
        }
        
        areasData = areas;
        totalItems = areas.length;
        totalPages = Math.ceil(totalItems / pageSize);
        
        // 🔥 Paginar en memoria
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const paginatedAreas = areas.slice(start, end);

        if (loadingState) loadingState.style.display = 'none';

        if (paginatedAreas.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay áreas registradas';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay áreas que coincidan con "${searchTerm}"` 
                        : 'Comienza creando tu primera área para organizar las subáreas y permisos del sistema.';
                }
                const emptyBtn = emptyState.querySelector('a');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (areaCount) areaCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (areaCount) areaCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        // 🔥 Construir filas con los datos paginados
        let rowsHtml = '';
        for (const area of paginatedAreas) {
            const isEnabled = area.habilitado !== false;
            const createdBy = await getUserName(area.modificadoPor);
            
            rowsHtml += `
                <tr>
                    <td data-label="Nombre">
                        <span style="font-weight: 600;">${area.nombreArea || '-'}</span>
                    </td>
                    <td data-label="Subáreas">
                        <span class="rsi-badge rsi-badge-primary">
                            ${Object.keys(area.subareas || {}).length}
                        </span>
                    </td>
                    <td data-label="Creado por">
                        <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                            ${createdBy}
                        </span>
                    </td>
                    <td data-label="Fecha">
                        <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                            ${formatDate(area.createdAt)}
                        </span>
                    </td>
                    <td data-label="Estado">
                        <span class="rsi-badge ${isEnabled ? 'rsi-badge-success' : 'rsi-badge-danger'}">
                            ${isEnabled ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-area" data-id="${area.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-area" data-id="${area.id}" title="Editar área">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon ${isEnabled ? 'rsi-btn-icon-delete' : 'rsi-btn-icon-success'} btn-toggle-area" data-id="${area.id}" title="${isEnabled ? 'Deshabilitar' : 'Habilitar'}">
                                <i class="fas ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        // Event listeners para ver detalles
        tableBody.querySelectorAll('.btn-view-area').forEach(btn => {
            btn.addEventListener('click', () => {
                const areaId = btn.dataset.id;
                handleViewArea(areaId);
            });
        });

        // Event listeners para editar
        tableBody.querySelectorAll('.btn-edit-area').forEach(btn => {
            btn.addEventListener('click', () => {
                const areaId = btn.dataset.id;
                handleEditArea(areaId);
            });
        });

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando áreas:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar las áreas: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Cuenta el total de módulos en todas las subáreas
 */
function countModulos(subareas) {
    if (!subareas) return 0;
    const subareaKeys = Object.keys(subareas);
    let total = 0;
    subareaKeys.forEach(key => {
        const subarea = subareas[key];
        if (subarea.modulos) {
            total += Object.keys(subarea.modulos).length;
        }
    });
    return total;
}

/**
 * Maneja la habilitación/deshabilitación de un área
 */
async function handleToggleArea(areaId) {
    const area = areasData.find(a => a.id === areaId);
    if (!area) return;

    const currentState = area.habilitado !== false;
    const newState = !currentState;
    const action = newState ? 'habilitar' : 'deshabilitar';

    const result = await Swal.fire({
        title: `${newState ? 'Habilitar' : 'Deshabilitar'} área`,
        html: `
            <div style="text-align: left;">
                <p><strong>Área:</strong> ${area.nombreArea}</p>
                <p><strong>Estado actual:</strong> ${currentState ? 'Activo' : 'Inactivo'}</p>
                <p style="color: var(--rsi-${newState ? 'success' : 'danger'});">
                    ¿Estás seguro de ${action} esta área?
                </p>
            </div>
        `,
        icon: newState ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonColor: newState ? '#28a745' : '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: `Sí, ${action}`,
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        await service.updateArea(areaId, { 
            habilitado: newState 
        });
        
        Swal.fire({
            icon: 'success',
            title: `¡Área ${newState ? 'habilitada' : 'deshabilitada'}!`,
            text: `El área "${area.nombreArea}" ha sido ${newState ? 'habilitada' : 'deshabilitada'}.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadAreasTable();
    } catch (error) {
        console.error('❌ Error cambiando estado del área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cambiar el estado del área',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la eliminación de un área (solo si está deshabilitada)
 */
async function handleDeleteArea(areaId) {
    const area = areasData.find(a => a.id === areaId);
    if (!area) return;

    const isEnabled = area.habilitado !== false;
    
    if (isEnabled) {
        Swal.fire({
            icon: 'warning',
            title: 'Área activa',
            text: 'Debes deshabilitar el área antes de poder eliminarla.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const result = await Swal.fire({
        title: '¿Eliminar área?',
        html: `
            <div style="text-align: left;">
                <p><strong>Área:</strong> ${area.nombreArea}</p>
                <p><strong>Subáreas:</strong> ${Object.keys(area.subareas || {}).length}</p>
                <p style="color: var(--rsi-danger);">Esta acción no se puede deshacer.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar permanentemente',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        await service.deleteArea(areaId);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminada!',
            text: `El área "${area.nombreArea}" ha sido eliminada permanentemente.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadAreasTable();
    } catch (error) {
        console.error('❌ Error eliminando área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar el área',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de un área
 */
async function handleViewArea(areaId) {
    try {
        const area = await service.getAreaById(areaId);
        if (!area) {
            throw new Error('Área no encontrada');
        }

        const subareas = area.subareas || {};
        const subareaKeys = Object.keys(subareas);
        const createdBy = await getUserName(area.modificadoPor);
        const isEnabled = area.habilitado !== false;
        
        let subareasHtml = '';
        if (subareaKeys.length === 0) {
            subareasHtml = '<p style="color: var(--rsi-gray-500);">No hay subáreas</p>';
        } else {
            subareasHtml = subareaKeys.map(key => {
                const s = subareas[key];
                const modulos = s.modulos || {};
                const modulosKeys = Object.keys(modulos);
                const modulosHtml = modulosKeys.map(mk => {
                    const m = modulos[mk];
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                            <span style="font-weight: 500;">${m.nombreModulo}</span>
                            <div>
                                ${(m.permisos?.permiso || []).map(p => 
                                    `<span class="rsi-tag" style="margin: 0 2px;">${p}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                }).join('');
                
                return `
                    <div style="background: var(--rsi-gray-50); padding: var(--rsi-spacing-md); border-radius: var(--rsi-radius-md); margin-bottom: var(--rsi-spacing-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--rsi-spacing-sm);">
                            <strong style="color: var(--rsi-text-primary);">${s.nombreSubarea}</strong>
                            <span class="rsi-badge rsi-badge-primary">${modulosKeys.length} módulos</span>
                        </div>
                        ${modulosHtml || '<p style="color: var(--rsi-gray-500); font-size: 0.9rem;">Sin módulos</p>'}
                    </div>
                `;
            }).join('');
        }

        Swal.fire({
            title: area.nombreArea,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: flex; gap: var(--rsi-spacing-md); margin-bottom: var(--rsi-spacing-md); flex-wrap: wrap;">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">ID</span>
                            <p style="font-size: 0.85rem; font-family: monospace; margin: 0;">${area.id}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Subáreas</span>
                            <p style="font-weight: 600; margin: 0;">${subareaKeys.length}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Módulos</span>
                            <p style="font-weight: 600; margin: 0;">${countModulos(subareas)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Estado</span>
                            <p style="margin: 0;">
                                <span class="rsi-badge ${isEnabled ? 'rsi-badge-success' : 'rsi-badge-danger'}">
                                    ${isEnabled ? 'Activo' : 'Inactivo'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 0;">${createdBy}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Fecha</span>
                            <p style="margin: 0;">${formatDate(area.createdAt)}</p>
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                    <h4 style="margin: 0 0 var(--rsi-spacing-sm) 0; color: var(--rsi-text-primary);">Subáreas</h4>
                    ${subareasHtml}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '700px'
        });

    } catch (error) {
        console.error('❌ Error viendo área:', error);
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
 * Maneja la edición de un área
 */
async function handleEditArea(areaId) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/area?id=${areaId}`);
        } else {
            window.location.href = `/partner/area?id=${areaId}`;
        }
    } catch (error) {
        console.error('❌ Error editando área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar el área',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyAreaCrudController() {
    console.log('🧹 Destroying AreaCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    areasData = [];
    usersCache = {};
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
}

export default areaCrudController;