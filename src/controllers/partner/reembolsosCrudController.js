/* ========================================
   REEMBOLSOS CRUD CONTROLLER - RSI ENTERPRISE
   Controlador del Panel de Reembolsos a Colaboradores (/hr/reembolsos)
   Permite:
   - Consultar reembolsos de todos los colaboradores por mes o quincena
   - Hacer reembolsos directos a otros colaboradores (con evidencia fotográfica)
   - Aplicar devoluciones Totales o Parciales (abonos acumulativos)
   - Ver expediente específico por colaborador haciendo clic en su nombre
   - Exportar tabla a Excel
   ======================================== */

import ReembolsoService from '../../services/reembolsoService.js';
import AuthService from '../../services/authService.js';
import ImageZoom from '../../utils/imageZoom.js';
import {
    ReembolsoModel,
    ESTADOS_REEMBOLSO,
    TIPOS_DEVOLUCION,
    CATEGORIAS_REEMBOLSO
} from '../../models/reembolsoModel.js';

let service = null;
let authService = null;
let eventListeners = [];
let quincenaActiva = 'todas';
let reembolsoSeleccionadoModal = null;
let archivoEvidenciaColabModal = null;
let previewColabUrl = null;

let estadoDatosAdmin = {
    reembolsos: [],
    colaboradores: [],
    metricas: {},
    detalleColaborador: null,
    periodo: {}
};

export async function reembolsosCrudController() {
    console.log('🏦 Inicializando Panel de Reembolsos a Colaboradores...');

    cleanup();

    service = new ReembolsoService();
    authService = new AuthService();

    const session = authService.getSession();
    if (!session || !session.uid) {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/login?returnUrl=/hr/reembolsos');
        } else {
            window.location.href = '/login?returnUrl=/hr/reembolsos';
        }
        return;
    }

    inicializarFiltrosPeriodo();
    await poblarSelectoresColaboradores();
    bindEvents();
    await cargarReembolsosPanel();

    console.log('✅ Panel de Reembolsos a Colaboradores listo.');
}

function addListener(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    eventListeners.push({ element, event, handler });
}

function formatearMoneda(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escaparHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function inicializarFiltrosPeriodo() {
    const selAnio = document.getElementById('filtroRmbAdminAnio');
    const selMes = document.getElementById('filtroRmbAdminMes');
    const fechaHoy = ReembolsoModel.getCurrentDateString();
    const [anioActual, mesActual] = fechaHoy.split('-').map(Number);

    if (selAnio) {
        selAnio.innerHTML = '';
        for (let a = anioActual; a >= anioActual - 3; a--) {
            const opt = document.createElement('option');
            opt.value = String(a);
            opt.textContent = String(a);
            selAnio.appendChild(opt);
        }
        selAnio.value = String(anioActual);
    }

    if (selMes) {
        selMes.value = String(mesActual);
    }

    quincenaActiva = 'todas';
    sincronizarTabsQuincena('todas');
}

function sincronizarTabsQuincena(q) {
    const tabs = document.querySelectorAll('#rmbQuincenaQuickTabs .rsi-quincena-tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.quincena === q);
    });
}

async function poblarSelectoresColaboradores() {
    const selFiltro = document.getElementById('filtroRmbAdminColaborador');
    const selModal = document.getElementById('rmbColabSelect');

    try {
        const colaboradores = await service.getColaboradoresActivos();
        estadoDatosAdmin.colaboradores = colaboradores;

        if (selFiltro) {
            selFiltro.innerHTML = '<option value="todos">Todos los colaboradores</option>';
            colaboradores.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.uid;
                opt.textContent = `${c.nombreCompleto} (${c.areaNombre || 'General'})`;
                selFiltro.appendChild(opt);
            });
        }

        if (selModal) {
            selModal.innerHTML = '<option value="">Selecciona un colaborador...</option>';
            colaboradores.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.uid;
                opt.textContent = `${c.nombreCompleto} — ${c.areaNombre || 'General'}`;
                selModal.appendChild(opt);
            });
        }
    } catch (err) {
        console.warn('⚠️ No se pudieron cargar colaboradores:', err.message);
    }
}

