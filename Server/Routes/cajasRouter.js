// Server/Routes/cajasRouter.js
// Recurso: CAJAS
// Montaje: app.use('/api/cajas', cajasRouter)
//
// ┌─────────────────────┬────────────────────────────────┬────────────────────────────────────────────────────┐
// │ Endpoint            │ SP llamado                     │ Datos de retorno                                   │
// ├─────────────────────┼────────────────────────────────┼────────────────────────────────────────────────────┤
// │ POST /insert        │ cajas_insert                   │ { caja_id, letra, cara, nivel, etiqueta }          │
// │ POST /update        │ cajas_update                   │ { caja_id, letra, cara, nivel, etiqueta }          │
// │ POST /set_state     │ cajas_set_state                │ (ninguno)                                          │
// │ GET  /get_all       │ cajas_get_all                  │ [{ caja_id, letra, cara, nivel, etiqueta, stock }] │
// │ GET  /por_id/:id    │ cajas_get_by_id                │ { caja_id, letra, cara, nivel, etiqueta }          │
// │ GET  /por_letra/:l  │ cajas_get_by_letra             │ [{ caja_id, letra, cara, nivel, etiqueta }]        │
// │ GET  /buscar        │ cajas_get_by_etiqueta          │ [{ caja_id, letra, cara, nivel, etiqueta, stock }] │
// └─────────────────────┴────────────────────────────────┴────────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const CajasRouter = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Construye el objeto params que espera dbconnector.queryWithParams / executeProc
function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

// Mapeo de códigos de error SQL → { status HTTP, mensaje amigable }
// Los números (52001‑52030) son los que lanzan los SP con THROW
const SQL_ERROR_MAP = {
  // ── cajas_insert ──
  52001: { status: 400, message: 'La letra debe tener entre 1 y 2 caracteres.' },
  52002: { status: 400, message: 'Cara inválida. Use 1 = FRENTE, 2 = ATRAS.' },
  52003: { status: 400, message: 'Nivel inválido. Use 1 = ARRIBA, 2 = ABAJO.' },
  52004: { status: 409, message: 'Ya existe una caja con esa misma configuración.' },

  // ── cajas_update ──
  52005: { status: 404, message: 'La caja no se encuentra en la base de datos.' },
  52006: { status: 400, message: 'La letra debe tener entre 1 y 2 caracteres.' },
  52007: { status: 400, message: 'Cara inválida.' },
  52008: { status: 400, message: 'Nivel inválido.' },
  52009: { status: 409, message: 'Otra caja ya usa esa combinación de letra, cara y nivel.' },

  // ── cajas_set_state ──
  52010: { status: 409, message: 'No se puede desactivar: la caja tiene productos asignados.' },

  // ── cajas_get_by_etiqueta ──
  52030: { status: 400, message: 'Debe proporcionar una etiqueta o un ID para buscar.' },
};

// Extrae el código numérico del error SQL y devuelve la respuesta mapeada.
// Si el código no está mapeado → 500 genérico.
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

// Valida letra: string, 1‑2 caracteres, solo A‑Z
function validarLetra(letra) {
  if (typeof letra !== 'string') return 'letra es obligatoria y debe ser texto.';
  const limpia = letra.trim().toUpperCase();
  if (limpia.length < 1 || limpia.length > 2) return 'letra debe tener 1 o 2 caracteres.';
  if (!/^[A-Z]{1,2}$/.test(limpia)) return 'letra solo puede contener letras A‑Z.';
  return null; // sin error
}

// Valida cara: debe ser 1 o 2
function validarCara(cara) {
  const n = Number(cara);
  if (isNaN(n) || (n !== 1 && n !== 2)) return 'cara debe ser 1 (FRENTE) o 2 (ATRAS).';
  return null;
}

// Valida nivel: debe ser 1 o 2
function validarNivel(nivel) {
  const n = Number(nivel);
  if (isNaN(n) || (n !== 1 && n !== 2)) return 'nivel debe ser 1 (ARRIBA) o 2 (ABAJO).';
  return null;
}

// Valida entero positivo (caja_id, id genérico)
function validarIdPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return `${campo} debe ser un entero positivo.`;
  return null;
}

// Valida estado: debe ser 0 o 1
function validarEstado(estado) {
  const n = Number(estado);
  if (isNaN(n) || (n !== 0 && n !== 1)) return 'estado debe ser 0 (inactivo) o 1 (activo).';
  return null;
}

// Acumula errores y devuelve { isValid, errors }
function validar(checks) {
  const errors = checks.filter(e => e !== null);
  return { isValid: errors.length === 0, errors };
}


