// Server/Routes/productosRouter.js
// Recurso: PRODUCTOS + STOCK (cajas_detalles)
// Montaje: app.use('/api/productos', productosRouter)
//
// ┌────────────────────────────────┬─────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
// │ Endpoint                       │ SP llamado                          │ Datos de retorno                                                 │
// ├────────────────────────────────┼─────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
// │ POST /insert_with_stock        │ productos_insert_with_stock         │ { producto completo + caja_id, stock }                           │
// │ POST /insert_without_stock     │ productos_insert_without_stock      │ { producto completo }                                            │
// │ POST /update                   │ productos_update                    │ { producto completo }                                            │
// │ POST /set_state                │ productos_set_state                 │ (ninguno)                                                        │
// │ POST /add_stock                │ productos_add_stock                 │ (ninguno)                                                        │
// │ POST /remove_stock             │ productos_remove_stock              │ (ninguno)                                                        │
// │ POST /set_stock                │ productos_set_stock                 │ (ninguno)                                                        │
// │ GET  /get_all                  │ productos_get_all                   │ [{ producto + stock_total }]                                     │
// │ GET  /without_stock            │ productos_get_without_stock         │ [{ producto sin stock }]  (solo activos)                         │
// │ GET  /por_id/:id               │ productos_get_by_id                 │ { producto + stock_total }                                       │
// │ GET  /por_nombre/:nombre       │ productos_get_by_nombre             │ [{ producto + stock_total }]                                     │
// │ GET  /por_categoria/:id        │ productos_get_by_categoria          │ [{ producto + stock_total }]                                     │
// │ GET  /por_marca/:id            │ productos_get_by_marca              │ [{ producto + stock_total }]                                     │
// │ GET  /por_unidad/:id           │ productos_get_by_unidad             │ [{ producto + stock_total }]                                     │
// │ GET  /detalle_caja/:id         │ productos_get_detalle_por_caja      │ [{ producto + caja_ubicacion + stock }]                          │
// │ GET  /count_by_caja/:id?       │ productos_get_count_by_caja_id      │ [{ caja_id, etiqueta, cantidad_productos }]                      │
// └────────────────────────────────┴─────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const ProductosRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

// Mapeo de códigos de error SQL → { status HTTP, mensaje amigable }
// Códigos 52010–52052 de los SPs de productos y stock
const SQL_ERROR_MAP = {
  // ── productos_insert / update ──
  52010: { status: 404, message: 'Producto no encontrado.' },
  52011: { status: 400, message: 'El nombre del producto es obligatorio.' },
  52012: { status: 409, message: 'Ya existe otro producto con ese nombre y marca.' },
  52013: { status: 400, message: 'La categoría seleccionada no existe o está inactiva.' },
  52014: { status: 400, message: 'La unidad seleccionada no existe o está inactiva.' },
  52015: { status: 400, message: 'La marca seleccionada no existe o está inactiva.' },
  52016: { status: 400, message: 'El precio no puede ser negativo.' },
  52017: { status: 400, message: 'El valor de unidad debe ser mayor que cero.' },
  52018: { status: 400, message: 'La presentación seleccionada no existe o está inactiva.' },
  52019: { status: 404, message: 'La caja seleccionada no fue encontrada.' },
  52020: { status: 400, message: 'El stock no puede ser negativo.' },

  // ── productos_set_state ──
  52021: { status: 409, message: 'No se puede desactivar: el producto aún tiene stock físico en una o más cajas.' },

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

function validarNombre(nombre) {
  if (typeof nombre !== 'string' || nombre.trim() === '') return 'El nombre es obligatorio.';
  if (nombre.trim().length > 100) return 'El nombre no puede exceder 100 caracteres.';
  return null;
}

function validarPrecio(precio) {
  const n = Number(precio);
  if (isNaN(n) || n < 0) return 'El precio no puede ser negativo.';
  return null;
}

function validarUnidadValor(valor) {
  const n = Number(valor);
  if (isNaN(n) || n <= 0) return 'El valor de unidad debe ser mayor que cero.';
  return null;
}

function validarEstado(estado) {
  const n = Number(estado);
  if (isNaN(n) || (n !== 0 && n !== 1)) return 'estado debe ser 0 (inactivo) o 1 (activo).';
  return null;
}

function validarCantidad(cantidad, campo) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 0) return `${campo} debe ser un entero no negativo.`;
  return null;
}

