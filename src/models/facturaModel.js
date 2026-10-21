/* ========================================
   FACTURA MODEL
   Estructura de datos para Facturas
   ======================================== */

import { validarCompatibilidadUsoCFDI } from '../utils/regimenesSat.js';

export class FacturaModel {
    
    /**
     * Crea un nuevo objeto Factura para Firestore
     * @param {Object} data - Datos de la factura
     * @param {string} uid - UID del usuario que crea
     * @param {string} creadoPor - UID del usuario que crea el registro
     */
    static create(data, uid, creadoPor) {
        const now = new Date().toISOString();
        
        return {
            // Datos de la cotización origen
            cotizacionId: data.cotizacionId || '',
            cotizacionNumero: data.cotizacionNumero || '',
            
            // Datos del cliente (completos desde la cotización)
            clienteId: data.clienteId || '',
            clienteNombre: data.clienteNombre || '',
            clienteRFC: data.clienteRFC || '',
            clienteDireccion: data.clienteDireccion || '',
            clienteTelefono: data.clienteTelefono || '',
            clienteEmail: data.clienteEmail || '',
            clienteRazonSocial: data.clienteRazonSocial || '',
            clienteNombreComercial: data.clienteNombreComercial || '',
            clienteRegimen: data.clienteRegimen || '',
            clienteRegimenCodigo: data.clienteRegimenCodigo || '',
            clienteRegimenFiscal: data.clienteRegimenFiscal || data.clienteRegimenCodigo || data.clienteRegimen || '',
            clienteCodigoPostal: data.clienteCodigoPostal || '',
            clienteTipoVialidad: data.clienteTipoVialidad || '',
            clienteNombreVialidad: data.clienteNombreVialidad || '',
            clienteNumeroExterior: data.clienteNumeroExterior || '',
            clienteNumeroInterior: data.clienteNumeroInterior || '',
            clienteColonia: data.clienteColonia || '',
            clienteLocalidad: data.clienteLocalidad || '',
            clienteMunicipio: data.clienteMunicipio || '',
            clienteEstado: data.clienteEstado || '',
            clienteTelefonoFijo: data.clienteTelefonoFijo || '',
            
            // Datos de la empresa
            empresaSelector: data.empresaSelector || 'RSI NEZA',
            empresaNombre: data.empresaNombre || 'RSI ENTERPRISE NEZAHUALCÓYOTL',
            empresaDireccion: data.empresaDireccion || '',
            empresaRFC: data.empresaRFC || 'RSI1810319G0',
            empresaTelefono: data.empresaTelefono || '',
            empresaCodigoPostal: data.empresaCodigoPostal || '57200',
            empresaRegimen: data.empresaRegimen || '601',
            
            // Datos de la factura
            facturaNumero: data.facturaNumero || '',
            facturaFecha: data.facturaFecha || new Date().toISOString().split('T')[0],
            facturaFechaPago: data.facturaFechaPago || '',
            facturaMoneda: data.facturaMoneda || 'MXN',
            facturaDescripcion: data.facturaDescripcion || '',
            tipoFactura: data.tipoFactura || 'ingreso',
            
            // Datos para timbrado (Facturama)
            cfdiData: data.cfdiData || {},
            
            // Items
            items: data.items || [],
            
            // Financiero
            subtotal: data.subtotal || 0,
            descuento: data.descuento || '0',
            descuentoMonto: data.descuentoMonto || 0,
            impuesto: data.impuesto || '16',
            impuestoMonto: data.impuestoMonto || 0,
            totalFinal: data.totalFinal || 0,
            
            // Términos
            terminos: data.terminos || '',
            
            // Estatus
            estatus: data.estatus || 'borrador', // borrador, pendiente, timbrada, cancelada
            metodoPago: data.metodoPago || 'PUE',
            formaPago: data.metodoPago === 'PPD' ? '99' : (data.formaPago || '01'),
            usoCFDI: data.usoCFDI || 'G01',
            
            // Respuesta del timbrado
            timbrado: data.timbrado || {
                uuid: '',
                fechaTimbrado: '',
                sello: '',
                noCertificado: '',
                cadenaOriginal: '',
                qrCode: ''
            },
            facturamaId: data.facturamaId || '',
            
            // Archivos generados
            pdfUrl: data.pdfUrl || '',
            xmlUrl: data.xmlUrl || '',
            pdfPath: data.pdfPath || '',
            xmlPath: data.xmlPath || '',

            // Información de cancelación
            cancelacion: data.cancelacion || {
                solicitada: false,
                fechaSolicitud: null,
                motivo: '',
                folioSustitucion: '',
                status: '', // 'canceled', 'pending', etc.
                mensaje: '',
                acuseXmlUrl: '',
                acuseXmlPath: '',
                solicitadoPor: ''
            },
            
            // Auditoría
            creadoPor: creadoPor || '',
            modificadoPor: creadoPor || '',
            createdAt: now,
            updatedAt: now,
            
            // Metadatos
            estado: data.estado || 'activa'
        };
    }

