/* ========================================
   JUSTIFICACION MODEL - RSI ENTERPRISE
   Modelo y validación para Justificaciones de Inasistencia
   ======================================== */

import { ESTADOS_JUSTIFICACION } from './asistenciaModel.js';

export class JustificacionModel {
    /**
     * Crea un objeto de justificación
     * @param {Object} params
     * @returns {Object}
     */
    static create({
        asistenciaId = null,
        colaboradorUid,
        colaboradorNombre,
        colaboradorEmail,
        fechaInasistencia, // YYYY-MM-DD
        motivo,
        evidenciaUrl = null,
        evidenciaPath = null,
        evidenciaNombre = null
    }) {
        const now = new Date().toISOString();

        return {
            asistenciaId: asistenciaId || null,
            colaboradorUid,
            colaboradorNombre: colaboradorNombre || 'Colaborador',
            colaboradorEmail: colaboradorEmail || '',
            fechaInasistencia,
            motivo: (motivo || '').trim(),
            evidenciaUrl: evidenciaUrl || null,
            evidenciaPath: evidenciaPath || null,
            evidenciaNombre: evidenciaNombre || null,
            estado: ESTADOS_JUSTIFICACION.PENDIENTE,
            fechaEnvio: now,
            revisadoPorUid: null,
            revisadoPorNombre: null,
            fechaRevision: null,
            comentarioRevision: null,
            historialRevisiones: [
                {
                    accion: 'creada',
                    realizadoPor: colaboradorNombre || colaboradorUid,
                    fecha: now,
                    comentario: 'Justificación enviada para revisión'
                }
            ],
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Valida los datos del formulario de justificación
     */
    static validate(data) {
        const errors = [];

        if (!data.colaboradorUid) {
            errors.push('El identificador del colaborador es requerido');
        }

        if (!data.fechaInasistencia || !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaInasistencia)) {
            errors.push('La fecha de la inasistencia es obligatoria (formato YYYY-MM-DD)');
        }

        if (!data.motivo || data.motivo.trim().length < 10) {
            errors.push('La descripción o motivo debe tener al menos 10 caracteres');
        }

        if (data.motivo && data.motivo.trim().length > 1000) {
            errors.push('El motivo no debe exceder 1000 caracteres');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida el archivo de evidencia adjunto
     * @param {File} file
     * @returns {{ valid: boolean, error: string|null }}
     */
    static validateArchivoEvidencia(file) {
        if (!file) {
            return { valid: true, error: null }; // Evidencia puede ser opcional u obligatoria según política
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

        if (!allowedMimeTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'Formato no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.'
            };
        }

        if (file.size > maxSizeBytes) {
            return {
                valid: false,
                error: `El archivo excede el tamaño máximo permitido de 5 MB (Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`
            };
        }

        return { valid: true, error: null };
    }
}

export default JustificacionModel;
