/* ========================================
   COTIZACION FORM CONTROLLER
   Controlador para crear/editar una cotización
   ======================================== */

import CotizacionService from '../../services/cotizacionService.js';
import ClienteService from '../../services/clienteService.js';
import ProductoServicioService from '../../services/productoServicioService.js';
import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';
import ContadorCotizacionService from '../../services/contadorCotizacionService.js';
import StorageService from '../../services/storageService.js';
import { generarPDFCotizacion } from '../../utils/pdfGenerator.js';

let cotizacionService = null;
let clienteService = null;
let productoServicioService = null;
let categoriaService = null;
let contadorService = null;
let storageService = null;
let eventListeners = [];
let editingId = null;
let isEditMode = false;
let currentStep = 1;
const totalSteps = 3;
let isNavigating = false;
let clientesList = [];
let productosList = [];
let categoriasList = [];
let currentUser = null;
let isManualEntry = false;
let itemsData = [];
let cotizacionTemporalId = null;
let tipoCotizacionBloqueado = false;
let clienteSeleccionadoId = null;
let cotizacionGuardadaTemporalmente = false;

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
 * Maneja la subida del PDF a Storage
 * @param {Object} cotizacionData - Datos de la cotización
 * @param {Blob} pdfBlob - Blob del PDF
 * @param {boolean} isEdit - Si es edición
 * @returns {Promise<{success: boolean, url: string, message: string}>}
 */
async function manejarPDFStorage(cotizacionData, pdfBlob, isEdit) {
    try {
        // Si es edición, eliminar PDF anterior
        if (isEdit && cotizacionData.cotizacionNumero) {
            console.log('🗑️ Eliminando PDF anterior...');
            await storageService.deleteAllPDFs(cotizacionData.cotizacionNumero, 'cotizaciones');
        }
        
        // Subir nuevo PDF
        console.log('📤 Subiendo PDF a Storage...');
        const result = await storageService.uploadPDF(
            pdfBlob,
            cotizacionData.cotizacionNumero,
            'cotizaciones'
        );
        
        if (result.success) {
            return {
                success: true,
                url: result.url,
                message: 'PDF almacenado en la nube correctamente'
            };
        } else {
            return {
                success: false,
                url: null,
                message: result.error || 'Error al subir el PDF'
            };
        }
    } catch (error) {
        console.error('❌ Error en manejarPDFStorage:', error);
        return {
            success: false,
            url: null,
            message: error.message || 'Error al manejar el PDF en Storage'
        };
    }
}

/**
 * Inicializa el controlador del formulario
 */
export async function cotizacionFormController() {
    console.log('📄 Cotizacion Form Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    // Inicializar servicios
    cotizacionService = new CotizacionService();
    clienteService = new ClienteService();
    productoServicioService = new ProductoServicioService();
    categoriaService = new CategoriaProductoServicioService();
    contadorService = new ContadorCotizacionService();
    storageService = new StorageService();
    
    eventListeners = [];
    editingId = null;
    isEditMode = false;
    currentStep = 1;
    isNavigating = false;
    clientesList = [];
    productosList = [];
    categoriasList = [];
    currentUser = null;
    isManualEntry = false;
    itemsData = [];
    cotizacionTemporalId = null;
    tipoCotizacionBloqueado = false;
    clienteSeleccionadoId = null;
    cotizacionGuardadaTemporalmente = false;
    
    // Cargar usuario actual
    await loadCurrentUser();
    
    // Verificar si hay ID en la URL (modo edición)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        editingId = id;
        isEditMode = true;
        console.log('✏️ Modo edición - ID:', editingId);
    }
    
    // Cargar datos necesarios
    await loadClientes();
    await loadCategorias();
    await loadProductos();
    
    // Inicializar eventos
    initStepNavigation();
    initFieldValidation();
    initClienteSearch();
    initProductoSearch();
    initItemHandlers();
    initSubmitHandler();
    initCancelButton();
    initCreditOptions();
    initEmpresaChange();
    initDescripcionCounter();
    initDragDrop();
    initTotalesListeners();
    initEnterNavigation();
    
    // Si es modo edición, cargar los datos
    if (isEditMode && editingId) {
        await loadCotizacionData(editingId);
    } else {
        resetForm();
        // Evento para generar número de cotización Y GUARDAR AUTOMÁTICAMENTE
        document.getElementById('tipoCotizacion').addEventListener('change', async () => {
            if (document.getElementById('tipoCotizacion').value && !tipoCotizacionBloqueado) {
                await generarNumeroCotizacion();
                await guardarCotizacionTemporal();
            }
        });
    }
    
    // Ir al paso 1
    goToStep(1);
    
    // Actualizar título
    updateTitle();
    
    console.log(`✅ Cotizacion Form Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
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
 * Carga la lista de clientes
 */
async function loadClientes() {
    try {
        clientesList = await clienteService.getAllClientes();
        console.log(`✅ Clientes cargados: ${clientesList.length}`);
        if (clientesList.length > 0) {
            console.log('📋 Ejemplo de cliente:', JSON.stringify(clientesList[0], null, 2));
        }
    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
        clientesList = [];
    }
}

/**
 * Carga la lista de categorías
 */
async function loadCategorias() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasList = categorias.map(cat => ({
            id: cat.id,
            nombre: cat.nombreCategoria || 'Sin nombre'
        }));
        console.log(`✅ Categorías cargadas: ${categoriasList.length}`);
    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        categoriasList = [];
    }
}

/**
 * Carga la lista de productos/servicios
 */
async function loadProductos() {
    try {
        const productos = await productoServicioService.getAllProductosServicios();
        productosList = productos.filter(p => p.activo !== false);
        console.log(`✅ Productos cargados: ${productosList.length}`);
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        productosList = [];
    }
}

/**
 * Obtiene el nombre de una categoría por su ID
 */
function getCategoriaNombre(categoriaId) {
    if (!categoriaId) return 'Sin categoría';
    const categoria = categoriasList.find(c => c.id === categoriaId);
    return categoria ? categoria.nombre : 'Sin categoría';
}

/**
 * Obtiene la información de la empresa
 */
function getEmpresaInfo(selector) {
    const empresas = { 
        'RSI IXT': { nombre: 'RSI ENTERPRISE IXTAPALUCA', direccion: 'Av. Morelos 10, Pueblo San Francisco Acuautla, 56587 Ixtapaluca, Méx.', telefono: '+52 1 55 7690 8248', rfc: 'RSI1810319G0' },
        'RSI NEZA': { nombre: 'RSI ENTERPRISE NEZAHUALCÓYOTL', direccion: '31 MZ102 LT20 EL SOL 57200', telefono: '+52 1 55 7690 8248', rfc: 'RSI1810319G0' }
    };
    return empresas[selector] || empresas['RSI NEZA'];
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
        if (titleEl) titleEl.innerHTML = `<span class="rsi-text-gold">Editar</span> Cotización`;
        if (subtitleEl) subtitleEl.textContent = 'Modifica los datos de la cotización.';
        if (submitBtnText) submitBtnText.textContent = 'Actualizar Cotización';
        if (step1Title) step1Title.textContent = 'Editar Cotización';
        if (step1Subtitle) step1Subtitle.textContent = 'Modifica los datos del cliente y la cotización';
    } else {
        if (titleEl) titleEl.innerHTML = `<span class="rsi-text-gold">Nueva</span> Cotización`;
        if (subtitleEl) subtitleEl.textContent = 'Crea una nueva cotización para un cliente.';
        if (submitBtnText) submitBtnText.textContent = 'Generar Cotización';
        if (step1Title) step1Title.textContent = 'Datos del Cliente';
        if (step1Subtitle) step1Subtitle.textContent = 'Selecciona o ingresa los datos del cliente';
    }
}

/**
 * Carga los datos de la cotización para edición
 */
async function loadCotizacionData(id) {
    try {
        mostrarLoading(true);
        
        const cotizacion = await cotizacionService.getCotizacionById(id);
        if (!cotizacion) {
            throw new Error('Cotización no encontrada');
        }
        
        // Guardar ID del cliente
        clienteSeleccionadoId = cotizacion.clienteId || null;
        
        // Cargar TODOS los datos del cliente
        setFieldValue('clienteNombre', cotizacion.clienteNombre);
        setFieldValue('clienteRFC', cotizacion.clienteRFC);
        setFieldValue('clienteDireccion', cotizacion.clienteDireccion);
        setFieldValue('clienteTelefono', cotizacion.clienteTelefono);
        setFieldValue('clienteEmail', cotizacion.clienteEmail);
        setFieldValue('clienteSearch', cotizacion.clienteNombre);
        
        // Campos adicionales del cliente (TODOS los del model)
        setFieldValue('clienteRazonSocial', cotizacion.clienteRazonSocial || cotizacion.clienteNombre);
        setFieldValue('clienteNombreComercial', cotizacion.clienteNombreComercial);
        setFieldValue('clienteRegimen', cotizacion.clienteRegimen);
        setFieldValue('clienteRegimenCodigo', cotizacion.clienteRegimenCodigo);
        setFieldValue('clienteCodigoPostal', cotizacion.clienteCodigoPostal);
        setFieldValue('clienteTipoVialidad', cotizacion.clienteTipoVialidad);
        setFieldValue('clienteNombreVialidad', cotizacion.clienteNombreVialidad);
        setFieldValue('clienteNumeroExterior', cotizacion.clienteNumeroExterior);
        setFieldValue('clienteNumeroInterior', cotizacion.clienteNumeroInterior);
        setFieldValue('clienteColonia', cotizacion.clienteColonia);
        setFieldValue('clienteLocalidad', cotizacion.clienteLocalidad);
        setFieldValue('clienteMunicipio', cotizacion.clienteMunicipio);
        setFieldValue('clienteEstado', cotizacion.clienteEstado);
        setFieldValue('clienteTelefonoFijo', cotizacion.clienteTelefonoFijo);
        
        // Llenar datos de la cotización
        setFieldValue('cotizacionNumero', cotizacion.cotizacionNumero);
        setFieldValue('tipoCotizacion', cotizacion.tipoCotizacion);
        setFieldValue('cotizacionFecha', cotizacion.cotizacionFecha);
        setFieldValue('cotizacionVigencia', cotizacion.cotizacionVigencia || 30);
        setFieldValue('cotizacionMoneda', cotizacion.cotizacionMoneda || 'MXN');
        setFieldValue('tipoCredito', cotizacion.tipoCredito);
        setFieldValue('diasCredito', cotizacion.diasCredito);
        setFieldValue('cotizacionDescripcion', cotizacion.cotizacionDescripcion);
        setFieldValue('terminos', cotizacion.terminos);
        setFieldValue('empresaSelector', cotizacion.empresaSelector || 'RSI NEZA');
        
        // Crédito
        handleCreditOptions();
        
        // Empresa
        handleEmpresaChange();
        
        // Bloquear tipo de cotización si ya tiene número
        if (cotizacion.cotizacionNumero) {
            bloquearTipoCotizacion();
        }
        
        // Items
        if (cotizacion.items && cotizacion.items.length > 0) {
            itemsData = cotizacion.items.map(item => ({
                categoria: item.categoria || '',
                categoriaNombre: item.categoriaNombre || getCategoriaNombre(item.categoria),
                tipoTecnologia: item.tipoTecnologia || 'pieza',
                descripcion: item.descripcion || '',
                cantidad: item.cantidad || 1,
                precio: item.precio || 0,
                total: (item.cantidad || 1) * (item.precio || 0)
            }));
        } else {
            itemsData = [{
                categoria: '',
                categoriaNombre: '',
                tipoTecnologia: 'pieza',
                descripcion: '',
                cantidad: 1,
                precio: 0,
                total: 0
            }];
        }
        
        // Renderizar items
        renderItemsTable();
        
        // Descuento e impuesto
        setFieldValue('descuento', cotizacion.descuento || 0);
        setFieldValue('impuesto', cotizacion.impuesto || 16);
        
        // Calcular totales
        calcularTotales();
        
        // Mostrar auditoría en confirmación
        const auditoriaConfirmacion = document.getElementById('auditoriaConfirmacion');
        if (auditoriaConfirmacion) {
            auditoriaConfirmacion.style.display = 'block';
            
            const creadoPorNombre = cotizacion.creadoPor ? await cotizacionService.getUserName(cotizacion.creadoPor) : 'Sistema';
            const creadoPorFecha = cotizacion.createdAt ? formatDate(cotizacion.createdAt) : '-';
            const modificadoPorNombre = cotizacion.modificadoPor ? await cotizacionService.getUserName(cotizacion.modificadoPor) : 'Sistema';
            const modificadoPorFecha = cotizacion.updatedAt ? formatDate(cotizacion.updatedAt) : '-';
            
            setFieldValue('confirmCreadoPor', creadoPorNombre);
            setFieldValue('confirmFechaCreacion', creadoPorFecha);
            setFieldValue('confirmModificadoPor', modificadoPorNombre);
            setFieldValue('confirmFechaModificacion', modificadoPorFecha);
        }
        
        console.log('✅ Datos de cotización cargados:', cotizacion.cotizacionNumero);
        
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cargando cotización:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la cotización para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudCotizaciones');
            } else {
                window.location.href = '/partner/crudCotizaciones';
            }
        });
    }
}

/**
 * Genera el número de cotización
 */
async function generarNumeroCotizacion() {
    try {
        const tipoCotizacion = document.getElementById('tipoCotizacion')?.value;
        if (!tipoCotizacion) {
            document.getElementById('cotizacionNumero').value = '';
            return null;
        }

        const result = await Swal.fire({
            title: '📄 Generar Cotización',
            html: `
                <div style="text-align: left; margin: 15px 0;">
                    <p style="font-size: 1.1rem; margin-bottom: 10px;">
                        <strong>Tipo: ${tipoCotizacion.toUpperCase()}</strong>
                    </p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
                        <p style="margin: 5px 0;">La cotización se almacenará temporalmente.</p>
                        <p style="margin: 5px 0;">Se generará un número consecutivo.</p>
                        <p style="margin: 5px 0; color: #2563eb; font-weight: 600;">El contador aumentará en 1.</p>
                    </div>
                    <p style="margin-top: 15px; color: #6b7280; font-size: 0.9rem;">
                        <i class="fas fa-info-circle"></i> 
                        El tipo de cotización quedará bloqueado después de generar el número.
                    </p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '✅ Aceptar y generar',
            cancelButtonText: '❌ Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6b7280',
            allowOutsideClick: false
        });

        if (!result.isConfirmed) {
            document.getElementById('tipoCotizacion').value = '';
            return null;
        }

        const numeroCompleto = await contadorService.getSiguienteNumeroCotizacion(tipoCotizacion);
        document.getElementById('cotizacionNumero').value = numeroCompleto;
        
        bloquearTipoCotizacion();
        
        mostrarAlerta(`✅ Número generado: ${numeroCompleto}`, 'success');
        
        return numeroCompleto;
    } catch (error) {
        console.error('❌ Error generando número:', error);
        mostrarAlerta('Error al generar el número de cotización', 'error');
        return null;
    }
}

