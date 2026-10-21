/* ========================================
   REEMBOLSO MODEL - RSI ENTERPRISE
   Modelo, constantes y validaciones para el Módulo de Reembolsos
   Soporta solicitudes propias, reembolsos a otros colaboradores y
   devoluciones totales o parciales (en abonos).
   ======================================== */

export const ESTADOS_REEMBOLSO = {
    PENDIENTE: 'pendiente',
    PARCIAL: 'parcial',
    LIQUIDADO: 'liquidado',
    RECHAZADO: 'rechazado'
};

export const TIPOS_DEVOLUCION = {
    TOTAL: 'total',
    PARCIAL: 'parcial'
};

export const CATEGORIAS_REEMBOLSO = {
    viaticos_transporte: 'Viáticos y Transporte',
    combustible_casetas: 'Combustible y Casetas',
    material_herramientas: 'Material y Herramientas Operativas',
    hospedaje_alimentos: 'Hospedaje y Alimentación',
    papeleria_insumos: 'Papelería e Insumos',
    emergencia_operativa: 'Gasto Operativo / Emergencia',
    otro: 'Otro Concepto'
};

export const METODOS_DEVOLUCION = {
    transferencia: 'Transferencia Bancaria (SPEI)',
    efectivo: 'Efectivo / Caja Chica',
    deposito: 'Depósito en Cuenta',
    nomina: 'Dispersión en Nómina',
    otro: 'Otro Medio'
};

export const ZONA_HORARIA_MEXICO = 'America/Mexico_City';

export class ReembolsoModel {
    /**
     * Obtiene la fecha actual en formato YYYY-MM-DD bajo zona horaria de CDMX
     */
    static getCurrentDateString(date = new Date()) {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: ZONA_HORARIA_MEXICO,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(date);
    }

