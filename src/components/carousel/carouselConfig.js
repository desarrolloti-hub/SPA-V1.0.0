/* ========================================
   CONFIGURACIÓN DEL CARRUSEL
   ======================================== */

export const carouselConfig = {
    autoplay: true,
    interval: 6000,
    transitionDuration: 800,
    showIndicators: true,
    showArrows: true,
    pauseOnHover: true,
    slides: [
        {
            // Unsplash - URLs directas
            image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&q=80',
            title: 'Seguridad Electrónica Profesional',
            description: 'Protegemos lo que más te importa con tecnología de última generación y monitoreo 24/7.',
            button: {
                text: 'Conoce más',
                link: '/nosotros',
                icon: 'fas fa-arrow-right'
            }
        },
        {
            image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1920&q=80',
            title: 'Sistemas de Vigilancia Inteligente',
            description: 'Cámaras HD con inteligencia artificial y análisis en tiempo real para tu tranquilidad.',
            button: {
                text: 'Ver productos',
                link: '/products',
                icon: 'fas fa-box'
            }
        },
        {
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80'
        },
        {
            image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80',
            title: 'Soporte Técnico Especializado',
            description: 'Nuestro equipo de expertos está disponible los 365 días del año para ayudarte.'
        }
    ]
};

export default carouselConfig;