/* ==========================================================================
   ECOMMERCE CATEGORIA FORM CONTROLLER - RSI Enterprise
   Controlador para Crear y Editar Categorías por Pasos (Stepper) con Live Preview
   ========================================================================== */

import { CategoriaService } from '../../services/categoriaService.js';
import { CategoriaModel } from '../../models/categoriaModel.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceCategoriaFormController {
    constructor() {
        this.categoriaService = new CategoriaService();
        this.categoriaId = null;
        this.isEditMode = false;
        this.selectedFile = null;
        this.currentImageUrl = null;
        this.sourceType = 'file'; // 'file' | 'url'

        // Estado del Stepper
        this.currentStep = 1;
        this.totalSteps = 2;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.categoriaId = urlParams.get('id');
        this.isEditMode = Boolean(this.categoriaId);

        this.initStepNavigation();
        this.initStepIndicators();
        this.bindEvents();

        if (this.isEditMode) {
            await this.cargarDatosCategoria(this.categoriaId);
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
            const nombre = document.getElementById('inputCatNombre')?.value.trim();
            const errEl = document.getElementById('errorCatNombre');
            if (!nombre) {
                if (errEl) {
                    errEl.textContent = 'El nombre de la categoría es obligatorio.';
                    errEl.style.display = 'block';
                }
                Swal.fire({
                    icon: 'warning',
                    title: 'Campo Requerido',
                    text: 'Ingresa el nombre de la categoría antes de avanzar.'
                });
                return false;
            }
            if (errEl) errEl.style.display = 'none';
        }
        return true;
    }

    updateStepUI(step) {
        // Paneles
        document.querySelectorAll('.rsi-step-panel').forEach(panel => {
            const panelStep = parseInt(panel.dataset.step, 10);
            panel.classList.toggle('active', panelStep === step);
        });

        // Números
        document.querySelectorAll('.rsi-step-number').forEach(dot => {
            const dotStep = parseInt(dot.dataset.step, 10);
            dot.classList.remove('active', 'completed');
            if (dotStep === step) {
                dot.classList.add('active');
            } else if (dotStep < step) {
                dot.classList.add('completed');
            }
        });

        // Etiquetas
        document.querySelectorAll('.rsi-step-label').forEach(label => {
            const labelStep = parseInt(label.dataset.step, 10);
            label.classList.remove('active', 'completed');
            if (labelStep === step) {
                label.classList.add('active');
            } else if (labelStep < step) {
                label.classList.add('completed');
            }
        });

        // Líneas
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
        const form = document.getElementById('formCategoria');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Live Preview en Inputs
        const inputNombre = document.getElementById('inputCatNombre');
        if (inputNombre) {
            inputNombre.addEventListener('input', () => {
                const slug = CategoriaModel.slugify(inputNombre.value);
                const txtSlug = document.getElementById('txtCatSlug');
                if (txtSlug) txtSlug.textContent = slug || 'automático';
                const errEl = document.getElementById('errorCatNombre');
                if (errEl && inputNombre.value.trim()) errEl.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const inputDesc = document.getElementById('inputCatDescripcion');
        if (inputDesc) {
            inputDesc.addEventListener('input', () => this.actualizarPreview());
        }

        const inputOrden = document.getElementById('inputCatOrden');
        if (inputOrden) {
            inputOrden.addEventListener('input', () => this.actualizarPreview());
        }

        const checkActivo = document.getElementById('checkCatActivo');
        if (checkActivo) {
            checkActivo.addEventListener('change', () => {
                const label = document.getElementById('labelCatActivo');
                if (label) {
                    label.textContent = checkActivo.checked ? 'Visible (Activa)' : 'Oculta (Inactiva)';
                }
                this.actualizarPreview();
            });
        }

        // Tabs origen de imagen
        const tabFile = document.getElementById('tabCatFile');
        const tabUrl = document.getElementById('tabCatUrl');
        const panelFile = document.getElementById('panelCatFile');
        const panelUrl = document.getElementById('panelCatUrl');

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
        const inputUrl = document.getElementById('inputCatImageUrl');
        if (inputUrl) {
            inputUrl.addEventListener('input', () => {
                if (this.sourceType === 'url') {
                    this.currentImageUrl = inputUrl.value.trim();
                    this.actualizarPreview();
                }
            });
        }

        // Drag & Drop / File Input
        const dropzone = document.getElementById('dropzoneCat');
        const fileInput = document.getElementById('fileCatInput');

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
                text: 'Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).'
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

        const info = document.getElementById('catFileInfo');
        const nameEl = document.getElementById('catFileName');
        if (info && nameEl) {
            nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            info.style.display = 'block';
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImageUrl = e.target.result;
            this.actualizarPreview();
        };
        reader.readAsDataURL(file);
    }

    actualizarPreview() {
        const nombre = document.getElementById('inputCatNombre')?.value.trim() || 'Nombre de Categoría';
        const desc = document.getElementById('inputCatDescripcion')?.value.trim() || 'Breve descripción de la categoría.';
        const orden = document.getElementById('inputCatOrden')?.value || 1;
        const activo = document.getElementById('checkCatActivo')?.checked ?? true;

        const pTitulo = document.getElementById('previewCatTitulo');
        const pDesc = document.getElementById('previewCatDesc');
        const pOrden = document.getElementById('previewCatOrden');
        const pBadge = document.getElementById('previewCatBadge');
        const pImg = document.getElementById('previewCatImg');
        const pPlaceholder = document.getElementById('previewCatPlaceholder');

        if (pTitulo) pTitulo.textContent = nombre;
        if (pDesc) pDesc.textContent = desc;
        if (pOrden) pOrden.innerHTML = `<i class="fas fa-sort-numeric-down"></i> Orden: ${orden}`;

        if (pBadge) {
            pBadge.className = `rsi-badge ${activo ? 'rsi-badge-primary' : 'rsi-badge-danger'}`;
            pBadge.textContent = activo ? 'Activa' : 'Inactiva';
        }

        if (pImg && pPlaceholder) {
            if (this.currentImageUrl) {
                pImg.src = this.currentImageUrl;
                pImg.style.display = 'block';
                pPlaceholder.style.display = 'none';
            } else {
                pImg.style.display = 'none';
                pPlaceholder.style.display = 'block';
            }
        }
    }

    async cargarDatosCategoria(id) {
        try {
            Swal.fire({
                title: 'Cargando datos...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const cat = await this.categoriaService.getCategoriaById(id);
            Swal.close();

            if (!cat) {
                await Swal.fire({
                    icon: 'error',
                    title: 'No encontrada',
                    text: 'La categoría solicitada no existe o fue eliminada.'
                });
                window.history.pushState({}, '', '/ecommerce/categorias');
                window.dispatchEvent(new PopStateEvent('popstate'));
                return;
            }

            // Cambiar textos a modo edición
            const txtAccion = document.getElementById('txtAccionTitulo');
            const badgeModo = document.getElementById('badgeModoCat');
            const btnGuardar = document.getElementById('btnGuardarCategoria');

            if (txtAccion) txtAccion.textContent = 'Editar';
            if (badgeModo) badgeModo.innerHTML = `<i class="fas fa-edit"></i> Editando: ${cat.nombre}`;
            if (btnGuardar) btnGuardar.innerHTML = `<i class="fas fa-save"></i> Guardar Cambios`;

            // Rellenar campos
            document.getElementById('categoriaDocId').value = cat.id;
            document.getElementById('inputCatNombre').value = cat.nombre || '';
            document.getElementById('txtCatSlug').textContent = cat.slug || '';
            document.getElementById('inputCatDescripcion').value = cat.descripcion || '';
            document.getElementById('inputCatOrden').value = cat.orden || 1;

            const checkActivo = document.getElementById('checkCatActivo');
            if (checkActivo) {
                checkActivo.checked = cat.activo !== false;
                document.getElementById('labelCatActivo').textContent = checkActivo.checked ? 'Visible (Activa)' : 'Oculta (Inactiva)';
            }

            if (cat.imagen) {
                this.currentImageUrl = cat.imagen;
                const inputUrl = document.getElementById('inputCatImageUrl');
                if (inputUrl) inputUrl.value = cat.imagen;
            }

            this.actualizarPreview();
        } catch (error) {
            console.error('❌ Error cargando categoría:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const nombre = document.getElementById('inputCatNombre')?.value.trim();
        const descripcion = document.getElementById('inputCatDescripcion')?.value.trim();
        const orden = parseInt(document.getElementById('inputCatOrden')?.value, 10) || 1;
        const activo = document.getElementById('checkCatActivo')?.checked ?? true;

        if (!nombre) {
            this.goToStep(1);
            Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'El nombre de la categoría es obligatorio.' });
            return;
        }

        let imageUrl = null;
        if (this.sourceType === 'url') {
            imageUrl = document.getElementById('inputCatImageUrl')?.value.trim() || null;
        }

        const data = {
            nombre,
            descripcion,
            orden,
            activo
        };

        if (imageUrl) {
            data.imagen = imageUrl;
        }

        try {
            Swal.fire({
                title: this.isEditMode ? 'Actualizando categoría...' : 'Creando categoría...',
                text: 'Guardando datos e imagen en Firebase.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            let res;
            if (this.isEditMode) {
                res = await this.categoriaService.updateCategoria(this.categoriaId, data, this.selectedFile);
            } else {
                res = await this.categoriaService.createCategoria(data, this.selectedFile);
            }

            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo guardar la categoría.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: res.message || 'Categoría guardada correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            window.history.pushState({}, '', '/ecommerce/categorias');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
            console.error('❌ Error guardando categoría:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }
}

export const ecommerceCategoriaFormController = () => {
    const ctrl = new EcommerceCategoriaFormController();
    ctrl.init();
    return ctrl;
};

export default ecommerceCategoriaFormController;
