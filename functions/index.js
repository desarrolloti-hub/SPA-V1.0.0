// index.js - COMPLETO CON FACTURAMA INTACTA Y EMAIL CON PARAMS
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require('firebase-functions/params');

admin.initializeApp();

// ==========================================
// 1. DEFINIR PARÁMETROS DE CONFIGURACIÓN
// ==========================================

const EMAIL_USER = defineString('EMAIL_USER', { 
    description: 'Usuario de Gmail para enviar correos'
});
const EMAIL_PASSWORD = defineString('EMAIL_PASSWORD', { 
    description: 'Contraseña de aplicación de Gmail'
});

// ==========================================
// 2. MIDDLEWARE CORS UNIFICADO
// ==========================================
const corsHandler = (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    res.set("Access-Control-Max-Age", "86400");
    
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
};

// ==========================================
// 3. CONTROLADORES
// ==========================================
const facturamaController = require("./controllers/facturama.controller");
const emailController = require("./controllers/email.controller");
const ticketsController = require("./controllers/tickets.controller");

// ==========================================
// 4. FUNCIONES DE NOTIFICACIONES
// ==========================================
// Cloud Function mejorada
exports.enviarNotificacion = functions.https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    try {
        const { tokens, titulo, mensaje, data } = req.body;

        console.log('📨 Request recibida:', {
            tokenCount: tokens?.length || 0,
            titulo,
            mensaje: mensaje?.substring(0, 50),
            hasData: !!data
        });

        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            return res.status(400).json({ 
                error: "Se requiere un array 'tokens' con al menos un token" 
            });
        }

        if (!titulo || !mensaje) {
            return res.status(400).json({ 
                error: "Se requieren 'titulo' y 'mensaje'" 
            });
        }

        // ✅ Filtrar tokens vacíos o inválidos
        const validTokens = tokens.filter(token => token && token.length > 10);
        console.log(`📨 Tokens válidos: ${validTokens.length} de ${tokens.length}`);

        if (validTokens.length === 0) {
            return res.status(400).json({ 
                error: "No hay tokens válidos para enviar" 
            });
        }

        // ✅ Enviar notificaciones en lotes de 500 (límite de FCM)
        const batchSize = 500;
        const batches = [];
        for (let i = 0; i < validTokens.length; i += batchSize) {
            batches.push(validTokens.slice(i, i + batchSize));
        }

        console.log(`📦 Enviando en ${batches.length} lotes`);

        const allResponses = [];

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`📦 Enviando lote ${batchIndex + 1}/${batches.length} (${batch.length} tokens)`);

            // Asegurar que las URLs de notificaciones apunten al dominio oficial rsienterprise.com y a /partner/ticketAtencion
            const baseData = data || {};
            const ticketId = baseData.ticketId || baseData.idTicket;
            let pushUrl = baseData.url;

            if (ticketId && (!pushUrl || pushUrl.includes('/partner/ticketView'))) {
                pushUrl = `https://rsienterprise.com/partner/ticketAtencion?id=${encodeURIComponent(ticketId)}`;
            } else if (pushUrl && !pushUrl.startsWith('http')) {
                pushUrl = `https://rsienterprise.com${pushUrl.startsWith('/') ? '' : '/'}${pushUrl}`;
            }

            const normalizedData = {
                ...baseData,
                ...(pushUrl ? { url: pushUrl } : {})
            };

            const messages = batch.map(token => ({
                token: token,
                notification: { 
                    title: titulo, 
                    body: mensaje 
                },
                data: normalizedData,
                android: {
                    priority: "high",
                    notification: { 
                        sound: "default", 
                        clickAction: "FLUTTER_NOTIFICATION_CLICK" 
                    }
                },
                apns: {
                    payload: { 
                        aps: { 
                            sound: "default",
                            "content-available": 1
                        } 
                    }
                },
                webpush: {
                    notification: {
                        icon: "https://rsienterprise.com/favicon.ico",
                        badge: "https://rsienterprise.com/favicon.ico"
                    },
                    fcmOptions: {
                        link: pushUrl || "https://rsienterprise.com"
                    }
                }
            }));

            const responses = await Promise.allSettled(
                messages.map(msg => admin.messaging().send(msg))
            );

            const successCount = responses.filter(r => r.status === "fulfilled").length;
            const failureCount = responses.filter(r => r.status === "rejected").length;

            // ✅ Log de errores específicos
            responses.forEach((response, index) => {
                if (response.status === "rejected") {
                    const error = response.reason;
                    console.error(`❌ Error en token ${index + 1}:`, {
                        code: error.code,
                        message: error.message,
                        token: batch[index]?.substring(0, 20) + '...'
                    });
                    
                    // ✅ Si el token está registrado como inválido, podríamos marcarlo
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        console.warn(`⚠️ Token inválido, debería ser eliminado: ${batch[index]?.substring(0, 20)}...`);
                    }
                }
            });

            allResponses.push({ successCount, failureCount });
        }

        const totalSuccess = allResponses.reduce((sum, r) => sum + r.successCount, 0);
        const totalFailure = allResponses.reduce((sum, r) => sum + r.failureCount, 0);

        console.log(`✅ Notificaciones enviadas: ${totalSuccess} éxitos, ${totalFailure} fallos`);

        res.json({ 
            success: true, 
            successCount: totalSuccess,
            failureCount: totalFailure,
            total: validTokens.length,
            batches: batches.length
        });

    } catch (error) {
        console.error("❌ Error en Cloud Function:", error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ==========================================
// 5. FACTURAMA - OBTENER CLIENTES
// ==========================================
exports.obtenerClientes = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;
    facturamaController.obtenerClientes(req, res);
});

