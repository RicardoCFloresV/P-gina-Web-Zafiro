// unidadesDashboard.js
// Controlador del panel de Unidades
// Gestiona: sidebar, modales (add/edit, buscar, delete), tabla DataTables,
//           toasts, y llamadas a unidadesApi.

import { unidadesApi } from '../api/unidadesApi.js';


// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
  const config = {
    success: { bg: 'bg-success',   icon: 'fa-circle-check' },
    error:   { bg: 'bg-danger',    icon: 'fa-circle-exclamation' },
    warning: { bg: 'bg-accent',    icon: 'fa-triangle-exclamation' },
    info:    { bg: 'bg-secondary', icon: 'fa-circle-info' },
  };
  const { bg, icon } = config[type] || config.info;
  const toastHtml = `
    <div class="toast-message ${bg} text-white px-5 py-3.5 rounded-lg shadow-lg flex items-start gap-3 font-body transform translate-x-full transition-all duration-300 ease-out max-w-full">
      <i class="fa-solid ${icon} text-lg mt-0.5 shrink-0"></i>
      <span class="font-semibold text-sm leading-snug break-words">${message}</span>
    </div>
  `;
  const $toast = $(toastHtml).appendTo('#toastContainer');
  requestAnimationFrame(() => { requestAnimationFrame(() => $toast.removeClass('translate-x-full').addClass('translate-x-0')); });
  setTimeout(() => { $toast.removeClass('translate-x-0').addClass('translate-x-full opacity-0'); setTimeout(() => $toast.remove(), 300); }, 3500);
}
function toastSuccess(msg) { showToast(msg, 'success'); }
function toastError(msg)   { showToast(msg, 'error'); }
function extractMessage(resp, fallback) { return resp?.message || fallback; }

function openModal(container, content) {
  container.classList.remove('opacity-0', 'invisible');
  container.classList.add('opacity-100', 'visible');
  content.classList.remove('translate-y-[-20px]');
  content.classList.add('translate-y-0');
}
function closeModal(container, content) {
  container.classList.remove('opacity-100', 'visible');
  container.classList.add('opacity-0', 'invisible');
  content.classList.remove('translate-y-0');
  content.classList.add('translate-y-[-20px]');
}


// ═════════════════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ═════════════════════════════════════════════════════════════════════════════

const menuToggle     = document.getElementById('menu-toggle');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const modalUnidad        = document.getElementById('modalUnidad');
const modalUnidadContent = document.getElementById('modalUnidadContent');

const modalBuscar        = document.getElementById('modalBuscarUnidad');
const modalBuscarContent = document.getElementById('modalBuscarUnidadContent');

const modalConfirmDelete = document.getElementById('modalConfirmDelete');
const deleteContent      = modalConfirmDelete.querySelector('.delete-content');


// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

function toggleSidebar() { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); }
if (menuToggle && sidebar) { menuToggle.addEventListener('click', toggleSidebar); sidebarOverlay.addEventListener('click', toggleSidebar); }


// ═════════════════════════════════════════════════════════════════════════════
//  TABLA — renderizado con DataTables
// ═════════════════════════════════════════════════════════════════════════════

const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles en la tabla',
  info: 'Mostrando _START_ a _END_ de _TOTAL_ registros', infoEmpty: 'Mostrando 0 a 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros totales)', thousands: ',',
  lengthMenu: 'Mostrar _MENU_ registros', loadingRecords: 'Cargando...', processing: 'Procesando...',
  search: 'Filtrar Tabla:', zeroRecords: 'No se encontraron registros coincidentes',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' },
  aria: { sortAscending: ': activar para ordenar ascendente', sortDescending: ': activar para ordenar descendente' }
};

