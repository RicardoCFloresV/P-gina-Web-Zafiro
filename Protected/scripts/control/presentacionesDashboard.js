// presentacionesDashboard.js
// Controlador del panel de Presentaciones

import { presentacionesApi } from '../api/presentacionesApi.js';

// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES Y TOASTS
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
  if(content) {
      content.classList.remove('translate-y-[-20px]', 'scale-95');
      content.classList.add('translate-y-0', 'scale-100');
  }
}
function closeModal(container, content) {
  container.classList.remove('opacity-100', 'visible');
  container.classList.add('opacity-0', 'invisible');
  if(content) {
      content.classList.remove('translate-y-0', 'scale-100');
      content.classList.add('translate-y-[-20px]', 'scale-95');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  REFERENCIAS DOM
// ═════════════════════════════════════════════════════════════════════════════
const menuToggle     = document.getElementById('menu-toggle');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const modalPresentacion        = document.getElementById('modalPresentacion');
const modalPresentacionContent = document.getElementById('modalPresentacionContent');

const modalConfirmDelete = document.getElementById('modalConfirmDelete');
const deleteContent      = modalConfirmDelete.querySelector('.delete-content');

// SIDEBAR
function toggleSidebar() { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); }
if (menuToggle && sidebar) { menuToggle.addEventListener('click', toggleSidebar); sidebarOverlay.addEventListener('click', toggleSidebar); }

// ═════════════════════════════════════════════════════════════════════════════
//  TABLA — DATATABLES
// ═════════════════════════════════════════════════════════════════════════════
const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles',
  info: 'Mostrando _START_ a _END_ de _TOTAL_ registros', infoEmpty: 'Mostrando 0 a 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros totales)', thousands: ',',
  lengthMenu: 'Mostrar _MENU_ registros', loadingRecords: 'Cargando...', processing: 'Procesando...',
  search: 'Buscar:', zeroRecords: 'No se encontraron registros coincidentes',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' }
};

function renderTable(data) {
  const tbody = $('#tablaPresentacionesBody');
  tbody.empty();
  if ($.fn.DataTable.isDataTable('#tablaPresentaciones')) { $('#tablaPresentaciones').DataTable().destroy(); }

  data.forEach(row => {
    const isActive = Number(row.estado ?? 1) === 1;
    const tr = `
      <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors" data-presentacion-id="${row.presentacion_id}" data-nombre="${row.nombre}" data-estado="${row.estado ?? 1}">
        <td class="py-3 px-4 text-textMuted text-sm">${row.presentacion_id}</td>
        <td class="py-3 px-4 font-semibold text-primary">${row.nombre}</td>
        <td class="py-3 px-4 text-center">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer toggle-checkbox" ${isActive ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
          </label>
        </td>
        <td class="py-3 px-4 text-center">
          <button class="btn-editar text-secondary hover:text-primary transition-colors bg-blue-50 hover:bg-blue-100 p-2 rounded-md" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
        </td>
      </tr>`;
    tbody.append(tr);
  });

  $('#tablaPresentaciones').DataTable({ language: DT_LANG, responsive: true, pageLength: 10, lengthMenu: [5, 10, 25, 50], order: [[0, 'desc']], columnDefs: [{ orderable: false, targets: [2, 3] }] });
}

async function cargarTodos() {
  try {
    const resp = await presentacionesApi.getAll();
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
    toastSuccess(`Se cargaron ${data.length} presentaciones`);
  } catch (err) {
    toastError(err.message || 'Error al cargar registros');
    renderTable([]);
  }
}
$('#btnCargarRegistros').on('click', cargarTodos);

// ═════════════════════════════════════════════════════════════════════════════
//  MODALES Y CRUD
// ═════════════════════════════════════════════════════════════════════════════
$('#btnNuevo').on('click', () => {
  $('#formPresentacion')[0].reset();
  $('#presentacionId').val('');
  $('#modalTitle').html('<i class="fa-solid fa-cubes mr-2"></i>Nueva Presentación');
  openModal(modalPresentacion, modalPresentacionContent);
});

$('.btn-cerrar-modal').on('click', function() {
  closeModal(modalPresentacion, modalPresentacionContent);
});

$('#formPresentacion').on('submit', async function(e) {
  e.preventDefault();
  const id = $('#presentacionId').val();
  const nombre = $('#nombre').val().trim();
  const payload = { nombre };

  try {
    if (id) {
      payload.presentacion_id = id;
      await presentacionesApi.update(payload);
      toastSuccess('Presentación actualizada correctamente');
    } else {
      await presentacionesApi.insert(payload);
      toastSuccess('Presentación creada correctamente');
    }
    closeModal(modalPresentacion, modalPresentacionContent);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al guardar la presentación');
  }
});

$('#tablaPresentacionesBody').on('click', '.btn-editar', function() {
  const $row = $(this).closest('tr');
  const id = $row.data('presentacion-id');
  const nombre = $row.data('nombre');
  
  $('#presentacionId').val(id);
  $('#nombre').val(nombre);
  $('#modalTitle').html('<i class="fa-solid fa-pen-to-square mr-2"></i>Editar Presentación');
  openModal(modalPresentacion, modalPresentacionContent);
});

$('#tablaPresentacionesBody').on('change', '.toggle-checkbox', async function() {
  const $row = $(this).closest('tr');
  const id = $row.data('presentacion-id');
  const isChecked = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle = $(this);

  if (!isChecked) {
      $toggle.prop('checked', true); // revertir visualmente para el confirm
      $('#deletePresentacionId').val(id);
      $('#deleteNombreInfo').text(`Presentación: ${$row.data('nombre')}`);
      openModal(modalConfirmDelete, deleteContent);
  } else {
      try {
        await presentacionesApi.setState({ presentacion_id: Number(id), estado: nuevoEstado });
        toastSuccess('Presentación activada');
        $row.data('estado', 1);
      } catch (err) {
        toastError(err.message || 'Error al cambiar estado');
        $toggle.prop('checked', false);
      }
  }
});

// Confirmar Desactivar
$('#btnConfirmarDelete').on('click', async function() {
  const id = $('#deletePresentacionId').val();
  try {
    await presentacionesApi.setState({ presentacion_id: Number(id), estado: 0 });
    toastSuccess('Presentación desactivada');
    closeModal(modalConfirmDelete, deleteContent);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al desactivar la presentación');
    closeModal(modalConfirmDelete, deleteContent);
  }
});

$('.btn-cancelar-delete').on('click', () => closeModal(modalConfirmDelete, deleteContent));

// Init
$(document).ready(() => cargarTodos());