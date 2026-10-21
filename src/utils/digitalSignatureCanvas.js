/* ========================================
   DIGITAL SIGNATURE CANVAS - RSI ENTERPRISE
   Lienzo interactivo para captura de firma electrónica manuscrita
   Soporte táctil (Touch) y puntero de ratón con prevención de scroll
   ======================================== */

export class DigitalSignatureCanvas {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options]
     */
    constructor(canvas, options = {}) {
        if (!canvas) {
            throw new Error('Se requiere un elemento HTMLCanvasElement válido.');
        }

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            strokeColor: options.strokeColor || '#0F172A',
            lineWidth: options.lineWidth || 2.5,
            backgroundColor: options.backgroundColor || '#FFFFFF',
            minDistance: options.minDistance || 2,
            ...options
        };

        this.isDrawing = false;
        this.hasDrawn = false;
        this.lastX = 0;
        this.lastY = 0;

        this._initCanvas();
        this._bindEvents();
    }

    /**
     * Configura el contexto y dimensiones del canvas
     */
    _initCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        // Si el canvas tiene ancho calculado de CSS, asegurar resolución adecuada
        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.scale(dpr, dpr);
            this.cssWidth = rect.width;
            this.cssHeight = rect.height;
        } else {
            this.cssWidth = this.canvas.width;
            this.cssHeight = this.canvas.height;
        }

        this.clear();
    }

    /**
     * Asocia eventos de dibujo para ratón y dispositivos táctiles
     */
    _bindEvents() {
        // Enlazar listeners para poder removerlos en cleanup
        this._onMouseDown = this._handlePointerStart.bind(this);
        this._onMouseMove = this._handlePointerMove.bind(this);
        this._onMouseUp = this._handlePointerEnd.bind(this);
        this._onTouchStart = this._handleTouchStart.bind(this);
        this._onTouchMove = this._handleTouchMove.bind(this);
        this._onTouchEnd = this._handleTouchEnd.bind(this);

        this.canvas.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);

        this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        window.addEventListener('touchmove', this._onTouchMove, { passive: false });
        window.addEventListener('touchend', this._onTouchEnd, { passive: false });
    }

    /**
     * Obtiene coordenadas relativas al canvas
     */
    _getCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    _handlePointerStart(e) {
        if (e.button !== 0) return; // Solo clic izquierdo
        const { x, y } = this._getCoordinates(e.clientX, e.clientY);
        this._startDrawing(x, y);
    }

    _handlePointerMove(e) {
        if (!this.isDrawing) return;
        const { x, y } = this._getCoordinates(e.clientX, e.clientY);
        this._draw(x, y);
    }

    _handlePointerEnd() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
    }

    _handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault(); // Evitar scroll de página al dibujar
        const touch = e.touches[0];
        const { x, y } = this._getCoordinates(touch.clientX, touch.clientY);
        this._startDrawing(x, y);
    }

    _handleTouchMove(e) {
        if (!this.isDrawing || e.touches.length !== 1) return;
        e.preventDefault(); // Evitar scroll
        const touch = e.touches[0];
        const { x, y } = this._getCoordinates(touch.clientX, touch.clientY);
        this._draw(x, y);
    }

    _handleTouchEnd(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        this.isDrawing = false;
    }

    _startDrawing(x, y) {
        this.isDrawing = true;
        this.lastX = x;
        this.lastY = y;
        
        // Dibujar un punto en caso de un solo toque
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.options.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.options.strokeColor;
        this.ctx.fill();
        this.hasDrawn = true;
    }

    _draw(x, y) {
        const dist = Math.hypot(x - this.lastX, y - this.lastY);
        if (dist < this.options.minDistance) return;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = this.options.strokeColor;
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();

        this.lastX = x;
        this.lastY = y;
        this.hasDrawn = true;
    }

    /**
     * Limpia completamente el lienzo y rellena con el fondo
     */
    clear() {
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, this.cssWidth || this.canvas.width, this.cssHeight || this.canvas.height);
        this.hasDrawn = false;
    }

    /**
     * Verifica si el lienzo está en blanco mediante inspección de píxeles
     * @returns {boolean}
     */
    isEmpty() {
        if (!this.hasDrawn) return true;

        try {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const imgData = this.ctx.getImageData(0, 0, w, h).data;

            // Comparar si algún píxel difiere sustancialmente del fondo blanco
            for (let i = 0; i < imgData.length; i += 16) {
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];
                // Si no es blanco puro
                if (r < 240 || g < 240 || b < 240) {
                    return false;
                }
            }
            return true;
        } catch {
            return !this.hasDrawn;
        }
    }

    /**
     * Exporta la firma como Blob PNG
     * @returns {Promise<Blob>}
     */
    toBlob() {
        return new Promise((resolve, reject) => {
            if (this.isEmpty()) {
                reject(new Error('El lienzo de firma se encuentra en blanco.'));
                return;
            }
            this.canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('No se pudo generar el archivo de firma.'));
                }
            }, 'image/png');
        });
    }

    /**
     * Exporta la firma como cadena base64 DataURL
     * @returns {string}
     */
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Libera listeners de eventos del DOM
     */
    destroy() {
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);

        this.canvas.removeEventListener('touchstart', this._onTouchStart);
        window.removeEventListener('touchmove', this._onTouchMove);
        window.removeEventListener('touchend', this._onTouchEnd);
    }
}

export default DigitalSignatureCanvas;
