import { Server, Socket } from 'socket.io';
import { setupRoomHandlers } from './roomHandler';
import { setupGameHandlers } from './gameHandler';
import { setupChatHandlers } from './chatHandler';
import { setupConfessionHandlers } from './confessionHandler';
import { SocketManager } from './socketManager';
import { UserService } from '../domain/services/userService';
import { SOCKET_EVENTS } from '@confess-and-play/shared';

const socketManager = SocketManager.getInstance();
const userService = new UserService();

export function setupSocketHandlers(io: Server) {
  // Middleware for authentication
  io.use(async (socket, next) => {
    const userId = socket.handshake.auth.userId;
    
    if (!userId) {
      return next(new Error('Authentication error: userId required'));
    }
    
    try {
      const user = await userService.getUser(userId);
      socket.data.user = user;
      next();
    } catch (error) {
      return next(new Error('Authentication error: User not found'));
    }
  });
  
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`New connection: ${user.nickname} (${socket.id})`);
    
    // Add user to socket manager
    socketManager.addUser(socket.id, user);
    
    // Setup handlers
    setupRoomHandlers(io, socket);
    setupGameHandlers(io, socket);
    setupChatHandlers(io, socket);
    setupConfessionHandlers(io, socket);
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Disconnected: ${user.nickname} (${socket.id})`);
      
      const socketUser = socketManager.removeUser(socket.id);
      
      // If user was in a room, notify others
      if (socketUser?.roomId) {
        // Update user's room in database
        try {
          await userService.leaveRoom(user.id);
          
          // Notify room members
          socket.to(socketUser.roomId).emit(SOCKET_EVENTS.USER_LEFT, {
            roomId: socketUser.roomId,
            userId: user.id,
            nickname: user.nickname,
          });
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${user.nickname}:`, error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: 'SOCKET_ERROR',
        message: 'An error occurred',
      });
    });
    
    // Send initial connection success
    socket.emit('connected', {
      userId: user.id,
      nickname: user.nickname,
      socketId: socket.id,
    });
  });
}