function bindEvents() {
    // Tabs de quincena
    const tabs = document.querySelectorAll('#rmbQuincenaQuickTabs .rsi-quincena-tab');
    tabs.forEach(tab => {
        addListener(tab, 'click', () => {
            quincenaActiva = tab.dataset.quincena || 'todas';
            sincronizarTabsQuincena(quincenaActiva);
            cargarReembolsosPanel();
        });
    });

    // Filtros
    addListener(document.getElementById('btnFiltrarReembolsosAdmin'), 'click', () => cargarReembolsosPanel());
    addListener(document.getElementById('filtroRmbAdminAnio'), 'change', () => cargarReembolsosPanel());
    addListener(document.getElementById('filtroRmbAdminMes'), 'change', () => cargarReembolsosPanel());
    addListener(document.getElementById('filtroRmbAdminColaborador'), 'change', () => cargarReembolsosPanel());
    addListener(document.getElementById('filtroRmbAdminEstado'), 'change', () => cargarReembolsosPanel());
    addListener(document.getElementById('filtroRmbAdminModalidad'), 'change', () => cargarReembolsosPanel());

    // Acciones del header
    addListener(document.getElementById('btnActualizarReembolsosAdmin'), 'click', () => cargarReembolsosPanel(true));
    addListener(document.getElementById('btnExportarExcelReembolsos'), 'click', exportarReembolsosExcel);

    // Expediente de colaborador
    addListener(document.getElementById('btnCerrarExpedienteColabRmb'), 'click', () => {
        const selColab = document.getElementById('filtroRmbAdminColaborador');
        if (selColab) selColab.value = 'todos';
        cargarReembolsosPanel();
    });

    addListener(document.getElementById('btnHacerReembolsoDirectoColab'), 'click', () => {
        const uidColab = document.getElementById('filtroRmbAdminColaborador')?.value;
        abrirModalReembolsoColaborador(uidColab && uidColab !== 'todos' ? uidColab : '');
    });

    // Modal 1: Hacer Reembolso a Colaborador
    addListener(document.getElementById('btnAbrirModalReembolsoColaborador'), 'click', () => abrirModalReembolsoColaborador());
    addListener(document.getElementById('btnEmptyCrearRmbColab'), 'click', () => abrirModalReembolsoColaborador());
    addListener(document.getElementById('btnCerrarModalRmbColab'), 'click', cerrarModalReembolsoColaborador);
    addListener(document.getElementById('btnCancelarModalRmbColab'), 'click', cerrarModalReembolsoColaborador);

    const modalColab = document.getElementById('modalReembolsoColaborador');
    if (modalColab) {
        addListener(modalColab, 'click', (e) => {
            if (e.target === modalColab) cerrarModalReembolsoColaborador();
        });
    }

    // Cámara y archivo en Modal 1
    const btnCamColab = document.getElementById('btnCamaraRmbColab');
    const btnGalColab = document.getElementById('btnGaleriaRmbColab');
    const inpCamColab = document.getElementById('inputCamaraRmbColab');
    const inpArcColab = document.getElementById('inputArchivoRmbColab');

    addListener(btnCamColab, 'click', () => inpCamColab?.click());
    addListener(btnGalColab, 'click', () => inpArcColab?.click());

    addListener(inpCamColab, 'change', (e) => {
        if (e.target.files && e.target.files[0]) {
            seleccionarArchivoModalColab(e.target.files[0]);
        }
    });
    addListener(inpArcColab, 'change', (e) => {
        if (e.target.files && e.target.files[0]) {
            seleccionarArchivoModalColab(e.target.files[0]);
        }
    });
    addListener(document.getElementById('btnQuitarRmbColabEvidencia'), 'click', limpiarArchivoModalColab);

    // Radios de acción inicial (Total, Parcial, Pendiente) en Modal 1
    const radiosAccionInicial = document.querySelectorAll('input[name="accionDevolucionInicial"]');
    radiosAccionInicial.forEach(radio => {
        addListener(radio, 'change', actualizarUIModalDevolucionInicial);
    });
    addListener(document.getElementById('rmbColabMonto'), 'input', actualizarCalculoSaldoInicialModal1);
    addListener(document.getElementById('rmbColabMontoInicial'), 'input', actualizarCalculoSaldoInicialModal1);

    addListener(document.getElementById('formReembolsoColaborador'), 'submit', handleSubmitReembolsoColaborador);

    // Modal 2: Devolver Reembolso (Total o Parcial)
    const modalDevolver = document.getElementById('modalDevolverReembolso');
    addListener(document.getElementById('btnCerrarModalDevolverRmb'), 'click', cerrarModalDevolverReembolso);
    addListener(document.getElementById('btnCerrarFooterDevolverRmb'), 'click', cerrarModalDevolverReembolso);
    if (modalDevolver) {
        addListener(modalDevolver, 'click', (e) => {
            if (e.target === modalDevolver) cerrarModalDevolverReembolso();
        });
    }

    const radiosTipoDevModal = document.querySelectorAll('input[name="tipoDevolucionModal"]');
    radiosTipoDevModal.forEach(radio => {
        addListener(radio, 'change', actualizarModoDevolucionModal2);
    });

    addListener(document.getElementById('devModalInputMonto'), 'input', actualizarCalculoRestanteModal2);

    document.querySelectorAll('.rsi-chip-percent').forEach(chip => {
        addListener(chip, 'click', () => {
            if (!reembolsoSeleccionadoModal) return;
            const pct = Number(chip.dataset.percent) || 0.5;
            const saldo = ReembolsoModel.roundCurrency(reembolsoSeleccionadoModal.saldoPendiente || 0);
            const sugerido = ReembolsoModel.roundCurrency(saldo * pct);
            const inputMonto = document.getElementById('devModalInputMonto');
            if (inputMonto && !inputMonto.readOnly) {
                inputMonto.value = sugerido.toFixed(2);
                actualizarCalculoRestanteModal2();
            }
        });
    });

    addListener(document.getElementById('formAplicarDevolucion'), 'submit', handleSubmitAplicarDevolucion);
    addListener(document.getElementById('btnRechazarReembolsoModal'), 'click', handleRechazarReembolsoDesdeModal);
}

