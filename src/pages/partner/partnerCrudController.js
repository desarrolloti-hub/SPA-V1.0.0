/* ========================================
   PARTNER CRUD CONTROLLER
   Controlador con buscador, paginación y estadísticas
   ======================================== */

import NewCollaboratorService from '../../services/partnerService.js';

let service = null;
let eventListeners = [];
let collaboratorsData = [];
let usersCache = {};
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;

/**
 * Inicializa el controlador CRUD de colaboradores
 */
export async function partnerCrudController() {
    console.log('👥 Partner CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new NewCollaboratorService();
    usersCache = {};
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    
    initLoadCollaborators();
    initDeleteCollaborator();
    initRefreshCollaborators();
    initPagination();
    initSearch();
    initClearSearch();
    
    await loadCollaboratorsTable();
    await loadStats();
    
    console.log('✅ Partner CRUD Controller listo');
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchPartner');
    const searchBtn = document.getElementById('searchPartnerBtn');
    
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
    const searchInput = document.getElementById('searchPartner');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadCollaboratorsTable();
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
    const searchInput = document.getElementById('searchPartner');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadCollaboratorsTable();
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
            await loadCollaboratorsTable();
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
                await loadCollaboratorsTable();
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
                await loadCollaboratorsTable();
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
 * Inicializa la carga de colaboradores
 */
function initLoadCollaborators() {
    // La carga se hace en loadCollaboratorsTable()
}

/**
 * 🔥 Inicializa el refresco de colaboradores (SIN SweetAlert)
 */
function initRefreshCollaborators() {
    const refreshBtn = document.getElementById('refreshPartners');
    if (!refreshBtn) return;

    const handler = async () => {
        // Deshabilitar botón y mostrar spinner
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            // Limpiar caché del servicio
            service.clearCache();
            // Limpiar caché de usuarios
            usersCache = {};
            // Resetear paginación
            currentPage = 1;
            
            // Recargar datos
            await loadCollaboratorsTable(true);
            await loadStats();
            updateSearchInfo();
            
            // ✅ Feedback visual solo con el icono (cambio de color temporal)
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
            // Restaurar botón
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        }
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
}

/**
 * Inicializa las acciones de colaboradores
 */
function initDeleteCollaborator() {
    const tableBody = document.getElementById('partnersTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-partner');
        if (toggleBtn) {
            const docId = toggleBtn.dataset.id;
            await handleToggleCollaborator(docId);
            return;
        }
        
        const deleteBtn = e.target.closest('.btn-delete-partner');
        if (deleteBtn) {
            const docId = deleteBtn.dataset.id;
            await handleDeleteCollaborator(docId);
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
 * Obtiene el estado de verificación de email
 */
function getEmailVerifiedBadge(emailVerified) {
    if (emailVerified === true) {
        return '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Verificado</span>';
    }
    return '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-clock"></i> Pendiente</span>';
}

/**
 * Carga las estadísticas
 */
async function loadStats() {
    try {
        const stats = await service.getCollaboratorStats();
        const statsContainer = document.getElementById('partnerStats');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="rsi-stat-item">
                <span class="rsi-stat-value">${stats.total}</span>
                <span class="rsi-stat-label">Total</span>
            </div>
            <div class="rsi-stat-item">
                <span class="rsi-stat-value" style="color: var(--rsi-success);">${stats.active}</span>
                <span class="rsi-stat-label">Activos</span>
            </div>
            <div class="rsi-stat-item">
                <span class="rsi-stat-value" style="color: var(--rsi-danger);">${stats.inactive}</span>
                <span class="rsi-stat-label">Inactivos</span>
            </div>
            <div class="rsi-stat-item">
                <span class="rsi-stat-value" style="color: var(--rsi-info);">${stats.verified}</span>
                <span class="rsi-stat-label">Verificados</span>
            </div>
        `;
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

/**
 * Carga y muestra los colaboradores en la tabla con paginación
 */
async function loadCollaboratorsTable(forceRefresh = false) {
    const tableBody = document.getElementById('partnersTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const partnerCount = document.getElementById('partnerCount');
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
        
        let result;
        
        if (isSearching && searchTerm.length > 0) {
            result = await service.getCollaboratorsPaginated(pageSize, currentPage, searchTerm);
        } else {
            result = await service.getCollaboratorsPaginated(pageSize, currentPage);
        }
        
        collaboratorsData = result.data || [];
        totalItems = result.total || collaboratorsData.length;
        totalPages = result.totalPages || Math.ceil(totalItems / pageSize);

        if (loadingState) loadingState.style.display = 'none';

        if (collaboratorsData.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay colaboradores registrados';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay colaboradores que coincidan con "${searchTerm}"` 
                        : 'Comienza registrando tu primer colaborador en el sistema.';
                }
                const emptyBtn = emptyState.querySelector('a');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (partnerCount) partnerCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (partnerCount) partnerCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        let rowsHtml = '';
        for (const collab of collaboratorsData) {
            const isEnabled = collab.status !== 'inactive';
            const createdBy = await getUserName(collab.creadoPor);
            const areaName = collab.areaNombre || collab.area || '-';
            const subareaName = collab.subareaNombre || collab.subarea || '-';
            
            rowsHtml += `
                <tr>
                    <td data-label="Nombre">
                        <div style="display: flex; align-items: center; gap: var(--rsi-spacing-sm);">
                            <img src="${collab.fotoPerfil && collab.fotoPerfil.startsWith('data:image') ? collab.fotoPerfil : '/assets/images/default-avatar.png'}" 
                                 alt="${collab.nombreCompleto}" 
                                 style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--rsi-gray-200);">
                            <span style="font-weight: 600;">${collab.nombreCompleto || '-'}</span>
                        </div>
                    </td>
                    <td data-label="Correo">
                        <span style="font-size: 0.85rem;">${collab.emailEmpresarial || '-'}</span>
                    </td>
                    <td data-label="Área">
                        <span style="font-size: 0.85rem;">${areaName}</span>
                    </td>
                    <td data-label="Subárea">
                        <span style="font-size: 0.85rem;">${subareaName}</span>
                    </td>
                    <td data-label="Verificado">
                        ${getEmailVerifiedBadge(collab.emailVerified)}
                    </td>
                    <td data-label="Estado">
                        <span class="rsi-badge ${isEnabled ? 'rsi-badge-success' : 'rsi-badge-danger'}">
                            ${isEnabled ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-partner" data-id="${collab.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-partner" data-id="${collab.id}" title="Editar colaborador">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon ${isEnabled ? 'rsi-btn-icon-delete' : 'rsi-btn-icon-success'} btn-toggle-partner" data-id="${collab.id}" title="${isEnabled ? 'Deshabilitar' : 'Habilitar'}">
                                <i class="fas ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        tableBody.querySelectorAll('.btn-view-partner').forEach(btn => {
            btn.addEventListener('click', () => {
                const docId = btn.dataset.id;
                handleViewCollaborator(docId);
            });
        });

        tableBody.querySelectorAll('.btn-edit-partner').forEach(btn => {
            btn.addEventListener('click', () => {
                const docId = btn.dataset.id;
                handleEditCollaborator(docId);
            });
        });

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando colaboradores:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar los colaboradores: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la habilitación/deshabilitación de un colaborador
 */
async function handleToggleCollaborator(docId) {
    const collab = collaboratorsData.find(c => c.id === docId);
    if (!collab) return;

    const currentState = collab.status !== 'inactive';
    const newState = !currentState;
    const action = newState ? 'habilitar' : 'deshabilitar';

    const result = await Swal.fire({
        title: `${newState ? 'Habilitar' : 'Deshabilitar'} colaborador`,
        html: `
            <div style="text-align: left;">
                <p><strong>Colaborador:</strong> ${collab.nombreCompleto}</p>
                <p><strong>Estado actual:</strong> ${currentState ? 'Activo' : 'Inactivo'}</p>
                <p style="color: var(--rsi-${newState ? 'success' : 'danger'});">
                    ¿Estás seguro de ${action} este colaborador?
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
        const newStatus = newState ? 'active' : 'inactive';
        await service.updateCollaborator(docId, { status: newStatus });
        
        Swal.fire({
            icon: 'success',
            title: `¡Colaborador ${newState ? 'habilitado' : 'deshabilitado'}!`,
            text: `El colaborador "${collab.nombreCompleto}" ha sido ${newState ? 'habilitado' : 'deshabilitado'}.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadCollaboratorsTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error cambiando estado del colaborador:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cambiar el estado del colaborador',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la eliminación de un colaborador (solo si está deshabilitado)
 */
async function handleDeleteCollaborator(docId) {
    const collab = collaboratorsData.find(c => c.id === docId);
    if (!collab) return;

    const isEnabled = collab.status !== 'inactive';
    
    if (isEnabled) {
        Swal.fire({
            icon: 'warning',
            title: 'Colaborador activo',
            text: 'Debes deshabilitar el colaborador antes de poder eliminarlo.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const result = await Swal.fire({
        title: '¿Eliminar colaborador?',
        html: `
            <div style="text-align: left;">
                <p><strong>Colaborador:</strong> ${collab.nombreCompleto}</p>
                <p><strong>Correo:</strong> ${collab.emailEmpresarial}</p>
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
        await service.deleteCollaboratorPermanently(docId);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminado!',
            text: `El colaborador "${collab.nombreCompleto}" ha sido eliminado permanentemente.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadCollaboratorsTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error eliminando colaborador:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar el colaborador',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de un colaborador
 */
async function handleViewCollaborator(docId) {
    try {
        const collab = await service.getCollaboratorById(docId);
        if (!collab) {
            throw new Error('Colaborador no encontrado');
        }

        const createdBy = await getUserName(collab.creadoPor);
        const isEnabled = collab.status !== 'inactive';
        const areaName = collab.areaNombre || collab.area || '-';
        const subareaName = collab.subareaNombre || collab.subarea || '-';

        Swal.fire({
            title: collab.nombreCompleto,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: flex; gap: var(--rsi-spacing-md); margin-bottom: var(--rsi-spacing-md); flex-wrap: wrap;">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">ID</span>
                            <p style="font-size: 0.85rem; font-family: monospace; margin: 0;">${collab.id}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">UID</span>
                            <p style="font-size: 0.85rem; font-family: monospace; margin: 0;">${collab.uid}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Correo</span>
                            <p style="margin: 0;">${collab.emailEmpresarial}</p>
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
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Verificado</span>
                            <p style="margin: 0;">${collab.emailVerified ? '✅ Sí' : '❌ No'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Área</span>
                            <p style="margin: 0;">${areaName}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Subárea</span>
                            <p style="margin: 0;">${subareaName}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Tipo</span>
                            <p style="margin: 0;">${collab.tipoColaborador || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 0;">${createdBy}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Fecha</span>
                            <p style="margin: 0;">${formatDate(collab.createdAt)}</p>
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">CURP</span>
                            <p style="font-weight: 500; margin: 0;">${collab.curp || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">RFC</span>
                            <p style="font-weight: 500; margin: 0;">${collab.rfc || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Teléfono móvil</span>
                            <p style="font-weight: 500; margin: 0;">${collab.telefonoMovil || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">NIT</span>
                            <p style="font-weight: 500; margin: 0;">${collab.nit || '-'}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '750px'
        });

    } catch (error) {
        console.error('❌ Error viendo colaborador:', error);
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
 * Maneja la edición de un colaborador
 */
async function handleEditCollaborator(docId) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/partner?id=${docId}`);
        } else {
            window.location.href = `/partner/partner?id=${docId}`;
        }
    } catch (error) {
        console.error('❌ Error editando colaborador:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar el colaborador',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyPartnerCrudController() {
    console.log('🧹 Destroying PartnerCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    collaboratorsData = [];
    usersCache = {};
}

export default partnerCrudController;