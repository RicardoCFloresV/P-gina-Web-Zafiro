// usuariosApi.js
// Módulo API para comunicación con /api/usuarios
//
// ┌───────────────────────────┬──────────┬──────────────────────────────────────────────────┐
// │ Método                    │ HTTP     │ Endpoint                                         │
// ├───────────────────────────┼──────────┼──────────────────────────────────────────────────┤
// │ getAll()                  │ GET      │ /api/usuarios/get_all                            │
// │ getById(id)               │ GET      │ /api/usuarios/por_id/:usuario_id                 │
// │ getByNombre(params)       │ GET      │ /api/usuarios/por_nombre?nombre=&email=          │
// │ getPassword(params)       │ GET      │ /api/usuarios/get_password?nombre=&email=         │
// │ insert(data)              │ POST     │ /api/usuarios/insert                             │
// │ setState(data)            │ POST     │ /api/usuarios/set_state                          │
// │ updatePassword(data)      │ POST     │ /api/usuarios/update_password                    │
// │ setTipo(data)             │ POST     │ /api/usuarios/set_tipo                           │
// │ changeName(data)          │ POST     │ /api/usuarios/change_name                        │
// └───────────────────────────┴──────────┴──────────────────────────────────────────────────┘

const BASE = '/api/usuarios';
const NO_SERVER = 'No hay conexión con el servidor';

async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, options); }
  catch (netErr) { console.error(`[usuariosApi] Error de red en ${url}:`, netErr); throw new Error(NO_SERVER); }

  let json;
  try { json = await res.json(); }
  catch (parseErr) { console.error(`[usuariosApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr); throw new Error(NO_SERVER); }

  if (!res.ok) { const msg = json.message || `Error HTTP ${res.status}`; console.warn(`[usuariosApi] ${url}:`, msg); throw new Error(msg); }
  return json;
}

const usuariosApi = {

  // SP: usuarios_get_all → [{ usuario_id, nombre, email, tipo }]
  async getAll() {
    console.log('[usuariosApi.getAll] Solicitando todos los usuarios...');
    const json = await request(`${BASE}/get_all`);
    console.log('[usuariosApi.getAll] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_get_by_id → { usuario_id, nombre, email, tipo }
  async getById(usuarioId) {
    console.log(`[usuariosApi.getById] Buscando usuario con id: ${usuarioId}`);
    const json = await request(`${BASE}/por_id/${usuarioId}`);
    console.log('[usuariosApi.getById] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_get_by_nombre(@nombre, @email) → [{ usuario_id, nombre, email, tipo }]
  // Parámetros: { nombre?: String, email?: String } (al menos uno obligatorio)
  async getByNombre({ nombre = null, email = null }) {
    const params = new URLSearchParams();
    if (nombre) params.set('nombre', nombre);
    if (email) params.set('email', email);

    console.log(`[usuariosApi.getByNombre] Buscando usuario: ${params.toString()}`);
    const json = await request(`${BASE}/por_nombre?${params.toString()}`);
    console.log('[usuariosApi.getByNombre] Datos recibidos:', json);
    return json;
  },

  // SP: usuario_get_password(@nombre, @email) → { contrasena }
  // Uso interno para login — al menos nombre o email obligatorio
  async getPassword({ nombre = null, email = null }) {
    const params = new URLSearchParams();
    if (nombre) params.set('nombre', nombre);
    if (email) params.set('email', email);

    console.log(`[usuariosApi.getPassword] Obteniendo contraseña para: ${params.toString()}`);
    const json = await request(`${BASE}/get_password?${params.toString()}`);
    console.log('[usuariosApi.getPassword] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_insert(@nombre, @contrasena, @email, @tipo) → { usuario_id }
  async insert({ nombre, contrasena, email, tipo }) {
    const body = { nombre, contrasena, email, tipo: Number(tipo) };
    console.log('[usuariosApi.insert] Datos enviados:', { ...body, contrasena: '***' });
    const json = await request(`${BASE}/insert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[usuariosApi.insert] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_set_state(@usuario_id, @estado) → (confirmación)
  async setState({ usuario_id, estado }) {
    const body = { usuario_id: Number(usuario_id), estado: Number(estado) };
    console.log('[usuariosApi.setState] Datos enviados:', body);
    const json = await request(`${BASE}/set_state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[usuariosApi.setState] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_update_password(@usuario_id, @nueva_contrasena) → (confirmación)
  async updatePassword({ usuario_id, nueva_contrasena }) {
    const body = { usuario_id: Number(usuario_id), nueva_contrasena };
    console.log('[usuariosApi.updatePassword] Datos enviados:', { usuario_id: body.usuario_id, nueva_contrasena: '***' });
    const json = await request(`${BASE}/update_password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[usuariosApi.updatePassword] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_set_tipo(@usuario_id, @tipo_usuario_id) → (confirmación)
  async setTipo({ usuario_id, tipo_usuario_id }) {
    const body = { usuario_id: Number(usuario_id), tipo_usuario_id: Number(tipo_usuario_id) };
    console.log('[usuariosApi.setTipo] Datos enviados:', body);
    const json = await request(`${BASE}/set_tipo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[usuariosApi.setTipo] Datos recibidos:', json);
    return json;
  },

  // SP: usuarios_change_name(@usuario_id, @nuevo_nombre, @nuevo_email) → (confirmación)
  async changeName({ usuario_id, nuevo_nombre, nuevo_email }) {
    const body = { usuario_id: Number(usuario_id), nuevo_nombre, nuevo_email };
    console.log('[usuariosApi.changeName] Datos enviados:', body);
    const json = await request(`${BASE}/change_name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('[usuariosApi.changeName] Datos recibidos:', json);
    return json;
  }
};

export { usuariosApi };