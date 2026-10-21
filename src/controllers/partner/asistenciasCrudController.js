/* ========================================
   ASISTENCIAS CRUD CONTROLLER - RSI ENTERPRISE
   Controlador administrativo con Matriz Quincenal de Días,
   Validación de Justificantes de Inasistencia, Expediente por Colaborador
   y Exportación a Excel
   ======================================== */

import AsistenciaService from '../../services/asistenciaService.js';
import JustificacionService from '../../services/justificacionService.js';
import GeoMapHelper from '../../utils/geoMapHelper.js';
import AuthService from '../../services/authService.js';
import ImageZoom from '../../utils/imageZoom.js';
import { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION } from '../../models/asistenciaModel.js';

let service = null;
let justificacionService = null;
let authService = null;
let eventListeners = [];
let justificacionActual = null;
let estadoActualDatos = {
    asistencias: [],
    matrizColaboradores: [],
    diasPeriodo: [],
    colaboradores: [],
    metricas: {},
    detalleColaborador: null,
    periodoTexto: ''
};

export async function asistenciasCrudController() {
    console.log('📊 Inicializando Asistencias CRUD Controller (Matriz Quincenal)...');

    cleanup();

    service = new AsistenciaService();
    justificacionService = new JustificacionService();
    authService = new AuthService();

    const session = authService.getSession();
    if (!session || !session.uid) {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/login?returnUrl=/partner/crudAsistencias');
        } else {
            window.location.href = '/login?returnUrl=/partner/crudAsistencias';
        }
        return;
    }

    inicializarFiltrosFechas();
    await cargarSelectColaboradores();
    bindEvents();

    await cargarAsistenciasAdmin();

    console.log('✅ Asistencias CRUD Controller listo.');
}

function addListener(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    eventListeners.push({ element, event, handler });
}

function inicializarFiltrosFechas() {
    const selAnio = document.getElementById('filtroAnio');
    const selMes = document.getElementById('filtroMes');
    const selQuincena = document.getElementById('filtroQuincena');

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();

    if (selAnio) {
        selAnio.innerHTML = '';
        for (let a = anioActual; a >= anioActual - 3; a--) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            selAnio.appendChild(opt);
        }
        selAnio.value = anioActual;
    }

    if (selMes) {
        selMes.value = mesActual;
    }

    const quincenaInicial = diaActual <= 15 ? 'primera' : 'segunda';
    if (selQuincena) {
        selQuincena.value = quincenaInicial;
    }

    sincronizarTabsQuincena(quincenaInicial);
}

