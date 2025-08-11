import { Server, Socket } from 'socket.io';
import { SocketManager } from './socketManager';
import { UserService } from '../domain/services/userService';
import { RoomService } from '../domain/services/roomService';
import { SOCKET_EVENTS, ERROR_CODES } from '@confess-and-play/shared';

const socketManager = SocketManager.getInstance();
const userService = new UserService();
const roomService = new RoomService();

export function setupRoomHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async (data: { userId: string; roomId: string }) => {
    try {
      const { userId, roomId } = data;
      
      // Validate user and room exist
      const [user, room] = await Promise.all([
        userService.getUser(userId),
        roomService.getRoom(roomId),
      ]);
      
      // Update user's room in database
      await userService.joinRoom(userId, roomId);
      
      // Update socket manager
      socketManager.addUser(socket.id, user);
      socketManager.updateUserRoom(socket.id, roomId);
      
      // Join the socket room
      await socket.join(roomId);
      
      // Get room users count
      const usersInRoom = await userService.getUsersInRoom(roomId);
      
      // Notify others in the room
      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
        roomId,
        user: { 
          id: user.id, 
          nickname: user.nickname 
        },
        roomUserCount: usersInRoom.length,
      });
      
      // Send current room state to the joining user
      socket.emit('room_state', {
        roomId,
        roomName: room.name,
        users: usersInRoom.map(u => ({
          id: u.id,
          nickname: u.nickname,
          hasConfession: !!u.confession,
        })),
      });
      
      console.log(`User ${user.nickname} joined room ${room.name}`);
    } catch (error: any) {
      console.error('Error joining room:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to join room',
      });
    }
  });
  
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, async (data: { userId: string; roomId: string }) => {
    try {
      const { userId, roomId } = data;
      
      // Update user's room in database
      await userService.leaveRoom(userId);
      
      // Update socket manager
      socketManager.updateUserRoom(socket.id, undefined);
      
      // Leave the socket room
      await socket.leave(roomId);
      
      // Get remaining users
      const usersInRoom = await userService.getUsersInRoom(roomId);
      
      // Notify others in the room
      socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, {
        roomId,
        userId,
        roomUserCount: usersInRoom.length,
      });
      
      console.log(`User ${userId} left room ${roomId}`);
    } catch (error: any) {
      console.error('Error leaving room:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to leave room',
      });
    }
  });
}