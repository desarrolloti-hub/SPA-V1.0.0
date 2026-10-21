/* ========================================
   CATALOG CONTROLLER
   Controlador para crear/editar catálogos
   ======================================== */

import CatalogService from '../../services/catalogService.js';

// ==========================================
// ESTADO
// ==========================================
let currentStep = 1;
const totalSteps = 3;
let service = null;
let eventListeners = [];

let editingCatalogId = null;
let isEditMode = false;
let originalCatalogData = {};

// Productos en memoria (modo nuevo) o cargados desde Firestore (modo edición)
let products = [];

// Imágenes pendientes (File objects)
let pendingPortadaFile = null;
let pendingProductImageFile = null;

// ==========================================
// HELPERS
// ==========================================

function getForm() {
    const form = document.getElementById('catalogForm');
    if (form && form instanceof HTMLFormElement) return form;
    console.error('❌ No se encontró #catalogForm');
    return null;
}

function getCurrentUserForUI() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (!session) return { uid: '', nombre: 'Usuario' };
        const s = JSON.parse(session);
        return {
            uid: s.uid || '',
            nombre: s.nombreCompleto || s.displayName || s.email || 'Usuario'
        };
    } catch {
        return { uid: '', nombre: 'Usuario' };
    }
}

/**
 * Genera un ID temporal para productos en memoria
 */
function tempId() {
    return 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ==========================================
// ENTRY POINT
// ==========================================

export async function catalogController() {
    console.log('📦 Catalog Controller iniciado');

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    const form = getForm();
    if (!form) return;

    service = new CatalogService();
    currentStep = 1;
    products = [];
    pendingPortadaFile = null;
    pendingProductImageFile = null;

    // Detectar modo edición
    const urlParams = new URLSearchParams(window.location.search);
    const catalogId = urlParams.get('id');

    if (catalogId) {
        editingCatalogId = catalogId;
        isEditMode = true;
        console.log('✏️ Modo edición - Catálogo ID:', editingCatalogId);
    }

    updateTitles();

    if (isEditMode) {
        await loadCatalogData(editingCatalogId);
    }

    initStepNavigation();
    initStepIndicators();
    initCharacterCounter();
    initImagePreviews();
    initProductModal();
    initSubmitHandler();

    goToStep(1);
    renderProducts();
    updateSummary();

    console.log(`✅ Catalog Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

// ==========================================
// TÍTULOS
// ==========================================

function updateTitles() {
    const pageTitle = document.querySelector('.rsi-page-title');
    const pageSubtitle = document.querySelector('.rsi-page-subtitle');
    const submitBtn = document.getElementById('submitCatalog');

    if (isEditMode) {
        if (pageTitle) pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Catálogo`;
        if (pageSubtitle) pageSubtitle.textContent = 'Modifica los datos del catálogo y sus productos.';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Catálogo';
    } else {
        if (pageTitle) pageTitle.innerHTML = `<span class="rsi-text-gold">Registro</span> de Nuevo Catálogo`;
        if (pageSubtitle) pageSubtitle.textContent = 'Crea un catálogo y agrega los productos o servicios que ofrecerás.';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Catálogo';
    }
}

// ==========================================
// CARGA EN MODO EDICIÓN
// ==========================================

async function loadCatalogData(catalogId) {
    try {
        const catalog = await service.getCatalogById(catalogId);
        if (!catalog) throw new Error('Catálogo no encontrado');

        originalCatalogData = catalog;

        // Paso 1
        document.getElementById('titulo').value = catalog.titulo || '';
        document.getElementById('descripcion').value = catalog.descripcion || '';
        document.getElementById('descCounter').textContent = (catalog.descripcion || '').length;

        if (catalog.imagenPortada) {
            const preview = document.getElementById('portadaPreview');
            preview.innerHTML = `<img src="${catalog.imagenPortada}" alt="Portada">`;
            preview.dataset.existingUrl = catalog.imagenPortada;
            preview.dataset.existingPath = catalog.imagenPortadaPath || '';
        }

        // Productos
        products = await service.getProductsByCatalog(catalogId, true);
        console.log(`📦 ${products.length} productos cargados`);

    } catch (error) {
        console.error('❌ Error cargando catálogo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el catálogo: ' + error.message,
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudCatalogos');
            } else {
                window.location.href = '/partner/crudCatalogos';
            }
        });
    }
}

// ==========================================
// NAVEGACIÓN POR PASOS
// ==========================================

function initStepNavigation() {
    document.querySelectorAll('.rsi-btn-next').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const next = parseInt(btn.dataset.next);
            if (!isNaN(next)) goToStep(next);
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });

    document.querySelectorAll('.rsi-btn-prev').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const prev = parseInt(btn.dataset.prev);
            if (!isNaN(prev)) goToStep(prev);
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

