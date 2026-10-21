/* ========================================
   DASHBOARD CONTROLLER
   Controlador operativo para el dashboard de partner / admin
   ======================================== */

import NewCollaboratorService from '../../services/partnerService.js';
import AsistenciaService from '../../services/asistenciaService.js';
import TicketService from '../../services/ticketService.js';
import AuthService from '../../services/authService.js';
import { ESTADOS_ASISTENCIA } from '../../models/asistenciaModel.js';
import ChecklistVehiculoService from '../../services/checklistVehiculoService.js';
import { ReembolsoService } from '../../services/reembolsoService.js';

let partnerService = null;
let asistenciaService = null;
let ticketService = null;
let authService = null;
let checklistService = null;
let reembolsoService = null;

let eventListeners = [];
let currentUser = null;
let estadoAsistenciaHoy = null;
let historialAsistencia = [];
let assignedTickets = [];
let activeTicketFilter = 'all';
let charts = {};
let Chart = null;

function addManagedListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

/**
 * Inicializa el controlador del dashboard
 */
export async function dashboardController() {
    console.log('Inicializando Dashboard Controller...');

    destroyDashboardController();

    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    partnerService = new NewCollaboratorService();
    asistenciaService = new AsistenciaService();
    ticketService = new TicketService();
    authService = new AuthService();
    checklistService = new ChecklistVehiculoService();
    reembolsoService = new ReembolsoService();

    // Cargar Chart.js dinámicamente
    try {
        const chartModule = await import('chart.js/auto');
        Chart = chartModule.default || chartModule;
    } catch (error) {
        console.warn('Chart.js no disponible:', error.message);
    }

    bindDashboardEvents();
    await loadAllDashboardData(false);

    // Limpiar recursos automáticamente al salir de la vista
    const onRouteChanging = (e) => {
        if (e.detail && e.detail.path !== '/partner/dashboard') {
            destroyDashboardController();
        }
    };
    addManagedListener(document, 'route:changing', onRouteChanging);

    console.log('Dashboard Controller listo');
}

/**
 * Registra los eventos de interacción del dashboard
 */
function bindDashboardEvents() {
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) {
        addManagedListener(refreshBtn, 'click', async () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            refreshBtn.disabled = true;
            try {
                await loadAllDashboardData(true);
            } finally {
                if (icon) icon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
            }
        });
    }

    const attendanceBtn = document.getElementById('registerAttendanceBtn');
    if (attendanceBtn) {
        addManagedListener(attendanceBtn, 'click', handleAttendanceAction);
    }

    const filterContainer = document.getElementById('dashboardTicketFilters');
    if (filterContainer) {
        const buttons = filterContainer.querySelectorAll('.rsi-ticket-filter-btn');
        buttons.forEach(btn => {
            addManagedListener(btn, 'click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTicketFilter = btn.dataset.filter || 'all';
                renderTicketsGrid();
            });
        });
    }

    // Escuchar actualizaciones de asistencia disparadas desde el navbar u otros componentes
    const onAsistenciaUpdated = async () => {
        await loadAttendanceData();
        renderCharts();
    };
    addManagedListener(document, 'asistencia:updated', onAsistenciaUpdated);

    // Escuchar cambio de tema claro/oscuro para repintar las gráficas con contraste adecuado
    const onThemeChanged = () => {
        renderCharts();
    };
    addManagedListener(document, 'theme:changed', onThemeChanged);
    addManagedListener(window, 'themeChanged', onThemeChanged);

    initChartResize();
}

/**
 * Carga todos los bloques de datos reales del dashboard en paralelo
 */
async function loadAllDashboardData(forceRefresh = false) {
    await loadUserData(forceRefresh);
    await Promise.all([
        loadAttendanceData(),
        loadTicketsData(forceRefresh)
    ]);
    renderCharts();
}

/**
 * 1. Carga los datos reales del perfil del colaborador autenticado
 */
