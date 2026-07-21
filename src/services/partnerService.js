/* ========================================
   NEW COLLABORATOR SERVICE
   Lógica de negocio
   ======================================== */

import NewCollaboratorRepository from '../repositories/partnerRepository.js';

export class NewCollaboratorService {
    
    constructor() {
        this.repository = new NewCollaboratorRepository();
    }

    /**
     * Valida todos los campos del formulario
     * @param {Object} data - Datos del formulario
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateForm(data) {
        const errors = {};

        // Paso 1: Información personal
        if (!data.nombreCompleto || data.nombreCompleto.trim().length < 3) {
            errors.nombreCompleto = 'El nombre completo es requerido (mínimo 3 caracteres)';
        }

        if (!data.fechaNacimiento) {
            errors.fechaNacimiento = 'La fecha de nacimiento es requerida';
        }

        if (!data.curp || data.curp.length !== 18) {
            errors.curp = 'CURP inválido (18 caracteres)';
        }

        if (!data.rfc || data.rfc.length < 12) {
            errors.rfc = 'RFC inválido (mínimo 12 caracteres)';
        }

        if (!data.estadoCivil) {
            errors.estadoCivil = 'El estado civil es requerido';
        }

        if (!data.telefonoMovil || data.telefonoMovil.length < 10) {
            errors.telefonoMovil = 'Teléfono móvil inválido (mínimo 10 dígitos)';
        }

        // Paso 2: Información laboral
        if (!data.area) {
            errors.area = 'El área es requerida';
        }

        if (!data.subarea) {
            errors.subarea = 'La subárea es requerida';
        }

        if (!data.tipoColaborador) {
            errors.tipoColaborador = 'El tipo de colaborador es requerido';
        }

        // Paso 3: Información de contacto
        if (!data.emailEmpresarial || !this._isValidEmail(data.emailEmpresarial)) {
            errors.emailEmpresarial = 'Correo empresarial inválido';
        }

        if (!data.emailPersonal || !this._isValidEmail(data.emailPersonal)) {
            errors.emailPersonal = 'Correo personal inválido';
        }

        if (!data.password || data.password.length < 6) {
            errors.password = 'La contraseña debe tener al menos 6 caracteres';
        }

        if (data.password !== data.confirmPassword) {
            errors.confirmPassword = 'Las contraseñas no coinciden';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida un email
     * @param {string} email
     * @returns {boolean}
     */
    _isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Registra un nuevo colaborador
     * @param {Object} data - Datos del formulario
     * @returns {Promise<Object>} - Resultado del registro
     */
    async registerCollaborator(data) {
        try {
            // 1. Validar datos
            const validation = this.validateForm(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            // 2. Verificar si el email ya existe
            const emailExists = await this.repository.checkEmailExists(data.emailEmpresarial);
            if (emailExists) {
                throw new Error('El correo empresarial ya está registrado');
            }

            // 3. Crear usuario en Auth
            const userCredential = await this.repository.createAuthUser(
                data.emailEmpresarial,
                data.password
            );

            const uid = userCredential.user.uid;

            // 4. Preparar datos para Firestore
            const collaboratorData = {
                nombreCompleto: data.nombreCompleto.trim(),
                fechaNacimiento: data.fechaNacimiento,
                curp: data.curp.toUpperCase(),
                rfc: data.rfc.toUpperCase(),
                estadoCivil: data.estadoCivil,
                nss: data.nss || '',
                telefonoFijo: data.telefonoFijo || '',
                telefonoMovil: data.telefonoMovil,
                area: data.area,
                subarea: data.subarea,
                tipoColaborador: data.tipoColaborador,
                rol: 'partner', // Siempre partner
                nit: data.nit || '',
                emailEmpresarial: data.emailEmpresarial,
                emailPersonal: data.emailPersonal,
                fotoPerfil: data.fotoPerfil || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active'
            };

            // 5. Guardar en Firestore
            const docId = await this.repository.saveCollaboratorData(uid, collaboratorData);

            return {
                success: true,
                uid: uid,
                docId: docId,
                message: 'Colaborador registrado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en registerCollaborator:', error);
            throw error;
        }
    }

    /**
     * Prepara los datos del formulario para enviar
     * @param {FormData} formData
     * @returns {Object}
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
            area: formData.get('area') || '',
            subarea: formData.get('subarea') || '',
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