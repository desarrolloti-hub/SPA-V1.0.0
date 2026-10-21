/* ==========================================================================
   CARRUSEL CRUD CONTROLLER - RSI Enterprise
   Controlador para la administración de diapositivas del carrusel de inicio.
   ========================================================================== */

import { CarruselService } from '../../services/carruselService.js';
import { carouselConfig } from '../../components/carousel/carouselConfig.js';

let carruselService = null;
let eventListeners = [];
let allSlides = [];
let currentFilter = 'all';
let selectedFile = null;

function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

/**
 * Inicializa el controlador del carrusel
 */
export async function carruselCrudController() {
    console.log('🎠 Inicializando Carrusel CRUD Controller...');

    destroyCarruselCrudController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    carruselService = new CarruselService();

    bindEvents();
    await loadSlides(false);

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        if (e.detail && e.detail.path !== '/ecommerce/carrusel' && e.detail.path !== '/partner/carrusel') {
            destroyCarruselCrudController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('✅ Carrusel CRUD Controller listo');
}

/**
 * Enlaza eventos de la vista
 */
function bindEvents() {
    // Botón Actualizar
    const btnRecargar = document.getElementById('btnRecargarCarrusel');
    if (btnRecargar) {
        addManagedListener(btnRecargar, 'click', async () => {
            btnRecargar.disabled = true;
            btnRecargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            await loadSlides(true);
            btnRecargar.disabled = false;
            btnRecargar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
        });
    }

    // Botón Nuevo Slide
    const btnNuevo = document.getElementById('btnNuevoSlide');
    if (btnNuevo) {
        addManagedListener(btnNuevo, 'click', () => {
            abrirModalForm(null);
        });
    }

    // Botón Crear Primera Diapositiva (desde Empty State)
    const btnCrearPrimera = document.getElementById('btnCrearPrimera');
    if (btnCrearPrimera) {
        addManagedListener(btnCrearPrimera, 'click', () => {
            abrirModalForm(null);
        });
    }

    // Botón Sembrar Predeterminados
    const btnSembrar = document.getElementById('btnSembrarPredeterminados');
    if (btnSembrar) {
        addManagedListener(btnSembrar, 'click', async () => {
            await sembrarSlidesIniciales();
        });
    }

    // Pestañas de filtro (Todas, Activas, Inactivas)
    const filterTabs = document.querySelectorAll('.rsi-filter-tab');
    filterTabs.forEach(tab => {
        addManagedListener(tab, 'click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.getAttribute('data-filter') || 'all';
            renderSlidesGrid();
        });
    });

    // Modal Formulario: cerrar
    const btnCerrarModal = document.getElementById('btnCerrarModalSlide');
    const btnCancelarModal = document.getElementById('btnCancelarModalSlide');
    const modalForm = document.getElementById('modalSlideForm');

    const cerrarModal = () => {
        if (modalForm) modalForm.style.display = 'none';
        limpiarFormulario();
    };

    if (btnCerrarModal) addManagedListener(btnCerrarModal, 'click', cerrarModal);
    if (btnCancelarModal) addManagedListener(btnCancelarModal, 'click', cerrarModal);

    if (modalForm) {
        addManagedListener(modalForm, 'click', (e) => {
            if (e.target === modalForm) cerrarModal();
        });
    }

    // Modal Preview: cerrar
    const modalPreview = document.getElementById('modalSlidePreviewFullscreen');
    const btnCerrarPreview = document.getElementById('btnCerrarPreviewFullscreen');
    const cerrarPreview = () => {
        if (modalPreview) modalPreview.style.display = 'none';
    };
    if (btnCerrarPreview) addManagedListener(btnCerrarPreview, 'click', cerrarPreview);
    if (modalPreview) {
        addManagedListener(modalPreview, 'click', (e) => {
            if (e.target === modalPreview) cerrarPreview();
        });
    }

    // Tecla Escape para modales
    addManagedListener(document, 'keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalForm && modalForm.style.display !== 'none') cerrarModal();
            if (modalPreview && modalPreview.style.display !== 'none') cerrarPreview();
        }
    });

    // Pestañas de origen de imagen en el formulario (Subir Archivo vs URL)
    const tabSourceFile = document.getElementById('tabSourceFile');
    const tabSourceUrl = document.getElementById('tabSourceUrl');
    const wrapperSourceFile = document.getElementById('wrapperSourceFile');
    const wrapperSourceUrl = document.getElementById('wrapperSourceUrl');

    if (tabSourceFile && tabSourceUrl) {
        addManagedListener(tabSourceFile, 'click', () => {
            tabSourceFile.classList.add('active');
            tabSourceUrl.classList.remove('active');
            if (wrapperSourceFile) wrapperSourceFile.style.display = 'block';
            if (wrapperSourceUrl) wrapperSourceUrl.style.display = 'none';
        });

        addManagedListener(tabSourceUrl, 'click', () => {
            tabSourceUrl.classList.add('active');
            tabSourceFile.classList.remove('active');
            if (wrapperSourceFile) wrapperSourceFile.style.display = 'none';
            if (wrapperSourceUrl) wrapperSourceUrl.style.display = 'block';
        });
    }

    // Botón selector de archivo
    const btnSelectFile = document.getElementById('btnSeleccionarArchivo');
    const fileInput = document.getElementById('slideFileInput');
    const fileNameSpan = document.getElementById('slideFileName');
    const previewWrapper = document.getElementById('slideImagePreviewWrapper');
    const previewImg = document.getElementById('slidePreviewImg');

    if (btnSelectFile && fileInput) {
        addManagedListener(btnSelectFile, 'click', () => fileInput.click());
        addManagedListener(fileInput, 'change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                selectedFile = file;
                if (fileNameSpan) fileNameSpan.textContent = `Archivo seleccionado: ${file.name} (${Math.round(file.size / 1024)} KB)`;
                
                // Mostrar preview local con FileReader
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (previewImg) previewImg.src = ev.target.result;
                    if (previewWrapper) previewWrapper.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Input URL de imagen
    const inputUrl = document.getElementById('slideImageUrl');
    if (inputUrl) {
        addManagedListener(inputUrl, 'input', (e) => {
            const url = (e.target.value || '').trim();
            if (url) {
                if (previewImg) previewImg.src = url;
                if (previewWrapper) previewWrapper.style.display = 'block';
            } else if (!selectedFile) {
                if (previewWrapper) previewWrapper.style.display = 'none';
            }
        });
    }

    // Checkbox de botón con enlace
    const checkHasButton = document.getElementById('slideHasButton');
    const buttonFields = document.getElementById('slideButtonFields');
    if (checkHasButton && buttonFields) {
        addManagedListener(checkHasButton, 'change', () => {
            buttonFields.style.display = checkHasButton.checked ? 'flex' : 'none';
        });
    }

    // Chips de sugerencia de enlace
    const chipBtns = document.querySelectorAll('.rsi-chip-btn');
    const linkInput = document.getElementById('slideButtonLink');
    chipBtns.forEach(chip => {
        addManagedListener(chip, 'click', () => {
            const link = chip.getAttribute('data-link');
            if (linkInput && link) {
                linkInput.value = link;
            }
        });
    });

    // Envío del formulario
    const form = document.getElementById('formSlide');
    if (form) {
        addManagedListener(form, 'submit', async (e) => {
            e.preventDefault();
            await guardarSlide();
        });
    }
}

/**
 * Carga las diapositivas de Firestore
 */
async function loadSlides(forceRefresh = false) {
    const loadingEl = document.getElementById('carruselLoading');
    const emptyEl = document.getElementById('carruselEmptyState');
    const gridEl = document.getElementById('carruselGrid');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';

    try {
        allSlides = await carruselService.getAllSlides(forceRefresh);

        renderKpis();

        if (loadingEl) loadingEl.style.display = 'none';

        if (allSlides.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (gridEl) gridEl.style.display = 'none';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            if (gridEl) gridEl.style.display = 'grid';
            renderSlidesGrid();
        }

    } catch (error) {
        console.error('❌ Error cargando diapositivas:', error);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x" style="color: var(--rsi-danger, #ef4444);"></i>
                <p style="margin-top: 10px;">Error al cargar diapositivas: ${escapeHtml(error.message)}</p>
            `;
        }
    }
}

/**
 * Actualiza los contadores de métricas
 */
function renderKpis() {
    const total = allSlides.length;
    const activos = allSlides.filter(s => s.activo !== false).length;
    const inactivos = total - activos;
    const conBoton = allSlides.filter(s => s.hasButton && s.button?.text).length;

    const elTotal = document.getElementById('statTotalSlides');
    const elActivos = document.getElementById('statActivos');
    const elInactivos = document.getElementById('statInactivos');
    const elConBoton = document.getElementById('statConBoton');
    const badgeCount = document.getElementById('slidesCountBadge');

    if (elTotal) elTotal.textContent = total;
    if (elActivos) elActivos.textContent = activos;
    if (elInactivos) elInactivos.textContent = inactivos;
    if (elConBoton) elConBoton.textContent = conBoton;
    if (badgeCount) badgeCount.textContent = total;
}

/**
 * Renderiza el Grid de diapositivas según el filtro actual
 */
function renderSlidesGrid() {
    const grid = document.getElementById('carruselGrid');
    if (!grid) return;

    let slidesFiltrados = [...allSlides];
    if (currentFilter === 'active') {
        slidesFiltrados = slidesFiltrados.filter(s => s.activo !== false);
    } else if (currentFilter === 'inactive') {
        slidesFiltrados = slidesFiltrados.filter(s => s.activo === false);
    }

    if (slidesFiltrados.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--rsi-text-secondary); background: var(--rsi-card-bg); border-radius: var(--rsi-radius); border: 1px dashed var(--rsi-border-color);">
                <i class="fas fa-filter fa-2x" style="opacity: 0.4; margin-bottom: 8px;"></i>
                <p style="margin: 0;">No hay diapositivas con el filtro seleccionado ("${escapeHtml(currentFilter)}").</p>
            </div>
        `;
        return;
    }

    const htmlCards = slidesFiltrados.map((slide, index) => {
        const esActivo = slide.activo !== false;
        const tieneTitulo = Boolean(slide.title && slide.title.trim());
        const tieneDesc = Boolean(slide.description && slide.description.trim());
        const tieneBoton = Boolean(slide.hasButton && slide.button?.text);

        const isFirst = index === 0;
        const isLast = index === slidesFiltrados.length - 1;

        return `
            <div class="rsi-carrusel-card ${esActivo ? '' : 'inactivo'}" data-id="${escapeHtml(slide.id)}">
                
                <!-- Media / Imagen -->
                <div class="rsi-carrusel-card-media">
                    <img src="${escapeHtml(slide.image)}" alt="${escapeHtml(slide.title || 'Slide')}" class="rsi-carrusel-card-img" onerror="this.src='/assets/images/placeholder.jpg';" />
                    
                    <div class="rsi-carrusel-card-badges">
                        <span class="rsi-badge-orden">
                            <i class="fas fa-layer-group"></i> #${slide.orden || (index + 1)}
                        </span>
                        <span class="rsi-badge-estado ${esActivo ? 'activo' : 'inactivo'}">
                            ${esActivo ? '<i class="fas fa-check"></i> Activo' : '<i class="fas fa-eye-slash"></i> Inactivo'}
                        </span>
                    </div>
                </div>

                <!-- Contenido -->
                <div class="rsi-carrusel-card-body">
                    <h3 class="rsi-carrusel-card-title ${tieneTitulo ? '' : 'sin-titulo'}">
                        ${tieneTitulo ? escapeHtml(slide.title) : '(Sin título - Solo banner visual)'}
                    </h3>

                    <p class="rsi-carrusel-card-desc ${tieneDesc ? '' : 'sin-desc'}">
                        ${tieneDesc ? escapeHtml(slide.description) : 'Sin descripción asignada.'}
                    </p>

                    <!-- Info de Botón -->
                    <div class="rsi-carrusel-card-btn-info">
                        <i class="fas fa-link"></i>
                        <span>
                            ${tieneBoton ? `Botón: <strong>"${escapeHtml(slide.button.text)}"</strong> &rarr; <code>${escapeHtml(slide.button.link || '#')}</code>` : '<em>Sin botón de enlace</em>'}
                        </span>
                    </div>

                    <!-- Barra de Acciones -->
                    <div class="rsi-carrusel-card-actions">
                        <!-- Botones de Reordenar -->
                        <div class="rsi-order-arrows">
                            <button type="button" class="rsi-btn-order-arrow btn-mover-arriba" data-id="${escapeHtml(slide.id)}" title="Mover arriba" ${isFirst ? 'disabled' : ''}>
                                <i class="fas fa-arrow-up"></i>
                            </button>
                            <button type="button" class="rsi-btn-order-arrow btn-mover-abajo" data-id="${escapeHtml(slide.id)}" title="Mover abajo" ${isLast ? 'disabled' : ''}>
                                <i class="fas fa-arrow-down"></i>
                            </button>
                        </div>

                        <!-- Botones de Acción -->
                        <div style="display: flex; gap: 6px;">
                            <button type="button" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-outline btn-preview-slide" data-id="${escapeHtml(slide.id)}" title="Previsualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-outline btn-toggle-activo" data-id="${escapeHtml(slide.id)}" data-activo="${esActivo}" title="${esActivo ? 'Desactivar' : 'Activar'}">
                                <i class="fas ${esActivo ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${esActivo ? 'var(--rsi-success)' : 'var(--rsi-text-muted)'};"></i>
                            </button>
                            <a href="/ecommerce/carrusel-form?id=${encodeURIComponent(slide.id)}" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-secondary" data-link title="Editar diapositiva">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button type="button" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-danger btn-eliminar-slide" data-id="${escapeHtml(slide.id)}" title="Eliminar diapositiva">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }).join('');

    grid.innerHTML = htmlCards;

    // Enlazar botones interactivos del grid
    grid.querySelectorAll('.btn-eliminar-slide').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const id = btn.getAttribute('data-id');
            await confirmarEliminarSlide(id);
        });
    });

    grid.querySelectorAll('.btn-toggle-activo').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const id = btn.getAttribute('data-id');
            const estadoActual = btn.getAttribute('data-activo') === 'true';
            await alternarEstadoSlide(id, !estadoActual);
        });
    });

    grid.querySelectorAll('.btn-preview-slide').forEach(btn => {
        addManagedListener(btn, 'click', () => {
            const id = btn.getAttribute('data-id');
            const slide = allSlides.find(s => s.id === id);
            if (slide) mostrarPreviewFullscreen(slide);
        });
    });

    grid.querySelectorAll('.btn-mover-arriba').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const id = btn.getAttribute('data-id');
            await moverOrdenSlide(id, -1);
        });
    });

    grid.querySelectorAll('.btn-mover-abajo').forEach(btn => {
        addManagedListener(btn, 'click', async () => {
            const id = btn.getAttribute('data-id');
            await moverOrdenSlide(id, 1);
        });
    });
}

/**
 * Abre el modal de formulario en modo creación o edición
 */
function abrirModalForm(slide = null) {
    const modal = document.getElementById('modalSlideForm');
    const modalTitle = document.getElementById('modalSlideTitle');
    const inputDocId = document.getElementById('slideDocId');
    const inputTitle = document.getElementById('slideTitle');
    const inputDesc = document.getElementById('slideDescription');
    const checkHasButton = document.getElementById('slideHasButton');
    const buttonFields = document.getElementById('slideButtonFields');
    const inputBtnText = document.getElementById('slideButtonText');
    const inputBtnLink = document.getElementById('slideButtonLink');
    const inputBtnIcon = document.getElementById('slideButtonIcon');
    const inputOrden = document.getElementById('slideOrden');
    const checkActivo = document.getElementById('slideActivo');
    const previewWrapper = document.getElementById('slideImagePreviewWrapper');
    const previewImg = document.getElementById('slidePreviewImg');
    const inputUrl = document.getElementById('slideImageUrl');
    const tabSourceFile = document.getElementById('tabSourceFile');
    const tabSourceUrl = document.getElementById('tabSourceUrl');
    const wrapperSourceFile = document.getElementById('wrapperSourceFile');
    const wrapperSourceUrl = document.getElementById('wrapperSourceUrl');

    limpiarFormulario();

    if (slide) {
        // Modo Edición
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Diapositiva';
        if (inputDocId) inputDocId.value = slide.id;
        if (inputTitle) inputTitle.value = slide.title || '';
        if (inputDesc) inputDesc.value = slide.description || '';
        
        const hasBtn = Boolean(slide.hasButton && slide.button?.text);
        if (checkHasButton) checkHasButton.checked = hasBtn;
        if (buttonFields) buttonFields.style.display = hasBtn ? 'flex' : 'none';
        if (inputBtnText) inputBtnText.value = slide.button?.text || '';
        if (inputBtnLink) inputBtnLink.value = slide.button?.link || '';
        if (inputBtnIcon) inputBtnIcon.value = slide.button?.icon || 'fas fa-arrow-right';

        if (inputOrden) inputOrden.value = slide.orden || 1;
        if (checkActivo) checkActivo.checked = slide.activo !== false;

        // Mostrar imagen actual en preview
        if (slide.image) {
            if (previewImg) previewImg.src = slide.image;
            if (previewWrapper) previewWrapper.style.display = 'block';
            if (inputUrl) inputUrl.value = slide.image;
        }

        // Si la imagen es externa, activar tab URL
        if (slide.image && !slide.imagePath) {
            if (tabSourceUrl) tabSourceUrl.click();
        } else {
            if (tabSourceFile) tabSourceFile.click();
        }

    } else {
        // Modo Creación
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-image"></i> Nueva Diapositiva';
        if (inputDocId) inputDocId.value = '';
        if (inputOrden) inputOrden.value = (allSlides.length + 1);
        if (checkActivo) checkActivo.checked = true;
        if (tabSourceFile) tabSourceFile.click();
    }

    if (modal) modal.style.display = 'flex';
}

/**
 * Limpia los campos del formulario
 */
function limpiarFormulario() {
    selectedFile = null;
    const fileInput = document.getElementById('slideFileInput');
    if (fileInput) fileInput.value = '';

    const fileNameSpan = document.getElementById('slideFileName');
    if (fileNameSpan) fileNameSpan.textContent = 'Recomendado: 1920x800 o resolución panorámica HD';

    const inputUrl = document.getElementById('slideImageUrl');
    if (inputUrl) inputUrl.value = '';

    const previewWrapper = document.getElementById('slideImagePreviewWrapper');
    if (previewWrapper) previewWrapper.style.display = 'none';

    const previewImg = document.getElementById('slidePreviewImg');
    if (previewImg) previewImg.src = '';

    const form = document.getElementById('formSlide');
    if (form) form.reset();

    const buttonFields = document.getElementById('slideButtonFields');
    if (buttonFields) buttonFields.style.display = 'none';
}

/**
 * Guarda o actualiza un slide
 */
async function guardarSlide() {
    const btnGuardar = document.getElementById('btnGuardarSlide');
    const docId = (document.getElementById('slideDocId')?.value || '').trim();
    const title = (document.getElementById('slideTitle')?.value || '').trim();
    const description = (document.getElementById('slideDescription')?.value || '').trim();
    const hasButton = Boolean(document.getElementById('slideHasButton')?.checked);
    const buttonText = (document.getElementById('slideButtonText')?.value || '').trim();
    const buttonLink = (document.getElementById('slideButtonLink')?.value || '').trim();
    const buttonIcon = (document.getElementById('slideButtonIcon')?.value || 'fas fa-arrow-right').trim();
    const orden = parseInt(document.getElementById('slideOrden')?.value, 10) || 1;
    const activo = Boolean(document.getElementById('slideActivo')?.checked);
    const imageUrl = (document.getElementById('slideImageUrl')?.value || '').trim();

    // Validar imagen
    if (!selectedFile && !imageUrl && !docId) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Imagen requerida',
                text: 'Debes seleccionar un archivo de imagen o ingresar una URL.',
                confirmButtonColor: '#1c1948'
            });
        }
        return;
    }

    if (hasButton && (!buttonText || !buttonLink)) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Datos del botón incompletos',
                text: 'Si activas el botón, debes ingresar tanto el texto como el enlace/ruta de destino.',
                confirmButtonColor: '#1c1948'
            });
        }
        return;
    }

    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
        const payload = {
            title,
            description,
            hasButton,
            buttonText,
            buttonLink,
            buttonIcon,
            orden,
            activo,
            image: imageUrl || ''
        };

        let result;
        if (docId) {
            // Actualizar
            result = await carruselService.updateSlide(docId, payload, selectedFile);
        } else {
            // Crear
            result = await carruselService.createSlide(payload, selectedFile);
        }

        if (!result.success) {
            throw new Error(result.error || 'No se pudo guardar la diapositiva');
        }

        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: '¡Operación exitosa!',
                text: result.message || 'Diapositiva guardada correctamente.',
                timer: 2000,
                showConfirmButton: false
            });
        }

        const modal = document.getElementById('modalSlideForm');
        if (modal) modal.style.display = 'none';
        limpiarFormulario();

        await loadSlides(true);

    } catch (err) {
        console.error('Error guardando slide:', err);
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                text: err.message || 'Ocurrió un problema inesperado',
                confirmButtonColor: '#1c1948'
            });
        }
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Diapositiva';
        }
    }
}

/**
 * Alterna el estado activo de un slide
 */
async function alternarEstadoSlide(id, nuevoEstado) {
    try {
        const res = await carruselService.toggleActivo(id, nuevoEstado);
        if (!res.success) throw new Error(res.error);

        // Actualizar estado en memoria
        const item = allSlides.find(s => s.id === id);
        if (item) item.activo = nuevoEstado;

        renderKpis();
        renderSlidesGrid();

    } catch (err) {
        console.error('Error cambiando estado:', err);
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message || 'No fue posible actualizar el estado',
                confirmButtonColor: '#1c1948'
            });
        }
    }
}

/**
 * Mueve la posición de un slide (arriba o abajo)
 */
async function moverOrdenSlide(id, direction) {
    const currentIndex = allSlides.findIndex(s => s.id === id);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= allSlides.length) return;

    // Intercambiar orden entre los dos slides
    const currentSlide = allSlides[currentIndex];
    const targetSlide = allSlides[targetIndex];

    const currentOrden = currentSlide.orden || (currentIndex + 1);
    const targetOrden = targetSlide.orden || (targetIndex + 1);

    const items = [
        { id: currentSlide.id, orden: targetOrden },
        { id: targetSlide.id, orden: currentOrden }
    ];

    try {
        await carruselService.reordenarSlides(items);
        await loadSlides(true);
    } catch (err) {
        console.error('Error reordenando slides:', err);
    }
}

/**
 * Confirmación y eliminación de slide
 */
async function confirmarEliminarSlide(id) {
    if (!window.Swal) return;

    const confirm = await Swal.fire({
        title: '¿Eliminar diapositiva?',
        text: 'Esta acción removerá el banner del carrusel de inicio y eliminará su imagen de Storage.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await carruselService.deleteSlide(id);
            if (!res.success) throw new Error(res.error);

            await Swal.fire({
                icon: 'success',
                title: 'Eliminada',
                text: 'La diapositiva fue eliminada exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

            await loadSlides(true);
        } catch (err) {
            console.error('Error al eliminar slide:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message || 'No se pudo eliminar la diapositiva.',
                confirmButtonColor: '#1c1948'
            });
        }
    }
}

/**
 * Previsualización en modal fullscreen
 */
function mostrarPreviewFullscreen(slide) {
    const modal = document.getElementById('modalSlidePreviewFullscreen');
    const mockup = document.getElementById('previewSlideMockup');
    if (!modal || !mockup) return;

    const tieneTitulo = Boolean(slide.title && slide.title.trim());
    const tieneDesc = Boolean(slide.description && slide.description.trim());
    const tieneBoton = Boolean(slide.hasButton && slide.button?.text);

    mockup.innerHTML = `
        <img src="${escapeHtml(slide.image)}" alt="Preview" />
        
        ${(tieneTitulo || tieneDesc || tieneBoton) ? `
            <div class="rsi-slide-mockup-content">
                ${tieneTitulo ? `<h2>${escapeHtml(slide.title)}</h2>` : ''}
                ${tieneDesc ? `<p>${escapeHtml(slide.description)}</p>` : ''}
                ${tieneBoton ? `
                    <a href="${escapeHtml(slide.button.link || '#')}" class="btn-mockup" target="_blank">
                        <span>${escapeHtml(slide.button.text)}</span>
                        ${slide.button.icon ? `<i class="${escapeHtml(slide.button.icon)}"></i>` : ''}
                    </a>
                ` : ''}
            </div>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

/**
 * Si la base de datos está vacía, permite importar las diapositivas estáticas iniciales
 */
async function sembrarSlidesIniciales() {
    if (!carouselConfig || !Array.isArray(carouselConfig.slides) || carouselConfig.slides.length === 0) {
        return;
    }

    if (window.Swal) {
        const confirm = await Swal.fire({
            title: '¿Importar diapositivas predeterminadas?',
            text: `Se crearán ${carouselConfig.slides.length} diapositivas en Firestore basadas en el contenido predeterminado del sitio.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#1c1948',
            confirmButtonText: 'Sí, importar ahora'
        });

        if (!confirm.isConfirmed) return;
    }

    try {
        const res = await carruselService.sembrarSlidesPredeterminados(carouselConfig.slides);
        if (!res.success) throw new Error(res.error);

        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: '¡Importación completada!',
                text: res.message || 'Se importaron las diapositivas con éxito.',
                timer: 2000,
                showConfirmButton: false
            });
        }

        await loadSlides(true);

    } catch (err) {
        console.error('Error sembrando slides:', err);
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message || 'No fue posible importar las diapositivas.',
                confirmButtonColor: '#1c1948'
            });
        }
    }
}

/**
 * Escapa HTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Limpieza al destruir el controlador
 */
export function destroyCarruselCrudController() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        if (element) {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                // Silenciar
            }
        }
    });
    eventListeners = [];

    const modalForm = document.getElementById('modalSlideForm');
    const modalPreview = document.getElementById('modalSlidePreviewFullscreen');
    if (modalForm) modalForm.style.display = 'none';
    if (modalPreview) modalPreview.style.display = 'none';
}

export default carruselCrudController;
