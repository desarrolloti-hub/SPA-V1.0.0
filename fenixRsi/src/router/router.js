/* ========================================
   ROUTER - Visitantes
   ======================================== */

import { routes } from './routes.js';

let isNavigating = false; // Prevenir navegaciones múltiples

/**
 * Inicializa el router
 */
export function initRouter() {
    // Escuchar clicks en enlaces con data-link
    document.addEventListener('click', async (e) => {
        const link = e.target.closest('[data-link]');
        if (link && !isNavigating) {
            e.preventDefault();
            e.stopPropagation(); // Evitar propagación
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                await navigateTo(href);
            }
        }
    });
    
    // Escuchar navegación con popstate
    window.addEventListener('popstate', async () => {
        if (!isNavigating) {
            await handleRoute();
        }
    });
    
    // Exponer navigateTo globalmente
    window.navigateTo = navigateTo;
    
    // Manejar ruta inicial
    handleRoute();
}

/**
 * Navega a una ruta específica
 */
async function navigateTo(path) {
    if (isNavigating) return;
    isNavigating = true;
    
    window.history.pushState({}, '', path);
    await handleRoute();
    
    isNavigating = false;
}

/**
 * Maneja la ruta actual
 */
async function handleRoute() {
    const path = window.location.pathname;
    
    console.log('📍 Navegando a:', path);
    
    // Disparar evento antes de cambiar ruta
    document.dispatchEvent(new CustomEvent('route:changing', { 
        detail: { path } 
    }));
    
    // Buscar ruta
    let route = routes[path];
    
    if (!route) {
        route = routes['/404'] || routes['/'];
    }
    
    try {
        // Cargar vista
        const response = await fetch(route.view);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // Insertar en el DOM - SOLO UNA VEZ
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = html;
        }
        
        // Ejecutar controller de la vista si existe
        if (route.controller && typeof route.controller === 'function') {
            await route.controller();
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        console.log(`✅ Vista cargada: ${path}`);
        
    } catch (error) {
        console.error('❌ Error cargando ruta:', error);
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `<h1>Error cargando página</h1><p>${error.message}</p>`;
        }
    }
    
    // Disparar evento después de cambiar ruta
    document.dispatchEvent(new CustomEvent('route:changed', { 
        detail: { path } 
    }));
}