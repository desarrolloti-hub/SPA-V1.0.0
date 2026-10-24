/* ========================================
   BLOGS PUBLIC CONTROLLER - RSI Enterprise México
   Vista pública de artículos tipo catálogo con carátulas
   ======================================== */

import { BlogService } from '../../services/blogService.js';

let blogService = null;
let eventListeners = [];
let allPublishedBlogs = [];
let filteredBlogs = [];
let currentPage = 1;
const pageSize = 9;
let currentSearch = '';
let currentCategory = 'all';

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

export function destroyBlogsPublicController() {
    removeAllManagedListeners();
    blogService = null;
    allPublishedBlogs = [];
    filteredBlogs = [];
    currentPage = 1;
    currentSearch = '';
    currentCategory = 'all';
}

/**
 * Entry point del módulo de blogs públicos
 */
export async function blogsPublicController() {
    console.log('🌐 Blogs Public Controller iniciado');

    destroyBlogsPublicController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    blogService = new BlogService();

    initEvents();
    await loadBlogs();

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        const nextPath = e.detail?.path || '';
        if (nextPath !== '/blogs' && nextPath !== '/blog') {
            destroyBlogsPublicController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);
}

/**
 * Enlaza listeners de búsqueda, categorías y paginación
 */
function initEvents() {
    const searchInput = document.getElementById('blogSearchInput');
    const searchClear = document.getElementById('blogSearchClear');
    const pillsContainer = document.getElementById('blogCategoriesContainer');
    const prevBtn = document.getElementById('blogPrevPage');
    const nextBtn = document.getElementById('blogNextPage');

    // Buscador
    if (searchInput) {
        addManagedListener(searchInput, 'input', (e) => {
            currentSearch = e.target.value.trim().toLowerCase();
            if (searchClear) {
                searchClear.classList.toggle('is-hidden', !currentSearch);
            }
            applyFilters();
        });
    }

    if (searchClear) {
        addManagedListener(searchClear, 'click', () => {
            if (searchInput) searchInput.value = '';
            currentSearch = '';
            searchClear.classList.add('is-hidden');
            applyFilters();
        });
    }

    // Filtro de categorías en Pills
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.rsi-pill-btn').forEach(btn => {
            addManagedListener(btn, 'click', () => {
                pillsContainer.querySelectorAll('.rsi-pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.dataset.category || 'all';
                applyFilters();
            });
        });
    }

    // Paginación
    if (prevBtn) {
        addManagedListener(prevBtn, 'click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderGrid();
                scrollToTop();
            }
        });
    }

    if (nextBtn) {
        addManagedListener(nextBtn, 'click', () => {
            const maxPages = Math.ceil(filteredBlogs.length / pageSize) || 1;
            if (currentPage < maxPages) {
                currentPage++;
                renderGrid();
                scrollToTop();
            }
        });
    }
}

/**
 * Carga los blogs publicados desde el servicio
 */
async function loadBlogs() {
    showLoading();
    hideEmpty();
    hideGrid();
    hidePagination();

    try {
        allPublishedBlogs = await blogService.getPublishedBlogs();
        applyFilters();
    } catch (error) {
        console.error('❌ Error al cargar blogs públicos:', error);
        showEmpty(
            'Error al cargar artículos',
            'Ocurrió un problema de conexión al consultar los blogs. Por favor intenta de nuevo.'
        );
    }
}

/**
 * Filtra los blogs y actualiza la paginación
 */
function applyFilters() {
    currentPage = 1;

    filteredBlogs = allPublishedBlogs.filter(blog => {
        const matchCategory = currentCategory === 'all' || blog.categoria === currentCategory;

        const matchSearch = !currentSearch ||
            (blog.titulo && blog.titulo.toLowerCase().includes(currentSearch)) ||
            (blog.resumen && blog.resumen.toLowerCase().includes(currentSearch)) ||
            (blog.categoria && blog.categoria.toLowerCase().includes(currentSearch)) ||
            (Array.isArray(blog.tags) && blog.tags.some(t => t.toLowerCase().includes(currentSearch)));

        return matchCategory && matchSearch;
    });

    hideLoading();

    if (filteredBlogs.length === 0) {
        if (currentSearch || currentCategory !== 'all') {
            showEmpty('Sin resultados coincidentes', 'No se encontraron artículos con los filtros aplicados.');
        } else {
            showEmpty('Aún no hay artículos disponibles', 'Vuelve pronto para descubrir nuestras publicaciones.');
        }
        hideGrid();
        hidePagination();
        return;
    }

    hideEmpty();
    renderGrid();
    showGrid();
    updatePaginationUI();
}

/**
 * Renderiza el Grid de tarjetas de artículos
 */
