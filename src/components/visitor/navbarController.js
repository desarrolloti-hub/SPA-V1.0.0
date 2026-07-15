/* ========================================
   NAVBAR CONTROLLER - RSI Enterprise
   ======================================== */
import ThemeService from '../shared/themeService.js';

let state = {
    isMenuOpen: false,
    isScrolled: false,
    currentUser: null,
    isDarkMode: false
};

let elements = {};

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
    initThemeToggle();
    
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
        themeSwitch: document.getElementById('themeToggleSwitch'),
        logo: document.getElementById('navbarLogo'),
        dropdownTriggers: document.querySelectorAll('.nan_dropdown-trigger'),
        dropdownItems: document.querySelectorAll('.nan_dropdown-item'),
        body: document.body
    };
}

function bindEvents() {
    if (elements.hamburger) {
        elements.hamburger.addEventListener('click', openMenu);
    }
    
    if (elements.closeBtn) {
        elements.closeBtn.addEventListener('click', closeMenu);
    }
    
    window.addEventListener('scroll', handleScroll);
    
    document.addEventListener('click', handleClickOutside);
    
    window.addEventListener('resize', handleResize);
    
    document.addEventListener('route:changed', () => {
        setActiveLink();
        closeMenu();
    });
    
    if (elements.menu) {
        elements.menu.addEventListener('click', handleLinkClick);
    }
    
    // Dropdown triggers - solo en mobile
    if (elements.dropdownTriggers) {
        elements.dropdownTriggers.forEach(trigger => {
            trigger.addEventListener('click', handleDropdownToggle);
            
            // En desktop, hover maneja el dropdown
            if (window.innerWidth > 992) {
                trigger.addEventListener('mouseenter', () => {
                    const parent = trigger.closest('.nan_dropdown-item');
                    if (parent) {
                        elements.dropdownItems.forEach(item => {
                            if (item !== parent) {
                                item.classList.remove('active');
                            }
                        });
                        parent.classList.add('active');
                    }
                });
            }
        });
    }
    
    // Cerrar dropdowns al salir del mouse en desktop
    if (elements.dropdownItems) {
        elements.dropdownItems.forEach(item => {
            item.addEventListener('mouseleave', () => {
                if (window.innerWidth > 992) {
                    item.classList.remove('active');
                }
            });
        });
    }
    
    document.addEventListener('theme:changed', (e) => {
        const isDark = e.detail.isDarkMode;
        state.isDarkMode = isDark;
        updateLogo(isDark);
        updateThemeSwitch(isDark);
    });
}

function initThemeToggle() {
    if (!elements.themeSwitch) return;
    
    const isDark = ThemeService.isDarkMode();
    elements.themeSwitch.checked = isDark;
    state.isDarkMode = isDark;
    updateLogo(isDark);
    
    elements.themeSwitch.addEventListener('change', (e) => {
        e.stopPropagation();
        const isDarkMode = e.target.checked;
        
        if (isDarkMode) {
            ThemeService.enableDarkMode();
        } else {
            ThemeService.enableLightMode();
        }
        
        state.isDarkMode = isDarkMode;
        updateLogo(isDarkMode);
        
        document.dispatchEvent(new CustomEvent('theme:changed', {
            detail: { isDarkMode }
        }));
    });
    
    // Override ThemeService.toggle para mantener sincronía
    const originalToggle = ThemeService.toggle;
    ThemeService.toggle = function() {
        originalToggle.call(ThemeService);
        const isDark = ThemeService.isDarkMode();
        if (elements.themeSwitch) {
            elements.themeSwitch.checked = isDark;
        }
        state.isDarkMode = isDark;
        updateLogo(isDark);
    };
}

function updateLogo(isDark) {
    if (!elements.logo) return;
    
    elements.logo.src = isDark 
        ? '/assets/icons/logoBlanco.png' 
        : '/assets/icons/logo.png';
    
    elements.logo.style.opacity = '0.7';
    setTimeout(() => {
        elements.logo.style.opacity = '1';
    }, 50);
}

function updateThemeSwitch(isDark) {
    if (elements.themeSwitch) {
        elements.themeSwitch.checked = isDark;
    }
}

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

function handleClickOutside(event) {
    if (!state.isMenuOpen) return;
    
    const isClickInsideMenu = elements.menu?.contains(event.target);
    const isClickOnHamburger = elements.hamburger?.contains(event.target);
    const isClickOnThemeSwitch = elements.themeSwitch?.contains(event.target);
    
    if (!isClickInsideMenu && !isClickOnHamburger && !isClickOnThemeSwitch) {
        closeMenu();
    }
}

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

function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        
        if (!href || href === '#') return;
        
        if (!href.startsWith('http')) {
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

function addLoadingEffect(link) {
    link.classList.add('loading');
    setTimeout(() => {
        link.classList.remove('loading');
    }, 500);
}

async function loadUserSession() {
    try {
        const user = await AuthService?.getCurrentUser();
        if (user && user.isLoggedIn) {
            state.currentUser = user;
            updateNavbarForLoggedUser(user);
        }
    } catch (error) {
        console.error('Error cargando sesión:', error);
    }
}

function updateNavbarForLoggedUser(user) {
    // ... implementación del usuario
}

async function handleLogout() {
    // ... implementación de logout
}

export function updateUser(user) {
    state.currentUser = user;
    if (user && user.isLoggedIn) {
        updateNavbarForLoggedUser(user);
    }
}

export function getState() {
    return { ...state };
}