/* ========================================
   FACTURA FORM CONTROLLER
   Controlador para crear/editar una factura
   ======================================== */

import FacturaService from '../../services/facturaService.js';
import CotizacionService from '../../services/cotizacionService.js';
import ClienteService from '../../services/clienteService.js';
import ProductoServicioService from '../../services/productoServicioService.js';
import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';
import StorageService from '../../services/storageService.js';
import { generarPDFFactura } from '../../utils/pdfGenerator.js';
import FacturaModel from '../../models/facturaModel.js';
import { 
    USOS_CFDI, 
    METODOS_PAGO, 
    FORMAS_PAGO, 
    validarCompatibilidadUsoCFDI, 
    getUsosCFDICompatibles, 
    obtenerUsoCFDI, 
    obtenerFormaPago, 
    obtenerMetodoPago 
} from '../../utils/regimenesSat.js';

let facturaService = null;
let cotizacionService = null;
let clienteService = null;
let productoServicioService = null;
let categoriaService = null;
let storageService = null;
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
let productosList = [];
let categoriasList = [];
let clientesList = [];
let itemsData = [];
let isFromCotizacion = false;
let clienteSeleccionadoId = null;
let isManualEntry = false;
let busquedaSatTimeout = null;
let isSubmitting = false;
let ultimaFormaPagoPUE = '01';

// Logo para PDF
const LOGO_URL = '/assets/icons/logo.png';

/**
 * Funcion helper para asignar valor a un elemento del DOM de forma segura
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
 * Funcion helper para obtener el valor de un campo de forma segura
 */
function getFieldValue(fieldId) {
    const el = document.getElementById(fieldId);
    return el ? (el.value || '') : '';
}

/**
 * Inicializa el controlador del formulario
 */
export async function facturaFormController() {
    console.log('Factura Form Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    // Inicializar servicios
    facturaService = new FacturaService();
    cotizacionService = new CotizacionService();
    clienteService = new ClienteService();
    productoServicioService = new ProductoServicioService();
    categoriaService = new CategoriaProductoServicioService();
    storageService = new StorageService();
    
    eventListeners = [];
    editingId = null;
    isEditMode = false;
    currentStep = 1;
    isNavigating = false;
    cotizacionData = null;
    facturaData = {};
    currentUser = null;
    cotizacionId = null;
    productosList = [];
    categoriasList = [];
    clientesList = [];
    itemsData = [];
    isFromCotizacion = false;
    clienteSeleccionadoId = null;
    isManualEntry = false;
    busquedaSatTimeout = null;
    
    // Cargar usuario actual
    await loadCurrentUser();
    
    // Cargar datos necesarios
    await loadClientes();
    await loadProductos();
    await loadCategorias();
    
    // Inicializar eventos y controles primero
    initUsoCFDI();
    initMetodoPagoHandler();
    initStepNavigation();
    initFieldValidation();
    initSubmitHandlers();
    initCancelButton();
    initClienteSearch();
    initProductoSearch();
    initItemHandlers();
    initTotalesListeners();
    
    // Verificar si hay ID en la URL (modo edicion)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const cotId = urlParams.get('cotizacionId');
    
    if (id) {
        editingId = id;
        isEditMode = true;
        console.log('Modo edicion - Factura ID:', editingId);
        await loadFacturaData(editingId);
    } else if (cotId) {
        cotizacionId = cotId;
        isFromCotizacion = true;
        console.log('Nueva factura desde cotizacion:', cotizacionId);
        await loadCotizacionData(cotizacionId);
    } else {
        console.log('Nueva factura desde cero');
        initEmptyFactura();
    }
    
    // Ir al paso 1
    goToStep(1);
    
    console.log(`Factura Form Controller listo (${isEditMode ? 'Edicion' : isFromCotizacion ? 'Desde Cotizacion' : 'Desde cero'})`);
}

/**
 * Carga el usuario actual desde localStorage
 */
async function loadCurrentUser() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (!session) {
            throw new Error('No hay sesion activa');
        }
        const sessionData = JSON.parse(session);
        currentUser = {
            uid: sessionData.uid || '',
            email: sessionData.email || '',
            nombre: sessionData.nombreCompleto || sessionData.displayName || 'Usuario'
        };
        console.log('Usuario cargado:', currentUser);
    } catch (error) {
        console.error('Error cargando usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Acceso no autorizado',
            text: 'Debes iniciar sesion para acceder a esta funcion',
            confirmButtonText: 'Iniciar sesion',
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
        console.log(`Clientes cargados: ${clientesList.length}`);
    } catch (error) {
        console.error('Error cargando clientes:', error);
        clientesList = [];
    }
}

/**
 * Carga la lista de productos/servicios
 */
async function loadProductos() {
    try {
        const productos = await productoServicioService.getAllProductosServicios();
        productosList = productos.filter(p => p.activo !== false);
        console.log(`Productos cargados: ${productosList.length}`);
    } catch (error) {
        console.error('Error cargando productos:', error);
        productosList = [];
    }
}

/**
 * Carga la lista de categorias
 */
async function loadCategorias() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasList = categorias.map(cat => ({
            id: cat.id,
            nombre: cat.nombreCategoria || 'Sin nombre'
        }));
        console.log(`Categorias cargadas: ${categoriasList.length}`);
    } catch (error) {
        console.error('Error cargando categorias:', error);
        categoriasList = [];
    }
}

/**
 * Obtiene el nombre de una categoria por su ID
 */
function getCategoriaNombre(categoriaId) {
    if (!categoriaId) return 'Sin categoria';
    const categoria = categoriasList.find(c => c.id === categoriaId);
    return categoria ? categoria.nombre : 'Sin categoria';
}

/**
 * Inicializa factura vacia (desde cero)
 */
function initEmptyFactura() {
    const today = new Date().toISOString().split('T')[0];
    const facturaNumero = generateFacturaNumero();
    
    facturaData = {
        facturaNumero: facturaNumero,
        facturaFecha: today,
        facturaDescripcion: '',
        items: [],
        subtotal: 0,
        impuesto: '16',
        impuestoMonto: 0,
        totalFinal: 0,
        estatus: 'borrador',
        metodoPago: 'PUE',
        formaPago: '01',
        usoCFDI: 'G01',
        clienteNombre: '',
        clienteRFC: '',
        clienteRazonSocial: '',
        clienteRegimenCodigo: '',
        clienteCodigoPostal: '',
        clienteDireccion: '',
        clienteEmail: '',
        clienteTelefono: ''
    };
    
    setFieldValue('facturaNumero', facturaNumero);
    setFieldValue('facturaFecha', today);
    setFieldValue('facturaDescripcion', '');
    setFieldValue('impuesto', 16);
    populateUsoCFDIOptions('G01');
    setFieldValue('usoCFDI', 'G01');
    setFieldValue('metodoPago', 'PUE');
    setFieldValue('formaPago', '01');
    ultimaFormaPagoPUE = '01';
    actualizarEstadoMetodoPago('PUE');
    
    itemsData = [];
    renderItemsTable();
    calcularTotales();
    
    ['clienteNombre', 'clienteRFC', 'clienteRazonSocial', 'clienteRegimenCodigo', 
     'clienteCodigoPostal', 'clienteDireccion', 'clienteEmail', 'clienteTelefono',
     'clienteSearch'].forEach(id => {
        setFieldValue(id, '');
    });
    
    const cotizacionOrigenGroup = document.querySelector('.rsi-cotizacion-origen-group');
    if (cotizacionOrigenGroup) {
        cotizacionOrigenGroup.style.display = 'none';
    }
}

/**
 * Genera un numero de factura
 */
function generateFacturaNumero() {
    const fecha = new Date();
    const fechaStr = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `FAC-${fechaStr}-${random}`;
}

// =================================================================================
// CARGA DE COTIZACION (con verificación de claves SAT)
// =================================================================================

/**
 * Carga los datos de la cotizacion para crear la factura
 */
