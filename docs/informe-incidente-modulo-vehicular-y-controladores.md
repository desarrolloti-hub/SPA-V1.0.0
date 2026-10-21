# INFORME DE RECUPERACIÓN TÉCNICA Y ARQUITECTÓNICA — SPA-V1.0.0
## Incidente: Errores HTTP 500 en Controladores Partner y Regularización Arquitectónica

**Fecha:** 19 de Octubre de 2026  
**Proyecto:** SPA-V1.0.0 (Fénix RSI Enterprise)  
**Entorno afectado:** Servidor de Desarrollo Vite y Compilador Rolldown  
**Estado:** Resuelto y Verificado  

---

## 1. Resumen ejecutivo

Durante la integración del nuevo módulo de Parque Vehicular, Checklists de Salida y Firma Electrónica, se presentaron respuestas HTTP 500 al solicitar cinco controladores en el navegador:

1. `/src/controllers/partner/profileController.js`
2. `/src/controllers/partner/vehiculosCrudController.js`
3. `/src/controllers/partner/vehiculoDetalleController.js`
4. `/src/controllers/partner/checklistSalidaFormController.js`
5. `/src/controllers/partner/checklistsCrudController.js`

Tras un diagnóstico forense minucioso, se identificó la causa raíz exacta, se eliminó la dependencia errónea, se homologó el patrón arquitectónico de controladores con el resto del proyecto y se verificó la compilación exitosa con código de salida 0 (`npm run build`).

---

## 2. Diagnóstico forense y causa raíz

### 2.1. Causa raíz principal: Import no resuelto de `sweetalert2` (HTTP 500 en Vite)
- **Problema:** En los cinco archivos afectados se agregó la instrucción:
  ```javascript
  import Swal from 'sweetalert2';
  ```
