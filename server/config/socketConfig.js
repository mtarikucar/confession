import redisClient from './redis.js';
import { logInfo, logError } from './logger.js';

/**
 * Socket.IO Optimized Configuration
 * Handles scaling, performance, and reliability
 */
export const socketConfig = {
  // CORS configuration
  cors: {
    origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  },
  
  // Transport configuration
  transports: ['websocket', 'polling'],
  
  // Connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: false
  },
  
  // Ping settings for connection health
  pingTimeout: 20000, // 20 seconds
  pingInterval: 10000, // 10 seconds
  
  // Performance optimizations
  perMessageDeflate: {
    threshold: 1024, // Compress messages larger than 1KB
    clientNoContextTakeover: true,
    serverNoContextTakeover: true
  },
  
  // HTTP compression
  httpCompression: {
    threshold: 1024,
    chunkSize: 8 * 1024,
    windowBits: 14,
    memLevel: 7
  },
  
  // Max HTTP buffer size (prevents memory issues)
  maxHttpBufferSize: 1e6, // 1MB
  
  // Allow batching of packets
  allowEIO3: true,
  
  // Server options
  serveClient: false, // Don't serve client files
  
  // Custom parser for better performance
  parser: undefined // Use default for now
};

/**
 * Create Redis adapter for Socket.IO scaling
 */
export async function createRedisAdapter() {
  try {
    // Import the already created pub/sub clients from redis.js
    const { createAdapter: createSocketAdapter } = await import('@socket.io/redis-adapter');
    const { pubClient, subClient } = await import('./redis.js');
    
    // Clients are already connected from redis.js
    logInfo('Using existing Redis adapter clients');
    
    return createSocketAdapter(pubClient, subClient, {
      publishOnSpecificResponseChannel: true,
      requestsTimeout: 5000
    });
  } catch (error) {
    logError(error, { context: 'Redis adapter creation' });
    // Return null instead of throwing to allow server to start without Redis adapter
    return null;
  }
}

/**
 * Socket.IO middleware for performance monitoring
 */
export function performanceMiddleware(socket, next) {
  const start = Date.now();
  
  // Track connection time
  socket.on('disconnect', () => {
    const duration = Date.now() - start;
    logInfo('Socket session duration', {
      socketId: socket.id,
      duration,
      userId: socket.userId
    });
  });
  
  // Track event processing time
  const originalEmit = socket.emit;
  socket.emit = function(...args) {
    const eventStart = Date.now();
    const result = originalEmit.apply(socket, args);
    const eventDuration = Date.now() - eventStart;
    
    if (eventDuration > 100) { // Log slow events
      logInfo('Slow event emission', {
        event: args[0],
        duration: eventDuration,
        socketId: socket.id
      });
    }
    
    return result;
  };
  
  next();
}

/**
 * Rate limiting configuration per event type
 */
export const rateLimits = {
  'gameAction': { limit: 30, window: 1 }, // 30 per second
  'sendMessage': { limit: 10, window: 10 }, // 10 per 10 seconds
  'createRoom': { limit: 3, window: 60 }, // 3 per minute
  'joinRoom': { limit: 10, window: 60 }, // 10 per minute
  'submitConfession': { limit: 5, window: 60 }, // 5 per minute
  'requestMatch': { limit: 5, window: 30 }, // 5 per 30 seconds
  'updateNickname': { limit: 3, window: 60 } // 3 per minute
};

/**
 * Connection limits
 */
export const connectionLimits = {
  maxConnectionsPerIP: 10,
  maxRoomsPerUser: 5,
  maxPlayersPerRoom: 20,
  maxMessagesInHistory: 100,
  maxGameHistorySize: 50
};

/**
 * Event batching configuration
 */
export const batchingConfig = {
  enabled: true,
  maxBatchSize: 10,
  batchInterval: 50, // milliseconds
  events: ['gameUpdate', 'playerPosition', 'drawingData']
};

/**
 * Compression settings for different data types
 */
export const compressionSettings = {
  gameState: {
    compress: true,
    algorithm: 'gzip',
    level: 6
  },
  chatMessages: {
    compress: false // Usually small
  },
  drawingData: {
    compress: true,
    algorithm: 'deflate',
    level: 9
  }
};

/**
 * Namespace configuration for better organization
 */
export const namespaces = {
  '/': {
    name: 'default',
    middlewares: ['auth', 'rateLimit']
  },
  '/game': {
    name: 'game',
    middlewares: ['auth', 'gameAuth', 'rateLimit']
  },
  '/chat': {
    name: 'chat',
    middlewares: ['auth', 'rateLimit']
  }
};

/**
 * Optimize Socket.IO server instance
 */
export function optimizeSocketIO(io) {
  // Set max listeners to prevent warnings
  io.setMaxListeners(100);
  
  // Enable binary support
  io.binary = true;
  
  // Custom error handling
  io.on('error', (error) => {
    logError(error, { context: 'Socket.IO server error' });
  });
  
  // Monitor connections
  let connectionCount = 0;
  io.on('connection', (socket) => {
    connectionCount++;
    logInfo('Connection count', { total: connectionCount });
    
    socket.on('disconnect', () => {
      connectionCount--;
    });
  });
  
  // Periodic cleanup
  setInterval(() => {
    const sockets = io.sockets.sockets;
    let cleaned = 0;
    
    for (const [id, socket] of sockets) {
      // Clean up disconnected sockets
      if (socket.disconnected) {
        socket.disconnect(true);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logInfo('Cleaned up disconnected sockets', { count: cleaned });
    }
  }, 60000); // Every minute
  
  return io;
}

/**
 * Room optimization utilities
 */
export const roomOptimization = {
  // Batch room updates
  batchRoomUpdates: (io, roomCode, updates, delay = 50) => {
    setTimeout(() => {
      io.to(roomCode).emit('roomBatchUpdate', updates);
    }, delay);
  },
  
  // Compress room state before sending
  compressRoomState: (roomState) => {
    // Remove unnecessary data
    const compressed = {
      ...roomState,
      players: roomState.players?.map(p => ({
        id: p.id,
        nickname: p.nickname,
        hasConfession: p.hasConfession
      }))
    };
    return compressed;
  },
  
  // Efficient room broadcasting
  broadcastToRoom: async (io, roomCode, event, data, excludeSocketId = null) => {
    const sockets = await io.in(roomCode).fetchSockets();
    
    for (const socket of sockets) {
      if (socket.id !== excludeSocketId) {
        socket.emit(event, data);
      }
    }
  }
};

export default {
  socketConfig,
  createRedisAdapter,
  performanceMiddleware,
  rateLimits,
  connectionLimits,
  batchingConfig,
  compressionSettings,
  namespaces,
  optimizeSocketIO,
  roomOptimization
};