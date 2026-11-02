/* ========================================
   CUENTAS POR COBRAR CONTROLLER - RSI Enterprise
   Estandarizado conforme a Facturas y Cotizaciones CRUD
   ======================================== */

import ComplementoPagoService from '../../services/complementoPagoService.js';
import FacturaService from '../../services/facturaService.js';

const Swal = window.Swal;

let complementoService = null;
let facturaService = null;

// Estado
let facturasData = [];
let filteredData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let searchTerm = '';
let isSearching = false;
let currentFilterStatus = 'todas';

let selectedFactura = null;
let isProcessing = false;

/**
 * Inicializador principal del controlador
 */
export async function cuentasPorCobrarController() {
    console.log('💼 Cuentas por Cobrar Controller inicializado');

    complementoService = new ComplementoPagoService();
    facturaService = new FacturaService();

    // Reset de variables
    facturasData = [];
    filteredData = [];
    currentPage = 1;
    searchTerm = '';
    isSearching = false;
    currentFilterStatus = 'todas';
    selectedFactura = null;
    isProcessing = false;

    // Inicializar listeners estandarizados
    initRefresh();
    initSearch();
    initClearSearch();
    initStatsFilters();
    initPagination();
    initModalRegistrarPago();
    initModalHistorial();

    // Carga de datos
    await loadCuentasPorCobrarTable();
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
 * Formatea fecha
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Badge de estatus de pago estandarizado
 */
function getPagoBadge(estado, numParcialidades = 0) {
    if (estado === 'pagada') {
        return `<span class="rsi-badge-status timbrada"><i class="fas fa-check-circle"></i> Liquidada</span>`;
    }
    if (estado === 'parcial') {
        return `<span class="rsi-badge-status borrador"><i class="fas fa-adjust"></i> Parcial (${numParcialidades})</span>`;
    }
    return `<span class="rsi-badge-status pendiente"><i class="fas fa-clock"></i> Pendiente</span>`;
}

/**
 * Inicializa botón refrescar
 */
function initRefresh() {
    const refreshBtn = document.getElementById('refreshCxc');
    if (!refreshBtn) return;

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Actualizando...';
        await loadCuentasPorCobrarTable();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
    });
}

/**
 * Inicializa el buscador estándar
 */
function initSearch() {
    const searchInput = document.getElementById('searchCxc');
    const searchBtn = document.getElementById('searchCxcBtn');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!searchInput || !searchBtn) return;

    const performSearch = () => {
        const term = searchInput.value.trim();
        searchTerm = term;
        isSearching = term.length > 0;
        currentPage = 1;

        if (clearBtn) {
            clearBtn.style.display = isSearching ? 'flex' : 'none';
        }

        applyFiltersAndRender();
        updateSearchInfo();
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    searchInput.addEventListener('input', () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
        }
        if (searchInput.value.length === 0 && isSearching) {
            searchTerm = '';
            isSearching = false;
            currentPage = 1;
            applyFiltersAndRender();
            updateSearchInfo();
        }
    });
}

/**
 * Limpia búsqueda
 */
function initClearSearch() {
    const clearBtn = document.getElementById('clearSearchBtn');
    const clearResultsBtn = document.getElementById('clearSearchResults');
    const searchInput = document.getElementById('searchCxc');

    const handleClear = () => {
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        searchTerm = '';
        isSearching = false;
        currentPage = 1;
        applyFiltersAndRender();
        updateSearchInfo();
    };

    if (clearBtn) clearBtn.addEventListener('click', handleClear);
    if (clearResultsBtn) clearResultsBtn.addEventListener('click', handleClear);
}

/**
 * Actualiza la barra informativa de resultados de búsqueda
 */
function updateSearchInfo() {
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const searchResultsText = document.getElementById('searchResultsText');
    if (!searchResultsInfo || !searchResultsText) return;

    if (isSearching) {
        searchResultsInfo.style.display = 'flex';
        searchResultsText.innerHTML = `<i class="fas fa-search"></i> Resultados para "<strong>${searchTerm}</strong>": ${filteredData.length} encontrada(s)`;
    } else {
        searchResultsInfo.style.display = 'none';
    }
}

/**
 * Filtro rápido por tarjetas de estadísticas
 */
