/* ========================================
   VEHICULO FORM CONTROLLER - RSI ENTERPRISE
   Controlador independiente para alta y edición de automóviles con fotografía
   ======================================== */

import VehiculoService from '../../services/vehiculoService.js';

export class VehiculoFormController {
    constructor() {
        this.service = new VehiculoService();
        this.vehiculoId = null;
        this.selectedImageFile = null;
        this.existingImageUrl = null;
        this.eliminarImagenFlag = false;
    }

    async init() {
        console.log('🚗 Inicializando VehiculoFormController...');
        this.cacheDOM();

        const params = new URLSearchParams(window.location.search);
        this.vehiculoId = params.get('id');

        this.bindEvents();

        if (this.vehiculoId) {
            await this.cargarVehiculoParaEdicion(this.vehiculoId);
        } else {
            this.inicializarModoNuevo();
        }
    }

    cacheDOM() {
        this.dom = {
            form: document.getElementById('formVehiculoIndependiente'),
            editIdInput: document.getElementById('editVehiculoId'),
            txtAccionTitulo: document.getElementById('txtAccionTitulo'),
            pageSubtitleVehiculo: document.getElementById('pageSubtitleVehiculo'),
            badgeModoForm: document.getElementById('badgeModoForm'),
            stepHeaderTitle: document.getElementById('stepHeaderTitle'),
            btnGuardar: document.getElementById('btnGuardarVehiculo'),
            // Inputs
            inputNumEco: document.getElementById('inputNumeroEconomico'),
            inputPlacas: document.getElementById('inputPlacas'),
            inputMarca: document.getElementById('inputMarca'),
            inputModelo: document.getElementById('inputModelo'),
            inputAnio: document.getElementById('inputAnio'),
            inputColor: document.getElementById('inputColor'),
            inputSerie: document.getElementById('inputNumeroSerie'),
            inputTipo: document.getElementById('inputTipoVehiculo'),
            inputKm: document.getElementById('inputKilometraje'),
            inputCombustible: document.getElementById('inputCombustible'),
            selectEstado: document.getElementById('selectEstadoOperativo'),
            inputObservaciones: document.getElementById('inputObservaciones'),
            // Uploader Fotografía
            dropzone: document.getElementById('vehiculoPhotoDropzone'),
            inputFile: document.getElementById('inputVehiculoFoto'),
            btnExplorar: document.getElementById('btnExplorarFoto'),
            btnCambiar: document.getElementById('btnCambiarFoto'),
            btnEliminar: document.getElementById('btnEliminarFoto'),
            emptyState: document.getElementById('dropzoneEmptyState'),
            previewState: document.getElementById('dropzonePreviewState'),
            imgPreview: document.getElementById('imgPreviewVehiculo')
        };
    }

    bindEvents() {
        // Form submit
        if (this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Click en zona o botón explorar para abrir selector de archivo
        if (this.dom.btnExplorar && this.dom.inputFile) {
            this.dom.btnExplorar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dom.inputFile.click();
            });
        }

