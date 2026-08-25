/* ========================================
   CLIENTE SERVICE
   Lógica de negocio para gestión de clientes
   ======================================== */

import ClienteRepository from '../repositories/clienteRepository.js';
import ClienteModel from '../models/clienteModel.js';
import { obtenerCodigoRegimen, REGIMENES_SAT } from '../utils/regimenesSAT.js';

// URL de la API de Facturama (Cloud Functions)
const FACTURAMA_API_URL = "https://us-central1-rsienterprise.cloudfunctions.net";


export class ClienteService {
    
    constructor() {
        this.repository = new ClienteRepository();
    }

    /**
     * Obtiene el UID del usuario actual desde localStorage
     */
    _getCurrentUserUid() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return null;
            const sessionData = JSON.parse(session);
            return sessionData.uid || null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    /**
     * Obtiene el nombre del usuario actual desde localStorage
     */
    _getCurrentUserName() {
        try {
            const session = localStorage.getItem('rsi_session');
            if (!session) return 'Sistema';
            const sessionData = JSON.parse(session);
            return sessionData.nombreCompleto || sessionData.displayName || sessionData.email || 'Usuario';
        } catch (error) {
            console.error('❌ Error obteniendo nombre de usuario:', error);
            return 'Sistema';
        }
    }

    /**
     * Valida los datos del cliente
     */
    validateCliente(data) {
        return ClienteModel.validate(data);
    }

