/* ========================================
   FACTURA SERVICE
   Lógica de negocio para gestión de facturas
   ======================================== */

import FacturaRepository from '../repositories/facturaRepository.js';
import FacturaModel from '../models/facturaModel.js';
import CotizacionService from './cotizacionService.js';
import StorageService from './storageService.js';
import { generarPDFFactura, extraerDatosFiscalesDesdeXML } from '../utils/pdfGenerator.js';

// URLs de Cloud Functions para Facturama
const TIMBRAR_URL = 'https://us-central1-rsienterprise.cloudfunctions.net/crearFactura';
const CANCELAR_URL = 'https://us-central1-rsienterprise.cloudfunctions.net/cancelarFactura';

export class FacturaService {
    
    constructor() {
        this.repository = new FacturaRepository();
        this.cotizacionService = new CotizacionService();
        this.storageService = new StorageService();
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

            // Si se proporciona un número de factura, verificar si ya existe un documento previo
            if (data.facturaNumero) {
                const facturaPrevia = await this.repository.getFacturaByFolio(data.facturaNumero);
                if (facturaPrevia && facturaPrevia.id) {
                    console.log(`ℹ️ Reutilizando documento de factura existente con folio ${data.facturaNumero} (ID: ${facturaPrevia.id})`);
                    await this.updateFactura(facturaPrevia.id, data);
                    return {
                        success: true,
                        id: facturaPrevia.id,
                        message: 'Factura actualizada exitosamente (reutilizada por folio)',
                        reused: true
                    };
                }
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
     * Crea una nueva factura a partir de una cotización existente
     * @param {string} cotizacionId - ID de la cotización
     * @param {string} facturaNumero - Número consecutivo asignado a la factura
     * @returns {Promise<{success: boolean, id: string, message: string, data: Object}>}
     */
    async crearFacturaDesdeCotizacion(cotizacionId, facturaNumero) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const cotizacion = await this.cotizacionService.getCotizacionById(cotizacionId);
            if (!cotizacion) {
                throw new Error('Cotización no encontrada');
            }

            const facturaData = FacturaModel.fromCotizacion(cotizacion, facturaNumero);
            const docId = await this.repository.createFactura(facturaData);

            return {
                success: true,
                id: docId,
                message: 'Factura creada exitosamente a partir de la cotización',
                data: facturaData
            };
        } catch (error) {
            console.error('❌ Error en crearFacturaDesdeCotizacion:', error);
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
    async getFacturaById(facturaId, forceRefresh = false) {
        try {
            return await this.repository.getFacturaById(facturaId, forceRefresh);
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

            // Proteger facturas timbradas de ser degradadas a borrador o de que un PDF preliminar sobrescriba el oficial
            const existing = await this.repository.getFacturaById(facturaId);
            const safeData = { ...data };

            if (existing && (existing.estatus === 'timbrada' || existing.estatus === 'cancelada')) {
                if (safeData.estatus && safeData.estatus === 'borrador') {
                    throw new Error('No se puede revertir una factura timbrada o cancelada a borrador');
                }
                // Si la factura ya está timbrada, conservar el pdfUrl oficial y evitar que un path de borrador lo reemplace
                if (safeData.pdfUrl && safeData.pdfUrl.includes('borradores')) {
                    delete safeData.pdfUrl;
                }
            }

            const updateData = {
                ...safeData,
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

        // Obtener el RFC del cliente - usar el que viene en los datos
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

        // 🔥 Construir items para el endpoint - USAR CLAVE SAT DEL ITEM
        const itemsPayload = items.map((item, index) => {
            const cantidad = parseFloat(item.cantidad) || 1;
            const precio = parseFloat(item.precioUnitario || item.precio || 0);
            const subtotal = cantidad * precio;
            const impuesto = parseFloat(facturaData.impuesto || 16);
            const total = subtotal * (1 + impuesto / 100);
            
            // 🔥 OBTENER CLAVE SAT DEL ITEM - si no tiene, usar la del producto o un default
            let productCode = item.claveSat || item.productCode || '10111302';
            
            // Si la clave SAT no tiene 8 dígitos, usar default
            if (!/^\d{8}$/.test(productCode)) {
                console.warn(`⚠️ Clave SAT inválida para "${item.descripcion}": ${productCode}, usando default 10111302`);
                productCode = '10111302';
            }

            return {
                Quantity: cantidad.toFixed(2),
                ProductCode: productCode,  // 🔥 Ahora usa la clave SAT del item
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
            PaymentForm: (facturaData.metodoPago === 'PPD') ? '99' : (facturaData.formaPago || '01'),
            PaymentMethod: facturaData.metodoPago || 'PUE',
            Exportation: facturaData.exportacion || '01',
            Items: itemsPayload
        };

        console.log('📤 Payload construido:');
        console.log('RFC Receptor:', payload.Receiver.Rfc);
        console.log('Nombre Receptor:', payload.Receiver.Name);
        console.log('Cantidad de Items:', itemsPayload.length);
        console.log('Items con claves SAT:', itemsPayload.map(i => `${i.Description}: ${i.ProductCode}`));

        return payload;
    }

    /**
    /**
     * Busca si un folio ya fue emitido previamente en Facturama
     * @param {string} folio - Folio de la factura (ej: 'FAC-20261012-001')
     * @returns {Promise<Object|null>}
     */
    async buscarEmisionPreviaFacturama(folio) {
        if (!folio) return null;
        try {
            console.log(`🔍 Verificando si existe emisión previa en Facturama para folio: ${folio}`);
            const response = await fetch(`https://us-central1-rsienterprise.cloudfunctions.net/consultarFactura?type=issued&folio=${encodeURIComponent(folio)}`);
            if (!response.ok) return null;
            const data = await response.json();
            
            // Si el backend devolvió { factura }
            if (data.factura && !Array.isArray(data.factura) && data.factura.Folio === folio) {
                return data.factura;
            }

            const list = Array.isArray(data.factura) ? data.factura : (Array.isArray(data) ? data : []);
            const encontrada = list.find(c => c.Folio === folio && c.Status === 'active' && c.IsActive !== false);
            if (encontrada) {
                console.log(`⚠️ Encontrada emisión previa en Facturama para folio ${folio}: ID ${encontrada.Id}, UUID ${encontrada.Uuid}`);
                return encontrada;
            }
            return null;
        } catch (error) {
            console.warn('⚠️ No se pudo consultar emisiones previas en Facturama:', error.message);
            return null;
        }
    }

    /**
     * Recupera y sincroniza los comprobantes (XML fiscal y PDF) de una factura ya emitida en Facturama
     * sin volver a emitir otro CFDI.
     * @param {string} facturaId - ID del documento en Firestore
     * @returns {Promise<Object>}
     */
    async recuperarComprobantes(facturaId) {
        try {
            const factura = await this.getFacturaById(facturaId);
            if (!factura) {
                throw new Error('Factura no encontrada');
            }

            let facturamaId = factura.facturamaId;
            let uuid = factura.timbrado?.uuid;

            // Si no tiene facturamaId, intentar buscar en Facturama por folio
            if (!facturamaId && factura.facturaNumero) {
                const previa = await this.buscarEmisionPreviaFacturama(factura.facturaNumero);
                if (previa) {
                    facturamaId = previa.Id;
                    uuid = previa.Uuid;
                }
            }

            if (!facturamaId) {
                throw new Error('La factura no tiene identificador de Facturama ni emisión previa recuperable');
            }

            console.log(`🔄 Recuperando comprobantes desde Facturama para factura ${facturaId} (Facturama ID: ${facturamaId})`);

            // 1. Obtener XML oficial desde Facturama
            const xmlResponse = await fetch(`https://us-central1-rsienterprise.cloudfunctions.net/obtenerXMLFactura?id=${facturamaId}`);
            if (!xmlResponse.ok) {
                throw new Error(`No se pudo obtener el XML fiscal desde Facturama (${xmlResponse.status})`);
            }
            const xmlString = await xmlResponse.text();

            if (!xmlString.includes('<?xml') && !xmlString.includes('<cfdi:Comprobante')) {
                throw new Error('El contenido obtenido no corresponde a un XML de CFDI válido');
            }

            // Extraer datos fiscales auténticos del XML oficial
            const fiscalXml = extraerDatosFiscalesDesdeXML(xmlString) || {};
            const timbradoRecuperado = {
                ...(factura.timbrado || {}),
                ...fiscalXml,
                uuid: uuid || fiscalXml.uuid || factura.timbrado?.uuid || '',
                fechaTimbrado: fiscalXml.fechaTimbrado || factura.timbrado?.fechaTimbrado || new Date().toISOString(),
                sello: fiscalXml.sello || factura.timbrado?.sello || '',
                selloSat: fiscalXml.selloSat || factura.timbrado?.selloSat || '',
                noCertificado: fiscalXml.noCertificado || factura.timbrado?.noCertificado || '',
                certNumber: fiscalXml.certNumber || factura.timbrado?.certNumber || '',
                rfcProveedor: fiscalXml.rfcProveedor || factura.timbrado?.rfcProveedor || ''
            };

            // 2. Almacenar XML en Firebase Storage
            const xmlStorageResult = await this.storageService.uploadXML(
                xmlString,
                factura.facturaNumero || facturamaId,
                `facturas/${facturamaId}`
            );

            if (!xmlStorageResult.success || !xmlStorageResult.url) {
                throw new Error('Error al guardar el XML en Firebase Storage: ' + (xmlStorageResult.error || 'Error desconocido'));
            }

            // 3. Generar y almacenar PDF aprobado en Firebase Storage
            let pdfUrl = factura.pdfUrl;
            let pdfPath = factura.pdfPath;
            let facturamaPdfUrl = factura.facturamaPdfUrl || '';

            try {
                const facturaParaPdf = {
                    ...factura,
                    facturamaId: facturamaId,
                    xmlUrl: xmlStorageResult.url,
                    xmlPath: xmlStorageResult.fileName,
                    timbrado: timbradoRecuperado
                };
                const pdfBlob = await generarPDFFactura(facturaParaPdf, { esBorrador: false, xmlContent: xmlString });
                if (pdfBlob) {
                    const pdfStorageResult = await this.storageService.uploadPDF(
                        pdfBlob,
                        factura.facturaNumero || facturamaId,
                        'facturas'
                    );
                    if (pdfStorageResult.success && pdfStorageResult.url) {
                        pdfUrl = pdfStorageResult.url;
                        pdfPath = pdfStorageResult.fileName;
                    }
                }
            } catch (pdfErr) {
                console.warn('⚠️ Error generando PDF en recuperación, recurriendo a PDF del PAC:', pdfErr);
                try {
                    const pacPdfRes = await fetch(`https://us-central1-rsienterprise.cloudfunctions.net/obtenerPDFFactura?id=${facturamaId}`);
                    if (pacPdfRes.ok) {
                        const pacBlob = await pacPdfRes.blob();
                        const pdfStorageResult = await this.storageService.uploadPDF(
                            pacBlob,
                            factura.facturaNumero || facturamaId,
                            'facturas'
                        );
                        if (pdfStorageResult.success) {
                            pdfUrl = pdfStorageResult.url;
                            pdfPath = pdfStorageResult.fileName;
                            facturamaPdfUrl = pdfStorageResult.url;
                        }
                    }
                } catch (pacErr) {
                    console.warn('⚠️ Fallback de PDF del PAC falló:', pacErr);
                }
            }

            // 4. Actualizar Firestore
            const updatePayload = {
                estatus: 'timbrada',
                facturamaId: facturamaId,
                timbrado: timbradoRecuperado,
                xmlUrl: xmlStorageResult.url,
                xmlPath: xmlStorageResult.fileName,
                pdfUrl: pdfUrl || '',
                facturamaPdfUrl: facturamaPdfUrl || factura.facturamaPdfUrl || '',
                pdfPath: pdfPath || '',
                archivosCompletos: Boolean(xmlStorageResult.url && pdfUrl),
                modificadoPor: this._getCurrentUserUid(),
                updatedAt: new Date().toISOString()
            };

            if (uuid) {
                updatePayload['timbrado.uuid'] = uuid;
            }

            await this.repository.updateFactura(facturaId, updatePayload);
            console.log(`✅ Comprobantes recuperados y guardados exitosamente para factura ${facturaId}`);

            return {
                success: true,
                message: 'Comprobantes recuperados y guardados exitosamente',
                facturamaId: facturamaId,
                uuid: uuid || factura.timbrado?.uuid,
                pdfUrl: pdfUrl,
                xmlUrl: xmlStorageResult.url,
                pdfPath: pdfPath,
                xmlPath: xmlStorageResult.fileName
            };
        } catch (error) {
            console.error('❌ Error en recuperarComprobantes:', error);
            throw error;
        }
    }

    /**
     * TIMBRAR FACTURA - Emite el CFDI 4.0 ante el SAT a través de Facturama sandbox
     * con protección de idempotencia, persistencia y almacenamiento de XML y PDF.
     * @param {string} facturaId - ID de la factura
     * @param {object} facturaData - Datos opcionales de la factura
     */
    async timbrarFactura(facturaId, facturaData = null) {
        try {
            let factura;
            if (facturaData) {
                console.log('📄 Usando datos proporcionados directamente para timbrar');
                factura = facturaData;
            } else if (facturaId) {
                console.log('📄 Obteniendo factura de la base de datos:', facturaId);
                factura = await this.getFacturaById(facturaId, true);
                if (!factura) {
                    // Reintentar brevemente en caso de latencia de Firestore
                    await new Promise(r => setTimeout(r, 400));
                    factura = await this.getFacturaById(facturaId, true);
                }
                if (!factura) {
                    throw new Error(`Factura no encontrada (ID: ${facturaId})`);
                }
            } else {
                throw new Error('Se requiere facturaId o facturaData');
            }

            // 1. Si la factura ya se encuentra timbrada con UUID, NO re-emitir
            if (factura.estatus === 'timbrada' && factura.timbrado?.uuid) {
                console.log('ℹ️ Factura ya se encuentra timbrada:', facturaId);
                if (!factura.xmlUrl || !factura.pdfUrl) {
                    return await this.recuperarComprobantes(facturaId);
                }
                return {
                    success: true,
                    message: 'Factura ya se encuentra timbrada',
                    facturamaId: factura.facturamaId,
                    uuid: factura.timbrado.uuid,
                    fechaTimbrado: factura.timbrado.fechaTimbrado,
                    pdfUrl: factura.pdfUrl,
                    xmlUrl: factura.xmlUrl,
                    pdfPath: factura.pdfPath,
                    xmlPath: factura.xmlPath,
                    timbrado: factura.timbrado
                };
            }

            // 2. Si ya tiene un facturamaId registrado, recuperar sin volver a timbrar
            if (factura.facturamaId) {
                console.log(`ℹ️ La factura ya cuenta con identificador de Facturama (${factura.facturamaId}), recuperando comprobante...`);
                return await this.recuperarComprobantes(facturaId);
            }

            // 3. Antes de emitir, comprobar si existe una emisión previa con este mismo folio en Facturama
            if (factura.facturaNumero) {
                const emisionPrevia = await this.buscarEmisionPreviaFacturama(factura.facturaNumero);
                if (emisionPrevia && emisionPrevia.Id) {
                    console.log(`⚠️ Se detectó emisión previa para folio ${factura.facturaNumero} en Facturama (ID: ${emisionPrevia.Id})`);
                    if (facturaId) {
                        await this.repository.updateFactura(facturaId, {
                            facturamaId: emisionPrevia.Id,
                            'timbrado.uuid': emisionPrevia.Uuid || '',
                            estatus: 'pendiente'
                        });
                        return await this.recuperarComprobantes(facturaId);
                    }
                }
            }

            // 4. Validar datos mínimos requeridos para timbrado fiscal
            const validacion = FacturaModel.validateForTimbrado(factura);
            if (!validacion.valid) {
                const primerError = validacion.errors[0] || 'Datos fiscales incompletos para timbrar';
                throw new Error(primerError);
            }

            // 5. Marcar estatus 'pendiente' en Firestore antes de solicitar la emisión
            if (facturaId) {
                await this.repository.updateFactura(facturaId, {
                    estatus: 'pendiente',
                    updatedAt: new Date().toISOString()
                });
            }

            // 6. Construir payload y solicitar emisión a Cloud Function
            const payload = this._buildPayload(factura);
            console.log('📤 Enviando factura a timbrar en Facturama sandbox...');

            let response;
            try {
                response = await fetch(TIMBRAR_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
            } catch (networkError) {
                console.error('❌ Error de comunicación con endpoint de timbrado:', networkError);
                // Si la petición falló por red o timeout, verificar si Facturama sí emitió
                if (factura.facturaNumero && facturaId) {
                    const emisionVerif = await this.buscarEmisionPreviaFacturama(factura.facturaNumero);
                    if (emisionVerif && emisionVerif.Id) {
                        console.log('✅ Emisión verificada tras fallo de red:', emisionVerif.Id);
                        await this.repository.updateFactura(facturaId, {
                            facturamaId: emisionVerif.Id,
                            'timbrado.uuid': emisionVerif.Uuid || ''
                        });
                        return await this.recuperarComprobantes(facturaId);
                    }
                }
                throw new Error(`Error de comunicación con el servicio de timbrado: ${networkError.message}`);
            }

            console.log('📥 Respuesta recibida - Status:', response.status);
            const responseText = await response.text();
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Error parseando respuesta:', responseText);
                throw new Error(`Error en el servidor: ${response.status} - ${responseText}`);
            }

            const timbradoObj = data.timbrado || data;
            const facturamaId = data.facturamaId || timbradoObj.Id || timbradoObj.id || '';
            const uuid = timbradoObj.Complement?.TaxStamp?.Uuid || 
                         timbradoObj.Complement?.TaxStamp?.uuid || 
                         timbradoObj.Uuid || 
                         timbradoObj.uuid || 
                         data.Uuid || 
                         data.uuid || '';

            const esActiva = timbradoObj.Status === 'active' || data.Status === 'active';
            const esExitosa = data.success === true;
            const esExito = Boolean(uuid || esActiva || esExitosa || facturamaId);

            if (!esExito) {
                // Si Facturama devolvió error pero el comprobante ya existía, comprobar
                if (factura.facturaNumero && facturaId) {
                    const emisionVerif = await this.buscarEmisionPreviaFacturama(factura.facturaNumero);
                    if (emisionVerif && emisionVerif.Id) {
                        console.log('✅ Emisión previa recuperada tras error reportado por Facturama:', emisionVerif.Id);
                        await this.repository.updateFactura(facturaId, {
                            facturamaId: emisionVerif.Id,
                            'timbrado.uuid': emisionVerif.Uuid || ''
                        });
                        return await this.recuperarComprobantes(facturaId);
                    }
                }
                const errorMsg = data.message || data.Message || data.error?.message || data.error || 'Error al timbrar la factura';
                const detalle = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : String(errorMsg);
                throw new Error(detalle);
            }

            console.log('✅ Factura timbrada exitosamente en sandbox!');
            console.log('📋 UUID:', uuid || 'N/A');
            console.log('📋 Facturama ID:', facturamaId);

            const fechaTimbrado = timbradoObj.Complement?.TaxStamp?.Date || 
                                  timbradoObj.Complement?.TaxStamp?.date || 
                                  timbradoObj.Date || 
                                  timbradoObj.date || 
                                  new Date().toISOString();

            const sello = timbradoObj.Complement?.TaxStamp?.CfdiSign || 
                          timbradoObj.Complement?.TaxStamp?.cfdiSign || 
                          timbradoObj.CfdiSign || '';

            const noCertificado = timbradoObj.Complement?.TaxStamp?.SatCertNumber || 
                                  timbradoObj.Complement?.TaxStamp?.satCertNumber || 
                                  timbradoObj.CertNumber || '';

            const cadenaOriginal = timbradoObj.OriginalString || data.OriginalString || '';
            const qrCode = timbradoObj.QrCode || data.QrCode || '';

            // 7. Persistir inmediatamente el resultado fiscal en Firestore para no perder el registro de Facturama
            const timbradoData = {
                facturamaId: facturamaId,
                timbrado: {
                    uuid: uuid,
                    fechaTimbrado: fechaTimbrado,
                    sello: sello,
                    noCertificado: noCertificado,
                    cadenaOriginal: cadenaOriginal,
                    qrCode: qrCode
                },
                serie: timbradoObj.Serie || data.Serie || factura.serie || '',
                folio: timbradoObj.Folio || data.Folio || factura.facturaNumero || '',
                total: parseFloat(timbradoObj.Total || data.Total || factura.totalFinal || 0),
                subtotal: parseFloat(timbradoObj.Subtotal || data.Subtotal || factura.subtotal || 0),
                modificadoPor: this._getCurrentUserUid(),
                updatedAt: new Date().toISOString()
            };

            if (facturaId) {
                await this.repository.updateFactura(facturaId, timbradoData);
            }

            // 8. OBTENER Y ALMACENAR XML FISCAL EN FIREBASE STORAGE
            let xmlUrl = null;
            let xmlPath = null;
            let xmlString = data.xmlContent || null;
            try {
                if (!xmlString && facturamaId) {
                    const xmlRes = await fetch(`https://us-central1-rsienterprise.cloudfunctions.net/obtenerXMLFactura?id=${facturamaId}`);
                    if (xmlRes.ok) {
                        xmlString = await xmlRes.text();
                    }
                }

                if (xmlString && (xmlString.includes('<?xml') || xmlString.includes('<cfdi:Comprobante'))) {
                    // Extraer datos fiscales auténticos directamente del XML
                    const fiscalXml = extraerDatosFiscalesDesdeXML(xmlString);
                    if (fiscalXml) {
                        timbradoData.timbrado = {
                            ...timbradoData.timbrado,
                            ...fiscalXml,
                            sello: timbradoData.timbrado.sello || fiscalXml.sello,
                            selloSat: timbradoData.timbrado.selloSat || fiscalXml.selloSat,
                            noCertificado: timbradoData.timbrado.noCertificado || fiscalXml.noCertificado,
                            certNumber: timbradoData.timbrado.certNumber || fiscalXml.certNumber,
                            rfcProveedor: timbradoData.rfcProveedor || fiscalXml.rfcProveedor
                        };
                    }

                    const xmlStorageResult = await this.storageService.uploadXML(
                        xmlString, 
                        factura.facturaNumero || facturamaId, 
                        `facturas/${facturamaId}`
                    );
                    if (xmlStorageResult.success && xmlStorageResult.url) {
                        xmlUrl = xmlStorageResult.url;
                        xmlPath = xmlStorageResult.fileName;
                    }
                }
            } catch (xmlStorageErr) {
                console.error('⚠️ Error guardando XML en Storage:', xmlStorageErr);
            }

            // 9. GENERAR Y ALMACENAR PDF APROBADO EN FIREBASE STORAGE
            let pdfUrl = null;
            let pdfPath = null;
            try {
                const facturaParaPdf = {
                    ...factura,
                    ...timbradoData,
                    xmlUrl: xmlUrl || '',
                    xmlPath: xmlPath || ''
                };
                const coherentPdfBlob = await generarPDFFactura(facturaParaPdf, { esBorrador: false, xmlContent: xmlString });
                if (coherentPdfBlob) {
                    const pdfStorageResult = await this.storageService.uploadPDF(
                        coherentPdfBlob, 
                        factura.facturaNumero || timbradoData.folio || facturamaId, 
                        'facturas'
                    );
                    if (pdfStorageResult.success && pdfStorageResult.url) {
                        pdfUrl = pdfStorageResult.url;
                        pdfPath = pdfStorageResult.fileName;
                    }
                }
            } catch (pdfStorageErr) {
                console.error('⚠️ Error generando representación PDF en Storage:', pdfStorageErr);
            }

            // Fallback de PDF si la generación local no produjo URL
            if (!pdfUrl && facturamaId) {
                try {
                    const pacPdfRes = await fetch(`https://us-central1-rsienterprise.cloudfunctions.net/obtenerPDFFactura?id=${facturamaId}`);
                    if (pacPdfRes.ok) {
                        const pacBlob = await pacPdfRes.blob();
                        const pdfStorageResult = await this.storageService.uploadPDF(
                            pacBlob, 
                            factura.facturaNumero || facturamaId, 
                            'facturas'
                        );
                        if (pdfStorageResult.success) {
                            pdfUrl = pdfStorageResult.url;
                            pdfPath = pdfStorageResult.fileName;
                        }
                    }
                } catch (pacErr) {
                    console.warn('⚠️ Fallback de PDF del PAC falló:', pacErr);
                }
            }

            // 10. Actualizar estatus final en Firestore
            const archivosCompletos = Boolean(xmlUrl && pdfUrl);
            const timbradoFinal = {
                estatus: archivosCompletos ? 'timbrada' : 'pendiente',
                pdfUrl: pdfUrl || data.pdfUrl || '',
                facturamaPdfUrl: data.pdfUrl || '',
                xmlUrl: xmlUrl || data.xmlUrl || '',
                pdfPath: pdfPath || data.pdfPath || '',
                xmlPath: xmlPath || data.xmlPath || '',
                archivosCompletos: archivosCompletos,
                modificadoPor: this._getCurrentUserUid(),
                updatedAt: new Date().toISOString()
            };

            if (facturaId) {
                await this.repository.updateFactura(facturaId, timbradoFinal);
                console.log(`✅ Factura finalizada en base de datos: ${facturaId} (Estatus: ${timbradoFinal.estatus})`);
            }

            return {
                success: true,
                message: archivosCompletos 
                    ? 'Factura timbrada exitosamente y archivos guardados' 
                    : 'Factura timbrada ante el SAT. Pendiente de sincronizar archivos en Storage.',
                facturamaId: facturamaId,
                uuid: uuid,
                fechaTimbrado: fechaTimbrado,
                pdfUrl: pdfUrl || data.pdfUrl || '',
                xmlUrl: xmlUrl || data.xmlUrl || '',
                pdfPath: pdfPath || data.pdfPath || '',
                xmlPath: xmlPath || data.xmlPath || '',
                archivosCompletos: archivosCompletos,
                timbrado: timbradoData.timbrado,
                data: data
            };

        } catch (error) {
            console.error('❌ Error en timbrarFactura:', error);
            throw error;
        }
    }

    /**
     * Solicita la cancelación de una factura mediante Firebase Cloud Functions / Facturama
     * @param {string} facturaId - ID del documento en Firestore
     * @param {Object} options - Parámetros de cancelación { motivo: string, folioSustitucion?: string }
     * @returns {Promise<{success: boolean, estatus: string, message: string, data: Object}>}
     */
    async cancelarFactura(facturaId, { motivo, folioSustitucion = null } = {}) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            if (!facturaId) {
                throw new Error('Se requiere el ID de la factura a cancelar');
            }

            // Validar parámetros conforme a reglas del SAT
            const validacion = FacturaModel.validateCancelacion({ motivo, folioSustitucion });
            if (!validacion.valid) {
                const primerError = Object.values(validacion.errors)[0];
                throw new Error(primerError);
            }

            // Obtener datos actuales de la factura
            const factura = await this.getFacturaById(facturaId);
            if (!factura) {
                throw new Error('Factura no encontrada');
            }

            if (factura.estatus === 'cancelada') {
                throw new Error('La factura ya se encuentra cancelada');
            }

            if (factura.estatus !== 'timbrada' && factura.estatus !== 'cancelacion_pendiente') {
                throw new Error(`Solo las facturas timbradas o en proceso pueden ser canceladas. Estatus actual: "${factura.estatus}"`);
            }

            const targetId = factura.facturamaId || factura.timbrado?.uuid;
            if (!targetId) {
                throw new Error('La factura no posee identificador de Facturama ni UUID fiscal para procesar la cancelación');
            }

            console.log(`🚫 Solicitando cancelación a Cloud Function para factura ${facturaId} (ID Facturama: ${targetId}, Motivo: ${motivo})`);

            const response = await fetch(CANCELAR_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    facturaId: facturaId,
                    id: targetId,
                    uuid: factura.timbrado?.uuid || '',
                    motivo: motivo,
                    folioSustitucion: motivo === '01' ? folioSustitucion : null,
                    uid: uid
                })
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                throw new Error(`Error en el servidor de cancelación (${response.status}): ${responseText}`);
            }

            if (!response.ok || !result.success) {
                const errorMsg = result.message || result.error || 'Error al procesar la cancelación';
                throw new Error(errorMsg);
            }

            // Interpretar el estatus fiscal real devuelto por el PAC / SAT
            // 'canceled' -> confirmada; 'pending' / 'requested' -> en espera de aceptación del receptor
            const providerStatus = (result.status || result.Status || '').toLowerCase();
            const nuevoEstatus = providerStatus === 'canceled' ? 'cancelada' : 'cancelacion_pendiente';

            // Actualizar Firestore con la respuesta confirmada
            await this.repository.updateCancelacionFactura(facturaId, {
                estatus: nuevoEstatus,
                fechaSolicitud: new Date().toISOString(),
                motivo: motivo,
                folioSustitucion: motivo === '01' ? folioSustitucion : '',
                status: result.status || result.Status || '',
                mensaje: result.message || result.Message || '',
                acuseXmlUrl: result.acuseXmlUrl || '',
                acuseXmlPath: result.acuseXmlPath || ''
            });

            return {
                success: true,
                estatus: nuevoEstatus,
                statusProveedor: result.status || result.Status,
                message: result.message || (nuevoEstatus === 'cancelada' ? 'Factura cancelada exitosamente' : 'Solicitud de cancelación en proceso ante el SAT'),
                data: result
            };

        } catch (error) {
            console.error('❌ Error en cancelarFactura:', error);
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