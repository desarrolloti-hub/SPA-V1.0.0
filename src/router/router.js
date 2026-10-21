/* ========================================
   ROUTER - Visitantes
   ======================================== */

import { routes } from './routes.js';
import AuthService from '../services/authService.js';

let isNavigating = false; // Prevenir navegaciones múltiples
let isRouterInitialized = false;
const authService = new AuthService();

/**
 * Inicializa el router
 */
export function initRouter() {
    if (!isRouterInitialized) {
        // Escuchar clicks en enlaces con data-link o rutas relativas internas
        document.addEventListener('click', async (e) => {
            const link = e.target.closest('a[data-link], a[href^="/"]');
            if (link && !isNavigating) {
                const href = link.getAttribute('href');
                if (
                    href && 
                    !href.startsWith('http') && 
                    !href.startsWith('//') && 
                    !href.startsWith('#') && 
                    !href.startsWith('mailto:') && 
                    !href.startsWith('tel:') &&
                    !link.hasAttribute('download') &&
                    link.getAttribute('target') !== '_blank'
                ) {
                    e.preventDefault();
                    e.stopPropagation(); // Evitar recarga completa del navegador
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
        
        // Escuchar mensajes del Service Worker para navegación push (FCM)
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', async (event) => {
                if (event.data && event.data.type === 'FCM_NAVIGATE' && event.data.url) {
                    let targetPath = event.data.url;
                    try {
                        const parsed = new URL(targetPath, window.location.origin);
                        targetPath = parsed.pathname + parsed.search;
                    } catch (e) {}
                    console.log('📬 Navegación activada por Service Worker FCM:', targetPath);
                    await navigateTo(targetPath);
                }
            });
        }

        isRouterInitialized = true;
    }

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
    const search = window.location.search || '';

    console.log('📍 Navegando a:', path + search);

    // Disparar evento antes de cambiar ruta (cierra menús desplegables de inmediato)
    document.dispatchEvent(new CustomEvent('route:changing', {
        detail: { path }
    }));

    // Guardia de navegación / Control de acceso
    const session = authService.getSession();

    // 1. Rutas protegidas (/partner/* y /hr/*) requieren sesión activa
    if (path.startsWith('/partner') || path.startsWith('/hr') || path.startsWith('/ecommerce')) {
        if (session && session.rol === 'buyer') {
            console.warn('⛔ Acceso denegado a compradores en módulo administrativo. Redirigiendo a /buyer/dashboard');
            window.history.replaceState({}, '', '/buyer/dashboard');
            return handleRoute();
        }
        if (!session || !session.uid) {
            console.warn('🔒 Ruta protegida requiere autenticación. Redirigiendo a /login con returnUrl');
            const returnUrl = encodeURIComponent(path + search);
            window.history.replaceState({}, '', `/login?returnUrl=${returnUrl}`);
            return handleRoute();
        }
    }

    
    // Rutas protegidas de Comprador (/buyer/*) requieren sesión activa
    if (path.startsWith('/buyer')) {
        if (!session || !session.uid) {
            console.warn('🔒 Área de cliente requiere autenticación. Redirigiendo a /login con returnUrl');
            const returnUrl = encodeURIComponent(path + search);
            window.history.replaceState({}, '', `/login?returnUrl=${returnUrl}`);
            return handleRoute();
        }
    }

    // 2. Si hay sesión activa de colaborador/admin, evaluar redirección inteligente en '/', '/login' y '/partner/dashboard'
    if (session && session.uid && (path === '/' || path === '/login' || path === '/partner/dashboard')) {
        // Si un partner accede a '/', '/login' o '/partner/dashboard', verificar registro diario de asistencia en Firestore
        if (session.rol === 'partner') {
            const landing = await authService.resolvePartnerLandingRoute();
            if (!landing.authenticated) {
                localStorage.removeItem('rsi_session');
                if (path.startsWith('/partner') || path.startsWith('/hr')) {
                    window.history.replaceState({}, '', '/login');
                    return handleRoute();
                }
            } else if (!landing.haRegistradoEntrada) {
                // El colaborador partner aún no ha registrado su asistencia de entrada del día de hoy
                console.log('📋 Partner sin registro de entrada hoy. Redirigiendo a /partner/asistencia');
                window.history.replaceState({}, '', '/partner/asistencia?from=redirect');
                return handleRoute();
            } else if (path === '/' || path === '/login') {
                // Ya registró entrada hoy: si entró a '/' o '/login', llevarlo a returnUrl o '/partner/dashboard'
                const urlParams = new URLSearchParams(window.location.search);
                const rawReturn = urlParams.get('returnUrl');
                let destination = '/partner/dashboard';
                if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login' && rawReturn !== '/') {
                    destination = rawReturn;
                }
                console.log(`👤 Partner con asistencia registrada hoy. Redirigiendo a ${destination}`);
                window.history.replaceState({}, '', destination);
                return handleRoute();
            }
        } else if (session.rol === 'admin' && path === '/login') {
            // Admin ingresando a /login va directo a returnUrl o /partner/dashboard sin bloqueo de asistencia
            const urlParams = new URLSearchParams(window.location.search);
            const rawReturn = urlParams.get('returnUrl');
            let destination = '/partner/dashboard';
            if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login') {
                destination = rawReturn;
            }
            console.log(`👤 Administrador autenticado en /login. Redirigiendo a ${destination}`);
            window.history.replaceState({}, '', destination);
            return handleRoute();
        } else if ((session.rol === 'buyer' || session.rol === 'customer') && path === '/login') {
            // Comprador autenticado ingresando a /login va a /buyer/dashboard o returnUrl
            const urlParams = new URLSearchParams(window.location.search);
            const rawReturn = urlParams.get('returnUrl');
            let destination = '/buyer/dashboard';
            if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login') {
                destination = rawReturn;
            }
            console.log(`👤 Comprador autenticado en /login. Redirigiendo a ${destination}`);
            window.history.replaceState({}, '', destination);
            return handleRoute();
        }
    }
    
    // Buscar ruta
    let route = routes[path];
    
    if (!route) {
        route = routes['/404'] || routes['/'];
    }

    // Actualizar título de la pestaña del navegador
    const pageTitle = route.title || 'RSI Enterprise - Soluciones Integrales de Seguridad';
    document.title = pageTitle;
    
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