/* ========================================
   DASHBOARD CONTROLLER
   Controlador para el dashboard de partner
   ======================================== */

import NewCollaboratorService from '../../services/partnerService.js';

let service = null;
let eventListeners = [];
let currentUser = null;
let charts = {};
let Chart = null;

/**
 * Inicializa el controlador del dashboard
 */
export async function dashboardController() {
    console.log('📊 Dashboard Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new NewCollaboratorService();
    
    // Cargar Chart.js dinámicamente
    try {
        const chartModule = await import('chart.js/auto');
        Chart = chartModule.default || chartModule;
        console.log('✅ Chart.js cargado correctamente');
    } catch (error) {
        console.warn('⚠️ Chart.js no disponible, las gráficas no se mostrarán:', error.message);
    }
    
    loadUserData();
    initAttendance();
    initCharts();
    loadRecentTickets();
    initChartResize();
    
    console.log('✅ Dashboard Controller listo');
}

/**
 * Carga los datos del usuario desde localStorage
 */
function loadUserData() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (!session) {
            console.warn('⚠️ No hay sesión activa');
            return;
        }
        
        currentUser = JSON.parse(session);
        console.log('👤 Usuario cargado:', currentUser);
        
        // Actualizar perfil
        const avatar = document.getElementById('dashboardAvatar');
        const name = document.getElementById('dashboardName');
        const role = document.getElementById('dashboardRole');
        const email = document.getElementById('dashboardEmail');
        
        if (avatar && currentUser.fotoPerfil) {
            avatar.src = currentUser.fotoPerfil;
        }
        
        if (name) {
            name.textContent = currentUser.nombreCompleto || currentUser.displayName || 'Colaborador';
        }
        
        if (role) {
            const area = currentUser.areaNombre || currentUser.area || 'Sin área';
            const subarea = currentUser.subareaNombre || currentUser.subarea || '';
            role.textContent = subarea ? `${area} - ${subarea}` : area;
        }
        
        if (email) {
            email.textContent = currentUser.emailEmpresarial || currentUser.email || 'correo@empresa.com';
        }
        
    } catch (error) {
        console.error('❌ Error cargando datos del usuario:', error);
    }
}

/**
 * Inicializa el sistema de asistencia
 */
