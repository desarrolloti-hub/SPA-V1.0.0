/* ========================================
   CHECKLIST VEHICULO MODEL - RSI ENTERPRISE
   Modelo y validación para el checklist y control de salida vehicular
   ======================================== */

export class ChecklistVehiculoModel {
    /**
     * Estados de la salida vehicular
     */
    static ESTADOS_SALIDA = {
        PENDIENTE_ACEPTACION: 'pendiente_aceptacion',
        ACEPTADA: 'aceptada',
        RECHAZADA: 'rechazada',
        CONCLUIDA: 'concluida',
        CANCELADA: 'cancelada'
    };

    /**
     * Estados de cada ítem del checklist
     */
    static ESTADOS_ITEM = {
        CORRECTO: 'correcto',
        CON_OBSERVACIONES: 'con_observaciones',
        NO_APLICA: 'no_aplica'
    };

    /**
     * Categorías de evidencia fotográfica obligatorias para una salida regular
     */
    static FOTOGRAFIAS_OBLIGATORIAS = [
        { id: 'frente', label: 'Frente del Vehículo' },
        { id: 'trasera', label: 'Parte Trasera' },
        { id: 'lateral_izq', label: 'Lateral Izquierdo' },
        { id: 'lateral_der', label: 'Lateral Derecho' },
        { id: 'tablero_km', label: 'Tablero (Kilometraje y Combustible)' },
        { id: 'interior', label: 'Interior / Cabina' }
    ];

    /**
     * Estructura base de inspección por categorías
     */
    static getCatalogoInspeccion() {
        return [
            {
                categoriaId: 'exterior',
                categoriaNombre: 'Exterior y Carrocería',
                items: [
                    { id: 'frente_trasera', label: 'Frente, fascia y defensa trasera' },
                    { id: 'laterales', label: 'Costados y laterales (izquierdo y derecho)' },
                    { id: 'puertas_cristales', label: 'Puertas, manijas y cristales laterales' },
                    { id: 'parabrisas', label: 'Parabrisas y medallón (sin fisuras o estrelladuras)' },
                    { id: 'espejos', label: 'Espejos retrovisores laterales y central' },
                    { id: 'pintura_carroceria', label: 'Pintura, rayones, abolladuras o golpes visibles' },
                    { id: 'placas_visibles', label: 'Placas delantera y trasera firmes y legibles' }
                ]
            },
            {
                categoriaId: 'llantas_equipo',
                categoriaNombre: 'Llantas y Equipo de Emergencia',
                items: [
                    { id: 'llantas_rodamiento', label: 'Estado visible de las 4 llantas (presión y dibujo)' },
                    { id: 'llanta_refaccion', label: 'Llanta de refacción (presión adecuada)' },
                    { id: 'herramientas', label: 'Gato hidráulico / llave de cruz / reflejantes' },
                    { id: 'luces_faros', label: 'Faros delanteros, cuartos, direccionales e intermitentes' },
                    { id: 'luces_freno', label: 'Luces traseras de freno y reversa' },
                    { id: 'limpiaparabrisas', label: 'Gomas y funcionamiento de limpiaparabrisas' }
                ]
            },
            {
                categoriaId: 'interior',
                categoriaNombre: 'Interior y Cabina',
                items: [
                    { id: 'tablero_testigos', label: 'Tablero e indicadores (sin testigos de falla activados)' },
                    { id: 'asientos_tapiceria', label: 'Asientos, vestiduras y tapicería limpios y sin roturas' },
                    { id: 'cinturones_seguridad', label: 'Cinturones de seguridad operativos en todas las plazas' },
                    { id: 'limpieza_general', label: 'Limpieza y orden general de la cabina y cajuela' },
                    { id: 'accesorios_cabina', label: 'Tapetes, encendedor/puertos USB y accesorios entregados' }
                ]
            },
            {
                categoriaId: 'condiciones_operativas',
                categoriaNombre: 'Condiciones Operativas y Documentos',
                items: [
                    { id: 'nivel_combustible_chk', label: 'Medición de combustible registrada correctamente' },
                    { id: 'mecanica_visible', label: 'Fugas visibles de fluidos o ruidos anómalos' },
                    { id: 'documentacion', label: 'Tarjeta de circulación y póliza de seguro vigentes en guantera' }
                ]
            }
        ];
    }

