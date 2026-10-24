// functions/services/ticketScheduler.service.js
const admin = require("firebase-admin");
const EmailService = require("./email.service");

class TicketSchedulerService {
    constructor(emailUserParam, emailPasswordParam) {
        this.emailService = new EmailService(emailUserParam, emailPasswordParam);
        this.db = admin.firestore();
        this.zonaHoraria = "America/Mexico_City";
    }

    /**
     * Obtiene la fecha en formato YYYY-MM-DD en la zona horaria de México
     * @param {number} offsetDays - Días a desplazar (0 para hoy, 1 para mañana, etc.)
     */
    getFechaMexico(offsetDays = 0) {
        const d = new Date();
        if (offsetDays !== 0) {
            d.setDate(d.getDate() + offsetDays);
        }
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: this.zonaHoraria,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
        return formatter.format(d);
    }

    /**
     * Ejecuta la revisión diaria de tickets:
     * 1. Notifica a los asignados 1 día antes del vencimiento.
     * 2. Pasa a 'abandonado' los tickets cuya fechaFin ya pasó sin evidencias de todos los asignados.
     */
    async procesarRevisionTickets() {
        const hoy = this.getFechaMexico(0);
        const manana = this.getFechaMexico(1);
        const nowIso = new Date().toISOString();

        console.log(`⏰ [TicketScheduler] Iniciando revisión de tickets para hoy (${hoy}) y vencimientos mañana (${manana})`);

        // Obtener tickets activos (pendiente o en_proceso)
        const ticketsSnap = await this.db.collection("ticketsOperaciones")
            .where("estado", "in", ["pendiente", "en_proceso"])
            .get();

        if (ticketsSnap.empty) {
            console.log("ℹ️ [TicketScheduler] No hay tickets activos para revisar.");
            return {
                success: true,
                totalRevisados: 0,
                abandonados: 0,
                recordatoriosEnviados: 0
            };
        }

        // Cache de colaboradores
        const usersSnap = await this.db.collection("usersRSI").get();
        const usersMap = {};
        usersSnap.forEach(uDoc => {
            const data = uDoc.data();
            const uid = data.uid || uDoc.id;
            usersMap[uid] = { id: uDoc.id, uid, ...data };
            if (data.collaboratorId) {
                usersMap[data.collaboratorId] = { id: uDoc.id, uid, ...data };
            }
        });

        let abandonadosCount = 0;
        let recordatoriosCount = 0;

        for (const doc of ticketsSnap.docs) {
            const ticket = doc.data();
            const ticketId = doc.id;
            const folio = ticket.idTicket || ticketId;
            const fechaFinStr = (ticket.fechaFin || "").split("T")[0];

            if (!fechaFinStr) continue;

            const asignados = Array.isArray(ticket.colaboradoresIds) ? ticket.colaboradoresIds : [];
            const evidenciasRaw = ticket.evidencias || {};
            const todasEvidencias = [
                ...(Array.isArray(evidenciasRaw.antes) ? evidenciasRaw.antes : []),
                ...(Array.isArray(evidenciasRaw.durante) ? evidenciasRaw.durante : []),
                ...(Array.isArray(evidenciasRaw.despues) ? evidenciasRaw.despues : [])
            ];

            // 1. Verificar si venció (fechaFin < hoy) -> Evaluar Abandono
            if (fechaFinStr < hoy) {
                // Verificar si todos los asignados subieron al menos 1 evidencia
                let faltanEvidencias = false;
                for (const colabId of asignados) {
                    const tiene = todasEvidencias.some(e => 
                        (e.subidoPorId && (e.subidoPorId === colabId || e.subidoPorUid === colabId)) ||
                        (e.subidoPorUid && (e.subidoPorUid === colabId || e.subidoPorId === colabId))
                    );
                    if (!tiene) {
                        faltanEvidencias = true;
                        break;
                    }
                }

                // Si falta evidencia de algún asignado o no fue cerrado formalmente
                if (faltanEvidencias || asignados.length === 0) {
                    const historialCambios = Array.isArray(ticket.historialCambios) ? [...ticket.historialCambios] : [];
                    historialCambios.push({
                        estadoAnterior: ticket.estado,
                        estadoNuevo: "abandonado",
                        tipoEvento: "abandono_automatico",
                        cambiadoPor: "Sistema Automático RSI",
                        cambiadoPorId: "system",
                        fechaCambio: nowIso,
                        motivo: `Ticket marcado en abandono por vencer su fecha límite (${fechaFinStr}) sin registrar las evidencias requeridas.`
                    });

                    await doc.ref.update({
                        estado: "abandonado",
                        fechaAbandono: nowIso,
                        motivoAbandono: `Vencimiento de fecha límite (${fechaFinStr}) sin completar evidencias requeridas de actividades.`,
                        historialCambios,
                        [`historial.${nowIso}`]: {
                            evento: "abandono",
                            usuario: "Sistema Automático RSI",
                            usuarioId: "system",
                            descripcion: `Ticket ${folio} marcado en abandono por vencimiento de fecha límite sin evidencias completas.`,
                            timestamp: nowIso
                        }
                    });

                    console.log(`⚠️ Ticket ${folio} (${ticketId}) actualizado a estado ABANDONADO.`);
                    abandonadosCount++;
                }
            }
            // 2. Recordatorio 1 día antes (fechaFin == manana)
            else if (fechaFinStr === manana && !ticket.recordatorioAbandonoEnviado) {
                const correosDestino = [];
                const nombresDestino = [];

                asignados.forEach(cId => {
                    const u = usersMap[cId];
                    if (u && u.email && !correosDestino.includes(u.email)) {
                        correosDestino.push(u.email);
                        nombresDestino.push(u.nombreCompleto || u.displayName || u.nombre || "Colaborador");
                    }
                });

                if (correosDestino.length > 0) {
                    try {
                        const htmlContent = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                                <div style="background-color: #0d2c54; padding: 15px; border-radius: 6px; text-align: center; color: white;">
                                    <h2 style="margin: 0;">Fénix RSI Enterprise</h2>
                                    <p style="margin: 5px 0 0; font-size: 0.9em;">Recordatorio Importante de Ticket</p>
                                </div>
                                <div style="padding: 20px 0;">
                                    <h3 style="color: #d97706;">⚠️ Tu ticket vence mañana (${fechaFinStr})</h3>
                                    <p>Estimado(a) colaborador(a):</p>
                                    <p>El ticket <strong>${folio}</strong> — <em>"${ticket.titulo || 'Sin título'}"</em> tiene fecha programada de término para el día de mañana.</p>
                                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
                                        <strong>Recuerda:</strong> Es obligatorio que todas las personas asignadas suban sus evidencias fotográficas (Antes, Durante y Después) y registren sus actividades desarrolladas. Si no se concluye a tiempo, el ticket pasará automáticamente a estado <strong>Abandonado</strong>.
                                    </div>
                                    <p>Por favor ingresa al sistema y concluye tus registros.</p>
                                </div>
                                <div style="text-align: center; font-size: 0.8em; color: #888; border-top: 1px solid #eee; padding-top: 10px;">
                                    Notificación automática generada por Fénix RSI Enterprise
                                </div>
                            </div>
                        `;

                        await this.emailService.sendEmail({
                            to: correosDestino.join(","),
                            subject: `⚠️ Recordatorio: Ticket ${folio} vence mañana (${fechaFinStr})`,
                            html: htmlContent
                        });

                        recordatoriosCount++;
                        console.log(`📧 Recordatorio de vencimiento enviado a ${correosDestino.join(", ")} para ticket ${folio}`);
                    } catch (mailErr) {
                        console.warn(`⚠️ Error enviando correo de recordatorio para ticket ${folio}:`, mailErr.message);
                    }
                }

                await doc.ref.update({
                    recordatorioAbandonoEnviado: true,
                    fechaRecordatorioAbandono: nowIso
                });
            }
        }

        return {
            success: true,
            totalRevisados: ticketsSnap.size,
            abandonados: abandonadosCount,
            recordatoriosEnviados: recordatoriosCount
        };
    }
}

module.exports = TicketSchedulerService;
