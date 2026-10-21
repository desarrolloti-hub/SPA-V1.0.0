/* ==========================================================================
   CARRUSEL FORM CONTROLLER - RSI Enterprise
   Controlador para la vista dedicada de creación y edición de diapositivas
   con previsualización interactiva en tiempo real (Live Preview).
   ========================================================================== */

import { CarruselService } from '../../services/carruselService.js';

let carruselService = null;
let eventListeners = [];
let selectedFile = null;
let currentSlideId = null;
let existingSlideData = null;

function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

/**
 * Inicializa el controlador del formulario de diapositiva
 */
export async function carruselFormController() {
    console.log('🖼️ Inicializando Carrusel Form Controller...');

    destroyCarruselFormController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    carruselService = new CarruselService();

    // Extraer ID de la URL si estamos en modo edición
    const urlParams = new URLSearchParams(window.location.search);
    currentSlideId = urlParams.get('id');

    bindEvents();
    await initFormMode();

    // Limpieza al salir de la ruta
    const onRouteChanging = (e) => {
        if (e.detail && !e.detail.path.includes('carrusel-form')) {
            destroyCarruselFormController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('✅ Carrusel Form Controller listo');
}

/**
 * Inicializa el formulario según sea modo Creación o Edición
 */
async function initFormMode() {
    const txtAccion = document.getElementById('txtAccionTitulo');
    const badgeModo = document.getElementById('badgeModoSlide');
    const inputDocId = document.getElementById('slideDocId');
    const inputOrden = document.getElementById('slideOrden');

    if (currentSlideId) {
        // Modo Edición
        if (txtAccion) txtAccion.textContent = 'Editar';
        if (badgeModo) badgeModo.innerHTML = '<i class="fas fa-edit"></i> Editar Diapositiva';
        document.title = 'Editar Diapositiva | RSI Enterprise';
        if (inputDocId) inputDocId.value = currentSlideId;

        await cargarDatosSlide(currentSlideId);
    } else {
        // Modo Creación
        if (txtAccion) txtAccion.textContent = 'Nueva';
        if (badgeModo) badgeModo.innerHTML = '<i class="fas fa-plus"></i> Nueva Diapositiva';
        document.title = 'Nueva Diapositiva | RSI Enterprise';
        if (inputDocId) inputDocId.value = '';

        // Calcular orden por defecto
        try {
            const allSlides = await carruselService.getAllSlides(false);
            if (inputOrden) inputOrden.value = (allSlides.length + 1);
        } catch {
            if (inputOrden) inputOrden.value = 1;
        }

        updateLivePreview();
    }
}

/**
 * Carga los datos existentes de una diapositiva para edición
 */
async function cargarDatosSlide(id) {
    try {
        const slide = await carruselService.getSlideById(id);
        if (!slide) {
            throw new Error('No se encontró la diapositiva solicitada.');
        }

        existingSlideData = slide;

        const inputTitle = document.getElementById('slideTitle');
        const inputDesc = document.getElementById('slideDescription');
        const checkHasButton = document.getElementById('slideHasButton');
        const buttonFields = document.getElementById('slideButtonFields');
        const inputBtnText = document.getElementById('slideButtonText');
        const inputBtnLink = document.getElementById('slideButtonLink');
        const inputBtnIcon = document.getElementById('slideButtonIcon');
        const inputOrden = document.getElementById('slideOrden');
        const checkActivo = document.getElementById('slideActivo');
        const inputUrl = document.getElementById('slideImageUrl');
        const tabSourceUrl = document.getElementById('tabSourceUrl');
        const tabSourceFile = document.getElementById('tabSourceFile');
        const fileNameSpan = document.getElementById('slideFileName');

        if (inputTitle) inputTitle.value = slide.title || '';
        if (inputDesc) inputDesc.value = slide.description || '';

        const hasBtn = Boolean(slide.hasButton && slide.button?.text);
        if (checkHasButton) checkHasButton.checked = hasBtn;
        if (buttonFields) buttonFields.style.display = hasBtn ? 'flex' : 'none';
        if (inputBtnText) inputBtnText.value = slide.button?.text || '';
        if (inputBtnLink) inputBtnLink.value = slide.button?.link || '';
        if (inputBtnIcon) inputBtnIcon.value = slide.button?.icon || 'fas fa-arrow-right';

        if (inputOrden) inputOrden.value = slide.orden || 1;
        if (checkActivo) {
            checkActivo.checked = slide.activo !== false;
            actualizarBadgeEstado(checkActivo.checked);
        }

        if (slide.image) {
            if (inputUrl) inputUrl.value = slide.image;
            if (fileNameSpan) {
                fileNameSpan.textContent = `Imagen actual: ${slide.imagePath ? slide.imagePath : 'Enlace externo'}`;
                fileNameSpan.style.display = 'inline-block';
            }

            // Si es URL externa (no Storage), activar tab de URL
            if (!slide.imagePath && tabSourceUrl) {
                tabSourceUrl.click();
            } else if (tabSourceFile) {
                tabSourceFile.click();
            }
        }

        actualizarContadorCaracteres();
        updateLivePreview();

    } catch (error) {
        console.error('Error cargando slide:', error);
        if (window.Swal) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo cargar la información de la diapositiva.',
                confirmButtonColor: '#1c1948'
            });
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/ecommerce/carrusel');
            } else {
                window.location.href = '/ecommerce/carrusel';
            }
        }
    }
}

