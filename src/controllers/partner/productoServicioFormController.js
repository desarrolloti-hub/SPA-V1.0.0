/* ========================================
   PRODUCTO/SERVICIO FORM CONTROLLER
   Controlador para crear/editar un producto o servicio
   BÚSQUEDA SAT EN FIRESTORE CON ÍNDICES
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

// ========================================
// ESTADO PARA CATÁLOGO SAT
// ========================================
let selectedSatClave = '';
let selectedSatDescripcion = '';
let searchTimeout = null;
let isSearching = false;

/**
 * Busca en el catálogo SAT a través de ProductoServicioService
 */
async function searchSatInFirestore(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        return [];
    }
    
    if (isSearching) return [];
    isSearching = true;
    
    try {
        const results = await service.searchSatCatalog(searchTerm);
        isSearching = false;
        return results;
    } catch (error) {
        console.error('❌ Error en búsqueda SAT:', error);
        isSearching = false;
        return [];
    }
}

// ========================================
// INICIALIZACIÓN DEL CONTROLLER
// ========================================
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
    selectedSatClave = '';
    selectedSatDescripcion = '';
    
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
    initSatAutocomplete(); // 🔥 Autocompletado con búsqueda en Firestore
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

// ========================================
// CARGA DE CATEGORÍAS
// ========================================
async function loadCategorias() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasCache = {};
        categorias.forEach(cat => {
            categoriasCache[cat.id] = cat.nombreCategoria;
        });
        
        const select = document.getElementById('categoriaId');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecciona una categoría</option>';
        
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

// ========================================
// TÍTULO DINÁMICO
// ========================================
function updateTitle() {
    const titleEl = document.getElementById('formPageTitle');
    const subtitleEl = document.getElementById('formPageSubtitle');
    const submitBtnText = document.getElementById('submitBtnText');
    const step1Title = document.getElementById('step1Title');
    const step1Subtitle = document.getElementById('step1Subtitle');
    
    if (isEditMode) {
        if (titleEl) titleEl.innerHTML = `<span class="rsi-text-gold">Editar</span> Producto o Servicio`;
        if (subtitleEl) subtitleEl.textContent = 'Modifica los datos del producto o servicio.';
        if (submitBtnText) submitBtnText.textContent = 'Actualizar Producto';
        if (step1Title) step1Title.textContent = 'Editar Producto';
        if (step1Subtitle) step1Subtitle.textContent = 'Modifica los datos del producto o servicio';
    } else {
        if (titleEl) titleEl.innerHTML = `<span class="rsi-text-gold">Nuevo</span> Producto o Servicio`;
        if (subtitleEl) subtitleEl.textContent = 'Registra un nuevo producto o servicio para usar en cotizaciones y facturas.';
        if (submitBtnText) submitBtnText.textContent = 'Guardar Producto';
        if (step1Title) step1Title.textContent = 'Información del Producto';
        if (step1Subtitle) step1Subtitle.textContent = 'Datos principales del producto o servicio';
    }
}

