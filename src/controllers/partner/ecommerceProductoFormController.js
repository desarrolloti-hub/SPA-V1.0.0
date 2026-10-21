/* ==========================================================================
   ECOMMERCE PRODUCTO FORM CONTROLLER - RSI Enterprise
   Controlador para Crear y Editar Productos por Pasos (Stepper) con Galería y Live Preview
   ========================================================================== */

import { EcommerceProductService } from '../../services/ecommerceProductService.js';
import { EcommerceProductModel } from '../../models/ecommerceProductModel.js';
import { CategoriaService } from '../../services/categoriaService.js';
import { MarcaService } from '../../services/marcaService.js';

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args),
    showLoading: () => {},
    close: () => {}
};

export class EcommerceProductoFormController {
    constructor() {
        this.productService = new EcommerceProductService();
        this.categoriaService = new CategoriaService();
        this.marcaService = new MarcaService();

        this.productoId = null;
        this.isEditMode = false;

        this.categorias = [];
        this.marcas = [];

        // Galería
        this.existingImages = []; // [{ url, path, principal: boolean }]
        this.newImageFiles = [];  // [File]
        this.newImagePreviews = []; // [{ file, previewUrl, principal: boolean }]
        this.deletedStoragePaths = [];

        // Ficha PDF
        this.existingPdf = null;
        this.newPdfFile = null;
        this.deleteExistingPdf = false;

        // Estado del Stepper
        this.currentStep = 1;
        this.totalSteps = 4;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.productoId = urlParams.get('id');
        this.isEditMode = Boolean(this.productoId);

        this.initStepNavigation();
        this.initStepIndicators();
        this.bindEvents();

        await this.cargarCatalogos();

        if (this.isEditMode) {
            await this.cargarDatosProducto(this.productoId);
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
            const nombre = document.getElementById('inputProdNombre')?.value.trim();
            const categoriaId = document.getElementById('selectProdCategoria')?.value;
            const marcaId = document.getElementById('selectProdMarca')?.value;

            const errNombre = document.getElementById('errorProdNombre');
            const errCat = document.getElementById('errorProdCat');
            const errMarca = document.getElementById('errorProdMarca');

            let valid = true;

            if (!nombre) {
                if (errNombre) {
                    errNombre.textContent = 'El nombre del producto es obligatorio.';
                    errNombre.style.display = 'block';
                }
                valid = false;
            } else if (errNombre) {
                errNombre.style.display = 'none';
            }

            if (!categoriaId) {
                if (errCat) {
                    errCat.textContent = 'Selecciona una categoría.';
                    errCat.style.display = 'block';
                }
                valid = false;
            } else if (errCat) {
                errCat.style.display = 'none';
            }

            if (!marcaId) {
                if (errMarca) {
                    errMarca.textContent = 'Selecciona una marca.';
                    errMarca.style.display = 'block';
                }
                valid = false;
            } else if (errMarca) {
                errMarca.style.display = 'none';
            }

            if (!valid) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Campos requeridos',
                    text: 'Completa el nombre, categoría y marca antes de continuar.'
                });
                return false;
            }
        }

        if (this.currentStep === 2) {
            const precioRaw = document.getElementById('inputProdPrecio')?.value;
            const stockRaw = document.getElementById('inputProdStock')?.value;

            const errPrecio = document.getElementById('errorProdPrecio');
            const errStock = document.getElementById('errorProdStock');

            let valid = true;

            const precio = parseFloat(precioRaw);
            if (isNaN(precio) || precio < 0) {
                if (errPrecio) {
                    errPrecio.textContent = 'Ingresa un precio válido (mayor o igual a 0).';
                    errPrecio.style.display = 'block';
                }
                valid = false;
            } else if (errPrecio) {
                errPrecio.style.display = 'none';
            }

            const stock = parseInt(stockRaw, 10);
            if (isNaN(stock) || stock < 0) {
                if (errStock) {
                    errStock.textContent = 'Ingresa una cantidad de inventario válida.';
                    errStock.style.display = 'block';
                }
                valid = false;
            } else if (errStock) {
                errStock.style.display = 'none';
            }

            if (!valid) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Valores Inválidos',
                    text: 'Por favor verifica el precio y el inventario del producto.'
                });
                return false;
            }
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
        const form = document.getElementById('formProducto');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Live Preview Inputs
        const inputNombre = document.getElementById('inputProdNombre');
        if (inputNombre) {
            inputNombre.addEventListener('input', () => {
                const slug = EcommerceProductModel.slugify(inputNombre.value);
                const txtSlug = document.getElementById('txtProdSlug');
                if (txtSlug) txtSlug.textContent = slug || 'automático';
                const err = document.getElementById('errorProdNombre');
                if (err && inputNombre.value.trim()) err.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const inputModelo = document.getElementById('inputProdModelo');
        if (inputModelo) inputModelo.addEventListener('input', () => this.actualizarPreview());

        const selectCat = document.getElementById('selectProdCategoria');
        if (selectCat) {
            selectCat.addEventListener('change', () => {
                const err = document.getElementById('errorProdCat');
                if (err && selectCat.value) err.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const selectMarca = document.getElementById('selectProdMarca');
        if (selectMarca) {
            selectMarca.addEventListener('change', () => {
                const err = document.getElementById('errorProdMarca');
                if (err && selectMarca.value) err.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const inputPrecio = document.getElementById('inputProdPrecio');
        if (inputPrecio) {
            inputPrecio.addEventListener('input', () => {
                const err = document.getElementById('errorProdPrecio');
                if (err && inputPrecio.value) err.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const inputStock = document.getElementById('inputProdStock');
        if (inputStock) {
            inputStock.addEventListener('input', () => {
                const err = document.getElementById('errorProdStock');
                if (err && inputStock.value) err.style.display = 'none';
                this.actualizarPreview();
            });
        }

        const selectEstado = document.getElementById('selectProdEstado');
        if (selectEstado) selectEstado.addEventListener('change', () => this.actualizarPreview());

        const checkDestacado = document.getElementById('checkProdDestacado');
        if (checkDestacado) checkDestacado.addEventListener('change', () => this.actualizarPreview());

        // Galería de imágenes (Dropzone y File Input)
        const dropzone = document.getElementById('dropzoneProd');
        const fileInput = document.getElementById('fileProdImages');

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
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.agregarNuevasImagenes(Array.from(e.dataTransfer.files));
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    this.agregarNuevasImagenes(Array.from(fileInput.files));
                    fileInput.value = '';
                }
            });
        }

        // Ficha técnica PDF
        const btnSelectPdf = document.getElementById('btnSelectPdf');
        const filePdfInput = document.getElementById('fileProdPdf');
        const txtPdfNombre = document.getElementById('txtPdfSeleccionado');

        if (btnSelectPdf && filePdfInput) {
            btnSelectPdf.addEventListener('click', () => filePdfInput.click());

            filePdfInput.addEventListener('change', () => {
                if (filePdfInput.files && filePdfInput.files[0]) {
                    const f = filePdfInput.files[0];
                    if (f.type !== 'application/pdf') {
                        Swal.fire({ icon: 'error', title: 'Formato incorrecto', text: 'Solo se admiten documentos PDF.' });
                        return;
                    }
                    if (f.size > 20 * 1024 * 1024) {
                        Swal.fire({ icon: 'warning', title: 'Archivo muy pesado', text: 'El PDF no debe superar 20 MB.' });
                        return;
                    }
                    this.newPdfFile = f;
                    if (txtPdfNombre) txtPdfNombre.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
                }
            });
        }

        const btnEliminarPdf = document.getElementById('btnEliminarPdf');
        if (btnEliminarPdf) {
            btnEliminarPdf.addEventListener('click', () => {
                this.deleteExistingPdf = true;
                const container = document.getElementById('pdfActualContainer');
                if (container) container.style.display = 'none';
                Swal.fire({
                    icon: 'info',
                    title: 'Ficha retirada',
                    text: 'El documento se eliminará definitivamente al guardar el producto.',
                    timer: 1500,
                    showConfirmButton: false
                });
            });
        }
    }

    async cargarCatalogos() {
        try {
            const [cats, marcas] = await Promise.all([
                this.categoriaService.getAllCategorias(true),
                this.marcaService.getAllMarcas(true)
            ]);

            this.categorias = cats || [];
            this.marcas = marcas || [];

            const selectCat = document.getElementById('selectProdCategoria');
            if (selectCat) {
                selectCat.innerHTML = '<option value="">Selecciona una categoría...</option>';
                this.categorias.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    opt.dataset.nombre = c.nombre;
                    selectCat.appendChild(opt);
                });
            }

            const selectMarca = document.getElementById('selectProdMarca');
            if (selectMarca) {
                selectMarca.innerHTML = '<option value="">Selecciona una marca...</option>';
                this.marcas.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.nombre;
                    opt.dataset.nombre = m.nombre;
                    selectMarca.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('❌ Error cargando catálogos de categorías y marcas:', error);
        }
    }

    agregarNuevasImagenes(files) {
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire({ icon: 'warning', title: 'Archivo muy pesado', text: `${file.name} supera 5 MB.` });
                return;
            }

            this.newImageFiles.push(file);

            const reader = new FileReader();
            reader.onload = (e) => {
                const isFirst = this.existingImages.length === 0 && this.newImagePreviews.length === 0;
                this.newImagePreviews.push({
                    file,
                    previewUrl: e.target.result,
                    principal: isFirst
                });
                this.renderGaleriaThumbs();
                this.actualizarPreview();
            };
            reader.readAsDataURL(file);
        });
    }

    renderGaleriaThumbs() {
        const container = document.getElementById('galeriaThumbsContainer');
        if (!container) return;

        container.innerHTML = '';

        // Renderizar existentes
        this.existingImages.forEach((img, idx) => {
            const thumb = this.crearThumbElement(img.url, img.principal, () => {
                // Seleccionar principal
                this.existingImages.forEach(i => i.principal = false);
                this.newImagePreviews.forEach(i => i.principal = false);
                img.principal = true;
                this.renderGaleriaThumbs();
                this.actualizarPreview();
            }, () => {
                // Eliminar
                if (img.path) this.deletedStoragePaths.push(img.path);
                this.existingImages.splice(idx, 1);
                if (img.principal && (this.existingImages.length > 0 || this.newImagePreviews.length > 0)) {
                    if (this.existingImages[0]) this.existingImages[0].principal = true;
                    else if (this.newImagePreviews[0]) this.newImagePreviews[0].principal = true;
                }
                this.renderGaleriaThumbs();
                this.actualizarPreview();
            });
            container.appendChild(thumb);
        });

        // Renderizar nuevas
        this.newImagePreviews.forEach((item, idx) => {
            const thumb = this.crearThumbElement(item.previewUrl, item.principal, () => {
                this.existingImages.forEach(i => i.principal = false);
                this.newImagePreviews.forEach(i => i.principal = false);
                item.principal = true;
                this.renderGaleriaThumbs();
                this.actualizarPreview();
            }, () => {
                this.newImagePreviews.splice(idx, 1);
                const fileIdx = this.newImageFiles.indexOf(item.file);
                if (fileIdx > -1) this.newImageFiles.splice(fileIdx, 1);

                if (item.principal && (this.existingImages.length > 0 || this.newImagePreviews.length > 0)) {
                    if (this.existingImages[0]) this.existingImages[0].principal = true;
                    else if (this.newImagePreviews[0]) this.newImagePreviews[0].principal = true;
                }
                this.renderGaleriaThumbs();
                this.actualizarPreview();
            });
            container.appendChild(thumb);
        });
    }

    crearThumbElement(src, esPrincipal, onSelectPrincipal, onDelete) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: relative;
            width: 80px;
            height: 80px;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid ${esPrincipal ? 'var(--rsi-gold, #c5a059)' : 'var(--rsi-gray-300)'};
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            background: #fff;
        `;

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Thumb';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
        img.title = esPrincipal ? 'Imagen principal' : 'Clic para hacerla principal';
        img.addEventListener('click', onSelectPrincipal);
        div.appendChild(img);

        if (esPrincipal) {
            const badge = document.createElement('span');
            badge.textContent = '★';
            badge.title = 'Principal';
            badge.style.cssText = `
                position: absolute;
                top: 2px;
                left: 2px;
                background: var(--rsi-gold, #c5a059);
                color: #fff;
                font-size: 11px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            `;
            div.appendChild(badge);
        }

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.innerHTML = '&times;';
        btnDel.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            background: rgba(239, 68, 68, 0.85);
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            cursor: pointer;
            font-size: 13px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        btnDel.addEventListener('click', onDelete);
        div.appendChild(btnDel);

        return div;
    }

    obtenerImagenPrincipalUrl() {
        const principalExist = this.existingImages.find(i => i.principal);
        if (principalExist) return principalExist.url;

        const principalNueva = this.newImagePreviews.find(i => i.principal);
        if (principalNueva) return principalNueva.previewUrl;

        if (this.existingImages[0]) return this.existingImages[0].url;
        if (this.newImagePreviews[0]) return this.newImagePreviews[0].previewUrl;

        return null;
    }

    actualizarPreview() {
        const nombre = document.getElementById('inputProdNombre')?.value.trim() || 'Nombre del Producto';
        const modelo = document.getElementById('inputProdModelo')?.value.trim() || 'Mod: N/A';
        const precio = parseFloat(document.getElementById('inputProdPrecio')?.value) || 0;
        const stock = parseInt(document.getElementById('inputProdStock')?.value, 10) || 0;
        const estado = document.getElementById('selectProdEstado')?.value || 'publicado';
        const destacado = document.getElementById('checkProdDestacado')?.checked ?? false;

        const selCat = document.getElementById('selectProdCategoria');
        const catNombre = selCat?.options[selCat.selectedIndex]?.textContent || 'CATEGORÍA';

        const selMarca = document.getElementById('selectProdMarca');
        const marcaNombre = selMarca?.options[selMarca.selectedIndex]?.textContent || 'MARCA';

        const pTitulo = document.getElementById('previewProdTitulo');
        const pModelo = document.getElementById('previewProdModelo');
        const pPrecio = document.getElementById('previewProdPrecio');
        const pStock = document.getElementById('previewProdStock');
        const pCat = document.getElementById('previewProdCat');
        const pMarca = document.getElementById('previewProdMarca');
        const pBadgeEstado = document.getElementById('previewProdBadgeEstado');
        const pBadgeDest = document.getElementById('previewProdBadgeDestacado');
        const pImg = document.getElementById('previewProdImg');
        const pPlaceholder = document.getElementById('previewProdPlaceholder');

        if (pTitulo) pTitulo.textContent = nombre;
        if (pModelo) pModelo.textContent = `Mod: ${modelo}`;
        if (pPrecio) pPrecio.textContent = `$${precio.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
        if (pStock) {
            pStock.className = `rsi-badge ${stock > 0 ? 'rsi-badge-success' : 'rsi-badge-danger'}`;
            pStock.textContent = stock > 0 ? `${stock} en stock` : 'Agotado';
        }
        if (pCat) pCat.textContent = catNombre.toUpperCase();
        if (pMarca) pMarca.textContent = marcaNombre.toUpperCase();

        if (pBadgeEstado) {
            pBadgeEstado.className = `rsi-badge ${estado === 'publicado' ? 'rsi-badge-primary' : (estado === 'borrador' ? 'rsi-badge-secondary' : 'rsi-badge-danger')}`;
            pBadgeEstado.textContent = estado === 'publicado' ? 'Publicado' : (estado === 'borrador' ? 'Borrador' : 'Desactivado');
        }

        if (pBadgeDest) {
            pBadgeDest.style.display = destacado ? 'inline-flex' : 'none';
        }

        const mainUrl = this.obtenerImagenPrincipalUrl();
        if (pImg && pPlaceholder) {
            if (mainUrl) {
                pImg.src = mainUrl;
                pImg.style.display = 'block';
                pPlaceholder.style.display = 'none';
            } else {
                pImg.style.display = 'none';
                pPlaceholder.style.display = 'block';
            }
        }
    }

    async cargarDatosProducto(id) {
        try {
            Swal.fire({
                title: 'Cargando producto...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const prod = await this.productService.getProductById(id);
            Swal.close();

            if (!prod) {
                await Swal.fire({
                    icon: 'error',
                    title: 'No encontrado',
                    text: 'El producto solicitado no existe o fue eliminado.'
                });
                window.history.pushState({}, '', '/ecommerce/productos');
                window.dispatchEvent(new PopStateEvent('popstate'));
                return;
            }

            const txtAccion = document.getElementById('txtAccionTituloProd');
            const badgeModo = document.getElementById('badgeModoProd');
            const btnGuardar = document.getElementById('btnGuardarProducto');

            if (txtAccion) txtAccion.textContent = 'Editar';
            if (badgeModo) badgeModo.innerHTML = `<i class="fas fa-edit"></i> Editando: ${prod.nombre}`;
            if (btnGuardar) btnGuardar.innerHTML = `<i class="fas fa-save"></i> Guardar Cambios`;

            document.getElementById('productoDocId').value = prod.id;
            document.getElementById('inputProdNombre').value = prod.nombre || '';
            document.getElementById('txtProdSlug').textContent = prod.slug || '';
            document.getElementById('inputProdModelo').value = prod.modelo || '';
            document.getElementById('inputProdCodigo').value = prod.codigoInterno || '';

            if (prod.categoriaId) {
                document.getElementById('selectProdCategoria').value = prod.categoriaId;
            }
            if (prod.marcaId) {
                document.getElementById('selectProdMarca').value = prod.marcaId;
            }

            document.getElementById('inputProdPrecio').value = prod.precio ?? '';
            document.getElementById('inputProdStock').value = prod.stock ?? 10;
            document.getElementById('selectProdEstado').value = prod.estado || 'publicado';
            document.getElementById('checkProdDestacado').checked = Boolean(prod.destacado);

            document.getElementById('inputProdDescripcion').value = prod.descripcion || '';
            if (Array.isArray(prod.caracteristicas)) {
                document.getElementById('inputProdCaracteristicas').value = prod.caracteristicas.join('\n');
            }

            document.getElementById('inputProdClaveSat').value = prod.claveSat || '43211500';
            document.getElementById('inputProdDescSat').value = prod.descripcionSat || '';
            document.getElementById('inputProdUnidadSat').value = prod.claveUnidadSat || 'H87';

            // Imágenes existentes
            this.existingImages = Array.isArray(prod.imagenes) ? [...prod.imagenes] : [];
            this.renderGaleriaThumbs();

            // Ficha técnica PDF existente
            if (prod.fichaTecnicaPdf?.url) {
                this.existingPdf = prod.fichaTecnicaPdf;
                const container = document.getElementById('pdfActualContainer');
                const nombreEl = document.getElementById('pdfActualNombre');
                const tamanoEl = document.getElementById('pdfActualTamano');
                const linkVer = document.getElementById('linkVerPdf');

                if (container && nombreEl && tamanoEl && linkVer) {
                    nombreEl.textContent = prod.fichaTecnicaPdf.nombre || 'ficha_tecnica.pdf';
                    tamanoEl.textContent = `${((prod.fichaTecnicaPdf.tamano || 0) / 1024).toFixed(1)} KB`;
                    linkVer.href = prod.fichaTecnicaPdf.url;
                    container.style.display = 'flex';
                }
            }

            this.actualizarPreview();
        } catch (error) {
            console.error('❌ Error cargando producto:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const nombre = document.getElementById('inputProdNombre')?.value.trim();
        const categoriaId = document.getElementById('selectProdCategoria')?.value;
        const marcaId = document.getElementById('selectProdMarca')?.value;

        const selCat = document.getElementById('selectProdCategoria');
        const categoriaNombre = selCat?.options[selCat.selectedIndex]?.dataset.nombre || '';

        const selMarca = document.getElementById('selectProdMarca');
        const marcaNombre = selMarca?.options[selMarca.selectedIndex]?.dataset.nombre || '';

        const precio = parseFloat(document.getElementById('inputProdPrecio')?.value);
        const stock = parseInt(document.getElementById('inputProdStock')?.value, 10);
        const estado = document.getElementById('selectProdEstado')?.value || 'publicado';
        const destacado = document.getElementById('checkProdDestacado')?.checked ?? false;

        const modelo = document.getElementById('inputProdModelo')?.value.trim();
        const codigoInterno = document.getElementById('inputProdCodigo')?.value.trim();
        const descripcion = document.getElementById('inputProdDescripcion')?.value.trim();

        const rawCaract = document.getElementById('inputProdCaracteristicas')?.value || '';
        const caracteristicas = rawCaract.split('\n').map(c => c.trim()).filter(Boolean);

        const claveSat = document.getElementById('inputProdClaveSat')?.value.trim() || '43211500';
        const descripcionSat = document.getElementById('inputProdDescSat')?.value.trim() || 'Equipos de seguridad y telecomunicaciones';
        const claveUnidadSat = document.getElementById('inputProdUnidadSat')?.value.trim() || 'H87';

        if (!nombre || !categoriaId || !marcaId) {
            this.goToStep(1);
            Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Revisa los campos del Paso 1 (Nombre, Categoría y Marca).' });
            return;
        }

        if (isNaN(precio) || isNaN(stock)) {
            this.goToStep(2);
            Swal.fire({ icon: 'warning', title: 'Valores numéricos requeridos', text: 'Revisa los campos del Paso 2 (Precio y Stock).' });
            return;
        }

        const data = {
            nombre,
            categoriaId,
            categoriaNombre,
            marcaId,
            marcaNombre,
            precio,
            stock,
            estado,
            destacado,
            modelo,
            codigoInterno,
            descripcion,
            caracteristicas,
            claveSat,
            descripcionSat,
            claveUnidadSat,
            imagenesExistentes: this.existingImages,
            deletedStoragePaths: this.deletedStoragePaths,
            eliminarPdf: this.deleteExistingPdf
        };

        try {
            Swal.fire({
                title: this.isEditMode ? 'Actualizando producto...' : 'Creando producto...',
                text: 'Subiendo archivos e indexando en Firebase.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            let res;
            if (this.isEditMode) {
                res = await this.productService.updateProduct(this.productoId, data, this.newImageFiles, this.newPdfFile);
            } else {
                res = await this.productService.createProduct(data, this.newImageFiles, this.newPdfFile);
            }

            if (!res.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo guardar el producto.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: res.message || 'Producto guardado correctamente.',
                timer: 1600,
                showConfirmButton: false
            });

            window.history.pushState({}, '', '/ecommerce/productos');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (error) {
            console.error('❌ Error guardando producto:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message });
        }
    }
}

export const ecommerceProductoFormController = () => {
    const ctrl = new EcommerceProductoFormController();
    ctrl.init();
    return ctrl;
};

export default ecommerceProductoFormController;
