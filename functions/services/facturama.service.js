const axios = require("axios");
const config = require("../config/facturama.config");

class FacturamaService {

    constructor() {

        this.client = axios.create({
            baseURL: config.url,

            auth: {
                username: config.user,
                password: config.password
            },

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            timeout: 30000
        });

    }


    // ============================================================
    // REQUEST GENERAL
    // ============================================================

    async request(
        method,
        endpoint,
        data = null,
        responseType = "json"
    ) {

        try {

            console.log("====================================");
            console.log("FACTURAMA REQUEST");
            console.log("Método:", method);
            console.log("Endpoint:", endpoint);
            console.log("Response Type:", responseType);

            if (data) {

                console.log("Body:");

                console.log(
                    JSON.stringify(data, null, 2)
                );

            }


            const configRequest = {

                method,

                url: endpoint,

                data,

                responseType,

                timeout: 30000

            };


            // ====================================================
            // HEADERS
            // ====================================================

            configRequest.headers = {

                "Content-Type":
                    "application/json",

                "Accept":
                    responseType === "json"
                        ? "application/json"
                        : "*/*"

            };


            const response =
                await this.client(configRequest);


            console.log("====================================");
            console.log("FACTURAMA RESPONSE");

            console.log(
                "Status:",
                response.status
            );


            // ====================================================
            // RESPUESTA JSON
            // ====================================================

            if (responseType === "json") {

                console.log(
                    "Data:",
                    JSON.stringify(
                        response.data,
                        null,
                        2
                    )
                );

            }


            // ====================================================
            // RESPUESTA BUFFER
            // ====================================================

            else if (
                responseType === "arraybuffer"
            ) {

                console.log(
                    "Data: [BUFFER]"
                );

                console.log(
                    "Size:",
                    response.data.length,
                    "bytes"
                );

            }


            // ====================================================
            // RESPUESTA TEXTO
            // ====================================================

            else {

                console.log(
                    "Data: [TEXT]"
                );

                console.log(
                    "Size:",
                    response.data?.length || 0
                );

            }


            console.log("====================================");


            return response.data;


        } catch (error) {

            console.log("====================================");
            console.log("FACTURAMA ERROR");


            if (error.response) {

                console.log(
                    "Status:",
                    error.response.status
                );

                console.log(
                    "Headers:",
                    error.response.headers
                );

                console.log(
                    "Data:",
                    JSON.stringify(
                        error.response.data,
                        null,
                        2
                    )
                );

            }

            else if (error.request) {

                console.log(
                    "No hubo respuesta:",
                    error.message
                );

            }

            else {

                console.log(
                    "Error:",
                    error.message
                );

            }


            console.log("====================================");

            throw error;

        }

    }


    // ============================================================
    // CLIENTES
    // ============================================================

    async obtenerClientes() {

        return this.request(
            "GET",
            "/client"
        );

    }


    async obtenerCliente(id) {

        return this.request(
            "GET",
            `/client/${id}`
        );

    }


    async crearCliente(cliente) {

        return this.request(
            "POST",
            "/client",
            cliente
        );

    }


    async actualizarCliente(
        id,
        cliente
    ) {

        return this.request(
            "PUT",
            `/client/${id}`,
            cliente
        );

    }


    async eliminarCliente(id) {

        return this.request(
            "DELETE",
            `/client/${id}`
        );

    }


    async validarCliente(cliente) {

        return this.request(
            "POST",
            "/api/customers/validate",
            cliente
        );

    }


    // ============================================================
    // FACTURAS
    // ============================================================

    async crearFactura(factura) {

        return this.request(
            "POST",
            "/3/cfdis",
            factura
        );

    }


    // ============================================================
    // OBTENER PDF DE FACTURA
    // ============================================================

    async obtenerPDFFactura(id) {

        try {

            console.log(
                `📄 Solicitando PDF para factura: ${id}`
            );


            // ====================================================
            // IMPORTANTE
            //
            // Facturama devuelve un JSON:
            //
            // {
            //     ContentEncoding: "base64",
            //     ContentType: "pdf",
            //     ContentLength: ...,
            //     Content: "JVBERi0x..."
            // }
            //
            // Por eso solicitamos JSON.
            // ====================================================

            const respuesta =
                await this.request(
                    "GET",
                    `/cfdi/pdf/issued/${id}`,
                    null,
                    "json"
                );


            console.log(
                "📦 Respuesta PDF de Facturama:"
            );

            console.log({

                ContentEncoding:
                    respuesta?.ContentEncoding,

                ContentType:
                    respuesta?.ContentType,

                ContentLength:
                    respuesta?.ContentLength,

                ContentSize:
                    respuesta?.Content?.length || 0

            });


            // ====================================================
            // VALIDAR RESPUESTA
            // ====================================================

            if (!respuesta) {

                throw new Error(
                    "Facturama no devolvió respuesta para el PDF"
                );

            }


            if (!respuesta.Content) {

                throw new Error(
                    "Facturama no devolvió contenido PDF"
                );

            }


            // ====================================================
            // CONVERTIR BASE64 → BUFFER
            // ====================================================

            let pdfBuffer;


            if (
                respuesta.ContentEncoding &&
                respuesta.ContentEncoding.toLowerCase() === "base64"
            ) {

                console.log(
                    "🔄 Decodificando PDF Base64..."
                );


                pdfBuffer =
                    Buffer.from(
                        respuesta.Content,
                        "base64"
                    );

            }

            else {

                console.log(
                    "ℹ️ El PDF no indica Base64, intentando convertir directamente..."
                );


                if (
                    Buffer.isBuffer(
                        respuesta.Content
                    )
                ) {

                    pdfBuffer =
                        respuesta.Content;

                }

                else {

                    pdfBuffer =
                        Buffer.from(
                            respuesta.Content
                        );

                }

            }


            // ====================================================
            // VALIDAR BUFFER
            // ====================================================

            if (
                !pdfBuffer ||
                pdfBuffer.length === 0
            ) {

                throw new Error(
                    "El PDF decodificado está vacío"
                );

            }


            console.log(
                `✅ PDF decodificado: ${pdfBuffer.length} bytes`
            );


            // ====================================================
            // VALIDAR HEADER PDF
            // ====================================================

            const pdfHeader =
                pdfBuffer
                    .slice(0, 5)
                    .toString("ascii");


            console.log(
                "PDF HEADER:",
                pdfHeader
            );


            if (
                pdfHeader !== "%PDF-"
            ) {

                console.warn(
                    "⚠️ El contenido recibido no parece ser un PDF válido"
                );

                console.warn(
                    "Primeros bytes:",
                    pdfBuffer
                        .slice(0, 20)
                        .toString("hex")
                );

            }


            console.log(
                "✅ PDF listo para Storage"
            );


            return pdfBuffer;


        } catch (error) {

            console.error(
                `❌ Error obteniendo PDF de factura ${id}:`,
                error.message
            );

            throw error;

        }

    }


