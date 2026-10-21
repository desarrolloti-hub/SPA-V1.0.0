/* ========================================
   LOGIN CONTROLLER
   ======================================== */

import AuthService from '../../services/authService.js';
import { reloadLayouts } from '../../components/shared/loadLayout.js';
import NotificationService from '../../services/notificationService.js';

let service = null;
let eventListeners = [];

/**
 * Controlador principal del login
 */
export async function loginController() {
    console.log('🔐 Login Controller iniciado');
    
    // Inicializar servicio
    service = new AuthService();
    
    // Verificar si ya hay sesión activa
    const session = service.getSession();
    if (session) {
        console.log('👤 Sesión activa detectada:', session.email);
        const destination = (session.rol === 'buyer' || session.rol === 'customer')
            ? '/buyer/dashboard'
            : '/partner/dashboard';
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(destination);
        } else {
            window.location.href = destination;
        }
        return;
    }
    
    // Inicializar funciones
    initFormValidation();
    initSubmitHandler();
    initPasswordToggle();
    initForgotPassword();
    
    console.log('✅ Login Controller listo');
}

/**
 * 1. VALIDACIÓN DEL FORMULARIO
 */
function initFormValidation() {
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    
    if (email) {
        const blurHandler = () => validateField(email);
        email.addEventListener('blur', blurHandler);
        eventListeners.push({ element: email, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (email.classList.contains('error')) {
                validateField(email);
            }
        };
        email.addEventListener('input', inputHandler);
        eventListeners.push({ element: email, event: 'input', handler: inputHandler });
    }
    
    if (password) {
        const blurHandler = () => validateField(password);
        password.addEventListener('blur', blurHandler);
        eventListeners.push({ element: password, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (password.classList.contains('error')) {
                validateField(password);
            }
        };
        password.addEventListener('input', inputHandler);
        eventListeners.push({ element: password, event: 'input', handler: inputHandler });
    }
}

/**
 * 2. ENVÍO DEL FORMULARIO
 */
function initSubmitHandler() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    form.addEventListener('submit', handler);
    eventListeners.push({ element: form, event: 'submit', handler });

    const btnGoogle = document.getElementById('btnGoogleLogin');
    if (btnGoogle) {
        const googleHandler = async () => {
            await handleGoogleLogin();
        };
        btnGoogle.addEventListener('click', googleHandler);
        eventListeners.push({ element: btnGoogle, event: 'click', handler: googleHandler });
    }

}

/**
 * 3. MOSTRAR/OCULTAR CONTRASEÑA
 */
function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (!toggleBtn || !passwordInput) return;

    const handler = () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        toggleBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    };
    
    toggleBtn.addEventListener('click', handler);
    eventListeners.push({ element: toggleBtn, event: 'click', handler });
}

/**
 * 4. RECUPERAR CONTRASEÑA
 */
function initForgotPassword() {
    const link = document.getElementById('forgotPassword');
    if (!link) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleForgotPassword();
    };
    
    link.addEventListener('click', handler);
    eventListeners.push({ element: link, event: 'click', handler });
}

/**
 * Valida un campo individual
 */
function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    
    if (isRequired && !value) {
        showFieldError(input, 'Este campo es requerido');
        return false;
    }

    // Validación específica de email
    if (input.id === 'email' && value.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showFieldError(input, 'Correo electrónico inválido');
            return false;
        }
    }

    // Validación específica de contraseña
    if (input.id === 'password' && value.length > 0 && value.length < 6) {
        showFieldError(input, 'La contraseña debe tener al menos 6 caracteres');
        return false;
    }

    clearFieldError(input);
    return true;
}

/**
 * Muestra error en un campo
 */
function showFieldError(input, message) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.add('error');
    const errorMsg = group.querySelector('.rsi-form-error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
    }
}

/**
 * Limpia el error de un campo
 */
