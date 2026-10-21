/* ==========================================================================
   TICKET ESTADÍSTICAS SERVICE - RSI Enterprise
   Servicio de métricas, KPIs globales, rendimiento por colaborador,
   ranking de solucionadores y expedientes de productividad operativa.
   ========================================================================== */

import TicketRepository from '../repositories/ticketRepository.js';
import PartnerRepository from '../repositories/partnerRepository.js';

export class TicketEstadisticasService {
    constructor() {
        this.ticketRepository = new TicketRepository();
        this.partnerRepository = new PartnerRepository();
    }

    /**
     * Obtiene las opciones de años disponibles según los tickets existentes
     * @returns {Promise<number[]>}
     */
    async getAniosDisponibles() {
        try {
            const allTickets = await this.ticketRepository.getAll([], 'fechaCreacion', 'desc', false);
            const anios = new Set();
            const currentYear = new Date().getFullYear();
            anios.add(currentYear);
            anios.add(currentYear - 1);

            allTickets.forEach(ticket => {
                if (ticket.fechaCreacion) {
                    const year = new Date(ticket.fechaCreacion).getFullYear();
                    if (!isNaN(year) && year > 2000 && year < 2100) {
                        anios.add(year);
                    }
                }
            });

            return Array.from(anios).sort((a, b) => b - a);
        } catch (error) {
            console.error('❌ Error obteniendo años disponibles:', error);
            const cur = new Date().getFullYear();
            return [cur, cur - 1];
        }
    }

    /**
     * Procesa y calcula las estadísticas generales, ranking y tabla de colaboradores
     * con filtros de año, mes y tipo de ticket.
     * @param {Object} filtros - { anio, mes, tipo }
     * @param {boolean} forceRefresh - Forzar actualización de caché
     * @returns {Promise<Object>}
     */
    async getEstadisticasRendimiento({ anio = null, mes = null, tipo = 'todos' } = {}, forceRefresh = false) {
        try {
            const [allTickets, allCollaborators] = await Promise.all([
                this.ticketRepository.getAll([], 'fechaCreacion', 'desc', forceRefresh),
                this.partnerRepository.getAll([], 'createdAt', 'desc', forceRefresh)
            ]);

            // 1. Filtrar tickets por año, mes y tipo
            const filteredTickets = this._filtrarTickets(allTickets, { anio, mes, tipo });

            // 2. Mapear colaboradores activos y con información normalizada
            const colabsMap = this._mapearColaboradores(allCollaborators);

            // 3. Calcular KPIs globales
            const kpisGlobales = this._calcularKpisGlobales(filteredTickets);

            // 4. Calcular métricas individuales de cada colaborador
            const colaboradoresMetricas = this._calcularMetricasColaboradores(colabsMap, filteredTickets);

            // 5. Determinar el Top 3 Solucionadores
            const topSolucionadores = this._calcularTopSolucionadores(colaboradoresMetricas);

            // 6. Preparar datos para gráficos temporales (meses del año)
            const graficos = this._generarDatosGraficos(allTickets, anio || new Date().getFullYear(), filteredTickets);

            return {
                success: true,
                periodo: {
                    anio: anio || 'Todos',
                    mes: mes || 'Todos',
                    tipo: tipo || 'todos'
                },
                totalTicketsFiltrados: filteredTickets.length,
                kpisGlobales,
                topSolucionadores,
                colaboradoresMetricas,
                graficos
            };

        } catch (error) {
            console.error('❌ Error calculando estadísticas de rendimiento:', error);
            return {
                success: false,
                error: error.message || 'Error al procesar las estadísticas de rendimiento'
            };
        }
    }

