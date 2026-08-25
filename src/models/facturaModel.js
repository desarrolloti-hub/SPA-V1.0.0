/* ========================================
   FACTURA MODEL
   Estructura de datos para Facturas
   ======================================== */

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
            metodoPago: data.metodoPago || '',
            formaPago: data.formaPago || '',
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
        const now = new Date().toISOString();
        
        // Mapear items de la cotización al formato de factura
        const items = (cotizacion.items || []).map(item => ({
            cantidad: item.cantidad || 1,
            descripcion: item.descripcion || 'Sin descripción',
            precioUnitario: item.precio || 0,
            total: item.total || 0,
            categoria: item.categoria || '',
            categoriaNombre: item.categoriaNombre || '',
            tipoTecnologia: item.tipoTecnologia || 'pieza'
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
            subtotal: cotizacion.subtotal || 0,
            descuento: cotizacion.descuento || '0',
            descuentoMonto: cotizacion.descuentoMonto || 0,
            impuesto: cotizacion.impuesto || '16',
            impuestoMonto: cotizacion.impuestoMonto || 0,
            totalFinal: cotizacion.totalFinal || 0,
            
            // Términos
            terminos: cotizacion.terminos || '',
            
            // Estatus
            estatus: 'borrador',
            metodoPago: '',
            formaPago: '',
            usoCFDI: 'G01',
            
            // CFDI Data (para timbrado)
            cfdiData: {
                Receiver: {
                    Name: cotizacion.clienteRazonSocial || cotizacion.clienteNombre || '',
                    CfdiUse: 'G03',
                    Rfc: cotizacion.clienteRFC || '',
                    FiscalRegime: cotizacion.clienteRegimenCodigo || '621',
                    TaxZipCode: cotizacion.clienteCodigoPostal || '00000'
                },
                CfdiType: 'I',
                NameId: '1',
                ExpeditionPlace: '57200',
                Serie: null,
                Folio: facturaNumero,
                PaymentForm: '01',
                PaymentMethod: 'PUE',
                Exportation: '01'
            }
        };
    }

    /**
     * Valida los datos de la factura para timbrado
     */
    static validateForTimbrado(data) {
        const errors = {};

        if (!data.clienteRFC || data.clienteRFC.length < 12) {
            errors.clienteRFC = 'RFC del cliente es requerido (mínimo 12 caracteres)';
        }

        if (!data.clienteRazonSocial) {
            errors.clienteRazonSocial = 'Razón social del cliente es requerida';
        }

        if (!data.clienteRegimenCodigo) {
            errors.clienteRegimenCodigo = 'Régimen fiscal del cliente es requerido';
        }

        if (!data.clienteCodigoPostal || data.clienteCodigoPostal.length !== 5) {
            errors.clienteCodigoPostal = 'Código postal del cliente es requerido (5 dígitos)';
        }

        if (!data.usoCFDI) {
            errors.usoCFDI = 'Uso de CFDI es requerido';
        }

        if (!data.formaPago) {
            errors.formaPago = 'Forma de pago es requerida';
        }

        if (!data.metodoPago) {
            errors.metodoPago = 'Método de pago es requerido';
        }

        if (!data.items || data.items.length === 0) {
            errors.items = 'Debe tener al menos un item';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
}

export default FacturaModel;