function clearFieldError(input) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.remove('error');
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('loginSubmit');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const rememberMe = document.getElementById('rememberMe');
    
    try {
        // Validar campos
        const isEmailValid = validateField(email);
        const isPasswordValid = validateField(password);
        
        if (!isEmailValid || !isPasswordValid) {
            return;
        }

        // Deshabilitar botón
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';

        // Preparar datos
        const data = {
            email: email.value.trim(),
            password: password.value,
            rememberMe: rememberMe ? rememberMe.checked : false
        };

        // Autenticar
        const result = await service.login(data);

        // Asegurar persistencia de la sesión en localStorage
        localStorage.setItem('rsi_session', JSON.stringify(result.user));

        // Inicializar notificaciones para el colaborador autenticado
        if (result.user.rol === 'partner' || result.user.rol === 'admin') {
            try {
                const notifService = new NotificationService();
                notifService.initForUser(result.user.uid);
            } catch (err) {
                console.warn('⚠️ No se pudo inicializar servicio de notificaciones en login:', err.message);
            }
        }

        // Recargar layouts inmediatamente para que el navbar y footer cambien a partner
        try {
            await reloadLayouts();
        } catch (layoutErr) {
            console.error('❌ Error recargando layout tras login:', layoutErr);
        }

        // Determinar destino validando asistencia diaria en Firestore (para rol partner) y returnUrl de manera segura
        const urlParams = new URLSearchParams(window.location.search);
        const rawReturn = urlParams.get('returnUrl');
        let destination = '/';
        let requiereAsistencia = false;

        if (result.user.rol === 'partner') {
            const landing = await service.resolvePartnerLandingRoute();
            destination = landing.route;
            requiereAsistencia = !landing.haRegistradoEntrada;
            if (!requiereAsistencia && rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login' && rawReturn !== '/') {
                destination = rawReturn;
            }
        } else if (result.user.rol === 'admin') {
            destination = '/partner/dashboard';
            if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login') {
                destination = rawReturn;
            }
        } else if (result.user.rol === 'buyer' || result.user.rol === 'customer') {
            destination = '/buyer/dashboard';
            if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login') {
                destination = rawReturn;
            }
        }

        // Mostrar éxito y navegar sin recargar la página completa
        Swal.fire({
            icon: 'success',
            title: '¡Bienvenido!',
            text: requiereAsistencia
                ? `Hola ${result.user.displayName || result.user.email}. Por favor registra tu entrada del día.`
                : `Hola ${result.user.displayName || result.user.email}`,
            timer: 1400,
            timerProgressBar: true,
            showConfirmButton: false
        }).then(async () => {
            if (typeof window.navigateTo === 'function') {
                await window.navigateTo(destination);
            } else {
                window.location.href = destination;
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        
        let errorMessage = 'Ocurrió un error al iniciar sesión';
        
        // Intentar extraer errores de validación
        if (error.message.includes('{"')) {
            try {
                const errors = JSON.parse(error.message);
                errorMessage = Object.values(errors).join('\n');
            } catch {
                errorMessage = error.message;
            }
        } else {
            errorMessage = error.message;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
            confirmButtonText: 'Intentar de nuevo',
            confirmButtonColor: '#d33'
        });

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
    }
}

/**
 * Maneja la recuperación de contraseña
 */
async function handleForgotPassword() {
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
        Swal.fire({
            icon: 'warning',
            title: 'Correo requerido',
            text: 'Ingresa tu correo electrónico para recuperar tu contraseña',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ffc107'
        });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        Swal.fire({
            icon: 'warning',
            title: 'Correo inválido',
            text: 'Ingresa un correo electrónico válido',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ffc107'
        });
        return;
    }

    try {
        // Aquí iría la llamada al servicio de recuperación
        await service.sendPasswordResetEmail(email);
        
        Swal.fire({
            icon: 'success',
            title: 'Correo enviado',
            text: 'Hemos enviado un enlace para restablecer tu contraseña a tu correo electrónico.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo enviar el correo de recuperación',
            confirmButtonText: 'Intentar de nuevo',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia los event listeners
 */
export function destroyLoginController() {
    console.log('🧹 Destroying LoginController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
}

// ✅ Exportar por defecto
export default loginController;

/**
 * Maneja el inicio de sesión con Google
 */
async function handleGoogleLogin() {
    try {
        Swal.fire({
            title: 'Conectando con Google...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const result = await service.loginWithGoogle();
        
        try {
            await reloadLayouts();
        } catch (e) {}

        const urlParams = new URLSearchParams(window.location.search);
        const rawReturn = urlParams.get('returnUrl');
        let destination = result.user.rol === 'buyer' ? '/buyer/dashboard' : '/partner/dashboard';
        if (rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.includes(':') && rawReturn !== '/login') {
            destination = rawReturn;
        }

        Swal.fire({
            icon: 'success',
            title: '¡Bienvenido!',
            text: `Hola ${result.user.displayName || result.user.email}`,
            timer: 1400,
            showConfirmButton: false
        }).then(async () => {
            if (typeof window.navigateTo === 'function') {
                await window.navigateTo(destination);
            } else {
                window.location.href = destination;
            }
        });
    } catch (error) {
        console.error('❌ Error en login con Google:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de autenticación',
            text: error.message || 'No se pudo iniciar sesión con Google.'
        });
    }
}
