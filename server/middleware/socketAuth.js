import sessionService from '../services/sessionService.js';
import { logInfo, logError } from '../config/logger.js';
import jwt from 'jsonwebtoken';

/**
 * Socket authentication middleware
 */
export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const nickname = socket.handshake.auth.nickname;
    const reconnection = socket.handshake.auth.reconnection || false;

    // If reconnecting with token
    if (reconnection && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const session = await sessionService.getSessionByToken(token);
        
        if (session) {
          // Update socket ID for reconnection
          await sessionService.updateSocketId(session.id, socket.id);
          
          socket.userId = session.userId;
          socket.sessionId = session.id;
          socket.user = session.user;
          
          logInfo('Socket reconnected', { 
            userId: session.userId, 
            socketId: socket.id,
            sessionId: session.id 
          });
          
          return next();
        }
      } catch (err) {
        logError(err, { token, socketId: socket.id });
      }
    }

    // Create new session (guest user)
    const { user, session, isNew } = await sessionService.getOrCreateUserForSocket(
      socket.id,
      nickname
    );

    socket.userId = user.id;
    socket.sessionId = session.id;
    socket.user = user;
    socket.sessionToken = session.token;
    socket.isNewUser = isNew;

    logInfo('Socket authenticated', { 
      userId: user.id, 
      socketId: socket.id,
      isNew 
    });

    next();
  } catch (error) {
    logError(error, { socketId: socket.id });
    next(new Error('Authentication failed'));
  }
};

/**
 * Require authenticated user
 */
export const requireAuth = (socket, next) => {
  if (!socket.userId) {
    return next(new Error('Not authenticated'));
  }
  next();
};

/**
 * Rate limiting middleware
 */
export const rateLimitSocket = (eventName, limit = 10, window = 60) => {
  const attempts = new Map();
  
  return async (socket, next) => {
    const key = `${socket.userId}:${eventName}`;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(
      timestamp => now - timestamp < window * 1000
    );
    
    if (validAttempts.length >= limit) {
      return next(new Error(`Rate limit exceeded for ${eventName}`));
    }
    
    validAttempts.push(now);
    attempts.set(key, validAttempts);
    
    next();
  };
};