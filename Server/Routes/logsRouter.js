// Server/Routes/logsRouter.js
// Recurso: LOGS
// Montaje: app.use('/api/logs', logsRouter)
//
// ┌──────────────────────────────────────┬───────────────────────────────────┬──────────────────────────────────────────────────┐
// │ Endpoint                             │ SP llamado                        │ Datos de retorno                                 │
// ├──────────────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────────┤
// │ GET  /get_all                        │ logs_get_all                      │ [{ log_id, fecha, origen, mensaje }]             │
// │ GET  /por_origen/:origen             │ logs_get_by_origen                │ [{ log_id, fecha, origen, mensaje }]             │
// │ GET  /por_fecha?inicio=...&fin=...   │ logs_get_by_date_range            │ [{ log_id, fecha, origen, mensaje }]             │
// │ POST /clear                          │ logs_clear                        │ (ninguno)                                        │
// └──────────────────────────────────────┴───────────────────────────────────┴──────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const LogsRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

function handleSqlError(err, res, fallbackMsg) {
  console.error(fallbackMsg, err);
  return res.status(500).json({ success: false, message: fallbackMsg });
}


// ─── Validadores inline ───────────────────────────────────────────────────────

function validarOrigen(origen) {
  if (typeof origen !== 'string' || origen.trim() === '') return 'El origen es obligatorio.';
  if (origen.trim().length > 100) return 'El origen no puede exceder 100 caracteres.';
  return null;
}

function validarFecha(valor, campo) {
  if (!valor) return `${campo} es obligatorio.`;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return `${campo} no es una fecha válida.`;
  return null;
}


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all   (admin requerido)
//  ► SP llamado      : logs_get_all()
//  ► Retorna          : [{ log_id, fecha, origen, mensaje }]
// ═════════════════════════════════════════════════════════════════════════════
LogsRouter.get('/get_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('logs_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Logs listados' : 'Sin logs registrados',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar logs');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_origen/:origen   (admin requerido)
//  ► SP llamado      : logs_get_by_origen(@origen)
//  ► Retorna          : [{ log_id, fecha, origen, mensaje }]
// ═════════════════════════════════════════════════════════════════════════════
LogsRouter.get('/por_origen/:origen', requireAdmin, async (req, res) => {
  try {
    const origen = decodeURIComponent(req.params.origen).trim();
    const error = validarOrigen(origen);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'origen', type: sql.NVarChar(100), value: origen },
    ]);

    const data = await db.executeProc('logs_get_by_origen', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Logs encontrados' : 'No se encontraron logs con ese origen',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar logs por origen');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_fecha?inicio=...&fin=...   (admin requerido)
//  ► SP llamado      : logs_get_by_date_range(@fecha_inicio, @fecha_fin)
//  ► Retorna          : [{ log_id, fecha, origen, mensaje }]
// ═════════════════════════════════════════════════════════════════════════════
LogsRouter.get('/por_fecha', requireAdmin, async (req, res) => {
  try {
    const { inicio, fin } = req.query;

    const errorInicio = validarFecha(inicio, 'inicio');
    const errorFin = validarFecha(fin, 'fin');
    if (errorInicio || errorFin) {
      const errors = [errorInicio, errorFin].filter(e => e !== null);
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    const params = BuildParams([
      { name: 'fecha_inicio', type: sql.DateTime2, value: new Date(inicio) },
      { name: 'fecha_fin',    type: sql.DateTime2, value: new Date(fin) },
    ]);

    const data = await db.executeProc('logs_get_by_date_range', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Logs encontrados' : 'No se encontraron logs en ese rango de fechas',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar logs por rango de fechas');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /clear   (admin requerido)
//  ► SP llamado      : logs_clear()
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
LogsRouter.post('/clear', requireAdmin, async (_req, res) => {
  try {
    await db.executeProc('logs_clear', {});
    return res.status(200).json({ success: true, message: 'Logs limpiados correctamente' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al limpiar los logs');
  }
});


module.exports = LogsRouter;
