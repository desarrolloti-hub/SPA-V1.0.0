/* =================================================================================
   TICKET PHOTOGRAPHIC REPORT PDF GENERATOR (RSI ENTERPRISE)
   Inspirado en la identidad visual oficial de Cotizaciones y Facturas (pdfGenerator.js)
   con fotografías de evidencia (Antes, Durante, Después) de gran tamaño.
   ================================================================================= */

import {
    loadJsPDF,
    getBase64ImageFromURL,
    formatearFecha,
    formatearFechaHora
} from './pdfGenerator.js';
import TicketModel from '../models/ticketModel.js';

const DEFAULT_LOGO_URL = '/assets/icons/logo.png';

/**
 * Convierte un Blob o DataURL de imagen a un objeto { dataUrl, width, height, format: 'JPEG' }
 * usando un elemento Image local (mismo origen) y Canvas para garantizar compatibilidad total con jsPDF.
 * @param {string} safeSrc - DataURL o ObjectURL local
 * @returns {Promise<{ dataUrl: string, width: number, height: number, format: string } | null>}
 */
function procesarFuenteLocalEnCanvas(safeSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const width = img.naturalWidth || img.width || 1280;
                const height = img.naturalHeight || img.height || 960;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                resolve({ dataUrl, width, height, format: 'JPEG' });
            } catch (err) {
                console.warn('⚠️ Error convirtiendo imagen en canvas:', err);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = safeSrc;
    });
}

/**
 * Convierte un Blob binario de imagen a DataURL y extrae sus dimensiones
 * @param {Blob} blob
 * @returns {Promise<{ dataUrl: string, width: number, height: number, format: string } | null>}
 */
async function convertirBlobAImagenConDimensiones(blob) {
    if (!blob || blob.size === 0) return null;
    if (blob.type && (blob.type.includes('text/html') || blob.type.includes('application/json'))) {
        return null;
    }

    const base64Url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });

    if (!base64Url) return null;
    return await procesarFuenteLocalEnCanvas(base64Url);
}

/**
 * Intenta descargar un Blob de imagen desde una URL candidata con timeout
 * @param {string} targetUrl
 * @param {number} [timeoutMs=12000]
 * @returns {Promise<Blob|null>}
 */
async function fetchImageBlob(targetUrl, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
            credentials: 'omit'
        });
        if (!response.ok) return null;
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
            return null;
        }
        const blob = await response.blob();
        if (!blob || blob.size < 100) return null;
        return blob;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Carga una imagen desde una URL (incluyendo Firebase Storage sin CORS directo)
 * y obtiene su DataURL JPEG junto con sus dimensiones originales para el PDF.
 * @param {string} url
 * @returns {Promise<{ dataUrl: string, width: number, height: number, format: string } | null>}
 */
async function cargarImagenConDimensiones(url) {
    if (!url) return null;

    // 1. Si ya es DataURL o Blob URL local
    if (url.startsWith('data:image/') || url.startsWith('blob:')) {
        return await procesarFuenteLocalEnCanvas(url);
    }

    // Construir lista priorizada de URLs candidatas para evadir bloqueos CORS de Firebase Storage
    const candidateUrls = [];

    // 2. Proxy local de Vite (si es URL de Firebase Storage)
    if (url.startsWith('https://firebasestorage.googleapis.com/')) {
        const proxiedPath = url.replace('https://firebasestorage.googleapis.com', '/__storage_proxy');
        candidateUrls.push(proxiedPath);
    }

    // 3. Proxy global de imágenes Cloudflare (wsrv.nl / images.weserv.nl) con cabeceras CORS habilitadas
    candidateUrls.push(`https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`);
    candidateUrls.push(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`);

    // 4. Proxies CORS de respaldo para binarios directos
    candidateUrls.push(`https://corsproxy.io/?url=${encodeURIComponent(url)}`);
    candidateUrls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);

    // 5. Petición directa (por si el bucket tiene CORS configurado o es mismo dominio)
    candidateUrls.push(url);

    for (const candidate of candidateUrls) {
        const blob = await fetchImageBlob(candidate);
        if (blob) {
            const parsed = await convertirBlobAImagenConDimensiones(blob);
            if (parsed && parsed.dataUrl) {
                return parsed;
            }
        }
    }

    // 6. Último intento mediante elemento Image con crossOrigin='Anonymous'
    const fallbackDirect = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const width = img.naturalWidth || img.width || 1280;
                const height = img.naturalHeight || img.height || 960;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve({
                    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
                    width,
                    height,
                    format: 'JPEG'
                });
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });

    return fallbackDirect;
}