function initStepIndicators() {
    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const handler = () => {
            const step = parseInt(dot.dataset.step);
            if (!isNaN(step) && step < currentStep) goToStep(step);
        };
        dot.addEventListener('click', handler);
        eventListeners.push({ element: dot, event: 'click', handler });
    });
}

function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    if (step > currentStep && !validateCurrentStep()) return;

    currentStep = step;
    updateUI(step);

    if (step === 3) updateSummary();
}

function updateUI(step) {
    document.querySelectorAll('.rsi-step-panel').forEach(panel => {
        panel.classList.toggle('active', parseInt(panel.dataset.step) === step);
    });

    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const s = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (s === step) dot.classList.add('active');
        else if (s < step) dot.classList.add('completed');
    });

    document.querySelectorAll('.rsi-step-label').forEach(label => {
        const s = parseInt(label.dataset.step);
        label.classList.remove('active', 'completed');
        if (s === step) label.classList.add('active');
        else if (s < step) label.classList.add('completed');
    });

    document.querySelectorAll('.rsi-step-line').forEach(line => {
        const s = parseInt(line.dataset.step);
        line.classList.remove('active', 'completed');
        if (s < step) line.classList.add('completed');
        else if (s === step && step < totalSteps) line.classList.add('active');
    });

    document.querySelectorAll('.rsi-step-counter span').forEach(span => {
        span.textContent = step;
    });

    const form = getForm();
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================
// VALIDACIÓN
// ==========================================

function validateCurrentStep() {
    const panel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!panel) return true;

    let isValid = true;

    // Paso 1: validar título
    if (currentStep === 1) {
        const titulo = document.getElementById('titulo');
        const descripcion = document.getElementById('descripcion');

        if (!titulo.value.trim() || titulo.value.trim().length < 3) {
            showFieldError(titulo, 'El título es requerido (mínimo 3 caracteres)');
            isValid = false;
        } else {
            clearFieldError(titulo);
        }

        if (descripcion.value.length > 500) {
            showFieldError(descripcion, 'Máximo 500 caracteres');
            isValid = false;
        } else {
            clearFieldError(descripcion);
        }
    }

    // Paso 2: no es obligatorio tener productos
    // Paso 3: no hay validaciones extra

    return isValid;
}

function showFieldError(input, message) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;
    group.classList.add('error');
    const msg = group.querySelector('.rsi-form-error-message');
    if (msg) msg.textContent = message;
}

function clearFieldError(input) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;
    group.classList.remove('error');
    const msg = group.querySelector('.rsi-form-error-message');
    if (msg) msg.textContent = '';
}

// ==========================================
// CONTADOR DE CARACTERES
// ==========================================

function initCharacterCounter() {
    const descripcion = document.getElementById('descripcion');
    const counter = document.getElementById('descCounter');
    if (!descripcion || !counter) return;

    const handler = () => {
        counter.textContent = descripcion.value.length;
    };
    descripcion.addEventListener('input', handler);
    eventListeners.push({ element: descripcion, event: 'input', handler });
}

// ==========================================
// PREVIEWS DE IMÁGENES (PORTADA)
// ==========================================

function initImagePreviews() {
    const portadaInput = document.getElementById('imagenPortada');
    const portadaPreview = document.getElementById('portadaPreview');
    if (!portadaInput || !portadaPreview) return;

    const handler = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar
        if (!file.type.startsWith('image/')) {
            Swal.fire({ icon: 'warning', title: 'Archivo inválido', text: 'Solo se permiten imágenes' });
            portadaInput.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({ icon: 'warning', title: 'Imagen muy grande', text: 'Máximo 5MB' });
            portadaInput.value = '';
            return;
        }

        pendingPortadaFile = file;

        const reader = new FileReader();
        reader.onload = (ev) => {
            portadaPreview.innerHTML = `<img src="${ev.target.result}" alt="Portada">`;
        };
        reader.readAsDataURL(file);
    };

    portadaInput.addEventListener('change', handler);
    eventListeners.push({ element: portadaInput, event: 'change', handler });
}

// ==========================================
// MODAL DE PRODUCTOS
// ==========================================