// ========================================
// CARGA DE DATOS PARA EDICIÓN
// ========================================
async function loadProductoData(id) {
    try {
        mostrarLoading(true);
        
        const producto = await service.getProductoServicioRawById(id);
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        document.getElementById('nombre').value = producto.nombre || '';
        document.getElementById('precioUnitario').value = producto.precioUnitario || '';
        document.getElementById('categoriaId').value = producto.categoriaId || '';
        document.getElementById('activo').checked = producto.activo !== false;
        
        // 🔑 Cargar clave SAT si existe
        if (producto.claveSat) {
            selectedSatClave = producto.claveSat;
            selectedSatDescripcion = producto.descripcionSat || '';
            const input = document.getElementById('claveSat');
            if (input) {
                input.value = producto.claveSat;
                updateSatInfo(producto.claveSat, producto.descripcionSat);
            }
        }
        
        // Cargar imagen
        if (producto.imagenBase64) {
            imagenBase64 = producto.imagenBase64;
            imagenNombre = producto.imagenNombre || 'imagen.png';
            updateImagePreview(imagenBase64);
            document.getElementById('removeImageBtn').style.display = 'inline-flex';
        }
        
        // Auditoría
        const auditoriaConfirmacion = document.getElementById('auditoriaConfirmacion');
        if (auditoriaConfirmacion) {
            auditoriaConfirmacion.style.display = 'block';
            document.getElementById('confirmCreadoPor').textContent = producto.creadoPor?.nombre || 'Sistema';
            document.getElementById('confirmFechaCreacion').textContent = producto.fechaCreacion ? formatDate(producto.fechaCreacion) : '-';
            document.getElementById('confirmModificadoPor').textContent = producto.modificadoPor?.nombre || 'Sistema';
            document.getElementById('confirmFechaModificacion').textContent = producto.fechaActualizacion ? formatDate(producto.fechaActualizacion) : '-';
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

// ========================================
// 🔥 AUTOCOMPLETADO DE CLAVE SAT (Con búsqueda en Firestore)
// ========================================
function initSatAutocomplete() {
    const input = document.getElementById('claveSat');
    const sugerenciasContainer = document.getElementById('sugerenciasSat');
    const infoClave = document.getElementById('descripcionSatMostrada');
    const buscarBtn = document.getElementById('buscarClaveSatBtn');
    
    if (!input) return;
    
    // ============ EVENTO DE ENTRADA CON DEBOUNCE ============
    input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        // Limpiar timeout anterior
        if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
        }
        
        if (value.length < 2) {
            sugerenciasContainer.style.display = 'none';
            if (!selectedSatClave) {
                infoClave.textContent = 'Clave del catálogo SAT (opcional)';
            }
            return;
        }
        
        // Mostrar indicador de búsqueda
        infoClave.innerHTML = `<span style="color: var(--rsi-gray-500);">🔍 Buscando...</span>`;
        
        // Debounce de 300ms para evitar muchas consultas
        searchTimeout = setTimeout(async () => {
            try {
                const results = await searchSatInFirestore(value);
                
                if (results.length === 0) {
                    sugerenciasContainer.style.display = 'none';
                    infoClave.innerHTML = `<span style="color: var(--rsi-warning, #d97706);">🔍 No se encontraron coincidencias en el catálogo SAT</span>`;
                    return;
                }
                
                // Mostrar sugerencias
                sugerenciasContainer.innerHTML = '';
                results.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'rsi-sugerencia-item';
                    div.innerHTML = `
                        <span class="clave">${item.clave}</span>
                        <span class="descripcion">${item.descripcion}</span>
                    `;
                    div.addEventListener('click', () => {
                        selectSatClave(item.clave, item.descripcion);
                        sugerenciasContainer.style.display = 'none';
                    });
                    div.addEventListener('mouseenter', () => {
                        div.style.background = 'var(--rsi-gray-100, #f0f0f0)';
                    });
                    div.addEventListener('mouseleave', () => {
                        div.style.background = 'transparent';
                    });
                    sugerenciasContainer.appendChild(div);
                });
                
                sugerenciasContainer.style.display = 'block';
                infoClave.innerHTML = `<span style="color: var(--rsi-gray-500);">🔎 ${results.length} resultados encontrados</span>`;
                
            } catch (error) {
                console.error('❌ Error en búsqueda SAT:', error);
                infoClave.innerHTML = `<span style="color: var(--rsi-danger, #dc2626);">❌ Error al buscar en el catálogo</span>`;
            }
        }, 300);
    });
    
    // ============ OCULTAR SUGERENCIAS ============
    document.addEventListener('click', (e) => {
        if (sugerenciasContainer && 
            !sugerenciasContainer.contains(e.target) && 
            e.target !== input) {
            sugerenciasContainer.style.display = 'none';
        }
    });
    
    // ============ BOTÓN DE BÚSQUEDA ============
    if (buscarBtn) {
        buscarBtn.addEventListener('click', async () => {
            const value = input.value.trim();
            if (value.length < 2) {
                infoClave.textContent = 'Ingresa al menos 2 caracteres para buscar';
                return;
            }
            
            try {
                infoClave.innerHTML = `<span style="color: var(--rsi-gray-500);">🔍 Buscando...</span>`;
                const results = await searchSatInFirestore(value);
                
                if (results.length === 1) {
                    selectSatClave(results[0].clave, results[0].descripcion);
                    sugerenciasContainer.style.display = 'none';
                } else if (results.length > 0) {
                    sugerenciasContainer.style.display = 'block';
                    input.dispatchEvent(new Event('input'));
                } else {
                    infoClave.innerHTML = `<span style="color: var(--rsi-warning, #d97706);">❌ No se encontró ninguna coincidencia</span>`;
                }
            } catch (error) {
                console.error('❌ Error en búsqueda:', error);
                infoClave.innerHTML = `<span style="color: var(--rsi-danger, #dc2626);">❌ Error al buscar</span>`;
            }
        });
    }
    
    // ============ TECLA ENTER ============
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = input.value.trim();
            if (value.length >= 2) {
                e.preventDefault();
                // Ver si hay sugerencias visibles
                if (sugerenciasContainer.style.display === 'block') {
                    const firstItem = sugerenciasContainer.querySelector('.rsi-sugerencia-item');
                    if (firstItem) {
                        const clave = firstItem.querySelector('.clave')?.textContent;
                        const desc = firstItem.querySelector('.descripcion')?.textContent;
                        if (clave) {
                            selectSatClave(clave, desc);
                            sugerenciasContainer.style.display = 'none';
                            return;
                        }
                    }
                }
                // Si no hay sugerencias, buscar directamente
                buscarBtn?.click();
            }
        }
        if (e.key === 'Escape') {
            sugerenciasContainer.style.display = 'none';
        }
    });
}