/**
 * Bloquea el selector de tipo de cotización
 */
function bloquearTipoCotizacion() {
    const select = document.getElementById('tipoCotizacion');
    if (select) {
        select.disabled = true;
        select.style.backgroundColor = '#f0f0f0';
        select.style.cursor = 'not-allowed';
        tipoCotizacionBloqueado = true;
    }
}

/**
 * GUARDA LA COTIZACIÓN TEMPORAL EN LA BASE DE DATOS
 */
async function guardarCotizacionTemporal() {
    const tipoCotizacion = document.getElementById('tipoCotizacion')?.value;
    const cotizacionNumero = document.getElementById('cotizacionNumero')?.value;
    
    if (!tipoCotizacion || !cotizacionNumero) {
        console.log('⏳ No se puede guardar temporal: faltan datos');
        return;
    }

    if (cotizacionGuardadaTemporalmente) {
        console.log('⏳ Cotización ya guardada temporalmente');
        return;
    }

    try {
        // Obtener TODOS los datos del cliente
        const clienteNombre = getFieldValue('clienteNombre') || 'Cliente pendiente';
        const clienteRFC = getFieldValue('clienteRFC') || '';
        const clienteDireccion = getFieldValue('clienteDireccion') || 'Sin dirección';
        const clienteTelefono = getFieldValue('clienteTelefono') || '';
        const clienteEmail = getFieldValue('clienteEmail') || '';
        const clienteRazonSocial = getFieldValue('clienteRazonSocial') || clienteNombre;
        const clienteNombreComercial = getFieldValue('clienteNombreComercial') || '';
        const clienteRegimen = getFieldValue('clienteRegimen') || 'Sin régimen';
        const clienteRegimenCodigo = getFieldValue('clienteRegimenCodigo') || '';
        const clienteCodigoPostal = getFieldValue('clienteCodigoPostal') || '00000';
        const clienteTipoVialidad = getFieldValue('clienteTipoVialidad') || '';
        const clienteNombreVialidad = getFieldValue('clienteNombreVialidad') || '';
        const clienteNumeroExterior = getFieldValue('clienteNumeroExterior') || '';
        const clienteNumeroInterior = getFieldValue('clienteNumeroInterior') || '';
        const clienteColonia = getFieldValue('clienteColonia') || '';
        const clienteLocalidad = getFieldValue('clienteLocalidad') || '';
        const clienteMunicipio = getFieldValue('clienteMunicipio') || '';
        const clienteEstado = getFieldValue('clienteEstado') || '';
        const clienteTelefonoFijo = getFieldValue('clienteTelefonoFijo') || '';
        
        const empresaSelector = getFieldValue('empresaSelector') || 'RSI NEZA';
        const empresaInfo = getEmpresaInfo(empresaSelector);
        
        // Obtener items de la tabla
        const items = getItemsFromTable();
        
        if (items.length === 0) {
            items.push({
                categoria: '',
                categoriaNombre: '',
                tipoTecnologia: 'pieza',
                descripcion: 'Item por defecto',
                cantidad: 1,
                precio: 0,
                total: 0
            });
        }
        
        // Calcular totales
        const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const descuento = parseFloat(getFieldValue('descuento')) || 0;
        const impuesto = parseFloat(getFieldValue('impuesto')) || 16;
        const subtotalConIva = subtotal * (1 + impuesto / 100);
        const descuentoMonto = subtotalConIva * (descuento / 100);
        const totalFinal = subtotalConIva - descuentoMonto;
        
        // Construir datos con TODOS los campos del cliente
        const cotizacionData = {
            clienteId: clienteSeleccionadoId || '',
            clienteNombre: clienteNombre,
            clienteRFC: clienteRFC,
            clienteDireccion: clienteDireccion,
            clienteTelefono: clienteTelefono,
            clienteEmail: clienteEmail,
            clienteRazonSocial: clienteRazonSocial,
            clienteNombreComercial: clienteNombreComercial,
            clienteRegimen: clienteRegimen,
            clienteRegimenCodigo: clienteRegimenCodigo,
            clienteCodigoPostal: clienteCodigoPostal,
            clienteTipoVialidad: clienteTipoVialidad,
            clienteNombreVialidad: clienteNombreVialidad,
            clienteNumeroExterior: clienteNumeroExterior,
            clienteNumeroInterior: clienteNumeroInterior,
            clienteColonia: clienteColonia,
            clienteLocalidad: clienteLocalidad,
            clienteMunicipio: clienteMunicipio,
            clienteEstado: clienteEstado,
            clienteTelefonoFijo: clienteTelefonoFijo,
            cotizacionNumero: cotizacionNumero,
            cotizacionFecha: getFieldValue('cotizacionFecha') || new Date().toISOString().split('T')[0],
            cotizacionVigencia: getFieldValue('cotizacionVigencia') || '30',
            cotizacionMoneda: getFieldValue('cotizacionMoneda') || 'MXN',
            cotizacionDescripcion: getFieldValue('cotizacionDescripcion') || '',
            tipoCotizacion: tipoCotizacion,
            empresaSelector: empresaSelector,
            empresaNombre: empresaInfo.nombre,
            empresaDireccion: empresaInfo.direccion,
            empresaRFC: empresaInfo.rfc,
            empresaTelefono: empresaInfo.telefono,
            items: items.map(item => ({
                categoria: item.categoria || '',
                categoriaNombre: item.categoriaNombre || getCategoriaNombre(item.categoria),
                tipoTecnologia: item.tipoTecnologia || 'pieza',
                descripcion: item.descripcion || 'Sin descripción',
                cantidad: item.cantidad || 1,
                precio: item.precio || 0,
                total: (item.cantidad || 1) * (item.precio || 0)
            })),
            subtotal: subtotal,
            descuento: descuento.toString(),
            descuentoMonto: descuentoMonto,
            impuesto: impuesto.toString(),
            impuestoMonto: subtotalConIva - subtotal,
            totalFinal: totalFinal,
            tipoCredito: getFieldValue('tipoCredito') || '',
            diasCredito: getFieldValue('diasCredito') || '',
            terminos: getFieldValue('terminos') || '',
            esEntradaManual: isManualEntry,
            estatus: 'borrador',
            estado: 'borrador',
            creadoPor: currentUser ? currentUser.uid : '',
            modificadoPor: currentUser ? currentUser.uid : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('📤 Guardando cotización temporal:', {
            clienteId: cotizacionData.clienteId,
            clienteNombre: cotizacionData.clienteNombre,
            clienteRazonSocial: cotizacionData.clienteRazonSocial,
            clienteDireccion: cotizacionData.clienteDireccion,
            clienteCodigoPostal: cotizacionData.clienteCodigoPostal,
            itemsCount: cotizacionData.items.length,
            totalFinal: cotizacionData.totalFinal
        });

        let result;
        if (cotizacionTemporalId) {
            result = await cotizacionService.updateCotizacion(cotizacionTemporalId, cotizacionData, false);
            console.log('✅ Cotización temporal actualizada');
        } else {
            result = await cotizacionService.createCotizacion(cotizacionData, false);
            cotizacionTemporalId = result.id;
            console.log('✅ Cotización temporal creada con ID:', cotizacionTemporalId);
        }
        
        cotizacionGuardadaTemporalmente = true;
        
    } catch (error) {
        console.error('❌ Error guardando temporal:', error);
    }
}

// =================================================================================
// NAVEGACIÓN POR PASOS
// =================================================================================

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
        const clienteNombre = getFieldValue('clienteNombre');
        const clienteDireccion = getFieldValue('clienteDireccion');
        const clienteTelefono = getFieldValue('clienteTelefono');
        const tipoCotizacion = getFieldValue('tipoCotizacion');
        
        if (!clienteNombre) {
            mostrarAlerta('El nombre del cliente es requerido', 'error');
            return false;
        }
        if (!clienteDireccion) {
            mostrarAlerta('La dirección del cliente es requerida', 'error');
            return false;
        }
        if (!clienteTelefono) {
            mostrarAlerta('El teléfono del cliente es requerido', 'error');
            return false;
        }
        if (!tipoCotizacion) {
            mostrarAlerta('Debe seleccionar un tipo de cotización', 'error');
            return false;
        }
    }

    if (currentStep === 2) {
        const items = getItemsFromTable();
        if (items.length === 0) {
            mostrarAlerta('Debe agregar al menos un item a la cotización', 'error');
            return false;
        }
        const hasInvalidItem = items.some(item => !item.descripcion || item.cantidad <= 0 || item.precio < 0);
        if (hasInvalidItem) {
            mostrarAlerta('Todos los items deben tener descripción, cantidad y precio válidos', 'error');
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

    const form = document.getElementById('cotizacionForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =================================================================================
// VALIDACIÓN DE CAMPOS
// =================================================================================

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

// =================================================================================
// NAVEGACIÓN CON ENTER
// =================================================================================

function initEnterNavigation() {
    const camposPaso1 = [
        document.getElementById('clienteSearch'),
        document.getElementById('clienteNombre'),
        document.getElementById('clienteRFC'),
        document.getElementById('clienteDireccion'),
        document.getElementById('clienteTelefono'),
        document.getElementById('clienteEmail'),
        document.getElementById('tipoCotizacion'),
        document.getElementById('cotizacionFecha'),
        document.getElementById('cotizacionVigencia'),
        document.getElementById('cotizacionMoneda'),
        document.getElementById('tipoCredito'),
        document.getElementById('diasCredito'),
        document.getElementById('cotizacionDescripcion'),
        document.getElementById('empresaSelector')
    ];
    
    camposPaso1.forEach((campo, index) => {
        if (campo) {
            campo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const siguiente = camposPaso1[index + 1];
                    if (siguiente) {
                        siguiente.focus();
                        if (siguiente.select) siguiente.select();
                    } else {
                        document.querySelector('.rsi-btn-next[data-next="2"]')?.click();
                    }
                }
            });
            eventListeners.push({ element: campo, event: 'keydown', handler: () => {} });
        }
    });
}

