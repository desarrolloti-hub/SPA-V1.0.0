/* ==========================================================================
   COMPLEMENTO PAGO SERVICE - RSI Enterprise
   Lógica de negocio para Complementos de Recepción de Pagos (REP 2.0 / CFDI 4.0),
   historial de parcialidades y sincronización de saldos con Facturama.
   ========================================================================== */

import ComplementoPagoRepository from '../repositories/complementoPagoRepository.js';
import FacturaRepository from '../repositories/facturaRepository.js';
import ComplementoPagoModel from '../models/complementoPagoModel.js';
import StorageService from './storageService.js';
import { generarPDFComplementoPago, descargarPDFComplementoPago, abrirPDFComplementoPago } from '../utils/pdfGenerator.js';

// URL de la Cloud Function que se comunica con Facturama (/3/cfdis)
const TIMBRAR_URL = 'https://us-central1-rsienterprise.cloudfunctions.net/crearFactura';

export class ComplementoPagoService {

    constructor() {
        this.repository = new ComplementoPagoRepository();
        this.facturaRepository = new FacturaRepository();
        this.storageService = new StorageService();
    }

    /**
     * Obtiene el UID del usuario actual
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
     * Obtiene el nombre del usuario actual
     */
    _getCurrentUserName() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return 'Colaborador RSI';
            const sessionData = JSON.parse(session);
            return sessionData.nombre || sessionData.displayName || sessionData.email || 'Colaborador RSI';
        } catch {
            return 'Colaborador RSI';
        }
    }

    /**
     * Obtiene todas las facturas PPD (Cuentas por Cobrar) con sus saldos y pagos calculados
     * @param {Object} [filtros={}] - Filtros opcionales { estadoPago, busqueda, fechaInicio, fechaFin }
     * @returns {Promise<Array<Object>>}
     */
    async obtenerCuentasPorCobrar(filtros = {}) {
        try {
            const facturas = await this.facturaRepository.getAllFacturas();

            // Filtrar facturas que sean de método de pago PPD
            let facturasPpd = facturas.filter(f => {
                const metodo = (f.metodoPago || '').toUpperCase();
                const esPpd = metodo === 'PPD' || f.formaPago === '99';
                const noCancelada = f.estatus !== 'cancelada';
                return esPpd && noCancelada;
            });

            // Para cada factura PPD, consultar sus complementos registrados para garantizar saldos 100% exactos
            const facturasEnriquecidas = await Promise.all(
                facturasPpd.map(async (fac) => {
                    const complementos = await this.repository.getComplementosByFacturaId(fac.id);
                    const complementosTimbrados = complementos.filter(c => c.estatus === 'timbrada');

                    const totalFactura = parseFloat(fac.totalFinal || fac.subtotal || 0);
                    const totalPagado = complementosTimbrados.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
                    const saldoInsoluto = Math.max(0, parseFloat((totalFactura - totalPagado).toFixed(2)));

                    let estadoPago = 'pendiente';
                    if (saldoInsoluto <= 0.01 && totalPagado > 0) {
                        estadoPago = 'pagada';
                    } else if (totalPagado > 0) {
                        estadoPago = 'parcial';
                    }

                    return {
                        ...fac,
                        saldoTotal: totalFactura,
                        totalPagado,
                        saldoInsoluto,
                        estadoPago,
                        numeroParcialidades: complementosTimbrados.length,
                        totalComplementos: complementos.length,
                        complementos
                    };
                })
            );

            // Aplicar filtros en memoria
            return facturasEnriquecidas.filter(fac => {
                if (filtros.estadoPago && filtros.estadoPago !== 'todas') {
                    if (fac.estadoPago !== filtros.estadoPago) return false;
                }

                if (filtros.busqueda) {
                    const q = filtros.busqueda.toLowerCase().trim();
                    const cliente = (fac.clienteRazonSocial || fac.clienteNombre || '').toLowerCase();
                    const rfc = (fac.clienteRFC || '').toLowerCase();
                    const folio = (fac.facturaNumero || '').toLowerCase();
                    const uuid = (fac.timbrado?.uuid || fac.uuid || '').toLowerCase();
                    if (!cliente.includes(q) && !rfc.includes(q) && !folio.includes(q) && !uuid.includes(q)) {
                        return false;
                    }
                }

                if (filtros.fechaInicio) {
                    const fechaFac = (fac.facturaFecha || fac.createdAt || '').substring(0, 10);
                    if (fechaFac < filtros.fechaInicio) return false;
                }

                if (filtros.fechaFin) {
                    const fechaFac = (fac.facturaFecha || fac.createdAt || '').substring(0, 10);
                    if (fechaFac > filtros.fechaFin) return false;
                }

                return true;
            });

        } catch (error) {
            console.error('❌ Error en obtenerCuentasPorCobrar:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial completo de parcialidades y estado actual de una factura
     * @param {string} facturaId
     * @returns {Promise<{factura: Object, complementos: Array<Object>, resumen: Object}>}
     */
    async obtenerHistorialFactura(facturaId) {
        try {
            if (!facturaId) throw new Error('Se requiere el ID de la factura');

            const factura = await this.facturaRepository.getFacturaById(facturaId, true);
            if (!factura) throw new Error('Factura no encontrada');

            const complementos = await this.repository.getComplementosByFacturaId(facturaId);
            const complementosTimbrados = complementos.filter(c => c.estatus === 'timbrada');

            const totalFactura = parseFloat(factura.totalFinal || factura.subtotal || 0);
            const totalPagado = complementosTimbrados.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
            const saldoInsoluto = Math.max(0, parseFloat((totalFactura - totalPagado).toFixed(2)));

            const siguienteParcialidad = complementosTimbrados.length + 1;

            let estadoPago = 'pendiente';
            if (saldoInsoluto <= 0.01 && totalPagado > 0) {
                estadoPago = 'pagada';
            } else if (totalPagado > 0) {
                estadoPago = 'parcial';
            }

            return {
                factura: {
                    ...factura,
                    saldoTotal: totalFactura,
                    totalPagado,
                    saldoInsoluto,
                    estadoPago,
                    numeroParcialidades: complementosTimbrados.length
                },
                complementos,
                resumen: {
                    totalFactura,
                    totalPagado,
                    saldoInsoluto,
                    estadoPago,
                    siguienteParcialidad,
                    puedeRecibirPagos: saldoInsoluto > 0.01 && factura.estatus !== 'cancelada'
                }
            };
        } catch (error) {
            console.error('❌ Error obteniendo historial de factura:', error);
            throw error;
        }
    }

    /**
     * Registra un nuevo Complemento de Pago (en borrador o timbrado)
     * @param {string} facturaId - ID de la factura original
     * @param {Object} paymentData - Datos del pago capturados en el formulario
     * @param {boolean} [autoTimbrar=true] - Si debe timbrarse inmediatamente con Facturama
     * @returns {Promise<{success: boolean, id: string, complemento: Object, message: string}>}
     */
    async registrarComplementoPago(facturaId, paymentData, autoTimbrar = true) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) throw new Error('Usuario no autenticado');

            const userName = this._getCurrentUserName();

            // 1. Obtener estado actual de la factura y validar
            const historial = await this.obtenerHistorialFactura(facturaId);
            const { factura, resumen } = historial;

            if (factura.estatus === 'cancelada') {
                throw new Error('No se pueden registrar pagos a una factura cancelada.');
            }

            if (!factura.timbrado?.uuid && autoTimbrar) {
                throw new Error('La factura original debe estar timbrada con UUID ante el SAT para emitir un complemento de pago.');
            }

            const montoPago = parseFloat(paymentData.monto);
            if (isNaN(montoPago) || montoPago <= 0) {
                throw new Error('El monto a pagar debe ser mayor a cero.');
            }

            if (montoPago > (resumen.saldoInsoluto + 0.01)) {
                throw new Error(`El monto ($${montoPago.toFixed(2)}) supera el saldo insoluto actual ($${resumen.saldoInsoluto.toFixed(2)}).`);
            }

            const siguienteFolio = await this.repository.getNextFolio();
            const parcialidad = resumen.siguienteParcialidad;
            const saldoAnterior = resumen.saldoInsoluto;
            const saldoInsoluto = Math.max(0, parseFloat((saldoAnterior - montoPago).toFixed(2)));

            // 2. Construir objeto base del complemento
            const complementoData = ComplementoPagoModel.create({
                facturaId: factura.id,
                facturaNumero: factura.facturaNumero || '',
                facturaUuid: factura.timbrado?.uuid || factura.uuid || '',
                facturaSerie: factura.serie || '',
                facturaFolio: factura.facturaNumero || '',
                facturaFecha: factura.facturaFecha || '',
                facturaTotal: resumen.totalFactura,

                clienteId: factura.clienteId,
                clienteNombre: factura.clienteNombre,
                clienteRazonSocial: factura.clienteRazonSocial || factura.clienteNombre,
                clienteRFC: factura.clienteRFC,
                clienteRegimen: factura.clienteRegimen || factura.clienteRegimenCodigo || '601',
                clienteRegimenCodigo: factura.clienteRegimenCodigo || '601',
                clienteCodigoPostal: factura.clienteCodigoPostal || '00000',
                clienteEmail: factura.clienteEmail || '',

                empresaNombre: factura.empresaNombre,
                empresaRFC: factura.empresaRFC,
                empresaCodigoPostal: factura.empresaCodigoPostal,
                empresaRegimen: factura.empresaRegimen,

                parcialidad,
                folio: String(siguienteFolio),
                serie: 'PAG',
                complementoNumero: `PAG-${factura.facturaNumero || ''}-P${parcialidad}`,

                fechaPago: paymentData.fechaPago || new Date().toISOString(),
                formaPago: paymentData.formaPago || '03',
                monto: montoPago,
                saldoAnterior,
                saldoInsoluto,
                numeroOperacion: paymentData.numeroOperacion || '',
                bancoOrdenante: paymentData.bancoOrdenante || '',
                cuentaOrdenante: paymentData.cuentaOrdenante || '',
                bancoBeneficiario: paymentData.bancoBeneficiario || '',
                cuentaBeneficiario: paymentData.cuentaBeneficiario || '',
                observaciones: paymentData.observaciones || '',

                estatus: autoTimbrar ? 'pendiente' : 'borrador'
            }, uid, userName);

            // 3. Validar esquema
            if (autoTimbrar) {
                const val = ComplementoPagoModel.validateForTimbrado(complementoData);
                if (!val.valid) {
                    throw new Error(val.errors[0] || 'Datos incompletos para timbrar complemento.');
                }
            }

            // 4. Guardar en Firestore
            const docId = await this.repository.createComplemento(complementoData);
            complementoData.id = docId;

            // 5. Si autoTimbrar es true, realizar timbrado con Facturama
            if (autoTimbrar) {
                return await this.timbrarComplemento(docId, complementoData);
            }

            return {
                success: true,
                id: docId,
                complemento: complementoData,
                message: 'Complemento de pago guardado como borrador.'
            };

        } catch (error) {
            console.error('❌ Error en registrarComplementoPago:', error);
            throw error;
        }
    }

    /**
     * Timbra un Complemento de Pago ante Facturama / SAT
     * @param {string} complementoId
     * @param {Object} [complementoData=null]
     * @returns {Promise<{success: boolean, id: string, uuid: string, complemento: Object, message: string}>}
     */
    async timbrarComplemento(complementoId, complementoData = null) {
        try {
            const comp = complementoData || await this.repository.getComplementoById(complementoId, true);
            if (!comp) throw new Error('Complemento no encontrado');

            if (comp.estatus === 'timbrada' && comp.uuid) {
                return {
                    success: true,
                    id: complementoId,
                    uuid: comp.uuid,
                    complemento: comp,
                    message: 'El complemento ya se encuentra timbrado.'
                };
            }

            const payload = this._buildFacturamaPayload(comp);
            console.log('📤 Enviando Complemento de Pago a Facturama:', JSON.stringify(payload, null, 2));

            const response = await fetch(TIMBRAR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                const errMsg = result.error || result.message || 'Error en timbrado con Facturama';
                throw new Error(errMsg);
            }

            // Actualizar documento del complemento en Firestore
            const updatedComplemento = ComplementoPagoModel.updateTimbrado(comp, result, this._getCurrentUserName());
            await this.repository.updateComplemento(complementoId, updatedComplemento);

            // Actualizar saldos en la factura original PPD
            await this._actualizarSaldosFacturaOriginal(comp.facturaId);

            return {
                success: true,
                id: complementoId,
                uuid: updatedComplemento.uuid,
                complemento: updatedComplemento,
                pdfUrl: updatedComplemento.pdfUrl,
                xmlUrl: updatedComplemento.xmlUrl,
                message: 'Complemento de Pago timbrado exitosamente ante el SAT.'
            };

        } catch (error) {
            console.error('❌ Error timbrando complemento:', error);
            // Marcar error si quedó pendiente
            if (complementoId) {
                await this.repository.updateComplemento(complementoId, {
                    estatus: 'borrador',
                    errorTimbrado: error.message || 'Fallo de timbrado'
                });
            }
            throw error;
        }
    }

    /**
     * Construye el payload conforme al estándar SAT CFDI 4.0 Complemento de Recepción de Pagos 2.0
     * @param {Object} comp - Datos del complemento
     * @returns {Object} Payload para Facturama
     */
    _buildFacturamaPayload(comp) {
        const monto = parseFloat(comp.monto) || 0;
        const saldoAnt = parseFloat(comp.saldoAnterior) || 0;
        const saldoIns = Math.max(0, parseFloat((saldoAnt - monto).toFixed(2)));

        // Base e IVA para desglose en REP 2.0
        const tasa = 0.16;
        const base = parseFloat((monto / (1 + tasa)).toFixed(2));
        const totalIva = parseFloat((monto - base).toFixed(2));

        // Formato de fecha ISO YYYY-MM-DDTHH:mm:ss
        let fechaPagoFormatted = comp.fechaPago || new Date().toISOString();
        if (fechaPagoFormatted.includes('.')) {
            fechaPagoFormatted = fechaPagoFormatted.split('.')[0];
        }

        let nombreReceptor = (comp.clienteRazonSocial || comp.clienteNombre || 'CLIENTE').toUpperCase().trim();
        nombreReceptor = nombreReceptor
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9\s]/g, '')
            .substring(0, 300);

        return {
            Receiver: {
                Rfc: comp.clienteRFC,
                Name: nombreReceptor,
                CfdiUse: 'CP01', // Obligatorio para Complemento de Pago
                FiscalRegime: comp.clienteRegimenCodigo || '601',
                TaxZipCode: comp.clienteCodigoPostal || '57200'
            },
            CfdiType: 'P',
            NameId: '1',
            ExpeditionPlace: comp.empresaCodigoPostal || '57200',
            Serie: comp.serie || 'PAG',
            Folio: comp.folio || '1',
            Exportation: '01',
            Complemento: {
                Payments: [
                    {
                        Date: fechaPagoFormatted,
                        PaymentForm: comp.formaPago || '03',
                        Currency: 'MXN',
                        Amount: monto.toFixed(2),
                        OperationNumber: comp.numeroOperacion || null,
                        RfcIssuerPayerAccount: comp.bancoOrdenante || null,
                        PayerAccount: comp.cuentaOrdenante || null,
                        RfcReceiverAccount: comp.bancoBeneficiario || null,
                        ReceiverAccount: comp.cuentaBeneficiario || null,
                        RelatedDocuments: [
                            {
                                Uuid: comp.facturaUuid,
                                PartialityNumber: parseInt(comp.parcialidad, 10) || 1,
                                Serie: comp.facturaSerie || null,
                                Folio: comp.facturaFolio || null,
                                Currency: comp.monedaFactura || 'MXN',
                                PreviousBalanceAmount: saldoAnt.toFixed(2),
                                AmountPaid: monto.toFixed(2),
                                ImpSaldoInsoluto: saldoIns.toFixed(2),
                                TaxObject: '02',
                                Taxes: [
                                    {
                                        Name: 'IVA',
                                        Rate: tasa.toFixed(2),
                                        Total: totalIva.toFixed(2),
                                        Base: base.toFixed(2),
                                        IsRetention: 'false',
                                        IsFederalTax: 'true'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };
    }

    /**
     * Recalcula y actualiza los saldos de la factura original en Firestore
     * @param {string} facturaId
     */
    async _actualizarSaldosFacturaOriginal(facturaId) {
        try {
            if (!facturaId) return;

            const factura = await this.facturaRepository.getFacturaById(facturaId, true);
            if (!factura) return;

            const complementos = await this.repository.getComplementosByFacturaId(facturaId);
            const timbrados = complementos.filter(c => c.estatus === 'timbrada');

            const totalFactura = parseFloat(factura.totalFinal || factura.subtotal || 0);
            const totalPagado = timbrados.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
            const saldoInsoluto = Math.max(0, parseFloat((totalFactura - totalPagado).toFixed(2)));

            let estadoPago = 'pendiente';
            if (saldoInsoluto <= 0.01 && totalPagado > 0) {
                estadoPago = 'pagada';
            } else if (totalPagado > 0) {
                estadoPago = 'parcial';
            }

            const complementosResumen = timbrados.map(c => ({
                id: c.id,
                uuid: c.uuid || '',
                folio: c.folio,
                serie: c.serie || 'PAG',
                parcialidad: c.parcialidad,
                monto: c.monto,
                fechaPago: c.fechaPago,
                formaPago: c.formaPago,
                saldoInsoluto: c.saldoInsoluto,
                pdfUrl: c.pdfUrl || '',
                xmlUrl: c.xmlUrl || ''
            }));

            await this.facturaRepository.updateFactura(facturaId, {
                totalPagado,
                saldoInsoluto,
                estadoPago,
                numeroParcialidades: timbrados.length,
                complementosPago: complementosResumen,
                updatedAt: new Date().toISOString()
            });

            console.log(`✅ Saldos de factura ${facturaId} actualizados: Pagado: $${totalPagado}, Saldo: $${saldoInsoluto}, Estado: ${estadoPago}`);
        } catch (error) {
            console.error('❌ Error actualizando saldos de factura original:', error);
        }
    }

    /**
     * Genera el PDF oficial del Complemento de Pago y lo abre en ventana
     */
    async abrirPDF(complementoId, options = {}) {
        const comp = await this.repository.getComplementoById(complementoId);
        if (!comp) throw new Error('Complemento no encontrado');
        return await abrirPDFComplementoPago(comp, options);
    }

    /**
     * Descarga el PDF del Complemento de Pago localmente
     */
    async descargarPDF(complementoId, options = {}) {
        const comp = await this.repository.getComplementoById(complementoId);
        if (!comp) throw new Error('Complemento no encontrado');
        return await descargarPDFComplementoPago(comp, options);
    }

    /**
     * Descarga el archivo XML timbrado
     */
    async descargarXML(complementoId) {
        const comp = await this.repository.getComplementoById(complementoId);
        if (!comp) throw new Error('Complemento no encontrado');
        if (!comp.xmlUrl) throw new Error('El complemento no cuenta con archivo XML registrado');

        const res = await fetch(comp.xmlUrl);
        const xmlText = await res.text();
        const blob = new Blob([xmlText], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ComplementoPago-${comp.serie || 'PAG'}-${comp.folio || '1'}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
}

export default ComplementoPagoService;