/**
 * Calcula las dimensiones proporcionales (width, height) para ajustar una imagen
 * dentro de una caja máxima (maxW, maxH) sin recortarla ni deformarla.
 */
function calcularDimensionesProporcionales(origW, origH, maxW, maxH) {
    const w = origW > 0 ? origW : 4;
    const h = origH > 0 ? origH : 3;
    const ratio = Math.min(maxW / w, maxH / h);
    return {
        width: Number((w * ratio).toFixed(2)),
        height: Number((h * ratio).toFixed(2))
    };
}

/**
 * Genera el Reporte Fotográfico en PDF de un Ticket con el formato institucional
 * de Cotizaciones y Facturas de RSI Enterprise y fotografías de gran tamaño.
 *
 * @param {Object} ticket - Datos completos del ticket
 * @param {Object} [options] - Opciones adicionales ({ logoUrl, colaboradoresNames })
 * @returns {Promise<Blob>} - Blob del archivo PDF generado
 */
export async function generarPDFReporteFotograficoTicket(ticket, options = {}) {
    if (!ticket) {
        throw new Error('No se proporcionaron datos del ticket para generar el reporte PDF.');
    }

    const jsPDF = await loadJsPDF();
    if (!jsPDF) {
        throw new Error('No se pudo cargar la librería jsPDF.');
    }

    const logoUrl = options.logoUrl || DEFAULT_LOGO_URL;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;          // 180 mm

    const headerHeight = 58;
    const footerHeight = 14;
    const contentStartY = headerHeight;
    const contentMaxY = pageHeight - footerHeight - 8;

    // Paleta institucional idéntica a Cotizaciones y Facturas
    const textColor = '#000000';
    const gray = '#6b7280';
    const navy = '#0d2c54';
    const lightGray = '#f5f5f5';

    const estadoColors = {
        pendiente: [217, 119, 6],
        en_proceso: [23, 162, 184],
        finalizado: [40, 167, 69],
        abandonado: [40, 167, 69], // Para el cliente se presenta como finalizado
        cancelado: [220, 53, 69]
    };

    const estadoLabels = {
        pendiente: 'PENDIENTE',
        en_proceso: 'EN PROCESO',
        finalizado: 'FINALIZADO',
        abandonado: 'FINALIZADO', // Para el cliente se marca como FINALIZADO
        cancelado: 'CANCELADO'
    };

    const folioTicket = ticket.idTicket || ticket.id || 'N/E';
    const esOperativo = ticket.tipo === 'operativo' || ticket.tipoTicket === 'operacion';
    const estadoKey = (ticket.estado || 'pendiente').toLowerCase();
    const estadoTexto = estadoLabels[estadoKey] || estadoKey.toUpperCase();
    const estadoRGB = estadoColors[estadoKey] || [13, 44, 84];

    let page = 1;
    let y = contentStartY;

    const logoBase64 = logoUrl ? await getBase64ImageFromURL(logoUrl) : null;

    /**
     * Dibuja el encabezado institucional inspirado en Cotizaciones y Facturas
     */
    const dibujarEncabezado = () => {
        if (logoBase64) {
            try {
                pdf.addImage(logoBase64, 'PNG', pageWidth - margin - 36, margin - 2, 36, 36);
            } catch (e) {
                console.warn('⚠️ No se pudo insertar el logo en el encabezado del reporte:', e);
            }
        }

        // Datos de la empresa (esquina superior izquierda)
        pdf.setFontSize(9.5).setTextColor(navy).setFont('helvetica', 'bold')
            .text('RSI ENTERPRISE NEZAHUALCÓYOTL', margin, margin + 4);

        pdf.setFontSize(7.5).setTextColor(textColor).setFont('helvetica', 'bold')
            .text('RFC: ', margin, margin + 8.2);
        pdf.setFont('helvetica', 'normal').setTextColor(gray)
            .text('RSI1810319G0', margin + 7.5, margin + 8.2);

        pdf.setFont('helvetica', 'normal').setTextColor(gray)
            .text('C.P. Domicilio Fiscal: 57200 | Seguridad Electrónica, Automatización y Telecomunicaciones', margin, margin + 12.2);

        // Título central del documento
        pdf.setFontSize(13).setTextColor(navy).setFont('helvetica', 'bold')
            .text('REPORTE FOTOGRÁFICO Y DE ATENCIÓN DE TICKET', pageWidth / 2, margin + 22, { align: 'center' });

        // Etiqueta de estado centrada (estilo Factura)
        pdf.setFillColor(estadoRGB[0], estadoRGB[1], estadoRGB[2]);
        pdf.roundedRect(pageWidth / 2 - 22, margin + 24.5, 44, 5, 1, 1, 'F');
        pdf.setFontSize(7.5).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
            .text(estadoTexto, pageWidth / 2, margin + 28.1, { align: 'center' });

        pdf.setFontSize(8.5).setTextColor(gray).setFont('helvetica', 'normal')
            .text(
                `Folio: ${folioTicket} | Fecha de Creación: ${formatearFecha(ticket.fechaCreacion)} | Tipo: ${esOperativo ? 'Operativo' : 'Administración'}`,
                pageWidth / 2,
                margin + 34.5,
                { align: 'center' }
            );

        pdf.setDrawColor(210, 210, 210)
            .line(margin, margin + 38, pageWidth - margin, margin + 38);
    };

    /**
     * Dibuja el pie de página institucional idéntico a Cotizaciones y Facturas
     */
    const dibujarPiePagina = () => {
        pdf.setFontSize(8).setTextColor(gray).setFont('helvetica', 'normal')
            .text(
                `Reporte Fotográfico | Ticket No. ${folioTicket} | Página ${page}`,
                pageWidth / 2,
                pageHeight - footerHeight,
                { align: 'center' }
            );
        pdf.setDrawColor(200, 200, 200)
            .line(margin, pageHeight - footerHeight - 3, pageWidth - margin, pageHeight - footerHeight - 3);
    };

    const nuevaPagina = () => {
        pdf.addPage();
        page++;
        y = contentStartY;
        dibujarEncabezado();
        dibujarPiePagina();
    };

    // Inicializar primera página
    dibujarEncabezado();
    dibujarPiePagina();

    // =========================================================================
    // 1. BLOQUE DE INFORMACIÓN GENERAL DEL TICKET Y CLIENTE
    // =========================================================================
    const tituloTicket = ticket.titulo || ticket.motivoLabel || 'Sin título especificado';
    const prioridadLabel = (ticket.prioridad || 'media').toUpperCase();
    const areaLabel = ticket.area || ticket.areaNombre || 'General';
    const responsableLabel = ticket.responsableNombre || 'Sin asignar';
    const fechaInicioLabel = ticket.fechaInicio ? formatearFechaHora(ticket.fechaInicio) : 'No registrada';
    const fechaFinLabel = (ticket.fechaFin || ticket.fechaFinalizacion)
        ? formatearFechaHora(ticket.fechaFin || ticket.fechaFinalizacion)
        : 'En atención';

    pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
        .text(`TÍTULO / MOTIVO: ${tituloTicket}`, margin, y);
    y += 5;

    pdf.setFontSize(8.5).setTextColor(textColor).setFont('helvetica', 'normal');

    if (esOperativo) {
        const clienteNombre = ticket.clienteNombre || ticket.cliente?.nombreEmpresa || 'Cliente General';
        const rfcCliente = ticket.rfc || 'N/E';
        const atencionA = ticket.atencionA || ticket.cliente?.nombreResponsable || 'N/E';
        const correoCliente = ticket.correo || ticket.cliente?.telefonoContacto || 'N/E';
        const proyecto = ticket.proyecto || 'N/E';
        const servicio = ticket.servicio || 'N/E';
        const ordenServicio = ticket.ordenServicio || 'N/E';
        const cotizacionNum = ticket.cotizacionNumero || 'No asociada';
        const sistemasStr = Array.isArray(ticket.sistemas) && ticket.sistemas.length > 0
            ? ticket.sistemas.join(', ')
            : 'N/E';

        pdf.text(`Cliente: ${clienteNombre} | RFC: ${rfcCliente}`, margin, y);
        y += 4.5;
        pdf.text(`Atención a: ${atencionA} | Contacto / Correo: ${correoCliente}`, margin, y);
        y += 4.5;
        pdf.text(`Proyecto: ${proyecto} | Servicio: ${servicio} | Orden de Servicio: ${ordenServicio}`, margin, y);
        y += 4.5;
        pdf.text(`Sistemas: ${sistemasStr} | Cotización Asociada: ${cotizacionNum}`, margin, y);
        y += 5;
    }

    pdf.text(`Área: ${areaLabel} | Prioridad: ${prioridadLabel} | Responsable: ${responsableLabel}`, margin, y);
    y += 4.5;
    pdf.text(`Inicio de Atención: ${fechaInicioLabel} | Finalización: ${fechaFinLabel}`, margin, y);
    y += 6;

    // Colaboradores asignados / que aceptaron
    const aceptaciones = TicketModel.normalizeAceptaciones(ticket);
    if ( Array.isArray(options.colaboradoresNames) && options.colaboradoresNames.length > 0 ) {
        const colabStr = options.colaboradoresNames.join(', ');
        const colabLines = pdf.splitTextToSize(`Colaboradores Asignados: ${colabStr}`, contentWidth);
        colabLines.forEach(line => {
            pdf.text(line, margin, y);
            y += 4.5;
        });
        y += 1.5;
    } else if (Array.isArray(ticket.colaboradores) && ticket.colaboradores.length > 0) {
        const colabStr = ticket.colaboradores.map(c => c.nombreCompleto || c.nombre).filter(Boolean).join(', ');
        if (colabStr) {
            const colabLines = pdf.splitTextToSize(`Colaboradores Asignados: ${colabStr}`, contentWidth);
            colabLines.forEach(line => {
                pdf.text(line, margin, y);
                y += 4.5;
            });
            y += 1.5;
        }
    } else if (aceptaciones.length > 0) {
        const accStr = aceptaciones.map(a => a.nombre).filter(Boolean).join(', ');
        if (accStr) {
            pdf.text(`Atendido por: ${accStr}`, margin, y);
            y += 5;
        }
    }

    // Descripción de la solicitud
    if (ticket.descripcion && ticket.descripcion.trim()) {
        if (y + 15 > contentMaxY) nuevaPagina();
        pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
            .text('DESCRIPCIÓN DE LA SOLICITUD:', margin, y);
        y += 4.5;
        pdf.setFontSize(8.5).setTextColor(textColor).setFont('helvetica', 'normal');
        const descLines = pdf.splitTextToSize(ticket.descripcion.trim(), contentWidth);
        for (const line of descLines) {
            if (y + 4.5 > contentMaxY) nuevaPagina();
            pdf.text(line, margin, y);
            y += 4.2;
        }
        y += 3;
    }

    // Actividades desarrolladas
    if (ticket.actividadesDesarrolladas && ticket.actividadesDesarrolladas.trim()) {
        if (y + 15 > contentMaxY) nuevaPagina();
        pdf.setFontSize(9).setTextColor(navy).setFont('helvetica', 'bold')
            .text('ACTIVIDADES DESARROLLADAS:', margin, y);
        y += 4.5;
        pdf.setFontSize(8.5).setTextColor(textColor).setFont('helvetica', 'normal');
        const actLines = pdf.splitTextToSize(ticket.actividadesDesarrolladas.trim(), contentWidth);
        for (const line of actLines) {
            if (y + 4.5 > contentMaxY) nuevaPagina();
            pdf.text(line, margin, y);
            y += 4.2;
        }
        y += 4;
    }

    // =========================================================================
    // 2. REPORTE FOTOGRÁFICO POR ETAPAS (ANTES, DURANTE, DESPUÉS)
    //    Imágenes de gran tamaño ("considerables en tamaño")
    // =========================================================================
    const evidencias = TicketModel.normalizeEvidencias(ticket);
    const etapasConfig = [
        { key: 'antes', titulo: '1. EVIDENCIAS FOTOGRÁFICAS — ANTES', chip: 'ANTES' },
        { key: 'durante', titulo: '2. EVIDENCIAS FOTOGRÁFICAS — DURANTE', chip: 'DURANTE' },
        { key: 'despues', titulo: '3. EVIDENCIAS FOTOGRÁFICAS — DESPUÉS', chip: 'DESPUÉS' }
    ];

    const totalFotos = (evidencias.antes?.length || 0) +
                       (evidencias.durante?.length || 0) +
                       (evidencias.despues?.length || 0);

    if (totalFotos === 0) {
        if (y + 25 > contentMaxY) nuevaPagina();
        pdf.setFillColor(navy).rect(margin, y, contentWidth, 10, 'F');
        pdf.setFontSize(10).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
            .text('EVIDENCIAS FOTOGRÁFICAS', pageWidth / 2, y + 6.5, { align: 'center' });
        y += 16;

        pdf.setFontSize(9).setTextColor(gray).setFont('helvetica', 'italic')
            .text('Este ticket aún no cuenta con evidencias fotográficas cargadas.', pageWidth / 2, y, { align: 'center' });
        return pdf.output('blob');
    }

    // Dimensiones máximas para cada fotografía grande en el reporte PDF:
    // Ancho disponible = 180mm (hasta 172mm efectivos de imagen)
    // Alto máximo por fotografía = 96mm (permite 2 fotografías grandes por página completa)
    const maxPhotoWidth = contentWidth - 8; // 172 mm
    const maxPhotoHeight = 96;              // 96 mm

    for (const etapaInfo of etapasConfig) {
        const items = evidencias[etapaInfo.key] || [];
        if (items.length === 0) continue;

        // Pre-cargar la primera imagen de la etapa para saber si cabe junto con el encabezado de sección
        const loadedImages = await Promise.all(items.map(ev => cargarImagenConDimensiones(ev.url)));

        for (let i = 0; i < items.length; i++) {
            const ev = items[i];
            const imgData = loadedImages[i];

            const descText = ev.descripcion ? `Nota: ${ev.descripcion.trim()}` : '';
            const descLines = descText ? pdf.splitTextToSize(descText, contentWidth - 8) : [];
            const metaBlockHeight = 14 + (descLines.length * 4);

            let photoW = maxPhotoWidth;
            let photoH = 82;
            if (imgData) {
                const dims = calcularDimensionesProporcionales(
                    imgData.width,
                    imgData.height,
                    maxPhotoWidth,
                    maxPhotoHeight
                );
                photoW = dims.width;
                photoH = dims.height;
            } else {
                photoH = 22;
            }

            const cardTotalHeight = metaBlockHeight + photoH + 8;
            const sectionHeaderHeight = i === 0 ? 14 : 0;

            // Si no cabe la barra de sección + la tarjeta de la foto completa en el espacio actual, saltar de página
            if (y + sectionHeaderHeight + cardTotalHeight > contentMaxY) {
                nuevaPagina();
            }

            // Si es la primera foto de la etapa (o acabamos de saltar de página al inicio de la etapa), dibujar barra navy
            if (i === 0) {
                pdf.setFillColor(navy).rect(margin, y, contentWidth, 10, 'F');
                pdf.setFontSize(10.5).setTextColor('#FFFFFF').setFont('helvetica', 'bold')
                    .text(
                        `${etapaInfo.titulo} (${items.length} FOTO${items.length === 1 ? '' : 'S'})`,
                        pageWidth / 2,
                        y + 6.6,
                        { align: 'center' }
                    );
                y += 13;
            }

            // Contenedor de la fotografía y sus metadatos
            const cardStartY = y;
            pdf.setDrawColor(205, 210, 218);
            pdf.setFillColor(lightGray);
            pdf.rect(margin, cardStartY, contentWidth, metaBlockHeight, 'F');
            pdf.rect(margin, cardStartY, contentWidth, cardTotalHeight, 'S');

            // Metadatos de la fotografía
            const autor = ev.subidoPorNombre || 'Colaborador RSI';
            const fechaEv = typeof ev.fechaHora === 'string'
                ? ev.fechaHora
                : (ev.fechaHora?.completo || formatearFechaHora(ev.fechaSubida));

            const hasGeo = ev.ubicacion?.latitud != null && ev.ubicacion?.longitud != null;
            const gpsStr = hasGeo
                ? `Lat ${Number(ev.ubicacion.latitud).toFixed(6)}, Lng ${Number(ev.ubicacion.longitud).toFixed(6)}${ev.ubicacion.precision ? ` (±${ev.ubicacion.precision}m)` : ''}`
                : 'Sin coordenadas GPS registradas';

            pdf.setFontSize(8.5).setTextColor(navy).setFont('helvetica', 'bold')
                .text(
                    `Fotografía #${i + 1} (${etapaInfo.chip}) — Capturada por: ${autor}`,
                    margin + 4,
                    cardStartY + 5
                );

            pdf.setFontSize(7.8).setTextColor(gray).setFont('helvetica', 'normal')
                .text(
                    `Fecha y Hora: ${fechaEv}   |   Ubicación GPS: ${gpsStr}`,
                    margin + 4,
                    cardStartY + 10
                );

            let currentMetaY = cardStartY + 14.5;
            if (descLines.length > 0) {
                pdf.setFontSize(8).setTextColor(textColor).setFont('helvetica', 'italic');
                descLines.forEach(line => {
                    pdf.text(line, margin + 4, currentMetaY);
                    currentMetaY += 4;
                });
            }

            // Dibujar la imagen centrada horizontalmente con tamaño considerable
            const imageStartY = cardStartY + metaBlockHeight + 3;
            if (imgData && imgData.dataUrl) {
                const imageX = margin + (contentWidth - photoW) / 2;
                try {
                    pdf.addImage(imgData.dataUrl, imgData.format || 'JPEG', imageX, imageStartY, photoW, photoH);
                } catch (imgErr) {
                    console.warn('⚠️ Error insertando imagen en jsPDF:', imgErr);
                    pdf.setFontSize(8).setTextColor(gray).setFont('helvetica', 'italic')
                        .text('No fue posible renderizar la imagen en este bloque.', pageWidth / 2, imageStartY + 10, { align: 'center' });
                }
            } else {
                pdf.setFontSize(8).setTextColor(gray).setFont('helvetica', 'italic')
                    .text('Fotografía no disponible temporalmente.', pageWidth / 2, imageStartY + 10, { align: 'center' });
            }

            y = cardStartY + cardTotalHeight + 5;
        }

        y += 3;
    }

    dibujarPiePagina();
    return pdf.output('blob');
}

/**
 * Genera el PDF del reporte fotográfico del ticket y lo abre en una nueva pestaña
 * (con descarga automática de respaldo si el navegador bloquea ventanas emergentes).
 */
export async function abrirPDFReporteFotograficoTicket(ticket, options = {}) {
    const blob = await generarPDFReporteFotograficoTicket(ticket, options);
    const pdfUrl = URL.createObjectURL(blob);
    const folio = (ticket?.idTicket || ticket?.id || 'Ticket').replace(/[^a-zA-Z0-9_-]/g, '_');

    const nuevaVentana = window.open(pdfUrl, '_blank');
    if (!nuevaVentana) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Reporte-Fotografico-${folio}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
    return blob;
}

export default {
    generarPDFReporteFotograficoTicket,
    abrirPDFReporteFotograficoTicket
};
