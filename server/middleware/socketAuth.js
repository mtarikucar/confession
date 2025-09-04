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
    const roomCode = socket.handshake.auth.roomCode;
    const reconnection = socket.handshake.auth.reconnection || false;
    const newSession = socket.handshake.auth.newSession || false;
    const tabId = socket.handshake.auth.tabId;

    // If reconnecting with token (and not forcing new session)
    if (reconnection && token && !newSession) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const session = await sessionService.getSessionByToken(token);
        
        if (session) {
          // Update socket ID for reconnection with room info
          await sessionService.updateSocketId(session.id, socket.id, roomCode);
          
          socket.userId = session.userId;
          socket.sessionId = session.id;
          socket.user = session.user;
          socket.lastRoomCode = roomCode; // Store for potential room rejoin
          socket.tabId = tabId;
          
          logInfo('Socket reconnected', { 
            userId: session.userId, 
            socketId: socket.id,
            sessionId: session.id,
            roomCode: roomCode,
            tabId: tabId
          });
          
          return next();
        }
      } catch (err) {
        logInfo('Token validation failed, creating new session', { socketId: socket.id });
        // Fall through to create new session
      }
    }

    // Create new session - allow multiple sessions per user
    const { user, session, isNew } = await sessionService.createNewSessionForSocket(
      socket.id,
      nickname,
      tabId
    );

    socket.userId = user.id;
    socket.sessionId = session.id;
    socket.user = user;
    socket.sessionToken = session.token;
    socket.isNewUser = isNew;
    socket.tabId = tabId;

    logInfo('Socket authenticated', { 
      userId: user.id, 
      socketId: socket.id,
      sessionId: session.id,
      isNew,
      tabId: tabId
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