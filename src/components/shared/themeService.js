/* ========================================
   THEME SERVICE
   Control de modo oscuro/claro
   ======================================== */

const THEME_KEY = 'rsi_theme';

export const ThemeService = {
    /**
     * Inicializar tema (cargar preferencia guardada)
     */
    init() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
        
        this.updateToggleButton();
    },
    
    /**
     * Activar modo oscuro
     */
    enableDarkMode() {
        document.body.classList.add('dark-mode');
        localStorage.setItem(THEME_KEY, 'dark');
        this.updateToggleButton();
    },
    
    /**
     * Activar modo claro
     */
    enableLightMode() {
        document.body.classList.remove('dark-mode');
        localStorage.setItem(THEME_KEY, 'light');
        this.updateToggleButton();
    },
    
    /**
     * Alternar entre modos
     */
    toggle() {
        if (document.body.classList.contains('dark-mode')) {
            this.enableLightMode();
        } else {
            this.enableDarkMode();
        }
    },
    
    /**
     * Actualizar ícono y texto del botón
     */
    updateToggleButton() {
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (!toggleBtn) return;
        
        const isDark = document.body.classList.contains('dark-mode');
        const icon = toggleBtn.querySelector('i');
        const span = toggleBtn.querySelector('span');
        
        if (isDark) {
            if (icon) icon.className = 'fas fa-sun';
            if (span) span.textContent = 'Modo claro';
        } else {
            if (icon) icon.className = 'fas fa-moon';
            if (span) span.textContent = 'Modo oscuro';
        }
    },
    
    /**
     * Verificar si está en modo oscuro
     */
    isDarkMode() {
        return document.body.classList.contains('dark-mode');
    }
};

export default ThemeService;