    /**
     * Obtiene el expediente de rendimiento detallado para un colaborador específico
     * @param {string} colaboradorId - UID o DocId del colaborador
     * @param {Object} filtros - { anio, mes, tipo }
     * @returns {Promise<Object>}
     */
    async getExpedienteColaborador(colaboradorId, { anio = null, mes = null, tipo = 'todos' } = {}) {
        try {
            if (!colaboradorId) throw new Error('ID de colaborador es requerido');

            let colaborador = await this.partnerRepository.getCollaboratorByUid(colaboradorId);
            if (!colaborador) {
                colaborador = await this.partnerRepository.getCollaboratorById(colaboradorId);
            }

            const allTickets = await this.ticketRepository.getAll([], 'fechaCreacion', 'desc', false);
            const filteredTickets = this._filtrarTickets(allTickets, { anio, mes, tipo });

            const userIds = [colaboradorId, colaborador?.uid, colaborador?.id].filter(Boolean);

            // Tickets asociados a este colaborador
            const colabTickets = filteredTickets.filter(t => {
                if (userIds.includes(t.responsableId) || userIds.includes(t.colaboradorId)) return true;
                if (Array.isArray(t.colaboradoresIds) && t.colaboradoresIds.some(id => userIds.includes(id))) return true;
                return false;
            });

            // Métricas calculadas
            const totalAsignados = colabTickets.length;
            const finalizados = colabTickets.filter(t => t.estado === 'finalizado');
            const enProceso = colabTickets.filter(t => t.estado === 'en_proceso');
            const pendientes = colabTickets.filter(t => t.estado === 'pendiente');
            const cancelados = colabTickets.filter(t => t.estado === 'cancelado');

            const tasaResolucion = totalAsignados > 0 
                ? Number(((finalizados.length / totalAsignados) * 100).toFixed(1)) 
                : 0;

            const tiemposHoras = finalizados
                .map(t => this._calcularHorasResolucion(t))
                .filter(h => h !== null && h > 0);

            const tiempoPromedioHoras = tiemposHoras.length > 0
                ? Number((tiemposHoras.reduce((a, b) => a + b, 0) / tiemposHoras.length).toFixed(1))
                : 0;

            // Desglose por prioridad
            const porPrioridad = {
                alta: colabTickets.filter(t => t.prioridad === 'alta').length,
                media: colabTickets.filter(t => t.prioridad === 'media').length,
                baja: colabTickets.filter(t => t.prioridad === 'baja').length
            };

            // Desglose por tipo
            const porTipo = {
                operativo: colabTickets.filter(t => t.tipo === 'operativo').length,
                administracion: colabTickets.filter(t => t.tipo === 'administracion').length
            };

            // Aceptaciones registradas con GPS
            const conGps = colabTickets.filter(t => {
                const aceptaciones = Array.isArray(t.aceptaciones) ? t.aceptaciones : [];
                return aceptaciones.some(a => userIds.includes(a.colaboradorId) && a.ubicacion?.latitud != null);
            }).length;

            // Tickets con reporte fotográfico
            const conReportePdf = colabTickets.filter(t => Boolean(t.reporteFotograficoUrl)).length;

            return {
                success: true,
                colaborador: {
                    id: colaborador?.uid || colaborador?.id || colaboradorId,
                    uid: colaborador?.uid || colaboradorId,
                    nombreCompleto: colaborador?.nombreCompleto || colaborador?.nombre || 'Colaborador',
                    email: colaborador?.emailEmpresarial || colaborador?.email || '-',
                    area: colaborador?.areaNombre || colaborador?.area || 'Sin área asignada',
                    puesto: colaborador?.puesto || colaborador?.cargo || 'Colaborador',
                    fotoPerfil: colaborador?.fotoPerfil || colaborador?.foto || colaborador?.photoURL || null
                },
                periodo: { anio: anio || 'Todos', mes: mes || 'Todos', tipo },
                metricas: {
                    totalAsignados,
                    finalizados: finalizados.length,
                    enProceso: enProceso.length,
                    pendientes: pendientes.length,
                    cancelados: cancelados.length,
                    tasaResolucion,
                    tiempoPromedioHoras,
                    tiempoPromedioTexto: this._formatearTiempoResolucion(tiempoPromedioHoras),
                    conGps,
                    conReportePdf,
                    porPrioridad,
                    porTipo
                },
                tickets: colabTickets.map(t => {
                    const horas = this._calcularHorasResolucion(t);
                    return {
                        id: t.id,
                        idTicket: t.idTicket || t.numeroTicket || t.folio || t.codigo || 'N/A',
                        titulo: t.titulo || 'Sin título',
                        tipo: t.tipo || 'operativo',
                        prioridad: t.prioridad || 'media',
                        estado: t.estado || 'pendiente',
                        fechaCreacion: t.fechaCreacion,
                        fechaFin: t.fechaFin || t.fechaFinalizacion || null,
                        reporteFotograficoUrl: t.reporteFotograficoUrl || null,
                        horasResolucion: horas,
                        horasResolucionTexto: horas !== null && horas > 0 ? this._formatearTiempoResolucion(horas) : (t.estado === 'finalizado' ? '< 1 hr' : '-')
                    };
                })
            };

        } catch (error) {
            console.error('❌ Error obteniendo expediente de colaborador:', error);
            return {
                success: false,
                error: error.message || 'No fue posible cargar el expediente del colaborador'
            };
        }
    }

