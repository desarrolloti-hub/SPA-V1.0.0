/* ========================================
   VIEW BLOG PUBLIC CONTROLLER - RSI Enterprise México
   Lectura de artículo completo consultado por slug
   ======================================== */

import { BlogService } from '../../services/blogService.js';

let blogService = null;
let eventListeners = [];
let currentBlog = null;

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

export function destroyViewBlogPublicController() {
    removeAllManagedListeners();
    blogService = null;
    currentBlog = null;
}

/**
 * Entry point para la lectura de artículo de blog
 */
export async function viewBlogPublicController() {
    console.log('📖 View Blog Public Controller iniciado');

    destroyViewBlogPublicController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    blogService = new BlogService();

    // Obtener slug de la URL (?slug=titulo-sin-espacios) o id fallback
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');
    const id = urlParams.get('id');

    if (!slug && !id) {
        showNotFound();
        return;
    }

    await loadArticle(slug, id);

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        const nextPath = e.detail?.path || '';
        if (nextPath !== '/verBlog' && nextPath !== '/blog') {
            destroyViewBlogPublicController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);
}

/**
 * Carga los datos del artículo y sus artículos relacionados
 * @param {string|null} slug
 * @param {string|null} id
 */
async function loadArticle(slug, id) {
    showLoading();

    try {
        if (slug) {
            currentBlog = await blogService.getBlogBySlug(slug);
        } else if (id) {
            currentBlog = await blogService.getBlogById(id);
        }

        if (!currentBlog) {
            showNotFound();
            return;
        }

        // Si el artículo no está publicado y el usuario no es colaborador interno, ocultar
        const session = localStorage.getItem('rsi_session');
        if (currentBlog.status !== 'published' && !session) {
            showNotFound();
            return;
        }

        // Incrementar vistas de forma no bloqueante
        blogService.incrementVistas(currentBlog.id);

        renderArticle(currentBlog);
        setupShareButtons(currentBlog);
        await loadRelatedArticles(currentBlog);

        hideLoading();
        showArticle();

    } catch (error) {
        console.error('❌ Error cargando artículo de blog:', error);
        showNotFound();
    }
}

/**
 * Renderiza todos los elementos del artículo en el DOM
 * @param {Object} blog
 */
function renderArticle(blog) {
    // Título y Document Title
    document.title = `${blog.titulo} | Blog RSI Enterprise`;
    const titleEl = document.getElementById('articleTitle');
    if (titleEl) titleEl.textContent = blog.titulo;

    // Categoría y Breadcrumbs
    const catBadge = document.getElementById('articleCategoryBadge');
    const breadcrumbCat = document.getElementById('breadcrumbCategory');
    if (catBadge) catBadge.textContent = blog.categoria || 'General';
    if (breadcrumbCat) breadcrumbCat.textContent = blog.categoria || 'General';

    // Resumen / Bajada
    const excerptEl = document.getElementById('articleExcerpt');
    if (excerptEl) excerptEl.textContent = blog.resumen || '';

    // Autor y Fecha
    const authorEl = document.getElementById('articleAuthor');
    const dateEl = document.getElementById('articleDate');
    if (authorEl) authorEl.textContent = blog.autorNombre || 'RSI Enterprise';
    if (dateEl) dateEl.textContent = formatDate(blog.fechaPublicacion || blog.createdAt);

    // Métricas de lectura
    const readTimeEl = document.getElementById('articleReadTime');
    const viewsEl = document.getElementById('articleViews');
    if (readTimeEl) readTimeEl.textContent = blog.tiempoLectura || '4 min de lectura';
    if (viewsEl) viewsEl.textContent = ((Number(blog.vistas) || 0) + 1).toLocaleString('es-MX');

    // Hero Cover
    const heroWrapper = document.getElementById('articleHeroCoverWrapper');
    const heroImg = document.getElementById('articleHeroImg');
    if (blog.imagenPortada && heroWrapper && heroImg) {
        heroImg.src = blog.imagenPortada;
        heroImg.alt = blog.titulo;
        heroWrapper.classList.remove('is-hidden');
    } else if (heroWrapper) {
        heroWrapper.classList.add('is-hidden');
    }

    // Contenido HTML enriquecido
    const bodyContent = document.getElementById('articleBodyContent');
    if (bodyContent) {
        bodyContent.innerHTML = blog.contenidoHtml || '<p>Contenido no disponible.</p>';
    }

    // Tags
    const tagsWrapper = document.getElementById('articleTagsWrapper');
    const tagsList = document.getElementById('articleTagsList');
    if (Array.isArray(blog.tags) && blog.tags.length > 0 && tagsWrapper && tagsList) {
        tagsList.innerHTML = blog.tags.map(tag => `
            <span class="rsi-article-tag">#${escapeHtml(tag)}</span>
        `).join('');
        tagsWrapper.classList.remove('is-hidden');
    } else if (tagsWrapper) {
        tagsWrapper.classList.add('is-hidden');
    }
}

