/* ========================================
   PDF GENERATOR - Cotizaciones y Facturas
   ======================================== */

let logoBase64Cache = null;
let jsPDFInstance = null;

/**
 * Carga la librería jsPDF de forma dinámica
 */
async function loadJsPDF() {
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
 * Obtiene el logo en Base64
 */
async function getBase64ImageFromURL(url) {
    if (logoBase64Cache) return logoBase64Cache;
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            logoBase64Cache = dataURL;
            resolve(dataURL);
        };
        img.onerror = (e) => {
            console.error("Error al cargar la imagen:", e);
            reject(new Error('No se pudo cargar la imagen del logo.'));
        };
        img.src = url;
    });
}

/**
 * Agrupa items por categoría
 */
function agruparItemsPorCategoria(items) {
    const grupos = {};
    items.forEach(item => {
        const categoria = item.categoriaNombre || item.categoria || 'OTRO';
        if (!grupos[categoria]) grupos[categoria] = [];
        grupos[categoria].push(item);
    });
    return grupos;
}

/**
 * Formatea moneda
 */
function formatearNumero(num) {
    return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: 'MXN' 
    }).format(num).replace('MX', '').trim();
}

// =================================================================================
// GENERAR PDF COTIZACIÓN
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
                    pdf.addImage(logoData, 'PNG', pageWidth - margin - 40, margin, 40, 40);
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
            
            pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'normal')
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
// GENERAR PDF FACTURA
// =================================================================================

/**
 * Genera el PDF de una factura
 * @param {Object} data - Datos de la factura
 * @param {string} logoUrl - URL del logo
 * @param {Object} timbrado - Datos del timbrado (uuid, fecha, etc.)
 * @returns {Promise<Blob>} - Blob del PDF
 */
