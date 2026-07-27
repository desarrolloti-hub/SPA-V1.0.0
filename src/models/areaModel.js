/* ========================================
   AREA MODEL
   Estructura de datos para Áreas, Subáreas y Módulos
   ======================================== */

/**
 * Modelo de Área
 * @typedef {Object} Area
 * @property {string} idArea - ID auto-generado del área
 * @property {string} nombreArea - Nombre del área
 * @property {Object} subareas - Mapa de subáreas
 * @property {string} modificadoPor - UID del usuario que modificó
 * @property {string} fechaModificacion - Fecha de última modificación
 * @property {string} createdAt - Fecha de creación
 */

/**
 * Modelo de Subárea
 * @typedef {Object} Subarea
 * @property {string} idsubarea - ID auto-generado de la subárea
 * @property {string} nombreSubarea - Nombre de la subárea
 * @property {Object} modulos - Mapa de módulos con permisos
 * @property {string} modificadoPor - UID del usuario que modificó
 * @property {string} fechaModificacion - Fecha de última modificación
 */

/**
 * Modelo de Módulo con Permisos
 * @typedef {Object} ModuloPermisos
 * @property {string} nombreModulo - Nombre del módulo
 * @property {Object} permisos - Objeto con array de permisos
 * @property {string} modificadoPor - UID del usuario que modificó
 * @property {string} fechaModificacion - Fecha de última modificación
 */

export class AreaModel {
    
    /**
     * Crea un nuevo objeto Área
     * @param {Object} data - Datos del área
     * @param {string} uid - UID del usuario
     * @returns {Object} - Objeto Área formateado
     */
    static createArea(data, uid) {
        const now = new Date().toISOString();
        
        return {
            idArea: this._generateId(),
            nombreArea: data.nombreArea?.trim() || '',
            subareas: data.subareas || {},
            modificadoPor: uid || '',
            fechaModificacion: now,
            createdAt: now
        };
    }

    /**
     * Crea una nueva Subárea
     * @param {Object} data - Datos de la subárea
     * @param {string} uid - UID del usuario
     * @returns {Object} - Objeto Subárea formateado
     */
    static createSubarea(data, uid) {
        const now = new Date().toISOString();
        
        return {
            idsubarea: data.idsubarea || this._generateId(),
            nombreSubarea: data.nombreSubarea?.trim() || '',
            modulos: data.modulos || {},
            modificadoPor: uid || '',
            fechaModificacion: now
        };
    }

    /**
     * Crea un nuevo Módulo con Permisos
     * @param {Object} data - Datos del módulo
     * @param {string} uid - UID del usuario
     * @returns {Object} - Objeto Módulo formateado
     */
    static createModulo(data, uid) {
        const now = new Date().toISOString();
        
        return {
            nombreModulo: data.nombreModulo?.trim() || '',
            permisos: this.createPermisos(data.permisos || []),
            modificadoPor: uid || '',
            fechaModificacion: now
        };
    }

    /**
     * Crea un objeto de Permisos
     * @param {string[]} permisos - Array de permisos
     * @returns {Object} - Objeto Permisos formateado
     */
    static createPermisos(permisos = []) {
        return {
            permiso: permisos
        };
    }

    /**
     * Convierte una subárea del frontend al formato de Firestore
     * @param {Object} subareaData - Datos de la subárea del frontend
     * @param {string} uid - UID del usuario
     * @returns {Object} - Subárea formateada para Firestore
     */
    static formatSubareaForFirestore(subareaData, uid) {
        const now = new Date().toISOString();
        const modulos = {};

        // Procesar cada módulo
        if (subareaData.modulos && Array.isArray(subareaData.modulos)) {
            subareaData.modulos.forEach(modulo => {
                modulos[modulo.nombreModulo] = {
                    nombreModulo: modulo.nombreModulo,
                    permisos: this.createPermisos(modulo.permisos || []),
                    modificadoPor: uid,
                    fechaModificacion: now
                };
            });
        }

        return {
            idsubarea: subareaData.idsubarea || this._generateId(),
            nombreSubarea: subareaData.nombreSubarea?.trim() || '',
            modulos: modulos,
            modificadoPor: uid,
            fechaModificacion: now
        };
    }

    /**
     * Formatea un área completa para enviar a Firestore
     * @param {Object} areaData - Datos del área del frontend
     * @param {string} uid - UID del usuario
     * @returns {Object} - Área formateada para Firestore
     */
    static formatAreaForFirestore(areaData, uid) {
        const now = new Date().toISOString();
        const subareas = {};

        // Procesar cada subárea
        if (areaData.subareas && Array.isArray(areaData.subareas)) {
            areaData.subareas.forEach(subarea => {
                const formattedSubarea = this.formatSubareaForFirestore(subarea, uid);
                subareas[formattedSubarea.idsubarea] = formattedSubarea;
            });
        }

        return {
            idArea: this._generateId(),
            nombreArea: areaData.nombreArea?.trim() || '',
            subareas: subareas,
            modificadoPor: uid,
            fechaModificacion: now,
            createdAt: now
        };
    }

    /**
     * Genera un ID único
     * @returns {string} - ID generado
     */
    static _generateId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    /**
     * Valida que un objeto sea un Área válida
     * @param {Object} area - Objeto a validar
     * @returns {boolean} - true si es válido
     */
    static isValidArea(area) {
        if (!area || typeof area !== 'object') return false;
        if (!area.nombreArea || typeof area.nombreArea !== 'string') return false;
        if (area.nombreArea.trim().length < 2) return false;
        return true;
    }

    /**
     * Valida que un objeto sea una Subárea válida
     * @param {Object} subarea - Objeto a validar
     * @returns {boolean} - true si es válido
     */
    static isValidSubarea(subarea) {
        if (!subarea || typeof subarea !== 'object') return false;
        if (!subarea.nombreSubarea || typeof subarea.nombreSubarea !== 'string') return false;
        if (subarea.nombreSubarea.trim().length < 2) return false;
        if (!subarea.modulos || !Array.isArray(subarea.modulos) || subarea.modulos.length === 0) return false;
        return true;
    }

    /**
     * Valida que un objeto sea un Módulo válido
     * @param {Object} modulo - Objeto a validar
     * @returns {boolean} - true si es válido
     */
    static isValidModulo(modulo) {
        if (!modulo || typeof modulo !== 'object') return false;
        if (!modulo.nombreModulo || typeof modulo.nombreModulo !== 'string') return false;
        if (modulo.nombreModulo.trim().length < 2) return false;
        if (!modulo.permisos || !Array.isArray(modulo.permisos) || modulo.permisos.length === 0) return false;
        return true;
    }
}

export default AreaModel;