// ==========================================
// 6. FACTURAMA - CREAR CLIENTE
// ==========================================
exports.crearCliente = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    facturamaController.crearCliente(req, res);
});

// ==========================================
// 7. FACTURAMA - VALIDAR CLIENTE
// ==========================================
exports.validarCliente = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    facturamaController.validarCliente(req, res);
});

// ==========================================
// 8. FACTURAMA - CREAR FACTURA (TIMBRAR Y GUARDAR PDF/XML EN STORAGE)
// ==========================================
exports.crearFactura = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    facturamaController.crearFactura(req, res);
});

// ==========================================
// 9. FACTURAMA - OBTENER PDF FACTURA
// ==========================================
exports.obtenerPDFFactura = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "GET") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use GET" 
        });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Se requiere el parámetro 'id' en la URL. Ejemplo: ?id=lsBrYCVfZ4z3Y0dm2a8acg2"
        });
    }

    req.params = { id };
    facturamaController.obtenerPDFFactura(req, res);
});

// ==========================================
// 10. FACTURAMA - OBTENER XML FACTURA
// ==========================================
exports.obtenerXMLFactura = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "GET") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use GET" 
        });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Se requiere el parámetro 'id' en la URL. Ejemplo: ?id=lsBrYCVfZ4z3Y0dm2a8acg2"
        });
    }

    req.params = { id };
    facturamaController.obtenerXMLFactura(req, res);
});

// ==========================================
// 10.1 FACTURAMA - CANCELAR FACTURA
// ==========================================
exports.cancelarFactura = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST" && req.method !== "DELETE") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use POST o DELETE" 
        });
    }

    facturamaController.cancelarFactura(req, res);
});

// ==========================================
// 10.2 FACTURAMA - CONSULTAR FACTURA
// ==========================================
exports.consultarFactura = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "GET") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use GET" 
        });
    }

    facturamaController.consultarFactura(req, res);
});

// ==========================================
// 11. 📧 ENVIAR COTIZACIÓN POR EMAIL
// ==========================================
exports.enviarCotizacionEmail = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    emailController.enviarCotizacion(req, res, { 
        EMAIL_USER, 
        EMAIL_PASSWORD 
    });
});

// ==========================================
// 12. 📧 ENVIAR FACTURA POR EMAIL
// ==========================================
exports.enviarFacturaEmail = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    emailController.enviarFactura(req, res, { 
        EMAIL_USER, 
        EMAIL_PASSWORD 
    });
});

// ==========================================
// 12.1 📧 ENVIAR TICKET ASIGNADO POR EMAIL
// ==========================================
exports.enviarTicketEmail = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido" 
        });
    }

    emailController.enviarTicket(req, res, { 
        EMAIL_USER, 
        EMAIL_PASSWORD 
    });
});

// ==========================================
// 13. 🔧 VERIFICAR CONFIGURACIÓN DE EMAIL
// ==========================================
exports.verificarEmailConfig = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    emailController.verificarConfiguracion(req, res, { 
        EMAIL_USER, 
        EMAIL_PASSWORD 
    });
});
// ==========================================
// 14. STORAGE - VERIFICAR ARCHIVO
// ==========================================
const storageController = require("./controllers/storage.controller");

exports.verificarArchivo = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;
    
    if (req.method !== "GET") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use GET" 
        });
    }
    
    storageController.verificarArchivo(req, res);
});

exports.obtenerUrlArchivo = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;
    
    if (req.method !== "GET") {
        return res.status(405).json({ 
            success: false, 
            error: "Método no permitido. Use GET" 
        });
    }
    
    storageController.obtenerUrlArchivo(req, res);
});

