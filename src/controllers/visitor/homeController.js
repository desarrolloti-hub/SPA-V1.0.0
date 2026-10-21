/* ========================================
   HOME CONTROLLER - RSI Enterprise México
   Carrusel Principal, Reseñas de Google,
   Contadores y Animaciones
   ======================================== */
import { createCarousel } from '../../components/carousel/carousel.js';
import { carouselConfig } from '../../components/carousel/carouselConfig.js';
import { CarruselService } from '../../services/carruselService.js';
import authService from '../../services/authService.js';

let carouselInstance = null;
let statsObserver = null;
let scrollObserver = null;

export async function homeController() {
    console.log('🏠 Inicializando Home Controller');

    // 🔐 Verificar sesión activa y redirigir según rol
    await checkSessionAndRedirect();

    // 🎠 Inicializar carrusel principal
    await initCarousel();

    // ⭐ Asegurar inicialización y re-escaneo del widget de reseñas de Google (Elfsight)
    initGoogleReviewsWidget();

    // 📊 Inicializar contadores animados de estadísticas
    initStatsCounter();

    // ✨ Animación suave de aparición al hacer scroll (Scroll Reveal)
    initScrollReveal();

    console.log('✅ Home Controller listo');
}

/**
 * 🎠 INICIALIZA EL CARRUSEL FULLSCREEN
 */
async function initCarousel() {
    const container = document.getElementById('homeCarousel');
    if (!container) {
        console.warn('⚠️ Contenedor del carrusel no encontrado');
        return;
    }

    if (carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
    }

    let configToUse = carouselConfig;

    try {
        const carruselService = new CarruselService();
        const dynamicSlides = await carruselService.getActiveSlides(true);
        if (dynamicSlides && dynamicSlides.length > 0) {
            configToUse = {
                ...carouselConfig,
                slides: dynamicSlides
            };
        }
    } catch (err) {
        console.warn('⚠️ No se pudieron cargar los slides dinámicos del carrusel, usando predeterminados:', err);
    }

    carouselInstance = createCarousel(container, configToUse);

    if (carouselInstance) {
        console.log(`✅ Carrusel inicializado con ${carouselInstance.getTotal()} slides`);
    }
}

/**
 * ⭐ ASEGURA LA CARGA DEL WIDGET DE RESEÑAS DE GOOGLE (ELFSIGHT) EN NAVEGACIÓN SPA
 */
function initGoogleReviewsWidget() {
    const widgetEl = document.querySelector('.elfsight-app-111c7a7e-1138-43ce-9a28-5b8cd6cbcf10');
    if (!widgetEl) return;

    // Si ya tiene contenido montado, no es necesario recargar
    if (widgetEl.children.length > 0) return;

    // En aplicaciones SPA, remover scripts previos de Elfsight para que el navegador
    // ejecute platform.js fresco sobre el nuevo nodo inyectado en el DOM
    const existingScripts = document.querySelectorAll('script[src*="elfsight"]');
    existingScripts.forEach(s => s.remove());

    const script = document.createElement('script');
    script.src = 'https://static.elfsight.com/platform/platform.js';
    script.async = true;
    document.head.appendChild(script);
}

/**
 * 📊 CONTADORES ANIMADOS DE ESTADÍSTICAS CON EASING
 */
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.rsi-stat-number');
    if (!statNumbers.length || typeof IntersectionObserver === 'undefined') return;

    statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                if (!element.classList.contains('is-animated')) {
                    element.classList.add('is-animated');
                    const text = element.textContent.trim();
                    const match = text.match(/\d+/);

                    if (match) {
                        const target = parseInt(match[0], 10);
                        const suffix = text.includes('+') ? '+' : (text.includes('/7') ? '/7' : '');
                        animateCountNumber(element, target, suffix);
                    }
                }
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.25 });

    statNumbers.forEach(stat => statsObserver.observe(stat));
}

function animateCountNumber(element, target, suffix = '') {
    let startTime = null;
    const duration = 2000;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // Easing cúbico suave out
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeOut * target);

        element.textContent = `${current}${suffix}`;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = `${target}${suffix}`;
        }
    }

    window.requestAnimationFrame(step);
}

/**
 * ✨ SCROLL REVEAL SUAVE PARA SECCIONES DEL HOME
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.rsi-about-section, .rsi-solution-card, .rsi-pillar-item, .rsi-stat-card, .rsi-process-card, .rsi-reviews-header, .rsi-reviews-widget-card, .rsi-final-cta-card'
    );

    if (!revealElements.length || typeof IntersectionObserver === 'undefined') return;

    revealElements.forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${(index % 4) * 0.08}s`;
    });

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

    revealElements.forEach(el => scrollObserver.observe(el));
}

/**
 * 🔐 VERIFICACIÓN DE SESIÓN Y REDIRECCIÓN SEGÚN ROL
 */
async function checkSessionAndRedirect() {
    try {
        const sessionData = localStorage.getItem('rsi_session');
        if (!sessionData) return;

        let loadingAlert = null;

        try {
            loadingAlert = Swal.fire({
                title: 'Verificando sesión...',
                text: 'Por favor espera un momento',
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            const session = JSON.parse(sessionData);

            if (!session || !session.rol) {
                if (loadingAlert) Swal.close();
                return;
            }

            let redirectPath = '';
            let rolDisplay = '';
            const currentPath = window.location.pathname;

            if (session.rol === 'admin') {
                // El administrador puede navegar libremente en el Home para previsualizar y auditar
                if (loadingAlert) Swal.close();
                return;
            } else if (session.rol === 'partner') {
                const landing = await authService.resolvePartnerLandingRoute();
                if (!landing || !landing.authenticated || landing.haRegistradoEntrada) {
                    if (loadingAlert) Swal.close();
                    return;
                }
                redirectPath = landing.route || '/partner/asistencia';
                rolDisplay = 'Partner';
            } else {
                if (loadingAlert) Swal.close();
                return;
            }

            if (currentPath === redirectPath || currentPath.includes(redirectPath)) {
                if (loadingAlert) Swal.close();
                return;
            }

            if (loadingAlert) {
                Swal.close();
            }

            await Swal.fire({
                title: `¡Bienvenido ${rolDisplay}!`,
                text: 'Redirigiendo a tu dashboard...',
                icon: 'success',
                timer: 1200,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                willClose: () => {
                    if (typeof window.navigateTo === 'function') {
                        window.navigateTo(redirectPath);
                    } else {
                        window.location.href = redirectPath;
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error al verificar sesión:', error);
            if (loadingAlert) Swal.close();
        }
    } catch (error) {
        console.error('❌ Error en checkSessionAndRedirect:', error);
    }
}

/**
 * 🧹 Limpieza del controlador al salir de la vista
 */
export function destroyHomeController() {
    if (carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
    }
    if (statsObserver) {
        statsObserver.disconnect();
        statsObserver = null;
    }
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}