/* ========================================
   ROUTES - Definición de rutas
   ======================================== */

// Importar controllers de vistas
import { homeController } from '../controllers/visitor/homeController.js';
import { aboutusController } from '../controllers/visitor/aboutusController.js';
import { contactController } from '../controllers/visitor/contactController.js';
import { init404Controller } from '../controllers/shared/errors/404Controller.js';
import { loginController } from '../controllers/visitor/loginController.js';
import { registerController } from '../controllers/visitor/registerController.js';
import { servicesController } from '../controllers/visitor/servicescController.js';
import { catalogsPublicController } from '../controllers/visitor/catalogosPublicController.js';
import { viewCatalogPublicController } from '../controllers/visitor/viewCatalogPublicController.js';
import { productsController } from '../controllers/visitor/productsController.js';
import { productDetailController } from '../controllers/visitor/productDetailController.js';
//Controllers de Partner
import { dashboardController } from '../controllers/partner/dashboardController.js';
import { newCollaboratorController } from '../controllers/partner/newCollaboratorController.js';
import { partnerCrudController } from '../controllers/partner/partnerCrudController.js';
import { areaController } from '../controllers/partner/areaController.js';
import { areaCrudController } from '../controllers/partner/areaCrudController.js';
import { clienteController } from '../controllers/partner/clienteController.js';
import { clientesCrudController } from '../controllers/partner/clientesCrudController.js';
import { cotizacionesCrudController } from '../controllers/partner/cotizacionesCrudController.js';
import { productosServiciosCrudController } from '../controllers/partner/productoServicioCrudController.js';
import { productoServicioFormController } from '../controllers/partner/productoServicioFormController.js';
import { categoriasCrudController } from '../controllers/partner/categoriaCrudController.js';
import {productoServicioViewController} from '../controllers/partner/productoServicioViewController.js';
import {cotizacionFormController} from '../controllers/partner/cotizacionFormController.js';
import {facturaFormController} from '../controllers/partner/facturaFormController.js';
import {facturasCrudController} from '../controllers/partner/facturasCrudController.js';
import {ProfileController} from '../controllers/partner/profileController.js';
import {ticketController} from '../controllers/partner/ticketController.js';
import {ticketsCrudController} from '../controllers/partner/ticketsCrudController.js';
import {ticketViewController} from '../controllers/partner/ticketViewController.js';
import {ticketAtencionController} from '../controllers/partner/ticketAtencionController.js';
import {catalogController} from '../controllers/partner/catalogController.js';
import {crudCatalogsController} from '../controllers/partner/crudCatalogsController.js';
import {viewCatalogController} from '../controllers/partner/viewCatalogController.js';
import { asistenciaController } from '../controllers/partner/asistenciaController.js';
import { asistenciasCrudController } from '../controllers/partner/asistenciasCrudController.js';
import { reembolsoFormController } from '../controllers/partner/reembolsoFormController.js';
import { misReembolsosController } from '../controllers/partner/misReembolsosController.js';
import { reembolsosCrudController } from '../controllers/partner/reembolsosCrudController.js';
import { vehiculosCrudController } from '../controllers/partner/vehiculosCrudController.js';
import { vehiculoDetalleController } from '../controllers/partner/vehiculoDetalleController.js';
import { vehiculoFormController } from '../controllers/partner/vehiculoFormController.js';
import { checklistSalidaFormController } from '../controllers/partner/checklistSalidaFormController.js';
import { checklistsCrudController } from '../controllers/partner/checklistsCrudController.js';
import { misSalidasController } from '../controllers/partner/misSalidasController.js';
import { estadisticasController } from '../controllers/partner/estadisticasController.js';
import { carruselCrudController } from '../controllers/partner/carruselCrudController.js';
import { carruselFormController } from '../controllers/partner/carruselFormController.js';
import { ecommerceCategoriasController } from '../controllers/partner/ecommerceCategoriasController.js';
import { ecommerceCategoriaFormController } from '../controllers/partner/ecommerceCategoriaFormController.js';
import { ecommerceMarcasController } from '../controllers/partner/ecommerceMarcasController.js';
import { ecommerceMarcaFormController } from '../controllers/partner/ecommerceMarcaFormController.js';
import { ecommerceProductosController } from '../controllers/partner/ecommerceProductosController.js';
import { ecommerceProductoFormController } from '../controllers/partner/ecommerceProductoFormController.js';
import { buyerDashboardController } from '../controllers/buyer/buyerDashboardController.js';
import { buyerCartController } from '../controllers/buyer/buyerCartController.js';
import { buyerWishlistController } from '../controllers/buyer/buyerWishlistController.js';
import { buyerProfileController } from '../controllers/buyer/buyerProfileController.js';