/**
 * 🔥 Selecciona una clave SAT y actualiza la UI
 */
function selectSatClave(clave, descripcion = '') {
    const input = document.getElementById('claveSat');
    const infoClave = document.getElementById('descripcionSatMostrada');
    const sugerenciasContainer = document.getElementById('sugerenciasSat');
    
    if (!clave) return;
    
    selectedSatClave = clave;
    selectedSatDescripcion = descripcion || '';
    
    input.value = clave;
    input.dataset.descripcionSat = selectedSatDescripcion;
    
    updateSatInfo(clave, selectedSatDescripcion);
    
    sugerenciasContainer.style.display = 'none';
    
    // Actualizar confirmación si estamos en el paso 3
    if (currentStep === 3) {
        updateConfirmacion();
    }
    
    console.log(`✅ Seleccionada clave SAT: ${clave} - ${selectedSatDescripcion}`);
}

/**
 * Actualiza la información de la clave SAT en la UI
 */
function updateSatInfo(clave, descripcion) {
    const infoClave = document.getElementById('descripcionSatMostrada');
    if (infoClave) {
        infoClave.innerHTML = `
            <span style="font-weight: 600; color: var(--rsi-success, #0f7b3e);">✅ ${clave}</span>
            <span style="color: var(--rsi-gray-500); margin-left: 8px;">${descripcion || 'Sin descripción'}</span>
        `;
    }
}

// ========================================
// NAVEGACIÓN POR PASOS
// ========================================
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

    return isValid;
}

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

function updateUI(step) {
    document.querySelectorAll('.rsi-step-panel').forEach(panel => {
        const panelStep = parseInt(panel.dataset.step);
        panel.classList.toggle('active', panelStep === step);
    });

    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (dotStep === step) dot.classList.add('active');
        else if (dotStep < step) dot.classList.add('completed');
    });

    document.querySelectorAll('.rsi-step-label').forEach(label => {
        const labelStep = parseInt(label.dataset.step);
        label.classList.remove('active', 'completed');
        if (labelStep === step) label.classList.add('active');
        else if (labelStep < step) label.classList.add('completed');
    });

    document.querySelectorAll('.rsi-step-line').forEach(line => {
        const lineStep = parseInt(line.dataset.step);
        line.classList.remove('active', 'completed');
        if (lineStep < step) line.classList.add('completed');
        else if (lineStep === step && step < totalSteps) line.classList.add('active');
    });

    document.querySelectorAll('.rsi-step-counter span').forEach(span => {
        span.textContent = step;
    });

    const form = document.getElementById('productoForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ========================================
// VALIDACIÓN DE CAMPOS
// ========================================
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input[required], .rsi-form-group select[required]').forEach(input => {
        const blurHandler = () => { validateField(input); };
        input.addEventListener('blur', blurHandler);
        eventListeners.push({ element: input, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (input.classList.contains('error')) validateField(input);
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

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

// ========================================
// MANEJADORES DE IMAGEN
// ========================================
function initImageHandlers() {
    const fileInput = document.getElementById('imagenInput');
    const dropArea = document.getElementById('dropArea');
    const removeBtn = document.getElementById('removeImageBtn');
    
    if (dropArea) {
        dropArea.addEventListener('click', () => { if (fileInput) fileInput.click(); });
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0]);
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        });
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', removeImage);
    }
}

function handleImageFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        mostrarAlerta('Formato no permitido. Usa JPG, PNG o WEBP.', 'error');
        return;
    }
    
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
        if (currentStep === 3) updateConfirmacion();
    };
    reader.onerror = () => { mostrarAlerta('Error al leer la imagen', 'error'); };
    reader.readAsDataURL(file);
}

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
    if (currentStep === 3) updateConfirmacion();
}

// ========================================
// ACTUALIZAR CONFIRMACIÓN
// ========================================
function updateConfirmacion() {
    const nombre = document.getElementById('nombre')?.value || '-';
    const categoriaId = document.getElementById('categoriaId')?.value || '';
    const precio = document.getElementById('precioUnitario')?.value || '0';
    const activo = document.getElementById('activo')?.checked;
    const claveSat = selectedSatClave || document.getElementById('claveSat')?.value || '';
    const descripcionSat = selectedSatDescripcion || document.getElementById('claveSat')?.dataset?.descripcionSat || '';
    
    document.getElementById('confirmNombre').textContent = nombre || '-';
    document.getElementById('confirmCategoria').textContent = categoriasCache[categoriaId] || 'Sin categoría';
    document.getElementById('confirmPrecio').textContent = formatCurrency(parseFloat(precio) || 0);
    document.getElementById('confirmEstado').textContent = activo ? '✅ Activo' : '❌ Inactivo';
    
    // 🔑 CLAVE SAT en confirmación
    const confirmClave = document.getElementById('confirmClaveSat');
    const confirmDesc = document.getElementById('confirmDescripcionSat');
    const descContainer = document.getElementById('confirmDescripcionSatContainer');
    
    if (confirmClave) {
        confirmClave.textContent = claveSat || 'No especificada';
    }
    if (confirmDesc) {
        confirmDesc.textContent = descripcionSat || '—';
    }
    if (descContainer) {
        descContainer.style.display = claveSat ? 'flex' : 'none';
    }
    
    // Imagen en confirmación
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

// ========================================
// ENVÍO DEL FORMULARIO
// ========================================
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

// ========================================
// MANEJO DEL ENVÍO
// ========================================
async function handleSubmit() {
    const submitBtn = document.getElementById('submitProducto');
    
    try {
        if (!validateCurrentStep()) return;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        const nombre = document.getElementById('nombre').value.trim();
        const precioUnitario = parseFloat(document.getElementById('precioUnitario').value);
        const categoriaId = document.getElementById('categoriaId').value;
        const activo = document.getElementById('activo').checked;
        
        // 🔑 Obtener clave SAT
        const claveSatInput = document.getElementById('claveSat');
        const claveSat = selectedSatClave || claveSatInput?.value?.trim() || '';
        const descripcionSat = selectedSatDescripcion || claveSatInput?.dataset?.descripcionSat || '';
        
        const data = {
            nombre,
            precioUnitario,
            categoriaId,
            activo,
            claveSat,
            descripcionSat
        };
        
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
            text: `"${nombre}" ha sido ${isEditMode ? 'actualizado' : 'creado'} exitosamente.`,
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
            } catch {}
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

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================
function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loadingSpinner');
    if (overlay) overlay.classList.toggle('active', mostrar);
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
            timerProgressBar: true
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
    } catch { return dateString; }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
}

// ========================================
// DESTROY
// ========================================
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
    selectedSatClave = '';
    selectedSatDescripcion = '';
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
}

export default productoServicioFormController;