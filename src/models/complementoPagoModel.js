/* ==========================================================================
   COMPLEMENTO PAGO MODEL - RSI Enterprise
   Estructura y normalización para Complementos de Pago (CFDI 4.0 / REP 2.0)
   ========================================================================== */

export class ComplementoPagoModel {

    /**
     * Crea la estructura de un Complemento de Pago para Firestore
     * @param {Object} data - Datos del pago y de la factura origen
     * @param {string} uid - UID del usuario que registra
     * @param {string} [creadoPor] - Nombre o identificador del creador
     */
    static create(data, uid, creadoPor = '') {
        const now = new Date().toISOString();
        const monto = parseFloat(data.monto) || 0;
        const saldoAnterior = parseFloat(data.saldoAnterior) || 0;
        const saldoInsoluto = Math.max(0, parseFloat((saldoAnterior - monto).toFixed(2)));
        const parcialidad = parseInt(data.parcialidad, 10) || 1;

        // Impuestos proporcionales conforme a CFDI 4.0 REP 2.0 (tasa 16%)
        const tasaIva = 0.16;
        const baseIva = parseFloat((monto / (1 + tasaIva)).toFixed(2));
        const importeIva = parseFloat((monto - baseIva).toFixed(2));

        return {
            // Relación con la factura original PPD
            facturaId: data.facturaId || '',
            facturaNumero: data.facturaNumero || '',
            facturaUuid: data.facturaUuid || '',
            facturaSerie: data.facturaSerie || '',
            facturaFolio: data.facturaFolio || data.facturaNumero || '',
            facturaFecha: data.facturaFecha || '',
            facturaTotal: parseFloat(data.facturaTotal) || saldoAnterior,
            monedaFactura: data.monedaFactura || 'MXN',

            // Datos del Cliente (Receptor)
            clienteId: data.clienteId || '',
            clienteNombre: data.clienteNombre || data.clienteRazonSocial || '',
            clienteRazonSocial: data.clienteRazonSocial || data.clienteNombre || '',
            clienteRFC: (data.clienteRFC || '').trim().toUpperCase(),
            clienteRegimen: data.clienteRegimen || data.clienteRegimenCodigo || '601',
            clienteRegimenCodigo: data.clienteRegimenCodigo || data.clienteRegimen || '601',
            clienteCodigoPostal: data.clienteCodigoPostal || '00000',
            clienteEmail: data.clienteEmail || '',

            // Datos del Emisor
            empresaNombre: data.empresaNombre || 'RSI ENTERPRISE NEZAHUALCÓYOTL',
            empresaRFC: data.empresaRFC || 'RSI1810319G0',
            empresaCodigoPostal: data.empresaCodigoPostal || '57200',
            empresaRegimen: data.empresaRegimen || '601',

            // Detalle del Pago
            parcialidad,
            fechaPago: data.fechaPago || now,
            formaPago: data.formaPago || '03', // Clave SAT: 03 = Transferencia, 01 = Efectivo, etc.
            moneda: data.moneda || 'MXN',
            tipoCambio: 1,
            monto,
            saldoAnterior,
            saldoInsoluto,
            numeroOperacion: data.numeroOperacion || '',
            bancoOrdenante: data.bancoOrdenante || '',
            cuentaOrdenante: data.cuentaOrdenante || '',
            bancoBeneficiario: data.bancoBeneficiario || '',
            cuentaBeneficiario: data.cuentaBeneficiario || '',
            observaciones: data.observaciones || '',

            // Identificadores del Comprobante
            serie: data.serie || 'PAG',
            folio: data.folio || `${parcialidad}`,
            complementoNumero: data.complementoNumero || `PAG-${data.facturaNumero || ''}-${parcialidad}`,
            tipoComprobante: 'P',
            usoCFDI: 'CP01',
            objetoImpuesto: '02', // Sí objeto de impuesto

            // Desglose fiscal del pago
            desgloseImpuestos: {
                tasa: tasaIva,
                base: baseIva,
                importe: importeIva,
                impuesto: '002', // IVA
                tipoFactor: 'Tasa'
            },

            // Datos de timbrado oficial SAT (Facturama)
            estatus: data.estatus || 'borrador', // 'borrador', 'pendiente', 'timbrada', 'cancelada'
            facturamaId: data.facturamaId || '',
            uuid: data.uuid || '',
            timbrado: data.timbrado || {
                uuid: '',
                fechaTimbrado: '',
                sello: '',
                selloSat: '',
                noCertificado: '',
                certNumber: '',
                rfcProveedor: '',
                cadenaOriginal: '',
                qrCode: ''
            },

            // Archivos generados / sincronizados
            pdfUrl: data.pdfUrl || '',
            pdfPath: data.pdfPath || '',
            xmlUrl: data.xmlUrl || '',
            xmlPath: data.xmlPath || '',

            // Auditoría
            creadoPorUid: uid || '',
            creadoPor: creadoPor || '',
            modificadoPor: creadoPor || '',
            createdAt: now,
            updatedAt: now,
            estado: 'activa'
        };
    }

