/* ========================================
   ROUTES - Definición de rutas
   ======================================== */

// Importar controllers de vistas
import { homeController } from '../pages/visitor/homeController.js';
import { init404Controller } from '../pages/shared/errors/404Controller.js';
import { loginController } from '../pages/visitor/loginController.js';
//Controllers de Partner
import { newCollaboratorController } from '../pages/partner/newCollaboratorController.js';
import { areaController } from '../pages/partner/areaController.js';
import { areaCrudController } from '../pages/partner/areaCrudController.js';

export const routes = {
    "/": {
        view: "/pages/visitor/home.html",
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
        view: "/pages/visitor/aboutus.html",
        controller: null
    },
    "/contacto": {
        view: "/pages/visitor/contact.html",
        controller: null
    },
    "/blogs": {
        view: "/pages/visitor/blogs/blogs.html",
        controller: null
    },
    "/login": {
        view: "/pages/visitor/login.html",
        controller: loginController
    },
    "/admin": {
        view: "/pages/visitor/admin/admin.html",
        controller: null
    },
    '/404': {
    view: '/pages/shared/errors/404.html',
    controller: init404Controller
    },
    "/partner": {
    view: '/pages/partner/newPartner.html',
    controller: newCollaboratorController
    },
    "/partner/area": {
    view: '/pages/partner/areas.html',
    controller: areaController
    },
    "/partner/crudAreas": {
    view: '/pages/partner/areasCrud.html',
    controller: areaCrudController
    }
};