function initStatsFilters() {
    const statItems = document.querySelectorAll('#cxcStats .rsi-stat-item[data-filter]');
    statItems.forEach(item => {
        item.addEventListener('click', () => {
            const filter = item.getAttribute('data-filter');
            if (currentFilterStatus === filter && filter !== 'todas') {
                currentFilterStatus = 'todas';
            } else {
                currentFilterStatus = filter;
            }

            statItems.forEach(i => i.classList.remove('active'));
            if (currentFilterStatus !== 'todas') {
                item.classList.add('active');
            }

            currentPage = 1;
            applyFiltersAndRender();
        });
    });
}

/**
 * Paginación estándar
 */
function initPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTablePage();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTablePage();
            }
        });
    }
}

/**
 * Carga principal desde Firestore
 */
async function loadCuentasPorCobrarTable() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const paginationContainer = document.getElementById('paginationContainer');

    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';

    try {
        const res = await complementoService.obtenerCuentasPorCobrar();
        if (res.success) {
            facturasData = res.facturas || [];
            updateStats(facturasData);
            applyFiltersAndRender();
        } else {
            console.error('Error cargando cuentas por cobrar:', res.error);
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                const title = document.getElementById('emptyStateTitle');
                const text = document.getElementById('emptyStateText');
                if (title) title.textContent = 'Error al consultar datos';
                if (text) text.textContent = res.error || 'No se pudieron recuperar las cuentas por cobrar.';
            }
        }
    } catch (err) {
        console.error('Error crítico al cargar cuentas por cobrar:', err);
        if (loadingState) loadingState.style.display = 'none';
    }
}

/**
 * Actualiza las estadísticas superiores
 */
function updateStats(facturas) {
    let totalPpd = facturas.length;
    let pendientes = 0;
    let parciales = 0;
    let liquidadas = 0;
    let totalSaldo = 0;

    facturas.forEach(f => {
        const saldo = parseFloat(f.saldoInsoluto !== undefined ? f.saldoInsoluto : (f.total - (f.totalPagado || 0)));
        const pagado = parseFloat(f.totalPagado || 0);

        if (saldo <= 0.01) {
            liquidadas++;
        } else if (pagado > 0.01) {
            parciales++;
            totalSaldo += saldo;
        } else {
            pendientes++;
            totalSaldo += saldo;
        }
    });

    const countEl = document.getElementById('cxcCount');
    const statTotal = document.getElementById('statTotal');
    const statPend = document.getElementById('statPendientes');
    const statParc = document.getElementById('statParciales');
    const statLiq = document.getElementById('statLiquidadas');
    const statMonto = document.getElementById('statTotalMonto');

    if (countEl) countEl.textContent = totalPpd;
    if (statTotal) statTotal.textContent = totalPpd;
    if (statPend) statPend.textContent = pendientes;
    if (statParc) statParc.textContent = parciales;
    if (statLiq) statLiq.textContent = liquidadas;
    if (statMonto) statMonto.textContent = formatCurrency(totalSaldo);
}

/**
 * Aplica filtros de estado y búsqueda
 */
function applyFiltersAndRender() {
    filteredData = facturasData.filter(f => {
        const saldo = parseFloat(f.saldoInsoluto !== undefined ? f.saldoInsoluto : (f.total - (f.totalPagado || 0)));
        const pagado = parseFloat(f.totalPagado || 0);

        let estado = 'pendiente';
        if (saldo <= 0.01) estado = 'pagada';
        else if (pagado > 0.01) estado = 'parcial';

        // Filtro por estado
        if (currentFilterStatus !== 'todas' && estado !== currentFilterStatus) {
            return false;
        }

        // Filtro por búsqueda
        if (isSearching && searchTerm.length > 0) {
            const termLower = searchTerm.toLowerCase();
            const folio = (f.folio || f.numeroFactura || '').toLowerCase();
            const serie = (f.serie || 'FAC').toLowerCase();
            const cliente = (f.cliente?.razonSocial || f.cliente?.nombre || f.clienteNombre || '').toLowerCase();
            const rfc = (f.cliente?.rfc || f.clienteRfc || '').toLowerCase();
            const uuid = (f.uuid || '').toLowerCase();

            const matches = folio.includes(termLower) ||
                            `${serie}-${folio}`.includes(termLower) ||
                            cliente.includes(termLower) ||
                            rfc.includes(termLower) ||
                            uuid.includes(termLower);
            if (!matches) return false;
        }

        return true;
    });

    totalItems = filteredData.length;
    totalPages = Math.ceil(totalItems / pageSize);
    renderTablePage();
}

