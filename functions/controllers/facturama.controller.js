const facturama = require("../services/facturama.service");
const admin = require('firebase-admin');

// Obtener Storage de Firebase
const storage = admin.storage();
const bucket = storage.bucket();

exports.obtenerClientes = async (req, res) => {

    try {

        const clientes = await facturama.obtenerClientes();

        console.log("CLIENTES RECIBIDOS:");
        console.log(JSON.stringify(clientes, null, 2));

        return res.status(200).json(clientes);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.crearCliente = async (req, res) => {

    try {

        console.log("====================================");
        console.log("BODY RECIBIDO");
        console.log(JSON.stringify(req.body, null, 2));

        const cliente = await facturama.crearCliente(req.body);

        console.log("CLIENTE CREADO:");
        console.log(JSON.stringify(cliente, null, 2));

        return res.status(201).json(cliente);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.crearFactura = async (req, res) => {

    try {

        console.log("========== FACTURA RECIBIDA ==========");
        console.log(JSON.stringify(req.body, null, 2));

        // =====================================================
        // 1. TIMBRAR FACTURA EN FACTURAMA
        // =====================================================

        const respuesta = await facturama.crearFactura(req.body);

        console.log("========== RESPUESTA FACTURAMA ==========");
        console.log(JSON.stringify(respuesta, null, 2));

        const facturamaId = respuesta.Id || respuesta.id;

        if (!facturamaId) {

            return res.status(500).json({
                success: false,
                message: "Facturama no devolvió el ID de la factura"
            });

        }

        console.log(`📄 Factura timbrada con ID: ${facturamaId}`);

        // =====================================================
        // 2. OBTENER PDF Y XML (YA DECODIFICADOS)
        // =====================================================

        console.log("📥 Descargando PDF y XML desde Facturama...");

        const [pdfBuffer, xmlString] = await Promise.all([
            facturama.obtenerPDFFactura(facturamaId),
            facturama.obtenerXMLFactura(facturamaId)
        ]);

        console.log(
            `✅ PDF obtenido: ${pdfBuffer.length} bytes`
        );

        console.log(
            `✅ XML obtenido: ${xmlString.length} caracteres`
        );

        // =====================================================
        // 3. VALIDAR PDF
        // =====================================================

        // Verificar que sea un PDF válido
        const pdfHeader = pdfBuffer
            .slice(0, 5)
            .toString("ascii");

        console.log("PDF HEADER:", pdfHeader);

        if (pdfHeader !== "%PDF-") {

            // Mostrar los primeros bytes para depuración
            console.log("Primeros 20 bytes (hex):", 
                pdfBuffer.slice(0, 20).toString('hex')
            );
            
            console.log("Primeros 20 bytes (ascii):", 
                pdfBuffer.slice(0, 20).toString('ascii')
            );

            throw new Error(
                `El contenido recibido no es un PDF válido. Header: ${pdfHeader}`
            );

        }

        // =====================================================
        // 4. VALIDAR XML
        // =====================================================

        if (
            !xmlString.includes("<?xml") &&
            !xmlString.includes("<cfdi:")
        ) {

            console.log("Primeros 200 caracteres del XML:", 
                xmlString.substring(0, 200)
            );

            throw new Error(
                "El contenido recibido no parece ser un XML válido"
            );

        }

        // =====================================================
        // 5. RUTAS DE STORAGE
        // =====================================================

        const timestamp = Date.now();
        const folder = `facturas/${facturamaId}`;
        const pdfFileName = `factura_${facturamaId}_${timestamp}.pdf`;
        const xmlFileName = `factura_${facturamaId}_${timestamp}.xml`;
        const pdfPath = `${folder}/${pdfFileName}`;
        const xmlPath = `${folder}/${xmlFileName}`;

        console.log("📁 PDF PATH:", pdfPath);
        console.log("📁 XML PATH:", xmlPath);

        // =====================================================
        // 6. GUARDAR PDF EN STORAGE
        // =====================================================

        // 🔥 IMPORTANTE: Guardar el buffer DIRECTAMENTE
        // No convertir a string, no codificar, solo guardar el buffer
        const pdfFile = bucket.file(pdfPath);
        
        await pdfFile.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                contentDisposition: `inline; filename="${pdfFileName}"`,
                metadata: {
                    facturamaId: facturamaId,
                    fechaTimbrado: new Date().toISOString(),
                    tipo: 'pdf'
                }
            },
            // 🔥 Asegurar que se guarda como binario
            resumable: false,
            validation: false
        });

        console.log(`✅ PDF guardado en Storage: ${pdfPath}`);
        console.log(`📦 Tamaño del PDF guardado: ${pdfBuffer.length} bytes`);

        // =====================================================
        // 7. GUARDAR XML EN STORAGE
        // =====================================================

        // Convertir XML a Buffer
        const xmlBuffer = Buffer.from(xmlString, 'utf8');
        const xmlFile = bucket.file(xmlPath);
        
        await xmlFile.save(xmlBuffer, {
            metadata: {
                contentType: 'application/xml',
                contentDisposition: `inline; filename="${xmlFileName}"`,
                metadata: {
                    facturamaId: facturamaId,
                    fechaTimbrado: new Date().toISOString(),
                    tipo: 'xml'
                }
            },
            resumable: false,
            validation: false
        });

        console.log(`✅ XML guardado en Storage: ${xmlPath}`);
        console.log(`📦 Tamaño del XML guardado: ${xmlBuffer.length} bytes`);

        // =====================================================
        // 8. HACER PÚBLICOS LOS ARCHIVOS
        // =====================================================

        await pdfFile.makePublic();
        await xmlFile.makePublic();

        console.log("✅ Archivos hechos públicos");

        // =====================================================
        // 9. GENERAR URLS
        // =====================================================

        const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;
        const xmlUrl = `https://storage.googleapis.com/${bucket.name}/${xmlPath}`;

        console.log("====================================");
        console.log("📄 ARCHIVOS GENERADOS");
        console.log("PDF URL:", pdfUrl);
        console.log("XML URL:", xmlUrl);
        console.log("====================================");

        // =====================================================
        // 10. RESPUESTA
        // =====================================================

        return res.status(201).json({

            success: true,

            facturamaId: facturamaId,

            timbrado: respuesta,

            pdfUrl: pdfUrl,

            xmlUrl: xmlUrl,

            pdfPath: pdfPath,

            xmlPath: xmlPath,

            pdfSize: pdfBuffer.length,

            xmlSize: xmlBuffer.length,

            archivosGuardados: true,

            mensaje:
                "Factura timbrada y archivos guardados correctamente"

        });

    } catch (error) {

        console.error(
            "========== ERROR CREAR FACTURA =========="
        );

        console.error(error);

        if (error.response) {

            console.error(
                "STATUS:",
                error.response.status
            );

            console.error(
                "DATA:",
                JSON.stringify(error.response.data, null, 2)
            );

            return res.status(
                error.response.status
            ).json({

                success: false,

                message:
                    "Error al procesar la factura",

                error:
                    error.response.data

            });

        }

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.validarCliente = async (req, res) => {

    try {

        console.log("========== VALIDAR CLIENTE ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const respuesta = await facturama.validarCliente(req.body);

        console.log("========== RESPUESTA ==========");
        console.log(JSON.stringify(respuesta, null, 2));

        return res.status(200).json(respuesta);

    } catch (error) {

        console.error("========== ERROR ==========");

        if (error.response) {

            console.error(JSON.stringify(error.response.data, null, 2));

            return res.status(error.response.status).json(error.response.data);

        }

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.obtenerPDFFactura = async (req, res) => {

    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el ID de la factura"
            });
        }

        console.log("========== OBTENER PDF FACTURA ==========");
        console.log("ID Factura:", id);

        const pdfBuffer = await facturama.obtenerPDFFactura(id);

        console.log("========== PDF OBTENIDO ==========");
        console.log("Tamaño:", pdfBuffer.length, "bytes");

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=factura_${id}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        return res.status(200).send(pdfBuffer);

    } catch (error) {

        console.error("========== ERROR OBTENER PDF ==========");

        if (error.response) {

            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);

            return res.status(error.response.status).json({
                success: false,
                message: "Error al obtener el PDF de Facturama",
                details: error.response.data
            });

        }

        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.obtenerXMLFactura = async (req, res) => {

    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el ID de la factura"
            });
        }

        console.log("========== OBTENER XML FACTURA ==========");
        console.log("ID Factura:", id);

        const xmlString = await facturama.obtenerXMLFactura(id);

        console.log("========== XML OBTENIDO ==========");
        console.log("Tamaño:", xmlString.length, "caracteres");

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=factura_${id}.xml`);
        res.setHeader('Content-Length', xmlString.length);
        
        return res.status(200).send(xmlString);

    } catch (error) {

        console.error("========== ERROR OBTENER XML ==========");

        if (error.response) {

            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);

            return res.status(error.response.status).json({
                success: false,
                message: "Error al obtener el XML de Facturama",
                details: error.response.data
            });

        }

        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};