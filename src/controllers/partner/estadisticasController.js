/* ==========================================================================
   ESTADÍSTICAS CONTROLLER - RSI Enterprise
   Controlador para métricas de tickets, KPIs globales, top solucionadores,
   gráficas con Chart.js y expediente de rendimiento individual por colaborador.
   ========================================================================== */

import { TicketEstadisticasService } from '../../services/ticketEstadisticasService.js';

let estadisticasService = null;
let eventListeners = [];
let charts = {};
let Chart = null;
let currentData = null;
let currentFilters = {
    anio: new Date().getFullYear().toString(),
    mes: 'todos',
    tipo: 'todos'
};

/**
 * Registra listeners con control de desuscripción
 */
function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

/**
 * Punto de entrada principal del controlador
 */
export async function estadisticasController() {
    console.log('📊 Inicializando Estadísticas Controller...');

    destroyEstadisticasController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    estadisticasService = new TicketEstadisticasService();

    // Import dinámico de Chart.js
    try {
        const chartModule = await import('chart.js/auto');
        Chart = chartModule.default || chartModule;
    } catch (error) {
        console.warn('⚠️ Chart.js no disponible:', error.message);
    }

    // Inicializar selector de años
    await initFiltrosAnio();

    // Enlazar eventos de la vista
    bindEvents();

    // Cargar datos con los filtros iniciales
    await loadEstadisticas(false);

    // Limpiar al cambiar de ruta
    const onRouteChanging = (e) => {
        if (e.detail && e.detail.path !== '/partner/estadisticas' && e.detail.path !== '/support/estadisticas') {
            destroyEstadisticasController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('✅ Estadísticas Controller listo');
}

/**
 * Inicializa las opciones del selector de año
 */
async function initFiltrosAnio() {
    const selectAnio = document.getElementById('filtroAnio');
    if (!selectAnio) return;

    try {
        const anios = await estadisticasService.getAniosDisponibles();
        const currentYear = new Date().getFullYear();

        selectAnio.innerHTML = '';
        anios.forEach(anio => {
            const opt = document.createElement('option');
            opt.value = anio.toString();
            opt.textContent = `Año ${anio}`;
            if (anio === currentYear) {
                opt.selected = true;
            }
            selectAnio.appendChild(opt);
        });

        currentFilters.anio = selectAnio.value || currentYear.toString();
    } catch (err) {
        console.error('Error inicializando selector de año:', err);
    }
}

/**
 * Enlaza eventos de la interfaz
 */
function bindEvents() {
    // Botón Actualizar
    const btnRecargar = document.getElementById('btnRecargarEstadisticas');
    if (btnRecargar) {
        addManagedListener(btnRecargar, 'click', async () => {
            btnRecargar.disabled = true;
            btnRecargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            await loadEstadisticas(true);
            btnRecargar.disabled = false;
            btnRecargar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
        });
    }

    // Botón Aplicar Filtros
    const btnAplicar = document.getElementById('btnAplicarFiltros');
    if (btnAplicar) {
        addManagedListener(btnAplicar, 'click', async () => {
            readFilterValues();
            await loadEstadisticas(false);
        });
    }

    // Botón Limpiar Filtros
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');
    if (btnLimpiar) {
        addManagedListener(btnLimpiar, 'click', async () => {
            const selectAnio = document.getElementById('filtroAnio');
            const selectMes = document.getElementById('filtroMes');
            const selectTipo = document.getElementById('filtroTipo');

            const currentYear = new Date().getFullYear().toString();
            if (selectAnio) selectAnio.value = currentYear;
            if (selectMes) selectMes.value = 'todos';
            if (selectTipo) selectTipo.value = 'todos';

            currentFilters = {
                anio: currentYear,
                mes: 'todos',
                tipo: 'todos'
            };

            await loadEstadisticas(false);
        });
    }

    // Cambios automáticos en selects (opcional o UX reactiva)
    ['filtroAnio', 'filtroMes', 'filtroTipo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            addManagedListener(el, 'change', () => {
                readFilterValues();
            });
        }
    });

    // Búsqueda en la tabla de colaboradores
    const inputBuscar = document.getElementById('inputBuscarColaboradorTabla');
    if (inputBuscar) {
        addManagedListener(inputBuscar, 'input', (e) => {
            const term = (e.target.value || '').trim().toLowerCase();
            filtrarTablaColaboradores(term);
        });
    }

    // Eventos para cerrar modal de expediente
    const modal = document.getElementById('modalExpedienteColaborador');
    const btnCerrarHeader = document.getElementById('btnCerrarModalExpediente');
    const btnCerrarFooter = document.getElementById('btnCerrarModalExpedienteFooter');

    const cerrarModal = () => {
        if (modal) modal.style.display = 'none';
    };

    if (btnCerrarHeader) addManagedListener(btnCerrarHeader, 'click', cerrarModal);
    if (btnCerrarFooter) addManagedListener(btnCerrarFooter, 'click', cerrarModal);

    if (modal) {
        addManagedListener(modal, 'click', (e) => {
            if (e.target === modal) cerrarModal();
        });
    }

    // Tecla Escape para cerrar modal
    addManagedListener(document, 'keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
            cerrarModal();
        }
    });
}

