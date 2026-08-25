// controllers/email.controller.js
const EmailService = require('../services/email.service');

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
     * Envía una factura por email
     */
    async enviarFactura(req, res, params) {
        try {
            // ✅ Crear servicio con parámetros
            const emailService = new EmailService(params.EMAIL_USER, params.EMAIL_PASSWORD);
            
            const { facturaId, email, pdfUrl, facturaNumero, clienteNombre } = req.body;

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

            console.log(`📧 Enviando factura ${facturaNumero} a ${email}`);

            if (!emailService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    error: 'Servicio de email no configurado. Verifica las variables EMAIL_USER y EMAIL_PASSWORD.'
                });
            }

            // Generar HTML
            const html = emailService.generarHTMLFactura(
                facturaNumero,
                clienteNombre,
                pdfUrl
            );

            const result = await emailService.sendEmail({
                to: email,
                subject: `Factura ${facturaNumero} - RSI Enterprise`,
                html: html,
                attachments: [
                    {
                        filename: `factura-${facturaNumero}.pdf`,
                        url: pdfUrl
                    }
                ]
            });

            console.log(`✅ Factura enviada a ${email}`);
            
            res.json({
                success: true,
                message: `Factura enviada a ${email}`,
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