/**
 * Renderiza la página actual de la tabla
 */
function renderTablePage() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    const paginationContainer = document.getElementById('paginationContainer');
    const tableBody = document.getElementById('cxcTableBody');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (loadingState) loadingState.style.display = 'none';

    if (filteredData.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            const title = document.getElementById('emptyStateTitle');
            const text = document.getElementById('emptyStateText');
            if (title) {
                title.textContent = isSearching ? 'No se encontraron resultados' : 'No hay cuentas por cobrar';
            }
            if (text) {
                text.textContent = isSearching 
                    ? `No hay facturas que coincidan con "${searchTerm}"`
                    : 'Las facturas emitidas con método de pago PPD aparecerán aquí.';
            }
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'block';
    if (paginationContainer) paginationContainer.style.display = 'flex';

    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
    }

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    const paginated = filteredData.slice(start, end);

    let rowsHtml = '';
    paginated.forEach(fac => {
        const id = fac.id;
        const folio = fac.folio || fac.numeroFactura || '-';
        const serie = fac.serie || 'FAC';
        const clienteNom = fac.cliente?.razonSocial || fac.cliente?.nombre || fac.clienteNombre || 'Sin cliente';
        const clienteRfc = fac.cliente?.rfc || fac.clienteRfc || 'Sin RFC';
        const fecha = formatDate(fac.fechaEmision || fac.facturaFecha || fac.createdAt);

        const total = parseFloat(fac.total || fac.saldoTotal || 0);
        const pagado = parseFloat(fac.totalPagado || 0);
        const saldo = parseFloat(fac.saldoInsoluto !== undefined ? fac.saldoInsoluto : (total - pagado));
        const numParcialidades = fac.numeroParcialidades || (fac.complementosPago ? fac.complementosPago.length : 0);

        let estado = 'pendiente';
        if (saldo <= 0.01) estado = 'pagada';
        else if (pagado > 0.01) estado = 'parcial';

        const saldoColor = saldo <= 0.01 ? 'var(--rsi-success, #16a34a)' : (pagado > 0 ? 'var(--rsi-warning, #d97706)' : 'var(--rsi-danger, #dc2626)');
        const puedePagar = saldo > 0.01 && fac.uuid;

        rowsHtml += `
            <tr>
                <td data-label="Factura">
                    <span style="font-weight: 600; font-size: 0.85rem;">${serie}-${folio}</span>
                    ${fac.uuid ? `<br><small style="font-size: 0.65rem; color: var(--rsi-text-muted); font-family: monospace;">UUID: ${fac.uuid.substring(0, 8)}...</small>` : ''}
                </td>
                <td data-label="Cliente">
                    <span style="font-weight: 500;">${clienteNom}</span>
                    <br>
                    <small style="color: var(--rsi-text-muted); font-size: 0.75rem;">${clienteRfc}</small>
                </td>
                <td data-label="Fecha">
                    <span style="font-size: 0.85rem; color: var(--rsi-text-muted);">${fecha}</span>
                </td>
                <td data-label="Total Factura" style="text-align: right;">
                    <span style="font-weight: 700; color: var(--rsi-text-primary);">${formatCurrency(total)}</span>
                </td>
                <td data-label="Total Pagado" style="text-align: right;">
                    <span style="font-weight: 600; color: var(--rsi-success);">${formatCurrency(pagado)}</span>
                </td>
                <td data-label="Saldo Pendiente" style="text-align: right;">
                    <span style="font-weight: 700; color: ${saldoColor};">${formatCurrency(saldo)}</span>
                </td>
                <td data-label="Parcialidades" style="text-align: center;">
                    <span class="rsi-badge rsi-badge-primary" style="font-size: 0.75rem;">
                        ${numParcialidades}
                    </span>
                </td>
                <td data-label="Estatus" style="text-align: center;">
                    ${getPagoBadge(estado, numParcialidades)}
                </td>
                <td data-label="Acciones" style="text-align: center;">
                    <div class="rsi-table-actions">
                        ${puedePagar ? `
                            <button class="rsi-btn-icon rsi-btn-icon-facturar btn-registrar-pago" data-id="${id}" title="Registrar Pago (REP 2.0)">
                                <i class="fas fa-hand-holding-usd"></i>
                            </button>
                        ` : ''}
                        <button class="rsi-btn-icon rsi-btn-icon-view btn-ver-historial" data-id="${id}" title="Historial de Parcialidades">
                            <i class="fas fa-history"></i>
                        </button>
                        ${fac.pdfUrl ? `
                            <a href="${fac.pdfUrl}" target="_blank" class="rsi-btn-icon rsi-btn-icon-pdf" title="Ver Factura PDF">
                                <i class="fas fa-file-pdf"></i>
                            </a>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    if (tableBody) tableBody.innerHTML = rowsHtml;

    // Vincular eventos de botones de fila
    tableBody.querySelectorAll('.btn-registrar-pago').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const facId = e.currentTarget.getAttribute('data-id');
            abrirModalRegistrarPago(facId);
        });
    });

    tableBody.querySelectorAll('.btn-ver-historial').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const facId = e.currentTarget.getAttribute('data-id');
            abrirModalHistorial(facId);
        });
    });
}