function renderTable(data) {
  console.log('[renderTable] Pintando tabla con', data.length, 'filas');
  const tbody = $('#tablaUnidadesBody');
  tbody.empty();

  if ($.fn.DataTable.isDataTable('#tablaUnidades')) { $('#tablaUnidades').DataTable().destroy(); }

  data.forEach(row => {
    const isActive = Number(row.estado ?? 1) === 1;
    const tr = `
      <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
          data-unidad-id="${row.unidad_id}" data-nombre="${row.nombre}" data-estado="${row.estado ?? 1}">
        <td class="py-3 px-4 text-textMuted text-sm">${row.unidad_id}</td>
        <td class="py-3 px-4 font-semibold text-primary">${row.nombre}</td>
        <td class="py-3 px-4 text-center">
          <label class="relative inline-flex items-center cursor-pointer" title="${isActive ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'}">
            <input type="checkbox" class="sr-only peer toggle-checkbox" ${isActive ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all toggle-label peer-checked:bg-green-400"></div>
          </label>
        </td>
        <td class="py-3 px-4">
          <div class="flex justify-center items-center gap-3">
            <button class="btn-modificar text-secondary hover:text-primary transition-colors focus:outline-none" title="Modificar"><i class="fa-solid fa-pencil text-lg"></i></button>
            <button class="btn-eliminar text-danger/70 hover:text-danger transition-colors focus:outline-none" title="Desactivar"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
        </td>
      </tr>
    `;
    tbody.append(tr);
  });

  $('#tablaUnidades').DataTable({ language: DT_LANG, columnDefs: [{ orderable: false, targets: [2, 3] }], pageLength: 10, lengthMenu: [5, 10, 25, 50], order: [[0, 'asc']] });
}


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL UNIDAD — Añadir / Modificar
// ═════════════════════════════════════════════════════════════════════════════

let modalMode = 'add';

function openModalUnidad()  { openModal(modalUnidad, modalUnidadContent); }
function closeModalUnidad() { closeModal(modalUnidad, modalUnidadContent); }

$('#btnAnadirUnidad').on('click', function () {
  console.log('[Dashboard] Click en #btnAnadirUnidad');
  modalMode = 'add';
  $('#modalTitle').html('<i class="fa-solid fa-ruler"></i> Añadir Nueva Unidad');
  $('#btnAccionModal').html('<i class="fa-solid fa-check"></i> Agregar');
  $('#formUnidad')[0].reset();
  $('#modalUnidadId').val('');
  openModalUnidad();
});

$('#tablaUnidades').on('click', '.btn-modificar', function () {
  const $row = $(this).closest('tr');
  const unidadId = $row.data('unidad-id');
  const nombre   = $row.data('nombre');
  console.log('[Dashboard] Click en .btn-modificar:', { unidadId, nombre });

  modalMode = 'edit';
  $('#modalUnidadId').val(unidadId);
  $('#modalNombre').val(nombre);
  $('#modalTitle').html('<i class="fa-solid fa-pencil"></i> Modificar Unidad');
  $('#btnAccionModal').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');
  openModalUnidad();
});

$('.btn-close-unidad, #modalUnidadBackdrop').on('click', closeModalUnidad);

