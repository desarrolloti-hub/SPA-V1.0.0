/* ========================================
   CLIENTES CRUD CONTROLLER
   Controlador para listar y gestionar clientes
   ======================================== */

import ClienteService from '../../services/clienteService.js';

let service = null;
let eventListeners = [];
let clientesData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;
let usersCache = {}; // ✅ Cache de usuarios

/**
 * Inicializa el controlador CRUD de clientes
 */
export async function clientesCrudController() {
    console.log('📋 Clientes CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new ClienteService();
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    
    initDeleteCliente();
    initRefreshClientes();
    initPagination();
    initSearch();
    initClearSearch();
    
    await loadClientesTable();
    
    console.log('✅ Clientes CRUD Controller listo');
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchCliente');
    const searchBtn = document.getElementById('searchClienteBtn');
    
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
    const searchInput = document.getElementById('searchCliente');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadClientesTable();
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
    const searchInput = document.getElementById('searchCliente');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadClientesTable();
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
            await loadClientesTable();
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
                await loadClientesTable();
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
                await loadClientesTable();
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
 * Inicializa el refresco de clientes
 */
function initRefreshClientes() {
    const refreshBtn = document.getElementById('refreshClientes');
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
            
            const searchInput = document.getElementById('searchCliente');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            await loadClientesTable();
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
 * Inicializa las acciones de clientes
 */
function initDeleteCliente() {
    const tableBody = document.getElementById('clientesTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-cliente');
        if (toggleBtn) {
            const clienteId = toggleBtn.dataset.id;
            await handleToggleCliente(clienteId);
            return;
        }
        
        const deleteBtn = e.target.closest('.btn-delete-cliente');
        if (deleteBtn) {
            const clienteId = deleteBtn.dataset.id;
            await handleDeleteCliente(clienteId);
            return;
        }
        
        const validarBtn = e.target.closest('.btn-validar-sat');
        if (validarBtn) {
            const clienteId = validarBtn.dataset.id;
            await handleValidarSAT(clienteId);
            return;
        }
        
        const syncBtn = e.target.closest('.btn-sync-facturama');
        if (syncBtn) {
            const clienteId = syncBtn.dataset.id;
            await handleSyncFacturama(clienteId);
            return;
        }
        
        const viewBtn = e.target.closest('.btn-view-cliente');
        if (viewBtn) {
            const clienteId = viewBtn.dataset.id;
            handleViewCliente(clienteId);
            return;
        }
        
        const editBtn = e.target.closest('.btn-edit-cliente');
        if (editBtn) {
            const clienteId = editBtn.dataset.id;
            handleEditCliente(clienteId);
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * ✅ Obtiene el nombre de un usuario por su UID (con caché)
 */
async function getUserName(uid) {
    if (!uid) return 'Sistema';
    
    if (usersCache[uid]) {
        return usersCache[uid];
    }
    
    try {
        // ✅ Usar el servicio para obtener el nombre del usuario
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
 * Obtiene el badge de validación SAT
 */
function getValidacionBadge(validadoSAT) {
    if (validadoSAT) {
        return '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Validado</span>';
    }
    return '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-clock"></i> Pendiente</span>';
}

/**
 * Obtiene el badge de sincronización Facturama
 */
function getFacturamaBadge(sincronizadoFacturama) {
    if (sincronizadoFacturama) {
        return '<span class="rsi-badge rsi-badge-success"><i class="fas fa-cloud-upload-alt"></i> Sincronizado</span>';
    }
    return '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-cloud"></i> Pendiente</span>';
}

/**
 * Carga y muestra los clientes en la tabla
 */
async function loadClientesTable() {
    const tableBody = document.getElementById('clientesTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const clienteCount = document.getElementById('clienteCount');
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
        
        let clientes = await service.getAllClientes();
        
        // Filtrar por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            clientes = clientes.filter(cliente => {
                const razon = (cliente.razonSocial || '').toLowerCase();
                const rfc = (cliente.rfc || '').toLowerCase();
                return razon.includes(termLower) || rfc.includes(termLower);
            });
        }
        
        clientesData = clientes;
        totalItems = clientes.length;
        totalPages = Math.ceil(totalItems / pageSize);
        
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const paginatedClientes = clientes.slice(start, end);

        if (loadingState) loadingState.style.display = 'none';

        if (paginatedClientes.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay clientes registrados';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay clientes que coincidan con "${searchTerm}"` 
                        : 'Comienza registrando tu primer cliente.';
                }
                const emptyBtn = emptyState.querySelector('a');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (clienteCount) clienteCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (clienteCount) clienteCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        let rowsHtml = '';
        for (const cliente of paginatedClientes) {
            const isEnabled = cliente.status !== 'inactive';
            const isValidado = cliente.validadoSAT === true;
            const isSincronizado = cliente.sincronizadoFacturama === true;
            
            // ✅ Obtener nombres de los usuarios
            const creadoPorNombre = await getUserName(cliente.creadoPor);
            const modificadoPorNombre = await getUserName(cliente.modificadoPor || cliente.creadoPor);
            
            rowsHtml += `
                <tr>
                    <td data-label="Razón Social">
                        <span style="font-weight: 600;">${cliente.razonSocial || '-'}</span>
                    </td>
                    <td data-label="RFC">
                        <span style="font-family: monospace; font-size: 0.9rem;">${cliente.rfc || '-'}</span>
                    </td>
                    <td data-label="Email">
                        <span style="font-size: 0.85rem;">${cliente.email || '-'}</span>
                    </td>
                    <td data-label="Validación SAT">
                        ${getValidacionBadge(isValidado)}
                    </td>
                    <td data-label="Facturama">
                        ${getFacturamaBadge(isSincronizado)}
                    </td>
                    <td data-label="Estado">
                        <span class="rsi-badge ${isEnabled ? 'rsi-badge-success' : 'rsi-badge-danger'}">
                            ${isEnabled ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td data-label="Creado por">
                        <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                            ${creadoPorNombre}
                        </span>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-cliente" data-id="${cliente.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-cliente" data-id="${cliente.id}" title="Editar cliente">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon ${isValidado ? 'rsi-btn-icon-success' : 'rsi-btn-icon-warning'} btn-validar-sat" data-id="${cliente.id}" title="${isValidado ? 'Ya validado' : 'Validar contra SAT'}">
                                <i class="fas ${isValidado ? 'fa-check-circle' : 'fa-shield-alt'}"></i>
                            </button>
                            <button class="rsi-btn-icon ${isSincronizado ? 'rsi-btn-icon-success' : 'rsi-btn-icon-info'} btn-sync-facturama" data-id="${cliente.id}" title="${isSincronizado ? 'Ya sincronizado' : 'Sincronizar con Facturama'}">
                                <i class="fas ${isSincronizado ? 'fa-cloud' : 'fa-cloud-upload-alt'}"></i>
                            </button>
                            <button class="rsi-btn-icon ${isEnabled ? 'rsi-btn-icon-delete' : 'rsi-btn-icon-success'} btn-toggle-cliente" data-id="${cliente.id}" title="${isEnabled ? 'Deshabilitar' : 'Habilitar'}">
                                <i class="fas ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar los clientes: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la habilitación/deshabilitación de un cliente
 */
async function handleToggleCliente(clienteId) {
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return;

    const currentState = cliente.status !== 'inactive';
    const newState = !currentState;
    const action = newState ? 'habilitar' : 'deshabilitar';

    const result = await Swal.fire({
        title: `${newState ? 'Habilitar' : 'Deshabilitar'} cliente`,
        html: `
            <div style="text-align: left;">
                <p><strong>Cliente:</strong> ${cliente.razonSocial}</p>
                <p><strong>RFC:</strong> ${cliente.rfc}</p>
                <p style="color: var(--rsi-${newState ? 'success' : 'danger'});">
                    ¿Estás seguro de ${action} este cliente?
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
        await service.updateCliente(clienteId, { status: newStatus });
        
        Swal.fire({
            icon: 'success',
            title: `¡Cliente ${newState ? 'habilitado' : 'deshabilitado'}!`,
            text: `El cliente "${cliente.razonSocial}" ha sido ${newState ? 'habilitado' : 'deshabilitado'}.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadClientesTable();
    } catch (error) {
        console.error('❌ Error cambiando estado del cliente:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cambiar el estado del cliente',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la eliminación de un cliente (solo si está deshabilitado)
 */
async function handleDeleteCliente(clienteId) {
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return;

    const isEnabled = cliente.status !== 'inactive';
    
    if (isEnabled) {
        Swal.fire({
            icon: 'warning',
            title: 'Cliente activo',
            text: 'Debes deshabilitar el cliente antes de poder eliminarlo.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const result = await Swal.fire({
        title: '¿Eliminar cliente?',
        html: `
            <div style="text-align: left;">
                <p><strong>Cliente:</strong> ${cliente.razonSocial}</p>
                <p><strong>RFC:</strong> ${cliente.rfc}</p>
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
        await service.deleteClientePermanently(clienteId);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminado!',
            text: `El cliente "${cliente.razonSocial}" ha sido eliminado permanentemente.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadClientesTable();
    } catch (error) {
        console.error('❌ Error eliminando cliente:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar el cliente',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * ✅ Maneja la validación contra SAT (SOLO VALIDACIÓN)
 */
async function handleValidarSAT(clienteId) {
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return;

    // Si ya está validado
    if (cliente.validadoSAT) {
        Swal.fire({
            icon: 'info',
            title: 'Cliente ya validado',
            text: `El cliente "${cliente.razonSocial}" ya ha sido validado contra el SAT.`,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const result = await Swal.fire({
        title: 'Validar contra el SAT',
        html: `
            <div style="text-align: left;">
                <p><strong>Cliente:</strong> ${cliente.razonSocial}</p>
                <p><strong>RFC:</strong> ${cliente.rfc}</p>
                <p>¿Deseas validar este cliente contra el SAT?</p>
                <p style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                    <i class="fas fa-info-circle"></i> Se verificará que el RFC y la razón social coincidan.
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, validar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Validando...',
            text: 'Consultando el SAT, por favor espera.',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const respuesta = await service.validarClienteSAT(clienteId);

        Swal.close();

        if (respuesta.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Validación exitosa!',
                text: `El cliente "${cliente.razonSocial}" ha sido validado correctamente contra el SAT.`,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Validación fallida',
                text: respuesta.message || 'El RFC no es válido según el SAT.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#d33'
            });
        }
        
        await loadClientesTable();
    } catch (error) {
        Swal.close();
        console.error('❌ Error validando cliente SAT:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al validar el cliente contra el SAT',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * ✅ Sincroniza un cliente con Facturama (SOLO SICRONIZACIÓN)
 */
async function handleSyncFacturama(clienteId) {
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return;

    // Verificar si ya está sincronizado
    if (cliente.sincronizadoFacturama) {
        Swal.fire({
            icon: 'info',
            title: 'Ya sincronizado',
            text: `El cliente "${cliente.razonSocial}" ya está sincronizado con Facturama.`,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    // Verificar si está validado
    if (!cliente.validadoSAT) {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Cliente no validado',
            html: `
                <div style="text-align: left;">
                    <p><strong>Cliente:</strong> ${cliente.razonSocial}</p>
                    <p><strong>RFC:</strong> ${cliente.rfc}</p>
                    <p style="color: var(--rsi-warning);">⚠️ Este cliente aún no ha sido validado contra el SAT.</p>
                    <p>Se recomienda validar antes de sincronizar con Facturama.</p>
                    <p>¿Deseas continuar de todas formas?</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d'
        });

        if (!result.isConfirmed) return;
    }

    try {
        Swal.fire({
            title: 'Sincronizando...',
            text: 'Creando cliente en Facturama',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const respuesta = await service.crearClienteFacturama(clienteId);

        Swal.close();

        if (respuesta.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Cliente sincronizado!',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Cliente:</strong> ${cliente.razonSocial}</p>
                        <p><strong>RFC:</strong> ${cliente.rfc}</p>
                        <p style="color: var(--rsi-success);">✅ ${respuesta.message}</p>
                        ${respuesta.data?.Id ? `<p><strong>ID Facturama:</strong> ${respuesta.data.Id}</p>` : ''}
                    </div>
                `,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: respuesta.message || 'Error al sincronizar el cliente',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#d33'
            });
        }
        
        await loadClientesTable();
    } catch (error) {
        Swal.close();
        console.error('❌ Error sincronizando cliente:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al sincronizar el cliente con Facturama',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de un cliente
 */
async function handleViewCliente(clienteId) {
    try {
        const cliente = await service.getClienteById(clienteId);
        if (!cliente) {
            throw new Error('Cliente no encontrado');
        }

        const isValidado = cliente.validadoSAT === true;
        const isSincronizado = cliente.sincronizadoFacturama === true;
        const isEnabled = cliente.status !== 'inactive';
        
        // ✅ Obtener nombres de los usuarios
        const creadoPorNombre = await getUserName(cliente.creadoPor);
        const modificadoPorNombre = await getUserName(cliente.modificadoPor || cliente.creadoPor);

        Swal.fire({
            title: cliente.razonSocial,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">RFC</span>
                            <p style="font-weight: 600; margin: 0;">${cliente.rfc || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Razón Social</span>
                            <p style="font-weight: 600; margin: 0;">${cliente.razonSocial || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Nombre Comercial</span>
                            <p style="margin: 0;">${cliente.nombreComercial || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Régimen</span>
                            <p style="margin: 0;">${cliente.regimen || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Validación SAT</span>
                            <p style="margin: 0;">${isValidado ? '✅ Validado' : '⏳ Pendiente'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Facturama</span>
                            <p style="margin: 0;">${isSincronizado ? '✅ Sincronizado' : '⏳ Pendiente'}</p>
                        </div>
                        ${cliente.facturamaId ? `<div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">ID Facturama</span>
                            <p style="font-size: 0.85rem; font-family: monospace; margin: 0;">${cliente.facturamaId}</p>
                        </div>` : ''}
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
                            <p style="margin: 0;">${creadoPorNombre}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Modificado por</span>
                            <p style="margin: 0;">${modificadoPorNombre}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Fecha creación</span>
                            <p style="margin: 0;">${formatDate(cliente.createdAt)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Última modificación</span>
                            <p style="margin: 0;">${formatDate(cliente.updatedAt)}</p>
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                    <div>
                        <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Domicilio</span>
                        <p style="margin: 0;">${cliente.nombreVialidad || ''} ${cliente.numeroExterior || ''}${cliente.numeroInterior ? ' ' + cliente.numeroInterior : ''}</p>
                        <p style="margin: 0;">${cliente.colonia || ''}${cliente.codigoPostal ? ', CP ' + cliente.codigoPostal : ''}</p>
                        <p style="margin: 0;">${cliente.municipio || ''}${cliente.estado ? ', ' + cliente.estado : ''}</p>
                    </div>
                    <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Teléfono Móvil</span>
                            <p style="margin: 0;">${cliente.telefonoMovil || '-'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Email</span>
                            <p style="margin: 0;">${cliente.email || '-'}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '700px'
        });

    } catch (error) {
        console.error('❌ Error viendo cliente:', error);
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
 * Maneja la edición de un cliente
 */
async function handleEditCliente(clienteId) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/cliente?id=${clienteId}`);
        } else {
            window.location.href = `/partner/cliente?id=${clienteId}`;
        }
    } catch (error) {
        console.error('❌ Error editando cliente:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar el cliente',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyClientesCrudController() {
    console.log('🧹 Destroying ClientesCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    clientesData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
}

export default clientesCrudController;