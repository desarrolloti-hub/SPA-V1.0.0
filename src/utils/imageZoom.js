/* ==========================================================================
   IMAGE ZOOM UTILITY - RSI ENTERPRISE
   Visor global de imágenes a tamaño de pantalla completa (100vw x 100vh) con
   zoom interactivo de alta precisión: acercar/alejar (+/-), rueda del ratón,
   clic para hacer zoom en el punto seleccionado, arrastre libre (pan) y
   pellizco táctil a 2 dedos (pinch-to-zoom).
   ========================================================================== */

const EXCLUDED_SELECTORS = [
    '#navbarLogo',
    '#footerLogo',
    '.rsi-footer-logo',
    '.nan-user-avatar',
    '.nan-menu-avatar',
    '#dropdownAvatar',
    '#userAvatar',
    '#menuAvatar',
    '.rsi-avatar-mini img',
    '.rsi-tag-avatar-img',
    '.rsi-suggestion-avatar-img',
    '.rsi-fs-viewer-img',
    '[data-no-zoom="true"]'
].join(', ');

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.6;

const attachedImagesSet = new WeakSet();
let observerInstance = null;
let viewerOverlayEl = null;
let viewerState = null;

/**
 * Determina si una imagen debe tener visor de pantalla completa + zoom habilitado
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
function isZoomableImage(img) {
    if (!img || !(img instanceof HTMLImageElement)) return false;
    if (img.matches(EXCLUDED_SELECTORS)) return false;
    if (img.closest('.nan-navbar, .rsi-footer, .rsi-partner-footer, .ta-collab-avatar, .rsi-avatar-mini, #rsiFullscreenImageViewer')) {
        return false;
    }
    return true;
}

/**
 * Crea o recupera el visor de pantalla completa (100vw x 100vh) en el DOM
 */
