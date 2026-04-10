// cajasDashboard.js
// Controlador del panel de Cajas
// Gestiona: sidebar, modales (add/edit, buscar, delete), tabla DataTables,
//           toasts, recolección de datos del DOM y llamadas a la API.

import { cajasApi } from '../api/cajasApi.js';


// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

// ─── Toast notifications ────────────────────────────────────────────────────
// Tipos: 'success' (verde), 'error' (rojo), 'warning' (naranja), 'info' (azul)
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
  requestAnimationFrame(() => {
    requestAnimationFrame(() => $toast.removeClass('translate-x-full').addClass('translate-x-0'));
  });
  setTimeout(() => {
    $toast.removeClass('translate-x-0').addClass('translate-x-full opacity-0');
    setTimeout(() => $toast.remove(), 300);
  }, 3500);
}

// Shorthand helpers
function toastSuccess(msg) { showToast(msg, 'success'); }
function toastError(msg)   { showToast(msg, 'error'); }

// ─── Extraer mensaje del backend ────────────────────────────────────────────
// El backend responde { success, message, data? }
// Los errores capturados por cajasApi llegan como Error(message)
function extractMessage(resp, fallback) {
  return resp?.message || fallback;
}

// ─── Abrir / cerrar un modal genérico (por refs DOM) ────────────────────────
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

// Sidebar
const menuToggle     = document.getElementById('menu-toggle');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Modal caja (add / edit)
const modalCaja        = document.getElementById('modalCaja');
const modalCajaContent = document.getElementById('modalCajaContent');

// Modal buscar
const modalBuscar        = document.getElementById('modalBuscar');
const modalBuscarContent = document.getElementById('modalBuscarContent');

// Modal delete
const modalConfirmDelete = document.getElementById('modalConfirmDelete');
const deleteContent      = modalConfirmDelete.querySelector('.delete-content');


// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

function toggleSidebar() {
  sidebar.classList.toggle('-translate-x-full');
  sidebarOverlay.classList.toggle('hidden');
}
if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', toggleSidebar);
}


// ═════════════════════════════════════════════════════════════════════════════
//  TABLA — renderizado y DataTables
// ═════════════════════════════════════════════════════════════════════════════

// DataTables: idioma español completo
// NOTA: "search" se renombra a "Filtrar Tabla:" para distinguirlo del botón "Buscar"
//       que abre el modal de búsqueda por etiqueta/ID
const DT_LANG = {
  decimal:      '',
  emptyTable:   'No hay datos disponibles en la tabla',
  info:         'Mostrando _START_ a _END_ de _TOTAL_ registros',
  infoEmpty:    'Mostrando 0 a 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros totales)',
  thousands:    ',',
  lengthMenu:   'Mostrar _MENU_ registros',
  loadingRecords: 'Cargando...',
  processing:   'Procesando...',
  search:       'Filtrar Tabla:',
  zeroRecords:  'No se encontraron registros coincidentes',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' },
  aria:     { sortAscending: ': activar para ordenar ascendente', sortDescending: ': activar para ordenar descendente' }
};

