
import { loadLayout } from './modules/visitor/layout/loadLayout.js';
import { initNavbarController } from './modules/visitor/layout/navbarController.js';
import { initFooterController } from './modules/visitor/layout/footerController.js';
import { initRouter } from './router/router.js';

function loadExternalScripts() {
    return new Promise((resolve) => {
        // Verificar si ya están cargados
        if (document.querySelector('script[src*="swiper"]')) {
            resolve();
            return;
        }
        
        // Cargar AOS
        const aosLink = document.createElement('link');
        aosLink.rel = 'stylesheet';
        aosLink.href = 'https://unpkg.com/aos@2.3.1/dist/aos.css';
        document.head.appendChild(aosLink);
        
        const aosScript = document.createElement('script');
        aosScript.src = 'https://unpkg.com/aos@2.3.1/dist/aos.js';
        aosScript.onload = () => {
            window.AOS = AOS;
        };
        document.body.appendChild(aosScript);
        
        // Cargar Swiper
        const swiperLink = document.createElement('link');
        swiperLink.rel = 'stylesheet';
        swiperLink.href = 'https://unpkg.com/swiper/swiper-bundle.min.css';
        document.head.appendChild(swiperLink);
        
        const swiperScript = document.createElement('script');
        swiperScript.src = 'https://unpkg.com/swiper/swiper-bundle.min.js';
        swiperScript.onload = () => {
            window.Swiper = Swiper;
            resolve();
        };
        document.body.appendChild(swiperScript);
        
        // Timeout por si fallan
        setTimeout(resolve, 3000);
    });
}

/**
 * Inicializa la aplicación
 */
async function initApp() {
    try {
        // Cargar scripts externos
        await loadExternalScripts();
        
        // 1. Cargar layouts persistentes
        await loadLayout();
        
        // 2. Inicializar controllers de layout
        initNavbarController();
        initFooterController();
        
        // 3. Inicializar router
        initRouter();
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
    }
}

// Iniciar aplicación
initApp();