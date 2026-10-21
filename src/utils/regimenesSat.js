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

// ========================================
// CATÁLOGO OFICIAL SAT CFDI 4.0 - USOS DE CFDI (c_UsoCFDI)
// ========================================
export const USOS_CFDI = {
    'G01': {
        clave: 'G01',
        descripcion: 'Adquisición de mercancías',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'G02': {
        clave: 'G02',
        descripcion: 'Devoluciones, descuentos o bonificaciones',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'G03': {
        clave: 'G03',
        descripcion: 'Gastos en general',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I01': {
        clave: 'I01',
        descripcion: 'Construcciones',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I02': {
        clave: 'I02',
        descripcion: 'Mobiliario y equipo de oficina por inversiones',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I03': {
        clave: 'I03',
        descripcion: 'Equipo de transporte',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I04': {
        clave: 'I04',
        descripcion: 'Equipo de computo y accesorios',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I05': {
        clave: 'I05',
        descripcion: 'Dados, troqueles, moldes, matrices y herramental',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I06': {
        clave: 'I06',
        descripcion: 'Comunicaciones telefónicas',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I07': {
        clave: 'I07',
        descripcion: 'Comunicaciones satelitales',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'I08': {
        clave: 'I08',
        descripcion: 'Otra maquinaria y equipo',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '606', '612', '620', '621', '622', '623', '624', '625', '626']
    },
    'D01': {
        clave: 'D01',
        descripcion: 'Honorarios médicos, dentales y gastos hospitalarios',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D02': {
        clave: 'D02',
        descripcion: 'Gastos médicos por incapacidad o discapacidad',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D03': {
        clave: 'D03',
        descripcion: 'Gastos funerales',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D04': {
        clave: 'D04',
        descripcion: 'Donativos',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D05': {
        clave: 'D05',
        descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D06': {
        clave: 'D06',
        descripcion: 'Aportaciones voluntarias al SAR',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D07': {
        clave: 'D07',
        descripcion: 'Primas por seguros de gastos médicos',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D08': {
        clave: 'D08',
        descripcion: 'Gastos de transportación escolar obligatoria',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D09': {
        clave: 'D09',
        descripcion: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'D10': {
        clave: 'D10',
        descripcion: 'Pagos por servicios educativos (colegiaturas)',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605', '606', '608', '611', '612', '614', '615', '621', '625', '626']
    },
    'S01': {
        clave: 'S01',
        descripcion: 'Sin efectos fiscales',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '620', '621', '622', '623', '624', '625', '626']
    },
    'CP01': {
        clave: 'CP01',
        descripcion: 'Pagos',
        personaFisica: true,
        personaMoral: true,
        regimenes: ['601', '603', '605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '620', '621', '622', '623', '624', '625', '626']
    },
    'CN01': {
        clave: 'CN01',
        descripcion: 'Nómina',
        personaFisica: true,
        personaMoral: false,
        regimenes: ['605']
    }
};

// ========================================
// CATÁLOGO OFICIAL SAT CFDI 4.0 - MÉTODOS DE PAGO (c_MetodoPago)
// ========================================
export const METODOS_PAGO = {
    'PUE': {
        clave: 'PUE',
        descripcion: 'Pago en una sola exhibición',
        label: 'PUE — Pago en una sola exhibición'
    },
    'PPD': {
        clave: 'PPD',
        descripcion: 'Pago en parcialidades o diferido',
        label: 'PPD — Pago en parcialidades o diferido'
    }
};

// ========================================
// CATÁLOGO OFICIAL SAT CFDI 4.0 - FORMAS DE PAGO (c_FormaPago)
// ========================================
export const FORMAS_PAGO = {
    '01': { clave: '01', descripcion: 'Efectivo', bancarizado: false },
    '02': { clave: '02', descripcion: 'Cheque nominativo', bancarizado: true },
    '03': { clave: '03', descripcion: 'Transferencia electrónica de fondos', bancarizado: true },
    '04': { clave: '04', descripcion: 'Tarjeta de crédito', bancarizado: true },
    '05': { clave: '05', descripcion: 'Monedero electrónico', bancarizado: true },
    '06': { clave: '06', descripcion: 'Dinero electrónico', bancarizado: true },
    '08': { clave: '08', descripcion: 'Vales de despensa', bancarizado: false },
    '12': { clave: '12', descripcion: 'Dación en pago', bancarizado: false },
    '13': { clave: '13', descripcion: 'Pago por subrogación', bancarizado: false },
    '14': { clave: '14', descripcion: 'Pago por consignación', bancarizado: false },
    '15': { clave: '15', descripcion: 'Condonación', bancarizado: false },
    '17': { clave: '17', descripcion: 'Compensación', bancarizado: false },
    '23': { clave: '23', descripcion: 'Novación', bancarizado: false },
    '24': { clave: '24', descripcion: 'Confusión', bancarizado: false },
    '25': { clave: '25', descripcion: 'Remisión de deuda', bancarizado: false },
    '26': { clave: '26', descripcion: 'Prescripción o caducidad', bancarizado: false },
    '27': { clave: '27', descripcion: 'A satisfacción del acreedor', bancarizado: false },
    '28': { clave: '28', descripcion: 'Tarjeta de débito', bancarizado: true },
    '29': { clave: '29', descripcion: 'Tarjeta de servicios', bancarizado: true },
    '30': { clave: '30', descripcion: 'Aplicación de anticipos', bancarizado: false },
    '31': { clave: '31', descripcion: 'Intermediario pagos', bancarizado: false },
    '99': { clave: '99', descripcion: 'Por definir', bancarizado: false }
};

/**
 * Obtiene la información y descripción completa de un Uso de CFDI
 * @param {string} clave - Clave de uso (ej. 'G03')
 * @returns {Object|null}
 */
export function obtenerUsoCFDI(clave) {
    if (!clave) return null;
    const c = String(clave).trim().toUpperCase();
    const item = USOS_CFDI[c];
    if (!item) return null;
    return {
        ...item,
        label: `${item.clave} — ${item.descripcion}`
    };
}

/**
 * Obtiene la información y descripción completa de una Forma de Pago
 * @param {string} clave - Clave de forma de pago (ej. '03')
 * @returns {Object|null}
 */
export function obtenerFormaPago(clave) {
    if (!clave) return null;
    const c = String(clave).trim();
    const clavePad = c.length === 1 ? `0${c}` : c;
    const item = FORMAS_PAGO[clavePad] || FORMAS_PAGO[c];
    if (!item) return null;
    return {
        ...item,
        label: `${item.clave} — ${item.descripcion}`
    };
}

/**
 * Obtiene la información y descripción completa de un Método de Pago
 * @param {string} clave - Clave de método de pago (ej. 'PUE', 'PPD')
 * @returns {Object|null}
 */
export function obtenerMetodoPago(clave) {
    if (!clave) return null;
    const c = String(clave).trim().toUpperCase();
    const item = METODOS_PAGO[c];
    if (!item) return null;
    return {
        ...item,
        label: item.label || `${item.clave} — ${item.descripcion}`
    };
}

/**
 * Valida la compatibilidad de un Uso de CFDI con el tipo de persona y régimen fiscal del receptor
 * conforme a las reglas del SAT CFDI 4.0.
 * @param {string} usoClave - Clave del uso de CFDI (ej. 'G03')
 * @param {string} regimenCodigo - Clave del régimen del receptor (ej. '601')
 * @param {string} [rfcReceptor] - RFC del receptor
 * @returns {{ compatible: boolean, error?: string }}
 */
export function validarCompatibilidadUsoCFDI(usoClave, regimenCodigo, rfcReceptor = '') {
    if (!usoClave) {
        return { compatible: false, error: 'El Uso de CFDI es requerido' };
    }

    const uso = USOS_CFDI[String(usoClave).trim().toUpperCase()];
    if (!uso) {
        return { compatible: false, error: `Clave de Uso de CFDI "${usoClave}" no existe en el catálogo oficial` };
    }

    const rfcLimpio = String(rfcReceptor || '').trim().toUpperCase();
    const esGenerico = rfcLimpio === 'XAXX010101000' || rfcLimpio === 'XEXX010101000';
    const esMoral = !esGenerico && rfcLimpio.length === 12;
    const esFisica = !esGenerico && rfcLimpio.length === 13;

    // Validación por tipo de persona
    if (esMoral && !uso.personaMoral) {
        return {
            compatible: false,
            error: `El uso "${uso.clave} — ${uso.descripcion}" no es aplicable para Personas Morales`
        };
    }
    if (esFisica && !uso.personaFisica) {
        return {
            compatible: false,
            error: `El uso "${uso.clave} — ${uso.descripcion}" no es aplicable para Personas Físicas`
        };
    }

    // Validación por régimen fiscal
    const regLimpio = String(regimenCodigo || '').trim();
    if (regLimpio && uso.regimenes && Array.isArray(uso.regimenes)) {
        if (!uso.regimenes.includes(regLimpio)) {
            return {
                compatible: false,
                error: `El uso "${uso.clave} — ${uso.descripcion}" no es compatible con el régimen fiscal ${regLimpio}`
            };
        }
    }

    return { compatible: true };
}

/**
 * Obtiene la lista de Usos de CFDI compatibles con un régimen y/o tipo de persona
 * @param {string} [regimenCodigo] - Clave del régimen fiscal
 * @param {string} [rfcReceptor] - RFC del receptor
 * @returns {Array<{ clave: string, descripcion: string, label: string }>}
 */
export function getUsosCFDICompatibles(regimenCodigo = '', rfcReceptor = '') {
    const rfcLimpio = String(rfcReceptor || '').trim().toUpperCase();
    const regLimpio = String(regimenCodigo || '').trim();
    const esGenerico = rfcLimpio === 'XAXX010101000' || rfcLimpio === 'XEXX010101000';
    const esMoral = !esGenerico && rfcLimpio.length === 12;
    const esFisica = !esGenerico && rfcLimpio.length === 13;

    const resultado = [];

    for (const [clave, uso] of Object.entries(USOS_CFDI)) {
        if (esMoral && !uso.personaMoral) continue;
        if (esFisica && !uso.personaFisica) continue;

        if (regLimpio && uso.regimenes && Array.isArray(uso.regimenes)) {
            if (!uso.regimenes.includes(regLimpio)) continue;
        }

        resultado.push({
            clave: uso.clave,
            descripcion: uso.descripcion,
            label: `${uso.clave} — ${uso.descripcion}`
        });
    }

    // Si por falta de datos el filtro quedó vacío, retornar todos los ordenados
    if (resultado.length === 0) {
        return Object.values(USOS_CFDI).map(u => ({
            clave: u.clave,
            descripcion: u.descripcion,
            label: `${u.clave} — ${u.descripcion}`
        }));
    }

    return resultado;
}

export default {
    REGIMENES_SAT,
    USOS_CFDI,
    METODOS_PAGO,
    FORMAS_PAGO,
    buscarRegimenPorNombre,
    obtenerCodigoRegimen,
    getRegimenesForSelect,
    getTipoPersonaFromRegimen,
    obtenerUsoCFDI,
    obtenerFormaPago,
    obtenerMetodoPago,
    validarCompatibilidadUsoCFDI,
    getUsosCFDICompatibles
};