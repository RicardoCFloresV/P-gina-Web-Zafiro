// productosApi.js
// Módulo API para comunicación con /api/productos y módulos auxiliares
//
// ┌───────────────────────────────┬──────────┬────────────────────────────────────────────┐
// │ Método                        │ HTTP     │ Endpoint                                   │
// ├───────────────────────────────┼──────────┼────────────────────────────────────────────┤
// │ getAll()                      │ GET      │ /api/productos/get_all                     │
// │ getWithoutStock()             │ GET      │ /api/productos/without_stock               │
// │ getById(id)                   │ GET      │ /api/productos/por_id/:id                  │
// │ getByNombre(nombre)           │ GET      │ /api/productos/por_nombre/:nombre          │
// │ getByCategoria(id)            │ GET      │ /api/productos/por_categoria/:id           │
// │ getByMarca(id)                │ GET      │ /api/productos/por_marca/:id               │
// │ getByUnidad(id)               │ GET      │ /api/productos/por_unidad/:id              │
// │ getDetalleCaja(productoId)    │ GET      │ /api/productos/detalle_caja/:id            │
// │ getCountByCaja(cajaId?)       │ GET      │ /api/productos/count_by_caja/:id?          │
// │ insertWithStock(data)         │ POST     │ /api/productos/insert_with_stock           │
// │ insertWithoutStock(data)      │ POST     │ /api/productos/insert_without_stock        │
// │ update(data)                  │ POST     │ /api/productos/update                      │
// │ setState(data)                │ POST     │ /api/productos/set_state                   │
// │ addStock(data)                │ POST     │ /api/productos/add_stock                   │
// │ removeStock(data)             │ POST     │ /api/productos/remove_stock                │
// │ setStock(data)                │ POST     │ /api/productos/set_stock                   │
// ├───────────────────────────────┼──────────┼────────────────────────────────────────────┤
// │ Cross-module helpers (para poblar selects)                                            │
// │ fetchCategorias()             │ GET      │ /api/categorias/get_all_active             │
// │ fetchCategoriasHijos(id)      │ GET      │ /api/categorias/hijos/:id                  │
// │ fetchUnidades()               │ GET      │ /api/unidades/get_all                      │
// │ fetchPresentaciones()         │ GET      │ /api/presentaciones/get_all                │
// │ fetchMarcas()                 │ GET      │ /api/marcas/get_all                        │
// │ fetchCajasAll()               │ GET      │ /api/cajas/get_all                         │
// └───────────────────────────────┴──────────┴────────────────────────────────────────────┘

const BASE = '/api/productos';
const NO_SERVER = 'No hay conexión con el servidor';

