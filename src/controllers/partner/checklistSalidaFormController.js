/* ========================================
   CHECKLIST SALIDA FORM CONTROLLER - RSI ENTERPRISE
   Controlador guiado por pasos, captura de fotos con cámara y marca de agua
   ======================================== */

import ChecklistVehiculoService from '../../services/checklistVehiculoService.js';
import ChecklistVehiculoModel from '../../models/checklistVehiculoModel.js';
import GeoMapHelper from '../../utils/geoMapHelper.js';

export class ChecklistSalidaFormController {
    constructor() {
        this.service = new ChecklistVehiculoService();
        this.currentStep = 1;
        this.vehiculosDisponibles = [];
        this.colaboradores = [];
        this.selectedVehiculo = null;

        // Estructura de respuestas del checklist
        this.respuestasChecklist = {};

        // Evidencias fotográficas requeridas y procesadas
        this.evidencias = {}; // { 'frente': { blob, dataUrl, categoria, categoriaLabel, ubicacion } }

        // Cámara WebRTC
        this.mediaStream = null;
        this.currentFacingMode = 'environment';
        this.activePhotoCategory = null;
        this.activePhotoCategoryLabel = '';
        this.tempCapturedWatermarkResult = null;
    }

    async init() {
        console.log('📋 Inicializando ChecklistSalidaFormController...');
        this.cacheDOM();
        this.bindEvents();
        await this.cargarDatosIniciales();
        this.renderChecklistCategorias();
        this.renderSlotsEvidencias();

        // Verificar si viene vehiculoId por URL
        const params = new URLSearchParams(window.location.search);
        const preselectVehiculoId = params.get('vehiculoId');
        if (preselectVehiculoId && this.dom.selectVehiculo) {
            this.dom.selectVehiculo.value = preselectVehiculoId;
            this.handleVehiculoSeleccionado(preselectVehiculoId);
        }
    }

    cacheDOM() {
        this.dom = {
            form: document.getElementById('formChecklistSalida'),
            stepperSteps: document.querySelectorAll('.veh-step'),
            wizardSteps: document.querySelectorAll('.veh-wizard-step'),
            btnNextList: document.querySelectorAll('.btn-next-step'),
            btnPrevList: document.querySelectorAll('.btn-prev-step'),
            // Paso 1
            selectVehiculo: document.getElementById('selectVehiculo'),
            selectReceptor: document.getElementById('selectReceptor'),
            inputKmSalida: document.getElementById('inputKmSalida'),
            selectCombustible: document.getElementById('selectCombustibleSalida'),
            inputMotivo: document.getElementById('inputMotivoSalida'),
            inputDestino: document.getElementById('inputDestinoSalida'),
            quickInfoBanner: document.getElementById('vehiculoQuickInfo'),
            bannerTitulo: document.getElementById('bannerVehiculoTitulo'),
            bannerSub: document.getElementById('bannerVehiculoSub'),
            helpKm: document.getElementById('helpKmActual'),
            // Paso 2
            categoriesContainer: document.getElementById('checklistCategoriesContainer'),
            // Paso 3
            photosContainer: document.getElementById('photosGridContainer'),
            cameraInputMobile: document.getElementById('cameraInputMobile'),
            fileInputGallery: document.getElementById('fileInputGallery'),
            // Paso 4
            summaryVehiculo: document.getElementById('summaryVehiculo'),
            summaryPlacas: document.getElementById('summaryPlacas'),
            summaryReceptor: document.getElementById('summaryReceptor'),
            summaryKm: document.getElementById('summaryKm'),
            summaryCombustible: document.getElementById('summaryCombustible'),
            summaryFotosCount: document.getElementById('summaryFotosCount'),
            inputObservacionesGenerales: document.getElementById('inputObservacionesGenerales'),
            btnGuardarChecklist: document.getElementById('btnGuardarChecklist'),
            // Cámara Modal
            cameraModal: document.getElementById('vehCameraModal'),
            cameraVideo: document.getElementById('vehCameraVideo'),
            cameraPreviewImg: document.getElementById('vehCameraPreviewImg'),
            btnCloseCamera: document.getElementById('btnCloseVehCamera'),
            btnSwitchCamera: document.getElementById('btnSwitchVehCamera'),
            btnTakeSnapshot: document.getElementById('btnTakeVehSnapshot'),
            btnRetakePhoto: document.getElementById('btnRetakeVehPhoto'),
            btnConfirmPhoto: document.getElementById('btnConfirmVehPhoto'),
            cameraTitle: document.getElementById('vehCameraTitle')
        };
    }

