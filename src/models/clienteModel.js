/* ========================================
   CLIENTE MODEL
   Estructura de datos para Clientes
   ======================================== */

import { obtenerCodigoRegimen } from '../utils/regimenesSat.js';

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
        
        const rfcUpper = (data.rfc || '').toUpperCase().trim();
        const esNacionalGen = rfcUpper === 'XAXX010101000';
        const esExtranjeroGen = rfcUpper === 'XEXX010101000';
        const esGenerico = esNacionalGen || esExtranjeroGen;
        const regimenCodigo = obtenerCodigoRegimen(data.regimen) || (data.regimenCodigo || (esGenerico ? '616' : ''));
        const regimenNombre = data.regimen?.trim() || (esGenerico ? 'Sin obligaciones fiscales' : '');
        const razonSocialFinal = data.razonSocial?.trim() || data.nombre?.trim() || '';
        
        return {
            uid: uid,
            // Datos SAT
            rfc: rfcUpper,
            razonSocial: razonSocialFinal,
            nombreComercial: data.nombreComercial?.trim() || razonSocialFinal,
            regimen: regimenNombre,
            regimenCodigo: regimenCodigo || '',
            tipoRfc: esNacionalGen ? 'nacional' : esExtranjeroGen ? 'extranjero' : 'especifico',
            esGenerico: esGenerico,
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
     * Permite el registro rápido únicamente con nombre y RFC.
     * Los demás campos son opcionales y solo se validan si fueron capturados.
     */
    static validate(data) {
        const errors = {};

        const rfc = (data.rfc || '').trim().toUpperCase();
        if (!rfc || rfc.length < 12) {
            errors.rfc = 'RFC inválido (mínimo 12 caracteres)';
        }

        const razonSocial = (data.razonSocial || data.nombre || '').trim();
        if (!razonSocial || razonSocial.length < 2) {
            errors.razonSocial = 'El nombre o razón social es requerido (mínimo 2 caracteres)';
        }

        // Código postal opcional: si se captura debe tener 5 dígitos
        const cp = (data.codigoPostal || '').trim();
        if (cp.length > 0 && cp.length !== 5) {
            errors.codigoPostal = 'Código postal inválido (5 dígitos)';
        }

        // Teléfono móvil opcional: si se captura debe tener al menos 10 dígitos
        const tel = (data.telefonoMovil || '').trim();
        if (tel.length > 0 && tel.length < 10) {
            errors.telefonoMovil = 'Teléfono móvil inválido (mínimo 10 dígitos)';
        }

        // Email opcional: si se captura debe tener formato válido
        const email = (data.email || '').trim();
        if (email.length > 0 && !this._isValidEmail(email)) {
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
