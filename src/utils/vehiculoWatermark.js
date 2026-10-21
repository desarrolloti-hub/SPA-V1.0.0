/* ========================================
   VEHICULO WATERMARK & CAMERA HELPER - RSI ENTERPRISE
   Estampado de marca de agua institucional (Logo, Fecha, Hora, GPS y Datos de Vehículo)
   sobre fotografías de inspección vehicular y control de salidas
   ======================================== */

export class VehiculoWatermarkHelper {
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
                console.warn('⚠️ No se pudo cargar el logo institucional en:', this.LOGO_SRC);
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
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No fue posible procesar el archivo de imagen de la inspección vehicular.'));
            };
            img.src = url;
        });
    }

    /**
     * Formatea fecha y hora en zona horaria America/Mexico_City
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
     * Procesa una imagen y estampa la marca de agua con datos del vehículo
     * @param {Object} params
     * @param {File|Blob|HTMLVideoElement} params.source
     * @param {string} params.placas
     * @param {string} params.numeroEconomico
     * @param {string} params.categoriaLabel
     * @param {string} params.colaboradorNombre
     * @param {Object|null} params.ubicacion
     * @returns {Promise<{ blob: Blob, dataUrl: string, fechaHora: Object }>}
     */
    static async estamparMarcaDeAgua({
        source,
        placas = '',
        numeroEconomico = '',
        categoriaLabel = 'Inspección',
        colaboradorNombre = 'Inspector',
        ubicacion = null
    }) {
        let imgWidth, imgHeight, drawSource;

        if (source instanceof HTMLVideoElement) {
            imgWidth = source.videoWidth || 1280;
            imgHeight = source.videoHeight || 720;
            drawSource = source;
        } else {
            const imgEl = await this._loadImageFromBlob(source);
            imgWidth = imgEl.naturalWidth || imgEl.width;
            imgHeight = imgEl.naturalHeight || imgEl.height;
            drawSource = imgEl;
        }

        const canvas = document.createElement('canvas');
        canvas.width = imgWidth;
        canvas.height = imgHeight;
        const ctx = canvas.getContext('2d');

        // Dibujar imagen original
        ctx.drawImage(drawSource, 0, 0, imgWidth, imgHeight);

        // Barra inferior para marca de agua
        const bannerHeight = Math.max(90, Math.round(imgHeight * 0.16));
        const bannerY = imgHeight - bannerHeight;

        // Fondo semitransparente oscuro con degradado
        const gradient = ctx.createLinearGradient(0, bannerY, 0, imgHeight);
        gradient.addColorStop(0, 'rgba(10, 15, 25, 0.88)');
        gradient.addColorStop(1, 'rgba(5, 8, 15, 0.98)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, bannerY, imgWidth, bannerHeight);

        // Línea dorada superior
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(0, bannerY, imgWidth, Math.max(3, Math.round(imgHeight * 0.005)));

        // Dibujar logo institucional a la izquierda
        const logo = await this._loadLogo();
        let textStartX = 20;

        if (logo) {
            const logoMaxH = bannerHeight * 0.72;
            const logoRatio = (logo.naturalWidth || 1) / (logo.naturalHeight || 1);
            const logoW = logoMaxH * logoRatio;
            const logoY = bannerY + (bannerHeight - logoMaxH) / 2;
            ctx.drawImage(logo, 20, logoY, logoW, logoMaxH);
            textStartX = 20 + logoW + 20;
        }

        // Metadatos de fecha y hora
        const fechaHora = this.formatFechaHoraCDMX();
        const fontSize = Math.max(13, Math.round(bannerHeight * 0.17));
        const lineHeight = fontSize * 1.35;
        let currentY = bannerY + (bannerHeight - (lineHeight * 3.5)) / 2 + fontSize;

        ctx.font = `bold ${fontSize + 1}px sans-serif`;
        ctx.fillStyle = '#D4AF37';
        ctx.fillText(`RSI ENTERPRISE — INSPECCIÓN VEHICULAR`, textStartX, currentY);

        currentY += lineHeight;
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        const vehiculoText = `No. Eco: ${numeroEconomico || 'S/N'} | Placas: ${placas || 'S/P'} | ${categoriaLabel}`;
        ctx.fillText(vehiculoText, textStartX, currentY);

        currentY += lineHeight;
        ctx.font = `normal ${fontSize - 1}px sans-serif`;
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText(`Inspector: ${colaboradorNombre} | ${fechaHora.completo}`, textStartX, currentY);

        // Coordenadas GPS
        currentY += lineHeight;
        ctx.font = `italic ${fontSize - 2}px sans-serif`;
        if (ubicacion && ubicacion.latitud && ubicacion.longitud) {
            ctx.fillStyle = '#38BDF8';
            const prec = ubicacion.precision ? ` (±${Math.round(ubicacion.precision)}m)` : '';
            ctx.fillText(`📍 GPS: ${ubicacion.latitud.toFixed(6)}, ${ubicacion.longitud.toFixed(6)}${prec}`, textStartX, currentY);
        } else {
            ctx.fillStyle = '#94A3B8';
            ctx.fillText(`📍 Ubicación no disponible al momento de la captura`, textStartX, currentY);
        }

        // Exportar como Blob JPEG y DataURL
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
                resolve({
                    blob,
                    dataUrl,
                    fechaHora
                });
            }, 'image/jpeg', 0.90);
        });
    }
}

export default VehiculoWatermarkHelper;
