# Arquitectura de Navegación, Flujo de Asistencia, Dashboard Partner y Sistema Visual
## Proyecto: SPA-V1.0.0 — Fénix RSI Enterprise

Este documento técnico describe el funcionamiento arquitectónico de los menús de navegación por rol, el flujo obligatorio de asistencia para colaboradores (`partner`), la integración en tiempo real del Dashboard de Partner y las reglas del sistema visual (espaciado CRUD, contraste y modo oscuro).

---

## A. Navegación, Layouts y Menús Desplegables

### 1. Estructura de Layouts y Navbars por Rol
El sistema carga dinámicamente el encabezado y pie de página a través de `src/utils/loadLayout.js` según la sesión activa en `localStorage` (`rsi_session`) y la ruta actual:
- **Visitante (`visitor` / sin sesión):** Renderiza `public/components/visitor/navbarVisitor.html` y `footerVisitor.html`.
- **Colaborador / Administrador (`partner` / `admin`):** Renderiza `public/components/partner/navbarPartner.html` y `footerPartner.html`.

Ambos navbars son inicializados y gestionados por el controlador unificado `src/components/visitor/navbarController.js`, el cual escucha el evento `navbarLoaded` emitido por `loadLayout.js`.

### 2. Separación de Estado Visual de Ruta Activa vs. Estado de Apertura de Dropdown
Anteriormente, la clase `.active` en `.nan_dropdown-item` cumplía dos propósitos conflictivos: resaltar el grupo de navegación cuya ruta estaba activa e indicar en CSS (`@media (min-width: 993px)`) que el menú desplegable debía permanecer abierto (`opacity: 1; visibility: visible`). Esto provocaba que al navegar a cualquier sub-opción de un menú desplegable en computadora, la lista quedara permanentemente desplegada cubriendo el contenido de la vista.

La arquitectura actual separa estrictamente ambos estados:
- **Estado de ruta activa (`has-active-child` / `.active` en `.nan_dropdown-trigger` y `.nan_dropdown-link`):**
  - El método `setActiveLink()` evalúa `window.location.pathname`.
  - Si un enlace hijo dentro de `.nan_dropdown-menu` coincide con la ruta actual, el enlace hijo recibe `.active`, el botón disparador `.nan_dropdown-trigger` recibe `.active` y el contenedor `.nan_dropdown-item` recibe `.has-active-child` únicamente para estilizado de color e indicador inferior, **sin abrir el menú desplegable**.
- **Estado de apertura del menú desplegable (`dropdown-open` y `:hover` controlado):**
  - En escritorio (`min-width: 993px`), el menú se muestra por `:hover` sobre `.nan_dropdown-item:not(.dropdown-closing)` o cuando se activa explícitamente `.dropdown-open`.
  - Mientras un menú desplegable (`.nan_dropdown-menu` o `.nan-user-dropdown`) está oculto (`opacity: 0; visibility: hidden`), mantiene `pointer-events: none` para no interceptar clics sobre el contenido de la vista. Solo adquiere `pointer-events: auto` cuando está visible.
- **Cierre inmediato tras seleccionar una opción (`closeAllDropdowns(suppressHover)`):**
  - Cuando el usuario selecciona cualquier opción dentro de `.nan_dropdown-menu` o `.nan-user-dropdown`, se invoca `closeAllDropdowns(true)` y `closeMenu()`.
  - En escritorio (`suppressHover = true`), se añade temporalmente la clase `.dropdown-closing` al `.nan_dropdown-item`, la cual fuerza `opacity: 0; visibility: hidden; pointer-events: none` incluso si el puntero sigue físicamente encima del elemento durante la transición SPA.
  - La clase `.dropdown-closing` se limpia automáticamente en el evento `mouseleave` / `pointerleave` del elemento o al interactuar nuevamente con el trigger.

### 3. Eventos de Cierre y Ciclo de Vida de Listeners
El controlador `navbarController.js` registra listeners administrados en el arreglo `this.boundCleanups` y ejecuta `this.cleanup()` antes de cada reinicialización para evitar fugas de memoria o listeners duplicados:
- **Clic en opción de menú:** Cierra inmediatamente todos los dropdowns y el menú móvil antes de que el router procese el cambio de vista.
- **Clic o toque fuera del menú (`pointerdown` / `click` en `document`):** Cierra cualquier dropdown abierto si el objetivo del evento no pertenece a `.nan_dropdown-item` ni a `.nan-user-menu`.
- **Tecla `Escape` (`keydown` en `document`):** Cierra todos los dropdowns abiertos y el drawer móvil.
- **Eventos del Router e Historial (`route:changing`, `route:changed`, `popstate`):** Cierran cualquier menú abierto y sincronizan el enlace activo (`setActiveLink()`).
- **Cambio de Layout o Cierre de Sesión (`loadLayout.js`):** Limpia el estado del menú antes de reemplazar el HTML del contenedor `#navbar`.

