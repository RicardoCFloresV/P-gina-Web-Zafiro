// Server/Routes/presentacionesRouter.js
// Recurso: PRESENTACIONES
// Montaje: app.use('/api/presentaciones', presentacionesRouter)
//
// ┌─────────────────────────┬───────────────────────────────────┬──────────────────────────────────────┐
// │ Endpoint                │ SP llamado                        │ Datos de retorno                     │
// ├─────────────────────────┼───────────────────────────────────┼──────────────────────────────────────┤
// │ POST /insert            │ presentaciones_insert             │ { presentacion_id, nombre }          │
// │ POST /update            │ presentaciones_update             │ { presentacion_id, nombre }          │
// │ POST /set_state         │ presentaciones_set_state          │ (ninguno)                            │
// │ GET  /get_all           │ presentaciones_get_all            │ [{ presentacion_id, nombre }]        │
// │ GET  /por_id/:id        │ presentaciones_get_by_id          │ { presentacion_id, nombre }          │
// └─────────────────────────┴───────────────────────────────────┴──────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const PresentacionesRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

const SQL_ERROR_MAP = {
  // ── presentaciones_insert ──
  51001: { status: 400, message: 'El nombre de la presentación es obligatorio.' },
  51002: { status: 409, message: 'Ya existe otra presentación con ese nombre.' },

  // ── presentaciones_update ──
  51003: { status: 404, message: 'La presentación no se encuentra.' },
  51004: { status: 400, message: 'El nombre de la presentación es obligatorio.' },

  // ── presentaciones_set_state ──
  51005: { status: 409, message: 'No se puede inactivar esta presentación porque está asignada a uno o más productos activos.' },
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
//  ► SP llamado      : presentaciones_insert(@nombre)
//  ► Retorna          : { presentacion_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
PresentacionesRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const { nombre } = req.body;

    const { isValid, errors } = validar([ validarNombre(nombre) ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('presentaciones_insert', params);
    return res.status(201).json({ success: true, message: 'Presentación creada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la presentación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { presentacion_id: Number, nombre: String }
//  ► SP llamado      : presentaciones_update(@presentacion_id, @nombre)
//  ► Retorna          : { presentacion_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
PresentacionesRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { presentacion_id, nombre } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(presentacion_id, 'presentacion_id'),
      validarNombre(nombre),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'presentacion_id', type: sql.Int,         value: Number(presentacion_id) },
      { name: 'nombre',          type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('presentaciones_update', params);
    return res.status(200).json({ success: true, message: 'Presentación actualizada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la presentación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { presentacion_id: Number, estado: Number(0|1) }
//  ► SP llamado      : presentaciones_set_state(@presentacion_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
PresentacionesRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { presentacion_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(presentacion_id, 'presentacion_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'presentacion_id', type: sql.Int, value: Number(presentacion_id) },
      { name: 'estado',          type: sql.Bit, value: Number(estado) },
    ]);

    await db.executeProc('presentaciones_set_state', params);

    const msg = Number(estado) === 1 ? 'Presentación activada' : 'Presentación desactivada';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la presentación');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► SP llamado      : presentaciones_get_all()
//  ► Retorna          : [{ presentacion_id, nombre }]  (solo estado=1)
// ═════════════════════════════════════════════════════════════════════════════
PresentacionesRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('presentaciones_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Presentaciones listadas' : 'Sin presentaciones registradas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar presentaciones');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:presentacion_id
//  ► SP llamado      : presentaciones_get_by_id(@presentacion_id)
//  ► Retorna          : { presentacion_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
PresentacionesRouter.get('/por_id/:presentacion_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.presentacion_id, 'presentacion_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'presentacion_id', type: sql.Int, value: Number(req.params.presentacion_id) },
    ]);

    const data = await db.executeProc('presentaciones_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Presentación no encontrada' });

    return res.status(200).json({ success: true, message: 'Presentación obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la presentación');
  }
});


module.exports = PresentacionesRouter;
