/* ========================================
   AUTH SERVICE
   Lógica de negocio para autenticación
   ======================================== */

import AuthRepository from '../repositories/authRepository.js';
import { reloadLayouts } from '../components/shared/loadLayout.js';
import NotificationService from './notificationService.js';
import AsistenciaService from './asistenciaService.js';

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
            if (userData.rol !== 'partner' && userData.rol !== 'admin' && userData.rol !== 'customer' && userData.rol !== 'buyer') {
                throw new Error('No tienes permisos para acceder a esta área');
            }

            // 5. Guardar sesión en localStorage
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
     * @param {boolean} redirectToLogin - Si debe redirigir al login
     * @returns {Promise<Object>}
     */
    async logout(redirectToLogin = true) {
        try {
            // 1. Desvincular token FCM del dispositivo actual si está activo
            try {
                const notificationService = new NotificationService();
                await notificationService.unregisterCurrentDevice();
            } catch (notifErr) {
                console.warn('⚠️ No se pudo desvincular token FCM al cerrar sesión:', notifErr.message);
            }

            // 2. Limpiar localStorage
            localStorage.removeItem('rsi_session');
            localStorage.removeItem('rsi_user');
            
            // 3. Cerrar sesión en Firebase Auth
            await this.repository.logout();
            
            // 4. Recargar layouts para que el navbar y footer cambien a los de visitante de inmediato
            try {
                await reloadLayouts();
            } catch (layoutErr) {
                console.error('❌ Error recargando layouts en logout:', layoutErr);
            }

            // 5. Redirigir al login o página correspondiente mediante el router sin recargar el navegador
            if (redirectToLogin) {
                if (typeof window.navigateTo === 'function') {
                    await window.navigateTo('/login');
                } else {
                    window.location.href = '/login';
                }
            }
            
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
     * Envía correo para restablecer contraseña
     * @param {string} email - Correo del usuario
     * @returns {Promise<boolean>}
     */
    async sendPasswordResetEmail(email) {
        if (!email || !this._isValidEmail(email)) {
            throw new Error('Correo electrónico inválido');
        }
        return await this.repository.sendPasswordResetEmail(email);
    }

    /**
     * Obtiene la sesión actual desde localStorage de forma estática o por instancia
     * @returns {Object|null}
     */
    static getSession() {
        try {
            const session = localStorage.getItem('rsi_session');
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    }

    /**
     * Obtiene la sesión actual
     * @returns {Object|null}
     */
    getSession() {
        return AuthService.getSession();
    }

    /**
     * Verifica si el usuario está autenticado
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        const user = await this.repository.getCurrentUser();
        return !!user;
    }

    /**
     * Resuelve la ruta de aterrizaje para un colaborador autenticado verificando su asistencia diaria en Firestore.
     * - Si el usuario tiene rol 'partner' y NO ha registrado entrada hoy (America/Mexico_City) -> '/partner/asistencia'
     * - Si el usuario tiene rol 'partner' y YA registró entrada hoy -> '/partner/dashboard'
     * - Si el usuario tiene rol 'admin' -> '/partner/dashboard' (sin redirección forzada a asistencia)
     * @returns {Promise<{authenticated: boolean, route: string, haRegistradoEntrada: boolean, estadoHoy: Object|null, session: Object|null}>}
     */
    async resolvePartnerLandingRoute() {
        try {
            const user = await this.repository.getCurrentUser();
            if (!user) {
                return {
                    authenticated: false,
                    route: '/login',
                    haRegistradoEntrada: false,
                    estadoHoy: null,
                    session: null
                };
            }

            let session = this.getSession();
            if (!session || session.uid !== user.uid || !session.rol) {
                const userData = await this.repository.getUserData(user.uid);
                if (userData) {
                    session = {
                        uid: user.uid,
                        email: user.email,
                        displayName: userData.nombreCompleto || user.email,
                        rol: userData.rol,
                        ...userData
                    };
                    localStorage.setItem('rsi_session', JSON.stringify(session));
                }
            }

            if (!session) {
                return {
                    authenticated: false,
                    route: '/login',
                    haRegistradoEntrada: false,
                    estadoHoy: null,
                    session: null
                };
            }

            // Los administradores entran directamente al dashboard sin redirección obligatoria de asistencia
            
            // Para rol 'buyer' (comprador de ecommerce)
            if (session.rol === 'buyer') {
                return {
                    authenticated: true,
                    route: '/buyer/dashboard',
                    haRegistradoEntrada: true,
                    estadoHoy: null,
                    session
                };
            }

            if (session.rol === 'admin') {
                return {
                    authenticated: true,
                    route: '/partner/dashboard',
                    haRegistradoEntrada: true,
                    estadoHoy: null,
                    session
                };
            }

            // Para rol 'partner', consultar registro real del día en Firestore (zona horaria America/Mexico_City)
            if (session.rol === 'partner') {
                const asistenciaService = new AsistenciaService();
                const estadoHoy = await asistenciaService.getEstadoHoy();
                const haRegistradoEntrada = Boolean(estadoHoy && estadoHoy.haRegistradoEntrada);

                return {
                    authenticated: true,
                    route: haRegistradoEntrada ? '/partner/dashboard' : '/partner/asistencia',
                    haRegistradoEntrada,
                    estadoHoy,
                    session
                };
            }

            return {
                authenticated: true,
                route: '/',
                haRegistradoEntrada: false,
                estadoHoy: null,
                session
            };
        } catch (error) {
            console.error('❌ Error al resolver ruta de aterrizaje por asistencia:', error);
            const fallbackSession = this.getSession();
            return {
                authenticated: Boolean(fallbackSession),
                route: fallbackSession?.rol === 'partner' ? '/partner/asistencia' : '/partner/dashboard',
                haRegistradoEntrada: false,
                estadoHoy: null,
                session: fallbackSession
            };
        }
    }

    /**
     * Inicia sesión o registro con Google
     */
    async loginWithGoogle() {
        try {
            const userCredential = await this.repository.loginWithGoogle();
            const user = userCredential.user;

            let userData = await this.repository.getUserData(user.uid);

            if (!userData) {
                // Nuevo comprador registrado con Google
                const now = new Date().toISOString();
                userData = {
                    uid: user.uid,
                    email: user.email,
                    nombreCompleto: user.displayName || user.email.split('@')[0],
                    fotoPerfil: user.photoURL || null,
                    rol: 'buyer',
                    activo: true,
                    createdAt: now,
                    updatedAt: now
                };
                await this.repository.setUserData(user.uid, userData);
            }

            const session = {
                uid: user.uid,
                email: user.email,
                displayName: userData.nombreCompleto || user.displayName || user.email,
                rol: userData.rol || 'buyer',
                ...userData
            };

            localStorage.setItem('rsi_session', JSON.stringify(session));

            document.dispatchEvent(new CustomEvent('auth:login', { detail: { session } }));

            return {
                success: true,
                user: session,
                message: 'Autenticación con Google exitosa'
            };
        } catch (error) {
            console.error('❌ Error en loginWithGoogle:', error);
            throw new Error(error.message || 'Error al iniciar sesión con Google');
        }
    }

    /**
     * Registra una cuenta nueva de comprador (buyer)
     */
    async registerBuyer({ email, password, nombreCompleto }) {
        try {
            if (!email || !password || !nombreCompleto) {
                throw new Error('Todos los campos son obligatorios.');
            }
            if (password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres.');
            }

            const userCredential = await this.repository.createUserWithEmail(email.trim(), password);
            const user = userCredential.user;
            const now = new Date().toISOString();

            const userData = {
                uid: user.uid,
                email: user.email,
                nombreCompleto: nombreCompleto.trim(),
                rol: 'buyer',
                activo: true,
                createdAt: now,
                updatedAt: now
            };

            await this.repository.setUserData(user.uid, userData);

            const session = {
                uid: user.uid,
                email: user.email,
                displayName: userData.nombreCompleto,
                rol: 'buyer',
                ...userData
            };

            localStorage.setItem('rsi_session', JSON.stringify(session));

            document.dispatchEvent(new CustomEvent('auth:login', { detail: { session } }));

            return {
                success: true,
                user: session,
                message: 'Cuenta creada exitosamente.'
            };
        } catch (error) {
            console.error('❌ Error en registerBuyer:', error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Este correo ya está registrado.');
            }
            throw new Error(error.message || 'Error al registrar la cuenta');
        }
    }
}

export default AuthService;
