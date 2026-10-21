/* ========================================
   ASISTENCIA CONTROLLER - RSI ENTERPRISE
   Controlador de la vista individual de Asistencia y Salida
   ======================================== */

import AsistenciaService from '../../services/asistenciaService.js';
import JustificacionService from '../../services/justificacionService.js';
import GeoMapHelper from '../../utils/geoMapHelper.js';
import { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION } from '../../models/asistenciaModel.js';

let service = null;
let justificacionService = null;
let clockInterval = null;
let eventListeners = [];
let estadoHoy = null;
let archivoEvidenciaSeleccionado = null;

const NOMBRES_MESES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export async function asistenciaController() {
    console.log('⏰ Inicializando Asistencia Controller...');

    cleanup();

    service = new AsistenciaService();
    justificacionService = new JustificacionService();

    iniciarRelojEnVivo();
    inicializarFiltrosHistorial();
    bindEvents();

    await cargarEstadoHoy();
    await cargarHistorial();

    console.log('✅ Asistencia Controller listo.');
}

/**
 * Inicializa los selectores de mes y año del historial personal al mes en curso (America/Mexico_City)
 */
function inicializarFiltrosHistorial() {
    const selMes = document.getElementById('filtroHistorialMes');
    const selAnio = document.getElementById('filtroHistorialAnio');
    const selEstado = document.getElementById('filtroHistorialEstado');

    const { fecha } = service.getFechaHoraActual();
    const [anioStr, mesStr] = fecha.split('-');
    const anioActual = parseInt(anioStr, 10) || new Date().getFullYear();
    const mesActual = parseInt(mesStr, 10) || (new Date().getMonth() + 1);

    if (selAnio) {
        selAnio.innerHTML = '';
        for (let a = anioActual; a >= anioActual - 3; a--) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            selAnio.appendChild(opt);
        }
        selAnio.value = String(anioActual);
    }

    if (selMes) {
        selMes.value = String(mesActual);
    }

    if (selEstado) {
        selEstado.value = 'todos';
    }
}

/**
 * Inicia el reloj digital sincronizado con la zona horaria institucional
 */