    /* ==========================================================================
       MÉTODOS PRIVADOS DE CÁLCULO Y FILTRADO
       ========================================================================== */

    _filtrarTickets(tickets, { anio, mes, tipo }) {
        return tickets.filter(ticket => {
            const fechaStr = ticket.fechaCreacion || ticket.createdAt;
            if (!fechaStr) return false;

            const d = new Date(fechaStr);
            if (isNaN(d.getTime())) return false;

            if (anio && anio !== 'todos') {
                if (d.getFullYear() !== parseInt(anio, 10)) return false;
            }

            if (mes && mes !== 'todos') {
                // mes es 1..12
                if ((d.getMonth() + 1) !== parseInt(mes, 10)) return false;
            }

            if (tipo && tipo !== 'todos') {
                if ((ticket.tipo || 'operativo').toLowerCase() !== tipo.toLowerCase()) return false;
            }

            return true;
        });
    }

    _mapearColaboradores(collaborators) {
        const map = new Map();
        collaborators.forEach(c => {
            // Excluir usuarios inactivos
            if (c.status === 'inactive') return;

            const uid = c.uid || c.id;
            const item = {
                id: uid,
                uid: uid,
                docId: c.id,
                nombreCompleto: c.nombreCompleto || c.nombre || c.displayName || 'Colaborador',
                email: c.emailEmpresarial || c.email || '',
                area: c.areaNombre || c.area || 'Operaciones',
                puesto: c.puesto || c.cargo || 'Especialista',
                fotoPerfil: c.fotoPerfil || c.foto || c.photoURL || null
            };
            map.set(uid, item);
            if (c.id && c.id !== uid) map.set(c.id, item);
        });
        return map;
    }

    _calcularKpisGlobales(tickets) {
        const total = tickets.length;
        const finalizados = tickets.filter(t => t.estado === 'finalizado').length;
        const enProceso = tickets.filter(t => t.estado === 'en_proceso').length;
        const pendientes = tickets.filter(t => t.estado === 'pendiente').length;
        const cancelados = tickets.filter(t => t.estado === 'cancelado').length;

        const tasaResolucion = total > 0 
            ? Number(((finalizados / total) * 100).toFixed(1)) 
            : 0;

        // Horas promedio de resolución
        const tiempos = tickets
            .filter(t => t.estado === 'finalizado')
            .map(t => this._calcularHorasResolucion(t))
            .filter(h => h !== null && h > 0);

        const tiempoPromedioHoras = tiempos.length > 0
            ? Number((tiempos.reduce((acc, curr) => acc + curr, 0) / tiempos.length).toFixed(1))
            : 0;

        // Con reporte fotográfico en Storage
        const conReportePdf = tickets.filter(t => Boolean(t.reporteFotograficoUrl)).length;
        const porcentajeConReporte = finalizados > 0 
            ? Number(((conReportePdf / finalizados) * 100).toFixed(1)) 
            : 0;

        return {
            total,
            finalizados,
            enProceso,
            pendientes,
            cancelados,
            tasaResolucion,
            tiempoPromedioHoras,
            tiempoPromedioTexto: this._formatearTiempoResolucion(tiempoPromedioHoras),
            conReportePdf,
            porcentajeConReporte
        };
    }