function initProductModal() {
    const addBtn = document.getElementById('addProductBtn');
    const closeBtn = document.getElementById('closeProductModal');
    const cancelBtn = document.getElementById('cancelProductModal');
    const saveBtn = document.getElementById('saveProductBtn');
    const modal = document.getElementById('productModal');
    const productImageInput = document.getElementById('productImage');
    const productImagePreview = document.getElementById('productImagePreview');

    if (!addBtn || !modal) return;

    // Abrir modal (nuevo producto)
    addBtn.addEventListener('click', () => openProductModal());
    eventListeners.push({ element: addBtn, event: 'click', handler: () => openProductModal() });

    // Cerrar modal
    const closeHandler = () => closeProductModal();
    closeBtn?.addEventListener('click', closeHandler);
    cancelBtn?.addEventListener('click', closeHandler);
    if (closeBtn) eventListeners.push({ element: closeBtn, event: 'click', handler: closeHandler });
    if (cancelBtn) eventListeners.push({ element: cancelBtn, event: 'click', handler: closeHandler });

    // Cerrar al click afuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeProductModal();
    });

    // Preview de imagen del producto
    if (productImageInput && productImagePreview) {
        const imgHandler = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                Swal.fire({ icon: 'warning', title: 'Archivo inválido', text: 'Solo se permiten imágenes' });
                productImageInput.value = '';
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire({ icon: 'warning', title: 'Imagen muy grande', text: 'Máximo 5MB' });
                productImageInput.value = '';
                return;
            }

            pendingProductImageFile = file;

            const reader = new FileReader();
            reader.onload = (ev) => {
                productImagePreview.innerHTML = `<img src="${ev.target.result}" alt="Producto">`;
            };
            reader.readAsDataURL(file);
        };
        productImageInput.addEventListener('change', imgHandler);
        eventListeners.push({ element: productImageInput, event: 'change', handler: imgHandler });
    }

    // Guardar producto
    if (saveBtn) {
        const saveHandler = async () => await saveProduct();
        saveBtn.addEventListener('click', saveHandler);
        eventListeners.push({ element: saveBtn, event: 'click', handler: saveHandler });
    }
}

function openProductModal(productToEdit = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const editingId = document.getElementById('editingProductId');
    const nameInput = document.getElementById('productName');
    const descInput = document.getElementById('productDescription');
    const priceInput = document.getElementById('productPrice');
    const preview = document.getElementById('productImagePreview');
    const imageInput = document.getElementById('productImage');

    // Limpiar
    nameInput.value = '';
    descInput.value = '';
    priceInput.value = '';
    imageInput.value = '';
    pendingProductImageFile = null;
    preview.innerHTML = `<i class="fas fa-camera"></i><span>Subir imagen</span>`;

    if (productToEdit) {
        title.textContent = 'Editar Producto';
        editingId.value = productToEdit.id;
        nameInput.value = productToEdit.nombre || '';
        descInput.value = productToEdit.descripcion || '';
        priceInput.value = productToEdit.precio ?? '';

        if (productToEdit.imagen) {
            preview.innerHTML = `<img src="${productToEdit.imagen}" alt="Producto">`;
            preview.dataset.existingUrl = productToEdit.imagen;
            preview.dataset.existingPath = productToEdit.imagenPath || '';
        }
    } else {
        title.textContent = 'Agregar Producto';
        editingId.value = '';
        delete preview.dataset.existingUrl;
        delete preview.dataset.existingPath;
    }

    modal.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 100);
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.style.display = 'none';
}

