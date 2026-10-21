/* ========================================
   AREA CONTROLLER
   Controlador para gestión de áreas con múltiples subáreas y módulos
   ======================================== */

import AreaService from '../../services/areaService.js';

let service = null;
let currentStep = 1;
const totalSteps = 3;
let eventListeners = [];
let subareasCollection = [];
let currentUserUid = '';
let editingSubareaIndex = null;
let currentModulos = [];
let isNavigating = false;
let editingAreaId = null;
let isEditMode = false;

/**
 * Inicializa el controlador de áreas
 */
export async function areaController() {
    console.log('🏢 Area Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new AreaService();
    currentStep = 1;
    subareasCollection = [];
    currentModulos = [];
    editingSubareaIndex = null;
    isNavigating = false;
    editingAreaId = null;
    isEditMode = false;
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const areaId = urlParams.get('id');
    
    if (areaId) {
        editingAreaId = areaId;
        isEditMode = true;
        console.log('✏️ Modo edición - Área ID:', editingAreaId);
    }
    
    loadUserData();
    initStepNavigation();
    initFieldValidation();
    initModuloHandlers();
    initSubareaHandlers();
    initFormToggle();
    initSubmitHandler();
    
    // Si es modo edición, cargar los datos
    if (isEditMode && editingAreaId) {
        await loadAreaData(editingAreaId);
    }
    
    goToStep(1);
    updateSubareasSummary();
    updateModulosList();
    updateTitle();
    
    console.log(`✅ Area Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Actualiza el título según el modo
 */
function updateTitle() {
    const titleEl = document.querySelector('.rsi-step-header h3');
    const subtitleEl = document.querySelector('.rsi-step-header p');
    const pageTitle = document.querySelector('.rsi-page-title');
    const pageSubtitle = document.querySelector('.rsi-page-subtitle');
    const submitBtn = document.getElementById('submitArea');
    
    if (isEditMode) {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Área`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Modifica el área, sus subáreas y módulos.';
        }
        if (titleEl) {
            titleEl.textContent = 'Editar Área';
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Modifica los datos del área';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Área';
        }
    } else {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Gestión</span> de Áreas`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Crea un área con múltiples subáreas y módulos con permisos.';
        }
        if (titleEl) {
            titleEl.textContent = 'Información del Área';
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Datos principales del área';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Área';
        }
    }
}

/**
 * Carga los datos del área para edición
 */
async function loadAreaData(areaId) {
    try {
        const area = await service.getAreaById(areaId);
        if (!area) {
            throw new Error('Área no encontrada');
        }

        // Cargar nombre del área
        document.getElementById('nombreArea').value = area.nombreArea || '';

        // Cargar subáreas
        const subareas = area.subareas || {};
        const subareaKeys = Object.keys(subareas);
        
        for (const key of subareaKeys) {
            const subarea = subareas[key];
            const modulos = subarea.modulos || {};
            const modulosKeys = Object.keys(modulos);
            
            // Convertir módulos a array para el frontend
            const modulosArray = modulosKeys.map(mk => ({
                nombreModulo: mk,
                permisos: modulos[mk].permisos?.permiso || []
            }));
            
            subareasCollection.push({
                idsubarea: subarea.idsubarea || key,
                nombreSubarea: subarea.nombreSubarea,
                modulos: modulosArray,
                modificadoPor: subarea.modificadoPor,
                fechaModificacion: subarea.fechaModificacion
            });
        }

        updateSubareasSummary();
        updateConfirmacion();
        console.log('✅ Datos del área cargados:', area.nombreArea);

    } catch (error) {
        console.error('❌ Error cargando área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el área para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            // Redirigir al CRUD si falla
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudAreas');
            } else {
                window.location.href = '/partner/crudAreas';
            }
        });
    }
}

/**
 * Carga los datos del usuario desde localStorage
 */
function loadUserData() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (session) {
            const sessionData = JSON.parse(session);
            currentUserUid = sessionData.uid || '';
            console.log('✅ Usuario cargado:', currentUserUid);
        }
    } catch (error) {
        console.error('❌ Error cargando datos del usuario:', error);
    }
}

/**
 * 0. TOGGLE DEL FORMULARIO DE SUBÁREA
 */
function initFormToggle() {
    const showBtn = document.getElementById('showSubareaFormBtn');
    const formContainer = document.getElementById('subareaFormContainer');
    const cancelBtn = document.getElementById('cancelSubareaBtn');

    if (showBtn) {
        showBtn.addEventListener('click', () => {
            showForm();
        });
        eventListeners.push({ element: showBtn, event: 'click', handler: showForm });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideForm);
        eventListeners.push({ element: cancelBtn, event: 'click', handler: hideForm });
    }
}

function showForm() {
    const formContainer = document.getElementById('subareaFormContainer');
    const showBtn = document.getElementById('showSubareaFormBtn');
    const nombreSubarea = document.getElementById('nombreSubarea');
    
    if (formContainer) {
        formContainer.style.display = 'block';
        setTimeout(() => {
            if (nombreSubarea) {
                nombreSubarea.focus();
                nombreSubarea.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 300);
    }
    
    if (showBtn) {
        showBtn.classList.add('hidden');
    }
}

function hideForm() {
    const formContainer = document.getElementById('subareaFormContainer');
    const showBtn = document.getElementById('showSubareaFormBtn');
    
    if (formContainer) {
        formContainer.style.display = 'none';
    }
    if (showBtn) {
        showBtn.classList.remove('hidden');
    }
    clearSubareaForm();
}

/**
 * 1. NAVEGACIÓN POR PASOS
 */
function initStepNavigation() {
    document.querySelectorAll('.rsi-btn-next').forEach(btn => {
        const handler = async (e) => {
            e.preventDefault();
            if (isNavigating) return;
            
            const nextStep = parseInt(btn.dataset.next);
            if (!isNaN(nextStep)) {
                await goToStepAsync(nextStep);
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
 * Navega a un paso (versión asíncrona para mostrar diálogos)
 */
async function goToStepAsync(step) {
    if (step < 1 || step > totalSteps) return;
    if (isNavigating) return;

    if (step > currentStep) {
        const canProceed = await validateCurrentStepAsync(step);
        if (!canProceed) {
            return;
        }
    }

    isNavigating = false;
    currentStep = step;
    updateUI(step);
    
    if (step === 3) {
        updateConfirmacion();
    }
}

/**
 * Navega a un paso (versión síncrona)
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
    
    if (step === 3) {
        updateConfirmacion();
    }
}

/**
 * Valida el paso actual (versión asíncrona)
 * @param {number} nextStep - El paso al que se quiere navegar
 * @returns {Promise<boolean>} - true si puede continuar, false si no
 */
async function validateCurrentStepAsync(nextStep) {
    const currentPanel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!currentPanel) return true;

    const inputs = currentPanel.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        const isVisible = input.closest('.rsi-subarea-form-container') 
            ? input.closest('.rsi-subarea-form-container').style.display !== 'none'
            : true;
        
        if (isVisible && !validateField(input)) {
            isValid = false;
        }
    });

    if (!isValid) return false;

    if (currentStep === 2) {
        if (subareasCollection.length === 0) {
            isNavigating = true;
            const result = await Swal.fire({
                icon: 'info',
                title: 'Agregar subárea',
                text: 'Aún no has agregado ninguna subárea. ¿Deseas agregar una ahora?',
                showCancelButton: true,
                confirmButtonText: 'Sí, agregar',
                cancelButtonText: 'No, continuar',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6c757d'
            });
            isNavigating = false;
            
            if (result.isConfirmed) {
                showForm();
                return false;
            } else {
                return true;
            }
        }
        return true;
    }

    return true;
}

/**
 * Valida el paso actual (versión síncrona)
 */
function validateCurrentStep() {
    const currentPanel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!currentPanel) return true;

    const inputs = currentPanel.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        const isVisible = input.closest('.rsi-subarea-form-container') 
            ? input.closest('.rsi-subarea-form-container').style.display !== 'none'
            : true;
        
        if (isVisible && !validateField(input)) {
            isValid = false;
        }
    });

    return isValid;
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

    const form = document.getElementById('areaForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 2. VALIDACIÓN DE CAMPOS
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input:not([disabled])').forEach(input => {
        const blurHandler = () => {
            const isVisible = input.closest('.rsi-subarea-form-container') 
                ? input.closest('.rsi-subarea-form-container').style.display !== 'none'
                : true;
            
            if (isVisible) {
                validateField(input);
            }
        };
        input.addEventListener('blur', blurHandler);
        eventListeners.push({ element: input, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            const isVisible = input.closest('.rsi-subarea-form-container') 
                ? input.closest('.rsi-subarea-form-container').style.display !== 'none'
                : true;
            
            if (isVisible && input.classList.contains('error')) {
                validateField(input);
            }
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

/**
 * 3. MANEJADORES DE MÓDULOS
 */
function initModuloHandlers() {
    const addModuloBtn = document.getElementById('addModuloBtn');
    if (addModuloBtn) {
        addModuloBtn.addEventListener('click', addModulo);
        eventListeners.push({ element: addModuloBtn, event: 'click', handler: addModulo });
    }

    document.getElementById('nombreModulo')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addModulo();
        }
    });
}

/**
 * Agrega un módulo a la subárea actual
 */
function addModulo() {
    const nombreModulo = document.getElementById('nombreModulo');
    const permisosCheckboxes = document.querySelectorAll('input[name="permisos"]:checked');

    let isValid = true;

    if (!nombreModulo.value.trim()) {
        showFieldError(nombreModulo, 'El nombre del módulo es requerido');
        isValid = false;
    } else {
        clearFieldError(nombreModulo);
    }

    if (permisosCheckboxes.length === 0) {
        const grid = document.querySelector('.rsi-permisos-grid');
        if (grid) {
            grid.style.border = '2px solid var(--rsi-danger)';
            grid.style.borderRadius = 'var(--rsi-radius-md)';
            grid.style.padding = 'var(--rsi-spacing-sm)';
        }
        isValid = false;
    } else {
        const grid = document.querySelector('.rsi-permisos-grid');
        if (grid) {
            grid.style.border = 'none';
            grid.style.padding = '0';
        }
    }

    if (!isValid) return;

    const permisosList = Array.from(permisosCheckboxes).map(cb => cb.value);
    
    const modulo = {
        nombreModulo: nombreModulo.value.trim(),
        permisos: permisosList
    };

    currentModulos.push(modulo);

    nombreModulo.value = '';
    permisosCheckboxes.forEach(cb => cb.checked = false);

    updateModulosList();

    const addBtn = document.getElementById('addModuloBtn');
    addBtn.innerHTML = '<i class="fas fa-check"></i> ¡Agregado!';
    setTimeout(() => {
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Módulo';
    }, 800);
}

/**
 * Elimina un módulo de la subárea actual
 */
function removeModulo(index) {
    currentModulos.splice(index, 1);
    updateModulosList();
}

/**
 * Actualiza la lista de módulos
 */
function updateModulosList() {
    const container = document.getElementById('modulosList');
    if (!container) return;

    if (currentModulos.length === 0) {
        container.innerHTML = `
            <div class="rsi-empty-modulos">
                <p><i class="fas fa-info-circle"></i> No hay módulos agregados para esta subárea</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentModulos.map((modulo, index) => `
        <div class="rsi-modulo-item">
            <div class="rsi-modulo-info">
                <span class="rsi-modulo-name">
                    <i class="fas fa-cube" style="color: var(--rsi-accent);"></i>
                    ${modulo.nombreModulo}
                </span>
                <div class="rsi-modulo-permisos">
                    ${modulo.permisos.map(p => `<span class="permiso-tag">${p}</span>`).join('')}
                </div>
            </div>
            <div class="rsi-modulo-actions">
                <button class="btn-remove-modulo" data-index="${index}" title="Eliminar módulo">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-remove-modulo').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            removeModulo(index);
        });
    });
}

/**
 * 4. MANEJADORES DE SUBÁREA
 */
function initSubareaHandlers() {
    const saveBtn = document.getElementById('saveSubareaBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveSubarea);
        eventListeners.push({ element: saveBtn, event: 'click', handler: saveSubarea });
    }
}

/**
 * Guarda una subárea
 */
function saveSubarea() {
    const nombreSubarea = document.getElementById('nombreSubarea');
    
    if (!nombreSubarea.value.trim()) {
        showFieldError(nombreSubarea, 'El nombre de la subárea es requerido');
        return;
    }
    clearFieldError(nombreSubarea);

    if (currentModulos.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin módulos',
            text: 'La subárea debe tener al menos un módulo con permisos.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const subarea = {
        idsubarea: generateId(),
        nombreSubarea: nombreSubarea.value.trim(),
        modulos: [...currentModulos],
        modificadoPor: currentUserUid,
        fechaModificacion: new Date().toISOString()
    };

    if (editingSubareaIndex !== null) {
        subareasCollection[editingSubareaIndex] = subarea;
    } else {
        subareasCollection.push(subarea);
    }

    clearSubareaForm();
    hideForm();
    updateSubareasSummary();
    updateConfirmacion();

    Swal.fire({
        icon: 'success',
        title: '¡Subárea guardada!',
        text: `"${subarea.nombreSubarea}" ha sido agregada con ${subarea.modulos.length} módulo(s).`,
        timer: 2000,
        showConfirmButton: false
    });
}

/**
 * Limpia el formulario de subárea
 */
function clearSubareaForm() {
    document.getElementById('nombreSubarea').value = '';
    document.getElementById('nombreModulo').value = '';
    document.querySelectorAll('input[name="permisos"]:checked').forEach(cb => cb.checked = false);
    currentModulos = [];
    updateModulosList();
    editingSubareaIndex = null;
    document.querySelector('.rsi-subarea-form-container').classList.remove('editing');
    document.getElementById('cancelEditSubarea').style.display = 'none';
    document.getElementById('subareaFormTitle').textContent = 'Nueva Subárea';
    
    document.querySelectorAll('.rsi-form-group.error').forEach(group => {
        group.classList.remove('error');
    });
}

/**
 * Actualiza el resumen de subáreas
 */
function updateSubareasSummary() {
    const container = document.getElementById('subareasSummary');
    if (!container) return;

    if (subareasCollection.length === 0) {
        container.innerHTML = `
            <div class="rsi-empty-summary">
                <i class="fas fa-plus-circle"></i>
                <p>No hay subáreas agregadas</p>
            </div>
        `;
        return;
    }

    container.innerHTML = subareasCollection.map((subarea, index) => `
        <div class="rsi-summary-item">
            <div>
                <span class="subarea-name">
                    <i class="fas fa-layer-group" style="color: var(--rsi-accent);"></i>
                    ${subarea.nombreSubarea}
                </span>
                <span class="subarea-modulos-count">
                    (${subarea.modulos.length} módulo${subarea.modulos.length !== 1 ? 's' : ''})
                </span>
            </div>
            <div class="subarea-actions">
                <button class="btn-edit-summary" data-index="${index}" title="Editar subárea">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete-summary" data-index="${index}" title="Eliminar subárea">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-edit-summary').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            editSubarea(index);
        });
    });

    container.querySelectorAll('.btn-delete-summary').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            deleteSubarea(index);
        });
    });
}