async function loadCotizacionData(cotId) {
    try {
        mostrarLoading(true);
        
        const cotizacion = await cotizacionService.getCotizacionById(cotId);
        if (!cotizacion) {
            throw new Error('Cotizacion no encontrada');
        }
        
        cotizacionData = cotizacion;
        facturaData = FacturaModel.fromCotizacion(cotizacion, generateFacturaNumero());
        
        // VERIFICAR CLAVES SAT DE LOS ITEMS DE LA COTIZACION
        const itemsFromCotizacion = cotizacion.items || [];
        const itemsConClave = [];
        let necesitaClave = false;
        
        for (const item of itemsFromCotizacion) {
            // Buscar el producto en productosList por nombre (coincidencia exacta)
            const producto = productosList.find(p => 
                p.nombre && p.nombre.toLowerCase() === item.descripcion.toLowerCase()
            );
            
            if (producto) {
                // Si el producto existe en la base de datos
                if (producto.claveSat && producto.claveSat.trim() !== '') {
                    // Tiene clave SAT, usarla
                    itemsConClave.push({
                        ...item,
                        productId: producto.id,
                        claveSat: producto.claveSat,
                        categoria: producto.categoriaId || item.categoria,
                        categoriaNombre: getCategoriaNombre(producto.categoriaId) || item.categoriaNombre,
                        precio: producto.precioUnitario || item.precio
                    });
                } else {
                    // No tiene clave SAT - marcar para solicitar
                    necesitaClave = true;
                    itemsConClave.push({
                        ...item,
                        productId: producto.id,
                        claveSat: '',
                        necesitaClave: true,
                        productoNombre: producto.nombre
                    });
                }
            } else {
                // Producto no encontrado en la base de datos - item personalizado
                itemsConClave.push({
                    ...item,
                    productId: null,
                    claveSat: '',
                    necesitaClave: false
                });
            }
        }
        
        // Si hay productos sin clave SAT, solicitar al usuario
        if (necesitaClave) {
            const itemsSinClave = itemsConClave.filter(item => item.necesitaClave);
            
            const confirmar = await Swal.fire({
                title: 'Productos sin clave SAT',
                html: `
                    <div style="text-align: left; margin: 15px 0;">
                        <p style="color: #dc3545; font-weight: 600; font-size: 0.95rem;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            Los siguientes productos no tienen clave SAT:
                        </p>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 8px 0;">
                            ${itemsSinClave.map((item, i) => 
                                `<p style="margin: 3px 0; font-size: 0.9rem;">${i + 1}. ${item.productoNombre || item.descripcion}</p>`
                            ).join('')}
                        </div>
                        <p style="color: #6b7280; font-size: 0.85rem;">
                            La clave se guardara en el producto para futuras facturas.
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Asignar claves',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#6b7280',
                allowOutsideClick: false
            });
            
            if (!confirmar.isConfirmed) {
                mostrarLoading(false);
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/commercial/cotizaciones');
                } else {
                    window.location.href = '/commercial/cotizaciones';
                }
                return;
            }
            
            // Asignar claves una por una
            for (const item of itemsSinClave) {
                const result = await verificarClaveSatProducto(item.productId, item.productoNombre || item.descripcion);
                if (result.tieneClave) {
                    item.claveSat = result.claveSat;
                    item.necesitaClave = false;
                    const idx = itemsConClave.indexOf(item);
                    if (idx !== -1) {
                        itemsConClave[idx].claveSat = result.claveSat;
                        itemsConClave[idx].necesitaClave = false;
                    }
                } else {
                    mostrarAlerta(`No se pudo asignar clave SAT para "${item.descripcion}"`, 'error');
                    mostrarLoading(false);
                    return;
                }
            }
        }
        
        // Asignar itemsData con las claves
        itemsData = itemsConClave.map(item => ({
            productId: item.productId || null,
            categoria: item.categoria || '',
            categoriaNombre: item.categoriaNombre || getCategoriaNombre(item.categoria),
            tipoTecnologia: item.tipoTecnologia || 'pieza',
            descripcion: item.descripcion || '',
            cantidad: item.cantidad || 1,
            precio: item.precio || 0,
            total: (item.cantidad || 1) * (item.precio || 0),
            claveSat: item.claveSat || ''
        }));
        
        // Cargar datos del cliente
        clienteSeleccionadoId = cotizacion.clienteId || null;
        
        setFieldValue('clienteNombre', facturaData.clienteNombre);
        setFieldValue('clienteRFC', facturaData.clienteRFC);
        setFieldValue('clienteRazonSocial', facturaData.clienteRazonSocial);
        setFieldValue('clienteRegimenCodigo', facturaData.clienteRegimenCodigo);
        setFieldValue('clienteCodigoPostal', facturaData.clienteCodigoPostal);
        setFieldValue('clienteDireccion', facturaData.clienteDireccion);
        setFieldValue('clienteEmail', facturaData.clienteEmail);
        setFieldValue('clienteTelefono', facturaData.clienteTelefono);
        setFieldValue('clienteSearch', facturaData.clienteRazonSocial || facturaData.clienteNombre);
        
        setFieldValue('facturaNumero', facturaData.facturaNumero);
        setFieldValue('facturaFecha', facturaData.facturaFecha);
        setFieldValue('cotizacionNumero', facturaData.cotizacionNumero);
        setFieldValue('facturaDescripcion', facturaData.facturaDescripcion);
        setFieldValue('impuesto', facturaData.impuesto || 16);
        
        populateUsoCFDIOptions(facturaData.usoCFDI || 'G01', facturaData.clienteRegimenCodigo, facturaData.clienteRFC);
        setFieldValue('usoCFDI', facturaData.usoCFDI || 'G01');
        const metodoCot = facturaData.metodoPago || 'PUE';
        const formaCot = (metodoCot === 'PPD') ? '99' : (facturaData.formaPago || '01');
        if (metodoCot === 'PUE' && formaCot !== '99') {
            ultimaFormaPagoPUE = formaCot;
        }
        setFieldValue('metodoPago', metodoCot);
        setFieldValue('formaPago', formaCot);
        actualizarEstadoMetodoPago(metodoCot);
        
        const cotizacionOrigenGroup = document.querySelector('.rsi-cotizacion-origen-group');
        if (cotizacionOrigenGroup) {
            cotizacionOrigenGroup.style.display = 'block';
        }
        
        // Bloquear campos de cliente (vienen de cotizacion)
        ['clienteNombre', 'clienteRFC', 'clienteRazonSocial', 'clienteRegimenCodigo',
         'clienteCodigoPostal', 'clienteDireccion', 'clienteTelefono', 'clienteEmail'].forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.readOnly = true;
                field.style.backgroundColor = '#f0f9ff';
            }
        });
        
        renderItemsTable();
        calcularTotales();
        
        console.log('Datos de cotizacion cargados para factura');
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error cargando cotizacion:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la cotizacion: ' + error.message,
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
 * Carga los datos de la factura para edicion
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
        itemsData = factura.items || [];
        clienteSeleccionadoId = factura.clienteId || null;
        
        setFieldValue('clienteNombre', factura.clienteNombre);
        setFieldValue('clienteRFC', factura.clienteRFC);
        setFieldValue('clienteRazonSocial', factura.clienteRazonSocial);
        setFieldValue('clienteRegimenCodigo', factura.clienteRegimenCodigo);
        setFieldValue('clienteCodigoPostal', factura.clienteCodigoPostal);
        setFieldValue('clienteDireccion', factura.clienteDireccion);
        setFieldValue('clienteEmail', factura.clienteEmail);
        setFieldValue('clienteTelefono', factura.clienteTelefono);
        setFieldValue('clienteSearch', factura.clienteRazonSocial || factura.clienteNombre);
        
        setFieldValue('facturaNumero', factura.facturaNumero);
        setFieldValue('facturaFecha', factura.facturaFecha);
        setFieldValue('cotizacionNumero', factura.cotizacionNumero);
        setFieldValue('facturaDescripcion', factura.facturaDescripcion);
        setFieldValue('impuesto', factura.impuesto || 16);
        
        populateUsoCFDIOptions(factura.usoCFDI || 'G01', factura.clienteRegimenCodigo, factura.clienteRFC);
        setFieldValue('usoCFDI', factura.usoCFDI || 'G01');
        const metodoFactura = factura.metodoPago || 'PUE';
        const formaFactura = (metodoFactura === 'PPD') ? '99' : (factura.formaPago || '01');
        if (metodoFactura === 'PUE' && formaFactura !== '99') {
            ultimaFormaPagoPUE = formaFactura;
        }
        setFieldValue('metodoPago', metodoFactura);
        setFieldValue('formaPago', formaFactura);
        actualizarEstadoMetodoPago(metodoFactura);
        
        renderItemsTable();
        calcularTotales();
        
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
        
        if (factura.estatus === 'timbrada' && factura.timbrado) {
            document.getElementById('timbradoInfo').style.display = 'block';
            document.getElementById('timbradoUUID').textContent = factura.timbrado.uuid || '-';
            document.getElementById('timbradoFecha').textContent = factura.timbrado.fechaTimbrado || '-';
            document.getElementById('timbradoNoCertificado').textContent = factura.timbrado.noCertificado || '-';
        }
        
        console.log('Datos de factura cargados:', factura.facturaNumero);
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('Error cargando factura:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la factura: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudFacturas');
            } else {
                window.location.href = '/partner/crudFacturas';
            }
        });
    }
}

// =================================================================================
// BUSQUEDA DE CLIENTES
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
                <div class="cliente-info">RFC: ${cliente.rfc || 'Sin RFC'}</div>
                <div class="cliente-info" style="font-size: 0.7rem; color: #6b7280;">${cliente.regimen || 'Sin regimen'}</div>
            `;
            option.addEventListener('click', () => seleccionarCliente(cliente));
            dropdown.appendChild(option);
        });
    }
    
    if (termino && termino.length >= 2) {
        const nuevoClienteOption = document.createElement('div');
        nuevoClienteOption.className = 'rsi-cliente-option manual';
        nuevoClienteOption.innerHTML = `
            <strong>+ Agregar "${termino}"</strong>
            <div class="cliente-info">Crear nuevo cliente con este nombre</div>
        `;
        nuevoClienteOption.addEventListener('click', () => agregarNuevoCliente(termino));
        dropdown.appendChild(nuevoClienteOption);
    }
    
    const manualOption = document.createElement('div');
    manualOption.className = 'rsi-cliente-option manual';
    manualOption.innerHTML = `
        <strong>Editar Manual</strong>
        <div class="cliente-info">Escribir datos del cliente manualmente</div>
    `;
    manualOption.addEventListener('click', activarEntradaManual);
    dropdown.appendChild(manualOption);
}

function seleccionarCliente(cliente) {
    isManualEntry = false;
    clienteSeleccionadoId = cliente.id || null;
    
    console.log('Seleccionando cliente:', cliente);
    
    setFieldValue('clienteSearch', cliente.razonSocial || cliente.nombre || '');
    setFieldValue('clienteNombre', cliente.nombre || '');
    setFieldValue('clienteRFC', cliente.rfc || '');
    
    const direccionParts = [
        cliente.nombreVialidad || '',
        cliente.numeroExterior || '',
        cliente.colonia || '',
        cliente.municipio || '',
        cliente.estado || ''
    ].filter(Boolean);
    setFieldValue('clienteDireccion', direccionParts.join(', ') || cliente.contacto1 || '');
    
    setFieldValue('clienteTelefono', cliente.telefonoMovil || cliente.telefono1 || '');
    setFieldValue('clienteEmail', cliente.email || '');
    setFieldValue('clienteRazonSocial', cliente.razonSocial || cliente.nombre || '');
    setFieldValue('clienteRegimenCodigo', cliente.regimenCodigo || '');
    setFieldValue('clienteCodigoPostal', cliente.codigoPostal || '');
    
    // Actualizar catálogo de Uso de CFDI compatible con el régimen y RFC del cliente
    populateUsoCFDIOptions(getFieldValue('usoCFDI'), cliente.regimenCodigo, cliente.rfc);
    
    ['clienteNombre', 'clienteRFC', 'clienteRazonSocial', 'clienteRegimenCodigo',
     'clienteCodigoPostal', 'clienteDireccion', 'clienteTelefono', 'clienteEmail'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.readOnly = true;
            field.style.backgroundColor = '#f0f9ff';
        }
    });
    
    document.getElementById('clienteDropdown').style.display = 'none';
}

