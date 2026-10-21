/* =================================================================================
   PDF GENERATOR - COTIZACIONES Y FACTURAS (RSI ENTERPRISE)
   Diseño Unificado Basado en la Identidad Visual de Cotizaciones
   ================================================================================= */

import { dibujarQRVectorial, construirSatUrl, validarParametrosSatUrl } from './qrCode.js';
import { 
    REGIMENES_SAT, 
    USOS_CFDI, 
    METODOS_PAGO, 
    FORMAS_PAGO, 
    obtenerUsoCFDI, 
    obtenerFormaPago, 
    obtenerMetodoPago 
} from './regimenesSat.js';

const imageBase64Cache = {};
let jsPDFInstance = null;

/**
 * Carga la librería jsPDF y autotable de forma dinámica
 */
export async function loadJsPDF() {
    if (jsPDFInstance) return jsPDFInstance;
    
    try {
        if (window.jspdf && window.jspdf.jsPDF) {
            jsPDFInstance = window.jspdf.jsPDF;
            return jsPDFInstance;
        }
        
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        await new Promise(resolve => {
            const checkJsPDF = () => {
                if (window.jspdf && window.jspdf.jsPDF) {
                    jsPDFInstance = window.jspdf.jsPDF;
                    resolve();
                } else {
                    setTimeout(checkJsPDF, 100);
                }
            };
            checkJsPDF();
        });
        
        console.log('✅ jsPDF cargado correctamente');
        return jsPDFInstance;
    } catch (error) {
        console.error('❌ Error cargando jsPDF:', error);
        throw new Error('No se pudo cargar la librería jsPDF. Verifica tu conexión a internet.');
    }
}

/**
 * Convierte imagen desde URL a Base64 con almacenamiento en caché
 */
export async function getBase64ImageFromURL(url) {
    if (!url) return null;
    if (imageBase64Cache[url]) return imageBase64Cache[url];
    
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                imageBase64Cache[url] = dataURL;
                resolve(dataURL);
            } catch (err) {
                console.warn('⚠️ No se pudo procesar canvas de imagen:', err);
                resolve(null);
            }
        };
        img.onerror = () => {
            console.warn('⚠️ No se pudo cargar imagen desde URL:', url);
            resolve(null);
        };
        img.src = url;
    });
}

/**
 * Agrupa items por categoría para la estructura visual por secciones
 */
export function agruparItemsPorCategoria(items) {
    const grupos = {};
    (items || []).forEach(item => {
        const categoria = item.categoriaNombre || item.categoria || 'CONCEPTOS';
        if (!grupos[categoria]) grupos[categoria] = [];
        grupos[categoria].push(item);
    });
    return grupos;
}

/**
 * Formatea número a formato de moneda (es-MX)
 */
export function formatearNumero(num) {
    return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: 'MXN' 
    }).format(num || 0).replace('MX', '').trim();
}

/**
 * Formatea fecha en estándar es-MX (DD/MM/AAAA)
 */
export function formatearFecha(fecha) {
    if (!fecha) return 'N/E';
    try {
        const date = new Date(fecha);
        if (isNaN(date.getTime())) return fecha;
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return fecha;
    }
}

/**
 * Formatea fecha y hora en estándar es-MX
 */
export function formatearFechaHora(fecha) {
    if (!fecha) return 'N/E';
    try {
        const date = new Date(fecha);
        if (isNaN(date.getTime())) return fecha;
        return date.toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return fecha;
    }
}

/**
 * Convierte un número a importe con letra en pesos mexicanos
 */
export function numeroALetras(numero) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    
    function convertirGrupo(n) {
        let output = '';
        if (n === 100) return 'CIEN';
        
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;
        const dd = n % 100;
        
        if (c > 0) output += centenas[c] + ' ';
        
        if (dd >= 10 && dd < 20) {
            output += especiales[dd - 10];
        } else {
            if (d > 0) output += decenas[d];
            if (u > 0) output += (d > 0 ? ' Y ' : '') + unidades[u];
        }
        
        return output.trim();
    }
    
    const num = Math.abs(Number(numero) || 0);
    if (num === 0) return 'CERO PESOS 00/100 M.N.';
    
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    
    let resultado = '';
    
    if (entero >= 1000000) {
        const millones = Math.floor(entero / 1000000);
        resultado += (millones === 1 ? 'UN MILLON' : convertirGrupo(millones) + ' MILLONES') + ' ';
    }
    
    const miles = Math.floor((entero % 1000000) / 1000);
    if (miles > 0) {
        resultado += (miles === 1 ? 'UN MIL' : convertirGrupo(miles) + ' MIL') + ' ';
    }
    
    const resto = entero % 1000;
    if (resto > 0) {
        resultado += convertirGrupo(resto);
    }
    
    resultado = resultado.trim();
    if (!resultado) resultado = 'CERO';
    resultado += (entero === 1 ? ' PESO' : ' PESOS');
    resultado += ` ${centavos.toString().padStart(2, '0')}/100 M.N.`;
    
    return resultado;
}

/**
 * Extrae metadatos fiscales completos desde una cadena XML CFDI 4.0 auténtica.
 * Extrae datos del Emisor, Receptor, Comprobante y Timbre Fiscal Digital.
 * @param {string} xmlString - Cadena de texto del XML
 * @returns {Object|null}
 */