---

## B. Flujo de Asistencia del Partner y Redirección Post-Login

### 1. Regla de Negocio por Rol
- **Rol `partner` (Colaborador):** Al iniciar sesión o acceder a la aplicación con sesión activa en `/`, `/login` o `/partner/dashboard`, el sistema verifica si ya registró su asistencia de entrada del día actual en la zona horaria `America/Mexico_City`.
  - Si **no ha registrado entrada** (`!haRegistradoEntrada`), es redirigido automáticamente a `/partner/asistencia`.
  - Si **ya registró entrada** (`haRegistradoEntrada === true`), accede directamente a `/partner/dashboard` y puede navegar libremente sin bucles de redirección.
- **Rol `admin` (Administrador):** No está sujeto a redirección forzosa de asistencia al iniciar sesión; accede directamente a `/partner/dashboard`.
- **Rol `visitor` (Visitante):** Navega libremente por las rutas públicas (`/`, `/servicios`, `/nosotros`, `/contacto`, `/productos`, `/catalogo`, `/login`).

### 2. Implementación Técnica (`AuthService`, `Router`, `LoginController`, `AsistenciaController`)
1. **`authService.resolvePartnerLandingRoute()` (`src/services/authService.js`):**
   - Espera la inicialización de Firebase Auth (`waitForAuthInit()`).
   - Verifica la sesión activa y refresca los datos del colaborador si es necesario.
   - Si el rol es `admin`, retorna `/partner/dashboard`.
   - Si el rol es `partner`, instancia `AsistenciaService` y consulta `getEstadoHoy()`, que calcula la fecha actual en `America/Mexico_City` (`YYYY-MM-DD`) y busca el documento `${uid}_${fecha}` en la colección `asistencias` de Firestore.
   - Si `!estadoResult.data.haRegistradoEntrada`, retorna `/partner/asistencia`; en caso contrario, retorna `/partner/dashboard`.
2. **Guardia en el Router (`src/router/router.js`):**
   - En `handleRoute()`, antes de cargar cualquier plantilla HTML, se evalúan las guardias de navegación:
     - Rutas protegidas (`/partner/*` y `/hr/*`) sin sesión redirigen a `/login`.
     - Si el usuario tiene sesión activa e intenta entrar a `/login` o `/`, o si tiene rol `partner` e intenta entrar a `/partner/dashboard`, se invoca `await authService.resolvePartnerLandingRoute()`.
     - Si la ruta resuelta difiere de la ruta solicitada, se actualiza la URL con `window.history.replaceState` y se carga directamente la vista destino, evitando destellos (*flash*) de la página pública de inicio.
3. **Transición tras Registrar Entrada (`src/controllers/partner/asistenciaController.js`):**
   - Al registrar la entrada exitosamente en `/partner/asistencia`, el controlador emite el evento global `window.dispatchEvent(new CustomEvent('asistencia:updated', ...))` y presenta en el modal de confirmación el botón **"Ir al Dashboard"**, permitiendo al colaborador desplazarse de inmediato a `/partner/dashboard`.

---

## C. Dashboard de Partner

### 1. Arquitectura y Fuentes de Datos Reales
El módulo del Dashboard (`public/pages/partner/dashboard.html` y `src/controllers/partner/dashboardController.js`) opera sin datos simulados (*mock data*) y respeta el flujo **Vista → Controlador → Servicio → Repositorio → Firebase**:
- **Perfil del Colaborador (`NewCollaboratorService` en `src/services/partnerService.js` + `authService`):**
  - Muestra nombre completo, puesto/cargo, área/departamento, correo electrónico, teléfono, estado activo, badge de rol (`Administrador` o `Partner`) y fotografía almacenada en Firebase Storage (o iniciales generadas dinámicamente).
- **Asistencia del Día e Historial (`AsistenciaService` en `src/services/asistenciaService.js`):**
  - Consulta `getEstadoHoy()` y `getMiHistorial(60)` en paralelo.
  - Muestra la fecha actual formateada, el estado de asistencia del día (`Sin registrar`, `En turno — Puntual`, `En turno — Retardo`, `Jornada completada`, `Falta Justificada`), la hora real de entrada (`#attendanceEntryTime`), la hora real de salida (`#attendanceExitTime`) y el porcentaje real de puntualidad de los últimos 30 días (`#punctualityRate`).
  - El botón de acción rápida (`#registerAttendanceBtn`) permite registrar la **Entrada** (si aún no se ha registrado hoy), registrar la **Salida** (si ya registró entrada pero no salida) o muestra el estado deshabilitado **Jornada Registrada** cuando ambos registros están completos.
