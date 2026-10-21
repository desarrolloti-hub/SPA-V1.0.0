/* ========================================
   CLIENTE MODAL CONTROLLER
   Controlador del modal de registro rápido
   ======================================== */

import ClienteService from '../../../services/clienteService.js';
import { getRegimenesForSelect, obtenerCodigoRegimen } from '../../../utils/regimenesSat.js';

let service = null;
let eventListeners = [];

/**
 * Controlador del modal de cliente
 * @param {Object} ctx
 * @param {Function} ctx.close - Función para cerrar el modal
 * @param {Function} ctx.onSuccess - (opcional) callback cuando se registra
 * @returns {Function} destroy
 */
export async function clienteModalController({ close, onSuccess } = {}) {
    console.log('👤 ClienteModal Controller iniciado');

    service = new ClienteService();
    eventListeners = [];

    loadRegimenesList();
    initValidation();
    initRegimenListener();
    initSubmit({ close, onSuccess });

    console.log('✅ ClienteModal Controller listo');

    return destroyClienteModalController;
}

/* ========================================
   INTERNOS
   ======================================== */

function loadRegimenesList() {
    const datalist = document.getElementById('modalRegimenesList');
    if (!datalist) return;

    const regimenes = getRegimenesForSelect('todos');
    datalist.innerHTML = regimenes
        .map(r => `<option value="${r.nombre}">${r.codigo} - ${r.nombre}</option>`)
        .join('');
}

function initRegimenListener() {
    const input = document.getElementById('modalRegimen');
    if (!input) return;

    const handler = () => {
        // Solo actualiza el código interno (no hay display visible en el modal)
        obtenerCodigoRegimen(input.value);
    };

    input.addEventListener('input', handler);
    eventListeners.push({ element: input, event: 'input', handler });
}

function initValidation() {
    document.querySelectorAll('#clienteModalForm input').forEach(input => {
        const handler = () => validateField(input);
        input.addEventListener('blur', handler);
        eventListeners.push({ element: input, event: 'blur', handler });

        const inputHandler = () => {
            const group = input.closest('.rsi-form-group');
            if (group?.classList.contains('error')) validateField(input);
        };
        input.addEventListener('input', inputHandler);
        eventListeners.push({ element: input, event: 'input', handler: inputHandler });
    });
}

function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    const group = input.closest('.rsi-form-group');

    if (isRequired && !value) {
        showError(group, 'Este campo es requerido');
        return false;
    }

    const rules = {
        modalRfc:          v => v.length === 0 || v.length >= 12,
        modalCodigoPostal: v => v.length === 0 || v.length === 5,
        modalEmail:        v => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        modalTelefono:     v => v.length === 0 || v.length >= 10,
    };

    if (rules[input.id] && value.length > 0 && !rules[input.id](value)) {
        showError(group, 'Valor inválido');
        return false;
    }

    clearError(group);
    return true;
}

function showError(group, msg) {
    if (!group) return;
    group.classList.add('error');
    const el = group.querySelector('.rsi-form-error-message');
    if (el) el.textContent = msg;
}

function clearError(group) {
    if (!group) return;
    group.classList.remove('error');
}

function prepareData() {
    const get = (id) => document.getElementById(id)?.value || '';
    const regimen = get('modalRegimen');

    return {
        rfc: get('modalRfc'),
        razonSocial: get('modalRazonSocial'),
        regimen,
        regimenCodigo: obtenerCodigoRegimen(regimen) || '',
        codigoPostal: get('modalCodigoPostal'),
        email: get('modalEmail'),
        telefonoMovil: get('modalTelefono'),
        // Campos opcionales vacíos
        nombreComercial: '',
        tipoVialidad: '',
        nombreVialidad: '',
        numeroExterior: '',
        numeroInterior: '',
        colonia: '',
        localidad: '',
        municipio: '',
        estado: '',
        entreCalle: '',
        yCalle: '',
        telefonoFijo: ''
    };
}

function initSubmit({ close, onSuccess }) {
    const btn = document.getElementById('modalSubmitCliente');
    if (!btn) return;

    const handler = async () => {
        // Validar todos los inputs
        const inputs = document.querySelectorAll('#clienteModalForm input');
        let valid = true;
        inputs.forEach(i => { if (!validateField(i)) valid = false; });
        if (!valid) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const data = prepareData();
            const result = await service.createCliente(data);

            if (!result.success) throw new Error(result.message);

            Swal.fire({
                icon: 'success',
                title: '¡Cliente registrado!',
                html: `
                    <div style="text-align:left;">
                        <p><strong>Razón Social:</strong> ${data.razonSocial}</p>
                        <p><strong>RFC:</strong> ${data.rfc}</p>
                        <p><strong>Email:</strong> ${data.email}</p>
                    </div>
                `,
                timer: 2500,
                showConfirmButton: false
            });

            // Cerrar modal (dispara onClose del manager)
            if (typeof close === 'function') close();

            // Callback opcional para la vista
            if (typeof onSuccess === 'function') {
                onSuccess({ id: result.id, data });
            }

        } catch (error) {
            console.error('❌ Error en modal:', error);

            let msg = error.message || 'Error al guardar el cliente';
            if (msg.includes('{"')) {
                try { msg = Object.values(JSON.parse(msg)).join('\n'); } catch {}
            }

            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: msg,
                confirmButtonColor: '#d33'
            });

        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Registrar Cliente';
        }
    };

    btn.addEventListener('click', handler);
    eventListeners.push({ element: btn, event: 'click', handler });
}

function destroyClienteModalController() {
    console.log('🧹 Destroying ClienteModalController');
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    service = null;
}

export default clienteModalController;