    /**
     * Actualiza los campos de auditoría para modificación
     */
    static update(data, modificadoPor) {
        return {
            ...data,
            modificadoPor: modificadoPor || data.modificadoPor || '',
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Convierte una cotización en datos de factura (para el formulario)
     */
    static fromCotizacion(cotizacion, facturaNumero) {
        // Mapear items de la cotización al formato de factura conservando claves fiscales
        const items = (cotizacion.items || []).map((item, index) => ({
            productId: item.productId || '',
            cantidad: parseFloat(item.cantidad) || 1,
            descripcion: item.descripcion || 'Sin descripción',
            precioUnitario: parseFloat(item.precioUnitario !== undefined ? item.precioUnitario : (item.precio || 0)),
            total: parseFloat(item.total || 0),
            categoria: item.categoria || '',
            categoriaNombre: item.categoriaNombre || '',
            tipoTecnologia: item.tipoTecnologia || 'pieza',
            claveSat: item.claveSat || '',
            unitCode: item.unitCode || 'H87',
            unit: item.unit || 'Pieza',
            identificationNumber: item.identificationNumber || item.sku || item.codigo || `ITEM-${index + 1}`
        }));
        
        return {
            cotizacionId: cotizacion.id || '',
            cotizacionNumero: cotizacion.cotizacionNumero || '',
            
            // Datos del cliente
            clienteId: cotizacion.clienteId || '',
            clienteNombre: cotizacion.clienteNombre || '',
            clienteRFC: cotizacion.clienteRFC || '',
            clienteDireccion: cotizacion.clienteDireccion || '',
            clienteTelefono: cotizacion.clienteTelefono || '',
            clienteEmail: cotizacion.clienteEmail || '',
            clienteRazonSocial: cotizacion.clienteRazonSocial || cotizacion.clienteNombre || '',
            clienteNombreComercial: cotizacion.clienteNombreComercial || '',
            clienteRegimen: cotizacion.clienteRegimen || '',
            clienteRegimenCodigo: cotizacion.clienteRegimenCodigo || '',
            clienteRegimenFiscal: cotizacion.clienteRegimenFiscal || cotizacion.clienteRegimenCodigo || cotizacion.clienteRegimen || '',
            clienteCodigoPostal: cotizacion.clienteCodigoPostal || '',
            clienteTipoVialidad: cotizacion.clienteTipoVialidad || '',
            clienteNombreVialidad: cotizacion.clienteNombreVialidad || '',
            clienteNumeroExterior: cotizacion.clienteNumeroExterior || '',
            clienteNumeroInterior: cotizacion.clienteNumeroInterior || '',
            clienteColonia: cotizacion.clienteColonia || '',
            clienteLocalidad: cotizacion.clienteLocalidad || '',
            clienteMunicipio: cotizacion.clienteMunicipio || '',
            clienteEstado: cotizacion.clienteEstado || '',
            clienteTelefonoFijo: cotizacion.clienteTelefonoFijo || '',
            
            // Datos de la empresa
            empresaSelector: cotizacion.empresaSelector || 'RSI NEZA',
            empresaNombre: cotizacion.empresaNombre || 'RSI ENTERPRISE NEZAHUALCÓYOTL',
            empresaDireccion: cotizacion.empresaDireccion || '',
            empresaRFC: cotizacion.empresaRFC || 'RSI1810319G0',
            empresaTelefono: cotizacion.empresaTelefono || '',
            empresaCodigoPostal: '57200',
            empresaRegimen: '601',
            
            // Datos de la factura
            facturaNumero: facturaNumero,
            facturaFecha: new Date().toISOString().split('T')[0],
            facturaFechaPago: '',
            facturaMoneda: cotizacion.cotizacionMoneda || 'MXN',
            facturaDescripcion: cotizacion.cotizacionDescripcion || '',
            tipoFactura: 'ingreso',
            
            // Items
            items: items,
            
            // Financiero
            subtotal: parseFloat(cotizacion.subtotal || 0),
            descuento: cotizacion.descuento || '0',
            descuentoMonto: parseFloat(cotizacion.descuentoMonto || 0),
            impuesto: cotizacion.impuesto || '16',
            impuestoMonto: parseFloat(cotizacion.impuestoMonto || 0),
            totalFinal: parseFloat(cotizacion.totalFinal || 0),
            
            // Términos
            terminos: cotizacion.terminos || '',
            
            // Estatus
            estatus: 'borrador',
            metodoPago: cotizacion.metodoPago || 'PUE',
            formaPago: cotizacion.metodoPago === 'PPD' ? '99' : (cotizacion.formaPago || '01'),
            usoCFDI: cotizacion.usoCFDI || 'G03',
            
            // CFDI Data (para timbrado)
            cfdiData: {
                Receiver: {
                    Name: (cotizacion.clienteRazonSocial || cotizacion.clienteNombre || '').trim().toUpperCase(),
                    CfdiUse: cotizacion.usoCFDI || 'G03',
                    Rfc: (cotizacion.clienteRFC || '').trim().toUpperCase(),
                    FiscalRegime: cotizacion.clienteRegimenFiscal || cotizacion.clienteRegimenCodigo || cotizacion.clienteRegimen || '601',
                    TaxZipCode: cotizacion.clienteCodigoPostal || '57200'
                },
                CfdiType: 'I',
                NameId: '1',
                ExpeditionPlace: cotizacion.empresaCodigoPostal || '57200',
                Serie: null,
                Folio: facturaNumero,
                PaymentForm: cotizacion.metodoPago === 'PPD' ? '99' : (cotizacion.formaPago || '01'),
                PaymentMethod: cotizacion.metodoPago || 'PUE',
                Exportation: '01'
            }
        };
    }

    /**
     * Valida los datos mínimos de una factura (borrador o general)
     * @param {Object} data - Datos de la factura
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    static validate(data) {
        const errors = {};

        if (!data || typeof data !== 'object') {
            errors.general = 'Los datos de la factura son requeridos';
            return { valid: false, errors };
        }

        if (!data.clienteNombre && !data.clienteRazonSocial) {
            errors.cliente = 'El cliente o razón social es requerido';
        }

        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.items = 'La factura debe tener al menos un ítem';
        } else {
            const invalidItems = data.items.filter(item => {
                const qty = parseFloat(item.cantidad);
                const price = parseFloat(item.precioUnitario !== undefined ? item.precioUnitario : item.precio);
                return isNaN(qty) || qty <= 0 || isNaN(price) || price < 0;
            });
            if (invalidItems.length > 0) {
                errors.itemsValidez = 'Todos los ítems deben tener cantidad mayor a 0 y precio válido';
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Valida los datos de la factura para timbrado CFDI 4.0
     * @param {Object} data - Datos de la factura
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    static validateForTimbrado(data) {
        const errors = {};

        if (!data || typeof data !== 'object') {
            errors.general = 'Los datos de la factura son requeridos para timbrar';
            return { valid: false, errors };
        }

        const rfc = (data.clienteRFC || '').trim().toUpperCase();
        // Validación estándar de RFC persona física (13) o moral (12), permitiendo genéricos
        const rfcRegex = /^([A-ZÑ&]{3}\d{6}[A-Z0-9]{3}|[A-ZÑ&]{4}\d{6}[A-Z0-9]{3})$/;
        if (!rfc || (!rfcRegex.test(rfc) && rfc !== 'XAXX010101000' && rfc !== 'XEXX010101000')) {
            errors.clienteRFC = 'RFC inválido. Debe tener 12 (moral) o 13 (física) caracteres o ser genérico';
        }

        const razonSocial = (data.clienteRazonSocial || data.clienteNombre || '').trim();
        if (!razonSocial) {
            errors.clienteRazonSocial = 'Razón social del receptor es requerida';
        }

        const regimen = (data.clienteRegimenFiscal || data.clienteRegimenCodigo || data.clienteRegimen || '').trim();
        if (!regimen || !/^\d{3}$/.test(regimen)) {
            errors.clienteRegimenCodigo = 'Régimen fiscal del receptor es requerido (clave de 3 dígitos SAT)';
        }

        const cp = (data.clienteCodigoPostal || '').trim();
        if (!cp || !/^\d{5}$/.test(cp)) {
            errors.clienteCodigoPostal = 'Código postal fiscal del receptor es requerido (5 dígitos)';
        }

        if (!data.usoCFDI) {
            errors.usoCFDI = 'Uso de CFDI es requerido';
        } else if (regimen) {
            const compat = validarCompatibilidadUsoCFDI(data.usoCFDI, regimen, rfc);
            if (!compat.compatible) {
                errors.usoCFDI = compat.error || `El Uso de CFDI ${data.usoCFDI} no es compatible con el receptor`;
            }
        }

        if (!data.metodoPago || !['PUE', 'PPD'].includes(data.metodoPago)) {
            errors.metodoPago = 'Método de pago debe ser PUE o PPD';
        }

        if (!data.formaPago) {
            errors.formaPago = 'Forma de pago es requerida (clave SAT, ej. 01, 03)';
        } else if (data.metodoPago === 'PPD' && String(data.formaPago).trim() !== '99') {
            errors.formaPago = 'Para el método de pago PPD (Pago en parcialidades o diferido), la forma de pago debe ser estrictamente "99" (Por definir)';
        } else if (data.metodoPago === 'PUE' && String(data.formaPago).trim() === '99') {
            errors.formaPago = 'Para el método de pago PUE (Pago en una sola exhibición), la forma de pago no debe ser "99" (Por definir)';
        }

        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.items = 'Debe incluir al menos un concepto';
        } else {
            const itemsSinClave = data.items.filter(item => {
                const clave = (item.claveSat || item.productCode || '').trim();
                return !/^\d{8}$/.test(clave);
            });
            if (itemsSinClave.length > 0) {
                errors.clavesSat = `Hay ${itemsSinClave.length} concepto(s) sin clave SAT válida de 8 dígitos`;
            }

            const itemsInvalidos = data.items.filter(item => {
                const qty = parseFloat(item.cantidad);
                const price = parseFloat(item.precioUnitario !== undefined ? item.precioUnitario : item.precio);
                return isNaN(qty) || qty <= 0 || isNaN(price) || price < 0;
            });
            if (itemsInvalidos.length > 0) {
                errors.itemsValidez = 'Todos los ítems deben tener cantidades y precios válidos';
            }
        }

        const isValid = Object.keys(errors).length === 0;
        return {
            valid: isValid,
            isValid: isValid,
            errors: Object.values(errors),
            errorMap: errors
        };
    }

    /**
     * Valida los datos requeridos para solicitar la cancelación de un CFDI
     * @param {Object|string} paramsOrMotivo - Objeto { motivo, folioSustitucion } o string con clave de motivo ('01'-'04')
     * @param {string} [folioSustitucionArg] - UUID sustituto en caso de motivo '01'
     * @returns {Object} - { valid: boolean, isValid: boolean, errors: string[], errorMap: Object }
     */
    static validateCancelacion(paramsOrMotivo, folioSustitucionArg) {
        const errors = {};

        let params;
        if (typeof paramsOrMotivo === 'string') {
            params = {
                motivo: paramsOrMotivo,
                folioSustitucion: folioSustitucionArg
            };
        } else {
            params = paramsOrMotivo;
        }

        if (!params || typeof params !== 'object') {
            errors.general = 'Los parámetros de cancelación son requeridos';
            return {
                valid: false,
                isValid: false,
                errors: Object.values(errors),
                errorMap: errors
            };
        }

        const motivosValidos = ['01', '02', '03', '04'];
        if (!params.motivo || !motivosValidos.includes(params.motivo)) {
            errors.motivo = 'El motivo de cancelación debe ser 01, 02, 03 o 04';
        }

        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (params.motivo === '01') {
            if (!params.folioSustitucion || !uuidRegex.test(params.folioSustitucion.trim())) {
                errors.folioSustitucion = 'Para el motivo 01 es obligatorio proporcionar un UUID sustituto válido (formato 8-4-4-4-12)';
            }
        } else if (params.folioSustitucion && params.folioSustitucion.trim() !== '') {
            errors.folioSustitucion = 'Solo el motivo 01 permite especificar un folio de sustitución';
        }

        const isValid = Object.keys(errors).length === 0;
        return {
            valid: isValid,
            isValid: isValid,
            errors: Object.values(errors),
            errorMap: errors
        };
    }
}

export default FacturaModel;