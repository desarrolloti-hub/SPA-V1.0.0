const facturama = require("../services/facturama.service");
const admin = require('firebase-admin');
const crypto = require('crypto');

// Obtener Storage de Firebase de forma segura y diferida
function getBucket() {
    try {
        const b = admin.storage().bucket();
        if (b && b.name) return b;
    } catch (e) {}
    return admin.storage().bucket(process.env.STORAGE_BUCKET || 'rsienterprise.firebasestorage.app');
}

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
        // 2. OBTENER PDF Y XML (YA DECODIFICADOS) Y GUARDAR EN STORAGE
        // =====================================================
        let pdfUrl = null;
        let xmlUrl = null;
        let pdfPath = null;
        let xmlPath = null;
        let pdfBuffer = null;
        let xmlBuffer = null;
        let xmlString = null;
        let archivosGuardados = false;

        try {
            console.log("📥 Descargando PDF y XML desde Facturama...");
            const bucket = getBucket();

            const [fetchedPdfBuffer, fetchedXmlString] = await Promise.all([
                facturama.obtenerPDFFactura(facturamaId),
                facturama.obtenerXMLFactura(facturamaId)
            ]);

            pdfBuffer = fetchedPdfBuffer;
            xmlString = fetchedXmlString;

            // Verificar header PDF
            const pdfHeader = pdfBuffer.slice(0, 5).toString("ascii");
            if (pdfHeader !== "%PDF-") {
                console.warn(`⚠️ Header PDF no estándar: ${pdfHeader}`);
            }

            // Validar XML
            if (!xmlString.includes("<?xml") && !xmlString.includes("<cfdi:")) {
                console.warn("⚠️ Contenido recibido puede no ser un XML de comprobante estándar");
            }

            // Rutas de Storage
            const timestamp = Date.now();
            const folder = `facturas/${facturamaId}`;
            const pdfFileName = `factura_${facturamaId}_${timestamp}.pdf`;
            const xmlFileName = `factura_${facturamaId}_${timestamp}.xml`;
            pdfPath = `${folder}/${pdfFileName}`;
            xmlPath = `${folder}/${xmlFileName}`;

            const pdfToken = crypto.randomUUID();
            const xmlToken = crypto.randomUUID();

            // Guardar PDF en Storage con token de Firebase
            const pdfFile = bucket.file(pdfPath);
            await pdfFile.save(pdfBuffer, {
                metadata: {
                    contentType: 'application/pdf',
                    contentDisposition: `inline; filename="${pdfFileName}"`,
                    metadata: {
                        facturamaId: facturamaId,
                        fechaTimbrado: new Date().toISOString(),
                        tipo: 'pdf',
                        firebaseStorageDownloadTokens: pdfToken
                    }
                },
                resumable: false,
                validation: false
            });

            // Guardar XML en Storage con token de Firebase
            xmlBuffer = Buffer.from(xmlString, 'utf8');
            const xmlFile = bucket.file(xmlPath);
            await xmlFile.save(xmlBuffer, {
                metadata: {
                    contentType: 'application/xml',
                    contentDisposition: `inline; filename="${xmlFileName}"`,
                    metadata: {
                        facturamaId: facturamaId,
                        fechaTimbrado: new Date().toISOString(),
                        tipo: 'xml',
                        firebaseStorageDownloadTokens: xmlToken
                    }
                },
                resumable: false,
                validation: false
            });

            // Intentar hacer públicos según configuración de acceso (ignorar si UBLA está activo)
            try {
                await pdfFile.makePublic();
                await xmlFile.makePublic();
            } catch (permError) {
                console.warn("ℹ️ makePublic omitido o restringido por política:", permError.message);
            }

            // URL estándar de Firebase Storage con token de descarga público y seguro
            pdfUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(pdfPath)}?alt=media&token=${pdfToken}`;
            xmlUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(xmlPath)}?alt=media&token=${xmlToken}`;
            archivosGuardados = true;

            console.log("✅ Archivos guardados en Storage correctamente con download tokens");

        } catch (storageError) {
            console.error("⚠️ Factura timbrada exitosamente pero falló la persistencia de archivos en Storage:", storageError.message);
        }

        // =====================================================
        // 3. RESPUESTA AL CLIENTE
        // =====================================================

        const uuid = respuesta.Complement?.TaxStamp?.Uuid || 
                     respuesta.Complement?.TaxStamp?.uuid || 
                     respuesta.Uuid || 
                     respuesta.uuid || '';

        const fechaTimbrado = respuesta.Complement?.TaxStamp?.Date || 
                              respuesta.Complement?.TaxStamp?.date || 
                              respuesta.Date || 
                              new Date().toISOString();

        return res.status(201).json({
            success: true,
            facturamaId: facturamaId,
            uuid: uuid,
            fechaTimbrado: fechaTimbrado,
            timbrado: respuesta,
            pdfUrl: pdfUrl,
            xmlUrl: xmlUrl,
            xmlContent: xmlString,
            pdfPath: pdfPath,
            xmlPath: xmlPath,
            pdfSize: pdfBuffer ? pdfBuffer.length : 0,
            xmlSize: xmlBuffer ? xmlBuffer.length : 0,
            archivosGuardados: archivosGuardados,
            mensaje: archivosGuardados 
                ? "Factura timbrada y archivos guardados correctamente" 
                : "Factura timbrada exitosamente ante el SAT (archivos pendientes de sincronizar en Storage)"
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

exports.cancelarFactura = async (req, res) => {
    try {
        console.log("========== SOLICITUD DE CANCELACIÓN RECIBIDA ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const { id, motivo, folioSustitucion } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el identificador 'id' de la factura en Facturama o UUID fiscal"
            });
        }

        const motivosValidos = ['01', '02', '03', '04'];
        if (!motivo || !motivosValidos.includes(String(motivo))) {
            return res.status(400).json({
                success: false,
                message: "Se requiere un motivo válido de cancelación SAT ('01', '02', '03', '04')"
            });
        }

        if (motivo === '01' && (!folioSustitucion || String(folioSustitucion).trim() === '')) {
            return res.status(400).json({
                success: false,
                message: "Para el motivo '01' es obligatorio proporcionar el folio fiscal sustituto (folioSustitucion)"
            });
        }

        // Llamar a Facturama
        const respuesta = await facturama.cancelarFactura(id, motivo, folioSustitucion);

        console.log("========== RESPUESTA CANCELACIÓN FACTURAMA ==========");
        console.log(JSON.stringify(respuesta, null, 2));

        // Si Facturama devuelve AcuseXmlBase64, guardarlo en Storage
        let acuseXmlUrl = null;
        let acuseXmlPath = null;
        if (respuesta && respuesta.AcuseXmlBase64) {
            try {
                const bucket = getBucket();
                const acuseBuffer = Buffer.from(respuesta.AcuseXmlBase64, 'base64');
                const timestamp = Date.now();
                acuseXmlPath = `facturas/${id}/acuse_cancelacion_${timestamp}.xml`;
                const acuseFile = bucket.file(acuseXmlPath);
                await acuseFile.save(acuseBuffer, {
                    metadata: {
                        contentType: 'application/xml',
                        metadata: {
                            facturamaId: id,
                            fechaCancelacion: new Date().toISOString(),
                            tipo: 'acuse_cancelacion'
                        }
                    },
                    resumable: false,
                    validation: false
                });
                try {
                    await acuseFile.makePublic();
                } catch (e) {
                    // opcional según política del bucket
                }
                acuseXmlUrl = `https://storage.googleapis.com/${bucket.name}/${acuseXmlPath}`;
            } catch (acuseErr) {
                console.warn("⚠️ No se pudo guardar el acuse XML en Storage:", acuseErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            status: respuesta.Status || 'canceled',
            message: respuesta.Message || 'Cancelación procesada',
            uuid: respuesta.Uuid || '',
            isCancelable: respuesta.IsCancelable || '',
            requestDate: respuesta.RequestDate || new Date().toISOString(),
            acuseXmlUrl: acuseXmlUrl,
            acuseXmlPath: acuseXmlPath,
            raw: respuesta
        });

    } catch (error) {
        console.error("========== ERROR CANCELAR FACTURA ==========");
        console.error(error);

        if (error.response) {
            console.error("STATUS:", error.response.status);
            console.error("DATA:", JSON.stringify(error.response.data, null, 2));

            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.Message || error.response.data?.message || "Error al solicitar la cancelación en Facturama",
                error: error.response.data
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.consultarFactura = async (req, res) => {
    try {
        const id = req.query.id || req.params.id;
        const folio = req.query.folio;

        if (folio && !id) {
            console.log(`📄 Buscando factura por folio: ${folio}`);
            const lista = await facturama.listarFacturasEmitidas();
            const facturas = Array.isArray(lista) ? lista : (lista?.data || []);
            const encontrada = facturas.find(f => (f.Folio || f.folio) === folio);

            if (encontrada) {
                const facturaDetalle = await facturama.obtenerFactura(encontrada.Id || encontrada.id);
                return res.status(200).json({
                    success: true,
                    factura: facturaDetalle || encontrada
                });
            }

            return res.status(404).json({
                success: false,
                message: `No se encontró comprobante previo con folio ${folio}`
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el ID o Folio de la factura"
            });
        }

        const factura = await facturama.obtenerFactura(id);
        return res.status(200).json({
            success: true,
            factura: factura
        });
    } catch (error) {
        console.error("========== ERROR CONSULTAR FACTURA ==========");
        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.Message || "Error consultando factura en Facturama",
                error: error.response.data
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};