    bindEvents() {
        // Navegación del Wizard
        this.dom.btnNextList.forEach(btn => {
            btn.addEventListener('click', () => {
                const nextStep = parseInt(btn.dataset.next, 10);
                this.goToStep(nextStep);
            });
        });

        this.dom.btnPrevList.forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.prev, 10);
                this.goToStep(prevStep);
            });
        });

        // Cambio de vehículo
        if (this.dom.selectVehiculo) {
            this.dom.selectVehiculo.addEventListener('change', (e) => {
                this.handleVehiculoSeleccionado(e.target.value);
            });
        }

        // Cámara Modal
        if (this.dom.btnCloseCamera) {
            this.dom.btnCloseCamera.addEventListener('click', () => this.cerrarCamaraModal());
        }

        if (this.dom.btnSwitchCamera) {
            this.dom.btnSwitchCamera.addEventListener('click', () => this.switchCamera());
        }

        if (this.dom.btnTakeSnapshot) {
            this.dom.btnTakeSnapshot.addEventListener('click', () => this.capturarSnapshotVideo());
        }

        if (this.dom.btnRetakePhoto) {
            this.dom.btnRetakePhoto.addEventListener('click', () => this.reiniciarCapturaVideo());
        }

        if (this.dom.btnConfirmPhoto) {
            this.dom.btnConfirmPhoto.addEventListener('click', () => this.confirmarFotoCapturada());
        }

        // Captura directa móvil (input file capture=environment)
        if (this.dom.cameraInputMobile) {
            this.dom.cameraInputMobile.addEventListener('change', (e) => this.handleArchivoSeleccionado(e));
        }

        if (this.dom.fileInputGallery) {
            this.dom.fileInputGallery.addEventListener('change', (e) => this.handleArchivoSeleccionado(e));
        }

        // Submit Final
        if (this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.handleSubmitFinal(e));
        }
    }

    async cargarDatosIniciales() {
        try {
            const [vehiculos, colaboradores] = await Promise.all([
                this.service.getVehiculosDisponiblesParaSalida(),
                this.service.getColaboradoresParaReceptor()
            ]);

            this.vehiculosDisponibles = vehiculos;
            this.colaboradores = colaboradores;

            // Poblar select vehículos
            if (this.dom.selectVehiculo) {
                if (vehiculos.length === 0) {
                    this.dom.selectVehiculo.innerHTML = '<option value="">⚠️ No hay vehículos disponibles en este momento</option>';
                } else {
                    this.dom.selectVehiculo.innerHTML = `
                        <option value="">-- Selecciona un automóvil disponible (${vehiculos.length}) --</option>
                        ${vehiculos.map(v => `
                            <option value="${v.id}">
                                ${v.numeroEconomico || 'S/N'} — ${v.marca} ${v.modelo} (${v.placas}) · ${ (v.kilometrajeActual || 0).toLocaleString() } km
                            </option>
                        `).join('')}
                    `;
                }
            }

            // Poblar select receptor
            if (this.dom.selectReceptor) {
                this.dom.selectReceptor.innerHTML = `
                    <option value="">-- Seleccionar colaborador receptor (${colaboradores.length}) --</option>
                    ${colaboradores.map(c => `
                        <option value="${c.uid}">
                            ${c.nombreCompleto} ${c.puesto ? `(${c.puesto})` : ''} ${c.area ? `· ${c.area}` : ''}
                        </option>
                    `).join('')}
                `;
            }
        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
        }
    }

    handleVehiculoSeleccionado(vehiculoId) {
        this.selectedVehiculo = this.vehiculosDisponibles.find(v => v.id === vehiculoId) || null;

        if (this.selectedVehiculo) {
            if (this.dom.quickInfoBanner) this.dom.quickInfoBanner.style.display = 'flex';
            if (this.dom.bannerTitulo) {
                this.dom.bannerTitulo.textContent = `${this.selectedVehiculo.marca} ${this.selectedVehiculo.modelo} (${this.selectedVehiculo.anio || ''})`;
            }
            if (this.dom.bannerSub) {
                this.dom.bannerSub.textContent = `No. Económico: ${this.selectedVehiculo.numeroEconomico || 'S/N'} | Placas: ${this.selectedVehiculo.placas || 'S/P'} | Color: ${this.selectedVehiculo.color || 'N/A'}`;
            }

            const kmActual = this.selectedVehiculo.kilometrajeActual || 0;
            if (this.dom.inputKmSalida) {
                this.dom.inputKmSalida.min = kmActual;
                this.dom.inputKmSalida.value = kmActual;
            }
            if (this.dom.helpKm) {
                this.dom.helpKm.textContent = `Kilometraje actual registrado en sistema: ${kmActual.toLocaleString()} km (El valor ingresado no puede ser menor)`;
            }
            if (this.dom.selectCombustible && this.selectedVehiculo.combustibleNivel) {
                this.dom.selectCombustible.value = this.selectedVehiculo.combustibleNivel;
            }
        } else {
            if (this.dom.quickInfoBanner) this.dom.quickInfoBanner.style.display = 'none';
        }
    }

    renderChecklistCategorias() {
        if (!this.dom.categoriesContainer) return;

        const catalogo = ChecklistVehiculoModel.getCatalogoInspeccion();

        this.dom.categoriesContainer.innerHTML = catalogo.map(cat => `
            <div style="background: var(--rsi-bg-secondary); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-lg); margin-bottom: var(--rsi-spacing-lg);">
                <div style="border-bottom: 1.5px solid var(--rsi-border-color); padding-bottom: 8px; margin-bottom: var(--rsi-spacing-md);">
                    <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--rsi-text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: var(--rsi-primary);"></i> ${cat.categoriaNombre}
                    </h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${cat.items.map(item => `
                        <div class="veh-chk-item" data-item-id="${item.id}" style="background: var(--rsi-bg-card); border: 1px solid var(--rsi-border-color); border-radius: var(--rsi-radius-md); padding: 12px 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                                <span class="veh-chk-label" style="font-weight: 600; color: var(--rsi-text-primary); font-size: 0.92rem;">${item.label}</span>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <label style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--rsi-radius-full); font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1.5px solid var(--rsi-border-color); background: var(--rsi-bg-secondary); color: var(--rsi-text-primary); transition: all 0.2s;">
                                        <input type="radio" name="chk_${item.id}" value="correcto" data-item-id="${item.id}" style="accent-color: var(--rsi-success);" />
                                        <i class="fas fa-check" style="color: var(--rsi-success);"></i> Correcto
                                    </label>
                                    <label style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--rsi-radius-full); font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1.5px solid var(--rsi-border-color); background: var(--rsi-bg-secondary); color: var(--rsi-text-primary); transition: all 0.2s;">
                                        <input type="radio" name="chk_${item.id}" value="con_observaciones" data-item-id="${item.id}" style="accent-color: var(--rsi-warning);" />
                                        <i class="fas fa-exclamation-triangle" style="color: var(--rsi-warning);"></i> Con Observación
                                    </label>
                                    <label style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--rsi-radius-full); font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1.5px solid var(--rsi-border-color); background: var(--rsi-bg-secondary); color: var(--rsi-text-primary); transition: all 0.2s;">
                                        <input type="radio" name="chk_${item.id}" value="no_aplica" data-item-id="${item.id}" style="accent-color: var(--rsi-text-muted);" />
                                        <i class="fas fa-minus" style="color: var(--rsi-text-muted);"></i> N/A
                                    </label>
                                </div>
                            </div>
                            <div class="veh-chk-obs-input" id="obsInputWrapper_${item.id}" style="display: none; margin-top: 10px;">
                                <div class="rsi-input-wrapper">
                                    <i class="fas fa-comment-alt rsi-input-icon"></i>
                                    <input type="text" id="obsText_${item.id}" placeholder="Describe la anomalía, daño o detalle detectado..." style="font-size: 0.88rem;" />
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Listeners para radios
        this.dom.categoriesContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const itemId = e.target.dataset.itemId;
                const value = e.target.value;
                const obsWrapper = document.getElementById(`obsInputWrapper_${itemId}`);

                if (value === 'con_observaciones') {
                    if (obsWrapper) obsWrapper.style.display = 'block';
                } else {
                    if (obsWrapper) obsWrapper.style.display = 'none';
                }

                // Guardar en respuestas
                const itemEl = e.target.closest('.veh-chk-item');
                const labelText = itemEl ? itemEl.querySelector('.veh-chk-label')?.textContent : itemId;
                const obsInput = document.getElementById(`obsText_${itemId}`);

                this.respuestasChecklist[itemId] = {
                    itemId,
                    label: labelText,
                    estado: value,
                    observacion: obsInput ? obsInput.value : ''
                };
            });
        });

        // Listeners para inputs de observación
        this.dom.categoriesContainer.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const itemId = e.target.id.replace('obsText_', '');
                if (this.respuestasChecklist[itemId]) {
                    this.respuestasChecklist[itemId].observacion = e.target.value;
                }
            });
        });
    }

    renderSlotsEvidencias() {
        if (!this.dom.photosContainer) return;

        const obligatorias = ChecklistVehiculoModel.FOTOGRAFIAS_OBLIGATORIAS;

        this.dom.photosContainer.innerHTML = obligatorias.map(foto => `
            <div style="background: var(--rsi-bg-card); border: 2px dashed var(--rsi-border-color); border-radius: var(--rsi-radius-lg); padding: var(--rsi-spacing-md); display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: space-between; min-height: 230px;" id="slot_${foto.id}" data-foto-id="${foto.id}" data-foto-label="${foto.label}">
                <div id="preview_${foto.id}" style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--rsi-bg-secondary); border: 1.5px solid var(--rsi-border-color); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: var(--rsi-primary); font-size: 1.4rem;">
                        <i class="fas fa-camera"></i>
                    </div>
                    <strong style="color: var(--rsi-text-primary); font-size: 0.95rem; margin-bottom: 4px;">${foto.label}</strong>
                    <span class="rsi-badge rsi-badge-primary" style="font-size: 0.72rem; padding: 2px 8px;">Obligatoria</span>
                </div>
                <div style="display: flex; gap: 8px; width: 100%; justify-content: center; margin-top: 12px; flex-wrap: wrap;">
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-primary btn-tomar-foto" data-id="${foto.id}" data-label="${foto.label}" style="padding: 7px 12px; font-size: 0.82rem;">
                        <i class="fas fa-camera"></i> Cámara
                    </button>
                    <button type="button" class="rsi-btn-crud rsi-btn-crud-outline btn-subir-archivo" data-id="${foto.id}" data-label="${foto.label}" style="padding: 7px 12px; font-size: 0.82rem;">
                        <i class="fas fa-upload"></i> Galería
                    </button>
                </div>
            </div>
        `).join('');

        // Listeners para botones de captura de cada slot
        this.dom.photosContainer.querySelectorAll('.btn-tomar-foto').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.id;
                const catLabel = btn.dataset.label;
                this.iniciarCapturaCamara(catId, catLabel);
            });
        });

        this.dom.photosContainer.querySelectorAll('.btn-subir-archivo').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.id;
                const catLabel = btn.dataset.label;
                this.activePhotoCategory = catId;
                this.activePhotoCategoryLabel = catLabel;
                if (this.dom.fileInputGallery) {
                    this.dom.fileInputGallery.click();
                }
            });
        });
    }

    goToStep(stepNumber) {
        // Validaciones al avanzar
        if (stepNumber > this.currentStep) {
            if (this.currentStep === 1) {
                if (!this.dom.selectVehiculo?.value) {
                    Swal.fire({ icon: 'warning', title: 'Vehículo requerido', text: 'Seleccione un automóvil disponible para la salida.', confirmButtonColor: '#D4AF37' });
                    return;
                }
                if (!this.dom.selectReceptor?.value) {
                    Swal.fire({ icon: 'warning', title: 'Conductor requerido', text: 'Debe asignar al colaborador que conducirá y retirará el vehículo.', confirmButtonColor: '#D4AF37' });
                    return;
                }
                const km = parseFloat(this.dom.inputKmSalida?.value);
                const kmMin = this.selectedVehiculo?.kilometrajeActual || 0;
                if (isNaN(km) || km < kmMin) {
                    Swal.fire({ icon: 'warning', title: 'Kilometraje inválido', text: `El kilometraje de salida no puede ser menor a ${kmMin.toLocaleString()} km.`, confirmButtonColor: '#D4AF37' });
                    return;
                }
            }

            if (this.currentStep === 2) {
                const catalogo = ChecklistVehiculoModel.getCatalogoInspeccion();
                const faltantes = [];
                for (const cat of catalogo) {
                    for (const item of cat.items) {
                        const resp = this.respuestasChecklist[item.id];
                        if (!resp || !resp.estado) {
                            faltantes.push(item.label);
                        } else if (resp.estado === 'con_observaciones' && (!resp.observacion || !resp.observacion.trim())) {
                            faltantes.push(`${item.label} (Requiere observación)`);
                        }
                    }
                }

                if (faltantes.length > 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Inspección Incompleta',
                        html: `Debes responder todos los ítems del checklist antes de continuar.<br><br><strong>Faltan:</strong><br><small style="text-align: left; display: block; max-height: 140px; overflow-y: auto;">${faltantes.join('<br>')}</small>`,
                        confirmButtonColor: '#D4AF37'
                    });
                    return;
                }
            }

            if (this.currentStep === 3) {
                const reqFotos = ChecklistVehiculoModel.FOTOGRAFIAS_OBLIGATORIAS;
                const faltanFotos = reqFotos.filter(rf => !this.evidencias[rf.id]);

                if (faltanFotos.length > 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Evidencias Fotográficas Obligatorias',
                        html: `Debes capturar las 6 fotografías obligatorias con marca de agua institucional.<br><br><strong>Faltan:</strong><br>${faltanFotos.map(f => `• ${f.label}`).join('<br>')}`,
                        confirmButtonColor: '#D4AF37'
                    });
                    return;
                }

                this.actualizarResumenPaso4();
            }
        }

        // Transición de paso
        this.currentStep = stepNumber;

        // Actualizar Stepper Header
        this.dom.stepperSteps.forEach(stepEl => {
            const stepIndex = parseInt(stepEl.dataset.step, 10);
            if (stepIndex === this.currentStep) {
                stepEl.classList.add('active');
            } else if (stepIndex < this.currentStep) {
                stepEl.classList.add('completed');
                stepEl.classList.remove('active');
            } else {
                stepEl.classList.remove('active', 'completed');
            }
        });

        // Actualizar Contenido
        this.dom.wizardSteps.forEach(panel => {
            const panelIndex = parseInt(panel.dataset.stepContent, 10);
            if (panelIndex === this.currentStep) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    actualizarResumenPaso4() {
        if (this.dom.summaryVehiculo && this.selectedVehiculo) {
            this.dom.summaryVehiculo.textContent = `${this.selectedVehiculo.marca} ${this.selectedVehiculo.modelo} (${this.selectedVehiculo.anio || ''})`;
        }
        if (this.dom.summaryPlacas && this.selectedVehiculo) {
            this.dom.summaryPlacas.textContent = `No. Eco: ${this.selectedVehiculo.numeroEconomico || 'S/N'} | Placas: ${this.selectedVehiculo.placas || 'S/P'}`;
        }
        if (this.dom.summaryReceptor) {
            const opt = this.dom.selectReceptor?.selectedOptions[0];
            this.dom.summaryReceptor.textContent = opt ? opt.textContent.trim() : '-';
        }
        if (this.dom.summaryKm) {
            this.dom.summaryKm.textContent = `${parseFloat(this.dom.inputKmSalida?.value || 0).toLocaleString()} km`;
        }
        if (this.dom.summaryCombustible) {
            this.dom.summaryCombustible.textContent = this.dom.selectCombustible?.value || '-';
        }
        if (this.dom.summaryFotosCount) {
            this.dom.summaryFotosCount.textContent = Object.keys(this.evidencias).length;
        }
    }

    // ==========================================
    // CAPTURA FOTOGRÁFICA Y CÁMARA
    // ==========================================

    async iniciarCapturaCamara(catId, catLabel) {
        this.activePhotoCategory = catId;
        this.activePhotoCategoryLabel = catLabel;

        // Si es dispositivo móvil táctil, preferir disparador nativo de cámara con capture="environment"
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && this.dom.cameraInputMobile) {
            this.dom.cameraInputMobile.click();
            return;
        }

        // En escritorio o si el navegador soporta getUserMedia, abrir modal WebRTC
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            await this.abrirCamaraModal(catLabel);
        } else if (this.dom.fileInputGallery) {
            this.dom.fileInputGallery.click();
        }
    }

    async abrirCamaraModal(catLabel) {
        if (!this.dom.cameraModal) return;

        if (this.dom.cameraTitle) {
            this.dom.cameraTitle.innerHTML = `<i class="fas fa-camera"></i> Capturar: ${catLabel}`;
        }

        this.dom.cameraModal.style.display = 'flex';
        this.reiniciarCapturaVideo();

        try {
            await this.iniciarStreamVideo();
        } catch (error) {
            console.warn('⚠️ No se pudo acceder a la cámara en vivo:', error);
            this.cerrarCamaraModal();
            Swal.fire({
                icon: 'info',
                title: 'Acceso a Cámara',
                text: 'No fue posible abrir la cámara en vivo. Por favor selecciona una imagen desde tus archivos.',
                confirmButtonColor: '#D4AF37'
            }).then(() => {
                if (this.dom.fileInputGallery) this.dom.fileInputGallery.click();
            });
        }
    }

    async iniciarStreamVideo() {
        this.detenerStreamVideo();

        const constraints = {
            video: {
                facingMode: { ideal: this.currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (this.dom.cameraVideo) {
            this.dom.cameraVideo.srcObject = this.mediaStream;
            await this.dom.cameraVideo.play();
        }
    }

    detenerStreamVideo() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.dom.cameraVideo) {
            this.dom.cameraVideo.srcObject = null;
        }
    }

    cerrarCamaraModal() {
        this.detenerStreamVideo();
        if (this.dom.cameraModal) {
            this.dom.cameraModal.style.display = 'none';
        }
        this.tempCapturedWatermarkResult = null;
    }

    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        await this.iniciarStreamVideo();
    }

    async capturarSnapshotVideo() {
        if (!this.dom.cameraVideo) return;

        Swal.fire({
            title: 'Estampando marca de agua y GPS...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const geo = await GeoMapHelper.obtenerPosicionActual();
            const res = await this.service.procesarFotografiaConMarcaDeAgua({
                source: this.dom.cameraVideo,
                placas: this.selectedVehiculo?.placas || '',
                numeroEconomico: this.selectedVehiculo?.numeroEconomico || '',
                categoriaLabel: this.activePhotoCategoryLabel,
                ubicacion: geo
            });

            this.tempCapturedWatermarkResult = res;

            // Mostrar previsualización
            if (this.dom.cameraVideo) this.dom.cameraVideo.style.display = 'none';
            if (this.dom.cameraPreviewImg) {
                this.dom.cameraPreviewImg.src = res.dataUrl;
                this.dom.cameraPreviewImg.style.display = 'block';
            }

            // Cambiar botones
            if (this.dom.btnTakeSnapshot) this.dom.btnTakeSnapshot.style.display = 'none';
            if (this.dom.btnSwitchCamera) this.dom.btnSwitchCamera.style.display = 'none';
            if (this.dom.btnRetakePhoto) this.dom.btnRetakePhoto.style.display = 'inline-flex';
            if (this.dom.btnConfirmPhoto) this.dom.btnConfirmPhoto.style.display = 'inline-flex';

            Swal.close();
        } catch (error) {
            console.error('❌ Error capturando foto:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al capturar',
                text: error.message,
                confirmButtonColor: '#D4AF37'
            });
        }
    }

    reiniciarCapturaVideo() {
        if (this.dom.cameraVideo) this.dom.cameraVideo.style.display = 'block';
        if (this.dom.cameraPreviewImg) {
            this.dom.cameraPreviewImg.src = '';
            this.dom.cameraPreviewImg.style.display = 'none';
        }

        if (this.dom.btnTakeSnapshot) this.dom.btnTakeSnapshot.style.display = 'inline-flex';
        if (this.dom.btnSwitchCamera) this.dom.btnSwitchCamera.style.display = 'inline-flex';
        if (this.dom.btnRetakePhoto) this.dom.btnRetakePhoto.style.display = 'none';
        if (this.dom.btnConfirmPhoto) this.dom.btnConfirmPhoto.style.display = 'none';

        this.tempCapturedWatermarkResult = null;
    }

    confirmarFotoCapturada() {
        if (!this.tempCapturedWatermarkResult || !this.activePhotoCategory) return;

        this.guardarEvidenciaEnSlot(this.activePhotoCategory, this.activePhotoCategoryLabel, this.tempCapturedWatermarkResult);
        this.cerrarCamaraModal();
    }

    async handleArchivoSeleccionado(e) {
        const file = e.target.files && e.target.files[0];
        if (!file || !this.activePhotoCategory) return;

        Swal.fire({
            title: 'Sellando fotografía con marca de agua y GPS...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const geo = await GeoMapHelper.obtenerPosicionActual();
            const res = await this.service.procesarFotografiaConMarcaDeAgua({
                source: file,
                placas: this.selectedVehiculo?.placas || '',
                numeroEconomico: this.selectedVehiculo?.numeroEconomico || '',
                categoriaLabel: this.activePhotoCategoryLabel,
                ubicacion: geo
            });

            this.guardarEvidenciaEnSlot(this.activePhotoCategory, this.activePhotoCategoryLabel, res);
            Swal.close();
        } catch (error) {
            console.error('❌ Error procesando archivo:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al procesar fotografía',
                text: error.message,
                confirmButtonColor: '#D4AF37'
            });
        } finally {
            e.target.value = '';
        }
    }

    guardarEvidenciaEnSlot(catId, catLabel, resultado) {
        this.evidencias[catId] = {
            id: `foto_${catId}_${Date.now()}`,
            categoria: catId,
            categoriaLabel: catLabel,
            blob: resultado.blob,
            dataUrl: resultado.dataUrl,
            ubicacion: resultado.ubicacion
        };

        const previewEl = document.getElementById(`preview_${catId}`);
        if (previewEl) {
            previewEl.classList.add('has-photo');
            previewEl.innerHTML = `
                <img src="${resultado.dataUrl}" alt="${catLabel}" />
                <span class="veh-photo-badge-done"><i class="fas fa-check-circle"></i> Sello RSI Listo</span>
            `;
        }
    }

    // ==========================================
    // ENVÍO FINAL DEL CHECKLIST
    // ==========================================

    async handleSubmitFinal(e) {
        e.preventDefault();

        const receptorUid = this.dom.selectReceptor?.value;
        const receptorObj = this.colaboradores.find(c => c.uid === receptorUid);

        const formData = {
            vehiculoId: this.dom.selectVehiculo?.value,
            receptorUid: receptorUid,
            receptorNombre: receptorObj?.nombreCompleto || 'Colaborador',
            receptorEmail: receptorObj?.email || '',
            receptorPuesto: receptorObj?.puesto || '',
            receptorArea: receptorObj?.area || '',
            kilometrajeSalida: this.dom.inputKmSalida?.value,
            nivelCombustibleSalida: this.dom.selectCombustible?.value,
            motivoSalida: this.dom.inputMotivo?.value,
            destinoSalida: this.dom.inputDestino?.value,
            respuestasChecklist: this.respuestasChecklist,
            evidencias: Object.values(this.evidencias),
            observacionesGenerales: this.dom.inputObservacionesGenerales?.value
        };

        const confirmRes = await Swal.fire({
            title: '¿Generar orden de salida vehicular?',
            html: `Se registrará la inspección de la unidad <strong>${this.selectedVehiculo?.numeroEconomico} (${this.selectedVehiculo?.placas})</strong>.<br><br>El automóvil quedará apartado en espera de la firma de aceptación por parte de <strong>${receptorObj?.nombreCompleto}</strong>.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#D4AF37',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, generar salida',
            cancelButtonText: 'Revisar datos'
        });

        if (!confirmRes.isConfirmed) return;

        Swal.fire({
            title: 'Guardando checklist y subiendo fotografías selladas a Storage...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await this.service.registrarSalidaVehicular(formData);

        if (res.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Salida Vehicular Registrada!',
                html: `Folio: <strong class="veh-text-gold">${res.folio}</strong><br><br>${res.message}`,
                confirmButtonColor: '#D4AF37',
                confirmButtonText: 'Ver Historial de Salidas'
            });

            // Redireccionar al historial
            window.location.hash = '';
            window.history.pushState({}, '', '/partner/checklists-vehiculos');
            window.dispatchEvent(new CustomEvent('route:changed'));
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error al registrar salida',
                html: res.error || 'Ocurrió un error al procesar el checklist vehicular.',
                confirmButtonColor: '#D4AF37'
            });
        }
    }
}

export async function checklistSalidaFormController() {
    const controller = new ChecklistSalidaFormController();
    await controller.init();
}

export default checklistSalidaFormController;
