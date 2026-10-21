/* ==========================================================================
   CLIENTE CONTROLLER — Fénix RSI Enterprise
   Controlador para registrar y editar clientes con soporte de RFC genérico (SAT)
   ========================================================================== */

import ClienteService from '../../services/clienteService.js';
import { obtenerCodigoRegimen, getRegimenesForSelect } from '../../utils/regimenesSat.js';

// Constantes oficiales de RFC genérico SAT (CFDI 4.0)
const RFC_GENERICO_NACIONAL = 'XAXX010101000';
const RFC_GENERICO_EXTRANJERO = 'XEXX010101000';

let service = null;
let currentStep = 1;
const totalSteps = 3;
let eventListeners = [];
let editingDocId = null;
let isEditMode = false;
let originalData = {};
let selectedMethod = 'manual';
let pdfjsLib = null;
let currentRfcType = 'especifico'; // 'especifico' | 'nacional' | 'extranjero'

/**
 * Obtiene el formulario del DOM
 */
function getForm() {
    const form = document.getElementById('clienteForm');
    if (form && form instanceof HTMLFormElement) {
        return form;
    }
    console.error('❌ No se encontró el formulario con ID "clienteForm"');
    return null;
}

/**
 * Carga PDF.js de forma dinámica
 */
async function loadPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    
    try {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        await new Promise(resolve => {
            const checkPdf = () => {
                if (window.pdfjsLib) {
                    pdfjsLib = window.pdfjsLib;
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 
                        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve();
                } else {
                    setTimeout(checkPdf, 100);
                }
            };
            checkPdf();
        });
        
        console.log('✅ PDF.js cargado correctamente');
        return pdfjsLib;
    } catch (error) {
        console.error('❌ Error cargando PDF.js:', error);
        throw new Error('No se pudo cargar la librería PDF.js.');
    }
}

/**
 * Carga la lista de regímenes en el datalist
 */
function loadRegimenesList() {
    const datalist = document.getElementById('regimenesList');
    if (!datalist) return;
    
    const regimenes = getRegimenesForSelect('todos');
    datalist.innerHTML = regimenes.map(r => 
        `<option value="${r.nombre}">${r.codigo} - ${r.nombre}</option>`
    ).join('');
    console.log('✅ Regímenes SAT cargados:', regimenes.length);
}

/**
 * Actualiza el código del régimen cuando cambia el nombre
 */
function updateRegimenCodigo() {
    const regimenInput = document.getElementById('regimen');
    const regimenCodigoDisplay = document.getElementById('regimenCodigoDisplay');
    
    if (!regimenInput || !regimenCodigoDisplay) return;
    
    const codigo = obtenerCodigoRegimen(regimenInput.value);
    regimenCodigoDisplay.value = codigo || '';
    
    const container = document.getElementById('regimenCodigoContainer');
    if (container) {
        container.style.display = codigo ? 'block' : 'none';
    }
}

/**
 * Actualiza el estado visual del PDF
 */
function updatePdfStatus(message, type = 'info') {
    const status = document.getElementById('pdfStatus');
    if (!status) return;
    
    const icons = {
        'info': '<i class="fas fa-file-pdf"></i>',
        'success': '<i class="fas fa-check-circle"></i>',
        'error': '<i class="fas fa-exclamation-triangle"></i>',
        'loading': '<i class="fas fa-spinner fa-spin"></i>'
    };
    const icon = icons[type] || '<i class="fas fa-info-circle"></i>';
    const cleanMessage = (message || '').replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]+/, '').trim();
    status.innerHTML = `${icon} ${cleanMessage}`;
    status.className = 'rsi-pdf-status';
    
    if (type === 'success') {
        status.classList.add('success');
    } else if (type === 'error') {
        status.classList.add('error');
    } else if (type === 'loading') {
        status.classList.add('loading');
    }
}

/**
 * Actualiza el nombre del archivo en el botón
 */
