/* ==========================================================================
   BLOG FORM CONTROLLER - RSI Enterprise México
   Editor enriquecido para redacción y publicación de artículos
   ========================================================================== */

import { BlogService } from '../../services/blogService.js';
import { BlogModel } from '../../models/blogModel.js';
const Swal = window.Swal;

let blogService = null;
let eventListeners = [];
let currentBlogId = null;
let currentBlogData = null;
let selectedCoverFile = null;
let isVisualMode = true;
let isSlugManuallyEdited = false;

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

export function destroyBlogFormController() {
    removeAllManagedListeners();
    blogService = null;
    currentBlogId = null;
    currentBlogData = null;
    selectedCoverFile = null;
    isVisualMode = true;
    isSlugManuallyEdited = false;
}

/**
 * Punto de entrada del formulario de blog
 */
export async function blogFormController() {
    console.log('✍️ Inicializando Blog Form Controller...');

    destroyBlogFormController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    blogService = new BlogService();

    // Obtener parámetro ?id= de la URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBlogId = urlParams.get('id');

    setupAuthorDisplay();
    bindEvents();

    if (currentBlogId) {
        await loadExistingBlog(currentBlogId);
    } else {
        updateWordCountAndReadTime('');
    }

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        const nextPath = e.detail?.path || '';
        if (nextPath !== '/partner/blog' && nextPath !== '/partner/blogs') {
            destroyBlogFormController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('✅ Blog Form Controller listo');
}

/**
 * Muestra el nombre del colaborador activo en el campo de autor
 */
function setupAuthorDisplay() {
    const authorInput = document.getElementById('blogAuthorName');
    if (authorInput) {
        const user = blogService._getCurrentUser();
        authorInput.value = user ? user.nombre : 'Colaborador RSI';
    }
}

/**
 * Enlaza listeners a todos los elementos del formulario
 */
function bindEvents() {
    const titleInput = document.getElementById('blogTitle');
    const slugInput = document.getElementById('blogSlug');
    const btnRegenSlug = document.getElementById('btnRegenerateSlug');
    const resumenInput = document.getElementById('blogResumen');
    const resumenCounter = document.getElementById('resumenCharCount');

    // Auto-generación de slug con base en el título
    if (titleInput) {
        addManagedListener(titleInput, 'input', () => {
            if (!isSlugManuallyEdited && slugInput) {
                slugInput.value = BlogModel.generateSlug(titleInput.value);
            }
        });
    }

    if (slugInput) {
        addManagedListener(slugInput, 'input', () => {
            isSlugManuallyEdited = true;
            slugInput.value = BlogModel.generateSlug(slugInput.value);
        });
    }

    if (btnRegenSlug) {
        addManagedListener(btnRegenSlug, 'click', () => {
            if (titleInput && slugInput) {
                slugInput.value = BlogModel.generateSlug(titleInput.value);
                isSlugManuallyEdited = false;
            }
        });
    }

    // Contador de caracteres de resumen
    if (resumenInput && resumenCounter) {
        addManagedListener(resumenInput, 'input', () => {
            resumenCounter.textContent = resumenInput.value.length;
        });
    }

    // Manejo de imagen de portada (Dropzone y File Input)
    setupCoverUpload();

    // Editor Enriquecido: Toolbar y modos
    setupEditorToolbar();

    // Botones de guardado
    const btnSaveDraft = document.getElementById('btnSaveDraft');
    const btnPublish = document.getElementById('btnPublishBlog');
    if (btnSaveDraft) {
        addManagedListener(btnSaveDraft, 'click', () => handleSave('draft'));
    }
    if (btnPublish) {
        addManagedListener(btnPublish, 'click', () => handleSave('published'));
    }

    // Modal de Vista Previa
    setupPreviewModal();
}

/**
 * Configuración de la carga de imagen de portada
 */
function setupCoverUpload() {
    const uploadArea = document.getElementById('coverUploadArea');
    const fileInput = document.getElementById('coverFileInput');
    const placeholder = document.getElementById('coverPlaceholder');
    const previewContainer = document.getElementById('coverPreviewContainer');
    const previewImg = document.getElementById('coverPreviewImg');
    const btnChange = document.getElementById('btnChangeCover');
    const btnRemove = document.getElementById('btnRemoveCover');

    if (!uploadArea || !fileInput) return;

    // Clic en placeholder abre selector de archivo
    addManagedListener(placeholder, 'click', () => fileInput.click());
    if (btnChange) {
        addManagedListener(btnChange, 'click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        addManagedListener(uploadArea, eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        addManagedListener(uploadArea, eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('is-dragging');
        });
    });

    addManagedListener(uploadArea, 'drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleCoverFileSelected(files[0]);
        }
    });

    addManagedListener(fileInput, 'change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleCoverFileSelected(fileInput.files[0]);
        }
    });

    if (btnRemove) {
        addManagedListener(btnRemove, 'click', (e) => {
            e.stopPropagation();
            selectedCoverFile = null;
            if (fileInput) fileInput.value = '';
            if (previewImg) previewImg.src = '';
            if (placeholder) placeholder.classList.remove('is-hidden');
            if (previewContainer) previewContainer.classList.add('is-hidden');
            if (currentBlogData) {
                currentBlogData.imagenPortada = null;
                currentBlogData.imagenPortadaPath = null;
            }
        });
    }
}