- **Origen del fallo:** En este proyecto, `sweetalert2` **no** está instalado como paquete npm en `package.json` (donde únicamente residen `firebase` y `chart.js`).
- **Mecanismo real del proyecto:** SweetAlert2 se carga globalmente a través del CDN oficial en `index.html`:
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  ```
- **Consecuencia en Vite:** Cuando el navegador solicita cualquier archivo con un import ES Module hacia un paquete inexistente en `node_modules`, Vite dev server intenta resolverlo estáticamente en el árbol de dependencias de Node. Al no encontrarlo, Vite arroja una excepción interna no capturada:
  ```text
  [vite] Internal server error: Failed to resolve import "sweetalert2" from "src/controllers/partner/..."
  ```
  lo que se traduce directamente en un código de estado `HTTP 500 Internal Server Error` devuelto al cliente.

### 2.2. Discrepancia en el patrón de controladores y router (`routes.js`)
- **Problema:** Los nuevos controladores vehiculares se habían registrado en `src/router/routes.js` importando clases por default y envolviéndolas en funciones anónimas inline:
  ```javascript
  controller: () => new VehiculosCrudController().init()
  ```
- **Convención transversal del proyecto:** En todo el repositorio (ver `asistenciaController.js`, `ticketAtencionController.js`, `dashboardController.js`, etc.), el router espera funciones exportadas nombradas con firma `async function xxxController()` y su correspondiente exportación por defecto:
  ```javascript
  export class TicketAtencionController { ... }

  export async function ticketAtencionController() {
      const controller = new TicketAtencionController();
      await controller.init();
  }
  export default ticketAtencionController;
  ```
  Al no apegarse a esta convención, se generó inconsistencia en el ciclo de vida del router y duplicidad de patrones.

---

## 3. Violaciones arquitectónicas identificadas y corregidas

| Componente | Violación Detectada | Corrección Aplicada | Estado |
| :--- | :--- | :--- | :--- |
| **Dependencias JS** | Import directo `import Swal from 'sweetalert2'` en controladores sin estar en `package.json`. | Eliminado el import estático. Consumir `Swal` desde el ámbito global (`window.Swal`), homologado con los demás controladores. | Resuelto |
| **Controladores** | Exportación exclusiva de clases sin la función puente asíncrona de inicialización. | Se mantuvieron las clases orientadas a objetos y se expuso la función `async function [nombre]Controller()` exportada nominalmente y por defecto. | Resuelto |
| **Enrutador (`routes.js`)** | Uso de funciones flecha anónimas que instanciaban clases de forma no estándar en las rutas. | Se restableció el mapeo directo `controller: vehiculosCrudController`, delegando la ejecución limpia en `router.js` (`await route.controller()`). | Resuelto |
| **Perfil Colaborador** | Inclusión de import roto de `sweetalert2` en `profileController.js` que colapsaba la vista de perfil. | Se limpió el import en `profileController.js`, preservando intacta la nueva pestaña de asignaciones vehiculares y la firma en canvas. | Resuelto |

---

## 4. Archivos modificados

1. **`src/controllers/partner/profileController.js`:**
   - Removido `import Swal from 'sweetalert2'`.
   - Se mantiene el servicio `ChecklistVehiculoService` y la inicialización del canvas para firma electrónica del receptor.

2. **`src/controllers/partner/vehiculosCrudController.js`:**
   - Removido `import Swal from 'sweetalert2'`.
   - Exportada función nominal `vehiculosCrudController` y export default.

3. **`src/controllers/partner/vehiculoDetalleController.js`:**
   - Removido `import Swal from 'sweetalert2'`.
   - Exportada función nominal `vehiculoDetalleController` y export default.

4. **`src/controllers/partner/checklistSalidaFormController.js`:**
   - Removido `import Swal from 'sweetalert2'`.
   - Exportada función nominal `checklistSalidaFormController` y export default.

5. **`src/controllers/partner/checklistsCrudController.js`:**
   - Removido `import Swal from 'sweetalert2'`.
   - Exportada función nominal `checklistsCrudController` y export default.

6. **`src/router/routes.js`:**
   - Estandarizados los imports a exportaciones nombradas (`{ vehiculosCrudController, vehiculoDetalleController, checklistSalidaFormController, checklistsCrudController }`).
   - Mapeo directo de `controller: vehiculosCrudController` respetando el contrato con `router.js`.

7. **`src/services/storageService.js`:**
   - Corregida la llave de cierre faltante en el método previo `uploadReembolsoEvidencia`.
   - Integrados métodos limpios `uploadVehiculoFoto` y `uploadVehiculoFirma`.

---

## 5. Pruebas y verificación de estabilidad

### 5.1. Verificación estática y de evaluación de módulos (Node.js)
Se ejecutó una prueba de importación dinámica directa en entorno Node:
- `profileController.js`: **OK**
- `vehiculosCrudController.js`: **OK**
- `vehiculoDetalleController.js`: **OK**
- `checklistSalidaFormController.js`: **OK**
- `checklistsCrudController.js`: **OK**

### 5.2. Compilación de producción (`npm run build`)
Ejecutado `npm run build` con Vite v8.0.12 y Rolldown:
- **Resultado:** Código de salida 0 (`Exit code 0`).
- **Módulos transformados:** 150 módulos transformados sin errores.
- **Artefactos generados:**
  - `dist/index.html` (6.18 kB)
  - `dist/assets/index-BFIOSSWo.css` (385.87 kB)
  - `dist/assets/index-JIS1KFD7.js` (1,672.73 kB)

---

## 6. Riesgos y verificaciones en vivo pendientes

1. **Pruebas en navegador:**
   - Acceder con sesión de colaborador a `/partner/profile` y verificar la pestaña "Vehículos" y apertura del canvas de firma.
   - Acceder a `/partner/vehiculos` y validar el listado y modal de alta.
   - Acceder a `/partner/checklist-salida` y comprobar la apertura de cámara y estampado de marca de agua con GPS.
2. **Restricción de despliegue:**
   - Conforme a la regla de oro de `AGENTS.md`, no se ha ejecutado `firebase deploy` ni se han modificado credenciales ni reglas remotas de producción.
