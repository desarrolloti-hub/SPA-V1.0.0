/* ========================================
   FACTURA VER CONTROLLER (Mobile)
   Vista dedicada para ver factura en mobile
   - Si está timbrada: redirige al PDF del storage
   - Si es borrador: muestra vista HTML con botón Timbrar
   ======================================== */

import FacturaService from '../../services/facturaService.js';

let service = null;
let facturaId = null;
let facturaData = null;

export async function facturaVerController() {
    console.log('📱 Factura Ver Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new FacturaService();
    
    const params = new URLSearchParams(window.location.search);
    facturaId = params.get('id');
    
    if (!facturaId) {
        mostrarError('No se especificó una factura');
        return;
    }
    
    initEventos();
    await cargarFactura();
}

/**
 * Inicializa los eventos
 */
function initEventos() {
    document.getElementById('facturaVerBack')?.addEventListener('click', () => {
        window.close();
        // Fallback si window.close no funciona (algunos navegadores lo bloquean)
        setTimeout(() => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/partner/crudFacturas';
            }
        }, 100);
    });
}

/**
 * Carga la factura
 */
async function cargarFactura() {
    try {
        mostrarLoading(true);
        
        facturaData = await service.getFacturaById(facturaId);
        
        if (!facturaData) {
            mostrarError('Factura no encontrada');
            return;
        }
        
        const estaTimbrada = facturaData.estatus === 'timbrada';
        const tienePDFOficial = estaTimbrada && facturaData.pdfUrl;
        
        // ============================================
        // SI ESTÁ TIMBRADA CON PDF → redirigir al PDF
        // ============================================
        if (tienePDFOficial) {
            try {
                const archivos = await service.verificarArchivosFactura(facturaId);
                if (archivos.pdf.existe) {
                    // Abrir PDF en la misma pestaña (ya estamos en nueva pestaña)
                    window.location.href = facturaData.pdfUrl;
                    return;
                }
            } catch (e) {
                console.warn('⚠️ No se pudo verificar PDF:', e);
            }
        }
        
        // ============================================
        // BORRADOR (o timbrada sin PDF) → mostrar vista HTML
        // ============================================
        renderizarVistaCompleta();
        
    } catch (error) {
        console.error('❌ Error cargando factura:', error);
        mostrarError(error.message || 'Error al cargar la factura');
    } finally {
        mostrarLoading(false);
    }
}

/**
 * Renderiza la vista completa de la factura (HTML, NO PDF)
 */