function handleCoverFileSelected(file) {
    if (!file || !file.type.startsWith('image/')) {
        Swal.fire('Formato Inválido', 'Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).', 'warning');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Archivo muy pesado', 'La imagen de portada no debe exceder los 5 MB.', 'warning');
        return;
    }

    selectedCoverFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImg = document.getElementById('coverPreviewImg');
        const placeholder = document.getElementById('coverPlaceholder');
        const previewContainer = document.getElementById('coverPreviewContainer');

        if (previewImg) previewImg.src = e.target.result;
        if (placeholder) placeholder.classList.add('is-hidden');
        if (previewContainer) previewContainer.classList.remove('is-hidden');
    };
    reader.readAsDataURL(file);
}

/**
 * Configuración de la barra de herramientas del editor enriquecido
 */
function setupEditorToolbar() {
    const toolbar = document.getElementById('blogEditorToolbar');
    const visualEditor = document.getElementById('blogContentVisual');
    const rawEditor = document.getElementById('blogContentHtml');
    const btnModeVisual = document.getElementById('btnModeVisual');
    const btnModeHtml = document.getElementById('btnModeHtml');
    const btnInsertLink = document.getElementById('btnInsertLink');
    const btnInsertImg = document.getElementById('btnInsertImageToolbar');
    const contentImageInput = document.getElementById('contentImageFileInput');

    if (!visualEditor || !rawEditor) return;

    // Cambiar a Modo Visual
    if (btnModeVisual) {
        addManagedListener(btnModeVisual, 'click', () => {
            if (isVisualMode) return;
            isVisualMode = true;
            btnModeVisual.classList.add('active');
            if (btnModeHtml) btnModeHtml.classList.remove('active');
            visualEditor.innerHTML = rawEditor.value;
            visualEditor.classList.remove('is-hidden');
            rawEditor.classList.add('is-hidden');
            if (toolbar) toolbar.classList.remove('is-disabled');
            updateWordCountAndReadTime(visualEditor.innerHTML);
        });
    }

    // Cambiar a Modo Código HTML
    if (btnModeHtml) {
        addManagedListener(btnModeHtml, 'click', () => {
            if (!isVisualMode) return;
            isVisualMode = false;
            btnModeHtml.classList.add('active');
            if (btnModeVisual) btnModeVisual.classList.remove('active');
            rawEditor.value = visualEditor.innerHTML;
            rawEditor.classList.remove('is-hidden');
            visualEditor.classList.add('is-hidden');
            if (toolbar) toolbar.classList.add('is-disabled');
            updateWordCountAndReadTime(rawEditor.value);
        });
    }

    // Sincronizar contador de palabras al escribir
    addManagedListener(visualEditor, 'input', () => {
        updateWordCountAndReadTime(visualEditor.innerHTML);
    });
    addManagedListener(rawEditor, 'input', () => {
        updateWordCountAndReadTime(rawEditor.value);
    });

    // Comandos de Toolbar estándar
    if (toolbar) {
        toolbar.querySelectorAll('button[data-command]').forEach(btn => {
            addManagedListener(btn, 'click', (e) => {
                e.preventDefault();
                if (!isVisualMode) return;
                const command = btn.dataset.command;
                const value = btn.dataset.value || null;
                document.execCommand(command, false, value);
                visualEditor.focus();
                updateWordCountAndReadTime(visualEditor.innerHTML);
            });
        });
    }

    // Insertar Enlace Web
    if (btnInsertLink) {
        addManagedListener(btnInsertLink, 'click', async (e) => {
            e.preventDefault();
            if (!isVisualMode) return;

            const { value: url } = await Swal.fire({
                title: 'Insertar Enlace Web',
                input: 'url',
                inputPlaceholder: 'https://ejemplo.com',
                showCancelButton: true,
                confirmButtonText: 'Insertar',
                cancelButtonText: 'Cancelar'
            });

            if (url) {
                document.execCommand('createLink', false, url);
                visualEditor.focus();
            }
        });
    }

    // Insertar Imagen desde archivo a Storage
    if (btnInsertImg && contentImageInput) {
        addManagedListener(btnInsertImg, 'click', (e) => {
            e.preventDefault();
            if (!isVisualMode) return;
            contentImageInput.click();
        });

        addManagedListener(contentImageInput, 'change', async () => {
            if (contentImageInput.files && contentImageInput.files.length > 0) {
                const imgFile = contentImageInput.files[0];
                contentImageInput.value = '';
                await uploadAndInsertImage(imgFile);
            }
        });
    }
}