function initAttendance() {
    const attendanceBtn = document.getElementById('registerAttendanceBtn');
    const attendanceStatus = document.getElementById('attendanceStatus');
    
    if (!attendanceBtn || !attendanceStatus) return;
    
    // Verificar si ya hay asistencia registrada hoy
    const today = new Date().toISOString().split('T')[0];
    const attendanceKey = `attendance_${today}_${currentUser?.uid || 'anonymous'}`;
    const hasAttendance = localStorage.getItem(attendanceKey);
    
    if (hasAttendance) {
        attendanceStatus.innerHTML = `
            <span class="rsi-badge rsi-badge-success">
                <i class="fas fa-check-circle"></i> Asistencia registrada
            </span>
        `;
        attendanceBtn.disabled = true;
        attendanceBtn.innerHTML = '<i class="fas fa-check"></i> Asistencia completada';
        attendanceBtn.style.opacity = '0.6';
    }
    
    attendanceBtn.addEventListener('click', () => {
        // Registrar asistencia
        localStorage.setItem(attendanceKey, JSON.stringify({
            date: today,
            timestamp: new Date().toISOString(),
            uid: currentUser?.uid || 'anonymous'
        }));
        
        attendanceStatus.innerHTML = `
            <span class="rsi-badge rsi-badge-success">
                <i class="fas fa-check-circle"></i> Asistencia registrada
            </span>
        `;
        attendanceBtn.disabled = true;
        attendanceBtn.innerHTML = '<i class="fas fa-check"></i> Asistencia completada';
        attendanceBtn.style.opacity = '0.6';
        
        Swal.fire({
            icon: 'success',
            title: '¡Asistencia registrada!',
            text: 'Tu asistencia del día ha sido registrada correctamente.',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    });
}

/**
 * Inicializa las gráficas
 */
function initCharts() {
    // Si Chart.js no está disponible, mostrar mensaje
    if (!Chart) {
        const chartContainers = document.querySelectorAll('.rsi-chart-container');
        chartContainers.forEach(container => {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--rsi-gray-500);">
                    <div style="text-align: center;">
                        <i class="fas fa-chart-simple" style="font-size: 2rem; display: block; margin-bottom: var(--rsi-spacing-sm);"></i>
                        <p style="font-size: 0.9rem; margin: 0;">Gráfica no disponible</p>
                    </div>
                </div>
            `;
        });
        return;
    }
    
    // Simular datos para las gráficas
    const pieData = {
        labels: ['Pendientes', 'En Progreso', 'Completados', 'Cerrados'],
        datasets: [{
            data: [12, 8, 15, 5],
            backgroundColor: [
                '#ffc107',
                '#17a2b8',
                '#28a745',
                '#adb5bd'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };
    
    const barData = {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Creados',
                data: [5, 8, 12, 7, 15, 10],
                backgroundColor: 'rgba(28, 25, 72, 0.8)',
                borderColor: '#1c1948',
                borderWidth: 2,
                borderRadius: 4
            },
            {
                label: 'Completados',
                data: [3, 5, 8, 6, 10, 8],
                backgroundColor: 'rgba(40, 167, 69, 0.8)',
                borderColor: '#28a745',
                borderWidth: 2,
                borderRadius: 4
            }
        ]
    };
    
    const lineData = {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Tickets Asignados',
                data: [4, 6, 10, 8, 12, 9],
                borderColor: '#1c1948',
                backgroundColor: 'rgba(28, 25, 72, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#1c1948',
                pointRadius: 4
            },
            {
                label: 'Tickets Resueltos',
                data: [2, 4, 7, 6, 9, 7],
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#28a745',
                pointRadius: 4
            }
        ]
    };
    
    // Actualizar estadísticas
    document.getElementById('totalTickets').textContent = '40';
    document.getElementById('pendingTickets').textContent = '12';
    document.getElementById('inProgressTickets').textContent = '8';
    document.getElementById('completedTickets').textContent = '15';
    
    // Crear gráficas
    createPieChart('ticketsPieChart', pieData);
    createBarChart('ticketsBarChart', barData);
    createLineChart('performanceLineChart', lineData);
}

/**
 * Crea una gráfica de pastel
 */
function createPieChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
        charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    } catch (error) {
        console.error('❌ Error creando gráfica de pastel:', error);
    }
}

/**
 * Crea una gráfica de barras
 */
function createBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
        charts.bar = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ Error creando gráfica de barras:', error);
    }
}

/**
 * Crea una gráfica de líneas
 */
function createLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
        charts.line = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12,
                                family: "'Montserrat', sans-serif"
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
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
        console.error('❌ Error creando gráfica de líneas:', error);
    }
}

/**
 * Carga los tickets recientes
 */
function loadRecentTickets() {
    const container = document.getElementById('recentTickets');
    if (!container) return;
    
    // Datos simulados de tickets
    const tickets = [
        {
            id: 'TK-001',
            title: 'Problema con el acceso al sistema',
            description: 'No puedo iniciar sesión en el panel de administración, me aparece error de credenciales.',
            status: 'pending',
            priority: 'high',
            date: '2024-01-15',
            author: 'Usuario Demo'
        },
        {
            id: 'TK-002',
            title: 'Solicitud de nueva funcionalidad',
            description: 'Necesito un reporte de ventas que pueda exportar a Excel con filtros por fecha.',
            status: 'in-progress',
            priority: 'medium',
            date: '2024-01-14',
            author: 'Usuario Demo'
        },
        {
            id: 'TK-003',
            title: 'Error en el módulo de facturación',
            description: 'Al generar una factura, el sistema no calcula correctamente los impuestos.',
            status: 'pending',
            priority: 'urgent',
            date: '2024-01-13',
            author: 'Usuario Demo'
        },
        {
            id: 'TK-004',
            title: 'Mejora en la interfaz de usuario',
            description: 'La tabla de productos es difícil de leer, sugerimos mejorar el diseño.',
            status: 'completed',
            priority: 'low',
            date: '2024-01-12',
            author: 'Usuario Demo'
        }
    ];
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="rsi-tickets-empty">
                <i class="fas fa-ticket-alt"></i>
                <p>No hay tickets recientes</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => `
        <div class="rsi-ticket-card status-${ticket.status}">
            <div class="rsi-ticket-header">
                <h4 class="rsi-ticket-title">${ticket.title}</h4>
                <span class="rsi-ticket-id">${ticket.id}</span>
            </div>
            <div class="rsi-ticket-meta">
                <span><i class="far fa-calendar-alt"></i> ${formatDate(ticket.date)}</span>
                <span><i class="far fa-user"></i> ${ticket.author}</span>
            </div>
            <p class="rsi-ticket-description">${ticket.description}</p>
            <div class="rsi-ticket-footer">
                <span class="rsi-ticket-priority priority-${ticket.priority}">
                    ${getPriorityLabel(ticket.priority)}
                </span>
                <button class="rsi-btn-ticket-detail" data-id="${ticket.id}">
                    Ver detalle <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Event listeners para ver detalle
    container.querySelectorAll('.rsi-btn-ticket-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const ticketId = btn.dataset.id;
            handleViewTicket(ticketId);
        });
    });
}

/**
 * Formatea una fecha
 */
function formatDate(dateString) {
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
 * Obtiene la etiqueta de prioridad
 */
function getPriorityLabel(priority) {
    const labels = {
        low: '🟢 Baja',
        medium: '🟡 Media',
        high: '🔴 Alta',
        urgent: '🔴⚡ Urgente'
    };
    return labels[priority] || priority;
}

/**
 * Maneja la visualización de un ticket
 */
function handleViewTicket(ticketId) {
    Swal.fire({
        title: `Ticket ${ticketId}`,
        html: `
            <div style="text-align: left;">
                <p><strong>Título:</strong> Detalle del ticket</p>
                <p><strong>Estado:</strong> <span class="rsi-badge rsi-badge-warning">Pendiente</span></p>
                <p><strong>Prioridad:</strong> <span class="rsi-badge rsi-badge-danger">Alta</span></p>
                <hr>
                <p>Esta es una vista previa del detalle del ticket. La funcionalidad completa estará disponible próximamente.</p>
            </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#1c1948'
    });
}

/**
 * Maneja el redimensionamiento de gráficas
 */
function initChartResize() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            Object.values(charts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }, 250);
    });
}

/**
 * Limpia eventos
 */
export function destroyDashboardController() {
    console.log('🧹 Destroying DashboardController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    // Destruir gráficas
    Object.values(charts).forEach(chart => {
        if (chart && chart.destroy) {
            chart.destroy();
        }
    });
    charts = {};
    
    service = null;
    currentUser = null;
}

export default dashboardController;