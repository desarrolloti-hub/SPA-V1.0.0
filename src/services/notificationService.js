// src/services/notificationService.js
/* ========================================
   NOTIFICATION SERVICE
   Lógica de negocio para notificaciones
   ======================================== */

import NewCollaboratorRepository from '../repositories/partnerRepository.js';
import { 
    messaging, 
    getToken as getFirebaseToken, 
    onMessage as onFirebaseMessage,
    isSupported
} from '../config/firebaseConfig.js';

const VAPID_KEY = 'BN1Y5vuRqbNdqQOFkpo2QQlAirqwej101NKdLwdP-bOtXS-EpsycPpNfPqZKnCK8EQ7ai1IvqMAZRA9pCvLIXA4'; // ⚠️ REEMPLAZAR CON TU VAPID KEY

export class NotificationService {
    
    constructor() {
        this.repository = new NewCollaboratorRepository();
        this._messageListener = null;
        this._currentToken = null;
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const sessionData = JSON.parse(session);
            return sessionData.uid || null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene el usuario actual desde localStorage
     */
    _getCurrentUser() {
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
     * Verifica si el navegador soporta notificaciones
     */
    isSupported() {
        return (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            'serviceWorker' in navigator &&
            isSupported()
        );
    }

    /**
     * Verifica el estado del Service Worker
     */
    async checkServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
            if (registration) {
                return registration;
            }
            
            const newRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            return newRegistration;
        } catch (error) {
            console.error('❌ Error con Service Worker:', error);
            return null;
        }
    }

    /**
     * Obtiene el token FCM
     */
    async getFCMToken() {
        if (!this.isSupported()) {
            return null;
        }

        if (this._currentToken) {
            return this._currentToken;
        }

        try {
            if (!messaging) {
                console.error('❌ Firebase Messaging no inicializado');
                return null;
            }

            const token = await getFirebaseToken(messaging, {
                vapidKey: VAPID_KEY,
            });

            if (token) {
                this._currentToken = token;
                return token;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo token FCM:', error);
            return null;
        }
    }

    /**
     * Solicita permiso de notificaciones y guarda el token
     */
    async requestNotificationPermission() {
        try {
            if (!this.isSupported()) {
                throw new Error('Notificaciones no soportadas');
            }

            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const sw = await this.checkServiceWorker();
            if (!sw) {
                throw new Error('Service Worker no disponible');
            }

            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                const token = await this.getFCMToken();
                if (!token) {
                    throw new Error('No se pudo obtener el token FCM');
                }

                await this.repository.saveFCMToken(uid, token, 'web');
                this.startListening();
                
                return {
                    success: true,
                    token: token,
                    permission: 'granted',
                    message: 'Notificaciones activadas correctamente'
                };
            } else {
                return {
                    success: false,
                    permission: permission,
                    message: `Permiso ${permission}`
                };
            }
        } catch (error) {
            console.error('❌ Error en requestNotificationPermission:', error);
            return {
                success: false,
                error: error.message,
                message: 'Error al activar notificaciones'
            };
        }
    }

