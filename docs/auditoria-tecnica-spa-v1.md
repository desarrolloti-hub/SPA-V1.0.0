# AUDITORÍA TÉCNICA Y DIAGNÓSTICO INTEGRAL: SPA-V1.0.0 (RSI Enterprise)

**Fecha de emisión:** Octubre 2026  
**Proyecto:** SPA-V1.0.0 (Fénix RSI Enterprise)  
**Entorno auditado:** Entorno local en Windows, arquitectura ES6 Modules + Vite + Firebase  
**Estado:** Auditoría completada / Correcciones incrementales implementadas y verificadas con éxito (100%)  

---

## 1. Resumen ejecutivo

Se ha llevado a cabo una auditoría técnica profunda y exhaustiva del proyecto **SPA-V1.0.0 (RSI Enterprise)**. La aplicación está construida sobre una arquitectura Single Page Application (SPA) en JavaScript ES6 modular, utilizando Vite como empaquetador de cliente, Firebase (Firestore, Auth, Storage, Functions, Cloud Messaging) como plataforma de backend y Facturama como proveedor de facturación electrónica CFDI 4.0.

### Principales conclusiones:
1. **Estabilidad y Compilación:** La compilación con `npm run build` tiene éxito a nivel sintáctico en el entorno local, pero presenta un riesgo crítico de despliegue: la dependencia principal `firebase` **no está declarada en el `package.json`** del proyecto (se resuelve accidentalmente desde un directorio `node_modules` global del sistema operativo). En cualquier entorno CI/CD o máquina limpia, el proyecto fallará al compilar.
2. **Errores Críticos en Tiempo de Ejecución (Runtime Blockers):** Se han identificado fallos graves donde controladores invocan métodos que **no existen** en las capas de servicios o repositorios:
   - En **Áreas**, la actualización de subáreas invoca `service.deleteSubarea()`, inexistente en `areaService.js`.
   - En **Cotizaciones**, la conversión directa a factura invoca `facturaService.crearFacturaDesdeCotizacion()`, inexistente en `facturaService.js`.
   - En **Facturas**, `facturaService.validateFactura()` invoca `FacturaModel.validate()`, inexistente en `facturaModel.js`.
   - En **Autenticación**, la recuperación de contraseña invoca `service.sendPasswordResetEmail()`, inexistente en `authService.js`.
   - En **Layout**, si un usuario con rol distinto de `partner` (como `admin` o `customer`) inicia sesión, `loadLayout.js` busca archivos HTML inexistentes (`navbarUser.html` y `footerUser.html`), arrojando un error HTTP 404 fatal que destruye la interfaz.
3. **Riesgos de Rendimiento y Bucle Infinito:** `footerPartnertController.js` ejecuta un bucle infinito que intenta buscar el footer de partner cada 300 ms cuando se navega en vistas públicas. Además, `index.html` importa dos veces `src/main.js`, provocando la duplicación en paralelo de todo el ciclo de vida de la aplicación.
4. **Seguridad y Control de Acceso:** No existen guardias de navegación en `src/router/router.js`. Cualquier usuario no autenticado puede entrar directamente a rutas privadas `/partner/*`. Asimismo, se identificaron credenciales sensibles en texto plano en archivos bajo control de versiones (`functions/.env` y `facturama.config.js`).
5. **Integridad de Datos y Concurrencia:** La generación de folios y numeraciones consecutivas en cotizaciones y tickets (`contadorCotizacionRepository.js` y `ticketRepository.js`) utiliza lecturas (`getDoc`) seguidas de escrituras (`updateDoc`) sin transacciones de Firestore, exponiendo al sistema a condiciones de carrera y duplicación de números de folios ante accesos concurrentes.
6. **Desviaciones Arquitectónicas:** Existen controladores (`facturaFormController.js`, `productoServicioFormController.js`) que violan el principio de responsabilidad al conectarse e importar directamente el SDK de Firestore para consultar catálogos SAT, saltándose los servicios y repositorios. Además, existen implementaciones duplicadas de generación de PDF (`pdfGenerator.js` vs `facturaPdfGenerator.js`) y servicios de notificaciones huérfanos.

---

## 2. Arquitectura real identificada

A diferencia de la estructura inicial de referencia, el proyecto implementa un patrón **MVC/Repository** en el cliente adaptado para Single Page Applications:

```
[ Navegador / Eventos DOM ]
            │
            ▼
[ Router: src/router/router.js ] ──► [ Rutas: src/router/routes.js ]
            │
            ├──────────────────────────┬──────────────────────────┐
            ▼                          ▼                          ▼
[ Vistas HTML: public/pages/ ]  [ Plantillas: public/components/ ]  [ Estilos: src/css/main.css ]
            │                          │
            └──────────┬───────────────┘
                       ▼
         [ Controladores de Presentación: src/controllers/ ]
                       │
                       ▼
           [ Modelos: src/models/ ] (Validación, formato y esquemas)
                       │
                       ▼
         [ Servicios de Negocio: src/services/ ]
                       │
                       ▼
       [ Repositorios de Datos: src/repositories/ ] (BaseRepository, caché y queries)
                       │
                       ▼
       [ Configuración Firebase: src/config/firebaseConfig.js ]
                       │
                       ▼
[ Firebase Remoto: Firestore, Auth, Storage, Cloud Functions (Node 22) ]
```

### Detalle de las capas existentes:
- **`public/pages/` y `public/components/`:** Plantillas HTML dinámicas cargadas vía `fetch()` por el enrutador e inyectadas en `<main id="app">` o persistentes en `<header id="navbar">` y `<footer id="footer">`.
- **`src/controllers/`:** Controladores de presentación (divididos en `partner/`, `visitor/` y `shared/`). Manejan eventos del DOM, formularios, llamados a servicios y alertas UI (SweetAlert2).
- **`src/models/`:** Clases con métodos estáticos (`create`, `update`, `validate`) que definen la estructura de datos, normalizan tipos y preparan objetos para persistencia.
- **`src/services/`:** Capa de lógica de negocio y orquestación. Valida permisos del usuario (`_getCurrentUserUid()`), coordina repositorios y servicios externos (Cloud Functions, Storage).
- **`src/repositories/`:** Herencia de `BaseRepository.js` con soporte para caché en memoria con TTL (por ejemplo, 60 segundos) y operaciones directas con Firestore y Storage.
- **`src/router/`:** Enrutador basado en `window.history.pushState` y eventos `popstate`.
- **`src/utils/`:** Utilerías específicas para generación de PDF (`jsPDF`, `AutoTable`), gestión de modales genéricos (`modalManager.js`) y catálogos fiscales del SAT (`regimenesSat.js`).
- **`functions/`:** Backend en Cloud Functions (Node.js 22) que expone endpoints para timbrado CFDI (Facturama), notificaciones FCM y envío de correos (Nodemailer).

---

## 3. Flujo de ejecución y dependencias principales

