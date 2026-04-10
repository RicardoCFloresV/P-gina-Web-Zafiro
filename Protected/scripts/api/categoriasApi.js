// categoriasApi.js
// Módulo API para comunicación con /api/categorias
//
// ┌──────────────────────────┬──────────┬──────────────────────────────────────────┐
// │ Método                   │ HTTP     │ Endpoint                                 │
// ├──────────────────────────┼──────────┼──────────────────────────────────────────┤
// │ getAll()                 │ GET      │ /api/categorias/get_all                  │
// │ getAllActive()           │ GET      │ /api/categorias/get_all_active           │
// │ getById(id)              │ GET      │ /api/categorias/por_id/:id               │
// │ getByName(nombre)        │ GET      │ /api/categorias/por_nombre/:nombre       │
// │ getByNivel(nivel)        │ GET      │ /api/categorias/por_nivel/:nivel         │
// │ getChildren(id)          │ GET      │ /api/categorias/hijos/:id                │
// │ getPath(id)              │ GET      │ /api/categorias/ruta/:id                 │
// │ getPadre(id)             │ GET      │ /api/categorias/padre/:id                │
// │ insert(data)             │ POST     │ /api/categorias/insert                   │
// │ update(data)             │ POST     │ /api/categorias/update                   │
// │ setState(data)           │ POST     │ /api/categorias/set_state                │
// └──────────────────────────┴──────────┴──────────────────────────────────────────┘

const BASE = '/api/categorias';
const NO_SERVER = 'No hay conexión con el servidor';

// ─── Helper central de peticiones ───────────────────────────────────────────
async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    console.error(`[categoriasApi] Error de red en ${url}:`, netErr);
    throw new Error(NO_SERVER);
  }

  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    console.error(`[categoriasApi] Respuesta no-JSON en ${url} (status ${res.status}):`, parseErr);
    throw new Error(NO_SERVER);
  }

  if (!res.ok) {
    const msg = json.message || `Error HTTP ${res.status}`;
    console.warn(`[categoriasApi] Error del servidor en ${url}:`, msg);
    throw new Error(msg);
  }

  return json;
}


const categoriasApi = {

  // ─── GET ALL ──────────────────────────────────────────────────────
  // SP: categorias_get_all → [{ categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }]
  async getAll() {
    console.log('[categoriasApi.getAll] Solicitando todas las categorías...');
    const json = await request(`${BASE}/get_all`);
    console.log('[categoriasApi.getAll] Datos recibidos:', json);
    return json;
  },

  // ─── GET ALL ACTIVE ───────────────────────────────────────────────
  // SP: categorias_get_all_active → [{ categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }]
  async getAllActive() {
    console.log('[categoriasApi.getAllActive] Solicitando categorías activas...');
    const json = await request(`${BASE}/get_all_active`);
    console.log('[categoriasApi.getAllActive] Datos recibidos:', json);
    return json;
  },

  // ─── GET BY ID ────────────────────────────────────────────────────
  // SP: categorias_get_by_id → { categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }
  async getById(categoriaId) {
    console.log(`[categoriasApi.getById] Buscando categoría con id: ${categoriaId}`);
    const json = await request(`${BASE}/por_id/${categoriaId}`);
    console.log('[categoriasApi.getById] Datos recibidos:', json);
    return json;
  },

  // ─── GET BY NAME ──────────────────────────────────────────────────
  // SP: categorias_get_by_name → [{ categoria_id, nombre, nivel, estado, ... }]
  async getByName(nombre) {
    console.log(`[categoriasApi.getByName] Buscando categoría: ${nombre}`);
    const json = await request(`${BASE}/por_nombre/${encodeURIComponent(nombre)}`);
    console.log('[categoriasApi.getByName] Datos recibidos:', json);
    return json;
  },

  // ─── GET BY NIVEL ─────────────────────────────────────────────────
  // SP: categorias_get_by_nivel → [{ categoria_id, nombre, nivel, estado, ... }]
  async getByNivel(nivel) {
    console.log(`[categoriasApi.getByNivel] Buscando categorías de nivel: ${nivel}`);
    const json = await request(`${BASE}/por_nivel/${nivel}`);
    console.log('[categoriasApi.getByNivel] Datos recibidos:', json);
    return json;
  },

  // ─── GET CHILDREN ─────────────────────────────────────────────────
  // SP: categorias_get_children → [{ categoria_id, nombre, nivel, estado, ... }]
  async getChildren(categoriaId) {
    console.log(`[categoriasApi.getChildren] Buscando hijos de categoría: ${categoriaId}`);
    const json = await request(`${BASE}/hijos/${categoriaId}`);
    console.log('[categoriasApi.getChildren] Datos recibidos:', json);
    return json;
  },

  // ─── GET PATH ─────────────────────────────────────────────────────
  // SP: categorias_get_path → { categoria_id, nombre, nivel, ruta_completa }
  async getPath(categoriaId) {
    console.log(`[categoriasApi.getPath] Obteniendo ruta de categoría: ${categoriaId}`);
    const json = await request(`${BASE}/ruta/${categoriaId}`);
    console.log('[categoriasApi.getPath] Datos recibidos:', json);
    return json;
  },

  // ─── GET PADRE ────────────────────────────────────────────────────
  // SP: categorias_get_categoria_padre → { categoria_padre_id, nombre_padre }
  async getPadre(categoriaId) {
    console.log(`[categoriasApi.getPadre] Obteniendo padre de categoría: ${categoriaId}`);
    const json = await request(`${BASE}/padre/${categoriaId}`);
    console.log('[categoriasApi.getPadre] Datos recibidos:', json);
    return json;
  },

  // ─── INSERT ───────────────────────────────────────────────────────
  // SP: categorias_insert(@nombre, @nivel, @categoria_padre_id)
  // → { categoria_id, nombre, categoria_padre_id, nivel, estado }
  async insert({ nombre, nivel, categoria_padre_id = null }) {
    const body = { nombre, nivel: Number(nivel), categoria_padre_id };
    console.log('[categoriasApi.insert] Datos enviados a /api/categorias/insert:', body);
    const json = await request(`${BASE}/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[categoriasApi.insert] Datos recibidos:', json);
    return json;
  },

  // ─── UPDATE ───────────────────────────────────────────────────────
  // SP: categorias_update(@categoria_id, @nombre, @padre_id, @estado)
  // → { categoria_id, nombre, categoria_padre_id, nivel, estado }
  async update({ categoria_id, nombre, padre_id = null, estado = null }) {
    const body = { categoria_id: Number(categoria_id), nombre };
    if (padre_id !== null) body.padre_id = Number(padre_id);
    if (estado !== null) body.estado = Number(estado);
    console.log('[categoriasApi.update] Datos enviados a /api/categorias/update:', body);
    const json = await request(`${BASE}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[categoriasApi.update] Datos recibidos:', json);
    return json;
  },

  // ─── SET STATE ────────────────────────────────────────────────────
  // SP: categorias_set_state(@categoria_id, @estado)
  // → { categoria_id, nombre, categoria_padre_id, nivel, estado }
  async setState({ categoria_id, estado }) {
    const body = { categoria_id: Number(categoria_id), estado: Number(estado) };
    console.log('[categoriasApi.setState] Datos enviados a /api/categorias/set_state:', body);
    const json = await request(`${BASE}/set_state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[categoriasApi.setState] Datos recibidos:', json);
    return json;
  }
};

export { categoriasApi };