function updatePdfFileName(fileName) {
    const label = document.querySelector('.rsi-pdf-file-label');
    if (!label) return;
    
    if (fileName) {
        label.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            ${fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}
        `;
        label.classList.add('has-file');
    } else {
        label.innerHTML = `
            <i class="fas fa-folder-open"></i>
            Seleccionar archivo PDF
        `;
        label.classList.remove('has-file');
    }
}

/**
 * Inicializa el drag and drop para la constancia PDF
 */
function initDragAndDrop() {
    const dropzone = document.getElementById('pdfDropzone');
    const pdfInput = document.getElementById('pdfFile');
    
    if (!dropzone || !pdfInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        eventListeners.push({ element: dropzone, event: eventName, handler: preventDefaults });
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        const handler = () => dropzone.classList.add('dragover');
        dropzone.addEventListener(eventName, handler, false);
        eventListeners.push({ element: dropzone, event: eventName, handler });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        const handler = () => dropzone.classList.remove('dragover');
        dropzone.addEventListener(eventName, handler, false);
        eventListeners.push({ element: dropzone, event: eventName, handler });
    });

    const dropHandler = (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            pdfInput.files = files;
            updatePdfFileName(files[0].name);
            updatePdfStatus(`Archivo seleccionado: ${files[0].name}`, 'info');
            pdfInput.dispatchEvent(new Event('change'));
        }
    };
    dropzone.addEventListener('drop', dropHandler, false);
    eventListeners.push({ element: dropzone, event: 'drop', handler: dropHandler });
}

/**
 * Controlador principal
 */
export async function clienteController() {
    console.log('👤 Cliente Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    const form = getForm();
    if (!form) {
        console.error('❌ No se encontró el formulario');
        return;
    }
    
    service = new ClienteService();
    currentStep = 1;
    currentRfcType = 'especifico';
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');
    
    if (docId) {
        editingDocId = docId;
        isEditMode = true;
        console.log('✏️ Modo edición - Cliente ID:', editingDocId);
    }
    
    // Cargar PDF.js en background
    try {
        await loadPdfJs();
    } catch (error) {
        console.warn('⚠️ PDF.js no disponible:', error.message);
        updatePdfStatus('PDF.js no disponible. Usa el ingreso manual.', 'error');
    }
    
    // Cargar regímenes en datalist
    loadRegimenesList();
    
    // Inicializar submódulos
    initMethodSelection();
    initRfcTypeSelection();
    initStepNavigation();
    initFieldValidation();
    initPdfUpload();
    initDragAndDrop();
    initSubmitHandler();
    initStepIndicators();
    initRegimenListener();
    
    if (isEditMode && editingDocId) {
        await loadClienteData(editingDocId);
    } else {
        setRfcType('especifico', { updateValue: false, clearGeneric: false });
        goToStep(1);
    }
    
    updateTitles();
    console.log(`✅ Cliente Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Inicializa el selector de tipo de RFC:
 * - RFC Específico
 * - Público en General (Nacional) -> XAXX010101000
 * - Extranjero -> XEXX010101000
 */
function initRfcTypeSelection() {
    const rfcInput = document.getElementById('rfc');
    const radioEspecifico = document.getElementById('tipoRfcEspecifico');
    const radioNacional = document.getElementById('tipoRfcNacional');
    const radioExtranjero = document.getElementById('tipoRfcExtranjero');

    const cardEspecifico = document.getElementById('cardRfcEspecifico');
    const cardNacional = document.getElementById('cardRfcNacional');
    const cardExtranjero = document.getElementById('cardRfcExtranjero');

    const handleTypeChange = (tipo, clearGeneric = true) => {
        setRfcType(tipo, { updateValue: true, clearGeneric });
    };

    if (radioEspecifico) {
        const handler = () => handleTypeChange('especifico', true);
        radioEspecifico.addEventListener('change', handler);
        eventListeners.push({ element: radioEspecifico, event: 'change', handler });
    }
    if (cardEspecifico) {
        const handler = () => {
            if (radioEspecifico) radioEspecifico.checked = true;
            handleTypeChange('especifico', true);
        };
        cardEspecifico.addEventListener('click', handler);
        eventListeners.push({ element: cardEspecifico, event: 'click', handler });
    }

    if (radioNacional) {
        const handler = () => handleTypeChange('nacional', false);
        radioNacional.addEventListener('change', handler);
        eventListeners.push({ element: radioNacional, event: 'change', handler });
    }
    if (cardNacional) {
        const handler = () => {
            if (radioNacional) radioNacional.checked = true;
            handleTypeChange('nacional', false);
        };
        cardNacional.addEventListener('click', handler);
        eventListeners.push({ element: cardNacional, event: 'click', handler });
    }

    if (radioExtranjero) {
        const handler = () => handleTypeChange('extranjero', false);
        radioExtranjero.addEventListener('change', handler);
        eventListeners.push({ element: radioExtranjero, event: 'change', handler });
    }
    if (cardExtranjero) {
        const handler = () => {
            if (radioExtranjero) radioExtranjero.checked = true;
            handleTypeChange('extranjero', false);
        };
        cardExtranjero.addEventListener('click', handler);
        eventListeners.push({ element: cardExtranjero, event: 'click', handler });
    }

    // Auto-formateo a mayúsculas y detección dinámica al escribir en el campo RFC
    if (rfcInput) {
        const inputHandler = () => {
            const val = rfcInput.value.toUpperCase().replace(/\s+/g, '');
            rfcInput.value = val;

            if (val === RFC_GENERICO_NACIONAL) {
                setRfcType('nacional', { updateValue: false, clearGeneric: false });
            } else if (val === RFC_GENERICO_EXTRANJERO) {
                setRfcType('extranjero', { updateValue: false, clearGeneric: false });
            } else if (currentRfcType !== 'especifico') {
                setRfcType('especifico', { updateValue: false, clearGeneric: false });
            }
        };
        rfcInput.addEventListener('input', inputHandler);
        eventListeners.push({ element: rfcInput, event: 'input', handler: inputHandler });
    }
}

/**
 * Establece el tipo de RFC activo y actualiza inputs, badges y estados
 * @param {'especifico'|'nacional'|'extranjero'} tipo
 * @param {Object} options
 */
function setRfcType(tipo, { updateValue = true, clearGeneric = true } = {}) {
    currentRfcType = tipo;

    const rfcInput = document.getElementById('rfc');
    const badge = document.getElementById('rfcTypeBadge');
    const helpText = document.getElementById('rfcHelpText');
    const regimenInput = document.getElementById('regimen');

    const cardEspecifico = document.getElementById('cardRfcEspecifico');
    const cardNacional = document.getElementById('cardRfcNacional');
    const cardExtranjero = document.getElementById('cardRfcExtranjero');

    const radioEspecifico = document.getElementById('tipoRfcEspecifico');
    const radioNacional = document.getElementById('tipoRfcNacional');
    const radioExtranjero = document.getElementById('tipoRfcExtranjero');

    // Desactivar todas las tarjetas
    [cardEspecifico, cardNacional, cardExtranjero].forEach(c => c?.classList.remove('active'));

    if (tipo === 'nacional') {
        if (radioNacional) radioNacional.checked = true;
        cardNacional?.classList.add('active');

        if (rfcInput) {
            if (updateValue) rfcInput.value = RFC_GENERICO_NACIONAL;
            rfcInput.readOnly = true;
            rfcInput.classList.add('rsi-input-readonly');
            clearFieldError(rfcInput);
        }

        if (badge) {
            badge.style.display = 'inline-flex';
            badge.className = 'rsi-rfc-status-badge nacional';
            badge.innerHTML = '<i class="fas fa-users"></i> Público General Nacional';
        }

        if (helpText) {
            helpText.textContent = 'RFC genérico SAT (XAXX010101000) para operaciones con público en general nacional sin RFC.';
        }

        // Sugerir régimen "Sin obligaciones fiscales" si está vacío
        if (regimenInput && (!regimenInput.value || regimenInput.value.trim() === '')) {
            regimenInput.value = 'Sin obligaciones fiscales';
            updateRegimenCodigo();
        }

    } else if (tipo === 'extranjero') {
        if (radioExtranjero) radioExtranjero.checked = true;
        cardExtranjero?.classList.add('active');

        if (rfcInput) {
            if (updateValue) rfcInput.value = RFC_GENERICO_EXTRANJERO;
            rfcInput.readOnly = true;
            rfcInput.classList.add('rsi-input-readonly');
            clearFieldError(rfcInput);
        }

        if (badge) {
            badge.style.display = 'inline-flex';
            badge.className = 'rsi-rfc-status-badge extranjero';
            badge.innerHTML = '<i class="fas fa-globe-americas"></i> Público Extranjero';
        }

        if (helpText) {
            helpText.textContent = 'RFC genérico SAT (XEXX010101000) para operaciones con clientes residentes en el extranjero.';
        }

        // Sugerir régimen "Sin obligaciones fiscales" si está vacío
        if (regimenInput && (!regimenInput.value || regimenInput.value.trim() === '')) {
            regimenInput.value = 'Sin obligaciones fiscales';
            updateRegimenCodigo();
        }

    } else {
        // Modo RFC Específico
        if (radioEspecifico) radioEspecifico.checked = true;
        cardEspecifico?.classList.add('active');

        if (rfcInput) {
            rfcInput.readOnly = false;
            rfcInput.classList.remove('rsi-input-readonly');
            if (clearGeneric && (rfcInput.value === RFC_GENERICO_NACIONAL || rfcInput.value === RFC_GENERICO_EXTRANJERO)) {
                rfcInput.value = '';
            }
        }

        if (badge) {
            badge.style.display = 'none';
        }

        if (helpText) {
            helpText.textContent = 'Introduce las 12 (Moral) o 13 (Física) posiciones del RFC con homoclave.';
        }
    }
}

/**
 * Inicializa el listener del campo régimen
 */
function initRegimenListener() {
    const regimenInput = document.getElementById('regimen');
    if (regimenInput) {
        regimenInput.addEventListener('change', updateRegimenCodigo);
        regimenInput.addEventListener('input', updateRegimenCodigo);
        eventListeners.push({ element: regimenInput, event: 'change', handler: updateRegimenCodigo });
        eventListeners.push({ element: regimenInput, event: 'input', handler: updateRegimenCodigo });
    }
}

/**
 * Inicializa la selección de método (Manual vs Cargar SAT PDF)
 */
function initMethodSelection() {
    const manualBtn = document.getElementById('methodManual');
    const pdfBtn = document.getElementById('methodPdf');
    const closePdfBtn = document.getElementById('btnClosePdfUploader');
    
    if (manualBtn) {
        const handler = () => selectMethod('manual');
        manualBtn.addEventListener('click', handler);
        eventListeners.push({ element: manualBtn, event: 'click', handler });
    }
    if (pdfBtn) {
        const handler = () => selectMethod('pdf');
        pdfBtn.addEventListener('click', handler);
        eventListeners.push({ element: pdfBtn, event: 'click', handler });
    }
    if (closePdfBtn) {
        const handler = () => selectMethod('manual');
        closePdfBtn.addEventListener('click', handler);
        eventListeners.push({ element: closePdfBtn, event: 'click', handler });
    }
}

/**
 * Selecciona el método de captura
 */
function selectMethod(method) {
    selectedMethod = method;
    
    const manualBtn = document.getElementById('methodManual');
    const pdfBtn = document.getElementById('methodPdf');
    const pdfUploader = document.getElementById('pdfUploader');

    if (method === 'pdf') {
        manualBtn?.classList.remove('active');
        pdfBtn?.classList.add('active');
        if (pdfUploader) {
            pdfUploader.style.display = 'block';
            pdfUploader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (!pdfjsLib) {
            updatePdfStatus('Cargando motor de lectura PDF...', 'loading');
        } else {
            updatePdfStatus('Selecciona un archivo PDF o arrástralo a la zona punteada', 'info');
        }
    } else {
        manualBtn?.classList.add('active');
        pdfBtn?.classList.remove('active');
        if (pdfUploader) {
            pdfUploader.style.display = 'none';
        }
    }
}

/**
 * Actualiza los títulos según el modo (Creación vs Edición)
 */
function updateTitles() {
    const pageTitle = document.getElementById('clientePageTitle') || document.querySelector('.rsi-page-title');
    const pageSubtitle = document.getElementById('clientePageSubtitle') || document.querySelector('.rsi-page-subtitle');
    const submitBtn = document.getElementById('submitCliente');
    
    if (isEditMode) {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Cliente`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Modifica los datos fiscales, domicilio o información de contacto del cliente.';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        }
    } else {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Registro</span> de Cliente`;
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'Completa los datos fiscales, domicilio y contacto para registrar un nuevo cliente en el sistema.';
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrar Cliente';
        }
    }
}

/**
 * Detecta si un texto corresponde a nombre completo de persona física o razón social
 */
function detectarTipoNombre(texto) {
    if (!texto) return 'razonSocial';
    
    const patronesNombre = [
        /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+( [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?$/,
        /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-Z][a-z]+ [A-Z][a-z]+$/,
        /^[A-ZÁÉÍÓÚÑ]\.? [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/
    ];
    
    const patronesRazonSocial = [
        /^[A-ZÁÉÍÓÚÑ\s]+(SA|S\.A\.|S.A.|S.A. de C.V.|SAPI|S.P.R.)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(S DE RL|S\.DE R\.L\.|S DE R L)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(C\.V\.|CV|S.C.)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(S\.A\.|S A)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(SAPI|SAPIB)/i
    ];
    
    for (const patron of patronesRazonSocial) {
        if (patron.test(texto)) return 'razonSocial';
    }
    
    for (const patron of patronesNombre) {
        if (patron.test(texto)) return 'nombreCompleto';
    }
    
    if (texto.length > 40) return 'razonSocial';
    
    const palabras = texto.trim().split(/\s+/);
    if (palabras.length >= 2 && palabras.length <= 4) {
        return 'nombreCompleto';
    }
    
    return 'razonSocial';
}

/**
 * Normaliza un nombre a formato título
 */
function normalizarNombre(texto) {
    if (!texto) return '';
    return texto.toLowerCase()
        .split(' ')
        .map(palabra => {
            const excepto = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'u', 'con', 'sin', 'por', 'para'];
            if (excepto.includes(palabra) && palabra.length <= 3) {
                return palabra;
            }
            return palabra.charAt(0).toUpperCase() + palabra.slice(1);
        })
        .join(' ');
}

/**
 * Carga los datos del cliente para edición
 */
async function loadClienteData(docId) {
    try {
        const cliente = await service.getClienteById(docId);
        if (!cliente) {
            throw new Error('Cliente no encontrado');
        }

        originalData = cliente;
        console.log('📋 Datos del cliente cargados:', cliente);

        const fields = [
            'rfc', 'razonSocial', 'nombreComercial', 'regimen',
            'codigoPostal', 'tipoVialidad', 'nombreVialidad',
            'numeroExterior', 'numeroInterior', 'colonia',
            'localidad', 'municipio', 'estado', 'entreCalle', 'yCalle',
            'telefonoMovil', 'telefonoFijo', 'email'
        ];
        
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input && cliente[field] !== undefined) {
                input.value = cliente[field] || '';
            }
        });

        // Detectar si el cliente tiene RFC genérico nacional o extranjero
        const rfcCargado = (cliente.rfc || '').trim().toUpperCase();
        if (rfcCargado === RFC_GENERICO_NACIONAL) {
            setRfcType('nacional', { updateValue: false, clearGeneric: false });
        } else if (rfcCargado === RFC_GENERICO_EXTRANJERO) {
            setRfcType('extranjero', { updateValue: false, clearGeneric: false });
        } else {
            setRfcType('especifico', { updateValue: false, clearGeneric: false });
        }

        // Actualizar código de régimen fiscal
        const regimenInput = document.getElementById('regimen');
        const regimenCodigoDisplay = document.getElementById('regimenCodigoDisplay');
        const regimenCodigoContainer = document.getElementById('regimenCodigoContainer');
        
        if (regimenInput && regimenInput.value) {
            const codigo = obtenerCodigoRegimen(regimenInput.value);
            const codigoFinal = codigo || cliente.regimenCodigo || '';
            
            if (regimenCodigoDisplay) regimenCodigoDisplay.value = codigoFinal;
            if (regimenCodigoContainer) regimenCodigoContainer.style.display = codigoFinal ? 'block' : 'none';
            
            if (codigoFinal && !codigo) {
                const regimenes = getRegimenesForSelect('todos');
                const encontrado = regimenes.find(r => r.codigo === codigoFinal);
                if (encontrado && regimenInput) {
                    regimenInput.value = encontrado.nombre;
                }
            }
        } else if (cliente.regimenCodigo) {
            const regimenes = getRegimenesForSelect('todos');
            const encontrado = regimenes.find(r => r.codigo === cliente.regimenCodigo);
            if (encontrado && regimenInput) {
                regimenInput.value = encontrado.nombre;
                if (regimenCodigoDisplay) regimenCodigoDisplay.value = cliente.regimenCodigo;
                if (regimenCodigoContainer) regimenCodigoContainer.style.display = 'block';
            }
        }

        updateTitles();
        goToStep(1);
        console.log('✅ Formulario llenado con datos del cliente');

    } catch (error) {
        console.error('❌ Error cargando cliente:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el cliente para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudClientes');
            } else {
                window.location.href = '/partner/crudClientes';
            }
        });
    }
}

