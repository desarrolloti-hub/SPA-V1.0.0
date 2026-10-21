/* ========================================
   STORAGE REPOSITORY
   Manejo de archivos en Firebase Storage
   ======================================== */

import { 
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from '../config/firebaseConfig.js';

export class StorageRepository {

    /**
     * Sube una imagen y retorna { url, path }
     * @param {File} file - Archivo a subir
     * @param {string} folder - Carpeta destino (ej: 'catalogos/abc123')
     * @param {string} fileName - Nombre del archivo (ej: 'portada.jpg')
     */
    async uploadImage(file, folder, fileName) {
        try {
            // Validar tipo
            if (!file.type.startsWith('image/')) {
                throw new Error('El archivo debe ser una imagen');
            }

            // Validar tamaño (5MB máximo)
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                throw new Error('La imagen no puede superar 5MB');
            }

            // Generar path único
            const ext = file.name.split('.').pop() || 'jpg';
            const finalName = `${fileName}_${Date.now()}.${ext}`;
            const path = `${folder}/${finalName}`;

            const storageRef = ref(storage, path);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            console.log('✅ Imagen subida:', path);
            return { url, path };
        } catch (error) {
            console.error('❌ Error subiendo imagen:', error);
            throw new Error('Error al subir la imagen: ' + error.message);
        }
    }

    /**
     * Elimina una imagen por su path
     */
    async deleteImage(path) {
        if (!path) return;
        try {
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
            console.log('✅ Imagen eliminada:', path);
        } catch (error) {
            // Si no existe, no es crítico
            if (error.code === 'storage/object-not-found') {
                console.warn('⚠️ Imagen no encontrada:', path);
                return;
            }
            console.error('❌ Error eliminando imagen:', error);
        }
    }
}

export default StorageRepository;