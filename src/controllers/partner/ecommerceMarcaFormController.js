/* ==========================================================================
   ECOMMERCE MARCA FORM CONTROLLER - RSI Enterprise
   Controlador para Crear y Editar Marcas por Pasos (Stepper) con Live Preview
   ========================================================================== */

import { MarcaService } from '../../services/marcaService.js';
import { MarcaModel } from '../../models/marcaModel.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceMarcaFormController {
    constructor() {
        this.marcaService = new MarcaService();
        this.marcaId = null;
        this.isEditMode = false;
        this.selectedFile = null;
        this.currentLogoUrl = null;
        this.sourceType = 'file';

        // Estado Stepper
        this.currentStep = 1;
        this.totalSteps = 2;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.marcaId = urlParams.get('id');
        this.isEditMode = Boolean(this.marcaId);

        this.initStepNavigation();
        this.initStepIndicators();
        this.bindEvents();

        if (this.isEditMode) {
            await this.cargarDatosMarca(this.marcaId);
        } else {
            this.actualizarPreview();
        }

        this.goToStep(1);
    }

    /* ==========================================
       1. NAVEGACIÓN POR PASOS (STEPPER)
       ========================================== */
    initStepNavigation() {
        document.querySelectorAll('.rsi-btn-next').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const nextStep = parseInt(btn.dataset.next, 10);
                if (!isNaN(nextStep)) {
                    this.goToStep(nextStep);
                }
            });
        });

        document.querySelectorAll('.rsi-btn-prev').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const prevStep = parseInt(btn.dataset.prev, 10);
                if (!isNaN(prevStep)) {
                    this.goToStep(prevStep);
                }
            });
        });
    }

    initStepIndicators() {
        document.querySelectorAll('.rsi-step-number').forEach(dot => {
            dot.addEventListener('click', () => {
                const step = parseInt(dot.dataset.step, 10);
                if (!isNaN(step) && step < this.currentStep) {
                    this.goToStep(step);
                }
            });
        });
    }

    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;

        if (step > this.currentStep) {
            const isValid = this.validateCurrentStep();
            if (!isValid) return;
        }

        this.currentStep = step;
        this.updateStepUI(step);
    }

    validateCurrentStep() {
        if (this.currentStep === 1) {
            const nombre = document.getElementById('inputMarcaNombre')?.value.trim();
            const errEl = document.getElementById('errorMarcaNombre');
            if (!nombre) {
                if (errEl) {
                    errEl.textContent = 'El nombre de la marca es obligatorio.';
                    errEl.style.display = 'block';
                }
                Swal.fire({
                    icon: 'warning',
                    title: 'Campo Requerido',
                    text: 'Ingresa el nombre de la marca antes de avanzar.'
                });
                return false;
            }
            if (errEl) errEl.style.display = 'none';
        }
        return true;
    }

    updateStepUI(step) {
        document.querySelectorAll('.rsi-step-panel').forEach(panel => {
            const panelStep = parseInt(panel.dataset.step, 10);
            panel.classList.toggle('active', panelStep === step);
        });

        document.querySelectorAll('.rsi-step-number').forEach(dot => {
            const dotStep = parseInt(dot.dataset.step, 10);
            dot.classList.remove('active', 'completed');
            if (dotStep === step) {
                dot.classList.add('active');
            } else if (dotStep < step) {
                dot.classList.add('completed');
            }
        });

        document.querySelectorAll('.rsi-step-label').forEach(label => {
            const labelStep = parseInt(label.dataset.step, 10);
            label.classList.remove('active', 'completed');
            if (labelStep === step) {
                label.classList.add('active');
            } else if (labelStep < step) {
                label.classList.add('completed');
            }
        });

        document.querySelectorAll('.rsi-step-line').forEach(line => {
            const lineStep = parseInt(line.dataset.step, 10);
            line.classList.remove('active', 'completed');
            if (lineStep < step) {
                line.classList.add('completed');
            } else if (lineStep === step && step < this.totalSteps) {
                line.classList.add('active');
            }
        });
    }

    /* ==========================================
       2. EVENTOS DEL FORMULARIO Y PREVIEW
       ========================================== */
    bindEvents() {
        const form = document.getElementById('formMarca');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const inputNombre = document.getElementById('inputMarcaNombre');
        if (inputNombre) {
            inputNombre.addEventListener('input', () => {
                const slug = MarcaModel.slugify(inputNombre.value);
                const txtSlug = document.getElementById('txtMarcaSlug');
                if (txtSlug) txtSlug.textContent = slug || 'automático';
                const errEl = document.getElementById('errorMarcaNombre');
                if (errEl && inputNombre.value.trim()) errEl.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const inputDesc = document.getElementById('inputMarcaDescripcion');
        if (inputDesc) {
            inputDesc.addEventListener('input', () => this.actualizarPreview());
        }

        const checkActivo = document.getElementById('checkMarcaActivo');
        if (checkActivo) {
            checkActivo.addEventListener('change', () => {
                const label = document.getElementById('labelMarcaActivo');
                if (label) {
                    label.textContent = checkActivo.checked ? 'Visible (Activa)' : 'Oculta (Inactiva)';
                }
                this.actualizarPreview();
            });
        }

        // Tabs origen
        const tabFile = document.getElementById('tabMarcaFile');
        const tabUrl = document.getElementById('tabMarcaUrl');
        const panelFile = document.getElementById('panelMarcaFile');
        const panelUrl = document.getElementById('panelMarcaUrl');

        if (tabFile && tabUrl) {
            tabFile.addEventListener('click', () => {
                this.sourceType = 'file';
                tabFile.classList.add('active');
                tabUrl.classList.remove('active');
                if (panelFile) panelFile.style.display = 'block';
                if (panelUrl) panelUrl.style.display = 'none';
            });

            tabUrl.addEventListener('click', () => {
                this.sourceType = 'url';
                tabUrl.classList.add('active');
                tabFile.classList.remove('active');
                if (panelFile) panelFile.style.display = 'none';
                if (panelUrl) panelUrl.style.display = 'block';
            });
        }

        // Input URL
        const inputUrl = document.getElementById('inputMarcaLogoUrl');
        if (inputUrl) {
            inputUrl.addEventListener('input', () => {
                if (this.sourceType === 'url') {
                    this.currentLogoUrl = inputUrl.value.trim();
                    this.actualizarPreview();
                }
            });
        }

        // Dropzone & File Input
        const dropzone = document.getElementById('dropzoneMarca');
        const fileInput = document.getElementById('fileMarcaInput');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.background = 'rgba(197, 160, 89, 0.1)';
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.style.background = 'rgba(197, 160, 89, 0.04)';
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.background = 'rgba(197, 160, 89, 0.04)';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.procesarArchivo(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files[0]) {
                    this.procesarArchivo(fileInput.files[0]);
                }
            });
        }
    }

    procesarArchivo(file) {
        if (!file.type.startsWith('image/')) {
            Swal.fire({
                icon: 'error',
                title: 'Formato no válido',
                text: 'Por favor selecciona un archivo de imagen (PNG, JPG, SVG o WEBP).'
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'warning',
                title: 'Archivo demasiado pesado',
                text: 'El tamaño de la imagen no debe superar los 5 MB.'
            });
            return;
        }

        this.selectedFile = file;

        const info = document.getElementById('marcaFileInfo');
        const nameEl = document.getElementById('marcaFileName');
        if (info && nameEl) {
            nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            info.style.display = 'block';
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentLogoUrl = e.target.result;
            this.actualizarPreview();
        };
        reader.readAsDataURL(file);
    }

    actualizarPreview() {
        const nombre = document.getElementById('inputMarcaNombre')?.value.trim() || 'Nombre de Marca';
        const desc = document.getElementById('inputMarcaDescripcion')?.value.trim() || 'Descripción o notas comerciales.';
        const activo = document.getElementById('checkMarcaActivo')?.checked ?? true;

        const pTitulo = document.getElementById('previewMarcaTitulo');
        const pDesc = document.getElementById('previewMarcaDesc');
        const pBadge = document.getElementById('previewMarcaBadge');
        const pLogo = document.getElementById('previewMarcaLogo');
        const pPlaceholder = document.getElementById('previewMarcaPlaceholder');

        if (pTitulo) pTitulo.textContent = nombre;
        if (pDesc) pDesc.textContent = desc;

        if (pBadge) {
            pBadge.className = `rsi-badge ${activo ? 'rsi-badge-primary' : 'rsi-badge-danger'}`;
            pBadge.textContent = activo ? 'Activa' : 'Inactiva';
        }

        if (pLogo && pPlaceholder) {
            if (this.currentLogoUrl) {
                pLogo.src = this.currentLogoUrl;
                pLogo.style.display = 'block';
                pPlaceholder.style.display = 'none';
            } else {
                pLogo.style.display = 'none';
                pPlaceholder.style.display = 'block';
            }
        }
    }

    async cargarDatosMarca(id) {
        try {
            Swal.fire({
                title: 'Cargando datos...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const m = await this.marcaService.getMarcaById(id);
            Swal.close();

            if (!m) {
                await Swal.fire({
                    icon: 'error',
                    title: 'No encontrada',
                    text: 'La marca solicitada no existe o fue eliminada.'
                });
                window.history.pushState({}, '', '/ecommerce/marcas');
                window.dispatchEvent(new PopStateEvent('popstate'));
                return;
            }

            const txtAccion = document.getElementById('txtAccionTituloMarca');
            const badgeModo = document.getElementById('badgeModoMarca');
            const btnGuardar = document.getElementById('btnGuardarMarca');

            if (txtAccion) txtAccion.textContent = 'Editar';
            if (badgeModo) badgeModo.innerHTML = `<i class="fas fa-edit"></i> Editando: ${m.nombre}`;
            if (btnGuardar) btnGuardar.innerHTML = `<i class="fas fa-save"></i> Guardar Cambios`;

            document.getElementById('marcaDocId').value = m.id;
            document.getElementById('inputMarcaNombre').value = m.nombre || '';
            document.getElementById('txtMarcaSlug').textContent = m.slug || '';
            document.getElementById('inputMarcaDescripcion').value = m.descripcion || '';

            const checkActivo = document.getElementById('checkMarcaActivo');
            if (checkActivo) {
                checkActivo.checked = m.activo !== false;
                document.getElementById('labelMarcaActivo').textContent = checkActivo.checked ? 'Visible (Activa)' : 'Oculta (Inactiva)';
            }

            if (m.logo) {
                this.currentLogoUrl = m.logo;
                const inputUrl = document.getElementById('inputMarcaLogoUrl');
                if (inputUrl) inputUrl.value = m.logo;
            }

            this.actualizarPreview();
        } catch (error) {
            console.error('❌ Error cargando marca:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const nombre = document.getElementById('inputMarcaNombre')?.value.trim();
        const descripcion = document.getElementById('inputMarcaDescripcion')?.value.trim();
        const activo = document.getElementById('checkMarcaActivo')?.checked ?? true;

        if (!nombre) {
            this.goToStep(1);
            Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'El nombre de la marca es obligatorio.' });
            return;
        }

        let logoUrl = null;
        if (this.sourceType === 'url') {
            logoUrl = document.getElementById('inputMarcaLogoUrl')?.value.trim() || null;
        }

        const data = {
            nombre,
            descripcion,
            activo
        };

        if (logoUrl) {
            data.logo = logoUrl;
        }

        try {
            Swal.fire({
                title: this.isEditMode ? 'Actualizando marca...' : 'Creando marca...',
                text: 'Guardando datos y logotipo en Firebase.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            let res;
            if (this.isEditMode) {
                res = await this.marcaService.updateMarca(this.marcaId, data, this.selectedFile);
            } else {
                res = await this.marcaService.createMarca(data, this.selectedFile);
            }

            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo guardar la marca.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: res.message || 'Marca guardada correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            window.history.pushState({}, '', '/ecommerce/marcas');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
            console.error('❌ Error guardando marca:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }
}

export const ecommerceMarcaFormController = () => {
    const ctrl = new EcommerceMarcaFormController();
    ctrl.init();
    return ctrl;
};

export default ecommerceMarcaFormController;
