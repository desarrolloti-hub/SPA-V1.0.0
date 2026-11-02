# Arquitectura de Complementos de Pago (REP 2.0) y Módulo Cuentas por Cobrar

**Proyecto:** Fénix RSI Enterprise (`SPA-V1.0.0`)  
**Módulo:** Finanzas y Facturación Electrónica SAT CFDI 4.0  
**Fecha de Implementación:** Octubre 2026  
**Estatus:** Implementado y Verificado  

---

## 1. Resumen Ejecutivo

Este documento detalla la arquitectura técnica, el modelo de datos, las colecciones de Firestore conectadas y los flujos de integración implementados para la emisión de **Complementos de Pago (Recibo Electrónico de Pago - REP 2.0 / CFDI 4.0)** y la gestión integral de la cartera en el nuevo módulo de **Cuentas por Cobrar**.

El sistema permite:
1. Identificar y clasificar automáticamente todas las facturas emitidas bajo el método de pago **PPD** (*Pago en Parcialidades o Diferido*).
2. Mantener en tiempo real la trazabilidad financiera de cada comprobante: **Total Facturado**, **Total Pagado**, **Saldo Insoluto** y **Número Consecutivo de Parcialidad**.
3. Registrar y timbrar oficialmente pagos parciales o totales ante el SAT mediante la API de Facturama y Cloud Functions.
4. Generar representaciones impresas en PDF con el **idéntico formato y diseño gráfico corporativo institucional** utilizado en las facturas ordinarias (incluyendo tablas navy/oro, desglose proporcional de IVA 16%, sellos CSD y vector QR del SAT).
5. Descargar tanto los comprobantes XML como PDF oficiales emitidos.

---

## 2. Colecciones de Firestore Conectadas

Para soportar este requerimiento sin comprometer la integridad transaccional ni el rendimiento de consultas, se conectaron y estructuraron las siguientes colecciones:

```
[ Firestore Database ]
  │
  ├── 📁 facturas / {facturaId}
  │     └── [Documento principal de la Factura Original PPD]
  │           ├── saldoTotal: number
  │           ├── totalPagado: number
  │           ├── saldoInsoluto: number
  │           ├── estadoPago: "pendiente" | "parcial" | "pagada"
  │           ├── numeroParcialidades: number
  │           └── complementosPago: array<{ id, parcialidad, monto, fecha, uuid }>
  │
  ├── 📁 complementos_pago / {complementoId}
  │     └── [Documentos individuales de cada Complemento REP 2.0 emitido]
  │           ├── folio: number (consecutivo)
  │           ├── facturaId: string (referencia a la factura origen)
  │           ├── uuidFacturaPadre: string (UUID del CFDI origen timbrado)
  │           ├── numeroParcialidad: number (1, 2, 3...)
  │           ├── saldoAnterior: number
  │           ├── monto: number
  │           ├── saldoInsoluto: number
  │           ├── formaPago: "01" | "02" | "03" | "04" | "28"...
  │           ├── emisor: { rfc, razonSocial, regimenFiscal }
  │           ├── receptor: { rfc, razonSocial, domicilioFiscal, regimenFiscal, usoCFDI: "CP01" }
  │           ├── concepto: { claveProdServ: "84111506", claveUnidad: "ACT", ... }
  │           ├── facturamaId: string
  │           ├── timbrado: boolean
  │           ├── uuid: string (Folio Fiscal SAT)
  │           ├── sello: string
  │           ├── selloSat: string
  │           ├── noCertificado: string
  │           ├── noCertificadoSat: string
  │           ├── fechaTimbrado: string
  │           ├── qrCodeUrl: string
  │           ├── pdfUrl: string
  │           ├── pdfPath: string
  │           ├── xmlUrl: string
  │           └── xmlPath: string
  │
  └── 📁 contadores / complementos_pago
        └── [Contador atómico transaccional para folios secuenciales REP]
              ├── count: number
              └── updatedAt: string
```

