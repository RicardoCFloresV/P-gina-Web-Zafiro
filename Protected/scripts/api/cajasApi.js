// cajasApi.js
// Módulo API para comunicación con /api/cajas
// Cada método envía datos al servidor y retorna la respuesta JSON.
//
// ┌──────────────────┬──────────┬──────────────────────────────────┐
// │ Método           │ HTTP     │ Endpoint                         │
// ├──────────────────┼──────────┼──────────────────────────────────┤
// │ getAll()         │ GET      │ /api/cajas/get_all               │
// │ getById(id)      │ GET      │ /api/cajas/por_id/:caja_id       │
// │ getByLetra(l)    │ GET      │ /api/cajas/por_letra/:letra      │
// │ buscar(params)   │ GET      │ /api/cajas/buscar?etiqueta=&id=  │
// │ insert(data)     │ POST     │ /api/cajas/insert                │
// │ update(data)     │ POST     │ /api/cajas/update                │
// │ setState(data)   │ POST     │ /api/cajas/set_state             │
// └──────────────────┴──────────┴──────────────────────────────────┘

const BASE = '/api/cajas';
const NO_SERVER = 'No hay conexión con el servidor';

// ─── Helper central de peticiones ───────────────────────────────────────────
// Captura:
//   1. Error de red (fetch lanza TypeError)       → "No hay conexión con el servidor"
//   2. Respuesta no-JSON (404 HTML de Live Server) → "No hay conexión con el servidor"
//   3. Respuesta JSON con status HTTP de error     → muestra el message del servidor
async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    // fetch falla totalmente: red caída, CORS, DNS, servidor apagado
    console.error(`[cajasApi] Error de red en ${url}:`, netErr);
    throw new Error(NO_SERVER);
  }

  // Intentar parsear JSON — si el servidor devolvió HTML (404 de Live Server, etc.)
  // el .json() lanza SyntaxError
  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    console.error(`[cajasApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr);
    throw new Error(NO_SERVER);
  }

  // Respuesta JSON válida pero con status HTTP de error (400, 404, 409, 500)
  if (!res.ok) {
    const msg = json.message || `Error HTTP ${res.status}`;
    console.warn(`[cajasApi] Error del servidor en ${url}:`, msg);
    throw new Error(msg);
  }

  return json;
}


const cajasApi = {

  // ─── GET ALL ──────────────────────────────────────────────────────
  // Llama: cajas_get_all → [{ caja_id, letra, cara, nivel, etiqueta, stock }]
  async getAll() {
    console.log('[cajasApi.getAll] Solicitando todos los registros...');
    const json = await request(`${BASE}/get_all`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[cajasApi.getAll] Datos recibidos:', json);
    return json;
  },

  // ─── GET BY ID ────────────────────────────────────────────────────
  // Llama: cajas_get_by_id → { caja_id, letra, cara, nivel, etiqueta }
  async getById(cajaId) {
    console.log(`[cajasApi.getById] Buscando caja con id: ${cajaId}`);
    const json = await request(`${BASE}/por_id/${cajaId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[cajasApi.getById] Datos recibidos:', json);
    return json;
  },

  // ─── GET BY LETRA ─────────────────────────────────────────────────
  // Llama: cajas_get_by_letra → [{ caja_id, letra, cara, nivel, etiqueta }]
  async getByLetra(letra) {
    console.log(`[cajasApi.getByLetra] Buscando cajas con letra: ${letra}`);
    const json = await request(`${BASE}/por_letra/${encodeURIComponent(letra)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[cajasApi.getByLetra] Datos recibidos:', json);
    return json;
  },

  // ─── BUSCAR (por etiqueta o id) ───────────────────────────────────
  // Llama: cajas_get_by_etiqueta → [{ caja_id, letra, cara, nivel, etiqueta, stock }]
  // Parámetros: { etiqueta: String } ó { id: Number } ó ambos
  async buscar({ etiqueta = null, id = null }) {
    const params = new URLSearchParams();
    if (etiqueta) params.set('etiqueta', etiqueta);
    if (id) params.set('id', id);

    console.log(`[cajasApi.buscar] Datos enviados por query string: ${params.toString()}`);
    const json = await request(`${BASE}/buscar?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[cajasApi.buscar] Datos recibidos:', json);
    return json;
  },

  // ─── INSERT ───────────────────────────────────────────────────────
  // Llama: cajas_insert → { caja_id, letra, cara, nivel, etiqueta }
  // Body: { letra: String, cara: Number(1|2), nivel: Number(1|2) }
  async insert({ letra, cara, nivel }) {
    const body = { letra, cara: Number(cara), nivel: Number(nivel) };
    console.log('[cajasApi.insert] Datos enviados a /api/cajas/insert:', body);
    const json = await request(`${BASE}/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[cajasApi.insert] Datos recibidos:', json);
    return json;
  },

  // ─── UPDATE ───────────────────────────────────────────────────────
  // Llama: cajas_update → { caja_id, letra, cara, nivel, etiqueta }
  // Body: { caja_id: Number, letra: String, cara: Number(1|2), nivel: Number(1|2) }
  async update({ caja_id, letra, cara, nivel }) {
    const body = { caja_id: Number(caja_id), letra, cara: Number(cara), nivel: Number(nivel) };
    console.log('[cajasApi.update] Datos enviados a /api/cajas/update:', body);
    const json = await request(`${BASE}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[cajasApi.update] Datos recibidos:', json);
    return json;
  },

  // ─── SET STATE ────────────────────────────────────────────────────
  // Llama: cajas_set_state → (confirmación)
  // Body: { caja_id: Number, estado: Number(0|1) }
  async setState({ caja_id, estado }) {
    const body = { caja_id: Number(caja_id), estado: Number(estado) };
    console.log('[cajasApi.setState] Datos enviados a /api/cajas/set_state:', body);
    const json = await request(`${BASE}/set_state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[cajasApi.setState] Datos recibidos:', json);
    return json;
  }
};

export { cajasApi };