// ==========================================
// 15. RECORDATORIOS AUTOMÁTICOS DE ASISTENCIA (CLOUD SCHEDULER)
// ==========================================
const { onSchedule } = require("firebase-functions/v2/scheduler");
const asistenciaController = require("./controllers/asistencia.controller");

// 15.1. Recordatorio programado matutino (09:00 AM - Zona Horaria México)
// Se ejecuta automáticamente todos los días a las 09:00 hrs
exports.recordatorioAsistencia0900 = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "America/Mexico_City",
    retryCount: 1
}, async (event) => {
    console.log("⏰ [AUTOMÁTICO] Ejecutando recordatorio de asistencia 09:00 AM (Zona Horaria México)...");
    return await asistenciaController.ejecutarRecordatorioProgramado("0900", {
        EMAIL_USER,
        EMAIL_PASSWORD
    });
});

// 15.2. Recordatorio programado mediodía (12:00 PM - Zona Horaria México)
// Se ejecuta automáticamente todos los días a las 12:00 hrs
exports.recordatorioAsistencia1200 = onSchedule({
    schedule: "0 12 * * *",
    timeZone: "America/Mexico_City",
    retryCount: 1
}, async (event) => {
    console.log("⏰ [AUTOMÁTICO] Ejecutando recordatorio de asistencia 12:00 PM (Zona Horaria México)...");
    return await asistenciaController.ejecutarRecordatorioProgramado("1200", {
        EMAIL_USER,
        EMAIL_PASSWORD
    });
});

// 15.3. Endpoint HTTP auxiliar (para webhook, verificación o pruebas de mantenimiento)
exports.procesarRecordatoriosAsistencia = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Método no permitido. Use POST o GET"
        });
    }

    asistenciaController.procesarRecordatorios(req, res, {
        EMAIL_USER,
        EMAIL_PASSWORD
    });
});

// ==========================================
// 15.4. REVISIÓN PROGRAMADA DE TICKETS (ABANDONO Y RECORDATORIO 1 DÍA ANTES)
// Se ejecuta automáticamente todos los días a las 08:00 hrs (Zona Horaria México)
// ==========================================
exports.revisionTicketsAbandono0800 = onSchedule({
    schedule: "0 8 * * *",
    timeZone: "America/Mexico_City",
    retryCount: 1
}, async (event) => {
    console.log("⏰ [AUTOMÁTICO] Ejecutando revisión de tickets (abandono y recordatorios 1 día antes) 08:00 AM...");
    return await ticketsController.ejecutarRevisionProgramada({
        EMAIL_USER,
        EMAIL_PASSWORD
    });
});

// 15.5. Endpoint HTTP auxiliar para procesar revisión de tickets bajo demanda
exports.procesarRevisionTickets = functions.https.onRequest((req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Método no permitido. Use POST o GET"
        });
    }

    ticketsController.procesarRevisionTickets(req, res, {
        EMAIL_USER,
        EMAIL_PASSWORD
    });
});

// ==========================================
// 16. SSR OPEN GRAPH PARA CRAWLERS (WHATSAPP, FACEBOOK, TWITTER, TELEGRAM)
// ==========================================
exports.catalogoSocialPreview = functions.https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;

    const catalogId = req.query.id;
    if (!catalogId) {
        return res.redirect('/catalogos');
    }

    try {
        const docSnap = await admin.firestore().collection('catalogos').doc(catalogId).get();
        if (!docSnap.exists) {
            return res.redirect('/catalogos');
        }

        const data = docSnap.data();
        const title = data.titulo ? `${data.titulo} | RSI Enterprise México` : 'Catálogo Comercial | RSI Enterprise México';
        const desc = data.descripcion || 'Explora nuestros productos y servicios especializados de seguridad electrónica y automatización.';
        const image = data.imagenPortada || 'https://rsienterprise.com/assets/icons/logo.png';
        const targetUrl = `https://rsienterprise.com/verCatalogo?id=${encodeURIComponent(catalogId)}`;

        const html = `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <!-- Open Graph / WhatsApp / Facebook -->
    <meta property="og:site_name" content="RSI Enterprise México">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${targetUrl}">
    <meta property="og:type" content="website">
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
    <!-- Redirección para navegadores humanos -->
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
</head>
<body>
    <script>window.location.replace('${targetUrl}');</script>
    <p style="font-family: sans-serif; text-align: center; margin-top: 40px;">
        Cargando catálogo <a href="${targetUrl}">${title}</a>...
    </p>
</body>
</html>`;

        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    } catch (err) {
        console.error('❌ Error generando preview de catálogo:', err);
        res.redirect(`/verCatalogo?id=${encodeURIComponent(catalogId)}`);
    }
});