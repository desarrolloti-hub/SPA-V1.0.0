// controllers/email.controller.js
const EmailService = require('../services/email.service');
const admin = require('firebase-admin');
const facturama = require('../services/facturama.service');

class EmailController {
    /**
     * Envía una cotización por email
     */
    async enviarCotizacion(req, res, params) {
        try {
            // ✅ Crear servicio con parámetros
            const emailService = new EmailService(params.EMAIL_USER, params.EMAIL_PASSWORD);
            
            const { cotizacionId, email, pdfUrl, cotizacionNumero, clienteNombre } = req.body;

            // Validar campos requeridos
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: "Email es requerido"
                });
            }

            if (!pdfUrl) {
                return res.status(400).json({
                    success: false,
                    error: "PDF URL es requerido"
                });
            }

            if (!cotizacionId) {
                return res.status(400).json({
                    success: false,
                    error: "cotizacionId es requerido"
                });
            }

            console.log(`📧 Enviando cotización ${cotizacionNumero} a ${email}`);

            // Verificar configuración de email
            if (!emailService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    error: 'Servicio de email no configurado. Verifica las variables EMAIL_USER y EMAIL_PASSWORD.'
                });
            }

            // Obtener datos completos de la cotización
            const cotizacion = await emailService.getCotizacionData(cotizacionId);

            // Generar HTML
            const html = emailService.generarHTMLCotizacion(
                cotizacion,
                cotizacionNumero,
                clienteNombre,
                pdfUrl
            );

            // Enviar correo
            const result = await emailService.sendEmail({
                to: email,
                subject: `Cotización ${cotizacionNumero} - RSI Enterprise`,
                html: html,
                attachments: [
                    {
                        filename: `cotizacion-${cotizacionNumero}.pdf`,
                        url: pdfUrl
                    }
                ]
            });

            console.log(`✅ Email enviado a ${email}`);
            
            res.json({
                success: true,
                message: `Cotización enviada a ${email}`,
                data: result
            });

        } catch (error) {
            console.error('❌ Error en enviarCotizacion:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al enviar el correo electrónico'
            });
        }
    }

    /**
     * Envía una factura por email con PDF y XML adjuntos binarios reales
     */
    async enviarFactura(req, res, params) {
        try {
            // ✅ Crear servicio con parámetros
            const emailService = new EmailService(params.EMAIL_USER, params.EMAIL_PASSWORD);
            
            let { facturaId, email, pdfUrl, xmlUrl, pdfPath, xmlPath, facturamaId, facturaNumero, clienteNombre } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: "Email es requerido"
                });
            }

            // Si se proporciona facturaId, obtener datos desde Firestore para complementar campos faltantes
            if (facturaId) {
                try {
                    const docSnap = await admin.firestore().collection('facturas').doc(facturaId).get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        facturaNumero = facturaNumero || data.facturaNumero || `FAC-${facturaId}`;
                        clienteNombre = clienteNombre || data.clienteRazonSocial || data.clienteNombre || 'Cliente';
                        pdfUrl = pdfUrl || data.pdfUrl;
                        xmlUrl = xmlUrl || data.xmlUrl;
                        pdfPath = pdfPath || data.pdfPath;
                        xmlPath = xmlPath || data.xmlPath;
                        facturamaId = facturamaId || data.facturamaId;
                    }
                } catch (firestoreErr) {
                    console.warn('⚠️ No se pudo consultar Firestore para factura:', firestoreErr.message);
                }
            }

            facturaNumero = facturaNumero || 'CFDI';
            clienteNombre = clienteNombre || 'Cliente';

            if (!emailService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    error: 'Servicio de email no configurado. Verifica las variables EMAIL_USER y EMAIL_PASSWORD.'
                });
            }

            console.log(`📧 Preparando envío de factura ${facturaNumero} a ${email}`);

            let bucket = null;
            try {
                bucket = admin.storage().bucket();
                if (!bucket || !bucket.name) {
                    bucket = admin.storage().bucket(process.env.STORAGE_BUCKET || 'rsienterprise.firebasestorage.app');
                }
            } catch (e) {
                bucket = admin.storage().bucket(process.env.STORAGE_BUCKET || 'rsienterprise.firebasestorage.app');
            }

            // 1. OBTENER BUFFER BINARIO DEL PDF
            let pdfBuffer = null;
            if (pdfPath && bucket) {
                try {
                    const file = bucket.file(pdfPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [downloaded] = await file.download();
                        if (downloaded && downloaded.length > 100 && downloaded.slice(0, 5).toString('ascii') === '%PDF-') {
                            pdfBuffer = downloaded;
                            console.log(`📄 PDF recuperado desde Storage path: ${pdfPath} (${pdfBuffer.length} bytes)`);
                        }
                    }
                } catch (storagePdfErr) {
                    console.warn(`⚠️ Error leyendo PDF desde Storage path:`, storagePdfErr.message);
                }
            }

            if (!pdfBuffer && pdfUrl && typeof fetch === 'function') {
                try {
                    const resp = await fetch(pdfUrl);
                    if (resp.ok) {
                        const arr = await resp.arrayBuffer();
                        const b = Buffer.from(arr);
                        if (b.length > 100 && b.slice(0, 5).toString('ascii') === '%PDF-') {
                            pdfBuffer = b;
                            console.log(`📄 PDF descargado desde URL (${pdfBuffer.length} bytes)`);
                        }
                    }
                } catch (fetchPdfErr) {
                    console.warn(`⚠️ Error descargando PDF desde URL:`, fetchPdfErr.message);
                }
            }

            if (!pdfBuffer && facturamaId) {
                try {
                    const b = await facturama.obtenerPDFFactura(facturamaId);
                    if (b && b.length > 100) {
                        pdfBuffer = b;
                        console.log(`📄 PDF descargado desde Facturama (${pdfBuffer.length} bytes)`);
                    }
                } catch (facturamaPdfErr) {
                    console.warn(`⚠️ Error obteniendo PDF desde Facturama:`, facturamaPdfErr.message);
                }
            }

            // 2. OBTENER BUFFER BINARIO DEL XML FISCAL
            let xmlBuffer = null;
            if (xmlPath && bucket) {
                try {
                    const file = bucket.file(xmlPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [downloaded] = await file.download();
                        const str = downloaded.toString('utf8');
                        if (downloaded && downloaded.length > 50 && (str.includes('<?xml') || str.includes('<cfdi:') || str.includes('<Comprobante'))) {
                            xmlBuffer = downloaded;
                            console.log(`📄 XML recuperado desde Storage path: ${xmlPath} (${xmlBuffer.length} bytes)`);
                        }
                    }
                } catch (storageXmlErr) {
                    console.warn(`⚠️ Error leyendo XML desde Storage path:`, storageXmlErr.message);
                }
            }

            if (!xmlBuffer && xmlUrl && typeof fetch === 'function') {
                try {
                    const resp = await fetch(xmlUrl);
                    if (resp.ok) {
                        const text = await resp.text();
                        if (text.length > 50 && (text.includes('<?xml') || text.includes('<cfdi:') || text.includes('<Comprobante'))) {
                            xmlBuffer = Buffer.from(text, 'utf8');
                            console.log(`📄 XML descargado desde URL (${xmlBuffer.length} bytes)`);
                        }
                    }
                } catch (fetchXmlErr) {
                    console.warn(`⚠️ Error descargando XML desde URL:`, fetchXmlErr.message);
                }
            }

            if (!xmlBuffer && facturamaId) {
                try {
                    const xmlString = await facturama.obtenerXMLFactura(facturamaId);
                    if (xmlString && xmlString.length > 50 && (xmlString.includes('<?xml') || xmlString.includes('<cfdi:') || xmlString.includes('<Comprobante'))) {
                        xmlBuffer = Buffer.from(xmlString, 'utf8');
                        console.log(`📄 XML descargado desde Facturama (${xmlBuffer.length} bytes)`);
                    }
                } catch (facturamaXmlErr) {
                    console.warn(`⚠️ Error obteniendo XML desde Facturama:`, facturamaXmlErr.message);
                }
            }

            // 3. VALIDACIONES ESTRICTAS DE LOS DOCUMENTOS
            if (!pdfBuffer) {
                return res.status(422).json({
                    success: false,
                    error: `No se pudo obtener el archivo PDF de la factura ${facturaNumero} para adjuntarlo al correo. Verifique que la factura esté timbrada.`
                });
            }

            if (!xmlBuffer) {
                return res.status(422).json({
                    success: false,
                    error: `No se pudo obtener el archivo XML fiscal de la factura ${facturaNumero} para adjuntarlo al correo. Se requiere el CFDI 4.0 timbrado.`
                });
            }

            // 4. VALIDACIÓN DE LÍMITE DE TAMAÑO
            const totalBytes = pdfBuffer.length + xmlBuffer.length;
            const maxBytes = 20 * 1024 * 1024; // 20 MB límite de seguridad para proveedores como Gmail
            if (totalBytes > maxBytes) {
                return res.status(413).json({
                    success: false,
                    error: `Los documentos adjuntos (${(totalBytes / 1024 / 1024).toFixed(1)} MB) exceden el límite de tamaño permitido por el servidor de correo.`
                });
            }

            // 4.1 PREPARAR LOGOTIPO DE RSI ENTERPRISE
            const fs = require('fs');
            const path = require('path');
            let logoAttachment = null;
            let logoSrc = req.body.logoUrl || 'https://rsienterprise.com/assets/icons/logo.png';

            const possibleLogoPaths = [
                path.join(__dirname, '../assets/icons/logo.png'),
                path.join(__dirname, '../../public/assets/icons/logo.png'),
                path.join(__dirname, '../../../public/assets/icons/logo.png')
            ];

            for (const p of possibleLogoPaths) {
                if (fs.existsSync(p)) {
                    logoAttachment = {
                        filename: 'logo.png',
                        path: p,
                        cid: 'rsi-logo',
                        contentType: 'image/png'
                    };
                    logoSrc = 'cid:rsi-logo';
                    break;
                }
            }

            // 5. GENERAR HTML CON BOTÓN DE ACCESO Y LOGOTIPO DE RSI ENTERPRISE
            const html = emailService.generarHTMLFactura(
                facturaNumero,
                clienteNombre,
                pdfUrl || '#',
                {
                    logoUrl: logoSrc,
                    total: req.body.total || '',
                    fecha: req.body.fecha || '',
                    uuid: req.body.uuid || ''
                }
            );

            // 6. ADJUNTAR ARCHIVOS BINARIOS REALES CON TIPOS MIME OFICIALES
            const attachments = [
                {
                    filename: `factura-${facturaNumero}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                },
                {
                    filename: `factura-${facturaNumero}.xml`,
                    content: xmlBuffer,
                    contentType: 'application/xml'
                }
            ];

            if (logoAttachment) {
                attachments.push(logoAttachment);
            }

            const result = await emailService.sendEmail({
                to: email,
                subject: `Factura ${facturaNumero} - RSI Enterprise`,
                html: html,
                attachments: attachments
            });

            console.log(`✅ Factura ${facturaNumero} enviada con éxito a ${email} (PDF + XML adjuntos)`);
            
            res.json({
                success: true,
                message: `Factura ${facturaNumero} enviada a ${email} con PDF y XML adjuntos`,
                data: result
            });

        } catch (error) {
            console.error('❌ Error en enviarFactura:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al enviar el correo electrónico'
            });
        }
    }

    /**
     * Envía notificación de ticket asignado por email
     */
    async enviarTicket(req, res, params) {
        try {
            const emailService = new EmailService(params.EMAIL_USER, params.EMAIL_PASSWORD);
            const { email, colaboradorNombre, ticketData, ticketUrl } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: "Email es requerido"
                });
            }

            if (!ticketData || !ticketData.idTicket) {
                return res.status(400).json({
                    success: false,
                    error: "ticketData con idTicket es requerido"
                });
            }

            if (!emailService.isConfigured()) {
                console.warn('⚠️ Servicio de email no configurado en Cloud Functions');
                return res.status(500).json({
                    success: false,
                    error: 'Servicio de email no configurado. Verifica las variables EMAIL_USER y EMAIL_PASSWORD.'
                });
            }

            console.log(`📧 Enviando notificación de ticket ${ticketData.idTicket} a ${email}`);

            // Asegurar que la URL del ticket siempre use el dominio oficial rsienterprise.com y /partner/ticketAtencion?id=
            const idTicket = ticketData.idTicket || ticketData.id || '';
            let finalTicketUrl = ticketUrl;
            if (!finalTicketUrl || finalTicketUrl.includes('/partner/ticketView')) {
                finalTicketUrl = idTicket 
                    ? `https://rsienterprise.com/partner/ticketAtencion?id=${encodeURIComponent(idTicket)}`
                    : 'https://rsienterprise.com/partner/crudTickets';
            } else if (finalTicketUrl.startsWith('/')) {
                finalTicketUrl = `https://rsienterprise.com${finalTicketUrl}`;
            }

            const html = emailService.generarHTMLTicketAsignado(
                ticketData,
                colaboradorNombre || 'Colaborador',
                finalTicketUrl
            );

            const result = await emailService.sendEmail({
                to: email,
                subject: `🎫 Nuevo ticket asignado: ${ticketData.idTicket} - ${ticketData.titulo || 'Sin título'}`,
                html
            });

            return res.json({
                success: true,
                message: `Correo de asignación enviado a ${email}`,
                messageId: result.messageId
            });

        } catch (error) {
            console.error('❌ Error enviando email de ticket:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al enviar el correo electrónico del ticket'
            });
        }
    }

    /**
     * Verifica el estado de la configuración de email
     */
    verificarConfiguracion(req, res, params) {
        // ✅ Crear servicio solo para verificar configuración
        const emailService = new EmailService(params.EMAIL_USER, params.EMAIL_PASSWORD);
        const isConfigured = emailService.isConfigured();
        
        res.json({
            success: true,
            configured: isConfigured,
            email: isConfigured ? emailService.getEmailUser() : null,
            message: isConfigured 
                ? 'Servicio de email configurado correctamente' 
                : 'Servicio de email no configurado. Verifica las variables EMAIL_USER y EMAIL_PASSWORD.'
        });
    }
}

module.exports = new EmailController();