function sincronizarTabsQuincena(quincenaActiva) {
    const tabs = document.querySelectorAll('#quincenaQuickTabs .rsi-quincena-tab');
    tabs.forEach(tab => {
        if (tab.dataset.quincena === quincenaActiva) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

async function cargarSelectColaboradores() {
    const selColaborador = document.getElementById('filtroColaborador');
    if (!selColaborador) return;

    try {
        const colaboradores = await service.getColaboradoresFiltro();
        selColaborador.innerHTML = '<option value="todos">Todos los colaboradores (Partners)</option>';

        colaboradores.forEach(colab => {
            const opt = document.createElement('option');
            opt.value = colab.uid || colab.id;
            opt.textContent = `${colab.nombreCompleto || colab.emailEmpresarial} (${colab.areaNombre || 'General'})`;
            selColaborador.appendChild(opt);
        });
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar colaboradores para el filtro:', error.message);
    }
}

function bindEvents() {
    const btnFiltrar = document.getElementById('btnAplicarFiltros');
    const btnActualizar = document.getElementById('btnActualizarAdmin');
    const btnExportarExcel = document.getElementById('btnExportarExcelAsistencias');
    const btnVolverTodos = document.getElementById('btnVolverTodosColaboradores');

    addListener(btnFiltrar, 'click', () => cargarAsistenciasAdmin());
    addListener(btnActualizar, 'click', () => cargarAsistenciasAdmin());
    addListener(btnExportarExcel, 'click', () => exportarTablaExcel());

    if (btnVolverTodos) {
        addListener(btnVolverTodos, 'click', () => {
            seleccionarColaboradorEspecifico('todos');
        });
    }

    const tabsQuincena = document.querySelectorAll('#quincenaQuickTabs .rsi-quincena-tab');
    tabsQuincena.forEach(tab => {
        addListener(tab, 'click', () => {
            const q = tab.dataset.quincena || 'primera';
            const selQuincena = document.getElementById('filtroQuincena');
            if (selQuincena) selQuincena.value = q;
            sincronizarTabsQuincena(q);
            cargarAsistenciasAdmin();
        });
    });

    const idsSelects = ['filtroAnio', 'filtroMes', 'filtroQuincena', 'filtroColaborador', 'filtroEstado', 'filtroJustificacion'];
    idsSelects.forEach(id => {
        const sel = document.getElementById(id);
        addListener(sel, 'change', () => {
            if (id === 'filtroQuincena') {
                sincronizarTabsQuincena(sel.value);
            }
            cargarAsistenciasAdmin();
        });
    });

    const modalRev = document.getElementById('modalRevisionJustificacion');
    const btnCerrarModalRev = document.getElementById('btnCerrarModalRevision');
    const btnCancelarRev = document.getElementById('btnCancelarRevision');
    const backdropRev = document.getElementById('modalRevisionBackdrop');
    const btnAprobar = document.getElementById('btnAprobarJustificacion');
    const btnRechazar = document.getElementById('btnRechazarJustificacion');

    if (modalRev) {
        addListener(modalRev, 'click', (e) => {
            if (e.target === modalRev) cerrarModalRevision();
        });
    }

    addListener(btnCerrarModalRev, 'click', cerrarModalRevision);
    addListener(btnCancelarRev, 'click', cerrarModalRevision);
    addListener(backdropRev, 'click', cerrarModalRevision);
    addListener(btnAprobar, 'click', () => handleResolverJustificacion(ESTADOS_JUSTIFICACION.APROBADA));
    addListener(btnRechazar, 'click', () => handleResolverJustificacion(ESTADOS_JUSTIFICACION.RECHAZADA));
}

/**
 * Selecciona un colaborador específico al darle clic a su nombre (o regresa a 'todos')
 */
async function seleccionarColaboradorEspecifico(colaboradorUid) {
    const selColaborador = document.getElementById('filtroColaborador');
    if (selColaborador) {
        const existeOpcion = Array.from(selColaborador.options).some(opt => opt.value === colaboradorUid);
        if (!existeOpcion && colaboradorUid !== 'todos') {
            const opt = document.createElement('option');
            opt.value = colaboradorUid;
            opt.textContent = 'Colaborador seleccionado';
            selColaborador.appendChild(opt);
        }
        selColaborador.value = colaboradorUid;
    }

    await cargarAsistenciasAdmin();

    const panelDetalle = document.getElementById('panelDetalleColaborador');
    if (colaboradorUid !== 'todos' && panelDetalle && panelDetalle.style.display !== 'none') {
        panelDetalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function formatearFechaLegible(fechaStr) {
    if (!fechaStr) return '--';
    try {
        const [y, m, d] = fechaStr.split('-').map(n => parseInt(n, 10));
        const fechaObj = new Date(y, m - 1, d, 12, 0, 0);
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const diaNombre = diasSemana[fechaObj.getDay()] || '';
        return `${diaNombre} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    } catch {
        return fechaStr;
    }
}

/**
 * Carga la matriz quincenal de asistencias según los filtros seleccionados
 */
async function cargarAsistenciasAdmin() {
    const loading = document.getElementById('loadingAdminState');
    const empty = document.getElementById('emptyAdminState');
    const tableWrapper = document.getElementById('tablaAdminWrapper');
    const headRow = document.getElementById('asistenciasMatrixHeadRow');
    const tbody = document.getElementById('asistenciasAdminTableBody');
    const badgeTotal = document.getElementById('badgeTotalRegistros');
    const tituloTabla = document.getElementById('tituloTablaAsistencias');
    const panelDetalle = document.getElementById('panelDetalleColaborador');

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';

    const anio = document.getElementById('filtroAnio')?.value || new Date().getFullYear();
    const mes = document.getElementById('filtroMes')?.value || (new Date().getMonth() + 1);
    const quincena = document.getElementById('filtroQuincena')?.value || 'primera';
    const colaboradorUid = document.getElementById('filtroColaborador')?.value || 'todos';
    const estado = document.getElementById('filtroEstado')?.value || 'todos';
    const estadoJustificacion = document.getElementById('filtroJustificacion')?.value || 'todos';

    sincronizarTabsQuincena(quincena);

    try {
        const respuesta = await service.getAsistenciasAdmin({
            anio,
            mes,
            quincena,
            colaboradorUid,
            estado,
            estadoJustificacion
        });

        if (loading) loading.style.display = 'none';

        const {
            asistencias,
            matrizColaboradores,
            diasPeriodo,
            colaboradores,
            metricas,
            detalleColaborador,
            periodoTexto
        } = respuesta;

        estadoActualDatos = {
            asistencias: asistencias || [],
            matrizColaboradores: matrizColaboradores || [],
            diasPeriodo: diasPeriodo || [],
            colaboradores: colaboradores || [],
            metricas: metricas || {},
            detalleColaborador: detalleColaborador || null,
            periodoTexto: periodoTexto || ''
        };

        actualizarMetricasCards(metricas);

        if (detalleColaborador && colaboradorUid !== 'todos') {
            renderizarPanelDetalleColaborador(detalleColaborador);
            if (tituloTabla) {
                tituloTabla.textContent = `Tabla Quincenal de ${detalleColaborador.colaborador.nombreCompleto} — ${periodoTexto}`;
            }
        } else {
            if (panelDetalle) panelDetalle.style.display = 'none';
            if (tituloTabla) {
                tituloTabla.textContent = `Tabla Quincenal de Asistencias — ${periodoTexto}`;
            }
        }

        if (badgeTotal) {
            badgeTotal.textContent = `${matrizColaboradores.length} colaborador${matrizColaboradores.length === 1 ? '' : 'es'}`;
        }

        if (!matrizColaboradores || matrizColaboradores.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        if (tableWrapper) tableWrapper.style.display = 'block';

        // 1. Renderizar encabezados de columnas: Primera columna Colaborador, siguientes los días de la quincena
        if (headRow) {
            headRow.innerHTML = `<th class="rsi-matrix-sticky-col">Colaborador</th>`;
            diasPeriodo.forEach(diaObj => {
                const th = document.createElement('th');
                th.className = `rsi-matrix-day-th ${diaObj.esFinDeSemana ? 'is-weekend' : ''} ${diaObj.esHoy ? 'is-today' : ''}`;
                th.innerHTML = `
                    <div class="rsi-th-day-name">${diaObj.nombreDiaCorto}</div>
                    <div class="rsi-th-day-num">${diaObj.diaPad}</div>
                `;
                headRow.appendChild(th);
            });
        }

        // 2. Renderizar una fila por cada Colaborador con sus celdas para cada día de la quincena
        if (tbody) {
            tbody.innerHTML = '';
            matrizColaboradores.forEach(filaColab => {
                const tr = construirFilaMatrizColaborador(filaColab, diasPeriodo);
                tbody.appendChild(tr);
            });
        }

    } catch (error) {
        console.error('❌ Error al consultar asistencias administrativas:', error);
        if (loading) loading.style.display = 'none';
        Swal.fire({
            icon: 'error',
            title: 'Error de consulta',
            text: error.message,
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Construye la fila de un colaborador en la tabla matriz quincenal:
 * Primera columna: Colaborador (clicable para ver solo ese colaborador).
 * Siguientes columnas: Cada día de la quincena con horarios de entrada/salida y validación de justificantes.
 */
function construirFilaMatrizColaborador(filaColab, diasPeriodo) {
    const tr = document.createElement('tr');
    const { colaborador, dias, resumen } = filaColab;

    // 1ª Columna: Colaborador (Clic únicamente en el colaborador para abrir su vista específica)
    const tdColab = document.createElement('td');
    tdColab.className = 'rsi-matrix-sticky-col rsi-matrix-colab-td';
    const fotoSrc = colaborador.fotoPerfil || '/assets/images/default-avatar.png';

    tdColab.innerHTML = `
        <div class="rsi-colab-cell">
            <img src="${fotoSrc}" alt="${colaborador.nombreCompleto || 'Avatar'}" class="rsi-colab-avatar" onerror="this.src='/assets/images/default-avatar.png'">
            <div class="rsi-colab-info">
                <button type="button" class="rsi-colab-link btn-seleccionar-colaborador" data-uid="${colaborador.uid}" title="Clic para ver en específico todo lo relacionado a las asistencias de ${colaborador.nombreCompleto}">
                    <span>${colaborador.nombreCompleto || 'Colaborador'}</span>
                </button>
                <small class="rsi-colab-area-tag">${colaborador.areaNombre || 'General'}${colaborador.subareaNombre ? ' · ' + colaborador.subareaNombre : ''}</small>
                <div class="rsi-colab-mini-stats">
                    <span class="mini-stat ok" title="Asistencias Puntuales">P: ${resumen.puntuales}</span>
                    <span class="mini-stat warn" title="Retardos">R: ${resumen.retardos}</span>
                    <span class="mini-stat err" title="Inasistencias">F: ${resumen.inasistencias}</span>
                </div>
            </div>
        </div>
    `;

    const btnColab = tdColab.querySelector('.btn-seleccionar-colaborador');
    if (btnColab) {
        btnColab.addEventListener('click', () => {
            if (colaborador.uid) {
                seleccionarColaboradorEspecifico(colaborador.uid);
            }
        });
    }

    tr.appendChild(tdColab);

    // Siguientes Columnas: Días de la Quincena
    diasPeriodo.forEach(diaObj => {
        const celda = dias[diaObj.fecha];
        const td = document.createElement('td');
        td.className = `rsi-matrix-day-td ${diaObj.esFinDeSemana ? 'is-weekend' : ''} ${diaObj.esHoy ? 'is-today' : ''}`;

        if (!celda || celda.estado === 'futuro') {
            td.innerHTML = `<span class="rsi-cell-futuro">--</span>`;
            tr.appendChild(td);
            return;
        }

        if (celda.estado === 'descanso') {
            td.innerHTML = `<span class="rsi-cell-descanso">Descanso</span>`;
            tr.appendChild(td);
            return;
        }

        // Caso A: El colaborador asistió (Puntual o Retardo) -> Mostrar Horario Entrada y Horario Salida
        if (celda.estado === ESTADOS_ASISTENCIA.PRESENTE || celda.estado === ESTADOS_ASISTENCIA.RETARDO) {
            const esRetardo = celda.estado === ESTADOS_ASISTENCIA.RETARDO;
            const estadoTag = esRetardo
                ? `<span class="rsi-cell-tag tag-retardo" title="Retardo de ${celda.minutosRetardo} minutos">Retardo +${celda.minutosRetardo}m</span>`
                : `<span class="rsi-cell-tag tag-puntual">Puntual</span>`;

            const tieneMapa = Boolean(celda.ubicacionEntrada && celda.ubicacionEntrada.latitud && celda.ubicacionEntrada.longitud);

            td.innerHTML = `
                <div class="rsi-matrix-cell-box ${esRetardo ? 'cell-warn' : 'cell-ok'}">
                    <div class="rsi-cell-times">
                        <span class="rsi-cell-time in" title="Horario de Entrada: ${celda.horaEntrada || '--'}">
                            <i class="fas fa-sign-in-alt"></i> ${celda.horaEntradaCorta || '--:--'}
                        </span>
                        <span class="rsi-cell-time out" title="Horario de Salida: ${celda.horaSalida || 'Sin registro de salida'}">
                            <i class="fas fa-sign-out-alt"></i> ${celda.horaSalidaCorta || '--:--'}
                        </span>
                    </div>
                    <div class="rsi-cell-footer-row">
                        ${estadoTag}
                        ${tieneMapa ? `<button type="button" class="rsi-cell-map-btn" title="Ver ubicación GPS"><i class="fas fa-map-marker-alt"></i></button>` : ''}
                    </div>
                </div>
            `;

            const btnMapa = td.querySelector('.rsi-cell-map-btn');
            if (btnMapa) {
                btnMapa.addEventListener('click', () => {
                    GeoMapHelper.mostrarModalMapa(
                        celda.ubicacionEntrada,
                        `Ubicación: ${colaborador.nombreCompleto}`,
                        `Fecha: ${celda.fecha} · Entrada: ${celda.horaEntrada || 'N/A'}`
                    );
                });
            }

            tr.appendChild(td);
            return;
        }

        // Caso B: Inasistencia (Se justifican solo las inasistencias; desde aquí se ve y se valida o rechaza)
        if (celda.haJustificado && celda.justificacionId) {
            let badgeJustHTML = '';
            let botonesValidacionRapidaHTML = '';

            if (celda.estadoJustificacion === ESTADOS_JUSTIFICACION.PENDIENTE) {
                badgeJustHTML = `
                    <button type="button" class="rsi-cell-just-btn tag-just-pendiente btn-revisar-celda" title="Ver motivo y evidencia para validar o rechazar">
                        <i class="fas fa-hourglass-half"></i> Justif. Pendiente
                    </button>
                `;
                botonesValidacionRapidaHTML = `
                    <div class="rsi-cell-quick-actions">
                        <button type="button" class="rsi-cell-qbtn qbtn-approve" title="Aprobar justificante">
                            <i class="fas fa-check"></i> Aprobar
                        </button>
                        <button type="button" class="rsi-cell-qbtn qbtn-reject" title="Rechazar justificante">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            } else if (celda.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA) {
                const autorizadorTxt = celda.justificacionAutorizadoPor ? `Autorizado por: ${celda.justificacionAutorizadoPor}` : 'Justificante aprobado';
                badgeJustHTML = `
                    <button type="button" class="rsi-cell-just-btn tag-just-aprobada btn-revisar-celda" title="${autorizadorTxt} (Clic para ver detalle)">
                        <i class="fas fa-check-circle"></i> Justificada
                    </button>
                    ${celda.justificacionAutorizadoPor ? `<small class="rsi-cell-sin-just" style="font-size:0.65rem;">Por: ${celda.justificacionAutorizadoPor}</small>` : ''}
                `;
            } else if (celda.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA) {
                const revisorTxt = celda.justificacionAutorizadoPor ? `Rechazado por: ${celda.justificacionAutorizadoPor}` : 'Justificante rechazado';
                badgeJustHTML = `
                    <button type="button" class="rsi-cell-just-btn tag-just-rechazada btn-revisar-celda" title="${revisorTxt} (Clic para ver detalle)">
                        <i class="fas fa-times-circle"></i> Rechazada
                    </button>
                    ${celda.justificacionAutorizadoPor ? `<small class="rsi-cell-sin-just" style="font-size:0.65rem;">Por: ${celda.justificacionAutorizadoPor}</small>` : ''}
                `;
            }

            td.innerHTML = `
                <div class="rsi-matrix-cell-box cell-just">
                    <span class="rsi-cell-tag tag-inasistencia">Inasistencia</span>
                    ${badgeJustHTML}
                    ${botonesValidacionRapidaHTML}
                </div>
            `;

            const btnRev = td.querySelector('.btn-revisar-celda');
            if (btnRev) {
                btnRev.addEventListener('click', () => abrirModalRevision(celda.justificacionId));
            }

            const btnQuickApprove = td.querySelector('.qbtn-approve');
            if (btnQuickApprove) {
                btnQuickApprove.addEventListener('click', () => {
                    resolverJustificacionDirecta(celda.justificacionId, ESTADOS_JUSTIFICACION.APROBADA, colaborador.nombreCompleto, celda.fecha);
                });
            }

            const btnQuickReject = td.querySelector('.qbtn-reject');
            if (btnQuickReject) {
                btnQuickReject.addEventListener('click', () => {
                    resolverJustificacionDirecta(celda.justificacionId, ESTADOS_JUSTIFICACION.RECHAZADA, colaborador.nombreCompleto, celda.fecha);
                });
            }
        } else {
            td.innerHTML = `
                <div class="rsi-matrix-cell-box cell-absent">
                    <span class="rsi-cell-tag tag-inasistencia">Inasistencia</span>
                    <span class="rsi-cell-sin-just">Sin justificar</span>
                </div>
            `;
        }

        tr.appendChild(td);
    });

    return tr;
}

/**
 * Permite aprobar o rechazar directamente un justificante desde la celda de la tabla quincenal
 */
async function resolverJustificacionDirecta(justificacionId, nuevoEstado, colaboradorNombre, fechaInasistencia) {
    const esAprobar = nuevoEstado === ESTADOS_JUSTIFICACION.APROBADA;
    const accionTitulo = esAprobar ? 'Validar / Aprobar Justificante' : 'Rechazar Justificante';

    const { isConfirmed, value: comentario } = await Swal.fire({
        title: accionTitulo,
        html: `
            <p style="font-size:0.9rem; margin-bottom:10px;">
                Colaborador: <strong>${colaboradorNombre}</strong><br>
                Fecha de inasistencia: <strong>${formatearFechaLegible(fechaInasistencia)}</strong>
            </p>
        `,
        input: 'textarea',
        inputPlaceholder: esAprobar
            ? 'Comentario de validación (opcional)...'
            : 'Indica el motivo del rechazo del justificante...',
        showCancelButton: true,
        confirmButtonText: esAprobar ? '<i class="fas fa-check"></i> Sí, Aprobar' : '<i class="fas fa-times"></i> Sí, Rechazar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: esAprobar ? '#28a745' : '#dc3545',
        cancelButtonColor: '#6c757d'
    });

    if (!isConfirmed) return;

    Swal.fire({
        title: 'Procesando resolución...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const resultado = await justificacionService.resolverJustificacion({
            justificacionId,
            estado: nuevoEstado,
            comentario: comentario || ''
        });

        if (resultado.success) {
            Swal.fire({
                icon: 'success',
                title: esAprobar ? 'Justificante Validado' : 'Justificante Rechazado',
                text: resultado.message,
                confirmButtonColor: '#1c1948'
            });
            await cargarAsistenciasAdmin();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo procesar',
                text: resultado.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Renderiza el expediente específico cuando se da clic en el nombre de un colaborador
 */
function renderizarPanelDetalleColaborador(detalle) {
    const panel = document.getElementById('panelDetalleColaborador');
    if (!panel || !detalle) return;

    panel.style.display = 'block';

    const { colaborador, periodoTexto, estadisticas, registrosDetallados, justificaciones } = detalle;

    const imgFoto = document.getElementById('detColabFoto');
    if (imgFoto) {
        imgFoto.src = colaborador.fotoPerfil || '/assets/images/default-avatar.png';
        imgFoto.alt = colaborador.nombreCompleto || 'Colaborador';
        imgFoto.onerror = () => { imgFoto.src = '/assets/images/default-avatar.png'; };
    }

    const elNombre = document.getElementById('detColabNombre');
    if (elNombre) elNombre.textContent = colaborador.nombreCompleto || 'Colaborador';

    const elPeriodo = document.getElementById('detColabPeriodo');
    if (elPeriodo) elPeriodo.textContent = periodoTexto || 'Periodo actual';

    const elArea = document.getElementById('detColabArea');
    if (elArea) {
        const sub = colaborador.subareaNombre ? ` · ${colaborador.subareaNombre}` : '';
        elArea.innerHTML = `<i class="fas fa-sitemap"></i> ${colaborador.areaNombre || 'General'}${sub}`;
    }

    const elEmail = document.getElementById('detColabEmail');
    if (elEmail) {
        const tel = colaborador.telefonoMovil ? ` &nbsp;|&nbsp; <i class="fas fa-phone"></i> ${colaborador.telefonoMovil}` : '';
        elEmail.innerHTML = `<i class="fas fa-envelope"></i> ${colaborador.emailEmpresarial || 'Sin correo'}${tel}`;
    }

    // KPIs específicos del colaborador
    const elPuntuales = document.getElementById('detMetricaPuntuales');
    const elTotalDias = document.getElementById('detMetricaTotalDias');
    const elRetardos = document.getElementById('detMetricaRetardos');
    const elMinRetardo = document.getElementById('detMetricaMinutosRetardo');
    const elInasistencias = document.getElementById('detMetricaInasistencias');
    const elHoras = document.getElementById('detMetricaHoras');
    const elJust = document.getElementById('detMetricaJustificaciones');
    const elJustSub = document.getElementById('detMetricaJustSub');

    if (elPuntuales) elPuntuales.textContent = estadisticas.puntuales || 0;
    if (elTotalDias) elTotalDias.textContent = `De ${estadisticas.totalRegistros || 0} días hábiles`;
    if (elRetardos) elRetardos.textContent = estadisticas.retardos || 0;
    if (elMinRetardo) elMinRetardo.textContent = `${estadisticas.minutosRetardoTotal || 0} min acumulados`;
    if (elInasistencias) elInasistencias.textContent = estadisticas.inasistencias || 0;
    if (elHoras) elHoras.textContent = estadisticas.horasTrabajadasTexto || '0h 00m';
    if (elJust) elJust.textContent = estadisticas.totalJustificaciones || 0;
    if (elJustSub) {
        elJustSub.textContent = `${estadisticas.justificacionesAprobadas || 0} aprob. / ${estadisticas.justificacionesPendientes || 0} pend. / ${estadisticas.justificacionesRechazadas || 0} rech.`;
    }

    // Lista de justificaciones del colaborador
    const boxJust = document.getElementById('detColabJustificacionesBox');
    const listJust = document.getElementById('detColabJustificacionesList');
    if (boxJust && listJust) {
        if (justificaciones && justificaciones.length > 0) {
            boxJust.style.display = 'block';
            listJust.innerHTML = '';

            justificaciones.forEach(j => {
                let badge = '<span class="rsi-badge rsi-badge-warning">Pendiente</span>';
                if (j.estado === ESTADOS_JUSTIFICACION.APROBADA) {
                    badge = '<span class="rsi-badge rsi-badge-success">Aprobada</span>';
                } else if (j.estado === ESTADOS_JUSTIFICACION.RECHAZADA) {
                    badge = '<span class="rsi-badge rsi-badge-danger">Rechazada</span>';
                }

                const card = document.createElement('div');
                card.className = 'rsi-colab-just-item';
                card.innerHTML = `
                    <div class="rsi-colab-just-info">
                        <div>
                            <strong>Inasistencia del ${formatearFechaLegible(j.fechaInasistencia)}</strong>
                            ${badge}
                        </div>
                        <p class="rsi-colab-just-motivo">${j.motivo || 'Sin motivo especificado'}</p>
                        ${j.comentarioRevision ? `<small class="rsi-colab-just-rev">Resolución (${j.revisadoPorNombre || 'Admin'}): ${j.comentarioRevision}</small>` : ''}
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="rsi-btn-table-action btn-ver-just-detalle" data-id="${j.id}">
                            <i class="fas fa-tasks"></i> Revisar / Validar
                        </button>
                    </div>
                `;

                const btnVer = card.querySelector('.btn-ver-just-detalle');
                if (btnVer) {
                    btnVer.addEventListener('click', () => abrirModalRevision(j.id));
                }

                listJust.appendChild(card);
            });
        } else {
            boxJust.style.display = 'none';
            listJust.innerHTML = '';
        }
    }

    // Desglose diario exclusivo del colaborador seleccionado
    const wrapperIndividual = document.getElementById('detalleIndividualTableWrapper');
    const tbodyIndividual = document.getElementById('detalleIndividualTableBody');
    if (wrapperIndividual && tbodyIndividual) {
        if (registrosDetallados && registrosDetallados.length > 0) {
            wrapperIndividual.style.display = 'block';
            tbodyIndividual.innerHTML = '';

            registrosDetallados.forEach(reg => {
                const tr = document.createElement('tr');

                let estadoBadge = '<span class="rsi-badge rsi-badge-success">Puntual</span>';
                if (reg.estado === ESTADOS_ASISTENCIA.RETARDO) {
                    estadoBadge = '<span class="rsi-badge rsi-badge-warning">Retardo</span>';
                } else if (reg.estado === ESTADOS_ASISTENCIA.INASISTENCIA) {
                    estadoBadge = '<span class="rsi-badge rsi-badge-danger">Inasistencia</span>';
                }

                let justHTML = '<span style="color:var(--rsi-text-muted);">No aplica (Asistió)</span>';
                if (reg.estado === ESTADOS_ASISTENCIA.INASISTENCIA) {
                    if (reg.haJustificado && reg.justificacionId) {
                        let bEst = '<span class="rsi-badge rsi-badge-warning">Pendiente</span>';
                        if (reg.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA) bEst = '<span class="rsi-badge rsi-badge-success">Aprobada</span>';
                        else if (reg.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA) bEst = '<span class="rsi-badge rsi-badge-danger">Rechazada</span>';

                        justHTML = `
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                ${bEst}
                                <button type="button" class="rsi-btn-table-action btn-rev-ind" data-id="${reg.justificacionId}">
                                    <i class="fas fa-tasks"></i> Validar / Ver
                                </button>
                            </div>
                        `;
                    } else {
                        justHTML = '<span class="rsi-badge rsi-badge-outline-danger">Sin justificar</span>';
                    }
                }

                let ubiHTML = '<span style="color:var(--rsi-text-muted);">--</span>';
                const tieneEnt = Boolean(reg.ubicacionEntrada && reg.ubicacionEntrada.latitud);
                const tieneSal = Boolean(reg.ubicacionSalida && reg.ubicacionSalida.latitud);
                if (tieneEnt || tieneSal) {
                    ubiHTML = `<div style="display:flex; gap:4px;">`;
                    if (tieneEnt) ubiHTML += `<button type="button" class="rsi-btn-table-action btn-mapa-ent"><i class="fas fa-map-marker-alt"></i> Entrada</button>`;
                    if (tieneSal) ubiHTML += `<button type="button" class="rsi-btn-table-action btn-mapa-sal"><i class="fas fa-map-pin"></i> Salida</button>`;
                    ubiHTML += `</div>`;
                }

                tr.innerHTML = `
                    <td><strong>${formatearFechaLegible(reg.fecha)}</strong></td>
                    <td>${reg.horaEntrada ? `<span class="rsi-time-pill rsi-time-in">${reg.horaEntrada}</span>` : '<span class="rsi-time-empty">--:--</span>'}</td>
                    <td>${reg.horaSalida ? `<span class="rsi-time-pill rsi-time-out">${reg.horaSalida}</span>` : '<span class="rsi-time-empty">--:--</span>'}</td>
                    <td>${reg.horasTrabajadas || '--'}</td>
                    <td>${estadoBadge}</td>
                    <td>${reg.minutosRetardo > 0 ? `+${reg.minutosRetardo} min` : '0 min'}</td>
                    <td>${ubiHTML}</td>
                    <td>${justHTML}</td>
                `;

                const btnRevInd = tr.querySelector('.btn-rev-ind');
                if (btnRevInd) {
                    btnRevInd.addEventListener('click', () => abrirModalRevision(reg.justificacionId));
                }
                const btnMapaEnt = tr.querySelector('.btn-mapa-ent');
                if (btnMapaEnt) {
                    btnMapaEnt.addEventListener('click', () => {
                        GeoMapHelper.mostrarModalMapa(reg.ubicacionEntrada, `Entrada: ${colaborador.nombreCompleto}`, `${reg.fecha} ${reg.horaEntrada || ''}`);
                    });
                }
                const btnMapaSal = tr.querySelector('.btn-mapa-sal');
                if (btnMapaSal) {
                    btnMapaSal.addEventListener('click', () => {
                        GeoMapHelper.mostrarModalMapa(reg.ubicacionSalida, `Salida: ${colaborador.nombreCompleto}`, `${reg.fecha} ${reg.horaSalida || ''}`);
                    });
                }

                tbodyIndividual.appendChild(tr);
            });
        } else {
            wrapperIndividual.style.display = 'none';
            tbodyIndividual.innerHTML = '';
        }
    }

    if (colaborador.fotoPerfil) {
        ImageZoom.attachToContainer(panel.querySelector('.rsi-colab-detail-profile'), '.rsi-colab-detail-avatar');
    }
}

function actualizarMetricasCards(metricas) {
    const totalColabs = document.getElementById('metricaTotalColaboradores');
    const totalAsis = document.getElementById('metricaAsistencias');
    const totalRet = document.getElementById('metricaRetardos');
    const totalInas = document.getElementById('metricaInasistencias');
    const totalJustPend = document.getElementById('metricaJustificacionesPend');

    if (totalColabs) totalColabs.textContent = metricas.totalColaboradoresActivos || 0;
    if (totalAsis) totalAsis.textContent = metricas.totalAsistencias || 0;
    if (totalRet) totalRet.textContent = metricas.totalRetardos || 0;
    if (totalInas) totalInas.textContent = metricas.totalInasistencias || 0;
    if (totalJustPend) totalJustPend.textContent = metricas.justificacionesPendientes || 0;
}

/**
 * Exporta la Tabla Quincenal de Asistencias (con columnas por cada día de la quincena) a Excel (.xls)
 */
function exportarTablaExcel() {
    const { matrizColaboradores, diasPeriodo, metricas, detalleColaborador, periodoTexto } = estadoActualDatos;

    if (!matrizColaboradores || matrizColaboradores.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos para exportar',
            text: 'No hay registros en la tabla actual para generar el archivo de Excel.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const esc = (val) => String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const fechaGeneracion = new Date().toLocaleString('es-MX');
    const totalCols = 6 + diasPeriodo.length;
    const tituloReporte = detalleColaborador
        ? `REPORTE QUINCENAL DE ASISTENCIAS — ${detalleColaborador.colaborador.nombreCompleto.toUpperCase()}`
        : 'REPORTE QUINCENAL DE ASISTENCIAS DE COLABORADORES (PARTNERS)';

    const headersDiasHTML = diasPeriodo.map(d => `
        <th style="background:#1c1948; color:#ffffff; text-align:center; min-width:95px;">
            ${esc(d.nombreDiaCorto)} ${esc(d.diaPad)}
        </th>
    `).join('');

    const filasMatrizHTML = matrizColaboradores.map((fila, idx) => {
        const { colaborador, dias, resumen } = fila;

        const celdasDiasHTML = diasPeriodo.map(d => {
            const c = dias[d.fecha];
            if (!c || c.estado === 'futuro') {
                return `<td style="text-align:center; color:#94a3b8;">--</td>`;
            }
            if (c.estado === 'descanso') {
                return `<td style="text-align:center; background:#f8fafc; color:#64748b;">Descanso</td>`;
            }
            if (c.estado === ESTADOS_ASISTENCIA.PRESENTE || c.estado === ESTADOS_ASISTENCIA.RETARDO) {
                const bg = c.estado === ESTADOS_ASISTENCIA.RETARDO ? '#fff3cd' : '#d1e7dd';
                const tag = c.estado === ESTADOS_ASISTENCIA.RETARDO ? `Retardo (+${c.minutosRetardo}m)` : 'Puntual';
                return `
                    <td style="text-align:center; background:${bg}; font-size:9.5pt; mso-number-format:'\\@';">
                        <b>E:</b> ${esc(c.horaEntradaCorta || '--:--')}<br>
                        <b>S:</b> ${esc(c.horaSalidaCorta || '--:--')}<br>
                        <span>${esc(tag)}</span>
                    </td>
                `;
            }
            // Inasistencia
            if (c.haJustificado) {
                let estJ = 'Justif. Pendiente';
                let bgJ = '#cff4fc';
                if (c.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA) {
                    estJ = 'Justificada (Aprobada)';
                    bgJ = '#d1e7dd';
                } else if (c.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA) {
                    estJ = 'Justif. Rechazada';
                    bgJ = '#f8d7da';
                }
                return `
                    <td style="text-align:center; background:${bgJ}; font-size:9.5pt;">
                        <b>Inasistencia</b><br>
                        <span>${esc(estJ)}</span>
                    </td>
                `;
            }
            return `
                <td style="text-align:center; background:#f8d7da; color:#842029; font-size:9.5pt;">
                    <b>Inasistencia</b><br>
                    <span>Sin justificar</span>
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td style="font-weight:bold;">
                    ${idx + 1}. ${esc(colaborador.nombreCompleto)}<br>
                    <span style="font-size:9pt; color:#475569; font-weight:normal;">${esc(colaborador.areaNombre || 'General')} (${esc(colaborador.emailEmpresarial)})</span>
                </td>
                ${celdasDiasHTML}
                <td style="text-align:center; font-weight:bold; color:#198754;">${resumen.puntuales}</td>
                <td style="text-align:center; font-weight:bold; color:#d97706;">${resumen.retardos} (${resumen.minutosRetardoTotal}m)</td>
                <td style="text-align:center; font-weight:bold; color:#dc3545;">${resumen.inasistencias}</td>
                <td style="text-align:center; font-weight:bold;">${resumen.totalJustificaciones}</td>
                <td style="text-align:center; font-weight:bold;">${esc(resumen.horasTrabajadasTexto)}</td>
            </tr>
        `;
    }).join('');

    const excelTemplate = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <!--[if gte mso 9]>
    <xml>
        <x:ExcelWorkbook>
            <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                    <x:Name>Asistencias Quincena</x:Name>
                    <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                </x:ExcelWorksheet>
            </x:ExcelWorksheets>
        </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
        th { background-color: #1c1948; color: #ffffff; font-weight: bold; text-align: center; }
    </style>
</head>
<body>
    <table>
        <tr>
            <td colspan="${totalCols}" style="background:#1c1948; color:#d4af37; font-size:13pt; font-weight:bold; text-align:center; padding:10px;">
                FÉNIX RSI ENTERPRISE — ${esc(tituloReporte)}
            </td>
        </tr>
        <tr>
            <td colspan="${Math.ceil(totalCols / 2)}" style="background:#f8fafc; font-weight:bold;">Periodo: ${esc(periodoTexto)}</td>
            <td colspan="${Math.floor(totalCols / 2)}" style="background:#f8fafc; font-weight:bold;">Fecha de exportación: ${esc(fechaGeneracion)}</td>
        </tr>
        <tr>
            <td colspan="${totalCols}" style="background:#eef2f7; font-weight:bold;">
                Colaboradores: ${metricas.totalColaboradoresActivos || 0} &nbsp;|&nbsp;
                Puntuales: ${metricas.totalAsistencias || 0} &nbsp;|&nbsp;
                Retardos: ${metricas.totalRetardos || 0} &nbsp;|&nbsp;
                Inasistencias: ${metricas.totalInasistencias || 0} &nbsp;|&nbsp;
                Justificantes Pendientes: ${metricas.justificacionesPendientes || 0}
            </td>
        </tr>
        <tr><td colspan="${totalCols}"></td></tr>
        <thead>
            <tr>
                <th style="min-width:220px;">Colaborador (Partner)</th>
                ${headersDiasHTML}
                <th>Puntuales</th>
                <th>Retardos</th>
                <th>Inasistencias</th>
                <th>Justificadas</th>
                <th>Hrs. Laboradas</th>
            </tr>
        </thead>
        <tbody>
            ${filasMatrizHTML}
        </tbody>
    </table>
</body>
</html>`;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const slugColab = detalleColaborador
        ? detalleColaborador.colaborador.nombreCompleto.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, '_')
        : 'Todos_Colaboradores';
    const slugPeriodo = (periodoTexto || 'Quincena').replace(/[^a-zA-Z0-9]+/g, '_');

    link.href = url;
    link.download = `Asistencias_RSI_${slugColab}_${slugPeriodo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Abre el modal para revisar y validar o rechazar una justificación de inasistencia
 */
async function abrirModalRevision(justificacionId) {
    if (!justificacionId) return;

    const modal = document.getElementById('modalRevisionJustificacion');
    const loadingData = document.getElementById('loadingRevisionData');
    const contentData = document.getElementById('contentRevisionData');

    if (modal) {
        modal.dataset.justificacionId = justificacionId;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    if (loadingData) loadingData.style.display = 'block';
    if (contentData) contentData.style.display = 'none';

    try {
        const detalle = await justificacionService.getDetalleJustificacion(justificacionId);
        if (!detalle) {
            throw new Error('No se encontró la información del justificante seleccionado.');
        }

        justificacionActual = {
            ...detalle,
            id: detalle.id || justificacionId
        };

        if (loadingData) loadingData.style.display = 'none';
        if (contentData) contentData.style.display = 'block';

        document.getElementById('revColaboradorNombre').textContent = justificacionActual.colaboradorNombre || 'Colaborador';
        document.getElementById('revFechaInasistencia').textContent = justificacionActual.fechaInasistencia || '--';
        document.getElementById('revFechaEnvio').textContent = justificacionActual.fechaEnvio
            ? new Date(justificacionActual.fechaEnvio).toLocaleString('es-MX')
            : '--';

        let badgeEstado = '<span class="rsi-badge rsi-badge-warning">Pendiente de Revisión</span>';
        if (justificacionActual.estado === ESTADOS_JUSTIFICACION.APROBADA) {
            badgeEstado = '<span class="rsi-badge rsi-badge-success">Aprobada</span>';
        } else if (justificacionActual.estado === ESTADOS_JUSTIFICACION.RECHAZADA) {
            badgeEstado = '<span class="rsi-badge rsi-badge-danger">Rechazada</span>';
        }
        document.getElementById('revEstadoBadge').innerHTML = badgeEstado;

        const rowAutorizado = document.getElementById('revAutorizadoPorRow');
        const spanAutorizado = document.getElementById('revAutorizadoPor');
        const nombreAutorizador = justificacionActual.autorizadoPor || justificacionActual.revisadoPorNombre || '';
        if (rowAutorizado && spanAutorizado) {
            if (nombreAutorizador) {
                const fechaRevTxt = justificacionActual.fechaRevision
                    ? ` (${new Date(justificacionActual.fechaRevision).toLocaleString('es-MX')})`
                    : '';
                spanAutorizado.textContent = `${nombreAutorizador}${fechaRevTxt}`;
                rowAutorizado.style.display = 'block';
            } else {
                rowAutorizado.style.display = 'none';
            }
        }

        document.getElementById('revMotivo').textContent = justificacionActual.motivo || '';
        document.getElementById('revComentario').value = justificacionActual.comentarioRevision || '';

        const evidenciaContainer = document.getElementById('revEvidenciaContent');
        if (justificacionActual.evidenciaUrl) {
            const esImagen = justificacionActual.evidenciaUrl.match(/\.(jpeg|jpg|png|webp)/i) || !justificacionActual.evidenciaUrl.includes('.pdf');
            if (esImagen) {
                evidenciaContainer.innerHTML = `
                    <img src="${justificacionActual.evidenciaUrl}" alt="Evidencia de Justificación" class="rsi-just-evidencia-img" style="max-width: 100%; max-height: 240px; border-radius: 6px; border: 1px solid var(--rsi-border-color); margin-bottom: 8px; cursor: zoom-in;">
                    <div>
                        <small style="color: var(--rsi-text-muted); display: block; margin-bottom: 4px;"><i class="fas fa-search-plus"></i> Haz clic sobre la imagen para verla en pantalla completa con zoom</small>
                    </div>
                `;
                ImageZoom.attachToContainer(evidenciaContainer, '.rsi-just-evidencia-img');
            } else {
                evidenciaContainer.innerHTML = `
                    <div style="padding: 16px;">
                        <i class="fas fa-file-pdf" style="font-size: 2.5rem; color: var(--rsi-danger); margin-bottom: 8px;"></i>
                        <p style="margin-bottom: 6px; font-weight: 600;">Documento de Evidencia (PDF)</p>
                        <a href="${justificacionActual.evidenciaUrl}" target="_blank" rel="noopener noreferrer" class="rsi-btn-link">
                            <i class="fas fa-external-link-alt"></i> Ver documento PDF en pestaña nueva
                        </a>
                    </div>
                `;
            }
        } else {
            evidenciaContainer.innerHTML = '<span style="color: var(--rsi-text-muted); font-style: italic;">Sin archivo de comprobante adjunto.</span>';
        }

        const historialContainer = document.getElementById('revHistorialContainer');
        const historialList = document.getElementById('revHistorialList');
        if (justificacionActual.historialRevisiones && justificacionActual.historialRevisiones.length > 0) {
            historialContainer.style.display = 'block';
            historialList.innerHTML = justificacionActual.historialRevisiones.map(h => `
                <div style="padding: 4px 0; border-bottom: 1px dashed var(--rsi-border-color);">
                    <strong>${(h.accion || '').toUpperCase()}</strong> por ${h.realizadoPor || 'Usuario'} el ${h.fecha ? new Date(h.fecha).toLocaleString('es-MX') : '--'}:
                    <em>${h.comentario || 'Sin comentarios'}</em>
                </div>
            `).join('');
        } else {
            historialContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('❌ Error al obtener detalle de justificación:', error);
        cerrarModalRevision();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#1c1948'
        });
    }
}

function cerrarModalRevision() {
    const modal = document.getElementById('modalRevisionJustificacion');
    if (modal) {
        modal.style.display = 'none';
        delete modal.dataset.justificacionId;
        document.body.style.overflow = '';
    }
    justificacionActual = null;
}

async function handleResolverJustificacion(nuevoEstado) {
    const modal = document.getElementById('modalRevisionJustificacion');
    const targetJustificacionId = justificacionActual?.id || modal?.dataset?.justificacionId || null;
    const targetColaboradorNombre = justificacionActual?.colaboradorNombre || document.getElementById('revColaboradorNombre')?.textContent || 'el colaborador';

    if (!targetJustificacionId) {
        Swal.fire({
            icon: 'warning',
            title: 'Justificante no seleccionado',
            text: 'No se pudo identificar el justificante a resolver. Por favor vuelve a seleccionarlo de la tabla.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const comentario = document.getElementById('revComentario')?.value || '';
    const accionTexto = nuevoEstado === ESTADOS_JUSTIFICACION.APROBADA ? 'aprobar' : 'rechazar';

    const confirmacion = await Swal.fire({
        title: `¿Confirmar y ${accionTexto}?`,
        text: `¿Estás seguro de que deseas ${accionTexto} la justificación de inasistencia del colaborador ${targetColaboradorNombre}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Sí, ${accionTexto}`,
        cancelButtonText: 'Cancelar',
        confirmButtonColor: nuevoEstado === ESTADOS_JUSTIFICACION.APROBADA ? '#28a745' : '#dc3545',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmacion.isConfirmed) return;

    Swal.fire({
        title: 'Guardando resolución...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const resultado = await justificacionService.resolverJustificacion({
            justificacionId: targetJustificacionId,
            estado: nuevoEstado,
            comentario
        });

        if (resultado.success) {
            cerrarModalRevision();
            await Swal.fire({
                icon: 'success',
                title: 'Resolución Guardada',
                text: resultado.message,
                confirmButtonColor: '#1c1948'
            });
            await cargarAsistenciasAdmin();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo resolver',
                text: resultado.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#1c1948'
        });
    }
}

function cleanup() {
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    eventListeners = [];
    justificacionActual = null;
    document.body.style.overflow = '';
}

export default asistenciasCrudController;
