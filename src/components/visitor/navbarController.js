/* ========================================
   NAVBAR CONTROLLER - RSI Enterprise
   ======================================== */

import ThemeService from '../shared/themeService.js';
import AuthService from '../../services/authService.js';
import AsistenciaService from '../../services/asistenciaService.js';
import { CategoriaService } from '../../services/categoriaService.js';
import { cartService } from '../../services/cartService.js';
import { wishlistService } from '../../services/wishlistService.js';

let state = {
    isMenuOpen: false,
    isScrolled: false,
    currentUser: null,
    isDarkMode: false
};

let elements = {};
let authService = null;
let eventListeners = [];

let isNavbarListenerBound = false;

export function initNavbarController() {
    console.log('🧭 Inicializando Navbar Controller');

    // Limpiar listeners previos antes de reinicializar para evitar duplicados
    cleanup();

    // Escuchar recarga del navbar una sola vez a nivel de documento
    if (!isNavbarListenerBound) {
        document.addEventListener('navbarLoaded', () => {
            console.log('🔄 Navbar recargado');
            cleanup();
            setTimeout(initNavbarController, 50);
        });
        isNavbarListenerBound = true;
    }

    authService = new AuthService();
    cacheElements();

    if (!elements.navbar) {
        console.warn('⚠️ Navbar no encontrado en el DOM');
        return null;
    }

    // Cargar sesión y actualizar perfil
    loadUserSession();

    // Inicializar tema
    initThemeToggle();
    updateLogo(ThemeService.isDarkMode());

    bindEvents();
    closeAllDropdowns(false);
    setActiveLink();
    handleScroll();
    populateVisitorCategoriesDropdown();

    console.log('✅ Navbar Controller inicializado');

    return {
        updateUser,
        closeMenu,
        closeAllDropdowns,
        setActiveLink,
        getState,
        cleanup,
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
        terminarAsistencia: document.getElementById('terminarAsistencia'),
        terminarAsistenciaMobile: document.getElementById('terminarAsistenciaMobile')
    };
}

function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

