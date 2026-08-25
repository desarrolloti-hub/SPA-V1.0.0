/* ========================================
   FACTURA SERVICE
   Lógica de negocio para gestión de facturas
   ======================================== */

import FacturaRepository from '../repositories/facturaRepository.js';
import FacturaModel from '../models/facturaModel.js';
import CotizacionService from './cotizacionService.js';

// URL de la Cloud Function para timbrar
const TIMBRAR_URL = 'https://us-central1-rsienterprise.cloudfunctions.net/crearFactura';

export class FacturaService {
    
    constructor() {
        this.repository = new FacturaRepository();
        this.cotizacionService = new CotizacionService();
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
     * Valida los datos de la factura
     */
    validateFactura(data) {
        return FacturaModel.validate(data);
    }

    /**
     * Valida los datos para timbrado
     */
    validateForTimbrado(data) {
        return FacturaModel.validateForTimbrado(data);
    }

    /**
     * Crea una nueva factura
     */
    async createFactura(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const facturaData = FacturaModel.create(data, uid, uid);
            const docId = await this.repository.createFactura(facturaData);

            return {
                success: true,
                id: docId,
                message: 'Factura creada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createFactura:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las facturas
     */
    async getAllFacturas() {
        try {
            return await this.repository.getAllFacturas();
        } catch (error) {
            console.error('❌ Error en getAllFacturas:', error);
            throw error;
        }
    }

    /**
     * Obtiene una factura por ID
     */
    async getFacturaById(facturaId) {
        try {
            return await this.repository.getFacturaById(facturaId);
        } catch (error) {
            console.error('❌ Error en getFacturaById:', error);
            return null;
        }
    }

    /**
     * Obtiene facturas por cotización
     */
    async getFacturasByCotizacion(cotizacionId) {
        try {
            return await this.repository.getFacturasByCotizacion(cotizacionId);
        } catch (error) {
            console.error('❌ Error en getFacturasByCotizacion:', error);
            return [];
        }
    }

    /**
     * Actualiza una factura
     */
    async updateFactura(facturaId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const updateData = {
                ...data,
                modificadoPor: uid,
                updatedAt: new Date().toISOString()
            };

            await this.repository.updateFactura(facturaId, updateData);

            return {
                success: true,
                message: 'Factura actualizada exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateFactura:', error);
            throw error;
        }
    }

    /**
     * Elimina una factura
     */
    async deleteFactura(facturaId) {
        try {
            await this.repository.deleteFactura(facturaId);
            return {
                success: true,
                message: 'Factura eliminada exitosamente'
            };
        } catch (error) {
            console.error('❌ Error en deleteFactura:', error);
            throw error;
        }
    }

    /**
     * CONSTRUYE EL PAYLOAD PARA EL ENDPOINT DE FIREBASE
     * Recibe los datos de la factura directamente (ya sea de cotización o de factura existente)
     */
    _buildPayload(facturaData) {
        console.log('🔨 Construyendo payload con datos:', facturaData);
        
        const items = facturaData.items || [];
        
        if (items.length === 0) {
            throw new Error('La factura debe tener al menos un item');
        }

        // Obtener el RFC del cliente
        let rfcCliente = (facturaData.clienteRFC || 'XAXX010101000').trim().toUpperCase();
        rfcCliente = rfcCliente.replace(/[^A-Z0-9]/g, '');
        
        // Si el RFC es genérico, el nombre debe ser "PUBLICO EN GENERAL"
        let nombreReceptor = facturaData.clienteRazonSocial || facturaData.clienteNombre || 'Cliente sin nombre';
        
        if (rfcCliente === 'XAXX010101000') {
            nombreReceptor = 'PUBLICO EN GENERAL';
        }
        
        // Formatear nombre: MAYÚSCULAS y sin acentos
        nombreReceptor = nombreReceptor
            .toUpperCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9\s]/g, '');

        // Validar que el nombre no esté vacío
        if (!nombreReceptor || nombreReceptor.trim() === '') {
            nombreReceptor = 'PUBLICO EN GENERAL';
            rfcCliente = 'XAXX010101000';
        }

        // Construir items para el endpoint
        const itemsPayload = items.map((item, index) => {
            const cantidad = parseFloat(item.cantidad) || 1;
            const precio = parseFloat(item.precioUnitario || item.precio || 0);
            const subtotal = cantidad * precio;
            const impuesto = parseFloat(facturaData.impuesto || 16);
            const total = subtotal * (1 + impuesto / 100);

            return {
                Quantity: cantidad.toFixed(2),
                ProductCode: item.productCode || '10111302',
                UnitCode: item.unitCode || 'H87',
                Unit: item.unit || 'Pieza',
                Description: (item.descripcion || 'Producto/Servicio sin descripción').substring(0, 1000),
                IdentificationNumber: item.identificationNumber || item.sku || item.codigo || `ITEM-${Date.now()}-${index}`,
                UnitPrice: precio.toFixed(2),
                Subtotal: subtotal.toFixed(2),
                TaxObject: '02',
                Taxes: [
                    {
                        Name: 'IVA',
                        Rate: (impuesto / 100).toFixed(2),
                        Total: (subtotal * impuesto / 100).toFixed(2),
                        Base: subtotal.toFixed(2),
                        IsRetention: 'false',
                        IsFederalTax: 'true'
                    }
                ],
                Total: total.toFixed(2)
            };
        });

        // Construir el payload completo
        const payload = {
            Receiver: {
                Name: nombreReceptor.substring(0, 300),
                CfdiUse: facturaData.usoCFDI || 'G03',
                Rfc: rfcCliente,
                FiscalRegime: facturaData.clienteRegimenCodigo || '601',
                TaxZipCode: facturaData.clienteCodigoPostal || '00000'
            },
            CfdiType: 'I',
            NameId: '1',
            ExpeditionPlace: facturaData.empresaCodigoPostal || '57200',
            Serie: facturaData.serie || null,
            Folio: facturaData.facturaNumero || '001',
            PaymentForm: facturaData.formaPago || '01',
            PaymentMethod: facturaData.metodoPago || 'PUE',
            Exportation: facturaData.exportacion || '01',
            Items: itemsPayload
        };

        console.log('📤 Payload construido:');
        console.log('RFC Receptor:', payload.Receiver.Rfc);
        console.log('Nombre Receptor:', payload.Receiver.Name);
        console.log('Cantidad de Items:', itemsPayload.length);

        return payload;
    }

