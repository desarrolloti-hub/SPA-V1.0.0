/* ========================================
   CONFIGURACIÓN DEL CARRUSEL - Servicios
   ======================================== */

export const carouselConfigServices = {
    autoplay: true,
    interval: 6000,
    transitionDuration: 700,
    showIndicators: true,
    showArrows: true,
    pauseOnHover: true,
    slides: [
        {
            image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1920&q=70&fm=webp',
            title: 'Servicios Profesionales de Seguridad',
            description: 'Soluciones integrales adaptadas a las necesidades de tu hogar o negocio.',
            button: {
                text: 'Ver servicios',
                link: '#servicios',
                icon: 'fas fa-arrow-down'
            }
        },
        {
            image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1920&q=70&fm=webp',
            title: 'Instalación y Mantenimiento',
            description: 'Equipo certificado listo para proteger lo que más te importa.',
            button: {
                text: 'Cotizar ahora',
                link: '/contacto',
                icon: 'fas fa-arrow-right'
            }
        },
        {
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=70&fm=webp'
        }
    ]
};

export default carouselConfigServices;