# AGENTS.md — Reglas y Guía Permanente de Desarrollo
## Proyecto: SPA-V1.0.0 — Fénix RSI Enterprise

Este documento establece las directrices arquitectónicas, convenciones de desarrollo, normas de seguridad y flujos de trabajo de observancia obligatoria para cualquier agente de programación (Codex, Antigravity u otros) que opere en este repositorio.

---

## 1. Identidad y objetivo del proyecto

- **Nombre del proyecto:** SPA-V1.0.0 (Fénix RSI Enterprise).
- **Naturaleza:** Single Page Application (SPA) modular de nivel empresarial para servicios integrales de seguridad electrónica, automatización y telecomunicaciones.
- **Stack tecnológico central:**
  - **Frontend:** Vanilla JavaScript modular (ES6+ Modules nativos), HTML5 semántico y CSS3 modular.
  - **Empaquetador y entorno de desarrollo:** Vite (`v8.x`), ejecutado en modo módulo (`"type": "module"` en `package.json`).
  - **Backend y Servicios Cloud:** Firebase Suite (Firestore, Firebase Authentication, Firebase Storage, Firebase Cloud Messaging y Cloud Functions sobre Node.js 22).
  - **Facturación Electrónica:** Facturama API para timbrado y cancelación de CFDI 4.0 en México.
- **Módulos principales del sistema:**
  - **Portal Público (Visitantes):** Home interactivo, servicios, nosotros, contacto, catálogo de productos públicos y visualizador de catálogos comerciales.
  - **Sistema Interno (Partner / Admin):** Dashboard operativo y comercial con métricas y gráficas (`Chart.js`), gestión de colaboradores y perfiles, estructura de áreas y puestos, catálogo de productos y servicios internos con homologación SAT, administración de clientes, módulo de cotizaciones formales y sistema de tickets de soporte técnico.
  - **Módulo Fiscal y Facturación:** Conversión de cotizaciones a facturas, creación de facturas en borrador, validación fiscal previa, timbrado oficial CFDI 4.0 vía Cloud Functions, generación de PDF oficial homologado con vector QR del SAT, almacenamiento de comprobantes oficiales (XML y PDF) en Firebase Storage y envío por correo electrónico con adjuntos certificados.

---

## 2. Arquitectura obligatoria

El proyecto implementa un patrón **MVC / Repository** desacoplado en el cliente. Todo agente debe respetar estrictamente la separación de responsabilidades y el flujo unidireccional de datos:

```
[ Vista HTML: public/pages/ o public/components/ ]
                    │
                    ▼
       [ Controlador: src/controllers/ ]
                    │
                    ▼
          [ Modelo: src/models/ ]  (Validación, transformación y esquemas)
                    │
                    ▼
        [ Servicio: src/services/ ] (Reglas de negocio y orquestación)
                    │
                    ▼
     [ Repositorio: src/repositories/ ] (Caché en memoria y acceso a datos)
                    │
                    ▼
[ Firebase SDK / Cloud Functions / Proveedores Externos (Facturama) ]
```

### Responsabilidades por capa

1. **Vistas (`public/pages/`, `public/components/`):**
   - Plantillas HTML limpias cargadas dinámicamente vía `fetch()` por el enrutador o el cargador de layouts (`loadLayout.js`).
   - Queda prohibido incrustar lógica de negocio o etiquetas `<script>` con código de aplicación dentro de los archivos HTML de las vistas.
2. **Controladores (`src/controllers/`):**
   - Agrupados por contexto en `src/controllers/partner/`, `src/controllers/visitor/` y `src/controllers/shared/`.
   - Capturan eventos del DOM, manejan formularios, invocan a la capa de Servicios y gestionan la interfaz de usuario y alertas visuales (`SweetAlert2`).
   - **PROHIBICIÓN ESTRICTA:** Ningún controlador debe importar directamente el SDK de Firestore (`collection`, `doc`, `getDocs`, `query`, etc.) ni consultar colecciones directamente. Toda interacción de datos debe realizarse a través del Servicio correspondiente.
3. **Modelos (`src/models/`):**
   - Clases que definen la estructura y normalización de las entidades del sistema (`areaModel.js`, `clienteModel.js`, `cotizacionModel.js`, `facturaModel.js`, `ticketModel.js`, etc.).
   - Contienen métodos estáticos para construcción (`create`, `update`), cálculo de totales, normalización de campos y validación de esquemas (`validate`, `validateForTimbrado`).
