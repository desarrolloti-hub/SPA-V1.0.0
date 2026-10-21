/* ========================================
   CHECKLIST VEHICULO SERVICE - RSI ENTERPRISE
   Lógica de negocio, validaciones y orquestación
   para checklists de salida, evidencia y firma electrónica
   ======================================== */

import ChecklistVehiculoRepository from '../repositories/checklistVehiculoRepository.js';
import VehiculoRepository from '../repositories/vehiculoRepository.js';
import PartnerRepository, { NewCollaboratorRepository } from '../repositories/partnerRepository.js';
import StorageService from './storageService.js';
import ChecklistVehiculoModel from '../models/checklistVehiculoModel.js';
import GeoMapHelper from '../utils/geoMapHelper.js';
import VehiculoWatermarkHelper from '../utils/vehiculoWatermark.js';

export class ChecklistVehiculoService {
    constructor() {
        this.repository = new ChecklistVehiculoRepository();
        this.vehiculoRepository = new VehiculoRepository();
        this.partnerRepository = new NewCollaboratorRepository();
        this.storageService = new StorageService();
    }

    _getCurrentUser() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            return JSON.parse(session);
        } catch {
            return null;
        }
    }

    _getCurrentUserUid() {
        const u = this._getCurrentUser();
        return u ? (u.uid || u.id) : null;
    }

    _getCurrentUserName() {
        const u = this._getCurrentUser();
        return u ? (u.nombreCompleto || u.displayName || u.email || 'Inspector') : 'Inspector';
    }

    /**
     * Obtiene los vehículos disponibles para iniciar una nueva salida
     * @returns {Promise<Array>}
     */
    async getVehiculosDisponiblesParaSalida() {
        try {
            const all = await this.vehiculoRepository.getAllVehiculos([], true);
            return all.filter(v => v.activo && v.estadoOperativo === 'disponible');
        } catch (error) {
            console.error('❌ Error obteniendo vehículos disponibles:', error);
            return [];
        }
    }

    /**
     * Obtiene la lista de colaboradores para seleccionar al conductor/receptor
     * @returns {Promise<Array>}
     */
    async getColaboradoresParaReceptor() {
        try {
            const colaboradores = await this.partnerRepository.getAllCollaborators(true);
            return (colaboradores || []).map(c => ({
                id: c.id,
                uid: c.uid || c.id,
                nombreCompleto: c.nombreCompleto || `${c.nombre || ''} ${c.apellidos || ''}`.trim() || c.email || 'Colaborador',
                email: c.emailEmpresarial || c.email || '',
                puesto: c.puestoNombre || c.puesto || '',
                area: c.areaNombre || c.area || ''
            }));
        } catch (error) {
            console.error('❌ Error obteniendo colaboradores:', error);
            return [];
        }
    }

    /**
     * Procesa una fotografía tomada con cámara o seleccionada de galería:
     * Le estampa la marca de agua con Logo RSI, Fecha/Hora CDMX, GPS y datos del vehículo
     * @param {Object} params
     * @param {File|Blob|HTMLVideoElement} params.source
     * @param {string} params.placas
     * @param {string} params.numeroEconomico
     * @param {string} params.categoriaLabel
     * @param {Object|null} [params.ubicacion]
     * @returns {Promise<{ blob: Blob, dataUrl: string, ubicacion: Object, fechaHora: Object }>}
     */
    async procesarFotografiaConMarcaDeAgua({
        source,
        placas,
        numeroEconomico,
        categoriaLabel,
        ubicacion = null
    }) {
        try {
            const inspectorNombre = this._getCurrentUserName();
            let geo = ubicacion;
            if (!geo) {
                try {
                    geo = await GeoMapHelper.obtenerPosicionActual();
                } catch {
                    geo = null;
                }
            }

            const resultado = await VehiculoWatermarkHelper.estamparMarcaDeAgua({
                source,
                placas,
                numeroEconomico,
                categoriaLabel,
                colaboradorNombre: inspectorNombre,
                ubicacion: geo
            });

            return {
                blob: resultado.blob,
                dataUrl: resultado.dataUrl,
                ubicacion: geo,
                fechaHora: resultado.fechaHora
            };
        } catch (error) {
            console.error('❌ Error procesando fotografía con marca de agua:', error);
            throw error;
        }
    }

    /**
     * Registra un nuevo checklist de salida vehicular con sus fotografías y asigna el receptor
     * @param {Object} formData
     * @returns {Promise<{ success: boolean, folio?: string, docId?: string, error?: string }>}
     */
    async registrarSalidaVehicular(formData) {
        try {
            const inspectorUid = this._getCurrentUserUid();
            const inspectorNombre = this._getCurrentUserName();

            if (!inspectorUid) {
                return { success: false, error: 'Debes iniciar sesión para realizar la inspección de salida vehicular.' };
            }

            // Obtener vehículo actual
            const vehiculo = await this.vehiculoRepository.getVehiculoById(formData.vehiculoId, true);
            if (!vehiculo) {
                return { success: false, error: 'El vehículo seleccionado no existe.' };
            }

            if (!vehiculo.activo) {
                return { success: false, error: 'El vehículo seleccionado está inactivo.' };
            }

            if (vehiculo.estadoOperativo !== 'disponible') {
                return { success: false, error: `El vehículo no está disponible para salida (Estado actual: ${vehiculo.estadoOperativo}).` };
            }

            // Validar kilometraje mínimo
            const kmMinimo = vehiculo.kilometrajeActual || 0;
            const validation = ChecklistVehiculoModel.validateSalida(formData, kmMinimo);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join('<br>') };
            }

            // Generar folio consecutivo atómico
            const { folio } = await this.repository.generarFolioAtomic();

            // Subir fotografías a Firebase Storage
            const evidenciasProcesadas = [];
            const rawEvidencias = formData.evidencias || [];

            for (const ev of rawEvidencias) {
                if (ev.blob) {
                    const uploadRes = await this.storageService.uploadVehiculoFoto(
                        ev.blob,
                        vehiculo.placas,
                        folio,
                        ev.categoria
                    );

                    if (!uploadRes.success) {
                        throw new Error(`Fallo al subir fotografía de ${ev.categoriaLabel || ev.categoria}: ${uploadRes.error}`);
                    }

                    evidenciasProcesadas.push({
                        id: ev.id || `foto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        categoria: ev.categoria,
                        categoriaLabel: ev.categoriaLabel || ev.categoria,
                        url: uploadRes.url,
                        path: uploadRes.path,
                        timestamp: new Date().toISOString(),
                        ubicacion: ev.ubicacion || null,
                        subidoPorUid: inspectorUid,
                        subidoPorNombre: inspectorNombre
                    });
                } else if (ev.url) {
                    evidenciasProcesadas.push(ev);
                }
            }

            // Construir payload del checklist
            const checklistPayload = ChecklistVehiculoModel.create({
                folio,
                vehiculoId: vehiculo.id,
                vehiculoPlacas: vehiculo.placas,
                vehiculoNumEconomico: vehiculo.numeroEconomico,
                vehiculoInfo: {
                    marca: vehiculo.marca,
                    modelo: vehiculo.modelo,
                    anio: vehiculo.anio,
                    color: vehiculo.color
                },
                inspectorUid,
                inspectorNombre,
                inspectorEmail: this._getCurrentUser()?.email || '',
                receptorUid: formData.receptorUid,
                receptorNombre: formData.receptorNombre,
                receptorEmail: formData.receptorEmail || '',
                receptorPuesto: formData.receptorPuesto || '',
                receptorArea: formData.receptorArea || '',
                kilometrajeSalida: parseFloat(formData.kilometrajeSalida),
                nivelCombustibleSalida: formData.nivelCombustibleSalida,
                motivoSalida: formData.motivoSalida,
                destinoSalida: formData.destinoSalida,
                respuestasChecklist: formData.respuestasChecklist,
                evidencias: evidenciasProcesadas,
                observacionesGenerales: formData.observacionesGenerales
            });

            // Guardar atómicamente el checklist y cambiar estado del auto a 'salida_pendiente'
            const result = await this.repository.createChecklistSalida(checklistPayload);

            return {
                success: true,
                folio: result.folio,
                docId: result.docId,
                message: `Salida vehicular registrada con folio ${result.folio}. Se encuentra en espera de firma y aceptación por el colaborador asignado.`
            };
        } catch (error) {
            console.error('❌ Error en registrarSalidaVehicular:', error);
            return { success: false, error: error.message || 'Error al guardar el checklist de salida' };
        }
    }

    /**
     * Obtiene los checklists de salida pendientes de aceptación para el colaborador actual
     * @returns {Promise<Array>}
     */
    async getMisSalidasPendientesDeAceptacion() {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) return [];
            return await this.repository.getChecklistsPendientesReceptor(uid);
        } catch (error) {
            console.error('❌ Error obteniendo salidas pendientes de firma:', error);
            return [];
        }
    }

    /**
     * Obtiene el listado de todas las salidas asignadas al colaborador actual (propias)
     * @returns {Promise<Array>}
     */
    async getMisSalidasVehiculares() {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) return [];
            return await this.repository.getChecklistsByReceptor(uid);
        } catch (error) {
            console.error('❌ Error obteniendo mis salidas vehiculares:', error);
            return [];
        }
    }

    /**
     * Obtiene el detalle de un checklist por su ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getChecklistDetalle(id) {
        try {
            return await this.repository.getChecklistById(id, true);
        } catch (error) {
            console.error('❌ Error obteniendo detalle del checklist:', error);
            return null;
        }
    }

    /**
     * Obtiene el listado completo de checklists para el historial general
     * @param {Object} [filtros]
     * @returns {Promise<Array>}
     */
    async getHistorialChecklists(filtros = {}) {
        try {
            let checklists = await this.repository.getAllChecklists(true);

            if (filtros.estado && filtros.estado !== 'todos') {
                checklists = checklists.filter(c => c.estado === filtros.estado);
            }

            if (filtros.busqueda && filtros.busqueda.trim()) {
                const term = filtros.busqueda.trim().toLowerCase();
                checklists = checklists.filter(c => {
                    const folio = (c.folio || '').toLowerCase();
                    const placas = (c.vehiculoPlacas || '').toLowerCase();
                    const eco = (c.vehiculoNumEconomico || '').toLowerCase();
                    const rec = (c.receptorNombre || '').toLowerCase();
                    const insp = (c.inspectorNombre || '').toLowerCase();
                    return folio.includes(term) || placas.includes(term) || eco.includes(term) || rec.includes(term) || insp.includes(term);
                });
            }

            return checklists;
        } catch (error) {
            console.error('❌ Error obteniendo historial general de checklists:', error);
            return [];
        }
    }

    /**
     * Firma y acepta la salida vehicular exclusivamente por el colaborador receptor
     * @param {string} checklistId
     * @param {Object} firmaParams - { firmaBlob, firmaDataUrl, declaracionAceptada, observacionesReceptor }
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async firmarAceptacionSalida(checklistId, firmaParams) {
        try {
            const currentUid = this._getCurrentUserUid();
            const currentNombre = this._getCurrentUserName();

            if (!currentUid) {
                return { success: false, error: 'Sesión no válida o expirada.' };
            }

            const checklist = await this.repository.getChecklistById(checklistId, true);
            if (!checklist) {
                return { success: false, error: 'La inspección de salida vehicular no existe.' };
            }

            // Validar que el usuario que firma sea exactamente el receptor asignado
            const validation = ChecklistVehiculoModel.validateFirmaAceptacion(firmaParams, checklist.receptorUid, currentUid);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(' ') };
            }

            if (checklist.estado !== 'pendiente_aceptacion') {
                return { success: false, error: `Esta salida vehicular ya fue procesada (Estado actual: ${checklist.estado}).` };
            }

            // Subir firma PNG a Firebase Storage
            const uploadFirmaRes = await this.storageService.uploadVehiculoFirma(
                firmaParams.firmaBlob,
                checklist.folio,
                currentUid
            );

            if (!uploadFirmaRes.success) {
                return { success: false, error: `Error al almacenar la firma digital: ${uploadFirmaRes.error}` };
            }

            // Transición atómica en base de datos
            await this.repository.firmarAceptacionAtomic(checklistId, {
                firmaUrl: uploadFirmaRes.url,
                firmaPath: uploadFirmaRes.path,
                declaracionAceptada: true,
                observacionesReceptor: firmaParams.observacionesReceptor || '',
                receptorUid: currentUid,
                receptorNombre: currentNombre
            });

            return {
                success: true,
                message: `Salida vehicular ${checklist.folio} aceptada y firmada exitosamente. El vehículo ahora se encuentra en ruta bajo tu resguardo.`
            };
        } catch (error) {
            console.error('❌ Error al firmar aceptación de salida vehicular:', error);
            return { success: false, error: error.message || 'Error al procesar la firma digital' };
        }
    }

    /**
     * Cancela una salida vehicular si aún no ha sido aceptada
     * @param {string} checklistId
     * @param {string} motivo
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async cancelarSalida(checklistId, motivo) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) return { success: false, error: 'Sesión requerida' };

            await this.repository.cancelarSalidaAtomic(checklistId, motivo, uid);
            return {
                success: true,
                message: 'Salida vehicular cancelada y vehículo liberado a disponible.'
            };
        } catch (error) {
            console.error('❌ Error cancelando salida vehicular:', error);
            return { success: false, error: error.message || 'Error al cancelar la salida' };
        }
    }
}

export default ChecklistVehiculoService;
