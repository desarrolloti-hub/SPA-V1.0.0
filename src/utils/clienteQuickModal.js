/* ==========================================================================
   CLIENTE QUICK MODAL - RSI Enterprise
   Modal rápido para registrar clientes únicamente con Nombre y RFC,
   ofreciendo botones directos para RFC Público en General y Extranjero.
   ========================================================================== */

import ClienteService from '../services/clienteService.js';

export const RFC_PUBLICO_GENERAL = 'XAXX010101000';
export const RFC_EXTRANJERO = 'XEXX010101000';

/**
 * Abre el diálogo de registro rápido de cliente (Nombre y RFC)
 * @param {Object} options
 * @param {string} [options.initialName=''] - Nombre o término inicial
 * @param {string} [options.initialRfc=''] - RFC inicial
 * @returns {Promise<{success: boolean, id: string, cliente: Object}|null>}
 */
export async function solicitarDatosNuevoClienteQuick({ initialName = '', initialRfc = '' } = {}) {
    const Swal = window.Swal;
    if (!Swal) {
        console.error('❌ SweetAlert2 (Swal) no está disponible en window');
        return null;
    }

    const service = new ClienteService();

    const { value: formValues, isDismissed } = await Swal.fire({
        title: '<i class="fas fa-user-plus" style="color: var(--rsi-primary, #1c1948);"></i> Nuevo Cliente',
        width: '460px',
        padding: '20px 24px',
        html: `
            <div style="text-align: left; font-size: 0.9rem; font-family: inherit;">
                <p style="margin: 0 0 14px 0; color: #64748b; font-size: 0.82rem; line-height: 1.4;">
                    Ingresa únicamente el <strong>Nombre o Razón Social</strong> y el <strong>RFC</strong> para registrar al cliente.
                </p>

                <div style="margin-bottom: 14px;">
                    <label for="swal-cliente-nombre" style="font-weight: 600; display: block; margin-bottom: 5px; font-size: 0.85rem; color: #1e293b;">
                        Nombre / Razón Social <span style="color: #dc2626;">*</span>
                    </label>
                    <input id="swal-cliente-nombre" value="${(initialName || '').replace(/"/g, '&quot;')}" placeholder="Ej. Soluciones TI o Juan Pérez" style="width: 100%; height: 40px; padding: 8px 12px; font-size: 0.92rem; border: 1.5px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none; background: #ffffff; color: #0f172a;">
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <label for="swal-cliente-rfc" style="font-weight: 600; margin: 0; font-size: 0.85rem; color: #1e293b;">
                            RFC <span style="color: #dc2626;">*</span>
                        </label>
                        <div style="display: inline-flex; gap: 4px;">
                            <button type="button" id="btnRfcPublicoGeneral" style="background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 4px; padding: 2px 7px; font-size: 0.72rem; font-weight: 600; cursor: pointer;">
                                Público en General
                            </button>
                            <button type="button" id="btnRfcExtranjero" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 4px; padding: 2px 7px; font-size: 0.72rem; font-weight: 600; cursor: pointer;">
                                Extranjero
                            </button>
                        </div>
                    </div>
                    <input id="swal-cliente-rfc" value="${(initialRfc || '').replace(/"/g, '&quot;')}" maxlength="13" placeholder="Ej. XAXX010101000" style="width: 100%; height: 40px; padding: 8px 12px; text-transform: uppercase; font-size: 0.92rem; border: 1.5px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none; background: #ffffff; color: #0f172a;">
                </div>

                <div style="font-size: 0.75rem; color: #64748b; line-height: 1.4; display: flex; align-items: center; gap: 6px; margin-top: 10px;">
                    <i class="fas fa-info-circle" style="color: #1c1948; font-size: 0.85rem;"></i>
                    Podrás complementar el domicilio fiscal completo después si lo requieres.
                </div>
            </div>
        `,
        didOpen: () => {
            const rfcInput = document.getElementById('swal-cliente-rfc');
            const btnPub = document.getElementById('btnRfcPublicoGeneral');
            const btnExt = document.getElementById('btnRfcExtranjero');

            if (btnPub && rfcInput) {
                btnPub.addEventListener('click', () => {
                    rfcInput.value = RFC_PUBLICO_GENERAL;
                    rfcInput.dispatchEvent(new Event('input', { bubbles: true }));
                    btnPub.style.transform = 'scale(0.97)';
                    setTimeout(() => { btnPub.style.transform = ''; }, 150);
                });
            }

            if (btnExt && rfcInput) {
                btnExt.addEventListener('click', () => {
                    rfcInput.value = RFC_EXTRANJERO;
                    rfcInput.dispatchEvent(new Event('input', { bubbles: true }));
                    btnExt.style.transform = 'scale(0.97)';
                    setTimeout(() => { btnExt.style.transform = ''; }, 150);
                });
            }

            const nombreInput = document.getElementById('swal-cliente-nombre');
            if (nombreInput && !nombreInput.value) {
                nombreInput.focus();
            } else if (rfcInput) {
                rfcInput.focus();
            }
        },
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Registrar Cliente',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c1948',
        cancelButtonColor: '#6b7280',
        width: '460px',
        preConfirm: () => {
            const nombre = document.getElementById('swal-cliente-nombre')?.value.trim();
            const rfc = document.getElementById('swal-cliente-rfc')?.value.trim().toUpperCase();

            if (!nombre || nombre.length < 2) {
                Swal.showValidationMessage('El nombre o razón social es requerido (mínimo 2 caracteres)');
                return false;
            }

            if (!rfc || rfc.length < 12) {
                Swal.showValidationMessage('El RFC es requerido (mínimo 12 caracteres)');
                return false;
            }

            return { nombre, rfc };
        }
    });

    if (isDismissed || !formValues) {
        return null;
    }

    try {
        Swal.fire({
            title: 'Guardando cliente...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const clientePayload = {
            razonSocial: formValues.nombre,
            nombreComercial: formValues.nombre,
            rfc: formValues.rfc,
            regimen: (formValues.rfc === RFC_PUBLICO_GENERAL || formValues.rfc === RFC_EXTRANJERO) ? 'Sin obligaciones fiscales' : '',
            regimenCodigo: (formValues.rfc === RFC_PUBLICO_GENERAL || formValues.rfc === RFC_EXTRANJERO) ? '616' : '',
            codigoPostal: '',
            telefonoMovil: '',
            email: ''
        };

        const result = await service.createCliente(clientePayload);

        if (!result.success) {
            throw new Error(result.error || result.message || 'Error al guardar el cliente');
        }

        await Swal.fire({
            icon: 'success',
            title: '¡Cliente registrado!',
            text: `${formValues.nombre} (${formValues.rfc}) se ha registrado exitosamente.`,
            timer: 2000,
            showConfirmButton: false
        });

        return {
            success: true,
            id: result.id,
            cliente: {
                id: result.id,
                ...clientePayload,
                nombre: formValues.nombre
            }
        };
    } catch (error) {
        console.error('❌ Error guardando cliente rápido:', error);
        let msg = error.message || 'No fue posible registrar al cliente';
        if (msg.includes('{"')) {
            try {
                msg = Object.values(JSON.parse(msg)).join('<br>');
            } catch {}
        }

        await Swal.fire({
            icon: 'error',
            title: 'Error al registrar cliente',
            html: msg,
            confirmButtonColor: '#1c1948'
        });
        return null;
    }
}

export default solicitarDatosNuevoClienteQuick;