/**
 * =========================================================================
 * MODAL: REGISTRAR COMPLEMENTO DE PAGO
 * =========================================================================
 */
function initModalRegistrarPago() {
    const modal = document.getElementById('modalRegistrarPago');
    const btnClose = document.getElementById('btnCloseModalPago');
    const btnCancel = document.getElementById('btnCancelModalPago');
    const btnConfirmar = document.getElementById('btnConfirmarPago');
    const btnSaldarTotal = document.getElementById('btnSaldarTotalidad');
    const inputMonto = document.getElementById('pagoMonto');

    const cerrarModal = () => {
        if (modal) modal.style.display = 'none';
        selectedFactura = null;
    };

    if (btnClose) btnClose.addEventListener('click', cerrarModal);
    if (btnCancel) btnCancel.addEventListener('click', cerrarModal);

    if (btnSaldarTotal) {
        btnSaldarTotal.addEventListener('click', () => {
            if (!selectedFactura) return;
            const saldoActual = parseFloat(selectedFactura.saldoInsoluto !== undefined ? selectedFactura.saldoInsoluto : (selectedFactura.total - (selectedFactura.totalPagado || 0)));
            if (inputMonto) {
                inputMonto.value = saldoActual.toFixed(2);
                actualizarPreviewSaldoRestante();
            }
        });
    }

    if (inputMonto) {
        inputMonto.addEventListener('input', () => {
            actualizarPreviewSaldoRestante();
        });
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', async () => {
            await procesarRegistroPago();
        });
    }
}

function actualizarPreviewSaldoRestante() {
    const inputMonto = document.getElementById('pagoMonto');
    const preview = document.getElementById('pagoSaldoRestantePreview');
    if (!selectedFactura || !preview) return;

    const saldoAnterior = parseFloat(selectedFactura.saldoInsoluto !== undefined ? selectedFactura.saldoInsoluto : (selectedFactura.total - (selectedFactura.totalPagado || 0)));
    const monto = parseFloat(inputMonto?.value || 0);

    if (isNaN(monto) || monto <= 0) {
        preview.value = formatCurrency(saldoAnterior);
        preview.style.color = 'var(--rsi-text-primary)';
        return;
    }

    const saldoResultante = Math.max(0, saldoAnterior - monto);
    preview.value = formatCurrency(saldoResultante);

    if (monto > saldoAnterior + 0.01) {
        preview.value = `¡Excede por ${formatCurrency(monto - saldoAnterior)}!`;
        preview.style.color = 'var(--rsi-danger, #dc2626)';
    } else if (saldoResultante <= 0.01) {
        preview.value = '$0.00 (Liquidada)';
        preview.style.color = 'var(--rsi-success, #16a34a)';
    } else {
        preview.style.color = 'var(--rsi-warning, #d97706)';
    }
}

