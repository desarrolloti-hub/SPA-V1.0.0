/* ========================================
   PRODUCTO/SERVICIO VIEW CONTROLLER
   Controlador para ver detalles de un producto o servicio
   ======================================== */

import ProductoServicioService from '../../services/productoServicioService.js';
import CategoriaProductoServicioService from '../../services/categoriaProductoServicioService.js';

let service = null;
let categoriaService = null;
let eventListeners = [];
let productoData = null;
let categoriasCache = {};

/**
 * Inicializa el controlador de vista de producto/servicio
 */
export async function productoServicioViewController() {
    console.log('👁️ Producto/Servicio View Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new ProductoServicioService();
    categoriaService = new CategoriaProductoServicioService();
    eventListeners = [];
    productoData = null;
    categoriasCache = {};
    
    // Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (!id) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se especificó un producto para ver.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudProductosServicios');
            } else {
                window.location.href = '/partner/crudProductosServicios';
            }
        });
        return;
    }
    
    // Cargar categorías
    await loadCategorias();
    
    // Cargar datos del producto
    await loadProductoData(id);
    
    // Inicializar eventos
    initBackButton();
    
    console.log('✅ Producto/Servicio View Controller listo');
}

/**
 * Carga las categorías para obtener nombres
 */
async function loadCategorias() {
    try {
        const categorias = await categoriaService.getAllCategorias();
        categoriasCache = {};
        categorias.forEach(cat => {
            categoriasCache[cat.id] = cat.nombreCategoria;
        });
        console.log(`✅ Caché de categorías cargado: ${Object.keys(categoriasCache).length}`);
    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        categoriasCache = {};
    }
}

/**
 * Obtiene el nombre de una categoría por su ID
 */
function getCategoriaNombre(categoriaId) {
    if (!categoriaId) return 'Sin categoría';
    return categoriasCache[categoriaId] || 'Sin categoría';
}

/**
 * Carga los datos del producto
 */