    _calcularMetricasColaboradores(colabsMap, tickets) {
        // Agrupar métricas por colaborador único (deduplicando por UID)
        const metricasMap = new Map();

        // Inicializar a todos los colaboradores con 0
        const uniqueColabs = Array.from(new Set(Array.from(colabsMap.values()).map(c => c.uid)))
            .map(uid => colabsMap.get(uid));

        uniqueColabs.forEach(c => {
            metricasMap.set(c.uid, {
                colaborador: c,
                totalAsignados: 0,
                finalizados: 0,
                enProceso: 0,
                pendientes: 0,
                cancelados: 0,
                tasaResolucion: 0,
                tiemposHoras: [],
                tiempoPromedioHoras: 0,
                tiempoPromedioTexto: '-',
                comoResponsable: 0,
                conReportePdf: 0
            });
        });

        // Contabilizar sobre los tickets del periodo
        tickets.forEach(ticket => {
            const rawIds = Array.isArray(ticket.colaboradoresIds) ? ticket.colaboradoresIds : [];
            const ticketColabUids = new Set();

            rawIds.forEach(id => {
                const found = colabsMap.get(id);
                if (found) ticketColabUids.add(found.uid);
            });

            if (ticket.responsableId) {
                const found = colabsMap.get(ticket.responsableId);
                if (found) ticketColabUids.add(found.uid);
            }

            const horas = this._calcularHorasResolucion(ticket);

            ticketColabUids.forEach(uid => {
                let entry = metricasMap.get(uid);
                if (!entry) {
                    // Si el colaborador no estaba en la lista inicial, crearlo al vuelo
                    const colInfo = colabsMap.get(uid) || {
                        id: uid,
                        uid: uid,
                        nombreCompleto: `Colaborador (${uid.substring(0, 6)})`,
                        area: 'Operaciones',
                        puesto: 'Técnico',
                        fotoPerfil: null
                    };
                    entry = {
                        colaborador: colInfo,
                        totalAsignados: 0,
                        finalizados: 0,
                        enProceso: 0,
                        pendientes: 0,
                        cancelados: 0,
                        tasaResolucion: 0,
                        tiemposHoras: [],
                        tiempoPromedioHoras: 0,
                        tiempoPromedioTexto: '-',
                        comoResponsable: 0,
                        conReportePdf: 0
                    };
                    metricasMap.set(uid, entry);
                }

                entry.totalAsignados++;
                if (ticket.responsableId && colabsMap.get(ticket.responsableId)?.uid === uid) {
                    entry.comoResponsable++;
                }

                if (ticket.estado === 'finalizado') {
                    entry.finalizados++;
                    if (horas !== null && horas > 0) {
                        entry.tiemposHoras.push(horas);
                    }
                    if (ticket.reporteFotograficoUrl) {
                        entry.conReportePdf++;
                    }
                } else if (ticket.estado === 'en_proceso') {
                    entry.enProceso++;
                } else if (ticket.estado === 'pendiente') {
                    entry.pendientes++;
                } else if (ticket.estado === 'cancelado') {
                    entry.cancelados++;
                }
            });
        });

        // Consolidar tasas y promedios finales
        const resultados = Array.from(metricasMap.values()).map(m => {
            const tasa = m.totalAsignados > 0 
                ? Number(((m.finalizados / m.totalAsignados) * 100).toFixed(1)) 
                : 0;

            const prom = m.tiemposHoras.length > 0
                ? Number((m.tiemposHoras.reduce((a, b) => a + b, 0) / m.tiemposHoras.length).toFixed(1))
                : 0;

            return {
                ...m,
                tasaResolucion: tasa,
                tiempoPromedioHoras: prom,
                tiempoPromedioTexto: prom > 0 ? this._formatearTiempoResolucion(prom) : 'N/A'
            };
        });

        // Ordenar por tickets finalizados descendente, luego por tasa de resolución
        return resultados.sort((a, b) => {
            if (b.finalizados !== a.finalizados) return b.finalizados - a.finalizados;
            if (b.totalAsignados !== a.totalAsignados) return b.totalAsignados - a.totalAsignados;
            return b.tasaResolucion - a.tasaResolucion;
        });
    }