function abrirModalRegistrarPago(facturaId) {
    const fac = facturasData.find(f => f.id === facturaId);
    if (!fac) {
        if (Swal) Swal.fire('Error', 'No se encontró la factura seleccionada.', 'error');
        return;
    }

    if (!fac.uuid) {
        if (Swal) Swal.fire('Atención', 'Esta factura aún no ha sido timbrada en el SAT. Solo se pueden emitir complementos de pago para facturas con UUID timbrado.', 'warning');
        return;
    }

    selectedFactura = fac;

    const saldoActual = parseFloat(fac.saldoInsoluto !== undefined ? fac.saldoInsoluto : (fac.total - (fac.totalPagado || 0)));
    const totalFac = parseFloat(fac.total || fac.saldoTotal || 0);
    const pagadoFac = parseFloat(fac.totalPagado || 0);
    const numParcialidad = (fac.numeroParcialidades || 0) + 1;

    const folioEl = document.getElementById('modalFacFolio');
    const clienteEl = document.getElementById('modalFacCliente');
    const uuidEl = document.getElementById('modalFacUuid');
    const badgeParcEl = document.getElementById('modalFacParcialidadBadge');
    const totalEl = document.getElementById('modalFacTotal');
    const pagadoEl = document.getElementById('modalFacPagado');
    const saldoEl = document.getElementById('modalFacSaldoActual');

    if (folioEl) folioEl.textContent = `${fac.serie || 'FAC'}-${fac.folio || fac.numeroFactura || '000'}`;
    if (clienteEl) clienteEl.textContent = fac.cliente?.razonSocial || fac.cliente?.nombre || fac.clienteNombre || 'Cliente';
    if (uuidEl) uuidEl.textContent = fac.uuid;
    if (badgeParcEl) badgeParcEl.textContent = `Parcialidad #${numParcialidad}`;
    if (totalEl) totalEl.textContent = formatCurrency(totalFac);
    if (pagadoEl) pagadoEl.textContent = formatCurrency(pagadoFac);
    if (saldoEl) saldoEl.textContent = formatCurrency(saldoActual);

    const inputMonto = document.getElementById('pagoMonto');
    const inputFecha = document.getElementById('pagoFecha');
    const selectFormaPago = document.getElementById('pagoFormaPago');
    const inputNumOp = document.getElementById('pagoNumOperacion');
    const inputObs = document.getElementById('pagoObservaciones');
    const chkTimbrar = document.getElementById('chkAutoTimbrar');

    if (inputMonto) inputMonto.value = '';
    if (inputNumOp) inputNumOp.value = '';
    if (inputObs) inputObs.value = '';
    if (selectFormaPago) selectFormaPago.value = '03';
    if (chkTimbrar) chkTimbrar.checked = true;

    if (inputFecha) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        inputFecha.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    actualizarPreviewSaldoRestante();

    const modal = document.getElementById('modalRegistrarPago');
    if (modal) modal.style.display = 'flex';
}