// =================================================================================
// BÚSQUEDA DE CLIENTES - CON TODOS LOS CAMPOS
// =================================================================================

function initClienteSearch() {
    const searchInput = document.getElementById('clienteSearch');
    
    if (!searchInput) return;
    
    let dropdown = document.getElementById('clienteDropdown');
    if (!dropdown) {
        const container = searchInput.closest('.rsi-cliente-search-container');
        dropdown = document.createElement('div');
        dropdown.id = 'clienteDropdown';
        dropdown.className = 'rsi-cliente-dropdown';
        dropdown.style.display = 'none';
        container.appendChild(dropdown);
    }
    
    searchInput.addEventListener('input', () => {
        const termino = searchInput.value.toLowerCase().trim();
        if (termino.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        const filtrados = clientesList.filter(c => {
            const nombre = (c.razonSocial || c.nombre || '').toLowerCase();
            const rfc = (c.rfc || '').toLowerCase();
            return nombre.includes(termino) || rfc.includes(termino);
        });
        
        mostrarOpcionesClientes(filtrados, termino);
    });
    
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length > 0) {
            const termino = searchInput.value.toLowerCase().trim();
            const filtrados = clientesList.filter(c => {
                const nombre = (c.razonSocial || c.nombre || '').toLowerCase();
                const rfc = (c.rfc || '').toLowerCase();
                return nombre.includes(termino) || rfc.includes(termino);
            });
            mostrarOpcionesClientes(filtrados, termino);
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.rsi-cliente-search-container')) {
            dropdown.style.display = 'none';
        }
    });
}

