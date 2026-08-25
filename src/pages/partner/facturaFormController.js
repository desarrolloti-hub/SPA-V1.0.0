/* ========================================
   FACTURA FORM CONTROLLER
   Controlador para crear/editar una factura
   ======================================== */

import FacturaService from '../../services/facturaService.js';
import CotizacionService from '../../services/cotizacionService.js';
import ClienteService from '../../services/clienteService.js';
import FacturaModel from '../../models/facturaModel.js';
import { generarPDFFactura } from '../../utils/pdfGenerator.js';

let facturaService = null;
let cotizacionService = null;
let clienteService = null;
let eventListeners = [];
let editingId = null;
let isEditMode = false;
let currentStep = 1;
const totalSteps = 3;
let isNavigating = false;
let cotizacionData = null;
let facturaData = {};
let currentUser = null;
let cotizacionId = null;

// Logo para PDF
const LOGO_URL = '/assets/icons/logo.png';

/**
 * Función helper para asignar valor a un elemento del DOM de forma segura
 */
function setFieldValue(fieldId, value) {
    const el = document.getElementById(fieldId);
    if (el) {
        el.value = value || '';
        return el;
    }
    return null;
}

/**
 * Función helper para obtener el valor de un campo de forma segura
 */
function getFieldValue(fieldId) {
    const el = document.getElementById(fieldId);
    return el ? (el.value || '') : '';
}

/**
 * Inicializa el controlador del formulario
 */
