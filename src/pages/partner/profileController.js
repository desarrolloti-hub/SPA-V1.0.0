// src/pages/partner/profileController.js
/* ========================================
   PROFILE CONTROLLER
   Controlador para la vista de perfil
   ======================================== */

import NotificationService from '../../services/notificationService.js';

let notificationService = null;
let _notificationStatus = null;
let _userData = null;
let _isLoading = false;
let _currentTab = 'personal';
let _isInitialized = false;

/**
 * Obtiene el usuario desde localStorage
 */
function _getUserFromStorage() {
    try {
        const session = localStorage.getItem('rsi_session');
        if (!session) return null;
        return JSON.parse(session);
    } catch (error) {
        console.error('❌ Error obteniendo usuario:', error);
        return null;
    }
}

/**
 * Setea el texto de un elemento
 */
function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    } else {
        console.warn(`⚠️ Elemento con ID '${id}' no encontrado`);
    }
}

/**
 * Setea el estado de un toggle
 */
function _setToggle(id, checked) {
    const el = document.getElementById(id);
    if (el) {
        el.checked = checked;
    }
}

/**
 * Muestra un toast
 */
function _showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            max-width: 400px;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Muestra un error
 */
function _showError(message) {
    console.error('❌', message);
    const container = document.getElementById('profile-container');
    if (container) {
        container.innerHTML = `
            <div class="rsi-error-state" style="padding: 40px; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336;"></i>
                <h3 style="margin: 20px 0 10px;">⚠️ ${message}</h3>
                <p style="color: var(--rsi-gray-500);">Por favor, inicia sesión nuevamente.</p>
                <button onclick="window.navigateTo('/login')" class="rsi-btn rsi-btn-primary" style="margin-top: 20px;">
                    Ir a Login
                </button>
            </div>
        `;
    }
}

/**
 * Setea el estado de carga
 */
function _setLoading(loading) {
    _isLoading = loading;
    const btns = document.querySelectorAll('.rsi-profile-actions button, .rsi-permission-card button');
    btns.forEach(btn => {
        btn.disabled = loading;
        btn.style.opacity = loading ? '0.6' : '1';
    });
}

/**
 * Carga los datos del usuario en el HTML
 */
function _loadUserData() {
    const user = _userData;
    
    // Avatar
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    
    if (avatarImg && avatarPlaceholder) {
        if (user.fotoPerfil) {
            avatarImg.src = user.fotoPerfil;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
            avatarPlaceholder.textContent = user.nombreCompleto?.charAt(0) || 'U';
        }
    }
    
    // Información básica
    _setText('profile-name', user.nombreCompleto || 'Usuario');
    _setText('profile-email', user.emailEmpresarial || user.email || '');
    _setText('profile-role', user.rol || 'Colaborador');
    _setText('profile-area-tag', user.areaNombre || user.area || 'Sin área');
    
    // Status badge
    const statusBadge = document.getElementById('profile-status-badge');
    if (statusBadge) {
        if (user.status === 'active') {
            statusBadge.className = 'rsi-avatar-status rsi-status-active';
            statusBadge.textContent = '● Activo';
        } else {
            statusBadge.className = 'rsi-avatar-status rsi-status-inactive';
            statusBadge.textContent = '● Inactivo';
        }
    }
    
    // Información Personal
    _setText('info-nombreCompleto', user.nombreCompleto || '-');
    _setText('info-fechaNacimiento', user.fechaNacimiento ? new Date(user.fechaNacimiento).toLocaleDateString('es-ES') : '-');
    _setText('info-curp', user.curp || '-');
    _setText('info-rfc', user.rfc || '-');
    _setText('info-estadoCivil', user.estadoCivil || '-');
    _setText('info-nss', user.nss || '-');
    
    // Contacto
    _setText('info-telefonoFijo', user.telefonoFijo || '-');
    _setText('info-telefonoMovil', user.telefonoMovil || '-');
    _setText('info-emailEmpresarial', user.emailEmpresarial || '-');
    _setText('info-emailPersonal', user.emailPersonal || '-');
    
    // Laboral
    _setText('info-area', user.areaNombre || user.area || '-');
    _setText('info-subarea', user.subareaNombre || user.subarea || '-');
    _setText('info-tipoColaborador', user.tipoColaborador || '-');
    _setText('info-nit', user.nit || '-');
    _setText('info-status', user.status === 'active' ? 'Activo' : 'Inactivo');
    _setText('info-createdAt', user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '-');
}

/**
 * Actualiza la UI de notificaciones
 */
