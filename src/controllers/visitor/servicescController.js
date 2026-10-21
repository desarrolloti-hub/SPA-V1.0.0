/* ========================================
   SERVICES CONTROLLER - RSI Enterprise
   ======================================== */

import { createCarousel } from '../../components/carousel/carousel.js';
import { carouselConfigServices } from '../../components/carousel/carouselConfigServices.js';

let carouselInstance = null;
let observerInstance = null;

export async function servicesController() {
    console.log('🛠️ Services controller');

    // 🎠 Carrusel
    await initCarousel();

    // ✨ Animación de aparición al hacer scroll
    initScrollRevealItems();

    console.log('✅ Services controller listo');
}

/**
 * 🎠 INICIALIZA EL CARRUSEL
 */
async function initCarousel() {
    const container = document.getElementById('servicesCarousel');
    if (!container) {
        console.warn('⚠️ Contenedor del carrusel no encontrado');
        return;
    }

    if (carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
    }

    carouselInstance = createCarousel(container, carouselConfigServices);

    if (carouselInstance) {
        console.log(`✅ Carrusel servicios: ${carouselInstance.getTotal()} slides`);
    }
}

/**
 * ✨ SCROLL REVEAL PARA ITEMS DE SERVICIO
 * Aparecen con transición suave desde abajo
 */
function initScrollRevealItems() {
    const items = document.querySelectorAll('.rsi-service-item');
    if (items.length === 0) return;

    // Limpiar observer anterior si existe
    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }

    // Respetar preferencias de accesibilidad
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
        items.forEach(item => item.classList.add('is-visible'));
        return;
    }

    observerInstance = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observerInstance.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -80px 0px' // activa un poco antes de que entre
        }
    );

    items.forEach((item, index) => {
        // Delay escalonado para que no aparezcan todos de golpe
        item.style.transitionDelay = `${Math.min(index * 0.08, 0.4)}s`;
        observerInstance.observe(item);
    });

    console.log(`✨ Scroll reveal activado en ${items.length} servicios`);
}

/**
 * 🧹 LIMPIEZA AL SALIR DE LA VISTA
 */
export function destroyServicesController() {
    if (carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
    }

    if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
    }
}

export default servicesController;