function iniciarRelojEnVivo() {
    const elTime = document.getElementById('liveClockTime');
    const elDate = document.getElementById('liveClockDate');
    if (!elTime || !elDate) return;

    const actualizar = () => {
        const now = new Date();
        const opcionesHora = { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const opcionesFecha = { timeZone: 'America/Mexico_City', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        try {
            elTime.textContent = new Intl.DateTimeFormat('es-MX', opcionesHora).format(now);
            const fechaTxt = new Intl.DateTimeFormat('es-MX', opcionesFecha).format(now);
            elDate.textContent = fechaTxt.charAt(0).toUpperCase() + fechaTxt.slice(1);
        } catch (e) {
            elTime.textContent = now.toLocaleTimeString();
            elDate.textContent = now.toLocaleDateString();
        }
    };

    actualizar();
    clockInterval = setInterval(actualizar, 1000);
}

/**
 * Asocia los eventos de la vista
 */
function bindEvents() {
    const btnEntrada = document.getElementById('btnRegistrarEntrada');
    const btnSalida = document.getElementById('btnRegistrarSalida');
    const btnRefresh = document.getElementById('btnActualizarHistorial');
    const btnMesActual = document.getElementById('btnHistorialMesActual');
    const selMes = document.getElementById('filtroHistorialMes');
    const selAnio = document.getElementById('filtroHistorialAnio');
    const selEstado = document.getElementById('filtroHistorialEstado');
    const btnAbrirModal = document.getElementById('btnAbrirModalJustificacion');
    const btnCerrarModal = document.getElementById('btnCerrarModalJustificacion');
    const btnCancelarModal = document.getElementById('btnCancelarJustificacion');
    const backdropModal = document.getElementById('modalJustificacionBackdrop');
    const formJustificacion = document.getElementById('formJustificacion');
    const inputEvidencia = document.getElementById('justEvidencia');
    const btnQuitarEvidencia = document.getElementById('btnQuitarEvidencia');
    const textareaMotivo = document.getElementById('justMotivo');
    const btnVerMapaHoy = document.getElementById('btnVerMapaHoy');

    if (btnEntrada) {
        btnEntrada.addEventListener('click', handleRegistrarEntrada);
        eventListeners.push({ element: btnEntrada, event: 'click', handler: handleRegistrarEntrada });
    }

    if (btnSalida) {
        btnSalida.addEventListener('click', handleRegistrarSalida);
        eventListeners.push({ element: btnSalida, event: 'click', handler: handleRegistrarSalida });
    }

    if (btnRefresh) {
        const onRefresh = async () => {
            await cargarEstadoHoy();
            await cargarHistorial();
        };
        btnRefresh.addEventListener('click', onRefresh);
        eventListeners.push({ element: btnRefresh, event: 'click', handler: onRefresh });
    }

    if (btnMesActual) {
        const onResetMes = async () => {
            inicializarFiltrosHistorial();
            await cargarHistorial();
        };
        btnMesActual.addEventListener('click', onResetMes);
        eventListeners.push({ element: btnMesActual, event: 'click', handler: onResetMes });
    }

    [selMes, selAnio, selEstado].forEach(sel => {
        if (sel) {
            const onChangeFiltro = () => cargarHistorial();
            sel.addEventListener('change', onChangeFiltro);
            eventListeners.push({ element: sel, event: 'change', handler: onChangeFiltro });
        }
    });

    if (btnVerMapaHoy) {
        btnVerMapaHoy.addEventListener('click', () => {
            if (estadoHoy?.asistencia?.ubicacionEntrada) {
                GeoMapHelper.mostrarModalMapa(
                    estadoHoy.asistencia.ubicacionEntrada,
                    'Ubicación de Entrada de Hoy',
                    `${estadoHoy.colaborador.nombreCompleto} (${estadoHoy.fechaActual} ${estadoHoy.asistencia.horaEntrada || ''})`
                );
            }
        });
    }

    // Modal Justificación
    const modalJustificacion = document.getElementById('modalJustificacion');
    if (modalJustificacion) {
        modalJustificacion.addEventListener('click', (e) => {
            if (e.target === modalJustificacion) cerrarModalJustificacion();
        });
    }
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => abrirModalJustificacion());
    }
    if (btnCerrarModal) {
        btnCerrarModal.addEventListener('click', () => cerrarModalJustificacion());
    }
    if (btnCancelarModal) {
        btnCancelarModal.addEventListener('click', () => cerrarModalJustificacion());
    }
    if (backdropModal) {
        backdropModal.addEventListener('click', () => cerrarModalJustificacion());
    }

    // Input de evidencia y preview
    if (inputEvidencia) {
        inputEvidencia.addEventListener('change', handleSeleccionEvidencia);
    }
    if (btnQuitarEvidencia) {
        btnQuitarEvidencia.addEventListener('click', limpiarEvidenciaSeleccionada);
    }

    // Contador de caracteres
    if (textareaMotivo) {
        textareaMotivo.addEventListener('input', () => {
            const countEl = document.getElementById('charCount');
            if (countEl) countEl.textContent = textareaMotivo.value.length;
        });
    }

    // Submit Justificación
    if (formJustificacion) {
        formJustificacion.addEventListener('submit', handleEnviarJustificacion);
    }
}

/**
 * Carga el estado actual de la jornada
 */
