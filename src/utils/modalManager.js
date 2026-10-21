/* ========================================
   MODAL MANAGER
   Helper genérico para abrir/cerrar modales
   ======================================== */

let activeModal = null;
let destroyFn = null;
let escHandler = null;

/**
 * Abre un modal
 * @param {Object} options
 * @param {string} options.html        - HTML del modal (importado con ?raw)
 * @param {Function} options.controller - Controlador del modal
 * @param {Function} options.onClose   - Callback al cerrar
 * @param {string} options.containerId - ID del contenedor (default: rsi-modal-root)
 */
export async function openModal({
    html,
    controller,
    onClose,
    containerId = 'rsi-modal-root'
} = {}) {
    // Si ya hay uno abierto, cerrarlo primero
    if (activeModal) closeModal();

    // Crear contenedor si no existe
    let root = document.getElementById(containerId);
    if (!root) {
        root = document.createElement('div');
        root.id = containerId;
        document.body.appendChild(root);
    }

    // Inyectar HTML
    root.innerHTML = html;
    root.classList.add('rsi-modal-open');
    document.body.style.overflow = 'hidden';

    activeModal = root;
    activeModal._onClose = onClose;

    // Ejecutar controlador
    if (typeof controller === 'function') {
        const result = await controller({
            close: closeModal,
            root
        });
        if (typeof result === 'function') {
            destroyFn = result;
        }
    }

    // Click en backdrop o en [data-modal-close] → cerrar
    const clickHandler = (e) => {
        if (e.target === root || e.target.closest('[data-modal-close]')) {
            e.preventDefault();
            closeModal();
        }
    };
    root.addEventListener('click', clickHandler);
    root._clickHandler = clickHandler;

    // ESC → cerrar
    escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);

    return root;
}

/**
 * Cierra el modal activo
 */
export function closeModal() {
    if (destroyFn) {
        try { destroyFn(); } catch (e) { console.warn('Error en destroy:', e); }
        destroyFn = null;
    }

    if (activeModal) {
        const onClose = activeModal._onClose;

        if (activeModal._clickHandler) {
            activeModal.removeEventListener('click', activeModal._clickHandler);
        }
        activeModal.innerHTML = '';
        activeModal.classList.remove('rsi-modal-open');

        activeModal = null;
        document.body.style.overflow = '';

        if (typeof onClose === 'function') onClose();
    }

    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
}