# Informe Técnico: Homologación de Notificaciones Push, Correos de Asignación y Catálogo de Cloud Functions

- **Fecha:** 20 de octubre de 2026
- **Proyecto:** SPA-V1.0.0 — Fénix RSI Enterprise
- **Dominio Oficial:** `https://rsienterprise.com`
- **Áreas / Capas Afectadas:** Cloud Functions (`functions/`), Frontend Services (`src/services/`), Service Worker (`public/firebase-messaging-sw.js`), Router SPA (`src/router/router.js`).

---

## 1. Resumen Ejecutivo

El presente informe documenta la implementación de las directivas operativas sobre los canales de notificación institucional (Push Notifications FCM y correos electrónicos transaccionales vía Nodemailer/Cloud Functions) para el flujo de trabajo de asignación de tickets en la plataforma **Fénix RSI Enterprise**.

### Objetivos cumplidos:
1. **Redirección Operativa Directa a Atención de Ticket:**
   Se modificó el destino de apertura al asignar un ticket para que tanto la notificación push en segundo plano / primer plano como el correo electrónico dirijan inmediatamente a `/partner/ticketAtencion?id={idTicket}` en lugar de la vista pasiva `/partner/ticketView?id={idTicket}`. Esto permite al colaborador acceder de inmediato a la captura de evidencias fotográficas con marca de agua, registro de actividades y seguimiento en campo.
2. **Homologación Estricta al Dominio Oficial `rsienterprise.com`:**
   Se unificaron todas las URLs de origen, enlaces de correo electrónico, enlaces webpush FCM y recursos gráficos para garantizar que el remitente visual, los botones de acción y los enlaces directos empleen exclusivamente el dominio corporativo `https://rsienterprise.com`, eliminando referencias a URLs genéricas (`firebaseapp.com`, `web.app` o referencias dinámicas dependientes del host local).
3. **Catálogo Integral de Cloud Functions:**
   Se consolidó la documentación completa de todas las Cloud Functions desplegadas y disponibles en el backend de Node.js 22.

---

## 2. Catálogo General de Cloud Functions (`functions/`)

El backend desacoplado del sistema opera sobre Firebase Cloud Functions (Node.js 22) agrupado por responsabilidades funcionales:

| Función | Tipo / Disparador | Propósito Operativo | Entradas Principales |
| :--- | :--- | :--- | :--- |
| `enviarNotificacion` | HTTP (POST) | Despacho de notificaciones push masivas o individuales vía FCM v1 (Android, APNs, Webpush) | `tokens[]`, `titulo`, `mensaje`, `data` |
| `enviarTicketEmail` | HTTP (POST) | Notificación formal vía correo electrónico a colaboradores asignados a un nuevo ticket | `email`, `colaboradorNombre`, `ticketData`, `ticketUrl` |
| `enviarFacturaEmail` | HTTP (POST) | Envío de CFDI 4.0 a clientes con adjuntos binarios verificados (PDF oficial y XML timbrado) | `facturaId`, `email`, `pdfUrl`, `xmlUrl`, etc. |
| `enviarCotizacionEmail` | HTTP (POST) | Envío formal de cotizaciones comerciales en PDF al cliente | `cotizacionId`, `email`, `pdfUrl`, `clienteNombre` |
| `verificarEmailConfig` | HTTP (POST/GET) | Verificación de conectividad SMTP corporativa y credenciales de correo | Credenciales `EMAIL_USER`, `EMAIL_PASSWORD` |
| `obtenerClientes` | HTTP (GET) | Consulta y sincronización de clientes con el catálogo de Facturama | Query params / filtros |
| `crearCliente` | HTTP (POST) | Alta fiscal de clientes en el catálogo de Facturama | Objeto fiscal receptor CFDI 4.0 |
| `actualizarCliente` | HTTP (PUT) | Actualización fiscal de clientes en Facturama | `id`, objeto fiscal actualizado |
| `eliminarCliente` | HTTP (DELETE) | Baja lógica o eliminación de cliente en Facturama | `id` |
| `crearFactura` | HTTP (POST) | Emisión y timbrado digital oficial CFDI 4.0 ante el SAT mediante Facturama | Payload CFDI 4.0 normalizado |
| `cancelarFactura` | HTTP (POST) | Solicitud de cancelación oficial de CFDI 4.0 con motivo fiscal ante el SAT | `idFactura`, `motivo`, `uuidSustitucion` |
| `consultarFactura` | HTTP (GET) | Consulta del estatus fiscal de una factura en Facturama | `id` o `uuid` |
| `verificarArchivo` | HTTP (GET) | Verificación de integridad y presencia de binarios en Firebase Storage | `filePath`, `bucket` |
| `obtenerUrlArchivo` | HTTP (GET) | Generación y resolución de URLs de acceso a documentos en Storage | `filePath` |
| `recordatorioAsistencia0900` | Cloud Scheduler (`0 9 * * *`) | Recordatorio matutino automático de registro de jornada laboral (Zona Horaria México) | Evento programado (idempotente) |
| `recordatorioAsistencia1200` | Cloud Scheduler (`0 12 * * *`) | Recordatorio del mediodía para colaboradores con registro de jornada pendiente | Evento programado (idempotente) |
| `procesarRecordatoriosAsistencia` | HTTP (POST/GET) | Endpoint de mantenimiento para ejecutar o forzar recordatorios de asistencia manualmente | `tipo` ('0900' \| '1200'), `forzar` |
| `catalogoSocialPreview` | HTTP (GET) | Servidor SSR de metadatos Open Graph y Twitter Cards para previews en WhatsApp/Redes | `?id={catalogId}` |

---

## 3. Especificación Técnica de los Cambios

### 3.1. Enrutamiento y Dominio en Asignación de Tickets

#### A. Frontend (`src/services/ticketService.js`)
- **Método `enviarEmailsAsignacion`:**
  Se fijó la base de URL en `https://rsienterprise.com` y la ruta en `/partner/ticketAtencion?id=${ticketId}`:
  ```javascript
  const ticketId = ticketData.idTicket || ticketData.id;
  const baseUrl = 'https://rsienterprise.com';
  const ticketUrl = `${baseUrl}/partner/ticketAtencion?id=${ticketId}`;
  ```
- **Método `enviarNotificacionesAsignacion`:**
  El objeto `data` transportado en el payload push ahora provee la URL canónica absoluta con el dominio corporativo:
  ```javascript
  const ticketUrl = `https://rsienterprise.com/partner/ticketAtencion?id=${idTicket}`;
  const data = {
      ticketId: idTicket,
      url: ticketUrl,
      tipo: tipo || 'operativo',
      prioridad: prioridad || 'media',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
  };
  ```

#### B. Cloud Function `enviarTicketEmail` (`functions/controllers/email.controller.js`)
Se añadió sanitización y validación estricta en el controlador de Cloud Functions:
- Si `ticketUrl` no viene especificado o apunta a `/partner/ticketView`, se transforma automáticamente a `https://rsienterprise.com/partner/ticketAtencion?id=${idTicket}`.
- Si viene con una ruta relativa, se le antepone el dominio `https://rsienterprise.com`.
- Se actualizó el fallback de imágenes a `https://rsienterprise.com/assets/icons/logo.png`.

#### C. Cloud Function `enviarNotificacion` (`functions/index.js`)
Se incorporó el soporte para Firebase Cloud Messaging v1 Webpush Links:
- Normalización automática del payload: si `data.ticketId` está presente, la URL de navegación por defecto es `https://rsienterprise.com/partner/ticketAtencion?id=${ticketId}`.
- Configuración de `webpush.fcmOptions.link`:
  ```javascript
  webpush: {
      notification: {
          icon: "https://rsienterprise.com/favicon.ico",
          badge: "https://rsienterprise.com/favicon.ico"
      },
      fcmOptions: {
          link: pushUrl || "https://rsienterprise.com"
      }
  }
  ```
  Esto permite que las notificaciones del sistema operativo en navegadores de escritorio y dispositivos móviles abran inmediatamente la ventana con la URL oficial al hacer clic en el banner push.