export async function generarPDFFactura(data, logoUrl, timbrado = null) {
    try {
        const jsPDF = await loadJsPDF();
        if (!jsPDF) {
            throw new Error('No se pudo cargar la librería jsPDF');
        }
        
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        
        const headerHeight = 75;
        const footerHeight = 20;
        const contentStartY = headerHeight;
        const contentMaxY = pageHeight - footerHeight - 10;
        
        const textColor = '#000000';
        const gray = '#6b7280';
        const navy = '#0d2c54';
        const lightGray = '#f5f5f5';
        const successGreen = '#28a745';
        
        let page = 1;
        let y = contentStartY;
        
        // Función para dibujar encabezado
        const dibujarEncabezado = async () => {
            try {
                if (logoUrl) {
                    const logoData = await getBase64ImageFromURL(logoUrl);
                    pdf.addImage(logoData, 'PNG', pageWidth - margin - 40, margin, 40, 40);
                }
            } catch (e) { 
                console.warn('No se pudo cargar el logo:', e); 
            }
            
            // Información de la empresa
            pdf.setFontSize(10).setTextColor(navy)
                .text(data.empresaNombre || "RSI ENTERPRISE", margin, margin + 5);
            pdf.setFontSize(8).setTextColor(gray)
                .text(data.empresaDireccion || "", margin, margin + 10)
                .text(`RFC: ${data.empresaRFC || ''} | Tel: ${data.empresaTelefono || ''}`, margin, margin + 15);
            
            // Título de factura
            pdf.setFontSize(16).setTextColor(navy)
                .text("FACTURA", pageWidth / 2, margin + 28, { align: 'center' });
            pdf.setFontSize(9).setTextColor(gray)
                .text(`No. ${data.facturaNumero} | Fecha: ${new Date(data.facturaFecha).toLocaleDateString('es-MX')}`, 
                      pageWidth / 2, margin + 35, { align: 'center' });
            
            // Si está timbrada, mostrar UUID
            if (timbrado && timbrado.uuid) {
                pdf.setFontSize(7).setTextColor(successGreen)
                    .text(`UUID: ${timbrado.uuid}`, pageWidth / 2, margin + 42, { align: 'center' });
            }
        };
        
        // Función para dibujar pie de página
        const dibujarPiePagina = () => {
            pdf.setFontSize(7).setTextColor(gray);
            
            const line1 = `Factura No. ${data.facturaNumero} | Página ${page}`;
            const line2 = timbrado && timbrado.uuid ? `UUID: ${timbrado.uuid}` : '';
            
            pdf.text(line1, pageWidth / 2, pageHeight - footerHeight, { align: 'center' });
            if (line2) {
                pdf.text(line2, pageWidth / 2, pageHeight - footerHeight + 5, { align: 'center' });
            }
            
            pdf.setDrawColor(200, 200, 200)
                .line(margin, pageHeight - footerHeight - 3, pageWidth - margin, pageHeight - footerHeight - 3);
        };
        
        // Función para nueva página
        const nuevaPagina = async () => {
            pdf.addPage();
            page++;
            y = contentStartY;
            await dibujarEncabezado();
            dibujarPiePagina();
        };
        
        // Dibujar primera página
        await dibujarEncabezado();
        dibujarPiePagina();
        
        // Información del cliente
        if (y + 35 > contentMaxY) {
            await nuevaPagina();
        }
        
        pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
            .text("DATOS DEL CLIENTE", margin, y);
        y += 6;
        
        pdf.setFontSize(9).setTextColor(textColor).setFont('helvetica', 'normal')
            .text(`Razón Social: ${data.clienteRazonSocial || data.clienteNombre || 'N/E'}`, margin, y);
        y += 5;
        pdf.text(`RFC: ${data.clienteRFC || 'N/E'}`, margin, y);
        y += 5;
        pdf.text(`Dirección: ${data.clienteDireccion || 'N/E'}`, margin, y);
        y += 5;
        pdf.text(`Teléfono: ${data.clienteTelefono || 'N/E'}`, margin, y);
        y += 5;
        pdf.text(`Email: ${data.clienteEmail || 'N/E'}`, margin, y);
        y += 8;
        
        // Datos CFDI
        if (y + 20 > contentMaxY) {
            await nuevaPagina();
        }
        
        pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
            .text("DATOS DEL CFDI", margin, y);
        y += 6;
        
        pdf.setFontSize(8).setTextColor(textColor).setFont('helvetica', 'normal')
            .text(`Uso de CFDI: ${data.usoCFDI || 'N/E'}`, margin, y);
        pdf.text(`Forma de Pago: ${data.formaPago || 'N/E'}`, margin + 100, y);
        y += 5;
        pdf.text(`Método de Pago: ${data.metodoPago || 'N/E'}`, margin, y);
        pdf.text(`Moneda: ${data.facturaMoneda || 'MXN'}`, margin + 100, y);
        y += 10;
        
        // Items
        if (y + 15 > contentMaxY) {
            await nuevaPagina();
        }
        
        pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
            .text("DETALLE DE LA FACTURA", margin, y);
        y += 6;
        
        // Encabezado de tabla
        pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
        pdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
            .text("DESCRIPCIÓN", margin + 5, y + 3)
            .text("CANT.", margin + 95, y + 3, { align: 'right' })
            .text("P. UNIT.", margin + 115, y + 3, { align: 'right' })
            .text("TOTAL", margin + 145, y + 3, { align: 'right' });
        y += 10;
        
        // Items
        const items = data.items || [];
        for (const item of items) {
            const descLines = pdf.splitTextToSize(item.descripcion || 'Sin descripción', 70);
            const itemHeight = Math.max(descLines.length * 4, 8) + 2;
            
            if (y + itemHeight + 5 > contentMaxY) {
                await nuevaPagina();
                // Redibujar encabezado de tabla
                pdf.setFillColor(navy).rect(margin, y - 2, pageWidth - 2 * margin, 8, 'F');
                pdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor('#FFFFFF')
                    .text("DESCRIPCIÓN", margin + 5, y + 3)
                    .text("CANT.", margin + 95, y + 3, { align: 'right' })
                    .text("P. UNIT.", margin + 115, y + 3, { align: 'right' })
                    .text("TOTAL", margin + 145, y + 3, { align: 'right' });
                y += 10;
            }
            
            if (items.indexOf(item) % 2 === 0) {
                pdf.setFillColor(lightGray).rect(margin, y - 2, pageWidth - 2 * margin, itemHeight, 'F');
            }
            
            pdf.setTextColor(textColor);
            descLines.forEach((line, i) => {
                if (y + 3 + (i * 4) < contentMaxY) {
                    pdf.text(line, margin + 5, y + 3 + (i * 4));
                }
            });
            
            const cantidad = item.cantidad || 0;
            const precio = item.precioUnitario || 0;
            const total = item.total || 0;
            
            pdf.text(cantidad.toString(), margin + 95, y + 3, { align: 'right' });
            pdf.text(formatearNumero(precio), margin + 115, y + 3, { align: 'right' });
            pdf.text(formatearNumero(total), margin + 145, y + 3, { align: 'right' });
            
            pdf.setDrawColor(200, 200, 200).line(margin, y + itemHeight - 2, pageWidth - margin, y + itemHeight - 2);
            y += itemHeight;
        }
        y += 4;
        
        // Totales
        if (y + 35 > contentMaxY) {
            await nuevaPagina();
        }
        
        const tableStartX = pageWidth - margin - 100;
        const valueColX = tableStartX + 80;
        
        pdf.setFontSize(9).setTextColor(textColor)
            .text("Subtotal:", tableStartX, y, { align: 'left' })
            .text(formatearNumero(data.subtotal || 0), valueColX, y, { align: 'right' });
        y += 6;
        
        pdf.text(`IVA (${data.impuesto || 16}%):`, tableStartX, y, { align: 'left' })
            .text(formatearNumero(data.impuestoMonto || 0), valueColX, y, { align: 'right' });
        y += 8;
        
        pdf.setFont('helvetica', 'bold').setTextColor(navy)
            .text("TOTAL:", tableStartX, y, { align: 'left' })
            .text(`${formatearNumero(data.totalFinal || 0)} ${data.facturaMoneda || 'MXN'}`, valueColX, y, { align: 'right' });
        y += 12;
        
        // Si está timbrada, mostrar información del timbrado
        if (timbrado && timbrado.uuid) {
            if (y + 30 > contentMaxY) {
                await nuevaPagina();
            }
            
            pdf.setFontSize(8).setTextColor(navy).setFont('helvetica', 'bold')
                .text("DATOS DEL TIMBRADO", margin, y);
            y += 5;
            
            pdf.setFontSize(7).setTextColor(textColor).setFont('helvetica', 'normal')
                .text(`UUID: ${timbrado.uuid || 'N/A'}`, margin, y);
            y += 4;
            pdf.text(`Fecha de Timbrado: ${timbrado.fechaTimbrado || 'N/A'}`, margin, y);
            y += 4;
            pdf.text(`No. Certificado: ${timbrado.noCertificado || 'N/A'}`, margin, y);
            y += 4;
            pdf.text(`Sello: ${(timbrado.sello || '').substring(0, 50)}...`, margin, y);
            
            // QR Code (si existe)
            if (timbrado.qrCode) {
                try {
                    // Aquí se podría agregar el QR code
                    // pdf.addImage(timbrado.qrCode, 'PNG', pageWidth - margin - 40, y - 20, 40, 40);
                } catch (e) {
                    console.warn('No se pudo agregar QR code:', e);
                }
            }
        }
        
        dibujarPiePagina();
        
        return pdf.output('blob');
        
    } catch (error) {
        console.error('❌ Error generando PDF de factura:', error);
        throw error;
    }
}

// =================================================================================
// EXPORTAR
// =================================================================================

export default {
    generarPDFCotizacion,
    generarPDFFactura
};