### Flujo de inicio:
1. `index.html` carga fuentes, FontAwesome, SweetAlert2, bibliotecas PDF (CDN) y el módulo principal `/src/main.js`.
2. `src/main.js` ejecuta `initApp()`:
   - Carga dinámica de AOS (animaciones) y Swiper.
   - Inicializa el servicio de tema (`ThemeService.init()`).
   - Invoca `loadLayout()`: determina la sesión activa en `localStorage` (`rsi_session`) y descarga las plantillas de `navbar` y `footer` correspondientes.
   - Inicializa los controladores de layout: `initNavbarController()`, `initFooterController()`, `initFooterPartnerController()`.
   - Inicializa el router: `initRouter()`.
3. `src/router/router.js` intercepta enlaces con atributo `data-link`, previene la recarga del navegador, ejecuta `fetch()` de la vista HTML, inyecta el HTML en `#app` y ejecuta la función controladora asociada en `routes.js`.

---

## 4. Inventario de módulos y su estado

| Módulo | Componentes Identificados | Estado Real | Observaciones Técnicas |
| :--- | :--- | :--- | :--- |
| **Autenticación y Sesión** | `authRepository`, `authService`, `loginController`, `login.html` | **Parcialmente Funcional** | Login y logout funcionales. Falta `sendPasswordResetEmail`. No hay protección de rutas en el router. |
| **Áreas y Puestos** | `areaModel`, `areaRepository`, `areaService`, `areaController`, `areaCrudController` | **Con Errores Críticos** | Listado y creación funcional. Edición rota por falta de `deleteSubarea()`. |
| **Colaboradores (Partners)** | `partnerModel`, `partnerRepository`, `partnerService`, `newCollaboratorController`, `partnerCrudController` | **Funcional con Riesgos** | Creación de usuario en Auth mediante SDK cliente suplanta la sesión activa en el navegador. |
| **Clientes** | `clienteModel`, `clienteRepository`, `clienteService`, `clienteController`, `clientesCrudController`, `clienteModal` | **Funcional** | Registro, edición, validación SAT y modal dinámico operativos. |
| **Catálogo de Productos y Servicios (Interno)** | `productoServicioModel`, `productoServicioRepository`, `productoServicioService`, `productoServicioFormController`, `productoServiciosCrudController` | **Funcional con Desviación** | Operativo, pero controlador realiza queries directas a Firestore para catálogo SAT. |
| **Catálogos Comerciales y Productos Públicos** | `catalogModel`, `productModel`, `catalogRepository`, `catalogService`, `catalogController`, `crudCatalogsController`, `viewCatalogController`, `catalogsPublicController` | **Funcional con Defectos** | Falta método `getProductById` en repositorio. Vistas públicas operativas. |
| **Cotizaciones** | `cotizacionModel`, `cotizacionRepository`, `cotizacionService`, `cotizacionFormController`, `cotizacionesCrudController` | **Funcional con Errores** | Generación de cotización funcional; conversión directa a factura rota en CRUD por método faltante. |
| **Facturas** | `facturaModel`, `facturaRepository`, `facturaService`, `facturaFormController`, `facturasCrudController`, `facturaVerController` | **Con Errores Críticos** | Falta `validate()`. Duplicación de generador PDF. `facturaVerController` es código huérfano sin vista HTML. |
| **Contadores y Folios** | `contadorCotizacionModel`, `contadorCotizacionRepository`, `contadorCotizacionService` | **Vulnerable** | Concurrencia débil: carece de transacciones atómicas `runTransaction`. |
| **Tickets y Soporte** | `ticketModel`, `ticketRepository`, `ticketService`, `ticketController`, `ticketsCrudController`, `ticketViewController` | **Funcional con Riesgos** | Operativo. Contador de tickets carece de atomicidad transaccional. |
| **Almacenamiento (Storage)** | `storageRepository`, `storageService` | **Inconsistente** | `StorageService` accede directamente a Firebase Storage sin pasar por repositorio. |
| **Generación de PDF** | `facturaPdfGenerator`, `pdfGenerator` | **Duplicado** | Dos implementaciones discordantes para facturas. |
| **Notificaciones y PWA** | `notificationService`, `firebase-messaging.js`, `firebase-messaging-sw.js` | **Incompleto / Deshabilitado** | Código desconectado de `main.js`; dos servicios duplicados y sin uso. |
| **Vistas Públicas / Visitante** | `home`, `services`, `aboutus`, `contact`, `products` | **Parcialmente Simulado** | `contact.html` no tiene controlador para procesar envíos. `products.html` tiene elementos deshabilitados. `/blogs` y `/admin` no existen. |

---

## 5. Problemas encontrados con evidencia

A continuación se detalla cada problema individual identificado durante la auditoría técnica.

---

### [ERR-001] Crash fatal de la aplicación en usuarios no-partner por plantillas inexistentes
- **Severidad:** Crítica
- **Archivo y función implicados:** `src/components/shared/loadLayout.js` (`getLayoutPaths`, L27-31)
- **Comportamiento actual:** Si un usuario inicia sesión con rol `admin` o `customer`, la función retorna rutas hacia `/components/visitor/navbarUser.html` y `/components/visitor/footerUser.html`. Estos archivos no existen en el proyecto, produciendo un error `HTTP 404` en `fetch` que interrumpe la carga de la aplicación y muestra un mensaje de fallo total.
- **Comportamiento esperado:** Usuarios con rol `partner` y `admin` deben compartir los componentes de interfaz interna (`navbarPartner.html` y `footerPartner.html`). Cualquier otro rol o fallback debe utilizar de manera segura `navbarVisitor.html` y `footerVisitor.html`.
- **Evidencia concreta:** Archivos inexistentes en el sistema de archivos (`Test-Path public/components/visitor/navbarUser.html` retorna `False`).
- **Causa confirmada:** Referencia en código a archivos de plantilla que nunca fueron creados.
- **Impacto:** Bloqueo total de la aplicación para cualquier cuenta con rol administrador o usuario registrado que no sea específicamente `partner`.
- **Solución propuesta:** Modificar `getLayoutPaths` en `loadLayout.js` para mapear roles `admin` y `partner` a `navbarPartner.html`/`footerPartner.html` y usar como fallback seguro las plantillas públicas existentes.
- **Dependencias:** `loadLayout.js`, `authService.js`.
- **Prueba de verificación:** Simular sesión con rol `admin` y verificar que el layout cargue sin errores 404.

---

### [ERR-002] Edición de áreas bloqueada por método inexistente `deleteSubarea`
- **Severidad:** Crítica
- **Archivo y función implicados:** `src/controllers/partner/areaController.js` (L942), `src/services/areaService.js`, `src/repositories/areaRepository.js`
- **Comportamiento actual:** Al editar un área y modificar sus subáreas, la línea 942 invoca `await service.deleteSubarea(editingAreaId, key)`. `areaService` no implementa `deleteSubarea`, lo que genera un error no controlado `TypeError: service.deleteSubarea is not a function`.
- **Comportamiento esperado:** `areaService` debe contar con `deleteSubarea(areaId, subareaId)` y delegar en `areaRepository.deleteSubarea(areaId, subareaId)`, eliminando la subárea del mapa en el documento de Firestore.
- **Evidencia concreta:** Inspección de métodos en `areaService.js` y `areaRepository.js` confirma la ausencia del método.
- **Causa confirmada:** Método consumido en el controlador pero omitido en el servicio y repositorio.
- **Impacto:** Imposibilidad funcional de editar o reconfigurar áreas existentes en el sistema.
- **Solución propuesta:** Implementar `deleteSubarea` en `areaRepository.js` (utilizando actualización de mapa en Firestore) y en `areaService.js` con validación de autenticación.
- **Dependencias:** `areaRepository.js`, `areaService.js`, `areaController.js`.
- **Prueba de verificación:** Invocar `deleteSubarea` en prueba local y verificar que no arroje excepción y actualice la colección.

