/* ========================================
   CARRUSEL REUTILIZABLE - RSI Enterprise
   Componente desacoplado
   ======================================== */
/**
 * Inicializa un carrusel fullscreen
 * @param {HTMLElement} container - Elemento contenedor
 * @param {Object} config - Configuración del carrusel
 * @returns {Object} - API del carrusel
 */
export function createCarousel(container, config = {}) {
    if (!container) {
        console.warn('⚠️ Carousel: contenedor no válido');
        return null;
    }

    // ✅ Configuración por defecto
    const settings = {
        slides: [],
        autoplay: true,
        interval: 8000,
        transitionDuration: 700,
        showIndicators: true,
        showArrows: true,
        pauseOnHover: true,
        ...config
    };

    if (!settings.slides || settings.slides.length === 0) {
        console.warn('⚠️ Carousel: no hay slides configurados');
        return null;
    }

    // ✅ Estado interno
    const state = {
        currentIndex: 0,
        isTransitioning: false,
        autoplayTimer: null,
        isPaused: false,
        isDestroyed: false,
        touchStartX: 0,
        touchEndX: 0
    };

    // ✅ Referencias DOM
    let trackEl = null;
    let dotsEls = [];
    let slideEls = [];
    let hoverTimer = null;

    // ==========================================
    // PRECARGA DE IMÁGENES
    // Se ejecuta ANTES del render para que el navegador
    // empiece a descargar cuanto antes
    // ==========================================
    function preloadImages() {
        settings.slides.forEach((slide, index) => {
            if (!slide.image) return;

            const img = new Image();

            // URLs externas
            if (/^https?:\/\//i.test(slide.image)) {
                // CrossOrigin removido para permitir carga de imágenes de Firebase Storage sin bloqueo CORS
                // Referrer policy estándar para preservar tokens de Firebase Storage
            }

            img.src = slide.image;

            // La primera: forzar decode inmediato
            if (index === 0 && img.decode) {
                img.decode().catch(() => {});
            }
        });
    }

    // ==========================================
    // RENDER
    // ==========================================
    function render() {
        container.innerHTML = '';
        container.classList.add('rsi-carousel');
        container.style.setProperty(
            '--rsi-carousel-duration',
            `${settings.transitionDuration}ms`
        );

        // Track
        trackEl = document.createElement('div');
        trackEl.className = 'rsi-carousel-track';

        // Slides
        slideEls = [];
        settings.slides.forEach((slide, index) => {
            const slideEl = createSlide(slide, index);
            trackEl.appendChild(slideEl);
            slideEls.push(slideEl);
        });

        container.appendChild(trackEl);

        // Flechas
        if (settings.showArrows && settings.slides.length > 1) {
            container.appendChild(createArrow('prev'));
            container.appendChild(createArrow('next'));
        }

        // Indicadores
        if (settings.showIndicators && settings.slides.length > 1) {
            container.appendChild(createIndicators());
        }

        // Scroll indicator
        container.appendChild(createScrollIndicator());

        // Activar primer slide (sin animación)
        updateActiveSlide(0, false);
    }

    // ==========================================
    // CREAR SLIDE
    // ==========================================
    function createSlide(slide, index) {
        const slideEl = document.createElement('div');
        slideEl.className = 'rsi-carousel-slide';
        slideEl.dataset.index = index;

        const hasContent = slide.title || slide.description || slide.button;
        if (!hasContent) {
            slideEl.classList.add('rsi-carousel-slide--image-only');
        }

        // Imagen
        if (slide.image) {
            const img = document.createElement('img');
            img.className = 'rsi-carousel-slide-image';
            img.src = slide.image;
            img.alt = slide.title || `RSI Enterprise México - Soluciones de Seguridad Electrónica (${index + 1})`;
            img.setAttribute('data-no-zoom', 'true');

            // ✅ Primera imagen: eager + prioridad alta
            // Resto: lazy + prioridad baja
            img.loading = index === 0 ? 'eager' : 'lazy';
            img.decoding = 'async';
            img.fetchPriority = index === 0 ? 'high' : 'low';

            // URLs externas
            if (/^https?:\/\//i.test(slide.image)) {
                // CrossOrigin removido para permitir carga de imágenes de Firebase Storage sin bloqueo CORS
                // Referrer policy estándar para preservar tokens de Firebase Storage
            }

            // Fallback si la imagen falla
            img.addEventListener('error', () => {
                console.warn(`⚠️ No se pudo cargar la imagen: ${slide.image}`);
                slideEl.style.background =
                    'linear-gradient(135deg, #1c1948 0%, #13103a 100%)';
                img.style.display = 'none';
            });

            // ✅ Primera imagen: SIN fade-in (visible al instante)
            if (index === 0) {
                img.style.opacity = '1';
                slideEl.classList.add('rsi-carousel-slide--instant');
            } else {
                // Resto: fade-in suave al cargar
                img.style.opacity = img.complete ? '1' : '0';
                img.style.transition = 'opacity 0.4s ease';
                img.addEventListener('load', () => {
                    img.style.opacity = '1';
                });
            }

            slideEl.appendChild(img);
        }

        // Contenido (solo si hay campos)
        if (hasContent) {
            const contentEl = document.createElement('div');
            contentEl.className = 'rsi-carousel-content';

            // Título (h1 único para el primer slide por SEO, h2 para el resto)
            if (slide.title) {
                const title = document.createElement(index === 0 ? 'h1' : 'h2');
                title.className = 'rsi-carousel-title';
                title.textContent = slide.title;
                contentEl.appendChild(title);
            }

            // Descripción
            if (slide.description) {
                const desc = document.createElement('p');
                desc.className = 'rsi-carousel-description';
                desc.textContent = slide.description;
                contentEl.appendChild(desc);
            }

            // Botón
            if (slide.button && slide.button.text) {
                const btn = document.createElement('a');
                btn.className = 'rsi-carousel-button';
                btn.href = slide.button.link || '#';
                if (slide.button.link && slide.button.link.startsWith('/')) {
                    btn.setAttribute('data-link', '');
                }

                const btnText = document.createElement('span');
                btnText.textContent = slide.button.text;
                btn.appendChild(btnText);

                if (slide.button.icon) {
                    const icon = document.createElement('i');
                    icon.className = slide.button.icon;
                    btn.appendChild(icon);
                }

                contentEl.appendChild(btn);
            }

            slideEl.appendChild(contentEl);
        }

        return slideEl;
    }

    // ==========================================
    // CREAR FLECHAS
    // ==========================================
    function createArrow(direction) {
        const btn = document.createElement('button');
        btn.className = `rsi-carousel-arrow rsi-carousel-arrow--${direction}`;
        btn.setAttribute('aria-label', direction === 'prev' ? 'Anterior' : 'Siguiente');

        const icon = document.createElement('i');
        icon.className = direction === 'prev'
            ? 'fas fa-chevron-left'
            : 'fas fa-chevron-right';
        btn.appendChild(icon);

        btn.addEventListener('click', () => {
            direction === 'prev' ? prev() : next();
        });

        return btn;
    }

    // ==========================================
    // CREAR INDICADORES
    // ==========================================
    function createIndicators() {
        const indicatorsEl = document.createElement('div');
        indicatorsEl.className = 'rsi-carousel-indicators';

        dotsEls = [];
        settings.slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = 'rsi-carousel-dot';
            dot.setAttribute('aria-label', `Ir al slide ${index + 1}`);
            dot.dataset.index = index;

            dot.addEventListener('click', () => goTo(index));
            indicatorsEl.appendChild(dot);
            dotsEls.push(dot);
        });

        return indicatorsEl;
    }

    // ==========================================
    // CREAR SCROLL INDICATOR
    // ==========================================
    function createScrollIndicator() {
        const scrollEl = document.createElement('div');
        scrollEl.className = 'rsi-carousel-scroll';
        scrollEl.style.cursor = 'pointer';
        scrollEl.setAttribute('role', 'button');
        scrollEl.setAttribute('tabindex', '0');
        scrollEl.setAttribute('aria-label', 'Desplazarse a la sección de reseñas y testimonios');

        const text = document.createElement('span');
        text.className = 'rsi-carousel-scroll-text';
        text.textContent = 'Desliza hacia abajo';

        const line = document.createElement('span');
        line.className = 'rsi-carousel-scroll-line';

        const scrollToTarget = () => {
            const nextSection = document.getElementById('resenas-clientes') || container.nextElementSibling;
            if (nextSection && typeof nextSection.scrollIntoView === 'function') {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        };

        scrollEl.addEventListener('click', scrollToTarget);
        scrollEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToTarget();
            }
        });

        scrollEl.appendChild(text);
        scrollEl.appendChild(line);
        return scrollEl;
    }

    // ==========================================
    // ACTUALIZAR SLIDE ACTIVO
    // ==========================================
    function updateActiveSlide(index, animate = true) {
        slideEls.forEach((slide, i) => {
            slide.classList.toggle('is-active', i === index);
        });

        dotsEls.forEach((dot, i) => {
            dot.classList.toggle('is-active', i === index);
        });

        if (animate) {
            trackEl.style.transition =
                `transform ${settings.transitionDuration}ms cubic-bezier(0.77, 0, 0.175, 1)`;
        } else {
            trackEl.style.transition = 'none';
        }

        trackEl.style.transform = `translateX(-${index * 100}%)`;

        // Forzar reflow si no animamos
        if (!animate) {
            void trackEl.offsetWidth;
        }
    }

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    function goTo(index, animate = true) {
        if (state.isTransitioning || state.isDestroyed) return;

        const total = settings.slides.length;
        state.currentIndex = ((index % total) + total) % total;

        state.isTransitioning = true;
        updateActiveSlide(state.currentIndex, animate);

        setTimeout(() => {
            state.isTransitioning = false;
        }, animate ? settings.transitionDuration : 0);
    }

    function next() {
        goTo(state.currentIndex + 1);
    }

    function prev() {
        goTo(state.currentIndex - 1);
    }

    // ==========================================
    // AUTOPLAY
    // ==========================================
    function startAutoplay() {
        if (!settings.autoplay || settings.slides.length <= 1) return;
        stopAutoplay();

        state.autoplayTimer = setInterval(() => {
            if (!state.isPaused && !state.isTransitioning && !state.isDestroyed) {
                next();
            }
        }, settings.interval);
    }

    function stopAutoplay() {
        if (state.autoplayTimer) {
            clearInterval(state.autoplayTimer);
            state.autoplayTimer = null;
        }
    }

    // ==========================================
    // EVENTOS
    // ==========================================
    function bindEvents() {
        if (settings.pauseOnHover) {
            container.addEventListener('mouseenter', handleMouseEnter);
            container.addEventListener('mouseleave', handleMouseLeave);
        }

        document.addEventListener('keydown', handleKeydown);
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function handleMouseEnter() {
        // Delay de 400ms: no pausar por pasar el mouse rápido
        hoverTimer = setTimeout(() => {
            state.isPaused = true;
        }, 400);
    }

    function handleMouseLeave() {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        state.isPaused = false;
    }

    function handleKeydown(e) {
        if (state.isDestroyed) return;

        const rect = container.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;

        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
    }

    function handleTouchStart(e) {
        state.touchStartX = e.changedTouches[0].screenX;
    }

    function handleTouchEnd(e) {
        state.touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }

    function handleSwipe() {
        const diff = state.touchStartX - state.touchEndX;
        const threshold = 50;

        if (Math.abs(diff) < threshold) return;

        if (diff > 0) next();
        else prev();
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            state.isPaused = true;
        } else {
            state.isPaused = false;
        }
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================
    function destroy() {
        state.isDestroyed = true;
        stopAutoplay();

        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }

        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);

        container.innerHTML = '';
        container.classList.remove('rsi-carousel');
        slideEls = [];
        dotsEls = [];
        trackEl = null;
    }

    // ==========================================
    // INIT
    // ==========================================
    preloadImages();          // 1. Precargar en paralelo (el navegador empieza a bajar)
    render();                 // 2. Renderizar con primera imagen SIN fade-in
    bindEvents();             // 3. Eventos

    state.isPaused = false;   // 4. Garantizar que NO arranque pausado
    startAutoplay();          // 5. Arrancar autoplay

    // 6. Fallback: si por alguna razón no arrancó, reintentar
    setTimeout(() => {
        if (!state.autoplayTimer && !state.isDestroyed) {
            console.warn('⚠️ Autoplay no arrancó, reintentando...');
            startAutoplay();
        }
    }, 500);

    console.log(
        `🎠 Carrusel iniciado — ${settings.slides.length} slides, autoplay cada ${settings.interval}ms`
    );

    return {
        next,
        prev,
        goTo,
        destroy,
        getCurrentIndex: () => state.currentIndex,
        getTotal: () => settings.slides.length,
        pause: () => { state.isPaused = true; },
        resume: () => { state.isPaused = false; },
        restartAutoplay: () => { stopAutoplay(); startAutoplay(); }
    };
}

/**
 * Carga la configuración desde un JSON y crea el carrusel
 * @param {HTMLElement} container
 * @param {string} configUrl - URL del JSON de configuración
 */
export async function createCarouselFromJSON(container, configUrl) {
    try {
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Respuesta no es JSON (content-type: ${contentType})`);
        }

        const config = await response.json();
        return createCarousel(container, config);
    } catch (error) {
        console.error('❌ Error cargando configuración del carrusel:', error);
        return null;
    }
}

export default createCarousel;