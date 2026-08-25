const admin = require('firebase-admin');

const storage = admin.storage();
const bucket = storage.bucket();

/**
 * Verifica si un archivo existe en Storage y obtiene su URL
 */
exports.verificarArchivo = async (req, res) => {
    try {
        const { path } = req.query;
        
        if (!path) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el parámetro 'path'"
            });
        }

        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: "El archivo no existe en Storage"
            });
        }

        // Obtener metadatos
        const [metadata] = await file.getMetadata();
        
        // Verificar si es público
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2027'
        });

        return res.status(200).json({
            success: true,
            exists: true,
            path: path,
            metadata: metadata,
            url: url,
            publicUrl: `https://storage.googleapis.com/${bucket.name}/${path}`
        });

    } catch (error) {
        console.error("❌ Error verificando archivo:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Obtiene la URL de un archivo en Storage
 */
exports.obtenerUrlArchivo = async (req, res) => {
    try {
        const { path } = req.query;
        
        if (!path) {
            return res.status(400).json({
                success: false,
                message: "Se requiere el parámetro 'path'"
            });
        }

        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: "El archivo no existe en Storage"
            });
        }

        // Generar URL pública
        const url = `https://storage.googleapis.com/${bucket.name}/${path}`;

        return res.status(200).json({
            success: true,
            url: url,
            path: path
        });

    } catch (error) {
        console.error("❌ Error obteniendo URL:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};