async function saveProduct() {
    const editingId = document.getElementById('editingProductId').value;
    const nameInput = document.getElementById('productName');
    const descInput = document.getElementById('productDescription');
    const priceInput = document.getElementById('productPrice');
    const preview = document.getElementById('productImagePreview');
    const saveBtn = document.getElementById('saveProductBtn');

    // Validar
    const nombre = nameInput.value.trim();
    if (!nombre || nombre.length < 2) {
        showFieldError(nameInput, 'El nombre es requerido (mínimo 2 caracteres)');
        return;
    }
    clearFieldError(nameInput);

    const productData = {
        nombre,
        descripcion: descInput.value.trim(),
        precio: priceInput.value === '' ? null : Number(priceInput.value),
        imagenFile: pendingProductImageFile,
        imagenActual: preview.dataset.existingUrl || '',
        imagenPathActual: preview.dataset.existingPath || '',
        catalogId: editingCatalogId
    };

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        if (isEditMode && editingCatalogId) {
            // 🔥 Modo edición: persistir directo en Firestore
            if (editingId) {
                // Actualizar
                await service.updateProduct(editingId, productData);
                // Refrescar lista
                products = await service.getProductsByCatalog(editingCatalogId, true);
            } else {
                // Crear
                await service.createProduct(editingCatalogId, productData);
                products = await service.getProductsByCatalog(editingCatalogId, true);
            }
        } else {
            // 🔥 Modo nuevo: guardar en memoria
            if (editingId) {
                // Buscar y actualizar
                const idx = products.findIndex(p => p.id === editingId);
                if (idx !== -1) {
                    products[idx] = {
                        ...products[idx],
                        nombre: productData.nombre,
                        descripcion: productData.descripcion,
                        precio: productData.precio,
                        _pendingImageFile: pendingProductImageFile || products[idx]._pendingImageFile,
                        _pendingPreview: pendingProductImageFile 
                            ? URL.createObjectURL(pendingProductImageFile) 
                            : products[idx]._pendingPreview,
                        _existingImage: preview.dataset.existingUrl || products[idx]._existingImage
                    };
                }
            } else {
                // Crear nuevo (en memoria)
                products.push({
                    id: tempId(),
                    nombre: productData.nombre,
                    descripcion: productData.descripcion,
                    precio: productData.precio,
                    orden: products.length + 1,
                    _pendingImageFile: pendingProductImageFile,
                    _pendingPreview: pendingProductImageFile 
                        ? URL.createObjectURL(pendingProductImageFile) 
                        : '',
                    _existingImage: preview.dataset.existingUrl || ''
                });
            }
        }

        renderProducts();
        closeProductModal();

        Swal.fire({
            icon: 'success',
            title: editingId ? 'Producto actualizado' : 'Producto agregado',
            timer: 1200,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('❌ Error guardando producto:', error);
        let msg = error.message || 'Error al guardar el producto';
        if (msg.includes('{"')) {
            try {
                const errors = JSON.parse(msg);
                msg = Object.values(errors).join('\n');
            } catch {}
        }
        Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#d33' });
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Guardar';
    }
}

// ==========================================
// RENDERIZADO DE PRODUCTOS
// ==========================================

function renderProducts() {
    const list = document.getElementById('productsList');
    const empty = document.getElementById('noProductsMessage');
    if (!list || !empty) return;

    list.innerHTML = '';

    if (products.length === 0) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    products.forEach((product, index) => {
        const imgSrc = product.imagen 
            || product._pendingPreview 
            || product._existingImage 
            || '';

        const card = document.createElement('div');
        card.className = 'rsi-product-card';
        card.innerHTML = `
            <div class="rsi-product-card-image">
                ${imgSrc 
                    ? `<img src="${imgSrc}" alt="${escapeHtml(product.nombre)}">` 
                    : `<div class="rsi-product-card-placeholder"><i class="fas fa-image"></i></div>`}
            </div>
            <div class="rsi-product-card-body">
                <h4>${escapeHtml(product.nombre)}</h4>
                <p>${escapeHtml(product.descripcion || 'Sin descripción')}</p>
                ${product.precio !== null && product.precio !== undefined 
                    ? `<span class="rsi-product-price">$${Number(product.precio).toFixed(2)}</span>` 
                    : ''}
            </div>
            <div class="rsi-product-card-actions">
                <button type="button" class="rsi-btn-icon" data-action="edit" data-index="${index}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="rsi-btn-icon rsi-btn-danger" data-action="disable" data-index="${index}" title="Deshabilitar">
                    <i class="fas fa-ban"></i>
                </button>
            </div>
        `;
        list.appendChild(card);
    });

    // Listeners de las cards
    list.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);
            const product = products[index];

            if (action === 'edit') {
                openProductModal(product);
            } else if (action === 'disable') {
                await handleDisableProduct(product, index);
            }
        });
    });
}

