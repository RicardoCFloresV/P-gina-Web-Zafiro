// logsApi.js
// Módulo API para comunicación con /api/logs
//
// ┌──────────────────────────┬──────────┬──────────────────────────────────────────────────┐
// │ Método                   │ HTTP     │ Endpoint                                         │
// ├──────────────────────────┼──────────┼──────────────────────────────────────────────────┤
// │ getAll()                 │ GET      │ /api/logs/get_all                                │
// │ getByOrigen(origen)      │ GET      │ /api/logs/por_origen/:origen                     │
// │ getByFecha(inicio, fin)  │ GET      │ /api/logs/por_fecha?inicio=&fin=                 │
// │ clear()                  │ POST     │ /api/logs/clear                                  │
// └──────────────────────────┴──────────┴──────────────────────────────────────────────────┘

const BASE = '/api/logs';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[logsApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[logsApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[logsApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const logsApi = {

  // SP: logs_get_all → [{ log_id, fecha, origen, mensaje }]
  async getAll() {
    console.log('[logsApi.getAll] Solicitando todos los logs...');
    const json = await request(`${BASE}/get_all`);
    console.log('[logsApi.getAll] Datos recibidos:', json);
    return json;
  },

  // SP: logs_get_by_origen(@origen) → [{ log_id, fecha, origen, mensaje }]
  async getByOrigen(origen) {
    console.log(`[logsApi.getByOrigen] Buscando logs con origen: ${origen}`);
    const json = await request(`${BASE}/por_origen/${encodeURIComponent(origen)}`);
    console.log('[logsApi.getByOrigen] Datos recibidos:', json);
    return json;
  },

  // SP: logs_get_by_date_range(@fecha_inicio, @fecha_fin) → [{ log_id, fecha, origen, mensaje }]
  // inicio y fin deben ser strings ISO válidos (ej: '2025-01-01T00:00:00')
  async getByFecha(inicio, fin) {
    const params = new URLSearchParams({ inicio, fin });
    console.log(`[logsApi.getByFecha] Buscando logs entre ${inicio} y ${fin}`);
    const json = await request(`${BASE}/por_fecha?${params.toString()}`);
    console.log('[logsApi.getByFecha] Datos recibidos:', json);
    return json;
  },

  // SP: logs_clear → (confirmación)
  // Limpia todos los registros de la tabla logs
  async clear() {
    console.log('[logsApi.clear] Limpiando todos los logs...');
    const json = await request(`${BASE}/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    console.log('[logsApi.clear] Datos recibidos:', json);
    return json;
  }
};

export { logsApi };
