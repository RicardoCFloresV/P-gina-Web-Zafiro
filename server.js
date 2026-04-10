// server.js
'use strict';

require('dotenv').config();

/**
 * Importación de módulos principales
 */
const express    = require('express');         // Servidor HTTP
const cors       = require('cors');            // CORS
const session    = require('express-session'); // Sesiones de usuario
const MSSQLStore = require('connect-mssql-v2'); // Sesiones persistentes en SQL Server
const helmet     = require('helmet');          // Seguridad HTTP
const path       = require('path');            // Rutas de archivos
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

// Conector con la base de datos (pool + utilidades)
const { db } = require('./db/dbconnector.js');

// Importar Enrutadores
const authModule             = require('./Server/Routes/authRouter.js'); // Exporta router + middlewares de auth
const authRouter             = authModule.router || authModule; 
const UnidadesRouter         = require('./Server/Routes/unidadesRouter.js');
const cajasRouter            = require('./Server/Routes/cajasRouter.js');
const categoriasRouter       = require('./Server/Routes/categoriasRouter.js');
const marcasRouter           = require('./Server/Routes/marcasRouter.js');
const presentacionesRouter   = require('./Server/Routes/presentacionesRouter.js');
const productosRouter        = require('./Server/Routes/productosRouter.js');

// Middlewares de autorización para proteger las rutas
const { requireAuth, requireAdmin, requireUser } = authModule;

/**
 * APP y MIDDLEWARES BASE
 */
const app = express();

// 1. HELMET: Seguridad en Cabeceras 
app.use(helmet({
  hsts: false, // Desactivado 
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "http://127.0.0.1:5500", "http://localhost:5500"], // Permite a Live Server comunicarse
      upgradeInsecureRequests: null
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * CONFIGURACIÓN DE SESIONES PERSISTENTES (connect-mssql-v2)
 */
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true // Requerido para desarrollo local sin SSL formal en SQL Server
  }
};

const sessionStore = new MSSQLStore({ ...dbConfig, autoRemove: true }, {
  table: 'sesiones_usuario', // La tabla se llamará así en SQL Server
  autoCreate: true           // Crea la tabla automáticamente si no existe
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { 
    maxAge: 60 * 60 * 1000, // 1 hora de duración
    httpOnly: true,
    secure: false // (sin HTTPS)
  }
}));

/**
 * LIMITADOR DE SOLICITUDES CONCURRENTES POR SESIÓN (Evita Spam a la DB)
 */
const activeRequests = new Map();

app.use((req, res, next) => {
  if (!req.sessionID) return next();

  const currentRequests = activeRequests.get(req.sessionID) || 0;

  // Límite establecido a 4 solicitudes concurrentes
  if (currentRequests >= 4) {
    return res.status(429).json({ 
      success: false, 
      message: 'Demasiadas solicitudes simultáneas. Por favor, espere.' 
    });
  }

  activeRequests.set(req.sessionID, currentRequests + 1);

  // Reducir el contador cuando termine la petición
  res.on('finish', () => {
    const count = activeRequests.get(req.sessionID);
    if (count > 1) {
      activeRequests.set(req.sessionID, count - 1);
    } else {
      activeRequests.delete(req.sessionID); // Limpieza de memoria
    }
  });

  next();
});

/**
 * CONFIGURACIÓN DE SWAGGER
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Documentación de la API para Autenticación y Unidades',
    },
    servers: [
      {
        // Matches the port fallback you already use
        url: `http://localhost:${process.env.PORT || 3000}`, 
      },
    ],
  },
  // This points to the folder where you keep your route files
  apis: ['./Routes/*.js'], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Ruta de documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


/**
 * ARCHIVOS ESTÁTICOS
 */
const PUBLIC_DIR = path.resolve(process.cwd(), 'Public');
app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  maxAge: '1d',
}));

/**
 * RUTAS DE LA API
 */
/**
 * RUTAS DE LA API
 */
// Ruta pública de Autenticación (Login, Logout, etc.)
app.use('/api/auth', authRouter);

// Rutas protegidas (Requieren autenticación previa y opcionalmente roles)
app.use('/api/unidades', requireAuth, UnidadesRouter); 
app.use('/api/cajas', requireAuth, cajasRouter);
app.use('/api/categorias', requireAuth, categoriasRouter);
app.use('/api/marcas', requireAuth, marcasRouter);
app.use('/api/presentaciones', requireAuth, presentacionesRouter);
app.use('/api/productos', requireAuth, productosRouter);

// Fallback al index.html explícito
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
    
    // Esperar a que la base de datos se conecte exitosamente primero
    await db.poolReady; 

    // Solo iniciar HTTP si la BD está lista
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

/**
 * APAGADO ORDENADO (Graceful Shutdown)
 */
async function safeShutdown(reason = 'shutdown', exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[${reason}] Cerrando servidor...`);

  // 1) Cierra HTTP
  await new Promise((resolve) => {
    if (!httpServer) return resolve();
    httpServer.close((err) => {
      if (err) console.error('Error al cerrar HTTP:', err);
      resolve();
    });
  });

  // 2) Cierra pool SQL
  if (db && typeof db.close === 'function') {
    try { 
      await db.close(); 
    } catch (e) { 
      console.error('Error al cerrar pool SQL:', e); 
    }
  }

  console.log('Apagado completo. Hasta luego.');
  process.exit(exitCode);
}

// Escuchar Señales y errores no controlados para apagado seguro
process.on('SIGINT',  () => safeShutdown('SIGINT', 0));
process.on('SIGTERM', () => safeShutdown('SIGTERM', 0));
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada (uncaughtException):', err);
  safeShutdown('uncaughtException', 1);
});

// Arrancar el sistema
startServer();