/**
 * Enlaza eventos de la interfaz y Live Preview en tiempo real
 */
function bindEvents() {
    // Pestañas de origen de imagen
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
            updateLivePreview();
        });

        addManagedListener(tabSourceUrl, 'click', () => {
            tabSourceUrl.classList.add('active');
            tabSourceFile.classList.remove('active');
            if (wrapperSourceFile) wrapperSourceFile.style.display = 'none';
            if (wrapperSourceUrl) wrapperSourceUrl.style.display = 'block';
            updateLivePreview();
        });
    }

    // Dropzone y selector de archivo
    const dropzone = document.getElementById('dropzoneTrigger');
    const fileInput = document.getElementById('slideFileInput');
    const fileNameSpan = document.getElementById('slideFileName');

    if (dropzone && fileInput) {
        addManagedListener(dropzone, 'click', () => fileInput.click());

        // Eventos Drag and Drop
        addManagedListener(dropzone, 'dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        addManagedListener(dropzone, 'dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        addManagedListener(dropzone, 'drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                fileInput.files = files;
                handleFileSelected(files[0]);
            }
        });

        addManagedListener(fileInput, 'change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFileSelected(file);
        });
    }

    // Input de URL de imagen
    const inputUrl = document.getElementById('slideImageUrl');
    if (inputUrl) {
        addManagedListener(inputUrl, 'input', () => {
            updateLivePreview();
        });
    }

    // Título y descripción (Live Preview reactivo)
    const inputTitle = document.getElementById('slideTitle');
    if (inputTitle) {
        addManagedListener(inputTitle, 'input', () => {
            updateLivePreview();
        });
    }

    const inputDesc = document.getElementById('slideDescription');
    if (inputDesc) {
        addManagedListener(inputDesc, 'input', () => {
            actualizarContadorCaracteres();
            updateLivePreview();
        });
    }

    // Checkbox de botón
    const checkHasButton = document.getElementById('slideHasButton');
    const buttonFields = document.getElementById('slideButtonFields');
    if (checkHasButton && buttonFields) {
        addManagedListener(checkHasButton, 'change', () => {
            buttonFields.style.display = checkHasButton.checked ? 'flex' : 'none';
            updateLivePreview();
        });
    }

    // Campos del botón
    const inputBtnText = document.getElementById('slideButtonText');
    if (inputBtnText) {
        addManagedListener(inputBtnText, 'input', () => {
            updateLivePreview();
        });
    }

    const inputBtnIcon = document.getElementById('slideButtonIcon');
    const iconPreview = document.getElementById('iconPreviewEl');
    if (inputBtnIcon) {
        addManagedListener(inputBtnIcon, 'input', () => {
            const iconClass = (inputBtnIcon.value || 'fas fa-arrow-right').trim();
            if (iconPreview) iconPreview.className = iconClass;
            updateLivePreview();
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
                updateLivePreview();
            }
        });
    });

    // Checkbox Activo
    const checkActivo = document.getElementById('slideActivo');
    if (checkActivo) {
        addManagedListener(checkActivo, 'change', () => {
            actualizarBadgeEstado(checkActivo.checked);
        });
    }

    // Envío del formulario
    const form = document.getElementById('formSlideCompleto');
    if (form) {
        addManagedListener(form, 'submit', async (e) => {
            e.preventDefault();
            await guardarSlide();
        });
    }
}

/**
 * Procesa la selección de un archivo local de imagen
 */
