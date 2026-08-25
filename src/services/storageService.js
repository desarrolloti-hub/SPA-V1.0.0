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
}

export default StorageService;