// Dibuja (o redibuja) la tabla con los datos proporcionados.
// Cada fila almacena los campos originales en data-* attributes.
function renderTable(data) {
  console.log('[renderTable] Pintando tabla con', data.length, 'filas');
  const tbody = $('#tablaCajasBody');
  tbody.empty();

  // Destruir instancia DataTable previa
  if ($.fn.DataTable.isDataTable('#tablaCajas')) {
    $('#tablaCajas').DataTable().destroy();
  }

  data.forEach(row => {
    const isActive = Number(row.estado) === 1;
    const stockVal = row.stock ?? 0;
    const tr = `
      <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
          data-caja-id="${row.caja_id}"
          data-letra="${row.letra}"
          data-cara="${row.cara}"
          data-nivel="${row.nivel}"
          data-etiqueta="${row.etiqueta}"
          data-stock="${stockVal}"
          data-estado="${row.estado}">
        <td class="py-3 px-4 text-textMuted text-sm">${row.caja_id}</td>
        <td class="py-3 px-4 font-semibold text-primary">${row.etiqueta}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${stockVal > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
            <i class="fa-solid ${stockVal > 0 ? 'fa-cubes' : 'fa-cube'} text-[10px]"></i>
            ${stockVal} items
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <label class="relative inline-flex items-center cursor-pointer" title="${isActive ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'}">
            <input type="checkbox" class="sr-only peer toggle-checkbox" ${isActive ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all toggle-label peer-checked:bg-green-400"></div>
          </label>
        </td>
        <td class="py-3 px-4">
          <div class="flex justify-center items-center gap-3">
            <button class="btn-modificar text-secondary hover:text-primary transition-colors focus:outline-none" title="Modificar">
              <i class="fa-solid fa-pencil text-lg"></i>
            </button>
            <button class="btn-eliminar text-danger/70 hover:text-danger transition-colors focus:outline-none" title="Desactivar">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    tbody.append(tr);
  });

  // Reinicializar DataTables
  $('#tablaCajas').DataTable({
    language: DT_LANG,
    columnDefs: [{ orderable: false, targets: [3, 4] }],
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    order: [[0, 'asc']],
  });
}


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL CAJA — Añadir / Modificar
// ═════════════════════════════════════════════════════════════════════════════

let modalCajaMode = 'add'; // 'add' | 'edit'

function openModalCaja()  { openModal(modalCaja, modalCajaContent); }
function closeModalCaja() { closeModal(modalCaja, modalCajaContent); }

// ─── Preview de etiqueta ────────────────────────────────────────────────────
function updateEtiquetaPreview() {
  const l1 = $('#modalLetra1').val() || '';
  const l2 = $('#modalLetra2').val() || '';
  const letra = l1 + l2;
  const caraVal  = $('#modalCara').val();
  const nivelVal = $('#modalNivel').val();

  const caraText  = caraVal === '1' ? 'FRENTE' : caraVal === '2' ? 'ATRAS' : '--';
  const nivelText = nivelVal === '1' ? 'ARRIBA' : nivelVal === '2' ? 'ABAJO' : '--';
  const letraText = letra || '--';

  const complete = (letra !== '' && caraVal !== '' && nivelVal !== '');
  $('#etiquetaPreview')
    .text(`caja ${letraText} ${caraText} ${nivelText}`)
    .toggleClass('text-primary bg-blue-50 border-secondary/40', complete)
    .toggleClass('text-textMuted bg-gray-50 border-gray-300', !complete);
}

$('#modalLetra1, #modalLetra2, #modalCara, #modalNivel').on('change', updateEtiquetaPreview);

// ─── Abrir modal: Añadir ────────────────────────────────────────────────────
$('#btnAnadirCaja').on('click', function () {
  console.log('[Dashboard] Click en botón #btnAnadirCaja');
  modalCajaMode = 'add';
  $('#modalCajaTitle').html('<i class="fa-solid fa-box-open"></i> Añadir Nueva Caja');
  $('#btnAccionCaja').html('<i class="fa-solid fa-check"></i> Agregar');
  $('#formCaja')[0].reset();
  $('#modalCajaId').val('');
  updateEtiquetaPreview();
  openModalCaja();
});

// ─── Abrir modal: Modificar (lee data-* de la fila) ─────────────────────────
$('#tablaCajas').on('click', '.btn-modificar', function () {
  const $row   = $(this).closest('tr');
  const cajaId = $row.data('caja-id');
  const letra  = String($row.data('letra'));
  const cara   = String($row.data('cara'));
  const nivel  = String($row.data('nivel'));

  console.log('[Dashboard] Click en .btn-modificar — datos recolectados de la fila <tr>:', { cajaId, letra, cara, nivel });

  modalCajaMode = 'edit';
  $('#modalCajaId').val(cajaId);
  $('#modalLetra1').val(letra.length >= 1 ? letra[0] : '');
  $('#modalLetra2').val(letra.length >= 2 ? letra[1] : '');
  $('#modalCara').val(cara);
  $('#modalNivel').val(nivel);

  $('#modalCajaTitle').html('<i class="fa-solid fa-pencil"></i> Modificar Caja');
  $('#btnAccionCaja').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');
  updateEtiquetaPreview();
  openModalCaja();
});

// ─── Cerrar modal caja ──────────────────────────────────────────────────────
$('.btn-close-caja, #modalCajaBackdrop').on('click', closeModalCaja);

// ─── Acción: Agregar / Guardar cambios ──────────────────────────────────────
$('#btnAccionCaja').on('click', async function () {
  const l1 = $('#modalLetra1').val();
  const l2 = $('#modalLetra2').val();
  const letra = (l1 + l2).toUpperCase();
  const cara  = $('#modalCara').val();
  const nivel = $('#modalNivel').val();

  console.log('[Dashboard] Datos recolectados de #modalLetra1, #modalLetra2, #modalCara, #modalNivel:', { letra, cara, nivel });

  // Validación frontend
  if (!l1)    { toastError('Selecciona al menos la primera letra.'); return; }
  if (!cara)  { toastError('Selecciona una cara.'); return; }
  if (!nivel) { toastError('Selecciona un nivel.'); return; }

  try {
    if (modalCajaMode === 'add') {
      // ── INSERT ──
      console.log('[Dashboard] Modo ADD — datos enviados a cajasApi.insert:', { letra, cara, nivel });
      const resp = await cajasApi.insert({ letra, cara: Number(cara), nivel: Number(nivel) });
      console.log('[Dashboard] Respuesta de cajasApi.insert:', resp);
      toastSuccess(extractMessage(resp, 'Caja añadida correctamente'));
    } else {
      // ── UPDATE ──
      const cajaId = $('#modalCajaId').val();
      console.log('[Dashboard] Modo EDIT — datos enviados a cajasApi.update:', { caja_id: cajaId, letra, cara, nivel });
      const resp = await cajasApi.update({ caja_id: Number(cajaId), letra, cara: Number(cara), nivel: Number(nivel) });
      console.log('[Dashboard] Respuesta de cajasApi.update:', resp);
      toastSuccess(extractMessage(resp, 'Caja modificada correctamente'));
    }

    closeModalCaja();
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error en operación insert/update:', err);
    toastError(err.message || 'Error en la operación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL BUSCAR — por Etiqueta / por ID
// ═════════════════════════════════════════════════════════════════════════════

let buscarMode = 'etiqueta'; // 'etiqueta' | 'id'

function openModalBuscar()  { openModal(modalBuscar, modalBuscarContent); }
function closeModalBuscar() { closeModal(modalBuscar, modalBuscarContent); }

// ─── Preview de etiqueta en modal buscar ────────────────────────────────────
function updateBuscarPreview() {
  const l1 = $('#buscarLetra1').val() || '';
  const l2 = $('#buscarLetra2').val() || '';
  const letra = l1 + l2;
  const cara  = $('#buscarCara').val()  || '--';
  const nivel = $('#buscarNivel').val() || '--';
  const letraText = letra || '--';
  $('#buscarEtiquetaPreview').text(`caja ${letraText} ${cara} ${nivel}`);
}

$('#buscarLetra1, #buscarLetra2, #buscarCara, #buscarNivel').on('change', updateBuscarPreview);

// ─── Tabs ───────────────────────────────────────────────────────────────────
$('#tabBuscarEtiqueta').on('click', function () {
  buscarMode = 'etiqueta';
  $(this).addClass('border-primary text-primary').removeClass('border-transparent text-textMuted');
  $('#tabBuscarId').addClass('border-transparent text-textMuted').removeClass('border-primary text-primary');
  $('#panelBuscarEtiqueta').removeClass('hidden');
  $('#panelBuscarId').addClass('hidden');
  console.log('[Dashboard] Tab búsqueda cambiada a: etiqueta');
});

$('#tabBuscarId').on('click', function () {
  buscarMode = 'id';
  $(this).addClass('border-primary text-primary').removeClass('border-transparent text-textMuted');
  $('#tabBuscarEtiqueta').addClass('border-transparent text-textMuted').removeClass('border-primary text-primary');
  $('#panelBuscarId').removeClass('hidden');
  $('#panelBuscarEtiqueta').addClass('hidden');
  console.log('[Dashboard] Tab búsqueda cambiada a: id');
});

// ─── Abrir modal buscar ─────────────────────────────────────────────────────
$('#btnBuscarEtiqueta').on('click', function () {
  console.log('[Dashboard] Click en botón #btnBuscarEtiqueta — abriendo modal de búsqueda');
  $('#buscarLetra1, #buscarLetra2, #buscarCara, #buscarNivel').val('');
  $('#buscarIdInput').val('');
  updateBuscarPreview();
  $('#tabBuscarEtiqueta').trigger('click');
  openModalBuscar();
});

// ─── Cerrar modal buscar ────────────────────────────────────────────────────
$('.btn-close-buscar, #modalBuscarBackdrop').on('click', closeModalBuscar);

// ─── Acción: Buscar ─────────────────────────────────────────────────────────
$('#btnAccionBuscar').on('click', async function () {
  try {
    if (buscarMode === 'etiqueta') {
      const l1 = $('#buscarLetra1').val();
      const l2 = $('#buscarLetra2').val();
      const letra = l1 + l2;
      const cara  = $('#buscarCara').val();
      const nivel = $('#buscarNivel').val();

      console.log('[Dashboard] Datos recolectados de #buscarLetra1, #buscarLetra2, #buscarCara, #buscarNivel:', { letra, cara, nivel });

      if (!l1)    { toastError('Selecciona al menos la primera letra.'); return; }
      if (!cara)  { toastError('Selecciona una cara.'); return; }
      if (!nivel) { toastError('Selecciona un nivel.'); return; }

      const etiqueta = `caja ${letra} ${cara} ${nivel}`;
      console.log('[Dashboard] Datos enviados a cajasApi.buscar:', { etiqueta });

      const resp = await cajasApi.buscar({ etiqueta });
      console.log('[Dashboard] Respuesta de cajasApi.buscar:', resp);

      const data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
      if (data.length) {
        renderTable(data);
        toastSuccess(`Se encontraron ${data.length} resultado(s)`);
      } else {
        showToast('No se encontraron cajas con esa etiqueta', 'warning');
      }

    } else {
      // Búsqueda por ID
      const id = $('#buscarIdInput').val();
      console.log('[Dashboard] Dato recolectado de #buscarIdInput:', id);

      if (!id || parseInt(id) < 1) { toastError('Ingresa un ID válido.'); return; }

      console.log('[Dashboard] Datos enviados a cajasApi.buscar:', { id: parseInt(id) });
      const resp = await cajasApi.buscar({ id: parseInt(id) });
      console.log('[Dashboard] Respuesta de cajasApi.buscar:', resp);

      const data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
      if (data.length) {
        renderTable(data);
        toastSuccess(`Caja encontrada: ${data[0].etiqueta}`);
      } else {
        showToast('No se encontró ninguna caja con ese ID', 'warning');
      }
    }
    closeModalBuscar();

  } catch (err) {
    console.error('[Dashboard] Error en búsqueda:', err);
    toastError(err.message || 'Error en la búsqueda');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DELETE — confirmar desactivación
// ═════════════════════════════════════════════════════════════════════════════

function openDeleteModal()  { openModal(modalConfirmDelete, deleteContent); }
function closeDeleteModal() { closeModal(modalConfirmDelete, deleteContent); }

// ─── Abrir (captura caja_id y etiqueta de la fila) ──────────────────────────
$('#tablaCajas').on('click', '.btn-eliminar', function () {
  const $row     = $(this).closest('tr');
  const cajaId   = $row.data('caja-id');
  const etiqueta = $row.data('etiqueta');
  console.log('[Dashboard] Click en .btn-eliminar — datos recolectados de <tr>:', { cajaId, etiqueta });
  $('#deleteCajaId').val(cajaId);
  $('#deleteEtiquetaInfo').text(etiqueta);
  openDeleteModal();
});

// ─── Cancelar ───────────────────────────────────────────────────────────────
$('.btn-cancelar-delete').on('click', closeDeleteModal);

// ─── Confirmar desactivación ────────────────────────────────────────────────
$('#btnConfirmarDelete').on('click', async function () {
  const cajaId = $('#deleteCajaId').val();
  console.log('[Dashboard] Dato recolectado de #deleteCajaId:', cajaId);
  console.log('[Dashboard] Datos enviados a cajasApi.setState:', { caja_id: cajaId, estado: 0 });

  try {
    const resp = await cajasApi.setState({ caja_id: Number(cajaId), estado: 0 });
    console.log('[Dashboard] Respuesta de cajasApi.setState:', resp);
    toastSuccess(extractMessage(resp, 'Caja desactivada con éxito'));
    closeDeleteModal();
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error al desactivar:', err);
    toastError(err.message || 'Error al desactivar la caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE DE ESTADO (switch en tabla)
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaCajas').on('change', '.toggle-checkbox', async function () {
  const $row       = $(this).closest('tr');
  const cajaId     = $row.data('caja-id');
  const isChecked  = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle    = $(this);

  console.log('[Dashboard] Toggle .toggle-checkbox cambiado — datos recolectados de <tr>:', { cajaId });
  console.log('[Dashboard] Datos enviados a cajasApi.setState:', { caja_id: cajaId, estado: nuevoEstado });

  try {
    const resp = await cajasApi.setState({ caja_id: Number(cajaId), estado: nuevoEstado });
    console.log('[Dashboard] Respuesta de cajasApi.setState:', resp);

    if (isChecked) {
      toastSuccess('La caja ahora está Activa');
    } else {
      showToast('La caja ahora está Inactiva', 'warning');
    }

  } catch (err) {
    console.error('[Dashboard] Error al cambiar estado:', err);
    toastError(err.message || 'Error al cambiar estado');
    // Revertir toggle visual
    $toggle.prop('checked', !isChecked);
  }
});

// ─── Poblar selects de letra (A-Z) ─────────────────────────────────────────
function poblarSelectsLetra() {
  const selects = [
    '#modalLetra1', '#modalLetra2',
    '#buscarLetra1', '#buscarLetra2'
  ];
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  selects.forEach(sel => {
    const $el = $(sel);
    const defaultText = $el.find('option:first').text(); // preserva "--" o "(opcional)"
    $el.empty().append(`<option value="">${defaultText}</option>`);
    letras.forEach(l => $el.append(`<option value="${l}">${l}</option>`));
  });

  console.log('[Dashboard] Selects de letra poblados con A-Z');
}


// ═════════════════════════════════════════════════════════════════════════════
//  CARGAR TODOS LOS REGISTROS
// ═════════════════════════════════════════════════════════════════════════════

async function cargarTodos() {
  console.log('[Dashboard] Llamando cajasApi.getAll...');
  try {
    const resp = await cajasApi.getAll();
    console.log('[Dashboard] Respuesta de cajasApi.getAll:', resp);

    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
    toastSuccess(`Se cargaron ${data.length} cajas`);

  } catch (err) {
    console.error('[Dashboard] Error al cargar registros:', err);
    toastError(err.message || 'Error al cargar registros');
    renderTable([]);
  }
}

$('#btnCargarRegistros').on('click', function () {
  console.log('[Dashboard] Click en botón #btnCargarRegistros');
  cargarTodos();
});


// ═════════════════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

console.log('[Dashboard] cajasDashboard.js cargado');
console.log('[Dashboard] Cargando registros iniciales...');
cargarTodos();
poblarSelectsLetra();