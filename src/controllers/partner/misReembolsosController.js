/* ========================================
   MIS REEMBOLSOS CONTROLLER - RSI ENTERPRISE
   Controlador del panel individual de Mis Reembolsos (/partner/reembolsos)
   Muestra métricas personales, avance de devoluciones (totales o parciales),
   evidencia con zoom e historial de abonos recibidos.
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
let cacheMisReembolsos = [];

const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export async function misReembolsosController() {
    console.log('💼 Inicializando Mis Reembolsos Controller...');

    cleanup();

    service = new ReembolsoService();
    authService = new AuthService();

    const session = authService.getSession();
    if (!session || !session.uid) {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/login?returnUrl=/partner/reembolsos');
        } else {
            window.location.href = '/login?returnUrl=/partner/reembolsos';
        }
        return;
    }

    inicializarFiltrosMesActual();
    bindEvents();
    await cargarMisReembolsos();

    console.log('✅ Mis Reembolsos Controller listo.');
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

function inicializarFiltrosMesActual() {
    const selMes = document.getElementById('filtroMisRmbMes');
    const selAnio = document.getElementById('filtroMisRmbAnio');
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
}

function bindEvents() {
    const selMes = document.getElementById('filtroMisRmbMes');
    const selAnio = document.getElementById('filtroMisRmbAnio');
    const selEstado = document.getElementById('filtroMisRmbEstado');
    const btnMesActual = document.getElementById('btnMisRmbMesActual');
    const btnActualizar = document.getElementById('btnActualizarMisReembolsos');

    addListener(selMes, 'change', () => cargarMisReembolsos());
    addListener(selAnio, 'change', () => cargarMisReembolsos());
    addListener(selEstado, 'change', () => cargarMisReembolsos());

    addListener(btnMesActual, 'click', () => {
        inicializarFiltrosMesActual();
        if (selEstado) selEstado.value = 'todos';
        cargarMisReembolsos(true);
    });

    addListener(btnActualizar, 'click', () => cargarMisReembolsos(true));

    // Modal de detalle de reembolso
    const modal = document.getElementById('modalDetalleMiReembolso');
    const btnCerrar1 = document.getElementById('btnCerrarModalDetalleMiRmb');
    const btnCerrar2 = document.getElementById('btnCerrarFooterDetalleMiRmb');

    addListener(btnCerrar1, 'click', cerrarModalDetalleMiRmb);
    addListener(btnCerrar2, 'click', cerrarModalDetalleMiRmb);
    if (modal) {
        addListener(modal, 'click', (e) => {
            if (e.target === modal) cerrarModalDetalleMiRmb();
        });
    }
}

async function cargarMisReembolsos(forceRefresh = false) {
    const loadingEl = document.getElementById('loadingMisReembolsos');
    const emptyEl = document.getElementById('emptyMisReembolsos');
    const wrapperEl = document.getElementById('tablaMisReembolsosWrapper');
    const tbodyEl = document.getElementById('misReembolsosTableBody');
    const badgePeriodo = document.getElementById('badgePeriodoMisReembolsos');
    const btnMesActual = document.getElementById('btnMisRmbMesActual');

    const fechaHoy = ReembolsoModel.getCurrentDateString();
    const [anioHoy, mesHoy] = fechaHoy.split('-').map(Number);

    const anioSel = Number(document.getElementById('filtroMisRmbAnio')?.value) || anioHoy;
    const mesSel = Number(document.getElementById('filtroMisRmbMes')?.value) || mesHoy;
    const estadoSel = document.getElementById('filtroMisRmbEstado')?.value || 'todos';

    const esMesActual = anioSel === anioHoy && mesSel === mesHoy;
    const nombreMes = NOMBRES_MESES[mesSel - 1] || '';

    if (badgePeriodo) {
        badgePeriodo.textContent = esMesActual
            ? `${nombreMes} ${anioSel} (Mes en curso)`
            : `${nombreMes} ${anioSel}`;
    }

    if (btnMesActual) {
        btnMesActual.style.display = esMesActual ? 'none' : 'inline-flex';
    }

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (wrapperEl) wrapperEl.style.display = 'none';

    try {
        const resultado = await service.getMisReembolsos({
            anio: anioSel,
            mes: mesSel,
            estado: estadoSel,
            forceRefresh
        });

        cacheMisReembolsos = resultado.reembolsos || [];
        renderizarMetricasPersonales(resultado.metricas || {});

        if (loadingEl) loadingEl.style.display = 'none';

        if (cacheMisReembolsos.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (wrapperEl) wrapperEl.style.display = 'block';
        renderizarTablaMisReembolsos(tbodyEl, cacheMisReembolsos);
    } catch (error) {
        console.error('❌ Error cargando mis reembolsos:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    }
}

function renderizarMetricasPersonales(m) {
    const elSol = document.getElementById('miMetricaSolicitado');
    const elDev = document.getElementById('miMetricaDevuelto');
    const elPen = document.getElementById('miMetricaPendienteSaldo');
    const elCnt = document.getElementById('miMetricaConteo');

    if (elSol) elSol.textContent = formatearMoneda(m.montoTotalSolicitado || 0);
    if (elDev) elDev.textContent = formatearMoneda(m.montoTotalDevuelto || 0);
    if (elPen) elPen.textContent = formatearMoneda(m.saldoTotalPendiente || 0);
    if (elCnt) {
        elCnt.textContent = `${m.pendientes || 0} / ${m.parciales || 0} / ${m.liquidados || 0}`;
    }
}

function renderizarTablaMisReembolsos(tbody, lista) {
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

        const catNombre = CATEGORIAS_REEMBOLSO[rmb.categoria] || rmb.categoriaNombre || 'Gasto Operativo';
        const numAbonos = Array.isArray(rmb.historialDevoluciones) ? rmb.historialDevoluciones.length : 0;

        // Badge de estado y modalidad
        let badgeEstadoHtml = '';
        if (rmb.estado === ESTADOS_REEMBOLSO.LIQUIDADO) {
            const etiquetaTipo = numAbonos > 1 ? 'Liquidado (en Abonos)' : 'Devolución Total (100%)';
            badgeEstadoHtml = `<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-double"></i> ${etiquetaTipo}</span>`;
        } else if (rmb.estado === ESTADOS_REEMBOLSO.PARCIAL) {
            badgeEstadoHtml = `<span class="rsi-badge rsi-badge-warning"><i class="fas fa-chart-pie"></i> Reembolso Parcial (${numAbonos} abono${numAbonos === 1 ? '' : 's'})</span>`;
        } else if (rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO) {
            badgeEstadoHtml = `<span class="rsi-badge rsi-badge-danger"><i class="fas fa-times-circle"></i> Rechazado</span>`;
        } else {
            const prefTexto = rmb.modalidadSolicitada === TIPOS_DEVOLUCION.PARCIAL ? 'Solicitado: Parcial' : 'Solicitado: Total';
            badgeEstadoHtml = `
                <span class="rsi-badge rsi-badge-info"><i class="fas fa-clock"></i> Pendiente</span>
                <div style="font-size: 0.73rem; color: var(--rsi-text-muted); margin-top: 3px;">${prefTexto}</div>
            `;
        }

        // Evidencia miniatura
        let evidenciaHtml = '<span class="rsi-text-muted">Sin archivo</span>';
        if (rmb.evidenciaUrl) {
            const esPdf = rmb.evidenciaUrl.toLowerCase().includes('.pdf') || (rmb.evidenciaNombre || '').toLowerCase().endsWith('.pdf');
            if (esPdf) {
                evidenciaHtml = `
                    <a href="${rmb.evidenciaUrl}" target="_blank" rel="noopener" class="rsi-btn-link" title="Abrir PDF">
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

        const etiquetaTercero = rmb.esReembolsoTercero
            ? `<div style="font-size: 0.72rem; color: var(--rsi-primary); margin-top: 2px;"><i class="fas fa-user-shield"></i> Asignado por: ${escaparHtml(rmb.creadoPorNombre)}</div>`
            : '';

        tr.innerHTML = `
            <td>
                <strong style="color: var(--rsi-primary);">${escaparHtml(rmb.folio || 'RMB-RSI')}</strong>
                <div style="font-size: 0.78rem; color: var(--rsi-text-muted);">Gasto: ${escaparHtml(rmb.fechaGasto || rmb.fechaRegistro)}</div>
                ${etiquetaTercero}
            </td>
            <td>
                <span class="rsi-rmb-category-pill">${escaparHtml(catNombre)}</span>
                <div style="margin-top: 4px; font-size: 0.86rem; color: var(--rsi-text-primary); max-width: 280px;">
                    ${escaparHtml(rmb.motivo)}
                </div>
                ${rmb.referenciaComprobante ? `<small style="color: var(--rsi-text-muted);">Ref: ${escaparHtml(rmb.referenciaComprobante)}</small>` : ''}
            </td>
            <td style="text-align: center;">${evidenciaHtml}</td>
            <td style="text-align: right; font-weight: 700; color: var(--rsi-text-primary);">
                ${formatearMoneda(montoSol)}
            </td>
            <td>
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600;">
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
            <td>${badgeEstadoHtml}</td>
            <td style="text-align: center;">
                <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-ver-detalle-mi-rmb" data-id="${rmb.id}" style="padding: 6px 12px; font-size: 0.8rem;">
                    <i class="fas fa-eye"></i> Detalle / Abonos (${numAbonos})
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
        ImageZoom.attachToContainer(tbody);
    }

    tbody.querySelectorAll('.btn-ver-detalle-mi-rmb').forEach(btn => {
        btn.addEventListener('click', () => {
            const rmb = cacheMisReembolsos.find(item => item.id === btn.dataset.id);
            if (rmb) abrirModalDetalleMiReembolso(rmb);
        });
    });
}

function abrirModalDetalleMiReembolso(rmb) {
    const modal = document.getElementById('modalDetalleMiReembolso');
    const folioEl = document.getElementById('detMiRmbFolio');
    const bodyEl = document.getElementById('bodyModalDetalleMiReembolso');

    if (!modal || !bodyEl) return;

    if (folioEl) folioEl.textContent = rmb.folio || '';

    const montoSol = ReembolsoModel.roundCurrency(rmb.montoSolicitado || 0);
    const montoDev = ReembolsoModel.roundCurrency(rmb.montoReembolsado || 0);
    const saldoPen = rmb.estado === ESTADOS_REEMBOLSO.RECHAZADO
        ? 0
        : Math.max(0, ReembolsoModel.roundCurrency(montoSol - montoDev));

    const abonos = Array.isArray(rmb.historialDevoluciones) ? rmb.historialDevoluciones : [];

    let evidenciaHtml = '<p class="rsi-text-muted">Sin evidencia adjunta</p>';
    if (rmb.evidenciaUrl) {
        const esPdf = rmb.evidenciaUrl.toLowerCase().includes('.pdf') || (rmb.evidenciaNombre || '').toLowerCase().endsWith('.pdf');
        if (esPdf) {
            evidenciaHtml = `
                <a href="${rmb.evidenciaUrl}" target="_blank" rel="noopener" class="rsi-btn-crud rsi-btn-crud-outline">
                    <i class="fas fa-file-pdf"></i> Abrir Comprobante PDF
                </a>
            `;
        } else {
            evidenciaHtml = `
                <div class="rsi-reembolso-evidencia-viewer">
                    <img src="${rmb.evidenciaUrl}" alt="Evidencia ${escaparHtml(rmb.folio)}" class="rsi-reembolso-modal-img">
                </div>
            `;
        }
    }

    let historialHtml = '';
    if (abonos.length === 0) {
        historialHtml = `
            <div class="rsi-empty-inline-box">
                <i class="fas fa-info-circle"></i>
                <span>Aún no se han registrado devoluciones parciales ni liquidación total sobre esta solicitud.</span>
            </div>
        `;
    } else {
        const filasAbonos = abonos.map((ab, idx) => {
            const fechaFmt = ab.fecha ? new Date(ab.fecha).toLocaleString('es-MX') : '--';
            const tipoBadge = ab.tipo === TIPOS_DEVOLUCION.TOTAL
                ? '<span class="rsi-badge rsi-badge-success">Total (100%)</span>'
                : '<span class="rsi-badge rsi-badge-warning">Abono Parcial</span>';
            const compLink = ab.comprobanteUrl
                ? `<a href="${ab.comprobanteUrl}" target="_blank" rel="noopener" class="rsi-btn-link"><i class="fas fa-receipt"></i> Ver comprobante</a>`
                : '<span class="rsi-text-muted">--</span>';

            return `
                <tr>
                    <td>#${ab.numeroAbono || (idx + 1)}</td>
                    <td>${fechaFmt}</td>
                    <td>${tipoBadge}</td>
                    <td style="font-weight: 700; color: #28a745;">${formatearMoneda(ab.monto)}</td>
                    <td>${formatearMoneda(ab.saldoRestante)}</td>
                    <td>${escaparHtml(ab.metodoPagoNombre || ab.metodoPago || 'Transferencia')}</td>
                    <td>
                        <strong>${escaparHtml(ab.realizadoPorNombre || 'Administración')}</strong>
                        ${ab.comentario ? `<div style="font-size: 0.76rem; color: var(--rsi-text-muted);">${escaparHtml(ab.comentario)}</div>` : ''}
                    </td>
                    <td>${compLink}</td>
                </tr>
            `;
        }).join('');

        historialHtml = `
            <div class="rsi-table-wrapper" style="margin-top: 8px;">
                <table class="rsi-table" style="font-size: 0.84rem;">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Fecha</th>
                            <th>Modalidad</th>
                            <th>Monto Devuelto</th>
                            <th>Saldo Restante</th>
                            <th>Método</th>
                            <th>Autorizado Por</th>
                            <th>Comprobante</th>
                        </tr>
                    </thead>
                    <tbody>${filasAbonos}</tbody>
                </table>
            </div>
        `;
    }

    bodyEl.innerHTML = `
        <div class="rsi-reembolso-balance-strip">
            <div class="rsi-balance-box">
                <span>Monto Solicitado</span>
                <strong>${formatearMoneda(montoSol)}</strong>
            </div>
            <div class="rsi-balance-box rsi-balance-paid">
                <span>Total Devuelto</span>
                <strong>${formatearMoneda(montoDev)}</strong>
            </div>
            <div class="rsi-balance-box rsi-balance-pending">
                <span>Saldo Pendiente</span>
                <strong>${formatearMoneda(saldoPen)}</strong>
            </div>
        </div>

        <div class="rsi-reembolso-modal-summary" style="margin-top: 14px;">
            <p><strong>Categoría:</strong> ${escaparHtml(CATEGORIAS_REEMBOLSO[rmb.categoria] || rmb.categoriaNombre || 'Otro')}</p>
            <p><strong>Fecha del Gasto:</strong> ${escaparHtml(rmb.fechaGasto || rmb.fechaRegistro)}</p>
            <p><strong>Motivo:</strong> ${escaparHtml(rmb.motivo)}</p>
            ${rmb.referenciaComprobante ? `<p><strong>Referencia:</strong> ${escaparHtml(rmb.referenciaComprobante)}</p>` : ''}
            ${rmb.ultimoRevisorNombre ? `<p><strong>Última revisión / pago por:</strong> ${escaparHtml(rmb.ultimoRevisorNombre)} ${rmb.comentarioResolucion ? `— <em>"${escaparHtml(rmb.comentarioResolucion)}"</em>` : ''}</p>` : ''}
        </div>

        <div style="margin-top: 14px;">
            <label class="rsi-form-label"><i class="fas fa-camera"></i> Evidencia Fotográfica Adjunta (Haz clic en la imagen para hacer Zoom):</label>
            ${evidenciaHtml}
        </div>

        <div style="margin-top: 18px;">
            <h4 style="margin: 0 0 8px 0; font-size: 0.96rem; color: var(--rsi-text-primary);">
                <i class="fas fa-history"></i> Desglose de Devoluciones (Totales o Parciales)
            </h4>
            ${historialHtml}
        </div>
    `;

    if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
        ImageZoom.attachToContainer(bodyEl);
    }

    modal.style.display = 'flex';
}

function cerrarModalDetalleMiRmb() {
    const modal = document.getElementById('modalDetalleMiReembolso');
    if (modal) modal.style.display = 'none';
}

function cleanup() {
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    eventListeners = [];
    cacheMisReembolsos = [];
}

export default misReembolsosController;
