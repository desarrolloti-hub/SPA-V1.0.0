/* ========================================
   NAVBAR CONTROLLER - RSI Enterprise
   ======================================== */

import ThemeService from '../shared/themeService.js';
import AuthService from '../../services/authService.js';

let state = {
    isMenuOpen: false,
    isScrolled: false,
    currentUser: null,
    isDarkMode: false
};

let elements = {};
let authService = null;
let eventListeners = [];

export function initNavbarController() {
    console.log('🧭 Inicializando Navbar Controller');
    
    authService = new AuthService();
    cacheElements();
    
    if (!elements.navbar) {
        console.warn('⚠️ Navbar no encontrado en el DOM');
        return null;
    }
    
    // ✅ Cargar sesión y actualizar perfil
    loadUserSession();
    
    // ✅ Inicializar tema
    initThemeToggle();
    updateLogo(ThemeService.isDarkMode());
    
    bindEvents();
    setActiveLink();
    handleScroll();
    
    // ✅ Escuchar recarga del navbar
    document.addEventListener('navbarLoaded', () => {
        console.log('🔄 Navbar recargado');
        cleanup();
        setTimeout(initNavbarController, 50);
    });
    
    console.log('✅ Navbar Controller inicializado');
    
    return {
        updateUser,
        closeMenu,
        setActiveLink,
        getState,
        toggleTheme: ThemeService.toggle
    };
}

function cacheElements() {
    elements = {
        navbar: document.querySelector('.nan_navbar'),
        hamburger: document.querySelector('.nan_hamburger'),
        closeBtn: document.querySelector('.nan_close'),
        menu: document.querySelector('.nan_menu'),
        menuLinks: document.querySelectorAll('.nan_menu li a'),
        themeSwitchDesktop: document.getElementById('themeToggleDesktop'),
        themeSwitchMobile: document.getElementById('themeToggleMobile'),
        logo: document.getElementById('navbarLogo'),
        dropdownTriggers: document.querySelectorAll('.nan_dropdown-trigger'),
        dropdownItems: document.querySelectorAll('.nan_dropdown-item'),
        body: document.body,
        // Elementos del perfil
        userAvatar: document.getElementById('userAvatar'),
        userName: document.getElementById('userName'),
        userRole: document.getElementById('userRole'),
        dropdownAvatar: document.getElementById('dropdownAvatar'),
        dropdownName: document.getElementById('dropdownName'),
        dropdownRole: document.getElementById('dropdownRole'),
        menuAvatar: document.getElementById('menuAvatar'),
        menuName: document.getElementById('menuName'),
        menuRole: document.getElementById('menuRole'),
        userInfo: document.querySelector('.nan-user-info'),
        userDropdown: document.querySelector('.nan-user-dropdown'),
        logoutBtn: document.getElementById('logoutBtn'),
        logoutBtnMobile: document.getElementById('logoutBtnMobile'),
        terminarAsistencia: document.getElementById('terminarAsistencia')
    };
}

function bindEvents() {
    // Menú hamburguesa
    if (elements.hamburger) {
        elements.hamburger.addEventListener('click', openMenu);
        eventListeners.push({ element: elements.hamburger, event: 'click', handler: openMenu });
    }
    
    if (elements.closeBtn) {
        elements.closeBtn.addEventListener('click', closeMenu);
        eventListeners.push({ element: elements.closeBtn, event: 'click', handler: closeMenu });
    }
    
    // Scroll
    window.addEventListener('scroll', handleScroll);
    eventListeners.push({ element: window, event: 'scroll', handler: handleScroll });
    
    // Click fuera
    document.addEventListener('click', handleClickOutside);
    eventListeners.push({ element: document, event: 'click', handler: handleClickOutside });
    
    // Resize
    window.addEventListener('resize', handleResize);
    eventListeners.push({ element: window, event: 'resize', handler: handleResize });
    
    // Clicks en enlaces
    if (elements.menu) {
        elements.menu.addEventListener('click', handleLinkClick);
        eventListeners.push({ element: elements.menu, event: 'click', handler: handleLinkClick });
    }
    
    // Dropdown triggers
    if (elements.dropdownTriggers) {
        elements.dropdownTriggers.forEach(trigger => {
            const handler = (e) => handleDropdownToggle(e);
            trigger.addEventListener('click', handler);
            eventListeners.push({ element: trigger, event: 'click', handler });
        });
    }
    
    // Tema
    const themeToggles = [elements.themeSwitchDesktop, elements.themeSwitchMobile];
    themeToggles.forEach(toggle => {
        if (toggle) {
            const handler = (e) => handleThemeChange(e);
            toggle.addEventListener('change', handler);
            eventListeners.push({ element: toggle, event: 'change', handler });
        }
    });
    
    // Logout
    if (elements.logoutBtn) {
        const handler = (e) => {
            e.preventDefault();
            handleLogout();
        };
        elements.logoutBtn.addEventListener('click', handler);
        eventListeners.push({ element: elements.logoutBtn, event: 'click', handler });
    }
    
    if (elements.logoutBtnMobile) {
        const handler = (e) => {
            e.preventDefault();
            handleLogout();
        };
        elements.logoutBtnMobile.addEventListener('click', handler);
        eventListeners.push({ element: elements.logoutBtnMobile, event: 'click', handler });
    }
    
    // Terminar asistencia
    if (elements.terminarAsistencia) {
        const handler = (e) => {
            e.preventDefault();
            handleTerminarAsistencia();
        };
        elements.terminarAsistencia.addEventListener('click', handler);
        eventListeners.push({ element: elements.terminarAsistencia, event: 'click', handler });
    }
    
    // Perfil - toggle dropdown
    if (elements.userInfo) {
        const handler = (e) => {
            e.stopPropagation();
            elements.userDropdown.classList.toggle('active');
            elements.userInfo.classList.toggle('active');
        };
        elements.userInfo.addEventListener('click', handler);
        eventListeners.push({ element: elements.userInfo, event: 'click', handler });
    }
    
    // Evento de tema global
    document.addEventListener('theme:changed', (e) => {
        const isDark = e.detail.isDarkMode;
        state.isDarkMode = isDark;
        updateLogo(isDark);
        updateThemeSwitches(isDark);
    });
}

