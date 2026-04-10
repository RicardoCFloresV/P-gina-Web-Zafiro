// usuariosDashboard.js
// Controlador del panel de Usuarios (Super Admin)
// Dos tablas: Administradores (tipo=1) y Usuarios (tipo=2)
// Modales: Añadir, Editar nombre/email, Cambiar contraseña, Buscar, Desactivar

import { usuariosApi } from '../api/usuariosApi.js';


// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

const TIPO_LABELS = { 1: 'Administrador', 2: 'Usuario' };
const TIPO_BADGE  = { 1: 'bg-amber-100 text-amber-700', 2: 'bg-blue-100 text-blue-700' };

function tipoLabel(t) { return TIPO_LABELS[t] || `Tipo ${t}`; }
function tipoBadge(t) { return TIPO_BADGE[t] || 'bg-gray-100 text-gray-600'; }

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
function extractMessage(resp, fb) { return resp?.message || fb; }

function openModal(c, cn) { c.classList.remove('opacity-0','invisible'); c.classList.add('opacity-100','visible'); cn.classList.remove('translate-y-[-20px]'); cn.classList.add('translate-y-0'); }
function closeModal(c, cn) { c.classList.remove('opacity-100','visible'); c.classList.add('opacity-0','invisible'); cn.classList.remove('translate-y-0'); cn.classList.add('translate-y-[-20px]'); }


// ═════════════════════════════════════════════════════════════════════════════
//  DOM REFS
// ═════════════════════════════════════════════════════════════════════════════

const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const mAnadir = document.getElementById('modalAnadir');
const mAnadirC = document.getElementById('modalAnadirContent');
const mEditName = document.getElementById('modalEditName');
const mEditNameC = document.getElementById('modalEditNameContent');
const mPassword = document.getElementById('modalPassword');
const mPasswordC = document.getElementById('modalPasswordContent');
const mBuscar = document.getElementById('modalBuscar');
const mBuscarC = document.getElementById('modalBuscarContent');
const mDelete = document.getElementById('modalConfirmDelete');
const mDeleteC = mDelete.querySelector('.delete-content');


// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════

function toggleSidebar() { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); }
if (menuToggle && sidebar) { menuToggle.addEventListener('click', toggleSidebar); sidebarOverlay.addEventListener('click', toggleSidebar); }


// ═════════════════════════════════════════════════════════════════════════════
//  TABLA — DataTables config
// ═════════════════════════════════════════════════════════════════════════════

const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles', info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
  infoEmpty: 'Mostrando 0 a 0 de 0 registros', infoFiltered: '(filtrado de _MAX_ registros totales)',
  thousands: ',', lengthMenu: 'Mostrar _MENU_ registros', loadingRecords: 'Cargando...', processing: 'Procesando...',
  search: 'Filtrar Tabla:', zeroRecords: 'No se encontraron registros coincidentes',
  paginate: { first: 'Primero', last: 'Último', next: 'Siguiente', previous: 'Anterior' },
  aria: { sortAscending: ': ordenar ascendente', sortDescending: ': ordenar descendente' }
};

// Builds row HTML used by both tables
function buildRow(row) {
  const tipo = Number(row.tipo);
  return `
    <tr class="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
        data-usuario-id="${row.usuario_id}" data-nombre="${row.nombre}" data-email="${row.email}" data-tipo="${tipo}">
      <td class="py-3 px-4 text-textMuted text-sm">${row.usuario_id}</td>
      <td class="py-3 px-4 font-semibold text-primary">${row.nombre}</td>
      <td class="py-3 px-4 text-textMuted text-sm">${row.email}</td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tipoBadge(tipo)}">
          <i class="fa-solid ${tipo === 1 ? 'fa-user-shield' : 'fa-user'} text-[10px]"></i>
          ${tipoLabel(tipo)}
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <label class="relative inline-flex items-center cursor-pointer" title="Cambiar estado">
          <input type="checkbox" class="sr-only peer toggle-checkbox" checked>
          <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all toggle-label peer-checked:bg-green-400"></div>
        </label>
      </td>
      <td class="py-3 px-4">
        <div class="flex justify-center items-center gap-2">
          <button class="btn-edit-name text-secondary hover:text-primary transition-colors focus:outline-none" title="Editar nombre/email"><i class="fa-solid fa-pencil text-base"></i></button>
          <button class="btn-change-pwd text-accent hover:text-accent-dark transition-colors focus:outline-none" title="Cambiar contraseña"><i class="fa-solid fa-key text-base"></i></button>
          <button class="btn-change-tipo text-purple-400 hover:text-purple-600 transition-colors focus:outline-none" title="Cambiar rol"><i class="fa-solid fa-arrows-rotate text-base"></i></button>
          <button class="btn-eliminar text-danger/70 hover:text-danger transition-colors focus:outline-none" title="Desactivar"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
      </td>
    </tr>
  `;
}