export async function facturaFormController() {
    console.log('📄 Factura Form Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    // Inicializar servicios
    facturaService = new FacturaService();
    cotizacionService = new CotizacionService();
    clienteService = new ClienteService();
    
    eventListeners = [];
    editingId = null;
    isEditMode = false;
    currentStep = 1;
    isNavigating = false;
    cotizacionData = null;
    facturaData = {};
    currentUser = null;
    cotizacionId = null;
    
    // Cargar usuario actual
    await loadCurrentUser();
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const cotId = urlParams.get('cotizacionId');
    
    if (id) {
        editingId = id;
        isEditMode = true;
        console.log('✏️ Modo edición - Factura ID:', editingId);
        await loadFacturaData(editingId);
    } else if (cotId) {
        cotizacionId = cotId;
        console.log('📄 Nueva factura desde cotización:', cotizacionId);
        await loadCotizacionData(cotizacionId);
    }
    
    // Inicializar eventos
    initStepNavigation();
    initFieldValidation();
    initSubmitHandlers();
    initCancelButton();
    initUsoCFDI();
    
    // Ir al paso 1
    goToStep(1);
    
    console.log(`✅ Factura Form Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Carga el usuario actual desde localStorage
 */
async function loadCurrentUser() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (!session) {
            throw new Error('No hay sesión activa');
        }
        const sessionData = JSON.parse(session);
        currentUser = {
            uid: sessionData.uid || '',
            email: sessionData.email || '',
            nombre: sessionData.nombreCompleto || sessionData.displayName || 'Usuario'
        };
        console.log('✅ Usuario cargado:', currentUser);
    } catch (error) {
        console.error('❌ Error cargando usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Acceso no autorizado',
            text: 'Debes iniciar sesión para acceder a esta función',
            confirmButtonText: 'Iniciar sesión',
            confirmButtonColor: '#d33'
        }).then(() => {
            window.location.href = '../nav-visitantes/inicio-de-sesion.html';
        });
    }
}

/**
 * Carga los datos de la cotización para crear la factura
 */
async function loadCotizacionData(cotId) {
    try {
        mostrarLoading(true);
        
        const cotizacion = await cotizacionService.getCotizacionById(cotId);
        if (!cotizacion) {
            throw new Error('Cotización no encontrada');
        }
        
        cotizacionData = cotizacion;
        facturaData = FacturaModel.fromCotizacion(cotizacion, generateFacturaNumero());
        
        // Llenar campos del cliente
        setFieldValue('clienteNombre', facturaData.clienteNombre);
        setFieldValue('clienteRFC', facturaData.clienteRFC);
        setFieldValue('clienteRazonSocial', facturaData.clienteRazonSocial);
        setFieldValue('clienteRegimenCodigo', facturaData.clienteRegimenCodigo);
        setFieldValue('clienteCodigoPostal', facturaData.clienteCodigoPostal);
        setFieldValue('clienteDireccion', facturaData.clienteDireccion);
        setFieldValue('clienteEmail', facturaData.clienteEmail);
        setFieldValue('clienteTelefono', facturaData.clienteTelefono);
        
        // Llenar datos de la factura
        setFieldValue('facturaNumero', facturaData.facturaNumero);
        setFieldValue('facturaFecha', facturaData.facturaFecha);
        setFieldValue('cotizacionNumero', facturaData.cotizacionNumero);
        setFieldValue('facturaDescripcion', facturaData.facturaDescripcion);
        
        // CFDI
        setFieldValue('usoCFDI', facturaData.usoCFDI || 'G01');
        setFieldValue('formaPago', facturaData.formaPago || '01');
        setFieldValue('metodoPago', facturaData.metodoPago || 'PUE');
        
        // Calcular y mostrar totales
        calcularTotales();
        
        // Items
        renderItemsTable(facturaData.items);
        
        console.log('✅ Datos de cotización cargados para factura');
        
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cargando cotización:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la cotización: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/commercial/cotizaciones');
            } else {
                window.location.href = '/commercial/cotizaciones';
            }
        });
    }
}

/**
 * Carga los datos de la factura para edición
 */
async function loadFacturaData(id) {
    try {
        mostrarLoading(true);
        
        const factura = await facturaService.getFacturaById(id);
        if (!factura) {
            throw new Error('Factura no encontrada');
        }
        
        facturaData = factura;
        cotizacionData = factura;
        
        // Llenar campos del cliente
        setFieldValue('clienteNombre', factura.clienteNombre);
        setFieldValue('clienteRFC', factura.clienteRFC);
        setFieldValue('clienteRazonSocial', factura.clienteRazonSocial);
        setFieldValue('clienteRegimenCodigo', factura.clienteRegimenCodigo);
        setFieldValue('clienteCodigoPostal', factura.clienteCodigoPostal);
        setFieldValue('clienteDireccion', factura.clienteDireccion);
        setFieldValue('clienteEmail', factura.clienteEmail);
        setFieldValue('clienteTelefono', factura.clienteTelefono);
        
        // Llenar datos de la factura
        setFieldValue('facturaNumero', factura.facturaNumero);
        setFieldValue('facturaFecha', factura.facturaFecha);
        setFieldValue('cotizacionNumero', factura.cotizacionNumero);
        setFieldValue('facturaDescripcion', factura.facturaDescripcion);
        
        // CFDI
        setFieldValue('usoCFDI', factura.usoCFDI || 'G01');
        setFieldValue('formaPago', factura.formaPago || '01');
        setFieldValue('metodoPago', factura.metodoPago || 'PUE');
        
        // Calcular y mostrar totales
        calcularTotales();
        
        // Items
        renderItemsTable(factura.items);
        
        // Mostrar estatus
        const estatusBadge = document.getElementById('estatusBadge');
        if (estatusBadge) {
            const estatusMap = {
                'borrador': { class: 'borrador', label: 'Borrador' },
                'pendiente': { class: 'pendiente', label: 'Pendiente' },
                'timbrada': { class: 'timbrada', label: 'Timbrada' },
                'cancelada': { class: 'cancelada', label: 'Cancelada' }
            };
            const info = estatusMap[factura.estatus] || estatusMap['borrador'];
            estatusBadge.textContent = info.label;
            estatusBadge.className = `rsi-badge-status ${info.class}`;
            document.getElementById('estatusContainer').style.display = 'block';
        }
        
        // Si está timbrada, mostrar información del timbrado y links a PDF/XML
        if (factura.estatus === 'timbrada') {
            // Mostrar información del timbrado
            if (factura.timbrado) {
                document.getElementById('timbradoInfo').style.display = 'block';
                document.getElementById('timbradoUUID').textContent = factura.timbrado.uuid || '-';
                document.getElementById('timbradoFecha').textContent = factura.timbrado.fechaTimbrado || '-';
                document.getElementById('timbradoNoCertificado').textContent = factura.timbrado.noCertificado || '-';
            }
            
            // Mostrar botones de descarga si hay URLs
            if (factura.pdfUrl || factura.xmlUrl) {
                const descargaContainer = document.getElementById('descargaArchivos');
                if (descargaContainer) {
                    descargaContainer.style.display = 'block';
                    
                    if (factura.pdfUrl) {
                        document.getElementById('btnDescargarPDF').href = factura.pdfUrl;
                        document.getElementById('btnDescargarPDF').style.display = 'inline-block';
                    }
                    
                    if (factura.xmlUrl) {
                        document.getElementById('btnDescargarXML').href = factura.xmlUrl;
                        document.getElementById('btnDescargarXML').style.display = 'inline-block';
                    }
                }
            }
        }
        
        console.log('✅ Datos de factura cargados:', factura.facturaNumero);
        
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cargando factura:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la factura: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/commercial/facturas');
            } else {
                window.location.href = '/commercial/facturas';
            }
        });
    }
}

/**
 * Genera un número de factura
 */
function generateFacturaNumero() {
    const fecha = new Date();
    const fechaStr = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `FAC-${fechaStr}-${random}`;
}

/**
 * CALCULAR TOTALES
 */
function calcularTotales() {
    const items = facturaData.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 16;
    const impuestoMonto = subtotal * (impuestoPorcentaje / 100);
    const totalFinal = subtotal + impuestoMonto;
    
    facturaData.subtotal = subtotal;
    facturaData.impuesto = impuestoPorcentaje.toString();
    facturaData.impuestoMonto = impuestoMonto;
    facturaData.totalFinal = totalFinal;
    
    const subtotalEl = document.getElementById('subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    
    const totalEl = document.getElementById('totalFinal');
    if (totalEl) totalEl.textContent = formatCurrency(totalFinal);
    
    if (currentStep === 3) {
        updateConfirmacion();
    }
}

/**
 * Renderiza la tabla de items
 */
function renderItemsTable(items) {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    
    if (!items || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: var(--rsi-spacing-lg); color: var(--rsi-gray-500);">
                    <i class="fas fa-plus-circle" style="font-size: 1.5rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                    No hay items en esta factura
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    items.forEach((item, index) => {
        html += `
            <tr>
                <td data-label="#">${index + 1}</td>
                <td data-label="Descripción">${item.descripcion || '-'}</td>
                <td data-label="Cantidad">${item.cantidad || 0}</td>
                <td data-label="Precio Unit.">${formatCurrency(item.precioUnitario || 0)}</td>
                <td data-label="Categoría">${item.categoriaNombre || '-'}</td>
                <td data-label="Total">${formatCurrency(item.total || 0)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    calcularTotales();
}

/**
 * ACTUALIZAR CONFIRMACIÓN
 */
function updateConfirmacion() {
    const items = facturaData.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 16;
    const impuestoMonto = subtotal * (impuestoPorcentaje / 100);
    const totalFinal = subtotal + impuestoMonto;
    
    setText('confirmClienteRazonSocial', getFieldValue('clienteRazonSocial') || '-');
    setText('confirmClienteRFC', getFieldValue('clienteRFC') || '-');
    setText('confirmClienteRegimen', getFieldValue('clienteRegimenCodigo') || '-');
    setText('confirmClienteCP', getFieldValue('clienteCodigoPostal') || '-');
    
    setText('confirmFacturaNumero', getFieldValue('facturaNumero') || '-');
    setText('confirmCotizacionNumero', getFieldValue('cotizacionNumero') || '-');
    setText('confirmUsoCFDI', getFieldValue('usoCFDI') || '-');
    setText('confirmFormaPago', getFieldValue('formaPago') || '-');
    setText('confirmMetodoPago', getFieldValue('metodoPago') || '-');
    setText('confirmFacturaFecha', getFieldValue('facturaFecha') || '-');
    
    const itemsContainer = document.getElementById('confirmItemsList');
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<p style="color: var(--rsi-gray-500);">No hay items</p>';
        } else {
            let itemsHtml = '';
            items.forEach(item => {
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                        <span>${item.descripcion || 'Sin descripción'}</span>
                        <span>${item.cantidad || 0} x ${formatCurrency(item.precioUnitario || 0)} = ${formatCurrency(item.total || 0)}</span>
                    </div>
                `;
            });
            itemsContainer.innerHTML = itemsHtml;
        }
    }
    
    setText('confirmSubtotal', formatCurrency(subtotal));
    setText('confirmIVA', `${impuestoPorcentaje}%`);
    setText('confirmTotal', formatCurrency(totalFinal));
}

/**
 * Helper para setear texto
 */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '-';
}

/**
 * Inicializa la navegación por pasos
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

    if (!isValid) return false;

    if (currentStep === 1) {
        const clienteRFC = getFieldValue('clienteRFC');
        const clienteRazonSocial = getFieldValue('clienteRazonSocial');
        const usoCFDI = getFieldValue('usoCFDI');
        const formaPago = getFieldValue('formaPago');
        const metodoPago = getFieldValue('metodoPago');
        
        if (!clienteRFC || clienteRFC.length < 12) {
            mostrarAlerta('El RFC del cliente es requerido (mínimo 12 caracteres)', 'error');
            return false;
        }
        if (!clienteRazonSocial) {
            mostrarAlerta('La razón social del cliente es requerida', 'error');
            return false;
        }
        if (!usoCFDI) {
            mostrarAlerta('El uso de CFDI es requerido', 'error');
            return false;
        }
        if (!formaPago) {
            mostrarAlerta('La forma de pago es requerida', 'error');
            return false;
        }
        if (!metodoPago) {
            mostrarAlerta('El método de pago es requerido', 'error');
            return false;
        }
    }

    return true;
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

    const form = document.getElementById('facturaForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Inicializa la validación de campos
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input[required], .rsi-form-group select[required]').forEach(input => {
        const blurHandler = () => validateField(input);
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
    if (!input) return true;
    const value = input.value?.trim() || '';
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
    
    input.classList.remove('error');
    if (errorEl) errorEl.textContent = '';
    return true;
}

/**
 * Inicializa los handlers de submit
 */
function initSubmitHandlers() {
    const guardarBorradorBtn = document.getElementById('guardarBorradorBtn');
    if (guardarBorradorBtn) {
        guardarBorradorBtn.addEventListener('click', () => handleSubmit(false));
        eventListeners.push({ element: guardarBorradorBtn, event: 'click', handler: () => handleSubmit(false) });
    }
    
    const guardarTimbrarBtn = document.getElementById('guardarTimbrarBtn');
    if (guardarTimbrarBtn) {
        guardarTimbrarBtn.addEventListener('click', () => handleSubmit(true));
        eventListeners.push({ element: guardarTimbrarBtn, event: 'click', handler: () => handleSubmit(true) });
    }
}

/**
 * Inicializa el botón de cancelar
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
                    window.navigateTo('/commercial/facturas');
                } else {
                    window.location.href = '/commercial/facturas';
                }
            }
        });
    };
    
    cancelBtn.addEventListener('click', handler);
    eventListeners.push({ element: cancelBtn, event: 'click', handler });
}

/**
 * Inicializa la lista de usos CFDI
 */
function initUsoCFDI() {
    const select = document.getElementById('usoCFDI');
    if (!select) return;
    
    const usosCFDI = [
        { value: 'G01', label: 'Adquisición de mercancías' },
        { value: 'G02', label: 'Devoluciones, descuentos o bonificaciones' },
        { value: 'G03', label: 'Gastos en general' },
        { value: 'I01', label: 'Construcciones' },
        { value: 'I02', label: 'Mobiliario y equipo de oficina' },
        { value: 'I03', label: 'Equipo de transporte' },
        { value: 'I04', label: 'Equipo de cómputo' },
        { value: 'I05', label: 'Dados, troqueles, moldes, matrices y herramental' },
        { value: 'I06', label: 'Comunicaciones telefónicas' },
        { value: 'I07', label: 'Comunicaciones satelitales' },
        { value: 'I08', label: 'Otra maquinaria y equipo' },
        { value: 'D01', label: 'Honorarios médicos, dentales y gastos hospitalarios' },
        { value: 'D02', label: 'Gastos médicos por incapacidad' },
        { value: 'D03', label: 'Gastos funerales' },
        { value: 'D04', label: 'Donativos' },
        { value: 'D05', label: 'Intereses reales' },
        { value: 'D06', label: 'Aportaciones voluntarias' },
        { value: 'D07', label: 'Primas por seguros de gastos médicos' },
        { value: 'D08', label: 'Gastos de transportación escolar' },
        { value: 'D09', label: 'Depósitos en cuentas para el ahorro' },
        { value: 'D10', label: 'Pagos por servicios educativos' },
        { value: 'P01', label: 'Por definir' }
    ];
    
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    usosCFDI.forEach(uso => {
        const option = document.createElement('option');
        option.value = uso.value;
        option.textContent = uso.label;
        select.appendChild(option);
    });
}

/**
 * Maneja el envío del formulario y el timbrado
 */
async function handleSubmit(timbrar = false) {
    const submitBtn = timbrar ? document.getElementById('guardarTimbrarBtn') : document.getElementById('guardarBorradorBtn');
    
    try {
        if (!validateCurrentStep()) {
            return;
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }
        
        // Obtener datos del cliente
        const clienteNombre = getFieldValue('clienteNombre');
        const clienteRFC = getFieldValue('clienteRFC');
        const clienteRazonSocial = getFieldValue('clienteRazonSocial');
        const clienteRegimenCodigo = getFieldValue('clienteRegimenCodigo');
        const clienteCodigoPostal = getFieldValue('clienteCodigoPostal');
        const clienteDireccion = getFieldValue('clienteDireccion');
        const clienteEmail = getFieldValue('clienteEmail');
        const clienteTelefono = getFieldValue('clienteTelefono');
        
        // Obtener datos de CFDI
        const usoCFDI = getFieldValue('usoCFDI');
        const formaPago = getFieldValue('formaPago');
        const metodoPago = getFieldValue('metodoPago');
        
        // Obtener datos de la factura
        const facturaNumero = getFieldValue('facturaNumero') || generateFacturaNumero();
        const facturaFecha = getFieldValue('facturaFecha') || new Date().toISOString().split('T')[0];
        const facturaDescripcion = getFieldValue('facturaDescripcion');
        
        // Items y totales
        const items = facturaData.items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const impuesto = parseFloat(getFieldValue('impuesto')) || 16;
        const impuestoMonto = subtotal * (impuesto / 100);
        const totalFinal = subtotal + impuestoMonto;
        
        const facturaDataToSave = {
            clienteNombre,
            clienteRFC,
            clienteRazonSocial,
            clienteRegimenCodigo,
            clienteCodigoPostal,
            clienteDireccion,
            clienteEmail,
            clienteTelefono,
            cotizacionId: cotizacionData?.id || '',
            cotizacionNumero: cotizacionData?.cotizacionNumero || '',
            facturaNumero,
            facturaFecha,
            facturaDescripcion,
            usoCFDI,
            formaPago,
            metodoPago,
            empresaCodigoPostal: '57200',
            items: items.map(item => ({
                ...item,
                precioUnitario: item.precioUnitario || item.precio || 0,
                total: (item.cantidad || 1) * (item.precioUnitario || item.precio || 0)
            })),
            subtotal,
            impuesto: impuesto.toString(),
            impuestoMonto,
            totalFinal,
            estatus: timbrar ? 'pendiente' : 'borrador',
            cfdiData: {
                Receiver: {
                    Name: clienteRazonSocial || clienteNombre,
                    CfdiUse: usoCFDI || 'G03',
                    Rfc: clienteRFC,
                    FiscalRegime: clienteRegimenCodigo || '621',
                    TaxZipCode: clienteCodigoPostal || '00000'
                },
                CfdiType: 'I',
                NameId: '1',
                ExpeditionPlace: '57200',
                Serie: null,
                Folio: facturaNumero,
                PaymentForm: formaPago || '01',
                PaymentMethod: metodoPago || 'PUE',
                Exportation: '01'
            }
        };
        
        let result;
        
        if (isEditMode && editingId) {
            result = await facturaService.updateFactura(editingId, facturaDataToSave);
        } else {
            result = await facturaService.createFactura(facturaDataToSave);
        }
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        const facturaId = result.id || editingId;
        
        // Si hay que timbrar
        if (timbrar) {
            try {
                // Llamar al servicio para timbrar
                const timbradoResult = await facturaService.timbrarFactura(facturaId);
                
                if (timbradoResult.success) {
                    console.log('✅ Factura timbrada exitosamente');
                    console.log('📄 PDF URL:', timbradoResult.pdfUrl);
                    console.log('📄 XML URL:', timbradoResult.xmlUrl);
                    
                    // Guardar URLs en localStorage para acceso rápido
                    if (timbradoResult.pdfUrl) {
                        localStorage.setItem(`factura_pdf_${facturaId}`, timbradoResult.pdfUrl);
                    }
                    if (timbradoResult.xmlUrl) {
                        localStorage.setItem(`factura_xml_${facturaId}`, timbradoResult.xmlUrl);
                    }
                    
                    // Construir mensaje con enlaces a los archivos
                    let archivosHtml = '';
                    if (timbradoResult.pdfUrl) {
                        archivosHtml += `
                            <p style="margin: 5px 0;">
                                <strong>PDF:</strong> 
                                <a href="${timbradoResult.pdfUrl}" target="_blank" style="color: #1c1948; text-decoration: underline;">
                                    Descargar PDF
                                </a>
                            </p>
                        `;
                    }
                    if (timbradoResult.xmlUrl) {
                        archivosHtml += `
                            <p style="margin: 5px 0;">
                                <strong>XML:</strong> 
                                <a href="${timbradoResult.xmlUrl}" target="_blank" style="color: #1c1948; text-decoration: underline;">
                                    Descargar XML
                                </a>
                            </p>
                        `;
                    }
                    
                    Swal.fire({
                        icon: 'success',
                        title: '✅ Factura timbrada exitosamente',
                        html: `
                            <div style="text-align: left;">
                                <p><strong>Factura:</strong> ${facturaNumero}</p>
                                <p><strong>UUID:</strong> ${timbradoResult.timbrado?.uuid || 'N/A'}</p>
                                <p><strong>Fecha de timbrado:</strong> ${timbradoResult.timbrado?.fechaTimbrado || 'N/A'}</p>
                                ${archivosHtml ? `<hr style="margin: 10px 0;"><div style="margin-top: 10px;">${archivosHtml}</div>` : ''}
                                <p style="margin-top: 10px; color: var(--rsi-success); font-size: 0.9em;">
                                    ✅ Los archivos PDF y XML han sido guardados en el sistema
                                </p>
                            </div>
                        `,
                        confirmButtonText: 'Ver factura',
                        confirmButtonColor: '#1c1948',
                        showCancelButton: true,
                        cancelButtonText: 'Ir al listado',
                        cancelButtonColor: '#6c757d'
                    }).then((res) => {
                        if (res.isConfirmed) {
                            if (typeof window.navigateTo === 'function') {
                                window.navigateTo(`/commercial/factura/ver?id=${facturaId}`);
                            } else {
                                window.location.href = `/commercial/factura/ver?id=${facturaId}`;
                            }
                        } else {
                            if (typeof window.navigateTo === 'function') {
                                window.navigateTo('/commercial/facturas');
                            } else {
                                window.location.href = '/commercial/facturas';
                            }
                        }
                    });
                    return;
                } else {
                    throw new Error(timbradoResult.message || 'Error al timbrar');
                }
                
            } catch (timbradoError) {
                console.error('❌ Error timbrando:', timbradoError);
                
                Swal.fire({
                    icon: 'warning',
                    title: '⚠️ Factura guardada pero no timbrada',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Factura:</strong> ${facturaNumero}</p>
                            <p>La factura se guardó como borrador pero hubo un error al timbrar.</p>
                            <p style="color: var(--rsi-danger);">Error: ${timbradoError.message}</p>
                        </div>
                    `,
                    confirmButtonText: 'Intentar de nuevo',
                    cancelButtonText: 'Ir al listado',
                    showCancelButton: true,
                    confirmButtonColor: '#1c1948',
                    cancelButtonColor: '#6c757d'
                }).then((res) => {
                    if (res.isConfirmed) {
                        handleSubmit(true);
                    } else {
                        if (typeof window.navigateTo === 'function') {
                            window.navigateTo('/commercial/facturas');
                        } else {
                            window.location.href = '/commercial/facturas';
                        }
                    }
                });
                return;
            }
        }
        
        // Si solo guardó borrador
        Swal.fire({
            icon: 'success',
            title: '✅ Factura guardada como borrador',
            text: `La factura ${facturaNumero} ha sido guardada exitosamente.`,
            confirmButtonText: 'Ver factura',
            cancelButtonText: 'Ir al listado',
            showCancelButton: true,
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d'
        }).then((res) => {
            if (res.isConfirmed) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(`/commercial/factura/editar?id=${facturaId}`);
                } else {
                    window.location.href = `/commercial/factura/editar?id=${facturaId}`;
                }
            } else {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/commercial/facturas');
                } else {
                    window.location.href = '/commercial/facturas';
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar la factura';
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
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = timbrar ? 
                '<i class="fas fa-file-invoice"></i> Guardar y Timbrar' : 
                '<i class="fas fa-save"></i> Guardar Borrador';
        }
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
export function destroyFacturaFormController() {
    console.log('🧹 Destroying FacturaFormController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    facturaService = null;
    cotizacionService = null;
    clienteService = null;
    editingId = null;
    isEditMode = false;
    cotizacionData = null;
    facturaData = {};
    currentUser = null;
    cotizacionId = null;
}

export default facturaFormController;