/**
 * CARGA LA SESIÓN DEL USUARIO
 */
function loadUserSession() {
    const session = authService.getSession();
    
    console.log('👤 Sesión:', session);
    
    if (session) {
        state.currentUser = session;
        updateUserProfile(session);
    } else {
        console.log('👤 No hay sesión activa');
    }
}

/**
 * ACTUALIZA EL PERFIL DEL USUARIO EN EL NAVBAR
 */
function updateUserProfile(user) {
    if (!user) return;
    
    const displayName = user.displayName || user.nombreCompleto || user.email || 'Usuario';
    const area = user.areaNombre || user.subarea || 'Sin área';
    const fotoPerfil = user.fotoPerfil || null;
    const areaFormatted = area.charAt(0).toUpperCase() + area.slice(1);
    
    // ✅ Actualizar avatares
    const avatarIds = ['userAvatar', 'dropdownAvatar', 'menuAvatar'];
    avatarIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (fotoPerfil && fotoPerfil.startsWith('data:image')) {
                el.src = fotoPerfil;
            } else {
                el.src = '/assets/images/default-avatar.png';
            }
        }
    });
    
    // ✅ Actualizar nombres
    const nameIds = ['userName', 'dropdownName', 'menuName'];
    nameIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = displayName;
        }
    });
    
    // ✅ Actualizar roles/áreas
    const roleIds = ['userRole', 'dropdownRole', 'menuRole'];
    roleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = areaFormatted;
        }
    });
    
    console.log('✅ Perfil actualizado:', { displayName, area: areaFormatted });
}

/**
 * ACTUALIZA EL USUARIO (para uso externo)
 */
function updateUser(user) {
    state.currentUser = user;
    if (user) {
        updateUserProfile(user);
    }
}

/**
 * MANEJA EL CAMBIO DE TEMA
 */
function handleThemeChange(e) {
    const isDarkMode = e.target.checked;
    
    if (isDarkMode) {
        ThemeService.enableDarkMode();
    } else {
        ThemeService.enableLightMode();
    }
    
    state.isDarkMode = isDarkMode;
    updateLogo(isDarkMode);
    updateThemeSwitches(isDarkMode);
    
    document.dispatchEvent(new CustomEvent('theme:changed', {
        detail: { isDarkMode }
    }));
}

/**
 * INICIALIZA EL TEMA
 */
function initThemeToggle() {
    const isDark = ThemeService.isDarkMode();
    state.isDarkMode = isDark;
    updateThemeSwitches(isDark);
    updateLogo(isDark);
}

/**
 * ACTUALIZA TODOS LOS SWITCHES DE TEMA
 */
function updateThemeSwitches(isDark) {
    const toggles = [elements.themeSwitchDesktop, elements.themeSwitchMobile];
    toggles.forEach(toggle => {
        if (toggle) {
            toggle.checked = isDark;
        }
    });
}

/**
 * ACTUALIZA EL LOGO SEGÚN EL TEMA
 */
function updateLogo(isDark) {
    if (!elements.logo) return;
    
    elements.logo.src = isDark 
        ? '/assets/icons/logoBlanco.png' 
        : '/assets/icons/logo.png';
    
    // Transición suave
    elements.logo.style.opacity = '0.5';
    setTimeout(() => {
        elements.logo.style.opacity = '1';
    }, 50);
}