function validar(checks) {
  const errors = checks.filter(e => e !== null);
  return { isValid: errors.length === 0, errors };
}


// ═════════════════════════════════════════════════════════════════════════════
//  POST /insert_with_stock   (auth requerido)
//  ► Datos esperados : { nombre, descripcion?, precio, categoria_id, unidad_id,
//                        unidad_valor, presentacion_id, marca_id, caja_id, stock }
//  ► SP llamado      : productos_insert_with_stock
//  ► Retorna          : { producto completo + caja_id, stock }
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/insert_with_stock', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, precio, categoria_id, unidad_id,
            unidad_valor, presentacion_id, marca_id, caja_id, stock } = req.body;

    const { isValid, errors } = validar([
      validarNombre(nombre),
      validarPrecio(precio),
      validarIdPositivo(categoria_id, 'categoria_id'),
      validarIdPositivo(unidad_id, 'unidad_id'),
      validarUnidadValor(unidad_valor),
      validarIdPositivo(presentacion_id, 'presentacion_id'),
      validarIdPositivo(marca_id, 'marca_id'),
      validarIdPositivo(caja_id, 'caja_id'),
      validarCantidad(stock, 'stock'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre',          type: sql.NVarChar(100),   value: nombre.trim() },
      { name: 'descripcion',     type: sql.NVarChar(255),   value: descripcion ? descripcion.trim() : null },
      { name: 'precio',          type: sql.Decimal(10, 2),  value: Number(precio) },
      { name: 'categoria_id',    type: sql.Int,             value: Number(categoria_id) },
      { name: 'unidad_id',       type: sql.Int,             value: Number(unidad_id) },
      { name: 'unidad_valor',    type: sql.Decimal(10, 2),  value: Number(unidad_valor) },
      { name: 'presentacion_id', type: sql.Int,             value: Number(presentacion_id) },
      { name: 'marca_id',        type: sql.Int,             value: Number(marca_id) },
      { name: 'caja_id',         type: sql.Int,             value: Number(caja_id) },
      { name: 'stock',           type: sql.Int,             value: Number(stock) },
    ]);

    const data = await db.executeProc('productos_insert_with_stock', params);
    return res.status(201).json({ success: true, message: 'Producto creado con stock inicial', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear el producto con stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /insert_without_stock   (auth requerido)
//  ► Datos esperados : { nombre, descripcion?, precio, categoria_id, unidad_id,
//                        unidad_valor, presentacion_id, marca_id }
//  ► SP llamado      : productos_insert_without_stock
//  ► Retorna          : { producto completo }
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/insert_without_stock', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion, precio, categoria_id, unidad_id,
            unidad_valor, presentacion_id, marca_id } = req.body;

    const { isValid, errors } = validar([
      validarNombre(nombre),
      validarPrecio(precio),
      validarIdPositivo(categoria_id, 'categoria_id'),
      validarIdPositivo(unidad_id, 'unidad_id'),
      validarUnidadValor(unidad_valor),
      validarIdPositivo(presentacion_id, 'presentacion_id'),
      validarIdPositivo(marca_id, 'marca_id'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre',          type: sql.NVarChar(100),   value: nombre.trim() },
      { name: 'descripcion',     type: sql.NVarChar(255),   value: descripcion ? descripcion.trim() : null },
      { name: 'precio',          type: sql.Decimal(10, 2),  value: Number(precio) },
      { name: 'categoria_id',    type: sql.Int,             value: Number(categoria_id) },
      { name: 'unidad_id',       type: sql.Int,             value: Number(unidad_id) },
      { name: 'unidad_valor',    type: sql.Decimal(10, 2),  value: Number(unidad_valor) },
      { name: 'presentacion_id', type: sql.Int,             value: Number(presentacion_id) },
      { name: 'marca_id',        type: sql.Int,             value: Number(marca_id) },
    ]);

    const data = await db.executeProc('productos_insert_without_stock', params);
    return res.status(201).json({ success: true, message: 'Producto creado (sin stock inicial)', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear el producto');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { producto_id, nombre, descripcion?, precio, categoria_id,
//                        unidad_id, unidad_valor, presentacion_id, marca_id, estado? }
//  ► SP llamado      : productos_update
//  ► Retorna          : { producto completo }
//  NOTA: No cambia stock ni caja — eso se hace con add/remove/set_stock
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { producto_id, nombre, descripcion, precio, categoria_id, unidad_id,
            unidad_valor, presentacion_id, marca_id, estado } = req.body;

    const checks = [
      validarIdPositivo(producto_id, 'producto_id'),
      validarNombre(nombre),
      validarPrecio(precio),
      validarIdPositivo(categoria_id, 'categoria_id'),
      validarIdPositivo(unidad_id, 'unidad_id'),
      validarUnidadValor(unidad_valor),
      validarIdPositivo(presentacion_id, 'presentacion_id'),
      validarIdPositivo(marca_id, 'marca_id'),
    ];
    if (estado !== undefined && estado !== null) checks.push(validarEstado(estado));

    const { isValid, errors } = validar(checks);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const paramEntries = [
      { name: 'producto_id',     type: sql.Int,             value: Number(producto_id) },
      { name: 'nombre',          type: sql.NVarChar(100),   value: nombre.trim() },
      { name: 'descripcion',     type: sql.NVarChar(255),   value: descripcion ? descripcion.trim() : null },
      { name: 'precio',          type: sql.Decimal(10, 2),  value: Number(precio) },
      { name: 'categoria_id',    type: sql.Int,             value: Number(categoria_id) },
      { name: 'unidad_id',       type: sql.Int,             value: Number(unidad_id) },
      { name: 'unidad_valor',    type: sql.Decimal(10, 2),  value: Number(unidad_valor) },
      { name: 'presentacion_id', type: sql.Int,             value: Number(presentacion_id) },
      { name: 'marca_id',        type: sql.Int,             value: Number(marca_id) },
      { name: 'estado',          type: sql.Bit,             value: (estado !== undefined && estado !== null) ? Number(estado) : null },
    ];

    const params = BuildParams(paramEntries);
    const data = await db.executeProc('productos_update', params);
    return res.status(200).json({ success: true, message: 'Producto actualizado', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar el producto');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { producto_id: Number, estado: Number(0|1) }
//  ► SP llamado      : productos_set_state(@producto_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
//  NOTA: No puede desactivar si tiene stock > 0 en alguna caja
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { producto_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(producto_id, 'producto_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'estado',      type: sql.Bit, value: Number(estado) },
    ]);

    await db.executeProc('productos_set_state', params);

    const msg = Number(estado) === 1 ? 'Producto activado' : 'Producto desactivado';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado del producto');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /add_stock   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_add_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — confirmación)
//  NOTA: Si el producto ya existe en la caja, suma; si no, crea el detalle
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/add_stock', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarIdPositivo(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_add_stock', params);
    return res.status(200).json({ success: true, message: `Se agregaron ${cantidad} unidades al stock` });

  } catch (err) {
    return handleSqlError(err, res, 'Error al agregar stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /remove_stock   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_remove_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — confirmación)
//  NOTA: Si el stock llega a 0, el SP elimina el registro de cajas_detalles
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/remove_stock', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarIdPositivo(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_remove_stock', params);
    return res.status(200).json({ success: true, message: `Se retiraron ${cantidad} unidades del stock` });

  } catch (err) {
    return handleSqlError(err, res, 'Error al retirar stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_stock   (auth requerido)
//  ► Datos esperados : { caja_id: Number, producto_id: Number, cantidad: Number }
//  ► SP llamado      : productos_set_stock(@caja_id, @producto_id, @cantidad)
//  ► Retorna          : (ninguno — confirmación)
//  NOTA: Sobrescribe el stock actual (upsert)
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.post('/set_stock', requireAuth, async (req, res) => {
  try {
    const { caja_id, producto_id, cantidad } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarIdPositivo(producto_id, 'producto_id'),
      validarCantidad(cantidad, 'cantidad'),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id',     type: sql.Int, value: Number(caja_id) },
      { name: 'producto_id', type: sql.Int, value: Number(producto_id) },
      { name: 'cantidad',    type: sql.Int, value: Number(cantidad) },
    ]);

    await db.executeProc('productos_set_stock', params);
    return res.status(200).json({ success: true, message: `Stock establecido a ${cantidad} unidades` });

  } catch (err) {
    return handleSqlError(err, res, 'Error al establecer stock');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► Datos esperados : (ninguno)
//  ► SP llamado      : productos_get_all()
//  ► Retorna          : [{ producto completo + stock_total }]
//  NOTA: Incluye activos e inactivos (para admin)
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos listados' : 'Sin productos registrados',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar productos');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /without_stock
//  ► Datos esperados : (ninguno)
//  ► SP llamado      : productos_get_without_stock()
//  ► Retorna          : [{ producto sin stock }]  (solo activos — para user view)
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/without_stock', async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_without_stock', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos activos listados' : 'Sin productos activos',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar productos activos');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:producto_id
//  ► Datos esperados : producto_id (param URL)
//  ► SP llamado      : productos_get_by_id(@producto_id)
//  ► Retorna          : { producto completo + stock_total }
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/por_id/:producto_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.producto_id, 'producto_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'producto_id', type: sql.Int, value: Number(req.params.producto_id) },
    ]);

    const data = await db.executeProc('productos_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

    return res.status(200).json({ success: true, message: 'Producto obtenido', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener el producto');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_nombre/:nombre
//  ► Datos esperados : nombre (param URL, búsqueda LIKE)
//  ► SP llamado      : productos_get_by_nombre(@nombre)
//  ► Retorna          : [{ producto + stock_total }]
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/por_nombre/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre).trim();
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre },
    ]);

    const data = await db.executeProc('productos_get_by_nombre', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'No se encontraron productos',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por nombre');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_categoria/:categoria_id
//  ► Datos esperados : categoria_id (param URL)
//  ► SP llamado      : productos_get_by_categoria(@categoria_id)
//  ► Retorna          : [{ producto + stock_total }]
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/por_categoria/:categoria_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.categoria_id, 'categoria_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Number(req.params.categoria_id) },
    ]);

    const data = await db.executeProc('productos_get_by_categoria', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'Sin productos en esta categoría',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por categoría');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_marca/:marca_id
//  ► Datos esperados : marca_id (param URL)
//  ► SP llamado      : productos_get_by_marca(@marca_id)
//  ► Retorna          : [{ producto + stock_total }]
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/por_marca/:marca_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.marca_id, 'marca_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'marca_id', type: sql.Int, value: Number(req.params.marca_id) },
    ]);

    const data = await db.executeProc('productos_get_by_marca', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'Sin productos de esta marca',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por marca');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_unidad/:unidad_id
//  ► Datos esperados : unidad_id (param URL)
//  ► SP llamado      : productos_get_by_unidad(@unidad_id)
//  ► Retorna          : [{ producto + stock_total }]
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/por_unidad/:unidad_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.unidad_id, 'unidad_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'unidad_id', type: sql.Int, value: Number(req.params.unidad_id) },
    ]);

    const data = await db.executeProc('productos_get_by_unidad', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos encontrados' : 'Sin productos con esta unidad',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar por unidad');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /detalle_caja/:producto_id
