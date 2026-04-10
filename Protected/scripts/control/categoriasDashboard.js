// categoriasDashboard.js
// Controlador del panel de Categorías
// Gestiona: sidebar, modales (add/edit, buscar, delete), tabla DataTables,
//           toasts, select dinámico de categoría padre, y llamadas a la API.

import { categoriasApi } from '../api/categoriasApi.js';


// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

const NIVEL_LABELS = { 1: 'Cat. Principal', 2: 'Cat. Secundaria', 3: 'Subcategoría' };
const NIVEL_COLORS = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-amber-100 text-amber-700',
};

function nivelLabel(n) { return NIVEL_LABELS[n] || `Nivel ${n}`; }
function nivelBadge(n) { return NIVEL_COLORS[n] || 'bg-gray-100 text-gray-600'; }

// ─── Toast notifications ────────────────────────────────────────────────────
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

function toastSuccess(msg) { showToast(msg, 'success'); }
function toastError(msg)   { showToast(msg, 'error'); }

function extractMessage(resp, fallback) {
  return resp?.message || fallback;
}

// ─── Modal helpers (Tailwind opacity/visibility) ────────────────────────────
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

const modalCategoria        = document.getElementById('modalCategoria');
const modalCategoriaContent = document.getElementById('modalCategoriaContent');

const modalBuscar        = document.getElementById('modalBuscarCategoria');
const modalBuscarContent = document.getElementById('modalBuscarContent');

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
//  CACHE de categorías activas (para poblar select de padre)
// ═════════════════════════════════════════════════════════════════════════════

let categoriasCache = [];

async function refreshCache() {
  try {
    const resp = await categoriasApi.getAllActive();
    categoriasCache = Array.isArray(resp.data) ? resp.data : [];
    console.log('[Dashboard] Cache de categorías activas actualizado:', categoriasCache.length, 'items');
  } catch (err) {
    console.error('[Dashboard] Error al refrescar cache:', err);
  }
}


// ═════════════════════════════════════════════════════════════════════════════
//  TABLA — renderizado con DataTables
// ═════════════════════════════════════════════════════════════════════════════

const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles en la tabla',
  info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
  infoEmpty: 'Mostrando 0 a 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros totales)',
  thousands: ',', lengthMenu: 'Mostrar _MENU_ registros',
  loadingRecords: 'Cargando...', processing: 'Procesando...',
  search: 'Filtrar Tabla:',
  zeroRecords: 'No se encontraron registros coincidentes',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' },
  aria: { sortAscending: ': activar para ordenar ascendente', sortDescending: ': activar para ordenar descendente' }
};