    /**
     * Construye un nuevo registro de Checklist de Salida para Firestore
     * @param {Object} params
     * @returns {Object}
     */
    static create(params) {
        const now = new Date().toISOString();
        return {
            folio: params.folio, // Ej: SAL-RSI-1001
            vehiculoId: params.vehiculoId,
            vehiculoPlacas: (params.vehiculoPlacas || '').toUpperCase(),
            vehiculoNumEconomico: (params.vehiculoNumEconomico || '').toUpperCase(),
            vehiculoInfo: {
                marca: params.vehiculoInfo?.marca || '',
                modelo: params.vehiculoInfo?.modelo || '',
                anio: params.vehiculoInfo?.anio || '',
                color: params.vehiculoInfo?.color || ''
            },
            // Inspector (quien llena el formulario y revisa el vehículo)
            inspectorUid: params.inspectorUid,
            inspectorNombre: params.inspectorNombre,
            inspectorEmail: params.inspectorEmail || '',
            // Receptor (el colaborador asignado que conducirá y retirará el vehículo)
            receptorUid: params.receptorUid,
            receptorNombre: params.receptorNombre,
            receptorEmail: params.receptorEmail || '',
            receptorPuesto: params.receptorPuesto || '',
            receptorArea: params.receptorArea || '',
            // Métricas de salida
            kilometrajeSalida: parseFloat(params.kilometrajeSalida) || 0,
            nivelCombustibleSalida: params.nivelCombustibleSalida || '1/2',
            motivoSalida: (params.motivoSalida || '').trim(),
            destinoSalida: (params.destinoSalida || '').trim(),
            // Estructura de respuestas del checklist
            respuestasChecklist: params.respuestasChecklist || {},
            // Fotografías de evidencia
            evidencias: params.evidencias || [], // [{ id, categoria, url, path, timestamp, ubicacion, subidoPorUid }]
            observacionesGenerales: (params.observacionesGenerales || '').trim(),
            // Estado de la salida
            estado: this.ESTADOS_SALIDA.PENDIENTE_ACEPTACION,
            // Aceptación y firma electrónica del receptor
            aceptacion: {
                firmado: false,
                firmaUrl: null,
                firmaPath: null,
                fechaHoraFirma: null,
                firmadoPorUid: null,
                firmadoPorNombre: null,
                declaracionAceptada: false,
                observacionesReceptor: '',
                ipCliente: null
            },
            // Datos para retorno posterior
            retorno: {
                completado: false,
                fechaHoraRetorno: null,
                kilometrajeRetorno: null,
                nivelCombustibleRetorno: null,
                recibidoPorUid: null,
                recibidoPorNombre: null,
                observacionesRetorno: '',
                evidenciasRetorno: []
            },
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Valida los datos requeridos antes de guardar un checklist de salida
     * @param {Object} data
     * @param {number} kilometrajeMinimo - Kilometraje actual del auto registrado en el sistema
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validateSalida(data, kilometrajeMinimo = 0) {
        const errors = [];

        if (!data.vehiculoId) {
            errors.push('Debe seleccionar un vehículo para la salida.');
        }

        if (!data.receptorUid) {
            errors.push('Debe asignar al colaborador que conducirá y retirará el vehículo.');
        }

        const km = parseFloat(data.kilometrajeSalida);
        if (isNaN(km) || km < 0) {
            errors.push('El kilometraje de salida debe ser un número válido mayor o igual a cero.');
        } else if (km < kilometrajeMinimo) {
            errors.push(`El kilometraje de salida (${km.toLocaleString()} km) no puede ser menor al kilometraje actual registrado del vehículo (${kilometrajeMinimo.toLocaleString()} km).`);
        }

        if (!data.nivelCombustibleSalida) {
            errors.push('Debe registrar el nivel de combustible al momento de la salida.');
        }

        // Validar que se hayan respondido todos los ítems del catálogo de inspección
        const catalogo = this.getCatalogoInspeccion();
        const respuestas = data.respuestasChecklist || {};
        
        for (const cat of catalogo) {
            for (const item of cat.items) {
                const resp = respuestas[item.id];
                if (!resp || !resp.estado) {
                    errors.push(`Falta responder el ítem "${item.label}" en la sección "${cat.categoriaNombre}".`);
                } else if (resp.estado === this.ESTADOS_ITEM.CON_OBSERVACIONES && (!resp.observacion || !resp.observacion.trim())) {
                    errors.push(`Debe ingresar una observación detallada para "${item.label}" al marcarlo con observaciones.`);
                }
            }
        }

        // Validar fotografías mínimas obligatorias
        const evidencias = Array.isArray(data.evidencias) ? data.evidencias : [];
        for (const reqFoto of this.FOTOGRAFIAS_OBLIGATORIAS) {
            const hasFoto = evidencias.some(ev => ev.categoria === reqFoto.id && (ev.url || ev.blob || ev.dataUrl));
            if (!hasFoto) {
                errors.push(`Falta la fotografía obligatoria de: ${reqFoto.label}.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida los requisitos de aceptación y firma electrónica del receptor
     * @param {Object} params
     * @param {string} receptorUid - UID del receptor asignado
     * @param {string} currentAuthUid - UID del usuario autenticado que intenta firmar
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validateFirmaAceptacion(params, receptorUid, currentAuthUid) {
        const errors = [];

        if (!currentAuthUid || currentAuthUid !== receptorUid) {
            errors.push('La firma de aceptación debe ser realizada exclusivamente por el colaborador asignado para retirar el vehículo.');
        }

        if (!params.firmaBlob && !params.firmaDataUrl) {
            errors.push('Debe plasmar su firma digital en el lienzo para confirmar la aceptación.');
        }

        if (!params.declaracionAceptada) {
            errors.push('Debe marcar la casilla de conformidad y declaración de responsabilidad del vehículo.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export default ChecklistVehiculoModel;
