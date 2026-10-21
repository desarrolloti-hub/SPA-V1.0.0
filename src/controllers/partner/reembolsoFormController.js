/* ========================================
   REEMBOLSO FORM CONTROLLER - RSI ENTERPRISE
   Controlador para la vista de solicitud de Reembolso Propio (/partner/reembolso)
   Captura monto, categoría, fecha, modalidad (total o parcial),
   motivo y evidencia fotográfica con previsualización y zoom.
   ======================================== */

import ReembolsoService from '../../services/reembolsoService.js';
import AuthService from '../../services/authService.js';
import ImageZoom from '../../utils/imageZoom.js';
import { ReembolsoModel, CATEGORIAS_REEMBOLSO, TIPOS_DEVOLUCION } from '../../models/reembolsoModel.js';

let service = null;
let authService = null;
let eventListeners = [];
let archivoEvidenciaSeleccionado = null;
let previewObjectUrl = null;

export async function reembolsoFormController() {
    console.log('💸 Inicializando Reembolso Form Controller (Reembolso Propio)...');

    cleanup();

    service = new ReembolsoService();
    authService = new AuthService();

    const session = authService.getSession();
    if (!session || !session.uid) {
        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/login?returnUrl=/partner/reembolso');
        } else {
            window.location.href = '/login?returnUrl=/partner/reembolso';
        }
        return;
    }

    await inicializarDatosSolicitante(session);
    inicializarValoresPorDefecto();
    bindEvents();
    actualizarResumenEnVivo();

    console.log('✅ Reembolso Form Controller listo.');
}

function addListener(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    eventListeners.push({ element, event, handler });
}

function formatearMoneda(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

async function inicializarDatosSolicitante(session) {
    const avatarEl = document.getElementById('rmbSolicitanteAvatar');
    const nombreEl = document.getElementById('rmbSolicitanteNombre');
    const areaEl = document.getElementById('rmbSolicitanteArea');
    const emailEl = document.getElementById('rmbSolicitanteEmail');

    const perfil = await service._obtenerPerfilColaborador(session.uid, session);

    if (nombreEl) nombreEl.textContent = perfil.nombre;
    if (areaEl) areaEl.innerHTML = `<i class="fas fa-sitemap"></i> ${perfil.area}`;
    if (emailEl) emailEl.innerHTML = `<i class="fas fa-envelope"></i> ${perfil.email || 'Sin correo'}`;
    if (avatarEl && perfil.foto) {
        avatarEl.src = perfil.foto;
    }
}

function inicializarValoresPorDefecto() {
    const fechaInput = document.getElementById('rmbFechaGasto');
    const fechaHoy = ReembolsoModel.getCurrentDateString();
    if (fechaInput) {
        fechaInput.value = fechaHoy;
        fechaInput.max = fechaHoy;
    }
}

function bindEvents() {
    const inputMonto = document.getElementById('rmbMontoSolicitado');
    const inputFecha = document.getElementById('rmbFechaGasto');
    const selectCategoria = document.getElementById('rmbCategoria');
    const inputMotivo = document.getElementById('rmbMotivo');
    const radiosModalidad = document.querySelectorAll('input[name="modalidadSolicitada"]');

    addListener(inputMonto, 'input', actualizarResumenEnVivo);
    addListener(inputFecha, 'change', actualizarResumenEnVivo);
    addListener(selectCategoria, 'change', actualizarResumenEnVivo);

    addListener(inputMotivo, 'input', () => {
        const countEl = document.getElementById('rmbMotivoCount');
        if (countEl) {
            countEl.textContent = (inputMotivo.value || '').length;
        }
    });

    radiosModalidad.forEach(radio => {
        addListener(radio, 'change', () => {
            document.getElementById('cardModeTotal')?.classList.toggle('active', radio.value === 'total' && radio.checked);
            document.getElementById('cardModeParcial')?.classList.toggle('active', radio.value === 'parcial' && radio.checked);
            actualizarResumenEnVivo();
        });
    });

    // Botones de cámara y galería
    const btnCamara = document.getElementById('btnCamaraReembolsoPropio');
    const btnGaleria = document.getElementById('btnGaleriaReembolsoPropio');
    const inputCamara = document.getElementById('inputCamaraReembolsoPropio');
    const inputArchivo = document.getElementById('inputArchivoReembolsoPropio');
    const dropzone = document.getElementById('dropzoneReembolsoPropio');
    const btnQuitarEvidencia = document.getElementById('btnQuitarEvidenciaPropio');

    addListener(btnCamara, 'click', () => inputCamara?.click());
    addListener(btnGaleria, 'click', () => inputArchivo?.click());
    addListener(dropzone, 'click', () => inputArchivo?.click());

    addListener(inputCamara, 'change', (e) => {
        if (e.target.files && e.target.files[0]) {
            procesarArchivoEvidencia(e.target.files[0]);
        }
    });

    addListener(inputArchivo, 'change', (e) => {
        if (e.target.files && e.target.files[0]) {
            procesarArchivoEvidencia(e.target.files[0]);
        }
    });

    if (dropzone) {
        addListener(dropzone, 'dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        addListener(dropzone, 'dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        addListener(dropzone, 'drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                procesarArchivoEvidencia(e.dataTransfer.files[0]);
            }
        });
    }

    addListener(btnQuitarEvidencia, 'click', limpiarArchivoEvidencia);

    const form = document.getElementById('formReembolsoPropio');
    addListener(form, 'submit', handleSubmitReembolsoPropio);
}