export function extraerDatosFiscalesDesdeXML(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return null;
    try {
        const getAttr = (tag, attr) => {
            const regex = new RegExp(`<[^>]*?(?:cfdi:|tfd:)?${tag}[^>]*?\\b${attr}=["']([^"']*)["']`, 'i');
            const match = xmlString.match(regex);
            return match ? match[1] : '';
        };

        // Timbre Fiscal Digital
        const uuid = getAttr('TimbreFiscalDigital', 'UUID');
        const fechaTimbrado = getAttr('TimbreFiscalDigital', 'FechaTimbrado');
        const rfcProvCertif = getAttr('TimbreFiscalDigital', 'RfcProvCertif');
        const selloCFD = getAttr('TimbreFiscalDigital', 'SelloCFD');
        const noCertificadoSAT = getAttr('TimbreFiscalDigital', 'NoCertificadoSAT');
        const selloSAT = getAttr('TimbreFiscalDigital', 'SelloSAT');

        // Comprobante
        const certNumber = getAttr('Comprobante', 'NoCertificado');
        const selloComprobante = getAttr('Comprobante', 'Sello');
        const total = getAttr('Comprobante', 'Total');
        const subtotal = getAttr('Comprobante', 'SubTotal');
        const metodoPago = getAttr('Comprobante', 'MetodoPago');
        const formaPago = getAttr('Comprobante', 'FormaPago');
        const lugarExpedicion = getAttr('Comprobante', 'LugarExpedicion');
        const moneda = getAttr('Comprobante', 'Moneda');
        const fecha = getAttr('Comprobante', 'Fecha');
        const folio = getAttr('Comprobante', 'Folio');
        const serie = getAttr('Comprobante', 'Serie');
        const tipoDeComprobante = getAttr('Comprobante', 'TipoDeComprobante');

        // Emisor
        const emisorRfc = getAttr('Emisor', 'Rfc');
        const emisorNombre = getAttr('Emisor', 'Nombre');
        const emisorRegimen = getAttr('Emisor', 'RegimenFiscal');

        // Receptor
        const receptorRfc = getAttr('Receptor', 'Rfc');
        const receptorNombre = getAttr('Receptor', 'Nombre');
        const receptorDomicilioFiscal = getAttr('Receptor', 'DomicilioFiscalReceptor');
        const receptorRegimen = getAttr('Receptor', 'RegimenFiscalReceptor');
        const usoCFDI = getAttr('Receptor', 'UsoCFDI');

        if (!uuid && !emisorRfc && !total) return null;

        const finalSello = selloCFD || selloComprobante;

        return {
            uuid,
            fechaTimbrado,
            rfcProveedor: rfcProvCertif,
            sello: finalSello,
            selloCFD: finalSello,
            selloSat: selloSAT,
            noCertificado: noCertificadoSAT,
            certNumber,
            // Emisor
            emisorRfc,
            emisorNombre,
            emisorRegimen,
            // Receptor
            receptorRfc,
            receptorNombre,
            receptorDomicilioFiscal,
            receptorRegimen,
            receptorRegimenFiscal: receptorRegimen,
            usoCFDI,
            receptorUsoCFDI: usoCFDI,
            // Comprobante
            total,
            totalExacto: total,
            subtotal,
            metodoPago,
            formaPago,
            lugarExpedicion,
            moneda,
            fecha,
            folio,
            serie,
            tipoDeComprobante,
            selloUltimos8: finalSello && finalSello.length >= 8 ? finalSello.slice(-8) : ''
        };
    } catch (e) {
        console.warn('⚠️ Error extrayendo datos fiscales de XML:', e);
        return null;
    }
}

// =================================================================================
// 1. GENERAR PDF COTIZACIÓN
// =================================================================================

/**
 * Genera el PDF de una cotización
 * @param {Object} data - Datos de la cotización
 * @param {string} logoUrl - URL del logo
 * @returns {Promise<Blob>} - Blob del PDF
 */