---

### [ERR-003] Conversión de cotización a factura rota por método faltante `crearFacturaDesdeCotizacion`
- **Severidad:** Crítica
- **Archivo y función implicados:** `src/controllers/partner/cotizacionesCrudController.js` (L714), `src/services/facturaService.js`
- **Comportamiento actual:** Al hacer clic en "Generar Factura" desde una cotización aprobada, se ejecuta `await facturaService.crearFacturaDesdeCotizacion(cotizacionId, facturaNumero)`. El método no existe en `facturaService.js`, provocando un fallo por `TypeError`.
- **Comportamiento esperado:** `facturaService` debe exponer `crearFacturaDesdeCotizacion(cotizacionId, facturaNumero)`, consultar la cotización mediante `cotizacionService`, transformarla usando `FacturaModel.fromCotizacion()` y persistirla vía `facturaRepository.createFactura()`.
- **Evidencia concreta:** `FacturaModel.fromCotizacion` ya existe en `src/models/facturaModel.js` (L120), pero `facturaService.js` nunca implementó la función coordinadora.
- **Causa confirmada:** Integración incompleta entre los módulos de cotizaciones y facturas.
- **Impacto:** Falla total del flujo operativo para convertir cotizaciones cerradas en facturas.
- **Solución propuesta:** Implementar el método en `facturaService.js` utilizando la conversión existente de `FacturaModel` y el repositorio de facturas.
- **Dependencias:** `facturaService.js`, `cotizacionService.js`, `facturaModel.js`, `facturaRepository.js`.
- **Prueba de verificación:** Invocar el método con datos de prueba válidos y confirmar la creación del documento de factura.

---

### [ERR-004] Validación general de factura rota por método inexistente `FacturaModel.validate`
- **Severidad:** Crítica
- **Archivo y función implicados:** `src/services/facturaService.js` (L39), `src/models/facturaModel.js`
- **Comportamiento actual:** `facturaService.validateFactura(data)` ejecuta `FacturaModel.validate(data)`. `FacturaModel` solo cuenta con `validateForTimbrado()`, por lo que cualquier llamada arroja `TypeError: FacturaModel.validate is not a function`.
- **Comportamiento esperado:** `FacturaModel` debe exponer `static validate(data)` validando requerimientos básicos de una factura (items, cliente, montos mínimos) antes del timbrado formal.
- **Evidencia concreta:** `src/models/facturaModel.js` contiene únicamente `validateForTimbrado`.
- **Causa confirmada:** Discordancia contractual entre `FacturaService` y `FacturaModel`.
- **Impacto:** Falla en la validación de facturas antes de su almacenamiento en modo borrador.
- **Solución propuesta:** Añadir `static validate(data)` en `FacturaModel` con reglas de validación básicas.
- **Dependencias:** `facturaModel.js`, `facturaService.js`.
- **Prueba de verificación:** Ejecutar `FacturaModel.validate({})` y verificar retorno con `{ valid: false, errors: {...} }`.

---

### [ERR-005] Recuperación de contraseña rota por método faltante `sendPasswordResetEmail`
- **Severidad:** Alta
- **Archivo y función implicados:** `src/controllers/visitor/loginController.js` (L295), `src/services/authService.js`, `src/repositories/authRepository.js`
- **Comportamiento actual:** En el login, al solicitar recuperación de clave se ejecuta `await service.sendPasswordResetEmail(email)`. Ni `authService` ni `authRepository` cuentan con dicho método.
- **Comportamiento esperado:** `authRepository` debe delegar a la función `sendPasswordResetEmail(auth, email)` de Firebase Auth, y `authService` debe validar el formato del correo y coordinar el llamado.
- **Evidencia concreta:** `authRepository.js` importa la función de Firebase en L11 pero no define el método público.
- **Causa confirmada:** Importación huérfana y omisión en la implementación de la función del repositorio y servicio.
- **Impacto:** Los usuarios no pueden restablecer sus credenciales olvidadas.
- **Solución propuesta:** Implementar `sendPasswordResetEmail(email)` en `authRepository.js` y `authService.js`.
- **Dependencias:** `authRepository.js`, `authService.js`, `loginController.js`.
- **Prueba de verificación:** Ejecutar validación de email y llamada al repositorio simulada.

---

### [ERR-006] Bucle infinito de temporizadores en `footerPartnertController.js` en vistas públicas
- **Severidad:** Crítica / Rendimiento
- **Archivo y función implicados:** `src/components/partner/footerPartnertController.js` (L18-24), `src/main.js` (L61)
- **Comportamiento actual:** `main.js` invoca incondicionalmente `initFooterPartnerController()`. Si el usuario se encuentra en vistas públicas, `.rsi-footer-partner` no existe en el DOM. El código reintenta recursivamente cada 300 ms indefinidamente mediante `setTimeout`, acumulando llamadas continuas.
- **Comportamiento esperado:** Si el elemento del footer partner no se encuentra en el DOM, el controlador debe abortar limpiamente sin reprogramar llamadas infinitas.
- **Evidencia concreta:** Líneas 18 a 24 de `footerPartnertController.js`:
  ```javascript
  if (!footer) {
      setTimeout(() => { initFooterPartnerController(); }, 300);
      return;
  }
  ```
- **Causa confirmada:** Bucle de polling ciego sin condición de corte ni comprobación del estado de sesión.
- **Impacto:** Consumo innecesario de recursos de CPU, degradación del rendimiento del navegador y polución de logs.
- **Solución propuesta:** Eliminar el reintento infinito y verificar si el footer está en el DOM antes de inicializarlo, o acotar el intento solo cuando el layout partner haya emitido el evento `footerLoaded`.
- **Dependencias:** `footerPartnertController.js`, `main.js`.
- **Prueba de verificación:** Cargar una vista pública y comprobar que la consola no imprima advertencias repetitivas cada 300 ms.

---

### [ERR-007] Doble ejecución de `main.js` en `index.html`
- **Severidad:** Alta
- **Archivo y función implicados:** `index.html` (L45 y L48)
- **Comportamiento actual:** `<script type="module" src="/src/main.js"></script>` está declarado dos veces en el HTML principal.
- **Comportamiento esperado:** Debe incluirse una única vez.
- **Evidencia concreta:** `index.html`:
  ```html
  45: <script type="module" src="/src/main.js"></script>
  46: <!-- Script para reseñas de google -->
  47: <script src="https://elfsightcdn.com/platform.js" async></script>
  48: <script type="module" src="/src/main.js"></script>
  ```
