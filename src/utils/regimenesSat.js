/* ========================================
   REGÍMENES FISCALES SAT
   Mapeo de regímenes a códigos numéricos
   ======================================== */

export const REGIMENES_SAT = {
    // Personas Morales
    '601': {
        codigo: '601',
        nombre: 'General de Ley Personas Morales',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Régimen General de Ley para Personas Morales'
    },
    '603': {
        codigo: '603',
        nombre: 'Personas Morales con Fines no Lucrativos',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Personas Morales con Fines no Lucrativos'
    },
    '620': {
        codigo: '620',
        nombre: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos'
    },
    '622': {
        codigo: '622',
        nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'
    },
    '623': {
        codigo: '623',
        nombre: 'Opcional para Grupos de Sociedades',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Opcional para Grupos de Sociedades'
    },
    '624': {
        codigo: '624',
        nombre: 'Coordinados',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Coordinados'
    },
    '602': {
        codigo: '602',
        nombre: 'Régimen Simplificado de Confianza (RESICO) para Personas Morales',
        personaFisica: false,
        personaMoral: true,
        descripcion: 'Régimen Simplificado de Confianza para Personas Morales'
    },

    // Personas Físicas
    '605': {
        codigo: '605',
        nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios'
    },
    '606': {
        codigo: '606',
        nombre: 'Arrendamiento',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Arrendamiento'
    },
    '607': {
        codigo: '607',
        nombre: 'Régimen de Enajenación o Adquisición de Bienes',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Régimen de Enajenación o Adquisición de Bienes'
    },
    '608': {
        codigo: '608',
        nombre: 'Demás ingresos',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Demás ingresos'
    },
    '610': {
        codigo: '610',
        nombre: 'Residentes en el Extranjero sin Establecimiento Permanente en México',
        personaFisica: true,
        personaMoral: true,
        descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México'
    },
    '611': {
        codigo: '611',
        nombre: 'Ingresos por Dividendos (socios y accionistas)',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Ingresos por Dividendos (socios y accionistas)'
    },
    '612': {
        codigo: '612',
        nombre: 'Personas Físicas con Actividades Empresariales y Profesionales',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales'
    },
    '614': {
        codigo: '614',
        nombre: 'Ingresos por intereses',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Ingresos por intereses'
    },
    '615': {
        codigo: '615',
        nombre: 'Régimen de los ingresos por obtención de premios',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Régimen de los ingresos por obtención de premios'
    },
    '616': {
        codigo: '616',
        nombre: 'Sin obligaciones fiscales',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Sin obligaciones fiscales'
    },
    '621': {
        codigo: '621',
        nombre: 'Incorporación Fiscal',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Incorporación Fiscal'
    },
    '625': {
        codigo: '625',
        nombre: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'
    },
    '626': {
        codigo: '626',
        nombre: 'Régimen Simplificado de Confianza (RESICO) para Personas Físicas',
        personaFisica: true,
        personaMoral: false,
        descripcion: 'Régimen Simplificado de Confianza para Personas Físicas'
    }
};

/**
 * Busca un régimen por nombre (case-insensitive)
 * @param {string} nombreRegimen - Nombre del régimen a buscar
 * @returns {Object|null} - Objeto del régimen o null si no se encuentra
 */
export function buscarRegimenPorNombre(nombreRegimen) {
    if (!nombreRegimen) return null;
    
    const nombreLower = nombreRegimen.toLowerCase().trim();
    
    // Buscar coincidencia exacta
    for (const [codigo, regimen] of Object.entries(REGIMENES_SAT)) {
        if (regimen.nombre.toLowerCase() === nombreLower) {
            return { ...regimen, codigo };
        }
    }
    
    // Buscar coincidencia parcial
    for (const [codigo, regimen] of Object.entries(REGIMENES_SAT)) {
        const nombreReg = regimen.nombre.toLowerCase();
        if (nombreReg.includes(nombreLower) || nombreLower.includes(nombreReg)) {
            return { ...regimen, codigo };
        }
    }
    
    return null;
}

/**
 * Obtiene el código de un régimen por nombre
 * @param {string} nombreRegimen - Nombre del régimen
 * @returns {string|null} - Código del régimen o null
 */
export function obtenerCodigoRegimen(nombreRegimen) {
    const regimen = buscarRegimenPorNombre(nombreRegimen);
    return regimen ? regimen.codigo : null;
}

/**
 * Obtiene todos los regímenes para select
 * @param {string} tipo - 'fisica', 'moral', o 'todos'
 * @returns {Array} - Array de regímenes formateados para select
 */
export function getRegimenesForSelect(tipo = 'todos') {
    const regimenes = [];
    
    for (const [codigo, regimen] of Object.entries(REGIMENES_SAT)) {
        if (tipo === 'fisica' && !regimen.personaFisica) continue;
        if (tipo === 'moral' && !regimen.personaMoral) continue;
        
        regimenes.push({
            codigo: codigo,
            nombre: regimen.nombre,
            label: `${codigo} - ${regimen.nombre}`
        });
    }
    
    // Ordenar por código
    regimenes.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return regimenes;
}

/**
 * Obtiene el tipo de persona (Física/Moral) de un régimen
 * @param {string} nombreRegimen - Nombre del régimen
 * @returns {string|null} - 'fisica', 'moral', o null
 */
export function getTipoPersonaFromRegimen(nombreRegimen) {
    const regimen = buscarRegimenPorNombre(nombreRegimen);
    if (!regimen) return null;
    
    if (regimen.personaFisica && regimen.personaMoral) return 'ambos';
    if (regimen.personaFisica) return 'fisica';
    if (regimen.personaMoral) return 'moral';
    return null;
}

export default {
    REGIMENES_SAT,
    buscarRegimenPorNombre,
    obtenerCodigoRegimen,
    getRegimenesForSelect,
    getTipoPersonaFromRegimen
};