async function cargarEstadoHoy() {
    try {
        estadoHoy = await service.getEstadoHoy();
        const { colaborador, asistencia, haRegistradoEntrada, haRegistradoSalida } = estadoHoy;

        // Datos del colaborador
        const elNombre = document.getElementById('asistenciaNombre');
        const elArea = document.getElementById('asistenciaArea');
        const elEmail = document.getElementById('asistenciaEmail');
        const elAvatar = document.getElementById('asistenciaAvatar');

        if (elNombre) elNombre.textContent = colaborador.nombreCompleto;
        if (elArea) elArea.innerHTML = `<i class="fas fa-briefcase"></i> ${colaborador.areaNombre || 'General'} ${colaborador.subareaNombre ? ` - ${colaborador.subareaNombre}` : ''}`;
        if (elEmail) elEmail.innerHTML = `<i class="fas fa-envelope"></i> ${colaborador.email}`;

        if (elAvatar && colaborador.fotoPerfil) {
            elAvatar.src = colaborador.fotoPerfil;
        }

        // Estado Entrada
        const valEntrada = document.getElementById('valEntrada');
        const subEntrada = document.getElementById('subEntrada');
        const btnEntrada = document.getElementById('btnRegistrarEntrada');

        if (haRegistradoEntrada) {
            const esRetardo = asistencia.estado === ESTADOS_ASISTENCIA.RETARDO;
            if (valEntrada) {
                valEntrada.innerHTML = `<span class="rsi-badge ${esRetardo ? 'rsi-badge-warning' : 'rsi-badge-success'}">
                    <i class="fas ${esRetardo ? 'fa-clock' : 'fa-check-circle'}"></i> ${asistencia.horaEntrada}
                </span>`;
            }
            if (subEntrada) {
                subEntrada.textContent = esRetardo
                    ? `Retardo (+${asistencia.minutosRetardo} min)`
                    : 'A tiempo (Puntual)';
            }
            if (btnEntrada) {
                btnEntrada.disabled = true;
                btnEntrada.classList.add('rsi-btn-disabled');
                btnEntrada.innerHTML = '<i class="fas fa-check-double"></i> <span>Entrada Registrada</span>';
            }
        } else {
            if (valEntrada) valEntrada.innerHTML = '<span class="rsi-badge rsi-badge-secondary">Sin registrar</span>';
            if (subEntrada) subEntrada.textContent = 'Jornada no iniciada';
            if (btnEntrada) {
                btnEntrada.disabled = false;
                btnEntrada.classList.remove('rsi-btn-disabled');
                btnEntrada.innerHTML = '<i class="fas fa-fingerprint"></i> <span>Registrar Entrada</span>';
            }
        }

        // Estado Salida
        const valSalida = document.getElementById('valSalida');
        const subSalida = document.getElementById('subSalida');
        const btnSalida = document.getElementById('btnRegistrarSalida');

        if (haRegistradoSalida) {
            if (valSalida) {
                valSalida.innerHTML = `<span class="rsi-badge rsi-badge-primary">
                    <i class="fas fa-door-closed"></i> ${asistencia.horaSalida}
                </span>`;
            }
            if (subSalida) subSalida.textContent = 'Jornada concluida';
            if (btnSalida) {
                btnSalida.disabled = true;
                btnSalida.classList.add('rsi-btn-disabled');
                btnSalida.innerHTML = '<i class="fas fa-check-circle"></i> <span>Salida Registrada</span>';
            }
        } else if (haRegistradoEntrada) {
            if (valSalida) valSalida.innerHTML = '<span class="rsi-badge rsi-badge-warning">Pendiente de salida</span>';
            if (subSalida) subSalida.textContent = 'En jornada laboral activa';
            if (btnSalida) {
                btnSalida.disabled = false;
                btnSalida.classList.remove('rsi-btn-disabled');
                btnSalida.innerHTML = '<i class="fas fa-door-open"></i> <span>Registrar Salida</span>';
            }
        } else {
            if (valSalida) valSalida.innerHTML = '<span class="rsi-badge rsi-badge-secondary">Requiere entrada previa</span>';
            if (subSalida) subSalida.textContent = 'Registra entrada primero';
            if (btnSalida) {
                btnSalida.disabled = true;
                btnSalida.classList.add('rsi-btn-disabled');
                btnSalida.innerHTML = '<i class="fas fa-door-open"></i> <span>Registrar Salida</span>';
            }
        }

        // Última ubicación
        const valUbicacion = document.getElementById('valUbicacion');
        const btnVerMapa = document.getElementById('btnVerMapaHoy');
        const ubi = asistencia?.ubicacionEntrada;

        if (ubi && ubi.latitud && ubi.longitud) {
            if (valUbicacion) {
                valUbicacion.innerHTML = `<small style="font-size:0.8rem; color:#1c1948; font-weight:600;">
                    ${ubi.latitud.toFixed(4)}, ${ubi.longitud.toFixed(4)} (±${ubi.precision || '?'}m)
                </small>`;
            }
            if (btnVerMapa) btnVerMapa.style.display = 'inline-flex';
        } else {
            if (valUbicacion) valUbicacion.textContent = haRegistradoEntrada ? 'Sin coordenadas' : 'No registrada';
            if (btnVerMapa) btnVerMapa.style.display = 'none';
        }

    } catch (error) {
        console.error('❌ Error al cargar estado diario:', error);
    }
}