function ensureFullscreenViewerDOM() {
    if (viewerOverlayEl && document.body.contains(viewerOverlayEl)) {
        return viewerOverlayEl;
    }

    const overlay = document.createElement('div');
    overlay.id = 'rsiFullscreenImageViewer';
    overlay.className = 'rsi-fs-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Visor de imagen en pantalla completa con zoom');

    overlay.innerHTML = `
        <div class="rsi-fs-viewer-topbar">
            <div class="rsi-fs-viewer-title" id="rsiFsViewerTitle">Vista en pantalla completa</div>
            <div class="rsi-fs-viewer-controls">
                <button type="button" class="rsi-fs-viewer-btn" data-fs-act="out" title="Alejar (-)" aria-label="Alejar" disabled>
                    <i class="fas fa-search-minus"></i>
                </button>
                <button type="button" class="rsi-fs-viewer-btn rsi-fs-viewer-scale-btn" data-fs-act="reset" title="Restablecer a pantalla completa (100%)">
                    100%
                </button>
                <button type="button" class="rsi-fs-viewer-btn" data-fs-act="in" title="Acercar (+)" aria-label="Acercar">
                    <i class="fas fa-search-plus"></i>
                </button>
                <button type="button" class="rsi-fs-viewer-btn rsi-fs-viewer-close-btn" data-fs-act="close" title="Cerrar pantalla completa (Esc)" aria-label="Cerrar">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        </div>
        <div class="rsi-fs-viewer-stage" id="rsiFsViewerStage">
            <img id="rsiFsViewerImg" class="rsi-fs-viewer-img" src="" alt="Imagen en pantalla completa" draggable="false" />
        </div>
        <div class="rsi-fs-viewer-hint">
            <span><i class="fas fa-mouse-pointer"></i> Clic o rueda del mouse para hacer zoom · Arrastra para moverte por la imagen · <strong>Esc</strong> para salir</span>
        </div>
    `;

    document.body.appendChild(overlay);
    viewerOverlayEl = overlay;

    const stage = overlay.querySelector('#rsiFsViewerStage');
    const imgEl = overlay.querySelector('#rsiFsViewerImg');
    const titleEl = overlay.querySelector('#rsiFsViewerTitle');
    const btnIn = overlay.querySelector('[data-fs-act="in"]');
    const btnOut = overlay.querySelector('[data-fs-act="out"]');
    const btnReset = overlay.querySelector('[data-fs-act="reset"]');
    const btnClose = overlay.querySelector('[data-fs-act="close"]');

    viewerState = {
        isOpen: false,
        scale: 1,
        tx: 0,
        ty: 0,
        isDragging: false,
        hasMoved: false,
        startX: 0,
        startY: 0,
        startTx: 0,
        startTy: 0,
        pinchStartDist: 0,
        pinchStartScale: 1,
        stage,
        imgEl,
        titleEl,
        btnIn,
        btnOut,
        btnReset,
        btnClose
    };

    const clampPan = () => {
        if (viewerState.scale <= 1.01) {
            viewerState.tx = 0;
            viewerState.ty = 0;
            return;
        }
        const stageRect = stage.getBoundingClientRect();
        const baseW = imgEl.offsetWidth || stageRect.width * 0.85;
        const baseH = imgEl.offsetHeight || stageRect.height * 0.85;

        const scaledW = baseW * viewerState.scale;
        const scaledH = baseH * viewerState.scale;

        const maxTx = Math.max(0, (scaledW - stageRect.width) / 2 + 120);
        const maxTy = Math.max(0, (scaledH - stageRect.height) / 2 + 120);

        viewerState.tx = Math.max(-maxTx, Math.min(maxTx, viewerState.tx));
        viewerState.ty = Math.max(-maxTy, Math.min(maxTy, viewerState.ty));
    };

    const renderTransform = () => {
        clampPan();
        const isZoomed = viewerState.scale > 1.02;
        stage.classList.toggle('is-zoomed', isZoomed);

        if (!isZoomed) {
            imgEl.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
        } else {
            imgEl.style.transform = `translate3d(${viewerState.tx.toFixed(1)}px, ${viewerState.ty.toFixed(1)}px, 0) scale(${viewerState.scale.toFixed(3)})`;
        }

        if (btnReset) {
            btnReset.textContent = `${Math.round(viewerState.scale * 100)}%`;
        }
        if (btnOut) {
            btnOut.disabled = !isZoomed;
        }
        if (btnIn) {
            btnIn.disabled = viewerState.scale >= MAX_SCALE - 0.05;
        }
    };

    const setScale = (targetScale, focalX = null, focalY = null) => {
        const prevScale = viewerState.scale;
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));

        if (nextScale <= 1.02) {
            viewerState.scale = 1;
            viewerState.tx = 0;
            viewerState.ty = 0;
            renderTransform();
            return;
        }

        if (focalX !== null && focalY !== null && Math.abs(nextScale - prevScale) > 0.01) {
            const rect = stage.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const offsetX = focalX - centerX;
            const offsetY = focalY - centerY;
            const ratio = nextScale / prevScale;

            viewerState.tx = viewerState.tx * ratio - offsetX * (ratio - 1);
            viewerState.ty = viewerState.ty * ratio - offsetY * (ratio - 1);
        }

        viewerState.scale = nextScale;
        renderTransform();
    };

    viewerState.setScale = setScale;
    viewerState.renderTransform = renderTransform;

    // Botones de la barra superior
    overlay.querySelector('.rsi-fs-viewer-topbar').addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.target.closest('[data-fs-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-fs-act');
        if (act === 'in') {
            setScale(viewerState.scale + ZOOM_STEP);
        } else if (act === 'out') {
            setScale(viewerState.scale - ZOOM_STEP);
        } else if (act === 'reset') {
            setScale(1);
        } else if (act === 'close') {
            closeFullscreenImageZoom();
        }
    });

    // Zoom con rueda del mouse en cualquier parte del visor de pantalla completa
    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.35 : -0.35;
        setScale(viewerState.scale + delta, e.clientX, e.clientY);
    }, { passive: false });

    // Arrastrar (Pan) con Mouse / Pointer
    stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        if (e.button !== 0) return;

        viewerState.isDragging = true;
        viewerState.hasMoved = false;
        viewerState.startX = e.clientX;
        viewerState.startY = e.clientY;
        viewerState.startTx = viewerState.tx;
        viewerState.startTy = viewerState.ty;

        if (viewerState.scale > 1.02) {
            stage.classList.add('is-panning');
            try {
                stage.setPointerCapture(e.pointerId);
            } catch {}
        }
    });

    stage.addEventListener('pointermove', (e) => {
        if (!viewerState.isDragging || e.pointerType === 'touch') return;
        const dx = e.clientX - viewerState.startX;
        const dy = e.clientY - viewerState.startY;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            viewerState.hasMoved = true;
        }

        if (viewerState.scale > 1.02 && viewerState.hasMoved) {
            viewerState.tx = viewerState.startTx + dx;
            viewerState.ty = viewerState.startTy + dy;
            renderTransform();
        }
    });

    const endPointer = (e) => {
        if (!viewerState.isDragging || e.pointerType === 'touch') return;
        viewerState.isDragging = false;
        stage.classList.remove('is-panning');
        try {
            if (stage.hasPointerCapture(e.pointerId)) {
                stage.releasePointerCapture(e.pointerId);
            }
        } catch {}
    };

    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Clic sobre la imagen para alternar niveles de zoom; clic en el fondo oscuro (cuando está a 100%) para cerrar
    stage.addEventListener('click', (e) => {
        if (viewerState.hasMoved) {
            viewerState.hasMoved = false;
            return;
        }

        if (e.target === imgEl) {
            let nextScale = 2.2;
            if (viewerState.scale >= 2.0 && viewerState.scale < 3.4) {
                nextScale = 3.6;
            } else if (viewerState.scale >= 3.4) {
                nextScale = 1;
            }
            setScale(nextScale, e.clientX, e.clientY);
        } else if (viewerState.scale <= 1.02) {
            closeFullscreenImageZoom();
        }
    });

    // Soporte táctil móvil: Pellizco (Pinch-to-zoom) a 2 dedos y Pan a 1 dedo
    stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            viewerState.pinchStartDist = Math.hypot(dx, dy);
            viewerState.pinchStartScale = viewerState.scale;
            viewerState.hasMoved = true;
        } else if (e.touches.length === 1 && viewerState.scale > 1.02) {
            viewerState.isDragging = true;
            viewerState.hasMoved = false;
            viewerState.startX = e.touches[0].clientX;
            viewerState.startY = e.touches[0].clientY;
            viewerState.startTx = viewerState.tx;
            viewerState.startTy = viewerState.ty;
        }
    }, { passive: false });

    stage.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && viewerState.pinchStartDist > 0) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const ratio = dist / viewerState.pinchStartDist;
            setScale(viewerState.pinchStartScale * ratio, midX, midY);
        } else if (e.touches.length === 1 && viewerState.isDragging && viewerState.scale > 1.02) {
            const dx = e.touches[0].clientX - viewerState.startX;
            const dy = e.touches[0].clientY - viewerState.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                viewerState.hasMoved = true;
                e.preventDefault();
                viewerState.tx = viewerState.startTx + dx;
                viewerState.ty = viewerState.startTy + dy;
                renderTransform();
            }
        }
    }, { passive: false });

    stage.addEventListener('touchend', () => {
        viewerState.isDragging = false;
        viewerState.pinchStartDist = 0;
    });

    return overlay;
}