async function loadUserData(forceRefresh = false) {
    try {
        const session = authService.getSession();
        if (!session || !session.uid) {
            console.warn('No hay sesión activa en el dashboard');
            return;
        }

        currentUser = { ...session };

        // Consultar perfil actualizado desde PartnerService para reflejar cambios recientes
        try {
            const freshProfile = await partnerService.getCollaboratorById(session.uid, forceRefresh);
            if (freshProfile) {
                currentUser = {
                    ...currentUser,
                    ...freshProfile,
                    uid: session.uid
                };
            }
        } catch (profileErr) {
            console.warn('Usando datos de sesión local para el perfil:', profileErr.message);
        }

        const avatar = document.getElementById('dashboardAvatar');
        const name = document.getElementById('dashboardName');
        const roleBadge = document.getElementById('dashboardRoleBadge');
        const role = document.getElementById('dashboardRole');
        const email = document.getElementById('dashboardEmail');
        const currentDateEl = document.getElementById('dashboardCurrentDate');
        const profileStatus = document.getElementById('profileStatus');

        if (avatar) {
            const foto = currentUser.fotoPerfil;
            if (foto && (foto.startsWith('http') || foto.startsWith('/') || foto.startsWith('data:image'))) {
                avatar.src = foto;
            } else {
                avatar.src = '/assets/images/default-avatar.png';
            }
        }

        if (name) {
            name.textContent = currentUser.nombreCompleto || currentUser.displayName || 'Colaborador RSI';
        }

        if (roleBadge) {
            roleBadge.textContent = currentUser.rol === 'admin' ? 'Administrador' : (currentUser.tipoColaborador || 'Partner');
        }

        if (role) {
            const area = currentUser.areaNombre || currentUser.area || 'Operaciones';
            const subarea = currentUser.subareaNombre || currentUser.subarea || '';
            const roleText = subarea ? `${area} — ${subarea}` : area;
            role.innerHTML = `<i class="fas fa-sitemap"></i> <span>${escapeHtml(roleText)}</span>`;
        }

        if (email) {
            const mailText = currentUser.emailEmpresarial || currentUser.email || 'Sin correo';
            email.innerHTML = `<i class="fas fa-envelope"></i> <span>${escapeHtml(mailText)}</span>`;
        }

        if (currentDateEl) {
            const fechaFormateada = new Intl.DateTimeFormat('es-MX', {
                timeZone: 'America/Mexico_City',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(new Date());
            currentDateEl.textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        }

        if (profileStatus) {
            const isActive = currentUser.status !== 'inactive' && currentUser.activo !== false;
            profileStatus.innerHTML = isActive
                ? '<i class="fas fa-circle"></i> Activo'
                : '<i class="fas fa-circle"></i> Inactivo';
        }
    } catch (error) {
        console.error('Error cargando datos del usuario en dashboard:', error);
    }
}

/**
 * 2. Carga el estado real de asistencia de hoy y el historial de 60 días desde AsistenciaService
 */
async function loadAttendanceData() {
    const attendanceBtn = document.getElementById('registerAttendanceBtn');
    const attendanceStatus = document.getElementById('attendanceStatus');
    const entryTimeEl = document.getElementById('attendanceEntryTime');
    const exitTimeEl = document.getElementById('attendanceExitTime');
    const punctualityEl = document.getElementById('punctualityRate');

    if (!attendanceStatus) return;

    try {
        const [estadoHoy, historial] = await Promise.all([
            asistenciaService.getEstadoHoy(),
            asistenciaService.getMiHistorial(60).catch(() => [])
        ]);

        estadoAsistenciaHoy = estadoHoy;
        historialAsistencia = Array.isArray(historial) ? historial : [];

        const {
            asistencia,
            haRegistradoEntrada,
            haRegistradoSalida
        } = estadoHoy;

        // Actualizar horarios de entrada y salida
        if (entryTimeEl) {
            entryTimeEl.textContent = haRegistradoEntrada && asistencia?.horaEntrada
                ? `${asistencia.horaEntrada} hrs`
                : '--:--';
        }

        if (exitTimeEl) {
            if (haRegistradoSalida && asistencia?.horaSalida) {
                exitTimeEl.textContent = `${asistencia.horaSalida} hrs`;
            } else if (haRegistradoEntrada) {
                exitTimeEl.textContent = 'En curso';
            } else {
                exitTimeEl.textContent = '--:--';
            }
        }

        // Calcular tasa de puntualidad en los últimos 30 registros
        if (punctualityEl) {
            const ultimos30 = historialAsistencia.slice(0, 30);
            const conEntrada = ultimos30.filter(r => r.horaEntrada);
            if (conEntrada.length > 0) {
                const puntuales = conEntrada.filter(r => r.estado === ESTADOS_ASISTENCIA.PUNTUAL).length;
                const porcentaje = Math.round((puntuales / conEntrada.length) * 100);
                punctualityEl.textContent = `${porcentaje}% (${conEntrada.length} días)`;
            } else {
                punctualityEl.textContent = 'Sin historial previo';
            }
        }

        // Actualizar badge de estado y botón de acción según el estado real del día
        if (!haRegistradoEntrada) {
            if (asistencia && asistencia.estado === ESTADOS_ASISTENCIA.INASISTENCIA) {
                attendanceStatus.innerHTML = `
                    <span class="rsi-badge rsi-badge-danger">
                        <i class="fas fa-exclamation-circle"></i> Inasistencia registrada
                    </span>
                `;
            } else {
                attendanceStatus.innerHTML = `
                    <span class="rsi-badge rsi-badge-warning">
                        <i class="fas fa-clock"></i> Entrada pendiente
                    </span>
                `;
            }

            if (attendanceBtn) {
                attendanceBtn.disabled = false;
                attendanceBtn.dataset.action = 'entrada';
                attendanceBtn.className = 'rsi-btn-attendance';
                attendanceBtn.innerHTML = '<i class="fas fa-fingerprint"></i> Registrar Entrada';
            }
        } else if (haRegistradoEntrada && !haRegistradoSalida) {
            const esRetardo = asistencia.estado === ESTADOS_ASISTENCIA.RETARDO;
            attendanceStatus.innerHTML = esRetardo
                ? `<span class="rsi-badge rsi-badge-warning">
                       <i class="fas fa-exclamation-triangle"></i> En jornada (Retardo +${asistencia.minutosRetardo || 0}m)
                   </span>`
                : `<span class="rsi-badge rsi-badge-success">
                       <i class="fas fa-check-circle"></i> En jornada activa (Puntual)
                   </span>`;

            if (attendanceBtn) {
                attendanceBtn.disabled = false;
                attendanceBtn.dataset.action = 'salida';
                attendanceBtn.className = 'rsi-btn-attendance rsi-btn-attendance-exit';
                attendanceBtn.innerHTML = '<i class="fas fa-door-open"></i> Terminar Asistencia (Salida)';
            }
        } else {
            attendanceStatus.innerHTML = `
                <span class="rsi-badge rsi-badge-primary">
                    <i class="fas fa-flag-checkered"></i> Jornada Concluida
                </span>
            `;

            if (attendanceBtn) {
                attendanceBtn.disabled = true;
                attendanceBtn.dataset.action = 'completada';
                attendanceBtn.className = 'rsi-btn-attendance rsi-btn-disabled';
                attendanceBtn.innerHTML = '<i class="fas fa-check-double"></i> Asistencia Completada Hoy';
            }
        }
    } catch (error) {
        console.error('Error cargando estado de asistencia en dashboard:', error);
        attendanceStatus.innerHTML = `
            <span class="rsi-badge rsi-badge-secondary">
                <i class="fas fa-info-circle"></i> Sin conexión de asistencia
            </span>
        `;
    }
}

/**
 * Maneja el botón de Registrar Entrada / Terminar Asistencia (Salida) desde el Dashboard
 * Reutiliza íntegramente las validaciones de geolocalización y biometría de AsistenciaService
 */
async function handleAttendanceAction() {
    const attendanceBtn = document.getElementById('registerAttendanceBtn');
    if (!attendanceBtn || attendanceBtn.disabled) return;

    const action = attendanceBtn.dataset.action || 'entrada';

    if (action === 'entrada') {
        const confirmacion = await Swal.fire({
            title: '¿Registrar Entrada de Jornada?',
            html: `
                <div style="text-align: left; font-size: 0.92rem;">
                    <p>Al confirmar, el sistema validará:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li><strong>Ubicación geográfica:</strong> Coordenadas actuales del dispositivo.</li>
                        <li><strong>Verificación biométrica:</strong> Huella o autenticador seguro (si está disponible).</li>
                    </ul>
                    <p style="margin-bottom: 0;">¿Deseas registrar tu entrada ahora?</p>
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
            text: 'Validando ubicación y dispositivo...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const resultado = await asistenciaService.registrarEntrada();
            if (resultado.success) {
                await Swal.fire({
                    icon: resultado.clasificacion?.estado === ESTADOS_ASISTENCIA.RETARDO ? 'warning' : 'success',
                    title: resultado.clasificacion?.estado === ESTADOS_ASISTENCIA.RETARDO
                        ? 'Entrada con Retardo Registrada'
                        : 'Entrada Puntual Registrada',
                    text: resultado.mensaje,
                    confirmButtonColor: '#1c1948'
                });
                await loadAttendanceData();
                renderCharts();
                document.dispatchEvent(new CustomEvent('asistencia:updated', { detail: { tipo: 'entrada' } }));
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo registrar la entrada',
                    text: resultado.error || 'Ocurrió un error al procesar el registro.',
                    confirmButtonColor: '#1c1948'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Error al registrar la entrada.',
                confirmButtonColor: '#1c1948'
            });
        }
    } else if (action === 'salida') {
        const confirmacion = await Swal.fire({
            title: '¿Terminar Asistencia de Hoy?',
            text: 'Se registrará la hora y ubicación de salida de tu jornada laboral.',
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
            const resultado = await asistenciaService.registrarSalida();
            if (resultado.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Salida Registrada',
                    text: resultado.mensaje,
                    confirmButtonColor: '#1c1948'
                });
                await loadAttendanceData();
                renderCharts();
                document.dispatchEvent(new CustomEvent('asistencia:updated', { detail: { tipo: 'salida' } }));
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo registrar la salida',
                    text: resultado.error || 'Ocurrió un error al procesar la salida.',
                    confirmButtonColor: '#1c1948'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Error al registrar la salida.',
                confirmButtonColor: '#1c1948'
            });
        }
    }
}

/**
 * 3. Carga exclusivamente los tickets propios asignados al colaborador desde TicketService
 */
async function loadTicketsData(forceRefresh = false) {
    const container = document.getElementById('recentTickets');
    const sectionTitle = document.getElementById('ticketsSectionTitle');
    const sectionSubtitle = document.getElementById('ticketsSectionSubtitle');

    if (container) {
        container.innerHTML = `
            <div class="rsi-tickets-empty">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Consultando tus tickets asignados...</p>
            </div>
        `;
    }

    try {
        const userContext = currentUser || authService.getSession();
        const uid = userContext?.uid || userContext?.id;
        if (!uid) {
            assignedTickets = [];
            updateTicketStats();
            renderTicketsGrid();
            return;
        }

        // Consultar únicamente los tickets propios asignados al colaborador autenticado
        const tickets = await ticketService.getTicketsByColaborador(userContext, forceRefresh);

        if (sectionTitle) {
            sectionTitle.innerHTML = '<i class="fas fa-ticket-alt"></i> Mis Tickets Asignados';
        }
        if (sectionSubtitle) {
            sectionSubtitle.textContent = 'Tickets donde participas como responsable principal o personal de apoyo.';
        }

        assignedTickets = Array.isArray(tickets) ? tickets : [];
        updateTicketStats();
        renderTicketsGrid();
    } catch (error) {
        console.error('Error cargando tickets en el dashboard:', error);
        assignedTickets = [];
        updateTicketStats();
        renderTicketsGrid();
    }
}

/**
 * Actualiza los contadores de estadísticas de tickets con datos reales
 */
function updateTicketStats() {
    const total = assignedTickets.length;
    const pending = assignedTickets.filter(t => t.estado === 'abierto' || t.estado === 'pendiente').length;
    const inProgress = assignedTickets.filter(t => t.estado === 'en_proceso').length;
    const completed = assignedTickets.filter(t => t.estado === 'finalizado' || t.estado === 'resuelto' || t.estado === 'cerrado').length;

    const totalEl = document.getElementById('totalTickets');
    const pendingEl = document.getElementById('pendingTickets');
    const inProgressEl = document.getElementById('inProgressTickets');
    const completedEl = document.getElementById('completedTickets');

    if (totalEl) totalEl.textContent = String(total);
    if (pendingEl) pendingEl.textContent = String(pending);
    if (inProgressEl) inProgressEl.textContent = String(inProgress);
    if (completedEl) completedEl.textContent = String(completed);
}

/**
 * Renderiza el listado de tickets propios filtrados según la pestaña activa
 */
function renderTicketsGrid() {
    const container = document.getElementById('recentTickets');
    if (!container) return;

    let filtered = assignedTickets;
    if (activeTicketFilter === 'pending') {
        filtered = assignedTickets.filter(t => t.estado === 'abierto' || t.estado === 'pendiente');
    } else if (activeTicketFilter === 'in_progress') {
        filtered = assignedTickets.filter(t => t.estado === 'en_proceso');
    } else if (activeTicketFilter === 'completed') {
        filtered = assignedTickets.filter(t => t.estado === 'finalizado' || t.estado === 'resuelto' || t.estado === 'cerrado');
    }

    if (filtered.length === 0) {
        const emptyMsg = assignedTickets.length === 0
            ? 'No tienes tickets asignados en este momento.'
            : 'No hay tickets tuyos que coincidan con el filtro seleccionado.';
        container.innerHTML = `
            <div class="rsi-tickets-empty">
                <i class="fas fa-clipboard-list"></i>
                <h4>Sin tickets para mostrar</h4>
                <p>${escapeHtml(emptyMsg)}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.slice(0, 12).map(ticket => {
        const statusCss = mapStatusClass(ticket.estado);
        const statusBadge = getStatusBadgeHtml(ticket.estado);
        const priorityClass = mapPriorityClass(ticket.prioridad);
        const priorityHtml = getPriorityLabel(ticket.prioridad);
        const folio = ticket.idTicket || ticket.id;
        const titulo = ticket.titulo || ticket.tipoServicioNombre || 'Servicio de Soporte Técnico';
        const cliente = ticket.clienteNombre || (ticket.tipo === 'administracion' ? 'Administración Interna' : 'Cliente no especificado');
        const ubicacion = ticket.ubicacionServicio || ticket.area || '';
        const descripcion = ticket.descripcion || ticket.descripcionProblema || 'Sin descripción registrada.';
        const fechaCreacion = formatDate(ticket.fechaCreacion || ticket.createdAt);
        const rawFechaProg = ticket.fechaFin || ticket.fechaFinalizacionEstimada || ticket.fechaProgramada;
        const fechaProg = rawFechaProg ? formatDate(rawFechaProg) : null;

        return `
            <article class="rsi-ticket-card status-${statusCss}">
                <div class="rsi-ticket-header">
                    <div class="rsi-ticket-title-group">
                        <span class="rsi-ticket-id">${escapeHtml(folio)}</span>
                        <h4 class="rsi-ticket-title">${escapeHtml(titulo)}</h4>
                    </div>
                    ${statusBadge}
                </div>

                <div class="rsi-ticket-meta">
                    <span title="Cliente"><i class="fas fa-building"></i> ${escapeHtml(cliente)}</span>
                    <span title="Fecha de creación"><i class="far fa-calendar-alt"></i> ${escapeHtml(fechaCreacion)}</span>
                    ${fechaProg ? `<span title="Fecha límite / programada"><i class="far fa-clock"></i> Fin: ${escapeHtml(fechaProg)}</span>` : ''}
                    ${ubicacion ? `<span title="Área / Ubicación"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(ubicacion)}</span>` : ''}
                </div>

                <p class="rsi-ticket-description">${escapeHtml(descripcion)}</p>

                <div class="rsi-ticket-footer">
                    <span class="rsi-ticket-priority priority-${priorityClass}">
                        ${priorityHtml}
                    </span>
                    <button type="button" class="rsi-btn-ticket-detail" data-id="${escapeHtml(ticket.id)}">
                        <span>${ticket.estado === 'finalizado' || ticket.estado === 'cancelado' ? 'Ver Atención' : 'Atender Ticket'}</span> <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </article>
        `;
    }).join('');

    container.querySelectorAll('.rsi-btn-ticket-detail').forEach(btn => {
        addManagedListener(btn, 'click', () => {
            const ticketId = btn.dataset.id;
            handleViewTicket(ticketId);
        });
    });
}

/**
 * 4. Construye y actualiza las 3 gráficas con datos reales de tickets y asistencias
 */
function renderCharts() {
    // Destruir instancias previas antes de recrear
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};

    if (!Chart) {
        const chartContainers = document.querySelectorAll('.rsi-chart-container');
        chartContainers.forEach(container => {
            container.innerHTML = `
                <div class="rsi-chart-empty-fallback">
                    <i class="fas fa-chart-bar"></i>
                    <p>Visualización gráfica no disponible</p>
                </div>
            `;
        });
        return;
    }

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e8e8f0' : '#343a40';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const primaryBarColor = isDark ? 'rgba(74, 158, 255, 0.85)' : 'rgba(28, 25, 72, 0.85)';
    const primaryBorderColor = isDark ? '#4a9eff' : '#1c1948';

    // --- 4.1 Gráfica de Distribución por Estado (Doughnut) ---
    const abiertosCount = assignedTickets.filter(t => t.estado === 'abierto' || t.estado === 'pendiente').length;
    const enProcesoCount = assignedTickets.filter(t => t.estado === 'en_proceso').length;
    const resueltosCount = assignedTickets.filter(t => t.estado === 'finalizado' || t.estado === 'resuelto').length;
    const cerradosCount = assignedTickets.filter(t => t.estado === 'cerrado' || t.estado === 'cancelado').length;
    const totalCount = abiertosCount + enProcesoCount + resueltosCount + cerradosCount;

    const pieData = totalCount > 0
        ? {
            labels: ['Abiertos / Pend.', 'En Proceso', 'Finalizados', 'Cancelados / Cerr.'],
            datasets: [{
                data: [abiertosCount, enProcesoCount, resueltosCount, cerradosCount],
                backgroundColor: ['#ffc107', '#17a2b8', '#28a745', '#6c757d'],
                borderWidth: 2,
                borderColor: isDark ? '#2a2a35' : '#ffffff'
            }]
        }
        : {
            labels: ['Sin tickets registrados'],
            datasets: [{
                data: [1],
                backgroundColor: [isDark ? '#3d3e4a' : '#e9ecef'],
                borderWidth: 0
            }]
        };

    createPieChart('ticketsPieChart', pieData, textColor, totalCount === 0);

    // --- 4.2 y 4.3 Series de los últimos 6 meses (Tickets y Asistencias) ---
    const monthsInfo = getLastMonths(6);
    const assignedByMonth = new Array(monthsInfo.length).fill(0);
    const resolvedByMonth = new Array(monthsInfo.length).fill(0);
    const attendanceByMonth = new Array(monthsInfo.length).fill(0);

    assignedTickets.forEach(ticket => {
        const rawDate = ticket.fechaCreacion || ticket.createdAt;
        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const idx = monthsInfo.findIndex(m => m.key === key);
                if (idx !== -1) {
                    assignedByMonth[idx]++;
                    if (ticket.estado === 'finalizado' || ticket.estado === 'resuelto' || ticket.estado === 'cerrado') {
                        resolvedByMonth[idx]++;
                    }
                }
            }
        }
    });

    historialAsistencia.forEach(reg => {
        if (reg.fecha && reg.horaEntrada) {
            const key = reg.fecha.substring(0, 7); // YYYY-MM
            const idx = monthsInfo.findIndex(m => m.key === key);
            if (idx !== -1) {
                attendanceByMonth[idx]++;
            }
        }
    });

    const barData = {
        labels: monthsInfo.map(m => m.label),
        datasets: [
            {
                label: 'Asignados',
                data: assignedByMonth,
                backgroundColor: primaryBarColor,
                borderColor: primaryBorderColor,
                borderWidth: 1.5,
                borderRadius: 4
            },
            {
                label: 'Resueltos',
                data: resolvedByMonth,
                backgroundColor: 'rgba(40, 167, 69, 0.85)',
                borderColor: '#28a745',
                borderWidth: 1.5,
                borderRadius: 4
            }
        ]
    };

    const lineData = {
        labels: monthsInfo.map(m => m.label),
        datasets: [
            {
                label: 'Asistencias',
                data: attendanceByMonth,
                borderColor: primaryBorderColor,
                backgroundColor: isDark ? 'rgba(74, 158, 255, 0.15)' : 'rgba(28, 25, 72, 0.12)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: primaryBorderColor,
                pointRadius: 4
            },
            {
                label: 'Tickets Resueltos',
                data: resolvedByMonth,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.12)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#28a745',
                pointRadius: 4
            }
        ]
    };

    createBarChart('ticketsBarChart', barData, textColor, gridColor);
    createLineChart('performanceLineChart', lineData, textColor, gridColor);
}

