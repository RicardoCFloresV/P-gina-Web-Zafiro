// presentacionesDashboard.js
// Controlador del panel de Presentaciones

import { presentacionesApi } from '../api/presentacionesApi.js';

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

const modalPresentacion        = document.getElementById('modalPresentacion');
const modalPresentacionContent = document.getElementById('modalPresentacionContent');

const modalBuscar        = document.getElementById('modalBuscarPresentacion');
const modalBuscarContent = document.getElementById('modalBuscarPresentacionContent');

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
  const tbody = $('#tablaPresentacionesBody');
  tbody.empty();

  if ($.fn.DataTable.isDataTable('#tablaPresentaciones')) { $('#tablaPresentaciones').DataTable().destroy(); }

  data.forEach(row => {
    const isActive = Number(row.estado ?? 1) === 1;
    const tr = `
      <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
          data-presentacion-id="${row.presentacion_id}" data-nombre="${row.nombre}" data-estado="${row.estado ?? 1}">
        <td class="py-3 px-4 text-textMuted text-sm">${row.presentacion_id}</td>
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

  $('#tablaPresentaciones').DataTable({ language: DT_LANG, columnDefs: [{ orderable: false, targets: [2, 3] }], pageLength: 10, lengthMenu: [5, 10, 25, 50], order: [[0, 'asc']] });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL PRESENTACIÓN — Añadir / Modificar
// ═════════════════════════════════════════════════════════════════════════════
let modalMode = 'add';

function openModalPresentacion() { openModal(modalPresentacion, modalPresentacionContent); }
function closeModalPresentacion() { closeModal(modalPresentacion, modalPresentacionContent); }

$('#btnAnadirPresentacion').on('click', function () {
  modalMode = 'add';
  $('#modalTitle').html('<i class="fa-solid fa-cubes"></i> Añadir Nueva Presentación');
  $('#btnAccionModal').html('<i class="fa-solid fa-check"></i> Agregar');
  $('#formPresentacion')[0].reset();
  $('#modalPresentacionId').val('');
  openModalPresentacion();
});

$('#tablaPresentaciones').on('click', '.btn-modificar', function () {
  const $row = $(this).closest('tr');
  const presentacionId = $row.data('presentacion-id');
  const nombre = $row.data('nombre');

  modalMode = 'edit';
  $('#modalTitle').html('<i class="fa-solid fa-pencil"></i> Modificar Presentación');
  $('#btnAccionModal').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');
  
  $('#modalPresentacionId').val(presentacionId);
  $('#nombrePresentacion').val(nombre);
  
  openModalPresentacion();
});

$('.btn-cerrar-modal').on('click', function () {
  closeModalPresentacion();
  closeModal(modalBuscar, modalBuscarContent);
});

$('#formPresentacion').on('submit', async function (e) {
  e.preventDefault();
  const data = {
    presentacion_id: $('#modalPresentacionId').val(),
    nombre: $('#nombrePresentacion').val().trim()
  };

  if (!data.nombre) return toastError('El nombre es obligatorio.');

  try {
    let resp;
    if (modalMode === 'add') {
      resp = await presentacionesApi.insert(data);
      toastSuccess(extractMessage(resp, 'Presentación agregada'));
    } else {
      resp = await presentacionesApi.update(data);
      toastSuccess(extractMessage(resp, 'Presentación actualizada'));
    }
    closeModalPresentacion();
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al guardar presentación');
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DESACTIVAR / ELIMINAR
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaPresentaciones').on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const presentacionId = $row.data('presentacion-id');
  const nombre = $row.data('nombre');
  
  $('#deletePresentacionId').val(presentacionId);
  $('#deleteNombreInfo').text(nombre);
  
  openModal(modalConfirmDelete, deleteContent);
});

$('.btn-cancelar-delete').on('click', function () {
  closeModal(modalConfirmDelete, deleteContent);
});

$('#btnConfirmarDelete').on('click', async function () {
  const presentacionId = $('#deletePresentacionId').val();
  try {
    await presentacionesApi.setState({ presentacion_id: Number(presentacionId), estado: 0 });
    toastSuccess('Presentación desactivada');
    closeModal(modalConfirmDelete, deleteContent);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al desactivar la presentación');
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  CAMBIAR ESTADO DESDE EL TOGGLE CHECKBOX
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaPresentaciones').on('change', '.toggle-checkbox', async function () {
  const $row          = $(this).closest('tr');
  const presentacionId = $row.data('presentacion-id');
  const isChecked     = $(this).is(':checked');
  const nuevoEstado   = isChecked ? 1 : 0;
  const $toggle       = $(this);

  try {
    await presentacionesApi.setState({ presentacion_id: Number(presentacionId), estado: nuevoEstado });
    if (isChecked) toastSuccess('Presentación activada');
    else showToast('Presentación desactivada', 'warning');
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al cambiar estado');
    $toggle.prop('checked', !isChecked);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  BUSCAR Y CARGAR TODOS
// ═════════════════════════════════════════════════════════════════════════════

$('#btnBuscarPresentacion').on('click', () => {
  $('#buscarNombre').val('');
  openModal(modalBuscar, modalBuscarContent);
});

$('#btnEjecutarBusqueda').on('click', async () => {
  const query = $('#buscarNombre').val().trim();
  if (!query) return toastError('Ingrese un término de búsqueda');
  
  try {
    const resp = await presentacionesApi.getByNombre(query); // Asumiendo que se creará este endpoint
    const data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
    renderTable(data);
    closeModal(modalBuscar, modalBuscarContent);
    toastSuccess(`Se encontraron ${data.length} resultados`);
  } catch (err) {
    toastError(err.message || 'Error en la búsqueda');
  }
});

async function cargarTodos() {
  try {
    const resp = await presentacionesApi.getAll();
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
  } catch (err) {
    toastError(err.message || 'Error al cargar registros');
    renderTable([]);
  }
}

// Inicializar
$(document).ready(() => {
  cargarTodos();
});