function renderTables(allData) {
  const admins = allData.filter(u => Number(u.tipo) === 1);
  const users  = allData.filter(u => Number(u.tipo) === 2);

  // ── Admins table ──
  const tbodyA = $('#tablaAdminsBody');
  tbodyA.empty();
  if ($.fn.DataTable.isDataTable('#tablaAdmins')) $('#tablaAdmins').DataTable().destroy();
  admins.forEach(r => tbodyA.append(buildRow(r)));
  $('#tablaAdmins').DataTable({ language: DT_LANG, columnDefs: [{ orderable: false, targets: [3, 4, 5] }], pageLength: 10, lengthMenu: [5, 10, 25], order: [[0, 'asc']] });

  // ── Users table ──
  const tbodyU = $('#tablaUsuariosBody');
  tbodyU.empty();
  if ($.fn.DataTable.isDataTable('#tablaUsuarios')) $('#tablaUsuarios').DataTable().destroy();
  users.forEach(r => tbodyU.append(buildRow(r)));
  $('#tablaUsuarios').DataTable({ language: DT_LANG, columnDefs: [{ orderable: false, targets: [3, 4, 5] }], pageLength: 10, lengthMenu: [5, 10, 25], order: [[0, 'asc']] });

  console.log(`[Dashboard] Renderizado: ${admins.length} admins, ${users.length} usuarios`);
}


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL: AÑADIR USUARIO
// ═════════════════════════════════════════════════════════════════════════════

$('#btnAnadirUsuario').on('click', () => { $('#formAnadir')[0].reset(); openModal(mAnadir, mAnadirC); });
$('.btn-close-anadir, #modalAnadirBackdrop').on('click', () => closeModal(mAnadir, mAnadirC));