function _updateNotificationUI() {
    const status = _notificationStatus;
    
    if (!status) {
        _setToggle('notifications-toggle', false);
        _setText('notif-status-text', '❌ No disponible');
        const statusText = document.getElementById('notif-status-text');
        if (statusText) statusText.className = 'rsi-status-value rsi-status-denied';
        const card = document.getElementById('notification-card');
        if (card) card.classList.remove('rsi-active');
        return;
    }

    // Notificaciones
    const notifToggle = document.getElementById('notifications-toggle');
    const notifCard = document.getElementById('notification-card');
    const notifStatusText = document.getElementById('notif-status-text');
    
    if (notifToggle) {
        notifToggle.checked = status.notificationsEnabled;
    }
    
    if (notifCard) {
        if (status.notificationsEnabled) {
            notifCard.classList.add('rsi-active');
        } else {
            notifCard.classList.remove('rsi-active');
        }
    }
    
    if (notifStatusText) {
        if (status.notificationsEnabled) {
            notifStatusText.innerHTML = '<i class="fas fa-check-circle"></i> Activadas';
            notifStatusText.className = 'rsi-status-value rsi-status-granted';
        } else {
            notifStatusText.innerHTML = '<i class="fas fa-times-circle"></i> Desactivadas';
            notifStatusText.className = 'rsi-status-value rsi-status-denied';
        }
    }

    // Token info
    const tokenInfo = document.getElementById('notif-token-info');
    const tokenText = document.getElementById('notif-token-text');
    if (tokenInfo && tokenText) {
        if (status.hasToken && status.fcmToken) {
            tokenInfo.style.display = 'flex';
            tokenText.textContent = status.fcmToken.substring(0, 25) + '...';
        } else {
            tokenInfo.style.display = 'none';
        }
    }

    // Platform info
    const platformInfo = document.getElementById('notif-platform-info');
    const platformText = document.getElementById('notif-platform-text');
    if (platformInfo && platformText) {
        if (status.fcmPlatform) {
            platformInfo.style.display = 'flex';
            platformText.textContent = status.fcmPlatform;
        } else {
            platformInfo.style.display = 'none';
        }
    }

    // Date info
    const dateInfo = document.getElementById('notif-date-info');
    const dateText = document.getElementById('notif-date-text');
    if (dateInfo && dateText) {
        if (status.fcmTokenUpdatedAt) {
            dateInfo.style.display = 'flex';
            dateText.textContent = new Date(status.fcmTokenUpdatedAt).toLocaleString('es-ES');
        } else {
            dateInfo.style.display = 'none';
        }
    }

    // Ubicación
    const locationToggle = document.getElementById('location-toggle');
    const locationCard = document.getElementById('location-card');
    const locationStatusText = document.getElementById('location-status-text');
    
    if (locationToggle) {
        locationToggle.checked = status.locationEnabled;
    }
    
    if (locationCard) {
        if (status.locationEnabled) {
            locationCard.classList.add('rsi-active');
        } else {
            locationCard.classList.remove('rsi-active');
        }
    }
    
    if (locationStatusText) {
        if (status.locationEnabled) {
            locationStatusText.innerHTML = '<i class="fas fa-check-circle"></i> Activada';
            locationStatusText.className = 'rsi-status-value rsi-status-granted';
        } else {
            locationStatusText.innerHTML = '<i class="fas fa-times-circle"></i> Desactivada';
            locationStatusText.className = 'rsi-status-value rsi-status-denied';
        }
    }

    // Location coords
    const coordsInfo = document.getElementById('location-coords-info');
    const coordsText = document.getElementById('location-coords-text');
    if (coordsInfo && coordsText) {
        if (status.hasLocation && status.location) {
            coordsInfo.style.display = 'flex';
            coordsText.textContent = `${status.location.lat?.toFixed(6)}, ${status.location.lng?.toFixed(6)}`;
        } else {
            coordsInfo.style.display = 'none';
        }
    }

    // Location date
    const locationDateInfo = document.getElementById('location-date-info');
    const locationDateText = document.getElementById('location-date-text');
    if (locationDateInfo && locationDateText) {
        if (status.locationUpdatedAt) {
            locationDateInfo.style.display = 'flex';
            locationDateText.textContent = new Date(status.locationUpdatedAt).toLocaleString('es-ES');
        } else {
            locationDateInfo.style.display = 'none';
        }
    }
}

/**
 * Carga el estado de notificaciones
 */
async function _loadNotificationStatus() {
    try {
        _notificationStatus = await notificationService.getNotificationStatus();
        console.log('📊 Estado de notificaciones:', _notificationStatus);
        _updateNotificationUI();
    } catch (error) {
        console.error('❌ Error cargando estado:', error);
        _notificationStatus = null;
    }
}

/**
 * Cambia de pestaña
 */
function _switchTab(tabId) {
    _currentTab = tabId;
    
    document.querySelectorAll('.rsi-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.rsi-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tab === tabId);
    });
}

/**
 * Maneja el toggle de notificaciones
 */
