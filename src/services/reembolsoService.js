/* ========================================
   REEMBOLSO SERVICE - RSI ENTERPRISE
   Lógica de negocio para:
   1. Solicitud/registro de reembolso propio con evidencia fotográfica
   2. Creación de reembolsos a otros colaboradores
   3. Devolución de reembolsos en modalidad Total o Parcial (abonos)
   4. Consulta mensual aislada y panel administrativo con métricas
   ======================================== */

import ReembolsoRepository from '../repositories/reembolsoRepository.js';
import NewCollaboratorRepository from '../repositories/partnerRepository.js';
import StorageService from './storageService.js';
import AuthService from './authService.js';
import {
    ReembolsoModel,
    ESTADOS_REEMBOLSO,
    TIPOS_DEVOLUCION,
    CATEGORIAS_REEMBOLSO,
    METODOS_DEVOLUCION
} from '../models/reembolsoModel.js';

export class ReembolsoService {
    constructor() {
        this.reembolsoRepo = new ReembolsoRepository();
        this.partnerRepo = new NewCollaboratorRepository();
        this.storageService = new StorageService();
        this.authService = new AuthService();
    }

    _getSession() {
        return this.authService.getSession();
    }

    _construirNombreCompleto(obj) {
        if (!obj) return '';
        if (obj.nombreCompleto && String(obj.nombreCompleto).trim()) {
            return String(obj.nombreCompleto).trim();
        }
        const partes = [obj.nombre, obj.apellidoPaterno, obj.apellidoMaterno]
            .filter(Boolean)
            .map(p => String(p).trim());
        return partes.join(' ').trim();
    }

    /**
     * Obtiene los datos enriquecidos de cualquier colaborador o del usuario en sesión
     */
    async _obtenerPerfilColaborador(uid, fallbackObj = null) {
        let nombre = this._construirNombreCompleto(fallbackObj) || fallbackObj?.displayName || '';
        let email = fallbackObj?.emailEmpresarial || fallbackObj?.email || '';
        let area = fallbackObj?.areaNombre || fallbackObj?.subareaNombre || fallbackObj?.subarea || 'General';
        let foto = fallbackObj?.fotoPerfil || null;
        let rol = fallbackObj?.rol || fallbackObj?.tipoColaborador || 'partner';

        if (uid) {
            try {
                let colab = await this.partnerRepo.getById(uid);
                if (!colab && typeof this.partnerRepo.getCollaboratorByUid === 'function') {
                    colab = await this.partnerRepo.getCollaboratorByUid(uid);
                }
                if (colab) {
                    nombre = this._construirNombreCompleto(colab) || nombre;
                    email = colab.emailEmpresarial || colab.emailPersonal || email;
                    area = colab.areaNombre || colab.subareaNombre || colab.subarea || area;
                    foto = (colab.fotoPerfil && typeof colab.fotoPerfil === 'object')
                        ? colab.fotoPerfil.url
                        : (colab.fotoPerfil || foto);
                    rol = colab.rol || colab.tipoColaborador || rol;
                }
            } catch (err) {
                console.warn('⚠️ Advertencia obteniendo perfil de colaborador:', err.message);
            }
        }

        return {
            uid: uid || fallbackObj?.uid || 'unknown',
            nombre: nombre || email || 'Colaborador RSI',
            email,
            area: area || 'General',
            foto,
            rol
        };
    }

