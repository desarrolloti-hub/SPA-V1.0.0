/* ========================================
   ABOUT US CONTROLLER - RSI Enterprise México
   Animación de Contadores y Scroll Reveal
   ======================================== */

let statsObserver = null;
let scrollObserver = null;

export function aboutusController() {
    console.log('🏛️ Inicializando About Us Controller');

    initStatsCounter();
    initScrollReveal();

    console.log('✅ About Us Controller listo');
}

/**
 * 📊 CONTADORES ANIMADOS DE ESTADÍSTICAS
 */
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.rsi-stat-number');
    if (!statNumbers.length || typeof IntersectionObserver === 'undefined') return;

    statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                if (!element.classList.contains('is-animated')) {
                    element.classList.add('is-animated');
                    const text = element.textContent.trim();
                    const match = text.match(/\d+/);

                    if (match) {
                        const target = parseInt(match[0], 10);
                        const suffix = text.includes('+') ? '+' : (text.includes('/7') ? '/7' : '');
                        animateCountNumber(element, target, suffix);
                    }
                }
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.25 });

    statNumbers.forEach(stat => statsObserver.observe(stat));
}

function animateCountNumber(element, target, suffix = '') {
    let startTime = null;
    const duration = 2000;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeOut * target);

        element.textContent = `${current}${suffix}`;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = `${target}${suffix}`;
        }
    }

    window.requestAnimationFrame(step);
}

/**
 * ✨ SCROLL REVEAL SUAVE
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.rsi-about-overview-section, .rsi-pillar-card, .rsi-value-pill, .rsi-cert-card, .rsi-stat-card, .rsi-final-cta-card'
    );

    if (!revealElements.length || typeof IntersectionObserver === 'undefined') return;

    revealElements.forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${(index % 4) * 0.08}s`;
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
 * 🧹 Limpieza del controlador al desmontar
 */
export function destroyAboutusController() {
    if (statsObserver) {
        statsObserver.disconnect();
        statsObserver = null;
    }
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}
