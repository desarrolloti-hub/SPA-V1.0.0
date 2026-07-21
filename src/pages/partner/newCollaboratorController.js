/* ========================================
   NEW COLLABORATOR CONTROLLER
   ======================================== */

import NewCollaboratorService from '../../services/partnerService.js';

// Variables de estado
let currentStep = 1;
const totalSteps = 3;
let service = null;
let eventListeners = [];

/**
 * Obtiene el formulario del DOM
 */
function getForm() {
    const form = document.getElementById('collaboratorForm');
    if (form && form instanceof HTMLFormElement) {
        console.log('✅ Form encontrado:', form.id);
        return form;
    }
    console.error('❌ No se encontró el formulario con ID "collaboratorForm"');
    return null;
}

/**
 * Convierte un archivo a Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Controlador principal
 */
export async function newCollaboratorController() {
    console.log('👤 New Collaborator Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    const form = getForm();
    if (!form) {
        console.error('❌ No se encontró el formulario, el controller no puede continuar');
        return;
    }
    
    service = new NewCollaboratorService();
    currentStep = 1;
    
    initStepNavigation();
    initFieldValidation();
    initFileUpload();
    initSubmitHandler();
    initStepIndicators();
    
    goToStep(1);
    
    console.log('✅ New Collaborator Controller listo');
}

/**
 * 1. NAVEGACIÓN POR PASOS
 */
function initStepNavigation() {
    document.querySelectorAll('.rsi-btn-next').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const nextStep = parseInt(btn.dataset.next);
            if (!isNaN(nextStep)) {
                goToStep(nextStep);
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });

    document.querySelectorAll('.rsi-btn-prev').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const prevStep = parseInt(btn.dataset.prev);
            if (!isNaN(prevStep)) {
                goToStep(prevStep);
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

/**
 * 2. VALIDACIÓN DE CAMPOS
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input, .rsi-form-group select').forEach(input => {
        const blurHandler = () => validateField(input);
        input.addEventListener('blur', blurHandler);
        eventListeners.push({ element: input, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

/**
 * 3. SUBIDA DE FOTO
 */
function initFileUpload() {
    const fotoInput = document.getElementById('fotoPerfil');
    if (!fotoInput) return;

    const handler = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const preview = document.getElementById('fotoPreview');

        reader.onload = (event) => {
            preview.innerHTML = `
                <img src="${event.target.result}" alt="Foto de perfil">
            `;
        };

        reader.readAsDataURL(file);
    };
    
    fotoInput.addEventListener('change', handler);
    eventListeners.push({ element: fotoInput, event: 'change', handler });
}

/**
 * 4. ENVÍO DEL FORMULARIO
 */
function initSubmitHandler() {
    const submitBtn = document.getElementById('submitCollaborator');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

/**
 * 5. INDICADORES DE PASOS
 */
function initStepIndicators() {
    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const handler = () => {
            const step = parseInt(dot.dataset.step);
            if (!isNaN(step) && step < currentStep) {
                goToStep(step);
            }
        };
        dot.addEventListener('click', handler);
        eventListeners.push({ element: dot, event: 'click', handler });
    });
}

/**
 * Navega a un paso
 */
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    if (step > currentStep) {
        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }
    }

    currentStep = step;
    updateUI(step);
}

/**
 * Actualiza la UI
 */
function updateUI(step) {
    document.querySelectorAll('.rsi-step-panel').forEach(panel => {
        const panelStep = parseInt(panel.dataset.step);
        panel.classList.toggle('active', panelStep === step);
    });

    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        
        if (dotStep === step) {
            dot.classList.add('active');
        } else if (dotStep < step) {
            dot.classList.add('completed');
        }
    });

    document.querySelectorAll('.rsi-step-label').forEach(label => {
        const labelStep = parseInt(label.dataset.step);
        label.classList.remove('active', 'completed');
        
        if (labelStep === step) {
            label.classList.add('active');
        } else if (labelStep < step) {
            label.classList.add('completed');
        }
    });

    document.querySelectorAll('.rsi-step-line').forEach(line => {
        const lineStep = parseInt(line.dataset.step);
        line.classList.remove('active', 'completed');
        
        if (lineStep < step) {
            line.classList.add('completed');
        } else if (lineStep === step && step < totalSteps) {
            line.classList.add('active');
        }
    });

    document.querySelectorAll('.rsi-step-counter span').forEach(span => {
        span.textContent = step;
    });

    const form = getForm();
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Valida el paso actual
 */