async function handleDisableProduct(product, index) {
    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Deshabilitar producto?',
        text: `"${product.nombre}" dejará de mostrarse en el catálogo.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, deshabilitar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (!result.isConfirmed) return;

    try {
        if (isEditMode && editingCatalogId && !product.id.startsWith('tmp_')) {
            // Persistir deshabilitación
            await service.disableProduct(product.id);
            products = await service.getProductsByCatalog(editingCatalogId, true);
        } else {
            // Modo nuevo: solo quitar de memoria
            products.splice(index, 1);
        }

        renderProducts();
        Swal.fire({
            icon: 'success',
            title: 'Producto deshabilitado',
            timer: 1200,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('❌ Error deshabilitando producto:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

// ==========================================
// RESUMEN
// ==========================================

function updateSummary() {
    const summary = document.getElementById('summaryContent');
    if (!summary) return;

    const titulo = document.getElementById('titulo')?.value || '';
    const descripcion = document.getElementById('descripcion')?.value || '';
    const portadaPreview = document.getElementById('portadaPreview');
    const portadaUrl = portadaPreview?.querySelector('img')?.src || '';

    summary.innerHTML = `
        <div class="rsi-summary-section">
            <h4><i class="fas fa-folder-open"></i> Catálogo</h4>
            <div class="rsi-summary-row">
                <span class="rsi-summary-label">Título:</span>
                <span class="rsi-summary-value">${escapeHtml(titulo) || '<em>Sin título</em>'}</span>
            </div>
            <div class="rsi-summary-row">
                <span class="rsi-summary-label">Descripción:</span>
                <span class="rsi-summary-value">${escapeHtml(descripcion) || '<em>Sin descripción</em>'}</span>
            </div>
            ${portadaUrl ? `
                <div class="rsi-summary-row">
                    <span class="rsi-summary-label">Portada:</span>
                    <span class="rsi-summary-value">
                        <img src="${portadaUrl}" alt="Portada" class="rsi-summary-thumb">
                    </span>
                </div>
            ` : ''}
        </div>

        <div class="rsi-summary-section">
            <h4><i class="fas fa-box-open"></i> Productos (${products.length})</h4>
            ${products.length === 0 
                ? '<p class="rsi-summary-empty">No se han agregado productos.</p>'
                : `<ul class="rsi-summary-products">
                    ${products.map(p => `<li>${escapeHtml(p.nombre)}</li>`).join('')}
                </ul>`
            }
        </div>
    `;
}

// ==========================================
// SUBMIT
// ==========================================

function initSubmitHandler() {
    const submitBtn = document.getElementById('submitCatalog');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

async function handleSubmit() {
    const submitBtn = document.getElementById('submitCatalog');

    try {
        const isValid = validateCurrentStep();
        if (!isValid) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const catalogData = {
            titulo: document.getElementById('titulo').value.trim(),
            descripcion: document.getElementById('descripcion').value.trim(),
            imagenPortadaFile: pendingPortadaFile,
            imagenPortadaActual: document.getElementById('portadaPreview').dataset.existingUrl || '',
            imagenPortadaPathActual: document.getElementById('portadaPreview').dataset.existingPath || ''
        };

        if (isEditMode && editingCatalogId) {
            // ============ MODO EDICIÓN ============
            await service.updateCatalog(editingCatalogId, catalogData);
            // Los productos ya se guardaron al instante

            await Swal.fire({
                icon: 'success',
                title: '¡Catálogo actualizado!',
                html: `<p><strong>${escapeHtml(catalogData.titulo)}</strong></p>
                       <p>${products.length} producto(s)</p>`,
                confirmButtonColor: '#1c1948'
            });
        } else {
            // ============ MODO CREACIÓN ============
            // 1. Crear catálogo
            const result = await service.createCatalog(catalogData);

            // 2. Crear los productos (ahora sí, con el catalogId)
            const errors = [];
            for (const p of products) {
                try {
                    await service.createProduct(result.docId, {
                        nombre: p.nombre,
                        descripcion: p.descripcion,
                        precio: p.precio,
                        imagenFile: p._pendingImageFile || null
                    });
                } catch (err) {
                    console.error('❌ Error creando producto:', p.nombre, err);
                    errors.push(p.nombre);
                }
            }

            if (errors.length > 0) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Catálogo creado con advertencias',
                    html: `<p>El catálogo se creó, pero estos productos fallaron:</p>
                           <ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`,
                    confirmButtonColor: '#1c1948'
                });
            } else {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Catálogo creado!',
                    html: `<p><strong>${escapeHtml(catalogData.titulo)}</strong></p>
                           <p>${products.length} producto(s) agregado(s)</p>`,
                    confirmButtonColor: '#1c1948'
                });
            }
        }

        // Redirigir al listado
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/partner/crudCatalogos');
        } else {
            window.location.href = '/partner/crudCatalogos';
        }

    } catch (error) {
        console.error('❌ Error en submit:', error);
        let msg = error.message || 'Error al guardar el catálogo';
        if (msg.includes('{"')) {
            try {
                const errors = JSON.parse(msg);
                msg = Object.values(errors).join('\n');
            } catch {}
        }
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: msg,
            confirmButtonColor: '#d33'
        });
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isEditMode
            ? '<i class="fas fa-save"></i> Actualizar Catálogo'
            : '<i class="fas fa-save"></i> Guardar Catálogo';
    }
}

// ==========================================
// UTILS
// ==========================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// DESTROY
// ==========================================

export function destroyCatalogController() {
    console.log('🧹 Destroying CatalogController');
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    service = null;
    editingCatalogId = null;
    isEditMode = false;
    originalCatalogData = {};
    products = [];
    pendingPortadaFile = null;
    pendingProductImageFile = null;
}

export default catalogController;