//  ► Datos esperados : producto_id (param URL)
//  ► SP llamado      : productos_get_detalle_por_caja(@producto_id)
//  ► Retorna          : [{ producto_id, nombre, marca, precio, caja_ubicacion, stock }]
//  NOTA: Este es el que alimenta las BOX CARDS — un row por cada caja donde
//        el producto tiene stock
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/detalle_caja/:producto_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.producto_id, 'producto_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'producto_id', type: sql.Int, value: Number(req.params.producto_id) },
    ]);

    const data = await db.executeProc('productos_get_detalle_por_caja', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Detalle por caja obtenido' : 'El producto no tiene stock en ninguna caja',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener detalle por caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /count_by_caja/:caja_id?
//  ► Datos esperados : caja_id (param URL, opcional — si se omite, todas las cajas)
//  ► SP llamado      : productos_get_count_by_caja_id(@caja_id)
//  ► Retorna          : [{ caja_id, etiqueta, cantidad_productos }]
// ═════════════════════════════════════════════════════════════════════════════
ProductosRouter.get('/count_by_caja/:caja_id?', async (req, res) => {
  try {
    const cajaId = req.params.caja_id ? Number(req.params.caja_id) : null;

    if (cajaId !== null) {
      const error = validarIdPositivo(cajaId, 'caja_id');
      if (error) return res.status(400).json({ success: false, message: error });
    }

    const params = BuildParams([
      { name: 'caja_id', type: sql.Int, value: cajaId },
    ]);

    const data = await db.executeProc('productos_get_count_by_caja_id', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Conteo obtenido' : 'Sin datos',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener conteo por caja');
  }
});


module.exports = ProductosRouter;