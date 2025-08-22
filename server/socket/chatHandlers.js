import roomService from '../services/roomService.js';
import prisma from '../config/database.js';
import { logInfo, logError } from '../config/logger.js';

export function handleChatEvents(io, socket) {
  socket.on('sendMessage', async (data, callback) => {
    try {
      const { text, roomCode } = data;

      if (!text || !roomCode) {
        return callback({ 
          success: false, 
          error: 'Message and room code required' 
        });
      }

      // Verify user is in the room
      const roomPlayer = await prisma.roomPlayer.findFirst({
        where: {
          userId: socket.userId,
          room: { code: roomCode },
          leftAt: null
        }
      });

      if (!roomPlayer) {
        return callback({ 
          success: false, 
          error: 'Not in this room' 
        });
      }

      // Save message to database
      const chatMessage = await prisma.chatMessage.create({
        data: {
          roomId: roomPlayer.roomId,
          userId: socket.userId,
          nickname: socket.user?.nickname || 'Unknown',
          text: text.trim(),
          type: 'CHAT',
          isSystem: false
        }
      });

      // Format message for emission
      const messageData = {
        id: chatMessage.id,
        userId: chatMessage.userId,
        nickname: chatMessage.nickname,
        text: chatMessage.text,
        type: chatMessage.type,
        isSystem: chatMessage.isSystem,
        createdAt: chatMessage.createdAt
      };

      // Emit to all users in room
      io.to(roomCode).emit('newMessage', messageData);
      
      logInfo('Chat message sent', {
        userId: socket.userId,
        roomCode,
        messageId: chatMessage.id
      });

      callback({ success: true });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to send message' 
      });
    }
  });

  socket.on('getChatHistory', async (data, callback) => {
    try {
      const { roomCode } = data;

      if (!roomCode) {
        return callback({ 
          success: false, 
          error: 'Room code required' 
        });
      }

      // Get room
      const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              userId: true,
              nickname: true,
              text: true,
              type: true,
              isSystem: true,
              createdAt: true
            }
          }
        }
      });

      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      // Verify user is in the room
      const roomPlayer = await prisma.roomPlayer.findFirst({
        where: {
          userId: socket.userId,
          roomId: room.id,
          leftAt: null
        }
      });

      if (!roomPlayer) {
        return callback({ 
          success: false, 
          error: 'Not in this room' 
        });
      }

      callback({ 
        success: true, 
        messages: room.chatMessages.reverse() 
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to get chat history' 
      });
    }
  });
}