/* ========================================
   LOAD LAYOUT
   Carga layouts persistentes según autenticación
   ======================================== */

import AuthService from '../../services/authService.js';

/**
 * Determina qué layouts cargar según el usuario
 */
function getLayoutPaths(user) {
    // Si no hay usuario, layout público
    if (!user) {
        return {
            navbar: '/components/visitor/navbarVisitor.html',
            footer: '/components/visitor/footerVisitor.html'
        };
    }
    // ✅ Si es partner
    if (user.rol === 'partner') {
        return {
            navbar: '/components/partner/navbarPartner.html',
            footer: '/components/partner/footerPartner.html'
        };
    }

    // ✅ Si es usuario logueado (user, etc)
    return {
        navbar: '/components/visitor/navbarUser.html',
        footer: '/components/visitor/footerUser.html'
    };
}

/**
 * Carga los layouts persistentes en el DOM
 */
export async function loadLayout() {
    console.log('📦 Cargando layouts...');
    
    try {
        // Obtener usuario autenticado
        const authService = new AuthService();
        const session = authService.getSession();
        
        console.log('👤 Usuario en sesión:', session ? session.email : 'No autenticado');
        console.log('👤 Rol:', session ? session.rol : 'N/A');
        
        // Determinar qué layouts cargar
        const { navbar, footer } = getLayoutPaths(session);
        
        console.log(`📂 Navbar: ${navbar}`);
        console.log(`📂 Footer: ${footer}`);

        // Cargar archivos
        const [navbarHTML, footerHTML] = await Promise.all([
            fetch(navbar).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} - ${navbar}`);
                return r.text();
            }),
            fetch(footer).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} - ${footer}`);
                return r.text();
            })
        ]);

        // Insertar en el DOM
        const navbarContainer = document.getElementById('navbar');
        const footerContainer = document.getElementById('footer');
        
        if (navbarContainer) {
            navbarContainer.innerHTML = navbarHTML;
            console.log('✅ Navbar insertado en el DOM');
        } else {
            console.error('❌ Elemento #navbar no encontrado en el DOM');
        }
        
        if (footerContainer) {
            footerContainer.innerHTML = footerHTML;
            console.log('✅ Footer insertado en el DOM');
        } else {
            console.error('❌ Elemento #footer no encontrado en el DOM');
        }

        // Disparar eventos DESPUÉS de insertar en el DOM
        requestAnimationFrame(() => {
            document.dispatchEvent(new CustomEvent('navbarLoaded', { 
                detail: { user: session } 
            }));
            document.dispatchEvent(new CustomEvent('footerLoaded'));
        });

        return {
            navbarLoaded: !!navbarContainer,
            footerLoaded: !!footerContainer,
            isAuthenticated: !!session,
            user: session,
            rol: session ? session.rol : null
        };

    } catch (error) {
        console.error('❌ Error cargando layouts:', error);
        
        // Mostrar error en la UI
        const app = document.getElementById('app');
        if (app && !app.innerHTML) {
            app.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;padding:2rem;text-align:center;flex-direction:column;">
                    <i class="fas fa-exclamation-triangle" style="font-size:4rem;color:#dc3545;margin-bottom:1rem;"></i>
                    <h2 style="color:#dc3545;">Error al cargar la página</h2>
                    <p style="color:#6c757d;max-width:500px;">${error.message || 'Ocurrió un error inesperado'}</p>
                    <button onclick="location.reload()" style="margin-top:1.5rem;padding:0.8rem 2rem;background:#1c1948;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </div>
            `;
        }
        
        throw error;
    }
}

/**
 * Recarga los layouts (después de login/logout)
 */
export async function reloadLayouts() {
    console.log('🔄 Recargando layouts...');
    
    // Limpiar el contenido actual
    const navbarContainer = document.getElementById('navbar');
    const footerContainer = document.getElementById('footer');
    
    if (navbarContainer) navbarContainer.innerHTML = '';
    if (footerContainer) footerContainer.innerHTML = '';
    
    // Esperar un frame para que el DOM se actualice
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Cargar de nuevo
    return await loadLayout();
}

export default loadLayout;