export const routes = {
    "/": {
        view: "/pages/visitor/home.html",
        controller: homeController,
        title: "Inicio | RSI Enterprise"
    },
    "/products": {
        view: "/pages/visitor/products.html",
        controller: productsController,
        title: "Productos | RSI Enterprise"
    },
    "/productos": {
        view: "/pages/visitor/products.html",
        controller: productsController,
        title: "Productos | RSI Enterprise"
    },
    "/productDetail": {
        view: "/pages/visitor/productDetail.html",
        controller: productDetailController,
        title: "Detalle de Producto | RSI Enterprise"
    },
    "/producto": {
        view: "/pages/visitor/productDetail.html",
        controller: productDetailController,
        title: "Productos | RSI Enterprise"
    },
    "/services": {
        view: "/pages/visitor/services.html",
        controller: servicesController,
        title: "Servicios | RSI Enterprise"
    },
    "/servicios": {
        view: "/pages/visitor/services.html",
        controller: servicesController,
        title: "Servicios | RSI Enterprise"
    },
    "/nosotros": {
        view: "/pages/visitor/aboutus.html",
        controller: aboutusController,
        title: "Nosotros | RSI Enterprise"
    },
    "/aboutus": {
        view: "/pages/visitor/aboutus.html",
        controller: aboutusController,
        title: "Nosotros | RSI Enterprise"
    },
    "/contacto": {
        view: "/pages/visitor/contact.html",
        controller: contactController,
        title: "Contacto | RSI Enterprise"
    },
    "/contact": {
        view: "/pages/visitor/contact.html",
        controller: contactController,
        title: "Contacto | RSI Enterprise"
    },
    "/blogs": {
        view: "/pages/shared/errors/404.html",
        controller: init404Controller,
        title: "Blogs | RSI Enterprise"
    },
    "/login": {
        view: "/pages/visitor/login.html",
        controller: loginController,
        title: "Iniciar Sesión | RSI Enterprise"
    },
    "/register": {
        view: "/pages/visitor/register.html",
        controller: registerController,
        title: "Registro de Cliente | RSI Enterprise"
    },
    "/registro": {
        view: "/pages/visitor/register.html",
        controller: registerController,
        title: "Registro de Cliente | RSI Enterprise"
    },
    "/admin": {
        view: "/pages/shared/errors/404.html",
        controller: init404Controller,
        title: "Página no encontrada | RSI Enterprise"
    },
    '/404': {
        view: '/pages/shared/errors/404.html',
        controller: init404Controller,
        title: "Página no encontrada | RSI Enterprise"
    },
    "/partner/dashboard": {
        view: '/pages/partner/dashboard.html',
        controller: dashboardController,
        title: "Dashboard Operativo | RSI Enterprise"
    },
    "/partner/partner": {
        view: '/pages/partner/newPartner.html',
        controller: newCollaboratorController,
        title: "Gestión de Colaborador | RSI Enterprise"
    },
    "/partner/crudPartners": {
        view: '/pages/partner/partnersCrud.html',
        controller: partnerCrudController,
        title: "Colaboradores | RSI Enterprise"
    },
    "/partner/area": {
        view: '/pages/partner/areas.html',
        controller: areaController,
        title: "Gestión de Área | RSI Enterprise"
    },
    "/partner/crudAreas": {
        view: '/pages/partner/areasCrud.html',
        controller: areaCrudController,
        title: "Áreas y Puestos | RSI Enterprise"
    },
    "/partner/cliente": {
        view: '/pages/partner/clienteForm.html',
        controller: clienteController,
        title: "Registro de Cliente | RSI Enterprise"
    },
    "/partner/crudClientes": {
        view: '/pages/partner/clientesCrud.html',
        controller: clientesCrudController,
        title: "Clientes | RSI Enterprise"
    },
    "/partner/crudCotizaciones": {
        view: '/pages/partner/cotizacionesCrud.html',
        controller: cotizacionesCrudController,
        title: "Cotizaciones | RSI Enterprise"
    },
    "/partner/crudProductosServicios": {
        view: '/pages/partner/productoServiciosCrud.html',
        controller: productosServiciosCrudController,
        title: "Productos y Servicios | RSI Enterprise"
    },
    "/partner/crudCategorias": {
        view: '/pages/partner/categoriasCrud.html',
        controller: categoriasCrudController,
        title: "Categorías de Productos | RSI Enterprise"
    },
    "/partner/productosServicios": {
        view: '/pages/partner/productoServicioForm.html',
        controller: productoServicioFormController,
        title: "Catálogo de Productos y Servicios | RSI Enterprise"
    },
    "/partner/productoServicioView": {
        view: '/pages/partner/productoServicioView.html',
        controller: productoServicioViewController,
        title: "Detalle de Producto o Servicio | RSI Enterprise"
    },
    "/partner/cotizacion": {
        view: '/pages/partner/cotizacionForm.html',
        controller: cotizacionFormController,
        title: "Nueva Cotización | RSI Enterprise"
    },
    "/partner/factura": {
        view: '/pages/partner/facturaForm.html',
        controller: facturaFormController,
        title: "Emisión de Factura | RSI Enterprise"
    },
    "/partner/crudFacturas": {
        view: '/pages/partner/facturasCrud.html',
        controller: facturasCrudController,
        title: "Facturación CFDI 4.0 | RSI Enterprise"
    },
    "/partner/profile": {
        view: '/pages/partner/profile.html',
        controller: ProfileController,
        title: "Mi Perfil | RSI Enterprise"
    },
    "/partner/ticket": {
        view: '/pages/partner/ticketForm.html',
        controller: ticketController,
        title: "Gestión de Ticket | RSI Enterprise"
    },
    "/partner/crudTickets": {
        view: '/pages/partner/ticketsCrud.html',
        controller: ticketsCrudController,
        title: "Tickets de Soporte | RSI Enterprise"
    },
    "/partner/ticketView": {
        view: '/pages/partner/ticketView.html',
        controller: ticketViewController,
        title: "Detalle de Ticket | RSI Enterprise"
    },
    "/partner/ticketAtencion": {
        view: '/pages/partner/ticketAtencion.html',
        controller: ticketAtencionController,
        title: "Atención y Cierre de Ticket | RSI Enterprise"
    },
    "/partner/catalogo": {
        view: '/pages/partner/newCatalog.html',
        controller: catalogController,
        title: "Nuevo Catálogo | RSI Enterprise"
    },
    "/partner/crudCatalogos": {
        view: '/pages/partner/crudCatalogs.html',
        controller: crudCatalogsController,
        title: "Gestión de Catálogos | RSI Enterprise"
    },
    "/partner/verCatalogo": {
        view: '/pages/partner/viewCatalog.html',
        controller: viewCatalogController,
        title: "Visualizador de Catálogo | RSI Enterprise"
    },
    "/catalogos": {
        view: '/pages/visitor/catalogsPublic.html',
        controller: catalogsPublicController,
        title: "Catálogos Comerciales | RSI Enterprise"
    },
    "/verCatalogo": {
        view: '/pages/visitor/viewCatalogPublic.html',
        controller: viewCatalogPublicController,
        title: "Visualizador de Catálogo | RSI Enterprise"
    },
    "/partner/asistencia": {
        view: '/pages/partner/asistencia.html',
        controller: asistenciaController,
        title: "Control de Asistencia | RSI Enterprise"
    },
    "/partner/crudAsistencias": {
        view: '/pages/partner/asistenciasCrud.html',
        controller: asistenciasCrudController,
        title: "Panel de Asistencias | RSI Enterprise"
    },
    "/hr/asistencias": {
        view: '/pages/partner/asistenciasCrud.html',
        controller: asistenciasCrudController,
        title: "Panel de Asistencias | RSI Enterprise"
    },
    "/partner/reembolso": {
        view: '/pages/partner/reembolsoForm.html',
        controller: reembolsoFormController,
        title: "Solicitar Reembolso Propio | RSI Enterprise"
    },
    "/partner/reembolsos": {
        view: '/pages/partner/misReembolsos.html',
        controller: misReembolsosController,
        title: "Mis Reembolsos | RSI Enterprise"
    },
    "/partner/crudReembolsos": {
        view: '/pages/partner/reembolsosCrud.html',
        controller: reembolsosCrudController,
        title: "Panel de Reembolsos a Colaboradores | RSI Enterprise"
    },
    "/hr/reembolsos": {
        view: '/pages/partner/reembolsosCrud.html',
        controller: reembolsosCrudController,
        title: "Panel de Reembolsos a Colaboradores | RSI Enterprise"
    },
    "/partner/vehiculos": {
        view: '/pages/partner/vehiculosCrud.html',
        controller: vehiculosCrudController,
        title: "Parque Vehicular | RSI Enterprise"
    },
    "/partner/vehiculo-form": {
        view: '/pages/partner/vehiculoForm.html',
        controller: vehiculoFormController,
        title: "Formulario de Vehículo | RSI Enterprise"
    },
    "/partner/nuevoVehiculo": {
        view: '/pages/partner/vehiculoForm.html',
        controller: vehiculoFormController,
        title: "Registrar Automóvil | RSI Enterprise"
    },
    "/partner/vehiculoDetalle": {
        view: '/pages/partner/vehiculoDetalle.html',
        controller: vehiculoDetalleController,
        title: "Ficha de Automóvil | RSI Enterprise"
    },
    "/partner/checklist-salida": {
        view: '/pages/partner/checklistSalidaForm.html',
        controller: checklistSalidaFormController,
        title: "Checklist de Salida Vehicular | RSI Enterprise"
    },
    "/partner/checklists-vehiculos": {
        view: '/pages/partner/checklistsCrud.html',
        controller: checklistsCrudController,
        title: "Historial de Salidas Vehiculares | RSI Enterprise"
    },
    "/ops/checklist": {
        view: '/pages/partner/checklistSalidaForm.html',
        controller: checklistSalidaFormController,
        title: "Checklist de Salida Vehicular | RSI Enterprise"
    },
    "/ops/historial": {
        view: '/pages/partner/checklistsCrud.html',
        controller: checklistsCrudController,
        title: "Historial de Salidas Vehiculares | RSI Enterprise"
    },
    "/partner/mis-salidas": {
        view: '/pages/partner/misSalidas.html',
        controller: misSalidasController,
        title: "Mis Salidas y Firmas | RSI Enterprise"
    },
    "/partner/estadisticas": {
        view: '/pages/partner/estadisticas.html',
        controller: estadisticasController,
        title: "Estadísticas y Rendimiento | RSI Enterprise"
    },
    "/support/estadisticas": {
        view: '/pages/partner/estadisticas.html',
        controller: estadisticasController,
        title: "Estadísticas y Rendimiento | RSI Enterprise"
    },
    "/ecommerce/carrusel": {
        view: '/pages/partner/carruselCrud.html',
        controller: carruselCrudController,
        title: "Gestión de Carrusel | RSI Enterprise"
    },
    "/partner/carrusel": {
        view: '/pages/partner/carruselCrud.html',
        controller: carruselCrudController,
        title: "Gestión de Carrusel | RSI Enterprise"
    },
    "/ecommerce/carrusel-form": {
        view: '/pages/partner/carruselForm.html',
        controller: carruselFormController,
        title: "Formulario de Diapositiva | RSI Enterprise"
    },
    "/partner/carrusel-form": {
        view: '/pages/partner/carruselForm.html',
        controller: carruselFormController,
        title: "Formulario de Diapositiva | RSI Enterprise"
    },
    "/ecommerce/categorias": {
        view: '/pages/partner/ecommerceCategorias.html',
        controller: ecommerceCategoriasController,
        title: "Gestión de Categorías | RSI Enterprise"
    },
    "/partner/categorias": {
        view: '/pages/partner/ecommerceCategorias.html',
        controller: ecommerceCategoriasController,
        title: "Gestión de Categorías | RSI Enterprise"
    },
    "/ecommerce/categoria-form": {
        view: '/pages/partner/ecommerceCategoriaForm.html',
        controller: ecommerceCategoriaFormController,
        title: "Formulario de Categoría | RSI Enterprise"
    },
    "/partner/categoria-form": {
        view: '/pages/partner/ecommerceCategoriaForm.html',
        controller: ecommerceCategoriaFormController,
        title: "Formulario de Categoría | RSI Enterprise"
    },
    "/ecommerce/marcas": {
        view: '/pages/partner/ecommerceMarcas.html',
        controller: ecommerceMarcasController,
        title: "Gestión de Marcas | RSI Enterprise"
    },
    "/partner/marcas": {
        view: '/pages/partner/ecommerceMarcas.html',
        controller: ecommerceMarcasController,
        title: "Gestión de Marcas | RSI Enterprise"
    },
    "/ecommerce/marca-form": {
        view: '/pages/partner/ecommerceMarcaForm.html',
        controller: ecommerceMarcaFormController,
        title: "Formulario de Marca | RSI Enterprise"
    },
    "/partner/marca-form": {
        view: '/pages/partner/ecommerceMarcaForm.html',
        controller: ecommerceMarcaFormController,
        title: "Formulario de Marca | RSI Enterprise"
    },
    "/ecommerce/productos": {
        view: '/pages/partner/ecommerceProductos.html',
        controller: ecommerceProductosController,
        title: "Catálogo de Productos | RSI Enterprise"
    },
    "/partner/productos": {
        view: '/pages/partner/ecommerceProductos.html',
        controller: ecommerceProductosController,
        title: "Catálogo de Productos | RSI Enterprise"
    },
    "/ecommerce/producto-form": {
        view: '/pages/partner/ecommerceProductoForm.html',
        controller: ecommerceProductoFormController,
        title: "Formulario de Producto | RSI Enterprise"
    },
    "/partner/producto-form": {
        view: '/pages/partner/ecommerceProductoForm.html',
        controller: ecommerceProductoFormController,
        title: "Formulario de Producto | RSI Enterprise"
    },
    "/buyer/dashboard": {
        view: '/pages/buyer/buyerDashboard.html',
        controller: buyerDashboardController,
        title: "Área de Cliente | RSI Enterprise"
    },
    "/buyer/cart": {
        view: '/pages/buyer/buyerCart.html',
        controller: buyerCartController,
        title: "Mi Carrito | RSI Enterprise"
    },
    "/buyer/wishlist": {
        view: '/pages/buyer/buyerWishlist.html',
        controller: buyerWishlistController,
        title: "Lista de Deseos | RSI Enterprise"
    },
    "/buyer/profile": {
        view: '/pages/buyer/buyerProfile.html',
        controller: buyerProfileController,
        title: "Mi Perfil | RSI Enterprise"
    },
    "/support/mis-salidas": {
        view: '/pages/partner/misSalidas.html',
        controller: misSalidasController,
        title: "Mis Salidas y Firmas | RSI Enterprise"
    },
};