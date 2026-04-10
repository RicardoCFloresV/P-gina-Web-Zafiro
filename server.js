// server.js
'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const session    = require('express-session');
const MSSQLStore = require('connect-mssql-v2');
const helmet     = require('helmet');
const path       = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const { db } = require('./db/dbconnector.js');

// ─── Importar Enrutadores ───────────────────────────────────────────────────
const authModule             = require('./Server/Routes/authRouter.js');
const authRouter             = authModule.router || authModule;
const UnidadesRouter         = require('./Server/Routes/unidadesRouter.js');
const cajasRouter            = require('./Server/Routes/cajasRouter.js');
const categoriasRouter       = require('./Server/Routes/categoriasRouter.js');
const marcasRouter           = require('./Server/Routes/marcasRouter.js');
const presentacionesRouter   = require('./Server/Routes/presentacionesRouter.js');
const productosRouter        = require('./Server/Routes/productosRouter.js');
const usuariosRouter         = require('./Server/Routes/usuariosRouter.js');
const logsRouter             = require('./Server/Routes/logsRouter.js');

const { requireAuth, requireAdmin, requireUser } = authModule;

/**
 * APP y MIDDLEWARES BASE
 */
const app = express();

// ─── HELMET (desarrollo) ────────────────────────────────────────────────────
// CSP, COOP, COEP, CORP desactivados para desarrollo con CDNs externos
// y acceso por IP no-localhost (ej: http://31.97.150.130:3000)
// TODO: Reactivar en producción con directivas CSP apropiadas
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: false,
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * SESIONES PERSISTENTES
 */
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
};

const sessionStore = new MSSQLStore({ ...dbConfig, autoRemove: true }, {
  table: 'sesiones_usuario',
  autoCreate: true
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 60 * 60 * 1000, httpOnly: true, secure: false }
}));

/**
 * LIMITADOR CONCURRENTE POR SESIÓN
 */
const activeRequests = new Map();

app.use((req, res, next) => {
  if (!req.sessionID) return next();
  const currentRequests = activeRequests.get(req.sessionID) || 0;
  if (currentRequests >= 4) {
    return res.status(429).json({ success: false, message: 'Demasiadas solicitudes simultáneas. Por favor, espere.' });
  }
  activeRequests.set(req.sessionID, currentRequests + 1);
  res.on('finish', () => {
    const count = activeRequests.get(req.sessionID);
    if (count > 1) activeRequests.set(req.sessionID, count - 1);
    else activeRequests.delete(req.sessionID);
  });
  next();
});

/**
 * SWAGGER
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'API Documentation', version: '1.0.0', description: 'Documentación de la API de Zafiro Home' },
    servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
  },
  apis: ['./Server/Routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * ARCHIVOS ESTÁTICOS
 */
const PUBLIC_DIR = path.resolve(process.cwd(), 'Public');
app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: '1d' }));

/**
 * RUTAS DE LA API
 */
app.use('/api/auth', authRouter);

app.use('/api/unidades',        requireAuth, UnidadesRouter);
app.use('/api/cajas',           requireAuth, cajasRouter);
app.use('/api/categorias',      requireAuth, categoriasRouter);
app.use('/api/marcas',          requireAuth, marcasRouter);
app.use('/api/presentaciones',  requireAuth, presentacionesRouter);
app.use('/api/productos',       requireAuth, productosRouter);

app.use('/api/usuarios',        requireAdmin, usuariosRouter);
app.use('/api/logs',            requireAdmin, logsRouter);

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/**
 * ARRANQUE DEL SERVIDOR
 */
let httpServer;
let shuttingDown = false;
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('Iniciando servicios, esperando base de datos...');
    await db.poolReady;
    httpServer = app.listen(port, () => {
      console.log(`Servidor HTTP corriendo exitosamente en el puerto ${port}`);
    });
    httpServer.on('error', (err) => {
      console.error('Error del servidor HTTP:', err);
      safeShutdown('http_server_error', 1);
    });
  } catch (err) {
    console.error('FATAL: No se pudo conectar con la base de datos. El servidor no arrancará.', err);
    process.exit(1);
  }
}

async function safeShutdown(reason = 'shutdown', exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${reason}] Cerrando servidor...`);
  await new Promise((resolve) => {
    if (!httpServer) return resolve();
    httpServer.close((err) => { if (err) console.error('Error al cerrar HTTP:', err); resolve(); });
  });
  if (db && typeof db.close === 'function') {
    try { await db.close(); } catch (e) { console.error('Error al cerrar pool SQL:', e); }
  }
  console.log('Apagado completo. Hasta luego.');
  process.exit(exitCode);
}

process.on('SIGINT',  () => safeShutdown('SIGINT', 0));
process.on('SIGTERM', () => safeShutdown('SIGTERM', 0));
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada (uncaughtException):', err);
  safeShutdown('uncaughtException', 1);
});

startServer();