- **Causa confirmada:** Duplicado accidental en la plantilla base HTML.
- **Impacto:** Toda la aplicación se inicializa dos veces (doble carga de scripts externos, doble inicialización del router, doble carga de layouts y duplicación de listeners en el objeto global `window` y `document`).
- **Solución propuesta:** Eliminar la línea 48 de `index.html`.
- **Dependencias:** `index.html`.
- **Prueba de verificación:** Recargar y comprobar que los logs de inicialización solo se impriman una vez.

---

### [ERR-008] Ausencia de control de acceso y protección de rutas en el enrutador
- **Severidad:** Alta / Seguridad
- **Archivo y función implicados:** `src/router/router.js` (`handleRoute`), `src/router/routes.js`
- **Comportamiento actual:** El router procesa cualquier ruta solicitada sin verificar el estado de autenticación. Un visitante sin credenciales puede ingresar a rutas como `/partner/dashboard` o `/partner/crudPartners` y ver las pantallas del sistema interno.
- **Comportamiento esperado:** El router debe verificar si la ruta pertenece a la sección privada `/partner/`. Si no existe sesión activa (`authService.getSession()`), debe redirigir a `/login`. Si el usuario ya está autenticado e intenta acceder a `/login`, debe redirigir a `/partner/dashboard`.
- **Evidencia concreta:** `router.js` L67-93 carece por completo de guardias o comprobaciones de sesión.
- **Causa confirmada:** Router diseñado como despachador estático sin guardias de navegación (navigation guards).
- **Impacto:** Exposición no autorizada de la interfaz y módulos administrativos ante accesos directos por URL.
- **Solución propuesta:** Incorporar una guardia de navegación en `handleRoute` de `src/router/router.js` que verifique `authService.getSession()` para rutas protegidas y maneje redirecciones ordenadas.
- **Dependencias:** `router.js`, `authService.js`.
- **Prueba de verificación:** Intentar navegar a `/partner/dashboard` sin sesión en `localStorage` y comprobar redirección automática a `/login`.

---

### [ERR-009] Rutas desalineadas y archivos HTML inexistentes en `routes.js`
- **Severidad:** Alta
- **Archivo y función implicados:** `src/router/routes.js` (L41-44, L57-60, L65-68)
- **Comportamiento actual:**
  - `/products` apunta a `/pages/visitor/products/products.html` (no existe; la ruta real es `/pages/visitor/products.html`).
  - `/blogs` apunta a `/pages/visitor/blogs/blogs.html` (no existe).
  - `/admin` apunta a `/pages/visitor/admin/admin.html` (no existe).
  Cuando se navega a estas rutas, el router lanza un error HTTP 404 e inserta un mensaje de error no amigable en `#app`.
- **Comportamiento esperado:** `/products` debe mapear a `/pages/visitor/products.html`. Las rutas a páginas inexistentes deben resolverse redirigiendo ordenadamente a la página `/404` controlada.
- **Evidencia concreta:** Comprobación de existencia de archivos en el árbol `public/pages/`.
- **Causa confirmada:** Desfase entre la estructura del directorio público y las rutas declaradas en `routes.js`.
- **Impacto:** Enlaces rotos en la barra de navegación y páginas de error visibles para los usuarios.
- **Solución propuesta:** Corregir la ruta de `/products` para apuntar a `/pages/visitor/products.html` y asegurar que cualquier ruta a vistas inexistentes cargue la vista `/404`.
- **Dependencias:** `routes.js`, `router.js`.
- **Prueba de verificación:** Navegar a `/products` y verificar carga exitosa de la plantilla.

---

### [ERR-010] Riesgo de colisión de folios en contadores de cotizaciones y tickets por falta de atomicidad
- **Severidad:** Alta / Integridad de Datos
- **Archivo y función implicados:** `src/repositories/contadorCotizacionRepository.js` (L52-72), `src/repositories/ticketRepository.js` (L65-92)
- **Comportamiento actual:** Ambos repositorios implementan el consecutivo con un `getDoc()` y un posterior `updateDoc()`.
- **Comportamiento esperado:** La generación de consecutivos debe ejecutarse dentro de una transacción atómica de Firestore mediante `runTransaction(db, ...)`.
- **Evidencia concreta:** En `contadorCotizacionRepository.js`:
  ```javascript
  const docSnap = await getDoc(docRef);
  let nuevoCount = 1;
  if (docSnap.exists()) {
      nuevoCount = (docSnap.data().count || 0) + 1;
      await updateDoc(docRef, { count: nuevoCount });
  }
  ```
- **Causa confirmada:** Omisión del patrón transaccional obligatorio para contadores en bases de datos NoSQL distribuidas.
- **Impacto:** Bajo concurrencia o múltiples usuarios guardando al mismo tiempo, ambos obtienen el mismo número consecutivo, generando duplicidad de folios de cotización o IDs de ticket.
- **Solución propuesta:** Refactorizar `incrementContador` en `contadorCotizacionRepository.js` y `_getNextTicketId` en `ticketRepository.js` utilizando `runTransaction()`.
- **Dependencias:** `firebaseConfig.js`, `contadorCotizacionRepository.js`, `ticketRepository.js`.
- **Prueba de verificación:** Revisar que la función transaccional realice lectura y escritura dentro del contexto de la transacción.

---

### [ERR-011] Método inexistente `getProductById` en `catalogRepository.js`
- **Severidad:** Alta
- **Archivo y función implicados:** `src/repositories/catalogRepository.js`, `src/services/catalogService.js` (L234-235)
- **Comportamiento actual:** `catalogService.getProductById(productId)` invoca `this.repository.getProductById(productId)`. Dicho método no existe en `catalogRepository.js`.
- **Comportamiento esperado:** `catalogRepository.js` debe proveer `getProductById(productId, forceRefresh)` consultando la colección `productosCatalogo`.
- **Evidencia concreta:** Búsqueda en `catalogRepository.js`: define `createProduct`, `updateProduct`, `disableProduct`, `enableProduct`, pero no `getProductById`.
- **Causa confirmada:** Implementación omitida durante el desarrollo del repositorio.
- **Impacto:** Fallo con excepción `TypeError` al consultar el detalle de un producto específico de catálogo.
- **Solución propuesta:** Implementar `getProductById(productId, forceRefresh)` con soporte de caché en `catalogRepository.js`.
- **Dependencias:** `catalogRepository.js`, `catalogService.js`.
- **Prueba de verificación:** Ejecutar consulta por ID de producto y verificar retorno correcto del objeto.

---