function renderizarVistaCompleta() {
    const container = document.getElementById('facturaVerContent');
    if (!container) return;
    
    const estaTimbrada = facturaData.estatus === 'timbrada';
    const esCancelada = facturaData.estatus === 'cancelada';
    const esCancelacionPendiente = facturaData.estatus === 'cancelacion_pendiente';
    const esBorrador = !estaTimbrada && !esCancelada && !esCancelacionPendiente;
    
    // Items
    let itemsHtml = '';
    if (facturaData.items && facturaData.items.length > 0) {
        itemsHtml = facturaData.items.map((item, i) => `
            <div class="rsi-mobile-item">
                <div class="rsi-mobile-item-header">
                    <span class="rsi-mobile-item-num">${i + 1}</span>
                    <div class="rsi-mobile-item-desc">${item.descripcion || 'Sin descripción'}</div>
                </div>
                <div class="rsi-mobile-item-details">
                    <div><span>Cantidad</span><strong>${item.cantidad || 0}</strong></div>
                    <div><span>P. Unitario</span><strong>${formatearMoneda(item.precioUnitario || item.precio || 0)}</strong></div>
                    <div><span>Importe</span><strong>${formatearMoneda(item.total || 0)}</strong></div>
                </div>
            </div>
        `).join('');
    } else {
        itemsHtml = '<p class="rsi-mobile-empty">Sin conceptos registrados</p>';
    }
    
    // Banner y Botones según estatus
    let bannerHtml = '';
    let botonesHtml = '';
    
    if (esCancelada) {
        bannerHtml = `
            <div class="rsi-mobile-alert rsi-mobile-alert-danger" style="background-color: #fee2e2; border-color: #ef4444; color: #991b1b;">
                <i class="fas fa-times-circle"></i>
                <div>
                    <strong>Cancelada</strong>
                    <p>${facturaData.cancelacion?.motivo ? `Motivo: ${facturaData.cancelacion.motivo}` : 'Factura cancelada ante el SAT'}</p>
                </div>
            </div>
        `;
        if (facturaData.pdfUrl) {
            botonesHtml = `
                <button class="rsi-mobile-btn rsi-mobile-btn-primary" id="mobileDescargarBtn">
                    <i class="fas fa-download"></i>
                    Descargar PDF
                </button>
            `;
        }
    } else if (esCancelacionPendiente) {
        bannerHtml = `
            <div class="rsi-mobile-alert rsi-mobile-alert-warning">
                <i class="fas fa-hourglass-half"></i>
                <div>
                    <strong>Cancelación en Proceso</strong>
                    <p>En espera de respuesta del receptor o confirmación SAT</p>
                </div>
            </div>
        `;
        if (facturaData.pdfUrl) {
            botonesHtml = `
                <button class="rsi-mobile-btn rsi-mobile-btn-primary" id="mobileDescargarBtn">
                    <i class="fas fa-download"></i>
                    Descargar PDF
                </button>
            `;
        }
    } else if (estaTimbrada) {
        bannerHtml = `
            <div class="rsi-mobile-alert rsi-mobile-alert-success">
                <i class="fas fa-check-circle"></i>
                <div>
                    <strong>Timbrada</strong>
                    <p>UUID: ${facturaData.timbrado?.uuid?.substring(0, 18) || 'N/A'}...</p>
                </div>
            </div>
        `;
        botonesHtml = `
            <button class="rsi-mobile-btn rsi-mobile-btn-primary" id="mobileDescargarBtn">
                <i class="fas fa-download"></i>
                Descargar PDF
            </button>
        `;
    } else {
        bannerHtml = `
            <div class="rsi-mobile-alert rsi-mobile-alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Borrador</strong>
                    <p>Esta factura aún no ha sido timbrada</p>
                </div>
            </div>
        `;
        botonesHtml = `
            <button class="rsi-mobile-btn rsi-mobile-btn-secondary" id="mobileEditarBtn">
                <i class="fas fa-edit"></i>
                Editar
            </button>
            <button class="rsi-mobile-btn rsi-mobile-btn-timbrar" id="mobileTimbrarBtn">
                <i class="fas fa-file-signature"></i>
                Timbrar Factura
            </button>
        `;
    }
    
    container.innerHTML = `
        <!-- Header -->
        <div class="rsi-mobile-header">
            <div class="rsi-mobile-header-top">
                <div>
                    <h2>Factura ${facturaData.facturaNumero || 'N/E'}</h2>
                    <p>${facturaData.clienteRazonSocial || facturaData.clienteNombre || ''}</p>
                </div>
                ${getEstatusBadge(facturaData.estatus)}
            </div>
        </div>
        
        <!-- Contenido -->
        <div class="rsi-mobile-content">
            
            ${bannerHtml}
            
            <!-- Datos del receptor -->
            <div class="rsi-mobile-card">
                <h3 class="rsi-mobile-card-title">
                    <i class="fas fa-user"></i> Receptor
                </h3>
                <div class="rsi-mobile-row">
                    <span>Razón Social</span>
                    <strong>${facturaData.clienteRazonSocial || facturaData.clienteNombre || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>RFC</span>
                    <strong>${facturaData.clienteRFC || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>CP</span>
                    <strong>${facturaData.clienteCodigoPostal || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>Email</span>
                    <strong>${facturaData.clienteEmail || 'N/E'}</strong>
                </div>
            </div>
            
            <!-- Datos de la factura -->
            <div class="rsi-mobile-card">
                <h3 class="rsi-mobile-card-title">
                    <i class="fas fa-file-alt"></i> Datos
                </h3>
                <div class="rsi-mobile-row">
                    <span>Fecha</span>
                    <strong>${formatearFecha(facturaData.facturaFecha)}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>Uso CFDI</span>
                    <strong>${facturaData.usoCFDI || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>Forma de Pago</span>
                    <strong>${facturaData.formaPago || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>Método de Pago</span>
                    <strong>${facturaData.metodoPago || 'N/E'}</strong>
                </div>
                <div class="rsi-mobile-row">
                    <span>Moneda</span>
                    <strong>${facturaData.facturaMoneda || 'MXN'}</strong>
                </div>
            </div>
            
            <!-- Conceptos -->
            <div class="rsi-mobile-card">
                <h3 class="rsi-mobile-card-title">
                    <i class="fas fa-list"></i> Conceptos (${facturaData.items?.length || 0})
                </h3>
                <div class="rsi-mobile-items">
                    ${itemsHtml}
                </div>
            </div>
            
            <!-- Totales -->
            <div class="rsi-mobile-card rsi-mobile-totales">
                <div class="rsi-mobile-row">
                    <span>Subtotal</span>
                    <strong>${formatearMoneda(facturaData.subtotal || 0)}</strong>
                </div>
                ${facturaData.descuentoMonto > 0 ? `
                    <div class="rsi-mobile-row">
                        <span>Descuento</span>
                        <strong style="color: var(--rsi-danger);">-${formatearMoneda(facturaData.descuentoMonto)}</strong>
                    </div>
                ` : ''}
                <div class="rsi-mobile-row">
                    <span>IVA (${facturaData.impuesto || 16}%)</span>
                    <strong>${formatearMoneda(facturaData.impuestoMonto || 0)}</strong>
                </div>
                <div class="rsi-mobile-row rsi-mobile-row-total">
                    <span>TOTAL</span>
                    <strong>${formatearMoneda(facturaData.totalFinal || 0)} ${facturaData.facturaMoneda || 'MXN'}</strong>
                </div>
            </div>
            
        </div>
        
        <!-- Footer con acciones fijo -->
        <div class="rsi-mobile-actions">
            ${botonesHtml}
        </div>
    `;
    
    // Eventos de botones
    document.getElementById('mobileEditarBtn')?.addEventListener('click', () => {
        window.location.href = `/partner/factura?id=${facturaId}`;
    });
    
    document.getElementById('mobileTimbrarBtn')?.addEventListener('click', timbrarDesdeVistaMobile);
    
    document.getElementById('mobileDescargarBtn')?.addEventListener('click', () => {
        if (facturaData.pdfUrl) {
            window.open(facturaData.pdfUrl, '_blank');
        } else {
            mostrarAlerta('PDF no disponible', 'warning');
        }
    });
}

