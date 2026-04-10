// unidadesApi.js
// Módulo API para comunicación con /api/unidades
//
// ┌──────────────────────┬──────────┬─────────────────────────────────────┐
// │ Método               │ HTTP     │ Endpoint                            │
// ├──────────────────────┼──────────┼─────────────────────────────────────┤
// │ getAll()             │ GET      │ /api/unidades/get_all               │
// │ getById(id)          │ GET      │ /api/unidades/por_id/:id            │
// │ getByNombre(nombre)  │ GET      │ /api/unidades/por_nombre/:nombre    │
// │ insert(data)         │ POST     │ /api/unidades/insert                │
// │ update(data)         │ POST     │ /api/unidades/update                │
// │ setState(data)       │ POST     │ /api/unidades/set_state             │
// └──────────────────────┴──────────┴─────────────────────────────────────┘

const BASE = '/api/unidades';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[unidadesApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[unidadesApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[unidadesApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const unidadesApi = {

  // SP: unidades_get_all → [{ unidad_id, nombre }]
  async getAll() {
    console.log('[unidadesApi.getAll] Solicitando todas las unidades...');
    const json = await request(`${BASE}/get_all`);
    console.log('[unidadesApi.getAll] Datos recibidos:', json);
    return json;
  },

  // SP: unidades_get_by_id → { unidad_id, nombre }
  async getById(unidadId) {
    console.log(`[unidadesApi.getById] Buscando unidad con id: ${unidadId}`);
    const json = await request(`${BASE}/por_id/${unidadId}`);
    console.log('[unidadesApi.getById] Datos recibidos:', json);
    return json;
  },

  // SP: unidades_get_by_nombre → [{ unidad_id, nombre }]
  async getByNombre(nombre) {
    console.log(`[unidadesApi.getByNombre] Buscando unidad: ${nombre}`);
    const json = await request(`${BASE}/por_nombre/${encodeURIComponent(nombre)}`);
    console.log('[unidadesApi.getByNombre] Datos recibidos:', json);
    return json;
  },

  // SP: unidades_insert(@nombre) → { unidad_id, nombre }
  async insert({ nombre }) {
    const body = { nombre };
    console.log('[unidadesApi.insert] Datos enviados:', body);
    const json = await request(`${BASE}/insert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[unidadesApi.insert] Datos recibidos:', json);
    return json;
  },

  // SP: unidades_update(@unidad_id, @nombre) → { unidad_id, nombre }
  async update({ unidad_id, nombre }) {
    const body = { unidad_id: Number(unidad_id), nombre };
    console.log('[unidadesApi.update] Datos enviados:', body);
    const json = await request(`${BASE}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[unidadesApi.update] Datos recibidos:', json);
    return json;
  },

  // SP: unidades_set_state(@unidad_id, @estado) → (confirmación)
  async setState({ unidad_id, estado }) {
    const body = { unidad_id: Number(unidad_id), estado: Number(estado) };
    console.log('[unidadesApi.setState] Datos enviados:', body);
    const json = await request(`${BASE}/set_state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[unidadesApi.setState] Datos recibidos:', json);
    return json;
  }
};

export { unidadesApi };