/**
 * Lee los valores actuales de los filtros
 */
function readFilterValues() {
    const selectAnio = document.getElementById('filtroAnio');
    const selectMes = document.getElementById('filtroMes');
    const selectTipo = document.getElementById('filtroTipo');

    currentFilters = {
        anio: selectAnio ? selectAnio.value : new Date().getFullYear().toString(),
        mes: selectMes ? selectMes.value : 'todos',
        tipo: selectTipo ? selectTipo.value : 'todos'
    };
}

/**
 * Carga y procesa las estadísticas principales
 */
async function loadEstadisticas(forceRefresh = false) {
    const loadingEl = document.getElementById('statsLoadingState');
    const contentEl = document.getElementById('statsMainContent');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';

    try {
        readFilterValues();

        const result = await estadisticasService.getEstadisticasRendimiento(currentFilters, forceRefresh);

        if (!result || !result.success) {
            throw new Error(result?.error || 'No se pudieron calcular las estadísticas.');
        }

        currentData = result;

        // Renderizar secciones
        renderPeriodoBadges(result);
        renderKpisGlobales(result.kpisGlobales);
        renderTopSolucionadores(result.topSolucionadores);
        renderGraficas(result.graficos);
        renderTablaColaboradores(result.colaboradoresMetricas);

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x" style="color: var(--rsi-danger, #ef4444);"></i>
                <p style="margin-top: 10px; color: var(--rsi-text-primary);">Error al procesar las estadísticas: ${escapeHtml(error.message)}</p>
                <button type="button" class="rsi-btn-crud rsi-btn-crud-primary" style="margin-top: 15px;" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            `;
        }
    }
}

/**
 * Actualiza etiquetas del periodo
 */
function renderPeriodoBadges(data) {
    const textoPeriodo = document.getElementById('textoPeriodoActivo');
    const textoTotal = document.getElementById('textoTotalTicketsPeriodo');

    const mesesMap = {
        '1': 'Enero', '2': 'Febrero', '3': 'Marzo', '4': 'Abril',
        '5': 'Mayo', '6': 'Junio', '7': 'Julio', '8': 'Agosto',
        '9': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };

    let periodoTxt = `Año ${data.periodo.anio}`;
    if (data.periodo.mes && data.periodo.mes !== 'todos') {
        periodoTxt += ` - ${mesesMap[data.periodo.mes] || `Mes ${data.periodo.mes}`}`;
    }
    if (data.periodo.tipo && data.periodo.tipo !== 'todos') {
        periodoTxt += ` (${data.periodo.tipo === 'operativo' ? 'Operativos' : 'Administrativos'})`;
    }

    if (textoPeriodo) textoPeriodo.textContent = periodoTxt;
    if (textoTotal) textoTotal.textContent = `${data.totalTicketsFiltrados} tickets encontrados`;
}

/**
 * Renderiza las 6 tarjetas de KPIs globales
 */
function renderKpisGlobales(kpis) {
    if (!kpis) return;

    const elTotal = document.getElementById('kpiTotalTickets');
    const elResueltos = document.getElementById('kpiResueltos');
    const elResueltosSub = document.getElementById('kpiResueltosSub');
    const elTasa = document.getElementById('kpiTasaResolucion');
    const elTasaProgress = document.getElementById('kpiTasaProgressBar');
    const elActivos = document.getElementById('kpiActivos');
    const elActivosDetalle = document.getElementById('kpiActivosDetalle');
    const elTiempo = document.getElementById('kpiTiempoPromedio');
    const elEvidencias = document.getElementById('kpiConEvidencias');
    const elEvidenciasPorc = document.getElementById('kpiConEvidenciasPorc');

    if (elTotal) elTotal.textContent = kpis.total || 0;
    if (elResueltos) elResueltos.textContent = kpis.finalizados || 0;
    if (elResueltosSub) elResueltosSub.textContent = `${kpis.finalizados || 0} finalizados con éxito`;
    
    if (elTasa) elTasa.textContent = `${kpis.tasaResolucion || 0}%`;
    if (elTasaProgress) elTasaProgress.style.width = `${Math.min(100, Math.max(0, kpis.tasaResolucion || 0))}%`;

    const activos = (kpis.enProceso || 0) + (kpis.pendientes || 0);
    if (elActivos) elActivos.textContent = activos;
    if (elActivosDetalle) elActivosDetalle.textContent = `${kpis.enProceso || 0} en proceso / ${kpis.pendientes || 0} pendientes`;

    if (elTiempo) elTiempo.textContent = kpis.tiempoPromedioTexto || '0 hrs';

    if (elEvidencias) elEvidencias.textContent = kpis.conReportePdf || 0;
    if (elEvidenciasPorc) elEvidenciasPorc.textContent = `${kpis.porcentajeConReporte || 0}% de resueltos`;
}

/**
 * Renderiza el Podio con el Top 3 Solucionadores
 */
function renderTopSolucionadores(top3) {
    const container = document.getElementById('podiumContainer');
    if (!container) return;

    if (!top3 || top3.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--rsi-card-bg); border-radius: var(--rsi-radius); border: 1px dashed var(--rsi-border-color);">
                <i class="fas fa-medal fa-3x" style="color: var(--rsi-text-muted); opacity: 0.5; margin-bottom: 12px;"></i>
                <p style="color: var(--rsi-text-secondary); margin: 0;">No se registraron solucionadores con tickets en este periodo.</p>
            </div>
        `;
        return;
    }

    // Reordenar visualmente para podio estilo olímpico: 2do (Plata) izquierda, 1ro (Oro) centro, 3ro (Bronce) derecha
    // Si hay menos de 3, ordenamos según vengan
    let itemsEnOrden = [...top3];
    if (top3.length === 3) {
        itemsEnOrden = [top3[1], top3[0], top3[2]]; // Plata, Oro, Bronce
    }

    const htmlCards = itemsEnOrden.map(item => {
        const colab = item.colaborador || {};
        const medallaClass = item.medalla; // 'oro', 'plata', 'bronce'
        const posNumero = item.posicion;

        const medallaIcon = posNumero === 1 
            ? '<i class="fas fa-crown"></i> 1º LUGAR' 
            : (posNumero === 2 ? '<i class="fas fa-medal"></i> 2º LUGAR' : '<i class="fas fa-award"></i> 3º LUGAR');

        // Avatar
        const avatarHtml = buildAvatarHtml(colab.fotoPerfil, colab.nombreCompleto);

        return `
            <div class="rsi-podium-card ${medallaClass}" data-colab-uid="${escapeHtml(colab.uid || colab.id)}">
                <div class="rsi-podium-rank-badge ${medallaClass}">
                    ${medallaIcon}
                </div>
                
                <div class="rsi-podium-avatar-wrapper">
                    ${avatarHtml}
                </div>

                <h3 class="rsi-podium-name" title="${escapeHtml(colab.nombreCompleto)}">
                    ${escapeHtml(colab.nombreCompleto)}
                </h3>
                <span class="rsi-podium-role">
                    ${escapeHtml(colab.puesto || 'Especialista')} &bull; ${escapeHtml(colab.area || 'Operaciones')}
                </span>

                <div class="rsi-podium-metrics-grid">
                    <div class="rsi-podium-metric">
                        <span class="rsi-podium-metric-val resueltos">${item.finalizados}</span>
                        <span class="rsi-podium-metric-lbl">Resueltos</span>
                    </div>
                    <div class="rsi-podium-metric">
                        <span class="rsi-podium-metric-val">${item.tasaResolucion}%</span>
                        <span class="rsi-podium-metric-lbl">Efectividad</span>
                    </div>
                    <div class="rsi-podium-metric">
                        <span class="rsi-podium-metric-val">${item.totalAsignados}</span>
                        <span class="rsi-podium-metric-lbl">Total Asignados</span>
                    </div>
                    <div class="rsi-podium-metric">
                        <span class="rsi-podium-metric-val">${escapeHtml(item.tiempoPromedioTexto)}</span>
                        <span class="rsi-podium-metric-lbl">Tiempo Prom.</span>
                    </div>
                </div>

                <div class="rsi-podium-action">
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-primary btn-ver-expediente" data-uid="${escapeHtml(colab.uid || colab.id)}" style="width: 100%; justify-content: center;">
                        <i class="fas fa-id-card-alt"></i> Ver Rendimiento
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = htmlCards;

    // Enlazar botones del podio
    container.querySelectorAll('.btn-ver-expediente').forEach(btn => {
        addManagedListener(btn, 'click', (e) => {
            e.stopPropagation();
            const uid = btn.getAttribute('data-uid');
            if (uid) abrirExpedienteColaborador(uid);
        });
    });

    container.querySelectorAll('.rsi-podium-card').forEach(card => {
        addManagedListener(card, 'click', () => {
            const uid = card.getAttribute('data-colab-uid');
            if (uid) abrirExpedienteColaborador(uid);
        });
    });
}

/**
 * Renderiza gráficas de Chart.js
 */
function renderGraficas(graficos) {
    if (!Chart || !graficos) return;

    // Destruir instancias previas
    if (charts.tendencia && typeof charts.tendencia.destroy === 'function') {
        charts.tendencia.destroy();
    }
    if (charts.estados && typeof charts.estados.destroy === 'function') {
        charts.estados.destroy();
    }

    // 1. Gráfico de Tendencia Mensual (Bar / Grouped)
    const ctxTendencia = document.getElementById('chartMensualTendencia');
    if (ctxTendencia && graficos.tendenciaMensual) {
        charts.tendencia = new Chart(ctxTendencia, {
            type: 'bar',
            data: {
                labels: graficos.tendenciaMensual.labels,
                datasets: [
                    {
                        label: 'Tickets Creados',
                        data: graficos.tendenciaMensual.creados,
                        backgroundColor: 'rgba(197, 160, 89, 0.75)', // Oro RSI
                        borderColor: '#c5a059',
                        borderWidth: 1.5,
                        borderRadius: 4
                    },
                    {
                        label: 'Tickets Resueltos',
                        data: graficos.tendenciaMensual.finalizados,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)', // Verde éxito
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'inherit', size: 12 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: '#94a3b8'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    }

    // 2. Gráfico de Distribución por Estados (Doughnut)
    const ctxEstados = document.getElementById('chartEstadosDonut');
    if (ctxEstados && graficos.distribucionEstados) {
        charts.estados = new Chart(ctxEstados, {
            type: 'doughnut',
            data: {
                labels: graficos.distribucionEstados.labels,
                datasets: [
                    {
                        data: graficos.distribucionEstados.data,
                        backgroundColor: graficos.distribucionEstados.colors,
                        borderWidth: 2,
                        borderColor: 'var(--rsi-card-bg, #1a2332)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 14,
                            padding: 12,
                            font: { family: 'inherit', size: 11 }
                        }
                    }
                },
                cutout: '68%'
            }
        });
    }
}

/**
 * Renderiza la tabla completa de colaboradores y su status
 */
function renderTablaColaboradores(colaboradores) {
    const tbody = document.getElementById('tablaColaboradoresBody');
    const countEl = document.getElementById('tablaColaboradoresCount');
    if (!tbody) return;

    if (!colaboradores || colaboradores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 35px; color: var(--rsi-text-secondary);">
                    <i class="fas fa-users-slash fa-2x" style="opacity: 0.4; margin-bottom: 8px;"></i>
                    <p style="margin: 0;">No se encontraron colaboradores registrados para este periodo.</p>
                </td>
            </tr>
        `;
        if (countEl) countEl.textContent = 'Mostrando 0 colaboradores';
        return;
    }

    const htmlRows = colaboradores.map(item => {
        const c = item.colaborador || {};
        const avatarHtml = buildAvatarHtml(c.fotoPerfil, c.nombreCompleto, 'small');
        const efectividad = item.tasaResolucion;
        
        // Color badge de efectividad
        let badgeColor = 'var(--rsi-text-secondary)';
        if (efectividad >= 80) badgeColor = 'var(--rsi-success, #10b981)';
        else if (efectividad >= 50) badgeColor = 'var(--rsi-warning, #f59e0b)';
        else if (item.totalAsignados > 0) badgeColor = 'var(--rsi-danger, #ef4444)';

        return `
            <tr class="rsi-table-row-clickable" data-uid="${escapeHtml(c.uid || c.id)}" data-search="${escapeHtml((c.nombreCompleto + ' ' + (c.puesto || '') + ' ' + (c.area || '')).toLowerCase())}">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${avatarHtml}
                        <div>
                            <strong style="color: var(--rsi-text-primary); font-size: 0.9rem;">${escapeHtml(c.nombreCompleto)}</strong>
                            ${item.comoResponsable > 0 ? `<br><small style="color: var(--rsi-text-muted); font-size: 0.75rem;">${item.comoResponsable} como responsable principal</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-weight: 500; color: var(--rsi-text-primary); font-size: 0.85rem;">${escapeHtml(c.area || '-')}</span>
                    <br><small style="color: var(--rsi-text-secondary); font-size: 0.78rem;">${escapeHtml(c.puesto || '-')}</small>
                </td>
                <td style="text-align: center; font-weight: 600;">${item.totalAsignados}</td>
                <td style="text-align: center; font-weight: 700; color: var(--rsi-success, #10b981);">${item.finalizados}</td>
                <td style="text-align: center; font-weight: 600; color: var(--rsi-warning, #f59e0b);">${item.enProceso}</td>
                <td style="text-align: center; font-weight: 600; color: var(--rsi-info, #3b82f6);">${item.pendientes}</td>
                <td style="text-align: center;">
                    <span style="font-weight: 700; color: ${badgeColor};">${efectividad}%</span>
                </td>
                <td style="text-align: center; font-size: 0.85rem; color: var(--rsi-text-secondary);">
                    ${escapeHtml(item.tiempoPromedioTexto)}
                </td>
                <td style="text-align: center;">
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-secondary btn-ver-expediente-row" data-uid="${escapeHtml(c.uid || c.id)}" title="Ver expediente individual">
                        <i class="fas fa-chart-line"></i> Ver Rendimiento
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = htmlRows;
    if (countEl) countEl.textContent = `Mostrando ${colaboradores.length} colaboradores`;

    // Enlazar filas y botones
    tbody.querySelectorAll('.btn-ver-expediente-row').forEach(btn => {
        addManagedListener(btn, 'click', (e) => {
            e.stopPropagation();
            const uid = btn.getAttribute('data-uid');
            if (uid) abrirExpedienteColaborador(uid);
        });
    });

    tbody.querySelectorAll('.rsi-table-row-clickable').forEach(row => {
        addManagedListener(row, 'click', () => {
            const uid = row.getAttribute('data-uid');
            if (uid) abrirExpedienteColaborador(uid);
        });
    });
}

/**
 * Filtro interactivo de texto en la tabla
 */
function filtrarTablaColaboradores(term) {
    const tbody = document.getElementById('tablaColaboradoresBody');
    const countEl = document.getElementById('tablaColaboradoresCount');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-search]');
    let visibles = 0;

    rows.forEach(row => {
        const searchVal = row.getAttribute('data-search') || '';
        if (!term || searchVal.includes(term)) {
            row.style.display = '';
            visibles++;
        } else {
            row.style.display = 'none';
        }
    });

    if (countEl) countEl.textContent = `Mostrando ${visibles} colaboradores`;
}

/**
 * Abre el expediente detallado del colaborador en modal
 */
export async function abrirExpedienteColaborador(colaboradorId) {
    const modal = document.getElementById('modalExpedienteColaborador');
    if (!modal) return;

    modal.style.display = 'flex';

    // Estado inicial de carga en el modal
    const elNombre = document.getElementById('modalColabNombre');
    const elPuesto = document.getElementById('modalColabPuestoArea');
    const elAvatar = document.getElementById('modalColabAvatar');
    const elPeriodo = document.getElementById('modalColabPeriodoTexto');
    const elTbody = document.getElementById('modalColabTicketsBody');

    if (elNombre) elNombre.textContent = 'Cargando expediente...';
    if (elPuesto) elPuesto.textContent = 'Consultando métricas en tiempo real';
    if (elAvatar) elAvatar.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x" style="color: var(--rsi-text-muted);"></i>';
    if (elPeriodo) elPeriodo.textContent = `${currentFilters.anio} (Cargando...)`;
    if (elTbody) {
        elTbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 25px;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando tickets del colaborador...
                </td>
            </tr>
        `;
    }

    try {
        const exp = await estadisticasService.getExpedienteColaborador(colaboradorId, currentFilters);

        if (!exp || !exp.success) {
            throw new Error(exp?.error || 'No se pudo obtener el expediente.');
        }

        const c = exp.colaborador || {};

        // 1. Cabecera del modal
        if (elNombre) elNombre.textContent = c.nombreCompleto || 'Colaborador';
        if (elPuesto) elPuesto.textContent = `${c.puesto || 'Especialista'} • ${c.area || 'Operaciones'}`;
        if (elAvatar) elAvatar.innerHTML = buildAvatarHtml(c.fotoPerfil, c.nombreCompleto, 'large');
        
        const mesesMap = {
            '1': 'Enero', '2': 'Febrero', '3': 'Marzo', '4': 'Abril',
            '5': 'Mayo', '6': 'Junio', '7': 'Julio', '8': 'Agosto',
            '9': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
        };
        let pTxt = `Año ${exp.periodo.anio}`;
        if (exp.periodo.mes && exp.periodo.mes !== 'todos') {
            pTxt += ` - ${mesesMap[exp.periodo.mes] || exp.periodo.mes}`;
        }
        if (elPeriodo) elPeriodo.textContent = pTxt;

        // 2. KPIs del colaborador
        const m = exp.metricas || {};
        const kpiAsignados = document.getElementById('modalKpiAsignados');
        const kpiRespSub = document.getElementById('modalKpiResponsableSub');
        const kpiResueltos = document.getElementById('modalKpiResueltos');
        const kpiTasaSub = document.getElementById('modalKpiTasaSub');
        const kpiEnCurso = document.getElementById('modalKpiEnCurso');
        const kpiPendSub = document.getElementById('modalKpiPendientesSub');
        const kpiTiempo = document.getElementById('modalKpiTiempoPromedio');
        const kpiGps = document.getElementById('modalKpiGps');
        const kpiReporte = document.getElementById('modalKpiReportePdf');

        if (kpiAsignados) kpiAsignados.textContent = m.totalAsignados || 0;
        if (kpiRespSub) kpiRespSub.textContent = `${m.comoResponsable || 0} como responsable principal`;

        if (kpiResueltos) kpiResueltos.textContent = m.finalizados || 0;
        if (kpiTasaSub) kpiTasaSub.textContent = `${m.tasaResolucion || 0}% efectividad`;

        if (kpiEnCurso) kpiEnCurso.textContent = m.enProceso || 0;
        if (kpiPendSub) kpiPendSub.textContent = `${m.pendientes || 0} pendientes de atención`;

        if (kpiTiempo) kpiTiempo.textContent = m.tiempoPromedioTexto || 'N/A';
        if (kpiGps) kpiGps.textContent = m.conGps || 0;
        if (kpiReporte) kpiReporte.textContent = m.conReportePdf || 0;

        // 3. Tabla de tickets asignados
        const tickets = exp.tickets || [];
        if (!tickets || tickets.length === 0) {
            if (elTbody) {
                elTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 25px; color: var(--rsi-text-secondary);">
                            <i class="fas fa-folder-open fa-2x" style="opacity: 0.4; margin-bottom: 8px;"></i>
                            <p style="margin: 0;">No hay tickets asignados a este colaborador en el periodo analizado.</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }

        const estadoBadges = {
            'finalizado': '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check"></i> Finalizado</span>',
            'en_proceso': '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-spinner fa-spin"></i> En Proceso</span>',
            'pendiente': '<span class="rsi-badge rsi-badge-info"><i class="fas fa-clock"></i> Pendiente</span>',
            'cancelado': '<span class="rsi-badge rsi-badge-danger"><i class="fas fa-ban"></i> Cancelado</span>'
        };

        const prioridadBadges = {
            'alta': '<span class="rsi-badge rsi-badge-danger">Alta</span>',
            'media': '<span class="rsi-badge rsi-badge-warning">Media</span>',
            'baja': '<span class="rsi-badge rsi-badge-secondary">Baja</span>'
        };

        const rowsHtml = tickets.map(t => {
            const folio = t.idTicket || t.numeroTicket || t.folio || t.ticketId || 'N/A';
            const titulo = t.titulo || t.descripcionBreve || 'Sin asunto';
            const tipoLabel = t.tipo === 'administracion' ? 'Administrativo' : 'Operativo';
            const estadoBadge = estadoBadges[t.estado] || `<span class="rsi-badge">${escapeHtml(t.estado || '-')}</span>`;
            const prioridadBadge = prioridadBadges[t.prioridad] || `<span class="rsi-badge">${escapeHtml(t.prioridad || '-')}</span>`;
            const tiempoResolucion = t.horasResolucionTexto || '-';

            return `
                <tr>
                    <td><strong>${escapeHtml(folio)}</strong></td>
                    <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(titulo)}">
                        ${escapeHtml(titulo)}
                    </td>
                    <td>${escapeHtml(tipoLabel)}</td>
                    <td>${prioridadBadge}</td>
                    <td>${estadoBadge}</td>
                    <td><small>${escapeHtml(tiempoResolucion)}</small></td>
                    <td style="text-align: center;">
                        <a href="/partner/ticketView?id=${encodeURIComponent(t.id)}" class="rsi-btn-crud rsi-btn-crud-sm rsi-btn-crud-outline" title="Ver detalle del ticket">
                            <i class="fas fa-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        if (elTbody) elTbody.innerHTML = rowsHtml;

    } catch (err) {
        console.error('Error al abrir expediente:', err);
        if (elNombre) elNombre.textContent = 'Error al cargar';
        if (elPuesto) elPuesto.textContent = err.message || 'Ocurrió un error inesperado';
        if (elTbody) {
            elTbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--rsi-danger); padding: 20px;">
                        ${escapeHtml(err.message || 'No fue posible cargar el detalle de tickets')}
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Genera el markup HTML para avatar (Base64, URL externa o iniciales con color)
 */
function buildAvatarHtml(fotoPerfil, nombreCompleto, size = 'medium') {
    const sizeClasses = {
        small: 'width: 34px; height: 34px; font-size: 0.8rem;',
        medium: 'width: 64px; height: 64px; font-size: 1.2rem;',
        large: 'width: 52px; height: 52px; font-size: 1.1rem;'
    };

    const style = sizeClasses[size] || sizeClasses.medium;

    if (fotoPerfil && (fotoPerfil.startsWith('data:image/') || fotoPerfil.startsWith('http://') || fotoPerfil.startsWith('https://'))) {
        return `
            <img src="${fotoPerfil}" alt="${escapeHtml(nombreCompleto || 'Colaborador')}" 
                 style="${style} border-radius: 50%; object-fit: cover; border: 2px solid var(--rsi-border-color);" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="rsi-avatar-initials-fallback" style="display: none; ${style} border-radius: 50%; background: linear-gradient(135deg, #c5a059, #b38b40); color: #fff; align-items: center; justify-content: center; font-weight: 700;">
                ${getInitials(nombreCompleto)}
            </div>
        `;
    }

    return `
        <div style="${style} border-radius: 50%; background: linear-gradient(135deg, #c5a059, #b38b40); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid var(--rsi-border-color);">
            ${getInitials(nombreCompleto)}
        </div>
    `;
}

/**
 * Obtiene iniciales de un nombre
 */
function getInitials(nombre) {
    if (!nombre) return 'RS';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Escapa strings para evitar inyección en HTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Destruye listeners y charts al salir de la vista
 */
export function destroyEstadisticasController() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        if (element) {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                // Silenciar
            }
        }
    });
    eventListeners = [];

    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};

    const modal = document.getElementById('modalExpedienteColaborador');
    if (modal) modal.style.display = 'none';
}

export default estadisticasController;