// ═════════════════════════════════════════════════════════════════════════════
//  POST /insert   (auth requerido)
//  ► Datos esperados : { letra: String, cara: Number(1|2), nivel: Number(1|2) }
//  ► SP llamado      : cajas_insert(@letra, @cara, @nivel)
//  ► Retorna          : { caja_id, letra, cara, nivel, etiqueta }
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const { letra, cara, nivel } = req.body;

    const { isValid, errors } = validar([
      validarLetra(letra),
      validarCara(cara),
      validarNivel(nivel),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'letra', type: sql.VarChar(2), value: letra.trim().toUpperCase() },
      { name: 'cara',  type: sql.TinyInt,    value: Number(cara) },
      { name: 'nivel', type: sql.TinyInt,    value: Number(nivel) },
    ]);

    const data = await db.executeProc('cajas_insert', params);
    return res.status(201).json({ success: true, message: 'Caja creada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear la caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update   (auth requerido)
//  ► Datos esperados : { caja_id: Number, letra: String, cara: Number(1|2), nivel: Number(1|2) }
//  ► SP llamado      : cajas_update(@caja_id, @letra, @cara, @nivel)
//  ► Retorna          : { caja_id, letra, cara, nivel, etiqueta }
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const { caja_id, letra, cara, nivel } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarLetra(letra),
      validarCara(cara),
      validarNivel(nivel),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id', type: sql.Int,        value: Number(caja_id) },
      { name: 'letra',   type: sql.VarChar(2), value: letra.trim().toUpperCase() },
      { name: 'cara',    type: sql.TinyInt,     value: Number(cara) },
      { name: 'nivel',   type: sql.TinyInt,     value: Number(nivel) },
    ]);

    const data = await db.executeProc('cajas_update', params);
    return res.status(200).json({ success: true, message: 'Caja actualizada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (auth requerido)
//  ► Datos esperados : { caja_id: Number, estado: Number(0|1) }
//  ► SP llamado      : cajas_set_state(@caja_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.post('/set_state', requireAuth, async (req, res) => {
  try {
    const { caja_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(caja_id, 'caja_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'caja_id', type: sql.Int, value: Number(caja_id) },
      { name: 'estado',  type: sql.Bit, value: Number(estado) },
    ]);

    await db.executeProc('cajas_set_state', params);

    const msg = Number(estado) === 1 ? 'Caja activada' : 'Caja desactivada';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado de la caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all
//  ► Datos esperados : (ninguno)
//  ► SP llamado      : cajas_get_all()
//  ► Retorna          : [{ caja_id, letra, cara, nivel, etiqueta, stock }]
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('cajas_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Cajas listadas' : 'Sin cajas registradas',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar cajas');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:caja_id
//  ► Datos esperados : caja_id (param URL)
//  ► SP llamado      : cajas_get_by_id(@caja_id)
//  ► Retorna          : { caja_id, letra, cara, nivel, etiqueta }
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.get('/por_id/:caja_id', async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.caja_id, 'caja_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'caja_id', type: sql.Int, value: Number(req.params.caja_id) },
    ]);

    const data = await db.executeProc('cajas_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Caja no encontrada' });

    return res.status(200).json({ success: true, message: 'Caja obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener la caja');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_letra/:letra
//  ► Datos esperados : letra (param URL, 1‑2 chars A‑Z)
//  ► SP llamado      : cajas_get_by_letra(@letra)
//  ► Retorna          : [{ caja_id, letra, cara, nivel, etiqueta }]
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.get('/por_letra/:letra', async (req, res) => {
  try {
    const error = validarLetra(req.params.letra);
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'letra', type: sql.VarChar(2), value: req.params.letra.trim().toUpperCase() },
    ]);

    const data = await db.executeProc('cajas_get_by_letra', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Cajas encontradas' : 'No hay cajas con esa letra',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar cajas por letra');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /buscar?etiqueta=...  ó  GET /buscar?id=...
//  ► Datos esperados : query string → etiqueta (String) ó id (Number)
//  ► SP llamado      : cajas_get_by_etiqueta(@etiqueta, @id)
//  ► Retorna          : [{ caja_id, letra, cara, nivel, etiqueta, stock }]
// ═════════════════════════════════════════════════════════════════════════════
CajasRouter.get('/buscar', async (req, res) => {
  try {
    const { etiqueta, id } = req.query;

    // Al menos uno de los dos es obligatorio
    if (!etiqueta && !id) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar el parámetro "etiqueta" o "id" en la query string.',
      });
    }

    // Si viene id, validar que sea entero positivo
    if (id) {
      const error = validarIdPositivo(id, 'id');
      if (error) return res.status(400).json({ success: false, message: error });
    }

    const params = BuildParams([
      { name: 'etiqueta', type: sql.VarChar(50), value: etiqueta || null },
      { name: 'id',       type: sql.Int,         value: id ? Number(id) : null },
    ]);

    const data = await db.executeProc('cajas_get_by_etiqueta', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'No se encontraron cajas' });

    return res.status(200).json({ success: true, message: 'Búsqueda completada', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar caja');
  }
});


module.exports = CajasRouter;