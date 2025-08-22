import { handleRoomEvents } from './roomHandlers.js';
import { handleGameEvents } from './gameHandlers.js';
import { handleChatEvents } from './chatHandlers.js';
import { handleConfessionEvents } from './confessionHandlers.js';
import { authenticateSocket } from '../middleware/socketAuth.js';
import sessionService from '../services/sessionService.js';
import roomService from '../services/roomService.js';
import { logInfo, logError } from '../config/logger.js';
import prisma from '../config/database.js';

export function setupSocketHandlers(io) {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    logInfo('New connection', { 
      socketId: socket.id,
      userId: socket.userId,
      nickname: socket.user?.nickname 
    });

    // Send authentication info back to client
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