$('#formAnadir').on('submit', async function (e) {
  e.preventDefault();
  const nombre = $('#addNombre').val().trim();
  const email = $('#addEmail').val().trim();
  const tipo = $('#addTipo').val();
  const contrasena = $('#addPassword').val();

  if (!nombre || !email || !tipo || !contrasena) { toastError('Todos los campos son obligatorios.'); return; }

  try {
    const resp = await usuariosApi.insert({ nombre, contrasena, email, tipo: Number(tipo) });
    toastSuccess(extractMessage(resp, 'Usuario creado'));
    closeModal(mAnadir, mAnadirC);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al crear usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL: EDITAR NOMBRE / EMAIL
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('click', '.btn-edit-name', function () {
  const $row = $(this).closest('tr');
  const id = $row.data('usuario-id');
  const nombre = $row.data('nombre');
  const email = $row.data('email');
  $('#editNameUserId').val(id);
  $('#editNombre').val(nombre);
  $('#editEmail').val(email);
  openModal(mEditName, mEditNameC);
});
$('.btn-close-editname, #modalEditNameBackdrop').on('click', () => closeModal(mEditName, mEditNameC));

$('#formEditName').on('submit', async function (e) {
  e.preventDefault();
  const usuario_id = $('#editNameUserId').val();
  const nuevo_nombre = $('#editNombre').val().trim();
  const nuevo_email = $('#editEmail').val().trim();
  if (!nuevo_nombre || !nuevo_email) { toastError('Nombre y email son obligatorios.'); return; }

  try {
    const resp = await usuariosApi.changeName({ usuario_id: Number(usuario_id), nuevo_nombre, nuevo_email });
    toastSuccess(extractMessage(resp, 'Datos actualizados'));
    closeModal(mEditName, mEditNameC);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al actualizar datos');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL: CAMBIAR CONTRASEÑA
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('click', '.btn-change-pwd', function () {
  const $row = $(this).closest('tr');
  const id = $row.data('usuario-id');
  const nombre = $row.data('nombre');
  $('#pwdUserId').val(id);
  $('#pwdUserInfo').text(`Cambiando contraseña para: ${nombre} (ID: ${id})`);
  $('#pwdNueva').val('');
  openModal(mPassword, mPasswordC);
});
$('.btn-close-password, #modalPasswordBackdrop').on('click', () => closeModal(mPassword, mPasswordC));

$('#formPassword').on('submit', async function (e) {
  e.preventDefault();
  const usuario_id = $('#pwdUserId').val();
  const nueva_contrasena = $('#pwdNueva').val();
  if (!nueva_contrasena) { toastError('La contraseña es obligatoria.'); return; }

  try {
    const resp = await usuariosApi.updatePassword({ usuario_id: Number(usuario_id), nueva_contrasena });
    toastSuccess(extractMessage(resp, 'Contraseña actualizada'));
    closeModal(mPassword, mPasswordC);
  } catch (err) {
    toastError(err.message || 'Error al cambiar contraseña');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  ACCIÓN: CAMBIAR TIPO (toggle admin ↔ usuario)
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('click', '.btn-change-tipo', async function () {
  const $row = $(this).closest('tr');
  const id = $row.data('usuario-id');
  const currentTipo = Number($row.data('tipo'));
  const nuevoTipo = currentTipo === 1 ? 2 : 1;
  const label = tipoLabel(nuevoTipo);

  console.log('[Dashboard] Cambiando tipo:', { id, de: currentTipo, a: nuevoTipo });

  try {
    const resp = await usuariosApi.setTipo({ usuario_id: Number(id), tipo_usuario_id: nuevoTipo });
    toastSuccess(extractMessage(resp, `Rol cambiado a ${label}`));
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al cambiar rol');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL: BUSCAR USUARIO
// ═════════════════════════════════════════════════════════════════════════════

$('#btnBuscarUsuario').on('click', () => { $('#formBuscar')[0].reset(); openModal(mBuscar, mBuscarC); });
$('.btn-close-buscar, #modalBuscarBackdrop').on('click', () => closeModal(mBuscar, mBuscarC));

$('#formBuscar').on('submit', async function (e) {
  e.preventDefault();
  const nombre = $('#searchNombre').val().trim() || null;
  const email = $('#searchEmail').val().trim() || null;
  if (!nombre && !email) { toastError('Ingresa al menos un criterio de búsqueda.'); return; }

  try {
    const resp = await usuariosApi.getByNombre({ nombre, email });
    const data = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
    if (data.length) {
      renderTables(data);
      toastSuccess(`Se encontraron ${data.length} resultado(s)`);
    } else {
      showToast('No se encontraron usuarios con ese criterio', 'warning');
    }
    closeModal(mBuscar, mBuscarC);
  } catch (err) {
    toastError(err.message || 'Error en la búsqueda');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DELETE
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const id = $row.data('usuario-id');
  const nombre = $row.data('nombre');
  $('#deleteUserId').val(id);
  $('#deleteNombreInfo').text(`${nombre} (ID: ${id})`);
  openModal(mDelete, mDeleteC);
});

$('.btn-cancelar-delete').on('click', () => closeModal(mDelete, mDeleteC));

$('#btnConfirmarDelete').on('click', async function () {
  const userId = $('#deleteUserId').val();
  try {
    const resp = await usuariosApi.setState({ usuario_id: Number(userId), estado: 0 });
    toastSuccess(extractMessage(resp, 'Usuario desactivado'));
    closeModal(mDelete, mDeleteC);
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al desactivar');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE ESTADO
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('change', '.toggle-checkbox', async function () {
  const $row = $(this).closest('tr');
  const id = $row.data('usuario-id');
  const isChecked = $(this).is(':checked');
  const nuevoEstado = isChecked ? 1 : 0;
  const $toggle = $(this);

  try {
    await usuariosApi.setState({ usuario_id: Number(id), estado: nuevoEstado });
    if (isChecked) toastSuccess('Usuario activado');
    else showToast('Usuario desactivado', 'warning');
    await cargarTodos();
  } catch (err) {
    toastError(err.message || 'Error al cambiar estado');
    $toggle.prop('checked', !isChecked);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  CARGAR TODOS
// ═════════════════════════════════════════════════════════════════════════════

async function cargarTodos() {
  try {
    const resp = await usuariosApi.getAll();
    const data = Array.isArray(resp.data) ? resp.data : [];
    renderTables(data);
    toastSuccess(`Se cargaron ${data.length} usuarios`);
  } catch (err) {
    toastError(err.message || 'Error al cargar usuarios');
    renderTables([]);
  }
}

$('#btnCargarRegistros').on('click', () => cargarTodos());


// ═════════════════════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════════════════════

console.log('[Dashboard] usuariosDashboard.js cargado');
cargarTodos();