/**
 * MANEJA EL TOGGLE DE DROPDOWN
 */
function handleDropdownToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const trigger = e.currentTarget;
    const parent = trigger.closest('.nan_dropdown-item');
    
    if (!parent) return;
    
    // En desktop, el hover maneja el dropdown
    if (window.innerWidth > 992) {
        return;
    }
    
    // Cerrar otros dropdowns abiertos en mobile
    elements.dropdownItems.forEach(item => {
        if (item !== parent && item.classList.contains('active')) {
            item.classList.remove('active');
        }
    });
    
    parent.classList.toggle('active');
}

/**
 * ABRE EL MENÚ MOBILE
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
 * CIERRA EL MENÚ MOBILE
 */
function closeMenu() {
    if (!elements.menu) return;
    
    elements.menu.classList.remove('active');
    elements.body.classList.remove('menu-open');
    elements.body.style.overflow = '';
    state.isMenuOpen = false;
    
    // Cerrar dropdowns al cerrar menú
    elements.dropdownItems.forEach(item => {
        item.classList.remove('active');
    });
    
    if (elements.closeBtn) {
        elements.closeBtn.style.display = 'none';
    }
    if (elements.hamburger) {
        elements.hamburger.style.display = 'block';
    }
}

/**
 * MANEJA EL SCROLL PARA EL NAVBAR
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
 * MANEJA CLICK FUERA DEL MENÚ
 */
function handleClickOutside(event) {
    if (!state.isMenuOpen) return;
    
    const isClickInsideMenu = elements.menu?.contains(event.target);
    const isClickOnHamburger = elements.hamburger?.contains(event.target);
    const isClickOnThemeSwitch = elements.themeSwitchDesktop?.contains(event.target) || 
                                  elements.themeSwitchMobile?.contains(event.target);
    
    if (!isClickInsideMenu && !isClickOnHamburger && !isClickOnThemeSwitch) {
        closeMenu();
    }
}

/**
 * MANEJA EL RESIZE
 */
function handleResize() {
    if (window.innerWidth > 992) {
        if (state.isMenuOpen) {
            closeMenu();
        }
        elements.dropdownItems.forEach(item => {
            item.classList.remove('active');
        });
    }
}

/**
 * MANEJA CLICK EN ENLACES
 */
function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        
        if (!href || href === '#') return;
        
        if (!href.startsWith('http')) {
            e.preventDefault();
            closeMenu();
            
            // Navegar
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(href);
            } else {
                window.location.href = href;
            }
        }
    }
}

/**
 * SETEA EL ENLACE ACTIVO
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
            const parent = link.closest('.nan_dropdown-item');
            if (parent) {
                parent.classList.add('active');
            }
        } else if (linkPath !== '/' && currentPath.startsWith(linkPath)) {
            link.classList.add('active');
            const parent = link.closest('.nan_dropdown-item');
            if (parent) {
                parent.classList.add('active');
            }
        } else if (currentPath === '/' && linkPath === '/') {
            link.classList.add('active');
        }
    });
}

/**
 * MANEJA TERMINAR ASISTENCIA
 */
function handleTerminarAsistencia() {
    console.log('📋 Terminar asistencia');
    
    Swal.fire({
        icon: 'question',
        title: '¿Terminar asistencia?',
        text: '¿Estás seguro de que quieres terminar tu jornada laboral?',
        showCancelButton: true,
        confirmButtonText: 'Sí, terminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                icon: 'success',
                title: '¡Asistencia terminada!',
                text: 'Tu jornada laboral ha sido registrada correctamente.',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
        }
    });
}

/**
 * MANEJA EL LOGOUT - ACTUALIZADO PARA REDIRIGIR A /login
 */
async function handleLogout() {
    const result = await Swal.fire({
        icon: 'question',
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que quieres cerrar sesión?',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
    });
    
    if (result.isConfirmed) {
        try {
            // Mostrar loading
            Swal.fire({
                title: 'Cerrando sesión...',
                text: 'Por favor espera un momento',
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Ejecutar logout con redirección a /login
            await authService.logout(true);
            
            // Cerrar cualquier SweetAlert abierto
            Swal.close();
            
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al cerrar sesión. Intenta nuevamente.',
                confirmButtonText: 'Intentar de nuevo',
                confirmButtonColor: '#dc3545'
            });
        }
    }
}

/**
 * OBTIENE EL ESTADO ACTUAL
 */
function getState() {
    return { ...state };
}

/**
 * LIMPIA EVENT LISTENERS
 */
function cleanup() {
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) {
            element.removeEventListener(event, handler);
        }
    });
    eventListeners = [];
}

export default initNavbarController;