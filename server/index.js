import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import configurations
import prisma, { testConnection } from './config/database.js';
import redisClient, { createRedisAdapter } from './config/redis.js';
import logger, { logInfo, logError } from './config/logger.js';

// Import middleware
import { 
  errorHandler, 
  notFound, 
  handleUncaughtException, 
  handleUnhandledRejection,
  gracefulShutdown 
} from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';

// Import socket setup
import { setupSocketHandlers } from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO with Redis adapter
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  adapter: createRedisAdapter()
});

// Make io globally available (for monitoring)
global.io = io;

// Setup error handlers
handleUncaughtException();
handleUnhandledRejection();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Trust proxy (for correct IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Catch all handler for React app
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    // Start listening
    server.listen(PORT, () => {
      logInfo(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        dbConnected
      });
      
      console.log(`
  🎮 Confession Game Server ${dbConnected ? '(Database-Driven)' : '(Fallback Mode)'}
  ==========================================
  Environment: ${process.env.NODE_ENV}
  Port: ${PORT}
  Database: ${dbConnected ? '✅ Connected (PostgreSQL)' : '⚠️ Not Connected (Using Redis Only)'}
  Cache: ✅ Connected (Redis)
  
  Health Check: http://localhost:${PORT}/api/health
  Metrics: http://localhost:${PORT}/api/health/metrics
  
  ${process.env.NODE_ENV === 'development' ? 
    `Admin Panel: http://localhost:8080 (Adminer)
  Redis Commander: http://localhost:8081` : ''}
  `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
gracefulShutdown(server, prisma, redisClient);

export default server;