function procesarArchivoEvidencia(file) {
    if (!file) return;

    const validacion = ReembolsoModel.validateArchivoEvidencia(file, { allowPdf: true });
    if (!validacion.valid) {
        Swal.fire({
            icon: 'warning',
            title: 'Archivo no válido',
            text: validacion.error,
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    archivoEvidenciaSeleccionado = file;

    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    const previewContainer = document.getElementById('previewContainerReembolsoPropio');
    const previewNombre = document.getElementById('previewNombreReembolsoPropio');
    const previewTamano = document.getElementById('previewTamanoReembolsoPropio');
    const previewBody = document.getElementById('previewBodyReembolsoPropio');

    if (previewNombre) previewNombre.textContent = file.name || 'evidencia_fotografica.jpg';
    if (previewTamano) previewTamano.textContent = `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`;

    if (previewBody) {
        previewBody.innerHTML = '';
        if (file.type.startsWith('image/')) {
            previewObjectUrl = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.src = previewObjectUrl;
            img.alt = 'Evidencia fotográfica del reembolso';
            img.className = 'rsi-reembolso-preview-img';
            previewBody.appendChild(img);

            if (ImageZoom && typeof ImageZoom.attachToContainer === 'function') {
                ImageZoom.attachToContainer(previewBody);
            }
        } else {
            previewBody.innerHTML = `
                <div class="rsi-pdf-preview-badge">
                    <i class="fas fa-file-pdf" style="font-size: 2rem; color: #dc3545;"></i>
                    <span>Documento PDF listo para adjuntar (${file.name})</span>
                </div>
            `;
        }
    }

    if (previewContainer) {
        previewContainer.style.display = 'block';
    }

    actualizarResumenEnVivo();
}

function limpiarArchivoEvidencia() {
    archivoEvidenciaSeleccionado = null;
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    const inputCamara = document.getElementById('inputCamaraReembolsoPropio');
    const inputArchivo = document.getElementById('inputArchivoReembolsoPropio');
    const previewContainer = document.getElementById('previewContainerReembolsoPropio');
    const previewBody = document.getElementById('previewBodyReembolsoPropio');

    if (inputCamara) inputCamara.value = '';
    if (inputArchivo) inputArchivo.value = '';
    if (previewBody) previewBody.innerHTML = '';
    if (previewContainer) previewContainer.style.display = 'none';

    actualizarResumenEnVivo();
}

function actualizarResumenEnVivo() {
    const montoVal = document.getElementById('rmbMontoSolicitado')?.value || 0;
    const catVal = document.getElementById('rmbCategoria')?.value || 'viaticos_transporte';
    const fechaVal = document.getElementById('rmbFechaGasto')?.value || '--';
    const modRadio = document.querySelector('input[name="modalidadSolicitada"]:checked');
    const modalidadVal = modRadio ? modRadio.value : TIPOS_DEVOLUCION.TOTAL;

    const elMonto = document.getElementById('resumenMontoVivo');
    const elCat = document.getElementById('resumenCategoriaVivo');
    const elFecha = document.getElementById('resumenFechaVivo');
    const elMod = document.getElementById('resumenModalidadVivo');
    const elEvid = document.getElementById('resumenEvidenciaVivo');

    if (elMonto) elMonto.textContent = `${formatearMoneda(montoVal)} MXN`;
    if (elCat) elCat.textContent = CATEGORIAS_REEMBOLSO[catVal] || 'Otro Concepto';
    if (elFecha) elFecha.textContent = fechaVal;
    if (elMod) {
        elMod.textContent = modalidadVal === TIPOS_DEVOLUCION.PARCIAL
            ? 'Abierto a Devolución Parcial (Abonos)'
            : 'Devolución Total (100%)';
    }
    if (elEvid) {
        if (archivoEvidenciaSeleccionado) {
            elEvid.textContent = 'Lista para enviar';
            elEvid.className = 'rsi-text-success';
        } else {
            elEvid.textContent = 'Pendiente de adjuntar';
            elEvid.className = 'rsi-text-danger';
        }
    }
}

async function handleSubmitReembolsoPropio(e) {
    e.preventDefault();

    const montoSolicitado = Number(document.getElementById('rmbMontoSolicitado')?.value || 0);
    const fechaGasto = document.getElementById('rmbFechaGasto')?.value || '';
    const categoria = document.getElementById('rmbCategoria')?.value || 'viaticos_transporte';
    const referenciaComprobante = document.getElementById('rmbReferencia')?.value || '';
    const motivo = (document.getElementById('rmbMotivo')?.value || '').trim();
    const modRadio = document.querySelector('input[name="modalidadSolicitada"]:checked');
    const modalidadSolicitada = modRadio ? modRadio.value : TIPOS_DEVOLUCION.TOTAL;

    if (!montoSolicitado || montoSolicitado <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Monto requerido',
            text: 'Por favor ingresa un monto válido mayor a $0.00 MXN.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    if (motivo.length < 5) {
        Swal.fire({
            icon: 'warning',
            title: 'Motivo requerido',
            text: 'Explica detalladamente el motivo del reembolso (mínimo 5 caracteres).',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    if (!archivoEvidenciaSeleccionado) {
        Swal.fire({
            icon: 'warning',
            title: 'Evidencia fotográfica obligatoria',
            text: 'Debes tomar una fotografía o adjuntar la imagen del comprobante/gasto para registrar tu reembolso.',
            confirmButtonColor: '#1c1948'
        });
        return;
    }

    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar solicitud de reembolso?',
        html: `
            <div style="text-align: left; font-size: 0.92rem; line-height: 1.6;">
                <p style="margin: 4px 0;"><strong>Monto Solicitado:</strong> ${formatearMoneda(montoSolicitado)} MXN</p>
                <p style="margin: 4px 0;"><strong>Categoría:</strong> ${CATEGORIAS_REEMBOLSO[categoria] || categoria}</p>
                <p style="margin: 4px 0;"><strong>Modalidad:</strong> ${modalidadSolicitada === 'parcial' ? 'Abierto a Devolución Parcial' : 'Devolución Total'}</p>
                <p style="margin: 4px 0;"><strong>Motivo:</strong> ${motivo}</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Sí, registrar reembolso',
        cancelButtonText: 'Revisar datos',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmacion.isConfirmed) return;

    const btnSubmit = document.getElementById('btnGuardarReembolsoPropio');
    if (btnSubmit) btnSubmit.disabled = true;

    Swal.fire({
        title: 'Registrando tu reembolso...',
        text: 'Subiendo evidencia fotográfica y generando folio...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await service.crearMiReembolso({
            montoSolicitado,
            categoria,
            fechaGasto,
            motivo,
            referenciaComprobante,
            modalidadSolicitada,
            archivoEvidencia: archivoEvidenciaSeleccionado
        });

        if (res.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Reembolso Registrado!',
                text: res.message,
                confirmButtonColor: '#1c1948'
            });

            if (typeof window.navigateTo === 'function') {
                await window.navigateTo('/partner/reembolsos');
            } else {
                window.location.href = '/partner/reembolsos';
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar el reembolso',
                text: res.error || 'Ocurrió un error al guardar tu solicitud.',
                confirmButtonColor: '#1c1948'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: error.message || 'Error de conexión al guardar el reembolso.',
            confirmButtonColor: '#1c1948'
        });
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

function cleanup() {
    eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    eventListeners = [];
    archivoEvidenciaSeleccionado = null;
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
}

export default reembolsoFormController;
