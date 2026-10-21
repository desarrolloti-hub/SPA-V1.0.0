# Módulo Ecommerce: Arquitectura, Catálogo y Área Buyer
## Proyecto: SPA-V1.0.0 — Fénix RSI Enterprise

Este documento detalla la arquitectura técnica, modelo de datos, capas MVC/Repository, seguridad y flujos de usuario implementados para el módulo de comercio electrónico de RSI Enterprise.

---

## 1. Alcance y Objetivos

El módulo de Ecommerce unifica tres dimensiones operativas en la misma Single Page Application:

1. **Administración Partner (`/ecommerce/*`):**
   - Gestión integral de familias y categorías de productos (`/ecommerce/categorias`, `/ecommerce/categoria-form`).
   - Gestión de marcas aliadas y fabricantes (`/ecommerce/marcas`, `/ecommerce/marca-form`).
   - Catálogo de productos y equipos de seguridad electrónica (`/ecommerce/productos`, `/ecommerce/producto-form`) con galería fotográfica múltiple, selección de portada principal, especificaciones, homologación fiscal CFDI 4.0 (claves SAT) y ficha técnica oficial en PDF.
2. **Catálogo Público para Visitantes (`/products` y `/productos`):**
   - Explorador de productos con buscador en tiempo real (por nombre, modelo, SKU o código SAT).
   - Filtros dinámicos por categorías y marcas.
   - Paginación e indicadores de existencia.
   - Menú desplegable público sincronizado dinámicamente en `navbarVisitor.html`.
   - Ficha interactiva de producto (`/productDetail?id=...`) con selector de imágenes en miniatura, descripción técnica, botón de descarga de ficha PDF certificada y algoritmo de recomendación de productos relacionados (misma categoría > misma marca).
3. **Área Privada del Comprador (`/buyer/*`):**
   - Autenticación híbrida: Email/Password y Google Authentication (`GoogleAuthProvider`, `signInWithPopup`).
   - Asignación estricta y segura del rol `buyer` en `usersRSI`.
   - Carrito de compras (`/buyer/cart`) y Lista de deseos (`/buyer/wishlist`) sincronizados con Firestore bajo el UID del usuario (`ecommerceCarritos/{uid}` y `ecommerceFavoritos/{uid}`) con soporte de carrito para invitados (`rsi_cart_guest`).
   - Dashboard de cliente (`/buyer/dashboard`) y perfil (`/buyer/profile`).

---

## 2. Arquitectura por Capas (Patrón MVC / Repository)

```
[ Vistas HTML: public/pages/partner/ o visitor/ o buyer/ ]
                           │
                           ▼
               [ Capa de Controladores ]
   (ecommerceProductosController, productsController, etc.)
                           │
                           ▼
                 [ Capa de Modelos ]
  (CategoriaModel, MarcaModel, EcommerceProductModel)
                           │
                           ▼
                [ Capa de Servicios ]
(CategoriaService, MarcaService, EcommerceProductService, CartService, WishlistService)
                           │
                           ▼
               [ Capa de Repositorios ]
(CategoriaRepository, MarcaRepository, EcommerceProductRepository - BaseRepository con TTL)
                           │
                           ▼
              [ Firebase Firestore & Storage ]
```

---

## 3. Estructura de Colecciones en Firestore

### A. `ecommerceCategorias`
- `id` (string auto-id)
- `nombre` (string)
- `slug` (string indexado y normalizado)
- `descripcion` (string | null)
- `imagen` (string URL de Storage)
- `imagenPath` (string ruta en bucket `ecommerce/categorias/...`)
- `orden` (number)
- `activo` (boolean)
- `productosCount` (number, contador referencial sincronizado)
- `createdAt`, `updatedAt` (Timestamp)

### B. `ecommerceMarcas`
- `id` (string auto-id)
- `nombre` (string)
- `slug` (string indexado y normalizado)
- `descripcion` (string | null)
- `logo` (string URL de Storage)
- `logoPath` (string ruta en bucket `ecommerce/marcas/...`)
- `activo` (boolean)
- `productosCount` (number)
- `createdAt`, `updatedAt` (Timestamp)

