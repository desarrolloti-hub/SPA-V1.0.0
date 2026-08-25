/* ========================================
   PRODUCTO/SERVICIO FORM CONTROLLER
   Controlador para crear/editar un producto o servicio
   ======================================== */

import ProductoServicioService from '../../services/productoServicioService.js';
import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';

let service = null;
let categoriaService = null;
let eventListeners = [];
let editingId = null;
let isEditMode = false;
let categoriasCache = {};
let currentStep = 1;
const totalSteps = 3;
let isNavigating = false;
let imagenBase64 = '';
let imagenNombre = '';

/**
 * Inicializa el controlador del formulario
 */
export async function productoServicioFormController() {
    console.log('📦 Producto/Servicio Form Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new ProductoServicioService();
    categoriaService = new CategoriaProductoServicioService();
    eventListeners = [];
    editingId = null;
    isEditMode = false;
    categoriasCache = {};
    currentStep = 1;
    isNavigating = false;
    imagenBase64 = '';
    imagenNombre = '';
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        editingId = id;
        isEditMode = true;
        console.log('✏️ Modo edición - ID:', editingId);
    }
    
    // Cargar categorías
    await loadCategorias();
    
    // Inicializar eventos
    initStepNavigation();
    initFieldValidation();
    initImageHandlers();
    initSubmitHandler();
    initCancelButton();
    
    // Si es modo edición, cargar los datos
    if (isEditMode && editingId) {
        await loadProductoData(editingId);
    }
    
    // Ir al paso 1
    goToStep(1);
    
    // Actualizar título
    updateTitle();
    
    console.log(`✅ Producto/Servicio Form Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Carga las categorías para el select
 */
async function loadCategorias() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasCache = {};
        categorias.forEach(cat => {
            categoriasCache[cat.id] = cat.nombreCategoria;
        });
        
        const select = document.getElementById('categoriaId');
        if (!select) return;
        
        // Limpiar opciones (mantener la primera)
        select.innerHTML = '<option value="">Selecciona una categoría</option>';
        
        // Agregar opciones
        Object.keys(categoriasCache).forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = categoriasCache[id];
            select.appendChild(option);
        });
        
        console.log(`✅ Categorías cargadas: ${Object.keys(categoriasCache).length}`);
    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        mostrarAlerta('Error al cargar las categorías', 'error');
    }
}

/**
 * Actualiza el título según el modo
 */
function updateTitle() {
    const titleEl = document.getElementById('formPageTitle');
    const subtitleEl = document.getElementById('formPageSubtitle');
    const submitBtnText = document.getElementById('submitBtnText');
    const step1Title = document.getElementById('step1Title');
    const step1Subtitle = document.getElementById('step1Subtitle');
    
    if (isEditMode) {
        if (titleEl) {
            titleEl.innerHTML = `<span class="rsi-text-gold">Editar</span> Producto o Servicio`;
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Modifica los datos del producto o servicio.';
        }
        if (submitBtnText) {
            submitBtnText.textContent = 'Actualizar Producto';
        }
        if (step1Title) {
            step1Title.textContent = 'Editar Producto';
        }
        if (step1Subtitle) {
            step1Subtitle.textContent = 'Modifica los datos del producto o servicio';
        }
    } else {
        if (titleEl) {
            titleEl.innerHTML = `<span class="rsi-text-gold">Nuevo</span> Producto o Servicio`;
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Registra un nuevo producto o servicio para usar en cotizaciones y facturas.';
        }
        if (submitBtnText) {
            submitBtnText.textContent = 'Guardar Producto';
        }
        if (step1Title) {
            step1Title.textContent = 'Información del Producto';
        }
        if (step1Subtitle) {
            step1Subtitle.textContent = 'Datos principales del producto o servicio';
        }
    }
}

/**
 * Carga los datos del producto para edición
 */
async function loadProductoData(id) {
    try {
        mostrarLoading(true);
        
        const producto = await service.getProductoServicioRawById(id);
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        // Llenar formulario
        document.getElementById('nombre').value = producto.nombre || '';
        document.getElementById('precioUnitario').value = producto.precioUnitario || '';
        document.getElementById('categoriaId').value = producto.categoriaId || '';
        document.getElementById('activo').checked = producto.activo !== false;
        
        // ✅ Cargar imagen si existe
        if (producto.imagenBase64) {
            imagenBase64 = producto.imagenBase64;
            imagenNombre = producto.imagenNombre || 'imagen.png';
            updateImagePreview(imagenBase64);
            document.getElementById('removeImageBtn').style.display = 'inline-flex';
        }
        
        // Mostrar auditoría en confirmación
        const auditoriaConfirmacion = document.getElementById('auditoriaConfirmacion');
        if (auditoriaConfirmacion) {
            auditoriaConfirmacion.style.display = 'block';
            
            const creadoPorNombre = producto.creadoPor?.nombre || 'Sistema';
            const creadoPorFecha = producto.fechaCreacion ? formatDate(producto.fechaCreacion) : '-';
            const modificadoPorNombre = producto.modificadoPor?.nombre || 'Sistema';
            const modificadoPorFecha = producto.fechaActualizacion ? formatDate(producto.fechaActualizacion) : '-';
            
            document.getElementById('confirmCreadoPor').textContent = creadoPorNombre;
            document.getElementById('confirmFechaCreacion').textContent = creadoPorFecha;
            document.getElementById('confirmModificadoPor').textContent = modificadoPorNombre;
            document.getElementById('confirmFechaModificacion').textContent = modificadoPorFecha;
        }
        
        console.log('✅ Datos del producto cargados:', producto.nombre);
        
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cargando producto:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el producto para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudProductosServicios');
            } else {
                window.location.href = '/partner/crudProductosServicios';
            }
        });
    }
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
            if (isNavigating) return;
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
 * Navega a un paso (versión asíncrona)
 */
async function goToStepAsync(step) {
    if (step < 1 || step > totalSteps) return;
    if (isNavigating) return;

    if (step > currentStep) {
        const canProceed = await validateCurrentStepAsync(step);
        if (!canProceed) return;
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
    if (isNavigating) return;

    if (step > currentStep) {
        const isValid = validateCurrentStep();
        if (!isValid) return;
    }

    currentStep = step;
    updateUI(step);
    
    if (step === 3) {
        updateConfirmacion();
    }
}

/**
 * Valida el paso actual (versión asíncrona)
 */
async function validateCurrentStepAsync(nextStep) {
    const currentPanel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!currentPanel) return true;

    const inputs = currentPanel.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    if (!isValid) return false;

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
        if (!validateField(input)) {
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

    const form = document.getElementById('productoForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 2. VALIDACIÓN DE CAMPOS
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input[required], .rsi-form-group select[required]').forEach(input => {
        const blurHandler = () => {
            validateField(input);
        };
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
 * Valida un campo individual
 */
function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    const errorId = input.id ? `error${input.id.charAt(0).toUpperCase() + input.id.slice(1)}` : null;
    const errorEl = errorId ? document.getElementById(errorId) : null;
    
    if (!isRequired && !value) {
        input.classList.remove('error');
        if (errorEl) errorEl.textContent = '';
        return true;
    }
    
    if (isRequired && !value) {
        input.classList.add('error');
        if (errorEl) errorEl.textContent = 'Este campo es requerido';
        return false;
    }
    
    if (input.id === 'precioUnitario') {
        const precio = parseFloat(value);
        if (isRequired && (isNaN(precio) || precio <= 0)) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = 'El precio debe ser mayor a 0';
            return false;
        }
    }
    
    input.classList.remove('error');
    if (errorEl) errorEl.textContent = '';
    return true;
}

/**
 * 3. MANEJADORES DE IMAGEN
 */
function initImageHandlers() {
    const fileInput = document.getElementById('imagenInput');
    const dropArea = document.getElementById('dropArea');
    const removeBtn = document.getElementById('removeImageBtn');
    
    // Click en el área de drop
    if (dropArea) {
        dropArea.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        eventListeners.push({ element: dropArea, event: 'click', handler: () => fileInput?.click() });
        
        // Drag & Drop
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        eventListeners.push({ element: dropArea, event: 'dragover', handler: (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        }});
        
        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });
        eventListeners.push({ element: dropArea, event: 'dragleave', handler: () => {
            dropArea.classList.remove('dragover');
        }});
        
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        });
        eventListeners.push({ element: dropArea, event: 'drop', handler: (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        }});
    }
    
    // Input file
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        });
        eventListeners.push({ element: fileInput, event: 'change', handler: (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        }});
    }
    
    // Botón eliminar
    if (removeBtn) {
        removeBtn.addEventListener('click', removeImage);
        eventListeners.push({ element: removeBtn, event: 'click', handler: removeImage });
    }
}

/**
 * Maneja el archivo de imagen seleccionado
 */
function handleImageFile(file) {
    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        mostrarAlerta('Formato no permitido. Usa JPG, PNG o WEBP.', 'error');
        return;
    }
    
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        mostrarAlerta('La imagen es demasiado grande. Máximo 5MB.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        imagenBase64 = e.target.result;
        imagenNombre = file.name;
        updateImagePreview(imagenBase64);
        document.getElementById('removeImageBtn').style.display = 'inline-flex';
        document.getElementById('errorImagen').textContent = '';
        
        // Actualizar confirmación si estamos en el paso 3
        if (currentStep === 3) {
            updateConfirmacion();
        }
    };
    reader.onerror = () => {
        mostrarAlerta('Error al leer la imagen', 'error');
    };
    reader.readAsDataURL(file);
}

/**
 * Actualiza la vista previa de la imagen
 */
function updateImagePreview(base64) {
    const preview = document.getElementById('imagePreview');
    const confirmPreview = document.getElementById('confirmImagenPreview');
    
    if (preview) {
        preview.innerHTML = `<img src="${base64}" alt="Vista previa">`;
        preview.classList.add('has-image');
    }
    
    if (confirmPreview) {
        confirmPreview.innerHTML = `<img src="${base64}" alt="Vista previa">`;
        confirmPreview.className = '';
        confirmPreview.style.padding = '0';
        confirmPreview.style.border = 'none';
        confirmPreview.style.background = 'transparent';
        confirmPreview.style.minHeight = 'auto';
        confirmPreview.style.display = 'flex';
        confirmPreview.style.justifyContent = 'center';
        confirmPreview.style.alignItems = 'center';
    }
}

/**
 * Elimina la imagen
 */
function removeImage() {
    imagenBase64 = '';
    imagenNombre = '';
    
    const preview = document.getElementById('imagePreview');
    if (preview) {
        preview.innerHTML = `
            <i class="fas fa-image" style="font-size: 3rem; color: var(--rsi-gray-300);"></i>
            <p>Sin imagen seleccionada</p>
        `;
        preview.classList.remove('has-image');
    }
    
    const confirmPreview = document.getElementById('confirmImagenPreview');
    if (confirmPreview) {
        confirmPreview.innerHTML = `
            <i class="fas fa-image" style="font-size: 1.5rem; color: var(--rsi-gray-300);"></i>
            <p style="font-size: 0.75rem; color: var(--rsi-gray-500);">Sin imagen</p>
        `;
        confirmPreview.className = 'rsi-confirmacion-imagen';
        confirmPreview.style.padding = 'var(--rsi-spacing-sm)';
        confirmPreview.style.border = '1px dashed var(--rsi-gray-300)';
        confirmPreview.style.background = 'var(--card-bg)';
        confirmPreview.style.minHeight = '80px';
        confirmPreview.style.maxWidth = '150px';
        confirmPreview.style.margin = '0 auto';
    }
    
    const fileInput = document.getElementById('imagenInput');
    if (fileInput) fileInput.value = '';
    
    document.getElementById('removeImageBtn').style.display = 'none';
    
    // Actualizar confirmación si estamos en el paso 3
    if (currentStep === 3) {
        updateConfirmacion();
    }
}

/**
 * 4. ACTUALIZAR CONFIRMACIÓN
 */
function updateConfirmacion() {
    const nombre = document.getElementById('nombre')?.value || '-';
    const categoriaId = document.getElementById('categoriaId')?.value || '';
    const precio = document.getElementById('precioUnitario')?.value || '0';
    const activo = document.getElementById('activo')?.checked;
    
    document.getElementById('confirmNombre').textContent = nombre || '-';
    document.getElementById('confirmCategoria').textContent = categoriasCache[categoriaId] || 'Sin categoría';
    document.getElementById('confirmPrecio').textContent = formatCurrency(parseFloat(precio) || 0);
    document.getElementById('confirmEstado').textContent = activo ? '✅ Activo' : '❌ Inactivo';
    
    // Si hay imagen, actualizar confirmación
    if (imagenBase64) {
        const confirmPreview = document.getElementById('confirmImagenPreview');
        if (confirmPreview) {
            confirmPreview.innerHTML = `<img src="${imagenBase64}" alt="Vista previa">`;
            confirmPreview.className = '';
            confirmPreview.style.padding = '0';
            confirmPreview.style.border = 'none';
            confirmPreview.style.background = 'transparent';
            confirmPreview.style.minHeight = 'auto';
            confirmPreview.style.display = 'flex';
            confirmPreview.style.justifyContent = 'center';
            confirmPreview.style.alignItems = 'center';
        }
    }
}

/**
 * 5. ENVÍO DEL FORMULARIO
 */
function initSubmitHandler() {
    const submitBtn = document.getElementById('submitProducto');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

/**
 * 6. BOTÓN CANCELAR
 */
function initCancelButton() {
    const cancelBtn = document.getElementById('cancelBtn');
    if (!cancelBtn) return;
    
    const handler = () => {
        Swal.fire({
            title: '¿Cancelar?',
            text: 'Los cambios no guardados se perderán.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Continuar editando',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#1c1948'
        }).then((result) => {
            if (result.isConfirmed) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/partner/crudProductosServicios');
                } else {
                    window.location.href = '/partner/crudProductosServicios';
                }
            }
        });
    };
    
    cancelBtn.addEventListener('click', handler);
    eventListeners.push({ element: cancelBtn, event: 'click', handler });
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitProducto');
    
    try {
        // Validar paso actual
        if (!validateCurrentStep()) {
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        const nombre = document.getElementById('nombre').value.trim();
        const precioUnitario = parseFloat(document.getElementById('precioUnitario').value);
        const categoriaId = document.getElementById('categoriaId').value;
        const activo = document.getElementById('activo').checked;
        
        const data = {
            nombre,
            precioUnitario,
            categoriaId,
            activo
        };
        
        // ✅ Agregar imagen si existe (base64)
        if (imagenBase64) {
            data.imagenBase64 = imagenBase64;
            data.imagenNombre = imagenNombre;
        }
        
        let result;
        
        if (isEditMode && editingId) {
            result = await service.updateProductoServicio(editingId, data);
        } else {
            result = await service.createProductoServicio(data);
        }
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        Swal.fire({
            icon: 'success',
            title: isEditMode ? '¡Producto actualizado!' : '¡Producto creado!',
            text: isEditMode 
                ? `"${nombre}" ha sido actualizado exitosamente.` 
                : `"${nombre}" ha sido creado exitosamente.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        setTimeout(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudProductosServicios');
            } else {
                window.location.href = '/partner/crudProductosServicios';
            }
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el producto';
        
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
        submitBtn.innerHTML = `<i class="fas fa-save"></i> <span id="submitBtnText">${isEditMode ? 'Actualizar Producto' : 'Guardar Producto'}</span>`;
    }
}

// =================================================================================
// FUNCIONES DE UTILIDAD
// =================================================================================

function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loadingSpinner');
    if (overlay) {
        overlay.classList.toggle('active', mostrar);
    }
}

function mostrarAlerta(mensaje, tipo = 'info') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            title: mensaje,
            icon: tipo,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: 'var(--card-bg)',
            color: 'var(--text-color)'
        });
    } else {
        console.log(`[ALERTA ${tipo}]: ${mensaje}`);
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
}

/**
 * Limpia eventos
 */
export function destroyProductoServicioFormController() {
    console.log('🧹 Destroying ProductoServicioFormController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    categoriaService = null;
    editingId = null;
    isEditMode = false;
    categoriasCache = {};
    imagenBase64 = '';
    imagenNombre = '';
}

export default productoServicioFormController;