/**
 * Abre una imagen a tamaño de pantalla completa (100vw x 100vh) con controles de zoom interactivo
 * @param {string} src - URL o DataURL de la imagen
 * @param {string} [title] - Título descriptivo opcional
 */
export function openFullscreenImageZoom(src, title = '') {
    if (!src) return;
    const overlay = ensureFullscreenViewerDOM();
    if (!overlay || !viewerState) return;

    viewerState.imgEl.src = src;
    viewerState.titleEl.textContent = title || 'Vista en pantalla completa';
    viewerState.scale = 1;
    viewerState.tx = 0;
    viewerState.ty = 0;
    viewerState.isOpen = true;
    viewerState.renderTransform();

    overlay.classList.add('open');
    document.body.classList.add('rsi-fs-viewer-active');
}

/**
 * Cierra el visor de pantalla completa
 */
export function closeFullscreenImageZoom() {
    if (!viewerOverlayEl || !viewerState) return;
    viewerState.isOpen = false;
    viewerOverlayEl.classList.remove('open');
    document.body.classList.remove('rsi-fs-viewer-active');
}

/**
 * Vincula una imagen de la plataforma para que al hacer clic se abra del tamaño de toda la pantalla
 * y desde ahí permita hacer zoom interactivo.
 * @param {HTMLImageElement} img
 */
