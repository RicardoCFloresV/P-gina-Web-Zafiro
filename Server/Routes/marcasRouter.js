// Server/Routes/marcasRouter.js
// Recurso: MARCAS
// Montaje: app.use('/api/marcas', marcasRouter)
//
// ┌─────────────────────────┬───────────────────────────────┬──────────────────────────────┐
// │ Endpoint                │ SP llamado                    │ Datos de retorno             │
// ├─────────────────────────┼───────────────────────────────┼──────────────────────────────┤
// │ POST /insert            │ marcas_insert                 │ { marca_id, nombre }         │
// │ POST /update            │ marcas_update                 │ { marca_id, nombre }         │
// │ POST /set_state         │ marcas_set_state              │ (ninguno)                    │
// │ GET  /get_all           │ marcas_get_all                │ [{ marca_id, nombre }]       │
// │ GET  /por_id/:id        │ marcas_get_by_id              │ { marca_id, nombre }         │
// └─────────────────────────┴───────────────────────────────┴──────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const MarcasRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

const SQL_ERROR_MAP = {
  // ── marcas_insert ──
  51001: { status: 400, message: 'El nombre de la marca es obligatorio.' },
  51002: { status: 409, message: 'Ya existe otra marca con ese nombre.' },

  // ── marcas_update ──
  51003: { status: 404, message: 'La marca no se encuentra.' },
  51004: { status: 400, message: 'El nombre de la marca es obligatorio.' },

  // ── marcas_set_state ──
  51005: { status: 409, message: 'No se puede inactivar esta marca porque está asignada a uno o más productos activos.' },
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
//  ► SP llamado      : marcas_insert(@nombre)
//  ► Retorna          : { marca_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
MarcasRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const { nombre } = req.body;

    const { isValid, errors } = validar([ validarNombre(nombre) ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('marcas_insert', params);
    return res.status(201).json({ success: true, message: 'Marca creada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la marca');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { marca_id: Number, nombre: String }
//  ► SP llamado      : marcas_update(@marca_id, @nombre)
//  ► Retorna          : { marca_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
MarcasRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { marca_id, nombre } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(marca_id, 'marca_id'),
      validarNombre(nombre),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int,         value: Number(marca_id) },
      { name: 'nombre',   type: sql.NVarChar(50), value: nombre.trim() },
    ]);

    const data = await db.executeProc('marcas_update', params);
    return res.status(200).json({ success: true, message: 'Marca actualizada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la marca');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { marca_id: Number, estado: Number(0|1) }
//  ► SP llamado      : marcas_set_state(@marca_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
MarcasRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { marca_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(marca_id, 'marca_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int, value: Number(marca_id) },
      { name: 'estado',   type: sql.Bit, value: Number(estado) },
    ]);

    await db.executeProc('marcas_set_state', params);

    const msg = Number(estado) === 1 ? 'Marca activada' : 'Marca desactivada';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la marca');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► SP llamado      : marcas_get_all()
//  ► Retorna          : [{ marca_id, nombre }]  (solo estado=1)
// ═════════════════════════════════════════════════════════════════════════════
MarcasRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('marcas_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Marcas listadas' : 'Sin marcas registradas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar marcas');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:marca_id
//  ► SP llamado      : marcas_get_by_id(@marca_id)
//  ► Retorna          : { marca_id, nombre }
// ═════════════════════════════════════════════════════════════════════════════
MarcasRouter.get('/por_id/:marca_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.marca_id, 'marca_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int, value: Number(req.params.marca_id) },
    ]);

    const data = await db.executeProc('marcas_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Marca no encontrada' });

    return res.status(200).json({ success: true, message: 'Marca obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la marca');
  }
});


module.exports = MarcasRouter;
