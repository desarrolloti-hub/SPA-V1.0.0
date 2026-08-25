/* ========================================
   CLIENTE CONTROLLER
   Controlador para crear y editar clientes
   ======================================== */

import ClienteService from '../../services/clienteService.js';
import { obtenerCodigoRegimen, getRegimenesForSelect } from '../../utils/regimenesSAT.js';

let service = null;
let currentStep = 1;
const totalSteps = 3;
let eventListeners = [];
let editingDocId = null;
let isEditMode = false;
let originalData = {};
let selectedMethod = null;
let pdfjsLib = null;

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
    console.log('✅ Regímenes cargados:', regimenes.length);
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
 * ✅ Actualiza el estado del PDF
 */
function updatePdfStatus(message, type = 'info') {
    const status = document.getElementById('pdfStatus');
    if (!status) return;
    
    status.textContent = message;
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
 * ✅ Actualiza el nombre del archivo en el botón
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
            Seleccionar archivo
        `;
        label.classList.remove('has-file');
    }
}

/**
 * ✅ Inicializa el drag and drop
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
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('dragover');
        }, false);
        eventListeners.push({ element: dropzone, event: eventName, handler: () => dropzone.classList.add('dragover') });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        }, false);
        eventListeners.push({ element: dropzone, event: eventName, handler: () => dropzone.classList.remove('dragover') });
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            pdfInput.files = files;
            updatePdfFileName(files[0].name);
            updatePdfStatus(`📄 Archivo seleccionado: ${files[0].name}`, 'info');
            pdfInput.dispatchEvent(new Event('change'));
        }
    }, false);
    eventListeners.push({ element: dropzone, event: 'drop', handler: (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            pdfInput.files = files;
            updatePdfFileName(files[0].name);
            updatePdfStatus(`📄 Archivo seleccionado: ${files[0].name}`, 'info');
            pdfInput.dispatchEvent(new Event('change'));
        }
    }});
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
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');
    
    if (docId) {
        editingDocId = docId;
        isEditMode = true;
        console.log('✏️ Modo edición - Cliente ID:', editingDocId);
    }
    
    // Cargar PDF.js
    try {
        await loadPdfJs();
    } catch (error) {
        console.warn('⚠️ PDF.js no disponible:', error.message);
        updatePdfStatus('⚠️ PDF.js no disponible. Usa el ingreso manual.', 'error');
    }
    
    // Cargar regímenes
    loadRegimenesList();
    
    initMethodSelection();
    initStepNavigation();
    initFieldValidation();
    initPdfUpload();
    initDragAndDrop();
    initSubmitHandler();
    initStepIndicators();
    initRegimenListener();
    
    if (isEditMode && editingDocId) {
        await loadClienteData(editingDocId);
        // En modo edición, ocultar la selección de método
        const methodSelection = document.querySelector('.rsi-method-selection');
        if (methodSelection) methodSelection.style.display = 'none';
        
        const firstPanel = document.querySelector('.rsi-step-panel[data-step="1"]');
        if (firstPanel) {
            firstPanel.style.display = 'block';
            firstPanel.classList.add('active');
        }
        
        const indicator = document.querySelector('.rsi-steps-indicator');
        if (indicator) indicator.style.display = 'flex';
        
        updateTitles();
        goToStep(1);
    } else {
        // En modo creación, mostrar selección de método
        showMethodSelection();
    }
    
    console.log(`✅ Cliente Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
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
 * Inicializa la selección de método
 */
function initMethodSelection() {
    const manualBtn = document.getElementById('methodManual');
    const pdfBtn = document.getElementById('methodPdf');
    
    if (manualBtn) {
        manualBtn.addEventListener('click', () => selectMethod('manual'));
        eventListeners.push({ element: manualBtn, event: 'click', handler: () => selectMethod('manual') });
    }
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => selectMethod('pdf'));
        eventListeners.push({ element: pdfBtn, event: 'click', handler: () => selectMethod('pdf') });
    }
}

/**
 * Selecciona el método de ingreso
 */