    /**
     * Obtiene la lista de colaboradores activos para selectores del panel
     */
    async getColaboradoresActivos() {
        try {
            const todos = await this.partnerRepo.getAll([], null, 'asc');
            return todos
                .filter(c => c.status !== 'inactive' && c.activo !== false)
                .map(c => {
                    const foto = (c.fotoPerfil && typeof c.fotoPerfil === 'object')
                        ? c.fotoPerfil.url
                        : (c.fotoPerfil || '/assets/images/default-avatar.png');
                    return {
                        uid: c.uid || c.id,
                        id: c.id,
                        nombreCompleto: this._construirNombreCompleto(c) || c.emailEmpresarial || 'Colaborador',
                        emailEmpresarial: c.emailEmpresarial || c.emailPersonal || '',
                        areaNombre: c.areaNombre || c.subareaNombre || c.subarea || 'General',
                        puestoNombre: c.puestoNombre || c.puesto || 'Colaborador',
                        fotoPerfil: foto
                    };
                })
                .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
        } catch (error) {
            console.error('❌ Error obteniendo colaboradores para reembolsos:', error);
            return [];
        }
    }

    /**
     * Crea un reembolso propio del colaborador autenticado (requiere monto, motivo y evidencia fotográfica)
     */
    async crearMiReembolso({
        montoSolicitado,
        categoria = 'viaticos_transporte',
        fechaGasto = null,
        motivo = '',
        referenciaComprobante = '',
        modalidadSolicitada = TIPOS_DEVOLUCION.TOTAL,
        archivoEvidencia = null
    }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Tu sesión ha expirado. Inicia sesión nuevamente.' };
        }

        const validacion = ReembolsoModel.validate(
            {
                colaboradorUid: session.uid,
                montoSolicitado,
                motivo,
                fechaGasto,
                archivoEvidencia
            },
            { requireEvidencia: true }
        );

        if (!validacion.valid) {
            return { success: false, error: validacion.errors.join(' ') };
        }

        const validacionArchivo = ReembolsoModel.validateArchivoEvidencia(archivoEvidencia, { allowPdf: true });
        if (!validacionArchivo.valid) {
            return { success: false, error: validacionArchivo.error };
        }

        // Subir evidencia fotográfica a Firebase Storage
        const uploadRes = await this.storageService.uploadReembolsoEvidencia(
            archivoEvidencia,
            'evidencias',
            session.uid
        );

        if (!uploadRes.success) {
            return {
                success: false,
                error: `No se pudo subir la evidencia fotográfica: ${uploadRes.error}`
            };
        }

        const perfil = await this._obtenerPerfilColaborador(session.uid, session);

        const payload = ReembolsoModel.create({
            colaboradorUid: perfil.uid,
            colaboradorNombre: perfil.nombre,
            colaboradorEmail: perfil.email,
            colaboradorArea: perfil.area,
            colaboradorFoto: perfil.foto,
            creadoPorUid: perfil.uid,
            creadoPorNombre: perfil.nombre,
            creadoPorEmail: perfil.email,
            esReembolsoTercero: false,
            fechaGasto: fechaGasto || ReembolsoModel.getCurrentDateString(),
            categoria,
            motivo,
            referenciaComprobante,
            modalidadSolicitada,
            montoSolicitado,
            montoReembolsado: 0,
            evidenciaUrl: uploadRes.url,
            evidenciaPath: uploadRes.path,
            evidenciaNombre: archivoEvidencia.name || 'evidencia_reembolso.jpg'
        });

        const res = await this.reembolsoRepo.crearReembolsoTransaccional(payload);
        if (!res.success) {
            return res;
        }