export async function generarPDFCotizacion(data, logoUrl) {
    try {
        const jsPDF = await loadJsPDF();
        if (!jsPDF) {
            throw new Error('No se pudo cargar la librería jsPDF');
        }
        
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        
        const headerHeight = 70;
        const footerHeight = 15;
        const contentStartY = headerHeight;
        const contentMaxY = pageHeight - footerHeight - 10;
        
        const textColor = '#000000';
        const gray = '#6b7280';
        const navy = '#0d2c54';
        const lightGray = '#f5f5f5';
        
        const colX = { 
            desc: margin, 
            unidad: margin + 90, 
            cant: margin + 110, 
            precio: margin + 130, 
            total: margin + 160 
        };
        
        let page = 1;
        let y = contentStartY;
        
        const dibujarEncabezado = async () => {
            try {
                if (logoUrl) {
                    const logoData = await getBase64ImageFromURL(logoUrl);
                    if (logoData) {
                        pdf.addImage(logoData, 'PNG', pageWidth - margin - 40, margin, 40, 40);
                    }
                }
            } catch (e) { 
                console.warn('No se pudo cargar el logo:', e); 
            }
            
            pdf.setFontSize(10).setTextColor(navy)
                .text(data.empresaNombre || "RSI ENTERPRISE", margin, margin + 5);
            pdf.setFontSize(8).setTextColor(gray)
                .text(data.empresaDireccion || "", margin, margin + 10)
                .text(`RFC: ${data.empresaRFC || ''} | Tel: ${data.empresaTelefono || ''}`, margin, margin + 15);
            
            pdf.setFontSize(14).setTextColor(navy)
                .text("COTIZACIÓN", pageWidth / 2, margin + 25, { align: 'center' });
            pdf.setFontSize(9).setTextColor(gray)
                .text(`No. ${data.cotizacionNumero} | Fecha: ${new Date(data.cotizacionFecha).toLocaleDateString('es-MX')}`, 
                      pageWidth / 2, margin + 32, { align: 'center' });
        };
        
        const dibujarPiePagina = () => {
            pdf.setFontSize(8)
                .setTextColor(gray)
                .text(`Cotización No. ${data.cotizacionNumero} | Página ${page}`, 
                      pageWidth / 2, pageHeight - footerHeight, { align: 'center' });
            pdf.setDrawColor(200, 200, 200)
                .line(margin, pageHeight - footerHeight - 3, pageWidth - margin, pageHeight - footerHeight - 3);
        };
        
        const nuevaPagina = async () => {
            pdf.addPage();
            page++;
            y = contentStartY;
            await dibujarEncabezado();
            dibujarPiePagina();
        };
        
        await dibujarEncabezado();
        dibujarPiePagina();
        
        // Descripción
        if (data.cotizacionDescripcion && data.cotizacionDescripcion.trim().length > 0) {
            if (y + 15 > contentMaxY) {
                await nuevaPagina();
            }
            
            pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
                .text("DESCRIPCIÓN:", margin, y); 
            y += 5;
            pdf.setFontSize(9).setTextColor(textColor).setFont('helvetica', 'normal');
            const descLines = pdf.splitTextToSize(data.cotizacionDescripcion.trim(), pageWidth - 2 * margin);
            descLines.forEach(line => { 
                if (y + 5 > contentMaxY) {
                    pdf.text(line.substring(0, 50) + "...", margin, y);
                    y += 5;
                } else {
                    pdf.text(line, margin, y); 
                    y += 5;
                }
            });
            y += 5;
        }
        
        // Información del cliente
        if (y + 30 > contentMaxY) {
            await nuevaPagina();
        }
        
        pdf.setFontSize(9).setTextColor(textColor)
            .text(`Cliente: ${data.clienteNombre}`, margin, y); 
        y += 5;
        pdf.text(`RFC: ${data.clienteRFC || 'N/E'}`, margin, y); 
        y += 5; 
        pdf.text(`Dirección: ${data.clienteDireccion || 'N/E'}`, margin, y); 
        y += 10;
        
        // Información de la cotización
        const tipoCotizacionMap = { 
            'implementacion': 'Implementación', 
            'proyecto': 'Proyecto', 
            'servicio': 'Servicio' 
        };
        let infoPago = `Pago: ${data.tipoCredito || 'N/E'}`;
        if (data.tipoCredito === 'credito' && data.diasCredito) {
            infoPago += ` (${data.diasCredito} días)`;
        }
        const info = [
            `Tipo: ${tipoCotizacionMap[data.tipoCotizacion] || 'N/E'}`,
            `Vigencia: ${data.cotizacionVigencia || '30'} días`,
            `Moneda: ${data.cotizacionMoneda || 'MXN'}`,
            infoPago
        ].join(" | ");
        pdf.text(info, margin, y); 
        y += 10;
        
        // Items agrupados por categoría
        const grupos = agruparItemsPorCategoria(data.items || []);
        
        for (const [categoria, items] of Object.entries(grupos)) {
            if (y + 25 > contentMaxY) {
                await nuevaPagina();
            }
            
            pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 12, 'F');
            pdf.setFontSize(12).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                .text(categoria || 'OTRO', pageWidth / 2, y + 6, { align: 'center' });
            y += 14;
            
            pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
            pdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
                .text("DESCRIPCIÓN", colX.desc, y + 3)
                .text("UNIDAD", colX.unidad, y + 3, { align: 'center' })
                .text("CANT.", colX.cant, y + 3, { align: 'right' })
                .text("P. UNIT.", colX.precio, y + 3, { align: 'right' })
                .text("TOTAL", colX.total, y + 3, { align: 'right' });
            y += 10;
            
            for (const item of items) {
                const descLines = pdf.splitTextToSize(item.descripcion || 'Sin descripción', colX.unidad - colX.desc - 5);
                const itemHeight = Math.max(descLines.length * 5, 10) + 4;
                
                if (y + itemHeight + 5 > contentMaxY) {
                    await nuevaPagina();
                    pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 12, 'F');
                    pdf.setFontSize(12).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                        .text(categoria || 'OTRO', pageWidth / 2, y + 6, { align: 'center' });
                    y += 14;
                    pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
                    pdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
                        .text("DESCRIPCIÓN", colX.desc, y + 3)
                        .text("UNIDAD", colX.unidad, y + 3, { align: 'center' })
                        .text("CANT.", colX.cant, y + 3, { align: 'right' })
                        .text("P. UNIT.", colX.precio, y + 3, { align: 'right' })
                        .text("TOTAL", colX.total, y + 3, { align: 'right' });
                    y += 10;
                }
                
                if (items.indexOf(item) % 2 === 0) {
                    pdf.setFillColor(lightGray).rect(margin, y - 2, pageWidth - 2 * margin, itemHeight, 'F');
                }
                
                pdf.setTextColor(textColor);
                descLines.forEach((line, i) => {
                    if (y + 3 + (i * 5) < contentMaxY) {
                        pdf.text(line, colX.desc, y + 3 + (i * 5));
                    }
                });
                
                pdf.text(item.tipoTecnologia || 'pza', colX.unidad, y + 3, { align: 'center' });
                pdf.text((item.cantidad || 0).toString(), colX.cant, y + 3, { align: 'right' });
                pdf.text(formatearNumero(item.precio || 0), colX.precio, y + 3, { align: 'right' });
                pdf.text(formatearNumero(item.total || 0), colX.total, y + 3, { align: 'right' });
                
                pdf.setDrawColor(200, 200, 200).line(margin, y + itemHeight - 2, pageWidth - margin, y + itemHeight - 2);
                y += itemHeight;
            }
            y += 4;
        }
        
        // Totales
        if (y + 40 > contentMaxY) {
            await nuevaPagina();
        }
        
        const tableStartX = colX.total - 82;
        const valueColX = tableStartX + 70;
        
        pdf.setFontSize(9).setTextColor(textColor)
            .text("Subtotal:", tableStartX, y, { align: 'left' })
            .text(formatearNumero(data.subtotal || 0), valueColX, y, { align: 'left' });
        y += 6;
        
        if (data.descuentoMonto > 0) { 
            pdf.text(`Descuento (${data.descuento || 0}%):`, tableStartX, y, { align: 'left' })
                .text(`-${formatearNumero(data.descuentoMonto || 0)}`, valueColX, y, { align: 'left' });
            y += 6; 
        }
        
        pdf.text(`IVA (${data.impuesto || 16}%):`, tableStartX, y, { align: 'left' })
            .text(formatearNumero(data.impuestoMonto || 0), valueColX, y, { align: 'left' });
        y += 8;
        
        pdf.setFont('helvetica', 'bold').setTextColor(navy)
            .text("TOTAL:", tableStartX, y, { align: 'left' })
            .text(`${formatearNumero(data.totalFinal || 0)} ${data.cotizacionMoneda || 'MXN'}`, valueColX, y, { align: 'left' });
        y += 15;
        
        // Términos y condiciones
        if (data.terminos) {
            if (y + 15 > contentMaxY) {
                await nuevaPagina();
            }
            
            pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
                .text("TÉRMINOS Y CONDICIONES", margin, y); 
            y += 5;
            pdf.setTextColor(textColor);
            
            const terminosLines = data.terminos.split('\n');
            for (const term of terminosLines) {
                if (term.trim()) {
                    const lines = pdf.splitTextToSize(term, pageWidth - 2 * margin);
                    for (const line of lines) {
                        if (y + 5 > contentMaxY) {
                            await nuevaPagina();
                        }
                        pdf.text(line, margin, y); 
                        y += 5;
                    }
                }
            }
        }
        
        dibujarPiePagina();
        
        return pdf.output('blob');
        
    } catch (error) {
        console.error('❌ Error generando PDF de cotización:', error);
        throw error;
    }
}

// =================================================================================
// 2. GENERAR PDF FACTURA (Borrador, Timbrada y Cancelada)
// =================================================================================

/**
 * Genera el PDF de una factura basándose exactamente en el diseño de las cotizaciones
 * @param {Object} factura - Datos de la factura
 * @param {Object|string} options - Opciones de configuración o URL del logo (retrocompatibilidad)
 * @param {Object} [legacyTimbrado] - Objeto de timbrado si se usa firma heredada
 * @returns {Promise<Blob>} - Blob del PDF
 */