    /**
     * Crea un nuevo cliente
     */
    async createCliente(data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateCliente(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const exists = await this.repository.existsClienteByRfc(data.rfc);
            if (exists) {
                throw new Error('Ya existe un cliente con ese RFC');
            }

            // ✅ Crear cliente con auditoría
            const clienteData = ClienteModel.create(data, uid, uid);
            const docId = await this.repository.createCliente(clienteData);

            return {
                success: true,
                id: docId,
                message: 'Cliente registrado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en createCliente:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los clientes
     */
    async getAllClientes() {
        try {
            return await this.repository.getAllClientes();
        } catch (error) {
            console.error('❌ Error en getAllClientes:', error);
            throw error;
        }
    }

    /**
     * Obtiene un cliente por ID
     */
    async getClienteById(clienteId) {
        try {
            return await this.repository.getClienteById(clienteId);
        } catch (error) {
            console.error('❌ Error en getClienteById:', error);
            return null;
        }
    }

    /**
     * Obtiene un cliente por RFC
     */
    async getClienteByRfc(rfc) {
        try {
            return await this.repository.getClienteByRfc(rfc);
        } catch (error) {
            console.error('❌ Error en getClienteByRfc:', error);
            return null;
        }
    }

    /**
     * ✅ Actualiza un cliente con auditoría (CORREGIDO)
     */
    async updateCliente(clienteId, data) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            const validation = this.validateCliente(data);
            if (!validation.valid) {
                throw new Error(JSON.stringify(validation.errors));
            }

            const exists = await this.repository.existsClienteByRfc(data.rfc, clienteId);
            if (exists) {
                throw new Error('Ya existe un cliente con ese RFC');
            }

            // ✅ Actualizar con auditoría - asegurar que modificadoPor se actualice
            const updateData = {
                ...data,
                modificadoPor: uid,  // ✅ Forzar actualización de modificadoPor
                updatedAt: new Date().toISOString()  // ✅ Forzar actualización de updatedAt
            };

            await this.repository.updateCliente(clienteId, updateData);

            return {
                success: true,
                message: 'Cliente actualizado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en updateCliente:', error);
            throw error;
        }
    }

    /**
     * Elimina un cliente (soft delete)
     */
    async deleteCliente(clienteId) {
        try {
            const uid = this._getCurrentUserUid();
            if (!uid) {
                throw new Error('Usuario no autenticado');
            }

            await this.repository.deleteCliente(clienteId, uid);

            return {
                success: true,
                message: 'Cliente deshabilitado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error en deleteCliente:', error);
            throw error;
        }
    }

    /**
     * Elimina permanentemente un cliente
     */
    async deleteClientePermanently(clienteId) {
        try {
            await this.repository.deleteClientePermanently(clienteId);
            return {
                success: true,
                message: 'Cliente eliminado permanentemente'
            };
        } catch (error) {
            console.error('❌ Error en deleteClientePermanently:', error);
            throw error;
        }
    }

    /**
     * ✅ Convierte los datos del cliente al formato que espera Facturama para validación
     */
    _mapClienteToFacturamaValidation(cliente) {
        return {
            Rfc: cliente.rfc || '',
            Name: cliente.razonSocial || '',
            TaxZipCode: cliente.codigoPostal || '',
            FiscalRegime: cliente.regimenCodigo || '616'
        };
    }

    /**
     * ✅ Convierte los datos del cliente al formato que espera Facturama para creación
     */
    _mapClienteToFacturamaCreate(cliente) {
        return {
            Rfc: cliente.rfc || '',
            Name: cliente.razonSocial || '',
            Email: cliente.email || '',
            CfdiUse: 'S01',
            TaxZipCode: cliente.codigoPostal || '',
            FiscalRegime: cliente.regimenCodigo || '616',
            Address: {
                Street: cliente.nombreVialidad || '',
                ExteriorNumber: cliente.numeroExterior || '',
                InteriorNumber: cliente.numeroInterior || '',
                Neighborhood: cliente.colonia || '',
                ZipCode: cliente.codigoPostal || '',
                Locality: cliente.localidad || '',
                Municipality: cliente.municipio || '',
                State: cliente.estado || '',
                Country: 'MEX'
            }
        };
    }

    /**
     * ✅ Valida un cliente contra el SAT usando Facturama
     */
    async validarClienteSAT(clienteId) {
        try {
            const cliente = await this.repository.getClienteById(clienteId);
            if (!cliente) {
                throw new Error('Cliente no encontrado');
            }

            const payload = this._mapClienteToFacturamaValidation(cliente);

            console.log('📤 Validando cliente en Facturama:', JSON.stringify(payload, null, 2));

            try {
                const response = await fetch(`${FACTURAMA_API_URL}/validarCliente`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('📥 Respuesta de validación:', JSON.stringify(data, null, 2));

                const isValid = data.success === true || data.Status === 'Válido' || data.valid === true || data.data?.Status === 'Válido';
                
                if (isValid) {
                    // ✅ Actualizar validación con auditoría
                    const uid = this._getCurrentUserUid();
                    await this.repository.validarClienteSAT(clienteId, uid);
                    return {
                        success: true,
                        message: 'Cliente validado correctamente contra el SAT',
                        data: data.data || data
                    };
                } else {
                    return {
                        success: false,
                        message: data.message || 'El RFC no es válido según el SAT',
                        data: data
                    };
                }

            } catch (fetchError) {
                console.warn('⚠️ Error conectando con Facturama:', fetchError.message);
                throw new Error('Error al conectar con el servicio de validación SAT. Intenta nuevamente.');
            }

        } catch (error) {
            console.error('❌ Error en validarClienteSAT:', error);
            throw error;
        }
    }

    /**
     * ✅ Crea un cliente en Facturama
     */
    async crearClienteFacturama(clienteId) {
        try {
            const cliente = await this.repository.getClienteById(clienteId);
            if (!cliente) {
                throw new Error('Cliente no encontrado');
            }

            const payload = this._mapClienteToFacturamaCreate(cliente);

            console.log('📤 Creando cliente en Facturama:', JSON.stringify(payload, null, 2));

            try {
                const response = await fetch(`${FACTURAMA_API_URL}/crearCliente`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('📥 Respuesta de creación:', JSON.stringify(data, null, 2));

                const facturamaId = data?.data?.Id || data?.Id || data?.id || data?.data?.id;
                const isSuccess = data.success === true || facturamaId;

                if (isSuccess && facturamaId) {
                    // ✅ Actualizar sincronización con auditoría
                    const uid = this._getCurrentUserUid();
                    await this.repository.updateCliente(clienteId, {
                        facturamaId: facturamaId.toString(),
                        sincronizadoFacturama: true,
                        fechaSincronizacion: new Date().toISOString(),
                        modificadoPor: uid,
                        updatedAt: new Date().toISOString()
                    });
                    
                    return {
                        success: true,
                        message: 'Cliente creado en Facturama exitosamente',
                        data: data.data || data
                    };
                } else {
                    return {
                        success: false,
                        message: data.message || 'Error al crear el cliente en Facturama',
                        data: data.data || data
                    };
                }

            } catch (fetchError) {
                console.error('❌ Error en crearClienteFacturama:', fetchError);
                throw new Error(fetchError.message || 'Error al conectar con Facturama. Intenta nuevamente.');
            }

        } catch (error) {
            console.error('❌ Error en crearClienteFacturama:', error);
            throw error;
        }
    }

    /**
     * ✅ Valida y crea cliente en Facturama en un solo paso
     */
    async validarYCrearClienteFacturama(clienteId) {
        try {
            // 1. Validar contra SAT
            const validacion = await this.validarClienteSAT(clienteId);
            
            if (!validacion.success) {
                return {
                    success: false,
                    step: 'validation',
                    message: validacion.message || 'El cliente no pasó la validación del SAT',
                    data: validacion.data
                };
            }

            // 2. Crear en Facturama
            const creacion = await this.crearClienteFacturama(clienteId);

            if (!creacion.success) {
                return {
                    success: false,
                    step: 'creation',
                    message: creacion.message || 'Error al crear el cliente en Facturama',
                    data: creacion.data
                };
            }

            return {
                success: true,
                message: 'Cliente validado y creado en Facturama exitosamente',
                data: {
                    validacion: validacion.data,
                    creacion: creacion.data
                }
            };

        } catch (error) {
            console.error('❌ Error en validarYCrearClienteFacturama:', error);
            throw error;
        }
    }

    /**
     * Obtiene el nombre de un usuario por su UID
     */
    async getUserName(uid) {
        if (!uid) return 'Sistema';
        return await this.repository.getUserName(uid);
    }

    /**
     * Extrae datos de la constancia SAT
     */
    extraerDatosSAT(texto) {
        function buscar(regex, texto) {
            const m = texto.match(regex);
            if (!m) return '';
            return m[1].trim();
        }

        const regimenNombre = buscar(/Regímenes:\s*Régimen\s*Fecha Inicio\s*Fecha Fin\s*(.*?)\s*\d{2}\/\d{2}\/\d{4}/is, texto);
        const regimenCodigo = obtenerCodigoRegimen(regimenNombre);
        
        let regimenFinal = regimenNombre;
        if (!regimenCodigo && regimenNombre) {
            for (const [codigo, data] of Object.entries(REGIMENES_SAT)) {
                if (regimenNombre.includes(codigo) || regimenNombre.includes(data.nombre)) {
                    regimenFinal = data.nombre;
                    break;
                }
            }
        }

        return {
            rfc: buscar(/RFC:\s*([A-Z0-9]{12,13})/i, texto),
            razonSocial: buscar(/Denominación\/Razón Social:\s*(.*?)\s*Régimen Capital:/is, texto),
            nombreComercial: buscar(/Nombre Comercial:\s*(.*?)\s*Fecha inicio de operaciones:/is, texto),
            codigoPostal: buscar(/Código Postal:\s*([0-9]{5})/i, texto),
            tipoVialidad: buscar(/Tipo de Vialidad:\s*(.*?)\s*Nombre de Vialidad:/is, texto),
            nombreVialidad: buscar(/Nombre de Vialidad:\s*(.*?)\s*Número Exterior:/is, texto),
            numeroExterior: buscar(/Número Exterior:\s*(.*?)\s*Número Interior:/is, texto),
            numeroInterior: buscar(/Número Interior:\s*(.*?)\s*Nombre de la Colonia:/is, texto),
            colonia: buscar(/Nombre de la Colonia:\s*(.*?)\s*Nombre de la Localidad:/is, texto),
            localidad: buscar(/Nombre de la Localidad:\s*(.*?)\s*Nombre del Municipio/is, texto),
            municipio: buscar(/Nombre del Municipio o Demarcación Territorial:\s*(.*?)\s*Nombre de la Entidad Federativa:/is, texto),
            estado: buscar(/Nombre de la Entidad Federativa:\s*(.*?)\s*Entre Calle:/is, texto),
            entreCalle: buscar(/Entre Calle:\s*(.*?)\s*Y Calle:/is, texto),
            yCalle: buscar(/Y Calle:\s*(.*?)\s*Actividades Económicas:/is, texto),
            regimen: regimenFinal,
            regimenCodigo: regimenCodigo || obtenerCodigoRegimen(regimenFinal) || ''
        };
    }

    /**
     * Limpia la caché del repositorio
     */
    clearCache() {
        this.repository.clearCache();
    }
}

export default ClienteService;