function bindEvents() {
    // Menú hamburguesa
    if (elements.hamburger) {
        addManagedListener(elements.hamburger, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMenu();
        });
    }

    if (elements.closeBtn) {
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
        };
        addManagedListener(elements.closeBtn, 'click', handleClose);
        addManagedListener(elements.closeBtn, 'pointerdown', handleClose);
    }

    // Scroll
    addManagedListener(window, 'scroll', handleScroll, { passive: true });

    // Click / pointerdown fuera y tecla Escape
    addManagedListener(document, 'pointerdown', handleClickOutside);
    addManagedListener(document, 'click', handleClickOutside);
    addManagedListener(document, 'keydown', handleKeyDown);

    // Resize
    addManagedListener(window, 'resize', handleResize);

    // Clicks en enlaces del menú principal y submenús
    if (elements.menu) {
        addManagedListener(elements.menu, 'click', (e) => {
            if (e.target === elements.menu) {
                closeMenu();
                return;
            }
            handleLinkClick(e);
        });
    }

    // Clicks en enlaces dentro del dropdown de usuario (ej. Mi Perfil, Dashboard)
    if (elements.userDropdown) {
        addManagedListener(elements.userDropdown, 'click', handleLinkClick);
    }

    // Dropdown items: limpiar clase de cierre temporal cuando el cursor sale del elemento
    if (elements.dropdownItems) {
        elements.dropdownItems.forEach(item => {
            const leaveHandler = () => item.classList.remove('dropdown-closing');
            addManagedListener(item, 'mouseleave', leaveHandler);
            addManagedListener(item, 'pointerleave', leaveHandler);
        });
    }

    // Dropdown triggers
    if (elements.dropdownTriggers) {
        elements.dropdownTriggers.forEach(trigger => {
            const handler = (e) => handleDropdownToggle(e);
            addManagedListener(trigger, 'click', handler);
        });
    }

    // Tema
    const themeToggles = [elements.themeSwitchDesktop, elements.themeSwitchMobile];
    themeToggles.forEach(toggle => {
        if (toggle) {
            const handler = (e) => handleThemeChange(e);
            addManagedListener(toggle, 'change', handler);
        }
    });

    // Logout
    if (elements.logoutBtn) {
        const handler = (e) => {
            e.preventDefault();
            closeAllDropdowns(true);
            handleLogout();
        };
        addManagedListener(elements.logoutBtn, 'click', handler);
    }

    if (elements.logoutBtnMobile) {
        const handler = (e) => {
            e.preventDefault();
            closeAllDropdowns(true);
            closeMenu();
            handleLogout();
        };
        addManagedListener(elements.logoutBtnMobile, 'click', handler);
    }

    // Terminar asistencia
    if (elements.terminarAsistencia) {
        const handler = (e) => {
            e.preventDefault();
            closeAllDropdowns(true);
            handleTerminarAsistencia();
        };
        addManagedListener(elements.terminarAsistencia, 'click', handler);
    }

    if (elements.terminarAsistenciaMobile) {
        const handler = (e) => {
            e.preventDefault();
            closeAllDropdowns(true);
            closeMenu();
            handleTerminarAsistencia();
        };
        addManagedListener(elements.terminarAsistenciaMobile, 'click', handler);
    }

    // Perfil - toggle dropdown
    if (elements.userInfo && elements.userDropdown) {
        const handler = (e) => {
            e.stopPropagation();
            const willOpen = !elements.userDropdown.classList.contains('active');
            closeAllDropdowns(false);
            if (willOpen) {
                elements.userDropdown.classList.add('active');
                elements.userInfo.classList.add('active');
                elements.userInfo.setAttribute('aria-expanded', 'true');
            }
        };
        addManagedListener(elements.userInfo, 'click', handler);
    }

    // Evento de tema global
    const themeChangeHandler = (e) => {
        const isDark = e.detail.isDarkMode;
        state.isDarkMode = isDark;
        updateLogo(isDark);
        updateThemeSwitches(isDark);
    };
    addManagedListener(document, 'theme:changed', themeChangeHandler);

    // Cerrar menús inmediatamente cuando inicia un cambio de ruta
    const routeChangingHandler = () => {
        closeAllDropdowns(true);
        if (state.isMenuOpen) {
            closeMenu();
        }
    };
    addManagedListener(document, 'route:changing', routeChangingHandler);

    // Navegación SPA reactiva y botones atrás/adelante para sincronizar estado de menús y enlace activo
    const routeChangeHandler = () => {
        cacheElements();
        closeAllDropdowns(true);
        if (state.isMenuOpen) {
            closeMenu();
        }
        setActiveLink();
        loadUserSession();
    };
    addManagedListener(document, 'route:changed', routeChangeHandler);
    addManagedListener(window, 'popstate', routeChangeHandler);
}

/**
 * CIERRA TODAS LAS LISTAS DESPLEGABLES (CATEGORÍAS Y PERFIL DE USUARIO)
 * @param {boolean} suppressHover - Si es true, añade .dropdown-closing para cerrar inmediatamente aunque el cursor siga encima en desktop
 */
function closeAllDropdowns(suppressHover = false) {
    const dropdownItems = document.querySelectorAll('.nan_dropdown-item');
    dropdownItems.forEach(item => {
        item.classList.remove('active', 'dropdown-open');
        if (suppressHover && window.innerWidth > 992) {
            item.classList.add('dropdown-closing');
        }
        const trigger = item.querySelector('.nan_dropdown-trigger');
        if (trigger) {
            trigger.classList.remove('dropdown-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    const userDropdown = document.querySelector('.nan-user-dropdown');
    if (userDropdown) {
        userDropdown.classList.remove('active');
    }

    const userInfo = document.querySelector('.nan-user-info');
    if (userInfo) {
        userInfo.classList.remove('active');
        userInfo.setAttribute('aria-expanded', 'false');
    }
}

/**
 * CARGA LA SESIÓN DEL USUARIO
 */
function loadUserSession() {
    if (!authService) authService = new AuthService();
    const session = authService.getSession();

    if (session) {
        state.currentUser = session;
        updateUserProfile(session);
    } else {
        state.currentUser = null;
        updateUserProfile(null);
    }

    try {
        cartService.getCart();
        wishlistService.getWishlist();
    } catch (e) {}
}

/**
 * ACTUALIZA EL PERFIL DEL USUARIO EN EL NAVBAR
 */
function updateUserProfile(user) {
    if (!user) return;

    const displayName = user.displayName || user.nombreCompleto || user.email || 'Usuario';
    let area = user.areaNombre || user.subareaNombre || user.subarea;
    if (!area) {
        if (user.rol === 'admin') {
            area = 'Administración';
        } else if (user.rol === 'buyer' || user.rol === 'customer') {
            area = 'Comprador';
        } else {
            area = 'Colaborador';
        }
    }
    const fotoPerfil = user.fotoPerfil || null;
    const areaFormatted = area.charAt(0).toUpperCase() + area.slice(1);

    // Actualizar avatares (soportando URLs de Firebase Storage, rutas locales o data:image)
    const avatarIds = ['userAvatar', 'dropdownAvatar', 'menuAvatar'];
    avatarIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (fotoPerfil && (fotoPerfil.startsWith('http') || fotoPerfil.startsWith('/') || fotoPerfil.startsWith('data:image'))) {
                el.src = fotoPerfil;
            } else {
                el.src = '/assets/images/default-avatar.png';
            }
        }
    });

    // Actualizar nombres
    const nameIds = ['userName', 'dropdownName', 'menuName'];
    nameIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = displayName;
        }
    });

    // Actualizar roles/áreas
    const roleIds = ['userRole', 'dropdownRole', 'menuRole'];
    roleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = areaFormatted;
        }
    });
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

    elements.logo.style.opacity = '0.5';
    setTimeout(() => {
        if (elements.logo) {
            elements.logo.style.opacity = '1';
        }
    }, 50);
}

