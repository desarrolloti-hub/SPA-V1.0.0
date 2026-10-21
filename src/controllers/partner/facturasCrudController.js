/* ========================================
   FACTURAS CRUD CONTROLLER
   Controlador para listar y gestionar facturas
   ======================================== */
import FacturaService from '../../services/facturaService.js';
import NewCollaboratorService from '../../services/partnerService.js';

let service = null;
let collaboratorService = null;
let eventListeners = [];
let facturasData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;
let usersCache = {};
let currentFacturaId = null;
let isActionProcessing = false;

/**
 * Inicializa el controlador CRUD de facturas
 */
export async function facturasCrudController() {
    console.log('📋 Facturas CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new FacturaService();
    collaboratorService = new NewCollaboratorService();
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    currentFacturaId = null;
    
    initDeleteFactura();
    initRefreshFacturas();
    initPagination();
    initSearch();
    initClearSearch();
    initAccionesModal();
    
    await loadFacturasTable();
    await loadStats();
    
    console.log('✅ Facturas CRUD Controller listo');
}

/**
 * Inicializa el modal de acciones (Timbrar/Cancelar/Enviar)
 */
function initAccionesModal() {
    // Los botones de acción se manejan con SweetAlert
}

/**
 * Inicializa la búsqueda
 */
function initSearch() {
    const searchInput = document.getElementById('searchFactura');
    const searchBtn = document.getElementById('searchFacturaBtn');
    
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
    const searchInput = document.getElementById('searchFactura');
    const newSearchTerm = searchInput?.value?.trim() || '';
    
    if (newSearchTerm === searchTerm && isSearching) return;
    
    searchTerm = newSearchTerm;
    currentPage = 1;
    isSearching = searchTerm.length > 0;
    
    await loadFacturasTable();
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
    const searchInput = document.getElementById('searchFactura');
    
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (searchInput) {
                searchInput.value = '';
                clearBtn.style.display = 'none';
            }
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            await loadFacturasTable();
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
            await loadFacturasTable();
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
                await loadFacturasTable();
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
                await loadFacturasTable();
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
 * Inicializa el refresco de facturas
 */
function initRefreshFacturas() {
    const refreshBtn = document.getElementById('refreshFacturas');
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
            
            const searchInput = document.getElementById('searchFactura');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            
            await loadFacturasTable();
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
 * Inicializa las acciones de facturas
 */
function initDeleteFactura() {
    const tableBody = document.getElementById('facturasTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        // Prevenir acciones simultáneas o dobles clics
        if (isActionProcessing) {
            console.warn('⚠️ Otra acción de factura ya está en proceso. Clic ignorado.');
            return;
        }

        // ✅ BOTÓN VER
        const viewBtn = e.target.closest('.btn-view-factura');
        if (viewBtn) {
            const facturaId = viewBtn.dataset.id;
            handleViewFactura(facturaId);
            return;
        }
        
        // ✅ BOTÓN EDITAR
        const editBtn = e.target.closest('.btn-edit-factura');
        if (editBtn) {
            const facturaId = editBtn.dataset.id;
            handleEditFactura(facturaId);
            return;
        }
        
        // ✅ BOTÓN ELIMINAR
        const deleteBtn = e.target.closest('.btn-delete-factura');
        if (deleteBtn) {
            const facturaId = deleteBtn.dataset.id;
            await handleDeleteFactura(facturaId);
            return;
        }
        
        // ✅ BOTÓN TIMBRAR
        const timbrarBtn = e.target.closest('.btn-timbrar-factura');
        if (timbrarBtn) {
            const facturaId = timbrarBtn.dataset.id;
            await handleTimbrarFactura(facturaId);
            return;
        }
        
        // ✅ BOTÓN CANCELAR
        const cancelarBtn = e.target.closest('.btn-cancelar-factura');
        if (cancelarBtn) {
            const facturaId = cancelarBtn.dataset.id;
            await handleCancelarFactura(facturaId);
            return;
        }
        
        // ✅ BOTÓN ENVIAR
        const sendBtn = e.target.closest('.btn-send-factura');
        if (sendBtn) {
            const facturaId = sendBtn.dataset.id;
            await handleEnviarFactura(facturaId);
            return;
        }

        // ✅ BOTÓN DESCARGAR XML
        const xmlBtn = e.target.closest('.btn-xml-factura');
        if (xmlBtn) {
            const facturaId = xmlBtn.dataset.id;
            const fact = facturasData.find(f => f.id === facturaId);
            if (fact) {
                await descargarXml(fact);
            }
            return;
        }
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}


/**
 * Maneja la visualización de una factura
 * 
 * REGLAS:
 * - SIEMPRE se muestra como PDF
 * - Timbrada → PDF del storage
 * - Borrador → PDF generado temporalmente con marca de agua
 * 
 * RESPONSIVE:
 * - Desktop (>= 1024px) → Modal con iframe
 * - Mobile/Tablet → Nueva pestaña del navegador (visor nativo de PDF)
 */
async function handleViewFactura(facturaId) {
    try {
        const factura = await service.getFacturaById(facturaId);
        if (!factura) {
            throw new Error('Factura no encontrada');
        }

        const esDesktop = window.matchMedia('(min-width: 1024px)').matches;

        // ============================================
        // Determinar la URL del PDF
        // ============================================
        let pdfUrl = await obtenerPdfUrl(factura);
        
        if (!pdfUrl) {
            throw new Error('No se pudo obtener el PDF de la factura');
        }

        // ============================================
        // 📱 MOBILE: Abrir en nueva pestaña (visor nativo)
        // ============================================
        if (!esDesktop) {
            window.open(pdfUrl, '_blank');
            return;
        }

        // ============================================
        // 🖥️ DESKTOP: Mostrar en modal con iframe
        // ============================================
        await abrirPdfEnModal(factura, pdfUrl);

    } catch (error) {
        console.error('❌ Error viendo factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cargar la factura',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Obtiene la URL del PDF de la factura
 * 
 * - TIMBRADA → recupera pdfUrl del Storage (NO se construye)
 * - BORRADOR → construye PDF temporal con marca de agua
 * 
 * @returns {Promise<string>} - URL del PDF
 */
async function obtenerPdfUrl(factura) {
    const tienePdfOficial = (factura.estatus === 'timbrada' || factura.estatus === 'cancelada') && Boolean(factura.pdfUrl);

    // ============================================
    // ✅ FACTURA CON PDF OFICIAL EN STORAGE (timbrada o cancelada)
    // ============================================
    if (tienePdfOficial) {
        try {
            const archivos = await service.verificarArchivosFactura(factura.id);
            if (!archivos.pdf.existe) {
                console.warn('⚠️ No se confirmó HEAD del PDF en Storage, procediendo con URL registrada');
            }
        } catch (e) {
            console.warn('⚠️ Error verificando PDF en Storage:', e);
        }

        console.log('✅ Usando PDF oficial del Storage:', factura.pdfUrl);
        return factura.pdfUrl;
    }

    // ============================================
    // ✅ FACTURA EN BORRADOR CON PDF PREVIAMENTE GUARDADO EN STORAGE
    // ============================================
    if (factura.borradorPdfUrl && factura.estatus !== 'timbrada' && factura.estatus !== 'cancelada') {
        console.log('📄 Usando PDF borrador persistido en Storage:', factura.borradorPdfUrl);
        return factura.borradorPdfUrl;
    }

    // ============================================
    // ✅ BORRADOR / GENERACIÓN LOCAL
    // ============================================
    console.log('📄 Construyendo PDF temporal...');
    
    const { generarPDFFactura } = await import('../../utils/facturaPdfGenerator.js');
    const esBorrador = factura.estatus !== 'timbrada' && factura.estatus !== 'cancelada';
    const blob = await generarPDFFactura(factura, { esBorrador });
    
    const blobUrl = URL.createObjectURL(blob);
    registrarBlobParaLimpieza(blobUrl);
    
    return blobUrl;
}

/**
 * Registra blobs para liberarlos después
 */
const blobsParaLimpiar = [];
function registrarBlobParaLimpieza(url) {
    blobsParaLimpiar.push(url);
    // Liberar automáticamente a los 5 minutos
    setTimeout(() => {
        liberarBlob(url);
    }, 5 * 60 * 1000);
}

function liberarBlob(url) {
    const index = blobsParaLimpiar.indexOf(url);
    if (index > -1) {
        URL.revokeObjectURL(url);
        blobsParaLimpiar.splice(index, 1);
    }
}

function liberarTodosLosBlobs() {
    blobsParaLimpiar.forEach(url => URL.revokeObjectURL(url));
    blobsParaLimpiar.length = 0;
}

/**
 * Abre el PDF en un modal (Desktop)
 * Muestra el iframe con el visor nativo del navegador
 */
async function abrirPdfEnModal(factura, pdfUrl) {
    const esBorrador = factura.estatus !== 'timbrada';
    const esBlob = pdfUrl.startsWith('blob:');

    const html = `
        <div class="rsi-pdf-viewer">
            
            <!-- Header -->
            <div class="rsi-pdf-viewer-header">
                <div class="rsi-pdf-viewer-header-info">
                    <h3 class="rsi-pdf-viewer-title">
                        <i class="fas fa-file-pdf"></i>
                        Factura ${factura.facturaNumero || 'N/E'}
                    </h3>
                    <p class="rsi-pdf-viewer-subtitle">
                        ${factura.clienteRazonSocial || factura.clienteNombre || 'Sin cliente'}
                        ${esBorrador ? '<span class="rsi-pdf-viewer-badge">BORRADOR</span>' : ''}
                    </p>
                </div>
                <div class="rsi-pdf-viewer-header-actions">
                    ${(!esBorrador || factura.xmlUrl || factura.facturamaId) ? `
                        <button class="rsi-pdf-viewer-icon-btn" id="pdfViewerDownloadXmlBtn" title="Descargar XML CFDI 4.0">
                            <i class="fas fa-file-code"></i>
                        </button>
                    ` : ''}
                    <button class="rsi-pdf-viewer-icon-btn" id="pdfViewerDownloadBtn" title="Descargar PDF">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="rsi-pdf-viewer-icon-btn" id="pdfViewerCloseBtn" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Iframe con PDF -->
            <div class="rsi-pdf-viewer-body">
                <iframe 
                    src="${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH"
                    class="rsi-pdf-viewer-iframe"
                    title="Visor de PDF">
                </iframe>
            </div>

            <!-- Footer con acciones -->
            ${esBorrador ? `
                <div class="rsi-pdf-viewer-footer">
                    <div class="rsi-pdf-viewer-footer-info">
                        <i class="fas fa-info-circle"></i>
                        Este documento es un borrador sin validez fiscal
                    </div>
                    <button class="rsi-pdf-viewer-timbrar-btn" id="pdfViewerTimbrarBtn">
                        <i class="fas fa-file-signature"></i>
                        Timbrar Factura
                    </button>
                </div>
            ` : ''}

        </div>
    `;

    await Swal.fire({
        html,
        width: '90vw',
        padding: 0,
        showConfirmButton: false,
        showCloseButton: false,
        allowOutsideClick: false,
        customClass: {
            popup: 'rsi-pdf-viewer-popup',
            htmlContainer: 'rsi-pdf-viewer-html-container'
        },
        didOpen: () => {
            // Cerrar
            document.getElementById('pdfViewerCloseBtn')?.addEventListener('click', () => {
                Swal.close();
            });

            // Descargar PDF
            document.getElementById('pdfViewerDownloadBtn')?.addEventListener('click', async () => {
                await descargarPdf(pdfUrl, factura.facturaNumero, esBorrador);
            });

            // Descargar XML
            document.getElementById('pdfViewerDownloadXmlBtn')?.addEventListener('click', async () => {
                await descargarXml(factura);
            });

            // Timbrar (solo borrador)
            document.getElementById('pdfViewerTimbrarBtn')?.addEventListener('click', async () => {
                Swal.close();
                await new Promise(r => setTimeout(r, 300));
                await handleTimbrarFactura(factura.id);
            });
        },
        willClose: () => {
            // Liberar el blob si fue temporal
            if (esBlob) {
                liberarBlob(pdfUrl);
            }
        }
    });
}

/**
 * Descarga un PDF
 */
async function descargarPdf(pdfUrl, numeroFactura, esBorrador) {
    mostrarAlerta('Preparando descarga...', 'info');
    try {
        if (pdfUrl.startsWith('blob:')) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `Factura-${numeroFactura}${esBorrador ? '-BORRADOR' : ''}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            mostrarAlerta('Descargando PDF...', 'success');
            return;
        }

        try {
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Error al obtener archivo');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Factura-${numeroFactura}${esBorrador ? '-BORRADOR' : ''}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            mostrarAlerta('Descargando PDF...', 'success');
        } catch (fetchErr) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `Factura-${numeroFactura}${esBorrador ? '-BORRADOR' : ''}.pdf`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            mostrarAlerta('Abriendo PDF...', 'info');
        }
    } catch (e) {
        console.error('❌ Error descargando PDF:', e);
        window.open(pdfUrl, '_blank');
    }
}

/**
 * Descarga el XML fiscal oficial de una factura
 */
async function descargarXml(factura) {
    if (isActionProcessing) return;
    isActionProcessing = true;
    mostrarAlerta('Preparando descarga de XML...', 'info');

    try {
        let xmlUrl = factura.xmlUrl;

        // Si no tiene xmlUrl disponible, recuperar comprobantes
        if (!xmlUrl && (factura.facturamaId || factura.id)) {
            mostrarLoading(true);
            try {
                const rec = await service.recuperarComprobantes(factura.id);
                if (rec.success && rec.xmlUrl) {
                    xmlUrl = rec.xmlUrl;
                    factura.xmlUrl = xmlUrl;
                }
            } finally {
                mostrarLoading(false);
            }
        }

        if (!xmlUrl) {
            throw new Error('No se encontró la URL del archivo XML para esta factura.');
        }

        const resp = await fetch(xmlUrl);
        if (!resp.ok) {
            throw new Error(`Error descargando XML (${resp.status})`);
        }

        const xmlText = await resp.text();
        const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Factura-${factura.facturaNumero || factura.id}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

        mostrarAlerta('✅ XML descargado correctamente', 'success');

    } catch (error) {
        console.error('❌ Error descargando XML:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al descargar XML',
            text: error.message || 'No se pudo obtener el archivo XML',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
    } finally {
        isActionProcessing = false;
    }
}


/**
 * Obtiene la URL del logo según la empresa
 */
function getLogoUrl(empresaSelector) {
    return '/assets/icons/logo.png';
}

/**
 * Maneja la edición de una factura
 */
async function handleEditFactura(facturaId) {
    try {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(`/partner/factura?id=${facturaId}`);
        } else {
            window.location.href = `/partner/factura?id=${facturaId}`;
        }
    } catch (error) {
        console.error('❌ Error editando factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar la factura',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la eliminación de una factura
 */
async function handleDeleteFactura(facturaId) {
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    // No permitir eliminar facturas timbradas
    if (factura.estatus === 'timbrada') {
        Swal.fire({
            icon: 'warning',
            title: 'No se puede eliminar',
            text: 'Las facturas timbradas no se pueden eliminar. Solo se pueden cancelar.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
    }

    const result = await Swal.fire({
        title: '¿Eliminar factura?',
        html: `
            <div style="text-align: left;">
                <p><strong>Número:</strong> ${factura.facturaNumero}</p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <p><strong>Estatus:</strong> ${factura.estatus || 'Borrador'}</p>
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

    try {
        await service.deleteFactura(facturaId);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminada!',
            text: `La factura "${factura.facturaNumero}" ha sido eliminada.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadFacturasTable();
        await loadStats();
    } catch (error) {
        console.error('❌ Error eliminando factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar la factura',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja el timbrado de una factura
 * Muestra modal animado de SweetAlert durante el proceso
 */
async function handleTimbrarFactura(facturaId) {
    if (isActionProcessing) return;
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    // ✅ Verificar si ya está timbrada
    if (factura.estatus === 'timbrada') {
        Swal.fire({
            icon: 'info',
            title: 'Ya está timbrada',
            text: `La factura ${factura.facturaNumero} ya fue timbrada.`,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    // ✅ Confirmar timbrado
    const result = await Swal.fire({
        title: '¿Timbrar factura?',
        html: `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <p style="color: var(--rsi-warning); margin-top: var(--rsi-spacing-md);">
                    ⚠️ Asegúrate de que los datos del cliente sean correctos.
                </p>
                <p style="color: var(--rsi-warning);">
                    El timbrado es un proceso irreversible.
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '✅ Sí, timbrar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        isActionProcessing = true;
        // ============================================
        // ✅ MOSTRAR MODAL DE TIMBRADO
        // ============================================
        mostrarModalTimbrar(factura);

        // Simular progreso de pasos mientras se timbra
        const progresoPromise = simularProgresoTimbrado();

        // ✅ Llamar al servicio de timbrado
        const timbradoResult = await service.timbrarFactura(facturaId);

        // Esperar a que termine la animación de progreso
        await progresoPromise;

        // ============================================
        // ✅ CERRAR MODAL DE TIMBRADO
        // ============================================
        Swal.close();

        // Pequeña pausa para que se vea fluido
        await new Promise(resolve => setTimeout(resolve, 300));

        if (timbradoResult.success) {
            // ✅ Modal de éxito
            const successResult = await Swal.fire({
                icon: 'success',
                title: '✅ Factura timbrada exitosamente',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p><strong>UUID:</strong> <span style="font-size: 0.85rem; word-break: break-all;">${timbradoResult.timbrado?.Complement?.TaxStamp?.Uuid || timbradoResult.timbrado?.Uuid || 'N/A'}</span></p>
                        <p><strong>Fecha de timbrado:</strong> ${formatDate(timbradoResult.timbrado?.Complement?.TaxStamp?.Date || timbradoResult.timbrado?.Date)}</p>
                    </div>
                `,
                confirmButtonText: '📄 Ver factura',
                confirmButtonColor: '#1c1948',
                showCancelButton: true,
                cancelButtonText: 'Ir al listado',
                cancelButtonColor: '#6c757d',
                timer: 8000,
                timerProgressBar: true
            });

            // Si confirma, abrir PDF
            if (successResult.isConfirmed) {
                try {
                    const facturaActualizada = await service.getFacturaById(facturaId);
                    if (facturaActualizada?.pdfUrl) {
                        window.open(facturaActualizada.pdfUrl, '_blank');
                    } else if (facturaActualizada) {
                        // Fallback: generar PDF
                        const { abrirPDFFactura } = await import('../../utils/facturaPdfGenerator.js');
                        await abrirPDFFactura(facturaActualizada, { esBorrador: false });
                    }
                } catch (e) {
                    console.warn('No se pudo abrir el PDF:', e);
                }
            }

            // ✅ Recargar tabla y stats
            await loadFacturasTable();
            await loadStats();

        } else {
            throw new Error(timbradoResult.message || 'Error al timbrar');
        }

    } catch (error) {
        Swal.close();
        console.error('❌ Error timbrando factura:', error);
        
        // Pequeña pausa para que se cierre el modal de timbrado
        await new Promise(resolve => setTimeout(resolve, 200));

        Swal.fire({
            icon: 'error',
            title: 'Error al timbrar',
            html: `
                <div style="text-align: left;">
                    <p style="color: var(--rsi-danger); font-weight: 600;">${error.message || 'Ocurrió un error al timbrar la factura'}</p>
                    <p style="font-size: 0.85rem; color: var(--rsi-gray-500); margin-top: var(--rsi-spacing-md);">
                        💡 Verifica los datos del cliente y vuelve a intentarlo.
                    </p>
                </div>
            `,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    } finally {
        isActionProcessing = false;
    }
}

/**
 * Muestra el modal de "Timbrando factura" con SweetAlert
 */
function mostrarModalTimbrar(factura) {
    Swal.fire({
        title: null,
        html: `
            <div class="rsi-timbrar-swal">
                
                <!-- Animación del documento -->
                <div class="rsi-timbrar-animation">
                    <div class="rsi-timbrar-document">
                        <i class="fas fa-file-invoice"></i>
                        <div class="rsi-timbrar-stamp">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                    <div class="rsi-timbrar-ripple"></div>
                    <div class="rsi-timbrar-ripple rsi-timbrar-ripple-delay"></div>
                </div>
                
                <!-- Título -->
                <h3 class="rsi-timbrar-title">Timbrando Factura</h3>
                <p class="rsi-timbrar-subtitle">
                    <strong>${factura.facturaNumero}</strong> · ${factura.clienteRazonSocial || factura.clienteNombre || ''}
                </p>
                
                <!-- Barra de progreso -->
                <div class="rsi-timbrar-progress">
                    <div class="rsi-timbrar-progress-bar" id="timbrarProgressBar"></div>
                </div>
                
                <!-- Pasos del proceso -->
                <div class="rsi-timbrar-steps">
                    <div class="rsi-timbrar-step" data-step="1">
                        <div class="rsi-timbrar-step-icon">
                            <i class="fas fa-check"></i>
                        </div>
                        <span>Validando</span>
                    </div>
                    <div class="rsi-timbrar-step" data-step="2">
                        <div class="rsi-timbrar-step-icon">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <span>Enviando PAC</span>
                    </div>
                    <div class="rsi-timbrar-step" data-step="3">
                        <div class="rsi-timbrar-step-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <span>Esperando SAT</span>
                    </div>
                    <div class="rsi-timbrar-step" data-step="4">
                        <div class="rsi-timbrar-step-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <span>Generando PDF</span>
                    </div>
                </div>
                
                <!-- Nota -->
                <p class="rsi-timbrar-note">
                    <i class="fas fa-info-circle"></i>
                    No cierres esta ventana. El proceso puede tardar unos segundos.
                </p>
                
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        width: '500px',
        padding: '0',
        customClass: {
            popup: 'rsi-swal-timbrar-popup'
        },
        didOpen: () => {
            // Pequeña pausa para que se renderice y luego animar la barra
            setTimeout(() => {
                const progressBar = document.getElementById('timbrarProgressBar');
                if (progressBar) {
                    progressBar.style.width = '35%';
                }
            }, 100);
        }
    });
}

/**
 * Simula el progreso del timbrado paso a paso
 * Se ejecuta en paralelo al request real
 */
async function simularProgresoTimbrado() {
    const steps = [1, 2, 3, 4];
    const progressValues = [35, 60, 85, 95];
    const delays = [800, 1500, 2500, 3500];
    
    for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delays[i] - (delays[i - 1] || 0)));
        
        // Actualizar barra de progreso
        const progressBar = document.getElementById('timbrarProgressBar');
        if (progressBar) {
            progressBar.style.width = `${progressValues[i]}%`;
        }
        
        // Actualizar icono del paso
        const stepElement = document.querySelector(`.rsi-timbrar-step[data-step="${steps[i]}"]`);
        if (stepElement) {
            const iconEl = stepElement.querySelector('.rsi-timbrar-step-icon i');
            if (iconEl) {
                // Marcar pasos anteriores como completados
                if (i > 0) {
                    const prevStep = document.querySelector(`.rsi-timbrar-step[data-step="${steps[i - 1]}"]`);
                    if (prevStep) {
                        prevStep.classList.add('rsi-step-completed');
                        const prevIcon = prevStep.querySelector('.rsi-timbrar-step-icon i');
                        if (prevIcon) {
                            prevIcon.className = 'fas fa-check';
                        }
                    }
                }
                
                // El paso actual muestra spinner
                if (i < steps.length - 1) {
                    stepElement.classList.add('rsi-step-active');
                    iconEl.className = 'fas fa-spinner fa-spin';
                } else {
                    // Último paso: spinner hasta que se complete
                    stepElement.classList.add('rsi-step-active');
                    iconEl.className = 'fas fa-spinner fa-spin';
                }
            }
        }
    }
    
    // Marcar todos los pasos como completados
    steps.forEach(step => {
        const stepElement = document.querySelector(`.rsi-timbrar-step[data-step="${step}"]`);
        if (stepElement) {
            stepElement.classList.remove('rsi-step-active');
            stepElement.classList.add('rsi-step-completed');
            const iconEl = stepElement.querySelector('.rsi-timbrar-step-icon i');
            if (iconEl) {
                iconEl.className = 'fas fa-check';
            }
        }
    });
    
    // Barra al 100%
    const progressBar = document.getElementById('timbrarProgressBar');
    if (progressBar) {
        progressBar.style.width = '100%';
    }
}

/**
 * Maneja la cancelación de una factura timbrada
 */
async function handleCancelarFactura(facturaId) {
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    if (factura.estatus === 'cancelada') {
        Swal.fire({
            icon: 'info',
            title: 'Ya cancelada',
            text: 'Esta factura ya fue cancelada previamente.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    // Solo se pueden cancelar facturas timbradas o en proceso de cancelación
    if (factura.estatus !== 'timbrada' && factura.estatus !== 'cancelacion_pendiente') {
        Swal.fire({
            icon: 'info',
            title: 'No se puede cancelar',
            text: 'Solo las facturas timbradas pueden ser canceladas.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Cancelar Factura Fiscal',
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                <p><strong>UUID:</strong> <span style="font-size: 0.8rem; word-break: break-all;">${factura.timbrado?.uuid || 'N/A'}</span></p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <hr style="margin: 12px 0;">
                
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">
                    Motivo de Cancelación SAT:
                </label>
                <select id="swalCancelMotivo" class="swal2-select" style="width: 100%; margin: 0 0 10px 0; font-size: 0.85rem;">
                    <option value="02" selected>02 - Comprobante emitido con errores sin relación</option>
                    <option value="01">01 - Comprobante emitido con errores con relación (Requiere sustituto)</option>
                    <option value="03">03 - No se llevó a cabo la operación</option>
                    <option value="04">04 - Operación nominativa relacionada en una factura global</option>
                </select>

                <div id="swalFolioSustitucionGroup" style="display: none; margin-top: 10px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 5px;">
                        UUID Sustituto (36 caracteres):
                    </label>
                    <input id="swalFolioSustitucion" class="swal2-input" placeholder="Ej: 12345678-ABCD-1234-ABCD-1234567890AB" style="width: 100%; margin: 0; font-size: 0.85rem;" />
                    <small style="color: var(--rsi-gray-500); display: block; margin-top: 4px;">
                        El nuevo comprobante debe existir previamente con relación tipo 04.
                    </small>
                </div>

                <p style="color: var(--rsi-danger); margin-top: 15px; font-size: 0.85rem;">
                    ⚠️ La solicitud de cancelación ante el SAT es un proceso oficial e irreversible.
                </p>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '🚫 Solicitar Cancelación',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const selectMotivo = document.getElementById('swalCancelMotivo');
            const grupoSustitucion = document.getElementById('swalFolioSustitucionGroup');
            selectMotivo?.addEventListener('change', () => {
                if (selectMotivo.value === '01') {
                    grupoSustitucion.style.display = 'block';
                } else {
                    grupoSustitucion.style.display = 'none';
                }
            });
        },
        preConfirm: () => {
            const motivo = document.getElementById('swalCancelMotivo')?.value;
            const folioSustitucion = document.getElementById('swalFolioSustitucion')?.value?.trim();

            if (!motivo) {
                Swal.showValidationMessage('Debe seleccionar un motivo de cancelación');
                return false;
            }

            if (motivo === '01') {
                const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
                if (!folioSustitucion || !uuidRegex.test(folioSustitucion)) {
                    Swal.showValidationMessage('Debe ingresar un UUID sustituto válido con formato 8-4-4-4-12');
                    return false;
                }
            }

            return { motivo, folioSustitucion: motivo === '01' ? folioSustitucion : null };
        }
    });

    if (!formValues) return;

    try {
        Swal.fire({
            title: 'Procesando cancelación...',
            html: `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #d33;"></i>
                    <p style="margin-top: 15px; color: #6b7280;">Contactando al SAT y a Facturama...</p>
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        });

        const resultado = await service.cancelarFactura(facturaId, formValues);

        Swal.close();

        if (resultado.estatus === 'cancelada') {
            await Swal.fire({
                icon: 'success',
                title: '✅ Factura cancelada',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p><strong>Estatus fiscal:</strong> Cancelada</p>
                        <p><strong>Detalle:</strong> ${resultado.message}</p>
                    </div>
                `,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
        } else {
            await Swal.fire({
                icon: 'info',
                title: '⏳ Cancelación en proceso',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p><strong>Estatus fiscal:</strong> Pendiente de aceptación</p>
                        <p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px;">
                            ${resultado.message || 'La solicitud fue enviada al SAT. El receptor tiene hasta 72 horas para aceptarla.'}
                        </p>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#1c1948'
            });
        }

        await loadFacturasTable();
        await loadStats();

    } catch (error) {
        Swal.close();
        console.error('❌ Error cancelando factura:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al cancelar',
            text: error.message || 'Ocurrió un error al cancelar la factura',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja el envío de una factura por email
 */
async function handleEnviarFactura(facturaId) {
    if (isActionProcessing) return;
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    // Verificar que tenga email
    if (!factura.clienteEmail) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin email',
            text: 'El cliente no tiene email registrado. No se puede enviar la factura.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
    }

    // Verificar que esté timbrada
    if (factura.estatus !== 'timbrada') {
        Swal.fire({
            icon: 'warning',
            title: 'Factura no timbrada',
            text: 'Solo se pueden enviar facturas timbradas ante el SAT.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
    }

    // Si falta XML o PDF en el registro en memoria, intentar recuperarlos
    if ((!factura.xmlUrl || !factura.pdfUrl) && (factura.facturamaId || factura.id)) {
        try {
            mostrarLoading(true);
            const rec = await service.recuperarComprobantes(facturaId);
            if (rec.success) {
                if (rec.xmlUrl) factura.xmlUrl = rec.xmlUrl;
                if (rec.pdfUrl) factura.pdfUrl = rec.pdfUrl;
            }
        } catch (recErr) {
            console.warn('⚠️ No se pudieron recuperar comprobantes automáticamente antes del envío:', recErr.message);
        } finally {
            mostrarLoading(false);
        }
    }

    // Verificar que tenga PDF
    if (!factura.pdfUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin PDF',
            text: 'La factura no tiene PDF asociado. No se puede enviar.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
    }

    // Verificar que tenga XML fiscal
    if (!factura.xmlUrl && !factura.facturamaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin XML Fiscal',
            text: 'La factura no cuenta con el comprobante XML fiscal correspondiente. No se puede enviar.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
    }

    const result = await Swal.fire({
        title: '📤 Enviar Factura por Correo',
        html: `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Email:</strong> ${factura.clienteEmail}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <p style="color: var(--rsi-success); margin-top: var(--rsi-spacing-md);">
                    📄 Se enviarán el PDF de la factura y el XML fiscal (CFDI 4.0) como archivos adjuntos descargables.
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✉️ Enviar por Email',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) return;

    try {
        isActionProcessing = true;
        mostrarLoading(true);

        // Usar la función de Firebase para enviar email
        const response = await fetch('https://us-central1-rsienterprise.cloudfunctions.net/enviarFacturaEmail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                facturaId: facturaId,
                email: factura.clienteEmail,
                pdfUrl: factura.pdfUrl,
                xmlUrl: factura.xmlUrl,
                pdfPath: factura.pdfPath,
                xmlPath: factura.xmlPath,
                facturamaId: factura.facturamaId,
                facturaNumero: factura.facturaNumero,
                clienteNombre: factura.clienteRazonSocial || factura.clienteNombre,
                logoUrl: `${window.location.origin}/assets/icons/logo.png`,
                total: factura.totalFinal || factura.total || 0,
                fecha: factura.facturaFecha || factura.timbrado?.fechaTimbrado || '',
                uuid: factura.timbrado?.uuid || factura.uuid || ''
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
                        <p><strong>Destinatario:</strong> ${factura.clienteEmail}</p>
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p style="color: var(--rsi-success);">✅ Los archivos PDF y XML han sido enviados por correo electrónico como documentos adjuntos descargables.</p>
                    </div>
                `,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#1c1948'
            });
        } else {
            throw new Error(data.error || data.message || 'Error al enviar el email');
        }

    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error enviando factura:', error);
        
        // Ofrecer descargar el PDF
        const resultDownload = await Swal.fire({
            icon: 'error',
            title: 'Error al enviar email',
            text: error.message || 'No se pudo enviar el correo electrónico',
            showCancelButton: true,
            confirmButtonText: '📥 Descargar PDF',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d'
        });

        if (resultDownload.isConfirmed && factura.pdfUrl) {
            window.open(factura.pdfUrl, '_blank');
        }
    } finally {
        isActionProcessing = false;
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
 * Usa NewCollaboratorService que consulta la colección de colaboradores
 */
async function getUserName(uid) {
    if (!uid) return 'Sistema';
    
    // ✅ Verificar caché primero
    if (usersCache[uid]) {
        return usersCache[uid];
    }
    
    try {
        // ✅ Usar el servicio de colaboradores
        const name = await collaboratorService.getUserName(uid);
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
        'borrador': { class: 'borrador', icon: 'fa-pencil-alt', label: 'Borrador' },
        'pendiente': { class: 'pendiente', icon: 'fa-clock', label: 'Pendiente' },
        'timbrada': { class: 'timbrada', icon: 'fa-check-circle', label: 'Timbrada' },
        'cancelada': { class: 'cancelada', icon: 'fa-times-circle', label: 'Cancelada' },
        'cancelacion_pendiente': { class: 'pendiente', icon: 'fa-hourglass-half', label: 'Canc. Pendiente' }
    };
    
    const info = estatusMap[estatus] || estatusMap['borrador'];
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
        const stats = await service.getFacturaStats();
        
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statBorradores').textContent = stats.borradores;
        document.getElementById('statPendientes').textContent = stats.pendientes;
        document.getElementById('statTimbradas').textContent = stats.timbradas;
        document.getElementById('statTotalMonto').textContent = formatCurrency(stats.totalMonto);
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

/**
 * Carga y muestra las facturas en la tabla
 */
async function loadFacturasTable() {
    const tableBody = document.getElementById('facturasTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const facturaCount = document.getElementById('facturaCount');
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
        
        let facturas = await service.getAllFacturas();
        
        // Filtrar por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            facturas = facturas.filter(fact => {
                const numero = (fact.facturaNumero || '').toLowerCase();
                const cliente = (fact.clienteRazonSocial || fact.clienteNombre || '').toLowerCase();
                const rfc = (fact.clienteRFC || '').toLowerCase();
                return numero.includes(termLower) || cliente.includes(termLower) || rfc.includes(termLower);
            });
        }
        
        facturasData = facturas;
        totalItems = facturas.length;
        totalPages = Math.ceil(totalItems / pageSize);
        
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const paginatedFacturas = facturas.slice(start, end);

        if (loadingState) loadingState.style.display = 'none';

        if (paginatedFacturas.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (emptyStateTitle) {
                    emptyStateTitle.textContent = isSearching 
                        ? 'No se encontraron resultados' 
                        : 'No hay facturas registradas';
                }
                if (emptyStateText) {
                    emptyStateText.textContent = isSearching 
                        ? `No hay facturas que coincidan con "${searchTerm}"` 
                        : 'Comienza creando tu primera factura.';
                }
                const emptyBtn = emptyState.querySelector('a');
                if (emptyBtn && isSearching) {
                    emptyBtn.style.display = 'none';
                } else if (emptyBtn) {
                    emptyBtn.style.display = 'inline-flex';
                }
            }
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (facturaCount) facturaCount.textContent = '0';
            if (paginationContainer) paginationContainer.style.display = 'none';
            updateSearchInfo();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (facturaCount) facturaCount.textContent = totalItems;
        if (paginationContainer) paginationContainer.style.display = 'flex';
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
        }

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

        let rowsHtml = '';
        for (const fact of paginatedFacturas) {
            const creadoPorNombre = await getUserName(fact.creadoPor);
            const estatus = fact.estatus || 'borrador';
            const isTimbrada = estatus === 'timbrada';
            const isCancelada = estatus === 'cancelada';
            const isBorrador = estatus === 'borrador';
            const isPendiente = estatus === 'pendiente';
            
            rowsHtml += `
                <tr>
                    <td data-label="Número">
                        <span style="font-weight: 600; font-size: 0.85rem;">${fact.facturaNumero || '-'}</span>
                        ${fact.cotizacionNumero ? `<br><small style="color: var(--rsi-gray-500); font-size: 0.65rem;">📄 Cot: ${fact.cotizacionNumero}</small>` : ''}
                    </td>
                    <td data-label="Cliente">
                        <span style="font-weight: 500;">${fact.clienteRazonSocial || fact.clienteNombre || '-'}</span>
                        <br>
                        <small style="color: var(--rsi-gray-500); font-size: 0.75rem;">${fact.clienteRFC || 'Sin RFC'}</small>
                    </td>
                    <td data-label="Cotización">
                        <span style="font-size: 0.85rem;">${fact.cotizacionNumero || '-'}</span>
                    </td>
                    <td data-label="Fecha">
                        <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                            ${formatDate(fact.facturaFecha)}
                        </span>
                    </td>
                    <td data-label="Total">
                        <span style="font-weight: 700; color: var(--rsi-primary);">
                            ${formatCurrency(fact.totalFinal)}
                        </span>
                    </td>
                    <td data-label="Estatus">
                        ${getEstatusBadge(estatus)}
                        ${isTimbrada && fact.timbrado?.uuid ? `<br><small style="font-size: 0.6rem; color: var(--rsi-gray-500);">UUID: ${fact.timbrado.uuid.substring(0, 8)}...</small>` : ''}
                    </td>
                    <td data-label="Creado por">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem;">${creadoPorNombre}</span>
                            <small style="color: var(--rsi-gray-500); font-size: 0.7rem;">
                                ${formatDate(fact.createdAt)}
                            </small>
                        </div>
                    </td>
                    <td data-label="Acciones">
                        <div class="rsi-table-actions">
                            <button class="rsi-btn-icon rsi-btn-icon-view btn-view-factura" data-id="${fact.id}" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-factura" data-id="${fact.id}" title="Editar factura">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!isTimbrada && !isCancelada ? `
                                <button class="rsi-btn-icon rsi-btn-icon-timbrar btn-timbrar-factura" data-id="${fact.id}" title="Timbrar factura" style="color: var(--rsi-success);">
                                    <i class="fas fa-file-signature"></i>
                                </button>
                            ` : ''}
                            ${isTimbrada && !isCancelada ? `
                                <button class="rsi-btn-icon rsi-btn-icon-cancelar btn-cancelar-factura" data-id="${fact.id}" title="Cancelar factura" style="color: var(--rsi-danger);">
                                    <i class="fas fa-ban"></i>
                                </button>
                            ` : ''}
                            ${isTimbrada && !isCancelada ? `
                                <button class="rsi-btn-icon rsi-btn-icon-send btn-send-factura" data-id="${fact.id}" title="Enviar factura" style="color: var(--rsi-primary);">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                                <button class="rsi-btn-icon rsi-btn-icon-xml btn-xml-factura" data-id="${fact.id}" title="Descargar XML CFDI 4.0" style="color: #0d9488;">
                                    <i class="fas fa-file-code"></i>
                                </button>
                            ` : ''}
                            ${!isTimbrada ? `
                                <button class="rsi-btn-icon rsi-btn-icon-delete btn-delete-factura" data-id="${fact.id}" title="Eliminar factura" style="color: var(--rsi-danger);">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = rowsHtml;

        updateSearchInfo();

    } catch (error) {
        console.error('❌ Error cargando facturas:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar las facturas: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyFacturasCrudController() {
    console.log('🧹 Destroying FacturasCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    // ✅ Liberar blobs pendientes
    liberarTodosLosBlobs();
    
    service = null;
    facturasData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    currentFacturaId = null;
    isActionProcessing = false;
}

export default facturasCrudController;