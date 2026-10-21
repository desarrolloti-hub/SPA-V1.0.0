/* ========================================
   JUSTIFICACION SERVICE - RSI ENTERPRISE
   Lógica de negocio para registro y resolución administrativa de justificaciones
   ======================================== */

import JustificacionRepository from '../repositories/justificacionRepository.js';
import AsistenciaRepository from '../repositories/asistenciaRepository.js';
import NewCollaboratorRepository from '../repositories/partnerRepository.js';
import JustificacionModel from '../models/justificacionModel.js';
import StorageService from './storageService.js';
import AuthService from './authService.js';
import { ESTADOS_ASISTENCIA, ESTADOS_JUSTIFICACION } from '../models/asistenciaModel.js';

export class JustificacionService {
    constructor() {
        this.justificacionRepo = new JustificacionRepository();
        this.asistenciaRepo = new AsistenciaRepository();
        this.partnerRepo = new NewCollaboratorRepository();
        this.storageService = new StorageService();
        this.authService = new AuthService();
    }

    _getSession() {
        return this.authService.getSession();
    }

    _isAdmin(session = null) {
        const user = session || this._getSession();
        return user && (user.rol === 'admin' || user.tipoColaborador === 'administrador');
    }

    /**
     * Obtiene el nombre completo, correo y puesto del usuario en sesión que otorga el permiso
     */
    async _obtenerDatosAutorizador(session) {
        if (!session || !session.uid) {
            return {
                uid: 'unknown',
                nombre: 'Usuario',
                email: '',
                rol: ''
            };
        }

        const construirNombre = (obj) => {
            if (!obj) return '';
            if (obj.nombreCompleto && String(obj.nombreCompleto).trim()) {
                return String(obj.nombreCompleto).trim();
            }
            const partes = [obj.nombre, obj.apellidoPaterno, obj.apellidoMaterno]
                .filter(Boolean)
                .map(p => String(p).trim());
            return partes.join(' ').trim();
        };

        let nombre = construirNombre(session) || session.displayName || '';
        let email = session.emailEmpresarial || session.email || '';
        let rol = session.rol || session.tipoColaborador || 'partner';

        // Si el nombre en sesión no está completo o coincide con el correo, buscar en colaboradores
        if (!nombre || nombre === email) {
            try {
                const colab = await this.partnerRepo.getById(session.uid);
                if (colab) {
                    nombre = construirNombre(colab) || nombre;
                    email = colab.emailEmpresarial || colab.emailPersonal || email;
                    rol = colab.rol || colab.tipoColaborador || rol;
                }
            } catch (err) {
                console.warn('⚠️ No se pudo enriquecer nombre de autorizador desde partnerRepo:', err.message);
            }
        }

        return {
            uid: session.uid,
            nombre: nombre || email || 'Colaborador Autorizado',
            email,
            rol
        };
    }

    /**
     * Envía una justificación de inasistencia con evidencia adjunta
     * @param {Object} params
     * @param {string} params.fechaInasistencia - YYYY-MM-DD
     * @param {string} params.motivo - Motivo detallado
     * @param {File|null} params.archivoEvidencia - Archivo de imagen o PDF
     * @param {string|null} params.asistenciaId - ID de asistencia si existe
     * @returns {Promise<{ success: boolean, id?: string, error?: string, message?: string }>}
     */
    async enviarJustificacion({ fechaInasistencia, motivo, archivoEvidencia = null, asistenciaId = null }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return { success: false, error: 'Debe iniciar sesión para enviar una justificación.' };
        }

        // 1. Validar modelo de datos
        const validacionModelo = JustificacionModel.validate({
            colaboradorUid: session.uid,
            fechaInasistencia,
            motivo
        });

        if (!validacionModelo.valid) {
            return { success: false, error: validacionModelo.errors.join('. ') };
        }

