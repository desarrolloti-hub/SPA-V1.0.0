/* ========================================
   ROUTES - Definición de rutas
   ======================================== */

// Importar controllers de vistas
import { homeController } from '../pages/visitor/homeController.js';
import { init404Controller } from '../pages/shared/errors/404Controller.js';
import { loginController } from '../pages/visitor/loginController.js';
//Controllers de Partner
import { dashboardController } from '../pages/partner/dashboardController.js';
import { newCollaboratorController } from '../pages/partner/newCollaboratorController.js';
import { partnerCrudController } from '../pages/partner/partnerCrudController.js';
import { areaController } from '../pages/partner/areaController.js';
import { areaCrudController } from '../pages/partner/areaCrudController.js';
import { clienteController } from '../pages/partner/clienteController.js';
import { clientesCrudController } from '../pages/partner/clientesCrudController.js';
import { cotizacionesCrudController } from '../pages/partner/cotizacionesCrudController.js';
import { productosServiciosCrudController } from '../pages/partner/productoServicioCrudController.js';
import { productoServicioFormController } from '../pages/partner/productoServicioFormController.js';
import { categoriasCrudController } from '../pages/partner/categoriaCrudController.js';
import {productoServicioViewController} from '../pages/partner/productoServicioViewController.js';
import {cotizacionFormController} from '../pages/partner/cotizacionFormController.js';
import {facturaFormController} from '../pages/partner/facturaFormController.js';
import {facturasCrudController} from '../pages/partner/facturasCrudController.js';
import {ProfileController} from '../pages/partner/profileController.js';
import {ticketController} from '../pages/partner/ticketController.js';
import {ticketsCrudController} from '../pages/partner/ticketsCrudController.js';
import {ticketViewController} from '../pages/partner/ticketViewController.js';

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
    "/partner/dashboard": {
    view: '/pages/partner/dashboard.html',
    controller: dashboardController
    },
    "/partner/partner": {
    view: '/pages/partner/newPartner.html',
    controller: newCollaboratorController
    },
    "/partner/crudPartners": {
    view: '/pages/partner/partnersCrud.html',
    controller: partnerCrudController
    },
    "/partner/area": {
    view: '/pages/partner/areas.html',
    controller: areaController
    },
    "/partner/crudAreas": {
    view: '/pages/partner/areasCrud.html',
    controller: areaCrudController
    },
    "/partner/cliente": {
    view: '/pages/partner/clienteForm.html',
    controller: clienteController
    },
    "/partner/crudClientes": {
    view: '/pages/partner/clientesCrud.html',
    controller: clientesCrudController
    },
    "/partner/crudCotizaciones": {
    view: '/pages/partner/cotizacionesCrud.html',
    controller: cotizacionesCrudController
    },
    "/partner/crudProductosServicios": {
    view: '/pages/partner/productoServiciosCrud.html',
    controller: productosServiciosCrudController
    },
    "/partner/crudCategorias": {
    view: '/pages/partner/categoriasCrud.html',
    controller: categoriasCrudController
    },
    "/partner/productosServicios": {
    view: '/pages/partner/productoServicioForm.html',
    controller: productoServicioFormController
    },
    "/partner/productoServicioView": {
    view: '/pages/partner/productoServicioView.html',
    controller: productoServicioViewController
    },
    "/partner/cotizacion": {
    view: '/pages/partner/cotizacionForm.html',
    controller: cotizacionFormController
    },
    "/partner/factura": {
    view: '/pages/partner/facturaForm.html',
    controller: facturaFormController
    },
    "/partner/crudFacturas": {
    view: '/pages/partner/facturasCrud.html',
    controller: facturasCrudController
    },
    "/partner/profile": {
    view: '/pages/partner/profile.html',
    controller: ProfileController
    },
    "/partner/ticket": {
    view: '/pages/partner/ticketForm.html',
    controller: ticketController
    },
    "/partner/crudTickets": {
    view: '/pages/partner/ticketsCrud.html',
    controller: ticketsCrudController
    },
    "/partner/ticketView": {
    view: '/pages/partner/ticketView.html',
    controller: ticketViewController
    },
};