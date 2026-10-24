/* ========================================
   CATEGORÍAS CRUD CONTROLLER
   Controlador para listar y gestionar categorías de productos/servicios en Finanzas
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
let currentImageBase64 = '';

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
    currentImageBase64 = '';
    
    initCategoriasEvents();
    initModalEvents();
    initPagination();
    initSearch();
    initClearSearch();
    initRefresh();
    
    await loadCategoriasTable();
    await loadStats();
    
    console.log('✅ Categorías CRUD Controller listo');
}

/**
 * Inicializa los eventos de la tabla
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
            openModalEditar(id);
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
 * Inicializa los eventos del Modal (Crear / Editar)
 */
function initModalEvents() {
    const btnNueva = document.getElementById('btnNuevaCategoria');
    const btnEmptyCrear = document.getElementById('btnEmptyCrearCategoria');
    const modal = document.getElementById('modalCategoria');
    const btnCerrar = document.getElementById('btnCerrarModalCategoria');
    const btnCancelar = document.getElementById('btnCancelarModalCategoria');
    const form = document.getElementById('formCategoria');
    const btnSubirImg = document.getElementById('btnSeleccionarImagen');
    const inputImg = document.getElementById('imagenCategoriaInput');
    const btnQuitarImg = document.getElementById('btnQuitarImagen');

    if (btnNueva) {
        btnNueva.addEventListener('click', openModalCrear);
        eventListeners.push({ element: btnNueva, event: 'click', handler: openModalCrear });
    }

    if (btnEmptyCrear) {
        btnEmptyCrear.addEventListener('click', openModalCrear);
        eventListeners.push({ element: btnEmptyCrear, event: 'click', handler: openModalCrear });
    }

    if (btnCerrar) {
        btnCerrar.addEventListener('click', closeModal);
        eventListeners.push({ element: btnCerrar, event: 'click', handler: closeModal });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', closeModal);
        eventListeners.push({ element: btnCancelar, event: 'click', handler: closeModal });
    }

    if (modal) {
        const modalBackdropHandler = (e) => {
            if (e.target === modal) closeModal();
        };
        modal.addEventListener('click', modalBackdropHandler);
        eventListeners.push({ element: modal, event: 'click', handler: modalBackdropHandler });
    }

    if (btnSubirImg && inputImg) {
        const triggerInput = () => inputImg.click();
        btnSubirImg.addEventListener('click', triggerInput);
        eventListeners.push({ element: btnSubirImg, event: 'click', handler: triggerInput });

        const handleImageChange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.size > 1024 * 1024) {
                mostrarAlerta('La imagen no debe superar 1 MB', 'warning');
                inputImg.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImageBase64 = event.target.result;
                updateImagePreview(currentImageBase64);
            };
            reader.readAsDataURL(file);
        };
        inputImg.addEventListener('change', handleImageChange);
        eventListeners.push({ element: inputImg, event: 'change', handler: handleImageChange });
    }

    if (btnQuitarImg) {
        const handleQuitar = () => {
            currentImageBase64 = '';
            if (inputImg) inputImg.value = '';
            updateImagePreview('');
        };
        btnQuitarImg.addEventListener('click', handleQuitar);
        eventListeners.push({ element: btnQuitarImg, event: 'click', handler: handleQuitar });
    }

    if (form) {
        form.addEventListener('submit', handleGuardarCategoria);
        eventListeners.push({ element: form, event: 'submit', handler: handleGuardarCategoria });
    }
}

/**
 * Actualiza la vista previa de la imagen
 */
function updateImagePreview(base64) {
    const previewImg = document.getElementById('previewCategoriaImg');
    const defaultIcon = document.getElementById('previewCategoriaIconDefault');
    const btnQuitar = document.getElementById('btnQuitarImagen');

    if (!previewImg || !defaultIcon) return;

    if (base64 && base64.trim().length > 0) {
        previewImg.src = base64;
        previewImg.style.display = 'block';
        defaultIcon.style.display = 'none';
        if (btnQuitar) btnQuitar.style.display = 'inline-flex';
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        defaultIcon.style.display = 'block';
        if (btnQuitar) btnQuitar.style.display = 'none';
    }
}

/**
 * Abre el modal en modo Creación
 */
function openModalCrear() {
    const modal = document.getElementById('modalCategoria');
    const title = document.getElementById('modalCategoriaTitle');
    const idInput = document.getElementById('categoriaIdInput');
    const nombreInput = document.getElementById('nombreCategoriaInput');
    const errorMsg = document.getElementById('errorNombreCategoria');
    const inputImg = document.getElementById('imagenCategoriaInput');

    if (!modal) return;

    if (title) title.innerHTML = '<i class="fas fa-plus-circle" style="color: var(--rsi-primary);"></i> <span>Nueva Categoría</span>';
    if (idInput) idInput.value = '';
    if (nombreInput) {
        nombreInput.value = '';
        nombreInput.classList.remove('input-error');
    }
    if (errorMsg) errorMsg.style.display = 'none';
    if (inputImg) inputImg.value = '';
    
    currentImageBase64 = '';
    updateImagePreview('');

    modal.style.display = 'flex';
    setTimeout(() => nombreInput?.focus(), 100);
}

