/* ========================================
   ROUTER - Sistema de navegación SPA
   ======================================== */

import { loadPage } from './pageLoader.js';
import { initLazyLoader, reinitLazyLoader } from '../utils/lazy-loader.js';

let currentPath = window.location.pathname;

/**
 * Inicializa el router
 */
export function initRouter() {
    console.log('🔄 Router inicializado');

    // Cargar página inicial
    navigateTo(currentPath);

    // Escuchar clicks en enlaces con data-link
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-link]');
        if (link) {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href && href !== currentPath) {
                navigateTo(href);
            }
        }
    });

    // Escuchar cambios en el historial (popstate)
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        if (path !== currentPath) {
            navigateTo(path, false);
        }
    });
}

/**
 * Navega a una ruta específica
 * @param {string} path - Ruta a navegar
 * @param {boolean} pushState - Si debe agregar al historial
 */
async function navigateTo(path, pushState = true) {
    try {
        console.log(`📍 Navegando a: ${path}`);

        // Cargar la página
        const html = await loadPage(path);
        
        // Insertar en el DOM
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = html;
        }

        // Actualizar URL
        if (pushState) {
            window.history.pushState({}, '', path);
        }
        currentPath = path;

        // ==========================================
        // REINICIAR LAZY LOADER DESPUÉS DE CADA PÁGINA
        // ==========================================
        // Esperar un frame para que el DOM se actualice
        requestAnimationFrame(() => {
            initLazyLoader();
        });

        // Disparar evento personalizado (por si otros scripts lo necesitan)
        const event = new CustomEvent('pageLoaded', { detail: { path } });
        document.dispatchEvent(event);

        console.log(`✅ Página cargada: ${path}`);

    } catch (error) {
        console.error(`❌ Error navegando a ${path}:`, error);
        // Cargar página 404
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `
                <section class="rsi-hero-section" style="min-height: 60vh; display: flex; align-items: center; justify-content: center;">
                    <div class="rsi-hero-content">
                        <h1 class="rsi-hero-title">404</h1>
                        <p class="rsi-hero-subtitle">Página no encontrada</p>
                        <a href="/" data-link class="rsi-primary-btn">Volver al inicio</a>
                    </div>
                </section>
            `;
        }
    }
}