/**
 * Timbra desde la vista mobile
 */
async function timbrarDesdeVistaMobile() {
    const confirm = await Swal.fire({
        title: '¿Timbrar factura?',
        html: `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${facturaData.facturaNumero}</p>
                <p><strong>Cliente:</strong> ${facturaData.clienteRazonSocial || facturaData.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatearMoneda(facturaData.totalFinal)}</p>
                <p style="color: var(--rsi-warning); margin-top: var(--rsi-spacing-md);">
                    ⚠️ El timbrado es irreversible.
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ Sí, timbrar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745'
    });
    
    if (!confirm.isConfirmed) return;
    
    try {
        // Modal de progreso
        Swal.fire({
            title: 'Timbrando...',
            html: `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-file-signature" style="font-size: 3rem; color: #1c1948;"></i>
                    <p style="margin-top: 15px; color: #6b7280;">Conectando con el SAT...</p>
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        });
        
        const resultado = await service.timbrarFactura(facturaId);
        
        Swal.close();
        
        if (resultado.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Timbrada!',
                text: 'La factura fue timbrada exitosamente.',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Recargar la factura
            await cargarFactura();
        } else {
            throw new Error(resultado.message || 'Error al timbrar');
        }
        
    } catch (error) {
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo timbrar la factura',
            confirmButtonColor: '#d33'
        });
    }
}

/* ========================================
   HELPERS
   ======================================== */

function mostrarLoading(mostrar) {
    const loader = document.getElementById('facturaVerLoading');
    if (loader) loader.style.display = mostrar ? 'flex' : 'none';
}

function mostrarError(msg) {
    const container = document.getElementById('facturaVerContent');
    if (container) {
        container.innerHTML = `
            <div class="rsi-mobile-error">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error</h3>
                <p>${msg}</p>
                <button onclick="window.close()">Cerrar</button>
            </div>
        `;
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
            timer: 2500
        });
    }
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/E';
    try {
        return new Date(fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return fecha;
    }
}

function formatearMoneda(num) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(num || 0);
}

function getEstatusBadge(estatus) {
    const map = {
        'borrador': { class: 'borrador', icon: 'fa-pencil-alt', label: 'Borrador' },
        'pendiente': { class: 'pendiente', icon: 'fa-clock', label: 'Pendiente' },
        'timbrada': { class: 'timbrada', icon: 'fa-check-circle', label: 'Timbrada' },
        'cancelada': { class: 'cancelada', icon: 'fa-times-circle', label: 'Cancelada' },
        'cancelacion_pendiente': { class: 'pendiente', icon: 'fa-hourglass-half', label: 'Cancelación en proceso' }
    };
    const info = map[estatus] || map['borrador'];
    return `<span class="rsi-badge-status ${info.class}">
        <i class="fas ${info.icon}"></i>
        ${info.label}
    </span>`;
}

export function destroyFacturaVerController() {
    service = null;
    facturaData = null;
    facturaId = null;
}

export default facturaVerController;