// Server/Routes/busquedasRouter.js
// Recurso: BÚSQUEDAS DE PRODUCTOS
// Montaje: app.use('/api/busquedas', busquedasRouter)
//
// ┌──────────────────────────────────────┬──────────────────────────────────────────────┬──────────────────────────────────────────────┐
// │ Endpoint                             │ SP llamado                                   │ Datos de retorno                             │
// ├──────────────────────────────────────┼──────────────────────────────────────────────┼──────────────────────────────────────────────┤
// │ GET /por_nombre/:nombre              │ productos_get_by_nombre                      │ [{ producto_id, nombre, ... }]               │
// │ GET /por_categoria/:categoria_id     │ productos_get_by_categoria                   │ [{ producto_id, nombre, ... }]               │
// │ GET /por_marca/:marca_id             │ productos_get_by_marca                       │ [{ producto_id, nombre, ... }]               │
// │ GET /por_unidad/:unidad_id           │ productos_get_by_unidad                      │ [{ producto_id, nombre, ... }]               │
// │ GET /stock/por_id/:producto_id       │ productos_get_by_id_and_stock                │ { producto_id, ..., stock_total }            │
// │ GET /stock/por_nombre/:nombre        │ productos_get_by_nombre_and_stock            │ [{ producto_id, ..., stock_total }]          │
// │ GET /stock/por_categoria/:cat_id     │ productos_get_by_categoria_and_stock         │ [{ producto_id, ..., stock_total }]          │
// │ GET /stock/por_marca/:marca_id       │ productos_get_by_marca_and_stock             │ [{ producto_id, ..., stock_total }]          │
// │ GET /stock/por_unidad/:unidad_id     │ productos_get_by_unidad_and_stock            │ [{ producto_id, ..., stock_total }]          │
// └──────────────────────────────────────┴──────────────────────────────────────────────┴──────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');

const BusquedasRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

function handleSqlError(err, res, fallbackMsg) {
  const code = err?.number || err?.originalError?.info?.number;
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


// ═══════════════════════════════════════════════════════════════════════════════
//  BÚSQUEDAS SIN STOCK (todos los estados)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /por_nombre/:nombre ──────────────────────────────────────────────────
BusquedasRouter.get('/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre },
    ]);

    const data = await db.executeProc('productos_get_by_nombre', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos con ese nombre',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por nombre');
  }
});


// ─── GET /por_categoria/:categoria_id ─────────────────────────────────────────
BusquedasRouter.get('/por_categoria/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('productos_get_by_categoria', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos en esa categoría',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por categoría');
  }
});


// ─── GET /por_marca/:marca_id ─────────────────────────────────────────────────
BusquedasRouter.get('/por_marca/:marca_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.marca_id, 'marca_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int, value: Number(req.params.marca_id) },
    ]);

    const data = await db.executeProc('productos_get_by_marca', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos con esa marca',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por marca');
  }
});


// ─── GET /por_unidad/:unidad_id ───────────────────────────────────────────────
BusquedasRouter.get('/por_unidad/:unidad_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.unidad_id, 'unidad_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int, value: Number(req.params.unidad_id) },
    ]);

    const data = await db.executeProc('productos_get_by_unidad', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos con esa unidad',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por unidad');
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  BÚSQUEDAS CON STOCK (solo activos, incluye stock_total)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /stock/por_id/:producto_id ───────────────────────────────────────────
BusquedasRouter.get('/stock/por_id/:producto_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.producto_id, 'producto_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'producto_id', type: sql.Int, value: Number(req.params.producto_id) },
    ]);

    const data = await db.executeProc('productos_get_by_id_and_stock', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Producto no encontrado o inactivo' });

    return res.status(200).json({ success: true, message: 'Producto obtenido con stock', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener producto con stock');
  }
});


// ─── GET /stock/por_nombre/:nombre ────────────────────────────────────────────
BusquedasRouter.get('/stock/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    const error = validarNombre(nombre);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre },
    ]);

    const data = await db.executeProc('productos_get_by_nombre_and_stock', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos activos con ese nombre',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por nombre con stock');
  }
});


// ─── GET /stock/por_categoria/:categoria_id ───────────────────────────────────
BusquedasRouter.get('/stock/por_categoria/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('productos_get_by_categoria_and_stock', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos activos en esa categoría',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por categoría con stock');
  }
});


// ─── GET /stock/por_marca/:marca_id ───────────────────────────────────────────
BusquedasRouter.get('/stock/por_marca/:marca_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.marca_id, 'marca_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int, value: Number(req.params.marca_id) },
    ]);

    const data = await db.executeProc('productos_get_by_marca_and_stock', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos activos con esa marca',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por marca con stock');
  }
});


// ─── GET /stock/por_unidad/:unidad_id ─────────────────────────────────────────
BusquedasRouter.get('/stock/por_unidad/:unidad_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.unidad_id, 'unidad_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int, value: Number(req.params.unidad_id) },
    ]);

    const data = await db.executeProc('productos_get_by_unidad_and_stock', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos activos con esa unidad',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar productos por unidad con stock');
  }
});


module.exports = BusquedasRouter;