function mostrarOpcionesClientes(clientesFiltrados, termino = '') {
    const dropdown = document.getElementById('clienteDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    dropdown.style.display = 'block';
    
    if (clientesFiltrados.length === 0 && termino) {
        const noResults = document.createElement('div');
        noResults.className = 'rsi-cliente-option';
        noResults.innerHTML = `<div style="color: #6b7280; font-style: italic;">No se encontraron clientes con "${termino}"</div>`;
        dropdown.appendChild(noResults);
    } else {
        clientesFiltrados.forEach(cliente => {
            const option = document.createElement('div');
            option.className = 'rsi-cliente-option';
            option.innerHTML = `
                <strong>${cliente.razonSocial || cliente.nombre || 'Sin nombre'}</strong>
                <div class="cliente-info">${cliente.rfc ? 'RFC: ' + cliente.rfc : 'Sin RFC'}</div>
                <div class="cliente-info" style="font-size: 0.7rem; color: #6b7280;">${cliente.regimen || 'Sin régimen'}</div>
            `;
            option.addEventListener('click', () => seleccionarCliente(cliente));
            dropdown.appendChild(option);
        });
    }
    
    if (termino && termino.length >= 2) {
        const nuevoClienteOption = document.createElement('div');
        nuevoClienteOption.className = 'rsi-cliente-option manual';
        nuevoClienteOption.innerHTML = `
            <strong>➕ Agregar "${termino}"</strong>
            <div class="cliente-info">Crear nuevo cliente con este nombre</div>
        `;
        nuevoClienteOption.addEventListener('click', () => agregarNuevoCliente(termino));
        dropdown.appendChild(nuevoClienteOption);
    }
    
    const manualOption = document.createElement('div');
    manualOption.className = 'rsi-cliente-option manual';
    manualOption.innerHTML = `
        <strong>✏️ Entrada Manual</strong>
        <div class="cliente-info">Escribir datos del cliente manualmente</div>
    `;
    manualOption.addEventListener('click', activarEntradaManual);
    dropdown.appendChild(manualOption);
}

/**
 * AGREGA UN NUEVO CLIENTE DESDE EL FORMULARIO
 */
async function agregarNuevoCliente(nombre) {
    mostrarLoading(true);
    try {
        const { value: formValues } = await Swal.fire({
            title: 'Agregar Nuevo Cliente',
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Nombre/Razón Social *</label>
                        <input id="swal-nombre" class="swal2-input" value="${nombre}" placeholder="Razón Social">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">RFC *</label>
                        <input id="swal-rfc" class="swal2-input" placeholder="RFC (ej: XAXX010101000)">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Régimen Fiscal</label>
                        <input id="swal-regimen" class="swal2-input" placeholder="Régimen Fiscal">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Código Postal</label>
                        <input id="swal-cp" class="swal2-input" placeholder="Código Postal">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Vialidad</label>
                        <input id="swal-vialidad" class="swal2-input" placeholder="Calle">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Número Exterior</label>
                        <input id="swal-num-ext" class="swal2-input" placeholder="Número Exterior">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Colonia</label>
                        <input id="swal-colonia" class="swal2-input" placeholder="Colonia">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Municipio</label>
                        <input id="swal-municipio" class="swal2-input" placeholder="Municipio">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Estado</label>
                        <input id="swal-estado" class="swal2-input" placeholder="Estado">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Teléfono Móvil</label>
                        <input id="swal-telefono" class="swal2-input" placeholder="Teléfono Móvil">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-weight: 600;">Email</label>
                        <input id="swal-email" class="swal2-input" placeholder="Email" type="email">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✅ Guardar Cliente',
            cancelButtonText: '❌ Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6b7280',
            width: '550px',
            preConfirm: () => {
                const nombreCliente = document.getElementById('swal-nombre').value.trim();
                const rfc = document.getElementById('swal-rfc').value.trim();
                if (!nombreCliente) {
                    Swal.showValidationMessage('El nombre es requerido');
                    return false;
                }
                if (!rfc || rfc.length < 12) {
                    Swal.showValidationMessage('El RFC es requerido (mínimo 12 caracteres)');
                    return false;
                }
                return {
                    nombre: nombreCliente,
                    rfc: rfc.toUpperCase(),
                    regimen: document.getElementById('swal-regimen').value.trim(),
                    codigoPostal: document.getElementById('swal-cp').value.trim(),
                    vialidad: document.getElementById('swal-vialidad').value.trim(),
                    numExt: document.getElementById('swal-num-ext').value.trim(),
                    colonia: document.getElementById('swal-colonia').value.trim(),
                    municipio: document.getElementById('swal-municipio').value.trim(),
                    estado: document.getElementById('swal-estado').value.trim(),
                    telefono: document.getElementById('swal-telefono').value.trim(),
                    email: document.getElementById('swal-email').value.trim()
                };
            }
        });

        if (!formValues) {
            mostrarLoading(false);
            return;
        }

        const clienteData = {
            razonSocial: formValues.nombre,
            rfc: formValues.rfc,
            nombreComercial: formValues.nombre,
            regimen: formValues.regimen || 'Sin régimen',
            codigoPostal: formValues.codigoPostal || '00000',
            nombreVialidad: formValues.vialidad || 'Sin vialidad',
            numeroExterior: formValues.numExt || '',
            colonia: formValues.colonia || 'Sin colonia',
            municipio: formValues.municipio || 'Sin municipio',
            estado: formValues.estado || 'Sin estado',
            telefonoMovil: formValues.telefono || '',
            email: formValues.email || ''
        };

        const result = await clienteService.createCliente(clienteData);
        
        if (result.success) {
            mostrarAlerta('✅ Cliente agregado exitosamente', 'success');
            await loadClientes();
            
            const nuevoCliente = clientesList.find(c => c.rfc === formValues.rfc);
            if (nuevoCliente) {
                seleccionarCliente(nuevoCliente);
            }
        } else {
            throw new Error(result.message || 'Error al crear el cliente');
        }
        
        mostrarLoading(false);
        
    } catch (error) {
        console.error('Error al agregar cliente:', error);
        mostrarAlerta('Error al agregar cliente: ' + error.message, 'error');
        mostrarLoading(false);
    }
}

/**
 * SELECCIÓN DE CLIENTE - CARGA TODOS LOS DATOS
 */
function seleccionarCliente(cliente) {
    isManualEntry = false;
    clienteSeleccionadoId = cliente.id || null;
    
    console.log('📋 Seleccionando cliente:', cliente);
    
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    
    setField('clienteSearch', cliente.razonSocial || cliente.nombre || '');
    setField('clienteNombre', cliente.razonSocial || cliente.nombre || '');
    setField('clienteRFC', cliente.rfc || '');
    
    const direccionParts = [
        cliente.nombreVialidad || '',
        cliente.numeroExterior || '',
        cliente.colonia || '',
        cliente.municipio || '',
        cliente.estado || ''
    ].filter(Boolean);
    setField('clienteDireccion', direccionParts.join(', ') || cliente.contacto1 || '');
    
    setField('clienteTelefono', cliente.telefonoMovil || cliente.telefono1 || '');
    setField('clienteEmail', cliente.email || '');
    
    setField('clienteRazonSocial', cliente.razonSocial || cliente.nombre || '');
    setField('clienteNombreComercial', cliente.nombreComercial || '');
    setField('clienteRegimen', cliente.regimen || '');
    setField('clienteRegimenCodigo', cliente.regimenCodigo || '');
    setField('clienteCodigoPostal', cliente.codigoPostal || '');
    setField('clienteTipoVialidad', cliente.tipoVialidad || '');
    setField('clienteNombreVialidad', cliente.nombreVialidad || '');
    setField('clienteNumeroExterior', cliente.numeroExterior || '');
    setField('clienteNumeroInterior', cliente.numeroInterior || '');
    setField('clienteColonia', cliente.colonia || '');
    setField('clienteLocalidad', cliente.localidad || '');
    setField('clienteMunicipio', cliente.municipio || '');
    setField('clienteEstado', cliente.estado || '');
    setField('clienteTelefonoFijo', cliente.telefonoFijo || '');
    setField('clienteEntreCalle', cliente.entreCalle || '');
    setField('clienteYCalle', cliente.yCalle || '');
    
    ['clienteNombre', 'clienteRFC', 'clienteDireccion', 'clienteTelefono', 'clienteEmail'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.readOnly = true;
            field.style.backgroundColor = '#f0f9ff';
        }
    });
    
    document.getElementById('clienteDropdown').style.display = 'none';
    
    if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
        cotizacionGuardadaTemporalmente = false;
        guardarCotizacionTemporal();
    }
}

function activarEntradaManual() {
    isManualEntry = true;
    clienteSeleccionadoId = null;
    document.getElementById('clienteSearch').value = '';
    ['clienteNombre', 'clienteRFC', 'clienteDireccion', 'clienteTelefono', 'clienteEmail'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
            field.readOnly = false;
            field.style.backgroundColor = '';
        }
    });
    document.getElementById('clienteDropdown').style.display = 'none';
    document.getElementById('clienteNombre').focus();
}

// =================================================================================
// BÚSQUEDA DE PRODUCTOS - GLOBAL
// =================================================================================