async function loadProductoData(id) {
    try {
        mostrarLoading(true);
        
        const producto = await service.getProductoServicioRawById(id);
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        productoData = producto;
        
        // Mostrar datos en la vista
        renderProductoData(producto);
        renderTimeline(producto);
        
        mostrarLoading(false);
        
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cargando producto:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el producto: ' + error.message,
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
 * Renderiza los datos del producto en la vista
 */
function renderProductoData(producto) {
    // ✅ Verificar que los elementos existan antes de asignar
    const nombre = producto.nombre || '-';
    const precio = producto.precioUnitario || 0;
    const categoriaNombre = getCategoriaNombre(producto.categoriaId);
    const activo = producto.activo !== false;
    const hasImage = producto.imagenBase64 && producto.imagenBase64.length > 0;
    
    // Título
    const viewNombre = document.getElementById('viewNombre');
    if (viewNombre) viewNombre.textContent = nombre;
    
    // Imagen
    const imagePreview = document.getElementById('viewImagePreview');
    if (imagePreview) {
        if (hasImage) {
            imagePreview.innerHTML = `<img src="${producto.imagenBase64}" alt="${nombre}">`;
            imagePreview.classList.add('has-image');
        } else {
            imagePreview.innerHTML = `<i class="fas fa-image" style="font-size: 2.5rem; color: var(--rsi-gray-300);"></i>`;
            imagePreview.classList.remove('has-image');
        }
    }
    
    // Badges
    const viewEstado = document.getElementById('viewEstado');
    if (viewEstado) {
        if (activo) {
            viewEstado.className = 'rsi-badge-status activo';
            viewEstado.innerHTML = '<i class="fas fa-check-circle"></i> Activo';
        } else {
            viewEstado.className = 'rsi-badge-status inactivo';
            viewEstado.innerHTML = '<i class="fas fa-times-circle"></i> Inactivo';
        }
    }
    
    const viewCategoria = document.getElementById('viewCategoria');
    if (viewCategoria) {
        viewCategoria.textContent = categoriaNombre;
    }
    
    // Valores
    const viewNombreValue = document.getElementById('viewNombreValue');
    if (viewNombreValue) viewNombreValue.textContent = nombre;
    
    const viewPrecio = document.getElementById('viewPrecio');
    if (viewPrecio) viewPrecio.textContent = formatCurrency(precio);
    
    const viewCategoriaValue = document.getElementById('viewCategoriaValue');
    if (viewCategoriaValue) viewCategoriaValue.textContent = categoriaNombre;
    
    const viewEstadoValue = document.getElementById('viewEstadoValue');
    if (viewEstadoValue) {
        if (activo) {
            viewEstadoValue.innerHTML = '<span class="rsi-badge-status activo"><i class="fas fa-check-circle"></i> Activo</span>';
        } else {
            viewEstadoValue.innerHTML = '<span class="rsi-badge-status inactivo"><i class="fas fa-times-circle"></i> Inactivo</span>';
        }
    }
}

/**
 * Renderiza la línea de tiempo
 */
function renderTimeline(producto) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    
    const timelineItems = [];
    
    // Evento de creación
    const creadoPor = producto.creadoPor?.nombre || 'Sistema';
    const creadoPorUid = producto.creadoPor?.uid || '';
    const fechaCreacion = producto.fechaCreacion || '';
    
    timelineItems.push({
        tipo: 'creacion',
        icon: 'fa-plus-circle',
        evento: 'Creación del producto',
        usuario: creadoPor,
        usuarioUid: creadoPorUid,
        fecha: fechaCreacion,
        detalles: [
            { label: 'Nombre', value: producto.nombre || '-' },
            { label: 'Precio', value: formatCurrency(producto.precioUnitario || 0) },
            { label: 'Categoría', value: getCategoriaNombre(producto.categoriaId) },
            { label: 'Estado', value: (producto.activo !== false) ? 'Activo' : 'Inactivo' }
        ]
    });
    
    // Evento de modificación (si es diferente a la creación)
    if (producto.fechaActualizacion && producto.fechaActualizacion !== producto.fechaCreacion) {
        const modificadoPor = producto.modificadoPor?.nombre || 'Sistema';
        const modificadoPorUid = producto.modificadoPor?.uid || '';
        
        timelineItems.push({
            tipo: 'modificacion',
            icon: 'fa-edit',
            evento: 'Última modificación',
            usuario: modificadoPor,
            usuarioUid: modificadoPorUid,
            fecha: producto.fechaActualizacion,
            detalles: [
                { label: 'Nombre', value: producto.nombre || '-' },
                { label: 'Precio', value: formatCurrency(producto.precioUnitario || 0) },
                { label: 'Categoría', value: getCategoriaNombre(producto.categoriaId) },
                { label: 'Estado', value: (producto.activo !== false) ? 'Activo' : 'Inactivo' }
            ]
        });
    }
    
    // Si no hay eventos, mostrar mensaje
    if (timelineItems.length === 0) {
        container.innerHTML = `
            <div class="rsi-timeline-empty" style="text-align: center; padding: var(--rsi-spacing-lg); color: var(--rsi-gray-500);">
                <i class="fas fa-info-circle" style="font-size: 2rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                <p>No hay información de auditoría disponible</p>
            </div>
        `;
        return;
    }
    
    // Generar HTML de la línea de tiempo
    let html = '';
    timelineItems.forEach((item, index) => {
        const isLast = index === timelineItems.length - 1;
        const fechaFormateada = formatDate(item.fecha);
        
        html += `
            <div class="rsi-timeline-item ${item.tipo}">
                <div class="rsi-timeline-icon ${item.tipo}">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div class="rsi-timeline-content">
                    <div class="rsi-timeline-content-header">
                        <div class="rsi-timeline-event ${item.tipo}">
                            <i class="fas ${item.icon}"></i>
                            ${item.evento}
                        </div>
                        <div class="rsi-timeline-date">
                            <i class="far fa-calendar-alt"></i>
                            ${fechaFormateada}
                        </div>
                    </div>
                    <div class="rsi-timeline-user">
                        <i class="fas fa-user"></i>
                        ${item.usuario}
                    </div>
                    <div class="rsi-timeline-details">
                        ${item.detalles.map(d => `
                            <span>
                                <span class="label">${d.label}:</span>
                                <span class="value">${d.value}</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Inicializa el botón de regresar
 */
function initBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (!backBtn) return;
    
    const handler = () => {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/partner/crudProductosServicios');
        } else {
            window.location.href = '/partner/crudProductosServicios';
        }
    };
    
    backBtn.addEventListener('click', handler);
    eventListeners.push({ element: backBtn, event: 'click', handler });
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
export function destroyProductoServicioViewController() {
    console.log('🧹 Destroying ProductoServicioViewController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    categoriaService = null;
    productoData = null;
    categoriasCache = {};
}

export default productoServicioViewController;