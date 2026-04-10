// presentacionesApi.js
// Módulo API para comunicación con /api/presentaciones
//
// ┌──────────────────────┬──────────┬─────────────────────────────────────────┐
// │ Método               │ HTTP     │ Endpoint                                │
// ├──────────────────────┼──────────┼─────────────────────────────────────────┤
// │ getAll()             │ GET      │ /api/presentaciones/get_all             │
// │ getById(id)          │ GET      │ /api/presentaciones/por_id/:id          │
// │ getByNombre(nombre)  │ GET      │ /api/presentaciones/por_nombre/:nombre  │
// │ insert(data)         │ POST     │ /api/presentaciones/insert              │
// │ update(data)         │ POST     │ /api/presentaciones/update              │
// │ setState(data)       │ POST     │ /api/presentaciones/set_state           │
// └──────────────────────┴──────────┴─────────────────────────────────────────┘

const BASE = '/api/presentaciones';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[presentacionesApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[presentacionesApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; throw new Error(msg); }
  if (json.success === false) { throw new Error(json.message || 'Error en la operación'); }
  return json;
}

export const presentacionesApi = {
  // SP: presentaciones_get_all() → [{ presentacion_id, nombre, estado }]
  async getAll() {
    console.log('[presentacionesApi.getAll] Solicitando todas las presentaciones...');
    const json = await request(`${BASE}/get_all`);
    console.log('[presentacionesApi.getAll] Datos recibidos:', json);
    return json;
  },

  // SP: presentaciones_get_by_id(@presentacion_id) → { presentacion_id, nombre, estado }
  async getById(presentacionId) {
    console.log(`[presentacionesApi.getById] Solicitando ID: ${presentacionId}`);
    const json = await request(`${BASE}/por_id/${presentacionId}`);
    console.log('[presentacionesApi.getById] Datos recibidos:', json);
    return json;
  },

  // SP: presentaciones_get_by_name(@nombre) → [{ presentacion_id, nombre, estado }]
  async getByNombre(nombre) {
    const url = `${BASE}/por_nombre/${encodeURIComponent(nombre)}`;
    console.log(`[presentacionesApi.getByNombre] Solicitando nombre: ${nombre}`);
    const json = await request(url);
    console.log('[presentacionesApi.getByNombre] Datos recibidos:', json);
    return json;
  },

  // SP: presentaciones_insert(@nombre) → { presentacion_id, nombre }
  async insert({ nombre }) {
    const body = { nombre };
    console.log('[presentacionesApi.insert] Datos enviados:', body);
    const json = await request(`${BASE}/insert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[presentacionesApi.insert] Datos recibidos:', json);
    return json;
  },

  // SP: presentaciones_update(@presentacion_id, @nombre) → { presentacion_id, nombre }
  async update({ presentacion_id, nombre }) {
    const body = { presentacion_id: Number(presentacion_id), nombre };
    console.log('[presentacionesApi.update] Datos enviados:', body);
    const json = await request(`${BASE}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[presentacionesApi.update] Datos recibidos:', json);
    return json;
  },

  // SP: presentaciones_set_state(@presentacion_id, @estado) → (confirmación)
  async setState({ presentacion_id, estado }) {
    const body = { presentacion_id: Number(presentacion_id), estado: Number(estado) };
    console.log('[presentacionesApi.setState] Datos enviados:', body);
    const json = await request(`${BASE}/set_state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[presentacionesApi.setState] Datos recibidos:', json);
    return json;
  }
};