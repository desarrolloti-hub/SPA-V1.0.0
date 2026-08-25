// services/email.service.js
const nodemailer = require("nodemailer");
const admin = require("firebase-admin"); // ✅ IMPORTANTE: agregar esta línea

class EmailService {
    constructor(emailUserParam, emailPasswordParam) {
        this.emailUser = emailUserParam ? emailUserParam.value() : null;
        const password = emailPasswordParam ? emailPasswordParam.value() : null;
        
        if (!this.emailUser || !password) {
            console.error('❌ Credenciales de email no configuradas');
            console.error('   Asegúrate de definir EMAIL_USER y EMAIL_PASSWORD en .env');
            this.transporter = null;
            return;
        }

        console.log(`✅ Transportador de email configurado para: ${this.emailUser}`);
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: this.emailUser, 
                pass: password 
            }
        });
    }

    isConfigured() {
        return this.transporter !== null && this.emailUser !== null;
    }

    getEmailUser() {
        return this.emailUser || 'no-reply@rsienterprise.com';
    }

    async sendEmail(options) {
        if (!this.isConfigured()) {
            throw new Error('Servicio de email no configurado. Verifica las variables de entorno.');
        }

        const mailOptions = {
            from: options.from || `RSI Enterprise <${this.emailUser}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            attachments: options.attachments || []
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email enviado a ${options.to}: ${info.messageId}`);
            return {
                success: true,
                messageId: info.messageId,
                message: `Correo enviado a ${options.to}`
            };
        } catch (error) {
            console.error('❌ Error enviando email:', error);
            throw new Error(`Error al enviar email: ${error.message}`);
        }
    }

    generarHTMLCotizacion(cotizacion, cotizacionNumero, clienteNombre, pdfUrl) {
        const totalFinal = cotizacion.totalFinal || 0;
        const fecha = cotizacion.cotizacionFecha || new Date().toISOString().split('T')[0];
        const moneda = cotizacion.cotizacionMoneda || 'MXN';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1c1948; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    .button { display: inline-block; padding: 12px 24px; background: #1c1948; color: white; text-decoration: none; border-radius: 4px; }
                    .button:hover { background: #2a2670; }
                    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                    .info-row:last-child { border-bottom: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin: 0;">RSI ENTERPRISE</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.8;">Soluciones Tecnológicas</p>
                    </div>
                    <div class="content">
                        <h3 style="margin-top: 0;">Hola ${clienteNombre || 'cliente'},</h3>
                        <p>Adjuntamos la cotización solicitada.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e0e0e0; margin: 15px 0;">
                            <div class="info-row">
                                <span><strong>Número de cotización:</strong></span>
                                <span>${cotizacionNumero}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Fecha:</strong></span>
                                <span>${fecha}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Total:</strong></span>
                                <span style="color: #1c1948; font-weight: bold;">$${totalFinal.toFixed(2)} ${moneda}</span>
                            </div>
                            ${cotizacion.items ? `
                            <div style="margin-top: 10px; border-top: 1px solid #e0e0e0; padding-top: 10px;">
                                <span><strong>Items:</strong> ${cotizacion.items.length} producto(s)</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <p>Puedes ver y descargar el PDF en el siguiente enlace:</p>
                        <p style="text-align: center;">
                            <a href="${pdfUrl}" class="button" target="_blank">📄 Ver Cotización</a>
                        </p>
                        <p style="font-size: 12px; color: #666; word-break: break-all;">
                            <strong>Enlace directo:</strong><br>
                            <a href="${pdfUrl}" target="_blank">${pdfUrl}</a>
                        </p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
                        <p style="font-size: 12px; color: #999;">
                            Este correo fue enviado automáticamente desde el sistema de RSI Enterprise.
                            Por favor no respondas a este mensaje.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} RSI Enterprise.</p>
                        <p style="margin: 5px 0 0 0; font-size: 11px;">31 MZ102 LT20 EL SOL 57200, Nezahualcóyotl, México</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    generarHTMLFactura(facturaNumero, clienteNombre, pdfUrl) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1c1948; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    .button { display: inline-block; padding: 12px 24px; background: #1c1948; color: white; text-decoration: none; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin: 0;">RSI ENTERPRISE</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.8;">Facturación Electrónica</p>
                    </div>
                    <div class="content">
                        <h3 style="margin-top: 0;">Hola ${clienteNombre || 'cliente'},</h3>
                        <p>Adjuntamos la factura solicitada.</p>
                        <p style="text-align: center;">
                            <a href="${pdfUrl}" class="button" target="_blank">📄 Ver Factura</a>
                        </p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
                        <p style="font-size: 12px; color: #999;">
                            Este correo fue enviado automáticamente desde el sistema de RSI Enterprise.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} RSI Enterprise.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async getCotizacionData(cotizacionId) {
        try {
            // ✅ admin ya está importado al inicio
            const doc = await admin.firestore()
                .collection('cotizacionPdf')
                .doc(cotizacionId)
                .get();

            if (!doc.exists) {
                throw new Error('Cotización no encontrada');
            }

            return doc.data();
        } catch (error) {
            console.error('❌ Error obteniendo cotización:', error);
            throw new Error(`Error al obtener cotización: ${error.message}`);
        }
    }
}

module.exports = EmailService;