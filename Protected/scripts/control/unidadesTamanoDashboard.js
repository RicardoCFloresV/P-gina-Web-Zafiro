// unidadesTamanoDashboard.js
// Controlador del panel de Unidades de Tamaño
// Gestiona: sidebar, modales (add/edit, delete), tabla DataTables,
//           toasts, toggle de estado, y llamadas a la API.

import { unidadesApi } from '../api/unidadesTamanoApi.js';


// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

function showToast(message, isError = false) {
  const bgColor = isError ? 'var(--color-danger, #a5230c)' : 'var(--color-primary, #2d4778)';
  const icon    = isError ? 'fa-circle-exclamation' : 'fa-check-circle';
  const toastHtml = `
    <div class="toast-message" style="position: fixed; bottom: 20px; right: 20px; background: ${bgColor}; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999; display: flex; align-items: center; gap: 10px; font-family: 'Open Sans', sans-serif;">
      <i class="fa-solid ${icon}"></i>
      <span style="font-weight: 600;">${message}</span>
    </div>
  `;
  const $toast = $(toastHtml).appendTo('body');
  setTimeout(() => { $toast.fadeOut(400, function () { $(this).remove(); }); }, 3000);
}

function openModal(el)  { $(el).addClass('active'); }
function closeModal(el) { $(el).removeClass('active'); }


// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

const menuToggle = document.getElementById('menu-toggle');
const sidebar    = document.getElementById('sidebar');

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target) && window.innerWidth <= 992) {
      sidebar.classList.remove('active');
    }
  });
}


// ═════════════════════════════════════════════════════════════════════════════
//  TABLA
// ═════════════════════════════════════════════════════════════════════════════

const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles', info: 'Mostrando _START_ a _END_ de _TOTAL_ entradas',
  infoEmpty: 'Mostrando 0 a 0 de 0 entradas', infoFiltered: '(filtrado de _MAX_ entradas totales)',
  thousands: ',', lengthMenu: 'Mostrar _MENU_ entradas', loadingRecords: 'Cargando...',
  processing: 'Procesando...', search: 'Buscar:', zeroRecords: 'No se encontraron registros',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' },
  aria: { sortAscending: ': ordenar ascendente', sortDescending: ': ordenar descendente' }
};