4. **Servicios (`src/services/`):**
   - Implementan la lógica de negocio, validación de permisos de usuario (`_getCurrentUserUid()`), orquestación entre múltiples repositorios y comunicación con endpoints de Cloud Functions (ej. Facturama, envío de emails, subida de binarios en Storage).
   - Nunca manipulan el DOM directamente.
5. **Repositorios (`src/repositories/`):**
   - Heredan de `BaseRepository.js`, aprovechando mecanismos de caché en memoria con TTL (ej. 60 segundos) para optimizar lecturas.
   - Encapsulan las operaciones de Firestore (`getDoc`, `setDoc`, `updateDoc`, `runTransaction`) y Storage.
   - Garantizan atomicidad transaccional en operaciones concurrentes.
6. **Backend Cloud Functions (`functions/`):**
   - Backend en Node.js 22 que centraliza operaciones con credenciales privilegiadas (Facturama API, Firebase Admin SDK, Nodemailer para envíos SMTP corporativos).

---

## 3. Convenciones de desarrollo

### Organización y ubicación de archivos
- Todo el código JavaScript de la aplicación reside en `src/`.
- Las plantillas HTML se ubican exclusivamente en `public/pages/` y `public/components/`.
- Las hojas de estilo se ubican en `src/css/` y se importan de forma centralizada en `src/css/main.css`.
- Queda prohibido crear archivos sueltos de prueba o notas huérfanas en los directorios de código (ej. archivos `.txt`).

### Nombres y convenciones de archivos
- **Modelos:** camelCase con sufijo `Model.js` (ej. `facturaModel.js`).
- **Repositorios:** camelCase con sufijo `Repository.js` (ej. `facturaRepository.js`).
- **Servicios:** camelCase con sufijo `Service.js` (ej. `facturaService.js`).
- **Controladores:** camelCase con sufijo `Controller.js` (ej. `facturaFormController.js`).
- **Archivos de rutas e importaciones:** Cuidar estrictamente la sensibilidad a mayúsculas/minúsculas (*case-sensitivity*). Por ejemplo, el módulo fiscal debe importarse como `regimenesSat.js` (no `regimenesSAT.js`) para garantizar total compatibilidad en sistemas Linux y tuberías CI/CD.

### Importaciones ES Modules
- Utilizar siempre la extensión explícita `.js` en las rutas relativas de importación:
  ```javascript
  import FacturaService from '../services/facturaService.js';
  import { db, runTransaction } from '../config/firebaseConfig.js';
  ```
- Centralizar las importaciones del SDK de Firebase a través del módulo de configuración `src/config/firebaseConfig.js`.

### Manejo de errores y respuestas
- Los métodos de servicios y repositorios deben encapsular llamadas asíncronas con bloques `try / catch` bien delimitados.
- Estandarizar retornos de operaciones con la estructura:
  ```javascript
  return { success: true, id: docId, message: 'Operación completada' };
  // En caso de fallo:
  return { success: false, error: error.message };
  ```
- No silenciar excepciones críticas; registrarlas con `console.error` descriptivo y propagarlas cuando el flujo del controlador requiera informar al usuario.
- En la interfaz de usuario, emplear SweetAlert2 (`Swal.fire`) para retroalimentación visual clara y no bloquear la ejecución con `alert()` nativo.

### Reutilización de código
- Antes de escribir una función utilitaria, revisar el directorio `src/utils/`.
- Utilizar `src/utils/pdfGenerator.js` como la fuente de verdad unificada para generación de cotizaciones y facturas. `src/utils/facturaPdfGenerator.js` actúa como adaptador re-exportador de conveniencia.
- Emplear `src/utils/qrCode.js` para códigos QR vectoriales del SAT y `src/utils/modalManager.js` para gestión modal.

---

## 4. Firebase y backend