function selectMethod(method) {
    selectedMethod = method;
    
    // Ocultar selección
    const methodSelection = document.querySelector('.rsi-method-selection');
    if (methodSelection) methodSelection.style.display = 'none';
    
    // Mostrar el formulario
    const firstPanel = document.querySelector('.rsi-step-panel[data-step="1"]');
    if (firstPanel) {
        firstPanel.style.display = 'block';
        firstPanel.classList.add('active');
    }
    
    const indicator = document.querySelector('.rsi-steps-indicator');
    if (indicator) indicator.style.display = 'flex';
    
    // Si es PDF, mostrar el uploader
    const pdfUploader = document.getElementById('pdfUploader');
    if (pdfUploader) {
        pdfUploader.style.display = method === 'pdf' ? 'block' : 'none';
    }
    
    if (method === 'pdf') {
        if (!pdfjsLib) {
            updatePdfStatus('⚠️ PDF.js no disponible. Usa el ingreso manual.', 'error');
        } else {
            updatePdfStatus('📄 Selecciona un archivo PDF o arrástralo aquí', 'info');
        }
    } else {
        goToStep(1);
    }
    
    updateTitles();
}

/**
 * Muestra la selección de método
 */
function showMethodSelection() {
    const methodSelection = document.querySelector('.rsi-method-selection');
    if (methodSelection) methodSelection.style.display = 'flex';
    
    const firstPanel = document.querySelector('.rsi-step-panel[data-step="1"]');
    if (firstPanel) {
        firstPanel.style.display = 'none';
        firstPanel.classList.remove('active');
    }
    
    const indicator = document.querySelector('.rsi-steps-indicator');
    if (indicator) indicator.style.display = 'none';
    
    const pdfUploader = document.getElementById('pdfUploader');
    if (pdfUploader) pdfUploader.style.display = 'none';
}

/**
 * Actualiza los títulos según el modo
 */
function updateTitles() {
    const pageTitle = document.querySelector('.rsi-page-title');
    const submitBtn = document.getElementById('submitCliente');
    
    if (isEditMode) {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Cliente`;
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Cliente';
        }
    } else {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Registro</span> de Cliente`;
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrar Cliente';
        }
    }
}

/**
 * ✅ Detecta si un texto es nombre completo o razón social
 */
