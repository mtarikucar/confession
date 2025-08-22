import prisma from '../config/database.js';
import roomService from '../services/roomService.js';
import { logInfo, logError } from '../config/logger.js';

export function handleConfessionEvents(io, socket) {
  socket.on('submitConfession', async (data, callback) => {
    try {
      const { text, roomCode } = data;
      
      // Validate confession
      if (!text || text.trim().length < 10) {
        return callback({ 
          success: false, 
          error: 'Confession must be at least 10 characters' 
        });
      }

      if (text.length > 500) {
        return callback({ 
          success: false, 
          error: 'Confession must be less than 500 characters' 
        });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      // Check if player is in room
      const isInRoom = room.players.some(p => p.id === socket.userId);
      if (!isInRoom) {
        return callback({ 
          success: false, 
          error: 'You are not in this room' 
        });
      }

      // Check if already has an unrevealed confession
      const existingConfession = await prisma.confession.findFirst({
        where: {
          roomId: room.id,
          userId: socket.userId,
          isRevealed: false
        }
      });

      if (existingConfession) {
        return callback({ 
          
          success: false, 
          error: 'You already have an active confession' 
        });
      }

      // Submit confession
      const confession = await roomService.addConfession(
        room.id,
        socket.userId,
        text.trim()
      );

      // Update player waiting status
      await prisma.roomPlayer.updateMany({
        where: {
          roomId: room.id,
          userId: socket.userId
        },
        data: {
          isWaiting: true
        }
      });

      logInfo('Confession submitted', {
        userId: socket.userId,
        roomCode,
        confessionId: confession.id
      });

      // Get updated room data
      const updatedRoom = await roomService.getRoomById(room.id);

      // Notify all players in room
      io.to(roomCode).emit('confessionSubmitted', {
        playerId: socket.userId,
        nickname: socket.user?.nickname,
        room: updatedRoom
      });

      callback({ 
        success: true, 
        confession: {
          id: confession.id,
          submitted: true
        }
      });

      // Check if enough players for matchmaking
      const waitingPlayers = await roomService.getWaitingPlayers(room.id);
      if (waitingPlayers.length >= 2) {
        io.to(roomCode).emit('matchmakingAvailable', {
          playerCount: waitingPlayers.length
        });
      }
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to submit confession' 
      });
    }
  });

  socket.on('getConfessions', async (data, callback) => {
    try {
      const { roomCode } = data;
      
      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      // Check if player is in room
      const isInRoom = room.players.some(p => p.id === socket.userId);
      if (!isInRoom) {
        return callback({ 
          success: false, 
          error: 'You are not in this room' 
        });
      }

      // Get revealed confessions
      const revealedConfessions = await prisma.confession.findMany({
        where: {
          roomId: room.id,
          isRevealed: true
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true
            }
          }
        },
        orderBy: {
          revealedAt: 'desc'
        }
      });

      // Check if user has submitted confession
      const hasSubmitted = await roomService.hasSubmittedConfession(
        room.id,
        socket.userId
      );
      
      callback({ 
        success: true, 
        confessions: revealedConfessions.map(c => ({
          id: c.id,
          text: c.text,
          userId: c.userId,
          nickname: c.user.nickname,
          revealedAt: c.revealedAt
        })),
        hasSubmitted
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to get confessions' 
      });
    }
  });

  socket.on('getMyConfession', async (data, callback) => {
    try {
      const { roomCode } = data;
      
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      const confession = await prisma.confession.findFirst({
        where: {
          roomId: room.id,
          userId: socket.userId,
          isRevealed: false
        },
        select: {
          id: true,
          text: true,
          createdAt: true
        }
      });

      callback({ 
        success: true,
        confession: confession || null
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to get confession' 
      });
    }
  });

  socket.on('updateConfession', async (data, callback) => {
    try {
      const { confessionId, text } = data;
      
      // Validate new text
      if (!text || text.trim().length < 10) {
        return callback({ 
          success: false, 
          error: 'Confession must be at least 10 characters' 
        });
      }

      if (text.length > 500) {
        return callback({ 
          success: false, 
          error: 'Confession must be less than 500 characters' 
        });
      }

      // Get confession
      const confession = await prisma.confession.findUnique({
        where: { id: confessionId }
      });

      if (!confession) {
        return callback({ 
          success: false, 
          error: 'Confession not found' 
        });
      }

      // Check ownership
      if (confession.userId !== socket.userId) {
        return callback({ 
          success: false, 
          error: 'Not your confession' 
        });
      }

      // Check if already revealed
      if (confession.isRevealed) {
        return callback({ 
          success: false, 
          error: 'Cannot update revealed confession' 
        });
      }

      // Update confession
      const updated = await prisma.confession.update({
        where: { id: confessionId },
        data: { text: text.trim() }
      });

      callback({ 
        success: true,
        confession: {
          id: updated.id,
          text: updated.text
        }
      });

      logInfo('Confession updated', { 
        userId: socket.userId, 
        confessionId 
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to update confession' 
      });
    }
  });
}