/* ========================================
   COTIZACIONES CRUD CONTROLLER
   Controlador para listar y gestionar cotizaciones
   ======================================== */

import CotizacionService from '../../services/cotizacionService.js';
import FacturaService from '../../services/facturaService.js';
import TicketService from '../../services/ticketService.js';
import { generarPDFCotizacion } from '../../utils/pdfGenerator.js';

/*Importaciones para que funcione el modal de clientes*/
import { openModal } from '../../utils/modalManager.js';
import clienteModalController from '../../components/modals/clienteModal/clienteModalController.js';
import modalHtml from '../../components/modals/clienteModal/clienteModal.html?raw';

let service = null;
let facturaService = null;
let ticketService = null;
let eventListeners = [];
let cotizacionesData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;
let usersCache = {};
let currentCotizacionId = null;
let facturasCache = {}; // ✅ Cache de facturas por cotizaciónId

// Logo para PDF
const LOGO_URL = '/assets/icons/logo.png';

/**
 * Inicializa el controlador CRUD de cotizaciones
 */
export async function cotizacionesCrudController() {
    console.log('📋 Cotizaciones CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new CotizacionService();
    facturaService = new FacturaService();
    ticketService = new TicketService();
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    currentCotizacionId = null;
    facturasCache = {};
    
    initDeleteCotizacion();
    initRefreshCotizaciones();
    initPagination();
    initSearch();
    initClearSearch();
    initEnvioModal();
    initClienteModal();//inicia el modal del cliente
    
    await loadCotizacionesTable();
    await loadStats();
    
    console.log('✅ Cotizaciones CRUD Controller listo');
}

/**
 * ✅ Carga todas las facturas y las organiza por cotizaciónId
 */
async function loadFacturasCache() {
    try {
        const facturas = await facturaService.getAllFacturas();
        facturasCache = {};
        
        facturas.forEach(factura => {
            const cotizacionId = factura.cotizacionId;
            if (cotizacionId) {
                // Si ya existe una factura para esta cotización, no sobrescribir
                // (tomamos la primera)
                if (!facturasCache[cotizacionId]) {
                    facturasCache[cotizacionId] = {
                        id: factura.id,
                        facturaNumero: factura.facturaNumero,
                        estatus: factura.estatus,
                        totalFinal: factura.totalFinal,
                        facturaFecha: factura.facturaFecha
                    };
                }
            }
        });
        
        console.log(`✅ Caché de facturas cargado: ${Object.keys(facturasCache).length} facturas asociadas`);
    } catch (error) {
        console.error('❌ Error cargando caché de facturas:', error);
        facturasCache = {};
    }
}

/**
 * Inicializa el modal de envío
 */
function initEnvioModal() {
    const modal = document.getElementById('modalEnvio');
    const closeBtn = document.getElementById('closeEnvioModal');
    const emailBtn = document.getElementById('btnEnviarEmail');
    const whatsappBtn = document.getElementById('btnEnviarWhatsApp');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        eventListeners.push({ element: closeBtn, event: 'click', handler: () => modal.style.display = 'none' });
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        eventListeners.push({ element: modal, event: 'click', handler: (e) => {
            if (e.target === modal) modal.style.display = 'none';
        }});
    }
    
    if (emailBtn) {
        emailBtn.addEventListener('click', handleEnviarEmail);
        eventListeners.push({ element: emailBtn, event: 'click', handler: handleEnviarEmail });
    }
    
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', handleEnviarWhatsApp);
        eventListeners.push({ element: whatsappBtn, event: 'click', handler: handleEnviarWhatsApp });
    }
}

/**
 * Abre el modal de envío (ahora usa SweetAlert)
 */