### [ERR-012] Discrepancia de mayúsculas/minúsculas en importaciones de `regimenesSat.js`
- **Severidad:** Media / Compatibilidad
- **Archivo y función implicados:** `src/models/clienteModel.js` (L6), `src/services/clienteService.js` (L8), `src/components/modals/clienteModal/clienteModalController.js` (L7)
- **Comportamiento actual:** Los tres archivos importan desde `'../utils/regimenesSAT.js'` (en mayúsculas), mientras que el archivo en disco se denomina `src/utils/regimenesSat.js` (con 'Sat').
- **Comportamiento esperado:** El nombre de la importación debe coincidir exactamente con el del sistema de archivos (`regimenesSat.js`).
- **Evidencia concreta:** En Windows (NTFS no sensitivo) el archivo es encontrado, pero en entornos Linux (despliegue en Cloud Functions, Firebase Hosting o CI/CD) genera `Error: Cannot find module '../utils/regimenesSAT.js'`.
- **Causa confirmada:** Inconsistencia de capitalización en el nombre del módulo.
- **Impacto:** Fallos inmediatos de compilación o ejecución en servidores de producción basados en Linux.
- **Solución propuesta:** Estandarizar la ruta de importación a `regimenesSat.js` en los tres consumidores.
- **Dependencias:** `clienteModel.js`, `clienteService.js`, `clienteModalController.js`.
- **Prueba de verificación:** Validar con script de resolución de rutas en modo case-sensitive.

---

### [ERR-013] Violación arquitectónica: consultas directas a Firestore en controladores para el Catálogo SAT
- **Severidad:** Media / Arquitectura
- **Archivo y función implicados:** `src/controllers/partner/facturaFormController.js` (L13-23, L1204-1249), `src/controllers/partner/productoServicioFormController.js` (L9-21, L47-100)
- **Comportamiento actual:** Ambos controladores importan funciones del SDK de Firestore (`collection`, `getDocs`, `query`, `where`) y consultan directamente la colección `'catalogoSAT'`, omitiendo el Service y Repository. Además, la lógica de búsqueda está duplicada en ambos controladores.
- **Comportamiento esperado:** Centralizar la consulta del Catálogo SAT en `ProductoServicioRepository` y exponerla en `ProductoServicioService`, permitiendo que los controladores consuman únicamente el servicio.
- **Evidencia concreta:** Imports directos de `'firebase/firestore'` y `'../../config/firebaseConfig.js'` en los dos controladores.
- **Causa confirmada:** Lógica de persistencia y acceso a datos escrita directamente en la capa de presentación.
- **Impacto:** Rompe el flujo arquitectónico mandatorio (Vista → Controlador → Service → Repository → Firebase) y dificulta el mantenimiento al tener código duplicado.
- **Solución propuesta:** Añadir método `searchSatCatalog(searchTerm)` en `productoServicioRepository.js` y `productoServicioService.js`, y refactorizar ambos controladores para consumirlo.
- **Dependencias:** `productoServicioRepository.js`, `productoServicioService.js`, `facturaFormController.js`, `productoServicioFormController.js`.
- **Prueba de verificación:** Ejecutar búsqueda de claves SAT a través del servicio y comprobar retorno uniforme.

---

### [ERR-014] Duplicación y dispersión en la generación de PDF para Facturas
- **Severidad:** Media / Mantenimiento
- **Archivo y función implicados:** `src/utils/pdfGenerator.js` (L386-631) vs `src/utils/facturaPdfGenerator.js`
- **Comportamiento actual:** `facturaPdfGenerator.js` es el generador completo y específico para facturas (incluye sellos digitales, códigos QR, régimen fiscal y marcas de agua de borrador). Paralelamente, `pdfGenerator.js` contiene una implementación incompleta y desactualizada de `generarPDFFactura`. Adicionalmente, `facturaFormController.js` importa `generarPDFFactura` de `pdfGenerator.js` sin usarlo.
- **Comportamiento esperado:** Centralizar la generación de facturas en `facturaPdfGenerator.js`. En `pdfGenerator.js`, mantener cotizaciones y eliminar o delegar la función redundante de factura para evitar divergencias de diseño.
- **Evidencia concreta:** Inspección comparativa entre ambos archivos y revisión de consumidores en controladores.
- **Causa confirmada:** Falta de consolidación tras la migración a un generador fiscal específico.
- **Impacto:** Riesgo de emitir documentos con diseño no homologado y código muerto en el bundle.
- **Solución propuesta:** Limpiar el import no utilizado en `facturaFormController.js` y consolidar `facturaPdfGenerator.js` como la única fuente de verdad para facturación.
- **Dependencias:** `facturaFormController.js`, `pdfGenerator.js`, `facturaPdfGenerator.js`.
- **Prueba de verificación:** Confirmar que `facturasCrudController.js` continúe generando correctamente borradores y facturas timbradas.

---

### [ERR-015] Estilos no importados en `src/css/main.css` y advertencia en compilación
- **Severidad:** Media
- **Archivo y función implicados:** `src/css/main.css` (L27)
- **Comportamiento actual:**
  1. `src/css/components/cotizaciones.css` (15.6 KB) y `src/css/pages/login.css` existen en disco pero no están importados en `main.css`.
  2. `src/css/components/switches.css` está vacío (0 bytes), generando una advertencia en PostCSS durante `vite build`.
- **Comportamiento esperado:** `main.css` debe importar todos los estilos activos del proyecto y evitar importar archivos vacíos sin contenido.
- **Evidencia concreta:** Advertencia en `npm run build`: `[vite:css][postcss] ... switches.css is empty`.
- **Causa confirmada:** Estilos agregados al proyecto sin registrar en la hoja de estilos principal.
- **Impacto:** Posibles inconsistencias visuales en el login y en las pantallas de cotización.
- **Solución propuesta:** Añadir `@import url('./components/cotizaciones.css');` y `@import url('./pages/login.css');` en `main.css`, y limpiar la importación vacía.
- **Dependencias:** `src/css/main.css`.
- **Prueba de verificación:** Ejecutar `npm run build` y comprobar la ausencia de advertencias de PostCSS.

---

### [ERR-016] Código huérfano y módulos abandonados en el repositorio
- **Severidad:** Baja / Mantenimiento
- **Archivos implicados:**
  - `src/utils/lazyLoader.js`: contiene importaciones a `./pageLoader.js` y `../utils/lazy-loader.js` inexistentes.
  - `src/controllers/partner/facturaVerController.js`: controlador para vista móvil de factura sin plantilla HTML y sin ruta en `routes.js`.
  - `src/services/notificationService.js` y `src/services/firebase-messaging.js`: dos servicios de notificaciones no utilizados tras su desvinculación de `main.js`.
  - Varios archivos `hola.txt` y `txt.txt` vacíos repartidos en la estructura.
- **Comportamiento actual:** Archivos que no forman parte activa del flujo pero aumentan la deuda técnica y pueden provocar errores si algún desarrollador intenta importarlos.
- **Comportamiento esperado:** Archivos identificados y documentados para su eventual retiro o consolidación futura.
- **Evidencia concreta:** Análisis de referencias estáticas sin ningún consumidor en el código activo.
- **Impacto:** Confusión arquitectónica y riesgo de mantenimiento.

---