    /**
     * Actualiza el modelo con datos de timbrado
     */
    static updateTimbrado(currentData, timbradoResponse, modificadoPor = '') {
        const now = new Date().toISOString();
        const uuid = timbradoResponse.uuid || timbradoResponse.Uuid || timbradoResponse.Complement?.TaxStamp?.Uuid || '';
        const fechaTimbrado = timbradoResponse.fechaTimbrado || timbradoResponse.Date || now;

        return {
            ...currentData,
            estatus: 'timbrada',
            facturamaId: timbradoResponse.facturamaId || currentData.facturamaId || '',
            uuid: uuid,
            timbrado: {
                uuid,
                fechaTimbrado,
                sello: timbradoResponse.Complement?.TaxStamp?.SelloCFD || timbradoResponse.sello || '',
                selloSat: timbradoResponse.Complement?.TaxStamp?.SelloSAT || timbradoResponse.selloSat || '',
                noCertificado: timbradoResponse.Complement?.TaxStamp?.NoCertificadoSAT || timbradoResponse.noCertificado || '',
                certNumber: timbradoResponse.CertNumber || timbradoResponse.noCertificado || '',
                rfcProveedor: timbradoResponse.Complement?.TaxStamp?.RfcProvCertif || 'FLI080612495',
                cadenaOriginal: timbradoResponse.cadenaOriginal || '',
                qrCode: timbradoResponse.qrCode || ''
            },
            pdfUrl: timbradoResponse.pdfUrl || currentData.pdfUrl || '',
            pdfPath: timbradoResponse.pdfPath || currentData.pdfPath || '',
            xmlUrl: timbradoResponse.xmlUrl || currentData.xmlUrl || '',
            xmlPath: timbradoResponse.xmlPath || currentData.xmlPath || '',
            modificadoPor: modificadoPor || currentData.modificadoPor || '',
            updatedAt: now
        };
    }

    /**
     * Valida los datos mínimos para emitir y timbrar un Complemento de Pago ante el SAT
     * @param {Object} data
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validateForTimbrado(data) {
        const errors = [];

        if (!data.facturaUuid || data.facturaUuid.length < 30) {
            errors.push('La factura original debe contar con un UUID fiscal válido ante el SAT.');
        }

        const monto = parseFloat(data.monto);
        if (isNaN(monto) || monto <= 0) {
            errors.push('El monto del pago debe ser mayor a 0.00.');
        }

        const saldoAnterior = parseFloat(data.saldoAnterior);
        if (isNaN(saldoAnterior) || saldoAnterior <= 0) {
            errors.push('El saldo anterior de la factura debe ser mayor a 0.00.');
        }

        if (monto > (saldoAnterior + 0.01)) {
            errors.push(`El monto a pagar ($${monto.toFixed(2)}) no puede exceder el saldo anterior insoluto ($${saldoAnterior.toFixed(2)}).`);
        }

        if (!data.formaPago) {
            errors.push('Se debe especificar la forma de pago (01, 02, 03, etc.). No puede ser 99.');
        } else if (data.formaPago === '99') {
            errors.push('En un Complemento de Pago, la forma de pago NO puede ser "99 — Por definir".');
        }

        if (!data.clienteRFC || data.clienteRFC.length < 12) {
            errors.push('El RFC del receptor es requerido y debe tener formato válido.');
        }

        if (!data.clienteRegimenCodigo) {
            errors.push('El régimen fiscal del receptor es requerido.');
        }

        if (!data.clienteCodigoPostal || data.clienteCodigoPostal.length !== 5) {
            errors.push('El código postal del receptor debe tener 5 dígitos.');
        }

        const parcialidad = parseInt(data.parcialidad, 10);
        if (isNaN(parcialidad) || parcialidad < 1) {
            errors.push('El número de parcialidad debe ser un entero mayor o igual a 1.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export default ComplementoPagoModel;