export async function generarPDFFactura(factura, options = {}, legacyTimbrado = null) {
    try {
        const jsPDF = await loadJsPDF();
        if (!jsPDF) {
            throw new Error('No se pudo cargar la librería jsPDF');
        }

        // Manejo flexible de parámetros (objeto de opciones o firma posicional previa)
        const opts = (typeof options === 'string' || options === null)
            ? { logoUrl: options, timbrado: legacyTimbrado }
            : { ...options };

        const logoUrl = opts.logoUrl || '/assets/icons/logo.png';
        let timbradoData = { ...(opts.timbrado || factura.timbrado || {}) };
        let fiscalXml = null;

        // Si se provee XML (como string o URL), enriquecer con datos auténticos del comprobante fiscal
        let xmlParaExtraer = opts.xmlContent || factura.xmlContent || factura.xmlString || null;
        if (!xmlParaExtraer && (opts.xmlUrl || factura.xmlUrl) && typeof fetch !== 'undefined') {
            try {
                const xmlRes = await fetch(opts.xmlUrl || factura.xmlUrl);
                if (xmlRes.ok) {
                    xmlParaExtraer = await xmlRes.text();
                }
            } catch (e) {
                console.warn('⚠️ No se pudo obtener el XML desde la URL para enriquecer el PDF:', e);
            }
        }

        if (xmlParaExtraer) {
            fiscalXml = extraerDatosFiscalesDesdeXML(xmlParaExtraer);
            if (fiscalXml) {
                timbradoData = {
                    ...fiscalXml,
                    ...timbradoData,
                    sello: timbradoData.sello || fiscalXml.sello,
                    selloSat: timbradoData.selloSat || fiscalXml.selloSat,
                    noCertificado: timbradoData.noCertificado || fiscalXml.noCertificado,
                    certNumber: timbradoData.certNumber || fiscalXml.certNumber,
                    rfcProveedor: timbradoData.rfcProveedor || fiscalXml.rfcProveedor,
                    uuid: timbradoData.uuid || fiscalXml.uuid,
                    fechaTimbrado: timbradoData.fechaTimbrado || fiscalXml.fechaTimbrado
                };
            }
        }

        // Si existe UUID pero falta la Cadena Original, construir la oficial del SAT
        if (!timbradoData.cadenaOriginal && (timbradoData.uuid || factura.uuid)) {
            const uuidVal = timbradoData.uuid || factura.uuid || '';
            const fechaVal = timbradoData.fechaTimbrado || factura.facturaFecha || '';
            const rfcProvVal = timbradoData.rfcProveedor || 'FLI080612495';
            const selloCfdVal = timbradoData.sello || '';
            const noCertSatVal = timbradoData.noCertificado || '';
            if (uuidVal && selloCfdVal) {
                timbradoData.cadenaOriginal = `||1.1|${uuidVal}|${fechaVal}|${rfcProvVal}|${selloCfdVal}|${noCertSatVal}||`;
            }
        }

        const esCancelada = factura.estatus === 'cancelada';
        const tieneTimbrado = Boolean((timbradoData.uuid || factura.uuid) && !esCancelada);
        const esBorrador = opts.esBorrador !== undefined 
            ? Boolean(opts.esBorrador) 
            : (!tieneTimbrado && !esCancelada);

        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;

        const headerHeight = 70;
        const footerHeight = 15;
        const contentStartY = headerHeight;
        const contentMaxY = pageHeight - footerHeight - 10;

        const textColor = '#000000';
        const gray = '#6b7280';
        const navy = '#0d2c54';
        const lightGray = '#f5f5f5';
        const danger = '#dc3545';

        // Columnas idénticas al diseño de cotizaciones
        const colX = {
            desc: margin,
            unidad: margin + 90,
            cant: margin + 110,
            precio: margin + 130,
            total: margin + 160
        };

        let page = 1;
        let y = contentStartY;

        /**
         * Dibuja marca de agua diagonal para borradores o facturas canceladas
         */
        const dibujarMarcaAgua = () => {
            if (!esBorrador && !esCancelada) return;

            pdf.saveGraphicsState();
            if (pdf.GState) {
                pdf.setGState(new pdf.GState({ opacity: esBorrador ? 0.08 : 0.09 }));
            }

            pdf.setFontSize(esCancelada ? 65 : 70);
            pdf.setTextColor(danger);
            pdf.setFont('helvetica', 'bold');

            const centerX = pageWidth / 2;
            const centerY = pageHeight / 2;

            pdf.text(esCancelada ? 'CANCELADA' : 'BORRADOR', centerX, centerY - 10, {
                align: 'center',
                angle: 45
            });

            pdf.setFontSize(esCancelada ? 14 : 15);
            pdf.text(esCancelada ? 'CANCELADA ANTE EL SAT' : 'DOCUMENTO SIN VALIDEZ FISCAL', centerX, centerY + 30, {
                align: 'center',
                angle: 45
            });

            pdf.restoreGraphicsState();
        };

        /**
         * Encabezado institucional coherente con cotizaciones
         */
        const dibujarEncabezado = async () => {
            try {
                if (logoUrl) {
                    const logoData = await getBase64ImageFromURL(logoUrl);
                    if (logoData) {
                        pdf.addImage(logoData, 'PNG', pageWidth - margin - 40, margin, 40, 40);
                    }
                }
            } catch (e) {
                console.warn('⚠️ No se pudo cargar el logo de la factura:', e);
            }

            // Datos fiscales del emisor (esquina superior izquierda)
            const emisorNombre = fiscalXml?.emisorNombre || factura.empresaNombre || "RSI ENTERPRISE NEZAHUALCÓYOTL";
            const emisorRFC = fiscalXml?.emisorRfc || factura.empresaRFC || "RSI1810319G0";
            const emisorRegimen = fiscalXml?.emisorRegimen || factura.empresaRegimen || "601";
            const emisorRegimenObj = REGIMENES_SAT[emisorRegimen];
            const emisorRegimenDesc = emisorRegimenObj ? `${emisorRegimen} — ${emisorRegimenObj.nombre}` : emisorRegimen;
            const emisorCP = factura.empresaCodigoPostal || "57200";
            const emisorDireccion = factura.empresaDireccion || "";
            const emisorTelefono = factura.empresaTelefono || "";

            pdf.setFontSize(9.5).setTextColor(navy).setFont('helvetica', 'bold')
                .text(emisorNombre, margin, margin + 4);
            pdf.setFontSize(7.5).setTextColor(textColor).setFont('helvetica', 'bold')
                .text("RFC: ", margin, margin + 8);
            pdf.setFont('helvetica', 'normal').setTextColor(gray)
                .text(emisorRFC, margin + 7.5, margin + 8);

            pdf.setFont('helvetica', 'bold').setTextColor(textColor)
                .text("Régimen Fiscal: ", margin, margin + 11.8);
            pdf.setFont('helvetica', 'normal').setTextColor(gray);
            const regLines = pdf.splitTextToSize(emisorRegimenDesc, pageWidth - margin - 60);
            pdf.text(regLines[0], margin + 21, margin + 11.8);

            let emisorNextY = margin + 15.6;
            if (emisorDireccion) {
                pdf.setFont('helvetica', 'normal').setTextColor(gray).text(emisorDireccion, margin, emisorNextY);
                emisorNextY += 3.8;
            }

            const domParts = [];
            if (emisorCP) domParts.push(`C.P. Domicilio Fiscal: ${emisorCP}`);
            if (emisorTelefono) domParts.push(`Tel: ${emisorTelefono}`);
            if (domParts.length > 0) {
                pdf.setFont('helvetica', 'normal').setTextColor(gray).text(domParts.join(" | "), margin, emisorNextY);
            }

            // Título central
            pdf.setFontSize(14).setTextColor(navy).setFont('helvetica', 'bold')
                .text("FACTURA", pageWidth / 2, margin + 23, { align: 'center' });

            if (esBorrador) {
                // Etiqueta distintiva de borrador
                pdf.setFillColor(220, 53, 69);
                pdf.roundedRect(pageWidth / 2 - 20, margin + 25.5, 40, 5, 1, 1, 'F');
                pdf.setFontSize(7.5).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                    .text("BORRADOR", pageWidth / 2, margin + 29.2, { align: 'center' });

                pdf.setFontSize(8.5).setTextColor(gray).setFont('helvetica', 'normal')
                    .text(`No. ${factura.facturaNumero || 'N/E'} | Fecha: ${formatearFecha(factura.facturaFecha)}`, pageWidth / 2, margin + 35.5, { align: 'center' });
                pdf.setFontSize(7).setTextColor(danger).setFont('helvetica', 'italic')
                    .text("(Documento preliminar - Sin validez fiscal)", pageWidth / 2, margin + 39.5, { align: 'center' });
            } else if (esCancelada) {
                // Etiqueta distintiva de cancelación
                pdf.setFillColor(220, 53, 69);
                pdf.roundedRect(pageWidth / 2 - 22, margin + 25.5, 44, 5, 1, 1, 'F');
                pdf.setFontSize(7.5).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                    .text("CANCELADA", pageWidth / 2, margin + 29.2, { align: 'center' });

                pdf.setFontSize(8.5).setTextColor(gray).setFont('helvetica', 'normal')
                    .text(`No. ${factura.facturaNumero || 'N/E'} | Fecha: ${formatearFecha(factura.facturaFecha)}`, pageWidth / 2, margin + 35.5, { align: 'center' });
                pdf.setFontSize(7).setTextColor(danger).setFont('helvetica', 'italic')
                    .text("(Comprobante fiscal cancelado ante el SAT)", pageWidth / 2, margin + 39.5, { align: 'center' });
            } else {
                // Factura Timbrada con UUID oficial
                pdf.setFontSize(8.5).setTextColor(gray).setFont('helvetica', 'normal')
                    .text(`No. ${factura.facturaNumero || 'N/E'} | Fecha: ${formatearFecha(factura.facturaFecha)}`, pageWidth / 2, margin + 30, { align: 'center' });
                pdf.setFontSize(7.5).setTextColor(navy).setFont('helvetica', 'bold')
                    .text(`Folio Fiscal (UUID): ${timbradoData.uuid || factura.uuid || 'N/E'}`, pageWidth / 2, margin + 35, { align: 'center' });
            }
        };

        /**
         * Pie de página idéntico al de cotizaciones
         */
        const dibujarPiePagina = () => {
            pdf.setFontSize(8).setTextColor(gray).setFont('helvetica', 'normal');
            if (esBorrador) {
                pdf.text(`Factura No. ${factura.facturaNumero || 'N/E'} (BORRADOR - SIN VALIDEZ FISCAL) | Página ${page}`, 
                         pageWidth / 2, pageHeight - footerHeight, { align: 'center' });
            } else if (esCancelada) {
                pdf.text(`Factura No. ${factura.facturaNumero || 'N/E'} (CANCELADA ANTE EL SAT) | Página ${page}`, 
                         pageWidth / 2, pageHeight - footerHeight, { align: 'center' });
            } else {
                pdf.text(`Factura No. ${factura.facturaNumero || 'N/E'} | UUID: ${timbradoData.uuid || factura.uuid || 'N/E'} | Página ${page}`, 
                         pageWidth / 2, pageHeight - footerHeight, { align: 'center' });
            }
            pdf.setDrawColor(200, 200, 200)
                .line(margin, pageHeight - footerHeight - 3, pageWidth - margin, pageHeight - footerHeight - 3);
        };

        const nuevaPagina = async () => {
            pdf.addPage();
            page++;
            y = contentStartY;
            dibujarMarcaAgua();
            await dibujarEncabezado();
            dibujarPiePagina();
        };

        dibujarMarcaAgua();
        await dibujarEncabezado();
        dibujarPiePagina();

        // Descripción de factura
        if (factura.facturaDescripcion && factura.facturaDescripcion.trim().length > 0) {
            if (y + 15 > contentMaxY) {
                await nuevaPagina();
            }
            
            pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
                .text("DESCRIPCIÓN:", margin, y); 
            y += 5;
            pdf.setFontSize(9).setTextColor(textColor).setFont('helvetica', 'normal');
            const descLines = pdf.splitTextToSize(factura.facturaDescripcion.trim(), pageWidth - 2 * margin);
            descLines.forEach(line => { 
                if (y + 5 > contentMaxY) {
                    pdf.text(line.substring(0, 50) + "...", margin, y);
                    y += 5;
                } else {
                    pdf.text(line, margin, y); 
                    y += 5;
                }
            });
            y += 5;
        }

        // Datos del receptor (cliente)
        if (y + 35 > contentMaxY) {
            await nuevaPagina();
        }

        const razonSocial = fiscalXml?.receptorNombre || factura.clienteRazonSocial || factura.clienteNombre || 'PÚBLICO EN GENERAL';
        const rfcReceptor = fiscalXml?.receptorRfc || factura.clienteRFC || 'XAXX010101000';
        const regimenFiscalCodigo = fiscalXml?.receptorRegimen || factura.clienteRegimenFiscal || factura.clienteRegimenCodigo || factura.clienteRegimen || 'N/E';
        const regimenFiscalObj = REGIMENES_SAT[regimenFiscalCodigo];
        const regimenFiscalDesc = regimenFiscalObj 
            ? `${regimenFiscalCodigo} — ${regimenFiscalObj.nombre}`
            : regimenFiscalCodigo;
        const cpFiscal = fiscalXml?.receptorDomicilioFiscal || factura.clienteCodigoPostal || 'N/E';

        pdf.setFontSize(8.5).setTextColor(textColor).setFont('helvetica', 'normal')
            .text(`Cliente / Razón Social: ${razonSocial}`, margin, y);
        y += 4.5;
        pdf.text(`RFC: ${rfcReceptor} | Régimen Fiscal: ${regimenFiscalDesc} | C.P. Fiscal: ${cpFiscal}`, margin, y);
        y += 4.5;
        pdf.text(`Dirección: ${factura.clienteDireccion || 'N/E'}`, margin, y);
        y += 6;

        // Metadatos de Factura CFDI 4.0
        // Clave y descripción de Uso CFDI, Método de Pago, Forma de Pago
        const usoClave = fiscalXml?.usoCFDI || factura.usoCFDI || 'G03';
        const usoObj = obtenerUsoCFDI(usoClave);
        const usoTexto = usoObj ? usoObj.label : `Uso de CFDI: ${usoClave}`;

        const metodoClave = fiscalXml?.metodoPago || factura.metodoPago || 'PUE';
        const metodoObj = obtenerMetodoPago(metodoClave);
        const metodoTexto = metodoObj ? metodoObj.label : `Método de Pago: ${metodoClave}`;

        const formaClave = fiscalXml?.formaPago || factura.formaPago || (metodoClave === 'PPD' ? '99' : '01');
        const formaObj = obtenerFormaPago(formaClave);
        const formaTexto = formaObj ? formaObj.label : `Forma de Pago: ${formaClave}`;

        const lugarExpedicion = fiscalXml?.lugarExpedicion || factura.cfdiData?.ExpeditionPlace || factura.empresaCodigoPostal || '57200';
        const moneda = fiscalXml?.moneda || factura.facturaMoneda || 'MXN';

        pdf.setFontSize(8).setTextColor(textColor).setFont('helvetica', 'normal')
            .text(`Uso de CFDI: ${usoTexto} | Tipo Comprobante: Ingreso (I) | Moneda: ${moneda}`, margin, y);
        y += 4.5;
        pdf.text(`Método de Pago: ${metodoTexto}`, margin, y);
        y += 4.5;
        pdf.text(`Forma de Pago: ${formaTexto} | Lugar de Expedición (C.P.): ${lugarExpedicion}`, margin, y);
        y += 7;

        // Conceptos agrupados por categoría (mismo patrón visual que cotizaciones)
        const grupos = agruparItemsPorCategoria(factura.items || []);
        const hayGrupos = Object.keys(grupos).length > 0;
        const gruposFinales = hayGrupos ? grupos : { 'CONCEPTOS': [] };

        for (const [categoria, items] of Object.entries(gruposFinales)) {
            if (y + 25 > contentMaxY) {
                await nuevaPagina();
            }

            pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 12, 'F');
            pdf.setFontSize(12).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                .text(categoria || 'CONCEPTOS', pageWidth / 2, y + 6, { align: 'center' });
            y += 14;

            pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
            pdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
                .text("DESCRIPCIÓN", colX.desc, y + 3)
                .text("UNIDAD", colX.unidad, y + 3, { align: 'center' })
                .text("CANT.", colX.cant, y + 3, { align: 'right' })
                .text("P. UNIT.", colX.precio, y + 3, { align: 'right' })
                .text("TOTAL", colX.total, y + 3, { align: 'right' });
            y += 10;

            if (items.length === 0) {
                pdf.setFontSize(8).setTextColor(gray).setFont('helvetica', 'italic')
                    .text("Sin conceptos registrados", pageWidth / 2, y + 4, { align: 'center' });
                y += 10;
            }

            for (const item of items) {
                const descText = item.descripcion || 'Sin descripción';
                const descLines = pdf.splitTextToSize(descText, colX.unidad - colX.desc - 5);
                const claveSat = item.claveSat || item.productCode || '';
                const unitSat = item.unitCode || item.claveUnidad || '';
                const hasSatSubtext = Boolean(claveSat || unitSat);

                const itemHeight = Math.max(descLines.length * 5 + (hasSatSubtext ? 4 : 0), 10) + 4;

                if (y + itemHeight + 5 > contentMaxY) {
                    await nuevaPagina();
                    pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 12, 'F');
                    pdf.setFontSize(12).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                        .text(categoria || 'CONCEPTOS', pageWidth / 2, y + 6, { align: 'center' });
                    y += 14;
                    pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
                    pdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
                        .text("DESCRIPCIÓN", colX.desc, y + 3)
                        .text("UNIDAD", colX.unidad, y + 3, { align: 'center' })
                        .text("CANT.", colX.cant, y + 3, { align: 'right' })
                        .text("P. UNIT.", colX.precio, y + 3, { align: 'right' })
                        .text("TOTAL", colX.total, y + 3, { align: 'right' });
                    y += 10;
                }

                if (items.indexOf(item) % 2 === 0) {
                    pdf.setFillColor(lightGray).rect(margin, y - 2, pageWidth - 2 * margin, itemHeight, 'F');
                }

                pdf.setTextColor(textColor).setFontSize(8).setFont('helvetica', 'normal');
                descLines.forEach((line, i) => {
                    if (y + 3 + (i * 5) < contentMaxY) {
                        pdf.text(line, colX.desc, y + 3 + (i * 5));
                    }
                });

                if (hasSatSubtext) {
                    const satY = y + 3 + (descLines.length * 5);
                    if (satY < contentMaxY) {
                        pdf.setFontSize(6.5).setTextColor(gray);
                        pdf.text(`Clave SAT: ${claveSat || '01010101'} | Unidad: ${unitSat || 'H87'}`, colX.desc, satY);
                        pdf.setFontSize(8).setTextColor(textColor);
                    }
                }

                const unidadText = item.unit || item.tipoTecnologia || 'pza';
                const precioUnit = item.precioUnitario !== undefined ? item.precioUnitario : (item.precio || 0);

                pdf.text(unidadText, colX.unidad, y + 3, { align: 'center' });
                pdf.text((item.cantidad || 0).toString(), colX.cant, y + 3, { align: 'right' });
                pdf.text(formatearNumero(precioUnit), colX.precio, y + 3, { align: 'right' });
                pdf.text(formatearNumero(item.total || 0), colX.total, y + 3, { align: 'right' });

                pdf.setDrawColor(200, 200, 200).line(margin, y + itemHeight - 2, pageWidth - margin, y + itemHeight - 2);
                y += itemHeight;
            }
            y += 4;
        }

        // Totales de la factura
        if (y + 40 > contentMaxY) {
            await nuevaPagina();
        }

        const tableStartX = colX.total - 82;
        const valueColX = tableStartX + 70;

        pdf.setFontSize(9).setTextColor(textColor).setFont('helvetica', 'normal')
            .text("Subtotal:", tableStartX, y, { align: 'left' })
            .text(formatearNumero(factura.subtotal || 0), valueColX, y, { align: 'left' });
        y += 6;

        if (factura.descuentoMonto > 0) {
            pdf.text(`Descuento (${factura.descuento || 0}%):`, tableStartX, y, { align: 'left' })
                .text(`-${formatearNumero(factura.descuentoMonto || 0)}`, valueColX, y, { align: 'left' });
            y += 6;
        }

        pdf.text(`IVA (${factura.impuesto || 16}%):`, tableStartX, y, { align: 'left' })
            .text(formatearNumero(factura.impuestoMonto || 0), valueColX, y, { align: 'left' });
        y += 8;

        pdf.setFont('helvetica', 'bold').setTextColor(navy)
            .text("TOTAL:", tableStartX, y, { align: 'left' })
            .text(`${formatearNumero(factura.totalFinal || 0)} ${factura.facturaMoneda || 'MXN'}`, valueColX, y, { align: 'left' });
        y += 6;

        // Importe con letra
        pdf.setFontSize(7.5).setTextColor(gray).setFont('helvetica', 'italic');
        const importeLetra = `Importe con letra: ${numeroALetras(factura.totalFinal || 0)}`;
        const letraLines = pdf.splitTextToSize(importeLetra, pageWidth - 2 * margin);
        letraLines.forEach(l => {
            pdf.text(l, margin, y);
            y += 4;
        });
        y += 6;

        // Términos y condiciones
        if (factura.terminos) {
            if (y + 15 > contentMaxY) {
                await nuevaPagina();
            }

            pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
                .text("TÉRMINOS Y CONDICIONES", margin, y);
            y += 5;
            pdf.setTextColor(textColor).setFont('helvetica', 'normal');

            const terminosLines = factura.terminos.split('\n');
            for (const term of terminosLines) {
                if (term.trim()) {
                    const lines = pdf.splitTextToSize(term, pageWidth - 2 * margin);
                    for (const line of lines) {
                        if (y + 5 > contentMaxY) {
                            await nuevaPagina();
                        }
                        pdf.text(line, margin, y);
                        y += 5;
                    }
                }
            }
            y += 5;
        }

        // =======================================================
        // SECCIÓN: TIMBRADO FISCAL CFDI 4.0 (Sólo factura timbrada)
        // =======================================================
        if (tieneTimbrado) {
            if (y + 55 > contentMaxY) {
                await nuevaPagina();
            }

            pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 6, 'F');
            pdf.setFontSize(8).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                .text("INFORMACIÓN DEL TIMBRADO FISCAL DIGITAL (CFDI 4.0)", margin + 3, y + 2.5);
            y += 8;

            const qrSize = 28;
            const qrX = margin;
            const qrY = y;
            const textStartX = margin + qrSize + 4;

            // Renderizado del código QR oficial SAT CFDI 4.0
            try {
                const satUuid = fiscalXml?.uuid || timbradoData.uuid || timbradoData.Uuid || timbradoData.UUID || factura.uuid || factura.Uuid || '';
                const satRe = fiscalXml?.emisorRfc || timbradoData.emisorRfc || factura.empresaRFC || factura.empresaRfc || factura.cfdiData?.Issuer?.Rfc || 'RSI1810319G0';
                const satRr = fiscalXml?.receptorRfc || timbradoData.receptorRfc || factura.clienteRFC || factura.cliente?.rfc || factura.clienteRfc || factura.cfdiData?.Receiver?.Rfc || 'XAXX010101000';
                const satTt = fiscalXml?.total !== undefined && fiscalXml?.total !== null && String(fiscalXml?.total).trim() !== ''
                    ? fiscalXml.total
                    : (factura.totalFinal !== undefined && factura.totalFinal !== null ? Number(factura.totalFinal).toFixed(2) : (factura.total !== undefined ? Number(factura.total).toFixed(2) : ''));
                
                // Extracción exhaustiva del Sello Digital CFD (Emisor)
                let satSello = fiscalXml?.sello || fiscalXml?.selloCFD || timbradoData.sello || timbradoData.selloCFD || timbradoData.cfdiSign || timbradoData.CfdiSign || factura.timbrado?.sello || factura.timbrado?.cfdiSign || factura.timbrado?.selloCFD || factura.cfdiSign || factura.sello || '';
                if (!satSello && timbradoData.cadenaOriginal) {
                    const coParts = timbradoData.cadenaOriginal.split('|');
                    if (coParts.length >= 6 && coParts[4]) {
                        satSello = coParts[4];
                    }
                }

                const satUrl = construirSatUrl({
                    uuid: satUuid,
                    re: satRe,
                    rr: satRr,
                    tt: satTt,
                    fe: satSello
                });

                const qrOk = dibujarQRVectorial(pdf, satUrl, qrX, qrY, qrSize);
                if (qrOk) {
                    // Texto interactivo complementario debajo del QR con enlace directo al portal SAT
                    pdf.setFontSize(5.5).setTextColor(navy).setFont('helvetica', 'normal');
                    pdf.text("Verificar en portal del SAT", qrX, qrY + qrSize + 2.5);
                    if (typeof pdf.link === 'function') {
                        pdf.link(qrX, qrY + qrSize + 0.5, qrSize, 3, { url: satUrl });
                    }
                } else {
                    console.error('❌ Error renderizando la matriz vectorial del código QR SAT en el PDF');
                }
            } catch (qrErr) {
                console.error('❌ Error generando el código QR del SAT para el comprobante:', qrErr.message || qrErr);
                // Si el XML o comprobante no contiene los datos fiscales necesarios, se informa el error
                // y se evita generar silenciosamente un QR o recuadro decorativo con información incorrecta.
            }

            // Metadatos de certificación
            const lugarExpCert = fiscalXml?.lugarExpedicion || factura.cfdiData?.ExpeditionPlace || factura.empresaCodigoPostal || '57200';
            const emisorRegCert = fiscalXml?.emisorRegimen || factura.empresaRegimen || '601';
            const emisorRegCertObj = REGIMENES_SAT[emisorRegCert];
            const emisorRegCertDesc = emisorRegCertObj ? `${emisorRegCert} — ${emisorRegCertObj.nombre}` : emisorRegCert;

            pdf.setFontSize(7).setTextColor(navy).setFont('helvetica', 'bold')
                .text(`Folio Fiscal (UUID): ${timbradoData.uuid || factura.uuid || 'N/E'}`, textStartX, y + 3);
            pdf.setFontSize(7).setTextColor(gray).setFont('helvetica', 'normal')
                .text(`No. Certificado SAT: ${timbradoData.noCertificado || 'N/E'}`, textStartX, y + 8)
                .text(`No. Certificado Emisor: ${timbradoData.certNumber || factura.empresaCertificado || 'N/E'}`, textStartX, y + 13)
                .text(`Fecha Timbrado: ${formatearFechaHora(timbradoData.fechaTimbrado)}`, textStartX, y + 18)
                .text(`RFC PAC: ${timbradoData.rfcProveedor || 'N/E'}`, textStartX, y + 23)
                .text(`Lugar de Expedición (C.P.): ${lugarExpCert} | Régimen Emisor: ${emisorRegCertDesc}`, textStartX, y + 28);

            y += Math.max(qrSize + 5, 33);

            // Cadena original
            if (timbradoData.cadenaOriginal) {
                if (y + 10 > contentMaxY) await nuevaPagina();
                pdf.setFontSize(6).setTextColor(navy).setFont('helvetica', 'bold')
                    .text("Cadena Original del Timbre Fiscal Digital del SAT:", margin, y);
                y += 3;
                pdf.setFontSize(5).setTextColor(textColor).setFont('helvetica', 'normal');
                const coLines = pdf.splitTextToSize(timbradoData.cadenaOriginal, pageWidth - 2 * margin);
                for (const line of coLines) {
                    if (y + 3 > contentMaxY) await nuevaPagina();
                    pdf.text(line, margin, y);
                    y += 2.4;
                }
                y += 1;
            }

            // Sello digital emisor
            if (timbradoData.sello) {
                if (y + 10 > contentMaxY) await nuevaPagina();
                pdf.setFontSize(6).setTextColor(navy).setFont('helvetica', 'bold')
                    .text("Sello Digital del Emisor (CFD):", margin, y);
                y += 3;
                pdf.setFontSize(5).setTextColor(textColor).setFont('helvetica', 'normal');
                const seLines = pdf.splitTextToSize(timbradoData.sello, pageWidth - 2 * margin);
                for (const line of seLines) {
                    if (y + 3 > contentMaxY) await nuevaPagina();
                    pdf.text(line, margin, y);
                    y += 2.4;
                }
                y += 1;
            }

            // Sello digital SAT
            if (timbradoData.selloSat) {
                if (y + 10 > contentMaxY) await nuevaPagina();
                pdf.setFontSize(6).setTextColor(navy).setFont('helvetica', 'bold')
                    .text("Sello Digital del SAT:", margin, y);
                y += 3;
                pdf.setFontSize(5).setTextColor(textColor).setFont('helvetica', 'normal');
                const ssLines = pdf.splitTextToSize(timbradoData.selloSat, pageWidth - 2 * margin);
                for (const line of ssLines) {
                    if (y + 3 > contentMaxY) await nuevaPagina();
                    pdf.text(line, margin, y);
                    y += 2.4;
                }
                y += 1;
            }

            pdf.setFontSize(6.5).setTextColor(gray).setFont('helvetica', 'italic')
                .text("Este documento es una representación impresa de un CFDI versión 4.0", pageWidth / 2, y + 2, { align: 'center' });
            y += 6;
        }

        // =======================================================
        // SECCIÓN: CANCELACIÓN (Sólo si fue cancelada)
        // =======================================================
        if (esCancelada) {
            if (y + 25 > contentMaxY) {
                await nuevaPagina();
            }

            pdf.setFillColor(254, 226, 226).rect(margin, y - 2, pageWidth - 2 * margin, 6, 'F');
            pdf.setFontSize(8).setTextColor(danger).setFont('helvetica', 'bold')
                .text("DATOS DE CANCELACIÓN ANTE EL SAT", margin + 3, y + 2.5);
            y += 8;

            pdf.setFontSize(7.5).setTextColor(gray).setFont('helvetica', 'normal');
            const fechaCanc = factura.cancelacion?.fechaCancelacion || factura.cancelacion?.fechaSolicitud || '';
            pdf.text(`Fecha Cancelación: ${formatearFechaHora(fechaCanc)}`, margin, y);
            y += 4.5;
            pdf.text(`Motivo SAT: ${factura.cancelacion?.motivo || 'N/E'}`, margin, y);
            y += 4.5;
            if (factura.cancelacion?.folioSustitucion) {
                pdf.text(`Folio Sustitución: ${factura.cancelacion.folioSustitucion}`, margin, y);
                y += 4.5;
            }
            if (factura.cancelacion?.mensaje) {
                pdf.text(`Estatus: ${factura.cancelacion.mensaje}`, margin, y);
                y += 4.5;
            }
            y += 3;
        }

        // =======================================================
        // SECCIÓN: ADVERTENCIA BORRADOR (Sólo si es borrador)
        // =======================================================
        if (esBorrador) {
            if (y + 16 > contentMaxY) {
                await nuevaPagina();
            }

            pdf.setFillColor(255, 243, 205).rect(margin, y, pageWidth - 2 * margin, 12, 'F');
            pdf.setDrawColor(255, 193, 7).rect(margin, y, pageWidth - 2 * margin, 12, 'S');

            pdf.setFontSize(7.5).setTextColor('#856404').setFont('helvetica', 'bold')
                .text("ESTE DOCUMENTO ES UN BORRADOR SIN VALIDEZ FISCAL ANTE EL SAT", pageWidth / 2, y + 4.5, { align: 'center' });
            pdf.setFontSize(6.5).setFont('helvetica', 'normal')
                .text("Los datos aquí contenidos son informativos y corresponden a la versión preliminar de la factura.", pageWidth / 2, y + 8.5, { align: 'center' });
            y += 15;
        }

        dibujarPiePagina();

        return pdf.output('blob');

    } catch (error) {
        console.error('❌ Error generando PDF de factura:', error);
        throw error;
    }
}

