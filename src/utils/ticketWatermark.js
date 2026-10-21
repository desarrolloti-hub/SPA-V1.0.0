/* ========================================
   TICKET WATERMARK & CAMERA HELPER - RSI ENTERPRISE
   Estampado de marca de agua institucional (Logo, Fecha, Hora y Ubicación GPS)
   sobre fotografías de evidencia de tickets (Antes, Durante y Después)
   ======================================== */

export class TicketWatermarkHelper {
    static LOGO_SRC = '/assets/icons/logo.png';
    static _cachedLogo = null;

    /**
     * Carga y cachea en memoria el logotipo institucional de RSI Enterprise
     * @returns {Promise<HTMLImageElement|null>}
     */
    static async _loadLogo() {
        if (this._cachedLogo) {
            return this._cachedLogo;
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this._cachedLogo = img;
                resolve(img);
            };
            img.onerror = () => {
                console.warn('⚠️ No se pudo cargar el logo para marca de agua en:', this.LOGO_SRC);
                resolve(null);
            };
            img.src = this.LOGO_SRC;
        });
    }

    /**
     * Convierte un File o Blob en un HTMLImageElement
     * @param {File|Blob} fileOrBlob
     * @returns {Promise<HTMLImageElement>}
     */
    static _loadImageFromBlob(fileOrBlob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(fileOrBlob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(new Error('No fue posible procesar el archivo de imagen seleccionado.'));
            };
            img.src = url;
        });
    }

    /**
     * Formatea la fecha y hora en zona horaria America/Mexico_City
     * @param {Date|string} [dateInput]
     * @returns {{ fecha: string, hora: string, completo: string, iso: string }}
     */
    static formatFechaHoraCDMX(dateInput = new Date()) {
        const now = dateInput instanceof Date ? dateInput : new Date(dateInput);
        const timeZone = 'America/Mexico_City';

        const fecha = new Intl.DateTimeFormat('es-MX', {
            timeZone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(now);

        const hora = new Intl.DateTimeFormat('es-MX', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(now);

        return {
            fecha,
            hora,
            completo: `${fecha} ${hora} hrs`,
            iso: now.toISOString()
        };
    }

    /**
     * Procesa una imagen (desde File/Blob o elemento de video de cámara) y le incrusta:
     * - Marca de agua con el logo de la empresa RSI Enterprise
     * - Fecha y hora exacta (CDMX)
     * - Coordenadas de ubicación GPS y precisión
     * - Folio del ticket, etapa (Antes / Durante / Después) y nombre del colaborador
     *
     * @param {Object} params
     * @param {File|Blob|HTMLVideoElement} params.source - Fuente de la imagen
     * @param {string} params.idTicket - Código del ticket (ej. Ticket-RSI-15)
     * @param {string} params.etapa - 'antes' | 'durante' | 'despues'
     * @param {string} params.colaboradorNombre - Nombre del colaborador que toma la evidencia
     * @param {Object|null} params.ubicacion - Objeto de GeoMapHelper.obtenerPosicionActual()
     * @returns {Promise<{ blob: Blob, previewUrl: string, fechaHora: Object, ubicacion: Object }>}
     */
    static async aplicarMarcaDeAgua({
        source,
        idTicket = 'Ticket-RSI',
        etapa = 'antes',
        colaboradorNombre = 'Colaborador RSI',
        ubicacion = null
    }) {
        let sourceElement = null;
        let origWidth = 1280;
        let origHeight = 720;

        if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
            sourceElement = source;
            origWidth = source.videoWidth || 1280;
            origHeight = source.videoHeight || 720;
        } else if (source instanceof Blob || source instanceof File) {
            sourceElement = await this._loadImageFromBlob(source);
            origWidth = sourceElement.naturalWidth || sourceElement.width || 1280;
            origHeight = sourceElement.naturalHeight || sourceElement.height || 720;
        } else {
            throw new Error('Fuente de imagen no válida para aplicar marca de agua.');
        }

        // Redimensionar manteniendo proporción (máximo 1600px en el lado mayor para nitidez y ligereza)
        const maxDim = 1600;
        const minWidth = 900;
        let targetWidth = origWidth;
        let targetHeight = origHeight;

        if (targetWidth > maxDim || targetHeight > maxDim) {
            if (targetWidth >= targetHeight) {
                targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
                targetWidth = maxDim;
            } else {
                targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
                targetHeight = maxDim;
            }
        } else if (targetWidth < minWidth && targetWidth > 0) {
            const scaleUp = minWidth / targetWidth;
            targetWidth = Math.round(targetWidth * scaleUp);
            targetHeight = Math.round(targetHeight * scaleUp);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('No se pudo inicializar el contexto gráfico para la marca de agua.');
        }

        // 1. Dibujar la fotografía original
        ctx.drawImage(sourceElement, 0, 0, targetWidth, targetHeight);

        const logoImg = await this._loadLogo();
        const fechaHora = this.formatFechaHoraCDMX(new Date());

        const etapaLabels = {
            antes: 'ANTES',
            durante: 'DURANTE',
            despues: 'DESPUÉS'
        };
        const etapaColors = {
            antes: '#ffc107',
            durante: '#17a2b8',
            despues: '#28a745'
        };
        const etapaLabel = etapaLabels[etapa] || String(etapa).toUpperCase();
        const etapaAccentColor = etapaColors[etapa] || '#d4af37';

        const scale = Math.max(0.65, Math.min(1.35, targetWidth / 1200));

        // 2. Marca de agua central translúcida (Logo + Sello RSI Enterprise)
        ctx.save();
        ctx.globalAlpha = 0.16;
        if (logoImg) {
            const wmWidth = Math.round(targetWidth * 0.28);
            const wmHeight = Math.round((logoImg.naturalHeight / (logoImg.naturalWidth || 1)) * wmWidth);
            const wmX = Math.round((targetWidth - wmWidth) / 2);
            const wmY = Math.round((targetHeight - wmHeight) / 2 - 30 * scale);
            ctx.drawImage(logoImg, wmX, wmY, wmWidth, wmHeight);
        }
        ctx.font = `700 ${Math.round(28 * scale)}px Montserrat, Poppins, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 6;
        ctx.fillText('RSI ENTERPRISE • EVIDENCIA CERTIFICADA', targetWidth / 2, targetHeight / 2 + Math.round(60 * scale));
        ctx.restore();

        // 3. Insignia superior derecha con la Etapa (ANTES / DURANTE / DESPUÉS) y Folio
        ctx.save();
        const badgePaddingX = Math.round(18 * scale);
        const badgeHeight = Math.round(42 * scale);
        const badgeText = `${idTicket}  |  ETAPA: ${etapaLabel}`;
        ctx.font = `700 ${Math.round(17 * scale)}px Montserrat, Poppins, sans-serif`;
        const textWidth = ctx.measureText(badgeText).width;
        const badgeWidth = textWidth + badgePaddingX * 2;
        const badgeX = targetWidth - badgeWidth - Math.round(20 * scale);
        const badgeY = Math.round(20 * scale);

        ctx.fillStyle = 'rgba(28, 25, 72, 0.88)';
        this._roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, Math.round(8 * scale));
        ctx.fill();

        ctx.lineWidth = Math.max(2, Math.round(2.5 * scale));
        ctx.strokeStyle = etapaAccentColor;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + badgePaddingX, badgeY + badgeHeight / 2);
        ctx.restore();

        // 4. Franja inferior oscura con Logo oficial, Fecha, Hora, Ubicación GPS y Colaborador
        ctx.save();
        const bannerHeight = Math.round(128 * scale);
        const bannerY = targetHeight - bannerHeight;

        const grad = ctx.createLinearGradient(0, bannerY - Math.round(24 * scale), 0, targetHeight);
        grad.addColorStop(0, 'rgba(19, 16, 58, 0)');
        grad.addColorStop(0.2, 'rgba(19, 16, 58, 0.86)');
        grad.addColorStop(1, 'rgba(10, 10, 26, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, bannerY - Math.round(24 * scale), targetWidth, bannerHeight + Math.round(24 * scale));

        // Línea divisoria dorada en el borde superior del banner
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = Math.max(2, Math.round(2 * scale));
        ctx.beginPath();
        ctx.moveTo(Math.round(20 * scale), bannerY);
        ctx.lineTo(targetWidth - Math.round(20 * scale), bannerY);
        ctx.stroke();

        let textStartX = Math.round(24 * scale);

        // Dibujar Logo de la empresa en la esquina inferior izquierda dentro de contenedor claro
        if (logoImg) {
            const boxSize = Math.round(86 * scale);
            const boxX = Math.round(22 * scale);
            const boxY = bannerY + Math.round((bannerHeight - boxSize) / 2);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            this._roundRect(ctx, boxX, boxY, boxSize, boxSize, Math.round(10 * scale));
            ctx.fill();

            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = Math.max(1.5, Math.round(1.5 * scale));
            ctx.stroke();

            const maxLogoW = boxSize - Math.round(14 * scale);
            const maxLogoH = boxSize - Math.round(14 * scale);
            const ratio = Math.min(
                maxLogoW / (logoImg.naturalWidth || 1),
                maxLogoH / (logoImg.naturalHeight || 1)
            );
            const drawW = Math.round((logoImg.naturalWidth || 1) * ratio);
            const drawH = Math.round((logoImg.naturalHeight || 1) * ratio);
            const drawX = boxX + Math.round((boxSize - drawW) / 2);
            const drawY = boxY + Math.round((boxSize - drawH) / 2);

            ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
            textStartX = boxX + boxSize + Math.round(18 * scale);
        }

        // Construir texto de ubicación GPS
        let ubicacionTexto = 'Ubicación GPS: Sin coordenadas disponibles';
        if (ubicacion && typeof ubicacion.latitud === 'number' && typeof ubicacion.longitud === 'number') {
            const latStr = ubicacion.latitud.toFixed(6);
            const lngStr = ubicacion.longitud.toFixed(6);
            const precStr = ubicacion.precision ? ` (±${ubicacion.precision}m)` : '';
            ubicacionTexto = `Ubicación GPS: Lat ${latStr}, Lng ${lngStr}${precStr}`;
        } else if (ubicacion && ubicacion.mensaje) {
            ubicacionTexto = `Ubicación GPS: ${ubicacion.mensaje}`;
        }

        const line1Y = bannerY + Math.round(28 * scale);
        const line2Y = bannerY + Math.round(54 * scale);
        const line3Y = bannerY + Math.round(80 * scale);
        const line4Y = bannerY + Math.round(105 * scale);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Línea 1: Empresa + Folio + Etapa
        ctx.font = `700 ${Math.round(17 * scale)}px Montserrat, Poppins, sans-serif`;
        ctx.fillStyle = '#f2d06b';
        ctx.fillText(`RSI ENTERPRISE  •  ${idTicket}  •  EVIDENCIA ${etapaLabel}`, textStartX, line1Y);

        // Línea 2: Fecha y Hora oficial
        ctx.font = `600 ${Math.round(15 * scale)}px Poppins, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Fecha y Hora: ${fechaHora.fecha}  |  ${fechaHora.hora} hrs (CDMX)`, textStartX, line2Y);

        // Línea 3: Coordenadas de Ubicación
        ctx.font = `500 ${Math.round(14.5 * scale)}px Poppins, sans-serif`;
        ctx.fillStyle = '#e9ecef';
        ctx.fillText(ubicacionTexto, textStartX, line3Y);

        // Línea 4: Colaborador
        ctx.font = `500 ${Math.round(13.5 * scale)}px Poppins, sans-serif`;
        ctx.fillStyle = '#ced4da';
        ctx.fillText(`Colaborador: ${colaboradorNombre}`, textStartX, line4Y);

        ctx.restore();

        // 5. Exportar a Blob JPEG optimizado para Firebase Storage
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (resultBlob) => {
                    if (resultBlob) {
                        resolve(resultBlob);
                    } else {
                        reject(new Error('No fue posible generar el archivo de imagen con marca de agua.'));
                    }
                },
                'image/jpeg',
                0.88
            );
        });

        const previewUrl = URL.createObjectURL(blob);

        return {
            blob,
            previewUrl,
            fechaHora,
            ubicacion: ubicacion ? {
                latitud: ubicacion.latitud ?? null,
                longitud: ubicacion.longitud ?? null,
                precision: ubicacion.precision ?? null,
                estadoCaptura: ubicacion.estadoCaptura || 'ok',
                mensaje: ubicacion.mensaje || ''
            } : null
        };
    }

    /**
     * Dibuja un rectángulo con bordes redondeados compatible con todos los navegadores
     */
    static _roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }
}

export default TicketWatermarkHelper;