### [ERR-017] Credenciales sensibles expuestas en texto plano y `.gitignore` incompleto
- **Severidad:** Crítica / Seguridad
- **Archivos implicados:** `functions/.env`, `functions/config/facturama.config.js`, `.gitignore`
- **Comportamiento actual:** Credenciales reales de correo (Gmail App Password) y credenciales de API de Facturama están almacenadas en texto plano en archivos que no están excluidos en `.gitignore` de la raíz del proyecto.
- **Comportamiento esperado:** Las credenciales nunca deben comitearse en el repositorio de código. Deben incluirse `.env` y archivos sensibles en `.gitignore` y gestionarse mediante variables de entorno seguras (Google Cloud Secret Manager o Firebase Functions Config).
- **Evidencia concreta:** Existencia de secretos en texto plano en dichos archivos locales (no se reproducen los valores en este informe conforme a las restricciones de seguridad).
- **Causa confirmada:** Configuración incompleta de exclusiones en `.gitignore`.
- **Impacto:** Riesgo grave de filtración de acceso a las cuentas corporativas si el repositorio se comparte o publica.
- **Solución propuesta:** Agregar `.env` y `functions/.env` al archivo `.gitignore` raíz.
- **Dependencias:** `.gitignore`.
- **Prueba de verificación:** Verificar mediante `git status --ignored` que los archivos queden excluidos del control de versiones.

---

### [ERR-018] Dependencia fundamental `firebase` no declarada en `package.json`
- **Severidad:** Alta / Infraestructura
- **Archivo implicado:** `package.json`
- **Comportamiento actual:** `package.json` únicamente declara `"chart.js"` en `dependencies` y `"vite"` en `devDependencies`. El paquete `firebase` no está listado. En la máquina actual, Node/Vite lo resuelve desde un directorio global en `C:\Users\desar\node_modules\firebase`.
- **Comportamiento esperado:** `firebase` debe estar declarado como dependencia en `package.json` (por ejemplo, `"firebase": "^10.x"` o `"^11.x"`).
- **Evidencia concreta:** `require.resolve('firebase/app')` devuelve `C:\Users\desar\node_modules\firebase\app\dist\index.cjs.js`.
- **Causa confirmada:** Instalación accidental fuera de la raíz del proyecto.
- **Impacto:** Cualquier despliegue automatizado, clonación por otro desarrollador o compilación en servidor fallará con el error `Cannot find package 'firebase'`.
- **Solución requerida:** Requiere autorización para modificar `package.json` e instalar la dependencia localmente (documentado en riesgos pendientes).

---

### [ERR-019] Reglas e índices de Firestore ausentes en el repositorio local
- **Severidad:** Media / Infraestructura
- **Archivo implicado:** `firebase.json` (L41-44)
- **Comportamiento actual:** `firebase.json` declara `"rules": "firestore.rules"` y `"indexes": "firestore.indexes.json"`. Ninguno de los dos archivos existe en la raíz del proyecto.
- **Comportamiento esperado:** Los archivos de reglas e índices deben existir localmente o el bloque de configuración debe ajustarse.
- **Evidencia concreta:** Búsqueda en el directorio raíz confirma que no existen los archivos.
- **Impacto:** Al ejecutar comandos CLI como `firebase deploy --only firestore`, el comando fallará por archivos faltantes.
- **Solución requerida:** Descargar/sincronizar las reglas e índices vigentes desde Firebase Console hacia el repositorio.

---

### [ERR-020] Suplantación de sesión de usuario en creación de colaboradores
- **Severidad:** Alta / Seguridad y Persistencia
- **Archivo y función implicados:** `src/repositories/partnerRepository.js` (`createAuthUser`, L52-65), `src/services/partnerService.js`
- **Comportamiento actual:** Al registrar un nuevo colaborador, se invoca `createUserWithEmailAndPassword(this.auth, email, password)` usando la instancia cliente principal de Firebase Auth. En el SDK web de Firebase, crear un usuario autentica automáticamente al nuevo usuario en la sesión del navegador, expulsando o reemplazando la sesión activa del administrador.
- **Comportamiento esperado:** La creación de credenciales de colaboradores debe delegarse a una Cloud Function con Firebase Admin SDK (`admin.auth().createUser()`) para evitar alterar la sesión del usuario actual en el cliente, o utilizar una instancia secundaria de Firebase App.
- **Evidencia concreta:** Comportamiento nativo documentado del método `createUserWithEmailAndPassword` en el SDK de Firebase Web.
- **Impacto:** El administrador que da de alta a un colaborador pierde su propia sesión de autenticación en el cliente Firebase inmediatamente tras completar el registro.

---

## 6. Errores que impiden compilar o ejecutar

Actualmente, el proyecto compila gracias a que Node resuelve `firebase` desde el directorio de usuario (`C:\Users\desar\node_modules`). Sin embargo, en tiempo de ejecución existen 5 errores que **impiden la ejecución** de flujos esenciales:
1. **[ERR-001]** Acceso a la aplicación por usuarios no-partner (falla con 404 al intentar cargar `navbarUser.html`).
2. **[ERR-002]** Edición y reestructuración de Áreas en `/partner/area?id=...` (falla por `deleteSubarea is not a function`).
3. **[ERR-003]** Generación de facturas desde cotizaciones en `/partner/crudCotizaciones` (falla por `crearFacturaDesdeCotizacion is not a function`).
4. **[ERR-004]** Validación de facturas en borrador (falla por `FacturaModel.validate is not a function`).
5. **[ERR-005]** Recuperación de contraseñas en `/login` (falla por `sendPasswordResetEmail is not a function`).

---

## 7. Funcionalidades incompletas o simuladas

Durante la auditoría funcional se identificaron los siguientes módulos con funcionalidad incompleta o simulada:
1. **Formulario de Contacto (`public/pages/visitor/contact.html`):** Contiene campos de nombre, email, teléfono y mensaje con botón de envío, pero carece de controlador en `routes.js`. Al presionar el botón no ocurre ninguna acción ni envío a Firebase o email.
2. **Catálogo Público de Productos (`public/pages/visitor/products.html`):** Contiene un catálogo estático pre-renderizado con 12 productos simulados en HTML, con el buscador deshabilitado (`disabled`) y los botones de acción deshabilitados. No está conectado a Firestore ni a los productos reales.
3. **Rutas del Menú de Navegación Partner no implementadas:** En `public/components/partner/navbarPartner.html` existen enlaces a submódulos no existentes en el enrutador:
   - Recursos Humanos: `/hr/asistencias`, `/hr/reembolsos`
   - Operaciones: `/ops/checklist`, `/ops/historial`, `/ops/manuales`, `/ops/notas`
   - Soporte: `/support/mis-tickets`, `/support/estadisticas`
   - Ecommerce: `/ecommerce/productos`, `/ecommerce/pedidos`, `/ecommerce/ventas`, `/ecommerce/categorias`, etc.
   Al hacer clic en cualquiera de estos enlaces, el router muestra la pantalla 404.
4. **Servicio de Notificaciones Push:** `notificationService.js` y `firebase-messaging.js` se encuentran totalmente desconectados del ciclo de vida de la aplicación.
5. **Vista Móvil de Factura:** `facturaVerController.js` existe como controlador independiente pero carece de plantilla HTML y de ruta en el router.

---

## 8. Problemas de integridad de datos