    _calcularTopSolucionadores(colaboradoresMetricas) {
        // Tomar los 3 con mayor cantidad de tickets resueltos
        const candidatos = colaboradoresMetricas.filter(c => c.totalAsignados > 0 || c.finalizados > 0);
        const top3 = candidatos.slice(0, 3);

        const medallas = ['oro', 'plata', 'bronce'];
        const posiciones = [1, 2, 3];

        return top3.map((item, idx) => ({
            posicion: posiciones[idx],
            medalla: medallas[idx],
            colaborador: item.colaborador,
            finalizados: item.finalizados,
            totalAsignados: item.totalAsignados,
            tasaResolucion: item.tasaResolucion,
            tiempoPromedioTexto: item.tiempoPromedioTexto,
            conReportePdf: item.conReportePdf
        }));
    }

    _generarDatosGraficos(allTickets, anioSeleccionado, ticketsPeriodo) {
        const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const anioInt = parseInt(anioSeleccionado, 10) || new Date().getFullYear();

        // 1. Gráfico Mensual del Año: Creados vs Finalizados
        const creadosMes = new Array(12).fill(0);
        const finalizadosMes = new Array(12).fill(0);

        allTickets.forEach(t => {
            if (t.fechaCreacion) {
                const d = new Date(t.fechaCreacion);
                if (d.getFullYear() === anioInt) {
                    const m = d.getMonth();
                    creadosMes[m]++;
                    if (t.estado === 'finalizado') {
                        finalizadosMes[m]++;
                    }
                }
            }
        });

        // 2. Gráfico de Estados del Periodo Filtrado
        const estadosConteo = {
            'Pendiente': ticketsPeriodo.filter(t => t.estado === 'pendiente').length,
            'En Proceso': ticketsPeriodo.filter(t => t.estado === 'en_proceso').length,
            'Finalizado': ticketsPeriodo.filter(t => t.estado === 'finalizado').length,
            'Cancelado': ticketsPeriodo.filter(t => t.estado === 'cancelado').length
        };

        // 3. Gráfico por Tipo de Ticket
        const tiposConteo = {
            'Operativo': ticketsPeriodo.filter(t => (t.tipo || 'operativo') === 'operativo').length,
            'Administración': ticketsPeriodo.filter(t => t.tipo === 'administracion').length
        };

        return {
            mensual: {
                labels: nombresMeses,
                creados: creadosMes,
                finalizados: finalizadosMes
            },
            estados: {
                labels: Object.keys(estadosConteo),
                data: Object.values(estadosConteo)
            },
            tipos: {
                labels: Object.keys(tiposConteo),
                data: Object.values(tiposConteo)
            }
        };
    }

    _calcularHorasResolucion(ticket) {
        if (!ticket.fechaCreacion) return null;
        const inicio = new Date(ticket.fechaInicio || ticket.fechaCreacion);
        const fin = new Date(ticket.fechaFin || ticket.fechaFinalizacion || ticket.updatedAt || ticket.fechaActualizacion);

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null;

        const diffMs = fin.getTime() - inicio.getTime();
        if (diffMs <= 0) return 0.5; // Mínimo 30 min simbólicos si se cerró inmediatamente

        const horas = diffMs / (1000 * 60 * 60);
        return horas > 0 ? Number(horas.toFixed(1)) : null;
    }

    _formatearTiempoResolucion(horas) {
        if (!horas || horas <= 0) return '0 hrs';
        if (horas < 24) {
            return `${horas} hrs`;
        }
        const dias = Math.floor(horas / 24);
        const restoHoras = Math.round(horas % 24);
        if (restoHoras === 0) return `${dias} d`;
        return `${dias}d ${restoHoras}h`;
    }
}

export default TicketEstadisticasService;
