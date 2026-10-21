/* ==========================================================================
   BUYER PROFILE CONTROLLER - RSI Enterprise
   Controlador para el perfil del comprador
   ========================================================================== */

import AuthService from '../../services/authService.js';

export class BuyerProfileController {
    constructor() {
        this.authService = new AuthService();
        this.session = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        this.session = this.authService.getSession();
        if (!this.session) {
            window.history.pushState({}, '', '/login');
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        this.renderPerfil();
        this.bindEvents();
    }

    renderPerfil() {
        const s = this.session;
        const nameEl = document.getElementById('buyerProfileName');
        const emailEl = document.getElementById('buyerProfileEmail');
        const uidEl = document.getElementById('buyerProfileUid');
        const avatarEl = document.getElementById('buyerProfileAvatar');

        if (nameEl) nameEl.textContent = s.displayName || s.nombreCompleto || 'Cliente RSI';
        if (emailEl) emailEl.textContent = s.email || '';
        if (uidEl) uidEl.value = s.uid || '';
        if (avatarEl && s.fotoPerfil) avatarEl.src = s.fotoPerfil;
    }

    bindEvents() {
        const btnLogout = document.getElementById('btnProfileLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                await this.authService.logout(true);
            });
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const buyerProfileController = () => {
    const ctrl = new BuyerProfileController();
    ctrl.init();
    return ctrl;
};

export default buyerProfileController;
