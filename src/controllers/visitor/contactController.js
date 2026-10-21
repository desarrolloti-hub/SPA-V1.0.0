/* ========================================
   CONTACT CONTROLLER - RSI Enterprise México
   Manejo de Formulario y Animaciones
   ======================================== */

let scrollObserver = null;
let formHandler = null;

export function contactController() {
    console.log('📞 Inicializando Contact Controller');

    initContactForm();
    initScrollReveal();

    console.log('✅ Contact Controller listo');
}

/**
 * 📝 GESTIÓN Y VALIDACIÓN DEL FORMULARIO DE CONTACTO
 */
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    formHandler = async (e) => {
        e.preventDefault();

        const nombreInput = document.getElementById('nombre');
        const telefonoInput = document.getElementById('telefono');
        const emailInput = document.getElementById('email');
        const servicioSelect = document.getElementById('servicio');
        const mensajeInput = document.getElementById('mensaje');

        let isValid = true;

        // Limpiar errores previos
        form.querySelectorAll('.rsi-form-group').forEach(fg => fg.classList.remove('has-error'));

        // Validar Nombre
        if (!nombreInput.value.trim()) {
            showInputError(nombreInput);
            isValid = false;
        }

        // Validar Teléfono
        const telPattern = /^[0-9+\s\-()]{8,20}$/;
        if (!telefonoInput.value.trim() || !telPattern.test(telefonoInput.value.trim())) {
            showInputError(telefonoInput);
            isValid = false;
        }

        // Validar Email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim() || !emailPattern.test(emailInput.value.trim())) {
            showInputError(emailInput);
            isValid = false;
        }

        // Validar Mensaje
        if (!mensajeInput.value.trim()) {
            showInputError(mensajeInput);
            isValid = false;
        }

        if (!isValid) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Campos incompletos',
                    text: 'Por favor completa todos los campos requeridos correctamente.',
                    icon: 'warning',
                    confirmButtonColor: '#1c1948'
                });
            }
            return;
        }

        const submitBtn = form.querySelector('.rsi-form-submit-btn');
        const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Enviando...';
        }

        // Simulación de envío exitoso con confirmación visual
        setTimeout(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '¡Mensaje Enviado con Éxito!',
                    text: `Gracias ${nombreInput.value.trim()}, uno de nuestros ingenieros se comunicará contigo a la brevedad.`,
                    icon: 'success',
                    confirmButtonColor: '#1c1948',
                    confirmButtonText: 'Entendido'
                });
            }

            form.reset();
        }, 800);
    };

    form.addEventListener('submit', formHandler);
}

function showInputError(inputElement) {
    const formGroup = inputElement.closest('.rsi-form-group');
    if (formGroup) {
        formGroup.classList.add('has-error');
    }
}

/**
 * ✨ SCROLL REVEAL SUAVE
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.rsi-locations-header, .rsi-location-card, .rsi-form-card, .rsi-channels-header, .rsi-contact-info-item, .rsi-contact-reviews-card'
    );

    if (!revealElements.length || typeof IntersectionObserver === 'undefined') return;

    revealElements.forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${(index % 3) * 0.09}s`;
    });

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

    revealElements.forEach(el => scrollObserver.observe(el));
}

/**
 * 🧹 Limpieza del controlador al desmontar la vista
 */
export function destroyContactController() {
    const form = document.getElementById('contactForm');
    if (form && formHandler) {
        form.removeEventListener('submit', formHandler);
        formHandler = null;
    }
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}
