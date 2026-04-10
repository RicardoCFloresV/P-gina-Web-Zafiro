// Server/Routes/categoriasRouter.js
// Recurso: CATEGORÍAS
// Montaje: app.use('/api/categorias', categoriasRouter)
//
// ┌──────────────────────────┬──────────────────────────────────┬───────────────────────────────────────────────────────────────┐
// │ Endpoint                 │ SP llamado                       │ Datos de retorno                                              │
// ├──────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
// │ POST /insert             │ categorias_insert                │ { categoria_id, nombre, categoria_padre_id, nivel, estado }   │
// │ POST /update             │ categorias_update                │ { categoria_id, nombre, categoria_padre_id, nivel, estado }   │
// │ POST /set_state          │ categorias_set_state             │ { categoria_id, nombre, categoria_padre_id, nivel, estado }   │
// │ GET  /get_all            │ categorias_get_all               │ [{ categoria_id, nombre, nivel, estado, ..., nombre_padre }]  │
// │ GET  /get_all_active     │ categorias_get_all_active        │ [{ categoria_id, nombre, nivel, estado, ..., nombre_padre }]  │
// │ GET  /por_id/:id         │ categorias_get_by_id             │ { categoria_id, nombre, nivel, estado,  ..., nombre_padre }   │
// │ GET  /por_nombre/:nombre │ categorias_get_by_name           │ [{ categoria_id, nombre, nivel, estado, ... }]                │
// │ GET  /por_nivel/:nivel   │ categorias_get_by_nivel          │ [{ categoria_id, nombre, nivel, estado, ... }]                │
// │ GET  /hijos/:id          │ categorias_get_children          │ [{ categoria_id, nombre, nivel, estado, ... }]                │
// │ GET  /ruta/:id           │ categorias_get_path              │ { categoria_id, nombre, nivel, ruta_completa }                │
// │ GET  /padre/:id          │ categorias_get_categoria_padre   │ { categoria_padre_id, nombre_padre }                          │
// └──────────────────────────┴──────────────────────────────────┴───────────────────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const CategoriasRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

// Mapeo de códigos de error SQL → { status HTTP, mensaje amigable }
const SQL_ERROR_MAP = {
  // ── categorias_insert ──
  51001: { status: 400, message: 'El nombre de la categoría es obligatorio.' },
  51002: { status: 400, message: 'El nivel debe ser 1 (Principal), 2 (Secundaria) o 3 (Subcategoría).' },
  51003: { status: 400, message: 'Una categoría principal no puede tener un padre.' },
  51004: { status: 400, message: 'Las categorías secundarias y subcategorías deben tener un padre asignado.' },
  51005: { status: 404, message: 'La categoría padre especificada no existe o está inactiva.' },
  51006: { status: 400, message: 'Error de jerarquía: el padre debe ser del nivel inmediatamente superior.' },

  // ── categorias_update ──
  51010: { status: 404, message: 'La categoría no se encuentra.' },
  51011: { status: 400, message: 'El nombre es obligatorio.' },
  51012: { status: 409, message: 'Ya existe otra categoría con ese nombre bajo el mismo padre.' },
  51015: { status: 400, message: 'Una categoría no puede ser su propio padre.' },
  51016: { status: 400, message: 'Una categoría principal (Nivel 1) no puede tener un padre.' },
  51017: { status: 400, message: 'Las categorías secundarias y subcategorías deben tener un padre.' },
  51018: { status: 404, message: 'La categoría padre especificada no existe o está inactiva.' },
  51019: { status: 400, message: 'Error de jerarquía: el padre debe ser de un nivel inmediatamente superior.' },

  // ── categorias_set_state ──
  51020: { status: 404, message: 'La categoría no existe.' },
  51021: { status: 409, message: 'No se puede desactivar: tiene subcategorías activas dependiendo de ella.' },
  51022: { status: 409, message: 'No se puede reactivar: su categoría padre se encuentra inactiva.' },
  51023: { status: 409, message: 'La categoría tiene productos activos.' },
};

function handleSqlError(err, res, fallbackMsg) {
  const code = err?.number || err?.originalError?.info?.number;
  if (code && SQL_ERROR_MAP[code]) {
    const mapped = SQL_ERROR_MAP[code];
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
  console.error(fallbackMsg, err);
  return res.status(500).json({ success: false, message: fallbackMsg });
}


// ─── Validadores inline ───────────────────────────────────────────────────────

function validarIdPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return `${campo} debe ser un entero positivo.`;
  return null;
}

function validarNombre(nombre) {
  if (typeof nombre !== 'string' || nombre.trim() === '') return 'El nombre es obligatorio.';
  if (nombre.trim().length > 100) return 'El nombre no puede exceder 100 caracteres.';
  return null;
}

function validarNivel(nivel) {
  const n = Number(nivel);
  if (isNaN(n) || ![1, 2, 3].includes(n)) return 'El nivel debe ser 1 (Principal), 2 (Secundaria) o 3 (Subcategoría).';
  return null;
}

function validarEstado(estado) {
  const n = Number(estado);
  if (isNaN(n) || (n !== 0 && n !== 1)) return 'estado debe ser 0 (inactivo) o 1 (activo).';
  return null;
}

function validar(checks) {
  const errors = checks.filter(e => e !== null);
  return { isValid: errors.length === 0, errors };
}


