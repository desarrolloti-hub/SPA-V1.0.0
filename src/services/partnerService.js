/* ========================================
   NEW COLLABORATOR SERVICE
   Lógica de negocio con caché y paginación
   ======================================== */

import NewCollaboratorRepository from '../repositories/partnerRepository.js';
import AreaRepository from '../repositories/areaRepository.js';
import PartnerModel from '../models/partnerModel.js';

export class NewCollaboratorService {
    
    constructor() {
        this.repository = new NewCollaboratorRepository();
        this.areaRepository = new AreaRepository();
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const sessionData = JSON.parse(session);
            return sessionData.uid || null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene todas las áreas con sus subáreas para selects (con caché)
     */
    async getAreasForSelect() {
        try {
            return await this.areaRepository.getAreasForSelect(true);
        } catch (error) {
            console.error('❌ Error obteniendo áreas:', error);
            return [];
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID (con caché)
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        return await this.areaRepository.getUserName(uid);
    }

    /**
     * Valida los datos del formulario
     */
    validateForm(data) {
        return PartnerModel.validate(data);
    }

    /**
     * Registra un nuevo colaborador
     */
    async registerCollaborator(data, areaData, subareaData) {
        try {
            const validation = this.validateForm(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const emailExists = await this.repository.checkEmailExists(data.emailEmpresarial);
            if (emailExists) {
                throw new Error('El correo empresarial ya está registrado');
            }

            const creadoPor = this._getCurrentUserUid();
            if (!creadoPor) {
                throw new Error('No se pudo identificar al usuario que realiza el registro');
            }

            const userCredential = await this.repository.createAuthUser(
                data.emailEmpresarial,
                data.password,
                data.nombreCompleto
            );

            const uid = userCredential.user.uid;
            const collaboratorData = PartnerModel.create(data, uid, creadoPor, areaData, subareaData);
            const docId = await this.repository.saveCollaboratorData(uid, collaboratorData);

            return {
                success: true,
                uid: uid,
                docId: docId,
                message: 'Colaborador registrado exitosamente. Se ha enviado un correo de verificación.',
                emailSent: true
            };

        } catch (error) {
            console.error('❌ Error en registerCollaborator:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los colaboradores (con caché)
     */
    async getAllCollaborators(forceRefresh = false) {
        try {
            return await this.repository.getAllCollaborators(forceRefresh);
        } catch (error) {
            console.error('❌ Error en getAllCollaborators:', error);
            throw error;
        }
    }

    /**
     * 🔥 Obtiene colaboradores con paginación
     */
    async getCollaboratorsPaginated(pageSize = 20, page = 1, searchTerm = '') {
        try {
            return await this.repository.getCollaboratorsPaginated(pageSize, page, searchTerm);
        } catch (error) {
            console.error('❌ Error en getCollaboratorsPaginated:', error);
            throw error;
        }
    }

    /**
     * Obtiene un colaborador por ID (con caché)
     */
    async getCollaboratorById(docId, forceRefresh = false) {
        try {
            return await this.repository.getCollaboratorById(docId, forceRefresh);
        } catch (error) {
            console.error('❌ Error en getCollaboratorById:', error);
            return null;
        }
    }

    /**
     * Actualiza un colaborador
     */
    async updateCollaborator(docId, data) {
        try {
            await this.repository.updateCollaborator(docId, data);
            return {
                success: true,
                message: 'Colaborador actualizado exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en updateCollaborator:', error);
            throw error;
        }
    }

    /**
     * Elimina un colaborador (soft delete)
     */
    async deleteCollaborator(docId) {
        try {
            await this.repository.deleteCollaborator(docId);
            return {
                success: true,
                message: 'Colaborador deshabilitado exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en deleteCollaborator:', error);
            throw error;
        }
    }

    /**
     * Elimina permanentemente un colaborador
     */
    async deleteCollaboratorPermanently(docId) {
        try {
            await this.repository.deleteCollaboratorPermanently(docId);
            return {
                success: true,
                message: 'Colaborador eliminado permanentemente'
            };
        } catch (error) {
            console.error('❌ Error en deleteCollaboratorPermanently:', error);
            throw error;
        }
    }

    /**
     * 🔥 Obtiene estadísticas de colaboradores
     */
    async getCollaboratorStats() {
        try {
            return await this.repository.getCollaboratorStats();
        } catch (error) {
            console.error('❌ Error en getCollaboratorStats:', error);
            return { total: 0, active: 0, inactive: 0, verified: 0, unverified: 0 };
        }
    }

    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
        this.areaRepository.clearCache();
    }

    /**
     * Prepara los datos del formulario para enviar
     */
    prepareData(formData) {
        return {
            nombreCompleto: formData.get('nombreCompleto') || '',
            fechaNacimiento: formData.get('fechaNacimiento') || '',
            curp: formData.get('curp') || '',
            rfc: formData.get('rfc') || '',
            estadoCivil: formData.get('estadoCivil') || '',
            nss: formData.get('nss') || '',
            telefonoFijo: formData.get('telefonoFijo') || '',
            telefonoMovil: formData.get('telefonoMovil') || '',
            areaNombre: formData.get('area') || '',
            subareaNombre: formData.get('subarea') || '',
            tipoColaborador: formData.get('tipoColaborador') || '',
            nit: formData.get('nit') || '',
            emailEmpresarial: formData.get('emailEmpresarial') || '',
            emailPersonal: formData.get('emailPersonal') || '',
            password: formData.get('password') || '',
            confirmPassword: formData.get('confirmPassword') || '',
            fotoPerfil: formData.get('fotoPerfil') || ''
        };
    }
}

export default NewCollaboratorService;