### 2.1. Detalle de Conexiones por Colección

#### A. Colección `facturas`
- **Rol:** Almacena el comprobante fiscal origen (CFDI de tipo Ingreso).
- **Actualización Atómica:** Al confirmarse un complemento de pago, la factura origen se actualiza de manera transaccional:
  - `totalPagado = totalPagado + nuevoAbono`
  - `saldoInsoluto = Math.max(0, saldoAnterior - nuevoAbono)`
  - `numeroParcialidades = numeroParcialidades + 1`
  - `estadoPago = saldoInsoluto <= 0.01 ? 'pagada' : 'parcial'`
  - `complementosPago = arrayUnion({ complementoId, numeroParcialidad, monto, fecha, uuid })`

#### B. Colección `complementos_pago`
- **Rol:** Repositorio histórico oficial de todos los abonos certificados ante el SAT.
- **Acceso:** Gestionada a través de `ComplementoPagoRepository` (heredando de `BaseRepository` con caché TTL en memoria).
- **Consultas Optimizadas:**
  - Consulta por factura: `where('facturaId', '==', facturaId)` ordenada cronológicamente.
  - Búsqueda por cliente, folio o UUID fiscal.

#### C. Colección `contadores` (Documento `complementos_pago`)
- **Rol:** Garantiza la asignación atómica de folios consecutivos (`REP-0001`, `REP-0002`...) sin condiciones de carrera, utilizando `runTransaction(db, ...)`.

---

## 3. Almacenamiento en Firebase Storage

Los comprobantes oficiales generados se persisten en Firebase Storage respetando las siguientes rutas:

- **Archivos XML Timbrados:**  
  `facturas/{facturamaId}.xml` o `complementos_pago/{complementoId}.xml`
- **Archivos PDF Certificados (Representación Impresa):**  
  `facturas/{facturaNumero}_REP{parcialidad}.pdf` o `complementos_pago/{complementoId}.pdf`

Las URLs públicas de descarga (`downloadURL`) y rutas de bucket (`path`) se guardan directamente en el documento de Firestore correspondiente.

---

## 4. Comunicación con Facturama (Cloud Functions)

Para la emisión del **REP 2.0 (CFDI 4.0)**, se reutiliza el endpoint proxy seguro de Cloud Functions:
`POST https://us-central1-rsienterprise.cloudfunctions.net/crearFactura`

### Estructura del Payload Enviado a Facturama:

```json
{
  "CfdiType": "P",
  "ExpeditionPlace": "29000",
  "Receiver": {
    "Rfc": "RFC_RECEPTOR",
    "Name": "RAZON_SOCIAL_RECEPTOR",
    "FiscalRegime": "601",
    "TaxZipCode": "29000",
    "CfdiUse": "CP01"
  },
  "Items": [
    {
      "ProductCode": "84111506",
      "Quantity": 1,
      "UnitCode": "ACT",
      "Description": "Pago",
      "UnitPrice": 0.00,
      "Subtotal": 0.00,
      "Discount": 0.00,
      "Taxes": [],
      "Total": 0.00
    }
  ],
  "Complemento": {
    "Payments": [
      {
        "Date": "2026-10-26T18:00:00",
        "PaymentForm": "03",
        "Currency": "MXN",
        "Amount": 5800.00,
        "RelatedDocuments": [
          {
            "Uuid": "UUID-FACTURA-ORIGINAL-PADRE",
            "Currency": "MXN",
            "PaymentMethod": "PPD",
            "PartialityNumber": 1,
            "PreviousBalanceAmount": 11600.00,
            "AmountPaid": 5800.00,
            "ImpSaldoInsoluto": 5800.00,
            "TaxObject": "02",
            "Taxes": [
              {
                "Base": 5000.00,
                "Total": 800.00,
                "Tax": "002",
                "Rate": 0.16,
                "IsRetention": false
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 5. Arquitectura por Capas en el Frontend (MVC / Repository)

Se aplicó estrictamente la separación de responsabilidades y las reglas de `AGENTS.md`:

```
[ Vista: public/pages/partner/cuentasPorCobrar.html ]
                    │
                    ▼