### C. `ecommerceProductos`
- `id` (string auto-id)
- `nombre` (string)
- `slug` (string único)
- `descripcion` (string)
- `caracteristicas` (array de strings)
- `modelo` (string)
- `codigoInterno` (string SKU)
- `categoriaId` (string), `categoriaNombre` (string)
- `marcaId` (string), `marcaNombre` (string)
- `precio` (number, MXN)
- `stock` (number)
- `estado` (`'borrador' | 'publicado' | 'desactivado'`)
- `destacado` (boolean)
- `claveSat`, `descripcionSat`, `claveUnidadSat` (strings de catálogo fiscal)
- `imagenes` (array de objetos `{ url, path, principal: boolean }`)
- `imagenPrincipal` (string URL)
- `fichaTecnicaPdf` (`{ url, path, nombre, tamano }` | null)
- `createdAt`, `updatedAt` (Timestamp)

### D. `ecommerceCarritos/{uid}`
- `items`: array de objetos `{ productoId, nombre, modelo, precio, imagen, cantidad, agregadoAt }`
- `updatedAt` (Timestamp)

### E. `ecommerceFavoritos/{uid}`
- `items`: array de objetos `{ productoId, nombre, modelo, precio, imagen, categoriaNombre, agregadoAt }`
- `updatedAt` (Timestamp)

---

## 4. Almacenamiento en Firebase Storage

Para dar cumplimiento estricto a la prohibición de almacenar binarios o Base64 en Firestore, `StorageService.js` incorpora los métodos especializados:

- `uploadCategoriaImage(file, categoriaId)` $\rightarrow$ `ecommerce/categorias/{id}_{timestamp}.{ext}`
- `deleteCategoriaImage(path)`
- `uploadMarcaLogo(file, marcaId)` $\rightarrow$ `ecommerce/marcas/{id}_{timestamp}.{ext}`
- `deleteMarcaLogo(path)`
- `uploadProductoImage(file, productoId, index)` $\rightarrow$ `ecommerce/productos/{id}_{index}_{timestamp}.{ext}`
- `deleteProductoImage(path)`
- `uploadFichaTecnica(pdfFile, productoId)` $\rightarrow$ `ecommerce/fichas/{id}_{timestamp}.pdf`
- `deleteFichaTecnica(path)`

---

## 5. Control de Acceso y Guardias de Navegación (`router.js`)

1. **Rutas protegidas administrativas (`/partner/*`, `/hr/*`, `/ecommerce/*`):**
   - Requieren sesión activa.
   - Si el usuario tiene rol `buyer`, se bloquea el acceso de inmediato y se le redirige a `/buyer/dashboard`.
2. **Rutas protegidas del cliente (`/buyer/*`):**
   - Requieren sesión activa (comprador, colaborador o administrador).
   - Si el visitante no está autenticado, se le redirige a `/login?returnUrl=/buyer/...`.
3. **Redirección inteligente en `/login`:**
   - Un `buyer` autenticado que ingresa a `/login` es redirigido automáticamente a su dashboard (`/buyer/dashboard`) o a la URL previa solicitada.
   - Un colaborador `partner` es evaluado por asistencia diaria (`resolvePartnerLandingRoute`).
   - Un `admin` va directo al dashboard operativo.

---

## 6. Reglas de Seguridad (`firestore.rules` y `storage.rules`)

- **Firestore:**
  - `ecommerceCategorias`, `ecommerceMarcas`, `ecommerceProductos`: lectura pública (`allow read: if true;`), escritura para colaboradores y administradores (`allow write: if isAuthenticated();`).
  - `ecommerceCarritos/{userId}`, `ecommerceFavoritos/{userId}`: cada usuario solo puede leer y modificar su propio documento (`request.auth.uid == userId`).
- **Storage:**
  - `ecommerce/{allPaths=**}`: lectura pública para permitir que los navegadores carguen las imágenes y fichas técnicas (`allow read: if true;`), subida y eliminación restringida a usuarios autenticados.
