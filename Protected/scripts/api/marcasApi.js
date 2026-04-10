// marcasApi.js
// Módulo API para comunicación con /api/marcas
//
// ┌──────────────────┬──────────┬──────────────────────────────────┐
// │ Método           │ HTTP     │ Endpoint                         │
// ├──────────────────┼──────────┼──────────────────────────────────┤
// │ getAll()         │ GET      │ /api/marcas/get_all              │
// │ getById(id)      │ GET      │ /api/marcas/por_id/:marca_id     │
// │ insert(data)     │ POST     │ /api/marcas/insert               │
// │ update(data)     │ POST     │ /api/marcas/update               │
// │ setState(data)   │ POST     │ /api/marcas/set_state            │
// └──────────────────┴──────────┴──────────────────────────────────┘

const BASE = '/api/marcas';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[marcasApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[marcasApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[marcasApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const marcasApi = {

  // SP: marcas_get_all → [{ marca_id, nombre }]
  async getAll() {
    console.log('[marcasApi.getAll] Solicitando todas las marcas...');
    const json = await request(`${BASE}/get_all`);
    console.log('[marcasApi.getAll] Datos recibidos:', json);
    return json;
  },

  // SP: marcas_get_by_id → { marca_id, nombre }
  async getById(marcaId) {
    console.log(`[marcasApi.getById] Buscando marca con id: ${marcaId}`);
    const json = await request(`${BASE}/por_id/${marcaId}`);
    console.log('[marcasApi.getById] Datos recibidos:', json);
    return json;
  },

  // SP: marcas_insert(@nombre) → { marca_id, nombre }
  async insert({ nombre }) {
    const body = { nombre };
    console.log('[marcasApi.insert] Datos enviados:', body);
    const json = await request(`${BASE}/insert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[marcasApi.insert] Datos recibidos:', json);
    return json;
  },

  // SP: marcas_update(@marca_id, @nombre) → { marca_id, nombre }
  async update({ marca_id, nombre }) {
    const body = { marca_id: Number(marca_id), nombre };
    console.log('[marcasApi.update] Datos enviados:', body);
    const json = await request(`${BASE}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[marcasApi.update] Datos recibidos:', json);
    return json;
  },

  // SP: marcas_set_state(@marca_id, @estado) → (confirmación)
  async setState({ marca_id, estado }) {
    const body = { marca_id: Number(marca_id), estado: Number(estado) };
    console.log('[marcasApi.setState] Datos enviados:', body);
    const json = await request(`${BASE}/set_state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[marcasApi.setState] Datos recibidos:', json);
    return json;
  }
};

export { marcasApi };