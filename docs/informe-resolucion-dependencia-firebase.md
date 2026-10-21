# Informe Técnico: Resolución de Dependencia `firebase` en Compilación Vite / Rolldown

- **Fecha:** 16 de octubre de 2026
- **Proyecto:** SPA-V1.0.0 — Fénix RSI Enterprise
- **Módulo / Alcance:** Configuración de dependencias (`package.json`, `package-lock.json`) y empaquetado de producción (`vite build`).
- **Referencia de Auditoría:** `[ERR-018]` en `auditoria-tecnica-spa-v1.md`

---

## 1. Descripción del Incidente

Al ejecutar el comando de compilación de producción (`npm run build` / `vite build` con Vite `v8.0.12`), el empaquetador Rolldown abortó el proceso con el siguiente error:

```text
Error: [vite]: Rolldown failed to resolve import "firebase/app" from "C:/Users/desar/Desktop/Proyectos TI-RSI/SPA-V1.0.0/src/config/firebaseConfig.js".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
`build.rolldownOptions.external`
```

---

## 2. Diagnóstico y Causa Raíz

1. **Ausencia de declaración en `package.json`:**
   El archivo `package.json` en la raíz del proyecto únicamente declaraba `"chart.js": "^4.5.1"` dentro de `dependencies` y `"vite": "^8.0.12"` en `devDependencies`. El paquete `firebase` nunca fue registrado formalmente en el manifiesto del proyecto.
2. **Resolución accidental previa desde directorio padre:**
   Según la evidencia registrada en `node_modules/.vite/deps/_metadata.json` (`"src": "../../../../../../node_modules/firebase/app/dist/esm/index.esm.js"`) y documentada previamente en el hallazgo `[ERR-018]` de `auditoria-tecnica-spa-v1.md`, las compilaciones anteriores funcionaban de manera incidental porque Node.js y Vite resolvían `firebase` (`v12.1.0`) escalando directorios hacia una carpeta `node_modules` externa (`C:\Users\desar\node_modules\firebase`).
3. **Fallo al limpiar o aislar el entorno:**
   Al no existir ya dicho directorio externo y no encontrarse `firebase` dentro del `node_modules/` local del proyecto, Rolldown no pudo resolver los submódulos importados en `src/config/firebaseConfig.js`:
   - `firebase/app`
   - `firebase/firestore`
   - `firebase/auth`
   - `firebase/storage`
   - `firebase/messaging`

---

## 3. Solución Implementada

Con autorización expresa del usuario conforme a la **Sección 9 de `AGENTS.md`**, se ejecutó la instalación local de la dependencia en la raíz del proyecto:

```bash
npm install firebase@^12.1.0
```

### Justificación Técnica
- Se fijó el rango `^12.1.0` para mantener compatibilidad exacta con la versión `12.1.0` del SDK modular de Firebase que el proyecto utilizaba previamente en su caché de pre-bundling (`.vite/deps/firebase_app.js`).
- Con ello, el repositorio queda autónomo, reproducible y listo para compilar en cualquier entorno local limpio o tubería CI/CD sin depender de paquetes globales o instalados en directorios superiores del sistema operativo.

---

## 4. Archivos Modificados

| Archivo | Cambio Realizado |
| :--- | :--- |
| `package.json` | Se agregó `"firebase": "^12.19.0"` (rango compatible `^12.1.0`) en la sección `dependencies`. |
| `package-lock.json` | Se actualizó el árbol de bloqueo de dependencias incluyendo `firebase` y sus subdependencias oficiales (`@firebase/*`). |
| `AGENTS.md` | Se documentó en la sección 4 (Firebase y backend) la obligatoriedad de mantener `firebase` declarado explícitamente en `package.json` y el historial de resolución de `[ERR-018]`. |
| `docs/informe-resolucion-dependencia-firebase.md` | Creación del presente informe técnico detallado. |

---

## 5. Verificación Técnica Local (`npm run build`)

Tras la instalación local de `firebase`, se ejecutó `npm run build` obteniendo código de salida `0` y resolviendo los 125 módulos del proyecto sin errores:

```text
> fenixrsi@0.0.0 build
> vite build

vite v8.0.12 building client environment for production...
transforming...✓ 125 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                  2.82 kB │ gzip:   1.10 kB
dist/assets/index-c3xTbaRh.css                 293.94 kB │ gzip:  39.50 kB
dist/assets/facturaPdfGenerator-DnnVUY_2.js      0.09 kB │ gzip:   0.09 kB
dist/assets/auto-Cg3eCJ32.js                   203.09 kB │ gzip:  69.60 kB
dist/assets/index-gY5EFpLM.js                1,341.37 kB │ gzip: 346.69 kB
✓ built in 1.57s
```

---

## 6. Plan de Contingencia y Reversión

En caso de requerir revertir la modificación del árbol de dependencias a su estado previo:
```bash
git checkout -- package.json package-lock.json
npm ci
```
*(Nota: Revertir este cambio volverá a impedir la compilación de `vite build` a menos que `firebase` esté presente en `node_modules`).*
