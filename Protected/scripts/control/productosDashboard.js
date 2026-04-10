// productosDashboard.js
// Controlador del panel de Productos (Admin)
// Dos vistas: DataTable administrativa + Box Cards para ubicación visual de stock

import { productosApi } from '../api/productosApi.js';

// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

function showToast(message, isError = false) {
  const bgColor = isError ? '#a5230c' : '#2d4778';
  const icon    = isError ? 'fa-circle-exclamation' : 'fa-check-circle';
  const html = `<div class="toast-message" style="position:fixed;bottom:20px;right:20px;background:${bgColor};color:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:9999;display:flex;align-items:center;gap:10px;font-family:'Open Sans',sans-serif;"><i class="fa-solid ${icon}"></i><span style="font-weight:600;">${message}</span></div>`;
  const $t = $(html).appendTo('body');
  setTimeout(() => { $t.fadeOut(400, function () { $(this).remove(); }); }, 3000);
}

function openModal(el)  { $(el).addClass('active'); }
function closeModal(el) { $(el).removeClass('active'); }
function toArr(resp) { return Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []); }

// ═════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════
const menuToggle = document.getElementById('menu-toggle');
const sidebar    = document.getElementById('sidebar');
if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'), document.getElementById('sidebar-overlay')?.classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target) && window.innerWidth <= 992)
      sidebar.classList.add('-translate-x-full'); document.getElementById('sidebar-overlay')?.classList.add('hidden');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  CACHES para selects (se llenan al inicio)
// ═════════════════════════════════════════════════════════════════════════════
let cacheCategorias = [];
let cacheUnidades = [];
let cachePresentaciones = [];
let cacheMarcas = [];
let cacheCajas = [];

async function loadAllSelects() {
  console.log('[Dashboard] Cargando catálogos para selects...');
  try {
    const [catResp, uniResp, preResp, marResp, cajResp] = await Promise.all([
      productosApi.fetchCategorias(),
      productosApi.fetchUnidades(),
      productosApi.fetchPresentaciones(),
      productosApi.fetchMarcas(),
      productosApi.fetchCajasAll(),
    ]);
    cacheCategorias    = toArr(catResp);
    cacheUnidades      = toArr(uniResp);
    cachePresentaciones = toArr(preResp);
    cacheMarcas        = toArr(marResp);
    cacheCajas         = toArr(cajResp);
    console.log('[Dashboard] Catálogos cargados:', {
      categorias: cacheCategorias.length, unidades: cacheUnidades.length,
      presentaciones: cachePresentaciones.length, marcas: cacheMarcas.length, cajas: cacheCajas.length
    });
  } catch (err) {
    console.error('[Dashboard] Error cargando catálogos:', err);
    showToast('Error al cargar catálogos auxiliares', true);
  }
}

// Pobla un <select> desde un array de objetos {id_field, nombre}
function fillSelect(selector, data, idField, labelField = 'nombre', placeholder = 'Seleccione...') {
  const $el = $(selector);
  $el.empty().append(`<option value="">${placeholder}</option>`);
  data.forEach(item => $el.append(`<option value="${item[idField]}">${item[labelField]}</option>`));
}

