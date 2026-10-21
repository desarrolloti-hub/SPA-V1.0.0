/* ========================================
   STORAGE SERVICE
   Servicio para gestionar archivos en Firebase Storage
   ======================================== */

import { 
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from '../config/firebaseConfig.js';

// ✅ Importar getMetadata directamente de firebase/storage
import { getMetadata } from 'firebase/storage';

export class StorageService {
    
    constructor() {
        this.storage = storage;
    }

    /**
     * Sube un archivo PDF a Firebase Storage
     * @param {Blob|File} pdfBlob - El blob del PDF
     * @param {string} cotizacionNumero - Número de cotización para nombrar el archivo
     * @param {string} tipo - Tipo de archivo (cotizacion, factura, etc.)
     * @returns {Promise<{success: boolean, url: string, error: string}>}
     */
    async uploadPDF(pdfBlob, cotizacionNumero, tipo = 'cotizaciones') {
        try {
            // Crear nombre de archivo
            const fileName = `${tipo}/${cotizacionNumero}.pdf`;
            const storageRef = ref(this.storage, fileName);
            
            // Subir archivo
            const snapshot = await uploadBytes(storageRef, pdfBlob, {
                contentType: 'application/pdf'
            });
            
            // Obtener URL de descarga
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            console.log(`✅ PDF subido exitosamente: ${fileName}`);
            console.log(`🔗 URL: ${downloadURL}`);
            
            return {
                success: true,
                url: downloadURL,
                fileName: fileName,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo PDF a Storage:', error);
            return {
                success: false,
                url: null,
                fileName: null,
                error: error.message || 'Error al subir el archivo'
            };
        }
    }

    /**
     * Elimina un PDF de Firebase Storage
     * @param {string} cotizacionNumero - Número de cotización para localizar el archivo
     * @param {string} tipo - Tipo de archivo (cotizaciones, facturas, etc.)
     * @returns {Promise<{success: boolean, error: string}>}
     */
    async deletePDF(cotizacionNumero, tipo = 'cotizaciones') {
        try {
            const fileName = `${tipo}/${cotizacionNumero}.pdf`;
            const storageRef = ref(this.storage, fileName);
            
            // ✅ Verificar si existe usando getMetadata
            try {
                await getMetadata(storageRef);
            } catch (error) {
                // Si no existe (error 404), no hay nada que eliminar
                if (error.code === 'storage/object-not-found') {
                    console.log(`ℹ️ El archivo ${fileName} no existe en Storage`);
                    return {
                        success: true,
                        error: null
                    };
                }
                throw error;
            }
            
            // Eliminar archivo
            await deleteObject(storageRef);
            
            console.log(`✅ PDF eliminado: ${fileName}`);
            return {
                success: true,
                error: null
            };
        } catch (error) {
            console.error('❌ Error eliminando PDF de Storage:', error);
            return {
                success: false,
                error: error.message || 'Error al eliminar el archivo'
            };
        }
    }

    /**
     * Elimina todos los PDFs antiguos de una cotización (por si hay múltiples versiones)
     * @param {string} cotizacionNumero - Número de cotización
     * @param {string} tipo - Tipo de archivo
     * @returns {Promise<{success: boolean, error: string}>}
     */
    async deleteAllPDFs(cotizacionNumero, tipo = 'cotizaciones') {
        try {
            // ✅ Eliminar el archivo específico (si existe)
            const result = await this.deletePDF(cotizacionNumero, tipo);
            return result;
        } catch (error) {
            console.error('❌ Error eliminando PDFs:', error);
            return {
                success: false,
                error: error.message || 'Error al eliminar los archivos'
            };
        }
    }

    /**
     * Obtiene la URL de un PDF existente
     * @param {string} cotizacionNumero - Número de cotización
     * @param {string} tipo - Tipo de archivo
     * @returns {Promise<{success: boolean, url: string, error: string}>}
     */
    async getPDFURL(cotizacionNumero, tipo = 'cotizaciones') {
        try {
            const fileName = `${tipo}/${cotizacionNumero}.pdf`;
            const storageRef = ref(this.storage, fileName);
            
            const url = await getDownloadURL(storageRef);
            
            return {
                success: true,
                url: url,
                error: null
            };
        } catch (error) {
            console.log(`ℹ️ No se encontró el archivo ${cotizacionNumero}.pdf`);
            return {
                success: false,
                url: null,
                error: error.message
            };
        }
    }

    /**
     * Sube un archivo XML fiscal (CFDI 4.0) a Firebase Storage
     * @param {string|Blob} xmlData - Contenido XML como string o Blob
     * @param {string} identificador - Folio o identificador para nombrar el archivo
     * @param {string} tipo - Carpeta de destino (ej: 'facturas', 'facturas/cfdi')
     * @returns {Promise<{success: boolean, url: string|null, fileName: string|null, error: string|null}>}
     */
    async uploadXML(xmlData, identificador, tipo = 'facturas') {
        try {
            const fileName = `${tipo}/${identificador}.xml`;
            const storageRef = ref(this.storage, fileName);

            let blob;
            if (xmlData instanceof Blob) {
                blob = xmlData;
            } else {
                blob = new Blob([xmlData], { type: 'application/xml;charset=utf-8' });
            }

            const snapshot = await uploadBytes(storageRef, blob, {
                contentType: 'application/xml'
            });

            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ XML subido exitosamente a Storage: ${fileName}`);
            console.log(`🔗 URL: ${downloadURL}`);

            return {
                success: true,
                url: downloadURL,
                fileName: fileName,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo XML a Storage:', error);
            return {
                success: false,
                url: null,
                fileName: null,
                error: error.message || 'Error al subir el archivo XML'
            };
        }
    }

    /**
     * Obtiene la URL de un XML existente en Firebase Storage
     * @param {string} identificador - Folio o identificador
     * @param {string} tipo - Carpeta de destino
     * @returns {Promise<{success: boolean, url: string|null, error: string|null}>}
     */
    async getXMLURL(identificador, tipo = 'facturas') {
        try {
            const fileName = `${tipo}/${identificador}.xml`;
            const storageRef = ref(this.storage, fileName);

            const url = await getDownloadURL(storageRef);

            return {
                success: true,
                url: url,
                error: null
            };
        } catch (error) {
            console.log(`ℹ️ No se encontró el archivo ${identificador}.xml`);
            return {
                success: false,
                url: null,
                error: error.message
            };
        }
    }

    /**
     * Elimina un XML de Firebase Storage
     * @param {string} identificador - Folio o identificador
     * @param {string} tipo - Carpeta
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteXML(identificador, tipo = 'facturas') {
        try {
            const fileName = `${tipo}/${identificador}.xml`;
            const storageRef = ref(this.storage, fileName);

            try {
                await getMetadata(storageRef);
            } catch (error) {
                if (error.code === 'storage/object-not-found') {
                    return { success: true, error: null };
                }
                throw error;
            }

            await deleteObject(storageRef);
            console.log(`✅ XML eliminado: ${fileName}`);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando XML de Storage:', error);
            return {
                success: false,
                error: error.message || 'Error al eliminar el archivo XML'
            };
        }
    }

    /**
     * Sube un archivo de evidencia de justificación a Firebase Storage
     * @param {File|Blob} file - Archivo o Blob de imagen/documento
     * @param {string} fileName - Nombre del archivo destino en storage
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadEvidencia(file, fileName) {
        try {
            const filePath = `justificaciones/${fileName}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: file.type || 'application/octet-stream',
                customMetadata: {
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, file, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Evidencia subida exitosamente: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo evidencia a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la evidencia'
            };
        }
    }

    /**
     * Elimina un archivo de evidencia de Firebase Storage
     * @param {string} filePath - Ruta completa en Storage
     */
    async deleteEvidencia(filePath) {
        try {
            if (!filePath) return { success: true, error: null };
            const storageRef = ref(this.storage, filePath);
            await deleteObject(storageRef);
            return { success: true, error: null };
        } catch (error) {
            if (error.code === 'storage/object-not-found') {
                return { success: true, error: null };
            }
            console.warn('⚠️ Error eliminando evidencia de Storage:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sube una imagen de evidencia de ticket (antes, durante, despues) con marca de agua a Firebase Storage
     * @param {Blob|File} imageBlob - Imagen procesada con marca de agua
     * @param {string} ticketIdentifier - ID o código del ticket (ej. Ticket-RSI-12)
     * @param {string} etapa - 'antes' | 'durante' | 'despues'
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadTicketEvidencia(imageBlob, ticketIdentifier, etapa = 'antes') {
        try {
            const safeTicketId = String(ticketIdentifier || 'ticket').replace(/[^a-zA-Z0-9_-]/g, '_');
            const safeEtapa = ['antes', 'durante', 'despues'].includes(etapa) ? etapa : 'antes';
            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const filePath = `tickets/${safeTicketId}/${safeEtapa}/evidencia_${safeEtapa}_${uniqueSuffix}.jpg`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: imageBlob.type || 'image/jpeg',
                customMetadata: {
                    ticketId: String(ticketIdentifier || ''),
                    etapa: safeEtapa,
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, imageBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Evidencia de ticket (${safeEtapa}) subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo evidencia de ticket a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la imagen de evidencia a Storage'
            };
        }
    }

    /**
     * Sube el Reporte Fotográfico en PDF de un ticket a Firebase Storage
     * @param {Blob|File} pdfBlob - Blob del reporte PDF generado
     * @param {string} ticketIdentifier - Folio o ID del ticket (ej. Ticket-RSI-12)
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadTicketReporteFotograficoPDF(pdfBlob, ticketIdentifier) {
        try {
            const safeTicketId = String(ticketIdentifier || 'ticket').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `tickets/${safeTicketId}/Reporte_Fotografico_${safeTicketId}.pdf`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: 'application/pdf',
                customMetadata: {
                    ticketId: String(ticketIdentifier || ''),
                    tipo: 'reporte_fotografico',
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, pdfBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Reporte Fotográfico PDF subido a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo Reporte Fotográfico PDF a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir el Reporte Fotográfico PDF a Storage'
            };
        }
    }

    /**
     * Sube una evidencia fotográfica o comprobante de reembolso a Firebase Storage
     * @param {File|Blob} file - Imagen o comprobante del reembolso
     * @param {string} subcarpeta - 'evidencias' | 'comprobantes'
     * @param {string} identificador - UID del colaborador o folio del reembolso
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadReembolsoEvidencia(file, subcarpeta = 'evidencias', identificador = 'reembolso') {
        try {
            const safeFolder = subcarpeta === 'comprobantes' ? 'comprobantes' : 'evidencias';
            const safeId = String(identificador || 'rmb').replace(/[^a-zA-Z0-9_-]/g, '_');
            const ext = (file.name && file.name.includes('.'))
                ? file.name.split('.').pop().toLowerCase()
                : (file.type === 'application/pdf' ? 'pdf' : 'jpg');
            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const filePath = `reembolsos/${safeFolder}/${safeId}_${uniqueSuffix}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: file.type || 'image/jpeg',
                customMetadata: {
                    identificador: String(identificador || ''),
                    tipo: safeFolder,
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, file, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Evidencia de reembolso (${safeFolder}) subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo evidencia de reembolso a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la evidencia fotográfica a Storage'
            };
        }
    }

    /**
     * Sube una fotografía de evidencia de vehículo con marca de agua a Firebase Storage
     * @param {File|Blob} fileOrBlob - Imagen procesada
     * @param {string} vehiculoPlacas - Placas del vehículo
     * @param {string} folioSalida - Folio de la salida (ej. SAL-RSI-0001)
     * @param {string} categoria - Categoría de la foto (frente, trasera, etc.)
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadVehiculoFoto(fileOrBlob, vehiculoPlacas, folioSalida, categoria = 'evidencia') {
        try {
            const safePlacas = String(vehiculoPlacas || 'vehiculo').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            const safeFolio = String(folioSalida || 'salida').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            const safeCat = String(categoria || 'foto').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const filePath = `vehiculos/${safePlacas}/${safeFolio}/${safeCat}_${uniqueSuffix}.jpg`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: 'image/jpeg',
                customMetadata: {
                    placas: safePlacas,
                    folio: safeFolio,
                    categoria: safeCat,
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Foto de vehículo subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo foto de vehículo a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la fotografía a Storage'
            };
        }
    }

    /**
     * Sube la firma digital de aceptación de un vehículo a Firebase Storage
     * @param {Blob} firmaBlob - Blob de imagen PNG de la firma
     * @param {string} folioSalida - Folio de la salida
     * @param {string} receptorUid - UID del colaborador receptor
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadVehiculoFirma(firmaBlob, folioSalida, receptorUid) {
        try {
            const safeFolio = String(folioSalida || 'salida').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            const safeUid = String(receptorUid || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `vehiculos/firmas/${safeFolio}_firma_${safeUid}.png`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: 'image/png',
                customMetadata: {
                    folio: safeFolio,
                    receptorUid: safeUid,
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, firmaBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Firma de vehículo subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo firma digital a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la firma digital a Storage'
            };
        }
    }

    /**
     * Sube la fotografía principal del vehículo a Firebase Storage
     * @param {File|Blob} fileOrBlob - Archivo de imagen del auto
     * @param {string} placas - Placas del vehículo
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadVehiculoImagenPrincipal(fileOrBlob, placas) {
        try {
            const safePlacas = String(placas || 'vehiculo').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            const ext = (fileOrBlob.name && fileOrBlob.name.includes('.'))
                ? fileOrBlob.name.split('.').pop().toLowerCase()
                : 'jpg';
            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const filePath = `vehiculos/catalogo/${safePlacas}_principal_${uniqueSuffix}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: fileOrBlob.type || 'image/jpeg',
                customMetadata: {
                    placas: safePlacas,
                    tipo: 'foto_principal',
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Fotografía principal de vehículo subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo foto principal de vehículo a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la imagen del automóvil'
            };
        }
    }

    /**
     * Sube una imagen de diapositiva de carrusel a Firebase Storage
     * @param {File|Blob} fileOrBlob - Archivo de imagen
     * @param {string} slideId - Identificador para el nombre del archivo
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadCarruselSlideImage(fileOrBlob, slideId = 'slide') {
        try {
            const timestamp = Date.now();
            const safeId = String(slideId || 'slide').replace(/[^a-zA-Z0-9_-]/g, '_');
            const ext = fileOrBlob.name ? fileOrBlob.name.split('.').pop().toLowerCase() : 'jpg';
            const filePath = `carrusel/${safeId}_${timestamp}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: fileOrBlob.type || 'image/jpeg',
                customMetadata: {
                    slideId: safeId,
                    uploadedAt: new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            console.log(`✅ Imagen de carrusel subida a Storage: ${filePath}`);
            return {
                success: true,
                url: downloadURL,
                path: filePath,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo imagen de carrusel a Storage:', error);
            return {
                success: false,
                url: null,
                path: null,
                error: error.message || 'Error al subir la imagen del carrusel'
            };
        }
    }

    /**
     * Elimina una imagen de diapositiva de Firebase Storage
     * @param {string} filePath - Ruta completa en Storage (ej. carrusel/slide_123.jpg)
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteCarruselSlideImage(filePath) {
        if (!filePath || !filePath.startsWith('carrusel/')) {
            return { success: true, error: null };
        }
        try {
            const storageRef = ref(this.storage, filePath);
            try {
                await getMetadata(storageRef);
            } catch (error) {
                if (error.code === 'storage/object-not-found') {
                    return { success: true, error: null };
                }
                throw error;
            }
            await deleteObject(storageRef);
            console.log(`✅ Imagen de carrusel eliminada de Storage: ${filePath}`);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando imagen de carrusel de Storage:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sube imagen de categoría ecommerce a Firebase Storage
     * @param {File|Blob} fileOrBlob 
     * @param {string} categoriaId 
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadCategoriaImage(fileOrBlob, categoriaId = 'cat') {
        try {
            const timestamp = Date.now();
            const safeId = String(categoriaId || 'cat').replace(/[^a-zA-Z0-9_-]/g, '_');
            const ext = fileOrBlob.name ? fileOrBlob.name.split('.').pop().toLowerCase() : 'jpg';
            const filePath = `ecommerce/categorias/${safeId}_${timestamp}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: fileOrBlob.type || 'image/jpeg',
                customMetadata: { categoriaId: safeId, uploadedAt: new Date().toISOString() }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return { success: true, url: downloadURL, path: filePath, error: null };
        } catch (error) {
            console.error('❌ Error subiendo imagen de categoría:', error);
            return { success: false, url: null, path: null, error: error.message };
        }
    }

    /**
     * Elimina imagen de categoría de Firebase Storage
     * @param {string} filePath 
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteCategoriaImage(filePath) {
        if (!filePath || !filePath.startsWith('ecommerce/categorias/')) {
            return { success: true, error: null };
        }
        try {
            const storageRef = ref(this.storage, filePath);
            try { await getMetadata(storageRef); } catch (e) {
                if (e.code === 'storage/object-not-found') return { success: true, error: null };
                throw e;
            }
            await deleteObject(storageRef);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando imagen de categoría:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sube logo de marca ecommerce a Firebase Storage
     * @param {File|Blob} fileOrBlob 
     * @param {string} marcaId 
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadMarcaLogo(fileOrBlob, marcaId = 'marca') {
        try {
            const timestamp = Date.now();
            const safeId = String(marcaId || 'marca').replace(/[^a-zA-Z0-9_-]/g, '_');
            const ext = fileOrBlob.name ? fileOrBlob.name.split('.').pop().toLowerCase() : 'png';
            const filePath = `ecommerce/marcas/${safeId}_${timestamp}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: fileOrBlob.type || 'image/png',
                customMetadata: { marcaId: safeId, uploadedAt: new Date().toISOString() }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return { success: true, url: downloadURL, path: filePath, error: null };
        } catch (error) {
            console.error('❌ Error subiendo logo de marca:', error);
            return { success: false, url: null, path: null, error: error.message };
        }
    }

    /**
     * Elimina logo de marca de Firebase Storage
     * @param {string} filePath 
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteMarcaLogo(filePath) {
        if (!filePath || !filePath.startsWith('ecommerce/marcas/')) {
            return { success: true, error: null };
        }
        try {
            const storageRef = ref(this.storage, filePath);
            try { await getMetadata(storageRef); } catch (e) {
                if (e.code === 'storage/object-not-found') return { success: true, error: null };
                throw e;
            }
            await deleteObject(storageRef);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando logo de marca:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sube imagen de producto ecommerce a Firebase Storage
     * @param {File|Blob} fileOrBlob 
     * @param {string} productoId 
     * @param {number|string} index 
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, error: string|null}>}
     */
    async uploadProductoImage(fileOrBlob, productoId = 'prod', index = 0) {
        try {
            const timestamp = Date.now();
            const safeId = String(productoId || 'prod').replace(/[^a-zA-Z0-9_-]/g, '_');
            const ext = fileOrBlob.name ? fileOrBlob.name.split('.').pop().toLowerCase() : 'jpg';
            const filePath = `ecommerce/productos/${safeId}_${index}_${timestamp}.${ext}`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: fileOrBlob.type || 'image/jpeg',
                customMetadata: { productoId: safeId, uploadedAt: new Date().toISOString() }
            };

            const snapshot = await uploadBytes(storageRef, fileOrBlob, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return { success: true, url: downloadURL, path: filePath, error: null };
        } catch (error) {
            console.error('❌ Error subiendo imagen de producto:', error);
            return { success: false, url: null, path: null, error: error.message };
        }
    }

    /**
     * Elimina imagen de producto de Firebase Storage
     * @param {string} filePath 
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteProductoImage(filePath) {
        if (!filePath || !filePath.startsWith('ecommerce/productos/')) {
            return { success: true, error: null };
        }
        try {
            const storageRef = ref(this.storage, filePath);
            try { await getMetadata(storageRef); } catch (e) {
                if (e.code === 'storage/object-not-found') return { success: true, error: null };
                throw e;
            }
            await deleteObject(storageRef);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando imagen de producto:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sube ficha técnica en PDF a Firebase Storage
     * @param {File|Blob} pdfFile 
     * @param {string} productoId 
     * @returns {Promise<{success: boolean, url: string|null, path: string|null, nombre: string, tamano: number, error: string|null}>}
     */
    async uploadFichaTecnica(pdfFile, productoId = 'prod') {
        try {
            const timestamp = Date.now();
            const safeId = String(productoId || 'prod').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `ecommerce/fichas/${safeId}_${timestamp}.pdf`;
            const storageRef = ref(this.storage, filePath);

            const metadata = {
                contentType: 'application/pdf',
                customMetadata: { productoId: safeId, originalName: pdfFile.name || 'ficha.pdf' }
            };

            const snapshot = await uploadBytes(storageRef, pdfFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return {
                success: true,
                url: downloadURL,
                path: filePath,
                nombre: pdfFile.name || 'ficha_tecnica.pdf',
                tamano: pdfFile.size || 0,
                error: null
            };
        } catch (error) {
            console.error('❌ Error subiendo ficha técnica PDF:', error);
            return { success: false, url: null, path: null, nombre: '', tamano: 0, error: error.message };
        }
    }

    /**
     * Elimina ficha técnica en PDF de Firebase Storage
     * @param {string} filePath 
     * @returns {Promise<{success: boolean, error: string|null}>}
     */
    async deleteFichaTecnica(filePath) {
        if (!filePath || !filePath.startsWith('ecommerce/fichas/')) {
            return { success: true, error: null };
        }
        try {
            const storageRef = ref(this.storage, filePath);
            try { await getMetadata(storageRef); } catch (e) {
                if (e.code === 'storage/object-not-found') return { success: true, error: null };
                throw e;
            }
            await deleteObject(storageRef);
            return { success: true, error: null };
        } catch (error) {
            console.error('❌ Error eliminando ficha técnica:', error);
            return { success: false, error: error.message };
        }
    }
}

export default StorageService;