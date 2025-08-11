import { Server, Socket } from 'socket.io';
import { ConfessionService } from '../domain/services/confessionService';
import { SocketManager } from './socketManager';
import { SOCKET_EVENTS, ERROR_CODES } from '@confess-and-play/shared';

const confessionService = new ConfessionService();
const socketManager = SocketManager.getInstance();

export function setupConfessionHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.SEND_CONFESSION, async (data: { userId: string; content: string }) => {
    try {
      const { userId, content } = data;
      
      // Create confession
      const confession = await confessionService.createConfession(userId, content);
      
      // Get user's current room
      const socketUser = socketManager.getUserByUserId(userId);
      
      // Notify the user
      socket.emit(SOCKET_EVENTS.CONFESSION_SUBMITTED, {
        userId,
        status: 'ok',
        confessionId: confession.id,
      });
      
      // If user is in a room, notify room members
      if (socketUser?.roomId) {
        io.to(socketUser.roomId).emit('user_confession_ready', {
          userId,
          nickname: socketUser.nickname,
        });
      }
      
      console.log(`Confession submitted by user ${userId}`);
    } catch (error: any) {
      console.error('Error submitting confession:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to submit confession',
      });
    }
  });
  
  socket.on('update_confession', async (data: { userId: string; content: string }) => {
    try {
      const { userId, content } = data;
      
      // Delete old confession
      await confessionService.deleteConfession(userId);
      
      // Create new confession
      const confession = await confessionService.createConfession(userId, content);
      
      socket.emit('confession_updated', {
        userId,
        status: 'ok',
        confessionId: confession.id,
      });
      
      console.log(`Confession updated by user ${userId}`);
    } catch (error: any) {
      console.error('Error updating confession:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to update confession',
      });
    }
  });
}