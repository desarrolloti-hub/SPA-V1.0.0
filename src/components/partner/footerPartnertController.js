/* ========================================
   FOOTER PARTNER CONTROLLER
   Controla eventos del footer partner y reloj
   ======================================== */

let eventListeners = [];
let clockInterval = null;

/**
 * Inicializa el controlador del footer partner
 */
export function initFooterPartnerController() {
    console.log('📋 Inicializando Footer Partner Controller');
    
    // ✅ Buscar el footer del partner
    const footer = document.querySelector('.rsi-footer-partner');
    
    if (!footer) {
        console.warn('⚠️ Footer Partner no encontrado en el DOM, reintentando...');
        setTimeout(() => {
            initFooterPartnerController();
        }, 300);
        return;
    }

    console.log('✅ Footer Partner encontrado');
    
    // ✅ Inicializar funcionalidades
    initYear();
    initClock(); // ⏰ RELOJ EN TIEMPO REAL
    initSocialLinks();
    initScrollTop();
    
    // ✅ Escuchar recarga del footer
    document.addEventListener('footerLoaded', () => {
        console.log('🔄 Footer Partner recargado');
        cleanup();
        setTimeout(initFooterPartnerController, 50);
    });
    
    console.log('✅ Footer Partner Controller listo');
}

/**
 * 1. AÑO ACTUAL EN EL FOOTER
 */
function initYear() {
    const yearElement = document.querySelector('.rsi-footer-partner-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
        console.log('📅 Año actualizado:', yearElement.textContent);
    }
}

/**
 * 2. RELOJ EN TIEMPO REAL (Fecha y Hora)
 */
function initClock() {
    const clockElement = document.getElementById('footerClock');
    
    console.log('🔍 Buscando #footerClock:', clockElement);
    
    if (!clockElement) {
        console.warn('⏰ No se encontró #footerClock para el reloj');
        return;
    }

    console.log('⏰ Reloj encontrado, iniciando...');

    // Función para actualizar el reloj
    function updateClock() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        
        const formattedDate = now.toLocaleDateString('es-MX', options);
        clockElement.textContent = formattedDate;
    }

    // ✅ Actualizar inmediatamente (para que no espere 1 segundo)
    updateClock();
    
    // ✅ Limpiar interval anterior si existe
    if (clockInterval) {
        clearInterval(clockInterval);
        console.log('⏰ Interval anterior limpiado');
    }
    
    // ✅ Actualizar cada segundo
    clockInterval = setInterval(updateClock, 1000);
    
    console.log('⏰ Reloj en tiempo real activado (actualiza cada 1s)');
}

/**
 * 3. ENLACES SOCIALES (con tracking)
 */
function initSocialLinks() {
    const socialLinks = document.querySelectorAll('.rsi-social-links a');
    
    socialLinks.forEach(link => {
        const handler = (e) => {
            const platform = link.getAttribute('aria-label') || 
                            link.querySelector('i')?.className?.replace('fab fa-', '') || 
                            'social';
            console.log(`📊 Click en ${platform}`);
        };
        link.addEventListener('click', handler);
        eventListeners.push({ element: link, event: 'click', handler });
    });
}

/**
 * 4. BOTÓN VOLVER ARRIBA
 */
function initScrollTop() {
    const scrollBtn = document.querySelector('.rsi-scroll-top');
    if (!scrollBtn) return;

    const scrollHandler = () => {
        if (window.scrollY > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    };
    
    window.addEventListener('scroll', scrollHandler);
    eventListeners.push({ element: window, event: 'scroll', handler: scrollHandler });

    const clickHandler = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    scrollBtn.addEventListener('click', clickHandler);
    eventListeners.push({ element: scrollBtn, event: 'click', handler: clickHandler });

    scrollHandler();
}

/**
 * 5. LIMPIEZA DE EVENTOS
 */
function cleanup() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
        console.log('⏰ Interval del reloj limpiado');
    }
    
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) {
            element.removeEventListener(event, handler);
        }
    });
    eventListeners = [];
}

/**
 * 6. RECARGA DEL FOOTER
 */
export function reloadFooterPartner() {
    console.log('🔄 Recargando Footer Partner...');
    cleanup();
    setTimeout(() => {
        initFooterPartnerController();
    }, 100);
}

export default initFooterPartnerController;