export function attachZoomToImage(img) {
    if (!isZoomableImage(img)) return;
    if (attachedImagesSet.has(img)) return;

    const setup = () => {
        if (attachedImagesSet.has(img)) return;

        const isEvidenceOrPreview = Boolean(
            img.closest('.ta-evidence-thumb-wrap, #viewImagePreview, #revEvidenciaContent, .ta-camera-viewport, .rsi-view-product-image, .rsi-detail-product-img') ||
            img.id === 'evidenciaPreviewImg' ||
            img.id === 'taWatermarkPreviewImg'
        );

        const w = img.naturalWidth || img.clientWidth || img.width || 0;
        const h = img.naturalHeight || img.clientHeight || img.height || 0;
        if (!isEvidenceOrPreview && w > 0 && h > 0 && (w < 45 || h < 45)) {
            return;
        }

        attachedImagesSet.add(img);
        img.classList.add('rsi-zoomable-img');
        if (!img.title) {
            img.title = 'Haz clic para ver en pantalla completa y hacer zoom';
        }

        img.addEventListener('click', (e) => {
            if (e.target.closest('[data-delete-id], .ta-evidence-delete-btn')) return;
            const currentSrc = img.currentSrc || img.src;
            if (!currentSrc) return;

            e.stopPropagation();
            e.preventDefault();

            const title =
                img.getAttribute('data-preview-title') ||
                img.closest('[data-preview-title]')?.getAttribute('data-preview-title') ||
                img.alt ||
                'Vista en pantalla completa';

            openFullscreenImageZoom(currentSrc, title);
        });
    };

    if (img.complete && (img.naturalWidth > 0 || img.src)) {
        setup();
    } else {
        img.addEventListener('load', setup, { once: true });
    }
}

/**
 * Abre la imagen en pantalla completa o controla su nivel de zoom
 * @param {HTMLImageElement} img
 * @param {'in'|'out'|'toggle'|'reset'} [action='toggle']
 */
export function triggerImageZoom(img, action = 'toggle') {
    if (!img) return;
    const currentSrc = img.currentSrc || img.src;
    if (!currentSrc) return;

    if (action === 'reset' && (!viewerState || !viewerState.isOpen)) {
        return;
    }

    const title =
        img.getAttribute('data-preview-title') ||
        img.closest('[data-preview-title]')?.getAttribute('data-preview-title') ||
        img.alt ||
        'Vista en pantalla completa';

    openFullscreenImageZoom(currentSrc, title);
}

/**
 * Escanea un contenedor y habilita el visor de pantalla completa con zoom en sus imágenes
 * @param {ParentNode} [root=document]
 * @param {string} [selector='img']
 */
export function enableImageZoomInContainer(root = document, selector = 'img') {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const images = root.querySelectorAll(selector || 'img');
    images.forEach(img => attachZoomToImage(img));
}

/**
 * Alias compatible para vincular visor de pantalla completa con zoom a imágenes dentro de un contenedor
 * @param {ParentNode} [root=document]
 * @param {string} [selector='img']
 */
export function attachToContainer(root = document, selector = 'img') {
    enableImageZoomInContainer(root, selector);
}

/**
 * Inicializa el observador global para habilitar pantalla completa + zoom en todas las imágenes de la plataforma
 */
export function initGlobalImageZoom() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    ensureFullscreenViewerDOM();
    enableImageZoomInContainer(document.body);

    if (!observerInstance && typeof MutationObserver !== 'undefined') {
        observerInstance = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.target instanceof HTMLImageElement) {
                    attachZoomToImage(m.target);
                } else if (m.type === 'childList') {
                    m.addedNodes.forEach(node => {
                        if (node instanceof HTMLImageElement) {
                            attachZoomToImage(node);
                        } else if (node instanceof HTMLElement && node.id !== 'rsiFullscreenImageViewer') {
                            enableImageZoomInContainer(node);
                        }
                    });
                }
            }
        });

        observerInstance.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewerState?.isOpen) {
            closeFullscreenImageZoom();
        }
    });
}

export default {
    initGlobalImageZoom,
    enableImageZoomInContainer,
    attachToContainer,
    attachZoomToImage,
    triggerImageZoom,
    openFullscreenImageZoom,
    closeFullscreenImageZoom
};