[ Controlador: src/controllers/partner/cuentasPorCobrarController.js ]
                    │
                    ▼
[ Modelo: src/models/complementoPagoModel.js & facturaModel.js ]
                    │
                    ▼
[ Servicio: src/services/complementoPagoService.js ]
                    │
                    ▼
[ Repositorio: src/repositories/complementoPagoRepository.js ]
                    │
                    ▼
[ Firestore SDK / Firebase Storage / Facturama Cloud Function ]
```

### Componentes Creados y Modificados:

1. **`src/models/complementoPagoModel.js`:**
   - Define el esquema formal del REP 2.0.
   - Realiza el cálculo desglosado de base gravable e IVA 16% proporcional al abono.
   - Valida coherencia matemática entre Saldo Anterior, Monto Pagado y Saldo Insoluto.

2. **`src/models/facturaModel.js`:**
   - Ampliado con propiedades de control de cartera: `saldoTotal`, `totalPagado`, `saldoInsoluto`, `estadoPago`, `numeroParcialidades`, y `complementosPago`.

3. **`src/repositories/complementoPagoRepository.js`:**
   - Hereda de `BaseRepository`.
   - Implementa transacciones atómicas de asignación de folios consecutivos.
   - Consultas filtradas por factura y por cliente.

4. **`src/services/complementoPagoService.js`:**
   - Orquesta la obtención de facturas PPD con saldo en tiempo real.
   - Construye el payload SAT para Facturama.
   - Actualiza concurrentemente la factura padre en Firestore.
   - Gestiona la generación y descarga de comprobantes oficiales (PDF y XML).

5. **`src/utils/pdfGenerator.js` & `src/utils/facturaPdfGenerator.js`:**
   - Función `generarPDFComplementoPago`: Construye el documento PDF con jsPDF y autoTable.
   - Mantiene la **idéntica identidad corporativa**: paleta `#001f3f` (Navy) y `#f59e0b` (Dorado), tipografías, encabezados con logotipo, desglose de parcialidad, saldos y código QR vectorial oficial del SAT.

6. **`public/pages/partner/cuentasPorCobrar.html` & `src/css/pages/partner/cuentasPorCobrar.css`:**
   - Tarjetas KPI globales: *Total por Cobrar (Saldo Insoluto)*, *Facturas Sin Pagos*, *En Parcialidades*, *Liquidadas*.
   - Pestañas de estado rápido (*Todas*, *Pendientes*, *En Parcialidades*, *Liquidadas*).
   - Buscador universal por cliente, RFC, folio o UUID.
   - Modal interactivo de **Registro de Pago** con cálculo y vista previa de saldo resultante en tiempo real.
   - Modal de **Historial de Parcialidades** con barra de progreso porcentual y descarga directa de PDF/XML por parcialidad.

7. **`src/controllers/partner/cuentasPorCobrarController.js`:**
   - Manejo completo de eventos, alertas SweetAlert2, validaciones previas y actualización dinámica del DOM sin llamadas directas a Firestore.

8. **Navegación y Rutas (`routes.js`, `navbarPartner.html`, `facturasCrud.html`):**
   - Nueva ruta `/partner/cuentasPorCobrar` integrada bajo el menú **Finanzas**.
   - Acceso directo y badges de saldo en la tabla general de facturas (`facturasCrudController.js`).

---

## 6. Verificación y Cumplimiento de Reglas

- **Compilación Vite:** `npm run build` ejecutado exitosamente con código de salida `0`.
- **Cero Credenciales:** No se expusieron llaves ni tokens en el cliente ni en los documentos.
- **Sin Despliegues Forzados:** No se ejecutó `firebase deploy` respetando las restricciones de `AGENTS.md`.