    /**
     * TIMBRAR FACTURA - Recibe los datos directamente
     * @param {string} facturaId - ID de la factura (opcional, si ya existe)
     * @param {object} facturaData - Datos de la factura (obligatorio para nueva factura)
     */
    async timbrarFactura(facturaId, facturaData = null) {
        try {
            let factura;
            
            // Si se proporcionan datos directamente, usarlos
            if (facturaData) {
                console.log('📄 Usando datos proporcionados directamente para timbrar');
                factura = facturaData;
            } else if (facturaId) {
                // Si no, obtener de la base de datos
                console.log('📄 Obteniendo factura de la base de datos:', facturaId);
                factura = await this.getFacturaById(facturaId);
                if (!factura) {
                    throw new Error('Factura no encontrada');
                }
            } else {
                throw new Error('Se requiere facturaId o facturaData');
            }

            // Validar que los datos necesarios estén presentes
            if (!factura.clienteRFC) {
                throw new Error('El RFC del cliente es requerido');
            }

            if (!factura.items || factura.items.length === 0) {
                throw new Error('La factura debe tener al menos un item');
            }

            // Construir payload para el endpoint
            const payload = this._buildPayload(factura);

            console.log('📤 Enviando factura a timbrar...');

            // Llamar al endpoint de Firebase
            const response = await fetch(TIMBRAR_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log('📥 Respuesta recibida - Status:', response.status);

            // Obtener la respuesta como texto
            const responseText = await response.text();
            console.log('📥 Respuesta raw:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('📥 Respuesta parseada:', JSON.stringify(data, null, 2));
            } catch (e) {
                console.error('❌ Error parsing response:', responseText);
                throw new Error(`Error en el servidor: ${response.status} - ${responseText}`);
            }

            // 🔥 VERIFICAR ÉXITO - La respuesta tiene diferentes formatos posibles
            // Caso 1: Tiene Status = "active" (éxito)
            // Caso 2: Tiene UUID en Complement.TaxStamp.Uuid
            // Caso 3: Tiene data.success = true
            // Caso 4: Tiene data.Uuid o data.uuid
            
            const tieneUuid = data.Complement?.TaxStamp?.Uuid || 
                             data.Complement?.TaxStamp?.uuid ||
                             data.Uuid || 
                             data.uuid;
            
            const esActiva = data.Status === 'active';
            const esExitosa = data.success === true;
            const tieneId = data.Id || data.id;
            
            const esExito = tieneUuid || esActiva || esExitosa || tieneId;

            if (!esExito) {
                const errorMsg = data.Message || data.message || data.error || 'Error al timbrar la factura';
                throw new Error(errorMsg);
            }

            console.log('✅ Factura timbrada exitosamente!');
            console.log('📋 UUID:', data.Complement?.TaxStamp?.Uuid || data.Uuid || data.uuid);

            // ✅ Si hay facturaId, actualizar en la base de datos
            if (facturaId) {
                const timbradoData = {
                    estatus: 'timbrada',
                    facturamaId: data.Id || data.id || '',
                    timbrado: {
                        uuid: data.Complement?.TaxStamp?.Uuid || data.Complement?.TaxStamp?.uuid || data.Uuid || data.uuid || '',
                        fechaTimbrado: data.Complement?.TaxStamp?.Date || data.Complement?.TaxStamp?.date || data.Date || data.date || '',
                        sello: data.Complement?.TaxStamp?.CfdiSign || data.Complement?.TaxStamp?.cfdiSign || data.CfdiSign || '',
                        noCertificado: data.Complement?.TaxStamp?.SatCertNumber || data.Complement?.TaxStamp?.satCertNumber || data.CertNumber || '',
                        cadenaOriginal: data.OriginalString || '',
                        qrCode: data.QrCode || data.qrCode || ''
                    },
                    pdfUrl: data.PdfUrl || data.pdfUrl || '',
                    xmlUrl: data.XmlUrl || data.xmlUrl || '',
                    serie: data.Serie || '',
                    folio: data.Folio || '',
                    total: data.Total || 0,
                    subtotal: data.Subtotal || 0,
                    modificadoPor: this._getCurrentUserUid(),
                    updatedAt: new Date().toISOString()
                };

                await this.repository.updateFactura(facturaId, timbradoData);
                console.log('✅ Factura actualizada en base de datos:', facturaId);
            }

            return {
                success: true,
                message: 'Factura timbrada exitosamente',
                data: data,
                timbrado: data
            };

        } catch (error) {
            console.error('❌ Error en timbrarFactura:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de facturas
     */
    async getFacturaStats() {
        try {
            return await this.repository.getFacturaStats();
        } catch (error) {
            console.error('❌ Error en getFacturaStats:', error);
            return { total: 0, borradores: 0, pendientes: 0, timbradas: 0, canceladas: 0, totalMonto: 0 };
        }
    }

    /**
     * Verifica si una factura tiene PDF y XML guardados
     */
    async verificarArchivosFactura(facturaId) {
        try {
            const factura = await this.getFacturaById(facturaId);
            if (!factura) {
                throw new Error('Factura no encontrada');
            }

            const result = {
                pdf: { existe: false, url: null },
                xml: { existe: false, url: null }
            };

            // Verificar PDF
            if (factura.pdfUrl) {
                try {
                    const response = await fetch(factura.pdfUrl, { method: 'HEAD' });
                    result.pdf.existe = response.ok;
                    result.pdf.url = factura.pdfUrl;
                } catch (error) {
                    console.error('❌ Error verificando PDF:', error);
                }
            }

            // Verificar XML
            if (factura.xmlUrl) {
                try {
                    const response = await fetch(factura.xmlUrl, { method: 'HEAD' });
                    result.xml.existe = response.ok;
                    result.xml.url = factura.xmlUrl;
                } catch (error) {
                    console.error('❌ Error verificando XML:', error);
                }
            }

            return result;

        } catch (error) {
            console.error('❌ Error verificando archivos:', error);
            throw error;
        }
    }
    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default FacturaService;