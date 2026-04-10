// Server/Routes/usuariosRouter.js
// Recurso: USUARIOS
// Montaje: app.use('/api/usuarios', usuariosRouter)
//
// ┌─────────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────────────────────┐
// │ Endpoint                        │ SP llamado                           │ Datos de retorno                                     │
// ├─────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────┤
// │ POST /insert                    │ usuarios_insert                      │ { usuario_id }                                       │
// │ POST /set_state                 │ usuarios_set_state                   │ (ninguno)                                            │
// │ POST /update_password           │ usuarios_update_password             │ (ninguno)                                            │
// │ POST /set_tipo                  │ usuarios_set_tipo                    │ (ninguno)                                            │
// │ POST /change_name               │ usuarios_change_name                 │ (ninguno)                                            │
// │ GET  /get_all                   │ usuarios_get_all                     │ [{ usuario_id, nombre, email, tipo }]                │
// │ GET  /por_id/:id                │ usuarios_get_by_id                   │ { usuario_id, nombre, email, tipo }                  │
// │ GET  /por_nombre                │ usuarios_get_by_nombre               │ [{ usuario_id, nombre, email, tipo }]                │
// │ GET  /get_password              │ usuario_get_password                 │ { contrasena }                                       │
// └─────────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────────────────────┘

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAuth, requireAdmin } = require('./authRouter.js');

const UsuariosRouter = express.Router();


// ─── Helpers ──────────────────────────────────────────────────────────────────

function BuildParams(entries) {
  const p = {};
  for (const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

const SQL_ERROR_MAP = {
  // ── usuarios_insert ──
  50001: { status: 400, message: 'El nombre de usuario es obligatorio.' },
  50002: { status: 400, message: 'La contraseña es obligatoria.' },
  50003: { status: 400, message: 'El email es obligatorio.' },
  50004: { status: 400, message: 'Tipo de usuario inválido.' },
  50005: { status: 409, message: 'Ya existe otro usuario con ese nombre.' },
  50006: { status: 409, message: 'Ya existe otro usuario con ese email.' },

  // ── usuarios_get_by_nombre / usuario_get_password ──
  50010: { status: 400, message: 'Debe proporcionar nombre o email para buscar.' },

  // ── usuarios_set_state / set_tipo ──
  51000: { status: 404, message: 'El usuario no existe o está inactivo.' },
  51001: { status: 404, message: 'El usuario no existe.' },

  // ── usuarios_change_name ──
  51002: { status: 409, message: 'El correo electrónico ya está en uso por otra cuenta.' },
  51003: { status: 409, message: 'El nombre de usuario ya está en uso.' },
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

function validarEmail(email) {
  if (typeof email !== 'string' || email.trim() === '') return 'El email es obligatorio.';
  if (email.trim().length > 150) return 'El email no puede exceder 150 caracteres.';
  // Validación básica de formato
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Formato de email inválido.';
  return null;
}

function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena === '') return 'La contraseña es obligatoria.';
  if (contrasena.length > 255) return 'La contraseña no puede exceder 255 caracteres.';
  return null;
}

function validarTipo(tipo) {
  const n = Number(tipo);
  if (isNaN(n) || (n !== 1 && n !== 2)) return 'tipo debe ser 1 (ADMIN) o 2 (USUARIO).';
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
//  POST /insert   (admin requerido)
//  ► Datos esperados : { nombre, contrasena, email, tipo }
//  ► SP llamado      : usuarios_insert(@nombre, @contrasena, @email, @tipo)
//  ► Retorna          : { usuario_id }
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    const { nombre, contrasena, email, tipo } = req.body;

    const { isValid, errors } = validar([
      validarNombre(nombre),
      validarContrasena(contrasena),
      validarEmail(email),
      validarTipo(tipo),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'nombre',     type: sql.NVarChar(100), value: nombre.trim() },
      { name: 'contrasena', type: sql.NVarChar(255), value: contrasena },
      { name: 'email',      type: sql.NVarChar(150), value: email.trim() },
      { name: 'tipo',       type: sql.TinyInt,       value: Number(tipo) },
    ]);

    const data = await db.executeProc('usuarios_insert', params);
    return res.status(201).json({ success: true, message: 'Usuario creado', data });

  } catch (err) {
    return handleSqlError(err, res, 'Error al crear el usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_state   (admin requerido)
//  ► Datos esperados : { usuario_id: Number, estado: Number(0|1) }
//  ► SP llamado      : usuarios_set_state(@usuario_id, @estado)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.post('/set_state', requireAdmin, async (req, res) => {
  try {
    const { usuario_id, estado } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(usuario_id, 'usuario_id'),
      validarEstado(estado),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'usuario_id', type: sql.Int, value: Number(usuario_id) },
      { name: 'estado',     type: sql.Int, value: Number(estado) },
    ]);

    await db.executeProc('usuarios_set_state', params);

    const msg = Number(estado) === 1 ? 'Usuario activado' : 'Usuario desactivado';
    return res.status(200).json({ success: true, message: msg });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar estado del usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /update_password   (auth requerido)