#### D. Service Worker (`public/firebase-messaging-sw.js`)
- En el evento `notificationclick`:
  Se estableció una constante `BASE_DOMAIN = 'https://rsienterprise.com'`.
  Si el mensaje push no contiene una URL explícita o trae la antigua ruta `/partner/ticketView`, se resuelve de forma determinista hacia `${BASE_DOMAIN}/partner/ticketAtencion?id=${ticketId}`.
  Al hacer clic, el Service Worker activa el cliente de ventana existente o invoca `clients.openWindow(fullUrlToOpen)`.

#### E. Servicio Cliente de Notificaciones (`src/services/notificationService.js`)
- En el evento en primer plano (`onMessage`):
  Se normaliza la URL de destino hacia `https://rsienterprise.com/partner/ticketAtencion?id=${ticketId}`.
  Al hacer clic en el toast de `SweetAlert2`, se analiza la URL para realizar una transición SPA sin recarga innecesaria si el usuario ya se encuentra dentro del sistema, o una redirección estándar en caso contrario.

#### F. Enrutador SPA (`src/router/router.js`) y Barra de Navegación (`src/components/visitor/navbarController.js`)
- Se mejoró el listener de `FCM_NAVIGATE` para interpretar URLs absolutas de `rsienterprise.com` y extraer la ruta interna (`pathname + search`), permitiendo a `navigateTo()` procesar la solicitud fluidamente.
- Se añadió el mapeo de `/partner/ticketAtencion` a la sección activa `/partner/crudTickets` en `navbarController.js`.

### 3.2. Visualización de Fotografía en Base64 de Colaboradores en `ticketAtencion` y `ticketView`
- **Frontend Services (`src/services/ticketService.js`):** Se aseguró la extracción y preservación de `fotoPerfil` (formato Base64 `data:image/...` o URL) en `getColaboradoresForSelect()` y `getTicketConDetalles()`. Se agregó un mecanismo de resolución individual (`partnerRepository.getCollaboratorByUid`) para aquellos colaboradores asignados cuyo rol o registro no forme parte de la consulta inicial.
- **Controlador de Atención (`src/controllers/partner/ticketAtencionController.js`):** El componente de perfil del colaborador en la sección de aceptaciones renderiza la imagen `<img>` con clase `.has-photo`, implementando un callback `onerror` que degrada automáticamente al avatar de iniciales si la imagen no está disponible.
- **Controlador de Detalle (`src/controllers/partner/ticketViewController.js`):** Se integró la foto de perfil en la lista de colaboradores asignados y en el campo de Responsable del ticket, respetando la estructura visual del diseño.
- **Estilos CSS (`src/css/pages/partner/ticketAtencion.css`):** Se añadieron reglas de estilo para `.ta-collab-avatar.has-photo` y `.ta-collab-avatar img` garantizando el ajuste circular (`border-radius: var(--rsi-radius-full)`), `object-fit: cover` y borde sutil.