    // ============================================================
    // OBTENER XML DE FACTURA
    // ============================================================

    async obtenerXMLFactura(id) {

        try {

            console.log(
                `📄 Solicitando XML para factura: ${id}`
            );


            // ====================================================
            // IMPORTANTE
            //
            // Facturama devuelve JSON con Content Base64.
            // ====================================================

            const respuesta =
                await this.request(
                    "GET",
                    `/cfdi/xml/issued/${id}`,
                    null,
                    "json"
                );


            console.log(
                "📦 Respuesta XML de Facturama:"
            );

            console.log({

                ContentEncoding:
                    respuesta?.ContentEncoding,

                ContentType:
                    respuesta?.ContentType,

                ContentLength:
                    respuesta?.ContentLength,

                ContentSize:
                    respuesta?.Content?.length || 0

            });


            // ====================================================
            // VALIDAR RESPUESTA
            // ====================================================

            if (!respuesta) {

                throw new Error(
                    "Facturama no devolvió respuesta para el XML"
                );

            }


            if (!respuesta.Content) {

                throw new Error(
                    "Facturama no devolvió contenido XML"
                );

            }


            // ====================================================
            // CONVERTIR BASE64 → XML
            // ====================================================

            let xmlString;


            if (
                respuesta.ContentEncoding &&
                respuesta.ContentEncoding.toLowerCase() === "base64"
            ) {

                console.log(
                    "🔄 Decodificando XML Base64..."
                );


                xmlString =
                    Buffer
                        .from(
                            respuesta.Content,
                            "base64"
                        )
                        .toString("utf8");

            }

            else {

                console.log(
                    "ℹ️ El XML no indica Base64, utilizando contenido directamente..."
                );


                xmlString =
                    Buffer.isBuffer(
                        respuesta.Content
                    )

                        ? respuesta.Content.toString(
                            "utf8"
                        )

                        : String(
                            respuesta.Content
                        );

            }


            // ====================================================
            // VALIDAR XML
            // ====================================================

            if (
                !xmlString ||
                xmlString.length === 0
            ) {

                throw new Error(
                    "El XML decodificado está vacío"
                );

            }


            console.log(
                `✅ XML decodificado: ${xmlString.length} caracteres`
            );


            console.log(
                "XML HEADER:",
                xmlString.substring(
                    0,
                    150
                )
            );


            // ====================================================
            // VALIDAR QUE REALMENTE SEA XML
            // ====================================================

            const esXML =
                xmlString.includes(
                    "<?xml"
                ) ||
                xmlString.includes(
                    "<cfdi:"
                ) ||
                xmlString.includes(
                    "<Comprobante"
                );


            if (!esXML) {

                console.warn(
                    "⚠️ El contenido recibido no parece ser un XML válido"
                );

            }


            console.log(
                "✅ XML listo para Storage"
            );


            return xmlString;


        } catch (error) {

            console.error(
                `❌ Error obteniendo XML de factura ${id}:`,
                error.message
            );

            throw error;

        }

    }


    // ============================================================
    // CANCELAR FACTURA
    // ============================================================

    async cancelarFactura(
        id,
        motivo,
        folioSustitucion = null
    ) {

        try {

            console.log(
                `🚫 Cancelando factura: ${id}`
            );


            const data = {

                Motivo: motivo

            };


            if (
                folioSustitucion
            ) {

                data.FolioSustitucion =
                    folioSustitucion;

            }


            return await this.request(
                "DELETE",
                `/3/cfdis/${id}`,
                data
            );


        } catch (error) {

            console.error(
                `❌ Error cancelando factura ${id}:`,
                error.message
            );

            throw error;

        }

    }


    // ============================================================
    // DESCARGAR PDF
    // ============================================================

    async descargarPDF(id) {

        return this.obtenerPDFFactura(
            id
        );

    }


    // ============================================================
    // DESCARGAR XML
    // ============================================================

    async descargarXML(id) {

        return this.obtenerXMLFactura(
            id
        );

    }

}


// ================================================================
// EXPORTAR SINGLETON
// ================================================================

module.exports = new FacturamaService();