import { verifyToken } from '../utils/auth.js';
import prisma from '../config/database.js';
import { sessionStore } from '../config/redis.js';
import { logError, logDebug } from '../config/logger.js';

// JWT Authentication Middleware
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token, false);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    req.token = token;
    
    logDebug('User authenticated', { userId: user.id, path: req.path });
    next();
  } catch (error) {
    logError(error, { path: req.path });
    
    if (error.message === 'Token expired') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Session Authentication Middleware
export const authenticateSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: 'Session required' });
    }

    // Get session from Redis
    const session = await sessionStore.get(sessionId);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      await sessionStore.delete(sessionId);
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Extend session TTL
    await sessionStore.touch(sessionId);

    req.user = user;
    req.sessionId = sessionId;
    req.session = session;
    
    next();
  } catch (error) {
    logError(error, { path: req.path });
    return res.status(500).json({ error: 'Session validation failed' });
  }
};

// Optional Authentication (doesn't fail if no auth)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token, false);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          nickname: true
        }
      });

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silent fail - user just won't be authenticated
    logDebug('Optional auth failed', { error: error.message });
  }
  
  next();
};

// Socket Authentication Middleware
export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const sessionId = socket.handshake.auth?.sessionId;

    if (token) {
      // JWT authentication
      const decoded = verifyToken(token, false);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          nickname: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.nickname = user.nickname;
      socket.authenticated = true;
      
    } else if (sessionId) {
      // Session authentication
      const session = await sessionStore.get(sessionId);
      
      if (!session) {
        return next(new Error('Invalid session'));
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          nickname: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.nickname = user.nickname;
      socket.sessionId = sessionId;
      socket.authenticated = true;
      
      // Update session with socket ID
      session.socketId = socket.id;
      await sessionStore.set(sessionId, session);
      
    } else {
      // Anonymous user - create temporary session
      socket.userId = socket.id;
      socket.nickname = `Guest${Math.floor(Math.random() * 9999)}`;
      socket.authenticated = false;
    }

    logDebug('Socket authenticated', { 
      socketId: socket.id, 
      userId: socket.userId,
      authenticated: socket.authenticated 
    });
    
    next();
  } catch (error) {
    logError(error, { socketId: socket.id });
    next(new Error('Authentication failed'));
  }
};

// Rate Limiting Middleware (uses Redis)
import { rateLimiter } from '../config/redis.js';

export const rateLimit = (limit = 10, window = 60) => {
  return async (req, res, next) => {
    try {
      const key = req.user?.id || req.ip;
      const allowed = await rateLimiter.checkLimit(key, limit, window);

      if (!allowed) {
        const remaining = await rateLimiter.getRemainingLimit(key, limit);
        
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + window * 1000).toISOString());
        
        return res.status(429).json({ 
          error: 'Too many requests', 
          retryAfter: window 
        });
      }

      next();
    } catch (error) {
      logError(error, { path: req.path });
      // Allow request on error
      next();
    }
  };
};

// WebSocket Rate Limiting
export const socketRateLimit = (limit = 30, window = 60) => {
  return async (socket, next) => {
    try {
      const key = `socket:${socket.userId || socket.id}`;
      const allowed = await rateLimiter.checkLimit(key, limit, window);

      if (!allowed) {
        socket.emit('error', { 
          message: 'Too many requests', 
          code: 'RATE_LIMIT_EXCEEDED' 
        });
        return;
      }

      next();
    } catch (error) {
      logError(error, { socketId: socket.id });
      next();
    }
  };
};