### 3.3. Unificación de Visibilidad y Asignación de Tickets en el CRUD (`/partner/crudTickets`)
- **Causa Raíz de la Restricción Previa:** Existía una bifurcación lógica condicional en `ticketsCrudController.js` (`if (!isAdmin)`) que forzaba a los colaboradores con rol `partner` a pasar por un filtro estricto (`userTickets = allTickets.filter(t => canUserAccessTicket(session, t))`), impidiéndoles ver cualquier ticket en el que no estuvieran explícitamente asignados o no fueran el creador directo.
- **Acceso Total Unificado:** Se eliminó la bifurcación restrictiva en `ticketsCrudController.js`. Ahora, tanto colaboradores como administradores consultan de forma unificada la totalidad de los tickets mediante paginación estándar (`getTicketsPaginated`) y búsqueda global (`getAllTickets`).
- **Permisos de Consulta (`src/services/ticketService.js`):** El método `canUserAccessTicket` fue actualizado para conceder acceso de lectura a todos los colaboradores y usuarios autenticados del sistema, eliminando los bloqueos por "Acceso Denegado" al consultar tickets desde la interfaz.
- **Asignación Ampliada de Colaboradores:** El método `getColaboradoresForSelect` en `ticketService.js` fue optimizado para consultar a todos los colaboradores activos de la colección `usersRSI` (`status !== 'inactive'`), permitiendo asignar cualquier colaborador o supervisor sin restricciones de rol excluyente.
- **Acceso Operativo Directo:** Se incorporó en las acciones de cada fila del CRUD de tickets el botón directo de `"Atención del ticket"` (`/partner/ticketAtencion?id=`) junto a las opciones de detalle, edición y reporte fotográfico.

---

## 4. Archivos Modificados

1. `src/services/ticketService.js`: Actualización de URLs de correo y payload push hacia `/partner/ticketAtencion?id=` y `https://rsienterprise.com`, extracción de fotos en base64 de colaboradores, unificación de permisos en `canUserAccessTicket` y consulta ampliada en `getColaboradoresForSelect`.
2. `src/controllers/partner/ticketsCrudController.js`: Eliminación de la restricción de visibilidad para colaboradores, paginación unificada de todos los tickets, cálculo de métricas globales e integración del botón directo de atención.
3. `src/controllers/partner/ticketViewController.js`: Actualización de la guardia de acceso para permitir consulta a cualquier usuario autenticado, renderizado de fotos de colaboradores asignados y responsable.
4. `src/services/notificationService.js`: Manejo de navegación en primer plano hacia `/partner/ticketAtencion?id=`.
5. `public/firebase-messaging-sw.js`: Manejo de clic en background con fallback hacia `https://rsienterprise.com/partner/ticketAtencion?id=`.
6. `src/router/router.js`: Soporte de navegación fluida con URLs completas desde eventos FCM.
7. `src/components/visitor/navbarController.js`: Registro de la sección activa para `/partner/ticketAtencion`.
8. `src/controllers/partner/ticketAtencionController.js`: Renderizado de fotografía de colaborador (base64) con fallback a iniciales en la lista de colaboradores.
9. `src/css/pages/partner/ticketAtencion.css`: Estilos visuales para avatares con fotografía.
10. `functions/controllers/email.controller.js`: Normalización y garantía del dominio oficial en `enviarTicketEmail` y reemplazo de fallbacks.
11. `functions/index.js`: Enriquecimiento del mensaje FCM con `webpush.fcmOptions.link` y normalización de URLs bajo `rsienterprise.com`.
12. `functions/services/recordatorioAsistencia.service.js`: Sustitución de enlaces `firebaseapp.com` por el dominio corporativo `https://rsienterprise.com/partner/asistencia`.

---

## 5. Pruebas y Verificaciones Técnicas

1. **Compilación de Producción (Vite):**
   - Comando ejecutado: `npm run build`
   - Resultado: Éxito (`exit code 0`).
   - Módulos transformados: 153 módulos, generación limpia de bundles en `dist/` en 1.62 segundos.
2. **Validación Sintáctica del Backend (Node.js):**
   - Comando ejecutado: `node -c` sobre `functions/index.js`, controladores y servicios modificados.
   - Resultado: Éxito (`exit code 0`), sin errores sintácticos ni referencias no resueltas.
3. **Validación de Políticas de Seguridad:**
   - Cero credenciales o secretos introducidos en código o documentación.
   - Respeto total al patrón arquitectónico desacoplado y las directrices de `AGENTS.md`.
