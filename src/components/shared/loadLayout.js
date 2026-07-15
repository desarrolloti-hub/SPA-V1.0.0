/* ========================================
   LOAD LAYOUT
   Carga layouts persistentes (navbar y footer)
   ======================================== */

/**
 * Carga los layouts persistentes en el DOM
 * @returns {Promise<Object>} - Retorna las rutas de los layouts cargados
 */
export async function loadLayout() {
    // Cargar navbar y footer en paralelo
    const [navbarHTML, footerHTML] = await Promise.all([
        fetch('/components/visitor/navbarVisitor.html').then(r => {
            if (!r.ok) throw new Error('Error cargando navbar');
            return r.text();
        }),
        fetch('/components/visitor/footerVisitor.html').then(r => {
            if (!r.ok) throw new Error('Error cargando footer');
            return r.text();
        })
    ]);

    // Insertar en el DOM
    const navbarContainer = document.getElementById('navbar');
    const footerContainer = document.getElementById('footer');
    
    if (navbarContainer) {
        navbarContainer.innerHTML = navbarHTML;
    }
    
    if (footerContainer) {
        footerContainer.innerHTML = footerHTML;
    }

    return {
        navbarLoaded: true,
        footerLoaded: true
    };
}