        if (this.dom.btnCambiar && this.dom.inputFile) {
            this.dom.btnCambiar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dom.inputFile.click();
            });
        }

        if (this.dom.dropzone && this.dom.inputFile) {
            this.dom.dropzone.addEventListener('click', (e) => {
                // Solo si no se hizo clic en botones internos
                if (!e.target.closest('button')) {
                    this.dom.inputFile.click();
                }
            });

            // Drag and drop events
            ['dragenter', 'dragover'].forEach(eventName => {
                this.dom.dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dom.dropzone.style.borderColor = 'var(--rsi-primary)';
                    this.dom.dropzone.style.background = 'rgba(212, 175, 55, 0.05)';
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                this.dom.dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dom.dropzone.style.borderColor = 'var(--rsi-border-color)';
                    this.dom.dropzone.style.background = 'var(--rsi-bg-card)';
                });
            });

            this.dom.dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.procesarArchivoSeleccionado(files[0]);
                }
            });
        }

        // Cambio en input file
        if (this.dom.inputFile) {
            this.dom.inputFile.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.procesarArchivoSeleccionado(files[0]);
                }
            });
        }

        // Quitar fotografía
        if (this.dom.btnEliminar) {
            this.dom.btnEliminar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.quitarFotografia();
            });
        }
    }

    inicializarModoNuevo() {
        if (this.dom.txtAccionTitulo) this.dom.txtAccionTitulo.textContent = 'Registrar';
        if (this.dom.stepHeaderTitle) this.dom.stepHeaderTitle.textContent = 'Alta de Nuevo Automóvil';
        if (this.dom.badgeModoForm) {
            this.dom.badgeModoForm.innerHTML = '<i class="fas fa-plus"></i> Nueva Unidad';
        }
        if (this.dom.inputAnio) {
            this.dom.inputAnio.value = new Date().getFullYear();
        }
        if (this.dom.inputKm) {
            this.dom.inputKm.value = 0;
        }
    }

    async cargarVehiculoParaEdicion(id) {
        try {
            Swal.fire({
                title: 'Cargando información del vehículo...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const vehiculo = await this.service.getVehiculoById(id, true);
            Swal.close();

            if (!vehiculo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Vehículo no encontrado',
                    text: 'El automóvil solicitado no existe o fue removido.',
                    confirmButtonColor: '#D4AF37'
                }).then(() => {
                    this.navegarAParqueVehicular();
                });
                return;
            }

            // Actualizar textos de UI para edición
            if (this.dom.txtAccionTitulo) this.dom.txtAccionTitulo.textContent = 'Editar';
            if (this.dom.stepHeaderTitle) {
                this.dom.stepHeaderTitle.textContent = `Actualizar ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.numeroEconomico || vehiculo.placas})`;
            }
            if (this.dom.badgeModoForm) {
                this.dom.badgeModoForm.innerHTML = `<i class="fas fa-edit"></i> Modo Edición`;
            }
            if (this.dom.btnGuardar) {
                this.dom.btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            }

            // Poblar campos
            if (this.dom.editIdInput) this.dom.editIdInput.value = vehiculo.id;
            if (this.dom.inputNumEco) this.dom.inputNumEco.value = vehiculo.numeroEconomico || '';
            if (this.dom.inputPlacas) this.dom.inputPlacas.value = vehiculo.placas || '';
            if (this.dom.inputMarca) this.dom.inputMarca.value = vehiculo.marca || '';
            if (this.dom.inputModelo) this.dom.inputModelo.value = vehiculo.modelo || '';
            if (this.dom.inputAnio) this.dom.inputAnio.value = vehiculo.anio || '';
            if (this.dom.inputColor) this.dom.inputColor.value = vehiculo.color || '';
            if (this.dom.inputSerie) this.dom.inputSerie.value = vehiculo.numeroSerie || '';
            if (this.dom.inputTipo) this.dom.inputTipo.value = vehiculo.tipoVehiculo || 'Automóvil';
            if (this.dom.inputKm) this.dom.inputKm.value = vehiculo.kilometrajeActual || 0;
            if (this.dom.inputCombustible) this.dom.inputCombustible.value = vehiculo.combustibleNivel || '1/2';
            if (this.dom.selectEstado) this.dom.selectEstado.value = vehiculo.estadoOperativo || 'disponible';
            if (this.dom.inputObservaciones) this.dom.inputObservaciones.value = vehiculo.observaciones || '';

            // Si cuenta con imagen existente
            if (vehiculo.imagenUrl) {
                this.existingImageUrl = vehiculo.imagenUrl;
                this.mostrarPreview(vehiculo.imagenUrl);
            }
        } catch (error) {
            console.error('❌ Error cargando vehículo para edición:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de carga',
                text: error.message,
                confirmButtonColor: '#D4AF37'
            });
        }
    }

    procesarArchivoSeleccionado(file) {
        if (!file || !file.type.startsWith('image/')) {
            Swal.fire({
                icon: 'warning',
                title: 'Formato no soportado',
                text: 'Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).',
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        // Límite de tamaño sugerido (10MB)
        if (file.size > 10 * 1024 * 1024) {
            Swal.fire({
                icon: 'warning',
                title: 'Imagen muy pesada',
                text: 'La imagen no debe superar los 10 MB.',
                confirmButtonColor: '#D4AF37'
            });
            return;
        }

        this.selectedImageFile = file;
        this.eliminarImagenFlag = false;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.mostrarPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    mostrarPreview(url) {
        if (this.dom.imgPreview) {
            this.dom.imgPreview.src = url;
        }
        if (this.dom.emptyState) this.dom.emptyState.style.display = 'none';
        if (this.dom.previewState) this.dom.previewState.style.display = 'flex';
    }

    quitarFotografia() {
        this.selectedImageFile = null;
        this.eliminarImagenFlag = true;
        if (this.dom.inputFile) this.dom.inputFile.value = '';
        if (this.dom.imgPreview) this.dom.imgPreview.src = '';
        if (this.dom.previewState) this.dom.previewState.style.display = 'none';
        if (this.dom.emptyState) this.dom.emptyState.style.display = 'flex';
    }

    async handleSubmit(e) {
        e.preventDefault();

        const data = {
            numeroEconomico: this.dom.inputNumEco?.value || '',
            placas: this.dom.inputPlacas?.value || '',
            marca: this.dom.inputMarca?.value || '',
            modelo: this.dom.inputModelo?.value || '',
            anio: this.dom.inputAnio?.value || '',
            color: this.dom.inputColor?.value || '',
            numeroSerie: this.dom.inputSerie?.value || '',
            tipoVehiculo: this.dom.inputTipo?.value || 'Automóvil',
            kilometrajeActual: this.dom.inputKm?.value || 0,
            combustibleNivel: this.dom.inputCombustible?.value || '1/2',
            estadoOperativo: this.dom.selectEstado?.value || 'disponible',
            observaciones: this.dom.inputObservaciones?.value || '',
            eliminarImagen: this.eliminarImagenFlag
        };

        Swal.fire({
            title: this.vehiculoId ? 'Actualizando automóvil...' : 'Registrando automóvil...',
            text: this.selectedImageFile ? 'Subiendo imagen oficial y guardando datos...' : 'Por favor espere un momento.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let res;
        if (this.vehiculoId) {
            res = await this.service.actualizarVehiculo(this.vehiculoId, data, this.selectedImageFile);
        } else {
            res = await this.service.registrarVehiculo(data, this.selectedImageFile);
        }

        if (res.success) {
            await Swal.fire({
                icon: 'success',
                title: this.vehiculoId ? '¡Automóvil Actualizado!' : '¡Automóvil Registrado!',
                text: res.message,
                confirmButtonColor: '#D4AF37'
            });
            this.navegarAParqueVehicular();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar el vehículo',
                text: res.error || 'Ocurrió un problema durante el registro.',
                confirmButtonColor: '#D4AF37'
            });
        }
    }

    navegarAParqueVehicular() {
        window.history.pushState({}, '', '/partner/vehiculos');
        window.dispatchEvent(new CustomEvent('route:changed'));
    }
}

export async function vehiculoFormController() {
    const controller = new VehiculoFormController();
    await controller.init();
}

export default vehiculoFormController;
