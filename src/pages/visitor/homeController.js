/* ========================================
   HOME CONTROLLER - Animaciones Premium
   ======================================== */

export async function homeController() {
    console.log('🏠 Home controller con animaciones premium');
    
    // 🔐 Verificar sesión activa y redirigir según rol
    await checkSessionAndRedirect();
    
    // Inicializar todas las animaciones elegantes
    initTypingEffect();           // Efecto de escritura en títulos
    initStatsCounter();           // Contadores animados
    initScrollReveal();           // Elementos que aparecen al hacer scroll
    initParallaxEffect();         // Efecto parallax suave
    initMagneticButtons();        // Botones con efecto magnético
    initFloatingImages();         // Imágenes que flotan suavemente
    initNumberGlow();             // Números con efecto glow
    initGradientBorder();         // Bordes con gradiente animado
    initTypewriterLoop();         // Texto que cambia cíclicamente
    
    console.log('✅ Animaciones premium activadas');
}

/**
 * 🔐 VERIFICACIÓN DE SESIÓN Y REDIRECCIÓN SEGÚN ROL
 * Si hay sesión activa, redirige al dashboard correspondiente
 * Si no hay sesión, permanece en la página actual
 */
async function checkSessionAndRedirect() {
    try {
        // Primero verificar si existe sesión en localStorage
        const sessionData = localStorage.getItem('rsi_session');
        
        // Si NO hay sesión, mostrar contenido normal sin alertas
        if (!sessionData) {
            console.log('🔓 No hay sesión activa - Mostrar contenido normal');
            return; // No hay sesión, permanecer en la página sin alertas
        }
        
        // Si HAY sesión, mostrar SweetAlert de carga
        let loadingAlert = null;
        
        try {
            // Mostrar alerta de carga SOLO cuando hay sesión
            loadingAlert = Swal.fire({
                title: 'Verificando sesión...',
                text: 'Por favor espera un momento',
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Pequeño delay para que se vea la animación de carga (opcional)
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Parsear los datos de sesión
            const session = JSON.parse(sessionData);
            
            // Verificar que los datos sean válidos
            if (!session || !session.rol) {
                console.warn('⚠️ Sesión inválida - Mostrar contenido normal');
                if (loadingAlert) {
                    Swal.close();
                }
                return;
            }
            
            // Determinar la ruta de redirección según el rol
            let redirectPath = '';
            let rolDisplay = '';
            const currentPath = window.location.pathname;
            
            switch (session.rol) {
                case 'partner':
                    redirectPath = '/partner/dashboard';
                    rolDisplay = 'Partner';
                    break;
                case 'customer':
                    redirectPath = '/customer/dashboard';
                    rolDisplay = 'Cliente';
                    break;
                case 'admin':
                    redirectPath = '/admin/dashboard';
                    rolDisplay = 'Administrador';
                    break;
                default:
                    console.warn(`⚠️ Rol desconocido: ${session.rol} - Mostrar contenido normal`);
                    if (loadingAlert) {
                        Swal.close();
                    }
                    return;
            }
            
            // Evitar redirección si ya estamos en el dashboard correspondiente
            if (currentPath.includes(redirectPath)) {
                console.log(`✅ Ya estás en ${redirectPath}`);
                if (loadingAlert) {
                    Swal.close();
                }
                return;
            }
            
            // Cerrar el SweetAlert de carga
            if (loadingAlert) {
                Swal.close();
            }
            
            // Mostrar SweetAlert de redirección
            await Swal.fire({
                title: `¡Bienvenido ${rolDisplay}!`,
                text: `Redirigiendo a tu dashboard...`,
                icon: 'success',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                willClose: () => {
                    // Redirigir después de cerrar el alert
                    console.log(`🔄 Sesión activa detectada (${session.rol}) - Redirigiendo a ${redirectPath}`);
                    window.location.href = redirectPath;
                }
            });
            
        } catch (error) {
            console.error('❌ Error al verificar sesión:', error);
            // Cerrar el SweetAlert de carga si existe
            if (loadingAlert) {
                Swal.close();
            }
            
            // Mostrar error pero permanecer en la página
            await Swal.fire({
                title: 'Error',
                text: 'Hubo un problema al verificar tu sesión',
                icon: 'error',
                timer: 2000,
                showConfirmButton: false
            });
        }
        
    } catch (error) {
        console.error('❌ Error en checkSessionAndRedirect:', error);
        // En caso de error, permanecer en la página sin alertas
    }
}

/**
 * 1. EFECTO DE ESCRITURA (TYPING) para títulos principales
 * Texto que se escribe solo como si fuera una máquina de escribir
 */
function initTypingEffect() {
    const titles = document.querySelectorAll('.rsi-section-title');
    
    titles.forEach((title, index) => {
        // Solo aplicar a títulos específicos (no a todos)
        if (title.closest('.rsi-about-section') || title.closest('.rsi-hero-section')) {
            const originalText = title.textContent;
            title.textContent = '';
            title.style.opacity = '1';
            
            let i = 0;
            const typeInterval = setInterval(() => {
                if (i < originalText.length) {
                    title.textContent += originalText.charAt(i);
                    i++;
                } else {
                    clearInterval(typeInterval);
                    // Añadir cursor parpadeante al final
                    title.classList.add('typed-cursor');
                }
            }, 80 + (index * 50)); // Diferente delay para cada título
        }
    });
}

/**
 * 2. CONTADORES ANIMADOS (más suaves y elegantes)
 */
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.rsi-stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const text = element.textContent;
                const match = text.match(/\d+/);
                
                if (match && !element.classList.contains('animated')) {
                    const target = parseInt(match[0]);
                    animateNumberEasing(element, target);
                    element.classList.add('animated');
                }
            }
        });
    }, { threshold: 0.3 });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