//  ► Datos esperados : { usuario_id: Number, nueva_contrasena: String }
//  ► SP llamado      : usuarios_update_password(@usuario_id, @nueva_contrasena)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.post('/update_password', requireAuth, async (req, res) => {
  try {
    const { usuario_id, nueva_contrasena } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(usuario_id, 'usuario_id'),
      validarContrasena(nueva_contrasena),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'usuario_id',       type: sql.Int,           value: Number(usuario_id) },
      { name: 'nueva_contrasena', type: sql.NVarChar(255), value: nueva_contrasena },
    ]);

    await db.executeProc('usuarios_update_password', params);
    return res.status(200).json({ success: true, message: 'Contraseña actualizada' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar la contraseña');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /set_tipo   (admin requerido)
//  ► Datos esperados : { usuario_id: Number, tipo_usuario_id: Number(1|2) }
//  ► SP llamado      : usuarios_set_tipo(@usuario_id, @tipo_usuario_id)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.post('/set_tipo', requireAdmin, async (req, res) => {
  try {
    const { usuario_id, tipo_usuario_id } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(usuario_id, 'usuario_id'),
      validarTipo(tipo_usuario_id),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'usuario_id',      type: sql.Int, value: Number(usuario_id) },
      { name: 'tipo_usuario_id', type: sql.Int, value: Number(tipo_usuario_id) },
    ]);

    await db.executeProc('usuarios_set_tipo', params);
    return res.status(200).json({ success: true, message: 'Tipo de usuario actualizado' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al cambiar tipo de usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  POST /change_name   (auth requerido)
//  ► Datos esperados : { usuario_id: Number, nuevo_nombre: String, nuevo_email: String }
//  ► SP llamado      : usuarios_change_name(@usuario_id, @nuevo_nombre, @nuevo_email)
//  ► Retorna          : (ninguno — solo confirmación)
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.post('/change_name', requireAuth, async (req, res) => {
  try {
    const { usuario_id, nuevo_nombre, nuevo_email } = req.body;

    const { isValid, errors } = validar([
      validarIdPositivo(usuario_id, 'usuario_id'),
      validarNombre(nuevo_nombre),
      validarEmail(nuevo_email),
    ]);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const params = BuildParams([
      { name: 'usuario_id',   type: sql.Int,           value: Number(usuario_id) },
      { name: 'nuevo_nombre', type: sql.NVarChar(100), value: nuevo_nombre.trim() },
      { name: 'nuevo_email',  type: sql.NVarChar(150), value: nuevo_email.trim() },
    ]);

    await db.executeProc('usuarios_change_name', params);
    return res.status(200).json({ success: true, message: 'Datos de usuario actualizados' });

  } catch (err) {
    return handleSqlError(err, res, 'Error al actualizar datos del usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_all   (admin requerido)
//  ► SP llamado      : usuarios_get_all()
//  ► Retorna          : [{ usuario_id, nombre, email, tipo }]
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.get('/get_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('usuarios_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Usuarios listados' : 'Sin usuarios registrados',
      data,
    });
  } catch (err) {
    return handleSqlError(err, res, 'Error al listar usuarios');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_id/:usuario_id   (auth requerido)
//  ► SP llamado      : usuarios_get_by_id(@usuario_id)
//  ► Retorna          : { usuario_id, nombre, email, tipo }
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.get('/por_id/:usuario_id', requireAuth, async (req, res) => {
  try {
    const error = validarIdPositivo(req.params.usuario_id, 'usuario_id');
    if (error) return res.status(400).json({ success: false, message: error });

    const params = BuildParams([
      { name: 'usuario_id', type: sql.Int, value: Number(req.params.usuario_id) },
    ]);

    const data = await db.executeProc('usuarios_get_by_id', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    return res.status(200).json({ success: true, message: 'Usuario obtenido', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener el usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /por_nombre?nombre=...&email=...
//  ► SP llamado      : usuarios_get_by_nombre(@nombre, @email)
//  ► Retorna          : [{ usuario_id, nombre, email, tipo }]
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.get('/por_nombre', async (req, res) => {
  try {
    const { nombre, email } = req.query;

    if (!nombre && !email) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar el parámetro "nombre" o "email" en la query string.',
      });
    }

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre ? nombre.trim() : null },
      { name: 'email',  type: sql.NVarChar(150), value: email ? email.trim() : null },
    ]);

    const data = await db.executeProc('usuarios_get_by_nombre', params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Usuarios encontrados' : 'No se encontraron usuarios',
      data,
    });

  } catch (err) {
    return handleSqlError(err, res, 'Error al buscar usuario');
  }
});


// ═════════════════════════════════════════════════════════════════════════════
//  GET /get_password?nombre=...&email=...   (uso interno para login)
//  ► SP llamado      : usuario_get_password(@nombre, @email)
//  ► Retorna          : { contrasena }
// ═════════════════════════════════════════════════════════════════════════════
UsuariosRouter.get('/get_password', async (req, res) => {
  try {
    const { nombre, email } = req.query;

    if (!nombre && !email) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar el parámetro "nombre" o "email" en la query string.',
      });
    }

    const params = BuildParams([
      { name: 'nombre', type: sql.NVarChar(100), value: nombre ? nombre.trim() : null },
      { name: 'email',  type: sql.NVarChar(150), value: email ? email.trim() : null },
    ]);

    const data = await db.executeProc('usuario_get_password', params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    return res.status(200).json({ success: true, message: 'Contraseña obtenida', data: data[0] });

  } catch (err) {
    return handleSqlError(err, res, 'Error al obtener contraseña');
  }
});


module.exports = UsuariosRouter;
