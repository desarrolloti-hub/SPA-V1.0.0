// functions/controllers/tickets.controller.js
const TicketSchedulerService = require("../services/ticketScheduler.service");

class TicketsController {
    /**
     * Ejecuta la revisión programada vía Cloud Scheduler (08:00 AM)
     */
    async ejecutarRevisionProgramada(params) {
        try {
            console.log("⏰ [Cloud Scheduler] Ejecutando revisión de tickets vencidos y recordatorios...");
            const service = new TicketSchedulerService(
                params.EMAIL_USER,
                params.EMAIL_PASSWORD
            );
            const resultado = await service.procesarRevisionTickets();
            console.log("✅ [Cloud Scheduler] Finalizada revisión de tickets:", resultado);
            return resultado;
        } catch (error) {
            console.error("❌ [Cloud Scheduler] Error en revisión de tickets:", error);
            throw error;
        }
    }

    /**
     * Endpoint HTTP auxiliar (para webhook o pruebas de sincronización)
     */
    async procesarRevisionTickets(req, res, params) {
        try {
            const service = new TicketSchedulerService(
                params.EMAIL_USER,
                params.EMAIL_PASSWORD
            );
            const resultado = await service.procesarRevisionTickets();
            return res.json(resultado);
        } catch (error) {
            console.error("❌ Error en procesarRevisionTickets controller:", error);
            return res.status(500).json({
                success: false,
                error: error.message || "Error al procesar la revisión de tickets"
            });
        }
    }
}

module.exports = new TicketsController();