function initProductoSearch() {
    const searchInput = document.getElementById('productoSearch');
    
    if (!searchInput) return;
    
    let dropdown = document.getElementById('productoDropdown');
    if (!dropdown) {
        const container = searchInput.closest('.rsi-producto-search-container');
        if (container) {
            dropdown = document.createElement('div');
            dropdown.id = 'productoDropdown';
            dropdown.className = 'rsi-producto-dropdown';
            dropdown.style.display = 'none';
            container.appendChild(dropdown);
        }
    }
    
    if (!dropdown) return;
    
    searchInput.addEventListener('input', () => {
        const termino = searchInput.value.toLowerCase().trim();
        if (termino.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        const filtrados = productosList.filter(p => 
            p.nombre && p.nombre.toLowerCase().includes(termino)
        );
        mostrarOpcionesProductosGlobal(dropdown, filtrados);
    });
    
    searchInput.addEventListener('focus', () => {
        const termino = searchInput.value.toLowerCase().trim();
        if (termino.length >= 2) {
            const filtrados = productosList.filter(p => 
                p.nombre && p.nombre.toLowerCase().includes(termino)
            );
            mostrarOpcionesProductosGlobal(dropdown, filtrados);
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.rsi-producto-search-container')) {
            dropdown.style.display = 'none';
        }
    });
}

function mostrarOpcionesProductosGlobal(dropdown, productosFiltrados) {
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    dropdown.style.display = 'block';
    
    if (productosFiltrados.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'rsi-producto-option';
        noResults.innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 8px 12px;">No se encontraron productos</div>`;
        dropdown.appendChild(noResults);
    } else {
        productosFiltrados.slice(0, 10).forEach(producto => {
            const option = document.createElement('div');
            option.className = 'rsi-producto-option';
            option.style.padding = '8px 12px';
            option.style.cursor = 'pointer';
            option.style.borderBottom = '1px solid var(--rsi-gray-100)';
            option.innerHTML = `
                <strong>${producto.nombre}</strong>
                <div style="font-size: 0.8rem; color: var(--rsi-gray-500);">
                    Categoría: ${getCategoriaNombre(producto.categoriaId)} - Precio: ${formatCurrency(producto.precioUnitario || 0)}
                </div>
            `;
            option.addEventListener('click', () => {
                const existingIndex = itemsData.findIndex(item => 
                    item.descripcion.toLowerCase() === producto.nombre.toLowerCase()
                );
                
                if (existingIndex !== -1) {
                    itemsData[existingIndex].cantidad += 1;
                    itemsData[existingIndex].total = itemsData[existingIndex].cantidad * itemsData[existingIndex].precio;
                    renderItemsTable();
                    calcularTotales();
                    mostrarAlerta(`✅ Cantidad de "${producto.nombre}" incrementada a ${itemsData[existingIndex].cantidad}`, 'success');
                } else {
                    const newItem = {
                        categoria: producto.categoriaId || '',
                        categoriaNombre: getCategoriaNombre(producto.categoriaId),
                        tipoTecnologia: 'pieza',
                        descripcion: producto.nombre || '',
                        cantidad: 1,
                        precio: producto.precioUnitario || 0,
                        total: producto.precioUnitario || 0
                    };
                    
                    itemsData.push(newItem);
                    renderItemsTable();
                    calcularTotales();
                    mostrarAlerta(`✅ "${producto.nombre}" agregado a la cotización`, 'success');
                }
                
                dropdown.style.display = 'none';
                searchInput.value = '';
                
                if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                    cotizacionGuardadaTemporalmente = false;
                    guardarCotizacionTemporal();
                }
            });
            dropdown.appendChild(option);
        });
    }
}

// =================================================================================
// ITEMS - OBTENER, RENDERIZAR Y MANEJAR
// =================================================================================

function getItemsFromTable() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const items = [];
    rows.forEach(row => {
        const categoria = row.querySelector('.item-categoria')?.value || '';
        const tipoTecnologia = row.querySelector('.item-tipo-tecnologia')?.value || 'pieza';
        const descripcion = row.querySelector('.item-descripcion')?.value || '';
        const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
        if (descripcion) {
            items.push({
                categoria,
                categoriaNombre: getCategoriaNombre(categoria),
                tipoTecnologia,
                descripcion,
                cantidad,
                precio,
                total: cantidad * precio
            });
        }
    });
    return items;
}

function renderItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    
    if (itemsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: var(--rsi-spacing-lg); color: var(--rsi-gray-500);">
                    <i class="fas fa-plus-circle" style="font-size: 1.5rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                    Agrega productos o servicios a la cotización
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    itemsData.forEach((item, index) => {
        html += `
            <tr data-index="${index}" draggable="true">
                <td><span class="drag-handle" title="Arrastrar para reordenar">⠿</span></td>
                <td data-label="Categoría">
                    <select class="item-categoria">
                        <option value="">Seleccionar...</option>
                        ${categoriasList.map(cat => `
                            <option value="${cat.id}" ${item.categoria === cat.id ? 'selected' : ''}>${cat.nombre}</option>
                        `).join('')}
                    </select>
                </td>
                <td data-label="Unidad">
                    <select class="item-tipo-tecnologia">
                        <option value="servicio" ${item.tipoTecnologia === 'servicio' ? 'selected' : ''}>🔧 Servicio</option>
                        <option value="pieza" ${item.tipoTecnologia === 'pieza' ? 'selected' : ''}>⚙️ Pieza</option>
                        <option value="kit" ${item.tipoTecnologia === 'kit' ? 'selected' : ''}>📦 Kit</option>
                        <option value="par" ${item.tipoTecnologia === 'par' ? 'selected' : ''}>👥 Par</option>
                        <option value="cm" ${item.tipoTecnologia === 'cm' ? 'selected' : ''}>🐛 Centimetro</option>
                        <option value="m" ${item.tipoTecnologia === 'm' ? 'selected' : ''}>🚇 Metro</option>
                    </select>
                </td>
                <td data-label="Descripción">
                    <div class="rsi-producto-search-container-fila" style="position: relative;">
                        <input type="text" class="item-descripcion" value="${item.descripcion}" placeholder="Buscar o escribir producto...">
                        <div class="producto-dropdown-fila" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--rsi-radius-md); box-shadow: var(--shadow-lg); max-height: 150px; overflow-y: auto; z-index: 100;"></div>
                    </div>
                </td>
                <td data-label="Cantidad">
                    <input type="number" class="item-cantidad" value="${item.cantidad}" min="0.01" step="0.01">
                </td>
                <td data-label="Precio Unit.">
                    <input type="number" class="item-precio" value="${item.precio}" min="0" step="0.01">
                </td>
                <td data-label="Total" class="item-total">${formatCurrency(item.total)}</td>
                <td data-label="Acción">
                    <button type="button" class="rsi-btn-remove-item" title="Eliminar item">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    tbody.querySelectorAll('tr').forEach((row, index) => {
        const cantidadInput = row.querySelector('.item-cantidad');
        const precioInput = row.querySelector('.item-precio');
        const totalCell = row.querySelector('.item-total');
        const descripcionInput = row.querySelector('.item-descripcion');
        const categoriaSelect = row.querySelector('.item-categoria');
        const tipoSelect = row.querySelector('.item-tipo-tecnologia');
        const removeBtn = row.querySelector('.rsi-btn-remove-item');
        const dropdown = row.querySelector('.producto-dropdown-fila');
        
        descripcionInput.addEventListener('input', () => {
            const termino = descripcionInput.value.trim().toLowerCase();
            if (termino.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            const filtrados = productosList.filter(p => 
                p.nombre && p.nombre.toLowerCase().includes(termino)
            );
            mostrarOpcionesProductosFila(dropdown, filtrados, descripcionInput, precioInput, categoriaSelect);
        });
        
        descripcionInput.addEventListener('focus', () => {
            const termino = descripcionInput.value.trim().toLowerCase();
            if (termino.length >= 2) {
                const filtrados = productosList.filter(p => 
                    p.nombre && p.nombre.toLowerCase().includes(termino)
                );
                mostrarOpcionesProductosFila(dropdown, filtrados, descripcionInput, precioInput, categoriaSelect);
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.rsi-producto-search-container-fila')) {
                dropdown.style.display = 'none';
            }
        });
        
        const verificarProductoManual = async () => {
            const descripcion = descripcionInput.value.trim();
            const categoriaId = categoriaSelect.value;
            const precio = parseFloat(precioInput.value) || 0;
            
            if (!descripcion || !categoriaId || precio <= 0) return false;
            
            const existe = productosList.some(p => 
                p.nombre && p.nombre.toLowerCase() === descripcion.toLowerCase()
            );
            
            if (!existe) {
                const result = await Swal.fire({
                    title: 'Producto no registrado',
                    html: `
                        <div style="text-align: left; margin: 15px 0;">
                            <p style="font-size: 1.1rem; margin-bottom: 10px;">
                                <strong>${descripcion}</strong>
                            </p>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
                                <p style="margin: 5px 0;">Categoría: ${categoriaSelect.options[categoriaSelect.selectedIndex]?.text || 'Sin categoría'}</p>
                                <p style="margin: 5px 0;">Precio: ${formatCurrency(precio)}</p>
                            </div>
                            <p style="margin-top: 15px;">El producto no está registrado en la base de datos.</p>
                            <p style="font-weight: 600;">¿Deseas registrarlo?</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: '✅ Sí, registrar',
                    cancelButtonText: '❌ No, solo usar',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#6b7280',
                    allowOutsideClick: false
                });
                
                if (result.isConfirmed) {
                    mostrarLoading(true);
                    try {
                        const nuevoProductoResult = await productoServicioService.createProductoServicio({
                            nombre: descripcion,
                            precioUnitario: precio,
                            categoriaId: categoriaId,
                            activo: true
                        });
                        
                        if (nuevoProductoResult.success) {
                            mostrarAlerta('✅ Producto registrado exitosamente', 'success');
                            await loadProductos();
                            return true;
                        }
                    } catch (error) {
                        console.error('Error al registrar producto:', error);
                        mostrarAlerta('Error al registrar producto', 'error');
                    } finally {
                        mostrarLoading(false);
                    }
                }
            }
            return false;
        };
        
        const calcularFila = () => {
            const cantidad = parseFloat(cantidadInput.value) || 0;
            const precio = parseFloat(precioInput.value) || 0;
            const total = cantidad * precio;
            totalCell.textContent = formatCurrency(total);
            itemsData[index].cantidad = cantidad;
            itemsData[index].precio = precio;
            itemsData[index].total = total;
            calcularTotales();
            
            if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                cotizacionGuardadaTemporalmente = false;
                guardarCotizacionTemporal();
            }
        };
        
        cantidadInput.addEventListener('input', calcularFila);
        precioInput.addEventListener('input', calcularFila);
        
        descripcionInput.addEventListener('change', () => {
            itemsData[index].descripcion = descripcionInput.value;
        });
        
        categoriaSelect.addEventListener('change', () => {
            itemsData[index].categoria = categoriaSelect.value;
            itemsData[index].categoriaNombre = getCategoriaNombre(categoriaSelect.value);
        });
        
        tipoSelect.addEventListener('change', () => {
            itemsData[index].tipoTecnologia = tipoSelect.value;
        });
        
        const inputsFila = [categoriaSelect, tipoSelect, descripcionInput, cantidadInput, precioInput, removeBtn];
        inputsFila.forEach((input, i) => {
            if (!input) return;
            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const siguiente = inputsFila[i + 1];
                    
                    if (i === inputsFila.length - 2) {
                        await verificarProductoManual();
                        calcularFila();
                        
                        const filas = document.querySelectorAll('#itemsTableBody tr');
                        if (index === filas.length - 1) {
                            itemsData.push({
                                categoria: '',
                                categoriaNombre: '',
                                tipoTecnologia: 'pieza',
                                descripcion: '',
                                cantidad: 1,
                                precio: 0,
                                total: 0
                            });
                            renderItemsTable();
                            calcularTotales();
                            const nuevasFilas = document.querySelectorAll('#itemsTableBody tr');
                            const nuevaFila = nuevasFilas[nuevasFilas.length - 1];
                            const nuevoSelect = nuevaFila.querySelector('.item-categoria');
                            if (nuevoSelect) nuevoSelect.focus();
                        } else {
                            const siguienteFila = document.querySelectorAll('#itemsTableBody tr')[index + 1];
                            if (siguienteFila) {
                                const primerInput = siguienteFila.querySelector('.item-categoria');
                                if (primerInput) primerInput.focus();
                            }
                        }
                    } else if (siguiente) {
                        siguiente.focus();
                        if (siguiente.select) siguiente.select();
                    }
                }
            });
            eventListeners.push({ element: input, event: 'keydown', handler: () => {} });
        });
        
        removeBtn.addEventListener('click', () => {
            if (itemsData.length > 1) {
                itemsData.splice(index, 1);
                renderItemsTable();
                calcularTotales();
                
                if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                    cotizacionGuardadaTemporalmente = false;
                    guardarCotizacionTemporal();
                }
            } else {
                mostrarAlerta('Debe mantener al menos un item', 'warning');
            }
        });
        
        row.addEventListener('dragstart', () => {
            setTimeout(() => row.classList.add('dragging'), 0);
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
        });
    });
}