async function cargarReembolsosPanel(forceRefresh = false) {
    const loadingEl = document.getElementById('loadingReembolsosAdmin');
    const emptyEl = document.getElementById('emptyReembolsosAdmin');
    const wrapperEl = document.getElementById('tablaReembolsosAdminWrapper');
    const tbodyEl = document.getElementById('reembolsosAdminTableBody');
    const badgeTotal = document.getElementById('badgeTotalReembolsosAdmin');

    const anio = document.getElementById('filtroRmbAdminAnio')?.value;
    const mes = document.getElementById('filtroRmbAdminMes')?.value;
    const colaboradorUid = document.getElementById('filtroRmbAdminColaborador')?.value || 'todos';
    const estado = document.getElementById('filtroRmbAdminEstado')?.value || 'todos';
    const tipoDevolucion = document.getElementById('filtroRmbAdminModalidad')?.value || 'todos';

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (wrapperEl) wrapperEl.style.display = 'none';

    try {
        const res = await service.getReembolsosAdmin({
            anio,
            mes,
            quincena: quincenaActiva,
            colaboradorUid,
            estado,
            tipoDevolucion,
            forceRefresh
        });

        estadoDatosAdmin = res;

        renderizarMetricasAdmin(res.metricas || {});
        renderizarExpedienteColaborador(res.detalleColaborador);

        if (badgeTotal) {
            const count = (res.reembolsos || []).length;
            badgeTotal.textContent = `${count} registro${count === 1 ? '' : 's'}`;
        }

        if (loadingEl) loadingEl.style.display = 'none';

        if (!res.reembolsos || res.reembolsos.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (wrapperEl) wrapperEl.style.display = 'block';
        renderizarTablaReembolsosAdmin(tbodyEl, res.reembolsos);
    } catch (error) {
        console.error('❌ Error cargando panel de reembolsos:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    }
}

function renderizarMetricasAdmin(m) {
    const elSol = document.getElementById('admMetricaSolicitado');
    const elDev = document.getElementById('admMetricaDevuelto');
    const elSal = document.getElementById('admMetricaSaldoPendiente');
    const elPP = document.getElementById('admMetricaPendientesParciales');
    const elLiq = document.getElementById('admMetricaLiquidados');

    if (elSol) elSol.textContent = formatearMoneda(m.montoTotalSolicitado || 0);
    if (elDev) elDev.textContent = formatearMoneda(m.montoTotalDevuelto || 0);
    if (elSal) elSal.textContent = formatearMoneda(m.saldoTotalPendiente || 0);
    if (elPP) elPP.textContent = `${m.pendientes || 0} / ${m.parciales || 0}`;
    if (elLiq) elLiq.textContent = String(m.liquidados || 0);
}

function renderizarExpedienteColaborador(detalle) {
    const panel = document.getElementById('panelDetalleColaboradorRmb');
    if (!panel) return;

    if (!detalle) {
        panel.style.display = 'none';
        return;
    }

    const fotoEl = document.getElementById('detRmbColabFoto');
    const nomEl = document.getElementById('detRmbColabNombre');
    const areaEl = document.getElementById('detRmbColabArea');
    const emailEl = document.getElementById('detRmbColabEmail');
    const solEl = document.getElementById('detRmbColabSolicitado');
    const devEl = document.getElementById('detRmbColabDevuelto');
    const penEl = document.getElementById('detRmbColabPendiente');

    if (fotoEl) fotoEl.src = detalle.fotoPerfil || '/assets/images/default-avatar.png';
    if (nomEl) nomEl.textContent = detalle.nombreCompleto || 'Colaborador';
    if (areaEl) areaEl.innerHTML = `<i class="fas fa-sitemap"></i> ${escaparHtml(detalle.areaNombre || 'General')}`;
    if (emailEl) emailEl.innerHTML = `<i class="fas fa-envelope"></i> ${escaparHtml(detalle.emailEmpresarial || '')}`;
    if (solEl) solEl.textContent = formatearMoneda(detalle.metricas?.montoTotalSolicitado || 0);
    if (devEl) devEl.textContent = formatearMoneda(detalle.metricas?.montoTotalDevuelto || 0);
    if (penEl) penEl.textContent = formatearMoneda(detalle.metricas?.saldoTotalPendiente || 0);

    panel.style.display = 'block';
}

function renderizarTablaReembolsosAdmin(tbody, lista) {
    if (!tbody) return;
    tbody.innerHTML = '';

    lista.forEach(rmb => {
        const tr = document.createElement('tr');

        const montoSol = ReembolsoModel.roundCurrency(rmb.montoSolicitado || 0);
        const montoDev = ReembolsoModel.roundCurrency(rmb.montoReembolsado || 0);
        const saldoPen = rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO
            ? 0
            : Math.max(0, ReembolsoModel.roundCurrency(montoSol - montoDev));
        const pct = rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO
            ? 0
            : (montoSol > 0 ? Math.min(100, Math.round((montoDev / montoSol) * 100)) : 0);

        const numAbonos = Array.isArray(rmb.historialDevoluciones) ? rmb.historialDevoluciones.length : 0;

        let badgeEstado = '';
        if (rmb.estado === ESTADOS_REEMBOLSO.LIQUIDADO) {
            const sub = numAbonos > 1 ? `Liquidado (${numAbonos} abonos)` : 'Devolución Total (100%)';
            badgeEstado = `<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-double"></i> ${sub}</span>`;
        } else if (rmb.estado === ESTADOS_REEMBOLSO.PARCIAL) {
            badgeEstado = `<span class="rsi-badge rsi-badge-warning"><i class="fas fa-chart-pie"></i> Parcial (${numAbonos} abono${numAbonos === 1 ? '' : 's'})</span>`;
        } else if (rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO) {
            badgeEstado = `<span class="rsi-badge rsi-badge-danger"><i class="fas fa-ban"></i> Rechazado</span>`;
        } else {
            badgeEstado = `<span class="rsi-badge rsi-badge-info"><i class="fas fa-clock"></i> Pendiente de Pago</span>`;
        }

        let evidenciaHtml = '<span class="rsi-text-muted">--</span>';
        if (rmb.evidenciaUrl) {
            const esPdf = rmb.evidenciaUrl.toLowerCase().includes('.pdf') || (rmb.evidenciaNombre || '').toLowerCase().endsWith('.pdf');
            if (esPdf) {
                evidenciaHtml = `
                    <a href="${rmb.evidenciaUrl}" target="_blank" rel="noopener" class="rsi-btn-link">
                        <i class="fas fa-file-pdf" style="color: #dc3545; font-size: 1.2rem;"></i> PDF
                    </a>
                `;
            } else {
                evidenciaHtml = `
                    <div class="rsi-rmb-thumb-wrap">
                        <img src="${rmb.evidenciaUrl}" alt="Evidencia ${escaparHtml(rmb.folio)}" class="rsi-rmb-thumb-img">
                    </div>
                `;
            }
        }

        const puedeDevolver = rmb.estado !== ESTADOS_REEMBOLSO.LIQUIDADO && rmb.estado !== ESTADOS_REEMBOLSO.RECHAZADO && saldoPen > 0.009;

        tr.innerHTML = `
            <td>
                <div class="rsi-rmb-colab-cell btn-filtrar-colab-rmb" data-uid="${escaparHtml(rmb.colaboradorUid)}" title="Ver todos los reembolsos de ${escaparHtml(rmb.colaboradorNombre)}">
                    <img src="${escaparHtml(rmb.colaboradorFoto || '/assets/images/default-avatar.png')}" alt="Avatar" class="rsi-rmb-colab-avatar">
                    <div>
                        <strong class="rsi-rmb-colab-link">${escaparHtml(rmb.colaboradorNombre)}</strong>
                        <div style="font-size: 0.76rem; color: var(--rsi-text-muted);">${escaparHtml(rmb.colaboradorArea || 'General')}</div>
                    </div>
                </div>
            </td>
            <td>
                <strong style="color: var(--rsi-primary);">${escaparHtml(rmb.folio || 'RMB-RSI')}</strong>
                <div style="font-size: 0.77rem; color: var(--rsi-text-muted);">${escaparHtml(rmb.fechaGasto || rmb.fechaRegistro)}</div>
                ${rmb.esReembolsoTercero ? `<span style="font-size: 0.7rem; color: var(--rsi-primary);"><i class="fas fa-user-plus"></i> Directo</span>` : ''}
            </td>
            <td>
                <span class="rsi-rmb-category-pill">${escaparHtml(rmb.categoriaNombre || CATEGORIAS_REEMBOLSO[rmb.categoria] || 'Gasto')}</span>
                <div style="margin-top: 4px; font-size: 0.85rem; color: var(--rsi-text-primary); max-width: 260px;">
                    ${escaparHtml(rmb.motivo)}
                </div>
            </td>
            <td style="text-align: center;">${evidenciaHtml}</td>
            <td style="text-align: right; font-weight: 700;">${formatearMoneda(montoSol)}</td>
            <td>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;">
                    <span style="color: #28a745;">${formatearMoneda(montoDev)}</span>
                    <span>${pct}%</span>
                </div>
                <div class="rsi-rmb-progress-bar">
                    <div class="rsi-rmb-progress-fill ${pct >= 100 ? 'complete' : (pct > 0 ? 'partial' : '')}" style="width: ${pct}%;"></div>
                </div>
            </td>
            <td style="text-align: right; font-weight: 700; color: ${saldoPen > 0 ? '#dc3545' : '#28a745'};">
                ${formatearMoneda(saldoPen)}
            </td>
            <td>
                ${badgeEstado}
                ${rmb.ultimoRevisorNombre ? `<div style="font-size: 0.72rem; color: var(--rsi-text-muted); margin-top: 3px;">Por: ${escaparHtml(rmb.ultimoRevisorNombre)}</div>` : ''}
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                    ${puedeDevolver ? `
                        <button type="button" class="rsi-btn-crud rsi-btn-crud-success btn-abrir-devolver-rmb" data-id="${rmb.id}" style="padding: 6px 11px; font-size: 0.78rem;">
                            <i class="fas fa-hand-holding-usd"></i> Devolver
                        </button>
                    ` : ''}
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-abrir-devolver-rmb" data-id="${rmb.id}" style="padding: 6px 10px; font-size: 0.78rem;" title="Ver detalle e historial de abonos">
                        <i class="fas fa-eye"></i> (${numAbonos})
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
        ImageZoom.attachToContainer(tbody);
    }

    // Clic en el colaborador para ver su expediente específico
    tbody.querySelectorAll('.btn-filtrar-colab-rmb').forEach(cell => {
        cell.addEventListener('click', () => {
            const uid = cell.dataset.uid;
            const selColab = document.getElementById('filtroRmbAdminColaborador');
            if (selColab && uid) {
                selColab.value = uid;
                cargarReembolsosPanel();
            }
        });
    });

    // Clic en Devolver / Ver Detalle
    tbody.querySelectorAll('.btn-abrir-devolver-rmb').forEach(btn => {
        btn.addEventListener('click', () => {
            const rmb = (estadoDatosAdmin.reembolsos || []).find(item => item.id === btn.dataset.id);
            if (rmb) abrirModalDevolverReembolso(rmb);
        });
    });
}

/* ==========================================
   MODAL 1: HACER REEMBOLSO A OTRO COLABORADOR
   ========================================== */

function abrirModalReembolsoColaborador(preselectedUid = '') {
    const modal = document.getElementById('modalReembolsoColaborador');
    const form = document.getElementById('formReembolsoColaborador');
    const selColab = document.getElementById('rmbColabSelect');
    const inputFecha = document.getElementById('rmbColabFecha');

    if (!modal) return;
    if (form) form.reset();
    limpiarArchivoModalColab();

    const hoy = ReembolsoModel.getCurrentDateString();
    if (inputFecha) {
        inputFecha.value = hoy;
        inputFecha.max = hoy;
    }

    if (selColab && preselectedUid) {
        selColab.value = preselectedUid;
    }

    actualizarUIModalDevolucionInicial();
    modal.style.display = 'flex';
}

function cerrarModalReembolsoColaborador() {
    const modal = document.getElementById('modalReembolsoColaborador');
    if (modal) modal.style.display = 'none';
    limpiarArchivoModalColab();
}

function seleccionarArchivoModalColab(file) {
    if (!file) return;
    const val = ReembolsoModel.validateArchivoEvidencia(file, { allowPdf: true });
    if (!val.valid) {
        Swal.fire({
            icon: 'warning',
            title: 'Archivo no válido',
            text: val.error,
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    archivoEvidenciaColabModal = file;
    if (previewColabUrl) {
        URL.revokeObjectURL(previewColabUrl);
        previewColabUrl = null;
    }

    const card = document.getElementById('previewRmbColabEvidencia');
    const nombreEl = document.getElementById('previewRmbColabNombre');
    const bodyEl = document.getElementById('previewRmbColabBody');

    if (nombreEl) nombreEl.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (bodyEl) {
        bodyEl.innerHTML = '';
        if (file.type.startsWith('image/')) {
            previewColabUrl = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.src = previewColabUrl;
            img.alt = 'Evidencia de reembolso';
            img.className = 'rsi-reembolso-preview-img';
            bodyEl.appendChild(img);

            if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
                ImageZoom.attachToContainer(bodyEl);
            }
        } else {
            bodyEl.innerHTML = `<div class="rsi-pdf-preview-badge"><i class="fas fa-file-pdf" style="color: #dc3545;"></i> ${escaparHtml(file.name)}</div>`;
        }
    }

    if (card) card.style.display = 'block';
}

function limpiarArchivoModalColab() {
    archivoEvidenciaColabModal = null;
    if (previewColabUrl) {
        URL.revokeObjectURL(previewColabUrl);
        previewColabUrl = null;
    }
    const card = document.getElementById('previewRmbColabEvidencia');
    const bodyEl = document.getElementById('previewRmbColabBody');
    const inp1 = document.getElementById('inputCamaraRmbColab');
    const inp2 = document.getElementById('inputArchivoRmbColab');

    if (card) card.style.display = 'none';
    if (bodyEl) bodyEl.innerHTML = '';
    if (inp1) inp1.value = '';
    if (inp2) inp2.value = '';
}

function actualizarUIModalDevolucionInicial() {
    const radioSel = document.querySelector('input[name="accionDevolucionInicial"]:checked');
    const valor = radioSel ? radioSel.value : 'total';

    document.querySelectorAll('.rsi-radio-pill').forEach(pill => {
        const input = pill.querySelector('input');
        pill.classList.toggle('active', Boolean(input && input.checked));
    });

    const bloque = document.getElementById('bloqueCamposDevolucionInicial');
    const grupoParcial = document.getElementById('grupoMontoInicialParcial');

    if (bloque) {
        bloque.style.display = valor === 'pendiente' ? 'none' : 'block';
    }
    if (grupoParcial) {
        grupoParcial.style.display = valor === 'parcial' ? 'block' : 'none';
    }

    actualizarCalculoSaldoInicialModal1();
}

function actualizarCalculoSaldoInicialModal1() {
    const montoTotal = Number(document.getElementById('rmbColabMonto')?.value || 0);
    const montoInicial = Number(document.getElementById('rmbColabMontoInicial')?.value || 0);
    const helpEl = document.getElementById('helpSaldoRestanteInicial');

    if (helpEl) {
        const restante = Math.max(0, ReembolsoModel.roundCurrency(montoTotal - montoInicial));
        helpEl.textContent = `Saldo pendiente restante tras este abono: ${formatearMoneda(restante)} MXN`;
    }
}

async function handleSubmitReembolsoColaborador(e) {
    e.preventDefault();

    const colaboradorUid = document.getElementById('rmbColabSelect')?.value || '';
    const montoSolicitado = Number(document.getElementById('rmbColabMonto')?.value || 0);
    const fechaGasto = document.getElementById('rmbColabFecha')?.value || '';
    const categoria = document.getElementById('rmbColabCategoria')?.value || 'viaticos_transporte';
    const referenciaComprobante = document.getElementById('rmbColabReferencia')?.value || '';
    const motivo = (document.getElementById('rmbColabMotivo')?.value || '').trim();
    const accionRadio = document.querySelector('input[name="accionDevolucionInicial"]:checked');
    const accionInicial = accionRadio ? accionRadio.value : 'total';
    const montoInicialParcial = Number(document.getElementById('rmbColabMontoInicial')?.value || 0);
    const metodoPagoInicial = document.getElementById('rmbColabMetodoPago')?.value || 'transferencia';

    if (!colaboradorUid) {
        Swal.fire({ icon: 'warning', title: 'Selecciona un colaborador', text: 'Debes elegir al colaborador beneficiario.', confirmButtonColor: '#1c1948' });
        return;
    }

    if (!montoSolicitado || montoSolicitado <= 0) {
        Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'Ingresa un monto mayor a $0.00 MXN.', confirmButtonColor: '#1c1948' });
        return;
    }

    if (motivo.length < 5) {
        Swal.fire({ icon: 'warning', title: 'Motivo requerido', text: 'Ingresa el motivo del reembolso (mínimo 5 caracteres).', confirmButtonColor: '#1c1948' });
        return;
    }

    if (!archivoEvidenciaColabModal) {
        Swal.fire({ icon: 'warning', title: 'Evidencia fotográfica requerida', text: 'Adjunta o toma una fotografía de la evidencia del reembolso.', confirmButtonColor: '#1c1948' });
        return;
    }

    if (accionInicial === 'parcial' && (!montoInicialParcial || montoInicialParcial <= 0 || montoInicialParcial >= montoSolicitado)) {
        Swal.fire({
            icon: 'warning',
            title: 'Monto parcial inválido',
            text: 'Para una devolución parcial inicial, el abono debe ser mayor a $0.00 y menor al monto total solicitado.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitRmbColab');
    if (btnSubmit) btnSubmit.disabled = true;

    Swal.fire({
        title: 'Guardando reembolso...',
        text: 'Subiendo evidencia fotográfica y registrando operación...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await service.crearReembolsoAColaborador({
            colaboradorUid,
            montoSolicitado,
            categoria,
            fechaGasto,
            motivo,
            referenciaComprobante,
            modalidadSolicitada: accionInicial === 'parcial' ? TIPOS_DEVOLUCION.PARCIAL : TIPOS_DEVOLUCION.TOTAL,
            archivoEvidencia: archivoEvidenciaColabModal,
            aplicarDevolucionInmediata: accionInicial !== 'pendiente',
            tipoDevolucionInicial: accionInicial === 'parcial' ? TIPOS_DEVOLUCION.PARCIAL : TIPOS_DEVOLUCION.TOTAL,
            montoDevolucionInicial: accionInicial === 'parcial' ? montoInicialParcial : montoSolicitado,
            metodoPagoInicial
        });

        if (res.success) {
            cerrarModalReembolsoColaborador();
            await Swal.fire({
                icon: 'success',
                title: '¡Reembolso Registrado!',
                text: res.message,
                confirmButtonColor: '#1c1948'
            });
            await cargarReembolsosPanel(true);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error al registrar',
                text: res.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: error.message || 'No se pudo guardar el reembolso.',
            confirmButtonColor: '#1c1948'
        });
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

/* ==========================================
   MODAL 2: DEVOLVER REEMBOLSO (TOTAL O PARCIAL)
   ========================================== */

function abrirModalDevolverReembolso(rmb) {
    reembolsoSeleccionadoModal = rmb;

    const modal = document.getElementById('modalDevolverReembolso');
    const folioEl = document.getElementById('devModalFolio');
    const headerResumen = document.getElementById('devModalResumenHeader');
    const elSol = document.getElementById('devModalMontoSolicitado');
    const elDev = document.getElementById('devModalMontoDevuelto');
    const elSal = document.getElementById('devModalSaldoPendiente');
    const evidContainer = document.getElementById('devModalEvidenciaContainer');
    const formDevolucion = document.getElementById('formAplicarDevolucion');
    const btnRechazar = document.getElementById('btnRechazarReembolsoModal');

    if (!modal) return;

    const montoSol = ReembolsoModel.roundCurrency(rmb.montoSolicitado || 0);
    const montoDev = ReembolsoModel.roundCurrency(rmb.montoReembolsado || 0);
    const saldoPen = rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO
        ? 0
        : Math.max(0, ReembolsoModel.roundCurrency(montoSol - montoDev));

    if (folioEl) folioEl.textContent = rmb.folio || '';
    if (elSol) elSol.textContent = formatearMoneda(montoSol);
    if (elDev) elDev.textContent = formatearMoneda(montoDev);
    if (elSal) elSal.textContent = formatearMoneda(saldoPen);

    if (headerResumen) {
        headerResumen.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                <img src="${escaparHtml(rmb.colaboradorFoto || '/assets/images/default-avatar.png')}" alt="Avatar" class="rsi-rmb-colab-avatar" style="width: 46px; height: 46px;">
                <div>
                    <h4 style="margin: 0; font-size: 1.02rem; color: var(--rsi-text-primary);">${escaparHtml(rmb.colaboradorNombre)}</h4>
                    <span style="font-size: 0.82rem; color: var(--rsi-text-muted);">${escaparHtml(rmb.colaboradorArea || 'General')} • ${escaparHtml(rmb.colaboradorEmail || '')}</span>
                </div>
            </div>
            <p style="margin: 4px 0;"><strong>Categoría:</strong> ${escaparHtml(rmb.categoriaNombre || CATEGORIAS_REEMBOLSO[rmb.categoria] || 'Gasto')} | <strong>Fecha del Gasto:</strong> ${escaparHtml(rmb.fechaGasto || rmb.fechaRegistro)}</p>
            <p style="margin: 4px 0;"><strong>Motivo del Reembolso:</strong> ${escaparHtml(rmb.motivo)}</p>
            ${rmb.referenciaComprobante ? `<p style="margin: 4px 0;"><strong>Referencia:</strong> ${escaparHtml(rmb.referenciaComprobante)}</p>` : ''}
        `;
    }

    if (evidContainer) {
        if (rmb.evidenciaUrl) {
            const esPdf = rmb.evidenciaUrl.toLowerCase().includes('.pdf') || (rmb.evidenciaNombre || '').toLowerCase().endsWith('.pdf');
            if (esPdf) {
                evidContainer.innerHTML = `
                    <a href="${rmb.evidenciaUrl}" target="_blank" rel="noopener" class="rsi-btn-crud rsi-btn-crud-outline">
                        <i class="fas fa-file-pdf"></i> Ver Evidencia PDF
                    </a>
                `;
            } else {
                evidContainer.innerHTML = `<img src="${rmb.evidenciaUrl}" alt="Evidencia ${escaparHtml(rmb.folio)}" class="rsi-reembolso-modal-img">`;
                if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
                    ImageZoom.attachToContainer(evidContainer);
                }
            }
        } else {
            evidContainer.innerHTML = '<span class="rsi-text-muted">Sin evidencia adjunta</span>';
        }
    }

    // Mostrar u ocultar formulario de devolución según si hay saldo pendiente
    const puedeDevolver = rmb.estado !== ESTADOS_REEMBOLSO.LIQUIDADO && rmb.estado !== ESTADOS_REEMBOLSO.RECHAZADO && saldoPen > 0.009;
    if (formDevolucion) {
        formDevolucion.reset();
        formDevolucion.style.display = puedeDevolver ? 'block' : 'none';
    }

    if (btnRechazar) {
        // Solo permitir rechazar si aún no se ha devuelto dinero
        btnRechazar.style.display = (montoDev <= 0 && rmb.estado === ESTADOS_REEMBOLSO.PENDIENTE) ? 'inline-flex' : 'none';
    }

    if (puedeDevolver) {
        const radioTotal = document.querySelector('input[name="tipoDevolucionModal"][value="total"]');
        if (radioTotal) radioTotal.checked = true;
        actualizarModoDevolucionModal2();
    }

    renderizarHistorialAbonosEnModal(rmb);
    modal.style.display = 'flex';
}

function cerrarModalDevolverReembolso() {
    const modal = document.getElementById('modalDevolverReembolso');
    if (modal) modal.style.display = 'none';
    reembolsoSeleccionadoModal = null;
}

function actualizarModoDevolucionModal2() {
    if (!reembolsoSeleccionadoModal) return;

    const radioSel = document.querySelector('input[name="tipoDevolucionModal"]:checked');
    const modo = radioSel ? radioSel.value : TIPOS_DEVOLUCION.TOTAL;

    const cardTotal = document.getElementById('cardDevModalTotal');
    const cardParcial = document.getElementById('cardDevModalParcial');
    const inputMonto = document.getElementById('devModalInputMonto');
    const quickBar = document.getElementById('devModalQuickPercentBtns');
    const saldoPen = ReembolsoModel.roundCurrency(reembolsoSeleccionadoModal.saldoPendiente || 0);

    if (cardTotal) cardTotal.classList.toggle('active', modo === TIPOS_DEVOLUCION.TOTAL);
    if (cardParcial) cardParcial.classList.toggle('active', modo === TIPOS_DEVOLUCION.PARCIAL);

    if (inputMonto) {
        inputMonto.max = String(saldoPen);
        if (modo === TIPOS_DEVOLUCION.TOTAL) {
            inputMonto.value = saldoPen.toFixed(2);
            inputMonto.readOnly = true;
        } else {
            const mitad = ReembolsoModel.roundCurrency(saldoPen / 2);
            inputMonto.value = (mitad > 0 ? mitad : saldoPen).toFixed(2);
            inputMonto.readOnly = false;
            inputMonto.focus();
        }
    }

    if (quickBar) {
        quickBar.style.display = modo === TIPOS_DEVOLUCION.PARCIAL ? 'flex' : 'none';
    }

    actualizarCalculoRestanteModal2();
}

function actualizarCalculoRestanteModal2() {
    if (!reembolsoSeleccionadoModal) return;

    const saldoPen = ReembolsoModel.roundCurrency(reembolsoSeleccionadoModal.saldoPendiente || 0);
    const montoIngresado = ReembolsoModel.roundCurrency(document.getElementById('devModalInputMonto')?.value || 0);
    const calcEl = document.getElementById('devModalCalculoRestante');

    if (!calcEl) return;

    if (montoIngresado > saldoPen + 0.009) {
        calcEl.textContent = `⚠️ El monto ingresado supera el saldo pendiente (${formatearMoneda(saldoPen)}).`;
        calcEl.style.color = '#dc3545';
        return;
    }

    const nuevoRestante = Math.max(0, ReembolsoModel.roundCurrency(saldoPen - montoIngresado));
    if (nuevoRestante <= 0.009) {
        calcEl.textContent = `✓ Con este pago el reembolso quedará LIQUIDADO AL 100% (Saldo: $0.00 MXN)`;
        calcEl.style.color = '#28a745';
    } else {
        calcEl.textContent = `Devolución Parcial: Se abonarán ${formatearMoneda(montoIngresado)} y quedará un saldo pendiente de ${formatearMoneda(nuevoRestante)} MXN`;
        calcEl.style.color = '#d97706';
    }
}

function renderizarHistorialAbonosEnModal(rmb) {
    const container = document.getElementById('devModalHistorialContainer');
    if (!container) return;

    const abonos = Array.isArray(rmb.historialDevoluciones) ? rmb.historialDevoluciones : [];
    if (abonos.length === 0) {
        container.innerHTML = `
            <div class="rsi-empty-inline-box">
                <i class="fas fa-info-circle"></i>
                <span>Este reembolso aún no tiene devoluciones ni abonos registrados.</span>
            </div>
        `;
        return;
    }

    const filas = abonos.map((ab, idx) => {
        const fechaFmt = ab.fecha ? new Date(ab.fecha).toLocaleString('es-MX') : '--';
        const badge = ab.tipo === TIPOS_DEVOLUCION.TOTAL
            ? '<span class="rsi-badge rsi-badge-success">Total (100%)</span>'
            : '<span class="rsi-badge rsi-badge-warning">Parcial</span>';
        const compHtml = ab.comprobanteUrl
            ? `<a href="${ab.comprobanteUrl}" target="_blank" rel="noopener" class="rsi-btn-link"><i class="fas fa-file-invoice"></i> Ver</a>`
            : '--';

        return `
            <tr>
                <td>#${ab.numeroAbono || (idx + 1)}</td>
                <td>${fechaFmt}</td>
                <td>${badge}</td>
                <td style="font-weight: 700; color: #28a745;">${formatearMoneda(ab.monto)}</td>
                <td>${formatearMoneda(ab.saldoRestante)}</td>
                <td>${escaparHtml(ab.metodoPagoNombre || ab.metodoPago || 'Transferencia')}</td>
                <td>
                    <strong>${escaparHtml(ab.realizadoPorNombre || 'Autorizado')}</strong>
                    ${ab.comentario ? `<div style="font-size: 0.75rem; color: var(--rsi-text-muted);">${escaparHtml(ab.comentario)}</div>` : ''}
                </td>
                <td>${compHtml}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="rsi-table-wrapper">
            <table class="rsi-table" style="font-size: 0.82rem;">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Monto Devuelto</th>
                        <th>Saldo Restante</th>
                        <th>Método</th>
                        <th>Autorizado Por</th>
                        <th>Comprobante</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
    `;
}

async function handleSubmitAplicarDevolucion(e) {
    e.preventDefault();
    if (!reembolsoSeleccionadoModal) return;

    const rmbActual = reembolsoSeleccionadoModal;
    const radioSel = document.querySelector('input[name="tipoDevolucionModal"]:checked');
    const tipoDevolucion = radioSel ? radioSel.value : TIPOS_DEVOLUCION.TOTAL;
    const montoDevolver = Number(document.getElementById('devModalInputMonto')?.value || 0);
    const metodoPago = document.getElementById('devModalMetodoPago')?.value || 'transferencia';
    const referenciaPago = document.getElementById('devModalReferenciaPago')?.value || '';
    const comentario = document.getElementById('devModalComentario')?.value || '';
    const inputComprobante = document.getElementById('devModalArchivoComprobante');
    const archivoComprobante = (inputComprobante && inputComprobante.files && inputComprobante.files[0])
        ? inputComprobante.files[0]
        : null;

    const saldoActual = ReembolsoModel.roundCurrency(rmbActual.saldoPendiente || 0);
    if (!montoDevolver || montoDevolver <= 0 || montoDevolver > saldoActual + 0.009) {
        Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: `Ingresa un monto entre $0.01 y ${formatearMoneda(saldoActual)} MXN.`,
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarDevolucionModal');
    if (btnConfirmar) btnConfirmar.disabled = true;

    Swal.fire({
        title: 'Registrando devolución...',
        text: 'Actualizando saldo del reembolso y guardando comprobante...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await service.devolverReembolso({
            reembolsoId: rmbActual.id,
            tipoDevolucion,
            montoDevolver,
            metodoPago,
            referenciaPago,
            comentario,
            archivoComprobante
        });

        if (res.success) {
            cerrarModalDevolverReembolso();
            await Swal.fire({
                icon: 'success',
                title: '¡Devolución Aplicada!',
                text: res.message,
                confirmButtonColor: '#1c1948'
            });
            await cargarReembolsosPanel(true);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo aplicar la devolución',
                text: res.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: error.message || 'Ocurrió un error al registrar la devolución.',
            confirmButtonColor: '#1c1948'
        });
    } finally {
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}

async function handleRechazarReembolsoDesdeModal() {
    if (!reembolsoSeleccionadoModal) return;

    const rmbActual = reembolsoSeleccionadoModal;
    const comentarioInput = (document.getElementById('devModalComentario')?.value || '').trim();

    if (comentarioInput.length < 5) {
        Swal.fire({
            icon: 'warning',
            title: 'Motivo de rechazo requerido',
            text: 'Por favor escribe en el campo "Nota o Comentario" el motivo por el cual se rechaza este reembolso (mínimo 5 caracteres).',
            confirmButtonColor: '#1c1948'
        });
        document.getElementById('devModalComentario')?.focus();
        return;
    }

    try {
        const res = await service.rechazarReembolso({
            reembolsoId: rmbActual.id,
            comentario: comentarioInput
        });

        if (res.success) {
            cerrarModalDevolverReembolso();
            await Swal.fire({
                icon: 'success',
                title: 'Reembolso Rechazado',
                text: res.message,
                confirmButtonColor: '#1c1948'
            });
            await cargarReembolsosPanel(true);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo rechazar',
                text: res.error,
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

/* ==========================================
   EXPORTACIÓN A EXCEL (.XLS)
   ========================================== */

function exportarReembolsosExcel() {
    const lista = estadoDatosAdmin.reembolsos || [];
    if (lista.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos para exportar',
            text: 'No hay reembolsos en la vista actual para generar el archivo Excel.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const filasHtml = lista.map(r => {
        const abonos = Array.isArray(r.historialDevoluciones) ? r.historialDevoluciones.length : 0;
        return `
            <tr>
                <td>${escaparHtml(r.folio)}</td>
                <td>${escaparHtml(r.fechaGasto || r.fechaRegistro)}</td>
                <td>${escaparHtml(r.colaboradorNombre)}</td>
                <td>${escaparHtml(r.colaboradorArea || 'General')}</td>
                <td>${escaparHtml(r.categoriaNombre || CATEGORIAS_REEMBOLSO[r.categoria] || 'Otro')}</td>
                <td>${escaparHtml(r.motivo)}</td>
                <td>${Number(r.montoSolicitado || 0).toFixed(2)}</td>
                <td>${Number(r.montoReembolsado || 0).toFixed(2)}</td>
                <td>${Number(r.saldoPendiente || 0).toFixed(2)}</td>
                <td>${r.porcentajeReembolsado || 0}%</td>
                <td>${escaparHtml(r.estado)}</td>
                <td>${abonos}</td>
                <td>${escaparHtml(r.ultimoRevisorNombre || 'Sin aplicar')}</td>
            </tr>
        `;
    }).join('');

    const htmlExcel = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"></head>
        <body>
            <table border="1">
                <thead style="background-color:#1c1948;color:#ffffff;font-weight:bold;">
                    <tr>
                        <th>Folio</th>
                        <th>Fecha Gasto</th>
                        <th>Colaborador</th>
                        <th>Área</th>
                        <th>Categoría</th>
                        <th>Motivo</th>
                        <th>Monto Solicitado (MXN)</th>
                        <th>Monto Devuelto (MXN)</th>
                        <th>Saldo Pendiente (MXN)</th>
                        <th>% Avance</th>
                        <th>Estado</th>
                        <th>No. Abonos</th>
                        <th>Autorizado / Revisado Por</th>
                    </tr>
                </thead>
                <tbody>${filasHtml}</tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reembolsos_RSI_${ReembolsoModel.getCurrentDateString()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function cleanup() {
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    eventListeners = [];
    reembolsoSeleccionadoModal = null;
    limpiarArchivoModalColab();
}

export default reembolsosCrudController;