/**
 * Animación de números con easing suave (cubic-bezier)
 */
function animateNumberEasing(element, target) {
    let current = 0;
    const duration = 2500;
    const startTime = performance.now();
    const suffix = element.textContent.includes('+') ? '+' : '';
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing elástico suave
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        current = Math.floor(easeProgress * target);
        
        element.textContent = current + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + suffix;
            element.style.animation = 'glowPulse 0.5s ease';
            setTimeout(() => {
                element.style.animation = '';
            }, 500);
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * 3. SCROLL REVEAL - Elementos que aparecen con delay escalonado
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.rsi-value-card, .rsi-stat-card, .rsi-section-content, .rsi-card-elegant'
    );
    
    revealElements.forEach((el, index) => {
        el.classList.add('scroll-reveal');
        el.style.transitionDelay = `${index * 0.05}s`;
    });
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
    
    revealElements.forEach(el => observer.observe(el));
}

/**
 * 4. EFECTO PARALLAX - Fondo que se mueve más lento
 */
function initParallaxEffect() {
    const statsSection = document.querySelector('.rsi-stats-section');
    const heroSection = document.querySelector('.rsi-hero-section');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        if (statsSection) {
            const rate = scrolled * 0.2;
            statsSection.style.backgroundPositionY = `${rate}px`;
        }
        
        if (heroSection && scrolled < window.innerHeight) {
            const rate = scrolled * 0.5;
            heroSection.style.transform = `translateY(${rate * 0.3}px)`;
        }
    });
}

/**
 * 5. BOTONES CON EFECTO MAGNÉTICO
 * El botón sigue el mouse suavemente
 */
function initMagneticButtons() {
    const buttons = document.querySelectorAll('.rsi-primary-btn, .rsi-cta-button');
    
    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });
}

/**
 * 6. IMÁGENES FLOTANTES
 * Efecto de flotación suave y continua
 */
function initFloatingImages() {
    const images = document.querySelectorAll('.rsi-image-wrapper img');
    
    images.forEach((img, index) => {
        img.style.animation = `floatImage ${3 + index * 0.5}s ease-in-out infinite`;
        img.style.animationDelay = `${index * 0.3}s`;
    });
}

/**
 * 7. NÚMEROS CON EFECTO GLOW (resplandor)
 */
function initNumberGlow() {
    const statNumbers = document.querySelectorAll('.rsi-stat-number');
    
    statNumbers.forEach(stat => {
        stat.addEventListener('mouseenter', () => {
            stat.style.textShadow = '0 0 20px rgba(143, 148, 251, 0.8)';
            stat.style.transition = 'all 0.3s ease';
        });
        
        stat.addEventListener('mouseleave', () => {
            stat.style.textShadow = '';
        });
    });
}

/**
 * 8. BORDES CON GRADIENTE ANIMADO
 */
function initGradientBorder() {
    const cards = document.querySelectorAll('.rsi-value-card, .rsi-card-elegant');
    // Implementación pendiente...
}

/**
 * 9. TEXTO QUE CAMBIA CÍCLICAMENTE (Typewriter loop)
 * Ideal para el hero section
 */
function initTypewriterLoop() {
    const heroTitle = document.querySelector('.rsi-hero-title');
    if (!heroTitle) return;
    
    const phrases = [
        'Seguridad Electrónica Profesional',
        'Protección Inteligente 24/7',
        'Tecnología de Última Generación',
        'Tranquilidad para tu Hogar'
    ];
    
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let currentText = '';
    
    function typeEffect() {
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            currentText = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            currentText = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }
        
        heroTitle.textContent = currentText;
        
        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            setTimeout(typeEffect, 2000);
            return;
        }
        
        if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            setTimeout(typeEffect, 500);
            return;
        }
        
        const speed = isDeleting ? 50 : 100;
        setTimeout(typeEffect, speed);
    }
    
    setTimeout(typeEffect, 500);
}

/**
 * 10. EFECTO DE CARGAS ESCALONADAS (Stagger Animation)
 */
function initStaggerAnimation() {
    const sections = document.querySelectorAll('.rsi-about-section, .rsi-value-section, .rsi-products-section, .rsi-stats-section, .rsi-services-section, .rsi-blog-section');
    
    sections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.animation = `fadeSlideUp 0.6s ease ${index * 0.15}s forwards`;
    });
}