function validateCurrentStep() {
    const currentPanel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!currentPanel) return true;

    const inputs = currentPanel.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    if (currentStep === 3) {
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (password && confirmPassword) {
            const isMatch = password.value === confirmPassword.value && password.value.length >= 6;
            if (!isMatch) {
                if (password.value !== confirmPassword.value) {
                    showFieldError(confirmPassword, 'Las contraseñas no coinciden');
                } else if (password.value.length < 6) {
                    showFieldError(password, 'Mínimo 6 caracteres');
                }
                isValid = false;
            } else {
                clearFieldError(password);
                clearFieldError(confirmPassword);
            }
        }
    }

    return isValid;
}

/**
 * Valida un campo
 */
function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    
    if (isRequired && !value) {
        showFieldError(input, 'Este campo es requerido');
        return false;
    }

    const validations = {
        curp: { test: (v) => v.length === 0 || v.length === 18, msg: 'CURP debe tener 18 caracteres' },
        rfc: { test: (v) => v.length === 0 || v.length >= 12, msg: 'RFC inválido' },
        telefonoMovil: { test: (v) => v.length === 0 || v.length >= 10, msg: 'Teléfono inválido (mínimo 10 dígitos)' },
        emailEmpresarial: { test: (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Correo electrónico inválido' },
        emailPersonal: { test: (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Correo electrónico inválido' }
    };

    if (validations[input.id]) {
        const validation = validations[input.id];
        if (value.length > 0 && !validation.test(value)) {
            showFieldError(input, validation.msg);
            return false;
        }
    }

    clearFieldError(input);
    return true;
}

/**
 * Muestra error
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
 * Limpia error
 */
function clearFieldError(input) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.remove('error');
}

/**
 * Prepara los datos del formulario
 */
async function prepareData(formData) {
    // Obtener el archivo de foto
    const fotoFile = formData.get('fotoPerfil');
    let fotoBase64 = '';
    
    // Si hay una foto, convertirla a Base64
    if (fotoFile && fotoFile instanceof File && fotoFile.size > 0) {
        try {
            fotoBase64 = await fileToBase64(fotoFile);
            console.log('✅ Foto convertida a Base64');
        } catch (error) {
            console.warn('⚠️ Error convirtiendo foto:', error);
        }
    }
    
    return {
        nombreCompleto: formData.get('nombreCompleto') || '',
        fechaNacimiento: formData.get('fechaNacimiento') || '',
        curp: formData.get('curp') || '',
        rfc: formData.get('rfc') || '',
        estadoCivil: formData.get('estadoCivil') || '',
        nss: formData.get('nss') || '',
        telefonoFijo: formData.get('telefonoFijo') || '',
        telefonoMovil: formData.get('telefonoMovil') || '',
        area: formData.get('area') || '',
        subarea: formData.get('subarea') || '',
        tipoColaborador: formData.get('tipoColaborador') || '',
        nit: formData.get('nit') || '',
        emailEmpresarial: formData.get('emailEmpresarial') || '',
        emailPersonal: formData.get('emailPersonal') || '',
        password: formData.get('password') || '',
        confirmPassword: formData.get('confirmPassword') || '',
        fotoPerfil: fotoBase64 || ''
    };
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitCollaborator');
    
    try {
        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

        const form = getForm();
        if (!form || !(form instanceof HTMLFormElement)) {
            throw new Error('No se encontró el formulario');
        }

        const formData = new FormData(form);
        const data = await prepareData(formData);

        const result = await service.registerCollaborator(data);

        Swal.fire({
            icon: 'success',
            title: '¡Registro exitoso!',
            text: `El colaborador ${data.nombreCompleto} ha sido registrado correctamente.`,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        }).then(() => {
            form.reset();
            goToStep(1);
            const preview = document.getElementById('fotoPreview');
            if (preview) {
                preview.innerHTML = `
                    <i class="fas fa-camera"></i>
                    <span>Subir foto</span>
                `;
            }
        });

    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al registrar el colaborador';
        
        if (errorMessage.includes('{"')) {
            try {
                const errors = JSON.parse(errorMessage);
                errorMessage = Object.values(errors).join('\n');
            } catch {
                // mantener mensaje original
            }
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
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrar Colaborador';
    }
}

/**
 * Limpia eventos
 */
export function destroyNewCollaboratorController() {
    console.log('🧹 Destroying NewCollaboratorController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
}

// ✅ Exportar por defecto
export default newCollaboratorController;