/**
 * MANEJA EL TOGGLE DE DROPDOWN (MOBILE Y DESKTOP)
 */
function handleDropdownToggle(e) {
    e.preventDefault();
    e.stopPropagation();

    const trigger = e.currentTarget;
    const parent = trigger.closest('.nan_dropdown-item');

    if (!parent) return;

    // Limpiar bloqueo temporal de hover al hacer clic explícito en el trigger
    parent.classList.remove('dropdown-closing');

    const isOpen = parent.classList.contains('dropdown-open') || parent.classList.contains('active');

    // Cerrar otros dropdowns abiertos y el menú de usuario
    document.querySelectorAll('.nan_dropdown-item').forEach(item => {
        if (item !== parent) {
            item.classList.remove('active', 'dropdown-open');
            const otherTrigger = item.querySelector('.nan_dropdown-trigger');
            if (otherTrigger) {
                otherTrigger.classList.remove('dropdown-open');
                otherTrigger.setAttribute('aria-expanded', 'false');
            }
        }
    });

    if (elements.userDropdown) {
        elements.userDropdown.classList.remove('active');
    }
    if (elements.userInfo) {
        elements.userInfo.classList.remove('active');
        elements.userInfo.setAttribute('aria-expanded', 'false');
    }

    if (isOpen) {
        parent.classList.remove('active', 'dropdown-open');
        trigger.classList.remove('dropdown-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (window.innerWidth > 992) {
            parent.classList.add('dropdown-closing');
        }
    } else {
        parent.classList.add('active', 'dropdown-open');
        trigger.classList.add('dropdown-open');
        trigger.setAttribute('aria-expanded', 'true');
    }
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

    if (elements.hamburger) {
        elements.hamburger.setAttribute('aria-expanded', 'true');
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

    if (elements.hamburger) {
        elements.hamburger.setAttribute('aria-expanded', 'false');
    }

    // Cerrar todos los dropdowns al cerrar menú
    closeAllDropdowns(false);
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
 * MANEJA TECLA ESCAPE PARA CERRAR MENÚS DESPLEGABLES Y MENÚ MÓVIL
 */
function handleKeyDown(event) {
    if (event.key === 'Escape') {
        closeAllDropdowns(true);
        if (state.isMenuOpen) {
            closeMenu();
        }
    }
}

/**
 * MANEJA CLICK / POINTERDOWN FUERA DE LOS MENÚS DESPLEGABLES Y DEL MENÚ MÓVIL
 */
function handleClickOutside(event) {
    const target = event.target;
    if (!target) return;

    // 1. Cerrar dropdowns de categorías si el clic ocurrió fuera de ellos
    const clickedDropdownItem = target.closest('.nan_dropdown-item');
    document.querySelectorAll('.nan_dropdown-item.dropdown-open, .nan_dropdown-item.active').forEach(item => {
        if (item !== clickedDropdownItem) {
            item.classList.remove('active', 'dropdown-open');
            const trigger = item.querySelector('.nan_dropdown-trigger');
            if (trigger) {
                trigger.classList.remove('dropdown-open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // 2. Cerrar dropdown de usuario si el clic ocurrió fuera de .nan-user-info y .nan-user-dropdown
    if (elements.userDropdown && elements.userDropdown.classList.contains('active')) {
        const clickedInsideUser = (elements.userInfo && elements.userInfo.contains(target)) ||
            elements.userDropdown.contains(target);
        if (!clickedInsideUser) {
            elements.userDropdown.classList.remove('active');
            if (elements.userInfo) {
                elements.userInfo.classList.remove('active');
                elements.userInfo.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // 3. Cerrar menú móvil si está abierto
    if (state.isMenuOpen) {
        const isClickOnClose = elements.closeBtn && (elements.closeBtn === target || elements.closeBtn.contains(target));
        if (isClickOnClose) {
            closeMenu();
            return;
        }
        const isClickInsideMenu = elements.menu?.contains(target);
        const isClickOnHamburger = elements.hamburger?.contains(target);
        const isClickOnThemeSwitch = elements.themeSwitchDesktop?.contains(target) ||
            elements.themeSwitchMobile?.contains(target);

        if (!isClickInsideMenu && !isClickOnHamburger && !isClickOnThemeSwitch) {
            closeMenu();
        }
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
        closeAllDropdowns(false);
    }
}

/**
 * MANEJA CLICK EN ENLACES (MENÚ PRINCIPAL, SUBMENÚS Y DROPDOWN DE USUARIO)
 */
function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    // Cerrar inmediatamente cualquier dropdown abierto y suprimir el hover residual en desktop
    closeAllDropdowns(true);

    // Quitar el foco del elemento para evitar que :focus-within retenga abierto el submenú
    if (typeof link.blur === 'function') {
        link.blur();
    }

    if (state.isMenuOpen) {
        closeMenu();
    }

    if (!href.startsWith('http')) {
        e.preventDefault();

        // Navegar mediante el router SPA
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(href);
        } else {
            window.location.href = href;
        }
    }
}

/**
 * SETEA EL ENLACE ACTIVO SEGÚN LA RUTA ACTUAL SIN ABRIR LOS DROPDOWNS
 */
function setActiveLink() {
    const menuLinks = document.querySelectorAll('.nan_menu li a');
    const dropdownItems = document.querySelectorAll('.nan_dropdown-item');
    if (!menuLinks || menuLinks.length === 0) return;

    const currentPath = window.location.pathname;

    // 1. Limpiar estados activos y accesibilidad anteriores
    menuLinks.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });

    dropdownItems.forEach(item => {
        item.classList.remove('active', 'dropdown-open', 'has-active-child');
        const trigger = item.querySelector('.nan_dropdown-trigger');
        if (trigger) {
            trigger.classList.remove('active', 'dropdown-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    // 2. Mapeo de vistas secundarias / formularios a su sección de menú correspondiente
    const sectionMap = {
        '/partner/ticket': '/partner/crudTickets',
        '/partner/ticketView': '/partner/crudTickets',
        '/partner/ticketAtencion': '/partner/crudTickets',
        '/partner/partner': '/partner/crudPartners',
        '/partner/area': '/partner/crudAreas',
        '/partner/cliente': '/partner/crudClientes',
        '/partner/cotizacion': '/partner/crudCotizaciones',
        '/partner/factura': '/partner/crudFacturas',
        '/partner/productosServicios': '/partner/crudProductosServicios',
        '/partner/productoServicioView': '/partner/crudProductosServicios',
        '/partner/catalogo': '/partner/crudCatalogos',
        '/partner/verCatalogo': '/partner/crudCatalogos',
        '/verCatalogo': '/catalogos',
        '/servicios': '/catalogos',
        '/services': '/catalogos',
        '/aboutus': '/nosotros',
        '/contact': '/contacto',
        '/products': '/productos',
        '/partner/asistencia': '/partner/asistencia',
        '/hr/asistencias': '/partner/crudAsistencias',
        '/partner/crudReembolsos': '/hr/reembolsos',
        '/partner/reembolso': '/hr/reembolsos',
        '/partner/dashboard': '/partner/dashboard',
        '/partner/mis-salidas': '/partner/mis-salidas',
        '/support/mis-salidas': '/partner/mis-salidas',
        '/partner/reembolsos': '/partner/reembolsos',
        '/partner/reembolso': '/partner/reembolsos',
        '/partner/vehiculos': '/partner/vehiculos',
        '/partner/vehiculo-form': '/partner/vehiculos',
        '/partner/nuevoVehiculo': '/partner/vehiculos',
        '/partner/vehiculoDetalle': '/partner/vehiculos',
        '/partner/checklist-salida': '/partner/checklist-salida',
        '/ops/checklist': '/partner/checklist-salida',
        '/partner/checklists-vehiculos': '/partner/checklists-vehiculos',
        '/ops/historial': '/partner/checklists-vehiculos',
        '/partner/estadisticas': '/support/estadisticas',
        '/partner/carrusel': '/ecommerce/carrusel',
        '/ecommerce/carrusel-form': '/ecommerce/carrusel',
        '/partner/carrusel-form': '/ecommerce/carrusel'
    };

    const targetPath = sectionMap[currentPath] || currentPath;
    let matchFound = false;

    const markLinkAndCategory = (link) => {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
        const parent = link.closest('.nan_dropdown-item');
        if (parent) {
            // IMPORTANTE: Usar .has-active-child en el contenedor y .active solo en el trigger
            // para resaltar visualmente la categoría activa sin abrir el menú desplegable.
            parent.classList.add('has-active-child');
            const trigger = parent.querySelector('.nan_dropdown-trigger');
            if (trigger) {
                trigger.classList.add('active');
            }
        }
    };

    // 3. Coincidencia exacta
    menuLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (!linkPath || linkPath === '#') return;

        if (linkPath === targetPath) {
            markLinkAndCategory(link);
            matchFound = true;
        }
    });

    // 4. Coincidencia por prefijo si no hubo coincidencia exacta (excluyendo raíz '/')
    if (!matchFound && targetPath !== '/') {
        menuLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            if (!linkPath || linkPath === '#' || linkPath === '/') return;

            if (targetPath.startsWith(linkPath)) {
                markLinkAndCategory(link);
            }
        });
    }
}

/**
 * MANEJA TERMINAR ASISTENCIA - FLUJO REAL DE SALIDA
 */
async function handleTerminarAsistencia() {
    console.log('📋 Registrar salida de jornada laboral desde navbar');

    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Terminar jornada laboral?',
        text: '¿Deseas registrar la salida oficial de tus actividades de hoy?',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-door-open"></i> Sí, registrar salida',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmacion.isConfirmed) return;

    Swal.fire({
        title: 'Registrando salida...',
        text: 'Capturando hora y ubicación...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const asisService = new AsistenciaService();
        const resultado = await asisService.registrarSalida();

        if (resultado.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Salida Registrada!',
                text: resultado.mensaje,
                confirmButtonColor: '#1c1948'
            });
            // Notificar a vistas activas (ej. dashboard o asistencia) que la asistencia cambió
            document.dispatchEvent(new CustomEvent('asistencia:updated', { detail: { tipo: 'salida' } }));
            if (window.location.pathname === '/partner/asistencia' && typeof window.navigateTo === 'function') {
                await window.navigateTo('/partner/asistencia');
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar la salida',
                text: resultado.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al conectar con el servicio de asistencias',
            confirmButtonColor: '#1c1948'
        });
    }
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
            closeAllDropdowns(true);
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

            await authService.logout(true);
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
/**
 * CARGA DINÁMICAMENTE LAS CATEGORÍAS ACTIVAS EN EL DROPDOWN DEL VISITANTE
 */
async function populateVisitorCategoriesDropdown() {
    const dropdown = document.querySelector('.nan_dropdown-trigger[data-dropdown="products"]')?.closest('.nan_dropdown-item')?.querySelector('.nan_dropdown-menu');
    if (!dropdown) return;

    try {
        const catService = new CategoriaService();
        const cats = await catService.getAllCategorias();
        const activas = cats.filter(c => c.activo !== false);

        if (activas.length === 0) return;

        let html = `<li><a href="/products" data-link><i class="fas fa-th"></i> Todos los productos</a></li>`;
        activas.forEach(cat => {
            html += `<li><a href="/products?categoria=${cat.slug || cat.id}" data-link><i class="fas fa-tag"></i> ${cat.nombre}</a></li>`;
        });

        dropdown.innerHTML = html;
    } catch (e) {
        console.warn('⚠️ No se pudieron cargar categorías dinámicas en el navbar:', e);
    }
}

function cleanup() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        if (element) {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                // Ignorar error si el elemento fue removido
            }
        }
    });
    eventListeners = [];
    state.isMenuOpen = false;
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
}

export default initNavbarController;