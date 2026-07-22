import { loadLayout } from './components/shared/loadLayout.js';
import { initNavbarController } from './components/visitor/navbarController.js';
import { initFooterController } from './components/visitor/footerController.js';
import { initFooterPartnerController } from './components/partner/footerPartnertController.js';
import { initRouter } from './router/router.js';
import { ThemeService } from './components/shared/themeService.js';

function loadExternalScripts() {
    return new Promise((resolve) => {
        if (document.querySelector('script[src*="swiper"]')) {
            resolve();
            return;
        }
        
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
        
        setTimeout(resolve, 3000);
    });
}

async function initApp() {
    try {
        await loadExternalScripts();
        
        // 1. Inicializar tema (modo oscuro/claro)
        ThemeService.init();
        
        // 2. Cargar layouts persistentes
        await loadLayout();
        
        // 3. Inicializar controllers de layout
        initNavbarController();
        
        // ✅ Inicializar AMBOS controllers (cada uno busca su propio footer)
        initFooterController();        // Para el footer visitante
        initFooterPartnerController(); // Para el footer partner
        
        // 4. Inicializar router
        initRouter();
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
    }
}

initApp();