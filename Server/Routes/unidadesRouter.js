// Server/Routes/unidadesRouter.js
// Recurso: UNIDADES 
// Montaje: app.use('/api/unidades', unidadesRouter)
//
// ┌─────────────────────────┬───────────────────────────────┬──────────────────────────────┐
// │ Endpoint                │ SP llamado                    │ Datos de retorno             │
// ├─────────────────────────┼───────────────────────────────┼──────────────────────────────┤
// │ POST /insert            │ unidades_insert               │ { unidad_id, nombre }        │
// │ POST /update            │ unidades_update               │ { unidad_id, nombre }        │
// │ POST /set_state         │ unidades_set_state            │ (ninguno)                    │
// │ GET  /get_all           │ unidades_get_all              │ [{ unidad_id, nombre }]      │
// │ GET  /por_id/:id        │ unidades_get_by_id            │ { unidad_id, nombre }        │
// │ GET  /por_nombre/:nom   │ unidades_get_by_name          │ [{ unidad_id, nombre }]      │
// └─────────────────────────┴───────────────────────────────┴──────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const UnidadesRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

// Mapeo de códigos de error SQL → { status HTTP, mensaje amigable }
const SQL_ERROR_MAP = {
  // ── unidades_insert ──
  51001: { status: 400, message: 'El nombre de la unidad es obligatorio.' },
  51002: { status: 409, message: 'Ya existe otra unidad con ese nombre.' },

  // ── unidades_update ──
  51003: { status: 404, message: 'La unidad no se encuentra.' },
  51004: { status: 400, message: 'El nombre de la unidad es obligatorio.' },

  // ── unidades_set_state ──
  51005: { status: 409, message: 'No se puede inactivar esta unidad porque está asignada a uno o más productos activos.' },
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
  if (nombre.trim().length > 50) return 'El nombre no puede exceder 50 caracteres.';
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
//  ► Datos esperados : { nombre: String }
//  ► SP llamado      : unidades_insert(@nombre)
//  ► Retorna          : { unidad_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const { nombre } = req.body;

    const { isValid, errors } = validar([ validarNombre(nombre) ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('unidades_insert', params);
    return res.status(201).json({ success: true, message: 'Unidad creada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la unidad');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { unidad_id: Number, nombre: String }
//  ► SP llamado      : unidades_update(@unidad_id, @nombre)
//  ► Retorna          : { unidad_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { unidad_id, nombre } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(unidad_id, 'unidad_id'),
      validarNombre(nombre),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int,         value: Number(unidad_id) },
      { name: 'nombre',    type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('unidades_update', params);
    return res.status(200).json({ success: true, message: 'Unidad actualizada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la unidad');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { unidad_id: Number, estado: Number(0|1) }
//  ► SP llamado      : unidades_set_state(@unidad_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { unidad_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(unidad_id, 'unidad_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int, value: Number(unidad_id) },
      { name: 'estado',    type: sql.Bit, value: Number(estado) },
    ]);

    await db.executeProc('unidades_set_state', params);

    const msg = Number(estado) === 1 ? 'Unidad activada' : 'Unidad desactivada';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la unidad');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► Datos esperados : (ninguno)
//  ► SP llamado      : unidades_get_all()
//  ► Retorna          : [{ unidad_id, nombre }]  (solo estado=1)
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('unidades_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Unidades listadas' : 'Sin unidades registradas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar unidades');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:unidad_id
//  ► Datos esperados : unidad_id (param URL)
//  ► SP llamado      : unidades_get_by_id(@unidad_id)
//  ► Retorna          : { unidad_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.get('/por_id/:unidad_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.unidad_id, 'unidad_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int, value: Number(req.params.unidad_id) },
    ]);

    const data = await db.executeProc('unidades_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Unidad no encontrada' });

    return res.status(200).json({ success: true, message: 'Unidad obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la unidad');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_nombre/:nombre
//  ► Datos esperados : nombre (param URL)
//  ► SP llamado      : unidades_get_by_name(@nombre)
//  ► Retorna          : [{ unidad_id, nombre }]
// ═════════════════════════════════════════════════════════════════════════════
UnidadesRouter.get('/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(50), value: nombre },
    ]);

    const data = await db.executeProc('unidades_get_by_name', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Unidades encontradas' : 'No se encontraron unidades con ese nombre',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar unidad por nombre');
  }
});


module.exports = UnidadesRouter;
