// Routes/authRouter.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

// Ajusta la ruta a tu conector
const { db, sql } = require('../../db/dbconnector.js');

const router = express.Router();
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connect.sid';

// Rutas de redirección post-login
const ADMIN_HOME = '/admin-resources/pages/admin.html';
const USER_HOME  = '/user-resources/pages/miCuenta.html';

// ---------------------------
// Helpers 
// ---------------------------
function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save(err => (err ? reject(err) : resolve()))
  );
}

function regenerateSession(req) {
  return new Promise((resolve, reject) =>
    req.session.regenerate(err => (err ? reject(err) : resolve()))
  );
}

function isHtmlRequest(req) {
  return (req.headers.accept || '').includes('text/html');
}

// ---------------------------
// Limitador de Peticiones (Rate Limiting para Login)
// ---------------------------
// Máximo 5 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, message: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.' }
});

// ---------------------------
// POST /login
// ---------------------------
router.post('/login', loginLimiter, [
  body('login').trim().isLength({ min: 1, max: 150 }).withMessage('Usuario o email requerido'),
  body('password').notEmpty().withMessage('Se requiere contraseña')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { login, password } = req.body;

  try {
    // 1. Determinar si el input es un email o un nombre de usuario
    const isEmail = login.includes('@');
    
    // Parámetros para buscar el ID, el nombre y el rol (sin traer la contraseña todavía)
    const paramsID = {
      nombre: { type: sql.NVarChar(100), value: isEmail ? null : login },
      email:  { type: sql.NVarChar(150), value: isEmail ? login : null }
    };

    // PASO 1: Obtener la info básica del usuario (ID, nombre, tipo, email)
    const userResult = await db.executeProc('usuarios_get_id_for_login', paramsID);
    
    if (!userResult || userResult.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const user = userResult[0];

    // PASO 2: Obtener el hash de la contraseña de forma separada e interna usando el ID
    const paramsPass = { 
      usuario_id: { type: sql.Int, value: user.usuario_id } 
    };
    
    const passResult = await db.executeProc('usuario_get_password', paramsPass);

    if (!passResult || passResult.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }

    const storedHash = passResult[0].contrasena;

    // PASO 3: Comparar la contraseña enviada con el Hash almacenado usando bcrypt
    const isMatch = await bcrypt.compare(password, storedHash);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }

    // PASO 4: Regenerar la sesión (Previene ataques de Session Fixation)
    await regenerateSession(req);

    // Guardar datos en la sesión (NUNCA guardar la contraseña)
    req.session.userID   = user.usuario_id;
    req.session.username = user.nombre;
    
    // Mapear el TINYINT a un string legible para el frontend
    req.session.userType = user.tipo === 1 ? 'admin' : 'usuario'; 
    
    // Evaluaciones booleanas correctas basadas en el TINYINT (1 o 2)
    req.session.isAdmin  = (user.tipo === 1);
    req.session.isUser   = (user.tipo === 2);
    
    req.session.isAuth   = true;

    // Persistir explícitamente antes de responder
    await saveSession(req);

    const redirectUrl = req.session.isAdmin ? ADMIN_HOME : USER_HOME;
    
    return res.json({ 
      success: true, 
      message: 'Login exitoso', 
      redirect: redirectUrl 
    });

  } catch (error) {
    console.error('Error en el proceso de login:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// ---------------------------
// GET /status (Verificar sesión actual)
// ---------------------------
router.get('/status', (req, res) => {
  const authenticated = !!req.session?.isAuth;
  
  res.json({
    role:     authenticated ? (req.session.userType || 'Usuario') : 'guest',
    isAdmin:  !!req.session?.isAdmin,
    isUser:   !!req.session?.isUser,
    isAuth:   !!req.session?.isAuth,
    userID:   authenticated ? (req.session.userID || null) : null,
    username: authenticated ? (req.session.username || null) : null
  });
});

// ---------------------------
// POST /logout (Cerrar sesión)
// ---------------------------
router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true, message: 'No hay sesión activa' });
  }

  req.session.destroy(err => {
    if (err) {
      console.error('Error al destruir la sesión:', err);
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.json({ success: true, message: 'Sesión cerrada exitosamente', redirect: '/index.html' });
  });
});

// ---------------------------
// Middlewares de autorización
// ---------------------------
function requireAuth(req, res, next) {
  const hasSession = !!req.session?.userID;
  const hasAllowedRole = !!(req.session?.isAdmin || req.session?.isUser);

  if (hasSession && hasAllowedRole) return next();

  // No autenticado
  if (isHtmlRequest(req)) return res.redirect('/index.html');
  return res.status(401).json({ success: false, message: 'No autenticado.' });
}

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    if (isHtmlRequest(req)) return res.redirect('/index.html');
    return res.status(403).json({ success: false, message: 'Prohibido: se requieren privilegios de administrador' });
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.session?.isUser) {
    if (isHtmlRequest(req)) return res.redirect('/index.html');
    return res.status(403).json({ success: false, message: 'Prohibido: solo para Usuarios' });
  }
  next();
}

// Exportamos el router y los middlewares juntos para que server.js los pueda usar correctamente
module.exports = {
  router,
  requireAuth,
  requireAdmin,
  requireUser
};