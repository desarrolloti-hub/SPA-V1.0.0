/* ========================================
   LOGIN CONTROLLER
   ======================================== */

import AuthService from '../../services/authService.js';

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
        // Redirigir al dashboard o home
        window.location.href = '/partner/users';
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

        // Guardar sesión en localStorage
        if (data.rememberMe) {
            localStorage.setItem('rsi_session', JSON.stringify(result.user));
        }

        // Mostrar éxito
        Swal.fire({
            icon: 'success',
            title: '¡Bienvenido!',
            text: `Hola ${result.user.displayName || result.user.email}`,
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
        }).then(() => {
            // Redirigir según rol
            if (result.user.rol === 'admin') {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/';
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