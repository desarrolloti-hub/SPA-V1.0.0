/* ========================================
   AREA CRUD CONTROLLER
   Controlador para listar y gestionar áreas
   ======================================== */

import AreaService from '../../services/areaService.js';

let service = null;
let eventListeners = [];
let areasData = [];

/**
 * Inicializa el controlador CRUD de áreas
 */
export async function areaCrudController() {
    console.log('📋 Area CRUD Controller iniciado');
    
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    service = new AreaService();
    
    initLoadAreas();
    initDeleteArea();
    initRefreshAreas();
    
    // Cargar áreas al iniciar
    await loadAreasTable();
    
    console.log('✅ Area CRUD Controller listo');
}

/**
 * Inicializa la carga de áreas
 */
function initLoadAreas() {
    // La carga se hace en loadAreasTable()
}

/**
 * Inicializa el refresco de áreas
 */
function initRefreshAreas() {
    const refreshBtn = document.getElementById('refreshAreas');
    if (!refreshBtn) return;

    const handler = async () => {
        await loadAreasTable();
    };
    
    refreshBtn.addEventListener('click', handler);
    eventListeners.push({ element: refreshBtn, event: 'click', handler });
}

/**
 * Inicializa la eliminación de áreas (event delegation)
 */
function initDeleteArea() {
    const tableBody = document.getElementById('areasTableBody');
    if (!tableBody) return;

    const handler = async (e) => {
        const deleteBtn = e.target.closest('.btn-delete-area');
        if (!deleteBtn) return;
        
        const areaId = deleteBtn.dataset.id;
        await handleDeleteArea(areaId);
    };
    
    tableBody.addEventListener('click', handler);
    eventListeners.push({ element: tableBody, event: 'click', handler });
}

/**
 * Carga y muestra las áreas en la tabla
 */
