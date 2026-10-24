/* ==========================================================================
   BLOGS CRUD CONTROLLER - RSI Enterprise México
   Panel de administración para redactores y colaboradores
   ========================================================================== */

import { BlogService } from '../../services/blogService.js';
const Swal = window.Swal;

let blogService = null;
let eventListeners = [];
let allBlogs = [];
let filteredBlogs = [];
let currentPage = 1;
const pageSize = 10;
let searchTerm = '';
let selectedCategory = 'all';
let selectedStatus = 'all';

function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

function removeAllManagedListeners() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        try {
            element.removeEventListener(event, handler, options);
        } catch (_) {}
    });
    eventListeners = [];
}

export function destroyBlogsCrudController() {
    removeAllManagedListeners();
    allBlogs = [];
    filteredBlogs = [];
    blogService = null;
    searchTerm = '';
    selectedCategory = 'all';
    selectedStatus = 'all';
}

/**
 * Inicializador principal del controlador CRUD de Blogs
 */
export async function blogsCrudController() {
    console.log('📰 Inicializando Blogs CRUD Controller...');

    destroyBlogsCrudController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    blogService = new BlogService();

    bindEvents();
    await loadBlogs(false);

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        const nextPath = e.detail?.path || '';
        if (nextPath !== '/partner/crudBlogs' && nextPath !== '/partner/blogs') {
            destroyBlogsCrudController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('✅ Blogs CRUD Controller iniciado con éxito');
}

/**
 * Enlaza listeners a elementos estáticos de la interfaz
 */
function bindEvents() {
    // Botón Recargar
    const refreshBtn = document.getElementById('refreshBlogsBtn');
    if (refreshBtn) {
        addManagedListener(refreshBtn, 'click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            await loadBlogs(true);
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        });
    }

    // Buscador
    const searchInput = document.getElementById('searchBlogInput');
    const clearSearchBtn = document.getElementById('clearSearchBlogBtn');
    if (searchInput) {
        addManagedListener(searchInput, 'input', (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('is-hidden', !searchTerm);
            }
            applyFilters();
        });
    }

    if (clearSearchBtn) {
        addManagedListener(clearSearchBtn, 'click', () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            clearSearchBtn.classList.add('is-hidden');
            applyFilters();
        });
    }

    // Limpiar desde mensaje de resultados
    const clearInfoBtn = document.getElementById('clearBlogSearchResults');
    if (clearInfoBtn) {
        addManagedListener(clearInfoBtn, 'click', () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            if (clearSearchBtn) clearSearchBtn.classList.add('is-hidden');
            applyFilters();
        });
    }

    // Filtros de categoría y estatus
    const filterCat = document.getElementById('filterCategory');
    if (filterCat) {
        addManagedListener(filterCat, 'change', (e) => {
            selectedCategory = e.target.value;
            applyFilters();
        });
    }

    const filterStat = document.getElementById('filterStatus');
    if (filterStat) {
        addManagedListener(filterStat, 'change', (e) => {
            selectedStatus = e.target.value;
            applyFilters();
        });
    }

    // Paginación
    const prevBtn = document.getElementById('blogsPrevPage');
    const nextBtn = document.getElementById('blogsNextPage');
    if (prevBtn) {
        addManagedListener(prevBtn, 'click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    if (nextBtn) {
        addManagedListener(nextBtn, 'click', () => {
            const maxPages = Math.ceil(filteredBlogs.length / pageSize) || 1;
            if (currentPage < maxPages) {
                currentPage++;
                renderTable();
            }
        });
    }
}

/**
 * Carga los blogs desde el servicio
 * @param {boolean} forceRefresh
 */
