/* ========================================
   FOOTER CONTROLLER - Visitantes
   Controlador del layout persistente footer
   ======================================== */

// Elementos DOM cacheados
let elements = {};

/**
 * Inicializa el controlador del footer
 */
export function initFooterController() {
    cacheElements();
    bindEvents();
    updateCurrentYear();
    
    console.log('✅ Footer Controller inicializado');
}

/**
 * Cachea elementos del DOM
 */
function cacheElements() {
    elements = {
        footer: document.querySelector('.rsi-footer'),
        yearElement: document.querySelector('.current-year')
    };
}

/**
 * Vincula eventos del DOM
 */
function bindEvents() {
    // Aquí puedes agregar eventos específicos del footer
    // Ejemplo: newsletter subscription, etc.
}

/**
 * Actualiza año actual en el footer
 */
function updateCurrentYear() {
    if (elements.yearElement) {
        elements.yearElement.textContent = new Date().getFullYear();
    }
}

/**
 * Obtiene estado del footer
 */
export function getFooterState() {
    return {
        isLoaded: true,
        currentYear: new Date().getFullYear()
    };
}