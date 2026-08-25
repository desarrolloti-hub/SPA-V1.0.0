/* ========================================
   TICKET CONTROLLER
   Controlador para crear y editar tickets
   ======================================== */

import TicketService from '../../services/ticketService.js';

let service = null;
let currentStep = 1;
const totalSteps = 3;
let eventListeners = [];
let editingDocId = null;
let isEditMode = false;
let originalData = {};
let selectedTicketType = 'operativo';
let colaboradoresCargados = [];
let clientesCargados = [];
let colaboradoresSeleccionados = [];

/**
 * Obtiene el formulario del DOM
 */
function getForm() {
    const form = document.getElementById('ticketForm');
    if (form && form instanceof HTMLFormElement) {
        return form;
    }
    console.error('❌ No se encontró el formulario con ID "ticketForm"');
    return null;
}

/**
 * Obtiene el valor de un campo del formulario
 */
function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

/**
 * Controlador principal
 */
export async function ticketController() {
    console.log('🎫 Ticket Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    const form = getForm();
    if (!form) {
        console.error('❌ No se encontró el formulario');
        return;
    }
    
    service = new TicketService();
    currentStep = 1;
    
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');
    
    if (docId) {
        editingDocId = docId;
        isEditMode = true;
        console.log('✏️ Modo edición - Ticket ID:', editingDocId);
    }
    
    await loadInitialData();
    
    initTypeSelector();
    initStepNavigation();
    initFieldValidation();
    initSubmitHandler();
    initStepIndicators();
    initColaboradoresSearch();
    initClientesSelect();
    initFechaValidation();
    
    if (isEditMode && editingDocId) {
        await loadTicketData(editingDocId);
        updateTitles();
        goToStep(1);
    } else {
        updateTitles();
        showStep(1);
        const today = new Date().toISOString().split('T')[0];
        const fechaInicio = document.getElementById('fechaInicio');
        if (fechaInicio) {
            fechaInicio.min = today;
            fechaInicio.value = today;
        }
        const fechaFin = document.getElementById('fechaFin');
        if (fechaFin) {
            fechaFin.min = today;
        }
    }
    
    console.log(`✅ Ticket Controller listo (${isEditMode ? 'Edición' : 'Creación'})`);
}

/**
 * Carga datos iniciales (colaboradores y clientes)
 */
async function loadInitialData() {
    try {
        const colaboradores = await service.getColaboradoresForSelect();
        colaboradoresCargados = colaboradores;
        console.log(`✅ ${colaboradores.length} colaboradores cargados`);
        
        const clientes = await service.getClientesForSelect();
        clientesCargados = clientes;
        console.log(`✅ ${clientes.length} clientes cargados`);
        
        cargarClientesEnSelect();
        
    } catch (error) {
        console.error('❌ Error cargando datos iniciales:', error);
    }
}

/**
 * Carga clientes en el select
 */
function cargarClientesEnSelect() {
    const select = document.getElementById('clienteId');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccione un cliente</option>';
    clientesCargados.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        select.appendChild(option);
    });
}

/**
 * Obtener iniciales para avatar de fallback
 */
function getInitials(nombre) {
    if (!nombre) return '?';
    const parts = nombre.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
}

/**
 * Inicializa el buscador de colaboradores con autocomplete y tags mejorado
 */
