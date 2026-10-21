/* ==========================================================================
   REGISTER CONTROLLER - RSI Enterprise
   Controlador para el registro de clientes / compradores (buyer)
   ========================================================================== */

import AuthService from '../../services/authService.js';
import { reloadLayouts } from '../../components/shared/loadLayout.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class RegisterController {
    constructor() {
        this.authService = new AuthService();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) this.cleanup();
        this.isInitialized = true;

        const session = this.authService.getSession();
        if (session) {
            window.history.pushState({}, '', '/buyer/dashboard');
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        this.bindEvents();
    }

    bindEvents() {
        const form = document.getElementById('registerForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleRegister(e));
        }

        const btnGoogle = document.getElementById('btnGoogleRegister');
        if (btnGoogle) {
            btnGoogle.addEventListener('click', () => this.handleGoogleRegister());
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const nombre = document.getElementById('regNombre')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const password = document.getElementById('regPassword')?.value;
        const submitBtn = document.getElementById('btnRegisterSubmit');

        if (!nombre || !email || !password) {
            Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Por favor completa todos los campos.' });
            return;
        }

        if (password.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Contraseña débil', text: 'La contraseña debe tener al menos 6 caracteres.' });
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
            }

            const res = await this.authService.registerBuyer({
                nombreCompleto: nombre,
                email,
                password
            });

            try {
                await reloadLayouts();
            } catch (err) {}

            await Swal.fire({
                icon: 'success',
                title: '¡Cuenta creada!',
                text: 'Bienvenido a RSI Enterprise. Tu cuenta de cliente ha sido activada.',
                timer: 1600,
                showConfirmButton: false
            });

            window.history.pushState({}, '', '/buyer/dashboard');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
            console.error('❌ Error en registro de cliente:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de registro',
                text: error.message || 'No se pudo crear la cuenta.'
            });
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Registrarme como Cliente';
            }
        }
    }

    async handleGoogleRegister() {
        try {
            Swal.fire({
                title: 'Conectando con Google...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            await this.authService.loginWithGoogle();

            try {
                await reloadLayouts();
            } catch (err) {}

            await Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: 'Cuenta vinculada correctamente con Google.',
                timer: 1400,
                showConfirmButton: false
            });

            window.history.pushState({}, '', '/buyer/dashboard');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
            console.error('❌ Error en Google register:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de autenticación',
                text: error.message || 'No se pudo completar el registro con Google.'
            });
        }
    }

    cleanup() {
        this.isInitialized = false;
    }
}

export const registerController = () => {
    const ctrl = new RegisterController();
    ctrl.init();
    return ctrl;
};

export default registerController;
