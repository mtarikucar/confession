import express from 'express';
import os from 'os';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).send('OK');
});

// Readiness probe (checks if service is ready to accept traffic)
router.get('/ready', asyncHandler(async (req, res) => {
  const checks = {
    database: false,
    redis: false
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  // Check Redis connection
  try {
    await redisClient.ping();
    checks.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  const isReady = checks.database && checks.redis;
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks
  });
}));

// Detailed health check with metrics
router.get('/health/detailed', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // System metrics
  const systemMetrics = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    loadAverage: os.loadavg(),
    uptime: os.uptime()
  };

  // Process metrics
  const processMetrics = {
    pid: process.pid,
    version: process.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  };

  // Database health
  let databaseHealth = {
    connected: false,
    responseTime: 0
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    databaseHealth.connected = true;
    databaseHealth.responseTime = Date.now() - dbStart;
    
    // Get database stats
    const [userCount, roomCount, gameCount] = await Promise.all([
      prisma.user.count(),
      prisma.room.count({ where: { isActive: true } }),
      prisma.game.count()
    ]);
    
    databaseHealth.stats = {
      users: userCount,
      activeRooms: roomCount,
      totalGames: gameCount
    };
  } catch (error) {
    databaseHealth.error = error.message;
  }

  // Redis health
  let redisHealth = {
    connected: false,
    responseTime: 0
  };

  try {
    const redisStart = Date.now();
    await redisClient.ping();
    redisHealth.connected = true;
    redisHealth.responseTime = Date.now() - redisStart;
    
    // Get Redis info
    const info = await redisClient.info();
    const lines = info.split('\r\n');
    const stats = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (['used_memory_human', 'connected_clients', 'total_connections_received', 'instantaneous_ops_per_sec'].includes(key)) {
          stats[key] = value;
        }
      }
    });
    
    redisHealth.stats = stats;
  } catch (error) {
    redisHealth.error = error.message;
  }

  // Socket.IO metrics (if available)
  let socketMetrics = {};
  if (global.io) {
    socketMetrics = {
      connectedSockets: global.io.sockets.sockets.size,
      rooms: global.io.sockets.adapter.rooms.size
    };
  }

  const overallHealth = databaseHealth.connected && redisHealth.connected ? 'healthy' : 'unhealthy';
  const responseTime = Date.now() - startTime;

  res.json({
    status: overallHealth,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    services: {
      database: databaseHealth,
      redis: redisHealth,
      socketIO: socketMetrics
    },
    system: systemMetrics,
    process: processMetrics
  });
}));

// Metrics endpoint (Prometheus format)
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = [];

  // Process metrics
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP process_memory_heap_used_bytes Process heap memory used`);
  metrics.push(`# TYPE process_memory_heap_used_bytes gauge`);
  metrics.push(`process_memory_heap_used_bytes ${memUsage.heapUsed}`);
  
  metrics.push(`# HELP process_memory_heap_total_bytes Process heap memory total`);
  metrics.push(`# TYPE process_memory_heap_total_bytes gauge`);
  metrics.push(`process_memory_heap_total_bytes ${memUsage.heapTotal}`);
  
  metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  metrics.push(`# TYPE process_uptime_seconds counter`);
  metrics.push(`process_uptime_seconds ${process.uptime()}`);

  // System metrics
  metrics.push(`# HELP system_memory_free_bytes System free memory`);
  metrics.push(`# TYPE system_memory_free_bytes gauge`);
  metrics.push(`system_memory_free_bytes ${os.freemem()}`);
  
  metrics.push(`# HELP system_load_average System load average`);
  metrics.push(`# TYPE system_load_average gauge`);
  const loadAvg = os.loadavg();
  metrics.push(`system_load_average{interval="1m"} ${loadAvg[0]}`);
  metrics.push(`system_load_average{interval="5m"} ${loadAvg[1]}`);
  metrics.push(`system_load_average{interval="15m"} ${loadAvg[2]}`);

  // Application metrics
  try {
    const [userCount, roomCount, gameCount, sessionCount] = await Promise.all([
      prisma.user.count(),
      prisma.room.count({ where: { isActive: true } }),
      prisma.game.count({ where: { endedAt: null } }),
      prisma.session.count({ where: { isActive: true } })
    ]);

    metrics.push(`# HELP app_users_total Total number of users`);
    metrics.push(`# TYPE app_users_total gauge`);
    metrics.push(`app_users_total ${userCount}`);
    
    metrics.push(`# HELP app_rooms_active Active rooms`);
    metrics.push(`# TYPE app_rooms_active gauge`);
    metrics.push(`app_rooms_active ${roomCount}`);
    
    metrics.push(`# HELP app_games_active Active games`);
    metrics.push(`# TYPE app_games_active gauge`);
    metrics.push(`app_games_active ${gameCount}`);
    
    metrics.push(`# HELP app_sessions_active Active sessions`);
    metrics.push(`# TYPE app_sessions_active gauge`);
    metrics.push(`app_sessions_active ${sessionCount}`);
  } catch (error) {
    console.error('Error collecting app metrics:', error);
  }

  // Socket.IO metrics
  if (global.io) {
    metrics.push(`# HELP socketio_connected_clients Connected Socket.IO clients`);
    metrics.push(`# TYPE socketio_connected_clients gauge`);
    metrics.push(`socketio_connected_clients ${global.io.sockets.sockets.size}`);
  }

  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
}));

// Application info endpoint
router.get('/info', (req, res) => {
  res.json({
    name: 'Confession Game Server',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    node: {
      version: process.version,
      env: process.env.NODE_ENV
    },
    git: {
      branch: process.env.GIT_BRANCH || 'unknown',
      commit: process.env.GIT_COMMIT || 'unknown'
    },
    build: {
      time: process.env.BUILD_TIME || new Date().toISOString(),
      number: process.env.BUILD_NUMBER || 'local'
    }
  });
});

export default router;