// public/firebase-messaging-sw.js

// ⚠️ IMPORTANTE: Este archivo DEBE estar en la carpeta 'public'
// Usar importScripts con Firebase Compat (versión compat)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 🔥 Usar la MISMA configuración que en firebaseConfig.js
const firebaseConfig = {
    apiKey: "AIzaSyBJy992gkvsT77-_fMp_O_z99wtjZiK77Y",
    authDomain: "rsienterprise.firebaseapp.com",
    databaseURL: "https://rsienterprise-default-rtdb.firebaseio.com",
    projectId: "rsienterprise",
    storageBucket: "rsienterprise.firebasestorage.app",
    messagingSenderId: "1063117165770",
    appId: "1:1063117165770:web:8555f26b25ae80bc42d033",
    measurementId: "G-38F2DBG9HE"
};

// Inicializar Firebase en el Service Worker
firebase.initializeApp(firebaseConfig);

// Obtener la instancia de messaging
const messaging = firebase.messaging();

// ==========================================
// MANEJAR MENSAJES EN SEGUNDO PLANO
// ==========================================

messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Mensaje en background:', payload);

    const notificationTitle = payload.notification?.title || '📨 Nueva notificación';
    const notificationOptions = {
        body: payload.notification?.body || 'Tienes un nuevo mensaje',
        icon: payload.notification?.icon || '/logo192.png',
        badge: '/badge.png',
        data: payload.data || {},
        actions: [
            {
                action: 'open',
                title: 'Abrir'
            },
            {
                action: 'close',
                title: 'Cerrar'
            }
        ],
        vibrate: [200, 100, 200],
        requireInteraction: true,
        // Personalizar según los datos
        tag: payload.data?.tag || 'default',
        renotify: true
    };

    // Mostrar la notificación
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// MANEJAR CLIC EN NOTIFICACIONES
// ==========================================

self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notificación clickeada:', event);

    event.notification.close();

    const clickAction = event.action;
    const notificationData = event.notification.data || {};

    if (clickAction === 'open' || !clickAction) {
        // Determinar la URL a abrir
        let urlToOpen = notificationData?.url || '/';
        
        // Si hay un ID específico, construir URL
        if (notificationData?.entityId && notificationData?.entityType) {
            urlToOpen = `/${notificationData.entityType}/${notificationData.entityId}`;
        }

        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then((windowClients) => {
                // Buscar si ya hay una ventana abierta con esa URL
                for (const client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir nueva
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// ==========================================
// EVENTOS DEL SERVICE WORKER
// ==========================================

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalado');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activado');
    event.waitUntil(self.clients.claim());
});

// Manejar errores
self.addEventListener('error', (error) => {
    console.error('[Service Worker] Error:', error);
});