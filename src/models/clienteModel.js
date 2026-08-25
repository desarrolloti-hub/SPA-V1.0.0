/* ========================================
   CLIENTE MODEL
   Estructura de datos para Clientes
   ======================================== */

import { obtenerCodigoRegimen } from '../utils/regimenesSAT.js';

export class ClienteModel {
    
    /**
     * Crea un nuevo objeto Cliente para Firestore
     * @param {Object} data - Datos del cliente
     * @param {string} uid - UID del usuario (Auth)
     * @param {string} creadoPor - UID del usuario que crea el registro
     * @param {string} modificadoPor - UID del usuario que modifica el registro
     */
    static create(data, uid, creadoPor, modificadoPor = null) {
        const now = new Date().toISOString();
        
        const regimenCodigo = obtenerCodigoRegimen(data.regimen);
        
        return {
            uid: uid,
            // Datos SAT
            rfc: data.rfc?.toUpperCase() || '',
            razonSocial: data.razonSocial?.trim() || '',
            nombreComercial: data.nombreComercial?.trim() || '',
            regimen: data.regimen?.trim() || '',
            regimenCodigo: regimenCodigo || '',
            // Domicilio
            codigoPostal: data.codigoPostal || '',
            tipoVialidad: data.tipoVialidad?.trim() || '',
            nombreVialidad: data.nombreVialidad?.trim() || '',
            numeroExterior: data.numeroExterior?.trim() || '',
            numeroInterior: data.numeroInterior?.trim() || '',
            colonia: data.colonia?.trim() || '',
            localidad: data.localidad?.trim() || '',
            municipio: data.municipio?.trim() || '',
            estado: data.estado?.trim() || '',
            entreCalle: data.entreCalle?.trim() || '',
            yCalle: data.yCalle?.trim() || '',
            // Contacto
            telefonoMovil: data.telefonoMovil || '',
            telefonoFijo: data.telefonoFijo || '',
            email: data.email?.trim() || '',
            // Validación SAT
            validadoSAT: data.validadoSAT || false,
            fechaValidacionSAT: data.fechaValidacionSAT || null,
            // Facturama
            facturamaId: data.facturamaId || '',
            sincronizadoFacturama: data.sincronizadoFacturama || false,
            fechaSincronizacion: data.fechaSincronizacion || null,
            // ✅ Auditoría
            creadoPor: creadoPor || '',
            modificadoPor: modificadoPor || creadoPor || '',
            createdAt: now,
            updatedAt: now,
            status: data.status || 'active'
        };
    }

    /**
     * ✅ Actualiza los campos de auditoría para modificación
     * @param {Object} data - Datos a actualizar
     * @param {string} modificadoPor - UID del usuario que modifica
     */
    static update(data, modificadoPor) {
        return {
            ...data,
            modificadoPor: modificadoPor || data.modificadoPor || '',
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Valida los datos del cliente
     */
    static validate(data) {
        const errors = {};

        if (!data.rfc || data.rfc.length < 12) {
            errors.rfc = 'RFC inválido (mínimo 12 caracteres)';
        }

        if (!data.razonSocial || data.razonSocial.trim().length < 3) {
            errors.razonSocial = 'La razón social es requerida (mínimo 3 caracteres)';
        }

        if (!data.codigoPostal || data.codigoPostal.length !== 5) {
            errors.codigoPostal = 'Código postal inválido (5 dígitos)';
        }

        if (!data.nombreVialidad || data.nombreVialidad.trim().length < 2) {
            errors.nombreVialidad = 'La vialidad es requerida';
        }

        if (!data.colonia || data.colonia.trim().length < 2) {
            errors.colonia = 'La colonia es requerida';
        }

        if (!data.municipio || data.municipio.trim().length < 2) {
            errors.municipio = 'El municipio es requerido';
        }

        if (!data.estado || data.estado.trim().length < 2) {
            errors.estado = 'El estado es requerido';
        }

        if (!data.telefonoMovil || data.telefonoMovil.length < 10) {
            errors.telefonoMovil = 'Teléfono móvil inválido (mínimo 10 dígitos)';
        }

        if (!data.email || !this._isValidEmail(data.email)) {
            errors.email = 'Correo electrónico inválido';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    static _isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

export default ClienteModel;