// Server/Routes/presentacionesRouter.js
// Recurso: PRESENTACIONES 
// Montaje: app.use('/api/presentaciones', presentacionesRouter)

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
// Descomentar si usas autenticación:
// const { requireAuth, requireAdmin } = require('./authRouter.js');

const PresentacionesRouter = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

const SQL_ERROR_MAP = {
  51001: { status: 400, message: 'El nombre de la presentación ya existe' },
  51002: { status: 404, message: 'Presentación no encontrada' },
  51003: { status: 400, message: 'No se puede eliminar: tiene productos asignados' },
};

function handleSqlError(err, res, defaultMsg = 'Error interno del servidor') {
  console.error(`[SQL Error] ${defaultMsg}:`, err.message || err);
  const mapped = SQL_ERROR_MAP[err.number];
  if (mapped) return res.status(mapped.status).json({ success: false, message: mapped.message });
  return res.status(500).json({ success: false, message: defaultMsg });
}

function validarNombre(nombre) {
  if (!nombre || typeof nombre !== 'string') return 'El nombre es obligatorio y debe ser texto';
  if (nombre.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
  if (nombre.length > 50) return 'El nombre no puede exceder los 50 caracteres';
  return null;
}

function validarIdPositivo(id, fieldName = 'ID') {
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) return `El ${fieldName} debe ser un entero positivo`;
  return null;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
PresentacionesRouter.post('/insert', async (req, res) => {
  try {
    const { nombre } = req.body;
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([{ name: 'nombre', type: sql.NVarChar(50), value: nombre.trim() }]);
    const data = await db.executeProc('presentaciones_insert', params);
    return res.status(201).json({ success: true, message: 'Presentación creada', data: data[0] });
  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la presentación');
  }
});

PresentacionesRouter.post('/update', async (req, res) => {
  try {
    const { presentacion_id, nombre } = req.body;
    const errId = validarIdPositivo(presentacion_id, 'presentacion_id');
    const errNom = validarNombre(nombre);
    if (errId || errNom) return res.status(400).json({ success: false, message: errId || errNom });

    const params = BuildParams([
      { name: 'presentacion_id', type: sql.Int, value: Number(presentacion_id) },
      { name: 'nombre', type: sql.NVarChar(50), value: nombre.trim() }
    ]);
    const data = await db.executeProc('presentaciones_update', params);
    return res.status(200).json({ success: true, message: 'Presentación actualizada', data: data[0] });
  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la presentación');
  }
});

PresentacionesRouter.post('/set_state', async (req, res) => {
  try {
    const { presentacion_id, estado } = req.body;
    const errId = validarIdPositivo(presentacion_id, 'presentacion_id');
    if (errId) return res.status(400).json({ success: false, message: errId });
    if (estado !== 0 && estado !== 1) return res.status(400).json({ success: false, message: 'El estado debe ser 0 o 1' });

    const params = BuildParams([
      { name: 'presentacion_id', type: sql.Int, value: Number(presentacion_id) },
      { name: 'estado', type: sql.Bit, value: estado }
    ]);
    await db.executeProc('presentaciones_set_state', params);
    return res.status(200).json({ success: true, message: `Presentación ${estado === 1 ? 'activada' : 'desactivada'}` });
  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la presentación');
  }
});

PresentacionesRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('presentaciones_get_all', {});
    return res.status(200).json({ success: true, message: data.length ? 'Presentaciones listadas' : 'Sin presentaciones registradas', data });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar presentaciones');
  }
});

PresentacionesRouter.get('/por_id/:presentacion_id', async (req, res) => {
  try {
    const errId = validarIdPositivo(req.params.presentacion_id, 'presentacion_id');
    if (errId) return res.status(400).json({ success: false, message: errId });

    const params = BuildParams([{ name: 'presentacion_id', type: sql.Int, value: Number(req.params.presentacion_id) }]);
    const data = await db.executeProc('presentaciones_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Presentación no encontrada' });
    return res.status(200).json({ success: true, message: 'Presentación obtenida', data: data[0] });
  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la presentación');
  }
});

PresentacionesRouter.get('/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([{ name: 'nombre', type: sql.NVarChar(50), value: nombre }]);
    const data = await db.executeProc('presentaciones_get_by_name', params);
    return res.status(200).json({ success: true, message: data.length ? 'Resultados de búsqueda' : 'No se encontraron coincidencias', data });
  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar presentación');
  }
});

module.exports = PresentacionesRouter;