### Reutilización de configuración y dependencia en `package.json`
- Usar siempre la instancia ya inicializada de Firebase en `src/config/firebaseConfig.js`.
- No inicializar apps adicionales en el frontend a menos que se requiera deliberadamente una conexión secundaria aislada y debidamente documentada.
- **Dependencia local obligatoria (`[ERR-018]` resuelto):** El paquete `firebase` (`^12.1.0`) debe permanecer explícitamente declarado en `dependencies` dentro del `package.json` raíz del proyecto (`firebase/app`, `firebase/firestore`, `firebase/auth`, `firebase/storage`, `firebase/messaging`). Nunca debe dependerse de instalaciones globales o en directorios padres fuera del repositorio para que `vite build` (Rolldown) compile correctamente. Ver informe detallado en `docs/informe-resolucion-dependencia-firebase.md`.

### Autenticación y control de acceso
- Validar siempre la sesión activa (`rsi_session` en `localStorage`) mediante `authService.getSession()` o `_getCurrentUserUid()` antes de efectuar operaciones de negocio en módulos protegidos.
- El enrutador (`src/router/router.js`) cuenta con guardias de navegación (*Route Guards*) que impiden el acceso visual a rutas `/partner/*` sin sesión válida y redirigen `/login` al dashboard si ya hay sesión.
- **Recordatorio esencial:** Las guardias del frontend son de carácter visual y de usabilidad. La seguridad real y definitiva debe estar respaldada por las reglas de seguridad de Firestore y Storage en Firebase Console.

### Optimización de consultas
- Evitar consultas abiertas sin filtros (`limit`, `where`) sobre colecciones que puedan crecer indefinidamente.
- Aprovechar el almacenamiento en memoria con TTL de `BaseRepository` para catálogos que no cambian con frecuencia.

### Integridad transaccional y prevención de carreras
- Para contadores, folios consecutivos o códigos de tickets (`contadorCotizacionRepository.js`, `ticketRepository.js`), **es obligatorio** utilizar transacciones atómicas de Firestore mediante `runTransaction(db, ...)`:
  ```javascript
  const nuevoNumero = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const actual = docSnap.exists() ? (docSnap.data().count || 0) : 0;
      const siguiente = actual + 1;
      transaction.update(docRef, { count: siguiente, updatedAt: new Date().toISOString() });
      return siguiente;
  });
  ```
- Queda terminantemente prohibido utilizar lecturas sueltas (`getDoc`) seguidas de escrituras independientes (`updateDoc` o `setDoc`) para asignación de números secuenciales o folios.

### Almacenamiento binario (Storage vs Firestore)
- **Regla estricta:** Está prohibido persistir imágenes en Base64 directamente dentro de documentos de Firestore (límite de 1 MB por documento).
- Fotografías de colaboradores, imágenes de productos y comprobantes deben subirse a Firebase Storage a través de `StorageService`, almacenando en Firestore únicamente la URL pública de descarga (`downloadURL`) y la ruta interna en el bucket (`fileName` / `path`).

---

## 5. Facturación electrónica CFDI 4.0 (Facturama)

### Entornos y credenciales
- Facturama opera con dos entornos: **Sandbox** (pruebas) y **Producción** (timbrado real).
- Queda terminantemente prohibido ejecutar operaciones de prueba o generar CFDIs de prueba apuntando a las credenciales o endpoints de producción.
- Toda operación fiscal en entorno de producción requiere autorización explícita y confirmación del usuario.

### Prevención de facturas duplicadas
- Antes de invocar el timbrado de un folio, el sistema debe:
  1. Verificar si el documento local en Firestore ya cuenta con un `uuid` o `facturamaId`.
  2. Consultar emisiones previas registradas en Facturama por número de folio (`buscarEmisionPreviaFacturama`).
  3. Si la factura ya fue timbrada previamente, utilizar el método `recuperarComprobantes(facturaId)` para sincronizar los archivos oficiales desde Facturama y Storage sin volver a consumir un timbre ni generar duplicidad fiscal.

### Catálogos y claves oficiales del SAT
- Cumplir rigurosamente con los catálogos del SAT para CFDI 4.0 contenidos en `src/utils/regimenesSat.js`:
  - `c_RegimenFiscal`: Régimen fiscal del emisor y receptor.
  - `c_UsoCFDI`: Uso fiscal válido para el receptor según su régimen.
  - `c_FormaPago`: Forma de pago (01, 02, 03, 04, 99, etc.).
  - `c_MetodoPago`: Método de pago (`PUE` o `PPD`).
  - `c_ClaveProdServ`: Clave de producto o servicio (Catálogo SAT).
  - `c_ClaveUnidad`: Clave de unidad de medida (Catálogo SAT).