// ─── Helper central ─────────────────────────────────────────────────────────
async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[productosApi] Red error ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[productosApi] No-JSON ${url} (${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[productosApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

function post(url, body) {
  console.log(`[productosApi] POST ${url}:`, body);
  return request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function get(url) {
  console.log(`[productosApi] GET ${url}`);
  return request(url);
}


const productosApi = {

  // ═══════════════════════════════════════════════════════════════════
  //  READS
  // ═══════════════════════════════════════════════════════════════════

  // SP: productos_get_all → todos (admin, incluye inactivos)
  async getAll() {
    const json = await get(`${BASE}/get_all`);
    console.log('[productosApi.getAll] Recibidos:', json.data?.length, 'productos');
    return json;
  },

  // SP: productos_get_without_stock → solo activos (user view)
  async getWithoutStock() {
    const json = await get(`${BASE}/without_stock`);
    console.log('[productosApi.getWithoutStock] Recibidos:', json.data?.length, 'productos');
    return json;
  },

  // SP: productos_get_by_id → 1 producto + stock_total
  async getById(productoId) {
    const json = await get(`${BASE}/por_id/${productoId}`);
    console.log('[productosApi.getById] Recibido:', json.data);
    return json;
  },

  // SP: productos_get_by_nombre → LIKE search
  async getByNombre(nombre) {
    const json = await get(`${BASE}/por_nombre/${encodeURIComponent(nombre)}`);
    console.log('[productosApi.getByNombre] Recibidos:', json.data?.length);
    return json;
  },

  // SP: productos_get_by_categoria
  async getByCategoria(categoriaId) {
    const json = await get(`${BASE}/por_categoria/${categoriaId}`);
    console.log('[productosApi.getByCategoria] Recibidos:', json.data?.length);
    return json;
  },

  // SP: productos_get_by_marca
  async getByMarca(marcaId) {
    const json = await get(`${BASE}/por_marca/${marcaId}`);
    console.log('[productosApi.getByMarca] Recibidos:', json.data?.length);
    return json;
  },

  // SP: productos_get_by_unidad
  async getByUnidad(unidadId) {
    const json = await get(`${BASE}/por_unidad/${unidadId}`);
    console.log('[productosApi.getByUnidad] Recibidos:', json.data?.length);
    return json;
  },

  // SP: productos_get_detalle_por_caja → box cards (1 row per caja with stock)
  async getDetalleCaja(productoId) {
    const json = await get(`${BASE}/detalle_caja/${productoId}`);
    console.log('[productosApi.getDetalleCaja] Recibidos:', json.data?.length, 'cajas');
    return json;
  },

  // SP: productos_get_count_by_caja_id
  async getCountByCaja(cajaId = null) {
    const url = cajaId ? `${BASE}/count_by_caja/${cajaId}` : `${BASE}/count_by_caja`;
    const json = await get(url);
    console.log('[productosApi.getCountByCaja] Recibidos:', json.data?.length);
    return json;
  },

  // ═══════════════════════════════════════════════════════════════════
  //  WRITES
  // ═══════════════════════════════════════════════════════════════════

  // SP: productos_insert_with_stock
  async insertWithStock({ nombre, descripcion, precio, categoria_id, unidad_id, unidad_valor, presentacion_id, marca_id, caja_id, stock }) {
    const json = await post(`${BASE}/insert_with_stock`, {
      nombre, descripcion: descripcion || null, precio: Number(precio),
      categoria_id: Number(categoria_id), unidad_id: Number(unidad_id), unidad_valor: Number(unidad_valor),
      presentacion_id: Number(presentacion_id), marca_id: Number(marca_id),
      caja_id: Number(caja_id), stock: Number(stock)
    });
    console.log('[productosApi.insertWithStock] Respuesta:', json);
    return json;
  },

  // SP: productos_insert_without_stock
  async insertWithoutStock({ nombre, descripcion, precio, categoria_id, unidad_id, unidad_valor, presentacion_id, marca_id }) {
    const json = await post(`${BASE}/insert_without_stock`, {
      nombre, descripcion: descripcion || null, precio: Number(precio),
      categoria_id: Number(categoria_id), unidad_id: Number(unidad_id), unidad_valor: Number(unidad_valor),
      presentacion_id: Number(presentacion_id), marca_id: Number(marca_id)
    });
    console.log('[productosApi.insertWithoutStock] Respuesta:', json);
    return json;
  },

  // SP: productos_update
  async update({ producto_id, nombre, descripcion, precio, categoria_id, unidad_id, unidad_valor, presentacion_id, marca_id, estado }) {
    const body = {
      producto_id: Number(producto_id), nombre, descripcion: descripcion || null, precio: Number(precio),
      categoria_id: Number(categoria_id), unidad_id: Number(unidad_id), unidad_valor: Number(unidad_valor),
      presentacion_id: Number(presentacion_id), marca_id: Number(marca_id)
    };
    if (estado !== undefined && estado !== null) body.estado = Number(estado);
    const json = await post(`${BASE}/update`, body);
    console.log('[productosApi.update] Respuesta:', json);
    return json;
  },

  // SP: productos_set_state
  async setState({ producto_id, estado }) {
    const json = await post(`${BASE}/set_state`, { producto_id: Number(producto_id), estado: Number(estado) });
    console.log('[productosApi.setState] Respuesta:', json);
    return json;
  },

  // ═══════════════════════════════════════════════════════════════════
  //  STOCK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  // SP: productos_add_stock (place into box)
  async addStock({ caja_id, producto_id, cantidad }) {
    const json = await post(`${BASE}/add_stock`, { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) });
    console.log('[productosApi.addStock] Respuesta:', json);
    return json;
  },

  // SP: productos_remove_stock (pull from box)
  async removeStock({ caja_id, producto_id, cantidad }) {
    const json = await post(`${BASE}/remove_stock`, { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) });
    console.log('[productosApi.removeStock] Respuesta:', json);
    return json;
  },

  // SP: productos_set_stock (override)
  async setStock({ caja_id, producto_id, cantidad }) {
    const json = await post(`${BASE}/set_stock`, { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) });
    console.log('[productosApi.setStock] Respuesta:', json);
    return json;
  },

  // ═══════════════════════════════════════════════════════════════════
  //  CROSS-MODULE HELPERS (para poblar selects del formulario)
  // ═══════════════════════════════════════════════════════════════════

  // Categorías activas (nivel 1 para cascade inicial)
  async fetchCategorias() {
    const json = await get('/api/categorias/get_all_active');
    console.log('[productosApi.fetchCategorias] Recibidas:', json.data?.length);
    return json;
  },

  // Hijos de una categoría (para cascade nivel 2→3)
  async fetchCategoriasHijos(categoriaId) {
    const json = await get(`/api/categorias/hijos/${categoriaId}`);
    console.log('[productosApi.fetchCategoriasHijos] Hijos de', categoriaId, ':', json.data?.length);
    return json;
  },

  // Unidades activas
  async fetchUnidades() {
    const json = await get('/api/unidades/get_all');
    console.log('[productosApi.fetchUnidades] Recibidas:', json.data?.length);
    return json;
  },

  // Presentaciones activas
  async fetchPresentaciones() {
    const json = await get('/api/presentaciones/get_all');
    console.log('[productosApi.fetchPresentaciones] Recibidas:', json.data?.length);
    return json;
  },

  // Marcas activas
  async fetchMarcas() {
    const json = await get('/api/marcas/get_all');
    console.log('[productosApi.fetchMarcas] Recibidas:', json.data?.length);
    return json;
  },

  // Cajas activas (para select de ubicación)
  async fetchCajasAll() {
    const json = await get('/api/cajas/get_all');
    console.log('[productosApi.fetchCajasAll] Recibidas:', json.data?.length);
    return json;
  },
};

export { productosApi };