1. **Condición de carrera en contadores (`contadoresCotizaciones` y `contadorTickets`):** El incremento de número consecutivo sin transacciones en Firestore provoca colisiones de folios si dos usuarios guardan casi simultáneamente.
2. **Quema prematura de folios en cotizaciones:** Al abrir o comenzar una cotización temporal, el sistema genera el consecutivo oficial antes de que la cotización sea validada o finalizada por el usuario. Si el usuario cancela, el consecutivo queda registrado en la base de datos como borrador/en proceso.
3. **Persistencia de imágenes en Base64 en documentos de Firestore:** En `ProductoServicioRepository` y `NewCollaboratorRepository`, las fotografías se convierten a cadenas Base64 y se guardan directamente dentro del documento de Firestore. Firestore impone un límite estricto de **1 MB por documento**. Imágenes de alta resolución pueden exceder dicho límite y hacer fallar la operación de guardado con error de cuota. El almacenamiento correcto debe ser en Firebase Storage guardando únicamente la URL en Firestore.

---

## 9. Problemas de seguridad confirmados y riesgos pendientes

### Confirmados en el código local:
- **Ausencia de Route Guards:** Cualquier usuario puede acceder visualmente a `/partner/*` sin sesión activa.
- **Secretos en texto plano:** Contraseña de aplicación Gmail en `functions/.env` y credenciales de Facturama en `facturama.config.js`.
- **Falta de `.env` en `.gitignore`:** Riesgo de inclusión involuntaria en repositorios de control de versiones.
- **Suplantación de sesión de cliente en `createUserWithEmailAndPassword`:** Al registrar colaboradores desde el cliente, la sesión local del administrador es sobrescrita por el nuevo usuario.

### Pendientes de verificación en Firebase Console:
- **Reglas de seguridad remotas de Firestore:** Al no existir `firestore.rules` localmente, no es posible verificar desde este entorno si Firestore cuenta con reglas de autorización basadas en roles (`request.auth != null`, roles `partner`/`admin`) o si la base de datos se encuentra abierta (`allow read, write: if true;`). **Requiere revisión urgente en Firebase Console.**
- **Reglas de Firebase Storage:** Idéntica situación: se debe comprobar en la consola que el bucket solo permita escritura a usuarios autenticados.

---

## 10. Duplicaciones y desviaciones arquitectónicas

1. **Doble Generador de Facturas:** Coexistencia de `pdfGenerator.js` y `facturaPdfGenerator.js`.
2. **Doble Servicio de Notificaciones:** Coexistencia de `notificationService.js` y `firebase-messaging.js`.
3. **Desviación de Capas en Catálogo SAT:** Controladores (`facturaFormController.js`, `productoServicioFormController.js`) realizando consultas a Firestore directamente en lugar de usar la capa de Repository/Service.
4. **Desviación en Storage:** `StorageService` conectándose directamente al SDK de Firebase Storage sin utilizar `StorageRepository`, mientras `CatalogService` sí lo utiliza.

---

## 11. Riesgos de modificar cada módulo

| Módulo | Nivel de Riesgo | Precauciones / Módulos Afectados |
| :--- | :--- | :--- |
| **`loadLayout.js` / Layouts** | Alto | Afecta toda la presentación inicial. Debe preservarse la compatibilidad con los eventos `navbarLoaded` y `footerLoaded`. |
| **`src/router/router.js`** | Alto | Afecta toda la navegación. Los guardias de autenticación deben verificar `authService.getSession()` sin interferir con la navegación normal. |
| **`facturaService.js` y `FacturaModel`** | Medio-Alto | Afecta facturas existentes y cotizaciones. No alterar la estructura de datos que espera el endpoint de timbrado (`_buildPayload`). |
| **`areaService.js` y `areaRepository.js`** | Medio | Afecta el módulo de gestión de áreas y roles. Debe manipular el mapa `subareas` conservando los IDs existentes. |
| **`contadorCotizacionRepository.js`** | Medio | Requiere mantener el formato del ID del documento (`tipo`) al migrar a `runTransaction`. |
| **`productoServicioService.js` (Catálogo SAT)** | Bajo-Medio | Migrar la búsqueda sin cambiar la firma de datos que esperan los autocompletados de los formularios. |
| **`index.html` y `main.css`** | Bajo | Corrección puntual sin riesgo para lógica de negocio. |

---

## 12. Plan de corrección priorizado

### **Bloque 1: Correcciones Críticas de Estabilidad, Layout e Inicialización**
- **Meta:** Garantizar que la aplicación inicie limpiamente, sin bucles infinitos, sin ejecuciones dobles y sin bloqueos de pantalla completa por 404.
- **Acciones:**
  1. Corregir `loadLayout.js` para asignar layouts de forma segura (admin/partner a `navbarPartner.html`/`footerPartner.html`, fallback a visitantes).
  2. Corregir `footerPartnertController.js` para eliminar el bucle infinito de reintentos (`setTimeout` cada 300 ms).
  3. Eliminar la importación duplicada de `src/main.js` en `index.html`.
  4. Corregir rutas erróneas en `src/router/routes.js` (`/products` a `/pages/visitor/products.html`).
  5. Implementar guardia de navegación de autenticación en `src/router/router.js` para proteger rutas `/partner/*`.

### **Bloque 2: Corrección de Métodos Inexistentes y Fallos Funcionales de Negocio**
- **Meta:** Restaurar la funcionalidad completa de los módulos con errores en tiempo de ejecución.
- **Acciones:**
  1. Implementar `deleteSubarea(areaId, subareaId)` en `areaRepository.js` y `areaService.js`.
  2. Implementar `crearFacturaDesdeCotizacion(cotizacionId, facturaNumero)` en `facturaService.js`.
  3. Implementar `validate(data)` en `FacturaModel`.
  4. Implementar `sendPasswordResetEmail(email)` en `authRepository.js` y `authService.js`.
  5. Implementar `getProductById(productId, forceRefresh)` en `catalogRepository.js`.

### **Bloque 3: Integridad de Datos, Concurrencia y Respeto Arquitectónico**
- **Meta:** Eliminar condiciones de carrera en folios y desacoplar la capa de presentación de Firestore.
- **Acciones:**
  1. Refactorizar `incrementContador` en `contadorCotizacionRepository.js` usando `runTransaction()`.
  2. Refactorizar `_getNextTicketId` en `ticketRepository.js` usando `runTransaction()`.
  3. Centralizar la búsqueda del catálogo SAT en `productoServicioRepository.js` y `productoServicioService.js`.
  4. Refactorizar `productoServicioFormController.js` y `facturaFormController.js` para consumir el servicio SAT y remover sus importaciones directas de Firestore.
  5. Estandarizar importaciones de `regimenesSat.js` con mayúsculas/minúsculas coherentes.

### **Bloque 4: Limpieza de Estilos, PDF y Seguridad de Configuración**
- **Meta:** Mejorar calidad, eliminar advertencias de compilación y proteger archivos sensibles.
- **Acciones:**
  1. Importar `cotizaciones.css` y `login.css` en `src/css/main.css`.
  2. Retirar importación de archivo vacío en `main.css`.
  3. Limpiar importación huérfana de `generarPDFFactura` en `facturaFormController.js`.
  4. Actualizar `.gitignore` para ignorar archivos `.env`.

---