$('#formUnidad').on('submit', async function (e) {
  e.preventDefault();
  const nombre = $('#modalNombre').val().trim();
  if (!nombre) { toastError('El nombre es obligatorio.'); return; }

  try {
    if (modalMode === 'add') {
      console.log('[Dashboard] INSERT:', { nombre });
      const resp = await unidadesApi.insert({ nombre });
      toastSuccess(extractMessage(resp, 'Unidad creada correctamente'));
    } else {
      const unidadId = $('#modalUnidadId').val();
      console.log('[Dashboard] UPDATE:', { unidad_id: unidadId, nombre });
      const resp = await unidadesApi.update({ unidad_id: Number(unidadId), nombre });
      toastSuccess(extractMessage(resp, 'Unidad actualizada correctamente'));
    }
    closeModalUnidad();
    await cargarTodos();
  } catch (err) {
    console.error('[Dashboard] Error insert/update:', err);
    toastError(err.message || 'Error en la operación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL BUSCAR
// ═════════════════════════════════════════════════════════════════════════════

function openModalBuscar()  { openModal(modalBuscar, modalBuscarContent); }
function closeModalBuscar() { closeModal(modalBuscar, modalBuscarContent); }

$('#btnBuscarUnidad').on('click', function () {
  $('#formBuscarUnidad')[0].reset();
  openModalBuscar();
});

$('.btn-close-buscar, #modalBuscarUnidadBackdrop').on('click', closeModalBuscar);

$('#formBuscarUnidad').on('submit', async function (e) {
  e.preventDefault();
  const id     = $('#searchId').val();
  const nombre = $('#searchNombre').val().trim();

  if (!id && !nombre) { toastError('Ingresa al menos un criterio de búsqueda.'); return; }

  try {
    let data = [];

    if (id) {
      console.log(`[Dashboard] Buscando por ID: ${id}`);
      const resp = await unidadesApi.getById(Number(id));
      data = resp.data ? [resp.data] : [];
    } else if (nombre) {
      console.log(`[Dashboard] Buscando por nombre: ${nombre}`);
      const resp = await unidadesApi.getByNombre(nombre);
      data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
    }

    if (data.length) {
      renderTable(data);
      toastSuccess(`Se encontraron ${data.length} resultado(s)`);
    } else {
      showToast('No se encontraron unidades con ese criterio', 'warning');
    }
    closeModalBuscar();
  } catch (err) {
    console.error('[Dashboard] Error en búsqueda:', err);
    toastError(err.message || 'Error en la búsqueda');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DELETE
// ═════════════════════════════════════════════════════════════════════════════

function openDeleteModal()  { openModal(modalConfirmDelete, deleteContent); }
function closeDeleteModal() { closeModal(modalConfirmDelete, deleteContent); }

$('#tablaUnidades').on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const unidadId = $row.data('unidad-id');
  const nombre   = $row.data('nombre');
  console.log('[Dashboard] Click en .btn-eliminar:', { unidadId, nombre });
  $('#deleteUnidadId').val(unidadId);
  $('#deleteNombreInfo').text(`${nombre} (ID: ${unidadId})`);
  openDeleteModal();
});

$('.btn-cancelar-delete').on('click', closeDeleteModal);

$('#btnConfirmarDelete').on('click', async function () {
  const unidadId = $('#deleteUnidadId').val();
  try {
    const resp = await unidadesApi.setState({ unidad_id: Number(unidadId), estado: 0 });
    toastSuccess(extractMessage(resp, 'Unidad desactivada'));
    closeDeleteModal();
    await cargarTodos();
  } catch (err) {
    console.error('[Dashboard] Error al desactivar:', err);
    toastError(err.message || 'Error al desactivar');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE DE ESTADO
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaUnidades').on('change', '.toggle-checkbox', async function () {
  const $row     = $(this).closest('tr');
  const unidadId = $row.data('unidad-id');
  const isChecked   = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle     = $(this);

  try {
    const resp = await unidadesApi.setState({ unidad_id: Number(unidadId), estado: nuevoEstado });
    if (isChecked) toastSuccess('Unidad activada');
    else showToast('Unidad desactivada', 'warning');
    await cargarTodos();
  } catch (err) {
    console.error('[Dashboard] Error al cambiar estado:', err);
    toastError(err.message || 'Error al cambiar estado');
    $toggle.prop('checked', !isChecked);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  CARGAR TODOS
// ═════════════════════════════════════════════════════════════════════════════

async function cargarTodos() {
  try {
    const resp = await unidadesApi.getAll();
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
    toastSuccess(`Se cargaron ${data.length} unidades`);
  } catch (err) {
    console.error('[Dashboard] Error al cargar registros:', err);
    toastError(err.message || 'Error al cargar registros');
    renderTable([]);
  }
}

$('#btnCargarRegistros').on('click', () => cargarTodos());


// ═════════════════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

console.log('[Dashboard] unidadesDashboard.js cargado');
cargarTodos();