function activarEntradaManual() {
    isManualEntry = true;
    clienteSeleccionadoId = null;
    document.getElementById('clienteSearch').value = '';
    
    ['clienteNombre', 'clienteRFC', 'clienteRazonSocial', 'clienteRegimenCodigo',
     'clienteCodigoPostal', 'clienteDireccion', 'clienteTelefono', 'clienteEmail'].forEach(id => {
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

async function agregarNuevoCliente(nombre) {
    mostrarLoading(true);
    try {
        const { value: formValues } = await Swal.fire({
            title: 'Agregar Nuevo Cliente',
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto; font-size: 0.9rem;">
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Nombre/Razon Social *</label>
                        <input id="swal-nombre" class="swal2-input" value="${nombre}" placeholder="Razon Social" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">RFC *</label>
                        <input id="swal-rfc" class="swal2-input" placeholder="RFC (ej: XAXX010101000)" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Regimen Fiscal</label>
                        <input id="swal-regimen" class="swal2-input" placeholder="Regimen Fiscal" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Codigo Postal</label>
                        <input id="swal-cp" class="swal2-input" placeholder="Codigo Postal" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Vialidad</label>
                        <input id="swal-vialidad" class="swal2-input" placeholder="Calle" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Numero Exterior</label>
                        <input id="swal-num-ext" class="swal2-input" placeholder="Numero Exterior" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Colonia</label>
                        <input id="swal-colonia" class="swal2-input" placeholder="Colonia" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Municipio</label>
                        <input id="swal-municipio" class="swal2-input" placeholder="Municipio" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Estado</label>
                        <input id="swal-estado" class="swal2-input" placeholder="Estado" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Telefono</label>
                        <input id="swal-telefono" class="swal2-input" placeholder="Telefono" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Email</label>
                        <input id="swal-email" class="swal2-input" placeholder="Email" type="email" style="padding: 6px 10px; font-size: 0.9rem;">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar Cliente',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6b7280',
            width: '500px',
            preConfirm: () => {
                const nombreCliente = document.getElementById('swal-nombre').value.trim();
                const rfc = document.getElementById('swal-rfc').value.trim();
                if (!nombreCliente) {
                    Swal.showValidationMessage('El nombre es requerido');
                    return false;
                }
                if (!rfc || rfc.length < 12) {
                    Swal.showValidationMessage('El RFC es requerido (minimo 12 caracteres)');
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
            regimen: formValues.regimen || 'Sin regimen',
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
            mostrarAlerta('Cliente agregado exitosamente', 'success');
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

// =================================================================================
// BUSQUEDA DE PRODUCTOS
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
        mostrarOpcionesProductos(dropdown, filtrados);
    });
    
    searchInput.addEventListener('focus', () => {
        const termino = searchInput.value.toLowerCase().trim();
        if (termino.length >= 2) {
            const filtrados = productosList.filter(p => 
                p.nombre && p.nombre.toLowerCase().includes(termino)
            );
            mostrarOpcionesProductos(dropdown, filtrados);
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.rsi-producto-search-container')) {
            dropdown.style.display = 'none';
        }
    });
}

function mostrarOpcionesProductos(dropdown, productosFiltrados) {
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    dropdown.style.display = 'block';
    
    if (productosFiltrados.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'rsi-producto-option';
        noResults.innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 8px 12px;">No se encontraron productos</div>`;
        dropdown.appendChild(noResults);
        return;
    }
    
    productosFiltrados.slice(0, 10).forEach(producto => {
        const option = document.createElement('div');
        option.className = 'rsi-producto-option';
        option.style.padding = '8px 12px';
        option.style.cursor = 'pointer';
        option.style.borderBottom = '1px solid var(--rsi-gray-100)';
        
        // Verificar si tiene clave SAT
        const tieneClaveSat = producto.claveSat && producto.claveSat.trim() !== '';
        
        // Color rojo si NO tiene clave SAT
        const nombreColor = tieneClaveSat ? 'var(--text-color)' : '#dc3545';
        const claveSatText = tieneClaveSat ? `Clave SAT: ${producto.claveSat}` : 'SIN CLAVE SAT';
        const claveSatColor = tieneClaveSat ? '#28a745' : '#dc3545';
        const claveSatStyle = tieneClaveSat ? '' : 'font-weight: 700;';
        
        option.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: ${nombreColor};">${producto.nombre}</strong>
                <span style="font-size: 0.7rem; color: ${claveSatColor}; ${claveSatStyle} background: ${tieneClaveSat ? 'transparent' : 'rgba(220, 53, 69, 0.1)'}; padding: 2px 8px; border-radius: 4px;">
                    ${claveSatText}
                </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--rsi-gray-500);">
                Categoria: ${getCategoriaNombre(producto.categoriaId)} - Precio: ${formatCurrency(producto.precioUnitario || 0)}
            </div>
        `;
        
        option.addEventListener('click', async () => {
            // Si no tiene clave SAT, solicitar antes de agregar
            if (!producto.claveSat) {
                const result = await verificarClaveSatProducto(producto.id, producto.nombre);
                if (!result.tieneClave) {
                    mostrarAlerta('No se puede agregar el producto sin clave SAT', 'error');
                    dropdown.style.display = 'none';
                    return;
                }
                // Recargar productos para actualizar la lista
                await loadProductos();
                // Buscar el producto actualizado
                const productoActualizado = productosList.find(p => p.id === producto.id);
                if (productoActualizado) {
                    agregarItemProducto(productoActualizado);
                }
            } else {
                agregarItemProducto(producto);
            }
            
            dropdown.style.display = 'none';
            searchInput.value = '';
        });
        
        dropdown.appendChild(option);
    });
}

function agregarItemProducto(producto) {
    // Buscar si ya existe en itemsData por productId
    const existingIndex = itemsData.findIndex(item => 
        item.productId === producto.id
    );
    
    if (existingIndex !== -1) {
        // Aumentar cantidad
        itemsData[existingIndex].cantidad += 1;
        itemsData[existingIndex].total = itemsData[existingIndex].cantidad * itemsData[existingIndex].precio;
        renderItemsTable();
        calcularTotales();
        mostrarAlerta(`Cantidad de "${producto.nombre}" incrementada a ${itemsData[existingIndex].cantidad}`, 'success');
    } else {
        // Agregar nuevo
        const newItem = {
            productId: producto.id,
            categoria: producto.categoriaId || '',
            categoriaNombre: getCategoriaNombre(producto.categoriaId),
            tipoTecnologia: 'pieza',
            descripcion: producto.nombre || '',
            cantidad: 1,
            precio: producto.precioUnitario || 0,
            total: producto.precioUnitario || 0,
            claveSat: producto.claveSat || ''
        };
        
        itemsData.push(newItem);
        renderItemsTable();
        calcularTotales();
        mostrarAlerta(`"${producto.nombre}" agregado a la factura`, 'success');
    }
}

// =================================================================================
// VERIFICACION DE CLAVE SAT - Guarda en el producto
// =================================================================================

    async function verificarClaveSatProducto(productoId, productoNombre) {
        try {
            // Obtener el producto completo desde la base de datos
            const producto = await productoServicioService.getProductoServicioRawById(productoId);
            
            if (!producto) {
                throw new Error('Producto no encontrado');
            }
            
            // Si ya tiene clave SAT, devolverla y ACTUALIZAR EN ITEMSDATA
            if (producto.claveSat && producto.claveSat.trim() !== '') {
                // 🔥 Buscar el item en itemsData y actualizar su clave SAT
                const itemIndex = itemsData.findIndex(item => item.productId === productoId);
                if (itemIndex !== -1) {
                    itemsData[itemIndex].claveSat = producto.claveSat;
                    renderItemsTable();
                }
                
                return {
                    tieneClave: true,
                    claveSat: producto.claveSat,
                    descripcionSat: producto.descripcionSat || ''
                };
            }
            
            // Modal para ingresar clave SAT
            const result = await Swal.fire({
                title: 'Clave SAT',
                html: `
                    <div style="text-align: left; font-size: 0.9rem;">
                        <p style="margin-bottom: 8px; color: #dc3545; font-weight: 600; font-size: 0.85rem;">
                            <i class="fas fa-exclamation-triangle"></i> ${producto.nombre}
                        </p>
                        <div style="margin-bottom: 6px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 3px; font-size: 0.85rem; text-align: left;">
                                Clave SAT (8 digitos) *
                            </label>
                            <div style="position: relative; text-align: left;">
                                <input id="swal-clave-sat" class="swal2-input" 
                                    placeholder="Ej: 10161505" 
                                    style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; text-align: left; box-sizing: border-box;">
                                <div id="swal-clave-sat-sugerencias" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 150px; overflow-y: auto; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: left;"></div>
                            </div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-top: 3px; text-align: left;">
                                Escribe al menos 2 digitos para buscar en el catalogo SAT
                            </div>
                        </div>
                        <div style="font-size: 0.7rem; color: #6b7280; margin-top: 6px; text-align: left;">
                            <i class="fas fa-info-circle"></i> La clave se guardara en el producto y en la factura actual
                        </div>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#6b7280',
                allowOutsideClick: false,
                width: '420px',
                didOpen: () => {
                    const input = document.getElementById('swal-clave-sat');
                    const sugerencias = document.getElementById('swal-clave-sat-sugerencias');
                    
                    if (input && sugerencias) {
                        input.style.textAlign = 'left';
                        
                        input.addEventListener('input', function() {
                            const termino = this.value.trim();
                            if (termino.length < 2) {
                                sugerencias.style.display = 'none';
                                sugerencias.innerHTML = '';
                                return;
                            }
                            buscarClavesSAT(termino, this, sugerencias);
                        });
                        
                        input.addEventListener('focus', function() {
                            const termino = this.value.trim();
                            if (termino.length >= 2) {
                                buscarClavesSAT(termino, this, sugerencias);
                            }
                        });
                        
                        document.addEventListener('click', function(e) {
                            if (!e.target.closest('#swal-clave-sat') && !e.target.closest('#swal-clave-sat-sugerencias')) {
                                sugerencias.style.display = 'none';
                                sugerencias.innerHTML = '';
                            }
                        });
                    }
                },
                preConfirm: () => {
                    const claveSat = document.getElementById('swal-clave-sat').value.trim();
                    if (!claveSat) {
                        Swal.showValidationMessage('La clave SAT es requerida');
                        return false;
                    }
                    if (!/^\d{8}$/.test(claveSat)) {
                        Swal.showValidationMessage('La clave SAT debe tener 8 digitos');
                        return false;
                    }
                    return {
                        claveSat: claveSat,
                        descripcionSat: ''
                    };
                }
            });
            
            if (!result.isConfirmed) {
                return {
                    tieneClave: false,
                    error: 'El usuario cancelo la asignacion de clave SAT'
                };
            }
            
            const { claveSat, descripcionSat } = result.value;
            
            // GUARDAR LA CLAVE SAT EN EL PRODUCTO
            await productoServicioService.updateProductoServicio(productoId, {
                ...producto,
                claveSat: claveSat,
                descripcionSat: descripcionSat || ''
            });
            
            // 🔥 ACTUALIZAR EL ITEM EN ITEMSDATA
            const itemIndex = itemsData.findIndex(item => item.productId === productoId);
            if (itemIndex !== -1) {
                itemsData[itemIndex].claveSat = claveSat;
                renderItemsTable();
            }
            
            // Recargar productos
            await loadProductos();
            
            mostrarAlerta('Clave SAT guardada en el producto y en la factura', 'success');
            
            return {
                tieneClave: true,
                claveSat: claveSat,
                descripcionSat: descripcionSat || ''
            };
            
        } catch (error) {
            console.error('Error verificando clave SAT:', error);
            return {
                tieneClave: false,
                error: error.message
            };
        }
    }

// =================================================================================
// BUSCADOR PREDICTIVO DE CLAVES SAT (directo desde Firebase - catalogoSAT)
// =================================================================================

async function buscarClavesSAT(termino, inputElement, sugerenciasContainer) {
    if (!sugerenciasContainer || !termino || termino.length < 2) {
        sugerenciasContainer.style.display = 'none';
        sugerenciasContainer.innerHTML = '';
        return;
    }
    
    clearTimeout(busquedaSatTimeout);
    
    busquedaSatTimeout = setTimeout(async () => {
        try {
            sugerenciasContainer.innerHTML = '<div style="padding: 6px 10px; color: #6b7280; font-size: 0.8rem; text-align: left;">Buscando...</div>';
            sugerenciasContainer.style.display = 'block';
            
            // Buscar en catálogo SAT a través de ProductoServicioService
            if (!productoServicioService) {
                productoServicioService = new ProductoServicioService();
            }
            const resultados = await productoServicioService.searchSatCatalog(termino, 10);
            
            sugerenciasContainer.innerHTML = '';
            
            if (resultados.length === 0) {
                sugerenciasContainer.innerHTML = '<div style="padding: 6px 10px; color: #6b7280; font-size: 0.8rem; text-align: left;">No se encontraron claves SAT</div>';
                return;
            }
            
            // Mostrar resultados (sin duplicados)
            const vistos = new Set();
            let contador = 0;
            
            resultados.forEach(item => {
                if (vistos.has(item.clave) || contador >= 10) return;
                vistos.add(item.clave);
                contador++;
                
                const option = document.createElement('div');
                option.style.cssText = 'padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.85rem; text-align: left;';
                option.style.transition = 'background 0.15s';
                
                const descCorta = item.descripcion && item.descripcion.length > 60 
                    ? item.descripcion.substring(0, 60) + '...' 
                    : item.descripcion || 'Sin descripcion';
                
                option.innerHTML = `
                    <strong style="color: #1c1948;">${item.clave}</strong>
                    <span style="color: #6b7280; margin-left: 6px; font-size: 0.75rem;">${descCorta}</span>
                `;
                
                option.addEventListener('mouseenter', () => {
                    option.style.background = '#f0f0f0';
                });
                option.addEventListener('mouseleave', () => {
                    option.style.background = 'transparent';
                });
                
                option.addEventListener('click', () => {
                    if (inputElement) {
                        inputElement.value = item.clave;
                        // Disparar eventos para actualizar
                        const event = new Event('input', { bubbles: true });
                        inputElement.dispatchEvent(event);
                        const changeEvent = new Event('change', { bubbles: true });
                        inputElement.dispatchEvent(changeEvent);
                    }
                    sugerenciasContainer.style.display = 'none';
                    sugerenciasContainer.innerHTML = '';
                });
                sugerenciasContainer.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error buscando claves SAT:', error);
            sugerenciasContainer.innerHTML = '<div style="padding: 6px 10px; color: #dc3545; font-size: 0.8rem; text-align: left;">Error al buscar claves SAT</div>';
        }
    }, 300);
}

// =================================================================================
// ITEMS
// =================================================================================

function getItemsFromTable() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const items = [];
    rows.forEach(row => {
        const productId = row.dataset.productId || null;
        const categoria = row.querySelector('.item-categoria')?.value || '';
        const tipoTecnologia = row.querySelector('.item-tipo-tecnologia')?.value || 'pieza';
        const descripcion = row.querySelector('.item-descripcion')?.value || '';
        const cantidad = parseFloat(row.querySelector('.item-cantidad')?.value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
        const claveSat = row.querySelector('.item-clave-sat')?.value || '';
        
        if (descripcion) {
            items.push({
                productId: productId,
                categoria,
                categoriaNombre: getCategoriaNombre(categoria),
                tipoTecnologia,
                descripcion,
                cantidad,
                precio,
                total: cantidad * precio,
                claveSat: claveSat
            });
        }
    });
    return items;
}

function validarClavesSAT(items) {
    const itemsSinClave = items.filter(item => !item.claveSat || item.claveSat.trim() === '');
    const itemsClaveInvalida = items.filter(item => {
        const clave = item.claveSat || '';
        return clave.length > 0 && !/^\d{8}$/.test(clave.trim());
    });
    
    const errores = [];
    if (itemsSinClave.length > 0) {
        errores.push(`${itemsSinClave.length} item(s) sin clave SAT: ${itemsSinClave.map(i => i.descripcion).join(', ')}`);
    }
    if (itemsClaveInvalida.length > 0) {
        errores.push(`${itemsClaveInvalida.length} item(s) con clave SAT inválida: ${itemsClaveInvalida.map(i => i.descripcion).join(', ')}`);
    }
    
    return {
        valido: errores.length === 0,
        errores,
        itemsSinClave,
        itemsClaveInvalida
    };
}

function renderItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    if (!tbody) return;
    
    if (itemsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: var(--rsi-spacing-lg); color: var(--rsi-gray-500);">
                    <i class="fas fa-plus-circle" style="font-size: 1.5rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                    Agrega productos o servicios a la factura
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    itemsData.forEach((item, index) => {
        const tieneClaveSat = item.claveSat && item.claveSat.trim() !== '';
        const rowBorderColor = tieneClaveSat ? '' : 'border-left: 3px solid #dc3545;';
        
        html += `
            <tr data-index="${index}" data-product-id="${item.productId || ''}" style="${rowBorderColor}">
                <td data-label="#">${index + 1}</td>
                <td data-label="Categoria">
                    <select class="item-categoria">
                        <option value="">Seleccionar...</option>
                        ${categoriasList.map(cat => `
                            <option value="${cat.id}" ${item.categoria === cat.id ? 'selected' : ''}>${cat.nombre}</option>
                        `).join('')}
                    </select>
                </td>
                <td data-label="Unidad">
                    <select class="item-tipo-tecnologia">
                        <option value="servicio" ${item.tipoTecnologia === 'servicio' ? 'selected' : ''}>Servicio</option>
                        <option value="pieza" ${item.tipoTecnologia === 'pieza' ? 'selected' : ''}>Pieza</option>
                        <option value="kit" ${item.tipoTecnologia === 'kit' ? 'selected' : ''}>Kit</option>
                        <option value="par" ${item.tipoTecnologia === 'par' ? 'selected' : ''}>Par</option>
                        <option value="cm" ${item.tipoTecnologia === 'cm' ? 'selected' : ''}>Centimetro</option>
                        <option value="m" ${item.tipoTecnologia === 'm' ? 'selected' : ''}>Metro</option>
                    </select>
                </td>
                <td data-label="Descripcion">
                    <input type="text" class="item-descripcion" value="${item.descripcion}" placeholder="Descripcion del item">
                </td>
                <td data-label="Clave SAT" style="${!tieneClaveSat ? 'background: rgba(220, 53, 69, 0.05);' : ''}">
                    <input type="text" class="item-clave-sat" value="${item.claveSat || ''}" placeholder="8 digitos" maxlength="8" style="${!tieneClaveSat ? 'border-color: #dc3545;' : ''}">
                    ${!tieneClaveSat ? '<div style="font-size: 0.6rem; color: #dc3545; margin-top: 2px;">Requiere clave SAT</div>' : ''}
                </td>
                <td data-label="Cantidad">
                    <input type="number" class="item-cantidad" value="${item.cantidad}" min="0.01" step="0.01">
                </td>
                <td data-label="Precio Unit.">
                    <input type="number" class="item-precio" value="${item.precio}" min="0" step="0.01">
                </td>
                <td data-label="Total" class="item-total">${formatCurrency(item.total)}</td>
                <td data-label="Accion">
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
        const claveSatInput = row.querySelector('.item-clave-sat');
        const removeBtn = row.querySelector('.rsi-btn-remove-item');
        
        const calcularFila = () => {
            const cantidad = parseFloat(cantidadInput.value) || 0;
            const precio = parseFloat(precioInput.value) || 0;
            const total = cantidad * precio;
            totalCell.textContent = formatCurrency(total);
            itemsData[index].cantidad = cantidad;
            itemsData[index].precio = precio;
            itemsData[index].total = total;
            calcularTotales();
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
        
        claveSatInput.addEventListener('change', () => {
            itemsData[index].claveSat = claveSatInput.value;
            // Actualizar estilo de la fila
            const tieneClave = claveSatInput.value && claveSatInput.value.trim() !== '';
            row.style.borderLeft = tieneClave ? '' : '3px solid #dc3545';
            const tdClave = row.querySelector('td[data-label="Clave SAT"]');
            if (tdClave) {
                tdClave.style.background = tieneClave ? '' : 'rgba(220, 53, 69, 0.05)';
                claveSatInput.style.borderColor = tieneClave ? '' : '#dc3545';
                const errorMsg = tdClave.querySelector('div');
                if (errorMsg && tieneClave) {
                    errorMsg.remove();
                } else if (!tieneClave && !tdClave.querySelector('div')) {
                    const newError = document.createElement('div');
                    newError.style.cssText = 'font-size: 0.6rem; color: #dc3545; margin-top: 2px;';
                    newError.textContent = 'Requiere clave SAT';
                    tdClave.appendChild(newError);
                }
            }
        });
        
        removeBtn.addEventListener('click', () => {
            if (itemsData.length > 1) {
                itemsData.splice(index, 1);
                renderItemsTable();
                calcularTotales();
            } else {
                mostrarAlerta('Debe mantener al menos un item', 'warning');
            }
        });
    });
}

function initItemHandlers() {
    // Boton para agregar item personalizado
    const addCustomBtn = document.getElementById('agregarItemPersonalizadoBtn');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', () => {
            Swal.fire({
                title: 'Agregar Item Personalizado',
                html: `
                    <div style="text-align: left; font-size: 0.9rem;">
                        <div style="margin-bottom: 8px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Descripcion *</label>
                            <input id="swal-item-desc" class="swal2-input" placeholder="Descripcion del producto/servicio" style="padding: 6px 10px; font-size: 0.9rem;">
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Precio *</label>
                            <input id="swal-item-precio" class="swal2-input" type="number" step="0.01" placeholder="0.00" style="padding: 6px 10px; font-size: 0.9rem;">
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Cantidad</label>
                            <input id="swal-item-cantidad" class="swal2-input" type="number" step="0.01" value="1" style="padding: 6px 10px; font-size: 0.9rem;">
                        </div>
                        <div>
                            <label style="font-weight: 600; font-size: 0.85rem;">Clave SAT (opcional)</label>
                            <input id="swal-item-clave" class="swal2-input" placeholder="8 digitos" maxlength="8" style="padding: 6px 10px; font-size: 0.9rem;">
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Agregar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6b7280',
                width: '420px',
                preConfirm: () => {
                    const desc = document.getElementById('swal-item-desc').value.trim();
                    const precio = parseFloat(document.getElementById('swal-item-precio').value);
                    const cantidad = parseFloat(document.getElementById('swal-item-cantidad').value) || 1;
                    const claveSat = document.getElementById('swal-item-clave').value.trim();
                    
                    if (!desc) {
                        Swal.showValidationMessage('La descripcion es requerida');
                        return false;
                    }
                    if (isNaN(precio) || precio <= 0) {
                        Swal.showValidationMessage('El precio debe ser mayor a 0');
                        return false;
                    }
                    
                    return { desc, precio, cantidad, claveSat };
                }
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    const { desc, precio, cantidad, claveSat } = result.value;
                    
                    const newItem = {
                        productId: null,
                        categoria: '',
                        categoriaNombre: 'Personalizado',
                        tipoTecnologia: 'pieza',
                        descripcion: desc,
                        cantidad: cantidad,
                        precio: precio,
                        total: cantidad * precio,
                        claveSat: claveSat || ''
                    };
                    
                    itemsData.push(newItem);
                    renderItemsTable();
                    calcularTotales();
                    mostrarAlerta('Item personalizado agregado', 'success');
                }
            });
        });
        eventListeners.push({ element: addCustomBtn, event: 'click', handler: () => {} });
    }
}

// =================================================================================
// CALCULO DE TOTALES
// =================================================================================

function calcularTotales() {
    const items = getItemsFromTable();
    let subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 0;
    const impuestoMonto = subtotal * (impuestoPorcentaje / 100);
    const total = subtotal + impuestoMonto;
    
    const subtotalEl = document.getElementById('subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    
    const totalEl = document.getElementById('totalFinal');
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    facturaData.subtotal = subtotal;
    facturaData.impuesto = impuestoPorcentaje.toString();
    facturaData.impuestoMonto = impuestoMonto;
    facturaData.totalFinal = total;
}

function initTotalesListeners() {
    const impuestoInput = document.getElementById('impuesto');
    if (impuestoInput) {
        impuestoInput.addEventListener('input', () => {
            calcularTotales();
        });
        eventListeners.push({ element: impuestoInput, event: 'input', handler: () => {} });
    }
}

// =================================================================================
// NAVEGACION POR PASOS
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
        const clienteRFC = getFieldValue('clienteRFC');
        const clienteRazonSocial = getFieldValue('clienteRazonSocial');
        const clienteRegimen = getFieldValue('clienteRegimenCodigo');
        const usoCFDI = getFieldValue('usoCFDI');
        const metodoPago = getFieldValue('metodoPago');
        const formaPago = metodoPago === 'PPD' ? '99' : getFieldValue('formaPago');
        
        if (!clienteRFC || clienteRFC.length < 12) {
            mostrarAlerta('El RFC del cliente es requerido (minimo 12 caracteres)', 'error');
            return false;
        }
        if (!clienteRazonSocial) {
            mostrarAlerta('La razon social del cliente es requerida', 'error');
            return false;
        }
        if (!usoCFDI) {
            mostrarAlerta('El uso de CFDI es requerido', 'error');
            return false;
        }
        if (!metodoPago) {
            mostrarAlerta('El metodo de pago es requerido', 'error');
            return false;
        }
        if (!formaPago) {
            mostrarAlerta('La forma de pago es requerida', 'error');
            return false;
        }

        // Regla CFDI 4.0: Si método de pago es PPD, forma de pago debe ser 99
        if (metodoPago === 'PPD' && formaPago !== '99') {
            mostrarAlerta('Para el método PPD (Pago en parcialidades o diferido), la forma de pago debe ser "99 — Por definir".', 'warning');
            return false;
        }

        // Regla CFDI 4.0: Si método de pago es PUE, forma de pago NO debe ser 99
        if (metodoPago === 'PUE' && formaPago === '99') {
            mostrarAlerta('Para el método PUE (Pago en una sola exhibición), la forma de pago no puede ser "99 — Por definir". Por favor seleccione la forma de pago correspondiente (ej. Efectivo, Transferencia, etc.).', 'warning');
            return false;
        }

        // Validación de compatibilidad del Uso de CFDI con el régimen y tipo de persona del receptor
        if (clienteRegimen && usoCFDI) {
            const compat = validarCompatibilidadUsoCFDI(usoCFDI, clienteRegimen, clienteRFC);
            if (!compat.compatible) {
                mostrarAlerta(compat.error || 'El Uso de CFDI seleccionado no es compatible con el régimen fiscal del receptor.', 'warning');
                return false;
            }
        }
    }

    if (currentStep === 2) {
        const items = getItemsFromTable();
        if (items.length === 0) {
            mostrarAlerta('Debe agregar al menos un item a la factura', 'error');
            return false;
        }
        
        // Verificar claves SAT
        for (const item of items) {
            if (!item.claveSat || item.claveSat.trim() === '') {
                mostrarAlerta(`El item "${item.descripcion}" no tiene clave SAT`, 'warning');
                return false;
            }
            if (!/^\d{8}$/.test(item.claveSat.trim())) {
                mostrarAlerta(`La clave SAT de "${item.descripcion}" debe tener 8 digitos`, 'error');
                return false;
            }
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

// =================================================================================
// VALIDACION DE CAMPOS
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
// USOS CFDI Y FORMAS / METODOS DE PAGO CFDI 4.0
// =================================================================================

function populateUsoCFDIOptions(selectedVal = null, regimenCodigo = null, rfc = null) {
    const select = document.getElementById('usoCFDI');
    if (!select) return;
    
    const valorActual = selectedVal || select.value || 'G01';
    
    // Obtener catálogo de opciones compatibles según el régimen y tipo de persona (CFDI 4.0)
    let opciones = Object.values(USOS_CFDI);
    if (regimenCodigo) {
        const compatibles = getUsosCFDICompatibles(regimenCodigo, rfc);
        if (compatibles && compatibles.length > 0) {
            opciones = compatibles;
        }
    }
    
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    let valorExiste = false;
    opciones.forEach(uso => {
        const option = document.createElement('option');
        option.value = uso.clave;
        option.textContent = `${uso.clave} — ${uso.descripcion}`;
        if (uso.clave === valorActual) {
            option.selected = true;
            valorExiste = true;
        }
        select.appendChild(option);
    });
    
    // Si el valor seleccionado previamente no aparece en las opciones compatibles (ej. factura existente),
    // incluirlo para que se muestre fielmente sin perder la información guardada
    if (valorActual && !valorExiste) {
        const usoObj = obtenerUsoCFDI(valorActual);
        const option = document.createElement('option');
        option.value = valorActual;
        option.textContent = usoObj ? `${usoObj.clave} — ${usoObj.descripcion}` : `${valorActual} — Uso ${valorActual}`;
        option.selected = true;
        select.appendChild(option);
    }
}

function initUsoCFDI() {
    populateUsoCFDIOptions(getFieldValue('usoCFDI'), getFieldValue('clienteRegimenCodigo'), getFieldValue('clienteRFC'));
}

function actualizarEstadoMetodoPago(metodoVal) {
    const formaPagoSelect = document.getElementById('formaPago');
    if (!formaPagoSelect) return;

    if (metodoVal === 'PPD') {
        // En PPD, la forma de pago debe ser forzosamente 99 — Por definir
        if (formaPagoSelect.value && formaPagoSelect.value !== '99') {
            ultimaFormaPagoPUE = formaPagoSelect.value;
        }
        formaPagoSelect.value = '99';
        formaPagoSelect.disabled = true;
        formaPagoSelect.setAttribute('title', 'Para método PPD la forma de pago debe ser 99 — Por definir');
        formaPagoSelect.classList.remove('error');
        const err = document.getElementById('errorFormaPago');
        if (err) err.textContent = '';
    } else {
        // En PUE (o no seleccionado), la forma de pago debe quedar habilitada
        formaPagoSelect.disabled = false;
        formaPagoSelect.removeAttribute('title');
        // Si estaba en '99' por haber sido cambiado a PPD, restaurar la última forma de pago elegida para PUE
        if (formaPagoSelect.value === '99') {
            formaPagoSelect.value = (ultimaFormaPagoPUE && ultimaFormaPagoPUE !== '99') ? ultimaFormaPagoPUE : '01';
        }
    }
}

function initMetodoPagoHandler() {
    const metodoPagoSelect = document.getElementById('metodoPago');
    const formaPagoSelect = document.getElementById('formaPago');
    if (!metodoPagoSelect || !formaPagoSelect) return;

    const handler = () => {
        const metodoVal = metodoPagoSelect.value;
        actualizarEstadoMetodoPago(metodoVal);
    };

    metodoPagoSelect.addEventListener('change', handler);
    eventListeners.push({ element: metodoPagoSelect, event: 'change', handler });

    // Escuchar cambios manuales de forma de pago cuando está en PUE
    const formaHandler = () => {
        if (metodoPagoSelect.value === 'PUE' && formaPagoSelect.value !== '99') {
            ultimaFormaPagoPUE = formaPagoSelect.value;
        }
    };
    formaPagoSelect.addEventListener('change', formaHandler);
    eventListeners.push({ element: formaPagoSelect, event: 'change', handler: formaHandler });

    // Escuchar cambios en régimen fiscal y RFC del cliente para actualizar compatibilidad de Uso de CFDI
    const regimenInput = document.getElementById('clienteRegimenCodigo');
    if (regimenInput) {
        const regimenHandler = () => {
            populateUsoCFDIOptions(getFieldValue('usoCFDI'), regimenInput.value.trim(), getFieldValue('clienteRFC'));
        };
        regimenInput.addEventListener('change', regimenHandler);
        eventListeners.push({ element: regimenInput, event: 'change', handler: regimenHandler });
    }

    const rfcInput = document.getElementById('clienteRFC');
    if (rfcInput) {
        const rfcHandler = () => {
            populateUsoCFDIOptions(getFieldValue('usoCFDI'), getFieldValue('clienteRegimenCodigo'), rfcInput.value.trim());
        };
        rfcInput.addEventListener('change', rfcHandler);
        eventListeners.push({ element: rfcInput, event: 'change', handler: rfcHandler });
    }
}

// =================================================================================
// BOTON CANCELAR
// =================================================================================

function initCancelButton() {
    const cancelBtn = document.getElementById('cancelBtn');
    if (!cancelBtn) return;
    
    const handler = () => {
        Swal.fire({
            title: 'Cancelar?',
            text: 'Los cambios no guardados se perderan.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Si, salir',
            cancelButtonText: 'Continuar editando',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#1c1948'
        }).then((result) => {
            if (result.isConfirmed) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/partner/crudFacturas');
                } else {
                    window.location.href = '/partner/crudFacturas';
                }
            }
        });
    };
    
    cancelBtn.addEventListener('click', handler);
    eventListeners.push({ element: cancelBtn, event: 'click', handler });
}

// =================================================================================
// ACTUALIZAR CONFIRMACION
// =================================================================================

function updateConfirmacion() {
    const items = getItemsFromTable();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const impuestoPorcentaje = parseFloat(getFieldValue('impuesto')) || 16;
    const impuestoMonto = subtotal * (impuestoPorcentaje / 100);
    const totalFinal = subtotal + impuestoMonto;
    
    setText('confirmClienteRazonSocial', getFieldValue('clienteRazonSocial') || '-');
    setText('confirmClienteRFC', getFieldValue('clienteRFC') || '-');
    setText('confirmClienteRegimen', getFieldValue('clienteRegimenCodigo') || '-');
    setText('confirmClienteCP', getFieldValue('clienteCodigoPostal') || '-');
    
    setText('confirmFacturaNumero', getFieldValue('facturaNumero') || '-');
    setText('confirmCotizacionNumero', getFieldValue('cotizacionNumero') || '-');
    const usoVal = getFieldValue('usoCFDI');
    const usoObj = obtenerUsoCFDI(usoVal);
    setText('confirmUsoCFDI', usoObj ? `${usoObj.clave} — ${usoObj.descripcion}` : (usoVal || '-'));

    const metodoVal = getFieldValue('metodoPago');
    const metodoObj = obtenerMetodoPago(metodoVal);
    setText('confirmMetodoPago', metodoObj ? `${metodoObj.clave} — ${metodoObj.descripcion}` : (metodoVal || '-'));

    const formaVal = metodoVal === 'PPD' ? '99' : getFieldValue('formaPago');
    const formaObj = obtenerFormaPago(formaVal);
    setText('confirmFormaPago', formaObj ? `${formaObj.clave} — ${formaObj.descripcion}` : (formaVal || '-'));
    setText('confirmFacturaFecha', getFieldValue('facturaFecha') || '-');
    
    const itemsContainer = document.getElementById('confirmItemsList');
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<p style="color: var(--rsi-gray-500);">No hay items</p>';
        } else {
            let itemsHtml = '';
            items.forEach(item => {
                const claveSatText = item.claveSat ? `Clave SAT: ${item.claveSat}` : '';
                const hasClave = item.claveSat && item.claveSat.trim() !== '';
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100); ${!hasClave ? 'border-left: 3px solid #dc3545; padding-left: 8px;' : ''}">
                        <span>${item.descripcion || 'Sin descripcion'} ${claveSatText ? `<span style="font-size: 0.7rem; color: #6b7280;">${claveSatText}</span>` : '<span style="font-size: 0.7rem; color: #dc3545;">SIN CLAVE SAT</span>'}</span>
                        <span>${item.cantidad || 0} x ${formatCurrency(item.precio || 0)} = ${formatCurrency(item.total || 0)}</span>
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

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '-';
}

// =================================================================================
// ENVIO DEL FORMULARIO
// =================================================================================

function initSubmitHandlers() {
    const guardarBorradorBtn = document.getElementById('guardarBorradorBtn');
    if (guardarBorradorBtn) {
        const handlerBorrador = () => handleSubmit(false);
        guardarBorradorBtn.addEventListener('click', handlerBorrador);
        eventListeners.push({ element: guardarBorradorBtn, event: 'click', handler: handlerBorrador });
    }
    
    const guardarTimbrarBtn = document.getElementById('guardarTimbrarBtn');
    if (guardarTimbrarBtn) {
        const handlerTimbrar = () => handleSubmit(true);
        guardarTimbrarBtn.addEventListener('click', handlerTimbrar);
        eventListeners.push({ element: guardarTimbrarBtn, event: 'click', handler: handlerTimbrar });
    }
}

async function handleSubmit(timbrar = false) {
    if (isSubmitting) {
        console.warn('⚠️ Operación de guardado/timbrado ya en progreso. Clic ignorado.');
        return;
    }

    try {
        if (!validateCurrentStep()) {
            return;
        }

        isSubmitting = true;

        const guardarBorradorBtn = document.getElementById('guardarBorradorBtn');
        const guardarTimbrarBtn = document.getElementById('guardarTimbrarBtn');

        if (guardarBorradorBtn) {
            guardarBorradorBtn.disabled = true;
        }
        if (guardarTimbrarBtn) {
            guardarTimbrarBtn.disabled = true;
        }

        if (timbrar && guardarTimbrarBtn) {
            guardarTimbrarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Timbrando...';
        } else if (!timbrar && guardarBorradorBtn) {
            guardarBorradorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
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
        const usoCFDI = getFieldValue('usoCFDI') || 'G03';
        const metodoPago = getFieldValue('metodoPago') || 'PUE';
        const formaPago = metodoPago === 'PPD' ? '99' : (getFieldValue('formaPago') || '01');
        
        // Obtener datos de la factura
        const facturaNumero = getFieldValue('facturaNumero') || generateFacturaNumero();
        const facturaFecha = getFieldValue('facturaFecha') || new Date().toISOString().split('T')[0];
        const facturaDescripcion = getFieldValue('facturaDescripcion');
        
        // Items y totales
        const items = getItemsFromTable();
        const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const impuesto = parseFloat(getFieldValue('impuesto')) || 16;
        const impuestoMonto = subtotal * (impuesto / 100);
        const totalFinal = subtotal + impuestoMonto;
        
        const facturaDataToSave = {
            clienteId: clienteSeleccionadoId || '',
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
                productId: item.productId || '',
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || 'Sin descripcion',
                precioUnitario: item.precio || 0,
                total: item.total || 0,
                categoria: item.categoria || '',
                categoriaNombre: item.categoriaNombre || '',
                tipoTecnologia: item.tipoTecnologia || 'pieza',
                claveSat: item.claveSat || ''
            })),
            subtotal,
            impuesto: impuesto.toString(),
            impuestoMonto,
            totalFinal,
            estatus: timbrar ? 'pendiente' : 'borrador',
            cfdiData: {
                Receiver: {
                    Name: clienteRazonSocial || clienteNombre,
                    CfdiUse: usoCFDI,
                    Rfc: clienteRFC,
                    FiscalRegime: clienteRegimenCodigo || '601',
                    TaxZipCode: clienteCodigoPostal || '00000'
                },
                CfdiType: 'I',
                NameId: '1',
                ExpeditionPlace: '57200',
                Serie: null,
                Folio: facturaNumero,
                PaymentForm: formaPago,
                PaymentMethod: metodoPago,
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

        // Actualizar estado para evitar duplicados en reintentos o clics subsiguientes
        editingId = facturaId;
        isEditMode = true;
        try {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('id') !== facturaId) {
                currentUrl.searchParams.set('id', facturaId);
                window.history.replaceState({}, '', currentUrl.toString());
            }
        } catch (e) {
            // Entornos de prueba o sin history
        }
        
        if (timbrar) {
            try {
                const timbradoResult = await facturaService.timbrarFactura(facturaId);
                
                if (timbradoResult.success) {
                    console.log('Factura timbrada exitosamente');
                    
                    if (timbradoResult.pdfUrl) {
                        localStorage.setItem(`factura_pdf_${facturaId}`, timbradoResult.pdfUrl);
                    }
                    if (timbradoResult.xmlUrl) {
                        localStorage.setItem(`factura_xml_${facturaId}`, timbradoResult.xmlUrl);
                    }
                    
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
                        title: 'Factura timbrada exitosamente',
                        html: `
                            <div style="text-align: left;">
                                <p><strong>Factura:</strong> ${facturaNumero}</p>
                                <p><strong>UUID:</strong> ${timbradoResult.uuid || timbradoResult.timbrado?.uuid || 'N/A'}</p>
                                <p><strong>Fecha de timbrado:</strong> ${timbradoResult.fechaTimbrado || timbradoResult.timbrado?.fechaTimbrado || 'N/A'}</p>
                                ${archivosHtml ? `<hr style="margin: 10px 0;"><div style="margin-top: 10px;">${archivosHtml}</div>` : ''}
                            </div>
                        `,
                        confirmButtonText: 'Ver PDF',
                        confirmButtonColor: '#1c1948',
                        showCancelButton: true,
                        cancelButtonText: 'Ir al listado',
                        cancelButtonColor: '#6c757d'
                    }).then((res) => {
                        if (res.isConfirmed && timbradoResult.pdfUrl) {
                            window.open(timbradoResult.pdfUrl, '_blank');
                        }
                        if (typeof window.navigateTo === 'function') {
                            window.navigateTo('/partner/crudFacturas');
                        } else {
                            window.location.href = '/partner/crudFacturas';
                        }
                    });
                    return;
                } else {
                    throw new Error(timbradoResult.message || 'Error al timbrar');
                }
                
            } catch (timbradoError) {
                console.error('Error timbrando:', timbradoError);
                
                Swal.fire({
                    icon: 'warning',
                    title: 'Factura guardada pero no timbrada',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Factura:</strong> ${facturaNumero}</p>
                            <p>La factura se guardo como borrador pero hubo un error al timbrar.</p>
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
                            window.navigateTo('/partner/crudFacturas');
                        } else {
                            window.location.href = '/partner/crudFacturas';
                        }
                    }
                });
                return;
            }
        }
        
        // ✅ Generar PDF de borrador
        let pdfBlob = null;
        try {
            pdfBlob = await generarPDFFactura(facturaDataToSave, { esBorrador: true, logoUrl: LOGO_URL });
        } catch (pdfErr) {
            console.warn('⚠️ Error generando PDF de borrador:', pdfErr);
        }

        // ✅ Subir PDF a Storage en carpeta separada de borradores
        let borradorPdfUrl = '';
        let storageSuccess = false;
        if (pdfBlob && storageService) {
            try {
                const storageResult = await storageService.uploadPDF(pdfBlob, facturaNumero, 'facturas/borradores');
                if (storageResult.success && storageResult.url) {
                    borradorPdfUrl = storageResult.url;
                    storageSuccess = true;
                    await facturaService.updateFactura(facturaId, { borradorPdfUrl });
                    console.log('✅ PDF borrador subido a Storage:', borradorPdfUrl);
                }
            } catch (storageErr) {
                console.warn('⚠️ Error subiendo borrador a Storage:', storageErr);
            }
        }

        // ✅ Notificación y opciones de descarga
        let mensajeHTML = `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${facturaNumero}</p>
                <p><strong>Cliente:</strong> ${clienteRazonSocial || clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(totalFinal)}</p>
                <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
        `;

        if (storageSuccess && borradorPdfUrl) {
            mensajeHTML += `
                <p style="color: var(--rsi-success);">
                    <i class="fas fa-check-circle"></i> PDF borrador almacenado en la nube
                </p>
                <p style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                    Puedes previsualizar y descargar el borrador antes de timbrarlo.
                </p>
            `;
        } else {
            mensajeHTML += `
                <p style="color: var(--rsi-info);">
                    <i class="fas fa-info-circle"></i> Factura guardada en borrador.
                </p>
            `;
        }
        mensajeHTML += `</div>`;

        Swal.fire({
            icon: 'success',
            title: 'Factura guardada como borrador',
            html: mensajeHTML,
            confirmButtonText: 'Descargar PDF',
            showDenyButton: true,
            denyButtonText: 'Seguir editando',
            cancelButtonText: 'Ir al listado',
            showCancelButton: true,
            confirmButtonColor: '#1c1948',
            denyButtonColor: '#28a745',
            cancelButtonColor: '#6c757d'
        }).then((res) => {
            if (res.isConfirmed && pdfBlob) {
                const pdfUrlLocal = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = pdfUrlLocal;
                link.download = `Factura-${facturaNumero}-BORRADOR.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(pdfUrlLocal);
                mostrarAlerta('PDF de borrador descargado correctamente', 'success');
            }

            if (res.isDenied) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(`/partner/factura?id=${facturaId}`);
                } else {
                    window.location.href = `/partner/factura?id=${facturaId}`;
                }
            } else if (res.isDismissed || res.isConfirmed) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/partner/crudFacturas');
                } else {
                    window.location.href = '/partner/crudFacturas';
                }
            }
        });
        
    } catch (error) {
        console.error('Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrio un error al guardar la factura';
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
        isSubmitting = false;
        const guardarBorradorBtn = document.getElementById('guardarBorradorBtn');
        const guardarTimbrarBtn = document.getElementById('guardarTimbrarBtn');
        if (guardarBorradorBtn) {
            guardarBorradorBtn.disabled = false;
            guardarBorradorBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Borrador';
        }
        if (guardarTimbrarBtn) {
            guardarTimbrarBtn.disabled = false;
            guardarTimbrarBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Guardar y Timbrar';
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
    console.log('Destroying FacturaFormController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    facturaService = null;
    cotizacionService = null;
    clienteService = null;
    productoServicioService = null;
    categoriaService = null;
    storageService = null;
    editingId = null;
    isEditMode = false;
    cotizacionData = null;
    facturaData = {};
    currentUser = null;
    cotizacionId = null;
    productosList = [];
    categoriasList = [];
    clientesList = [];
    itemsData = [];
    isFromCotizacion = false;
    clienteSeleccionadoId = null;
    isManualEntry = false;
    busquedaSatTimeout = null;
}

export default facturaFormController;