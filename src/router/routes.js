/* ========================================
   ROUTES - Definición de rutas
   ======================================== */

// Importar controllers de vistas
import { homeController } from '../pages/visitor/home/homeController.js';
import { init404Controller } from '../pages/shared/errors/404Controller.js';

export const routes = {
    "/": {
        view: "/pages/visitor/home/home.html",
        controller: homeController
    },
    "/products": {
        view: "/pages/visitor/products/products.html",
        controller: null
    },
    "/services": {
        view: "/pages/visitor/services/services.html",
        controller: null
    },
    "/nosotros": {
        view: "/pages/visitor/nosotros/nosotros.html",
        controller: null
    },
    "/contacto": {
        view: "/pages/visitor/contacto/contacto.html",
        controller: null
    },
    "/blogs": {
        view: "/pages/visitor/blogs/blogs.html",
        controller: null
    },
    "/admin": {
        view: "/pages/visitor/admin/admin.html",
        controller: null
    },
    '/404': {
    view: '/pages/shared/errors/404.html',
    controller: init404Controller
    }
};