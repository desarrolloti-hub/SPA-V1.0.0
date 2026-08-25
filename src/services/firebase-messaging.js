// src/services/firebase-messaging.js
import { 
    messaging, 
    getToken as getFirebaseToken, 
    onMessage as onFirebaseMessage,
    isSupported
} from '../config/firebaseConfig.js';

// 🔥 VAPID Key - OBTENER DE FIREBASE CONSOLE
const VAPID_KEY = 'BN1Y5vuRqbNdqQOFkpo2QQlAirqwej101NKdLwdP-bOtXS-EpsycPpNfPqZKnCK8EQ7ai1IvqMAZRA9pCvLIXA4'; // ⚠️ REEMPLAZA CON TU VAPID KEY

// ✅ EXPORTAR CONSTANTE
export const NOTIFICATION_EVENT = 'fcm-notification';

/**
 * Verificar si el navegador soporta notificaciones
 */
export function isNotificationsSupported() {
    return (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        isSupported()
    );
}

/**
 * Solicitar permiso y obtener el token FCM
 */
export async function requestNotificationPermission() {
    try {
        if (!isNotificationsSupported()) {
            console.warn('❌ Notificaciones no soportadas en este navegador');
            return null;
        }

        console.log('📢 Solicitando permiso de notificaciones...');
        
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('✅ Permiso concedido');
            
            if (!messaging) {
                console.error('❌ Firebase Messaging no inicializado');
                return null;
            }

            const token = await getFirebaseToken(messaging, {
                vapidKey: VAPID_KEY,
            });
            
            if (token) {
                console.log('✅ Token FCM obtenido:', token);
                await saveTokenToServer(token);
                return token;
            } else {
                console.warn('⚠️ No se pudo obtener el token');
                return null;
            }
        } else {
            console.warn('⚠️ Permiso denegado por el usuario');
            return null;
        }
    } catch (error) {
        console.error('❌ Error al solicitar permiso:', error);
        
        if (error.code === 'messaging/permission-blocked') {
            console.error('🔒 Permiso bloqueado permanentemente');
        } else if (error.code === 'messaging/unsupported-browser') {
            console.error('🌐 Navegador no soportado');
        }
        
        return null;
    }
}

/**
 * Guardar token en el servidor
 */
async function saveTokenToServer(token) {
    try {
        const response = await fetch('/api/notifications/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                token,
                platform: 'web',
                timestamp: new Date().toISOString()
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al guardar token');
        }
        
        console.log('✅ Token guardado en el servidor');
    } catch (error) {
        console.error('❌ Error guardando token:', error);
    }
}

/**
 * Escuchar mensajes en primer plano
 */
export function listenForMessages() {
    if (!messaging) {
        console.warn('⚠️ Firebase Messaging no disponible');
        return null;
    }

    console.log('👂 Escuchando mensajes en primer plano...');
    
    return onFirebaseMessage(messaging, (payload) => {
        console.log('📨 Mensaje recibido en primer plano:', payload);
        
        const notification = {
            title: payload.notification?.title || 'Nueva notificación',
            body: payload.notification?.body || '',
            image: payload.notification?.image || null,
            data: payload.data || {},
            timestamp: new Date().toISOString(),
            clickAction: payload.notification?.clickAction || null
        };
        
        // Disparar evento personalizado
        const event = new CustomEvent(NOTIFICATION_EVENT, { 
            detail: notification,
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
        
        // Mostrar en UI
        showInAppNotification(notification);
    });
}

/**
 * Mostrar notificación en la UI
 */
function showInAppNotification(notification) {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            max-width: 400px;
            width: 100%;
        `;
        document.body.appendChild(container);
    }
    
    const notifEl = document.createElement('div');
    notifEl.className = 'notification-toast';
    notifEl.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid #4CAF50;
        animation: slideIn 0.3s ease;
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        notifEl.style.background = '#2d2d2d';
        notifEl.style.color = '#fff';
    }
    
    notifEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <strong style="font-size: 14px;">${notification.title}</strong>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">${notification.body}</p>
            </div>
            <button class="notification-close" style="
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.6;
                padding: 0 4px;
            ">×</button>
        </div>
    `;
    
    const closeBtn = notifEl.querySelector('.notification-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifEl.remove();
    });
    
    notifEl.addEventListener('click', () => {
        if (notification.data?.url) {
            window.location.href = notification.data.url;
        }
        notifEl.remove();
    });
    
    container.appendChild(notifEl);
    
    setTimeout(() => {
        if (notifEl.parentNode) {
            notifEl.style.opacity = '0';
            notifEl.style.transform = 'translateX(100px)';
            setTimeout(() => notifEl.remove(), 300);
        }
    }, 8000);
}

/**
 * Verificar estado del Service Worker
 */
export async function checkServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn('❌ Service Worker no soportado');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        
        if (registration) {
            console.log('✅ Service Worker registrado:', registration);
            return registration;
        }
        
        console.log('📦 Registrando Service Worker...');
        const newRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        console.log('✅ Service Worker registrado:', newRegistration);
        return newRegistration;
        
    } catch (error) {
        console.error('❌ Error con Service Worker:', error);
        return null;
    }
}

/**
 * Inicializar notificaciones
 */
export async function initNotifications() {
    try {
        if (!isNotificationsSupported()) {
            console.warn('❌ Notificaciones no soportadas');
            return false;
        }

        const swRegistration = await checkServiceWorker();
        if (!swRegistration) {
            console.warn('❌ No se pudo registrar el Service Worker');
            return false;
        }

        if (Notification.permission === 'granted') {
            try {
                const token = await getFirebaseToken(messaging, {
                    vapidKey: VAPID_KEY,
                });
                if (token) {
                    console.log('✅ Token FCM restaurado:', token);
                    await saveTokenToServer(token);
                }
            } catch (error) {
                console.warn('⚠️ Error restaurando token:', error);
            }
            
            listenForMessages();
            return true;
        }
        
        console.log('ℹ️ Permiso no concedido. El usuario debe activar manualmente.');
        return false;
        
    } catch (error) {
        console.error('❌ Error inicializando notificaciones:', error);
        return false;
    }
}

/**
 * Activar notificaciones (solicitar permiso)
 */
export async function enableNotifications() {
    const token = await requestNotificationPermission();
    if (token) {
        listenForMessages();
        return true;
    }
    return false;
}

/**
 * Eliminar token del servidor
 */
export async function removeTokenFromServer(token) {
    try {
        const response = await fetch('/api/notifications/token', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });
        
        if (!response.ok) {
            throw new Error('Error al eliminar token');
        }
        
        console.log('✅ Token eliminado del servidor');
    } catch (error) {
        console.error('❌ Error eliminando token:', error);
    }
}

// ✅ TODAS LAS EXPORTACIONES AL FINAL
export default {
    initNotifications,
    enableNotifications,
    listenForMessages,
    checkServiceWorker,
    requestNotificationPermission,
    removeTokenFromServer,
    isNotificationsSupported,
    NOTIFICATION_EVENT // ✅ Asegurar que está en el default export
};