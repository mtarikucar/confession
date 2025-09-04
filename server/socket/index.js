import { handleRoomEvents } from './roomHandlers.js';
import { handleGameEvents } from './gameHandlers.js';
import { handleChatEvents } from './chatHandlers.js';
import { handleConfessionEvents } from './confessionHandlers.js';
import { authenticateSocket } from '../middleware/socketAuth.js';
import sessionService from '../services/sessionService.js';
import roomService from '../services/roomService.js';
import gameService from '../services/gameService.js';
import gameStateService from '../services/gameStateService.js';
import { logInfo, logError } from '../config/logger.js';
import { performanceMiddleware } from '../config/socketConfig.js';
import prisma from '../config/database.js';

export function setupSocketHandlers(io) {
  // Apply authentication middleware
  io.use(authenticateSocket);
  
  // Apply performance monitoring middleware
  io.use(performanceMiddleware);

  io.on('connection', async (socket) => {
    logInfo('New connection', { 
      socketId: socket.id,
      userId: socket.userId,
      nickname: socket.user?.nickname,
      tabId: socket.tabId
    });

    // Send authentication info back to client immediately
    // Use process.nextTick to ensure it's sent after connection is established
    process.nextTick(async () => {
      socket.emit('authenticated', {
        success: true,
        user: {
          id: socket.userId,
          nickname: socket.user.nickname,
          avatar: socket.user.avatar
        },
        token: socket.sessionToken,
        isNew: socket.isNewUser
      });
      
      logInfo('Authentication sent to client', {
        socketId: socket.id,
        userId: socket.userId
      });
      
      // If we have a lastRoomCode from reconnection, set it
      if (socket.lastRoomCode) {
        socket.roomCode = socket.lastRoomCode;
        socket.join(socket.lastRoomCode);
        logInfo('Restored room context after reconnection', {
          socketId: socket.id,
          roomCode: socket.lastRoomCode
        });
      }
    });

    // Set up event handlers
    handleRoomEvents(io, socket);
    handleGameEvents(io, socket);
    handleChatEvents(io, socket);
    handleConfessionEvents(io, socket);

    // Handle nickname update
    socket.on('updateNickname', async (nickname, callback) => {
      try {
        const updated = await prisma.user.update({
          where: { id: socket.userId },
          data: { nickname }
        });

        socket.user.nickname = nickname;

        callback({ 
          success: true, 
          user: {
            id: updated.id,
            nickname: updated.nickname,
            avatar: updated.avatar
          }
        });

        // Notify rooms about nickname change
        const rooms = await roomService.getUserRooms(socket.userId);
        for (const room of rooms) {
          io.to(room.code).emit('playerUpdated', {
            playerId: socket.userId,
            nickname: updated.nickname
          });
        }

        logInfo('Nickname updated', { userId: socket.userId, nickname });
      } catch (error) {
        logError(error, { userId: socket.userId, nickname });
        callback({ success: false, error: 'Failed to update nickname' });
      }
    });

    // Handle reconnection
    socket.on('reconnect', async (data, callback) => {
      try {
        const { token, roomCode } = data;
        
        if (token) {
          const session = await sessionService.getSessionByToken(token);
          if (session) {
            // Update socket ID
            await sessionService.updateSocketId(session.id, socket.id);
            
            // Rejoin room if provided
            if (roomCode) {
              socket.join(roomCode);
              const room = await roomService.getRoomByCode(roomCode);
              
              if (room) {
                callback({ 
                  success: true, 
                  room,
                  user: session.user 
                });

                // Notify others about reconnection
                socket.to(roomCode).emit('playerReconnected', {
                  playerId: session.userId,
                  nickname: session.user.nickname
                });
              }
            } else {
              callback({ success: true, user: session.user });
            }
            
            logInfo('User reconnected', { 
              userId: session.userId, 
              socketId: socket.id,
              roomCode 
            });
          } else {
            callback({ success: false, error: 'Invalid session' });
          }
        } else {
          callback({ success: false, error: 'No token provided' });
        }
      } catch (error) {
        logError(error, { socketId: socket.id });
        callback({ success: false, error: 'Reconnection failed' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        // Handle session disconnect
        await sessionService.handleDisconnect(socket.id);

        // Get user's active rooms
        const rooms = await roomService.getUserRooms(socket.userId);
        
        for (const room of rooms) {
          // Check if user is in an active game
          const currentGame = await gameService.getCurrentGameByRoomId(room.id);
          if (currentGame) {
            // Mark player as disconnected in game state
            await gameStateService.handlePlayerDisconnect(socket.userId, currentGame.id);
          }
          
          // Don't immediately remove from room - allow reconnection
          io.to(room.code).emit('playerDisconnected', {
            playerId: socket.userId,
            nickname: socket.user?.nickname,
            temporary: true // Indicate it might be temporary
          });
        }

        logInfo('Socket disconnected', { 
          socketId: socket.id,
          userId: socket.userId 
        });
      } catch (error) {
        logError(error, { socketId: socket.id });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logError(error, { 
        socketId: socket.id,
        userId: socket.userId 
      });
    });
  });

  // Periodic cleanup of expired sessions
  setInterval(async () => {
    try {
      const cleaned = await sessionService.cleanupExpiredSessions();
      if (cleaned > 0) {
        logInfo('Cleaned up expired sessions', { count: cleaned });
      }
    } catch (error) {
      logError(error, { context: 'session_cleanup' });
    }
  }, 60 * 60 * 1000); // Every hour
}