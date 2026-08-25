/* ========================================
   FACTURAS CRUD CONTROLLER
   Controlador para listar y gestionar facturas
   ======================================== */

import FacturaService from '../../services/facturaService.js';

let service = null;
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
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * Maneja la visualización de detalles de una factura
 */
async function handleViewFactura(facturaId) {
    try {
        const factura = await service.getFacturaById(facturaId);
        if (!factura) {
            throw new Error('Factura no encontrada');
        }

        const creadoPorNombre = await getUserName(factura.creadoPor);
        const modificadoPorNombre = await getUserName(factura.modificadoPor || factura.creadoPor);

        let itemsHtml = '';
        if (factura.items && factura.items.length > 0) {
            itemsHtml = factura.items.map((item, index) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                    <div style="flex: 1;">
                        <span style="font-weight: 500;">${item.descripcion || 'Item ' + (index + 1)}</span>
                        <br>
                        <small style="color: var(--rsi-gray-500);">
                            ${item.categoriaNombre || 'Sin categoría'} | ${item.cantidad || 0} x ${formatCurrency(item.precioUnitario || 0)}
                        </small>
                    </div>
                    <span style="font-weight: 600;">${formatCurrency(item.total || 0)}</span>
                </div>
            `).join('');
        } else {
            itemsHtml = '<p style="color: var(--rsi-gray-500);">Sin items</p>';
        }

        // Información de timbrado si existe
        let timbradoInfo = '';
        if (factura.estatus === 'timbrada' && factura.timbrado) {
            timbradoInfo = `
                <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                <div style="background: rgba(46, 204, 113, 0.1); padding: var(--rsi-spacing-md); border-radius: var(--rsi-radius-md);">
                    <span style="color: var(--rsi-success); font-weight: 600;">✅ Factura Timbrada</span>
                    <p style="margin: 0;"><strong>UUID:</strong> ${factura.timbrado.uuid || '-'}</p>
                    <p style="margin: 0;"><strong>Fecha timbrado:</strong> ${formatDate(factura.timbrado.fechaTimbrado)}</p>
                    <p style="margin: 0;"><strong>No. Certificado:</strong> ${factura.timbrado.noCertificado || '-'}</p>
                    ${factura.pdfUrl ? `<p style="margin: 0;"><a href="${factura.pdfUrl}" target="_blank">📄 Ver PDF</a></p>` : ''}
                </div>
            `;
        }

        Swal.fire({
            title: `Factura ${factura.facturaNumero}`,
            html: `
                <div style="text-align: left; max-height: 450px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm); margin-bottom: var(--rsi-spacing-md);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Cliente</span>
                            <p style="font-weight: 600; margin: 0;">${factura.clienteRazonSocial || factura.clienteNombre || '-'}</p>
                            <p style="font-size: 0.85rem; margin: 0;">${factura.clienteRFC || 'Sin RFC'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Fecha</span>
                            <p style="margin: 0;">${formatDate(factura.facturaFecha)}</p>
                            <p style="font-size: 0.85rem; margin: 0;">Cotización: ${factura.cotizacionNumero || 'N/A'}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Total</span>
                            <p style="font-weight: 700; margin: 0; color: var(--rsi-primary);">${formatCurrency(factura.totalFinal)}</p>
                            <p style="font-size: 0.85rem; margin: 0;">Subtotal: ${formatCurrency(factura.subtotal)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Estatus</span>
                            <p style="margin: 0;">${getEstatusBadge(factura.estatus)}</p>
                        </div>
                    </div>
                    ${timbradoInfo}
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div>
                        <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Descripción</span>
                        <p style="margin: 0;">${factura.facturaDescripcion || 'Sin descripción'}</p>
                    </div>
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div>
                        <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Items (${factura.items?.length || 0})</span>
                        <div style="margin-top: var(--rsi-spacing-xs);">
                            ${itemsHtml}
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-sm) 0; border-color: var(--rsi-gray-200);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--rsi-spacing-sm);">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado por</span>
                            <p style="margin: 0;">${creadoPorNombre}</p>
                            <p style="font-size: 0.75rem; color: var(--rsi-gray-500);">${formatDate(factura.createdAt)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Modificado por</span>
                            <p style="margin: 0;">${modificadoPorNombre}</p>
                            <p style="font-size: 0.75rem; color: var(--rsi-gray-500);">${formatDate(factura.updatedAt)}</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '750px'
        });

    } catch (error) {
        console.error('❌ Error viendo factura:', error);
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
 */
async function handleTimbrarFactura(facturaId) {
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    // Verificar si ya está timbrada
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

    // Confirmar timbrado
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
        mostrarLoading(true);

        const timbradoResult = await service.timbrarFactura(facturaId);

        if (timbradoResult.success) {
            mostrarLoading(false);
            
            Swal.fire({
                icon: 'success',
                title: '✅ Factura timbrada exitosamente',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                        <p><strong>UUID:</strong> ${timbradoResult.timbrado?.Complement?.TaxStamp?.Uuid || timbradoResult.timbrado?.Uuid || 'N/A'}</p>
                        <p><strong>Fecha de timbrado:</strong> ${formatDate(timbradoResult.timbrado?.Complement?.TaxStamp?.Date || timbradoResult.timbrado?.Date)}</p>
                    </div>
                `,
                confirmButtonText: 'Ver factura',
                confirmButtonColor: '#1c1948',
                showCancelButton: true,
                cancelButtonText: 'Ir al listado'
            }).then((res) => {
                if (res.isConfirmed) {
                    if (typeof window.navigateTo === 'function') {
                        window.navigateTo(`/partner/factura/ver?id=${facturaId}`);
                    } else {
                        window.location.href = `/partner/factura/ver?id=${facturaId}`;
                    }
                }
            });
            
            await loadFacturasTable();
            await loadStats();
        } else {
            throw new Error(timbradoResult.message || 'Error al timbrar');
        }

    } catch (error) {
        mostrarLoading(false);
        console.error('❌ Error timbrando factura:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al timbrar',
            text: error.message || 'Ocurrió un error al timbrar la factura',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la cancelación de una factura timbrada
 */
async function handleCancelarFactura(facturaId) {
    const factura = facturasData.find(f => f.id === facturaId);
    if (!factura) return;

    // Solo se pueden cancelar facturas timbradas
    if (factura.estatus !== 'timbrada') {
        Swal.fire({
            icon: 'info',
            title: 'No se puede cancelar',
            text: 'Solo las facturas timbradas pueden ser canceladas.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    // Confirmar cancelación
    const result = await Swal.fire({
        title: '¿Cancelar factura?',
        html: `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                <p><strong>UUID:</strong> ${factura.timbrado?.uuid || 'N/A'}</p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <p style="color: var(--rsi-danger); margin-top: var(--rsi-spacing-md);">
                    ⚠️ La cancelación es un proceso irreversible.
                </p>
                <p style="color: var(--rsi-danger);">
                    Se enviará una solicitud de cancelación al SAT.
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        mostrarLoading(true);

        // TODO: Llamar al endpoint de cancelación cuando esté disponible
        // Por ahora solo actualizamos el estatus localmente
        await service.updateFactura(facturaId, {
            estatus: 'cancelada'
        });

        mostrarLoading(false);

        Swal.fire({
            icon: 'success',
            title: '✅ Factura cancelada',
            text: `La factura ${factura.facturaNumero} ha sido cancelada exitosamente.`,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#1c1948'
        });

        await loadFacturasTable();
        await loadStats();

    } catch (error) {
        mostrarLoading(false);
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
            text: 'Solo se pueden enviar facturas timbradas.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
        return;
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

    const result = await Swal.fire({
        title: '📤 Enviar Factura',
        html: `
            <div style="text-align: left;">
                <p><strong>Factura:</strong> ${factura.facturaNumero}</p>
                <p><strong>Cliente:</strong> ${factura.clienteRazonSocial || factura.clienteNombre}</p>
                <p><strong>Email:</strong> ${factura.clienteEmail}</p>
                <p><strong>Total:</strong> ${formatCurrency(factura.totalFinal)}</p>
                <p style="color: var(--rsi-success); margin-top: var(--rsi-spacing-md);">
                    📄 Se enviará el PDF de la factura timbrada.
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
                facturaNumero: factura.facturaNumero,
                clienteNombre: factura.clienteRazonSocial || factura.clienteNombre
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
        const name = await service._getUserName ? await service._getUserName(uid) : uid;
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
        'cancelada': { class: 'cancelada', icon: 'fa-times-circle', label: 'Cancelada' }
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
    
    service = null;
    facturasData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    usersCache = {};
    currentFacturaId = null;
}

export default facturasCrudController;