function renderGrid() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const totalPages = Math.ceil(filteredBlogs.length / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filteredBlogs.slice(startIndex, startIndex + pageSize);

    pageItems.forEach(blog => {
        grid.appendChild(createBlogCard(blog));
    });

    // Enlazar clics de navegación con slug limpio
    grid.querySelectorAll('[data-blog-slug]').forEach(card => {
        const handler = (e) => {
            if (e.target.closest('.btn-share-blog')) return;
            const slug = card.dataset.blogSlug;
            goToBlogDetail(slug);
        };
        card.addEventListener('click', handler);
        eventListeners.push({ element: card, event: 'click', handler });
    });

    // Enlazar botón compartir
    grid.querySelectorAll('.btn-share-blog').forEach(btn => {
        const shareHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const slug = btn.dataset.slug;
            const blog = allPublishedBlogs.find(b => b.slug === slug);
            if (blog) shareBlog(blog);
        };
        btn.addEventListener('click', shareHandler);
        eventListeners.push({ element: btn, event: 'click', handler: shareHandler });
    });
}

/**
 * Construye el elemento HTML de cada tarjeta de blog
 */
function createBlogCard(blog) {
    const card = document.createElement('article');
    card.className = 'rsi-public-card rsi-blog-card';
    card.dataset.blogSlug = blog.slug;

    const cover = blog.imagenPortada
        ? `<img src="${escapeHtml(blog.imagenPortada)}" alt="${escapeHtml(blog.titulo)}" loading="lazy">`
        : `<div class="rsi-public-card-placeholder"><i class="fas fa-newspaper"></i></div>`;

    const fechaStr = formatDate(blog.fechaPublicacion || blog.createdAt);
    const readTime = blog.tiempoLectura || '3 min de lectura';

    card.innerHTML = `
        <div class="rsi-public-card-cover">
            ${cover}
            <span class="rsi-blog-category-badge">${escapeHtml(blog.categoria || 'General')}</span>
        </div>
        <div class="rsi-public-card-body">
            <div class="rsi-blog-card-meta">
                <span><i class="fas fa-clock"></i> ${readTime}</span>
                <span><i class="fas fa-calendar-alt"></i> ${fechaStr}</span>
            </div>
            <h3>${escapeHtml(blog.titulo || 'Sin título')}</h3>
            <p>${escapeHtml(blog.resumen || 'Sin resumen disponible.')}</p>
            <div class="rsi-public-card-footer">
                <span class="rsi-blog-author-meta">
                    <i class="fas fa-user-circle"></i> ${escapeHtml(blog.autorNombre || 'RSI Enterprise')}
                </span>
                <div class="rsi-blog-footer-actions">
                    <button type="button" class="btn-share-blog" data-slug="${escapeHtml(blog.slug)}" title="Compartir artículo">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <span class="rsi-public-card-cta">
                        Leer <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        </div>
    `;

    return card;
}

/**
 * Navega a la vista del artículo usando el slug sin espacios
 * @param {string} slug
 */
function goToBlogDetail(slug) {
    const targetUrl = `/verBlog?slug=${encodeURIComponent(slug)}`;
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(targetUrl);
    } else {
        window.location.href = targetUrl;
    }
}

/**
 * Comparte el artículo vía Web Share API o portapapeles
 */
async function shareBlog(blog) {
    const blogUrl = `${window.location.origin}/verBlog?slug=${encodeURIComponent(blog.slug)}`;
    const shareData = {
        title: blog.titulo,
        text: blog.resumen,
        url: blogUrl
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (_) {}
    }

    // Fallback: copiar enlace
    try {
        await navigator.clipboard.writeText(blogUrl);
        showQuickToast('Enlace copiado al portapapeles');
    } catch (_) {
        window.prompt('Copia este enlace para compartir el blog:', blogUrl);
    }
}

function showQuickToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'rsi-quick-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 50);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function updatePaginationUI() {
    const pagination = document.getElementById('blogPagination');
    const pageInfo = document.getElementById('blogPageInfo');
    const prevBtn = document.getElementById('blogPrevPage');
    const nextBtn = document.getElementById('blogNextPage');

    const totalPages = Math.ceil(filteredBlogs.length / pageSize) || 1;

    if (pagination) {
        if (totalPages > 1) {
            pagination.classList.remove('is-hidden');
            if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages;
        } else {
            pagination.classList.add('is-hidden');
        }
    }
}

function showLoading() {
    const el = document.getElementById('blogLoading');
    if (el) el.classList.remove('is-hidden');
}

function hideLoading() {
    const el = document.getElementById('blogLoading');
    if (el) el.classList.add('is-hidden');
}

function showEmpty(title, text) {
    const el = document.getElementById('blogEmpty');
    const t = document.getElementById('blogEmptyTitle');
    const tx = document.getElementById('blogEmptyText');
    if (el) {
        if (title && t) t.textContent = title;
        if (text && tx) tx.textContent = text;
        el.classList.remove('is-hidden');
    }
}

function hideEmpty() {
    const el = document.getElementById('blogEmpty');
    if (el) el.classList.add('is-hidden');
}

function showGrid() {
    const el = document.getElementById('blogGrid');
    if (el) el.classList.remove('is-hidden');
}

function hideGrid() {
    const el = document.getElementById('blogGrid');
    if (el) el.classList.add('is-hidden');
}

function hidePagination() {
    const el = document.getElementById('blogPagination');
    if (el) el.classList.add('is-hidden');
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (_) {
        return '';
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
