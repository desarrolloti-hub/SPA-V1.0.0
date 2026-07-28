/* ========================================
   NEW COLLABORATOR CONTROLLER
   Controlador para crear y editar colaboradores
   ======================================== */

import NewCollaboratorService from '../../services/partnerService.js';

// Variables de estado
let currentStep = 1;
const totalSteps = 3;
let service = null;
let eventListeners = [];
let areasDataMap = {};
let editingDocId = null;
let isEditMode = false;
let originalData = {};

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
    
    // 🔥 Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');
    
    if (docId) {
        editingDocId = docId;
        isEditMode = true;
        console.log('✏️ Modo edición - Colaborador ID:', editingDocId);
    }
    
    // Cargar áreas antes de cargar los datos del colaborador
    await loadAreas();
    
    // Si es modo edición, cargar los datos del colaborador
    if (isEditMode && editingDocId) {
        await loadCollaboratorData(editingDocId);
    }
    
    initStepNavigation();
    initFieldValidation();
    initFileUpload();
    initSubmitHandler();
    initStepIndicators();
    
    updateTitles();
    goToStep(1);
    
    console.log(`✅ New Collaborator Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Actualiza los títulos según el modo
 */
function updateTitles() {
    const pageTitle = document.querySelector('.rsi-page-title');
    const pageSubtitle = document.querySelector('.rsi-page-subtitle');
    const stepTitle = document.querySelector('.rsi-step-header h3');
    const submitBtn = document.getElementById('submitCollaborator');
    
    if (isEditMode) {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Colaborador`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Modifica los datos del colaborador.';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Colaborador';
        }
    } else {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Registro</span> de Nuevo Colaborador`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Completa todos los datos para registrar un nuevo colaborador en el sistema.';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrar Colaborador';
        }
    }
}

/**
 * Carga los datos del colaborador para edición
 */
async function loadCollaboratorData(docId) {
    try {
        const collaborator = await service.getCollaboratorById(docId);
        if (!collaborator) {
            throw new Error('Colaborador no encontrado');
        }

        originalData = collaborator;
        console.log('📋 Datos del colaborador cargados:', collaborator);

        const form = getForm();
        if (!form) return;

        // Paso 1: Información personal
        document.getElementById('nombreCompleto').value = collaborator.nombreCompleto || '';
        document.getElementById('fechaNacimiento').value = collaborator.fechaNacimiento || '';
        document.getElementById('curp').value = collaborator.curp || '';
        document.getElementById('rfc').value = collaborator.rfc || '';
        document.getElementById('estadoCivil').value = collaborator.estadoCivil || '';
        document.getElementById('nss').value = collaborator.nss || '';
        document.getElementById('telefonoFijo').value = collaborator.telefonoFijo || '';
        document.getElementById('telefonoMovil').value = collaborator.telefonoMovil || '';
        
        // Foto de perfil (si existe)
        if (collaborator.fotoPerfil && collaborator.fotoPerfil.startsWith('data:image')) {
            const preview = document.getElementById('fotoPreview');
            if (preview) {
                preview.innerHTML = `
                    <img src="${collaborator.fotoPerfil}" alt="Foto de perfil">
                `;
            }
        }

        // Paso 2: Información laboral
        const areaNombre = collaborator.areaNombre || collaborator.area || '';
        const subareaNombre = collaborator.subareaNombre || collaborator.subarea || '';
        
        const areaSelect = document.getElementById('area');
        const subareaSelect = document.getElementById('subarea');
        
        if (areaSelect && areaNombre) {
            setTimeout(() => {
                for (const option of areaSelect.options) {
                    if (option.value === areaNombre) {
                        option.selected = true;
                        break;
                    }
                }
                areaSelect.dispatchEvent(new Event('change'));
                
                setTimeout(() => {
                    if (subareaSelect && subareaNombre) {
                        for (const option of subareaSelect.options) {
                            if (option.value === subareaNombre) {
                                option.selected = true;
                                break;
                            }
                        }
                    }
                }, 200);
            }, 300);
        }
        
        document.getElementById('tipoColaborador').value = collaborator.tipoColaborador || '';
        document.getElementById('nit').value = collaborator.nit || '';

        // Paso 3: Información de contacto
        document.getElementById('emailEmpresarial').value = collaborator.emailEmpresarial || '';
        document.getElementById('emailPersonal').value = collaborator.emailPersonal || '';
        
        // 🔥 En modo edición, bloquear correo y contraseña
        const emailInput = document.getElementById('emailEmpresarial');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (emailInput) {
            emailInput.disabled = true;
            emailInput.title = 'El correo empresarial no se puede modificar';
            emailInput.style.backgroundColor = 'var(--rsi-gray-100)';
            emailInput.style.cursor = 'not-allowed';
        }
        
        if (passwordInput) {
            passwordInput.disabled = true;
            passwordInput.placeholder = 'Contraseña bloqueada en modo edición';
            passwordInput.title = 'La contraseña no se puede modificar en edición';
            passwordInput.style.backgroundColor = 'var(--rsi-gray-100)';
            passwordInput.style.cursor = 'not-allowed';
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.disabled = true;
            confirmPasswordInput.placeholder = 'Contraseña bloqueada en modo edición';
            confirmPasswordInput.title = 'La contraseña no se puede modificar en edición';
            confirmPasswordInput.style.backgroundColor = 'var(--rsi-gray-100)';
            confirmPasswordInput.style.cursor = 'not-allowed';
        }

        console.log('✅ Formulario llenado con datos del colaborador');

    } catch (error) {
        console.error('❌ Error cargando colaborador:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el colaborador para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudPartners');
            } else {
                window.location.href = '/partner/crudPartners';
            }
        });
    }
}

/**
 * Carga las áreas y subáreas desde Firestore
 */
async function loadAreas() {
    try {
        const areaSelect = document.getElementById('area');
        const subareaSelect = document.getElementById('subarea');
        
        if (!areaSelect) {
            console.warn('⚠️ Select de área no encontrado');
            return;
        }

        areaSelect.innerHTML = '<option value="">Cargando áreas...</option>';
        if (subareaSelect) {
            subareaSelect.innerHTML = '<option value="">Selecciona un área primero</option>';
        }

        const areas = await service.getAreasForSelect();
        
        areasDataMap = {};
        areas.forEach(area => {
            areasDataMap[area.nombre] = {
                id: area.id,
                nombre: area.nombre,
                subareas: area.subareas
            };
        });
        
        areaSelect.innerHTML = '<option value="">Seleccionar...</option>';
        
        if (areas.length === 0) {
            areaSelect.innerHTML = '<option value="">No hay áreas disponibles</option>';
            return;
        }

        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.nombre;
            option.dataset.id = area.id;
            option.textContent = area.nombre;
            areaSelect.appendChild(option);
        });

        console.log('✅ Áreas cargadas:', areas.length);

    } catch (error) {
        console.error('❌ Error cargando áreas:', error);
        const areaSelect = document.getElementById('area');
        if (areaSelect) {
            areaSelect.innerHTML = '<option value="">Error al cargar áreas</option>';
        }
    }
}

/**
 * Actualiza las subáreas según el área seleccionada
 */
function updateSubareas(areaNombre) {
    const subareaSelect = document.getElementById('subarea');
    if (!subareaSelect) return;

    subareaSelect.innerHTML = '<option value="">Seleccionar...</option>';

    if (!areaNombre || !areasDataMap[areaNombre]) {
        subareaSelect.innerHTML = '<option value="">Selecciona un área primero</option>';
        return;
    }

    const areaData = areasDataMap[areaNombre];
    const subareas = areaData.subareas || [];
    
    if (subareas.length === 0) {
        subareaSelect.innerHTML = '<option value="">No hay subáreas disponibles</option>';
        return;
    }

    subareas.forEach(subarea => {
        const option = document.createElement('option');
        option.value = subarea.nombre;
        option.dataset.id = subarea.id;
        option.textContent = subarea.nombre;
        subareaSelect.appendChild(option);
    });

    console.log(`✅ Subáreas cargadas para "${areaNombre}":`, subareas.length);
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
        // 🔥 No validar campos deshabilitados
        if (input.disabled) return;
        
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

    const areaSelect = document.getElementById('area');
    if (areaSelect) {
        areaSelect.addEventListener('change', () => {
            updateSubareas(areaSelect.value);
        });
        eventListeners.push({ element: areaSelect, event: 'change', handler: () => updateSubareas(areaSelect.value) });
    }
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
        // 🔥 No validar campos deshabilitados
        if (input.disabled) return;
        if (!validateField(input)) {
            isValid = false;
        }
    });

    // 🔥 En modo edición, no validar contraseña (está deshabilitada)
    if (!isEditMode && currentStep === 3) {
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
    
    // 🔥 No validar campos deshabilitados
    if (input.disabled) return true;
    
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
    const fotoFile = formData.get('fotoPerfil');
    let fotoBase64 = '';
    
    if (fotoFile && fotoFile instanceof File && fotoFile.size > 0) {
        try {
            fotoBase64 = await fileToBase64(fotoFile);
            console.log('✅ Foto convertida a Base64');
        } catch (error) {
            console.warn('⚠️ Error convirtiendo foto:', error);
        }
    }
    
    const areaNombre = formData.get('area') || '';
    const subareaNombre = formData.get('subarea') || '';
    
    let areaId = '';
    let subareaId = '';
    
    if (areaNombre && areasDataMap[areaNombre]) {
        areaId = areasDataMap[areaNombre].id;
        
        if (subareaNombre) {
            const subarea = areasDataMap[areaNombre].subareas.find(s => s.nombre === subareaNombre);
            if (subarea) {
                subareaId = subarea.id;
            }
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
        areaId: areaId,
        areaNombre: areaNombre,
        subareaId: subareaId,
        subareaNombre: subareaNombre,
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
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const form = getForm();
        if (!form || !(form instanceof HTMLFormElement)) {
            throw new Error('No se encontró el formulario');
        }

        const formData = new FormData(form);
        const data = await prepareData(formData);

        const areaData = {
            id: data.areaId,
            nombre: data.areaNombre
        };
        
        const subareaData = {
            id: data.subareaId,
            nombre: data.subareaNombre
        };

        let result;

        if (isEditMode && editingDocId) {
            // 🔥 MODO EDICIÓN - No incluir correo ni contraseña
            const updateData = {
                nombreCompleto: data.nombreCompleto,
                fechaNacimiento: data.fechaNacimiento,
                curp: data.curp,
                rfc: data.rfc,
                estadoCivil: data.estadoCivil,
                nss: data.nss,
                telefonoFijo: data.telefonoFijo,
                telefonoMovil: data.telefonoMovil,
                areaId: data.areaId,
                areaNombre: data.areaNombre,
                subareaId: data.subareaId,
                subareaNombre: data.subareaNombre,
                tipoColaborador: data.tipoColaborador,
                nit: data.nit,
                emailPersonal: data.emailPersonal,
                fotoPerfil: data.fotoPerfil || originalData.fotoPerfil || ''
            };

            // Actualizar colaborador (sin correo ni contraseña)
            await service.updateCollaborator(editingDocId, updateData);
            
            result = {
                success: true,
                message: 'Colaborador actualizado exitosamente'
            };
        } else {
            // 🔥 MODO CREACIÓN
            result = await service.registerCollaborator(data, areaData, subareaData);
        }

        if (!result.success) {
            throw new Error(result.message);
        }

        const successMessage = isEditMode 
            ? '¡Colaborador actualizado exitosamente!'
            : '¡Registro exitoso!';

        const htmlContent = isEditMode ? `
            <div style="text-align: left;">
                <p><strong>Colaborador:</strong> ${data.nombreCompleto}</p>
                <p><strong>Correo:</strong> ${data.emailEmpresarial}</p>
                <p><strong>Área:</strong> ${data.areaNombre}</p>
                <p><strong>Subárea:</strong> ${data.subareaNombre}</p>
            </div>
        ` : `
            <div style="text-align: left;">
                <p><strong>Colaborador:</strong> ${data.nombreCompleto}</p>
                <p><strong>Correo:</strong> ${data.emailEmpresarial}</p>
                <p><strong>Área:</strong> ${data.areaNombre}</p>
                <p><strong>Subárea:</strong> ${data.subareaNombre}</p>
                <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                <div style="background: var(--rsi-info-light); padding: var(--rsi-spacing-md); border-radius: var(--rsi-radius-md);">
                    <p style="margin: 0; color: var(--rsi-info);">
                        <i class="fas fa-envelope"></i> 
                        Se ha enviado un correo de verificación a <strong>${data.emailEmpresarial}</strong>
                    </p>
                    <p style="margin: var(--rsi-spacing-sm) 0 0 0; font-size: 0.9rem; color: var(--rsi-gray-600);">
                        El colaborador debe verificar su correo antes de poder iniciar sesión.
                    </p>
                </div>
            </div>
        `;

        Swal.fire({
            icon: 'success',
            title: successMessage,
            html: htmlContent,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudPartners');
            } else {
                window.location.href = '/partner/crudPartners';
            }
        });

    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el colaborador';
        
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
        submitBtn.innerHTML = isEditMode 
            ? '<i class="fas fa-save"></i> Actualizar Colaborador'
            : '<i class="fas fa-user-plus"></i> Registrar Colaborador';
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
    areasDataMap = {};
    editingDocId = null;
    isEditMode = false;
    originalData = {};
}

// ✅ Exportar por defecto
export default newCollaboratorController;