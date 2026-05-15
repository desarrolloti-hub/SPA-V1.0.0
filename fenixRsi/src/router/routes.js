/* ========================================
   ROUTES - Definición de rutas
   ======================================== */

// Importar controllers de vistas
import { homeController } from '../modules/visitor/home/homeController.js';
import { init404Controller } from '../modules/shared/errors/404Controller.js';

export const routes = {
    "/": {
        view: "/modules/visitor/home/home.html",
        controller: homeController
    },
    "/products": {
        view: "/modules/visitor/products/products.html",
        controller: null
    },
    "/services": {
        view: "/src/views/services.html",
        controller: null
    },
    "/nosotros": {
        view: "/src/views/nosotros.html",
        controller: null
    },
    "/contacto": {
        view: "/src/views/contacto.html",
        controller: null
    },
    "/blogs": {
        view: "/src/views/blogs.html",
        controller: null
    },
    "/admin": {
        view: "/src/views/admin.html",
        controller: null
    },
    '/404': {
    view: '/modules/shared/errors/404.html',
    controller: init404Controller
    }
};