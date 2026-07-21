/* ========================================
   AUTH SERVICE
   Lógica de negocio para autenticación
   ======================================== */

import AuthRepository from '../repositories/authRepository.js';

export class AuthService {
    
    constructor() {
        this.repository = new AuthRepository();
    }

    /**
     * Valida los campos del login
     * @param {Object} data - Datos del formulario
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateLogin(data) {
        const errors = {};

        if (!data.email || !this._isValidEmail(data.email)) {
            errors.email = 'Correo electrónico inválido';
        }

        if (!data.password || data.password.length < 6) {
            errors.password = 'La contraseña debe tener al menos 6 caracteres';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida un email
     * @param {string} email
     * @returns {boolean}
     */
    _isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Inicia sesión
     * @param {Object} data - Datos del login
     * @returns {Promise<Object>} - Resultado del login
     */
    async login(data) {
        try {
            // 1. Validar datos
            const validation = this.validateLogin(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            // 2. Autenticar con Firebase
            const userCredential = await this.repository.login(data.email, data.password);
            const user = userCredential.user;

            // 3. Obtener datos del usuario desde Firestore
            const userData = await this.repository.getUserData(user.uid);

            if (!userData) {
                throw new Error('No se encontraron datos del usuario');
            }

            // 4. Verificar rol (opcional)
            if (userData.rol !== 'partner' && userData.rol !== 'admin') {
                throw new Error('No tienes permisos para acceder a esta área');
            }

            // 5. Guardar sesión en localStorage (opcional)
            const session = {
                uid: user.uid,
                email: user.email,
                displayName: userData.nombreCompleto || user.email,
                rol: userData.rol,
                ...userData
            };

            localStorage.setItem('rsi_session', JSON.stringify(session));

            return {
                success: true,
                user: session,
                message: 'Inicio de sesión exitoso'
            };

        } catch (error) {
            console.error('❌ Error en login service:', error);
            
            // Si es un error de validación, re-lanzar
            if (error.message.includes('{"')) {
                throw error;
            }
            
            throw new Error(error.message || 'Error al iniciar sesión');
        }
    }

    /**
     * Cierra sesión
     * @returns {Promise<Object>}
     */
    async logout() {
        try {
            await this.repository.logout();
            localStorage.removeItem('rsi_session');
            return {
                success: true,
                message: 'Sesión cerrada correctamente'
            };
        } catch (error) {
            console.error('❌ Error en logout:', error);
            throw new Error('Error al cerrar sesión');
        }
    }

    /**
     * Obtiene la sesión actual
     * @returns {Object|null}
     */
    getSession() {
        try {
            const session = localStorage.getItem('rsi_session');
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    }

    /**
     * Verifica si el usuario está autenticado
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        const user = await this.repository.getCurrentUser();
        return !!user;
    }
}

export default AuthService;