// functions/controllers/asistencia.controller.js
const RecordatorioAsistenciaService = require("../services/recordatorioAsistencia.service");

class AsistenciaController {
    /**
     * Ejecuta el recordatorio automático programado vía Cloud Scheduler (09:00 AM o 12:00 PM)
     */
    async ejecutarRecordatorioProgramado(tipo, params) {
        try {
            console.log(`⏰ [Cloud Scheduler] Ejecutando recordatorio automático de asistencia: ${tipo}...`);
            const service = new RecordatorioAsistenciaService(
                params.EMAIL_USER,
                params.EMAIL_PASSWORD
            );
            const resultado = await service.procesarRecordatorios(tipo, false);
            console.log(`✅ [Cloud Scheduler] Finalizado recordatorio ${tipo}:`, resultado);
            return resultado;
        } catch (error) {
            console.error(`❌ [Cloud Scheduler] Error en recordatorio ${tipo}:`, error);
            throw error;
        }
    }

    /**
     * Procesa la ejecución de recordatorios automáticos de asistencia
     */
    async procesarRecordatorios(req, res, params) {
        try {
            const service = new RecordatorioAsistenciaService(
                params.EMAIL_USER,
                params.EMAIL_PASSWORD
            );

            const tipo = req.body?.tipo || req.query?.tipo || "0900";
            const forzar = req.body?.forzar === true || req.query?.forzar === "true";

            if (tipo !== "0900" && tipo !== "1200") {
                return res.status(400).json({
                    success: false,
                    error: "El parámetro 'tipo' debe ser '0900' (9:00 AM) o '1200' (12:00 PM)."
                });
            }

            const resultado = await service.procesarRecordatorios(tipo, forzar);
            return res.json(resultado);
        } catch (error) {
            console.error("❌ Error en procesarRecordatorios controller:", error);
            return res.status(500).json({
                success: false,
                error: error.message || "Error al procesar los recordatorios de asistencia"
            });
        }
    }
}

module.exports = new AsistenciaController();