function mostrarOpcionesProductosFila(dropdown, productosFiltrados, descripcionInput, precioInput, categoriaSelect) {
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    dropdown.style.display = 'block';
    
    if (productosFiltrados.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'rsi-producto-option';
        noResults.innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 8px 12px;">No se encontraron productos</div>`;
        dropdown.appendChild(noResults);
    } else {
        productosFiltrados.slice(0, 10).forEach(producto => {
            const option = document.createElement('div');
            option.className = 'rsi-producto-option';
            option.style.padding = '8px 12px';
            option.style.cursor = 'pointer';
            option.style.borderBottom = '1px solid var(--rsi-gray-100)';
            option.innerHTML = `
                <strong>${producto.nombre}</strong>
                <div style="font-size: 0.8rem; color: var(--rsi-gray-500);">
                    Categoría: ${getCategoriaNombre(producto.categoriaId)} - Precio: ${formatCurrency(producto.precioUnitario || 0)}
                </div>
            `;
            option.addEventListener('click', () => {
                descripcionInput.value = producto.nombre || '';
                precioInput.value = producto.precioUnitario || 0;
                if (categoriaSelect && producto.categoriaId) {
                    categoriaSelect.value = producto.categoriaId;
                }
                dropdown.style.display = 'none';
                const row = descripcionInput.closest('tr');
                const index = parseInt(row.dataset.index);
                if (!isNaN(index) && itemsData[index]) {
                    itemsData[index].descripcion = producto.nombre || '';
                    itemsData[index].precio = producto.precioUnitario || 0;
                    itemsData[index].categoria = producto.categoriaId || '';
                    itemsData[index].categoriaNombre = getCategoriaNombre(producto.categoriaId);
                }
                calcularFila();
            });
            dropdown.appendChild(option);
        });
    }
}

function initItemHandlers() {
    const addBtn = document.getElementById('agregarItemBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            itemsData.push({
                categoria: '',
                categoriaNombre: '',
                tipoTecnologia: 'pieza',
                descripcion: '',
                cantidad: 1,
                precio: 0,
                total: 0
            });
            renderItemsTable();
            calcularTotales();
            
            if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                cotizacionGuardadaTemporalmente = false;
                guardarCotizacionTemporal();
            }
        });
        eventListeners.push({ element: addBtn, event: 'click', handler: () => {} });
    }
}

function initDragDrop() {
    const tbody = document.getElementById('itemsTableBody');
    
    tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingRow = document.querySelector('.dragging');
        if (!draggingRow) return;
        
        const afterElement = getDragAfterElement(tbody, e.clientY);
        if (afterElement == null) {
            tbody.appendChild(draggingRow);
        } else {
            tbody.insertBefore(draggingRow, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('tr:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// =================================================================================
// CÁLCULO DE TOTALES
// =================================================================================

function calcularTotales() {
    const items = getItemsFromTable();
    let subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    const descuentoPorcentaje = parseFloat(getFieldValue('descuento')) || 0;
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 0;
    
    const subtotalConIva = subtotal * (1 + impuestoPorcentaje / 100);
    const descuentoMonto = subtotalConIva * (descuentoPorcentaje / 100);
    const total = subtotalConIva - descuentoMonto;
    
    const subtotalEl = document.getElementById('subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    
    const totalEl = document.getElementById('total');
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    const detalle = document.getElementById('detalleOperaciones');
    if (detalle) {
        if (descuentoPorcentaje > 0 || impuestoPorcentaje > 0) {
            detalle.style.display = 'block';
            let detalleText = '';
            if (impuestoPorcentaje > 0) {
                detalleText += `Subtotal: ${formatCurrency(subtotal)} + IVA ${impuestoPorcentaje}% = ${formatCurrency(subtotalConIva)}`;
            }
            if (descuentoPorcentaje > 0) {
                if (detalleText) detalleText += ' ';
                detalleText += `- Descuento ${descuentoPorcentaje}% (${formatCurrency(descuentoMonto)}) = ${formatCurrency(total)}`;
            }
            const small = detalle.querySelector('small');
            if (small) small.textContent = detalleText;
        } else {
            detalle.style.display = 'none';
        }
    }
}

function calcularFila() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    rows.forEach((row, index) => {
        const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
        const total = cantidad * precio;
        const totalCell = row.querySelector('.item-total');
        if (totalCell) totalCell.textContent = formatCurrency(total);
        if (itemsData[index]) {
            itemsData[index].cantidad = cantidad;
            itemsData[index].precio = precio;
            itemsData[index].total = total;
        }
    });
    calcularTotales();
}

// =================================================================================
// LISTENERS PARA IVA Y DESCUENTO
// =================================================================================

function initTotalesListeners() {
    const descuentoInput = document.getElementById('descuento');
    const impuestoInput = document.getElementById('impuesto');
    
    if (descuentoInput) {
        descuentoInput.addEventListener('input', () => {
            calcularTotales();
            if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                cotizacionGuardadaTemporalmente = false;
                guardarCotizacionTemporal();
            }
        });
        eventListeners.push({ element: descuentoInput, event: 'input', handler: () => {} });
    }
    
    if (impuestoInput) {
        impuestoInput.addEventListener('input', () => {
            calcularTotales();
            if (document.getElementById('tipoCotizacion')?.value && document.getElementById('cotizacionNumero')?.value) {
                cotizacionGuardadaTemporalmente = false;
                guardarCotizacionTemporal();
            }
        });
        eventListeners.push({ element: impuestoInput, event: 'input', handler: () => {} });
    }
}

// =================================================================================
// OPCIONES DE CRÉDITO
// =================================================================================

function initCreditOptions() {
    const tipoCredito = document.getElementById('tipoCredito');
    if (tipoCredito) {
        tipoCredito.addEventListener('change', handleCreditOptions);
        eventListeners.push({ element: tipoCredito, event: 'change', handler: handleCreditOptions });
    }
}

function handleCreditOptions() {
    const tipo = document.getElementById('tipoCredito')?.value;
    const creditOptions = document.getElementById('creditOptions');
    if (tipo === 'credito' || tipo === 'debido') {
        if (creditOptions) creditOptions.style.display = 'block';
    } else {
        if (creditOptions) creditOptions.style.display = 'none';
        const diasCredito = document.getElementById('diasCredito');
        if (diasCredito) diasCredito.value = '';
    }
}

// =================================================================================
// EMPRESA
// =================================================================================

function initEmpresaChange() {
    const selector = document.getElementById('empresaSelector');
    if (selector) {
        selector.addEventListener('change', handleEmpresaChange);
        eventListeners.push({ element: selector, event: 'change', handler: handleEmpresaChange });
    }
}

function handleEmpresaChange() {
    const empresaSeleccionada = document.getElementById('empresaSelector')?.value || 'RSI NEZA';
    const empresaData = getEmpresaInfo(empresaSeleccionada);
    
    const direccionEl = document.getElementById('empresaDireccion');
    if (direccionEl) direccionEl.value = empresaData.direccion;
    
    const rfcEl = document.getElementById('empresaRFC');
    if (rfcEl) rfcEl.value = empresaData.rfc;
    
    const telefonoEl = document.getElementById('empresaTelefono');
    if (telefonoEl) telefonoEl.value = empresaData.telefono;
}

// =================================================================================
// CONTADOR DE DESCRIPCIÓN
// =================================================================================

function initDescripcionCounter() {
    const descripcion = document.getElementById('cotizacionDescripcion');
    const contador = document.getElementById('contadorCaracteres');
    if (descripcion && contador) {
        descripcion.addEventListener('input', () => {
            const length = descripcion.value.length;
            contador.textContent = `${length}/500 caracteres`;
            contador.style.color = length > 500 ? 'var(--rsi-danger)' : 'var(--rsi-gray-500)';
        });
        eventListeners.push({ element: descripcion, event: 'input', handler: () => {} });
    }
}

// =================================================================================
// BOTÓN CANCELAR
// =================================================================================

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
                    window.navigateTo('/partner/crudCotizaciones');
                } else {
                    window.location.href = '/partner/crudCotizaciones';
                }
            }
        });
    };
    
    cancelBtn.addEventListener('click', handler);
    eventListeners.push({ element: cancelBtn, event: 'click', handler });
}

