/* ========================================
   NAVBAR CONTROLLER - RSI Enterprise
   Controlador del layout persistente navbar
   ======================================== */
import ThemeService from './themeService.js';
// Estado privado del controller
let state = {
    isMenuOpen: false,
    isScrolled: false,
    currentUser: null
};

// Elementos DOM cacheados
let elements = {};

/**
 * Inicializa el controlador del navbar
 */
export function initNavbarController() {
    cacheElements();
    
    if (!elements.navbar) {
        console.warn('⚠️ Navbar no encontrado en el DOM');
        return null;
    }
    
    bindEvents();
    setActiveLink();
    handleScroll();
    loadUserSession();
    
    // Inicializar tema (modo oscuro/claro)
    ThemeService.init();
    
    console.log('✅ Navbar Controller inicializado');
    
    return {
        updateUser,
        closeMenu,
        setActiveLink,
        getState
    };
}

/**
 * Cachea elementos del DOM
 */
function cacheElements() {
    elements = {
        navbar: document.querySelector('.nan_navbar'),
        hamburger: document.querySelector('.nan_hamburger'),
        closeBtn: document.querySelector('.nan_close'),
        menu: document.querySelector('.nan_menu'),
        menuLinks: document.querySelectorAll('.nan_menu li a'),
        themeBtn: document.getElementById('themeToggleBtn'),
        body: document.body
    };
}

/**
 * Vincula eventos del DOM
 */
function bindEvents() {
    // Eventos menú móvil
    if (elements.hamburger) {
        elements.hamburger.addEventListener('click', openMenu);
    }
    
    if (elements.closeBtn) {
        elements.closeBtn.addEventListener('click', closeMenu);
    }
    
    // Evento scroll
    window.addEventListener('scroll', handleScroll);
    
    // Click fuera del menú
    document.addEventListener('click', handleClickOutside);
    
    // Evento resize
    window.addEventListener('resize', handleResize);
    
    // Escuchar cambios de ruta (disparado por router)
    document.addEventListener('route:changed', () => {
        setActiveLink();
        closeMenu();
    });
    
    // Delegación de eventos para enlaces
    if (elements.menu) {
        elements.menu.addEventListener('click', handleLinkClick);
    }
    
    // Evento del botón de tema (modo oscuro)
    if (elements.themeBtn) {
        elements.themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            ThemeService.toggle();
        });
    }
}

/**
 * Abre menú móvil
 */
function openMenu() {
    if (!elements.menu) return;
    
    elements.menu.classList.add('active');
    elements.body.classList.add('menu-open');
    elements.body.style.overflow = 'hidden';
    state.isMenuOpen = true;
    
    if (elements.closeBtn) {
        elements.closeBtn.style.display = 'block';
    }
    if (elements.hamburger) {
        elements.hamburger.style.display = 'none';
    }
}

/**
 * Cierra menú móvil
 */
function closeMenu() {
    if (!elements.menu) return;
    
    elements.menu.classList.remove('active');
    elements.body.classList.remove('menu-open');
    elements.body.style.overflow = '';
    state.isMenuOpen = false;
    
    if (elements.closeBtn) {
        elements.closeBtn.style.display = 'none';
    }
    if (elements.hamburger) {
        elements.hamburger.style.display = 'block';
    }
}

/**
 * Maneja evento scroll
 */
function handleScroll() {
    if (!elements.navbar) return;
    
    const scrolled = window.scrollY > 50;
    
    if (scrolled !== state.isScrolled) {
        state.isScrolled = scrolled;
        
        if (scrolled) {
            elements.navbar.classList.add('navbar-scrolled');
        } else {
            elements.navbar.classList.remove('navbar-scrolled');
        }
    }
}

/**
 * Maneja click fuera del menú
 */
function handleClickOutside(event) {
    if (!state.isMenuOpen) return;
    
    const isClickInsideMenu = elements.menu?.contains(event.target);
    const isClickOnHamburger = elements.hamburger?.contains(event.target);
    const isClickOnThemeBtn = elements.themeBtn?.contains(event.target);
    
    if (!isClickInsideMenu && !isClickOnHamburger && !isClickOnThemeBtn) {
        closeMenu();
    }
}

/**
 * Maneja resize de ventana
 */
function handleResize() {
    if (window.innerWidth > 992 && state.isMenuOpen) {
        closeMenu();
    }
}

/**
 * Maneja click en enlaces del navbar
 */
function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        
        if (href && !href.startsWith('http') && href !== '#') {
            e.preventDefault();
            addLoadingEffect(link);
            
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(href);
            } else {
                window.location.href = href;
            }
            
            closeMenu();
        }
    }
}

/**
 * Marca enlace activo según ruta actual
 */
function setActiveLink() {
    if (!elements.menuLinks || elements.menuLinks.length === 0) return;
    
    const currentPath = window.location.pathname;
    
    elements.menuLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        
        if (!linkPath || linkPath === '#') return;
        
        link.classList.remove('active');
        
        if (currentPath === linkPath) {
            link.classList.add('active');
        } else if (linkPath !== '/' && currentPath.startsWith(linkPath)) {
            link.classList.add('active');
        } else if (currentPath === '/' && linkPath === '/') {
            link.classList.add('active');
        }
    });
}

/**
 * Agrega efecto de carga a enlace clickeado
 */
function addLoadingEffect(link) {
    link.classList.add('loading');
    setTimeout(() => {
        link.classList.remove('loading');
    }, 500);
}

/**
 * Carga sesión de usuario desde service
 */
async function loadUserSession() {
    try {
        const user = await AuthService.getCurrentUser();
        
        if (user && user.isLoggedIn) {
            state.currentUser = user;
            updateNavbarForLoggedUser(user);
        }
    } catch (error) {
        console.error('Error cargando sesión:', error);
    }
}

/**
 * Actualiza navbar para usuario logueado
 */
function updateNavbarForLoggedUser(user) {
    const menu = elements.menu;
    if (!menu) return;
    
    const loginItem = menu.querySelector('li:last-child');
    if (!loginItem) return;
    
    if (loginItem.querySelector('.rsi-theme-toggle')) return;
    
    const avatarUrl = user.avatar || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Usuario')}&background=1c1948&color=fff`;
    
    loginItem.innerHTML = `
        <div class="nan_user-menu">
            <img src="${avatarUrl}" class="nan_user-avatar" alt="Avatar">
            <span class="nan_user-name">${user.name || 'Usuario'}</span>
            <i class="fas fa-chevron-down"></i>
        </div>
        <ul class="nan_dropdown">
            <li><a href="/perfil" data-link><i class="fas fa-user"></i> Mi Perfil</a></li>
            <li><a href="/dashboard" data-link><i class="fas fa-tachometer-alt"></i> Dashboard</a></li>
            <li><button class="nan_logout-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Cerrar Sesión</button></li>
        </ul>
    `;
    loginItem.classList.add('has-dropdown');
    
    const logoutBtn = loginItem.querySelector('#logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    elements.menuLinks = document.querySelectorAll('.nan_menu li a');
}

/**
 * Maneja cierre de sesión
 */
async function handleLogout() {
    try {
        await AuthService.logout();
        state.currentUser = null;
        window.location.href = '/login';
    } catch (error) {
        console.error('Error en logout:', error);
    }
}

/**
 * Actualiza usuario desde otros controllers
 */
export function updateUser(user) {
    state.currentUser = user;
    if (user && user.isLoggedIn) {
        updateNavbarForLoggedUser(user);
    }
}

/**
 * Obtiene estado actual del navbar
 */
export function getState() {
    return { ...state };
}