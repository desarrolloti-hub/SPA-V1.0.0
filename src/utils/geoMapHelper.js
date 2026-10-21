/* ========================================
   GEOLOCATION & GOOGLE MAPS HELPER - RSI ENTERPRISE
   Gestión de coordenadas, precisión y visualización en mapas
   ======================================== */

export class GeoMapHelper {
    /**
     * Obtiene la posición geográfica actual del dispositivo
     * @param {Object} options - Opciones de geolocalización
     * @returns {Promise<{
     *   exito: boolean,
     *   latitud: number|null,
     *   longitud: number|null,
     *   precision: number|null,
     *   timestamp: string,
     *   estadoCaptura: string,
     *   metodo: string,
     *   mensaje: string
     * }>}
     */
    static async obtenerPosicionActual(options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }) {
        const timestampCaptura = new Date().toISOString();

        if (typeof window === 'undefined' || !('geolocation' in navigator)) {
            return {
                exito: false,
                latitud: null,
                longitud: null,
                precision: null,
                timestamp: timestampCaptura,
                estadoCaptura: 'no_soportado',
                metodo: 'geolocalizacion_navegador',
                mensaje: 'La geolocalización no está soportada en este navegador o dispositivo.'
            };
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        exito: true,
                        latitud: pos.coords.latitude,
                        longitud: pos.coords.longitude,
                        precision: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
                        timestamp: timestampCaptura,
                        estadoCaptura: 'ok',
                        metodo: 'geolocalizacion_navegador',
                        mensaje: `Ubicación capturada con precisión de ±${Math.round(pos.coords.accuracy || 0)}m`
                    });
                },
                (err) => {
                    let estadoCaptura = 'error';
                    let mensaje = 'No fue posible determinar la ubicación del dispositivo.';

                    switch (err.code) {
                        case err.PERMISSION_DENIED:
                            estadoCaptura = 'denegado';
                            mensaje = 'Permiso de ubicación denegado por el usuario o navegador.';
                            break;
                        case err.POSITION_UNAVAILABLE:
                            estadoCaptura = 'no_disponible';
                            mensaje = 'Información de ubicación no disponible en el dispositivo.';
                            break;
                        case err.TIMEOUT:
                            estadoCaptura = 'tiempo_agotado';
                            mensaje = 'Tiempo de espera agotado al consultar la ubicación.';
                            break;
                        default:
                            estadoCaptura = 'error';
                            mensaje = err.message || 'Error desconocido al obtener ubicación.';
                    }

                    resolve({
                        exito: false,
                        latitud: null,
                        longitud: null,
                        precision: null,
                        timestamp: timestampCaptura,
                        estadoCaptura,
                        metodo: 'geolocalizacion_navegador',
                        mensaje
                    });
                },
                options
            );
        });
    }

    /**
     * Genera la URL de Google Maps para consulta externa
     */
    static getGoogleMapsUrl(latitud, longitud) {
        if (!latitud || !longitud) return null;
        return `https://www.google.com/maps?q=${latitud},${longitud}`;
    }

    /**
     * Genera la URL para iframe embed seguro de Google Maps
     */
    static getGoogleMapsEmbedUrl(latitud, longitud) {
        if (!latitud || !longitud) return null;
        return `https://maps.google.com/maps?q=${latitud},${longitud}&z=16&output=embed`;
    }

    /**
     * Muestra un modal con el mapa de la ubicación registrada
     * @param {Object} ubicacion - Objeto con latitud, longitud, precision, etc.
     * @param {string} titulo - Título descriptivo (ej: "Ubicación de Entrada")
     * @param {string} subtitulo - Subtítulo descriptivo (ej: "Juan Pérez - 15/10/2026 09:02")
     */
    static mostrarModalMapa(ubicacion, titulo = 'Ubicación Registrada', subtitulo = '') {
        if (!ubicacion || !ubicacion.latitud || !ubicacion.longitud) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'Ubicación no disponible',
                    text: ubicacion?.errorMensaje || 'No se registraron coordenadas para este evento de asistencia.',
                    confirmButtonColor: '#1c1948'
                });
            }
            return;
        }

        const { latitud, longitud, precision, timestamp, metodo, estadoCaptura } = ubicacion;
        const mapsUrl = this.getGoogleMapsUrl(latitud, longitud);
        const embedUrl = this.getGoogleMapsEmbedUrl(latitud, longitud);

        const fechaFormateada = timestamp ? new Date(timestamp).toLocaleString('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'medium'
        }) : 'No disponible';

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: `<span style="font-size: 1.15rem; font-weight: 600;"><i class="fas fa-map-marker-alt" style="color: #d4af37; margin-right: 8px;"></i>${titulo}</span>`,
                html: `
                    <div style="text-align: left; font-size: 0.9rem; margin-bottom: 12px; color: #495057;">
                        ${subtitulo ? `<div style="font-weight: 600; margin-bottom: 6px;">${subtitulo}</div>` : ''}
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                            <span class="rsi-badge" style="background:#e9ecef; color:#1c1948; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem;">
                                <i class="fas fa-crosshairs"></i> Lat: ${latitud.toFixed(6)}, Lng: ${longitud.toFixed(6)}
                            </span>
                            ${precision ? `
                                <span class="rsi-badge" style="background:#d4edda; color:#155724; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem;">
                                    <i class="fas fa-bullseye"></i> Precisión: ±${precision}m
                                </span>
                            ` : ''}
                            <span class="rsi-badge" style="background:#d1ecf1; color:#0c5460; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem;">
                                <i class="fas fa-clock"></i> ${fechaFormateada}
                            </span>
                        </div>
                    </div>
                    <div style="width: 100%; height: 320px; border-radius: 8px; overflow: hidden; border: 1px solid #ced4da; background: #f8f9fa; position: relative;">
                        <iframe 
                            src="${embedUrl}" 
                            width="100%" 
                            height="100%" 
                            style="border: 0;" 
                            allowfullscreen="" 
                            loading="lazy" 
                            referrerpolicy="no-referrer-when-downgrade"
                            title="Mapa de ubicación">
                        </iframe>
                    </div>
                `,
                width: '640px',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-external-link-alt"></i> Abrir en Google Maps',
                cancelButtonText: 'Cerrar',
                confirmButtonColor: '#1c1948',
                cancelButtonColor: '#6c757d'
            }).then((result) => {
                if (result.isConfirmed && mapsUrl) {
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                }
            });
        }
    }
}

export default GeoMapHelper;