/**
 * Genera el PDF y lo abre en una nueva ventana/pestaña
 */
export async function abrirPDFFactura(factura, options = {}) {
    try {
        const blob = await generarPDFFactura(factura, options);
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        return newWindow;
    } catch (error) {
        console.error('❌ Error abriendo PDF de factura:', error);
        throw error;
    }
}

/**
 * Descarga el PDF de la factura localmente
 */
export async function descargarPDFFactura(factura, options = {}) {
    try {
        const blob = await generarPDFFactura(factura, options);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const esBorrador = options.esBorrador !== undefined 
            ? Boolean(options.esBorrador) 
            : (factura.estatus === 'borrador' || factura.estatus === 'pendiente' || !factura.timbrado?.uuid);
        link.download = `Factura-${factura.facturaNumero || 'Borrador'}${esBorrador ? '-BORRADOR' : ''}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
        console.error('❌ Error descargando PDF de factura:', error);
        throw error;
    }
}

// =================================================================================
// EXPORTACIÓN POR DEFECTO
// =================================================================================

export default {
    generarPDFCotizacion,
    generarPDFFactura,
    abrirPDFFactura,
    descargarPDFFactura,
    loadJsPDF,
    getBase64ImageFromURL,
    formatearNumero,
    formatearFecha,
    formatearFechaHora,
    numeroALetras,
    extraerDatosFiscalesDesdeXML
};