function detectarTipoNombre(texto) {
    if (!texto) return 'razonSocial';
    
    // Patrones para detectar nombre completo (persona física)
    const patronesNombre = [
        /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+( [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?$/, // Juan Pérez, Juan Pérez García
        /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-Z][a-z]+ [A-Z][a-z]+$/, // Juan Manuel Pérez
        /^[A-ZÁÉÍÓÚÑ]\.? [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/ // J. Pérez
    ];
    
    // Patrones para detectar razón social (empresa)
    const patronesRazonSocial = [
        /^[A-ZÁÉÍÓÚÑ\s]+(SA|S\.A\.|S.A.|S.A. de C.V.|SAPI|S.P.R.)/i, // EMPRESA SA de CV
        /^[A-ZÁÉÍÓÚÑ\s]+(S DE RL|S\.DE R\.L\.|S DE R L)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(C\.V\.|CV|S.C.)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(S\.A\.|S A)/i,
        /^[A-ZÁÉÍÓÚÑ\s]+(SAPI|SAPIB)/i
    ];
    
    // Verificar si coincide con algún patrón de razón social
    for (const patron of patronesRazonSocial) {
        if (patron.test(texto)) {
            return 'razonSocial';
        }
    }
    
    // Verificar si coincide con algún patrón de nombre
    for (const patron of patronesNombre) {
        if (patron.test(texto)) {
            return 'nombreCompleto';
        }
    }
    
    // Si tiene más de 40 caracteres, probablemente es razón social
    if (texto.length > 40) {
        return 'razonSocial';
    }
    
    // Si tiene 2 o 3 palabras, probablemente es nombre
    const palabras = texto.trim().split(/\s+/);
    if (palabras.length >= 2 && palabras.length <= 4) {
        return 'nombreCompleto';
    }
    
    // Por defecto, asumir razón social
    return 'razonSocial';
}

/**
 * ✅ Normaliza un nombre (convierte a formato título)
 */
function normalizarNombre(texto) {
    if (!texto) return '';
    
    // Convertir a minúsculas y luego capitalizar cada palabra
    return texto.toLowerCase()
        .split(' ')
        .map(palabra => {
            // Palabras que no se capitalizan
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

        // ✅ Actualizar código del régimen
        const regimenInput = document.getElementById('regimen');
        const regimenCodigoDisplay = document.getElementById('regimenCodigoDisplay');
        const regimenCodigoContainer = document.getElementById('regimenCodigoContainer');
        
        if (regimenInput && regimenInput.value) {
            const codigo = obtenerCodigoRegimen(regimenInput.value);
            const codigoFinal = codigo || cliente.regimenCodigo || '';
            
            if (regimenCodigoDisplay) {
                regimenCodigoDisplay.value = codigoFinal;
            }
            
            if (regimenCodigoContainer) {
                regimenCodigoContainer.style.display = codigoFinal ? 'block' : 'none';
            }
            
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
                if (regimenCodigoDisplay) {
                    regimenCodigoDisplay.value = cliente.regimenCodigo;
                }
                if (regimenCodigoContainer) {
                    regimenCodigoContainer.style.display = 'block';
                }
            }
        }

        // ✅ Mostrar información de auditoría en modo edición (solo visual)
        console.log('📝 Auditoría - Creado por:', cliente.creadoPor);
        console.log('📝 Auditoría - Modificado por:', cliente.modificadoPor || cliente.creadoPor);
        console.log('📝 Auditoría - Creado:', cliente.createdAt);
        console.log('📝 Auditoría - Modificado:', cliente.updatedAt);

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
 * ✅ Inicializa la carga de PDF con drag and drop y detección de tipo de nombre
 */
function initPdfUpload() {
    const pdfInput = document.getElementById('pdfFile');
    const pdfStatus = document.getElementById('pdfStatus');
    
    if (!pdfInput) return;
    
    pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        updatePdfFileName(file.name);
        
        if (!pdfStatus) return;
        
        updatePdfStatus('📄 Procesando PDF...', 'loading');
        
        try {
            if (!pdfjsLib) {
                throw new Error('PDF.js no está disponible. Por favor, usa el ingreso manual.');
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
            
            // ✅ Detectar si es nombre completo o razón social
            const tipoNombre = detectarTipoNombre(datos.razonSocial);
            console.log('🔍 Tipo de nombre detectado:', tipoNombre);
            
            // ✅ Si es nombre completo, normalizarlo
            if (tipoNombre === 'nombreCompleto') {
                datos.razonSocial = normalizarNombre(datos.razonSocial);
                console.log('📝 Nombre normalizado:', datos.razonSocial);
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
                    filledCount++;
                }
            }

            // ✅ Actualizar código del régimen
            if (datos.regimen) {
                const codigo = obtenerCodigoRegimen(datos.regimen);
                const regimenCodigoDisplay = document.getElementById('regimenCodigoDisplay');
                const regimenCodigoContainer = document.getElementById('regimenCodigoContainer');
                
                if (regimenCodigoDisplay) {
                    regimenCodigoDisplay.value = codigo || '';
                }
                
                if (regimenCodigoContainer) {
                    regimenCodigoContainer.style.display = codigo ? 'block' : 'none';
                }
            }
            
            // ✅ Mostrar el tipo de nombre detectado
            const tipoMensaje = tipoNombre === 'nombreCompleto' 
                ? ' (detectado como nombre de persona física)' 
                : ' (detectado como razón social)';
            
            updatePdfStatus(`✅ PDF procesado correctamente (${filledCount} campos llenados)${tipoMensaje}`, 'success');
            
            // Ocultar el uploader y mostrar el formulario
            const pdfUploader = document.getElementById('pdfUploader');
            if (pdfUploader) {
                setTimeout(() => {
                    pdfUploader.style.display = 'none';
                }, 1500);
            }
            
            // Ir al paso 1
            goToStep(1);
            
            // Actualizar UI para mostrar el paso 1
            document.querySelectorAll('.rsi-step-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            const firstPanel = document.querySelector('.rsi-step-panel[data-step="1"]');
            if (firstPanel) {
                firstPanel.classList.add('active');
                firstPanel.style.display = 'block';
            }
            
            // Actualizar indicadores
            document.querySelectorAll('.rsi-step-number').forEach(dot => {
                const dotStep = parseInt(dot.dataset.step);
                dot.classList.remove('active', 'completed');
                if (dotStep === 1) {
                    dot.classList.add('active');
                }
            });
            
            document.querySelectorAll('.rsi-step-label').forEach(label => {
                const labelStep = parseInt(label.dataset.step);
                label.classList.remove('active', 'completed');
                if (labelStep === 1) {
                    label.classList.add('active');
                }
            });
            
            document.querySelector('.rsi-step-counter span').textContent = '1';
            
            // Scroll al formulario
            const form = getForm();
            if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            Swal.fire({
                icon: 'success',
                title: 'PDF procesado',
                text: `Se han extraído ${filledCount} campos del documento.${tipoMensaje}`,
                timer: 4000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            
            console.log('📋 Datos extraídos del PDF:', datos);
            
        } catch (error) {
            console.error('❌ Error procesando PDF:', error);
            updatePdfStatus('❌ Error al procesar el PDF: ' + error.message, 'error');
            
            Swal.fire({
                icon: 'error',
                title: 'Error al procesar el PDF',
                text: error.message || 'Ocurrió un error al leer el archivo. Verifica que sea una Constancia SAT válida.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#d33'
            });
        }
    });
    
    eventListeners.push({ element: pdfInput, event: 'change', handler: pdfInput.onchange });
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
    document.querySelectorAll('.rsi-form-group input').forEach(input => {
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
 * 3. ENVÍO DEL FORMULARIO
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
 * 4. INDICADORES DE PASOS
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
        if (panelStep === step) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
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
        rfc: { test: (v) => v.length === 0 || v.length >= 12, msg: 'RFC inválido (mínimo 12 caracteres)' },
        codigoPostal: { test: (v) => v.length === 0 || v.length === 5, msg: 'Código postal inválido (5 dígitos)' },
        telefonoMovil: { test: (v) => v.length === 0 || v.length >= 10, msg: 'Teléfono inválido (mínimo 10 dígitos)' },
        email: { test: (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Correo electrónico inválido' }
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
function prepareData() {
    const getValue = (id) => document.getElementById(id)?.value || '';
    const regimen = getValue('regimen');
    const regimenCodigo = obtenerCodigoRegimen(regimen);
    
    return {
        rfc: getValue('rfc'),
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
 * ✅ Maneja el envío del formulario con auditoría
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitCliente');
    
    try {
        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const data = prepareData();

        let result;

        if (isEditMode && editingDocId) {
            // ✅ Modo edición - actualizar con auditoría
            // El service.updateCliente ya actualiza modificadoPor y updatedAt
            result = await service.updateCliente(editingDocId, data);
        } else {
            // ✅ Modo creación - crear con auditoría
            // El service.createCliente ya guarda creadoPor y modificadoPor
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
                <div style="text-align: left;">
                    <p><strong>Razón Social:</strong> ${data.razonSocial}</p>
                    <p><strong>RFC:</strong> ${data.rfc}</p>
                    <p><strong>Régimen:</strong> ${data.regimen}</p>
                    <p><strong>Código Régimen:</strong> ${data.regimenCodigo || 'No asignado'}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    ${isEditMode ? `<p style="font-size: 0.85rem; color: var(--rsi-gray-500); margin-top: var(--rsi-spacing-sm);">
                        <i class="fas fa-user-edit"></i> Modificado por: ${service._getCurrentUserName?.() || 'Usuario actual'}
                    </p>` : ''}
                </div>
            `,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudClientes');
            } else {
                window.location.href = '/partner/crudClientes';
            }
        });

    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el cliente';
        
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
            ? '<i class="fas fa-save"></i> Actualizar Cliente'
            : '<i class="fas fa-user-plus"></i> Registrar Cliente';
    }
}

/**
 * Limpia eventos
 */
export function destroyClienteController() {
    console.log('🧹 Destroying ClienteController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    editingDocId = null;
    isEditMode = false;
    originalData = {};
    selectedMethod = null;
    pdfjsLib = null;
}

export default clienteController;