    /**
     * Redondea un valor numérico a 2 decimales monetarios
     */
    static roundCurrency(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    /**
     * Construye un documento de reembolso normalizado
     */
    static create({
        folio = 'RMB-RSI-000',
        colaboradorUid,
        colaboradorNombre,
        colaboradorEmail = '',
        colaboradorArea = 'General',
        colaboradorFoto = null,
        creadoPorUid = null,
        creadoPorNombre = null,
        creadoPorEmail = '',
        esReembolsoTercero = false,
        fechaGasto = null,
        categoria = 'viaticos_transporte',
        motivo = '',
        referenciaComprobante = '',
        modalidadSolicitada = TIPOS_DEVOLUCION.TOTAL,
        montoSolicitado = 0,
        montoReembolsado = 0,
        evidenciaUrl = null,
        evidenciaPath = null,
        evidenciaNombre = null,
        historialDevoluciones = [],
        estado = null
    }) {
        const now = new Date().toISOString();
        const fechaHoy = this.getCurrentDateString();
        const montoTotal = this.roundCurrency(montoSolicitado);
        const montoPagado = this.roundCurrency(montoReembolsado);
        const saldo = Math.max(0, this.roundCurrency(montoTotal - montoPagado));

        let estadoCalculado = estado;
        if (!estadoCalculado) {
            if (montoPagado <= 0) {
                estadoCalculado = ESTADOS_REEMBOLSO.PENDIENTE;
            } else if (saldo <= 0.009) {
                estadoCalculado = ESTADOS_REEMBOLSO.LIQUIDADO;
            } else {
                estadoCalculado = ESTADOS_REEMBOLSO.PARCIAL;
            }
        }

        const porcentaje = montoTotal > 0
            ? Math.min(100, Math.round((montoPagado / montoTotal) * 100))
            : 0;

        let tipoDevolucionActual = null;
        if (montoPagado > 0) {
            if (historialDevoluciones.length === 1 && saldo <= 0.009) {
                tipoDevolucionActual = TIPOS_DEVOLUCION.TOTAL;
            } else {
                tipoDevolucionActual = TIPOS_DEVOLUCION.PARCIAL;
            }
        }

        return {
            folio,
            colaboradorUid,
            colaboradorNombre: (colaboradorNombre || 'Colaborador').trim(),
            colaboradorEmail: (colaboradorEmail || '').trim(),
            colaboradorArea: (colaboradorArea || 'General').trim(),
            colaboradorFoto: colaboradorFoto || null,
            creadoPorUid: creadoPorUid || colaboradorUid,
            creadoPorNombre: (creadoPorNombre || colaboradorNombre || 'Colaborador').trim(),
            creadoPorEmail: (creadoPorEmail || colaboradorEmail || '').trim(),
            esReembolsoTercero: Boolean(esReembolsoTercero),
            fechaGasto: fechaGasto || fechaHoy,
            fechaRegistro: fechaHoy,
            categoria: CATEGORIAS_REEMBOLSO[categoria] ? categoria : 'otro',
            categoriaNombre: CATEGORIAS_REEMBOLSO[categoria] || CATEGORIAS_REEMBOLSO.otro,
            motivo: (motivo || '').trim(),
            referenciaComprobante: (referenciaComprobante || '').trim(),
            modalidadSolicitada: modalidadSolicitada === TIPOS_DEVOLUCION.PARCIAL
                ? TIPOS_DEVOLUCION.PARCIAL
                : TIPOS_DEVOLUCION.TOTAL,
            montoSolicitado: montoTotal,
            montoReembolsado: montoPagado,
            saldoPendiente: saldo,
            porcentajeReembolsado: porcentaje,
            tipoDevolucionActual,
            estado: estadoCalculado,
            evidenciaUrl: evidenciaUrl || null,
            evidenciaPath: evidenciaPath || null,
            evidenciaNombre: evidenciaNombre || null,
            historialDevoluciones: Array.isArray(historialDevoluciones) ? historialDevoluciones : [],
            ultimoRevisorUid: null,
            ultimoRevisorNombre: null,
            ultimoRevisorEmail: null,
            fechaUltimaResolucion: null,
            comentarioResolucion: null,
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Valida los datos para crear una solicitud o registro de reembolso
     */
    static validate(data = {}, { requireEvidencia = true } = {}) {
        const errors = [];

        if (!data.colaboradorUid) {
            errors.push('Debe seleccionar o identificar al colaborador del reembolso.');
        }

        const monto = this.roundCurrency(data.montoSolicitado);
        if (!monto || monto <= 0) {
            errors.push('El monto del reembolso debe ser mayor a $0.00 MXN.');
        } else if (monto > 1000000) {
            errors.push('El monto solicitado excede el límite permitido por operación ($1,000,000.00 MXN).');
        }

        if (!data.motivo || String(data.motivo).trim().length < 5) {
            errors.push('El motivo del reembolso es obligatorio (mínimo 5 caracteres).');
        } else if (String(data.motivo).trim().length > 1200) {
            errors.push('El motivo no debe exceder 1,200 caracteres.');
        }

        if (data.fechaGasto && !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaGasto)) {
            errors.push('La fecha del gasto debe tener formato válido (YYYY-MM-DD).');
        }

        if (requireEvidencia && !data.archivoEvidencia && !data.evidenciaUrl) {
            errors.push('La evidencia fotográfica del gasto o comprobante es obligatoria.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida una operación de devolución (Total o Parcial) sobre un reembolso
     */
    static validateDevolucion(reembolso, { tipoDevolucion, montoDevolver }) {
        const errors = [];

        if (!reembolso) {
            return { valid: false, errors: ['No se encontró el reembolso especificado.'] };
        }

        if (reembolso.estado === ESTADOS_REEMBOLSO.RECHAZADO) {
            errors.push('No se puede devolver un reembolso que ha sido rechazado.');
        }

        const saldoActual = this.roundCurrency(
            reembolso.saldoPendiente !== undefined
                ? reembolso.saldoPendiente
                : (Number(reembolso.montoSolicitado || 0) - Number(reembolso.montoReembolsado || 0))
        );

        if (saldoActual <= 0.009 || reembolso.estado === ESTADOS_REEMBOLSO.LIQUIDADO) {
            errors.push('Este reembolso ya fue devuelto y liquidado en su totalidad.');
        }

        const monto = tipoDevolucion === TIPOS_DEVOLUCION.TOTAL
            ? saldoActual
            : this.roundCurrency(montoDevolver);

        if (!monto || monto <= 0) {
            errors.push('El monto a devolver debe ser mayor a $0.00 MXN.');
        } else if (monto > saldoActual + 0.009) {
            errors.push(`El monto a devolver ($${monto.toFixed(2)}) no puede ser mayor al saldo pendiente ($${saldoActual.toFixed(2)}).`);
        }

        return {
            valid: errors.length === 0,
            montoValidado: Math.min(monto, saldoActual),
            saldoActual,
            errors
        };
    }

    /**
     * Valida archivo de evidencia fotográfica o comprobante
     */
    static validateArchivoEvidencia(file, { allowPdf = true } = {}) {
        if (!file) {
            return { valid: false, error: 'No se seleccionó ningún archivo de evidencia.' };
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowPdf) {
            allowedTypes.push('application/pdf');
        }

        const maxSizeBytes = 8 * 1024 * 1024; // 8 MB

        if (!allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: allowPdf
                    ? 'Formato no permitido. Sube una fotografía (JPG, PNG, WEBP) o archivo PDF.'
                    : 'Formato no permitido. Sube una fotografía válida (JPG, PNG o WEBP).'
            };
        }

        if (file.size > maxSizeBytes) {
            return {
                valid: false,
                error: `La imagen o archivo excede el límite de 8 MB (actual: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`
            };
        }

        return { valid: true, error: null };
    }
}

export default ReembolsoModel;