/**
 * Abre el modal en modo Edición
 */
async function openModalEditar(id) {
    const modal = document.getElementById('modalCategoria');
    const title = document.getElementById('modalCategoriaTitle');
    const idInput = document.getElementById('categoriaIdInput');
    const nombreInput = document.getElementById('nombreCategoriaInput');
    const errorMsg = document.getElementById('errorNombreCategoria');
    const inputImg = document.getElementById('imagenCategoriaInput');

    if (!modal) return;

    const item = categoriasData.find(c => c.id === id);
    if (!item) {
        mostrarAlerta('No se encontró la categoría seleccionada', 'error');
        return;
    }

    if (title) title.innerHTML = '<i class="fas fa-edit" style="color: var(--rsi-primary);"></i> <span>Editar Categoría</span>';
    if (idInput) idInput.value = item.id;
    if (nombreInput) {
        nombreInput.value = item.nombreCategoria || '';
        nombreInput.classList.remove('input-error');
    }
    if (errorMsg) errorMsg.style.display = 'none';
    if (inputImg) inputImg.value = '';

    currentImageBase64 = item.imagenBase64 || '';
    updateImagePreview(currentImageBase64);

    modal.style.display = 'flex';
    setTimeout(() => nombreInput?.focus(), 100);
}

/**
 * Cierra el modal
 */
function closeModal() {
    const modal = document.getElementById('modalCategoria');
    if (modal) modal.style.display = 'none';

    const idInput = document.getElementById('categoriaIdInput');
    const nombreInput = document.getElementById('nombreCategoriaInput');
    const errorMsg = document.getElementById('errorNombreCategoria');
    const inputImg = document.getElementById('imagenCategoriaInput');

    if (idInput) idInput.value = '';
    if (nombreInput) {
        nombreInput.value = '';
        nombreInput.classList.remove('input-error');
    }
    if (errorMsg) errorMsg.style.display = 'none';
    if (inputImg) inputImg.value = '';
    currentImageBase64 = '';
    updateImagePreview('');
}

/**
 * Procesa el guardado de la categoría (Creación o Edición)
 */
async function handleGuardarCategoria(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idInput = document.getElementById('categoriaIdInput');
    const nombreInput = document.getElementById('nombreCategoriaInput');
    const errorMsg = document.getElementById('errorNombreCategoria');
    const submitBtn = document.getElementById('btnGuardarCategoria');

    const id = idInput?.value?.trim() || '';
    const nombre = nombreInput?.value?.trim() || '';

    if (!nombre) {
        if (errorMsg) {
            errorMsg.textContent = 'El nombre de la categoría es obligatorio';
            errorMsg.style.display = 'block';
        }
        if (nombreInput) nombreInput.classList.add('input-error');
        nombreInput?.focus();
        return;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    if (nombreInput) nombreInput.classList.remove('input-error');

    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
        const payload = {
            nombreCategoria: nombre,
            imagenBase64: currentImageBase64 || ''
        };

        if (id) {
            // Edición
            await service.updateCategoria(id, payload);
            mostrarAlerta('Categoría actualizada con éxito', 'success');
        } else {
            // Creación
            await service.createCategoria(payload);
            mostrarAlerta('Categoría creada con éxito', 'success');
        }

        closeModal();
        await loadCategoriasTable();
        await loadStats();

    } catch (error) {
        console.error('❌ Error guardando categoría:', error);
        mostrarAlerta(error.message || 'Error al guardar la categoría', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
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
    
    const clearAction = async () => {
        if (searchInput) {
            searchInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';
        }
        searchTerm = '';
        isSearching = false;
        currentPage = 1;
        await loadCategoriasTable();
        await loadStats();
        updateSearchInfo();
    };

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAction);
        eventListeners.push({ element: clearBtn, event: 'click', handler: clearAction });
    }
    
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', clearAction);
        eventListeners.push({ element: clearResultsBtn, event: 'click', handler: clearAction });
    }
}

/**
 * Inicializa la paginación
 */
function initPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        const prevHandler = async () => {
            if (currentPage > 1) {
                currentPage--;
                await loadCategoriasTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        };
        prevBtn.addEventListener('click', prevHandler);
        eventListeners.push({ element: prevBtn, event: 'click', handler: prevHandler });
    }
    
    if (nextBtn) {
        const nextHandler = async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await loadCategoriasTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        };
        nextBtn.addEventListener('click', nextHandler);
        eventListeners.push({ element: nextBtn, event: 'click', handler: nextHandler });
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
            
            refreshBtn.style.color = 'var(--rsi-success, #10b981)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 600);
            
        } catch (error) {
            console.error('❌ Error actualizando:', error);
            refreshBtn.style.color = 'var(--rsi-danger, #ef4444)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 600);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        }
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
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
            background: 'var(--rsi-bg-card, #ffffff)',
            color: 'var(--rsi-text-primary, #0f172a)'
        });
    } else {
        console.log(`[ALERTA ${tipo}]: ${mensaje}`);
    }
}

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
        const countEl = document.getElementById('itemCount');
        if (countEl) countEl.textContent = stats.total || totalItems || 0;
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
                        <div style="display: flex; align-items: center; gap: var(--rsi-spacing-sm, 12px);">
                            ${tieneImagen ? `
                                <img src="${item.imagenBase64}" alt="${item.nombreCategoria}" 
                                     style="width: 36px; height: 36px; object-fit: cover; border-radius: var(--rsi-radius-sm, 6px); border: 1px solid var(--rsi-border-color, #e2e8f0);">
                            ` : `
                                <div style="width: 36px; height: 36px; background: rgba(28, 25, 72, 0.08); border-radius: var(--rsi-radius-sm, 6px); 
                                            display: flex; align-items: center; justify-content: center; color: var(--rsi-primary, #1c1948);">
                                    <i class="fas fa-tag"></i>
                                </div>
                            `}
                            <div>
                                <span style="font-weight: 600; color: var(--rsi-text-primary, #0f172a); font-size: 0.92rem;">${item.nombreCategoria}</span>
                            </div>
                        </div>
                    </td>
                    <td data-label="Creado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem; font-weight: 500;">${item.creadoPor || 'Sistema'}</span>
                            <small style="color: var(--rsi-gray-500, #64748b); font-size: 0.72rem;">
                                ${formatDate(item.fechaCreacion)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Modificado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem; font-weight: 500;">${item.modificadoPor || 'Sistema'}</span>
                            <small style="color: var(--rsi-gray-500, #64748b); font-size: 0.72rem;">
                                ${formatDate(item.fechaActualizacion)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-categoria" data-id="${item.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-categoria" data-id="${item.id}" title="Editar categoría">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-delete btn-delete-categoria" data-id="${item.id}" title="Eliminar categoría">
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
                confirmButtonColor: '#1c1948'
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
                <p style="color: var(--rsi-danger, #ef4444); margin-top: 10px;">
                    ⚠️ Esta acción no se puede deshacer.
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
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
            text: `La categoría "${item.nombreCategoria}" ha sido eliminada con éxito.`,
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
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Maneja la visualización de detalles de una categoría
 */
async function handleViewCategoria(id) {
    try {
        const item = categoriasData.find(c => c.id === id);
        if (!item) throw new Error('Categoría no encontrada');

        const tieneImagen = item.imagenBase64 && item.imagenBase64.length > 0;

        Swal.fire({
            title: item.nombreCategoria,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                        ${tieneImagen ? `
                            <img src="${item.imagenBase64}" alt="${item.nombreCategoria}" 
                                 style="max-width: 180px; max-height: 180px; object-fit: contain; border-radius: var(--rsi-radius-md, 8px); border: 1px solid var(--rsi-border-color, #e2e8f0);">
                        ` : `
                            <div style="width: 80px; height: 80px; background: rgba(28, 25, 72, 0.08); border-radius: var(--rsi-radius-md, 8px); 
                                        display: flex; align-items: center; justify-content: center; color: var(--rsi-primary, #1c1948); font-size: 2.5rem;">
                                <i class="fas fa-tag"></i>
                            </div>
                        `}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: var(--rsi-bg-secondary, #f8fafc); padding: 14px; border-radius: var(--rsi-radius-md, 8px);">
                        <div>
                            <span style="color: var(--rsi-gray-500, #64748b); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 2px 0 0; font-weight: 600;">${item.creadoPor || 'Sistema'}</p>
                            <p style="font-size: 0.78rem; color: var(--rsi-gray-500, #64748b); margin: 2px 0 0;">${formatDate(item.fechaCreacion)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500, #64748b); font-size: 0.8rem;">Modificado por</span>
                            <p style="margin: 2px 0 0; font-weight: 600;">${item.modificadoPor || 'Sistema'}</p>
                            <p style="font-size: 0.78rem; color: var(--rsi-gray-500, #64748b); margin: 2px 0 0;">${formatDate(item.fechaActualizacion)}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '480px'
        });

    } catch (error) {
        console.error('❌ Error viendo categoría:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cargar los detalles',
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Limpia eventos al desmontar la vista
 */
export function destroyCategoriasCrudController() {
    console.log('🧹 Destroying CategoriasCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler);
        }
    });
    eventListeners = [];
    
    service = null;
    categoriasData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    currentImageBase64 = '';
}

export default categoriasCrudController;