- Las búsquedas en el catálogo SAT deben consumirse mediante `ProductoServicioService.searchSatCatalog()`, nunca mediante consultas directas en controladores.

### Coherencia total de representaciones
Debe existir una correspondencia matemática y textual exacta del 100% entre:
1. El formulario de captura en el cliente.
2. El modelo estructurado en `FacturaModel`.
3. El payload JSON enviado a Facturama / Cloud Function.
4. El archivo XML timbrado por el PAC / SAT.
5. Los campos guardados en el documento de Firestore.
6. La representación impresa en el archivo PDF.

### Preservación de sellos y metadatos fiscales
Queda prohibido simular, alterar o inventar datos de timbrado en facturas vigentes. Tras un timbrado o recuperación auténtica, deben preservarse intactos:
- Folio Fiscal (`UUID`).
- Fecha y Hora de Certificación.
- Sello Digital del Emisor (`sello`).
- Sello Digital del SAT (`selloSat`).
- No. de Certificado del Emisor (`noCertificado`).
- No. de Certificado del SAT (`certNumber`).
- RFC del Proveedor de Certificación (`rfcProveedor`).
- Cadena Original del complemento de certificación.
- Código QR oficial construido estrictamente bajo el formato SAT:
  `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id={UUID}&re={RFC_EMISOR}&rr={RFC_RECEPTOR}&tt={TOTAL}&fe={OCHO_ULTIMOS_CARACTERES_SELLO}`.

### Almacenamiento y recuperación de comprobantes
- El XML oficial timbrado debe persistirse en Firebase Storage en la ruta `facturas/{facturamaId}.xml`.
- El PDF oficial generado debe persistirse en Firebase Storage en la ruta `facturas/{facturaNumero}.pdf`.
- En el documento de Firestore deben persistirse `xmlUrl`, `xmlPath`, `pdfUrl`, `pdfPath`, `timbrado` y `facturamaId`.

### Envío de correos electrónicos con comprobantes
- Los correos de facturación enviados a través de `enviarFacturaEmail` deben adjuntar los archivos binarios auténticos:
  - Validar que el PDF comience con la cabecera binaria `%PDF-`.
  - Validar que el XML contenga `<cfdi:Comprobante` o la declaración `<?xml`.
- Queda terminantemente prohibido adjuntar archivos vacíos, textos con mensajes de error simulados como adjuntos o enlaces rotos.

### Protección del diseño gráfico institucional
- El diseño visual de facturas y cotizaciones implementado en `src/utils/pdfGenerator.js` es la plantilla corporativa oficial aprobada de RSI Enterprise.
- Ningún agente debe modificar el diseño, tipografías, encabezados, tablas, paleta de colores ni la disposición de los bloques fiscales del PDF sin solicitud y aprobación expresa del usuario.

---

## 6. Seguridad

### Cero credenciales en código, documentación o logs
- **Regla inviolable:** Queda estrictamente prohibido incluir contraseñas, secretos de API, credenciales de correo (como Gmail App Passwords), tokens privados, claves privadas de certificados o llaves de Facturama en el código fuente, comentarios, archivos markdown, commits o logs de consola.
- Los secretos deben gestionarse únicamente a través de variables de entorno seguras (`defineString` de Firebase Functions o Google Cloud Secret Manager).

### Control de versiones y exclusiones
- Revisar permanentemente que `.gitignore` excluya:
  - `.env` y `.env.*`
  - `functions/.env*`
  - `*-credentials.json`
  - `service-account*.json`
- Si un agente detecta un secreto o archivo sensible expuesto localmente, no debe imprimirlo en sus respuestas ni copiarlo a ningún archivo que forme parte del control de versiones. Debe reportar de inmediato el riesgo y las medidas de contención.

### Integridad de mecanismos de autorización
- Queda terminantemente prohibido modificar reglas de seguridad en Firebase (`firestore.rules` o `storage.rules`) para abrirlas a modo permisivo (`allow read, write: if true;`) con el pretexto de resolver un problema de desarrollo.
- La creación de nuevos usuarios colaboradores no debe realizarse desde el SDK de cliente principal si esto sobrescribe o suplanta la sesión activa del administrador; debe gestionarse a través del backend con Firebase Admin SDK.