async function _handleNotificationToggle(enabled) {
    try {
        _setLoading(true);

        if (enabled) {
            const result = await notificationService.requestNotificationPermission();
            
            if (result.success) {
                _showToast('✅ Notificaciones activadas correctamente', 'success');
                await _loadNotificationStatus();
            } else {
                _showToast(`❌ ${result.message}`, 'error');
                const toggle = document.getElementById('notifications-toggle');
                if (toggle) toggle.checked = false;
            }
        } else {
            const result = await notificationService.disableNotifications();
            if (result.success) {
                _showToast('✅ Notificaciones desactivadas', 'info');
                await _loadNotificationStatus();
            }
        }
    } catch (error) {
        console.error('❌ Error en toggle notificaciones:', error);
        _showToast('❌ Error al procesar la solicitud', 'error');
        const toggle = document.getElementById('notifications-toggle');
        if (toggle) toggle.checked = !enabled;
    } finally {
        _setLoading(false);
    }
}

/**
 * Maneja el toggle de ubicación
 */
async function _handleLocationToggle(enabled) {
    try {
        _setLoading(true);

        if (enabled) {
            if (!navigator.geolocation) {
                _showToast('❌ Geolocalización no soportada', 'error');
                const toggle = document.getElementById('location-toggle');
                if (toggle) toggle.checked = false;
                return;
            }

            _showToast('📍 Obteniendo ubicación...', 'info');

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toISOString()
                    };

                    try {
                        await notificationService.saveLocation(location);
                        _showToast('✅ Ubicación guardada correctamente', 'success');
                        await _loadNotificationStatus();
                    } catch (error) {
                        console.error('❌ Error guardando ubicación:', error);
                        _showToast('❌ Error al guardar ubicación', 'error');
                        const toggle = document.getElementById('location-toggle');
                        if (toggle) toggle.checked = false;
                    }
                },
                (error) => {
                    console.error('❌ Error obteniendo ubicación:', error);
                    _showToast(`❌ Error: ${error.message}`, 'error');
                    const toggle = document.getElementById('location-toggle');
                    if (toggle) toggle.checked = false;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            try {
                await notificationService.saveLocation(null);
                _showToast('✅ Ubicación desactivada', 'info');
                await _loadNotificationStatus();
            } catch (error) {
                console.error('❌ Error desactivando ubicación:', error);
                _showToast('❌ Error al desactivar ubicación', 'error');
                const toggle = document.getElementById('location-toggle');
                if (toggle) toggle.checked = true;
            }
        }
    } catch (error) {
        console.error('❌ Error en toggle ubicación:', error);
        _showToast('❌ Error al procesar la solicitud', 'error');
    } finally {
        _setLoading(false);
    }
}

/**
 * Actualiza los datos
 */
async function _refreshData() {
    try {
        _setLoading(true);
        _userData = _getUserFromStorage();
        await _loadNotificationStatus();
        _loadUserData();
        _showToast('🔄 Datos actualizados', 'info');
    } catch (error) {
        console.error('❌ Error actualizando:', error);
        _showToast('❌ Error al actualizar', 'error');
    } finally {
        _setLoading(false);
    }
}

/**
 * Configura los eventos
 */
function _setupEvents() {
    // Tabs
    document.querySelectorAll('.rsi-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            _switchTab(tab.dataset.tab);
        });
    });

    // Toggle de notificaciones
    const notifToggle = document.getElementById('notifications-toggle');
    if (notifToggle) {
        notifToggle.addEventListener('change', async (e) => {
            await _handleNotificationToggle(e.target.checked);
        });
    }

    // Toggle de ubicación
    const locationToggle = document.getElementById('location-toggle');
    if (locationToggle) {
        locationToggle.addEventListener('change', async (e) => {
            await _handleLocationToggle(e.target.checked);
        });
    }

    // Botón actualizar
    const refreshBtn = document.getElementById('refresh-profile-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await _refreshData();
        });
    }
}

/**
 * CONTROLLER PRINCIPAL - Exportado para routes.js
 */
export async function ProfileController() {
    console.log('🚀 Inicializando ProfileController...');
    
    // Evitar inicialización múltiple
    if (_isInitialized) {
        console.log('ℹ️ ProfileController ya inicializado');
        return;
    }
    _isInitialized = true;
    
    // Verificar que el contenedor exista
    const container = document.getElementById('profile-container');
    if (!container) {
        console.error('❌ Contenedor #profile-container no encontrado');
        return;
    }
    
    // Inicializar servicio
    notificationService = new NotificationService();
    
    // Obtener usuario
    _userData = _getUserFromStorage();
    
    if (!_userData) {
        _showError('Usuario no autenticado');
        return;
    }

    // Cargar datos en el HTML
    _loadUserData();
    
    // Cargar estado de notificaciones
    await _loadNotificationStatus();
    
    // Configurar eventos
    _setupEvents();
    
    console.log('✅ ProfileController inicializado');
}

export default ProfileController;