async function loadAreasTable() {
    const tableBody = document.getElementById('areasTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.rsi-table-wrapper');
    
    if (!tableBody) return;

    try {
        // Mostrar loading
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        
        const areas = await service.getAllAreas();
        areasData = areas;

        // Ocultar loading
        if (loadingState) loadingState.style.display = 'none';

        if (areas.length === 0) {
            // Mostrar empty state
            if (emptyState) emptyState.style.display = 'block';
            if (tableWrapper) tableWrapper.style.display = 'none';
            return;
        }

        // Mostrar tabla
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';

        tableBody.innerHTML = areas.map(area => `
            <tr>
                <td data-label="ID">
                    <span style="font-size: 0.8rem; color: var(--rsi-gray-500); font-family: monospace;">
                        ${area.id?.substring(0, 8) || '-'}
                    </span>
                </td>
                <td data-label="Nombre">
                    <span style="font-weight: 600;">${area.nombreArea || '-'}</span>
                </td>
                <td data-label="Subáreas">
                    <span class="rsi-badge rsi-badge-primary">
                        ${Object.keys(area.subareas || {}).length}
                    </span>
                </td>
                <td data-label="Módulos">
                    <span class="rsi-badge rsi-badge-success">
                        ${countModulos(area.subareas)}
                    </span>
                </td>
                <td data-label="Creado">
                    <span style="font-size: 0.85rem; color: var(--rsi-gray-500);">
                        ${formatDate(area.createdAt)}
                    </span>
                </td>
                <td data-label="Acciones">
                    <div class="rsi-table-actions">
                        <button class="rsi-btn-icon rsi-btn-icon-view btn-view-area" data-id="${area.id}" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="rsi-btn-icon rsi-btn-icon-edit btn-edit-area" data-id="${area.id}" title="Editar área">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="rsi-btn-icon rsi-btn-icon-delete btn-delete-area" data-id="${area.id}" title="Eliminar área">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Event listeners para ver detalles
        tableBody.querySelectorAll('.btn-view-area').forEach(btn => {
            btn.addEventListener('click', () => {
                const areaId = btn.dataset.id;
                handleViewArea(areaId);
            });
        });

        // Event listeners para editar
        tableBody.querySelectorAll('.btn-edit-area').forEach(btn => {
            btn.addEventListener('click', () => {
                const areaId = btn.dataset.id;
                handleEditArea(areaId);
            });
        });

    } catch (error) {
        console.error('❌ Error cargando áreas:', error);
        if (loadingState) loadingState.style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar las áreas: ' + error.message,
            confirmButtonText: 'Reintentar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Cuenta el total de módulos en todas las subáreas
 */
function countModulos(subareas) {
    if (!subareas) return 0;
    const subareaKeys = Object.keys(subareas);
    let total = 0;
    subareaKeys.forEach(key => {
        const subarea = subareas[key];
        if (subarea.modulos) {
            total += Object.keys(subarea.modulos).length;
        }
    });
    return total;
}

/**
 * Formatea una fecha
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Maneja la eliminación de un área
 */
async function handleDeleteArea(areaId) {
    const area = areasData.find(a => a.id === areaId);
    if (!area) return;

    const result = await Swal.fire({
        title: '¿Eliminar área?',
        html: `
            <div style="text-align: left;">
                <p><strong>Área:</strong> ${area.nombreArea}</p>
                <p><strong>Subáreas:</strong> ${Object.keys(area.subareas || {}).length}</p>
                <p style="color: var(--rsi-danger);">Esta acción no se puede deshacer.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        await service.deleteArea(areaId);
        
        Swal.fire({
            icon: 'success',
            title: '¡Eliminada!',
            text: `El área "${area.nombreArea}" ha sido eliminada.`,
            timer: 2000,
            showConfirmButton: false
        });
        
        await loadAreasTable();
    } catch (error) {
        console.error('❌ Error eliminando área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al eliminar el área',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la visualización de detalles de un área
 */
async function handleViewArea(areaId) {
    try {
        const area = await service.getAreaById(areaId);
        if (!area) {
            throw new Error('Área no encontrada');
        }

        const subareas = area.subareas || {};
        const subareaKeys = Object.keys(subareas);
        
        let subareasHtml = '';
        if (subareaKeys.length === 0) {
            subareasHtml = '<p style="color: var(--rsi-gray-500);">No hay subáreas</p>';
        } else {
            subareasHtml = subareaKeys.map(key => {
                const s = subareas[key];
                const modulos = s.modulos || {};
                const modulosKeys = Object.keys(modulos);
                const modulosHtml = modulosKeys.map(mk => {
                    const m = modulos[mk];
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--rsi-gray-100);">
                            <span style="font-weight: 500;">${m.nombreModulo}</span>
                            <div>
                                ${(m.permisos?.permiso || []).map(p => 
                                    `<span class="rsi-tag" style="margin: 0 2px;">${p}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                }).join('');
                
                return `
                    <div style="background: var(--rsi-gray-50); padding: var(--rsi-spacing-md); border-radius: var(--rsi-radius-md); margin-bottom: var(--rsi-spacing-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--rsi-spacing-sm);">
                            <strong style="color: var(--rsi-text-primary);">${s.nombreSubarea}</strong>
                            <span class="rsi-badge rsi-badge-primary">${modulosKeys.length} módulos</span>
                        </div>
                        ${modulosHtml || '<p style="color: var(--rsi-gray-500); font-size: 0.9rem;">Sin módulos</p>'}
                    </div>
                `;
            }).join('');
        }

        Swal.fire({
            title: area.nombreArea,
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display: flex; gap: var(--rsi-spacing-md); margin-bottom: var(--rsi-spacing-md); flex-wrap: wrap;">
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">ID</span>
                            <p style="font-size: 0.85rem; font-family: monospace; margin: 0;">${area.id}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Subáreas</span>
                            <p style="font-weight: 600; margin: 0;">${subareaKeys.length}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Módulos</span>
                            <p style="font-weight: 600; margin: 0;">${countModulos(subareas)}</p>
                        </div>
                        <div>
                            <span style="color: var(--rsi-gray-500); font-size: 0.8rem;">Creado</span>
                            <p style="margin: 0;">${formatDate(area.createdAt)}</p>
                        </div>
                    </div>
                    <hr style="margin: var(--rsi-spacing-md) 0; border-color: var(--rsi-gray-200);">
                    <h4 style="margin: 0 0 var(--rsi-spacing-sm) 0; color: var(--rsi-text-primary);">Subáreas</h4>
                    ${subareasHtml}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1c1948',
            width: '700px'
        });

    } catch (error) {
        console.error('❌ Error viendo área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al cargar los detalles',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Maneja la edición de un área
 */
async function handleEditArea(areaId) {
    try {
        const area = await service.getAreaById(areaId);
        if (!area) {
            throw new Error('Área no encontrada');
        }

        const { value: nombreArea } = await Swal.fire({
            title: 'Editar Área',
            input: 'text',
            inputLabel: 'Nombre del área',
            inputValue: area.nombreArea,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c1948',
            cancelButtonColor: '#6c757d',
            inputValidator: (value) => {
                if (!value || value.trim().length < 2) {
                    return 'El nombre debe tener al menos 2 caracteres';
                }
                return null;
            }
        });

        if (nombreArea) {
            await service.updateArea(areaId, { nombreArea: nombreArea.trim() });
            
            Swal.fire({
                icon: 'success',
                title: '¡Actualizada!',
                text: `El área ahora se llama "${nombreArea.trim()}"`,
                timer: 2000,
                showConfirmButton: false
            });
            
            await loadAreasTable();
        }
    } catch (error) {
        console.error('❌ Error editando área:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al editar el área',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
        });
    }
}

/**
 * Limpia eventos
 */
export function destroyAreaCrudController() {
    console.log('🧹 Destroying AreaCrudController');
    
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners = [];
    
    service = null;
    areasData = [];
}

export default areaCrudController;