function initColaboradoresSearch() {
    const input = document.getElementById('colaboradorSearch');
    const container = document.getElementById('colaboradoresTags');
    const suggestions = document.getElementById('colaboradorSuggestions');
    const wrapper = document.querySelector('.rsi-colaboradores-search-container');
    
    if (!input || !container) return;
    
    let selectedIndex = -1;
    
    const filterColaboradores = (searchTerm) => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return [];
        
        const seleccionadosIds = colaboradoresSeleccionados.map(c => c.id);
        
        return colaboradoresCargados.filter(c => {
            const nombre = (c.nombre || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            const match = nombre.includes(term) || email.includes(term);
            return match && !seleccionadosIds.includes(c.id);
        }).slice(0, 8);
    };
    
    const showSuggestions = (results) => {
        if (!suggestions) return;
        
        if (results.length === 0) {
            suggestions.innerHTML = `
                <div class="rsi-suggestion-empty">
                    <i class="fas fa-search"></i>
                    <span>No se encontraron colaboradores</span>
                </div>
            `;
            suggestions.style.display = 'block';
            return;
        }
        
        suggestions.innerHTML = results.map((col, index) => {
            const fotoHtml = col.fotoPerfil 
                ? `<img src="${col.fotoPerfil}" alt="${col.nombre}" class="rsi-suggestion-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const fallbackHtml = !col.fotoPerfil ? `<span class="rsi-suggestion-avatar-fallback">${getInitials(col.nombre)}</span>` : '';
            
            return `
                <div class="rsi-suggestion-item" data-id="${col.id}" data-index="${index}">
                    <div class="rsi-suggestion-avatar">
                        ${fotoHtml}
                        ${fallbackHtml}
                        ${col.fotoPerfil ? `<span class="rsi-suggestion-avatar-fallback" style="display:none;">${getInitials(col.nombre)}</span>` : ''}
                    </div>
                    <div class="rsi-suggestion-info">
                        <strong>${col.nombre}</strong>
                        <div class="rsi-suggestion-details">
                            ${col.area ? `<span class="rsi-suggestion-area"><i class="fas fa-building"></i> ${col.area}</span>` : ''}
                            ${col.email ? `<span class="rsi-suggestion-email"><i class="fas fa-envelope"></i> ${col.email}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="rsi-suggestion-add" data-id="${col.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        suggestions.style.display = 'block';
        selectedIndex = -1;
        
        suggestions.querySelectorAll('.rsi-suggestion-item').forEach(item => {
            const handler = (e) => {
                const id = item.dataset.id;
                const col = colaboradoresCargados.find(c => c.id === id);
                if (col) {
                    agregarColaborador(col.id, col.nombre, col.area, col.email, col.fotoPerfil);
                    suggestions.style.display = 'none';
                    input.value = '';
                    input.focus();
                    updateResumen();
                }
                e.stopPropagation();
            };
            item.addEventListener('click', handler);
            eventListeners.push({ element: item, event: 'click', handler });
        });
        
        suggestions.querySelectorAll('.rsi-suggestion-add').forEach(btn => {
            const handler = (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const col = colaboradoresCargados.find(c => c.id === id);
                if (col) {
                    agregarColaborador(col.id, col.nombre, col.area, col.email, col.fotoPerfil);
                    suggestions.style.display = 'none';
                    input.value = '';
                    input.focus();
                    updateResumen();
                }
            };
            btn.addEventListener('click', handler);
            eventListeners.push({ element: btn, event: 'click', handler });
        });
    };
    
    const agregarColaborador = (id, nombre, area, email, fotoPerfil) => {
        if (colaboradoresSeleccionados.find(c => c.id === id)) return;
        
        colaboradoresSeleccionados.push({ id, nombre, area, email, fotoPerfil });
        renderTags();
        actualizarArea();
        updateResumen();
        
        const tag = container.querySelector(`.rsi-tag-item[data-id="${id}"]`);
        if (tag) {
            tag.style.animation = 'none';
            setTimeout(() => {
                tag.style.animation = 'tagFadeIn 0.3s ease';
            }, 10);
        }
    };
    
    const renderTags = () => {
        if (!container) return;
        
        if (colaboradoresSeleccionados.length === 0) {
            container.innerHTML = `
                <div class="rsi-tags-empty">
                    <i class="fas fa-user-plus"></i>
                    <span>Busca y selecciona colaboradores</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = colaboradoresSeleccionados.map((col, index) => {
            const fotoHtml = col.fotoPerfil 
                ? `<img src="${col.fotoPerfil}" alt="${col.nombre}" class="rsi-tag-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const fallbackHtml = !col.fotoPerfil ? `<span class="rsi-tag-avatar-fallback">${getInitials(col.nombre)}</span>` : '';
            
            return `
                <div class="rsi-tag-item" data-id="${col.id}" style="animation-delay: ${index * 0.05}s">
                    <div class="rsi-tag-avatar">
                        ${fotoHtml}
                        ${fallbackHtml}
                        ${col.fotoPerfil ? `<span class="rsi-tag-avatar-fallback" style="display:none;">${getInitials(col.nombre)}</span>` : ''}
                    </div>
                    <span class="rsi-tag-name">${col.nombre}</span>
                    ${col.area ? `<span class="rsi-tag-area">${col.area}</span>` : ''}
                    ${index === 0 ? '<span class="rsi-tag-badge">Responsable</span>' : ''}
                    <button type="button" class="rsi-tag-remove" data-id="${col.id}" title="Eliminar colaborador">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.rsi-tag-remove').forEach(btn => {
            const handler = (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const col = colaboradoresSeleccionados.find(c => c.id === id);
                colaboradoresSeleccionados = colaboradoresSeleccionados.filter(c => c.id !== id);
                renderTags();
                actualizarArea();
                updateResumen();
                const searchInput = document.getElementById('colaboradorSearch');
                if (searchInput) searchInput.focus();
                
                if (col) {
                    showToast(`${col.nombre} eliminado`, 'info');
                }
            };
            btn.addEventListener('click', handler);
            eventListeners.push({ element: btn, event: 'click', handler });
        });
    };
    
    let debounceTimer;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const term = e.target.value;
        
        if (term.length > 0) {
            suggestions.innerHTML = `
                <div class="rsi-suggestion-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Buscando...</span>
                </div>
            `;
            suggestions.style.display = 'block';
        }
        
        debounceTimer = setTimeout(() => {
            const results = filterColaboradores(term);
            showSuggestions(results);
        }, 300);
    });
    
    document.addEventListener('click', (e) => {
        if (suggestions && wrapper && !wrapper.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
    
    input.addEventListener('keydown', (e) => {
        const items = suggestions.querySelectorAll('.rsi-suggestion-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelectedItem(items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedItem(items);
            }
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && items.length > 0) {
                items[selectedIndex].click();
                e.preventDefault();
            }
        } else if (e.key === 'Escape') {
            suggestions.style.display = 'none';
            input.blur();
        }
    });
    
    const updateSelectedItem = (items) => {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
            if (index === selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    };
    
    input.addEventListener('focus', () => {
        if (input.value.length > 0) {
            const results = filterColaboradores(input.value);
            showSuggestions(results);
        }
    });
    
    renderTags();
    
    if (window._colaboradoresPrecargados) {
        window._colaboradoresPrecargados.forEach(col => {
            agregarColaborador(col.id, col.nombre, col.area, col.email, col.fotoPerfil);
        });
        window._colaboradoresPrecargados = null;
    }
}

/**
 * Muestra un toast de notificación
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `rsi-toast rsi-toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'info' ? 'fa-info-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
/**
 * Inicializa el select de clientes
 */
function initClientesSelect() {
    const select = document.getElementById('clienteId');
    if (!select) return;
    
    select.addEventListener('change', (e) => {
        const value = e.target.value;
        loadClienteData(value);
        updateResumen();
    });
}

/**
 * Carga datos del cliente seleccionado
 */
function loadClienteData(clienteId) {
    const cliente = clientesCargados.find(c => c.id === clienteId);
    if (!cliente) {
        document.getElementById('clienteNombre').value = '';
        document.getElementById('rfc').value = '';
        document.getElementById('atencionA').value = '';
        document.getElementById('correo').value = '';
        return;
    }
    
    document.getElementById('clienteNombre').value = cliente.nombre || '';
    document.getElementById('rfc').value = cliente.rfc || '';
    document.getElementById('atencionA').value = cliente.contacto || '';
    document.getElementById('correo').value = cliente.correo || '';
    
    updateResumen();
}

/**
 * Inicializa validación de fechas
 */
function initFechaValidation() {
    const fechaInicio = document.getElementById('fechaInicio');
    const fechaFin = document.getElementById('fechaFin');
    
    if (fechaInicio) {
        fechaInicio.addEventListener('change', () => {
            if (fechaFin && fechaInicio.value) {
                fechaFin.min = fechaInicio.value;
                if (fechaFin.value && fechaFin.value < fechaInicio.value) {
                    fechaFin.value = '';
                }
            }
            validateField(fechaInicio);
            updateResumen();
        });
    }
    
    if (fechaFin) {
        fechaFin.addEventListener('change', () => {
            validateField(fechaFin);
            updateResumen();
        });
    }
}

/**
 * Inicializa el selector de tipo de ticket
 */
function initTypeSelector() {
    document.querySelectorAll('.rsi-ticket-type-btn').forEach(btn => {
        const handler = () => {
            const type = btn.dataset.type;
            if (type) {
                selectTicketType(type);
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

/**
 * Selecciona el tipo de ticket
 */
function selectTicketType(type) {
    selectedTicketType = type;
    
    document.querySelectorAll('.rsi-ticket-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    const operativoFields = document.getElementById('operativoFields');
    const adminFields = document.getElementById('adminFields');
    
    if (operativoFields) {
        operativoFields.style.display = type === 'operativo' ? 'block' : 'none';
    }
    if (adminFields) {
        adminFields.style.display = type === 'administracion' ? 'block' : 'none';
    }
    
    const title = document.getElementById('formTitle');
    if (title) {
        title.textContent = type === 'operativo' 
            ? 'Datos del Ticket Operativo' 
            : 'Datos del Ticket Administración';
    }
    
    if (type === 'administracion') {
        const clienteSelect = document.getElementById('clienteId');
        if (clienteSelect) {
            clienteSelect.removeAttribute('required');
        }
        document.getElementById('clienteNombre').value = '';
        document.getElementById('rfc').value = '';
        document.getElementById('atencionA').value = '';
        document.getElementById('correo').value = '';
    } else {
        const clienteSelect = document.getElementById('clienteId');
        if (clienteSelect) {
            clienteSelect.setAttribute('required', 'required');
        }
    }
    
    updateResumen();
}

/**
 * Inicializa la navegación por pasos
 */
function initStepNavigation() {
    document.querySelectorAll('.rsi-btn-next').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const nextStep = parseInt(btn.dataset.next);
            if (!isNaN(nextStep) && validateCurrentStep()) {
                goToStep(nextStep);
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });

    document.querySelectorAll('.rsi-btn-prev').forEach(btn => {
        const handler = (e) => {
            e.preventDefault();
            const prevStep = parseInt(btn.dataset.prev);
            if (!isNaN(prevStep)) {
                goToStep(prevStep);
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

/**
 * Inicializa la validación de campos
 */
function initFieldValidation() {
    document.querySelectorAll('.rsi-form-group input, .rsi-form-group textarea, .rsi-form-group select').forEach(input => {
        const blurHandler = () => validateField(input);
        input.addEventListener('blur', blurHandler);
        eventListeners.push({ element: input, event: 'blur', handler: blurHandler });
        
        const inputHandler = () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
            if (input.id === 'titulo' || input.id === 'prioridad' || input.id === 'clienteId') {
                updateResumen();
            }
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

/**
 * Valida un campo
 */
function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    
    if (isRequired && !value) {
        showFieldError(input, 'Este campo es requerido');
        return false;
    }

    const validations = {
        fechaInicio: {
            test: (v) => {
                if (!v) return true;
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const fecha = new Date(v);
                return fecha >= hoy;
            },
            msg: 'La fecha de inicio no puede ser anterior a hoy'
        },
        fechaFin: {
            test: (v) => {
                if (!v) return true;
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const fecha = new Date(v);
                if (fecha < hoy) return false;
                
                const fechaInicio = document.getElementById('fechaInicio');
                if (fechaInicio && fechaInicio.value) {
                    const inicio = new Date(fechaInicio.value);
                    inicio.setHours(0, 0, 0, 0);
                    if (fecha < inicio) return false;
                }
                return true;
            },
            msg: 'La fecha de finalización no puede ser anterior a hoy o a la fecha de inicio'
        }
    };

    if (validations[input.id]) {
        const validation = validations[input.id];
        if (value.length > 0 && !validation.test(value)) {
            showFieldError(input, validation.msg);
            return false;
        }
    }

    clearFieldError(input);
    return true;
}

/**
 * Muestra error en campo
 */
function showFieldError(input, message) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.add('error');
    const errorMsg = group.querySelector('.rsi-form-error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
    }
}

/**
 * Limpia error de campo
 */
function clearFieldError(input) {
    const group = input.closest('.rsi-form-group');
    if (!group) return;

    group.classList.remove('error');
    const errorMsg = group.querySelector('.rsi-form-error-message');
    if (errorMsg) {
        errorMsg.textContent = '';
    }
}

/**
 * Inicializa el envío del formulario
 */
function initSubmitHandler() {
    const submitBtn = document.getElementById('submitTicket');
    if (!submitBtn) return;

    const handler = async (e) => {
        e.preventDefault();
        await handleSubmit();
    };
    
    submitBtn.addEventListener('click', handler);
    eventListeners.push({ element: submitBtn, event: 'click', handler });
}

/**
 * Inicializa los indicadores de pasos
 */
function initStepIndicators() {
    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const handler = () => {
            const step = parseInt(dot.dataset.step);
            if (!isNaN(step) && step < currentStep) {
                goToStep(step);
            }
        };
        dot.addEventListener('click', handler);
        eventListeners.push({ element: dot, event: 'click', handler });
    });
}

/**
 * Navega a un paso
 */
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    currentStep = step;
    updateUI(step);
}

/**
 * Muestra un paso específico
 */
function showStep(step) {
    goToStep(step);
}

/**
 * Actualiza la UI según el paso actual
 */
function updateUI(step) {
    document.querySelectorAll('.rsi-step-panel').forEach(panel => {
        const panelStep = parseInt(panel.dataset.step);
        panel.classList.toggle('active', panelStep === step);
        if (panelStep === step) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });

    document.querySelectorAll('.rsi-step-number').forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        
        if (dotStep === step) {
            dot.classList.add('active');
        } else if (dotStep < step) {
            dot.classList.add('completed');
        }
    });

    document.querySelectorAll('.rsi-step-label').forEach(label => {
        const labelStep = parseInt(label.dataset.step);
        label.classList.remove('active', 'completed');
        
        if (labelStep === step) {
            label.classList.add('active');
        } else if (labelStep < step) {
            label.classList.add('completed');
        }
    });

    document.querySelectorAll('.rsi-step-line').forEach(line => {
        const lineStep = parseInt(line.dataset.step);
        line.classList.remove('active', 'completed');
        
        if (lineStep < step) {
            line.classList.add('completed');
        } else if (lineStep === step && step < totalSteps) {
            line.classList.add('active');
        }
    });

    document.querySelectorAll('.rsi-step-counter span').forEach(span => {
        span.textContent = step;
    });
}

/**
 * Valida el paso actual
 */
function validateCurrentStep() {
    const currentPanel = document.querySelector(`.rsi-step-panel[data-step="${currentStep}"]`);
    if (!currentPanel) return true;

    if (currentStep === 2) {
        if (colaboradoresSeleccionados.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Colaboradores requeridos',
                text: 'Debes seleccionar al menos un colaborador para asignar el ticket.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#d33'
            });
            return false;
        }
        return true;
    }

    if (currentStep === 1) {
        const inputs = currentPanel.querySelectorAll('[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (selectedTicketType === 'administracion' && input.id === 'clienteId') {
                return;
            }
            if (!validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    const inputs = currentPanel.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Actualiza el resumen del ticket
 */
function updateResumen() {
    const titulo = document.getElementById('titulo')?.value || '-';
    const prioridad = document.getElementById('prioridad')?.value || 'media';
    
    const clienteSelect = document.getElementById('clienteId');
    let clienteNombre = '-';
    if (clienteSelect) {
        if (clienteSelect.selectedIndex >= 0) {
            const selectedOption = clienteSelect.options[clienteSelect.selectedIndex];
            if (selectedOption && selectedOption.value) {
                clienteNombre = selectedOption.text || '-';
            }
        }
    }
    
    const clienteNombreInput = document.getElementById('clienteNombre');
    if (clienteNombreInput && clienteNombreInput.value) {
        clienteNombre = clienteNombreInput.value;
    }
    
    const fechaInicio = document.getElementById('fechaInicio')?.value || '-';
    const fechaFin = document.getElementById('fechaFin')?.value || '-';
    
    const prioridadLabel = {
        'alta': '🔴 Alta',
        'media': '🟡 Media',
        'baja': '🟢 Baja'
    }[prioridad] || prioridad;
    
    const resumenTitulo = document.getElementById('resumenTitulo');
    const resumenPrioridad = document.getElementById('resumenPrioridad');
    const resumenTipo = document.getElementById('resumenTipo');
    const resumenCliente = document.getElementById('resumenCliente');
    const resumenFechas = document.getElementById('resumenFechas');
    const resumenColaboradores = document.getElementById('resumenColaboradores');
    
    if (resumenTitulo) resumenTitulo.textContent = titulo;
    if (resumenPrioridad) resumenPrioridad.textContent = prioridadLabel;
    if (resumenTipo) resumenTipo.textContent = selectedTicketType === 'operativo' ? 'Operativo' : 'Administración';
    if (resumenCliente) {
        if (selectedTicketType === 'administracion') {
            resumenCliente.textContent = 'N/A';
        } else {
            resumenCliente.textContent = clienteNombre || 'N/A';
        }
    }
    if (resumenFechas) resumenFechas.textContent = `Inicio: ${fechaInicio} | Fin: ${fechaFin}`;
    if (resumenColaboradores) {
        resumenColaboradores.textContent = `${colaboradoresSeleccionados.length} colaborador(es)`;
    }
}

/**
 * Actualiza los títulos del formulario
 */
function updateTitles() {
    const pageTitle = document.querySelector('.rsi-page-title');
    const submitBtn = document.getElementById('submitTicket');
    
    if (isEditMode) {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Editar</span> Ticket`;
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Ticket';
        }
    } else {
        if (pageTitle) {
            pageTitle.innerHTML = `<span class="rsi-text-gold">Nuevo</span> Ticket`;
        }
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-ticket-alt"></i> Crear Ticket';
        }
    }
}

/**
 * Carga los datos de un ticket para edición
 */
async function loadTicketData(docId) {
    try {
        const ticket = await service.getTicketById(docId);
        if (!ticket) {
            throw new Error('Ticket no encontrado');
        }

        originalData = ticket;
        console.log('📋 Datos del ticket cargados:', ticket);

        selectTicketType(ticket.tipo || 'operativo');

        document.getElementById('titulo').value = ticket.titulo || '';
        document.getElementById('descripcion').value = ticket.descripcion || '';
        document.getElementById('prioridad').value = ticket.prioridad || 'media';
        document.getElementById('estado').value = ticket.estado || 'pendiente';
        document.getElementById('area').value = ticket.area || '';
        document.getElementById('fechaInicio').value = ticket.fechaInicio || '';
        document.getElementById('fechaFin').value = ticket.fechaFin || '';
        
        if (ticket.colaboradoresIds && ticket.colaboradoresIds.length > 0) {
            const colaboradoresPre = colaboradoresCargados.filter(c => 
                ticket.colaboradoresIds.includes(c.id)
            );
            
            window._colaboradoresPrecargados = colaboradoresPre;
            colaboradoresSeleccionados = colaboradoresPre;
            
            const container = document.getElementById('colaboradoresTags');
            if (container) {
                renderTags();
                actualizarArea();
            }
        }
        
        if (ticket.tipo === 'operativo') {
            const clienteSelect = document.getElementById('clienteId');
            if (clienteSelect && ticket.clienteId) {
                clienteSelect.value = ticket.clienteId;
                loadClienteData(ticket.clienteId);
            }
            
            document.getElementById('ordenServicio').value = ticket.ordenServicio || '';
            document.getElementById('proyecto').value = ticket.proyecto || '';
            document.getElementById('servicio').value = ticket.servicio || '';
            
            if (ticket.sistemas) {
                document.querySelectorAll('input[name="sistemas"]').forEach(cb => {
                    cb.checked = ticket.sistemas.includes(cb.value);
                });
            }
        } else {
            document.getElementById('clienteId').value = '';
            document.getElementById('clienteNombre').value = '';
            document.getElementById('rfc').value = '';
            document.getElementById('atencionA').value = '';
            document.getElementById('correo').value = '';
            document.getElementById('fechaFinalizacionEstimada').value = ticket.fechaFinalizacionEstimada || '';
        }

        document.querySelectorAll('.rsi-ticket-type-btn').forEach(btn => {
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
        });

        updateResumen();
        console.log('✅ Formulario llenado con datos del ticket');

    } catch (error) {
        console.error('❌ Error cargando ticket:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el ticket para edición: ' + error.message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        }).then(() => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('/partner/crudTickets');
            } else {
                window.location.href = '/partner/crudTickets';
            }
        });
    }
}

/**
 * Renderiza los tags de colaboradores seleccionados
 */
function renderTags() {
    const container = document.getElementById('colaboradoresTags');
    if (!container) return;
    
    if (colaboradoresSeleccionados.length === 0) {
        container.innerHTML = `
            <div class="rsi-tags-empty">
                <i class="fas fa-user-plus"></i>
                <span>Busca y selecciona colaboradores</span>
            </div>
        `;
        return;
    }
    
    container.innerHTML = colaboradoresSeleccionados.map((col, index) => {
        const fotoHtml = col.fotoPerfil 
            ? `<img src="${col.fotoPerfil}" alt="${col.nombre}" class="rsi-tag-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        const fallbackHtml = !col.fotoPerfil ? `<span class="rsi-tag-avatar-fallback">${getInitials(col.nombre)}</span>` : '';
        
        return `
            <div class="rsi-tag-item" data-id="${col.id}" style="animation-delay: ${index * 0.05}s">
                <div class="rsi-tag-avatar">
                    ${fotoHtml}
                    ${fallbackHtml}
                    ${col.fotoPerfil ? `<span class="rsi-tag-avatar-fallback" style="display:none;">${getInitials(col.nombre)}</span>` : ''}
                </div>
                <span class="rsi-tag-name">${col.nombre}</span>
                ${col.area ? `<span class="rsi-tag-area">${col.area}</span>` : ''}
                ${index === 0 ? '<span class="rsi-tag-badge">Responsable</span>' : ''}
                <button type="button" class="rsi-tag-remove" data-id="${col.id}" title="Eliminar colaborador">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    container.querySelectorAll('.rsi-tag-remove').forEach(btn => {
        const handler = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const col = colaboradoresSeleccionados.find(c => c.id === id);
            colaboradoresSeleccionados = colaboradoresSeleccionados.filter(c => c.id !== id);
            renderTags();
            actualizarArea();
            updateResumen();
            const searchInput = document.getElementById('colaboradorSearch');
            if (searchInput) searchInput.focus();
            
            if (col) {
                showToast(`${col.nombre} eliminado`, 'info');
            }
        };
        btn.addEventListener('click', handler);
        eventListeners.push({ element: btn, event: 'click', handler });
    });
}

/**
 * Actualiza el área y responsable basado en colaboradores seleccionados
 */
function actualizarArea() {
    const areaInput = document.getElementById('area');
    const responsableInput = document.getElementById('responsableNombre');
    
    if (colaboradoresSeleccionados.length > 0) {
        const areas = new Set();
        colaboradoresSeleccionados.forEach(col => {
            if (col.area) {
                areas.add(col.area);
            }
        });
        if (areaInput) {
            areaInput.value = Array.from(areas).join(', ');
        }
        
        if (responsableInput) {
            responsableInput.value = colaboradoresSeleccionados[0].nombre;
        }
    } else {
        if (areaInput) areaInput.value = '';
        if (responsableInput) responsableInput.value = '';
    }
}

/**
 * Prepara los datos del formulario
 */
function prepareData() {
    const colaboradoresIds = colaboradoresSeleccionados.map(c => c.id);
    const responsable = colaboradoresSeleccionados.length > 0 ? colaboradoresSeleccionados[0] : null;
    
    const data = {
        titulo: getValue('titulo'),
        descripcion: getValue('descripcion'),
        prioridad: getValue('prioridad'),
        estado: getValue('estado'),
        area: getValue('area'),
        colaboradoresIds: colaboradoresIds,
        responsableNombre: responsable ? responsable.nombre : '',
        fechaInicio: getValue('fechaInicio') || null,
        fechaFin: getValue('fechaFin') || null
    };

    if (selectedTicketType === 'operativo') {
        const sistemas = [];
        document.querySelectorAll('input[name="sistemas"]:checked').forEach(cb => {
            sistemas.push(cb.value);
        });
        
        data.clienteId = getValue('clienteId');
        data.clienteNombre = getValue('clienteNombre');
        data.rfc = getValue('rfc');
        data.atencionA = getValue('atencionA');
        data.correo = getValue('correo');
        data.ordenServicio = getValue('ordenServicio');
        data.proyecto = getValue('proyecto');
        data.servicio = getValue('servicio');
        data.sistemas = sistemas;
    } else {
        data.fechaFinalizacionEstimada = getValue('fechaFinalizacionEstimada') || null;
        data.clienteId = null;
        data.clienteNombre = '';
        data.rfc = '';
        data.atencionA = '';
        data.correo = '';
        data.sistemas = [];
    }

    return data;
}

/**
 * Maneja el envío del formulario
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('submitTicket');
    
    try {
        const confirmCheckbox = document.getElementById('confirmarDatos');
        if (!confirmCheckbox || !confirmCheckbox.checked) {
            Swal.fire({
                icon: 'warning',
                title: 'Confirmación requerida',
                text: 'Debes confirmar que los datos son correctos antes de crear el ticket.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#d33'
            });
            return;
        }

        const isValid = validateCurrentStep();
        if (!isValid) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const data = prepareData();

        let result;
        if (isEditMode && editingDocId) {
            result = await service.updateTicket(editingDocId, data);
        } else {
            result = await service.createTicket(data, selectedTicketType);
        }

        if (!result.success) {
            throw new Error(result.message);
        }

        const successMessage = isEditMode 
            ? '¡Ticket actualizado exitosamente!' 
            : `¡Ticket ${result.idTicket} creado exitosamente!`;

        const htmlContent = `
            <div style="text-align: left;">
                <p><strong>ID:</strong> ${result.idTicket || 'N/A'}</p>
                <p><strong>Título:</strong> ${data.titulo}</p>
                <p><strong>Tipo:</strong> ${selectedTicketType === 'operativo' ? 'Operativo' : 'Administración'}</p>
                <p><strong>Prioridad:</strong> ${data.prioridad}</p>
                <p><strong>Colaboradores:</strong> ${colaboradoresSeleccionados.map(c => c.nombre).join(', ')}</p>
                ${selectedTicketType === 'operativo' ? `<p><strong>Cliente:</strong> ${data.clienteNombre || 'N/A'}</p>` : ''}
                <p><strong>Fechas:</strong> ${data.fechaInicio || 'N/A'} - ${data.fechaFin || 'N/A'}</p>
            </div>
        `;

        await Swal.fire({
            icon: 'success',
            title: successMessage,
            html: htmlContent,
            confirmButtonText: 'Ir a Gestión de Tickets',
            confirmButtonColor: '#1c1948'
        });

        if (typeof window.navigateTo === 'function') {
            window.navigateTo('/partner/crudTickets');
        } else {
            window.location.href = '/partner/crudTickets';
        }

    } catch (error) {
        console.error('❌ Error en submit:', error);
        
        let errorMessage = error.message || 'Ocurrió un error al guardar el ticket';
        
        if (errorMessage.includes('{"')) {
            try {
                const errors = JSON.parse(errorMessage);
                errorMessage = Object.values(errors).join('\n');
            } catch {
                // mantener mensaje original
            }
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
            confirmButtonText: 'Intentar de nuevo',
            confirmButtonColor: '#d33'
        });

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isEditMode 
            ? '<i class="fas fa-save"></i> Actualizar Ticket'
            : '<i class="fas fa-ticket-alt"></i> Crear Ticket';
    }
}

/**
 * Limpia eventos
 */
export function destroyTicketController() {
    console.log('🧹 Destroying TicketController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    editingDocId = null;
    isEditMode = false;
    originalData = {};
    colaboradoresCargados = [];
    clientesCargados = [];
    colaboradoresSeleccionados = [];
}

export default ticketController;