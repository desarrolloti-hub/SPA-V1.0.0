/* ========================================
   COTIZACION MODEL
   Estructura de datos para Cotizaciones
   ======================================== */

export class CotizacionModel {
    
    /**
     * Crea un nuevo objeto Cotización para Firestore
     * @param {Object} data - Datos de la cotización
     * @param {string} uid - UID del usuario que crea
     * @param {string} creadoPor - UID del usuario que crea el registro
     */
    static create(data, uid, creadoPor) {
        const now = new Date().toISOString();
        
        return {
            // Datos del cliente
            clienteId: data.clienteId || '',
            clienteNombre: data.clienteNombre || '',
            clienteRFC: data.clienteRFC || '',
            clienteDireccion: data.clienteDireccion || '',
            clienteTelefono: data.clienteTelefono || '',
            clienteEmail: data.clienteEmail || '',
            
            // Datos de la cotización
            cotizacionNumero: data.cotizacionNumero || '',
            cotizacionFecha: data.cotizacionFecha || new Date().toISOString().split('T')[0],
            cotizacionVigencia: data.cotizacionVigencia || '30',
            cotizacionMoneda: data.cotizacionMoneda || 'MXN',
            cotizacionDescripcion: data.cotizacionDescripcion || '',
            tipoCotizacion: data.tipoCotizacion || 'proyecto',
            
            // Datos de la empresa
            empresaSelector: data.empresaSelector || 'RSI NEZA',
            empresaNombre: data.empresaNombre || 'RSI ENTERPRISE NEZAHUALCÓYOTL',
            empresaDireccion: data.empresaDireccion || '',
            empresaRFC: data.empresaRFC || 'RSI1810319G0',
            empresaTelefono: data.empresaTelefono || '',
            
            // Items
            items: data.items || [],
            
            // Financiero
            subtotal: data.subtotal || 0,
            descuento: data.descuento || '0',
            descuentoMonto: data.descuentoMonto || 0,
            impuesto: data.impuesto || '16',
            impuestoMonto: data.impuestoMonto || 0,
            totalFinal: data.totalFinal || 0,
            
            // Crédito
            tipoCredito: data.tipoCredito || 'contado',
            diasCredito: data.diasCredito || '',
            
            // Términos
            terminos: data.terminos || '',
            
            // Estatus
            estatus: data.estatus || 'en proceso',
            pagoEstatus: data.pagoEstatus || 'pendiente',
            motivoRechazo: data.motivoRechazo || '',
            
            // Ticket asociado
            ticketAsociado: data.ticketAsociado || '',
            
            // ✅ PDF URL
            pdfUrl: data.pdfUrl || '',
            
            // Auditoría
            creadoPor: creadoPor || '',
            modificadoPor: creadoPor || '',
            createdAt: now,
            updatedAt: now,
            
            // Metadatos
            esEntradaManual: data.esEntradaManual !== undefined ? data.esEntradaManual : true,
            estado: data.estado || 'borrador'
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
     * Valida los datos de la cotización
     * @param {Object} data - Datos a validar
     * @param {boolean} isCompletada - Si es una cotización completada
     */
    static validate(data, isCompletada = false) {
        const errors = {};

        // ✅ Si es completada, validar todos los campos obligatorios
        if (isCompletada) {
            if (!data.clienteId) {
                errors.clienteId = 'El cliente es requerido';
            }
            if (!data.cotizacionNumero) {
                errors.cotizacionNumero = 'El número de cotización es requerido';
            }
            if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
                errors.items = 'Debe tener al menos un item';
            }
            if (!data.totalFinal || data.totalFinal <= 0) {
                errors.totalFinal = 'El total debe ser mayor a 0';
            }
        } else {
            // ✅ Para borrador/temporal, solo validar campos obligatorios básicos
            // y permitir totalFinal = 0
            if (!data.clienteId) {
                errors.clienteId = 'El cliente es requerido';
            }
            if (!data.cotizacionNumero) {
                errors.cotizacionNumero = 'El número de cotización es requerido';
            }
            // ✅ Los items y totalFinal NO son obligatorios en borrador
            // Solo validamos si existen y tienen datos incorrectos
            if (data.items !== undefined && !Array.isArray(data.items)) {
                errors.items = 'Los items deben ser un array';
            }
            if (data.totalFinal !== undefined && data.totalFinal < 0) {
                errors.totalFinal = 'El total no puede ser negativo';
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
}

export default CotizacionModel;