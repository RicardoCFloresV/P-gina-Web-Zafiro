// stockApi.js
// Módulo API para comunicación con /api/stock
//
// ┌──────────────────────────┬──────────┬──────────────────────────────────────────┐
// │ Método                   │ HTTP     │ Endpoint                                 │
// ├──────────────────────────┼──────────┼──────────────────────────────────────────┤
// │ agregar(data)            │ POST     │ /api/stock/agregar                       │
// │ retirar(data)            │ POST     │ /api/stock/retirar                       │
// │ establecer(data)         │ POST     │ /api/stock/establecer                    │
// │ getDetallePorCaja()      │ GET      │ /api/stock/detalle_por_caja              │
// │ getConteo(cajaId?)       │ GET      │ /api/stock/conteo/:caja_id?              │
// └──────────────────────────┴──────────┴──────────────────────────────────────────┘

const BASE = '/api/stock';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[stockApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[stockApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[stockApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const stockApi = {

  // SP: productos_add_stock(@caja_id, @producto_id, @cantidad) → (confirmación)
  // Agrega stock a un producto en una caja específica (acumula si ya existe)
  async agregar({ caja_id, producto_id, cantidad }) {
    const body = { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) };
    console.log('[stockApi.agregar] Datos enviados:', body);
    const json = await request(`${BASE}/agregar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[stockApi.agregar] Datos recibidos:', json);
    return json;
  },

  // SP: productos_remove_stock(@caja_id, @producto_id, @cantidad) → (confirmación)
  // Resta stock de un producto en una caja (elimina el registro si llega a 0)
  async retirar({ caja_id, producto_id, cantidad }) {
    const body = { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) };
    console.log('[stockApi.retirar] Datos enviados:', body);
    const json = await request(`${BASE}/retirar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[stockApi.retirar] Datos recibidos:', json);
    return json;
  },

  // SP: productos_set_stock(@caja_id, @producto_id, @cantidad) → (confirmación)
  // Establece el stock exacto de un producto en una caja
  async establecer({ caja_id, producto_id, cantidad }) {
    const body = { caja_id: Number(caja_id), producto_id: Number(producto_id), cantidad: Number(cantidad) };
    console.log('[stockApi.establecer] Datos enviados:', body);
    const json = await request(`${BASE}/establecer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[stockApi.establecer] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_detalle_por_caja → [{ producto_id, nombre, marca_nombre, precio,
  //     categoria_nombre, presentacion_nombre, caja_ubicacion, unidad_nombre, unidad_valor, stock }]
  async getDetallePorCaja() {
    console.log('[stockApi.getDetallePorCaja] Solicitando detalle de stock por caja...');
    const json = await request(`${BASE}/detalle_por_caja`);
    console.log('[stockApi.getDetallePorCaja] Datos recibidos:', json);
    return json;
  },

  // SP: productos_get_count_by_caja_id → [{ caja_id, etiqueta, cantidad_productos }]
  // Si cajaId es null/undefined, retorna conteo de todas las cajas
  async getConteo(cajaId = null) {
    const url = cajaId ? `${BASE}/conteo/${cajaId}` : `${BASE}/conteo`;
    console.log(`[stockApi.getConteo] Solicitando conteo${cajaId ? ` para caja ${cajaId}` : ' general'}...`);
    const json = await request(url);
    console.log('[stockApi.getConteo] Datos recibidos:', json);
    return json;
  }
};

export { stockApi };