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
                    .button:hover { background: #272361; }
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
                            <a href="${pdfUrl}" class="button" target="_blank">Ver Cotización</a>
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

    generarHTMLFactura(facturaNumero, clienteNombre, pdfUrl, options = {}) {
        const logoUrl = options.logoUrl || 'cid:rsi-logo';
        const total = options.total ? `$${Number(options.total).toFixed(2)} ${options.moneda || 'MXN'}` : '';
        const fecha = options.fecha || '';
        const uuid = options.uuid || '';

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Factura Electrónica ${facturaNumero} - RSI Enterprise</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
                    .header { background: #1c1948; color: #ffffff; padding: 28px 24px; text-align: center; }
                    .header img { max-height: 52px; width: auto; max-width: 180px; display: block; margin: 0 auto 12px auto; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
                    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
                    .content { padding: 28px 24px; background: #ffffff; }
                    .greeting { font-size: 16px; font-weight: 600; color: #1c1948; margin-top: 0; }
                    .badge-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0; }
                    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #edf2f7; }
                    .info-row:last-child { border-bottom: none; }
                    .btn-wrapper { text-align: center; margin: 28px 0 20px 0; }
                    .button { display: inline-block; padding: 12px 28px; background: #1c1948; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
                    .button:hover { background: #272361; }
                    .attachments-notice { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 4px 4px 0; font-size: 13px; color: #1e40af; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; background: #f9fafb; border-top: 1px solid #e5e7eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${logoUrl}" alt="RSI Enterprise" />
                        <h1>RSI ENTERPRISE</h1>
                        <p>Comprobante Fiscal Digital por Internet (CFDI 4.0)</p>
                    </div>
                    <div class="content">
                        <h2 class="greeting">Estimado(a) ${clienteNombre || 'Cliente'},</h2>
                        <p>Le informamos que ha sido emitida su factura correspondiente con los siguientes datos fiscales:</p>
                        
                        <div class="badge-container">
                            <div class="info-row">
                                <span><strong>Folio de Factura:</strong></span>
                                <span>${facturaNumero}</span>
                            </div>
                            ${uuid ? `
                            <div class="info-row">
                                <span><strong>Folio Fiscal (UUID):</strong></span>
                                <span style="font-family: monospace; font-size: 12px;">${uuid}</span>
                            </div>` : ''}
                            ${fecha ? `
                            <div class="info-row">
                                <span><strong>Fecha de Emisión:</strong></span>
                                <span>${fecha}</span>
                            </div>` : ''}
                            ${total ? `
                            <div class="info-row">
                                <span><strong>Total:</strong></span>
                                <span style="color: #1c1948; font-weight: bold;">${total}</span>
                            </div>` : ''}
                        </div>

                        <div class="attachments-notice">
                            <strong>Documentos fiscales adjuntos:</strong><br>
                            Se han adjuntado a este correo los archivos oficiales:
                            <ul style="margin: 6px 0 0 0; padding-left: 20px;">
                                <li><strong>PDF:</strong> Representación impresa oficial de su CFDI 4.0</li>
                                <li><strong>XML:</strong> Comprobante fiscal digital con timbre del SAT</li>
                            </ul>
                        </div>

                        ${pdfUrl && pdfUrl !== '#' ? `
                        <div class="btn-wrapper">
                            <a href="${pdfUrl}" class="button" target="_blank">Consultar Factura en Línea</a>
                        </div>
                        <p style="font-size: 11px; color: #9ca3af; text-align: center; word-break: break-all;">
                            Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
                            <a href="${pdfUrl}" style="color: #6b7280;">${pdfUrl}</a>
                        </p>` : ''}
                        
                        <hr style="margin: 24px 0 16px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
                            Este es un mensaje generado automáticamente. Por favor no responda directamente a este correo.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0; font-weight: 600;">&copy; ${new Date().getFullYear()} RSI Enterprise</p>
                        <p style="margin: 4px 0 0 0; font-size: 11px;">Soluciones Tecnológicas Integrales</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    generarHTMLTicketAsignado(ticketData, colaboradorNombre, ticketUrl) {
        const idTicket = ticketData.idTicket || 'Ticket';
        const titulo = ticketData.titulo || 'Sin título';
        const prioridad = ticketData.prioridad || 'media';
        const tipo = ticketData.tipo === 'operativo' ? 'Operativo' : 'Administración';
        const area = ticketData.area || 'General';
        const descripcion = ticketData.descripcion || '';
        const asignadorNombre = ticketData.asignadorNombre || ticketData.creadoPorNombre || 'Administración';
        const fecha = ticketData.fecha || new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        const prioridadBadgeStyle = {
            'alta': 'background: #fee2e2; color: #991b1b; border: 1px solid #f87171;',
            'media': 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;',
            'baja': 'background: #dcfce7; color: #166534; border: 1px solid #86efac;'
        }[prioridad] || 'background: #f3f4f6; color: #374151;';

        const prioridadLabel = {
            'alta': 'Alta',
            'media': 'Media',
            'baja': 'Baja'
        }[prioridad] || prioridad;

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Asignación de Ticket ${idTicket} - RSI Enterprise</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
                    .header { background: #1c1948; color: #ffffff; padding: 24px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
                    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.85; }
                    .content { padding: 24px 20px; background: #ffffff; }
                    .greeting { font-size: 16px; font-weight: 600; color: #1c1948; margin-top: 0; }
                    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 18px 0; }
                    .info-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #edf2f7; }
                    .info-row:last-child { border-bottom: none; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
                    .btn-wrapper { text-align: center; margin: 26px 0 16px 0; }
                    .button { display: inline-block; padding: 12px 28px; background: #1c1948; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
                    .button:hover { background: #272361; }
                    .notice { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 4px 4px 0; font-size: 12px; color: #1e40af; margin: 18px 0; }
                    .footer { text-align: center; padding: 18px; font-size: 11px; color: #6b7280; background: #f9fafb; border-top: 1px solid #e5e7eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>RSI ENTERPRISE</h1>
                        <p>Sistema Integral de Gestión de Soporte y Tickets</p>
                    </div>
                    <div class="content">
                        <h2 class="greeting">Hola ${colaboradorNombre || 'Colaborador'},</h2>
                        <p>Se te ha asignado un nuevo ticket en el sistema. A continuación encontrarás el resumen de los detalles:</p>
                        
                        <div class="card">
                            <div class="info-row">
                                <span><strong>Folio del Ticket:</strong></span>
                                <span style="font-family: monospace; font-weight: 700; color: #1c1948;">${idTicket}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Título / Asunto:</strong></span>
                                <span><strong>${titulo}</strong></span>
                            </div>
                            <div class="info-row">
                                <span><strong>Prioridad:</strong></span>
                                <span class="badge" style="${prioridadBadgeStyle}">${prioridadLabel}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Tipo de Ticket:</strong></span>
                                <span>${tipo}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Área asignada:</strong></span>
                                <span>${area}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Asignado por:</strong></span>
                                <span>${asignadorNombre}</span>
                            </div>
                            <div class="info-row">
                                <span><strong>Fecha de asignación:</strong></span>
                                <span>${fecha}</span>
                            </div>
                            ${descripcion ? `
                            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #edf2f7; font-size: 13px;">
                                <strong style="color: #4b5563;">Descripción:</strong>
                                <p style="margin: 4px 0 0 0; color: #374151; white-space: pre-wrap;">${descripcion}</p>
                            </div>
                            ` : ''}
                        </div>

                        <div class="notice">
                            <strong>Seguridad y Acceso:</strong><br>
                            Para consultar el ticket completo y actualizar su estado, deberás iniciar sesión con tus credenciales de colaborador.
                        </div>

                        ${ticketUrl ? `
                        <div class="btn-wrapper">
                            <a href="${ticketUrl}" class="button" target="_blank">Consultar Ticket en Plataforma</a>
                        </div>
                        <p style="font-size: 11px; color: #9ca3af; text-align: center; word-break: break-all;">
                            Si el botón no funciona, ingresa directamente mediante este enlace:<br>
                            <a href="${ticketUrl}" style="color: #4b5563;">${ticketUrl}</a>
                        </p>
                        ` : ''}
                        
                        <hr style="margin: 20px 0 12px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
                            Este es un correo generado automáticamente. Por favor no respondas a este remitente.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0; font-weight: 600;">&copy; ${new Date().getFullYear()} RSI Enterprise</p>
                        <p style="margin: 4px 0 0 0;">Seguridad Electrónica, Automatización y Telecomunicaciones</p>
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