/**
 * Conecta los botones para compartir el artículo en redes sociales
 * @param {Object} blog
 */
function setupShareButtons(blog) {
    const articleUrl = window.location.href;
    const articleTitle = encodeURIComponent(blog.titulo);
    const encodedUrl = encodeURIComponent(articleUrl);

    // WhatsApp
    const waUrl = `https://api.whatsapp.com/send?text=${articleTitle}%20${encodedUrl}`;
    setupShareAction('btnShareWhatsApp', waUrl);
    setupShareAction('btnShareWhatsAppBottom', waUrl);

    // LinkedIn
    const inUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    setupShareAction('btnShareLinkedIn', inUrl);
    setupShareAction('btnShareLinkedInBottom', inUrl);

    // Twitter / X
    const twUrl = `https://twitter.com/intent/tweet?text=${articleTitle}&url=${encodedUrl}`;
    setupShareAction('btnShareTwitter', twUrl);

    // Copiar enlace
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(articleUrl);
            showQuickToast('Enlace copiado al portapapeles');
        } catch (_) {
            window.prompt('Copia el enlace de este artículo:', articleUrl);
        }
    };

    const copyBtn1 = document.getElementById('btnCopyArticleUrl');
    const copyBtn2 = document.getElementById('btnCopyArticleUrlBottom');
    if (copyBtn1) addManagedListener(copyBtn1, 'click', handleCopy);
    if (copyBtn2) addManagedListener(copyBtn2, 'click', handleCopy);
}

function setupShareAction(btnId, targetUrl) {
    const btn = document.getElementById(btnId);
    if (btn) {
        addManagedListener(btn, 'click', () => {
            window.open(targetUrl, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes');
        });
    }
}

/**
 * Carga hasta 3 artículos relacionados de la misma categoría
 * @param {Object} blog
 */
async function loadRelatedArticles(blog) {
    const section = document.getElementById('relatedArticlesSection');
    const grid = document.getElementById('relatedArticlesGrid');
    if (!section || !grid) return;

    try {
        const allPublished = await blogService.getPublishedBlogs();
        // Filtrar excluyendo el actual, prefiriendo misma categoría
        let related = allPublished.filter(b => b.id !== blog.id && b.categoria === blog.categoria);
        if (related.length < 3) {
            const others = allPublished.filter(b => b.id !== blog.id && b.categoria !== blog.categoria);
            related = related.concat(others);
        }
        related = related.slice(0, 3);

        if (related.length === 0) {
            section.classList.add('is-hidden');
            return;
        }

        grid.innerHTML = related.map(item => `
            <article class="rsi-public-card rsi-blog-card" data-slug="${escapeHtml(item.slug)}">
                <div class="rsi-public-card-cover">
                    ${item.imagenPortada ? `<img src="${escapeHtml(item.imagenPortada)}" alt="${escapeHtml(item.titulo)}" loading="lazy">` : '<div class="rsi-public-card-placeholder"><i class="fas fa-newspaper"></i></div>'}
                    <span class="rsi-blog-category-badge">${escapeHtml(item.categoria || 'General')}</span>
                </div>
                <div class="rsi-public-card-body">
                    <h3>${escapeHtml(item.titulo)}</h3>
                    <p>${escapeHtml(item.resumen || '')}</p>
                    <div class="rsi-public-card-footer">
                        <span class="rsi-blog-author-meta"><i class="fas fa-clock"></i> ${item.tiempoLectura || '3 min'}</span>
                        <span class="rsi-public-card-cta">Leer <i class="fas fa-arrow-right"></i></span>
                    </div>
                </div>
            </article>
        `).join('');

        grid.querySelectorAll('[data-slug]').forEach(card => {
            addManagedListener(card, 'click', () => {
                const slug = card.dataset.slug;
                const nextUrl = `/verBlog?slug=${encodeURIComponent(slug)}`;
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(nextUrl);
                } else {
                    window.location.href = nextUrl;
                }
            });
        });

        section.classList.remove('is-hidden');

    } catch (e) {
        console.warn('⚠️ No se pudieron cargar artículos relacionados:', e.message);
        section.classList.add('is-hidden');
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

function showLoading() {
    const el = document.getElementById('viewBlogLoading');
    if (el) el.classList.remove('is-hidden');
}

function hideLoading() {
    const el = document.getElementById('viewBlogLoading');
    if (el) el.classList.add('is-hidden');
}

function showNotFound() {
    hideLoading();
    const notFound = document.getElementById('viewBlogNotFound');
    const article = document.getElementById('viewBlogArticle');
    if (notFound) notFound.classList.remove('is-hidden');
    if (article) article.classList.add('is-hidden');
}

function showArticle() {
    const notFound = document.getElementById('viewBlogNotFound');
    const article = document.getElementById('viewBlogArticle');
    if (notFound) notFound.classList.add('is-hidden');
    if (article) article.classList.remove('is-hidden');
}

function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
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