// =================================================================================
// ACTUALIZAR CONFIRMACIÓN
// =================================================================================

function updateConfirmacion() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };
    
    setText('confirmClienteNombre', getFieldValue('clienteNombre'));
    setText('confirmClienteRFC', getFieldValue('clienteRFC'));
    setText('confirmClienteDireccion', getFieldValue('clienteDireccion'));
    setText('confirmClienteTelefono', getFieldValue('clienteTelefono'));
    
    setText('confirmNumero', getFieldValue('cotizacionNumero'));
    const tipos = { 'implementacion': 'Implementación', 'proyecto': 'Proyecto', 'servicio': 'Servicio', 'pruebaTI': 'Prueba TI' };
    const tipoSeleccionado = getFieldValue('tipoCotizacion');
    setText('confirmTipo', tipos[tipoSeleccionado] || tipoSeleccionado || '-');
    setText('confirmFecha', getFieldValue('cotizacionFecha'));
    setText('confirmVigencia', getFieldValue('cotizacionVigencia') + ' días');
    setText('confirmMoneda', getFieldValue('cotizacionMoneda'));
    
    const tipoCredito = getFieldValue('tipoCredito');
    const diasCredito = getFieldValue('diasCredito');
    let pagoText = tipoCredito || '-';
    if (tipoCredito === 'credito' && diasCredito) pagoText += ` (${diasCredito} días)`;
    setText('confirmPago', pagoText);
    
    const items = getItemsFromTable();
    const itemsContainer = document.getElementById('confirmItemsList');
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<p style="color: var(--rsi-gray-500);">No hay items agregados</p>';
        } else {
            let itemsHtml = '';
            items.forEach(item => {
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                        <span>${item.descripcion}</span>
                        <span>${item.cantidad} x ${formatCurrency(item.precio)} = ${formatCurrency(item.total)}</span>
                    </div>
                `;
            });
            itemsContainer.innerHTML = itemsHtml;
        }
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const descuentoPorcentaje = parseFloat(getFieldValue('descuento')) || 0;
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 0;
    
    const subtotalConIva = subtotal * (1 + impuestoPorcentaje / 100);
    const descuentoMonto = subtotalConIva * (descuentoPorcentaje / 100);
    const total = subtotalConIva - descuentoMonto;
    
    setText('confirmSubtotal', formatCurrency(subtotal));
    setText('confirmDescuento', `${descuentoPorcentaje}%`);
    setText('confirmImpuesto', `${impuestoPorcentaje}%`);
    setText('confirmTotal', formatCurrency(total));
    
    const detalle = document.getElementById('confirmDetalleOperaciones');
    if (detalle) {
        if (descuentoPorcentaje > 0 || impuestoPorcentaje > 0) {
            detalle.style.display = 'block';
            let detalleText = '';
            if (impuestoPorcentaje > 0) {
                detalleText += `Subtotal: ${formatCurrency(subtotal)} + IVA ${impuestoPorcentaje}% = ${formatCurrency(subtotalConIva)}`;
            }
            if (descuentoPorcentaje > 0) {
                if (detalleText) detalleText += ' ';
                detalleText += `- Descuento ${descuentoPorcentaje}% (${formatCurrency(descuentoMonto)}) = ${formatCurrency(total)}`;
            }
            const small = detalle.querySelector('small');
            if (small) small.textContent = detalleText;
        } else {
            detalle.style.display = 'none';
        }
    }
}

// =================================================================================
// RESET FORM
// =================================================================================

function resetForm() {
    const form = document.getElementById('cotizacionForm');
    if (form) form.reset();
    
    setFieldValue('tipoCotizacion', '');
    setFieldValue('cotizacionNumero', '');
    setFieldValue('cotizacionFecha', new Date().toISOString().split('T')[0]);
    setFieldValue('cotizacionVigencia', 30);
    setFieldValue('cotizacionMoneda', 'MXN');
    setFieldValue('descuento', 0);
    setFieldValue('impuesto', 16);
    
    const creditOptions = document.getElementById('creditOptions');
    if (creditOptions) creditOptions.style.display = 'none';
    
    setFieldValue('diasCredito', '');
    
    const terminos = document.getElementById('terminos');
    if (terminos) {
        terminos.value = `1. La presente cotización se realiza en base a los requerimientos necesarios para la solución tecnológica.
2. Condiciones de pago, 70% de anticipo y 30% al término de la instalación y funcionamiento.
3. En caso de cancelación tendrá una penalización del 20% en el total de la cotización.
4. Trabajo adicional que no esté dentro de la cotización tendrá un costo extra.
5. Los equipos tienen un año de garantía por defecto de fábrica.
6. La instalación tendrá la garantía de 2 meses siempre y cuando no cuente con daños o manipulación.`;
    }
    
    itemsData = [{
        categoria: '',
        categoriaNombre: '',
        tipoTecnologia: 'pieza',
        descripcion: '',
        cantidad: 1,
        precio: 0,
        total: 0
    }];
    renderItemsTable();
    calcularTotales();
    activarEntradaManual();
    tipoCotizacionBloqueado = false;
    clienteSeleccionadoId = null;
    cotizacionTemporalId = null;
    cotizacionGuardadaTemporalmente = false;
    
    const tipoCotizacionSelect = document.getElementById('tipoCotizacion');
    if (tipoCotizacionSelect) {
        tipoCotizacionSelect.disabled = false;
        tipoCotizacionSelect.style.backgroundColor = '';
        tipoCotizacionSelect.style.cursor = '';
    }
}

// =================================================================================
// ENVÍO DEL FORMULARIO (CON STORAGE)
// =================================================================================

function initSubmitHandler() {
    const submitBtn = document.getElementById('submitCotizacion');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

async function handleSubmit() {
    const submitBtn = document.getElementById('submitCotizacion');
    
    try {
        if (!validateCurrentStep()) {
            return;
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }
        
        // Obtener TODOS los datos del cliente
        const clienteNombre = getFieldValue('clienteNombre') || 'Cliente sin nombre';
        const clienteRFC = getFieldValue('clienteRFC') || '';
        const clienteDireccion = getFieldValue('clienteDireccion') || 'Sin dirección';
        const clienteTelefono = getFieldValue('clienteTelefono') || '';
        const clienteEmail = getFieldValue('clienteEmail') || '';
        const clienteRazonSocial = getFieldValue('clienteRazonSocial') || clienteNombre;
        const clienteNombreComercial = getFieldValue('clienteNombreComercial') || '';
        const clienteRegimen = getFieldValue('clienteRegimen') || 'Sin régimen';
        const clienteRegimenCodigo = getFieldValue('clienteRegimenCodigo') || '';
        const clienteCodigoPostal = getFieldValue('clienteCodigoPostal') || '00000';
        const clienteTipoVialidad = getFieldValue('clienteTipoVialidad') || '';
        const clienteNombreVialidad = getFieldValue('clienteNombreVialidad') || '';
        const clienteNumeroExterior = getFieldValue('clienteNumeroExterior') || '';
        const clienteNumeroInterior = getFieldValue('clienteNumeroInterior') || '';
        const clienteColonia = getFieldValue('clienteColonia') || '';
        const clienteLocalidad = getFieldValue('clienteLocalidad') || '';
        const clienteMunicipio = getFieldValue('clienteMunicipio') || '';
        const clienteEstado = getFieldValue('clienteEstado') || '';
        const clienteTelefonoFijo = getFieldValue('clienteTelefonoFijo') || '';
        
        const tipoCotizacion = getFieldValue('tipoCotizacion');
        const cotizacionNumero = getFieldValue('cotizacionNumero');
        const cotizacionFecha = getFieldValue('cotizacionFecha');
        const cotizacionVigencia = getFieldValue('cotizacionVigencia') || 30;
        const cotizacionMoneda = getFieldValue('cotizacionMoneda') || 'MXN';
        const tipoCredito = getFieldValue('tipoCredito');
        const diasCredito = getFieldValue('diasCredito');
        const cotizacionDescripcion = getFieldValue('cotizacionDescripcion');
        const terminos = getFieldValue('terminos');
        const empresaSelector = getFieldValue('empresaSelector') || 'RSI NEZA';
        const descuento = parseFloat(getFieldValue('descuento')) || 0;
        const impuesto = parseFloat(getFieldValue('impuesto')) || 16;
        
        const items = getItemsFromTable();
        if (items.length === 0) {
            mostrarAlerta('Debe agregar al menos un item', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> <span id="submitBtnText">${isEditMode ? 'Actualizar Cotización' : 'Generar Cotización'}</span>`;
            }
            return;
        }
        
        const empresaInfo = getEmpresaInfo(empresaSelector);
        
        const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const subtotalConIva = subtotal * (1 + impuesto / 100);
        const descuentoMonto = subtotalConIva * (descuento / 100);
        const totalFinal = subtotalConIva - descuentoMonto;
        
        const cotizacionData = {
            clienteId: clienteSeleccionadoId || '',
            clienteNombre: clienteNombre,
            clienteRFC: clienteRFC,
            clienteDireccion: clienteDireccion,
            clienteTelefono: clienteTelefono,
            clienteEmail: clienteEmail,
            clienteRazonSocial: clienteRazonSocial,
            clienteNombreComercial: clienteNombreComercial,
            clienteRegimen: clienteRegimen,
            clienteRegimenCodigo: clienteRegimenCodigo,
            clienteCodigoPostal: clienteCodigoPostal,
            clienteTipoVialidad: clienteTipoVialidad,
            clienteNombreVialidad: clienteNombreVialidad,
            clienteNumeroExterior: clienteNumeroExterior,
            clienteNumeroInterior: clienteNumeroInterior,
            clienteColonia: clienteColonia,
            clienteLocalidad: clienteLocalidad,
            clienteMunicipio: clienteMunicipio,
            clienteEstado: clienteEstado,
            clienteTelefonoFijo: clienteTelefonoFijo,
            cotizacionNumero: cotizacionNumero,
            cotizacionFecha: cotizacionFecha,
            cotizacionVigencia: cotizacionVigencia || '30',
            cotizacionMoneda: cotizacionMoneda || 'MXN',
            cotizacionDescripcion: cotizacionDescripcion || '',
            tipoCotizacion: tipoCotizacion,
            empresaSelector: empresaSelector,
            empresaNombre: empresaInfo.nombre,
            empresaDireccion: empresaInfo.direccion,
            empresaRFC: empresaInfo.rfc,
            empresaTelefono: empresaInfo.telefono,
            items: items.map(item => ({
                categoria: item.categoria || '',
                categoriaNombre: item.categoriaNombre || getCategoriaNombre(item.categoria),
                tipoTecnologia: item.tipoTecnologia || 'pieza',
                descripcion: item.descripcion || 'Sin descripción',
                cantidad: item.cantidad || 1,
                precio: item.precio || 0,
                total: (item.cantidad || 1) * (item.precio || 0)
            })),
            subtotal: subtotal,
            descuento: descuento.toString(),
            descuentoMonto: descuentoMonto,
            impuesto: impuesto.toString(),
            impuestoMonto: subtotalConIva - subtotal,
            totalFinal: totalFinal,
            tipoCredito: tipoCredito || '',
            diasCredito: (tipoCredito === 'credito' || tipoCredito === 'debido') ? diasCredito : '',
            terminos: terminos || '',
            esEntradaManual: isManualEntry,
            estatus: 'en proceso',
            estado: 'completada',
            creadoPor: currentUser ? currentUser.uid : '',
            modificadoPor: currentUser ? currentUser.uid : '',
            pdfUrl: ''
        };

        console.log('📤 Enviando cotización completada:', {
            clienteId: cotizacionData.clienteId,
            clienteNombre: cotizacionData.clienteNombre,
            clienteRazonSocial: cotizacionData.clienteRazonSocial,
            clienteDireccion: cotizacionData.clienteDireccion,
            itemsCount: cotizacionData.items.length,
            totalFinal: cotizacionData.totalFinal
        });

        let result;
        let cotizacionId;
        
        // ✅ 1. Generar el PDF antes de guardar
        let pdfBlob = null;
        let pdfGenerationError = null;
        
        try {
            pdfBlob = await generarPDFCotizacion(cotizacionData, LOGO_URL);
        } catch (pdfError) {
            console.error('❌ Error generando PDF:', pdfError);
            pdfGenerationError = pdfError.message || 'Error al generar el PDF';
        }
        
        // ✅ 2. Guardar la cotización en Firestore
        if (isEditMode && editingId) {
            result = await cotizacionService.updateCotizacion(editingId, cotizacionData, true);
            cotizacionId = editingId;
        } else {
            if (cotizacionTemporalId) {
                result = await cotizacionService.updateCotizacion(cotizacionTemporalId, cotizacionData, true);
                cotizacionId = cotizacionTemporalId;
            } else {
                result = await cotizacionService.createCotizacion(cotizacionData, true);
                cotizacionId = result.id;
            }
        }
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        // ✅ 3. Subir el PDF a Storage (si se generó correctamente)
        let pdfUrl = '';
        let storageSuccess = false;
        let storageMessage = '';
        
        if (pdfBlob) {
            const storageResult = await manejarPDFStorage(cotizacionData, pdfBlob, isEditMode);
            storageSuccess = storageResult.success;
            pdfUrl = storageResult.url || '';
            storageMessage = storageResult.message;
            
            // ✅ 4. Actualizar la cotización con la URL del PDF
            if (pdfUrl) {
                await cotizacionService.updateCotizacion(cotizacionId, { pdfUrl }, false);
                console.log('✅ PDF URL guardada en Firestore:', pdfUrl);
            }
        } else {
            storageMessage = pdfGenerationError || 'No se pudo generar el PDF';
        }
        
        // ✅ 5. Mostrar mensaje según el resultado
        let mensajeHTML = `
            <div style="text-align: left;">
                <p><strong>Cotización:</strong> ${cotizacionNumero}</p>
                <p><strong>Cliente:</strong> ${clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(totalFinal)}</p>
                <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
        `;
        
        if (storageSuccess && pdfUrl) {
            mensajeHTML += `
                <p style="color: var(--rsi-success);">
                    <i class="fas fa-check-circle"></i> ✅ PDF almacenado en la nube
                </p>
                <p style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                    <i class="fas fa-share-alt"></i> Puedes compartir este PDF por correo electrónico o WhatsApp
                </p>
            `;
        } else {
            mensajeHTML += `
                <p style="color: var(--rsi-warning);">
                    <i class="fas fa-exclamation-triangle"></i> ⚠️ Cotización guardada, pero no se almacenó en la nube
                </p>
                <p style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                    ${storageMessage || 'El PDF se ha descargado localmente, pero no está disponible en la nube.'}
                </p>
            `;
        }
        
        mensajeHTML += `</div>`;
        
        // ✅ 6. Preguntar si desea descargar el PDF
        const resultSwal = await Swal.fire({
            icon: storageSuccess ? 'success' : 'warning',
            title: storageSuccess ? '¡Cotización creada!' : '¡Cotización guardada!',
            html: mensajeHTML,
            showCancelButton: true,
            confirmButtonText: '📥 Descargar PDF',
            cancelButtonText: '📋 Ir al listado',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d',
            reverseButtons: false
        });
        
        if (resultSwal.isConfirmed && pdfBlob) {
            // Descargar PDF
            const pdfUrlLocal = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = pdfUrlLocal;
            link.download = `cotizacion-${cotizacionNumero}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(pdfUrlLocal);
            
            mostrarAlerta('✅ PDF descargado correctamente', 'success');
        }
        
        // Redirigir al CRUD
        setTimeout(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudCotizaciones');
            } else {
                window.location.href = '/partner/crudCotizaciones';
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar la cotización';
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
            submitBtn.innerHTML = `<i class="fas fa-save"></i> <span id="submitBtnText">${isEditMode ? 'Actualizar Cotización' : 'Generar Cotización'}</span>`;
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
export function destroyCotizacionFormController() {
    console.log('🧹 Destroying CotizacionFormController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    cotizacionService = null;
    clienteService = null;
    productoServicioService = null;
    categoriaService = null;
    contadorService = null;
    storageService = null;
    editingId = null;
    isEditMode = false;
    clientesList = [];
    productosList = [];
    categoriasList = [];
    currentUser = null;
    itemsData = [];
    cotizacionTemporalId = null;
    clienteSeleccionadoId = null;
    cotizacionGuardadaTemporalmente = false;
}

export default cotizacionFormController;