    /**
     * Inicializa el servicio de notificaciones para un usuario autenticado
     */
    async initForUser(uid) {
        if (!this.isSupported() || !uid) return;

        this.startListening();

        // Si el usuario ya concedió permisos previamente, refrescar token silenciosamente
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                const token = await this.getFCMToken();
                if (token) {
                    await this.repository.saveFCMToken(uid, token, 'web');
                }
            } catch (error) {
                console.warn('⚠️ No se pudo refrescar token FCM en inicio:', error.message);
            }
        }
    }

    /**
     * Desvincula el token del dispositivo actual (usado en logout)
     */
    async unregisterCurrentDevice() {
        try {
            const uid = this._getCurrentUserUid();
            const token = this._currentToken || (await this.getFCMToken());
            if (uid && token) {
                await this.repository.removeFCMToken(uid, token);
            }
            this.stopListening();
            this._currentToken = null;
        } catch (error) {
            console.warn('⚠️ Error desvinculando dispositivo en logout:', error.message);
        }
    }

    /**
     * Inicia la escucha de mensajes en primer plano
     */
    startListening(callback) {
        if (this._messageListener) {
            return;
        }

        if (!messaging) {
            console.warn('⚠️ Firebase Messaging no disponible');
            return;
        }

        console.log('👂 Escuchando mensajes en primer plano...');
        
        this._messageListener = onFirebaseMessage(messaging, (payload) => {
            console.log('📨 Mensaje recibido en primer plano:', payload);
            
            const title = payload.notification?.title || payload.data?.titulo || 'Nuevo ticket asignado';
            const body = payload.notification?.body || payload.data?.mensaje || 'Se te ha asignado un nuevo ticket';
            const data = payload.data || {};
            const ticketId = data.ticketId || data.idTicket || '';
            let targetUrl = data.url;
            if (!targetUrl || targetUrl.includes('/partner/ticketView')) {
                targetUrl = ticketId 
                    ? `https://rsienterprise.com/partner/ticketAtencion?id=${ticketId}` 
                    : 'https://rsienterprise.com/partner/crudTickets';
            }
            
            const notification = {
                title,
                body,
                image: payload.notification?.image || null,
                data,
                targetUrl,
                timestamp: new Date().toISOString()
            };
            
            const event = new CustomEvent('fcm-notification', { 
                detail: notification,
                bubbles: true,
                composed: true
            });
            document.dispatchEvent(event);
            
            // Mostrar aviso visual con SweetAlert2 en primer plano
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: title,
                    html: `<div style="text-align: left; font-size: 14px; margin-top: 6px;">${body}</div>`,
                    icon: 'info',
                    position: 'top-end',
                    toast: true,
                    timer: 10000,
                    timerProgressBar: true,
                    showConfirmButton: true,
                    confirmButtonText: 'Ver ticket',
                    confirmButtonColor: '#1c1948',
                    showCancelButton: true,
                    cancelButtonText: 'Cerrar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        if (typeof window.navigateTo === 'function') {
                            try {
                                const parsed = new URL(targetUrl, window.location.origin);
                                if (parsed.hostname === 'rsienterprise.com' || parsed.hostname === window.location.hostname) {
                                    window.navigateTo(parsed.pathname + parsed.search);
                                } else {
                                    window.location.href = targetUrl;
                                }
                            } catch (e) {
                                window.navigateTo(targetUrl);
                            }
                        } else {
                            window.location.href = targetUrl;
                        }
                    }
                });
            }

            if (callback && typeof callback === 'function') {
                callback(notification);
            }
        });
    }

    /**
     * Detiene la escucha de mensajes
     */
    stopListening() {
        if (this._messageListener) {
            this._messageListener();
            this._messageListener = null;
            console.log('👂 Escucha de mensajes detenida');
        }
    }

    /**
     * Obtiene el estado de notificaciones del usuario actual
     */
    async getNotificationStatus() {
        const uid = this._getCurrentUserUid();
        if (!uid) return null;

        try {
            const status = await this.repository.getUserNotificationStatus(uid);
            
            if (!status) {
                return {
                    isSubscribed: false,
                    notificationsEnabled: false,
                    locationEnabled: false
                };
            }

            return {
                isSubscribed: true,
                notificationsEnabled: status.notificationsEnabled || false,
                locationEnabled: status.locationEnabled || false,
                hasToken: !!status.fcmToken,
                hasLocation: !!status.location,
                fcmToken: status.fcmToken,
                location: status.location,
                fcmPlatform: status.fcmPlatform,
                fcmTokenUpdatedAt: status.fcmTokenUpdatedAt,
                locationUpdatedAt: status.locationUpdatedAt
            };
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            return null;
        }
    }

    /**
     * Desactiva las notificaciones del usuario
     */
    async disableNotifications() {
        const uid = this._getCurrentUserUid();
        if (!uid) {
            throw new Error('Usuario no autenticado');
        }

        try {
            await this.repository.disableNotifications(uid);
            this._currentToken = null;
            this.stopListening();
            return {
                success: true,
                message: 'Notificaciones desactivadas'
            };
        } catch (error) {
            console.error('❌ Error desactivando notificaciones:', error);
            throw error;
        }
    }

    /**
     * Guarda la ubicación del usuario
     */
    async saveLocation(location) {
        const uid = this._getCurrentUserUid();
        if (!uid) {
            throw new Error('Usuario no autenticado');
        }

        try {
            await this.repository.saveUserLocation(uid, location);
            return {
                success: true,
                message: 'Ubicación guardada correctamente'
            };
        } catch (error) {
            console.error('❌ Error guardando ubicación:', error);
            throw error;
        }
    }
}

export default NotificationService;