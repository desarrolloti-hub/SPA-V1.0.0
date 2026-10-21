/* ========================================
   ASISTENCIA MODEL - RSI ENTERPRISE
   Modelo y validación para Asistencias y Salidas
   ======================================== */

/**
 * Estados posibles de asistencia
 */
export const ESTADOS_ASISTENCIA = {
    PRESENTE: 'asistencia_registrada',
    RETARDO: 'retardo',
    INASISTENCIA: 'inasistencia'
};

/**
 * Estados posibles de justificación
 */
export const ESTADOS_JUSTIFICACION = {
    SIN_JUSTIFICACION: 'sin_justificacion',
    PENDIENTE: 'pendiente',
    APROBADA: 'aprobada',
    RECHAZADA: 'rechazada'
};

/**
 * Tipos de verificación biométrica
 */
export const TIPOS_VERIFICACION = {
    WEBAUTHN: 'webauthn_passkey',
    DISPOSITIVO_SEGURO: 'dispositivo_seguro',
    SESION_FALLBACK: 'sesion_segura_fallback'
};

export class AsistenciaModel {
    /**
     * Construye un registro de asistencia inicial (Entrada)
     * @param {Object} params
     * @returns {Object} Documento listo para Firestore
     */
    static createEntrada({
        colaboradorUid,
        colaboradorNombre,
        colaboradorEmail,
        colaboradorFoto = null,
        areaId = '',
        areaNombre = '',
        subareaNombre = '',
        fecha, // YYYY-MM-DD
        horaEntrada, // HH:mm:ss
        estado = ESTADOS_ASISTENCIA.PRESENTE,
        minutosRetardo = 0,
        ubicacion = null,
        verificacionBiometrica = null,
        observaciones = ''
    }) {
        const now = new Date().toISOString();

        return {
            colaboradorUid,
            colaboradorNombre: colaboradorNombre || 'Colaborador',
            colaboradorEmail: colaboradorEmail || '',
            colaboradorFoto: colaboradorFoto || null,
            areaId: areaId || '',
            areaNombre: areaNombre || '',
            subareaNombre: subareaNombre || '',
            fecha, // Identificador de la jornada: YYYY-MM-DD
            horaEntrada,
            horaSalida: null,
            entradaTimestamp: now,
            salidaTimestamp: null,
            estado, // asistencia_registrada | retardo | inasistencia
            minutosRetardo: Math.max(0, parseInt(minutosRetardo, 10) || 0),
            tipoRegistro: 'entrada',
            ubicacionEntrada: this.normalizeUbicacion(ubicacion),
            ubicacionSalida: null,
            verificacionBiometrica: this.normalizeBiometria(verificacionBiometrica),
            justificacionId: null,
            estadoJustificacion: ESTADOS_JUSTIFICACION.SIN_JUSTIFICACION,
            observaciones: observaciones || '',
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Prepara los datos de actualización para registrar la salida
     * @param {Object} params
     * @returns {Object}
     */
    static createSalida({
        horaSalida,
        ubicacion = null,
        observaciones = ''
    }) {
        const now = new Date().toISOString();

        return {
            horaSalida,
            salidaTimestamp: now,
            tipoRegistro: 'completo',
            ubicacionSalida: this.normalizeUbicacion(ubicacion),
            observacionesSalida: observaciones || '',
            updatedAt: now
        };
    }

    /**
     * Normaliza los datos de ubicación geográfica
     */
    static normalizeUbicacion(ubicacion) {
        if (!ubicacion) {
            return {
                latitud: null,
                longitud: null,
                precision: null,
                timestamp: null,
                estadoCaptura: 'no_disponible',
                metodo: 'ninguno',
                errorMensaje: 'Ubicación no proporcionada'
            };
        }

        return {
            latitud: typeof ubicacion.latitud === 'number' ? ubicacion.latitud : null,
            longitud: typeof ubicacion.longitud === 'number' ? ubicacion.longitud : null,
            precision: typeof ubicacion.precision === 'number' ? Math.round(ubicacion.precision) : null,
            timestamp: ubicacion.timestamp || new Date().toISOString(),
            estadoCaptura: ubicacion.estadoCaptura || 'ok', // ok | denegado | no_soportado | error
            metodo: ubicacion.metodo || 'geolocalizacion_navegador',
            errorMensaje: ubicacion.errorMensaje || null
        };
    }

    /**
     * Normaliza el resultado de la verificación biométrica
     */
    static normalizeBiometria(bio) {
        if (!bio) {
            return {
                utilizada: false,
                tipo: TIPOS_VERIFICACION.SESION_FALLBACK,
                resultado: 'no_configurado',
                credentialId: null,
                detalles: 'Registro autenticado por sesión de usuario'
            };
        }

        return {
            utilizada: !!bio.utilizada,
            tipo: bio.tipo || TIPOS_VERIFICACION.SESION_FALLBACK,
            resultado: bio.resultado || 'no_disponible', // verificado | no_disponible | omitido
            credentialId: bio.credentialId || null,
            detalles: bio.detalles || ''
        };
    }

    /**
     * Valida si un objeto de asistencia cumple con los campos mínimos
     */
    static validateEntrada(data) {
        const errors = [];

        if (!data.colaboradorUid) errors.push('El identificador del colaborador es requerido');
        if (!data.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
            errors.push('La fecha de la jornada debe tener formato YYYY-MM-DD');
        }
        if (!data.horaEntrada || !/^\d{2}:\d{2}(:\d{2})?$/.test(data.horaEntrada)) {
            errors.push('La hora de entrada es requerida con formato HH:mm o HH:mm:ss');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Determina si la hora de entrada corresponde a presente o retardo según horario y tolerancia
     * @param {string} horaEntrada - Formato HH:mm:ss o HH:mm
     * @param {string} horaOficial - Formato HH:mm (ej: "09:00")
     * @param {number} toleranciaMinutos - Tolerancia en minutos (ej: 15)
     */
    static clasificarHoraEntrada(horaEntrada, horaOficial = '09:00', toleranciaMinutos = 15) {
        if (!horaEntrada) {
            return { estado: ESTADOS_ASISTENCIA.INASISTENCIA, minutosRetardo: 0 };
        }

        const [hE, mE] = horaEntrada.split(':').map(n => parseInt(n, 10));
        const [hO, mO] = horaOficial.split(':').map(n => parseInt(n, 10));

        const minutosEntrada = (hE * 60) + mE;
        const minutosOficial = (hO * 60) + mO;
        const limiteTolerancia = minutosOficial + toleranciaMinutos;

        if (minutosEntrada <= limiteTolerancia) {
            return {
                estado: ESTADOS_ASISTENCIA.PRESENTE,
                minutosRetardo: 0
            };
        }

        const minutosRetardo = minutosEntrada - limiteTolerancia;
        return {
            estado: ESTADOS_ASISTENCIA.RETARDO,
            minutosRetardo
        };
    }

    /**
     * Calcula el tiempo laborado entre la hora de entrada y la hora de salida
     * @param {string|null} horaEntrada - HH:mm:ss o HH:mm
     * @param {string|null} horaSalida - HH:mm:ss o HH:mm
     * @returns {{ texto: string, minutosTotales: number, horasDecimal: number }}
     */
    static calcularHorasTrabajadas(horaEntrada, horaSalida) {
        if (!horaEntrada || !horaSalida) {
            return {
                texto: horaEntrada && !horaSalida ? 'Sin salida' : '--',
                minutosTotales: 0,
                horasDecimal: 0
            };
        }

        const [hE = 0, mE = 0] = String(horaEntrada).split(':').map(n => parseInt(n, 10) || 0);
        const [hS = 0, mS = 0] = String(horaSalida).split(':').map(n => parseInt(n, 10) || 0);

        const minEntrada = (hE * 60) + mE;
        const minSalida = (hS * 60) + mS;
        const diff = Math.max(0, minSalida - minEntrada);

        const horas = Math.floor(diff / 60);
        const mins = diff % 60;

        return {
            texto: `${horas}h ${String(mins).padStart(2, '0')}m`,
            minutosTotales: diff,
            horasDecimal: Number((diff / 60).toFixed(2))
        };
    }
}

export default AsistenciaModel;