async function loadBlogs(forceRefresh = false) {
    try {
        allBlogs = await blogService.getAllBlogs(forceRefresh);
        updateStats();
        applyFilters();
    } catch (error) {
        console.error('❌ Error al cargar blogs:', error);
        const tbody = document.getElementById('blogsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-danger">
                        <i class="fas fa-exclamation-triangle"></i> Error al cargar artículos: ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Actualiza las cajas de métricas superiores
 */
function updateStats() {
    const total = allBlogs.length;
    const published = allBlogs.filter(b => b.status === 'published').length;
    const draft = allBlogs.filter(b => b.status === 'draft').length;
    const totalViews = allBlogs.reduce((acc, curr) => acc + (Number(curr.vistas) || 0), 0);

    const elTotal = document.getElementById('statTotalBlogs');
    const elPub = document.getElementById('statPublishedBlogs');
    const elDraft = document.getElementById('statDraftBlogs');
    const elViews = document.getElementById('statTotalVistas');
    const elCount = document.getElementById('blogCount');

    if (elTotal) elTotal.textContent = total;
    if (elPub) elPub.textContent = published;
    if (elDraft) elDraft.textContent = draft;
    if (elViews) elViews.textContent = totalViews.toLocaleString('es-MX');
    if (elCount) elCount.textContent = total;
}

/**
 * Filtra los blogs según búsqueda, categoría y estatus
 */
function applyFilters() {
    currentPage = 1;
    filteredBlogs = allBlogs.filter(blog => {
        // Filtro de texto
        const matchSearch = !searchTerm ||
            (blog.titulo && blog.titulo.toLowerCase().includes(searchTerm)) ||
            (blog.slug && blog.slug.toLowerCase().includes(searchTerm)) ||
            (blog.autorNombre && blog.autorNombre.toLowerCase().includes(searchTerm)) ||
            (blog.categoria && blog.categoria.toLowerCase().includes(searchTerm)) ||
            (Array.isArray(blog.tags) && blog.tags.some(t => t.toLowerCase().includes(searchTerm)));

        // Filtro de categoría
        const matchCategory = selectedCategory === 'all' || blog.categoria === selectedCategory;

        // Filtro de estatus
        const matchStatus = selectedStatus === 'all' || blog.status === selectedStatus;

        return matchSearch && matchCategory && matchStatus;
    });

    // Mostrar/ocultar barra informativa de búsqueda
    const infoBox = document.getElementById('blogSearchResultsInfo');
    const infoText = document.getElementById('blogSearchResultsText');
    if (infoBox && infoText) {
        if (searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all') {
            infoBox.classList.remove('is-hidden');
            infoText.innerHTML = `Mostrando <strong>${filteredBlogs.length}</strong> de <strong>${allBlogs.length}</strong> artículos encontrados.`;
        } else {
            infoBox.classList.add('is-hidden');
        }
    }

    renderTable();
}

/**
 * Renderiza la tabla de artículos con paginación
 */
function renderTable() {
    const tbody = document.getElementById('blogsTableBody');
    const emptyState = document.getElementById('blogsEmptyState');
    const pagination = document.getElementById('blogsPagination');
    const table = document.getElementById('blogsTable');

    if (!tbody) return;

    if (filteredBlogs.length === 0) {
        tbody.innerHTML = '';
        if (table) table.classList.add('is-hidden');
        if (emptyState) emptyState.classList.remove('is-hidden');
        if (pagination) pagination.classList.add('is-hidden');
        return;
    }

    if (table) table.classList.remove('is-hidden');
    if (emptyState) emptyState.classList.add('is-hidden');

    const totalPages = Math.ceil(filteredBlogs.length / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filteredBlogs.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(blog => {
        const coverThumb = blog.imagenPortada
            ? `<img src="${escapeHtml(blog.imagenPortada)}" alt="Portada" class="rsi-blog-thumb" loading="lazy">`
            : `<div class="rsi-blog-thumb-placeholder"><i class="fas fa-image"></i></div>`;

        const statusBadge = getStatusBadge(blog.status);
        const fechaFormatted = formatDate(blog.fechaPublicacion || blog.createdAt);

        return `
            <tr data-blog-id="${blog.id}">
                <td>${coverThumb}</td>
                <td>
                    <div class="rsi-blog-title-cell">
                        <strong class="rsi-blog-title">${escapeHtml(blog.titulo || 'Sin título')}</strong>
                        <span class="rsi-blog-slug-meta">
                            <i class="fas fa-link"></i> /verBlog?slug=<strong>${escapeHtml(blog.slug || '')}</strong>
                        </span>
                    </div>
                </td>
                <td>
                    <span class="rsi-category-pill">${escapeHtml(blog.categoria || 'General')}</span>
                </td>
                <td>
                    <div class="rsi-author-cell">
                        <i class="fas fa-user-edit"></i>
                        <span>${escapeHtml(blog.autorNombre || 'Colaborador')}</span>
                    </div>
                </td>
                <td style="text-align: center;">
                    <span class="rsi-views-badge">
                        <i class="fas fa-eye"></i> ${Number(blog.vistas || 0).toLocaleString()}
                    </span>
                </td>
                <td style="text-align: center;">
                    ${statusBadge}
                </td>
                <td>
                    <span class="rsi-date-cell">${fechaFormatted}</span>
                </td>
                <td style="text-align: right;">
                    <div class="rsi-table-actions">
                        <a href="/verBlog?slug=${encodeURIComponent(blog.slug || '')}" target="_blank" class="rsi-action-btn rsi-action-view" title="Ver en portal público">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <a href="/partner/blog?id=${blog.id}" class="rsi-action-btn rsi-action-edit" title="Editar artículo">
                            <i class="fas fa-pen"></i>
                        </a>
                        <button type="button" class="rsi-action-btn rsi-action-status btn-change-status" data-id="${blog.id}" data-status="${blog.status}" title="Cambiar estatus">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        <button type="button" class="rsi-action-btn rsi-action-delete btn-delete-blog" data-id="${blog.id}" data-title="${escapeHtml(blog.titulo)}" title="Eliminar artículo">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Enlazar botones de acción en las filas renderizadas
    attachRowActions(tbody);

    // Actualizar paginador
    if (pagination) {
        if (totalPages > 1) {
            pagination.classList.remove('is-hidden');
            const pageInfo = document.getElementById('blogsPageInfo');
            const prevBtn = document.getElementById('blogsPrevPage');
            const nextBtn = document.getElementById('blogsNextPage');

            if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages;
        } else {
            pagination.classList.add('is-hidden');
        }
    }
}

/**
 * Conecta eventos para botones dentro de las filas de la tabla
 * @param {HTMLElement} tbody
 */
function attachRowActions(tbody) {
    // Cambiar Estatus
    tbody.querySelectorAll('.btn-change-status').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const blogId = btn.dataset.id;
            const currentStat = btn.dataset.status;
            await promptChangeStatus(blogId, currentStat);
        });
    });

    // Eliminar Blog
    tbody.querySelectorAll('.btn-delete-blog').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const blogId = btn.dataset.id;
            const blogTitle = btn.dataset.title;
            await confirmDeleteBlog(blogId, blogTitle);
        });
    });
}

/**
 * Modal SweetAlert2 para cambiar el estatus de un blog
 */
async function promptChangeStatus(blogId, currentStat) {
    const { value: newStatus } = await Swal.fire({
        title: 'Cambiar Estatus',
        text: 'Selecciona el nuevo estado de publicación para este artículo:',
        input: 'select',
        inputOptions: {
            published: 'Publicado (Visible al público)',
            draft: 'Borrador (Solo interno)',
            inactive: 'Inactivo (Oculto)'
        },
        inputValue: currentStat,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        customClass: {
            popup: 'rsi-swal-popup'
        }
    });

    if (newStatus && newStatus !== currentStat) {
        try {
            Swal.fire({
                title: 'Actualizando estatus...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false
            });

            const res = await blogService.changeStatus(blogId, newStatus);
            if (!res.success) {
                throw new Error(res.error);
            }

            Swal.fire({
                icon: 'success',
                title: 'Estatus actualizado',
                text: res.message,
                timer: 1600,
                showConfirmButton: false
            });

            await loadBlogs(true);
        } catch (error) {
            Swal.fire('Error', error.message || 'No se pudo cambiar el estatus', 'error');
        }
    }
}

/**
 * Confirmación SweetAlert2 para eliminar un blog
 */
async function confirmDeleteBlog(blogId, blogTitle) {
    const result = await Swal.fire({
        title: '¿Eliminar artículo?',
        html: `¿Estás seguro de eliminar permanentemente el blog <strong>"${escapeHtml(blogTitle)}"</strong>?<br><br>Esta acción eliminará el contenido y su imagen de portada en Storage.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'rsi-swal-popup'
        }
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Eliminando artículo...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false
            });

            const res = await blogService.deleteBlog(blogId);
            if (!res.success) {
                throw new Error(res.error);
            }

            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'El artículo ha sido eliminado con éxito.',
                timer: 1600,
                showConfirmButton: false
            });

            await loadBlogs(true);
        } catch (error) {
            Swal.fire('Error', error.message || 'No se pudo eliminar el blog', 'error');
        }
    }
}

// ==========================================
// HELPERS
// ==========================================

function getStatusBadge(status) {
    switch (status) {
        case 'published':
            return '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Publicado</span>';
        case 'draft':
            return '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-pencil-alt"></i> Borrador</span>';
        case 'inactive':
            return '<span class="rsi-badge rsi-badge-secondary"><i class="fas fa-eye-slash"></i> Inactivo</span>';
        default:
            return '<span class="rsi-badge rsi-badge-light">Desconocido</span>';
    }
}

function formatDate(isoString) {
    if (!isoString) return '-';
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (_) {
        return '-';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