        // 1.1 Validar estrictamente que sea un día de inasistencia (que no haya registrado asistencia ese día)
        try {
            const asistenciaDia = await this.asistenciaRepo.getAsistenciaHoy(session.uid, fechaInasistencia, true);
            if (asistenciaDia && (asistenciaDia.horaEntrada || asistenciaDia.estado === ESTADOS_ASISTENCIA.PRESENTE || asistenciaDia.estado === ESTADOS_ASISTENCIA.RETARDO)) {
                return {
                    success: false,
                    error: `No es posible justificar el día ${fechaInasistencia} porque ya cuentas con registro de asistencia (${asistenciaDia.horaEntrada || 'registrada'}). Solo se pueden justificar días en los que no asististe.`
                };
            }
            if (asistenciaDia && (asistenciaDia.estadoJustificacion === ESTADOS_JUSTIFICACION.PENDIENTE || asistenciaDia.estadoJustificacion === ESTADOS_JUSTIFICACION.APROBADA)) {
                return {
                    success: false,
                    error: `El día ${fechaInasistencia} ya cuenta con una justificación ${asistenciaDia.estadoJustificacion}.`
                };
            }
        } catch (verifErr) {
            console.warn('⚠️ Advertencia verificando asistencia previa para justificación:', verifErr.message);
        }

        // 2. Validar archivo de evidencia si se proporcionó
        if (archivoEvidencia) {
            const validacionArchivo = JustificacionModel.validateArchivoEvidencia(archivoEvidencia);
            if (!validacionArchivo.valid) {
                return { success: false, error: validacionArchivo.error };
            }
        }

        // 3. Subir archivo a Firebase Storage (si existe)
        let evidenciaUrl = null;
        let evidenciaPath = null;
        let evidenciaNombre = null;

        if (archivoEvidencia) {
            const extension = (archivoEvidencia.name.split('.').pop() || 'jpg').toLowerCase();
            const fileName = `${session.uid}_${fechaInasistencia}_${Date.now()}.${extension}`;

            const uploadResult = await this.storageService.uploadEvidencia(archivoEvidencia, fileName);
            if (!uploadResult.success) {
                return {
                    success: false,
                    error: `Error al subir la evidencia: ${uploadResult.error}`
                };
            }

            evidenciaUrl = uploadResult.url;
            evidenciaPath = uploadResult.path;
            evidenciaNombre = archivoEvidencia.name;
        }

        // 4. Crear modelo estructurado
        const payload = JustificacionModel.create({
            asistenciaId: asistenciaId || `${session.uid}_${fechaInasistencia}`,
            colaboradorUid: session.uid,
            colaboradorNombre: session.nombreCompleto || session.displayName || 'Colaborador',
            colaboradorEmail: session.emailEmpresarial || session.email || '',
            fechaInasistencia,
            motivo,
            evidenciaUrl,
            evidenciaPath,
            evidenciaNombre
        });

        // 5. Persistir en Firestore
        const resultado = await this.justificacionRepo.crearJustificacion(payload);
        return resultado;
    }

    /**
     * Obtiene el listado de justificaciones del colaborador autenticado
     */
    async getMisJustificaciones() {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('Sesión no encontrada');
        }

        return await this.justificacionRepo.getJustificacionesPorColaborador(session.uid);
    }

    /**
     * Obtiene el detalle de una justificación específica
     */
    async getDetalleJustificacion(justificacionId) {
        const session = this._getSession();
        if (!session || !session.uid) {
            throw new Error('Sesión no encontrada');
        }

        const justificacion = await this.justificacionRepo.getJustificacionPorId(justificacionId);
        if (!justificacion) {
            throw new Error('Justificación no encontrada');
        }

        return justificacion;
    }

    /**
     * Resolución de justificación (Aprobar / Rechazar) almacenando quién otorgó el permiso
     * @param {Object} params
     * @param {string} params.justificacionId
     * @param {string} params.estado - 'aprobada' | 'rechazada'
     * @param {string} params.comentario - Motivo de la resolución
     */
    async resolverJustificacion({ justificacionId, estado, comentario = '' }) {
        const session = this._getSession();
        if (!session || !session.uid) {
            return {
                success: false,
                error: 'Debe iniciar sesión para validar o rechazar una justificación.'
            };
        }

        const justificacion = await this.justificacionRepo.getJustificacionPorId(justificacionId);
        if (!justificacion) {
            return { success: false, error: 'No se encontró la justificación especificada.' };
        }

        const autorizador = await this._obtenerDatosAutorizador(session);

        return await this.justificacionRepo.resolverJustificacion(justificacionId, {
            estado,
            revisorUid: autorizador.uid,
            revisorNombre: autorizador.nombre,
            revisorEmail: autorizador.email,
            revisorRol: autorizador.rol,
            comentario: (comentario || '').trim()
        });
    }
}

export default JustificacionService;