async function procesarRegistroPago() {
    if (isProcessing || !selectedFactura) return;

    const inputMonto = document.getElementById('pagoMonto');
    const inputFecha = document.getElementById('pagoFecha');
    const selectFormaPago = document.getElementById('pagoFormaPago');
    const inputNumOp = document.getElementById('pagoNumOperacion');
    const inputObs = document.getElementById('pagoObservaciones');
    const chkTimbrar = document.getElementById('chkAutoTimbrar');

    const monto = parseFloat(inputMonto?.value || 0);
    const fechaPago = inputFecha?.value;
    const formaPago = selectFormaPago?.value || '03';
    const numOperacion = inputNumOp?.value?.trim() || '';
    const observaciones = inputObs?.value?.trim() || '';
    const timbrarInmediato = chkTimbrar ? chkTimbrar.checked : true;

    const saldoAnterior = parseFloat(selectedFactura.saldoInsoluto !== undefined ? selectedFactura.saldoInsoluto : (selectedFactura.total - (selectedFactura.totalPagado || 0)));

    if (!monto || isNaN(monto) || monto <= 0) {
        if (Swal) Swal.fire('Monto inválido', 'Ingresa un monto mayor a cero.', 'warning');
        return;
    }

    if (monto > saldoAnterior + 0.01) {
        if (Swal) Swal.fire('Monto excedido', `El abono ($${monto.toFixed(2)}) supera el saldo pendiente ($${saldoAnterior.toFixed(2)}).`, 'error');
        return;
    }

    if (!fechaPago) {
        if (Swal) Swal.fire('Fecha requerida', 'Selecciona la fecha y hora de recepción del pago.', 'warning');
        return;
    }

    const confirmResult = await Swal.fire({
        title: '¿Confirmar emisión de complemento?',
        html: `
            <div style="text-align: left; font-size: 0.9rem; line-height: 1.6;">
                <p><strong>Factura:</strong> ${selectedFactura.serie || 'FAC'}-${selectedFactura.folio || ''}</p>
                <p><strong>Monto:</strong> <span style="color: var(--rsi-success); font-weight: bold;">${formatCurrency(monto)}</span></p>
                <p><strong>Saldo Restante:</strong> <span style="color: var(--rsi-danger); font-weight: bold;">${formatCurrency(Math.max(0, saldoAnterior - monto))}</span></p>
                <p><strong>SAT:</strong> ${timbrarInmediato ? 'Se certificará oficialmente ante el SAT (Facturama).' : 'Se guardará como borrador local.'}</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--rsi-primary, #1c1948)',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, emitir complemento',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    isProcessing = true;

    Swal.fire({
        title: 'Emitiendo Complemento...',
        html: 'Generando póliza REP 2.0 ante Facturama SAT.<br>Por favor espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const payload = {
            facturaId: selectedFactura.id,
            monto,
            fechaPago: new Date(fechaPago).toISOString(),
            formaPago,
            numOperacion,
            observaciones,
            timbrarInmediato
        };

        const res = await complementoService.registrarComplementoPago(payload);

        if (res.success) {
            const modal = document.getElementById('modalRegistrarPago');
            if (modal) modal.style.display = 'none';

            const complementoId = res.id;
            const uuidSat = res.uuid || 'Emitido correctamente';

            await Swal.fire({
                title: '¡Complemento Emitido con Éxito!',
                html: `
                    <p style="margin-bottom: 8px;">El recibo electrónico de pago ha sido procesado.</p>
                    <p style="font-size: 0.85rem; color: #475569; word-break: break-all;">
                        <strong>Folio Fiscal UUID:</strong><br><code>${uuidSat}</code>
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 15px;">
                        <button id="swalBtnDescargarPdf" class="swal2-confirm swal2-styled" style="background-color: #dc2626;">
                            <i class="fas fa-file-pdf"></i> Descargar PDF
                        </button>
                        <button id="swalBtnDescargarXml" class="swal2-confirm swal2-styled" style="background-color: #2563eb;">
                            <i class="fas fa-file-code"></i> Descargar XML
                        </button>
                    </div>
                `,
                icon: 'success',
                showConfirmButton: true,
                confirmButtonText: 'Aceptar',
                didOpen: () => {
                    const btnPdf = document.getElementById('swalBtnDescargarPdf');
                    const btnXml = document.getElementById('swalBtnDescargarXml');

                    if (btnPdf) {
                        btnPdf.addEventListener('click', async () => {
                            btnPdf.disabled = true;
                            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
                            await complementoService.descargarPDF(complementoId);
                            btnPdf.disabled = false;
                            btnPdf.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar PDF';
                        });
                    }

                    if (btnXml) {
                        btnXml.addEventListener('click', async () => {
                            btnXml.disabled = true;
                            btnXml.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo...';
                            await complementoService.descargarXML(complementoId);
                            btnXml.disabled = false;
                            btnXml.innerHTML = '<i class="fas fa-file-code"></i> Descargar XML';
                        });
                    }
                }
            });

            await loadCuentasPorCobrarTable();
        } else {
            Swal.fire({
                title: 'Error al emitir complemento',
                text: res.error || 'Ocurrió un error al procesar el complemento de pago.',
                icon: 'error'
            });
        }
    } catch (err) {
        console.error('Error registrando complemento:', err);
        Swal.fire({
            title: 'Error en la solicitud',
            text: err.message,
            icon: 'error'
        });
    } finally {
        isProcessing = false;
    }
}

/**
 * =========================================================================
 * MODAL: HISTORIAL DE PARCIALIDADES
 * =========================================================================
 */
function initModalHistorial() {
    const modal = document.getElementById('modalHistorialPagos');
    const btnClose = document.getElementById('btnCloseModalHistorial');
    const btnCloseFooter = document.getElementById('btnCloseHistorialFooter');
    const btnAgregar = document.getElementById('btnAgregarPagoDesdeHistorial');

    const cerrarModal = () => {
        if (modal) modal.style.display = 'none';
        selectedFactura = null;
    };

    if (btnClose) btnClose.addEventListener('click', cerrarModal);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', cerrarModal);

    if (btnAgregar) {
        btnAgregar.addEventListener('click', () => {
            if (!selectedFactura) return;
            const facId = selectedFactura.id;
            cerrarModal();
            abrirModalRegistrarPago(facId);
        });
    }
}

async function abrirModalHistorial(facturaId) {
    const fac = facturasData.find(f => f.id === facturaId);
    if (!fac) {
        if (Swal) Swal.fire('Error', 'No se encontró la factura.', 'error');
        return;
    }

    selectedFactura = fac;

    const modal = document.getElementById('modalHistorialPagos');
    const headerContainer = document.getElementById('historialFacturaHeader');
    const listContainer = document.getElementById('historialListContainer');
    const progressBar = document.getElementById('historialProgressBar');
    const progressText = document.getElementById('historialPorcentajeTexto');
    const btnAgregar = document.getElementById('btnAgregarPagoDesdeHistorial');

    const total = parseFloat(fac.total || fac.saldoTotal || 0);
    const pagado = parseFloat(fac.totalPagado || 0);
    const saldo = parseFloat(fac.saldoInsoluto !== undefined ? fac.saldoInsoluto : (total - pagado));
    const porcentaje = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;

    if (btnAgregar) {
        btnAgregar.style.display = saldo > 0.01 && fac.uuid ? 'inline-flex' : 'none';
    }

    if (headerContainer) {
        headerContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div>
                    <strong style="font-size: 0.95rem; color: var(--rsi-text-primary);">${fac.serie || 'FAC'}-${fac.folio || fac.numeroFactura || '000'}</strong>
                    <span style="margin-left: 8px; font-size: 0.88rem; color: var(--rsi-text-secondary);">${fac.cliente?.razonSocial || fac.cliente?.nombre || fac.clienteNombre || 'Cliente'}</span>
                </div>
                ${getPagoBadge(saldo <= 0.01 ? 'pagada' : (pagado > 0 ? 'parcial' : 'pendiente'), fac.numeroParcialidades || 0)}
            </div>
            <div style="font-size: 0.75rem; color: var(--rsi-text-muted); margin-bottom: 8px; font-family: monospace;">
                <span>UUID:</span> <span>${fac.uuid || 'Sin timbrar'}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.82rem; border-top: 1px dashed var(--rsi-border-color, #cbd5e1); padding-top: 8px;">
                <div><span style="color: var(--rsi-text-muted);">Total:</span> <strong>${formatCurrency(total)}</strong></div>
                <div><span style="color: var(--rsi-text-muted);">Pagado:</span> <strong style="color: var(--rsi-success);">${formatCurrency(pagado)}</strong></div>
                <div><span style="color: var(--rsi-text-muted);">Saldo Insoluto:</span> <strong style="color: ${saldo <= 0.01 ? 'var(--rsi-success)' : 'var(--rsi-danger)'};">${formatCurrency(saldo)}</strong></div>
            </div>
        `;
    }

    if (progressBar) progressBar.style.width = `${porcentaje}%`;
    if (progressText) progressText.textContent = `${porcentaje}% Cobrado (${formatCurrency(pagado)} de ${formatCurrency(total)})`;

    if (listContainer) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 25px; color: var(--rsi-text-muted);">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 8px;">Consultando complementos...</p>
            </div>
        `;
    }

    if (modal) modal.style.display = 'flex';

    try {
        const res = await complementoService.obtenerHistorialComplementos(facturaId);
        if (res.success) {
            renderListaComplementos(res.complementos || []);
        } else {
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 15px; color: var(--rsi-danger);">
                        <i class="fas fa-exclamation-circle fa-2x"></i>
                        <p style="margin-top: 6px;">${res.error || 'No se pudieron recuperar los complementos.'}</p>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error('Error cargando historial de complementos:', err);
    }
}

function renderListaComplementos(complementos) {
    const listContainer = document.getElementById('historialListContainer');
    if (!listContainer) return;

    if (!complementos.length) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 25px; color: var(--rsi-text-muted); background: var(--rsi-bg-secondary); border-radius: 8px; border: 1px dashed var(--rsi-border-color);">
                <i class="fas fa-receipt fa-2x" style="opacity: 0.4;"></i>
                <p style="margin: 8px 0 0; font-weight: 500;">No hay complementos de pago emitidos aún para esta factura.</p>
            </div>
        `;
        return;
    }

    const items = complementos.map(item => {
        const numParc = item.numeroParcialidad || 1;
        const fecha = formatDate(item.fechaPago);
        const monto = parseFloat(item.monto || 0);
        const saldoAnt = parseFloat(item.saldoAnterior || 0);
        const saldoIns = parseFloat(item.saldoInsoluto || 0);
        const timbrado = item.timbrado === true && item.uuid;
        const folioComp = item.folio ? `REP-${item.folio}` : (item.id.slice(0, 8));

        return `
            <div style="background: var(--rsi-bg-card, #ffffff); border: 1px solid var(--rsi-border-color, #e2e8f0); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="rsi-badge rsi-badge-primary" style="font-size: 0.75rem; font-weight: 700;">
                            Parcialidad #${numParc}
                        </span>
                        <strong style="font-size: 0.88rem; color: var(--rsi-text-primary);">${folioComp}</strong>
                        <span style="font-size: 0.75rem; color: var(--rsi-text-muted);">${fecha}</span>
                    </div>
                    <div>
                        ${timbrado ? `
                            <span class="rsi-badge-status timbrada" style="font-size: 0.72rem;">
                                <i class="fas fa-check-circle"></i> Timbrado SAT
                            </span>
                        ` : `
                            <span class="rsi-badge-status borrador" style="font-size: 0.72rem;">
                                Borrador
                            </span>
                        `}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: var(--rsi-bg-secondary, #f8fafc); padding: 8px 10px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 6px;">
                    <div><span style="color: var(--rsi-text-muted);">Saldo Anterior:</span> <strong style="display: block;">${formatCurrency(saldoAnt)}</strong></div>
                    <div><span style="color: var(--rsi-success);">Abonado:</span> <strong style="display: block; color: var(--rsi-success);">${formatCurrency(monto)}</strong></div>
                    <div><span style="color: var(--rsi-danger);">Saldo Insoluto:</span> <strong style="display: block; color: ${saldoIns <= 0.01 ? 'var(--rsi-success)' : 'var(--rsi-danger)'};">${formatCurrency(saldoIns)}</strong></div>
                    <div><span style="color: var(--rsi-text-muted);">Forma:</span> <strong style="display: block;">${item.formaPago || '03'}</strong></div>
                </div>

                ${item.uuid ? `
                    <div style="font-size: 0.7rem; color: var(--rsi-text-muted); font-family: monospace; word-break: break-all; margin-bottom: 6px;">
                        UUID: ${item.uuid}
                    </div>
                ` : ''}

                <div style="display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid var(--rsi-border-color, #f1f5f9); padding-top: 6px;">
                    <button type="button" class="rsi-btn-icon rsi-btn-icon-view btn-ver-pdf-comp" data-id="${item.id}" title="Ver PDF">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="rsi-btn-icon rsi-btn-icon-pdf btn-descargar-pdf-comp" data-id="${item.id}" title="Descargar PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    ${timbrado ? `
                        <button type="button" class="rsi-btn-icon rsi-btn-icon-xml btn-descargar-xml-comp" data-id="${item.id}" title="Descargar XML">
                            <i class="fas fa-file-code"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    listContainer.innerHTML = items;

    listContainer.querySelectorAll('.btn-ver-pdf-comp').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const compId = e.currentTarget.getAttribute('data-id');
            await complementoService.abrirPDF(compId);
        });
    });

    listContainer.querySelectorAll('.btn-descargar-pdf-comp').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const compId = e.currentTarget.getAttribute('data-id');
            await complementoService.descargarPDF(compId);
        });
    });

    listContainer.querySelectorAll('.btn-descargar-xml-comp').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const compId = e.currentTarget.getAttribute('data-id');
            await complementoService.descargarXML(compId);
        });
    });
}