/**
 * Obtiene los últimos N meses en formato { key: 'YYYY-MM', label: 'Mes' }
 */
function getLastMonths(count = 6) {
    const monthsNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const result = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        result.push({
            key,
            label: monthsNames[d.getMonth()]
        });
    }
    return result;
}

function createPieChart(canvasId, data, textColor, isEmpty) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        enabled: !isEmpty
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 11,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                cutout: '62%'
            }
        });
    } catch (error) {
        console.error('Error creando gráfica de pastel:', error);
    }
}

function createBarChart(canvasId, data, textColor, gridColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        charts.bar = new Chart(ctx, {
            type: 'bar',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 11,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            precision: 0
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creando gráfica de barras:', error);
    }
}

function createLineChart(canvasId, data, textColor, gridColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        charts.line = new Chart(ctx, {
            type: 'line',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 11,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            precision: 0
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    } catch (error) {
        console.error('Error creando gráfica de líneas:', error);
    }
}

/**
 * Mapea el estado real del ticket a la clase CSS del borde de tarjeta
 */
function mapStatusClass(estado) {
    const map = {
        abierto: 'pending',
        pendiente: 'pending',
        en_proceso: 'in-progress',
        finalizado: 'completed',
        resuelto: 'completed',
        cerrado: 'closed',
        cancelado: 'closed'
    };
    return map[estado] || 'pending';
}

/**
 * Devuelve el badge HTML del estado del ticket
 */
function getStatusBadgeHtml(estado) {
    const badges = {
        abierto: '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-folder-open"></i> Abierto</span>',
        pendiente: '<span class="rsi-badge rsi-badge-warning"><i class="fas fa-clock"></i> Pendiente</span>',
        en_proceso: '<span class="rsi-badge rsi-badge-info"><i class="fas fa-tools"></i> En Proceso</span>',
        finalizado: '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Finalizado</span>',
        resuelto: '<span class="rsi-badge rsi-badge-success"><i class="fas fa-check-circle"></i> Resuelto</span>',
        cerrado: '<span class="rsi-badge rsi-badge-secondary"><i class="fas fa-lock"></i> Cerrado</span>',
        cancelado: '<span class="rsi-badge rsi-badge-danger"><i class="fas fa-ban"></i> Cancelado</span>'
    };
    return badges[estado] || `<span class="rsi-badge rsi-badge-secondary">${escapeHtml(estado || 'Abierto')}</span>`;
}

/**
 * Mapea la prioridad real del ticket a la clase CSS
 */
function mapPriorityClass(prioridad) {
    const map = {
        baja: 'low',
        low: 'low',
        media: 'medium',
        medium: 'medium',
        alta: 'high',
        high: 'high',
        critica: 'urgent',
        urgente: 'urgent',
        urgent: 'urgent'
    };
    return map[prioridad] || 'medium';
}

/**
 * Obtiene la etiqueta de prioridad usando iconos FontAwesome (sin emojis)
 */
function getPriorityLabel(priority) {
    const labels = {
        baja: '<i class="fas fa-arrow-down"></i> Prioridad Baja',
        low: '<i class="fas fa-arrow-down"></i> Prioridad Baja',
        media: '<i class="fas fa-minus"></i> Prioridad Media',
        medium: '<i class="fas fa-minus"></i> Prioridad Media',
        alta: '<i class="fas fa-arrow-up"></i> Prioridad Alta',
        high: '<i class="fas fa-arrow-up"></i> Prioridad Alta',
        critica: '<i class="fas fa-exclamation-triangle"></i> Prioridad Crítica',
        urgente: '<i class="fas fa-exclamation-triangle"></i> Prioridad Urgente',
        urgent: '<i class="fas fa-exclamation-triangle"></i> Prioridad Urgente'
    };
    return labels[priority] || '<i class="fas fa-minus"></i> Prioridad Media';
}

/**
 * Formatea una fecha ISO a formato legible es-MX
 */
function formatDate(dateString) {
    if (!dateString) return 'Sin fecha';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return String(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return String(dateString);
    }
}

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
 * Navega a la vista operativa de aceptación, atención y cierre del ticket (/partner/ticketAtencion?id=...)
 */
function handleViewTicket(ticketId) {
    if (!ticketId) return;
    const targetUrl = `/partner/ticketAtencion?id=${encodeURIComponent(ticketId)}`;
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(targetUrl);
    } else {
        window.location.href = targetUrl;
    }
}

/**
 * Maneja el redimensionamiento responsivo de las gráficas
 */
function initChartResize() {
    let resizeTimeout;
    const onResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            Object.values(charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }, 200);
    };
    addManagedListener(window, 'resize', onResize);
}