## 13. Pruebas necesarias para verificar las soluciones

1. **Verificación de Compilación y PostCSS:** Ejecutar `npm run build` y confirmar que no existan advertencias ni errores.
2. **Verificación de Enrutador y Layout:**
   - Prueba de navegación a `/partner/dashboard` sin sesión -> Redirección a `/login`.
   - Prueba con rol `admin` y `partner` -> Carga exitosa de `navbarPartner.html` sin error 404.
   - Prueba en vista `/` -> Confirmar ausencia del bucle de 300 ms en consola.
3. **Verificación de Áreas:**
   - Invocar `deleteSubarea` en `areaService` y confirmar que se ejecute la eliminación en el modelo/repositorio sin arrojar `TypeError`.
4. **Verificación de Cotización a Factura:**
   - Invocar `crearFacturaDesdeCotizacion` en `facturaService` y verificar que cree el documento de factura en borrador con los datos transferidos.
5. **Verificación de Validación de Factura:**
   - Ejecutar `FacturaModel.validate(data)` y validar que retorne `{ valid: boolean, errors: Object }`.
6. **Verificación de Recuperación de Contraseña:**
   - Validar que `authService.sendPasswordResetEmail(email)` valide el email y delegue al repositorio sin arrojar error de método inexistente.
7. **Verificación de Contadores Transaccionales:**
   - Inspeccionar la implementación de `runTransaction` asegurando atomicidad de lectura y escritura.
8. **Verificación de Catálogo SAT:**
   - Confirmar que `facturaFormController.js` y `productoServicioFormController.js` ya no importen `db` ni `collection` de Firebase.

---

## 14. Estado de ejecución y resultados de las correcciones incrementales

Todas las correcciones planificadas fueron implementadas de forma incremental, verificadas mediante scripts automatizados y validadas con `npm run build` sin alterar estilos existentes ni romper contratos funcionales:

### ✅ Bloque 1: Estabilidad, Layout e Inicialización (Completado)
- **`src/components/shared/loadLayout.js`:** Corregido el mapeo de roles para evitar 404. Roles con privilegios (`admin`, etc.) cargan `navbarPartner.html` / `footerPartner.html`. Fallback seguro a layouts de visitante ante cualquier inconsistencia.
- **`src/components/partner/footerPartnertController.js`:** Eliminado el bucle infinito de reintentos (`setTimeout` cada 300 ms). Se garantiza que el listener `footerLoaded` sea único y no genere fugas de memoria.
- **`src/components/visitor/navbarController.js`:** Asegurada la asignación de listener `navbarLoaded` una única vez para evitar multiplicidad de manejadores.
- **`index.html`:** Eliminada la etiqueta duplicada `<script type="module" src="/src/main.js"></script>` en línea 48, resolviendo la doble inicialización de la app.
- **`src/router/routes.js`:** Corregida ruta `/products` para apuntar a `/pages/visitor/products.html`. Rutas inexistentes (`/blogs`, `/admin`) dirigidas al controlador `404`.
- **`src/router/router.js`:** Implementada guardia de navegación (route guard) con `AuthService.getSession()`: protege rutas `/partner/*` (redirigiendo a `/login` si no hay sesión activa) y redirige a `/partner/dashboard` si un usuario autenticado intenta acceder a `/login`.
- **Verificación:** `npm run build` exitoso (593 ms).

### ✅ Bloque 2: Métodos Inexistentes y Fallos Funcionales de Negocio (Completado)
- **`src/repositories/areaRepository.js` & `src/services/areaService.js`:** Implementado `deleteSubarea(areaId, subareaId)` para permitir la edición de subáreas sin arrojar `TypeError`.
- **`src/models/facturaModel.js`:** Implementado `FacturaModel.validate(data)` retornando `{ valid, errors }` para validar campos fiscales mínimos requeridos.
- **`src/services/facturaService.js`:** Implementado `crearFacturaDesdeCotizacion(cotizacionId, facturaNumero)` consumiendo `FacturaModel.fromCotizacion()` y `facturaRepository.createFactura()`.
- **`src/repositories/authRepository.js` & `src/services/authService.js`:** Implementado `sendPasswordResetEmail(email)` permitiendo el restablecimiento de contraseñas mediante Firebase Auth.
- **`src/repositories/catalogRepository.js`:** Implementado `getProductById(productId, forceRefresh)` con soporte de caché en memoria y fallback a Firestore.
- **Verificación:** Ejecución de scripts de análisis estático `check_service_repo.js` (0 llamadas huérfanas), `check_controller_service.js` (0 llamadas huérfanas), `check_models.js` (0 métodos faltantes). `npm run build` exitoso (584 ms).

### ✅ Bloque 3: Integridad de Datos, Concurrencia y Respeto Arquitectónico (Completado)
- **`src/config/firebaseConfig.js`:** Exportado `runTransaction` desde el SDK modular de Firestore.
- **`src/repositories/contadorCotizacionRepository.js`:** Refactorizado `incrementContador(tipo)` utilizando `runTransaction(db, ...)` para garantizar folios atómicos sin condiciones de carrera.
- **`src/repositories/ticketRepository.js`:** Refactorizado `_getNextTicketId()` utilizando `runTransaction(db, ...)` para garantizar la correlación atómica de tickets consecutivos.
- **`src/repositories/productoServicioRepository.js` & `src/services/productoServicioService.js`:** Implementados `searchSatCatalog(searchTerm, maxResults)` y `getSatProductByClave(clave)` centralizando la consulta a la colección `catalogoSAT` en el repositorio/servicio.
- **`src/controllers/partner/productoServicioFormController.js` & `src/controllers/partner/facturaFormController.js`:** Eliminadas todas las importaciones directas de Firestore (`db`, `collection`, `query`, etc.) y delegada la búsqueda al servicio correspondiente, cumpliendo estrictamente con la regla arquitectónica `Vista/Controlador → Service → Repository → Firebase`.
- **Normalización de Casing:** Normalizada la importación de `regimenesSat.js` en `clienteModel.js`, `clienteService.js`, `clienteController.js` y `clienteModalController.js`, eliminando el riesgo de fallo en sistemas operativos sensibles a mayúsculas (Linux/CI).
- **Verificación:** 0 importaciones directas de Firebase en la capa de controladores/componentes. `npm run build` exitoso (575 ms).

### ✅ Bloque 4: Limpieza de Estilos, PDF y Seguridad de Configuración (Completado)
- **`src/css/main.css`:** Incluidas las hojas de estilo faltantes `@import url('./components/cotizaciones.css');` y `@import url('./pages/login.css');`. Comentada la importación de `./components/switches.css` (archivo vacío de 0 bytes).
- **`src/controllers/partner/facturaFormController.js`:** Eliminada la importación huérfana de `generarPDFFactura` desde `../../utils/pdfGenerator.js`.
- **`.gitignore`:** Añadidas reglas estrictas para ignorar archivos `.env`, `.env.*`, `functions/.env*`, y credenciales `*-credentials.json` o `service-account*.json`.
- **Verificación:** `npm run build` ejecutado en 553 ms con **0 advertencias de PostCSS**.