- **Tickets Asignados e Indicadores (`TicketService` en `src/services/ticketService.js`):**
  - Consulta los tickets asignados al colaborador autenticado mediante `getTicketsByColaborador(uid)` (y si es administrador sin tickets propios asignados, carga el panorama general con `getAllTickets()`).
  - Calcula y renderiza en tiempo real:
    - **Tickets Resueltos (`#completedProjects`):** Tickets en estado `finalizado`.
    - **Tickets Activos (`#activeProjects`):** Tickets en estado `pendiente` o `en_proceso`.
    - **Días Registrados (Mes) (`#workedHours`):** Total de días con asistencia efectiva en el mes en curso.
    - **Tickets por Estado:** Contadores y listado filtrable por pestañas (`Todos`, `Pendientes`, `En Proceso`, `Resueltos`).
  - Cada tarjeta de ticket muestra código oficial (`RSI-TK-...`), título, cliente, dirección, prioridad (con iconos FontAwesome, sin emojis), tipo (`operativo` / `administracion`), fecha relativa y botón **"Ver detalle"** que navega a `/partner/ticketView?id={ticket.id}`.
- **Gráficas Dinámicas (`Chart.js`):**
  - **Gráfica 1 (`#projectsChart`):** Dona de distribución real de tickets por estado (`Pendientes`, `En Proceso`, `Resueltos`, `Cancelados`).
  - **Gráfica 2 (`#performanceChart`):** Barras de actividad semanal (tickets atendidos/activos vs. asistencias registradas en las últimas 4 semanas).
  - **Gráfica 3 (`#skillsChart`):** Barras horizontales de distribución real de asistencias de los últimos 30 días (`Puntuales`, `Retardos`, `Justificadas`, `Inasistencias`).
  - Todas las gráficas reaccionan automáticamente al cambio entre modo claro y modo oscuro (`MutationObserver` sobre `body.classList`).

---

## D. Sistema Visual, Espaciado CRUD y Contraste en Modo Oscuro

### 1. Tokens Compartidos de Espaciado CRUD (`src/css/base/variables.css` y `src/css/components/panelCrud.css`)
Para evitar que los paneles CRUD queden pegados a los bordes de la ventana o tengan márgenes inconsistentes entre módulos, se definieron tokens globales reutilizables en `:root`:
- `--rsi-crud-section-pt` / `--rsi-crud-section-pb`: Espaciado vertical uniforme para todas las secciones CRUD (`.rsi-users-section`, `.rsi-areas-section`, `.rsi-clientes-section`, `.rsi-cotizaciones-section`, `.rsi-facturas-section`, `.rsi-productos-section`, `.rsi-tickets-section`, `.rsi-asistencias-crud-section`).
- `--rsi-crud-section-px`: Margen horizontal responsivo del contenedor `.rsi-container`.
- `--rsi-crud-panel-padding`: Relleno interno uniforme (`clamp(1.25rem, 2.5vw, 2.25rem)`) para `.rsi-panel-crud`, garantizando aire visual alrededor de encabezados, barras de búsqueda/filtros, contadores, tablas y controles de paginación.
- Se eliminaron las reglas globales no acotadas en `src/css/pages/partner/crudCatalogs.css` que sobrescribían `.rsi-panel-crud { background: transparent; padding: 0; }`.

### 2. Reglas de Contraste y Tema Oscuro (`body.dark-mode`)
En `src/css/base/variables.css`, las variables `--rsi-white` (`#1a1a24`) y `--rsi-black` (`#f4f6fb`) se invierten semánticamente en `body.dark-mode`. Para prevenir combinaciones ilegibles (como texto blanco sobre fondo blanco o texto claro sobre botones claros):
1. **Token de Texto sobre Botones Sólidos (`--rsi-btn-text-on-solid: #ffffff`):**
   - Permanece siempre blanco (`#ffffff`) tanto en modo claro como en modo oscuro.
   - Todos los botones de acción sólida (`.rsi-btn-crud-primary`, `.rsi-btn-crud-success`, `.rsi-btn-crud-danger`, `.rsi-btn-submit`, `.rsi-btn-next`, `.rsi-btn-submit-step`, `.swal2-confirm`) utilizan fondos de alto contraste (`linear-gradient(135deg, var(--rsi-primary), var(--rsi-primary-dark))`) con `color: var(--rsi-btn-text-on-solid)`.
2. **Prohibición de `background: white` literal en Componentes:**
   - Las tarjetas, paneles, modales, inputs y botones secundarios/outline deben emplear siempre `var(--rsi-bg-card)` o `var(--rsi-bg-input)` en lugar de `white` o `#ffffff` fijo, asegurando su adaptación automática a `body.dark-mode`.
3. **Badges de Estado con Contraste WCAG AA:**
   - Los estados semánticos (`pendiente`, `en-proceso`, `finalizado`, `cancelado`, `active`, `inactive`, `alta`, `media`, `baja`) utilizan fondos translúcidos calibrados y colores de texto luminosos (`#ffd166`, `#67e8f9`, `#6ee7b7`, `#ff6b7d`) en `body.dark-mode`.