/**
 * Maneja el registro de entrada
 */
async function handleRegistrarEntrada() {
    const confirmacion = await Swal.fire({
        title: '¿Registrar Entrada?',
        html: `
            <div style="text-align: left; font-size: 0.9rem; color: #495057;">
                <p>Al confirmar, el sistema solicitará:</p>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    <li><strong>Ubicación geográfica:</strong> Para validar las coordenadas de tu dispositivo.</li>
                    <li><strong>Autenticador seguro:</strong> Huella o verificación de tu dispositivo (si está disponible).</li>
                </ul>
                <p style="margin-bottom: 0;">¿Deseas continuar con el registro de tu jornada?</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-fingerprint"></i> Sí, registrar entrada',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmacion.isConfirmed) return;

    Swal.fire({
        title: 'Registrando entrada...',
        text: 'Obteniendo ubicación y verificando dispositivo...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const resultado = await service.registrarEntrada();

        if (resultado.success) {
            await cargarEstadoHoy();
            await cargarHistorial();
            document.dispatchEvent(new CustomEvent('asistencia:updated', { detail: { tipo: 'entrada' } }));

            const navResult = await Swal.fire({
                icon: resultado.clasificacion?.estado === ESTADOS_ASISTENCIA.RETARDO ? 'warning' : 'success',
                title: resultado.clasificacion?.estado === ESTADOS_ASISTENCIA.RETARDO ? '¡Entrada con Retardo!' : '¡Entrada Puntual Registrada!',
                text: resultado.mensaje,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-chart-line"></i> Ir al Dashboard',
                cancelButtonText: 'Permanecer aquí',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6c757d'
            });

            if (navResult.isConfirmed && typeof window.navigateTo === 'function') {
                await window.navigateTo('/partner/dashboard');
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar la entrada',
                text: resultado.error || 'Ocurrió un error inesperado al procesar el registro.',
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de comunicación',
            text: error.message || 'Error al conectar con el servidor',
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Maneja el registro de salida
 */
async function handleRegistrarSalida() {
    const confirmacion = await Swal.fire({
        title: '¿Registrar Salida de la Jornada?',
        text: '¿Confirmas que has concluido tus actividades laborales del día de hoy?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-door-open"></i> Sí, registrar salida',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmacion.isConfirmed) return;

    Swal.fire({
        title: 'Registrando salida...',
        text: 'Guardando hora y ubicación de salida...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const resultado = await service.registrarSalida();

        if (resultado.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Salida Registrada!',
                text: resultado.mensaje,
                confirmButtonColor: '#1c1948'
            });
            await cargarEstadoHoy();
            await cargarHistorial();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar la salida',
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
 * Carga la tabla de historial de asistencias exclusivamente del mes seleccionado (por defecto el mes actual)
 */
async function cargarHistorial() {
    const loadingEl = document.getElementById('loadingHistorial');
    const emptyEl = document.getElementById('emptyHistorial');
    const tableWrapper = document.getElementById('tablaHistorialWrapper');
    const tbody = document.getElementById('historialTableBody');
    const badgePeriodo = document.getElementById('badgePeriodoHistorial');
    const btnMesActual = document.getElementById('btnHistorialMesActual');

    const { fecha } = service.getFechaHoraActual();
    const [anioHoyStr, mesHoyStr] = fecha.split('-');
    const anioHoy = parseInt(anioHoyStr, 10) || new Date().getFullYear();
    const mesHoy = parseInt(mesHoyStr, 10) || (new Date().getMonth() + 1);

    const selMes = document.getElementById('filtroHistorialMes');
    const selAnio = document.getElementById('filtroHistorialAnio');
    const selEstado = document.getElementById('filtroHistorialEstado');

    const mesTarget = selMes?.value ? parseInt(selMes.value, 10) : mesHoy;
    const anioTarget = selAnio?.value ? parseInt(selAnio.value, 10) : anioHoy;
    const estadoTarget = selEstado?.value || 'todos';

    const esMesActual = (anioTarget === anioHoy && mesTarget === mesHoy);
    const nombreMes = NOMBRES_MESES[mesTarget] || `Mes ${mesTarget}`;

    if (badgePeriodo) {
        badgePeriodo.textContent = esMesActual
            ? `${nombreMes} ${anioTarget} (Mes en curso)`
            : `${nombreMes} ${anioTarget}`;
    }

    if (btnMesActual) {
        btnMesActual.style.display = (!esMesActual || estadoTarget !== 'todos') ? 'inline-flex' : 'none';
    }

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';

    try {
        const historial = await service.getMiHistorial({
            anio: anioTarget,
            mes: mesTarget,
            estado: estadoTarget
        });

        if (loadingEl) loadingEl.style.display = 'none';

        if (!historial || historial.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (tableWrapper) tableWrapper.style.display = 'block';
        if (tbody) {
            tbody.innerHTML = '';
            historial.forEach(reg => {
                const tr = document.createElement('tr');

                // Estado badge
                let estadoBadge = '<span class="rsi-badge rsi-badge-success">Puntual</span>';
                if (reg.estado === ESTADOS_ASISTENCIA.RETARDO) {
                    estadoBadge = '<span class="rsi-badge rsi-badge-warning">Retardo</span>';
                } else if (reg.estado === ESTADOS_ASISTENCIA.INASISTENCIA) {
                    estadoBadge = '<span class="rsi-badge rsi-badge-danger">Inasistencia</span>';
                }

                // Justificación badge
                let justBadge = '<span class="rsi-badge rsi-badge-secondary">N/A</span>';
                if (reg.estado === ESTADOS_ASISTENCIA.INASISTENCIA || reg.justificacionId || reg.estadoJustificacion !== ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION) {
                    const autorizadorSub = reg.autorizadoPor ? `<small style="display:block; font-size:0.72rem; color:var(--rsi-text-muted); margin-top:2px;">Por: ${reg.autorizadoPor}</small>` : '';
                    if (reg.estadoJustificacion === ESTADOS_JUSTIFICACION.PENDIENTE) {
                        justBadge = '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-hourglass-half"></i> Pendiente</span>';
                    } else if (reg.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA) {
                        justBadge = `<span class="rsi-badge rsi-badge-success"><i class="fas fa-check"></i> Aprobada</span>${autorizadorSub}`;
                    } else if (reg.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA) {
                        justBadge = `<span class="rsi-badge rsi-badge-danger"><i class="fas fa-times"></i> Rechazada</span>${autorizadorSub}`;
                    } else {
                        justBadge = '<span class="rsi-badge rsi-badge-outline-danger">Sin justificar</span>';
                    }
                }

                // Retardo
                const retardoTxt = reg.minutosRetardo > 0 ? `+${reg.minutosRetardo} min` : '0 min';

                // Ubicación botón
                let ubicacionBtn = '<span style="color:#adb5bd;">--</span>';
                if (reg.ubicacionEntrada && reg.ubicacionEntrada.latitud && reg.ubicacionEntrada.longitud) {
                    ubicacionBtn = `
                        <button class="rsi-btn-table-action btn-ver-mapa" data-id="${reg.id}" title="Ver ubicación en mapa">
                            <i class="fas fa-map-marker-alt"></i> Mapa
                        </button>
                    `;
                }

                // Acciones
                let accionesHTML = '';
                if (reg.estado === ESTADOS_ASISTENCIA.INASISTENCIA && (!reg.estadoJustificacion || reg.estadoJustificacion === ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION || reg.estadoJustificacion === ESTADOS_JUSTIFICACION.RECHAZADA)) {
                    accionesHTML = `
                        <button class="rsi-btn-table-action btn-justificar-fila" data-fecha="${reg.fecha}" data-id="${reg.id}" title="Justificar inasistencia">
                            <i class="fas fa-file-medical"></i> Justificar
                        </button>
                    `;
                } else if (reg.justificacionId) {
                    accionesHTML = `
                        <button class="rsi-btn-table-action btn-ver-justificacion" data-id="${reg.justificacionId}" title="Ver estado de justificación">
                            <i class="fas fa-info-circle"></i> Detalle
                        </button>
                    `;
                }

                tr.innerHTML = `
                    <td><strong>${reg.fecha || '--'}</strong></td>
                    <td>${reg.horaEntrada || '<span style="color:#adb5bd;">--:--</span>'}</td>
                    <td>${reg.horaSalida || '<span style="color:#adb5bd;">--:--</span>'}</td>
                    <td>${estadoBadge}</td>
                    <td>${retardoTxt}</td>
                    <td>${ubicacionBtn}</td>
                    <td>${justBadge}</td>
                    <td style="text-align: center;">${accionesHTML || '<span style="color:#adb5bd;">-</span>'}</td>
                `;

                // Eventos de la fila
                const btnMapa = tr.querySelector('.btn-ver-mapa');
                if (btnMapa) {
                    btnMapa.addEventListener('click', () => {
                        GeoMapHelper.mostrarModalMapa(
                            reg.ubicacionEntrada,
                            'Ubicación de Entrada',
                            `Registro del ${reg.fecha} a las ${reg.horaEntrada}`
                        );
                    });
                }

                const btnJustificar = tr.querySelector('.btn-justificar-fila');
                if (btnJustificar) {
                    btnJustificar.addEventListener('click', () => {
                        abrirModalJustificacion(reg.fecha, reg.id);
                    });
                }

                const btnVerJust = tr.querySelector('.btn-ver-justificacion');
                if (btnVerJust) {
                    btnVerJust.addEventListener('click', () => {
                        verDetalleJustificacionModal(reg.justificacionId);
                    });
                }

                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('❌ Error cargando historial:', error);
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * Abre el modal para justificar inasistencia (permitiendo únicamente días en los que no asistió del mes activo/seleccionado)
 */
async function abrirModalJustificacion(fechaSugerida = null, asistenciaId = null) {
    const modal = document.getElementById('modalJustificacion');
    const selectFecha = document.getElementById('justFechaInasistencia');
    const helpFecha = document.getElementById('justFechaHelpText');
    const textareaMotivo = document.getElementById('justMotivo');
    const btnEnviar = document.getElementById('btnEnviarJustificacion');
    const form = document.getElementById('formJustificacion');

    if (form) form.reset();
    limpiarEvidenciaSeleccionada();

    if (textareaMotivo) {
        const countEl = document.getElementById('charCount');
        if (countEl) countEl.textContent = '0';
    }

    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    if (selectFecha) {
        selectFecha.innerHTML = '<option value="">Consultando tus días sin asistencia del mes...</option>';
        selectFecha.disabled = true;
    }
    if (btnEnviar) btnEnviar.disabled = true;

    try {
        // Determinar el mes a consultar (si viene fechaSugerida usar su mes, o el filtro de mes actual)
        let anioConsulta = null;
        let mesConsulta = null;
        if (fechaSugerida && /^\d{4}-\d{2}-\d{2}$/.test(fechaSugerida)) {
            const [yS, mS] = fechaSugerida.split('-').map(n => parseInt(n, 10));
            anioConsulta = yS;
            mesConsulta = mS;
        } else {
            const selAnio = document.getElementById('filtroHistorialAnio');
            const selMes = document.getElementById('filtroHistorialMes');
            if (selAnio?.value) anioConsulta = parseInt(selAnio.value, 10);
            if (selMes?.value) mesConsulta = parseInt(selMes.value, 10);
        }

        const diasInasistencia = await service.getDiasInasistenciaJustificables({
            anio: anioConsulta,
            mes: mesConsulta
        });

        if (!selectFecha) return;
        selectFecha.innerHTML = '';

        if (!diasInasistencia || diasInasistencia.length === 0) {
            const optEmpty = document.createElement('option');
            optEmpty.value = '';
            optEmpty.textContent = 'No tienes días de inasistencia pendientes por justificar en este mes';
            selectFecha.appendChild(optEmpty);
            selectFecha.disabled = true;
            if (btnEnviar) btnEnviar.disabled = true;
            if (helpFecha) {
                helpFecha.textContent = 'Has asistido puntualmente o tus inasistencias del mes ya cuentan con justificante.';
                helpFecha.style.color = 'var(--rsi-success)';
            }
            return;
        }

        selectFecha.disabled = false;
        if (btnEnviar) btnEnviar.disabled = false;
        if (helpFecha) {
            helpFecha.textContent = 'Solo se muestran los días del mes en los que no registraste asistencia.';
            helpFecha.style.color = '';
        }

        diasInasistencia.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.fecha;
            opt.textContent = item.etiqueta;
            opt.dataset.asistenciaId = item.asistenciaId || '';
            selectFecha.appendChild(opt);
        });

        if (fechaSugerida && diasInasistencia.some(d => d.fecha === fechaSugerida)) {
            selectFecha.value = fechaSugerida;
        } else {
            selectFecha.value = diasInasistencia[0].fecha;
        }

        if (form) {
            const selectedOpt = selectFecha.options[selectFecha.selectedIndex];
            form.dataset.asistenciaId = asistenciaId || selectedOpt?.dataset?.asistenciaId || '';
        }

        selectFecha.onchange = () => {
            if (form) {
                const optSel = selectFecha.options[selectFecha.selectedIndex];
                form.dataset.asistenciaId = optSel?.dataset?.asistenciaId || '';
            }
        };
    } catch (err) {
        console.error('❌ Error obteniendo días de inasistencia:', err);
        if (selectFecha) {
            selectFecha.innerHTML = '<option value="">Error al cargar días sin asistencia</option>';
        }
    }
}

function cerrarModalJustificacion() {
    const modal = document.getElementById('modalJustificacion');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    limpiarEvidenciaSeleccionada();
}

/**
 * Previsualiza el archivo de evidencia
 */
function handleSeleccionEvidencia(e) {
    const file = e.target.files[0];
    if (!file) {
        limpiarEvidenciaSeleccionada();
        return;
    }

    archivoEvidenciaSeleccionado = file;

    const previewBox = document.getElementById('evidenciaPreviewContainer');
    const previewImg = document.getElementById('evidenciaPreviewImg');
    const previewPdf = document.getElementById('evidenciaPreviewPdf');
    const pdfName = document.getElementById('evidenciaPdfName');

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (previewImg) {
                previewImg.src = event.target.result;
                previewImg.style.display = 'block';
            }
            if (previewPdf) previewPdf.style.display = 'none';
            if (previewBox) previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
        if (previewImg) previewImg.style.display = 'none';
        if (previewPdf) {
            if (pdfName) pdfName.textContent = file.name;
            previewPdf.style.display = 'inline-flex';
        }
        if (previewBox) previewBox.style.display = 'block';
    }
}

function limpiarEvidenciaSeleccionada() {
    archivoEvidenciaSeleccionado = null;
    const input = document.getElementById('justEvidencia');
    if (input) input.value = '';
    const previewBox = document.getElementById('evidenciaPreviewContainer');
    if (previewBox) previewBox.style.display = 'none';
    const previewImg = document.getElementById('evidenciaPreviewImg');
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    const previewPdf = document.getElementById('evidenciaPreviewPdf');
    if (previewPdf) previewPdf.style.display = 'none';
}

/**
 * Envío de la justificación
 */
async function handleEnviarJustificacion(e) {
    e.preventDefault();

    const form = e.target;
    const fechaInasistencia = document.getElementById('justFechaInasistencia')?.value;
    const motivo = document.getElementById('justMotivo')?.value?.trim();
    const asistenciaId = form.dataset.asistenciaId || null;

    if (!fechaInasistencia) {
        Swal.fire({ icon: 'warning', title: 'Fecha requerida', text: 'Indica la fecha de la inasistencia.', confirmButtonColor: '#1c1948' });
        return;
    }

    if (!motivo || motivo.length < 10) {
        Swal.fire({ icon: 'warning', title: 'Motivo requerido', text: 'Por favor detalla el motivo de tu inasistencia (mínimo 10 caracteres).', confirmButtonColor: '#1c1948' });
        return;
    }

    Swal.fire({
        title: 'Enviando justificación...',
        text: 'Subiendo evidencia y guardando solicitud...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const resultado = await justificacionService.enviarJustificacion({
            fechaInasistencia,
            motivo,
            archivoEvidencia: archivoEvidenciaSeleccionado,
            asistenciaId
        });

        if (resultado.success) {
            cerrarModalJustificacion();
            Swal.fire({
                icon: 'success',
                title: '¡Justificación enviada!',
                text: 'Tu solicitud de justificación ha sido registrada y está pendiente de revisión administrativa.',
                confirmButtonColor: '#1c1948'
            });
            await cargarHistorial();
            await cargarEstadoHoy();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo enviar la justificación',
                text: resultado.error,
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error al enviar',
            text: error.message,
            confirmButtonColor: '#1c1948'
        });
    }
}

/**
 * Consulta y muestra el detalle de una justificación existente
 */
async function verDetalleJustificacionModal(justificacionId) {
    try {
        Swal.fire({
            title: 'Cargando información...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const just = await justificacionService.getDetalleJustificacion(justificacionId);
        Swal.close();

        let badgeEstado = '<span class="rsi-badge rsi-badge-warning">Pendiente de Revisión</span>';
        if (just.estado === ESTADOS_JUSTIFICACION.APROBADA) {
            badgeEstado = '<span class="rsi-badge rsi-badge-success">Aprobada</span>';
        } else if (just.estado === ESTADOS_JUSTIFICACION.RECHAZADA) {
            badgeEstado = '<span class="rsi-badge rsi-badge-danger">Rechazada</span>';
        }

        let evidenciaHTML = '<p style="color: #6c757d; font-style: italic;">No se adjuntó archivo de comprobante.</p>';
        if (just.evidenciaUrl) {
            evidenciaHTML = `
                <div style="margin-top: 10px; text-align: center;">
                    <a href="${just.evidenciaUrl}" target="_blank" rel="noopener noreferrer" style="color: #1c1948; font-weight: 600; text-decoration: underline;">
                        <i class="fas fa-external-link-alt"></i> Ver comprobante adjunto
                    </a>
                </div>
            `;
        }

        const autorizadorNombre = just.autorizadoPor || just.revisadoPorNombre || 'Colaborador Autorizado';

        Swal.fire({
            title: `Justificación del ${just.fechaInasistencia}`,
            html: `
                <div style="text-align: left; font-size: 0.9rem; color: #495057;">
                    <div style="margin-bottom: 8px;"><strong>Estado actual:</strong> ${badgeEstado}</div>
                    <div style="margin-bottom: 8px;"><strong>Fecha de envío:</strong> ${new Date(just.fechaEnvio).toLocaleString('es-MX')}</div>
                    <div style="margin-bottom: 8px;"><strong>Motivo presentado:</strong></div>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6; margin-bottom: 12px;">
                        ${just.motivo}
                    </div>
                    ${just.fechaRevision ? `
                        <div style="margin-bottom: 8px; border-top: 1px solid #e9ecef; padding-top: 8px;">
                            <strong>Autorizado / Revisado por:</strong> ${autorizadorNombre} (${new Date(just.fechaRevision).toLocaleString('es-MX')})
                        </div>
                        <div style="margin-bottom: 8px;"><strong>Comentario del revisor:</strong></div>
                        <div style="background: #eef2f7; padding: 8px; border-radius: 6px; font-style: italic;">
                            ${just.comentarioRevision || 'Sin comentarios adicionales.'}
                        </div>
                    ` : ''}
                    ${evidenciaHTML}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948'
        });

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
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    eventListeners = [];
    archivoEvidenciaSeleccionado = null;
    estadoHoy = null;
    document.body.style.overflow = '';
}

export default asistenciaController;
