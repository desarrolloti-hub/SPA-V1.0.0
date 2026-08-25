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

// ==========================================
// 4. FUNCIONES DE NOTIFICACIONES
// ==========================================
exports.enviarNotificacion = functions.https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    try {
        const { tokens, titulo, mensaje, data } = req.body;

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

        console.log(`📨 Enviando notificaciones a ${tokens.length} dispositivos`);

        const messages = tokens.map(token => ({
            token: token,
            notification: { title: titulo, body: mensaje },
            data: data || {},
            android: {
                priority: "high",
                notification: { sound: "default", clickAction: "FLUTTER_NOTIFICATION_CLICK" }
            },
            apns: {
                payload: { aps: { sound: "default" } }
            }
        }));

        const responses = await Promise.allSettled(
            messages.map(msg => admin.messaging().send(msg))
        );

        const successCount = responses.filter(r => r.status === "fulfilled").length;
        const failureCount = responses.filter(r => r.status === "rejected").length;

        responses.forEach((response, index) => {
            if (response.status === "rejected") {
                console.error(`❌ Error en token ${index + 1}:`, response.reason);
            }
        });

        console.log(`✅ Éxitos: ${successCount}, Fallos: ${failureCount}`);

        res.json({ 
            success: true, 
            successCount,
            failureCount,
            total: tokens.length
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