/* ========================================
   PARTNER MODEL
   Estructura de datos para Colaboradores
   ======================================== */

/**
 * Modelo de Colaborador (Partner)
 * @typedef {Object} Partner
 * @property {string} uid - UID de Firebase Auth
 * @property {string} nombreCompleto - Nombre completo del colaborador
 * @property {string} fechaNacimiento - Fecha de nacimiento
 * @property {string} curp - CURP del colaborador
 * @property {string} rfc - RFC del colaborador
 * @property {string} estadoCivil - Estado civil
 * @property {string} nss - Número de Seguro Social
 * @property {string} telefonoFijo - Teléfono fijo
 * @property {string} telefonoMovil - Teléfono móvil
 * @property {string} areaId - ID del área (Firestore)
 * @property {string} areaNombre - Nombre del área (para mostrar)
 * @property {string} subareaId - ID de la subárea (Firestore)
 * @property {string} subareaNombre - Nombre de la subárea (para mostrar)
 * @property {string} tipoColaborador - Tipo de colaborador
 * @property {string} rol - Rol del colaborador (partner)
 * @property {string} nit - NIT del colaborador
 * @property {string} emailEmpresarial - Correo empresarial
 * @property {string} emailPersonal - Correo personal
 * @property {string} fotoPerfil - Foto de perfil (Base64)
 * @property {string} creadoPor - UID del usuario que creó el registro
 * @property {string} createdAt - Fecha de creación
 * @property {string} updatedAt - Fecha de actualización
 * @property {string} status - Estado del colaborador (active/inactive)
 * @property {boolean} emailVerified - Si el correo fue verificado
 */

export class PartnerModel {
    
    /**
     * Crea un nuevo objeto Colaborador para Firestore
     * @param {Object} data - Datos del colaborador
     * @param {string} uid - UID del usuario (Auth)
     * @param {string} creadoPor - UID del usuario que crea el registro
     * @param {Object} areaData - Datos del área seleccionada { id, nombre }
     * @param {Object} subareaData - Datos de la subárea seleccionada { id, nombre }
     * @returns {Object} - Objeto Colaborador formateado
     */
    static create(data, uid, creadoPor, areaData, subareaData) {
        const now = new Date().toISOString();
        
        return {
            uid: uid,
            nombreCompleto: data.nombreCompleto?.trim() || '',
            fechaNacimiento: data.fechaNacimiento || '',
            curp: data.curp?.toUpperCase() || '',
            rfc: data.rfc?.toUpperCase() || '',
            estadoCivil: data.estadoCivil || '',
            nss: data.nss || '',
            telefonoFijo: data.telefonoFijo || '',
            telefonoMovil: data.telefonoMovil || '',
            // ✅ Guardar ID y nombre del área
            areaId: areaData?.id || '',
            areaNombre: areaData?.nombre || '',
            // ✅ Guardar ID y nombre de la subárea
            subareaId: subareaData?.id || '',
            subareaNombre: subareaData?.nombre || '',
            tipoColaborador: data.tipoColaborador || '',
            rol: 'partner',
            nit: data.nit || '',
            emailEmpresarial: data.emailEmpresarial || '',
            emailPersonal: data.emailPersonal || '',
            fotoPerfil: data.fotoPerfil || '',
            creadoPor: creadoPor || '',
            createdAt: now,
            updatedAt: now,
            status: data.status || 'active',
            emailVerified: false
        };
    }

    /**
     * Valida los datos del colaborador
     * @param {Object} data - Datos a validar
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    static validate(data) {
        const errors = {};

        // Información personal
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

        // Información laboral
        if (!data.areaId) {
            errors.area = 'El área es requerida';
        }

        if (!data.subareaId) {
            errors.subarea = 'La subárea es requerida';
        }

        if (!data.tipoColaborador) {
            errors.tipoColaborador = 'El tipo de colaborador es requerido';
        }

        // Información de contacto
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
    static _isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Genera un ID único
     * @returns {string} - ID generado
     */
    static _generateId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
}

export default PartnerModel;