/**
 * Edita una subárea
 */
function editSubarea(index) {
    const subarea = subareasCollection[index];
    if (!subarea) return;

    document.getElementById('nombreSubarea').value = subarea.nombreSubarea;
    currentModulos = [...subarea.modulos];
    editingSubareaIndex = index;

    updateModulosList();
    document.querySelector('.rsi-subarea-form-container').classList.add('editing');
    document.getElementById('cancelEditSubarea').style.display = 'inline-block';
    document.getElementById('subareaFormTitle').textContent = `Editando: ${subarea.nombreSubarea}`;

    showForm();
}

/**
 * Elimina una subárea
 */
function deleteSubarea(index) {
    const subarea = subareasCollection[index];
    
    Swal.fire({
        title: '¿Eliminar subárea?',
        text: `¿Estás seguro de eliminar "${subarea.nombreSubarea}"? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            subareasCollection.splice(index, 1);
            updateSubareasSummary();
            updateConfirmacion();
            
            Swal.fire({
                icon: 'success',
                title: 'Eliminada',
                text: 'La subárea ha sido eliminada.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

/**
 * 5. ENVÍO DEL FORMULARIO
 */
function initSubmitHandler() {
    const submitBtn = document.getElementById('submitArea');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
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
 * Actualiza la confirmación
 */
function updateConfirmacion() {
    const nombreArea = document.getElementById('nombreArea')?.value || '-';
    document.getElementById('confirmNombreArea').textContent = nombreArea;

    const container = document.getElementById('confirmSubareasList');
    if (!container) return;

    if (subareasCollection.length === 0) {
        container.innerHTML = '<p style="color: var(--rsi-gray-500);">No hay subáreas configuradas</p>';
        return;
    }

    container.innerHTML = subareasCollection.map(subarea => `
        <div class="rsi-confirm-subarea-item">
            <span class="rsi-confirm-subarea-name">
                <i class="fas fa-layer-group" style="color: var(--rsi-accent);"></i>
                ${subarea.nombreSubarea}
            </span>
            ${subarea.modulos.map(modulo => `
                <div class="rsi-confirm-modulo-item">
                    <span class="rsi-confirm-modulo-name">
                        <i class="fas fa-cube" style="color: var(--rsi-accent);"></i>
                        ${modulo.nombreModulo}
                    </span>
                    <div class="rsi-confirm-modulo-permisos">
                        ${modulo.permisos.map(p => `<span class="permiso-tag">${p}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

/**
 * Genera un ID único
 */
function generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 12; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitArea');
    
    try {
        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const nombreArea = document.getElementById('nombreArea').value.trim();

        // Preparar datos completos
        const fullData = {
            nombreArea: nombreArea,
            subareas: subareasCollection.map(subarea => ({
                nombreSubarea: subarea.nombreSubarea,
                modulos: subarea.modulos.map(modulo => ({
                    nombreModulo: modulo.nombreModulo,
                    permisos: modulo.permisos
                }))
            }))
        };

        let result;

        if (isEditMode && editingAreaId) {
            // 🔥 MODO EDICIÓN: Actualizar área existente
            // Primero actualizar el nombre del área
            await service.updateArea(editingAreaId, { nombreArea });
            
            // Luego actualizar subáreas y módulos
            // Para simplificar, eliminamos las subáreas existentes y las reemplazamos
            const area = await service.getAreaById(editingAreaId);
            const existingSubareas = area.subareas || {};
            const existingKeys = Object.keys(existingSubareas);
            
            // Eliminar subáreas existentes (una por una)
            for (const key of existingKeys) {
                await service.deleteSubarea(editingAreaId, key);
            }
            
            // Agregar nuevas subáreas
            for (const subarea of subareasCollection) {
                const subareaResult = await service.addSubarea(editingAreaId, { 
                    nombreSubarea: subarea.nombreSubarea 
                });
                
                if (subareaResult.success) {
                    const subareaId = subareaResult.id;
                    for (const modulo of subarea.modulos) {
                        await service.addModuloToSubarea(editingAreaId, subareaId, {
                            nombreModulo: modulo.nombreModulo,
                            permisos: modulo.permisos
                        });
                    }
                }
            }
            
            result = {
                success: true,
                message: `Área "${nombreArea}" actualizada exitosamente`,
                data: { subareas: {} }
            };
        } else {
            // 🔥 MODO CREACIÓN: Crear área nueva
            result = await service.createFullArea(fullData);
        }

        if (!result.success) {
            throw new Error(result.message);
        }

        // Generar texto para mostrar
        const subareasData = result.data?.subareas || {};
        const subareaKeys = Object.keys(subareasData);
        
        let subareasText = '';
        if (subareaKeys.length > 0) {
            subareasText = subareaKeys.map(key => {
                const s = subareasData[key];
                const modulosObj = s.modulos || {};
                const modulosKeys = Object.keys(modulosObj);
                const modulosText = modulosKeys.map(mk => {
                    const m = modulosObj[mk];
                    return `&nbsp;&nbsp;• <strong>${m.nombreModulo}</strong> (${m.permisos.permiso.join(', ')})`;
                }).join('<br>');
                return `<strong>${s.nombreSubarea}</strong><br>${modulosText}`;
            }).join('<br><br>');
        } else {
            subareasText = subareasCollection.map(s => 
                `<strong>${s.nombreSubarea}</strong><br>${s.modulos.map(m => 
                    `&nbsp;&nbsp;• <strong>${m.nombreModulo}</strong> (${m.permisos.join(', ')})`
                ).join('<br>')}`
            ).join('<br><br>');
        }

        Swal.fire({
            icon: 'success',
            title: isEditMode ? '¡Área actualizada!' : '¡Registro exitoso!',
            html: `
                <div style="text-align: left;">
                    <p><strong>Área:</strong> ${nombreArea}</p>
                    <p><strong>Subáreas:</strong> ${subareasCollection.length}</p>
                    <div style="margin-top: var(--rsi-spacing-sm); padding-left: var(--rsi-spacing-md);">
                        ${subareasText}
                    </div>
                </div>
            `,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        }).then(() => {
            // Redirigir al CRUD
            document.getElementById('areaForm').reset();
            subareasCollection = [];
            currentModulos = [];
            editingSubareaIndex = null;
            
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudAreas');
            } else {
                window.location.href = '/partner/crudAreas';
            }
        });

    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el área';
        
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
        submitBtn.innerHTML = isEditMode ? 
            '<i class="fas fa-save"></i> Actualizar Área' : 
            '<i class="fas fa-save"></i> Guardar Área';
    }
}

/**
 * Limpia eventos
 */
export function destroyAreaController() {
    console.log('🧹 Destroying AreaController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    subareasCollection = [];
    currentModulos = [];
    isNavigating = false;
    editingAreaId = null;
    isEditMode = false;
}

export default areaController;