// ─── Cascade de categorías (3 niveles) ──────────────────────────────────────
function fillCategoriaCascade(prefijo, nivel1Val, nivel2Val) {
  // nivel 1
  const nivel1 = cacheCategorias.filter(c => Number(c.nivel) === 1);
  fillSelect(`#${prefijo}CategoriaPrincipal`, nivel1, 'categoria_id', 'nombre', 'Cat. Principal...');

  // nivel 2 (hijos del seleccionado en nivel 1)
  const $sec = $(`#${prefijo}CategoriaSecundaria`);
  $sec.empty().append('<option value="">Cat. Secundaria...</option>');
  if (nivel1Val) {
    const nivel2 = cacheCategorias.filter(c => Number(c.nivel) === 2 && Number(c.categoria_padre_id) === Number(nivel1Val));
    nivel2.forEach(c => $sec.append(`<option value="${c.categoria_id}">${c.nombre}</option>`));
  }

  // nivel 3 (hijos del seleccionado en nivel 2)
  const $sub = $(`#${prefijo}Subcategoria`);
  $sub.empty().append('<option value="">Subcategoría...</option>');
  if (nivel2Val) {
    const nivel3 = cacheCategorias.filter(c => Number(c.nivel) === 3 && Number(c.categoria_padre_id) === Number(nivel2Val));
    nivel3.forEach(c => $sub.append(`<option value="${c.categoria_id}">${c.nombre}</option>`));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  DATATABLE LANG
// ═════════════════════════════════════════════════════════════════════════════
const DT_LANG = {
  decimal: '', emptyTable: 'No hay datos disponibles', info: 'Mostrando _START_ a _END_ de _TOTAL_',
  infoEmpty: '0 registros', infoFiltered: '(de _MAX_ total)', thousands: ',',
  lengthMenu: 'Mostrar _MENU_', loadingRecords: 'Cargando...', processing: 'Procesando...',
  search: 'Filtrar:', zeroRecords: 'Sin resultados',
  paginate: { first: 'Primero', last: 'Último', next: 'Sig.', previous: 'Ant.' },
  aria: { sortAscending: ': asc', sortDescending: ': desc' }
};

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN TABLE (View 1)
// ═════════════════════════════════════════════════════════════════════════════

function renderTable(data) {
  console.log('[renderTable] Pintando', data.length, 'productos');
  const tbody = $('#tablaProductosBody');
  tbody.empty();
  if ($.fn.DataTable.isDataTable('#tablaProductos')) $('#tablaProductos').DataTable().destroy();

  data.forEach(p => {
    const isActive = Number(p.estado) === 1;
    const stockBadge = (p.stock_total > 0)
      ? `<span style="background:#e7f6ec;color:#145a32;padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:600;">${p.stock_total}</span>`
      : `<span style="background:#f1f1ef;color:#888;padding:2px 8px;border-radius:12px;font-size:0.8rem;">0</span>`;

    const tr = `
      <tr data-producto-id="${p.producto_id}" data-nombre="${p.nombre}" data-estado="${p.estado}">
        <td>${p.producto_id}</td>
        <td style="font-weight:600;">${p.nombre}</td>
        <td>$${Number(p.precio).toFixed(2)}</td>
        <td>${p.categoria_nombre || '—'}</td>
        <td>${p.marca_nombre || '—'}</td>
        <td>${p.presentacion_nombre || '—'}</td>
        <td>${p.unidad_nombre || '—'} (${p.unidad_valor})</td>
        <td style="text-align:center;">${stockBadge}</td>
        <td style="text-align:center;">
          <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer;" title="Estado">
            <input type="checkbox" class="toggle-checkbox" style="position:absolute;opacity:0;width:0;height:0;" ${isActive ? 'checked' : ''}>
            <span style="width:40px;height:22px;background:${isActive ? '#68D391' : '#ccc'};border-radius:11px;position:relative;display:inline-block;transition:background .3s;">
              <span style="position:absolute;top:2px;left:${isActive ? '20px' : '2px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:left .3s;box-shadow:0 1px 3px rgba(0,0,0,.2);"></span>
            </span>
          </label>
        </td>
        <td style="text-align:center;">
          <div style="display:flex;justify-content:center;gap:6px;">
            <button class="btn-ver-cajas" title="Ver en cajas" style="background:none;border:none;cursor:pointer;color:#2d4778;font-size:1rem;"><i class="fa-solid fa-box-open"></i></button>
            <button class="btn-modificar" title="Editar" style="background:none;border:none;cursor:pointer;color:#648cbc;font-size:1rem;"><i class="fa-solid fa-pencil"></i></button>
            <button class="btn-eliminar" title="Desactivar" style="background:none;border:none;cursor:pointer;color:#a5230c;font-size:1.1rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </td>
      </tr>`;
    tbody.append(tr);
  });

  $('#tablaProductos').DataTable({ language: DT_LANG, columnDefs: [{ orderable: false, targets: [8, 9] }], pageLength: 15 });
}

// ═════════════════════════════════════════════════════════════════════════════
//  BOX CARDS (View 2) — visual representation of product location
// ═════════════════════════════════════════════════════════════════════════════

function renderBoxCards(productoId, productoNombre, detalles) {
  const $container = $('#boxCardsContainer');
  $container.empty();

  if (!detalles.length) {
    $container.html(`<p style="color:#737b90;text-align:center;padding:2rem;">El producto "${productoNombre}" no tiene stock en ninguna caja.</p>`);
    $('#boxCardsSection').removeClass('hidden');
    return;
  }

  // Header
  $container.append(`<p style="margin-bottom:1rem;font-weight:600;">Ubicaciones de: <span style="color:#2d4778;">${productoNombre}</span></p>`);

  const grid = $('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;"></div>');

  detalles.forEach(d => {
    const card = `
      <div class="box-card" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:box-shadow .2s;"
           data-caja-etiqueta="${d.caja_ubicacion}" data-stock="${d.stock}" data-producto-id="${productoId}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.8rem;">
          <i class="fa-solid fa-box" style="color:#2d4778;font-size:1.3rem;"></i>
          <span style="font-weight:700;font-size:0.95rem;">${d.caja_ubicacion}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:2rem;font-weight:700;color:#2d4778;">${d.stock}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn-box-add" data-producto-id="${productoId}" data-caja-etiqueta="${d.caja_ubicacion}" title="Agregar stock"
              style="width:32px;height:32px;border-radius:8px;border:1px solid #ddd;background:#f0f8f0;cursor:pointer;font-size:1rem;color:#2e7d32;display:flex;align-items:center;justify-content:center;">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button class="btn-box-remove" data-producto-id="${productoId}" data-caja-etiqueta="${d.caja_ubicacion}" data-stock="${d.stock}" title="Retirar stock"
              style="width:32px;height:32px;border-radius:8px;border:1px solid #ddd;background:#fef2f2;cursor:pointer;font-size:1rem;color:#a5230c;display:flex;align-items:center;justify-content:center;">
              <i class="fa-solid fa-minus"></i>
            </button>
          </div>
        </div>
        <div style="margin-top:0.6rem;font-size:0.8rem;color:#737b90;">
          ${d.marca_nombre || ''} · ${d.unidad_nombre || ''} ${d.unidad_valor || ''} · $${Number(d.precio).toFixed(2)}
        </div>
      </div>`;
    grid.append(card);
  });

  // "Add to new box" card
  grid.append(`
    <div class="btn-add-to-new-box" data-producto-id="${productoId}" style="background:#f9fafb;border:2px dashed #d0d0d0;border-radius:12px;padding:1.2rem;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;min-height:140px;"
         title="Colocar en otra caja">
      <i class="fa-solid fa-plus" style="font-size:1.5rem;color:#aaa;margin-bottom:0.5rem;"></i>
      <span style="font-size:0.85rem;color:#888;font-weight:600;">Agregar a otra caja</span>
    </div>`);

  $container.append(grid);
  $('#boxCardsSection').removeClass('hidden');
}


// ═════════════════════════════════════════════════════════════════════════════
//  CARGAR TODOS (admin: activos + inactivos)
// ═════════════════════════════════════════════════════════════════════════════

async function cargarTodos() {
  console.log('[Dashboard] Cargando todos los productos...');
  try {
    const resp = await productosApi.getAll();
    const data = toArr(resp);
    renderTable(data);
    showToast(`Se cargaron ${data.length} productos`);
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    showToast(err.message, true);
    renderTable([]);
  }
}

$('#btnCargarRegistros').on('click', () => cargarTodos());

// ═════════════════════════════════════════════════════════════════════════════
//  SEARCH MODAL
// ═════════════════════════════════════════════════════════════════════════════

$('#btnAbrirBuscar').on('click', async function () {
  console.log('[Dashboard] Abriendo modal de búsqueda');
  $('#formBuscar')[0].reset();
  // Poblar selects del modal búsqueda
  fillSelect('#searchCategoria', cacheCategorias.filter(c => Number(c.nivel) === 1), 'categoria_id');
  fillSelect('#searchMarca', cacheMarcas, 'marca_id');
  fillSelect('#searchUnidad', cacheUnidades, 'unidad_id');
  openModal('#modalBuscar');
});

$('#btnCloseBuscarModal, #btnCancelarBuscar').on('click', () => closeModal('#modalBuscar'));
$('#modalBuscar').on('click', function (e) { if (e.target === this) closeModal('#modalBuscar'); });

$('#formBuscar').on('submit', async function (e) {
  e.preventDefault();
  const id        = $('#searchId').val();
  const nombre    = $('#searchNombre').val().trim();
  const catId     = $('#searchCategoria').val();
  const marcaId   = $('#searchMarca').val();
  const unidadId  = $('#searchUnidad').val();

  console.log('[Dashboard] Búsqueda:', { id, nombre, catId, marcaId, unidadId });

  if (!id && !nombre && !catId && !marcaId && !unidadId) {
    showToast('Ingresa al menos un criterio de búsqueda.', true); return;
  }

  try {
    let data = [];
    if (id)        { data = toArr(await productosApi.getById(Number(id))); }
    else if (nombre)  { data = toArr(await productosApi.getByNombre(nombre)); }
    else if (catId)   { data = toArr(await productosApi.getByCategoria(Number(catId))); }
    else if (marcaId) { data = toArr(await productosApi.getByMarca(Number(marcaId))); }
    else if (unidadId){ data = toArr(await productosApi.getByUnidad(Number(unidadId))); }

    if (data.length) {
      renderTable(data);
      showToast(`${data.length} resultado(s)`);
    } else {
      showToast('Sin resultados', true);
    }
    closeModal('#modalBuscar');
  } catch (err) {
    console.error('[Dashboard] Error búsqueda:', err);
    showToast(err.message, true);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT MODAL
// ═════════════════════════════════════════════════════════════════════════════

let modalProductoMode = 'add';

function poblarModalProductoSelects() {
  fillCategoriaCascade('modal', null, null);
  fillSelect('#modalUnidad', cacheUnidades, 'unidad_id');
  fillSelect('#modalPresentacion', cachePresentaciones, 'presentacion_id');
  fillSelect('#modalMarca', cacheMarcas, 'marca_id');
  fillSelect('#modalCaja', cacheCajas, 'caja_id', 'etiqueta', 'Sin caja (crear sin stock)');
}

// Cascade: nivel 1 → 2
$('#modalCategoriaPrincipal').on('change', function () {
  fillCategoriaCascade('modal', $(this).val(), null);
});
// Cascade: nivel 2 → 3
$('#modalCategoriaSecundaria').on('change', function () {
  const $sub = $('#modalSubcategoria');
  $sub.empty().append('<option value="">Subcategoría...</option>');
  const nivel2Val = $(this).val();
  if (nivel2Val) {
    const nivel3 = cacheCategorias.filter(c => Number(c.nivel) === 3 && Number(c.categoria_padre_id) === Number(nivel2Val));
    nivel3.forEach(c => $sub.append(`<option value="${c.categoria_id}">${c.nombre}</option>`));
  }
});

// ─── Abrir: Añadir ──────────────────────────────────────────────────────────
$('#btnAnadirProducto').on('click', function () {
  console.log('[Dashboard] Click en #btnAnadirProducto');
  modalProductoMode = 'add';
  $('#modalProductoTitle').html('<i class="fa-solid fa-plus" style="margin-right:8px;"></i>Nuevo Producto');
  $('#btnAccionProducto').html('<i class="fa-solid fa-check"></i> Crear Producto');
  $('#formProducto')[0].reset();
  $('#modalProductoId').val('');
  $('#grupoStockInicial').show();
  poblarModalProductoSelects();
  openModal('#modalProducto');
});

// ─── Abrir: Editar (fetch por ID) ───────────────────────────────────────────
$('#tablaProductos').on('click', '.btn-modificar', async function () {
  const $row = $(this).closest('tr');
  const productoId = $row.data('producto-id');
  console.log('[Dashboard] Editar producto_id:', productoId);

  try {
    const resp = await productosApi.getById(productoId);
    const p = resp.data;
    if (!p) { showToast('Producto no encontrado', true); return; }

    modalProductoMode = 'edit';
    $('#modalProductoTitle').html('<i class="fa-solid fa-pencil" style="margin-right:8px;"></i>Editar Producto');
    $('#btnAccionProducto').html('<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios');
    $('#grupoStockInicial').hide();

    poblarModalProductoSelects();

    // Poblar campos
    $('#modalProductoId').val(p.producto_id);
    $('#modalNombre').val(p.nombre);
    $('#modalDescripcion').val(p.descripcion || '');
    $('#modalPrecio').val(p.precio);
    $('#modalUnidadValor').val(p.unidad_valor);

    // Selects
    $('#modalUnidad').val(p.unidad_id);
    $('#modalPresentacion').val(p.presentacion_id);
    $('#modalMarca').val(p.marca_id);

    // Cascade categorías: necesitamos encontrar la cadena padre
    // La API devuelve categoria_id (la hoja), necesitamos reconstruir
    const cat = cacheCategorias.find(c => c.categoria_id === p.categoria_id);
    if (cat) {
      if (Number(cat.nivel) === 1) {
        $('#modalCategoriaPrincipal').val(cat.categoria_id).trigger('change');
      } else if (Number(cat.nivel) === 2) {
        const padre = cacheCategorias.find(c => c.categoria_id === cat.categoria_padre_id);
        if (padre) $('#modalCategoriaPrincipal').val(padre.categoria_id);
        fillCategoriaCascade('modal', cat.categoria_padre_id, null);
        $('#modalCategoriaSecundaria').val(cat.categoria_id);
      } else if (Number(cat.nivel) === 3) {
        const padre2 = cacheCategorias.find(c => c.categoria_id === cat.categoria_padre_id);
        if (padre2) {
          const padre1 = cacheCategorias.find(c => c.categoria_id === padre2.categoria_padre_id);
          if (padre1) $('#modalCategoriaPrincipal').val(padre1.categoria_id);
          fillCategoriaCascade('modal', padre2.categoria_padre_id, padre2.categoria_id);
          $('#modalCategoriaSecundaria').val(padre2.categoria_id);
          // Rebuild subcategorías
          const nivel3 = cacheCategorias.filter(c => Number(c.nivel) === 3 && Number(c.categoria_padre_id) === Number(padre2.categoria_id));
          const $sub = $('#modalSubcategoria').empty().append('<option value="">Subcategoría...</option>');
          nivel3.forEach(c => $sub.append(`<option value="${c.categoria_id}">${c.nombre}</option>`));
          $('#modalSubcategoria').val(cat.categoria_id);
        }
      }
    }

    openModal('#modalProducto');
  } catch (err) {
    console.error('[Dashboard] Error fetch para editar:', err);
    showToast(err.message, true);
  }
});

// ─── Cerrar ─────────────────────────────────────────────────────────────────
$('#btnCloseProductoModal, #btnCancelarProducto').on('click', () => closeModal('#modalProducto'));
$('#modalProducto').on('click', function (e) { if (e.target === this) closeModal('#modalProducto'); });

// ─── Submit ─────────────────────────────────────────────────────────────────
$('#formProducto').on('submit', async function (e) {
  e.preventDefault();

  // Determinar categoría: la más específica seleccionada
  const subCat = $('#modalSubcategoria').val();
  const secCat = $('#modalCategoriaSecundaria').val();
  const priCat = $('#modalCategoriaPrincipal').val();
  const categoria_id = subCat || secCat || priCat;

  const payload = {
    nombre:          $('#modalNombre').val().trim(),
    descripcion:     $('#modalDescripcion').val().trim(),
    precio:          Number($('#modalPrecio').val()),
    categoria_id:    Number(categoria_id),
    unidad_id:       Number($('#modalUnidad').val()),
    unidad_valor:    Number($('#modalUnidadValor').val()),
    presentacion_id: Number($('#modalPresentacion').val()),
    marca_id:        Number($('#modalMarca').val()),
  };

  console.log('[Dashboard] Payload producto:', payload, 'modo:', modalProductoMode);

  if (!payload.nombre || !categoria_id || !payload.unidad_id || !payload.presentacion_id || !payload.marca_id) {
    showToast('Completa todos los campos obligatorios.', true); return;
  }

  try {
    if (modalProductoMode === 'add') {
      const cajaId = $('#modalCaja').val();
      const stock  = Number($('#modalStockInicial').val()) || 0;

      if (cajaId && stock > 0) {
        const resp = await productosApi.insertWithStock({ ...payload, caja_id: Number(cajaId), stock });
        console.log('[Dashboard] insertWithStock resp:', resp);
        showToast(resp.message || 'Producto creado con stock');
      } else {
        const resp = await productosApi.insertWithoutStock(payload);
        console.log('[Dashboard] insertWithoutStock resp:', resp);
        showToast(resp.message || 'Producto creado (sin stock)');
      }
    } else {
      payload.producto_id = Number($('#modalProductoId').val());
      const resp = await productosApi.update(payload);
      console.log('[Dashboard] update resp:', resp);
      showToast(resp.message || 'Producto actualizado');
    }

    closeModal('#modalProducto');
    await cargarTodos();
  } catch (err) {
    console.error('[Dashboard] Error submit producto:', err);
    showToast(err.message, true);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  TOGGLE ESTADO
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaProductos').on('change', '.toggle-checkbox', async function () {
  const $row = $(this).closest('tr');
  const productoId = $row.data('producto-id');
  const isChecked  = $(this).is(':checked');
  const $toggle    = $(this);

  console.log('[Dashboard] Toggle estado producto_id:', productoId, '→', isChecked ? 1 : 0);
  try {
    const resp = await productosApi.setState({ producto_id: Number(productoId), estado: isChecked ? 1 : 0 });
    showToast(resp.message);
    await cargarTodos();
  } catch (err) {
    showToast(err.message, true);
    $toggle.prop('checked', !isChecked);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  DEACTIVATE MODAL
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaProductos').on('click', '.btn-eliminar', function () {
  const $row = $(this).closest('tr');
  const id = $row.data('producto-id');
  const nombre = $row.data('nombre');
  console.log('[Dashboard] Desactivar producto:', id, nombre);
  $('#deleteProductoId').val(id);
  $('#deleteMessage').text(`¿Desactivar "${nombre}" (ID: ${id})? Si tiene stock, la operación será rechazada.`);
  openModal('#modalConfirmDelete');
});

$('.btn-cancelar-delete').on('click', () => closeModal('#modalConfirmDelete'));
$('#modalConfirmDelete').on('click', function (e) { if (e.target === this) closeModal('#modalConfirmDelete'); });

$('#btnConfirmarDelete').on('click', async function () {
  const id = $('#deleteProductoId').val();
  try {
    const resp = await productosApi.setState({ producto_id: Number(id), estado: 0 });
    showToast(resp.message);
    closeModal('#modalConfirmDelete');
    await cargarTodos();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  VIEW BOX CARDS (click from table row)
// ═════════════════════════════════════════════════════════════════════════════

$('#tablaProductos').on('click', '.btn-ver-cajas', async function () {
  const $row = $(this).closest('tr');
  const productoId = $row.data('producto-id');
  const nombre     = $row.data('nombre');
  console.log('[Dashboard] Ver cajas de producto:', productoId, nombre);

  try {
    const resp = await productosApi.getDetalleCaja(productoId);
    renderBoxCards(productoId, nombre, toArr(resp));
    // Scroll to cards
    document.getElementById('boxCardsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showToast(err.message, true);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  ADD TO BOX MODAL (from box cards "+" dashed card)
// ═════════════════════════════════════════════════════════════════════════════

$(document).on('click', '.btn-add-to-new-box', function () {
  const productoId = $(this).data('producto-id');
  console.log('[Dashboard] Agregar a nueva caja, producto_id:', productoId);
  $('#addBoxProductoId').val(productoId);
  fillSelect('#addBoxCaja', cacheCajas, 'caja_id', 'etiqueta', 'Seleccione caja...');
  $('#addBoxCantidad').val(1);
  openModal('#modalAddToBox');
});

$('#btnCloseAddBox, #btnCancelarAddBox').on('click', () => closeModal('#modalAddToBox'));
$('#modalAddToBox').on('click', function (e) { if (e.target === this) closeModal('#modalAddToBox'); });

$('#formAddToBox').on('submit', async function (e) {
  e.preventDefault();
  const productoId = Number($('#addBoxProductoId').val());
  const cajaId     = Number($('#addBoxCaja').val());
  const cantidad   = Number($('#addBoxCantidad').val());

  if (!cajaId || !cantidad || cantidad < 1) { showToast('Selecciona caja y cantidad.', true); return; }

  console.log('[Dashboard] addStock:', { caja_id: cajaId, producto_id: productoId, cantidad });
  try {
    const resp = await productosApi.addStock({ caja_id: cajaId, producto_id: productoId, cantidad });
    showToast(resp.message);
    closeModal('#modalAddToBox');
    // Refresh box cards
    const nombre = $(`tr[data-producto-id="${productoId}"]`).data('nombre') || '';
    const detResp = await productosApi.getDetalleCaja(productoId);
    renderBoxCards(productoId, nombre, toArr(detResp));
  } catch (err) {
    showToast(err.message, true);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  QUICK STOCK +/- (from box cards)
// ═════════════════════════════════════════════════════════════════════════════

// Find caja_id from etiqueta in cache
function cajaIdFromEtiqueta(etiqueta) {
  const c = cacheCajas.find(b => b.etiqueta === etiqueta);
  return c ? c.caja_id : null;
}

$(document).on('click', '.btn-box-add', async function () {
  const productoId = Number($(this).data('producto-id'));
  const etiqueta   = $(this).data('caja-etiqueta');
  const cajaId     = cajaIdFromEtiqueta(etiqueta);
  if (!cajaId) { showToast('Caja no encontrada en cache', true); return; }

  const cantidad = prompt(`¿Cuántas unidades agregar a "${etiqueta}"?`, '1');
  if (!cantidad || Number(cantidad) < 1) return;

  try {
    await productosApi.addStock({ caja_id: cajaId, producto_id: productoId, cantidad: Number(cantidad) });
    showToast(`+${cantidad} agregadas`);
    const nombre = $(`tr[data-producto-id="${productoId}"]`).data('nombre') || '';
    const resp = await productosApi.getDetalleCaja(productoId);
    renderBoxCards(productoId, nombre, toArr(resp));
    await cargarTodos();
  } catch (err) { showToast(err.message, true); }
});

$(document).on('click', '.btn-box-remove', async function () {
  const productoId = Number($(this).data('producto-id'));
  const etiqueta   = $(this).data('caja-etiqueta');
  const stockActual = Number($(this).data('stock'));
  const cajaId     = cajaIdFromEtiqueta(etiqueta);
  if (!cajaId) { showToast('Caja no encontrada en cache', true); return; }

  const cantidad = prompt(`¿Cuántas retirar de "${etiqueta}"? (stock actual: ${stockActual})`, '1');
  if (!cantidad || Number(cantidad) < 1) return;

  try {
    await productosApi.removeStock({ caja_id: cajaId, producto_id: productoId, cantidad: Number(cantidad) });
    showToast(`-${cantidad} retiradas`);
    const nombre = $(`tr[data-producto-id="${productoId}"]`).data('nombre') || '';
    const resp = await productosApi.getDetalleCaja(productoId);
    renderBoxCards(productoId, nombre, toArr(resp));
    await cargarTodos();
  } catch (err) { showToast(err.message, true); }
});


// ═════════════════════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════════════════════

console.log('[Dashboard] productosDashboard.js cargado');
(async () => {
  await loadAllSelects();
  await cargarTodos();
})();