async function openEnvioModal(cotizacionId) {
    try {
        const cotizacion = cotizacionesData.find(c => c.id === cotizacionId);
        if (!cotizacion) {
            mostrarAlerta('Cotización no encontrada', 'error');
            return;
        }

        // Obtener la URL del PDF desde Firebase Storage
        let pdfUrl = cotizacion.pdfUrl || '';
        
        // Si no tiene URL en el documento, intentar obtenerla
        if (!pdfUrl) {
            const cotizacionCompleta = await service.getCotizacionById(cotizacionId);
            pdfUrl = cotizacionCompleta?.pdfUrl || '';
        }

        const clienteNombre = cotizacion.clienteNombre || 'N/A';
        const cotizacionNumero = cotizacion.cotizacionNumero || 'N/A';
        const telefono = cotizacion.clienteTelefono || '';
        
        // Limpiar número de teléfono
        const telefonoLimpio = telefono.replace(/\s/g, '').replace(/[^0-9]/g, '');
        const telefonoInternacional = telefonoLimpio.startsWith('52') ? telefonoLimpio : `52${telefonoLimpio}`;

        // Mensaje para WhatsApp con enlace
        let mensajeWhatsApp = `Hola, te comparto la cotización ${cotizacionNumero} para ${clienteNombre}.`;
        if (pdfUrl) {
            mensajeWhatsApp += `\n\nPuedes ver/descargar el PDF aquí: ${pdfUrl}`;
        } else {
            mensajeWhatsApp += `\n\nEl PDF se generará al abrir el enlace.`;
        }
        mensajeWhatsApp += `\n\n¡Gracias por tu confianza!`;

        const whatsappUrl = `https://wa.me/${telefonoInternacional}?text=${encodeURIComponent(mensajeWhatsApp)}`;

        // Mostrar SweetAlert en lugar del modal
        const result = await Swal.fire({
            title: '📤 Enviar Cotización',
            html: `
                <div style="text-align: left;">
                    <p><strong>Cotización:</strong> ${cotizacionNumero}</p>
                    <p><strong>Cliente:</strong> ${clienteNombre}</p>
                    <p><strong>Teléfono:</strong> ${telefono || 'No disponible'}</p>
                    ${pdfUrl ? `<p style="font-size: 0.85rem; color: var(--rsi-gray-500); word-break: break-all;"><strong>📄 PDF:</strong> <a href="${pdfUrl}" target="_blank">${pdfUrl.substring(0, 50)}...</a></p>` : '<p style="font-size: 0.85rem; color: var(--rsi-warning);">⚠️ PDF no disponible en la nube</p>'}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '📱 Enviar por WhatsApp',
            cancelButtonText: '✉️ Enviar por Email',
            confirmButtonColor: '#25D366',
            cancelButtonColor: '#1c1948',
            showDenyButton: true,
            denyButtonText: '📋 Copiar enlace',
            denyButtonColor: '#6c757d',
            reverseButtons: false
        });

        if (result.isConfirmed) {
            // Enviar por WhatsApp
            window.open(whatsappUrl, '_blank');
            mostrarAlerta('✅ Abriendo WhatsApp...', 'success');
        } else if (result.isDenied) {
            // Copiar enlace
            if (pdfUrl) {
                try {
                    await navigator.clipboard.writeText(pdfUrl);
                    mostrarAlerta('✅ Enlace copiado al portapapeles', 'success');
                } catch (error) {
                    // Fallback
                    const textarea = document.createElement('textarea');
                    textarea.value = pdfUrl;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    mostrarAlerta('✅ Enlace copiado al portapapeles', 'success');
                }
            } else {
                mostrarAlerta('❌ No hay enlace disponible para copiar', 'error');
            }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Enviar por Email - solo si hay URL
            if (pdfUrl) {
                handleEnviarEmail(cotizacionId, pdfUrl);
            } else {
                mostrarAlerta('❌ No hay PDF disponible para enviar por email', 'error');
            }
        }

        currentCotizacionId = cotizacionId;

    } catch (error) {
        console.error('❌ Error abriendo modal de envío:', error);
        mostrarAlerta('Error al abrir el envío', 'error');
    }
}

/**
 * Maneja el envío por email (usa la función de Firebase)
 */
async function handleEnviarEmail(cotizacionId, pdfUrl) {
    try {
        if (!cotizacionId) {
            cotizacionId = currentCotizacionId;
        }
        
        if (!cotizacionId) {
            mostrarAlerta('No hay cotización seleccionada', 'error');
            return;
        }
        
        const cotizacion = await service.getCotizacionById(cotizacionId);
        if (!cotizacion) {
            mostrarAlerta('Cotización no encontrada', 'error');
            return;
        }

        // Si no se pasó pdfUrl, obtenerla
        if (!pdfUrl) {
            pdfUrl = cotizacion.pdfUrl || '';
        }

        if (!pdfUrl) {
            mostrarAlerta('❌ No hay PDF disponible para enviar', 'error');
            return;
        }

        mostrarLoading(true);

        // ✅ Usar la función de Firebase para enviar email
        // Esta función debe estar desplegada en Firebase Cloud Functions
        const response = await fetch('https://us-central1-rsienterprise.cloudfunctions.net/enviarCotizacionEmail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cotizacionId: cotizacionId,
                email: cotizacion.clienteEmail || '',
                pdfUrl: pdfUrl,
                cotizacionNumero: cotizacion.cotizacionNumero,
                clienteNombre: cotizacion.clienteNombre
            })
        });

        const data = await response.json();

        mostrarLoading(false);

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: '✅ Email enviado',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Destinatario:</strong> ${cotizacion.clienteEmail || 'No especificado'}</p>
                        <p><strong>Cotización:</strong> ${cotizacion.cotizacionNumero}</p>
                        <p style="color: var(--rsi-success);">✅ El PDF ha sido enviado por correo electrónico</p>
                    </div>
                `,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
        } else {
            throw new Error(data.message || 'Error al enviar el email');
        }

    } catch (error) {
        console.error('❌ Error enviando email:', error);
        mostrarLoading(false);
        
        // Si falla la función de Firebase, ofrecer descargar el PDF
        const result = await Swal.fire({
            icon: 'error',
            title: 'Error al enviar email',
            text: error.message || 'No se pudo enviar el correo electrónico',
            showCancelButton: true,
            confirmButtonText: '📥 Descargar PDF',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d'
        });

        if (result.isConfirmed && pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    }
}

/**
 * Maneja el envío por WhatsApp
 */
async function handleEnviarWhatsApp() {
    try {
        if (!currentCotizacionId) {
            mostrarAlerta('No hay cotización seleccionada', 'error');
            return;
        }
        
        const cotizacion = await service.getCotizacionById(currentCotizacionId);
        if (!cotizacion) {
            mostrarAlerta('Cotización no encontrada', 'error');
            return;
        }
        
        mostrarLoading(true);
        
        const pdfBlob = await generarPDFCotizacion(cotizacion, LOGO_URL);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const telefono = cotizacion.clienteTelefono || '';
        const mensaje = `Hola, te comparto la cotización ${cotizacion.cotizacionNumero} para ${cotizacion.clienteNombre}.`;
        const whatsappUrl = `https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;
        
        mostrarAlerta('✅ Abriendo WhatsApp...', 'success');
        window.open(whatsappUrl, '_blank');
        
        document.getElementById('modalEnvio').style.display = 'none';
        mostrarLoading(false);
        
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error);
        mostrarAlerta('❌ Error al enviar por WhatsApp', 'error');
        mostrarLoading(false);
    }
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchCotizacion');
    const searchBtn = document.getElementById('searchCotizacionBtn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            await performSearch();
        });
        eventListeners.push({ element: searchBtn, event: 'click', handler: performSearch });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await performSearch();
            }
        });
        eventListeners.push({ element: searchInput, event: 'keypress', handler: performSearch });
        
        searchInput.addEventListener('input', () => {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
            }
        });
        eventListeners.push({ element: searchInput, event: 'input', handler: () => {
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
            }
        }});
    }
}

/**
 * Realiza la búsqueda
 */
async function performSearch() {
    const searchInput = document.getElementById('searchCotizacion');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadCotizacionesTable();
    await loadStats();
    updateSearchInfo();
}

/**
 * Actualiza la información de búsqueda
 */
function updateSearchInfo() {
    const searchInfo = document.getElementById('searchResultsInfo');
    const searchText = document.getElementById('searchResultsText');
    
    if (!searchInfo || !searchText) return;
    
    if (isSearching && searchTerm.length > 0) {
        searchInfo.style.display = 'flex';
        searchText.innerHTML = `
            <i class="fas fa-search"></i> 
            Resultados para: <strong>"${searchTerm}"</strong> 
            (${totalItems} ${totalItems === 1 ? 'coincidencia' : 'coincidencias'})
        `;
    } else {
        searchInfo.style.display = 'none';
    }
}

/**
 * Inicializa el limpiar búsqueda
 */
function initClearSearch() {
    const clearBtn = document.getElementById('clearSearchBtn');
    const clearResultsBtn = document.getElementById('clearSearchResults');
    const searchInput = document.getElementById('searchCotizacion');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadCotizacionesTable();
            await loadStats();
            updateSearchInfo();
        });
        eventListeners.push({ element: clearBtn, event: 'click', handler: () => {} });
    }
    
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadCotizacionesTable();
            await loadStats();
            updateSearchInfo();
        });
        eventListeners.push({ element: clearResultsBtn, event: 'click', handler: () => {} });
    }
}

/**
 * Inicializa la paginación
 */
function initPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await loadCotizacionesTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
        eventListeners.push({ element: prevBtn, event: 'click', handler: () => {} });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await loadCotizacionesTable();
                const tableWrapper = document.querySelector('.rsi-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
        eventListeners.push({ element: nextBtn, event: 'click', handler: () => {} });
    }
}

/**
 * Inicializa el refresco de cotizaciones
 */
function initRefreshCotizaciones() {
    const refreshBtn = document.getElementById('refreshCotizaciones');
    if (!refreshBtn) return;

    const handler = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            service.clearCache?.();
            usersCache = {};
            currentPage = 1;
            searchTerm = '';
            isSearching = false;
            
            const searchInput = document.getElementById('searchCotizacion');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            // ✅ Recargar caché de facturas
            await loadFacturasCache();
            
            await loadCotizacionesTable();
            await loadStats();
            updateSearchInfo();
            
            refreshBtn.style.color = 'var(--rsi-success)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 500);
            
        } catch (error) {
            console.error('❌ Error actualizando:', error);
            refreshBtn.style.color = 'var(--rsi-danger)';
            setTimeout(() => {
                refreshBtn.style.color = '';
            }, 500);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
        }
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
}

/**
 * Inicializa las acciones de cotizaciones
 */
function initDeleteCotizacion() {
    const tableBody = document.getElementById('cotizacionesTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        // ✅ BOTÓN FACTURAR
        const facturarBtn = e.target.closest('.btn-facturar-cotizacion');
        if (facturarBtn) {
            const cotizacionId = facturarBtn.dataset.id;
            // ✅ Redirigir al formulario de factura con el ID de la cotización
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(`/partner/factura?cotizacionId=${cotizacionId}`);
            } else {
                window.location.href = `/partner/factura?cotizacionId=${cotizacionId}`;
            }
            return;
        }
        
        const deleteBtn = e.target.closest('.btn-delete-cotizacion');
        if (deleteBtn) {
            const cotizacionId = deleteBtn.dataset.id;
            await handleDeleteCotizacion(cotizacionId);
            return;
        }
        
        const viewBtn = e.target.closest('.btn-view-cotizacion');
        if (viewBtn) {
            const cotizacionId = viewBtn.dataset.id;
            handleViewCotizacion(cotizacionId);
            return;
        }
        
        const editBtn = e.target.closest('.btn-edit-cotizacion');
        if (editBtn) {
            const cotizacionId = editBtn.dataset.id;
            handleEditCotizacion(cotizacionId);
            return;
        }
        
        const pdfBtn = e.target.closest('.btn-pdf-cotizacion');
        if (pdfBtn) {
            const cotizacionId = pdfBtn.dataset.id;
            handlePdfCotizacion(cotizacionId);
            return;
        }
        
        const sendBtn = e.target.closest('.btn-send-cotizacion');
        if (sendBtn) {
            const cotizacionId = sendBtn.dataset.id;
            openEnvioModal(cotizacionId);
            return;
        }

        // ✅ CAMBIAR ESTATUS
        const statusBtn = e.target.closest('.btn-status-cotizacion');
        if (statusBtn) {
            const cotizacionId = statusBtn.dataset.id;
            await handleCambiarEstatus(cotizacionId);
            return;
        }

        // ✅ GESTIONAR O VINCULAR TICKET
        const ticketBtn = e.target.closest('.btn-ticket-cotizacion') || e.target.closest('.ticket-link-badge');
        if (ticketBtn) {
            const cotizacionId = ticketBtn.dataset.id;
            await handleGestionarTicket(cotizacionId);
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * ✅ Maneja la conversión de cotización a factura
 */
async function handleFacturarCotizacion(cotizacionId) {
    try {
        const cotizacion = cotizacionesData.find(c => c.id === cotizacionId);
        if (!cotizacion) {
            mostrarAlerta('Cotización no encontrada', 'error');
            return;
        }

        // ✅ Verificar si ya tiene factura usando el caché
        if (facturasCache[cotizacionId]) {
            const factura = facturasCache[cotizacionId];
            Swal.fire({
                icon: 'warning',
                title: 'Ya tiene factura',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p><strong>Estatus:</strong> ${factura.estatus || 'Pendiente'}</p>
                        <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal || 0)}</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Ver factura',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6c757d'
            }).then((result) => {
                if (result.isConfirmed) {
                    if (typeof window.navigateTo === 'function') {
                        window.navigateTo(`/partner/factura?id=${factura.id}`);
                    } else {
                        window.location.href = `/partner/factura?id=${factura.id}`;
                    }
                }
            });
            return;
        }

        // Confirmar conversión
        const result = await Swal.fire({
            title: '¿Convertir a factura?',
            html: `
                <div style="text-align: left;">
                    <p><strong>Cotización:</strong> ${cotizacion.cotizacionNumero}</p>
                    <p><strong>Cliente:</strong> ${cotizacion.clienteNombre}</p>
                    <p><strong>Total:</strong> ${formatCurrency(cotizacion.totalFinal)}</p>
                    <p style="color: var(--rsi-warning); margin-top: var(--rsi-spacing-md);">
                        ⚠️ Se generará una factura con los datos de esta cotización.
                    </p>
                    <p style="font-size: 0.9rem; color: var(--rsi-gray-500);">
                        La factura se creará en estado "Pendiente" y podrás editarla después.
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, generar factura',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        mostrarLoading(true);

        // Generar número de factura
        const fecha = new Date();
        const fechaStr = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        const facturaNumero = `FAC-${fechaStr}-${cotizacion.cotizacionNumero.split('-').pop() || '001'}`;

        // Crear factura desde cotización
        const resultado = await facturaService.crearFacturaDesdeCotizacion(cotizacionId, facturaNumero);

        if (!resultado.success) {
            throw new Error(resultado.message);
        }

        // ✅ Actualizar caché de facturas
        await loadFacturasCache();

        mostrarLoading(false);

        Swal.fire({
            icon: 'success',
            title: '¡Factura generada!',
            html: `
                <div style="text-align: left;">
                    <p><strong>Factura:</strong> ${facturaNumero}</p>
                    <p><strong>Cotización:</strong> ${cotizacion.cotizacionNumero}</p>
                    <p><strong>Cliente:</strong> ${cotizacion.clienteNombre}</p>
                    <p><strong>Total:</strong> ${formatCurrency(cotizacion.totalFinal)}</p>
                </div>
            `,
            confirmButtonText: 'Ver factura',
            confirmButtonColor: '#1c1948',
            showCancelButton: true,
            cancelButtonText: 'Ir al listado'
        }).then((res) => {
            if (res.isConfirmed) {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(`/partner/factura?id=${resultado.id}`);
                } else {
                    window.location.href = `/partner/factura?id=${resultado.id}`;
                }
            } else {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('/partner/crudFacturas');
                } else {
                    window.location.href = '/partner/crudFacturas';
                }
            }
        });

        // Recargar tabla
        await loadCotizacionesTable();
        await loadStats();

    } catch (error) {
        console.error('❌ Error facturando cotización:', error);
        mostrarLoading(false);
        
        let errorMessage = error.message || 'Error al generar la factura';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

// =================================================================================
// FUNCIONES DE UTILIDAD
// =================================================================================

function mostrarLoading(mostrar) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = mostrar ? 'flex' : 'none';
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

/**
 * Obtiene el nombre de un usuario por su UID (con caché)
 */
async function getUserName(uid) {
    if (!uid) return 'Sistema';
    
    if (usersCache[uid]) {
        return usersCache[uid];
    }
    
    try {
        const name = await service.getUserName(uid);
        usersCache[uid] = name;
        return name;
    } catch (error) {
        console.error('❌ Error obteniendo usuario:', error);
        return 'Usuario desconocido';
    }
}

/**
 * Formatea una fecha
 */
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

/**
 * Formatea moneda
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
}

/**
 * Obtiene el badge de estatus
 */
function getEstatusBadge(estatus) {
    const estatusMap = {
        'en proceso': { class: 'en-proceso', icon: 'fa-clock', label: 'En Proceso' },
        'vendida': { class: 'vendida', icon: 'fa-check-circle', label: 'Vendida' },
        'rechazada': { class: 'rechazada', icon: 'fa-times-circle', label: 'Rechazada' },
        'borrador': { class: 'borrador', icon: 'fa-pencil-alt', label: 'Borrador' },
        'completada': { class: 'completada', icon: 'fa-check-double', label: 'Completada' }
    };
    
    const info = estatusMap[estatus] || estatusMap['en proceso'];
    return `<span class="rsi-badge-status ${info.class}">
        <i class="fas ${info.icon}"></i>
        ${info.label}
    </span>`;
}

/**
 * Carga las estadísticas
 */
async function loadStats() {
    try {
        const stats = await service.getCotizacionStats();
        
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statEnProceso').textContent = stats.enProceso;
        document.getElementById('statVendidas').textContent = stats.vendidas;
        document.getElementById('statRechazadas').textContent = stats.rechazadas;
        document.getElementById('statTotalMonto').textContent = formatCurrency(stats.totalMonto);
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

/**
 * Carga y muestra las cotizaciones en la tabla
 */
async function loadCotizacionesTable() {
    const tableBody = document.getElementById('cotizacionesTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const cotizacionCount = document.getElementById('cotizacionCount');
    const paginationContainer = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const emptyStateTitle = document.getElementById('emptyStateTitle');
    const emptyStateText = document.getElementById('emptyStateText');
    
    if (!tableBody) return;

    try {
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        
        // ✅ Cargar caché de facturas primero
        await loadFacturasCache();
        
        let cotizaciones = await service.getAllCotizaciones();
        
        // Filtrar por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            cotizaciones = cotizaciones.filter(coti => {
                const numero = (coti.cotizacionNumero || '').toLowerCase();
                const cliente = (coti.clienteNombre || '').toLowerCase();
                const descripcion = (coti.cotizacionDescripcion || '').toLowerCase();
                return numero.includes(termLower) || cliente.includes(termLower) || descripcion.includes(termLower);
            });
        }
        
        // ✅ Asignar factura a cada cotización desde el caché
        cotizaciones = cotizaciones.map(coti => {
            const factura = facturasCache[coti.id];
            if (factura) {
                return {
                    ...coti,
                    tieneFactura: true,
                    facturaId: factura.id,
                    facturaNumero: factura.facturaNumero,
                    facturaEstatus: factura.estatus
                };
            }
            return {
                ...coti,
                tieneFactura: false
            };
        });
        
        cotizacionesData = cotizaciones;
        totalItems = cotizaciones.length;
        totalPages = Math.ceil(totalItems / pageSize);
        
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const paginatedCotizaciones = cotizaciones.slice(start, end);

        if (loadingState) loadingState.style.display = 'none';

        if (paginatedCotizaciones.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay cotizaciones registradas';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay cotizaciones que coincidan con "${searchTerm}"` 
                        : 'Comienza creando tu primera cotización.';
                }
                const emptyBtn = emptyState.querySelector('a');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (cotizacionCount) cotizacionCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (cotizacionCount) cotizacionCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        let rowsHtml = '';
        for (const coti of paginatedCotizaciones) {
            const creadoPorNombre = await getUserName(coti.creadoPor);
            const descripcion = coti.cotizacionDescripcion || 'Sin descripción';
            const descripcionCorta = descripcion.length > 60 ? descripcion.substring(0, 60) + '...' : descripcion;
            const estatus = coti.estatus || coti.estado || 'en proceso';
            const tieneFactura = coti.tieneFactura || false;
            const tieneTicket = !!coti.ticketAsociado;
            
            rowsHtml += `
                <tr>
                    <td data-label="Número">
                        <span style="font-weight: 600; font-size: 0.85rem;">${coti.cotizacionNumero || '-'}</span>
                        ${tieneFactura ? `<br><small style="color: var(--rsi-success); font-size: 0.65rem;"><i class="fas fa-file-invoice"></i> Factura: ${coti.facturaNumero || ''}</small>` : ''}
                        ${tieneTicket ? `<br><small class="ticket-link-badge" data-ticket="${coti.ticketAsociado}" data-id="${coti.id}" style="color: #2563eb; font-size: 0.72rem; cursor: pointer; font-weight: 600;" title="Ver o gestionar ticket vinculado"><i class="fas fa-ticket-alt"></i> Ticket: ${coti.ticketAsociado}</small>` : ''}
                    </td>
                    <td data-label="Cliente">
                        <span style="font-weight: 500;">${coti.clienteNombre || '-'}</span>
                        <br>
                        <small style="color: var(--rsi-gray-500); font-size: 0.75rem;">${coti.clienteRFC || 'Sin RFC'}</small>
                    </td>
                    <td data-label="Descripción">
                        <div class="rsi-descripcion-container">
                            <span class="rsi-descripcion-texto">${descripcionCorta}</span>
                            <div class="rsi-descripcion-tooltip">${descripcion}</div>
                        </div>
                    </td>
                    <td data-label="Fecha">
                        <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                            ${formatDate(coti.cotizacionFecha)}
                        </span>
                    </td>
                    <td data-label="Total">
                        <span style="font-weight: 700; color: var(--rsi-primary);">
                            ${formatCurrency(coti.totalFinal)}
                        </span>
                    </td>
                    <td data-label="Estatus">
                        <div class="rsi-status-badge-wrapper btn-status-cotizacion" data-id="${coti.id}" data-estatus="${estatus}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Haz clic para cambiar el estatus">
                            ${getEstatusBadge(estatus)}
                            <i class="fas fa-pencil-alt" style="font-size: 0.65rem; color: var(--rsi-gray-400); margin-left: 2px;"></i>
                        </div>
                    </td>
                    <td data-label="Creado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem;">${creadoPorNombre}</span>
                            <small style="color: var(--rsi-gray-500); font-size: 0.7rem;">
                                ${formatDate(coti.createdAt)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-cotizacion" data-id="${coti.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-cotizacion" data-id="${coti.id}" title="Editar cotización">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-pdf btn-pdf-cotizacion" data-id="${coti.id}" title="Ver/Descargar PDF">
                                <i class="fas fa-file-pdf"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-send btn-send-cotizacion" data-id="${coti.id}" title="Enviar cotización">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                            <!-- ✅ BOTÓN CAMBIAR ESTATUS -->
                            <button class="rsi-btn-icon btn-status-cotizacion" 
                                    data-id="${coti.id}" 
                                    data-estatus="${estatus}" 
                                    title="Cambiar estatus de la cotización">
                                <i class="fas fa-exchange-alt"></i>
                            </button>
                            <!-- ✅ BOTÓN VINCULAR / CREAR TICKET -->
                            <button class="rsi-btn-icon btn-ticket-cotizacion" 
                                    data-id="${coti.id}" 
                                    title="${tieneTicket ? 'Ticket: ' + coti.ticketAsociado : 'Vincular o crear Ticket'}"
                                    style="${tieneTicket ? 'color: #2563eb;' : ''}">
                                <i class="fas fa-ticket-alt"></i>
                            </button>
                            <!-- ✅ BOTÓN FACTURAR -->
                            <button class="rsi-btn-icon rsi-btn-icon-facturar btn-facturar-cotizacion" 
                                    data-id="${coti.id}" 
                                    title="${tieneFactura ? 'Ya tiene factura' : 'Convertir a factura'}"
                                    style="${tieneFactura ? 'color: var(--rsi-success);' : ''}">
                                <i class="fas ${tieneFactura ? 'fa-file-invoice' : 'fa-receipt'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando cotizaciones:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar las cotizaciones: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la eliminación de una cotización
 */
async function handleDeleteCotizacion(cotizacionId) {
    const cotizacion = cotizacionesData.find(c => c.id === cotizacionId);
    if (!cotizacion) return;

    // ✅ Verificar si tiene factura antes de eliminar
    if (facturasCache[cotizacionId]) {
        const result = await Swal.fire({
            title: '¿Eliminar cotización con factura?',
            html: `
                <div style="text-align: left;">
                    <p><strong>Cotización:</strong> ${cotizacion.cotizacionNumero}</p>
                    <p><strong>Factura asociada:</strong> ${facturasCache[cotizacionId].facturaNumero}</p>
                    <p style="color: var(--rsi-danger); margin-top: var(--rsi-spacing-md);">
                        ⚠️ Esta cotización tiene una factura asociada.
                    </p>
                    <p style="color: var(--rsi-warning);">
                        Se eliminará también la factura asociada.
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar todo',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;
        
        // Eliminar factura primero
        try {
            await facturaService.deleteFactura(facturasCache[cotizacionId].id);
        } catch (error) {
            console.error('❌ Error eliminando factura:', error);
            // Continuar con la eliminación de la cotización
        }
    } else {
        const result = await Swal.fire({
            title: '¿Eliminar cotización?',
            html: `
                <div style="text-align: left;">
                    <p><strong>Número:</strong> ${cotizacion.cotizacionNumero}</p>
                    <p><strong>Cliente:</strong> ${cotizacion.clienteNombre}</p>
                    <p><strong>Total:</strong> ${formatCurrency(cotizacion.totalFinal)}</p>
                    <p style="color: var(--rsi-danger); margin-top: var(--rsi-spacing-md);">
                        ⚠️ Esta acción no se puede deshacer.
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;
    }

    try {
        await service.deleteCotizacion(cotizacionId);
        
        // ✅ Actualizar caché de facturas
        await loadFacturasCache();
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminada!',
            text: `La cotización "${cotizacion.cotizacionNumero}" ha sido eliminada.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadCotizacionesTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error eliminando cotización:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar la cotización',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de una cotización
 */
async function handleViewCotizacion(cotizacionId) {
    try {
        const cotizacion = await service.getCotizacionById(cotizacionId);
        if (!cotizacion) {
            throw new Error('Cotización no encontrada');
        }

        const creadoPorNombre = await getUserName(cotizacion.creadoPor);
        const modificadoPorNombre = await getUserName(cotizacion.modificadoPor || cotizacion.creadoPor);

        let itemsHtml = '';
        if (cotizacion.items && cotizacion.items.length > 0) {
            itemsHtml = cotizacion.items.map((item, index) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                    <div style="flex: 1;">
                        <span style="font-weight: 500;">${item.descripcion || 'Item ' + (index + 1)}</span>
                        <br>
                        <small style="color: var(--rsi-gray-500);">
                            ${item.categoria || 'Sin categoría'} | ${item.cantidad || 0} x ${formatCurrency(item.precio || 0)}
                        </small>
                    </div>
                    <span style="font-weight: 600;">${formatCurrency(item.total || 0)}</span>
                </div>
            `).join('');
        } else {
            itemsHtml = '<p style="color: var(--rsi-gray-500);">Sin items</p>';
        }

        // ✅ Mostrar información de factura si existe
        let facturaInfo = '';
        if (facturasCache[cotizacionId]) {
            const factura = facturasCache[cotizacionId];
            facturaInfo = `
                <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                <div style="background: rgba(46, 204, 113, 0.1); padding: var(--rsi-spacing-md); border-radius: var(--rsi-radius-md);">
                    <span style="color: var(--rsi-success); font-weight: 600;"><i class="fas fa-file-invoice"></i> Factura asociada</span>
                    <p style="margin: 0;"><strong>Número:</strong> ${factura.facturaNumero}</p>
                    <p style="margin: 0;"><strong>Estatus:</strong> ${factura.estatus || 'Pendiente'}</p>
                    <p style="margin: 0;"><strong>Total:</strong> ${formatCurrency(factura.totalFinal || 0)}</p>
                </div>
            `;
        }

        Swal.fire({
            title: `Cotización ${cotizacion.cotizacionNumero}`,
            html: `
                <div style="text-align: left; max-height: 450px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm); margin-bottom: var(--rsi-spacing-md);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Cliente</span>
                            <p style="font-weight: 600; margin: 0;">${cotizacion.clienteNombre || '-'}</p>
                            <p style="font-size: 0.85rem; margin: 0;">${cotizacion.clienteRFC || 'Sin RFC'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Fecha</span>
                            <p style="margin: 0;">${formatDate(cotizacion.cotizacionFecha)}</p>
                            <p style="font-size: 0.85rem; margin: 0;">Vigencia: ${cotizacion.cotizacionVigencia || '30'} días</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Total</span>
                            <p style="font-weight: 700; margin: 0; color: var(--rsi-primary);">${formatCurrency(cotizacion.totalFinal)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Estatus</span>
                            <p style="margin: 0;">${getEstatusBadge(cotizacion.estatus || cotizacion.estado || 'en proceso')}</p>
                        </div>
                    </div>
                    ${facturaInfo}
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div>
                        <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Descripción</span>
                        <p style="margin: 0;">${cotizacion.cotizacionDescripcion || 'Sin descripción'}</p>
                    </div>
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div>
                        <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Items (${cotizacion.items?.length || 0})</span>
                        <div style="margin-top: var(--rsi-spacing-xs);">
                            ${itemsHtml}
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 0;">${creadoPorNombre}</p>
                            <p style="font-size: 0.75rem; color: var(--rsi-gray-500);">${formatDate(cotizacion.createdAt)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Modificado por</span>
                            <p style="margin: 0;">${modificadoPorNombre}</p>
                            <p style="font-size: 0.75rem; color: var(--rsi-gray-500);">${formatDate(cotizacion.updatedAt)}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '750px'
        });

    } catch (error) {
        console.error('❌ Error viendo cotización:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cargar los detalles',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la edición de una cotización
 */
async function handleEditCotizacion(cotizacionId) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/cotizacion?id=${cotizacionId}`);
        } else {
            window.location.href = `/partner/cotizacion?id=${cotizacionId}`;
        }
    } catch (error) {
        console.error('❌ Error editando cotización:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar la cotización',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la generación de PDF
 */
async function handlePdfCotizacion(cotizacionId) {
    try {
        mostrarLoading(true);
        
        const cotizacion = await service.getCotizacionById(cotizacionId);
        if (!cotizacion) {
            throw new Error('Cotización no encontrada');
        }

        const pdfBlob = await generarPDFCotizacion(cotizacion, LOGO_URL);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const nuevaVentana = window.open(pdfUrl, '_blank');
        if (!nuevaVentana) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `cotizacion-${cotizacion.cotizacionNumero}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        mostrarLoading(false);
        
    } catch (error) {
        console.error('❌ Error generando PDF:', error);
        mostrarAlerta('❌ Error al generar el PDF: ' + error.message, 'error');
        mostrarLoading(false);
    }
}

/**
 * Renderiza la paginación
 */
function renderPagination() {
    const paginationContainer = document.querySelector('.pagination-container');
    if (!paginationContainer) return;
    
    const { currentPage, totalPages } = { currentPage, totalPages };
    
    paginationContainer.innerHTML = '';
    
    // Botón Anterior
    const prevButton = document.createElement('button');
    prevButton.className = `pagination-btn prev`;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => changePage(currentPage - 1));
    paginationContainer.appendChild(prevButton);
    
    // Números de página
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        const firstButton = document.createElement('button');
        firstButton.className = 'pagination-btn';
        firstButton.textContent = '1';
        firstButton.addEventListener('click', () => changePage(1));
        paginationContainer.appendChild(firstButton);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginationContainer.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn${i === currentPage ? ' active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => changePage(i));
        paginationContainer.appendChild(pageButton);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginationContainer.appendChild(dots);
        }
        
        const lastButton = document.createElement('button');
        lastButton.className = 'pagination-btn';
        lastButton.textContent = totalPages;
        lastButton.addEventListener('click', () => changePage(totalPages));
        paginationContainer.appendChild(lastButton);
    }
    
    // Botón Siguiente
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn next';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => changePage(currentPage + 1));
    paginationContainer.appendChild(nextButton);
}

/**
 * Cambia de página
 */
function changePage(pageNumber) {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    currentPage = pageNumber;
    loadCotizacionesTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Limpia eventos
 */
/**
 * ✅ Maneja el cambio de estatus de una cotización
 */
async function handleCambiarEstatus(cotizacionId) {
    const coti = cotizacionesData.find(c => c.id === cotizacionId);
    if (!coti) return;

    const estatusActual = (coti.estatus || coti.estado || 'en proceso').toLowerCase();

    const { value: formValues } = await Swal.fire({
        title: 'Cambiar Estatus de Cotización',
        html: `
            <div style="text-align: left; margin-top: 10px;">
                <p><strong>Cotización:</strong> ${coti.cotizacionNumero || 'S/N'}</p>
                <p><strong>Cliente:</strong> ${coti.clienteNombre || '-'}</p>
                <div style="margin-top: 15px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px;">Nuevo Estatus:</label>
                    <select id="swalEstatusSelect" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;">
                        <option value="en proceso" ${estatusActual === 'en proceso' ? 'selected' : ''}>En Proceso (Pendiente)</option>
                        <option value="vendida" ${estatusActual === 'vendida' ? 'selected' : ''}>Vendida (Aprobada)</option>
                        <option value="rechazada" ${estatusActual === 'rechazada' ? 'selected' : ''}>Rechazada</option>
                        <option value="borrador" ${estatusActual === 'borrador' ? 'selected' : ''}>Borrador</option>
                        <option value="completada" ${estatusActual === 'completada' ? 'selected' : ''}>Completada</option>
                    </select>
                </div>
                <div id="swalMotivoContainer" style="margin-top: 15px; display: ${estatusActual === 'rechazada' ? 'block' : 'none'};">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px;">Motivo de Rechazo:</label>
                    <textarea id="swalMotivoRechazo" class="swal2-textarea" style="width: 100%; margin: 0; box-sizing: border-box;" placeholder="Ingresa la razón del rechazo...">${coti.motivoRechazo || ''}</textarea>
                </div>
            </div>
        `,
        didOpen: () => {
            const select = document.getElementById('swalEstatusSelect');
            const motivoContainer = document.getElementById('swalMotivoContainer');
            if (select && motivoContainer) {
                select.addEventListener('change', () => {
                    motivoContainer.style.display = select.value === 'rechazada' ? 'block' : 'none';
                });
            }
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Guardar Estatus',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d',
        preConfirm: () => {
            const estatus = document.getElementById('swalEstatusSelect').value;
            const motivo = document.getElementById('swalMotivoRechazo')?.value?.trim() || '';
            return { estatus, motivo };
        }
    });

    if (!formValues) return;

    try {
        mostrarLoading(true);
        await service.updateCotizacionEstatus(cotizacionId, formValues.estatus, formValues.motivo);
        
        coti.estatus = formValues.estatus;
        if (formValues.motivo) coti.motivoRechazo = formValues.motivo;
        
        await loadCotizacionesTable();
        await loadStats();
        mostrarLoading(false);

        // Si cambió a VENDIDA, ofrecer crear ticket operativo inmediatamente
        if (formValues.estatus === 'vendida') {
            const ticketPrompt = await Swal.fire({
                title: '¡Cotización Marcada como Vendida!',
                html: `
                    <div style="text-align: left;">
                        <p>La cotización <strong>${coti.cotizacionNumero}</strong> ha sido registrada como <strong>Vendida</strong>.</p>
                        <p style="color: var(--rsi-text-secondary, #475569); margin-top: 8px;">
                            ¿Deseas generar el <strong>ticket de servicio operativo</strong> ahora para comenzar la atención?
                        </p>
                    </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-ticket-alt"></i> Crear Ticket Ahora',
                cancelButtonText: 'Más tarde',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6c757d'
            });

            if (ticketPrompt.isConfirmed) {
                crearTicketDesdeCotizacion(coti);
            }
        } else {
            mostrarAlerta(`Estatus actualizado a "${formValues.estatus}"`, 'success');
        }
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error cambiando estatus:', error);
        mostrarAlerta(error.message || 'Error al actualizar el estatus', 'error');
    }
}

/**
 * ✅ Maneja la vinculación o gestión de ticket para una cotización
 */
async function handleGestionarTicket(cotizacionId) {
    const coti = cotizacionesData.find(c => c.id === cotizacionId);
    if (!coti) return;

    if (coti.ticketAsociado) {
        const result = await Swal.fire({
            title: 'Gestión de Ticket Vinculado',
            html: `
                <div style="text-align: left;">
                    <p>Esta cotización está vinculada al ticket:</p>
                    <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid #3b82f6; border-radius: var(--rsi-radius-md); padding: 12px; margin: 10px 0;">
                        <strong style="color: #1e40af; font-size: 1.1rem;"><i class="fas fa-ticket-alt"></i> ${coti.ticketAsociado}</strong>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--rsi-gray-500);">¿Qué acción deseas realizar?</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-eye"></i> Ver Ticket',
            denyButtonText: '<i class="fas fa-unlink"></i> Desvincular',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            denyButtonColor: '#dc2626',
            cancelButtonColor: '#6c757d'
        });

        if (result.isConfirmed) {
            const targetUrl = coti.ticketId ? `/partner/ticketView?id=${coti.ticketId}` : `/partner/crudTickets`;
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(targetUrl);
            } else {
                window.location.href = targetUrl;
            }
        } else if (result.isDenied) {
            const confirmDesvincular = await Swal.fire({
                title: '¿Desvincular Ticket?',
                text: `Se eliminará la asociación entre la cotización ${coti.cotizacionNumero} y el ticket ${coti.ticketAsociado}.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, desvincular',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626'
            });

            if (confirmDesvincular.isConfirmed) {
                try {
                    mostrarLoading(true);
                    await service.desvincularTicket(cotizacionId, coti.ticketId);
                    coti.ticketAsociado = '';
                    coti.ticketId = '';
                    await loadCotizacionesTable();
                    mostrarLoading(false);
                    mostrarAlerta('Ticket desvinculado exitosamente', 'success');
                } catch (error) {
                    mostrarLoading(false);
                    mostrarAlerta('Error desvinculando ticket: ' + error.message, 'error');
                }
            }
        }
    } else {
        const result = await Swal.fire({
            title: 'Asociar Ticket a Cotización',
            html: `
                <div style="text-align: left;">
                    <p>Cotización: <strong>${coti.cotizacionNumero || 'S/N'}</strong></p>
                    <p>Cliente: <strong>${coti.clienteNombre || '-'}</strong></p>
                    <p style="margin-top: 12px; font-size: 0.9rem; color: var(--rsi-text-secondary);">Selecciona la opción deseada:</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-plus"></i> Crear Nuevo Ticket',
            denyButtonText: '<i class="fas fa-link"></i> Vincular a Ticket Existente',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            denyButtonColor: '#2563eb',
            cancelButtonColor: '#6c757d'
        });

        if (result.isConfirmed) {
            crearTicketDesdeCotizacion(coti);
        } else if (result.isDenied) {
            await seleccionarTicketParaVincular(coti);
        }
    }
}

/**
 * ✅ Selecciona un ticket existente de la base de datos para vincular a la cotización
 */
async function seleccionarTicketParaVincular(coti) {
    try {
        mostrarLoading(true);
        if (!ticketService) {
            ticketService = new TicketService();
        }

        const tickets = await ticketService.getAllTickets();
        mostrarLoading(false);

        if (!tickets || tickets.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'No hay tickets disponibles',
                text: 'No se encontraron tickets registrados en el sistema para vincular.',
                confirmButtonColor: '#1c1948'
            });
            return;
        }

        const optionsHtml = tickets.map(t => {
            const labelCliente = t.clienteNombre ? ` [${t.clienteNombre}]` : '';
            const matchCliente = coti.clienteId && t.clienteId === coti.clienteId;
            return `<option value="${t.id}" data-idticket="${t.idTicket}">${t.idTicket} - ${t.titulo || 'Sin título'}${labelCliente}${matchCliente ? ' ⭐ Coincide Cliente' : ''}</option>`;
        }).join('');

        const { value: selection } = await Swal.fire({
            title: 'Seleccionar Ticket para Vincular',
            html: `
                <div style="text-align: left;">
                    <p style="font-size: 0.9rem; color: var(--rsi-text-secondary); margin-bottom: 12px;">
                        Selecciona el ticket que deseas asociar a la cotización <strong>${coti.cotizacionNumero}</strong>:
                    </p>
                    <select id="swalTicketSelect" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;">
                        <option value="">-- Elige un ticket --</option>
                        ${optionsHtml}
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-link"></i> Vincular Ticket',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d',
            preConfirm: () => {
                const select = document.getElementById('swalTicketSelect');
                if (!select.value) {
                    Swal.showValidationMessage('Debes seleccionar un ticket');
                    return false;
                }
                const selectedOption = select.options[select.selectedIndex];
                return {
                    docId: select.value,
                    idTicket: selectedOption.dataset.idticket
                };
            }
        });

        if (!selection) return;

        mostrarLoading(true);
        await service.vincularTicket(coti.id, selection.idTicket, selection.docId, coti.cotizacionNumero);
        coti.ticketAsociado = selection.idTicket;
        coti.ticketId = selection.docId;
        await loadCotizacionesTable();
        mostrarLoading(false);

        mostrarAlerta(`Ticket ${selection.idTicket} vinculado exitosamente a la cotización`, 'success');
    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error vinculando ticket:', error);
        mostrarAlerta('Error al vincular ticket: ' + error.message, 'error');
    }
}

/**
 * ✅ Navega al formulario de creación de ticket pre-cargando los parámetros de la cotización
 */
function crearTicketDesdeCotizacion(coti) {
    const partidasTexto = coti.items && coti.items.length 
        ? '\n\nPartidas cotizadas:\n' + coti.items.map(i => `• ${i.cantidad || 1} ${i.tipoTecnologia || 'unidad'} - ${i.descripcion || ''}`).join('\n')
        : '';

    const params = new URLSearchParams({
        cotizacionId: coti.id,
        cotizacionNumero: coti.cotizacionNumero || '',
        clienteId: coti.clienteId || '',
        clienteNombre: coti.clienteNombre || '',
        clienteRFC: coti.clienteRFC || '',
        clienteEmail: coti.clienteEmail || '',
        clienteTelefono: coti.clienteTelefono || '',
        titulo: `Servicio Cotización ${coti.cotizacionNumero || ''}`,
        descripcion: (coti.cotizacionDescripcion || '') + partidasTexto,
        servicio: coti.tipoCotizacion || 'Proyecto / Instalación',
        proyecto: coti.proyecto || coti.cotizacionProyecto || '',
        atencionA: coti.contacto || coti.clienteContacto || coti.atencionA || ''
    });

    const targetUrl = `/partner/ticket?${params.toString()}`;
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(targetUrl);
    } else {
        window.location.href = targetUrl;
    }
}

export function destroyCotizacionesCrudController() {
    console.log('🧹 Destroying CotizacionesCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    facturaService = null;
    cotizacionesData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    currentCotizacionId = null;
    facturasCache = {};
}

function initClienteModal() {
    const btnNuevo = document.getElementById('btnNuevoCliente');
    console.log('🔍 btnNuevo encontrado:', btnNuevo);
    console.log('📄 modalHtml cargado:', typeof modalHtml, modalHtml?.length);

    if (!btnNuevo) {
        console.error('❌ No existe #btnNuevoCliente en el DOM');
        return;
    }

    const handler = async () => {
        console.log('🖱️ Click en Nuevo Cliente');
        try {
            await openModal({
                html: modalHtml,
                controller: (ctx) => clienteModalController({
                    close: ctx.close,
                    onSuccess: ({ id, data }) => {
                        console.log('✅ Cliente creado:', id, data);
                        // Opcional: recargar algo si quieres
                        // await loadCotizacionesTable();
                    }
                })
            });
            console.log('✅ Modal abierto');
        } catch (err) {
            console.error('❌ Error en openModal:', err);
        }
    };

    btnNuevo.addEventListener('click', handler);
    eventListeners.push({ element: btnNuevo, event: 'click', handler });
}

export default cotizacionesCrudController;