/**
 * Sube una imagen a Storage e inserta el HTML en el contenido
 * @param {File} imgFile
 */
async function uploadAndInsertImage(imgFile) {
    const slugInput = document.getElementById('blogSlug');
    const slug = (slugInput && slugInput.value.trim()) || 'articulo';

    try {
        Swal.fire({
            title: 'Subiendo imagen...',
            html: 'Optimizando y alojando la fotografía en Firebase Storage...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const uploadRes = await blogService.uploadInlineImage(imgFile, slug);
        if (!uploadRes.success) {
            throw new Error(uploadRes.error);
        }

        Swal.close();

        // Preguntar por descripción o pie de foto
        const { value: caption } = await Swal.fire({
            title: 'Descripción de la Imagen',
            input: 'text',
            inputLabel: 'Pie de foto / Texto alternativo (Opcional):',
            inputPlaceholder: 'Ej: Instalación de domo IP 4K en exterior',
            showCancelButton: true,
            confirmButtonText: 'Insertar en Artículo',
            cancelButtonText: 'Omitir pie de foto'
        });

        const visualEditor = document.getElementById('blogContentVisual');
        if (!visualEditor) return;

        const safeCaption = caption ? escapeHtml(caption) : 'Ilustración del artículo';
        const figureHtml = `
            <figure class="blog-figure" style="margin: 2rem 0; text-align: center;">
                <img src="${uploadRes.url}" alt="${safeCaption}" loading="lazy" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
                <figcaption style="font-size: 0.85rem; color: #6c757d; margin-top: 0.5rem; font-style: italic;">${safeCaption}</figcaption>
            </figure>
            <p><br></p>
        `;

        visualEditor.focus();
        document.execCommand('insertHTML', false, figureHtml);
        updateWordCountAndReadTime(visualEditor.innerHTML);

    } catch (error) {
        Swal.fire('Error', error.message || 'No se pudo subir la fotografía.', 'error');
    }
}

/**
 * Actualiza métricas de lectura y palabras
 */
function updateWordCountAndReadTime(htmlContent) {
    const elWords = document.getElementById('editorWordCount');
    const elReadTime = document.getElementById('editorReadTime');

    const cleanText = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText ? cleanText.split(' ').length : 0;
    const readTimeStr = BlogModel.calculateReadTime(htmlContent);

    if (elWords) elWords.innerHTML = `<i class="fas fa-font"></i> ${wordCount.toLocaleString()} palabras`;
    if (elReadTime) elReadTime.innerHTML = `<i class="fas fa-clock"></i> ${readTimeStr}`;
}

/**
 * Carga un blog existente en modo edición
 */
async function loadExistingBlog(blogId) {
    try {
        Swal.fire({
            title: 'Cargando artículo...',
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });

        currentBlogData = await blogService.getBlogById(blogId);
        Swal.close();

        if (!currentBlogData) {
            Swal.fire('No encontrado', 'El artículo solicitado no existe.', 'error');
            return;
        }

        // Título del formulario
        const pageTitle = document.getElementById('blogFormPageTitle');
        if (pageTitle) pageTitle.innerHTML = 'Editar <span class="rsi-text-gold">Artículo de Blog</span>';

        // Llenar campos
        document.getElementById('blogDocId').value = currentBlogData.id;
        document.getElementById('blogTitle').value = currentBlogData.titulo || '';
        document.getElementById('blogSlug').value = currentBlogData.slug || '';
        isSlugManuallyEdited = true;

        const resumenInput = document.getElementById('blogResumen');
        if (resumenInput) {
            resumenInput.value = currentBlogData.resumen || '';
            const charCount = document.getElementById('resumenCharCount');
            if (charCount) charCount.textContent = resumenInput.value.length;
        }

        if (currentBlogData.categoria) {
            document.getElementById('blogCategory').value = currentBlogData.categoria;
        }

        if (Array.isArray(currentBlogData.tags)) {
            document.getElementById('blogTags').value = currentBlogData.tags.join(', ');
        }

        if (currentBlogData.status) {
            document.getElementById('blogStatus').value = currentBlogData.status;
        }

        if (currentBlogData.autorNombre) {
            document.getElementById('blogAuthorName').value = currentBlogData.autorNombre;
        }

        // Métricas de vistas
        const viewsGroup = document.getElementById('blogMetaStatsGroup');
        const viewsCount = document.getElementById('blogViewsCount');
        if (viewsGroup && viewsCount) {
            viewsGroup.style.display = 'block';
            viewsCount.textContent = (currentBlogData.vistas || 0).toLocaleString();
        }

        // Imagen de portada existente
        if (currentBlogData.imagenPortada) {
            const previewImg = document.getElementById('coverPreviewImg');
            const placeholder = document.getElementById('coverPlaceholder');
            const previewContainer = document.getElementById('coverPreviewContainer');

            if (previewImg) previewImg.src = currentBlogData.imagenPortada;
            if (placeholder) placeholder.classList.add('is-hidden');
            if (previewContainer) previewContainer.classList.remove('is-hidden');
        }

        // Contenido HTML
        const visualEditor = document.getElementById('blogContentVisual');
        const rawEditor = document.getElementById('blogContentHtml');
        const html = currentBlogData.contenidoHtml || '';

        if (visualEditor) visualEditor.innerHTML = html;
        if (rawEditor) rawEditor.value = html;

        updateWordCountAndReadTime(html);

    } catch (error) {
        Swal.fire('Error', error.message || 'No se pudo cargar el artículo', 'error');
    }
}

/**
 * Guarda o publica el blog
 * @param {'published'|'draft'} targetStatus
 */
async function handleSave(targetStatus) {
    const title = document.getElementById('blogTitle')?.value.trim();
    const slug = document.getElementById('blogSlug')?.value.trim();
    const resumen = document.getElementById('blogResumen')?.value.trim();
    const categoria = document.getElementById('blogCategory')?.value;
    const tagsRaw = document.getElementById('blogTags')?.value || '';
    const statusSelect = document.getElementById('blogStatus');

    // Obtener contenido HTML según el modo activo
    const visualEditor = document.getElementById('blogContentVisual');
    const rawEditor = document.getElementById('blogContentHtml');
    const contenidoHtml = isVisualMode ? visualEditor.innerHTML : rawEditor.value;

    // Validación preliminar
    if (!title) {
        Swal.fire('Título Requerido', 'Por favor ingresa un título para el artículo.', 'warning');
        return;
    }

    if (!categoria) {
        Swal.fire('Categoría Requerida', 'Por favor selecciona la categoría temática.', 'warning');
        return;
    }

    if (!resumen) {
        Swal.fire('Resumen Requerido', 'Por favor redacta un resumen breve para las carátulas.', 'warning');
        return;
    }

    if (!contenidoHtml || contenidoHtml.trim() === '' || contenidoHtml === '<br>') {
        Swal.fire('Contenido Vacío', 'Por favor redacta el contenido del artículo antes de guardar.', 'warning');
        return;
    }

    // Procesar tags
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    // Estatus final
    const finalStatus = targetStatus || (statusSelect ? statusSelect.value : 'draft');

    const payload = {
        titulo: title,
        slug: slug || BlogModel.generateSlug(title),
        resumen,
        categoria,
        tags,
        contenidoHtml,
        status: finalStatus
    };

    try {
        Swal.fire({
            title: currentBlogId ? 'Actualizando artículo...' : 'Guardando artículo...',
            text: 'Procesando imágenes y sincronizando datos...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let result;
        if (currentBlogId) {
            result = await blogService.updateBlog(currentBlogId, payload, selectedCoverFile);
        } else {
            result = await blogService.createBlog(payload, selectedCoverFile);
        }

        if (!result.success) {
            throw new Error(result.error);
        }

        await Swal.fire({
            icon: 'success',
            title: '¡Guardado Exitoso!',
            html: `El artículo ha sido ${finalStatus === 'published' ? '<strong>publicado</strong>' : 'guardado como <strong>borrador</strong>'}.<br><br>URL: <code>/verBlog?slug=${result.slug || payload.slug}</code>`,
            confirmButtonText: 'Ir a Gestión de Blogs',
            confirmButtonColor: '#1c1948'
        });

        // Redirigir a listado de blogs
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/partner/crudBlogs');
        } else {
            window.location.href = '/partner/crudBlogs';
        }

    } catch (error) {
        console.error('❌ Error guardando blog:', error);
        Swal.fire('Error', error.message || 'No se pudo guardar el artículo.', 'error');
    }
}

/**
 * Modal de Vista Previa
 */
function setupPreviewModal() {
    const btnPreview = document.getElementById('btnPreviewBlog');
    const modal = document.getElementById('modalBlogPreview');
    const btnClose = document.getElementById('btnClosePreviewModal');
    const backdrop = document.getElementById('modalPreviewBackdrop');
    const modalBody = document.getElementById('modalPreviewContent');

    if (!btnPreview || !modal) return;

    const openPreview = () => {
        const title = document.getElementById('blogTitle')?.value || 'Título del Artículo';
        const categoria = document.getElementById('blogCategory')?.value || 'General';
        const visualEditor = document.getElementById('blogContentVisual');
        const rawEditor = document.getElementById('blogContentHtml');
        const html = isVisualMode ? visualEditor.innerHTML : rawEditor.value;
        const readTime = BlogModel.calculateReadTime(html);
        const coverImgSrc = document.getElementById('coverPreviewImg')?.src || '';

        modalBody.innerHTML = `
            <div class="rsi-blog-preview-container">
                <span class="rsi-preview-badge">${escapeHtml(categoria)}</span>
                <h1 class="rsi-preview-title">${escapeHtml(title)}</h1>
                <div class="rsi-preview-meta">
                    <span><i class="fas fa-clock"></i> ${readTime}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date().toLocaleDateString('es-MX')}</span>
                </div>
                ${coverImgSrc ? `<img src="${coverImgSrc}" class="rsi-preview-cover" alt="Portada">` : ''}
                <div class="rsi-preview-body">
                    ${html || '<p class="text-muted">Sin contenido redactado aún.</p>'}
                </div>
            </div>
        `;
        modal.classList.remove('is-hidden');
    };

    const closePreview = () => modal.classList.add('is-hidden');

    addManagedListener(btnPreview, 'click', openPreview);
    if (btnClose) addManagedListener(btnClose, 'click', closePreview);
    if (backdrop) addManagedListener(backdrop, 'click', closePreview);
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
