// Server/Routes/stockRouter.js
// Recurso: STOCK (cajas_detalles)
// Montaje: app.use('/api/stock', stockRouter)
//
// ┌───────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
// │ Endpoint                      │ SP llamado                               │ Datos de retorno                                           │
// ├───────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
// │ POST /agregar                 │ productos_add_stock                      │ (ninguno — solo confirmación)                              │
// │ POST /retirar                 │ productos_remove_stock                   │ (ninguno — solo confirmación)                              │
// │ POST /establecer              │ productos_set_stock                      │ (ninguno — solo confirmación)                              │
// │ GET  /detalle_por_caja        │ productos_get_detalle_por_caja           │ [{ producto_id, nombre, ..., caja_ubicacion, stock }]      │
// │ GET  /conteo/:caja_id?        │ productos_get_count_by_caja_id           │ [{ caja_id, etiqueta, cantidad_productos }]                │
// └───────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const StockRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

const SQL_ERROR_MAP = {
  // ── productos_add_stock ──
  52030: { status: 400, message: 'La cantidad a agregar debe ser mayor a 0.' },
  52031: { status: 404, message: 'El producto no existe.' },
  52032: { status: 404, message: 'La caja no existe.' },

  // ── productos_remove_stock ──
  52040: { status: 400, message: 'La cantidad a retirar debe ser mayor a 0.' },
  52041: { status: 404, message: 'El producto no se encuentra en la caja especificada.' },
  52042: { status: 409, message: 'Stock insuficiente para retirar esa cantidad.' },

  // ── productos_set_stock ──
  52050: { status: 400, message: 'El stock no puede ser negativo.' },
  52051: { status: 404, message: 'El producto no existe.' },
  52052: { status: 404, message: 'La caja no existe.' },
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

function validarCantidadPositiva(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return `${campo} debe ser un entero mayor a 0.`;
  return null;
}

function validarCantidadNoNegativa(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) return `${campo} debe ser un entero no negativo.`;
  return null;
}

function validar(checks) {
  const errors = checks.filter(e => e !== null);
  return { isValid: errors.length === 0, errors };
}


// ═════════════════════════════════════════════════════════════════════════════
//  POST /agregar   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_add_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
StockRouter.post('/agregar', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarCantidadPositiva(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_add_stock', params);
    return res.status(200).json({ success: true, message: 'Stock agregado correctamente' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al agregar stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /retirar   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_remove_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
StockRouter.post('/retirar', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarCantidadPositiva(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_remove_stock', params);
    return res.status(200).json({ success: true, message: 'Stock retirado correctamente' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al retirar stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /establecer   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_set_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
StockRouter.post('/establecer', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarCantidadNoNegativa(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_set_stock', params);
    return res.status(200).json({ success: true, message: 'Stock establecido correctamente' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al establecer stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /detalle_por_caja
//  ► SP llamado      : productos_get_detalle_por_caja()
//  ► Retorna          : [{ producto_id, nombre, marca_nombre, precio,
//                          categoria_nombre, presentacion_nombre,
//                          caja_ubicacion, unidad_nombre, unidad_valor, stock }]
// ═════════════════════════════════════════════════════════════════════════════
StockRouter.get('/detalle_por_caja', async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_detalle_por_caja', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Detalle de stock por caja listado' : 'Sin stock registrado',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener detalle de stock por caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /conteo/:caja_id?
//  ► Datos esperados : caja_id (param URL, opcional)
//  ► SP llamado      : productos_get_count_by_caja_id(@caja_id)
//  ► Retorna          : [{ caja_id, etiqueta, cantidad_productos }]
// ═════════════════════════════════════════════════════════════════════════════
StockRouter.get('/conteo/:caja_id?', async (req, res) => {
  try {
    const { caja_id } = req.params;

    if (caja_id) {
      const error = validarIdPositivo(caja_id, 'caja_id');
      if (error) return res.status(400).json({ success: false, message: error });
    }

    const params = BuildParams([
      { name: 'caja_id', type: sql.Int, value: caja_id ? Number(caja_id) : null },
    ]);

    const data = await db.executeProc('productos_get_count_by_caja_id', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Conteo obtenido' : 'Sin datos de conteo',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener conteo de productos por caja');
  }
});


module.exports = StockRouter;
