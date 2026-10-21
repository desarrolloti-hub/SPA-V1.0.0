// functions/services/recordatorioAsistencia.service.js
const admin = require("firebase-admin");
const EmailService = require("./email.service");

class RecordatorioAsistenciaService {
    constructor(emailUserParam, emailPasswordParam) {
        this.emailService = new EmailService(emailUserParam, emailPasswordParam);
        this.db = admin.firestore();
        this.zonaHoraria = "America/Mexico_City";
    }

    /**
     * Obtiene la fecha actual en formato YYYY-MM-DD en la zona horaria de México
     */
    getFechaMexico() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: this.zonaHoraria,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
        return formatter.format(now);
    }

    /**
     * Procesa los recordatorios automáticos de asistencia con idempotencia
     * @param {string} tipo - '0900' (9:00 AM) o '1200' (12:00 PM mediodía)
     * @param {boolean} forzar - Si es true, ignora el candado de ejecución única previa
     */
    async procesarRecordatorios(tipo = "0900", forzar = false) {
        const fecha = this.getFechaMexico();
        const recordatorioId = `${fecha}_${tipo}`;
        const recordatorioRef = this.db.collection("recordatoriosAsistencia").doc(recordatorioId);

        console.log(`⏰ Iniciando proceso de recordatorios de asistencia: ${recordatorioId}`);

        // 1. Control de idempotencia: Verificar si ya se procesó este recordatorio hoy
        const recSnap = await recordatorioRef.get();
        if (recSnap.exists && !forzar) {
            console.log(`ℹ️ Recordatorio ${recordatorioId} ya fue procesado el ${recSnap.data().ejecutadoAt}. Omitiendo.`);
            return {
                success: true,
                omitido: true,
                mensaje: `El recordatorio de las ${tipo === '0900' ? '09:00 AM' : '12:00 PM'} para el día ${fecha} ya fue procesado previamente.`,
                detalles: recSnap.data()
            };
        }

        // 2. Obtener colaboradores activos
        const usersSnap = await this.db.collection("usersRSI")
            .where("rol", "==", "partner")
            .where("status", "==", "active")
            .get();

        if (usersSnap.empty) {
            console.log("ℹ️ No hay colaboradores activos para notificar.");
            return {
                success: true,
                totalActivos: 0,
                totalNotificados: 0,
                mensaje: "No se encontraron colaboradores activos."
            };
        }

        const colaboradoresActivos = usersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`👥 Total colaboradores activos: ${colaboradoresActivos.length}`);

        // 3. Identificar colaboradores elegibles (sin registro de entrada hoy)
        const colaboradoresElegibles = [];
        const colaboradoresExcluidos = [];

        for (const colab of colaboradoresActivos) {
            const uid = colab.uid || colab.id;
            const asistenciaId = `${uid}_${fecha}`;
            const asisDoc = await this.db.collection("asistencias").doc(asistenciaId).get();

            if (asisDoc.exists) {
                const asisData = asisDoc.data();
                if (asisData.horaEntrada) {
                    colaboradoresExcluidos.push({
                        uid,
                        nombre: colab.nombreCompleto || colab.emailEmpresarial,
                        motivo: `Ya registró entrada a las ${asisData.horaEntrada}`
                    });
                    continue;
                }
                if (asisData.estadoJustificacion === 'aprobada') {
                    colaboradoresExcluidos.push({
                        uid,
                        nombre: colab.nombreCompleto || colab.emailEmpresarial,
                        motivo: 'Inasistencia o permiso justificado y aprobado'
                    });
                    continue;
                }
            }

            colaboradoresElegibles.push(colab);
        }

        console.log(`📋 Colaboradores elegibles para recordatorio: ${colaboradoresElegibles.length} (Excluidos: ${colaboradoresExcluidos.length})`);

        // 4. Preparar mensajes según horario
        const esMediodia = tipo === "1200";
        const asunto = esMediodia
            ? "Segundo recordatorio de asistencia — Registro pendiente | RSI Enterprise"
            : "Recordatorio de asistencia | RSI Enterprise";

        const generarMensajeTexto = (nombre) => {
            if (esMediodia) {
                return `Hola ${nombre}, te informamos que al mediodía todavía no aparece registrada tu asistencia de hoy. Por favor, realiza tu registro en el sistema a la brevedad posible.`;
            }
            return `Hola ${nombre}, te recordamos que todavía no aparece registrada tu asistencia de hoy. Por favor, realiza tu registro cuando corresponda.`;
        };

        const generarHTMLCorreo = (nombre) => {
            const cuerpo = esMediodia
                ? `Al mediodía te informamos que tu registro de asistencia para el día de hoy (<strong>${fecha}</strong>) aún continúa <strong style="color: #dc3545;">pendiente</strong>. Te invitamos a ingresar al sistema para registrar tu jornada laboral a la brevedad.`
                : `Te recordamos cordialmente que el día de hoy (<strong>${fecha}</strong>) aún no registras tu asistencia laboral en el sistema. Por favor, accede para registrar tu entrada cuando corresponda.`;

            return `
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 24px; color: #212529;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #e9ecef;">
                    <div style="background: #1c1948; padding: 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">RSI ENTERPRISE</h1>
                        <p style="color: #d4af37; margin: 6px 0 0 0; font-size: 13px; font-weight: 600;">CONTROL DE ASISTENCIAS Y SALIDAS</p>
                    </div>
                    <div style="padding: 30px 24px;">
                        <h2 style="color: #1c1948; font-size: 18px; margin-top: 0;">Estimado(a) ${nombre},</h2>
                        <p style="font-size: 14px; line-height: 1.6; color: #495057;">
                            ${cuerpo}
                        </p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="https://rsienterprise.com/partner/asistencia" 
                               style="background: #1c1948; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                                Registrar Mi Asistencia
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef; padding-top: 16px; margin-bottom: 0;">
                            Este es un mensaje institucional automático generado por la plataforma RSI Enterprise (${tipo === '0900' ? 'Recordatorio 09:00 AM' : 'Recordatorio 12:00 PM'}).
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `;
        };

        // 5. Enviar notificaciones FCM y Correos a colaboradores elegibles
        const resultadosEnvio = [];
        let exitosEmail = 0;
        let fallosEmail = 0;
        let exitosFCM = 0;
        let fallosFCM = 0;

        for (const colab of colaboradoresElegibles) {
            const uid = colab.uid || colab.id;
            const nombre = colab.nombreCompleto || "Colaborador";
            const email = colab.emailEmpresarial || colab.emailPersonal || colab.email;
            const tokens = Array.isArray(colab.fcmTokens) ? colab.fcmTokens : (colab.fcmToken ? [colab.fcmToken] : []);

            let emailEnviado = false;
            let fcmEnviado = false;
            let errorEmail = null;
            let errorFCM = null;

            // Envío por correo electrónico
            if (email && this.emailService.isConfigured()) {
                try {
                    await this.emailService.sendEmail({
                        to: email,
                        subject: asunto,
                        html: generarHTMLCorreo(nombre)
                    });
                    emailEnviado = true;
                    exitosEmail++;
                } catch (eErr) {
                    errorEmail = eErr.message;
                    fallosEmail++;
                    console.warn(`⚠️ Error enviando correo de recordatorio a ${email}:`, eErr.message);
                }
            }

            // Envío por FCM Push
            const validTokens = tokens.filter(t => t && t.length > 10);
            if (validTokens.length > 0) {
                try {
                    const fcmPromises = validTokens.map(token => {
                        return admin.messaging().send({
                            token: token,
                            notification: {
                                title: esMediodia ? "⚠️ Registro de Asistencia Pendiente" : "⏰ Recordatorio de Asistencia",
                                body: generarMensajeTexto(nombre)
                            },
                            data: {
                                url: "https://rsienterprise.com/partner/asistencia",
                                tipo: "recordatorio_asistencia",
                                fecha: fecha,
                                horario: tipo
                            },
                            webpush: {
                                notification: {
                                    icon: "https://rsienterprise.com/favicon.ico",
                                    badge: "https://rsienterprise.com/favicon.ico"
                                },
                                fcmOptions: {
                                    link: "https://rsienterprise.com/partner/asistencia"
                                }
                            }
                        });
                    });

                    const fcmResults = await Promise.allSettled(fcmPromises);
                    const anySuccess = fcmResults.some(r => r.status === 'fulfilled');
                    if (anySuccess) {
                        fcmEnviado = true;
                        exitosFCM++;
                    } else {
                        fallosFCM++;
                    }
                } catch (fErr) {
                    errorFCM = fErr.message;
                    fallosFCM++;
                    console.warn(`⚠️ Error enviando FCM a colaborador ${uid}:`, fErr.message);
                }
            }

            resultadosEnvio.push({
                uid,
                nombre,
                email,
                tokensCount: validTokens.length,
                emailEnviado,
                fcmEnviado,
                errorEmail,
                errorFCM
            });
        }

        // 6. Guardar auditoría del recordatorio en Firestore
        const logData = {
            id: recordatorioId,
            fecha,
            tipo,
            horarioDesc: tipo === '0900' ? '09:00 AM' : '12:00 PM',
            ejecutadoAt: new Date().toISOString(),
            totalActivos: colaboradoresActivos.length,
            totalElegibles: colaboradoresElegibles.length,
            totalExcluidos: colaboradoresExcluidos.length,
            exitosEmail,
            fallosEmail,
            exitosFCM,
            fallosFCM,
            destinatarios: resultadosEnvio,
            excluidos: colaboradoresExcluidos
        };

        await recordatorioRef.set(logData);
        console.log(`✅ Recordatorio ${recordatorioId} completado y registrado en auditoría.`);

        return {
            success: true,
            registroId: recordatorioId,
            metricas: {
                totalActivos: colaboradoresActivos.length,
                totalElegibles: colaboradoresElegibles.length,
                totalNotificados: resultadosEnvio.length,
                exitosEmail,
                fallosEmail,
                exitosFCM,
                fallosFCM
            }
        };
    }
}

module.exports = RecordatorioAsistenciaService;