---

## 7. Protección contra regresiones

Antes de modificar cualquier archivo existente en el proyecto, el agente debe seguir las siguientes reglas de protección:

1. **Rapeo de dependencias:** Identificar qué módulos importan el archivo a modificar y qué dependencias consume dicho archivo.
2. **Preservación de contratos de interfaz:** Mantener los nombres de métodos, firmas de parámetros y estructuras de datos de retorno existentes (por ejemplo, `{ success, id, ... }` o `{ valid, errors }`).
3. **No refactorizaciones masivas no solicitadas:** Limitar la intervención exclusivamente al alcance de la tarea asignada. No reorganizar carpetas, no cambiar nombres de variables en archivos ajenos ni reescribir módulos funcionales sin instrucción explícita.
4. **Comprobación de archivos aparentemente huérfanos:** No eliminar archivos HTML ni scripts que parezcan no tener importaciones estáticas directas sin comprobar si son cargados dinámicamente mediante `fetch()` en `loadLayout.js`, llamados por `src/router/routes.js` o invocados como modales.
5. **Preservación de la sesión y estado del usuario:** No alterar los esquemas de persistencia en `localStorage` (`rsi_session`, `rsi_theme`) sin mantener compatibilidad con sesiones previamente guardadas.

---

## 8. Flujo de trabajo obligatorio para agentes

Toda intervención en este repositorio debe ajustarse de forma metódica al siguiente ciclo de 7 pasos:

1. **Inspección preliminar:** Leer los archivos implicados y sus dependencias directas para comprender el contexto y los contratos previos.
2. **Diagnóstico claro:** Explicar brevemente el problema detectado, la causa raíz y la solución técnica mínima requerida.
3. **Implementación del cambio mínimo suficiente:** Realizar las modificaciones necesarias con la menor superficie de cambio posible, preservando estilos y convenciones existentes.
4. **Revisión de efectos secundarios:** Verificar que ningún consumidor o archivo dependiente haya quedado roto tras el cambio.
5. **Verificación técnica local:**
   - Ejecutar `npm run build` en la raíz del proyecto para validar que la compilación de Vite concluya con código de salida 0 y sin errores de PostCSS o rollup.
   - Ejecutar pruebas sintácticas o scripts de verificación existentes si aplica al módulo modificado.
6. **Informe honesto y transparente:** Reportar al usuario con precisión:
   - Archivos modificados y su justificación.
   - Resultados de las pruebas ejecutadas.
   - Errores pendientes o advertencias que requieran atención.
   - Verificaciones que no pudieron realizarse en el entorno local (ej. validaciones que dependan de servicios cloud remotos o credenciales privadas).
7. **Regla de oro sobre el éxito:** Queda prohibido declarar una tarea como "completamente exitosa y probada en producción" si únicamente se inspeccionó el código o se ejecutó la compilación local. Debe distinguirse con claridad entre la verificación estática/de compilación y la prueba funcional en vivo.

---

## 9. Restricciones de ejecución

Por defecto, los agentes tienen estrictamente restringido ejecutar las siguientes acciones a menos que el usuario proporcione una autorización explícita y documentada:

- **Despliegues remotos:** Ejecutar `firebase deploy` (sea Hosting, Functions, Firestore o Storage).
- **Operaciones fiscales reales:** Timbrar, certificar o cancelar comprobantes CFDI reales en el entorno de producción de Facturama.
- **Modificación de dependencias:** Ejecutar `npm install`, `npm update` o alterar manualmente `package.json` o `package-lock.json`.
- **Migraciones o borrados masivos:** Modificar o eliminar colecciones enteras en bases de datos o buckets de Storage remotos.
- **Modificación de reglas remotas:** Desplegar o cambiar reglas de seguridad de Firestore o Storage en la consola de Firebase.

Si una tarea técnica requiere indispensablemente alguna de estas operaciones, el agente debe:
1. Explicar el motivo técnico y justificar la necesidad.
2. Detallar el alcance, los riesgos y el plan de contingencia.
3. Solicitar autorización expresa y esperar la confirmación del usuario antes de proceder.

---

## 10. Criterios de finalización de tarea