// ═════════════════════════════════════════════════════════════════════════════
//  POST /insert   (auth requerido)
//  ► Datos esperados : { nombre: String, nivel: Number(1|2|3), categoria_padre_id: Number|null }
//  ► SP llamado      : categorias_insert(@nombre, @nivel, @categoria_padre_id)
//  ► Retorna          : { categoria_id, nombre, categoria_padre_id, nivel, estado }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const { nombre, nivel, categoria_padre_id } = req.body;

    const { isValid, errors } = validar([
      validarNombre(nombre),
      validarNivel(nivel),
    ]);
    // Padre obligatorio para nivel 2 y 3 (el SP también lo valida, pero mejor prevenir)
    if (Number(nivel) > 1 && !categoria_padre_id) {
      errors.push('categoria_padre_id es obligatorio para categorías secundarias y subcategorías.');
    }
    if (!isValid || errors.length) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre',             type: sql.NVarChar(100), value: nombre.trim() },
      { name: 'nivel',              type: sql.TinyInt,       value: Number(nivel) },
      { name: 'categoria_padre_id', type: sql.Int,           value: categoria_padre_id ? Number(categoria_padre_id) : null },
    ]);

    const data = await db.executeProc('categorias_insert', params);
    return res.status(201).json({ success: true, message: 'Categoría creada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { categoria_id: Number, nombre: String, padre_id?: Number|null, estado?: Number(0|1) }
//  ► SP llamado      : categorias_update(@categoria_id, @nombre, @padre_id, @estado)
//  ► Retorna          : { categoria_id, nombre, categoria_padre_id, nivel, estado }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { categoria_id, nombre, padre_id, estado } = req.body;

    const checks = [
      validarIdPositivo(categoria_id, 'categoria_id'),
      validarNombre(nombre),
    ];
    if (estado !== undefined && estado !== null) {
      checks.push(validarEstado(estado));
    }
    if (padre_id !== undefined && padre_id !== null) {
      checks.push(validarIdPositivo(padre_id, 'padre_id'));
    }

    const { isValid, errors } = validar(checks);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int,           value: Number(categoria_id) },
      { name: 'nombre',       type: sql.NVarChar(100), value: nombre.trim() },
      { name: 'padre_id',     type: sql.Int,           value: (padre_id !== undefined && padre_id !== null) ? Number(padre_id) : null },
      { name: 'estado',       type: sql.Bit,           value: (estado !== undefined && estado !== null) ? Number(estado) : null },
    ]);

    const data = await db.executeProc('categorias_update', params);
    return res.status(200).json({ success: true, message: 'Categoría actualizada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { categoria_id: Number, estado: Number(0|1) }
//  ► SP llamado      : categorias_set_state(@categoria_id, @estado)
//  ► Retorna          : { categoria_id, nombre, categoria_padre_id, nivel, estado }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { categoria_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(categoria_id, 'categoria_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(categoria_id) },
      { name: 'estado',       type: sql.Bit, value: Number(estado) },
    ]);

    const data = await db.executeProc('categorias_set_state', params);

    const msg = Number(estado) === 1 ? 'Categoría activada' : 'Categoría desactivada';
    return res.status(200).json({ success: true, message: msg, data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► SP llamado      : categorias_get_all()
//  ► Retorna          : [{ categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }]
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('categorias_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías listadas' : 'Sin categorías registradas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar categorías');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all_active
//  ► SP llamado      : categorias_get_all_active()
//  ► Retorna          : [{ categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }]
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/get_all_active', async (_req, res) => {
  try {
    const data = await db.executeProc('categorias_get_all_active', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías activas listadas' : 'Sin categorías activas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar categorías activas');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:categoria_id
//  ► SP llamado      : categorias_get_by_id(@categoria_id)
//  ► Retorna          : { categoria_id, nombre, nivel, estado, categoria_padre_id, nombre_padre }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/por_id/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('categorias_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });

    return res.status(200).json({ success: true, message: 'Categoría obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_nombre/:nombre
//  ► SP llamado      : categorias_get_by_name(@nombre)
//  ► Retorna          : [{ categoria_id, nombre, nivel, estado, ... }]
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre },
    ]);

    const data = await db.executeProc('categorias_get_by_name', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías encontradas' : 'No se encontraron categorías con ese nombre',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por nombre');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_nivel/:nivel
//  ► SP llamado      : categorias_get_by_nivel(@nivel)
//  ► Retorna          : [{ categoria_id, nombre, nivel, estado, ... }]
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/por_nivel/:nivel', async (req, res) => {
  try {
    const error = validarNivel(req.params.nivel);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'nivel', type: sql.TinyInt, value: Number(req.params.nivel) },
    ]);

    const data = await db.executeProc('categorias_get_by_nivel', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías encontradas' : 'Sin categorías en ese nivel',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por nivel');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /hijos/:categoria_id
//  ► SP llamado      : categorias_get_children(@categoria_id)
//  ► Retorna          : [{ categoria_id, nombre, nivel, estado, ... }]
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/hijos/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('categorias_get_children', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Subcategorías encontradas' : 'Sin subcategorías',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener subcategorías');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /ruta/:categoria_id
//  ► SP llamado      : categorias_get_path(@categoria_id)
//  ► Retorna          : { categoria_id, nombre, nivel, ruta_completa }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/ruta/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('categorias_get_path', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });

    return res.status(200).json({ success: true, message: 'Ruta obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener ruta de la categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /padre/:categoria_id
//  ► SP llamado      : categorias_get_categoria_padre(@categoria_id)
//  ► Retorna          : { categoria_padre_id, nombre_padre }
// ═════════════════════════════════════════════════════════════════════════════
CategoriasRouter.get('/padre/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('categorias_get_categoria_padre', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });

    return res.status(200).json({ success: true, message: 'Padre obtenido', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener categoría padre');
  }
});


module.exports = CategoriasRouter;