function handleFileSelected(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Formato no válido',
                text: 'El archivo seleccionado no es una imagen válida (JPG, PNG, WEBP).',
                confirmButtonColor: '#1c1948'
            });
        }
        return;
    }

    selectedFile = file;

    const fileNameSpan = document.getElementById('slideFileName');
    if (fileNameSpan) {
        fileNameSpan.textContent = `Archivo: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        fileNameSpan.style.display = 'inline-block';
    }

    // Leer como DataURL para Live Preview inmediato
    const reader = new FileReader();
    reader.onload = (ev) => {
        const previewImg = document.getElementById('livePreviewImg');
        const placeholder = document.getElementById('livePreviewPlaceholder');
        if (previewImg) {
            previewImg.src = ev.target.result;
            previewImg.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

/**
 * Actualiza el contador de caracteres de la descripción
 */
function actualizarContadorCaracteres() {
    const inputDesc = document.getElementById('slideDescription');
    const charCountEl = document.getElementById('charCountDesc');
    if (inputDesc && charCountEl) {
        charCountEl.textContent = `${inputDesc.value.length} / 280 caracteres`;
    }
}

/**
 * Actualiza la etiqueta de estado en la cabecera
 */
function actualizarBadgeEstado(activo) {
    const badge = document.getElementById('badgeEstadoSlide');
    const label = document.getElementById('slideActivoLabel');
    if (badge) {
        badge.className = `rsi-badge ${activo ? 'rsi-badge-success' : 'rsi-badge-secondary'}`;
        badge.innerHTML = activo ? '<i class="fas fa-check"></i> Activa en Home' : '<i class="fas fa-eye-slash"></i> Inactiva';
    }
    if (label) {
        label.textContent = activo ? 'Activa en Home' : 'Inactiva (No visible en Home)';
        label.style.color = activo ? 'var(--rsi-success, #10b981)' : 'var(--rsi-text-muted, #94a3b8)';
    }
}

/**
 * Actualiza la previsualización en tiempo real (Live Preview)
 */
function updateLivePreview() {
    const previewImg = document.getElementById('livePreviewImg');
    const placeholder = document.getElementById('livePreviewPlaceholder');
    const overlay = document.getElementById('liveContentOverlay');
    const previewTitle = document.getElementById('livePreviewTitle');
    const previewDesc = document.getElementById('livePreviewDesc');
    const btnWrapper = document.getElementById('livePreviewBtnWrapper');
    const btnTextEl = document.getElementById('livePreviewBtnText');
    const btnIconEl = document.getElementById('livePreviewBtnIcon');

    // 1. Imagen
    let currentImageSrc = '';
    const tabSourceUrl = document.getElementById('tabSourceUrl');
    const inputUrl = document.getElementById('slideImageUrl');

    if (selectedFile) {
        // Ya se asignó con FileReader
    } else if (tabSourceUrl && tabSourceUrl.classList.contains('active') && inputUrl && inputUrl.value.trim()) {
        currentImageSrc = inputUrl.value.trim();
    } else if (existingSlideData && existingSlideData.image) {
        currentImageSrc = existingSlideData.image;
    }

    if (currentImageSrc && previewImg) {
        previewImg.src = currentImageSrc;
        previewImg.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else if (!selectedFile && previewImg) {
        previewImg.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }

    // 2. Textos
    const titleVal = (document.getElementById('slideTitle')?.value || '').trim();
    const descVal = (document.getElementById('slideDescription')?.value || '').trim();

    if (titleVal && previewTitle) {
        previewTitle.textContent = titleVal;
        previewTitle.style.display = 'block';
    } else if (previewTitle) {
        previewTitle.style.display = 'none';
    }

    if (descVal && previewDesc) {
        previewDesc.textContent = descVal;
        previewDesc.style.display = 'block';
    } else if (previewDesc) {
        previewDesc.style.display = 'none';
    }

    // 3. Botón
    const hasButton = Boolean(document.getElementById('slideHasButton')?.checked);
    const btnTextVal = (document.getElementById('slideButtonText')?.value || '').trim();
    const btnIconVal = (document.getElementById('slideButtonIcon')?.value || 'fas fa-arrow-right').trim();

    if (hasButton && btnTextVal && btnWrapper) {
        btnWrapper.style.display = 'inline-block';
        if (btnTextEl) btnTextEl.textContent = btnTextVal;
        if (btnIconEl) btnIconEl.className = btnIconVal;
    } else if (btnWrapper) {
        btnWrapper.style.display = 'none';
    }

    // Mostrar overlay solo si hay título, descripción o botón
    const hasContent = Boolean(titleVal || descVal || (hasButton && btnTextVal));
    if (overlay) {
        overlay.style.display = hasContent ? 'block' : 'none';
    }
}

/**
 * Guarda los cambios de la diapositiva en Firestore / Storage
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
    if (!selectedFile && !imageUrl && !existingSlideData?.image) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Imagen requerida',
                text: 'Debes seleccionar un archivo de imagen o ingresar una URL válida.',
                confirmButtonColor: '#1c1948'
            });
        }
        return;
    }

    // Validar botón
    if (hasButton && (!buttonText || !buttonLink)) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Datos del botón incompletos',
                text: 'Si activas el botón, debes ingresar tanto el texto como el enlace o ruta de destino.',
                confirmButtonColor: '#1c1948'
            });
        }
        return;
    }

    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando diapositiva...';
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
            image: imageUrl || existingSlideData?.image || ''
        };

        let result;
        if (docId) {
            result = await carruselService.updateSlide(docId, payload, selectedFile);
        } else {
            result = await carruselService.createSlide(payload, selectedFile);
        }

        if (!result.success) {
            throw new Error(result.error || 'No fue posible guardar la diapositiva.');
        }

        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: '¡Diapositiva Guardada!',
                text: result.message || 'La diapositiva se registró exitosamente.',
                timer: 1800,
                showConfirmButton: false
            });
        }

        // Redirigir al listado de diapositivas
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/ecommerce/carrusel');
        } else {
            window.location.href = '/ecommerce/carrusel';
        }

    } catch (err) {
        console.error('Error al guardar slide:', err);
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                text: err.message || 'Ocurrió un problema inesperado al guardar la diapositiva.',
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
 * Limpieza al salir de la vista
 */
export function destroyCarruselFormController() {
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
    selectedFile = null;
    currentSlideId = null;
    existingSlideData = null;
}

export default carruselFormController;