function renderTable(data) {
  console.log('[renderTable] Pintando tabla con', data.length, 'filas');
  const tbody = $('#tablaCategoriasBody');
  tbody.empty();

  if ($.fn.DataTable.isDataTable('#tablaCategorias')) {
    $('#tablaCategorias').DataTable().destroy();
  }

  data.forEach(row => {
    const isActive = Number(row.estado) === 1;
    const tr = `
      <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
          data-categoria-id="${row.categoria_id}"
          data-nombre="${row.nombre}"
          data-nivel="${row.nivel}"
          data-estado="${row.estado}"
          data-padre-id="${row.categoria_padre_id || ''}"
          data-nombre-padre="${row.nombre_padre || ''}">
        <td class="py-3 px-4 text-textMuted text-sm">${row.categoria_id}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${nivelBadge(row.nivel)}">
            <i class="fa-solid fa-layer-group text-[10px]"></i>
            ${nivelLabel(row.nivel)}
          </span>
        </td>
        <td class="py-3 px-4 font-semibold text-primary">${row.nombre}</td>
        <td class="py-3 px-4 text-textMuted text-sm">${row.nombre_padre || '—'}</td>
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

  $('#tablaCategorias').DataTable({
    language: DT_LANG,
    columnDefs: [{ orderable: false, targets: [4, 5] }],
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    order: [[0, 'asc']],
  });
}


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL CATEGORÍA — Añadir / Modificar
// ═════════════════════════════════════════════════════════════════════════════

let modalMode = 'add'; // 'add' | 'edit'

function openModalCategoria()  { openModal(modalCategoria, modalCategoriaContent); }
function closeModalCategoria() {
  closeModal(modalCategoria, modalCategoriaContent);
  $('#modalJerarquia').prop('disabled', false);
  $('#modalPadreId').prop('disabled', false);
}

// ─── Poblar select de padre según nivel elegido ─────────────────────────────
function poblarSelectPadre(nivelHijo) {
  const $padre = $('#modalPadreId');
  const $grupo = $('#grupoPadre');
  $padre.empty().append('<option value="">Seleccione la categoría padre</option>');

  if (Number(nivelHijo) === 1) {
    $grupo.addClass('hidden').removeClass('flex');
    return;
  }

  const nivelPadre = Number(nivelHijo) - 1;
  const padres = categoriasCache.filter(c => Number(c.nivel) === nivelPadre);
  console.log(`[Dashboard] Poblando select padre con ${padres.length} categorías de nivel ${nivelPadre}`);

  padres.forEach(p => {
    $padre.append(`<option value="${p.categoria_id}">${p.nombre}</option>`);
  });
  $grupo.removeClass('hidden').addClass('flex');
}

$('#modalJerarquia').on('change', function () {
  const nivel = $(this).val();
  console.log('[Dashboard] Cambio en #modalJerarquia:', nivel);
  poblarSelectPadre(nivel);
});

// ─── Abrir: Añadir ──────────────────────────────────────────────────────────
$('#btnAnadirCategoria').on('click', async function () {
  console.log('[Dashboard] Click en #btnAnadirCategoria');
  modalMode = 'add';
  $('#modalTitle').html('<i class="fa-solid fa-layer-group"></i> Añadir Nueva Categoría');
  $('#btnAccionModal').html('<i class="fa-solid fa-check"></i> Agregar');
  $('#formCategoria')[0].reset();
  $('#modalCategoriaId').val('');
  $('#modalJerarquia').prop('disabled', false);
  $('#modalPadreId').prop('disabled', false);
  $('#grupoPadre').addClass('hidden').removeClass('flex');

  await refreshCache();
  openModalCategoria();
});

// ─── Abrir: Modificar ───────────────────────────────────────────────────────
$('#tablaCategorias').on('click', '.btn-modificar', async function () {
  const $row = $(this).closest('tr');
  const categoriaId = $row.data('categoria-id');
  console.log('[Dashboard] Click en .btn-modificar — categoria_id:', categoriaId);

  try {
    const resp = await categoriasApi.getById(categoriaId);
    const cat = resp.data;
    console.log('[Dashboard] Datos recibidos del servidor para editar:', cat);

    if (!cat) { toastError('No se encontró la categoría'); return; }

    modalMode = 'edit';
    $('#modalTitle').html('<i class="fa-solid fa-pencil"></i> Modificar Categoría');
    $('#btnAccionModal').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');

    $('#modalCategoriaId').val(cat.categoria_id);
    $('#modalJerarquia').val(cat.nivel).prop('disabled', true);
    $('#modalNombre').val(cat.nombre);

    await refreshCache();
    poblarSelectPadre(cat.nivel);
    if (cat.categoria_padre_id) {
      $('#modalPadreId').val(cat.categoria_padre_id);
    }
    $('#modalPadreId').prop('disabled', true);

    openModalCategoria();

  } catch (err) {
    console.error('[Dashboard] Error al obtener categoría para editar:', err);
    toastError(err.message || 'Error al obtener datos');
  }
});

// ─── Cerrar modal ───────────────────────────────────────────────────────────
$('.btn-close-categoria, #modalCategoriaBackdrop').on('click', closeModalCategoria);

// ─── Submit: Agregar o Guardar cambios ──────────────────────────────────────
$('#formCategoria').on('submit', async function (e) {
  e.preventDefault();

  const nombre  = $('#modalNombre').val().trim();
  const nivel   = $('#modalJerarquia').val();
  const padreId = $('#modalPadreId').val() || null;

  console.log('[Dashboard] Datos recolectados:', { nombre, nivel, padreId });

  if (!nombre) { toastError('El nombre es obligatorio.'); return; }

  try {
    if (modalMode === 'add') {
      if (!nivel) { toastError('Selecciona una jerarquía.'); return; }
      if (Number(nivel) > 1 && !padreId) { toastError('Selecciona la categoría padre.'); return; }

      const payload = { nombre, nivel: Number(nivel), categoria_padre_id: padreId ? Number(padreId) : null };
      console.log('[Dashboard] Modo ADD — enviando a categoriasApi.insert:', payload);
      const resp = await categoriasApi.insert(payload);
      console.log('[Dashboard] Respuesta:', resp);
      toastSuccess(extractMessage(resp, 'Categoría creada correctamente'));

    } else {
      const categoriaId = $('#modalCategoriaId').val();
      const payload = { categoria_id: Number(categoriaId), nombre };
      console.log('[Dashboard] Modo EDIT — enviando a categoriasApi.update:', payload);
      const resp = await categoriasApi.update(payload);
      console.log('[Dashboard] Respuesta:', resp);
      toastSuccess(extractMessage(resp, 'Categoría actualizada correctamente'));
    }

    closeModalCategoria();
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error en insert/update:', err);
    toastError(err.message || 'Error en la operación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL BUSCAR — por Jerarquía, ID, o Nombre
// ═════════════════════════════════════════════════════════════════════════════

function openModalBuscar()  { openModal(modalBuscar, modalBuscarContent); }
function closeModalBuscar() { closeModal(modalBuscar, modalBuscarContent); }

$('#btnAbrirBuscarCategoria').on('click', function () {
  console.log('[Dashboard] Click en #btnAbrirBuscarCategoria');
  $('#formBuscarCategoria')[0].reset();
  openModalBuscar();
});

$('.btn-close-buscar, #modalBuscarBackdrop').on('click', closeModalBuscar);

$('#formBuscarCategoria').on('submit', async function (e) {
  e.preventDefault();

  const jerarquia = $('#searchJerarquia').val();
  const id        = $('#searchId').val();
  const nombre    = $('#searchNombre').val().trim();

  console.log('[Dashboard] Búsqueda:', { jerarquia, id, nombre });

  if (!jerarquia && !id && !nombre) {
    toastError('Ingresa al menos un criterio de búsqueda.');
    return;
  }

  try {
    let data = [];

    // Prioridad: ID > Nombre > Nivel
    if (id) {
      console.log(`[Dashboard] Buscando por ID: ${id}`);
      const resp = await categoriasApi.getById(Number(id));
      data = resp.data ? [resp.data] : [];

    } else if (nombre) {
      console.log(`[Dashboard] Buscando por nombre: ${nombre}`);
      const resp = await categoriasApi.getByName(nombre);
      data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);

    } else if (jerarquia) {
      console.log(`[Dashboard] Buscando por nivel: ${jerarquia}`);
      const resp = await categoriasApi.getByNivel(Number(jerarquia));
      data = Array.isArray(resp.data) ? resp.data : [];
    }

    console.log('[Dashboard] Resultados de búsqueda:', data);

    if (data.length) {
      renderTable(data);
      toastSuccess(`Se encontraron ${data.length} resultado(s)`);
    } else {
      showToast('No se encontraron categorías con ese criterio', 'warning');
    }

    closeModalBuscar();

  } catch (err) {
    console.error('[Dashboard] Error en búsqueda:', err);
    toastError(err.message || 'Error en la búsqueda');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DELETE — Confirmar desactivación
// ═════════════════════════════════════════════════════════════════════════════

function openDeleteModal()  { openModal(modalConfirmDelete, deleteContent); }
function closeDeleteModal() { closeModal(modalConfirmDelete, deleteContent); }

$('#tablaCategorias').on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const categoriaId = $row.data('categoria-id');
  const nombre      = $row.data('nombre');
  console.log('[Dashboard] Click en .btn-eliminar:', { categoriaId, nombre });
  $('#deleteCategoriaId').val(categoriaId);
  $('#deleteNombreInfo').text(`${nombre} (ID: ${categoriaId})`);
  openDeleteModal();
});

$('.btn-cancelar-delete').on('click', closeDeleteModal);

$('#btnConfirmarDelete').on('click', async function () {
  const categoriaId = $('#deleteCategoriaId').val();
  console.log('[Dashboard] Confirmando desactivación:', categoriaId);

  try {
    const resp = await categoriasApi.setState({ categoria_id: Number(categoriaId), estado: 0 });
    console.log('[Dashboard] Respuesta:', resp);
    toastSuccess(extractMessage(resp, 'Categoría desactivada'));
    closeDeleteModal();
    await cargarTodos();

  } catch (err) {
    console.error('[Dashboard] Error al desactivar:', err);
    toastError(err.message || 'Error al desactivar');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE DE ESTADO (switch en tabla)
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaCategorias').on('change', '.toggle-checkbox', async function () {
  const $row        = $(this).closest('tr');
  const categoriaId = $row.data('categoria-id');
  const isChecked   = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle     = $(this);

  console.log('[Dashboard] Toggle estado:', { categoriaId, nuevoEstado });

  try {
    const resp = await categoriasApi.setState({ categoria_id: Number(categoriaId), estado: nuevoEstado });
    console.log('[Dashboard] Respuesta:', resp);

    if (isChecked) {
      toastSuccess('Categoría activada');
    } else {
      showToast('Categoría desactivada', 'warning');
    }

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
  console.log('[Dashboard] Llamando categoriasApi.getAll...');
  try {
    const resp = await categoriasApi.getAll();
    console.log('[Dashboard] Respuesta:', resp);
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTable(data);
    toastSuccess(`Se cargaron ${data.length} categorías`);
  } catch (err) {
    console.error('[Dashboard] Error al cargar registros:', err);
    toastError(err.message || 'Error al cargar registros');
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

console.log('[Dashboard] categoriasDashboard.js cargado');
console.log('[Dashboard] Cargando registros iniciales...');
cargarTodos();