function renderTable(data) {
  console.log('[renderTable] Pintando tabla con', data.length, 'filas');
  const tbody = $('#tablaUnidadesBody');
  tbody.empty();

  if ($.fn.DataTable.isDataTable('#tablaUnidades')) {
    $('#tablaUnidades').DataTable().destroy();
  }

  data.forEach(row => {
    // get_all solo retorna activas, pero si en el futuro se cambia, soportamos ambos
    const isActive = row.estado !== undefined ? Number(row.estado) === 1 : true;
    const tr = `
      <tr data-unidad-id="${row.unidad_id}"
          data-nombre="${row.nombre}"
          data-estado="${isActive ? 1 : 0}">
        <td>${row.unidad_id}</td>
        <td style="font-weight: 600;">${row.nombre}</td>
        <td style="text-align: center;">
          <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;" title="Cambiar Estado">
            <input type="checkbox" class="toggle-checkbox" style="position: absolute; opacity: 0; width: 0; height: 0;" ${isActive ? 'checked' : ''}>
            <span class="toggle-track" style="width: 44px; height: 24px; background: ${isActive ? '#68D391' : '#ccc'}; border-radius: 12px; position: relative; display: inline-block; transition: background 0.3s;">
              <span style="position: absolute; top: 2px; left: ${isActive ? '22px' : '2px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: left 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
            </span>
          </label>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; justify-content: center; gap: 8px;">
            <button class="btn-modificar" title="Modificar" style="background: none; border: none; cursor: pointer; color: var(--color-secondary, #648cbc); font-size: 1.1rem;">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="btn-eliminar" title="Desactivar" style="background: none; border: none; cursor: pointer; color: var(--color-danger, #a5230c); font-size: 1.2rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    tbody.append(tr);
  });

  $('#tablaUnidades').DataTable({
    language: DT_LANG,
    columnDefs: [{ orderable: false, targets: [2, 3] }]
  });
}


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL UNIDAD — Añadir / Modificar
// ═════════════════════════════════════════════════════════════════════════════

let modalMode = 'add'; // 'add' | 'edit'

// ─── Abrir: Añadir ──────────────────────────────────────────────────────────
$('#btnAnadirUnidad').on('click', function () {
  console.log('[Dashboard] Click en #btnAnadirUnidad');
  modalMode = 'add';
  $('#modalTitle').html('<i class="fa-solid fa-ruler" style="margin-right: 8px;"></i>Añadir Nueva Unidad');
  $('#btnAccionModal').html('<i class="fa-solid fa-check"></i> Agregar');
  $('#formUnidad')[0].reset();
  $('#modalUnidadId').val('');
  openModal('#modalUnidad');
});

// ─── Abrir: Modificar (fetch por ID para datos frescos) ─────────────────────
$('#tablaUnidades').on('click', '.btn-modificar', async function () {
  const $row = $(this).closest('tr');
  const unidadId = $row.data('unidad-id');
  console.log('[Dashboard] Click en .btn-modificar — unidad_id:', unidadId);

  try {
    console.log(`[Dashboard] Llamando unidadesApi.getById(${unidadId})...`);
    const resp = await unidadesApi.getById(unidadId);
    const unidad = resp.data;
    console.log('[Dashboard] Datos recibidos para editar:', unidad);

    if (!unidad) { showToast('No se encontró la unidad', true); return; }

    modalMode = 'edit';
    $('#modalTitle').html('<i class="fa-solid fa-pencil" style="margin-right: 8px;"></i>Modificar Unidad');
    $('#btnAccionModal').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');
    $('#modalUnidadId').val(unidad.unidad_id);
    $('#modalNombre').val(unidad.nombre);
    openModal('#modalUnidad');

  } catch (err) {
    console.error('[Dashboard] Error al obtener unidad para editar:', err);
    showToast(err.message || 'Error al obtener datos', true);
  }
});

// ─── Cerrar modal ───────────────────────────────────────────────────────────
$('#btnCloseModal, #btnCancelarModal').on('click', function () { closeModal('#modalUnidad'); });
$('#modalUnidad').on('click', function (e) { if (e.target === this) closeModal('#modalUnidad'); });

// ─── Submit: Agregar o Guardar ──────────────────────────────────────────────
$('#formUnidad').on('submit', async function (e) {
  e.preventDefault();

  const nombre = $('#modalNombre').val().trim();
  console.log('[Dashboard] Dato recolectado de #modalNombre:', nombre);

  if (!nombre) { showToast('El nombre es obligatorio.', true); return; }

  try {
    if (modalMode === 'add') {
      console.log('[Dashboard] Modo ADD — datos enviados a unidadesApi.insert:', { nombre });
      const resp = await unidadesApi.insert({ nombre });
      console.log('[Dashboard] Respuesta de unidadesApi.insert:', resp);
      showToast(resp.message || 'Unidad creada correctamente');
    } else {
      const unidadId = $('#modalUnidadId').val();
      console.log('[Dashboard] Modo EDIT — dato de #modalUnidadId:', unidadId);
      console.log('[Dashboard] Datos enviados a unidadesApi.update:', { unidad_id: unidadId, nombre });
      const resp = await unidadesApi.update({ unidad_id: Number(unidadId), nombre });
      console.log('[Dashboard] Respuesta de unidadesApi.update:', resp);
      showToast(resp.message || 'Unidad actualizada correctamente');
    }

    closeModal('#modalUnidad');
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error en insert/update:', err);
    showToast(err.message || 'Error en la operación', true);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DELETE — Confirmar desactivación
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaUnidades').on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const unidadId = $row.data('unidad-id');
  const nombre   = $row.data('nombre');
  console.log('[Dashboard] Click en .btn-eliminar — datos de <tr>:', { unidadId, nombre });
  $('#deleteUnidadId').val(unidadId);
  $('#deleteMessage').text(`¿Estás seguro de que deseas desactivar "${nombre}" (ID: ${unidadId})?`);
  openModal('#modalConfirmDelete');
});

$('.btn-cancelar-delete').on('click', function () { closeModal('#modalConfirmDelete'); });
$('#modalConfirmDelete').on('click', function (e) { if (e.target === this) closeModal('#modalConfirmDelete'); });

$('#btnConfirmarDelete').on('click', async function () {
  const unidadId = $('#deleteUnidadId').val();
  console.log('[Dashboard] Dato de #deleteUnidadId:', unidadId);
  console.log('[Dashboard] Datos enviados a unidadesApi.setState:', { unidad_id: unidadId, estado: 0 });

  try {
    const resp = await unidadesApi.setState({ unidad_id: Number(unidadId), estado: 0 });
    console.log('[Dashboard] Respuesta de unidadesApi.setState:', resp);
    showToast(resp.message || 'Unidad desactivada');
    closeModal('#modalConfirmDelete');
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error al desactivar:', err);
    showToast(err.message || 'Error al desactivar', true);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE DE ESTADO
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaUnidades').on('change', '.toggle-checkbox', async function () {
  const $row      = $(this).closest('tr');
  const unidadId  = $row.data('unidad-id');
  const isChecked = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle   = $(this);

  console.log('[Dashboard] Toggle .toggle-checkbox — unidad_id:', unidadId);
  console.log('[Dashboard] Datos enviados a unidadesApi.setState:', { unidad_id: unidadId, estado: nuevoEstado });

  try {
    const resp = await unidadesApi.setState({ unidad_id: Number(unidadId), estado: nuevoEstado });
    console.log('[Dashboard] Respuesta de unidadesApi.setState:', resp);
    showToast(isChecked ? 'Unidad activada' : 'Unidad desactivada', !isChecked);
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error al cambiar estado:', err);
    showToast(err.message || 'Error al cambiar estado', true);
    $toggle.prop('checked', !isChecked);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  CARGAR TODOS
// ═════════════════════════════════════════════════════════════════════════════

async function cargarTodos() {
  console.log('[Dashboard] Llamando unidadesApi.getAll...');
  try {
    const resp = await unidadesApi.getAll();
    console.log('[Dashboard] Respuesta de unidadesApi.getAll:', resp);
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
    showToast(`Se cargaron ${data.length} unidades`);
  } catch (err) {
    console.error('[Dashboard] Error al cargar registros:', err);
    showToast(err.message || 'Error al cargar registros', true);
    renderTable([]);
  }
}

$('#btnCargarRegistros').on('click', function () {
  console.log('[Dashboard] Click en #btnCargarRegistros');
  cargarTodos();
});


// ═════════════════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

console.log('[Dashboard] unidadesTamanoDashboard.js cargado');
console.log('[Dashboard] Cargando registros iniciales...');
cargarTodos();