/**
 * Limpia eventos e instancias de Chart.js
 */
export 
/**
 * Carga métricas y estados en tiempo real para las tarjetas de Operaciones del Colaborador
 */
async function loadOperationsHubData(forceRefresh = false) {
    try {
        // 1. Estado de Asistencia Propia
        const cardAsistencia = document.getElementById('opsCardAsistenciaStatus');
        if (cardAsistencia && estadoAsistenciaHoy) {
            if (!estadoAsistenciaHoy.haRegistradoEntrada) {
                cardAsistencia.innerHTML = '<span style="color: #ef4444; font-weight: 600;"><i class="fas fa-exclamation-circle"></i> Entrada pendiente de registrar</span>';
            } else if (estadoAsistenciaHoy.haRegistradoSalida) {
                cardAsistencia.innerHTML = '<span style="color: #10b981; font-weight: 600;"><i class="fas fa-check-circle"></i> Jornada completada</span>';
            } else {
                const entrada = estadoAsistenciaHoy.asistencia?.horaEntrada || '';
                cardAsistencia.innerHTML = `<span style="color: #22c55e; font-weight: 600;"><i class="fas fa-circle"></i> Jornada activa (${entrada} hrs)</span>`;
            }
        }

        // 2. Estado de Checklists y Firmas Propias
        const cardChecklists = document.getElementById('opsCardChecklistsCount');
        if (cardChecklists && checklistService) {
            try {
                const salidas = await checklistService.getMisSalidasVehiculares(forceRefresh);
                const pendientesFirma = Array.isArray(salidas)
                    ? salidas.filter(s => s.estado === 'pendiente_aceptacion' || s.estado === 'pendiente')
                    : [];

                if (pendientesFirma.length > 0) {
                    cardChecklists.innerHTML = `<span style="color: #d97706; font-weight: 700;"><i class="fas fa-pen-nib"></i> ${pendientesFirma.length} salida(s) por firmar</span>`;
                } else if (salidas.length > 0) {
                    cardChecklists.innerHTML = `<span style="color: #10b981; font-weight: 600;"><i class="fas fa-check"></i> ${salidas.length} salidas (al día)</span>`;
                } else {
                    cardChecklists.textContent = 'Sin salidas vehiculares registradas';
                }
            } catch (checklistErr) {
                console.warn('Error consultando salidas vehiculares para hub:', checklistErr.message);
            }
        }

        // 3. Estado de Reembolsos
        const cardReembolsos = document.getElementById('opsCardReembolsosStatus');
        if (cardReembolsos && reembolsoService) {
            try {
                const dataReembolsos = await reembolsoService.getReembolsosColaborador({ forceRefresh });
                const metricas = dataReembolsos?.metricas;
                if (metricas && metricas.pendientes > 0) {
                    cardReembolsos.innerHTML = `<span style="color: #3b82f6; font-weight: 600;"><i class="fas fa-hourglass-half"></i> ${metricas.pendientes} solicitud(es) en revisión</span>`;
                } else if (metricas && metricas.totalMes > 0) {
                    cardReembolsos.innerHTML = `<span style="color: #10b981; font-weight: 600;"><i class="fas fa-check-double"></i> ${metricas.aprobados} aprobados este mes</span>`;
                } else {
                    cardReembolsos.textContent = 'Sin solicitudes este mes';
                }
            } catch (reembolsoErr) {
                console.warn('Error consultando reembolsos para hub:', reembolsoErr.message);
            }
        }
    } catch (hubErr) {
        console.warn('Error en loadOperationsHubData:', hubErr);
    }
}

function destroyDashboardController() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        if (element) {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                // Ignorar
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
}

export default dashboardController;