/**
 * Inicializa la carga de PDF con drag and drop y extracción inteligente
 */
function initPdfUpload() {
    const pdfInput = document.getElementById('pdfFile');
    if (!pdfInput) return;
    
    const changeHandler = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        updatePdfFileName(file.name);
        updatePdfStatus('Procesando Constancia SAT en PDF...', 'loading');
        
        try {
            if (!pdfjsLib) {
                await loadPdfJs();
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let textoCompleto = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                textoCompleto += content.items.map(x => x.str).join(' ');
                textoCompleto += '\n';
            }
            
            const datos = service.extraerDatosSAT(textoCompleto);
            
            // Detectar tipo de nombre
            const tipoNombre = detectarTipoNombre(datos.razonSocial);
            if (tipoNombre === 'nombreCompleto') {
                datos.razonSocial = normalizarNombre(datos.razonSocial);
            }
            
            // Llenar el formulario con los datos extraídos
            const fields = {
                rfc: 'rfc',
                razonSocial: 'razonSocial',
                nombreComercial: 'nombreComercial',
                codigoPostal: 'codigoPostal',
                tipoVialidad: 'tipoVialidad',
                nombreVialidad: 'nombreVialidad',
                numeroExterior: 'numeroExterior',
                numeroInterior: 'numeroInterior',
                colonia: 'colonia',
                localidad: 'localidad',
                municipio: 'municipio',
                estado: 'estado',
                entreCalle: 'entreCalle',
                yCalle: 'yCalle',
                regimen: 'regimen'
            };
            
            let filledCount = 0;
            for (const [satField, formField] of Object.entries(fields)) {
                const input = document.getElementById(formField);
                if (input && datos[satField]) {
                    input.value = datos[satField];
                    clearFieldError(input);
                    filledCount++;
                }
            }

            // Sincronizar selector de RFC con el RFC extraído
            const rfcExtraido = (datos.rfc || '').trim().toUpperCase();
            if (rfcExtraido === RFC_GENERICO_NACIONAL) {
                setRfcType('nacional', { updateValue: false, clearGeneric: false });
            } else if (rfcExtraido === RFC_GENERICO_EXTRANJERO) {
                setRfcType('extranjero', { updateValue: false, clearGeneric: false });
            } else {
                setRfcType('especifico', { updateValue: false, clearGeneric: false });
            }

            // Actualizar código del régimen
            if (datos.regimen) {
                const codigo = obtenerCodigoRegimen(datos.regimen);
                const regimenCodigoDisplay = document.getElementById('regimenCodigoDisplay');
                const regimenCodigoContainer = document.getElementById('regimenCodigoContainer');
                
                if (regimenCodigoDisplay) regimenCodigoDisplay.value = codigo || '';
                if (regimenCodigoContainer) regimenCodigoContainer.style.display = codigo ? 'block' : 'none';
            }
            
            const tipoMensaje = tipoNombre === 'nombreCompleto' 
                ? ' (Persona Física)' 
                : ' (Persona Moral / Razón Social)';
            
            updatePdfStatus(`Constancia procesada: ${filledCount} campos completados ${tipoMensaje}`, 'success');
            
            // Cerrar suavemente el uploader tras procesar
            setTimeout(() => {
                selectMethod('manual');
            }, 1800);
            
            goToStep(1);
            
            Swal.fire({
                icon: 'success',
                title: 'Constancia SAT procesada',
                text: `Se han completado ${filledCount} campos automáticamente desde el PDF.`,
                timer: 3500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            
        } catch (error) {
            console.error('❌ Error procesando PDF:', error);
            updatePdfStatus('Error al procesar el PDF: ' + error.message, 'error');
            
            Swal.fire({
                icon: 'error',
                title: 'Error al leer la Constancia SAT',
                text: error.message || 'Verifica que el documento sea una Constancia de Situación Fiscal válida en formato PDF.',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1c1948'
            });
        }
    };
    
    pdfInput.addEventListener('change', changeHandler);
    eventListeners.push({ element: pdfInput, event: 'change', handler: changeHandler });
}

/**
 * Navegación por pasos
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
 * Validación reactiva de campos en blur / input
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input').forEach(input => {
        const blurHandler = () => validateField(input);
        input.addEventListener('blur', blurHandler);
        eventListeners.push({ element: input, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (input.closest('.rsi-form-group')?.classList.contains('error')) {
                validateField(input);
            }
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

/**
 * Manejo de envío del formulario
 */
function initSubmitHandler() {
    const submitBtn = document.getElementById('submitCliente');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

/**
 * Indicadores interactivos de pasos
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
 * Navega a un paso específico validando previamente los pasos anteriores
 */
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    if (step > currentStep) {
        const isValid = validateCurrentStep();
        if (!isValid) return;
    }

    currentStep = step;
    updateUI(step);

    if (step === 3) {
        updateClienteSummary();
    }
}

/**
 * Actualiza la interfaz gráfica al cambiar de paso
 */
function updateUI(step) {
    document.querySelectorAll('.rsi-step-panel').forEach(panel => {
        const panelStep = parseInt(panel.dataset.step);
        const isActive = (panelStep === step);
        panel.classList.toggle('active', isActive);
        panel.style.display = isActive ? 'block' : 'none';
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
 * Actualiza la tarjeta de resumen en el Paso 3
 */
function updateClienteSummary() {
    const getValue = (id) => (document.getElementById(id)?.value || '').trim();
    
    const rfcVal = getValue('rfc') || 'No especificado';
    const razonVal = getValue('razonSocial') || 'No especificada';
    const regimenVal = getValue('regimen') || 'No especificado';
    const regimenCodigo = obtenerCodigoRegimen(regimenVal);
    
    const cp = getValue('codigoPostal');
    const vialidad = `${getValue('tipoVialidad')} ${getValue('nombreVialidad')}`.trim();
    const numExt = getValue('numeroExterior') ? `No. ${getValue('numeroExterior')}` : '';
    const numInt = getValue('numeroInterior') ? `Int. ${getValue('numeroInterior')}` : '';
    const colonia = getValue('colonia');
    const municipio = getValue('municipio');
    const estado = getValue('estado');
    
    const domicilioCompleto = [vialidad, numExt, numInt, colonia, cp ? `C.P. ${cp}` : '', municipio, estado]
        .filter(part => part && part.length > 0)
        .join(', ') || 'No especificado';

    const summaryRfc = document.getElementById('summaryRfc');
    const summaryTipoRfc = document.getElementById('summaryTipoRfc');
    const summaryRazon = document.getElementById('summaryRazonSocial');
    const summaryRegimen = document.getElementById('summaryRegimen');
    const summaryDomicilio = document.getElementById('summaryDomicilio');

    if (summaryRfc) summaryRfc.textContent = rfcVal;
    
    if (summaryTipoRfc) {
        if (rfcVal === RFC_GENERICO_NACIONAL) {
            summaryTipoRfc.innerHTML = '<span class="rsi-badge rsi-badge-success" style="padding: 3px 9px;">Público en General (Nacional)</span>';
        } else if (rfcVal === RFC_GENERICO_EXTRANJERO) {
            summaryTipoRfc.innerHTML = '<span class="rsi-badge rsi-badge-info" style="padding: 3px 9px;">Público en General (Extranjero)</span>';
        } else {
            summaryTipoRfc.innerHTML = '<span class="rsi-badge rsi-badge-primary" style="padding: 3px 9px;">RFC Específico</span>';
        }
    }

    if (summaryRazon) summaryRazon.textContent = razonVal;
    if (summaryRegimen) summaryRegimen.textContent = regimenCodigo ? `${regimenCodigo} — ${regimenVal}` : regimenVal;
    if (summaryDomicilio) summaryDomicilio.textContent = domicilioCompleto;
}

/**
 * Valida el panel de formulario del paso actual
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
 * Valida un campo individual con reglas fiscales
 */
function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    
    if (isRequired && !value) {
        showFieldError(input, 'Este campo es obligatorio');
        return false;
    }

    // Regla de validación de RFC:
    // Los RFCs genéricos del SAT siempre son válidos (13 caracteres)
    const isGeneric = (value === RFC_GENERICO_NACIONAL || value === RFC_GENERICO_EXTRANJERO);

    const validations = {
        rfc: { 
            test: (v) => isGeneric || v.length >= 12, 
            msg: 'RFC inválido (mínimo 12 posiciones con homoclave)' 
        },
        codigoPostal: { 
            test: (v) => v.length === 0 || v.length === 5, 
            msg: 'Código postal inválido (debe tener exactamente 5 dígitos)' 
        },
        telefonoMovil: { 
            test: (v) => v.length === 0 || v.length >= 10, 
            msg: 'Teléfono móvil inválido (mínimo 10 dígitos)' 
        },
        email: { 
            test: (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 
            msg: 'Correo electrónico con formato inválido' 
        }
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
 * Muestra mensaje de error en un campo
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
 * Limpia el estado de error de un campo
 */
function clearFieldError(input) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.remove('error');
    const errorMsg = group.querySelector('.rsi-form-error-message');
    if (errorMsg) {
        errorMsg.textContent = '';
    }
}

/**
 * Prepara el paquete de datos del cliente para persistencia
 */
function prepareData() {
    const getValue = (id) => (document.getElementById(id)?.value || '').trim();
    const regimen = getValue('regimen');
    const regimenCodigo = obtenerCodigoRegimen(regimen);
    const rfcUpper = getValue('rfc').toUpperCase();
    
    return {
        rfc: rfcUpper,
        tipoRfc: (rfcUpper === RFC_GENERICO_NACIONAL) ? 'nacional' : (rfcUpper === RFC_GENERICO_EXTRANJERO) ? 'extranjero' : 'especifico',
        esGenerico: (rfcUpper === RFC_GENERICO_NACIONAL || rfcUpper === RFC_GENERICO_EXTRANJERO),
        razonSocial: getValue('razonSocial'),
        nombreComercial: getValue('nombreComercial'),
        regimen: regimen,
        regimenCodigo: regimenCodigo || '',
        codigoPostal: getValue('codigoPostal'),
        tipoVialidad: getValue('tipoVialidad'),
        nombreVialidad: getValue('nombreVialidad'),
        numeroExterior: getValue('numeroExterior'),
        numeroInterior: getValue('numeroInterior'),
        colonia: getValue('colonia'),
        localidad: getValue('localidad'),
        municipio: getValue('municipio'),
        estado: getValue('estado'),
        entreCalle: getValue('entreCalle'),
        yCalle: getValue('yCalle'),
        telefonoMovil: getValue('telefonoMovil'),
        telefonoFijo: getValue('telefonoFijo'),
        email: getValue('email')
    };
}

/**
 * Maneja el guardado o actualización del cliente con auditoría
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitCliente');
    
    try {
        const isValid = validateCurrentStep();
        if (!isValid) return;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        const data = prepareData();
        let result;

        if (isEditMode && editingDocId) {
            result = await service.updateCliente(editingDocId, data);
        } else {
            result = await service.createCliente(data);
        }

        if (!result.success) {
            throw new Error(result.message);
        }

        const successMessage = isEditMode ? '¡Cliente actualizado exitosamente!' : '¡Cliente registrado exitosamente!';

        Swal.fire({
            icon: 'success',
            title: successMessage,
            html: `
                <div style="text-align: left; font-size: 0.95rem; line-height: 1.6;">
                    <p><strong>Razón Social / Nombre:</strong> ${data.razonSocial}</p>
                    <p><strong>RFC:</strong> ${data.rfc} ${data.esGenerico ? '<span class="rsi-badge rsi-badge-success">Público en General</span>' : ''}</p>
                    <p><strong>Régimen:</strong> ${data.regimen}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    ${isEditMode ? `<p style="font-size: 0.85rem; color: var(--rsi-text-muted); margin-top: 10px;">
                        <i class="fas fa-user-edit"></i> Modificado por: ${service._getCurrentUserName?.() || 'Usuario actual'}
                    </p>` : ''}
                </div>
            `,
            confirmButtonText: 'Ir a Clientes',
            confirmButtonColor: '#1c1948'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudClientes');
            } else {
                window.location.href = '/partner/crudClientes';
            }
        });

    } catch (error) {
        console.error('❌ Error en submit de cliente:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el cliente';
        if (errorMessage.includes('{"')) {
            try {
                const errors = JSON.parse(errorMessage);
                errorMessage = Object.values(errors).join('\n');
            } catch {
                // mantener original
            }
        }

        Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar el cliente',
            text: errorMessage,
            confirmButtonText: 'Revisar datos',
            confirmButtonColor: '#d33'
        });

    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isEditMode 
                ? '<i class="fas fa-save"></i> Guardar Cambios'
                : '<i class="fas fa-user-plus"></i> Registrar Cliente';
        }
    }
}

/**
 * Limpia eventos y libera memoria al salir de la vista
 */
export function destroyClienteController() {
    console.log('🧹 Destruyendo ClienteController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        if (element && typeof element.removeEventListener === 'function') {
            element.removeEventListener(event, handler);
        }
    });
    eventListeners = [];
    
    service = null;
    editingDocId = null;
    isEditMode = false;
    originalData = {};
    selectedMethod = 'manual';
    pdfjsLib = null;
    currentRfcType = 'especifico';
}

export default clienteController;