Una tarea asignada a un agente de programación se considerará formalmente concluida únicamente cuando se cumplan todos los siguientes criterios:

1. **Código implementado y limpio:** El cambio cumple el objetivo solicitado sin introducir código muerto, imports no resueltos ni archivos temporales.
2. **Arquitectura respetada:** La solución se apega al flujo `Vista → Controlador → Modelo → Servicio → Repositorio` sin atajos ni violaciones de responsabilidad.
3. **Compilación verificada:** `npm run build` se ejecuta y finaliza exitosamente (`exit code 0`).
4. **Sin secretos expuestos:** Ninguna credencial, token o dato confidencial ha sido escrito en código, documentación o historial.
5. **Reporte final completo:** Se entrega al usuario un resumen conciso con las rutas de los archivos modificados, las decisiones técnicas adoptadas, las verificaciones realizadas y los pasos manuales recomendados al usuario si aplican.

---

## 11. Reglas de Navegación, Flujo de Asistencia Partner, Dashboard y Sistema Visual

Ver documentación técnica detallada en `docs/arquitectura-navegacion-dashboard-y-sistema-visual.md`.

### Navegación y menús desplegables (`navbarController.js`)
- **Separación de estados:** Nunca utilizar la clase `.active` en `.nan_dropdown-item` para mantener visible un `.nan_dropdown-menu` en escritorio. El resaltado de sección activa debe usar `.has-active-child` en el ítem contenedor y `.active` en `.nan_dropdown-trigger`, mientras que la apertura del desplegable se controla exclusivamente con `.dropdown-open` y `:hover:not(.dropdown-closing)`.
- **Cierre obligatorio:** Todo menú desplegable (`.nan_dropdown-menu` y `.nan-user-dropdown`) debe cerrarse inmediatamente al seleccionar una opción (`closeAllDropdowns(true)`), al hacer clic/toque fuera (`pointerdown`), al presionar `Escape`, o ante eventos de navegación (`route:changing`, `route:changed`, `popstate`).
- **Limpieza de listeners:** Antes de reinicializar el navbar en `navbarController.init()`, siempre debe invocarse `this.cleanup()` para remover listeners previos de `document` y `window`.

### Flujo obligatorio de asistencia para el rol `partner`
- Al iniciar sesión o navegar a `/`, `/login` o `/partner/dashboard`, el sistema debe evaluar `await authService.resolvePartnerLandingRoute()`.
- Si el usuario autenticado tiene rol `partner` y no ha registrado su entrada del día actual en Firestore (`AsistenciaService.getEstadoHoy()` bajo zona horaria `America/Mexico_City`), debe ser redirigido a `/partner/asistencia`.
- Una vez registrada la entrada del día, el colaborador `partner` puede acceder libremente a `/partner/dashboard` y al resto de módulos permitidos sin redirecciones repetitivas.
- El rol `admin` no está sujeto a redirección forzosa de asistencia al iniciar sesión.

### Dashboard de Partner (`dashboardController.js`)
- Queda prohibido el uso de datos simulados (*mock data*) o estados de asistencia falsos en `localStorage` dentro de `src/controllers/partner/dashboardController.js`.
- El dashboard debe alimentarse exclusivamente de `NewCollaboratorService`, `AsistenciaService` y `TicketService`, y no debe emplear emojis como iconos en el código ni en la interfaz (usar siempre iconos de FontAwesome).

### Espaciado CRUD y contraste en modo oscuro (`variables.css`, `panelCrud.css`)
- Todos los módulos CRUD deben respetar los tokens de espaciado `--rsi-crud-section-pt`, `--rsi-crud-section-pb`, `--rsi-crud-section-px` y `--rsi-crud-panel-padding` definidos en `src/css/base/variables.css` y aplicados en `src/css/components/panelCrud.css`. Queda prohibido sobrescribir globalmente `.rsi-panel-crud` con `padding: 0` o `background: transparent`.
- Dado que `--rsi-white` y `--rsi-black` invierten su luminosidad en `body.dark-mode`, los botones con fondo sólido deben usar `var(--rsi-btn-text-on-solid, #ffffff)` para su color de texto, y las tarjetas/paneles/modales deben usar `var(--rsi-bg-card)` o `var(--rsi-bg-input)` en lugar de `white` o `#ffffff` literal.