        return {
            success: true,
            id: res.id,
            folio: res.folio,
            data: res.data,
            message: `Tu solicitud de reembolso ${res.folio} por $${ payload.montoSolicitado.toFixed(2) } MXN fue registrada correctamente.`
        };
    }

    /**
     * Registra un reembolso destinado a otro colaborador desde el panel de gestión.
     * Permite dejarlo pendiente o aplicar en el mismo acto una devolución Total o Parcial.
     */
    async crearReembolsoAColaborador({
        colaboradorUid,
        montoSolicitado,
        categoria = 'viaticos_transporte',
        fechaGasto = null,
        motivo = '',
        referenciaComprobante = '',
        modalidadSolicitada = TIPOS_DEVOLUCION.TOTAL,
        archivoEvidencia = null,
        aplicarDevolucionInmediata = false,
        tipoDevolucionInicial = TIPOS_DEVOLUCION.TOTAL,
        montoDevolucionInicial = 0,
        metodoPagoInicial = 'transferencia',
        referenciaPagoInicial = '',
        comentarioDevolucionInicial = '',
        archivoComprobantePago = null
    }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para registrar un reembolso a un colaborador.' };
        }

        const validacion = ReembolsoModel.validate(
            {
                colaboradorUid,
                montoSolicitado,
                motivo,
                fechaGasto,
                archivoEvidencia
            },
            { requireEvidencia: true }
        );

        if (!validacion.valid) {
            return { success: false, error: validacion.errors.join(' ') };
        }

        const validacionEvidencia = ReembolsoModel.validateArchivoEvidencia(archivoEvidencia, { allowPdf: true });
        if (!validacionEvidencia.valid) {
            return { success: false, error: validacionEvidencia.error };
        }

        const montoTotal = ReembolsoModel.roundCurrency(montoSolicitado);
        let montoInicialPagado = 0;

        if (aplicarDevolucionInmediata) {
            montoInicialPagado = tipoDevolucionInicial === TIPOS_DEVOLUCION.TOTAL
                ? montoTotal
                : ReembolsoModel.roundCurrency(montoDevolucionInicial);

            if (!montoInicialPagado || montoInicialPagado <= 0) {
                return { success: false, error: 'El monto de la devolución inicial debe ser mayor a $0.00 MXN.' };
            }
            if (montoInicialPagado > montoTotal + 0.009) {
                return {
                    success: false,
                    error: `El monto a devolver ($${montoInicialPagado.toFixed(2)}) no puede exceder el monto total del reembolso ($${montoTotal.toFixed(2)}).`
                };
            }
            montoInicialPagado = Math.min(montoInicialPagado, montoTotal);
        }

        // 1. Subir evidencia fotográfica del gasto
        const uploadEvidenciaRes = await this.storageService.uploadReembolsoEvidencia(
            archivoEvidencia,
            'evidencias',
            colaboradorUid
        );

        if (!uploadEvidenciaRes.success) {
            return {
                success: false,
                error: `Error al subir la evidencia fotográfica: ${uploadEvidenciaRes.error}`
            };
        }

        // 2. Si hay comprobante de pago inicial, subirlo también
        let comprobantePagoUrl = null;
        let comprobantePagoPath = null;
        let comprobantePagoNombre = null;

        if (aplicarDevolucionInmediata && archivoComprobantePago) {
            const valComp = ReembolsoModel.validateArchivoEvidencia(archivoComprobantePago, { allowPdf: true });
            if (!valComp.valid) {
                return { success: false, error: `Comprobante de pago inválido: ${valComp.error}` };
            }
            const upComp = await this.storageService.uploadReembolsoEvidencia(
                archivoComprobantePago,
                'comprobantes',
                colaboradorUid
            );
            if (!upComp.success) {
                return { success: false, error: `Error al subir comprobante de devolución: ${upComp.error}` };
            }
            comprobantePagoUrl = upComp.url;
            comprobantePagoPath = upComp.path;
            comprobantePagoNombre = archivoComprobantePago.name;
        }

        // 3. Obtener perfiles del colaborador beneficiario y de quien registra
        const [perfilBeneficiario, perfilAutorizador] = await Promise.all([
            this._obtenerPerfilColaborador(colaboradorUid),
            this._obtenerPerfilColaborador(session.uid, session)
        ]);

        const historialInicial = [];
        const nowIso = new Date().toISOString();

        if (aplicarDevolucionInmediata && montoInicialPagado > 0) {
            const saldoRestante = Math.max(0, ReembolsoModel.roundCurrency(montoTotal - montoInicialPagado));
            const esLiquidacionTotal = saldoRestante <= 0.009;
            historialInicial.push({
                id: `DEV-${Date.now()}`,
                numeroAbono: 1,
                tipo: esLiquidacionTotal ? TIPOS_DEVOLUCION.TOTAL : TIPOS_DEVOLUCION.PARCIAL,
                subtipo: esLiquidacionTotal ? TIPOS_DEVOLUCION.TOTAL : TIPOS_DEVOLUCION.PARCIAL,
                monto: montoInicialPagado,
                saldoAnterior: montoTotal,
                saldoRestante,
                metodoPago: METODOS_DEVOLUCION[metodoPagoInicial] ? metodoPagoInicial : 'transferencia',
                metodoPagoNombre: METODOS_DEVOLUCION[metodoPagoInicial] || METODOS_DEVOLUCION.transferencia,
                referenciaPago: (referenciaPagoInicial || '').trim(),
                comentario: (comentarioDevolucionInicial || '').trim() || (esLiquidacionTotal ? 'Devolución total aplicada al registrar reembolso' : 'Devolución parcial aplicada al registrar reembolso'),
                comprobanteUrl: comprobantePagoUrl,
                comprobantePath: comprobantePagoPath,
                comprobanteNombre: comprobantePagoNombre,
                fecha: nowIso,
                realizadoPorUid: perfilAutorizador.uid,
                realizadoPorNombre: perfilAutorizador.nombre,
                realizadoPorEmail: perfilAutorizador.email,
                realizadoPorRol: perfilAutorizador.rol
            });
        }

        const payload = ReembolsoModel.create({
            colaboradorUid: perfilBeneficiario.uid,
            colaboradorNombre: perfilBeneficiario.nombre,
            colaboradorEmail: perfilBeneficiario.email,
            colaboradorArea: perfilBeneficiario.area,
            colaboradorFoto: perfilBeneficiario.foto,
            creadoPorUid: perfilAutorizador.uid,
            creadoPorNombre: perfilAutorizador.nombre,
            creadoPorEmail: perfilAutorizador.email,
            esReembolsoTercero: perfilBeneficiario.uid !== perfilAutorizador.uid,
            fechaGasto: fechaGasto || ReembolsoModel.getCurrentDateString(),
            categoria,
            motivo,
            referenciaComprobante,
            modalidadSolicitada: aplicarDevolucionInmediata ? tipoDevolucionInicial : modalidadSolicitada,
            montoSolicitado: montoTotal,
            montoReembolsado: montoInicialPagado,
            evidenciaUrl: uploadEvidenciaRes.url,
            evidenciaPath: uploadEvidenciaRes.path,
            evidenciaNombre: archivoEvidencia.name || 'evidencia_reembolso.jpg',
            historialDevoluciones: historialInicial
        });

        if (aplicarDevolucionInmediata && montoInicialPagado > 0) {
            payload.ultimoRevisorUid = perfilAutorizador.uid;
            payload.ultimoRevisorNombre = perfilAutorizador.nombre;
            payload.ultimoRevisorEmail = perfilAutorizador.email;
            payload.fechaUltimaResolucion = nowIso;
            payload.comentarioResolucion = historialInicial[0].comentario;
        }

        const res = await this.reembolsoRepo.crearReembolsoTransaccional(payload);
        if (!res.success) {
            return res;
        }

        return {
            success: true,
            id: res.id,
            folio: res.folio,
            data: res.data,
            message: aplicarDevolucionInmediata
                ? `Reembolso ${res.folio} registrado para ${perfilBeneficiario.nombre} con devolución ${payload.estado === ESTADOS_REEMBOLSO.LIQUIDADO ? 'TOTAL' : 'PARCIAL'} de $${montoInicialPagado.toFixed(2)} MXN.`
                : `Reembolso ${res.folio} registrado para ${perfilBeneficiario.nombre} por $${montoTotal.toFixed(2)} MXN.`
        };
    }

    /**
     * Registra una devolución Total o Parcial sobre un reembolso existente
     */
    async devolverReembolso({
        reembolsoId,
        tipoDevolucion = TIPOS_DEVOLUCION.TOTAL,
        montoDevolver = 0,
        metodoPago = 'transferencia',
        referenciaPago = '',
        comentario = '',
        archivoComprobante = null
    }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para procesar una devolución de reembolso.' };
        }

        const reembolsoActual = await this.reembolsoRepo.getById(reembolsoId, true);
        if (!reembolsoActual) {
            return { success: false, error: 'No se encontró el reembolso especificado.' };
        }

        const validacion = ReembolsoModel.validateDevolucion(reembolsoActual, {
            tipoDevolucion,
            montoDevolver
        });

        if (!validacion.valid) {
            return { success: false, error: validacion.errors.join(' ') };
        }

        let comprobanteUrl = null;
        let comprobantePath = null;
        let comprobanteNombre = null;

        if (archivoComprobante) {
            const validacionArchivo = ReembolsoModel.validateArchivoEvidencia(archivoComprobante, { allowPdf: true });
            if (!validacionArchivo.valid) {
                return { success: false, error: validacionArchivo.error };
            }

            const uploadRes = await this.storageService.uploadReembolsoEvidencia(
                archivoComprobante,
                'comprobantes',
                reembolsoActual.folio || reembolsoId
            );

            if (!uploadRes.success) {
                return {
                    success: false,
                    error: `No se pudo subir el comprobante de devolución: ${uploadRes.error}`
                };
            }

            comprobanteUrl = uploadRes.url;
            comprobantePath = uploadRes.path;
            comprobanteNombre = archivoComprobante.name;
        }

        const autorizador = await this._obtenerPerfilColaborador(session.uid, session);

        return await this.reembolsoRepo.registrarDevolucionTransaccional(reembolsoId, {
            tipoDevolucion,
            montoDevolver: validacion.montoValidado,
            metodoPago,
            referenciaPago,
            comentario,
            comprobanteUrl,
            comprobantePath,
            comprobanteNombre,
            realizadoPorUid: autorizador.uid,
            realizadoPorNombre: autorizador.nombre,
            realizadoPorEmail: autorizador.email,
            realizadoPorRol: autorizador.rol
        });
    }

    /**
     * Rechaza un reembolso pendiente almacenando quién dictaminó el rechazo
     */
    async rechazarReembolso({ reembolsoId, comentario = '' }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para rechazar un reembolso.' };
        }

        if (!comentario || String(comentario).trim().length < 5) {
            return { success: false, error: 'Por favor indica el motivo del rechazo (mínimo 5 caracteres).' };
        }

        const autorizador = await this._obtenerPerfilColaborador(session.uid, session);

        return await this.reembolsoRepo.rechazarReembolsoTransaccional(reembolsoId, {
            comentario,
            realizadoPorUid: autorizador.uid,
            realizadoPorNombre: autorizador.nombre,
            realizadoPorEmail: autorizador.email,
            realizadoPorRol: autorizador.rol
        });
    }

    /**
     * Obtiene los reembolsos propios del colaborador autenticado en el mes seleccionado
     * (Por defecto el mes en curso en America/Mexico_City)
     */
    async getMisReembolsos({ anio = null, mes = null, estado = 'todos', forceRefresh = false } = {}) {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('Sesión no activa');
        }

        const fechaHoyStr = ReembolsoModel.getCurrentDateString();
        const [anioHoy, mesHoy] = fechaHoyStr.split('-').map(Number);

        const anioConsulta = Number(anio) || anioHoy;
        const mesConsulta = Number(mes) || mesHoy;

        let registros = await this.reembolsoRepo.getReembolsosColaboradorPorMes(
            session.uid,
            anioConsulta,
            mesConsulta,
            forceRefresh
        );

        // Calcular métricas globales del mes para el colaborador antes de filtrar por estado visual
        const metricas = this._calcularMetricasReembolsos(registros);

        if (estado && estado !== 'todos') {
            registros = registros.filter(r => r.estado === estado);
        }

        return {
            reembolsos: registros,
            metricas,
            periodo: {
                anio: anioConsulta,
                mes: mesConsulta,
                esMesActual: anioConsulta === anioHoy && mesConsulta === mesHoy
            }
        };
    }

    /**
     * Obtiene todos los reembolsos del periodo para el Panel de Gestión de Reembolsos a Colaboradores
     */
    async getReembolsosAdmin({
        anio = null,
        mes = null,
        quincena = 'todas',
        colaboradorUid = 'todos',
        estado = 'todos',
        tipoDevolucion = 'todos',
        forceRefresh = false
    } = {}) {
        const fechaHoyStr = ReembolsoModel.getCurrentDateString();
        const [anioHoy, mesHoy] = fechaHoyStr.split('-').map(Number);

        const anioNum = Number(anio) || anioHoy;
        const mesNum = Number(mes) || mesHoy;
        const mesPad = String(mesNum).padStart(2, '0');
        const ultimoDiaMes = new Date(anioNum, mesNum, 0).getDate();

        let diaInicio = 1;
        let diaFin = ultimoDiaMes;

        if (quincena === 'primera') {
            diaInicio = 1;
            diaFin = 15;
        } else if (quincena === 'segunda') {
            diaInicio = 16;
            diaFin = ultimoDiaMes;
        }

        const fechaInicio = `${anioNum}-${mesPad}-${String(diaInicio).padStart(2, '0')}`;
        const fechaFin = `${anioNum}-${mesPad}-${String(diaFin).padStart(2, '0')}`;

        const [reembolsosRaw, colaboradores] = await Promise.all([
            this.reembolsoRepo.getReembolsosPorPeriodo(
                {
                    fechaInicio,
                    fechaFin,
                    colaboradorUid: colaboradorUid !== 'todos' ? colaboradorUid : null,
                    estado: null
                },
                forceRefresh
            ),
            this.getColaboradoresActivos()
        ]);

        const mapaColabs = new Map();
        colaboradores.forEach(c => {
            if (c.uid) mapaColabs.set(c.uid, c);
            if (c.id) mapaColabs.set(c.id, c);
        });

        let reembolsosEnriquecidos = reembolsosRaw.map(r => {
            const colab = mapaColabs.get(r.colaboradorUid);
            const montoSolicitado = ReembolsoModel.roundCurrency(r.montoSolicitado || 0);
            const montoReembolsado = ReembolsoModel.roundCurrency(r.montoReembolsado || 0);
            const saldoPendiente = Math.max(0, ReembolsoModel.roundCurrency(montoSolicitado - montoReembolsado));
            const porcentajeReembolsado = montoSolicitado > 0
                ? Math.min(100, Math.round((montoReembolsado / montoSolicitado) * 100))
                : 0;

            return {
                ...r,
                colaboradorNombre: colab?.nombreCompleto || r.colaboradorNombre || 'Colaborador',
                colaboradorEmail: colab?.emailEmpresarial || r.colaboradorEmail || '',
                colaboradorArea: colab?.areaNombre || r.colaboradorArea || 'General',
                colaboradorPuesto: colab?.puestoNombre || 'Colaborador',
                colaboradorFoto: colab?.fotoPerfil || r.colaboradorFoto || '/assets/images/default-avatar.png',
                categoriaNombre: CATEGORIAS_REEMBOLSO[r.categoria] || r.categoriaNombre || 'Otro Concepto',
                montoSolicitado,
                montoReembolsado,
                saldoPendiente,
                porcentajeReembolsado
            };
        });

        const metricasPeriodo = this._calcularMetricasReembolsos(reembolsosEnriquecidos);

        if (estado && estado !== 'todos') {
            reembolsosEnriquecidos = reembolsosEnriquecidos.filter(r => r.estado === estado);
        }

        if (tipoDevolucion && tipoDevolucion !== 'todos') {
            reembolsosEnriquecidos = reembolsosEnriquecidos.filter(r => {
                if (tipoDevolucion === TIPOS_DEVOLUCION.TOTAL) {
                    return r.tipoDevolucionActual === TIPOS_DEVOLUCION.TOTAL ||
                        (r.estado === ESTADOS_REEMBOLSO.LIQUIDADO && (r.historialDevoluciones?.length || 0) <= 1);
                }
                if (tipoDevolucion === TIPOS_DEVOLUCION.PARCIAL) {
                    return r.estado === ESTADOS_REEMBOLSO.PARCIAL ||
                        r.tipoDevolucionActual === TIPOS_DEVOLUCION.PARCIAL ||
                        (r.historialDevoluciones?.length || 0) > 1;
                }
                return true;
            });
        }

        let detalleColaborador = null;
        if (colaboradorUid && colaboradorUid !== 'todos') {
            const colabInfo = mapaColabs.get(colaboradorUid) || {
                uid: colaboradorUid,
                nombreCompleto: reembolsosEnriquecidos[0]?.colaboradorNombre || 'Colaborador',
                emailEmpresarial: reembolsosEnriquecidos[0]?.colaboradorEmail || '',
                areaNombre: reembolsosEnriquecidos[0]?.colaboradorArea || 'General',
                fotoPerfil: reembolsosEnriquecidos[0]?.colaboradorFoto || '/assets/images/default-avatar.png'
            };

            const metricasColab = this._calcularMetricasReembolsos(reembolsosEnriquecidos);
            detalleColaborador = {
                ...colabInfo,
                metricas: metricasColab
            };
        }

        return {
            reembolsos: reembolsosEnriquecidos,
            colaboradores,
            metricas: metricasPeriodo,
            detalleColaborador,
            periodo: {
                anio: anioNum,
                mes: mesNum,
                quincena,
                fechaInicio,
                fechaFin
            }
        };
    }

    _calcularMetricasReembolsos(lista = []) {
        let montoTotalSolicitado = 0;
        let montoTotalDevuelto = 0;
        let saldoTotalPendiente = 0;
        let pendientes = 0;
        let parciales = 0;
        let liquidados = 0;
        let rechazados = 0;

        lista.forEach(item => {
            const solicitado = ReembolsoModel.roundCurrency(item.montoSolicitado || 0);
            const devuelto = ReembolsoModel.roundCurrency(item.montoReembolsado || 0);
            const saldo = item.estado === ESTADOS_REEMBOLSO.RECHAZADO
                ? 0
                : Math.max(0, ReembolsoModel.roundCurrency(solicitado - devuelto));

            if (item.estado !== ESTADOS_REEMBOLSO.RECHAZADO) {
                montoTotalSolicitado = ReembolsoModel.roundCurrency(montoTotalSolicitado + solicitado);
                montoTotalDevuelto = ReembolsoModel.roundCurrency(montoTotalDevuelto + devuelto);
                saldoTotalPendiente = ReembolsoModel.roundCurrency(saldoTotalPendiente + saldo);
            }

            if (item.estado === ESTADOS_REEMBOLSO.PENDIENTE) pendientes++;
            else if (item.estado === ESTADOS_REEMBOLSO.PARCIAL) parciales++;
            else if (item.estado === ESTADOS_REEMBOLSO.LIQUIDADO) liquidados++;
            else if (item.estado === ESTADOS_REEMBOLSO.RECHAZADO) rechazados++;
        });

        return {
            totalRegistros: lista.length,
            montoTotalSolicitado,
            montoTotalDevuelto,
            saldoTotalPendiente,
            pendientes,
            parciales,
            liquidados,
            rechazados
        };
    }
}

export default ReembolsoService;
