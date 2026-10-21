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

    const notificationTitle = payload.notification?.title || payload.data?.titulo || 'Nuevo ticket asignado';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.mensaje || 'Se te ha asignado un nuevo ticket',
        icon: payload.notification?.icon || '/assets/icons/logoApp.png',
        badge: '/assets/icons/logoApp.png',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: payload.data?.ticketId || payload.data?.idTicket || 'ticket-notification',
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

    const notificationData = event.notification.data || {};

    // Determinar la ruta relativa y URL absoluta a abrir (siempre dominio oficial rsienterprise.com)
    const BASE_DOMAIN = 'https://rsienterprise.com';
    let urlToOpen = notificationData?.url;
    const ticketId = notificationData?.ticketId || notificationData?.idTicket;

    if (!urlToOpen || urlToOpen.includes('/partner/ticketView')) {
        if (ticketId) {
            urlToOpen = `${BASE_DOMAIN}/partner/ticketAtencion?id=${ticketId}`;
        } else {
            urlToOpen = `${BASE_DOMAIN}/partner/crudTickets`;
        }
    }

    const fullUrlToOpen = urlToOpen.startsWith('http') 
        ? urlToOpen 
        : new URL(urlToOpen, BASE_DOMAIN).href;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // Buscar si ya hay una pestaña abierta de la aplicación
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.postMessage({
                        type: 'FCM_NAVIGATE',
                        url: urlToOpen,
                        ticketId: notificationData?.ticketId || notificationData?.idTicket
                    });
                    if ('navigate' in client && client.url !== fullUrlToOpen) {
                        return client.navigate(fullUrlToOpen);
                    }
                    return;
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(fullUrlToOpen);
            }
        })
    );
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