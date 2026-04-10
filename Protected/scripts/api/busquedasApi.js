// busquedasApi.js
// Módulo API para comunicación con /api/busquedas
// Búsquedas de productos por distintos criterios, con y sin stock
//
// ┌────────────────────────────────────┬──────────┬─────────────────────────────────────────────────┐
// │ Método                             │ HTTP     │ Endpoint                                        │
// ├────────────────────────────────────┼──────────┼─────────────────────────────────────────────────┤
// │ porNombre(nombre)                  │ GET      │ /api/busquedas/por_nombre/:nombre                │
// │ porCategoria(categoriaId)          │ GET      │ /api/busquedas/por_categoria/:categoria_id       │
// │ porMarca(marcaId)                  │ GET      │ /api/busquedas/por_marca/:marca_id               │
// │ porUnidad(unidadId)                │ GET      │ /api/busquedas/por_unidad/:unidad_id             │
// │ stockPorId(productoId)             │ GET      │ /api/busquedas/stock/por_id/:producto_id         │
// │ stockPorNombre(nombre)             │ GET      │ /api/busquedas/stock/por_nombre/:nombre          │
// │ stockPorCategoria(categoriaId)     │ GET      │ /api/busquedas/stock/por_categoria/:categoria_id │
// │ stockPorMarca(marcaId)             │ GET      │ /api/busquedas/stock/por_marca/:marca_id         │
// │ stockPorUnidad(unidadId)           │ GET      │ /api/busquedas/stock/por_unidad/:unidad_id       │
// └────────────────────────────────────┴──────────┴─────────────────────────────────────────────────┘

const BASE = '/api/busquedas';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[busquedasApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[busquedasApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[busquedasApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const busquedasApi = {

  // ═══════════════════════════════════════════════════════════════════
  //  BÚSQUEDAS SIN STOCK (todos los estados)
  // ═══════════════════════════════════════════════════════════════════

  // SP: productos_get_by_nombre → [{ producto_id, nombre, ... }]
  async porNombre(nombre) {
    console.log(`[busquedasApi.porNombre] Buscando productos: ${nombre}`);
    const json = await request(`${BASE}/por_nombre/${encodeURIComponent(nombre)}`);
    console.log('[busquedasApi.porNombre] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_categoria → [{ producto_id, nombre, ... }]
  async porCategoria(categoriaId) {
    console.log(`[busquedasApi.porCategoria] Buscando productos de categoría: ${categoriaId}`);
    const json = await request(`${BASE}/por_categoria/${categoriaId}`);
    console.log('[busquedasApi.porCategoria] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_marca → [{ producto_id, nombre, ... }]
  async porMarca(marcaId) {
    console.log(`[busquedasApi.porMarca] Buscando productos de marca: ${marcaId}`);
    const json = await request(`${BASE}/por_marca/${marcaId}`);
    console.log('[busquedasApi.porMarca] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_unidad → [{ producto_id, nombre, ... }]
  async porUnidad(unidadId) {
    console.log(`[busquedasApi.porUnidad] Buscando productos con unidad: ${unidadId}`);
    const json = await request(`${BASE}/por_unidad/${unidadId}`);
    console.log('[busquedasApi.porUnidad] Datos recibidos:', json);
    return json;
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BÚSQUEDAS CON STOCK (solo activos, incluye stock_total)
  // ═══════════════════════════════════════════════════════════════════

  // SP: productos_get_by_id_and_stock → { producto_id, ..., stock_total }
  async stockPorId(productoId) {
    console.log(`[busquedasApi.stockPorId] Buscando producto activo con stock, id: ${productoId}`);
    const json = await request(`${BASE}/stock/por_id/${productoId}`);
    console.log('[busquedasApi.stockPorId] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_nombre_and_stock → [{ producto_id, ..., stock_total }]
  async stockPorNombre(nombre) {
    console.log(`[busquedasApi.stockPorNombre] Buscando productos activos: ${nombre}`);
    const json = await request(`${BASE}/stock/por_nombre/${encodeURIComponent(nombre)}`);
    console.log('[busquedasApi.stockPorNombre] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_categoria_and_stock → [{ producto_id, ..., stock_total }]
  async stockPorCategoria(categoriaId) {
    console.log(`[busquedasApi.stockPorCategoria] Buscando productos activos de categoría: ${categoriaId}`);
    const json = await request(`${BASE}/stock/por_categoria/${categoriaId}`);
    console.log('[busquedasApi.stockPorCategoria] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_marca_and_stock → [{ producto_id, ..., stock_total }]
  async stockPorMarca(marcaId) {
    console.log(`[busquedasApi.stockPorMarca] Buscando productos activos de marca: ${marcaId}`);
    const json = await request(`${BASE}/stock/por_marca/${marcaId}`);
    console.log('[busquedasApi.stockPorMarca] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_by_unidad_and_stock → [{ producto_id, ..., stock_total }]
  async stockPorUnidad(unidadId) {
    console.log(`[busquedasApi.stockPorUnidad] Buscando productos activos con unidad: ${unidadId}`);
    const json = await request(`${BASE}/stock/por_unidad/${unidadId}`);
    console.log('[busquedasApi.stockPorUnidad] Datos recibidos:', json);
    return json;
  }
};

export { busquedasApi };