import roomService from '../services/roomService.js';
import cacheService from '../services/cacheService.js';
import { logInfo, logError } from '../config/logger.js';
import prisma from '../config/database.js';

export function handleRoomEvents(io, socket) {
  // Create room
  socket.on('createRoom', async (data, callback) => {
    try {
      const { name, description, password, maxPlayers, isPublic } = data;

      // Validate input
      if (!name || name.trim().length < 3) {
        return callback({ 
          success: false, 
          error: 'Room name must be at least 3 characters' 
        });
      }

      // Create room with the authenticated user as creator
      const room = await roomService.createRoom(socket.userId, {
        name: name.trim(),
        description: description?.trim(),
        password,
        maxPlayers: maxPlayers || 20,
        isPublic: isPublic !== false
      });

      // Join socket room
      socket.join(room.code);
      socket.roomCode = room.code;

      logInfo('Room created', {
        roomId: room.id,
        roomCode: room.code,
        creatorId: socket.userId
      });

      callback({
        success: true,
        room: await roomService.getRoomById(room.id)
      });

      // Notify others about new public room
      if (room.isPublic) {
        socket.broadcast.emit('roomCreated', {
          code: room.code,
          name: room.name,
          playerCount: 1,
          maxPlayers: room.maxPlayers
        });
      }
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to create room' 
      });
    }
  });

  // Join room
  socket.on('joinRoom', async (data, callback) => {
    try {
      const { roomCode, password } = data;

      if (!roomCode) {
        return callback({ 
          success: false, 
          error: 'Room code required' 
        });
      }

      // Leave current room if in one
      if (socket.roomCode) {
        await roomService.leaveRoom(socket.userId, socket.roomCode);
        socket.leave(socket.roomCode);
      }

      // Join new room
      const room = await roomService.joinRoom(
        socket.userId,
        roomCode.toUpperCase(),
        password
      );

      // Join socket room
      socket.join(room.code);
      socket.roomCode = room.code;

      // Get updated room data
      const roomData = await roomService.getRoomById(room.id);

      // Notify others
      socket.to(room.code).emit('playerJoined', {
        playerId: socket.userId,
        nickname: socket.user?.nickname,
        room: roomData
      });

      logInfo('Player joined room', {
        userId: socket.userId,
        roomCode: room.code
      });

      callback({
        success: true,
        room: roomData
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: error.message || 'Failed to join room' 
      });
    }
  });

  // Leave room
  socket.on('leaveRoom', async (callback) => {
    try {
      if (!socket.roomCode) {
        return callback && callback({ 
          success: false, 
          error: 'Not in a room' 
        });
      }

      const roomCode = socket.roomCode;
      
      // Leave room
      const left = await roomService.leaveRoom(socket.userId, roomCode);
      
      if (left) {
        socket.leave(roomCode);
        
        // Get updated room
        const room = await roomService.getRoomByCode(roomCode);
        
        // Notify others
        if (room) {
          socket.to(roomCode).emit('playerLeft', {
            playerId: socket.userId,
            nickname: socket.user?.nickname,
            room
          });
        }

        delete socket.roomCode;

        logInfo('Player left room', {
          userId: socket.userId,
          roomCode
        });
      }

      callback && callback({ success: true });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback && callback({ 
        success: false, 
        error: 'Failed to leave room' 
      });
    }
  });

  // Get public rooms
  socket.on('getRooms', async (callback) => {
    try {
      // Check cache first
      let rooms = await cacheService.getCachedPublicRooms();
      
      if (!rooms) {
        // Get from database
        rooms = await roomService.getPublicRooms(50);
        
        // Cache for next time
        await cacheService.cachePublicRooms(rooms);
      }

      callback({
        success: true,
        rooms
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to get rooms' 
      });
    }
  });

  // Get room info
  socket.on('getRoomInfo', async (data, callback) => {
    try {
      const { roomCode } = data;

      if (!roomCode) {
        return callback({ 
          success: false, 
          error: 'Room code required' 
        });
      }

      const room = await roomService.getRoomByCode(roomCode);

      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      callback({
        success: true,
        room
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to get room info' 
      });
    }
  });

  // Update room settings (for room creator only)
  socket.on('updateRoomSettings', async (data, callback) => {
    try {
      if (!socket.roomCode) {
        return callback({ 
          success: false, 
          error: 'Not in a room' 
        });
      }

      const room = await roomService.getRoomByCode(socket.roomCode);
      
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      if (room.creator.id !== socket.userId) {
        return callback({ 
          success: false, 
          error: 'Only room creator can update settings' 
        });
      }

      const { name, description, maxPlayers, isPublic, password } = data;

      // Update room settings in database
      const updated = await prisma.room.update({
        where: { id: room.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() }),
          ...(maxPlayers && { maxPlayers }),
          ...(isPublic !== undefined && { isPublic }),
          ...(password !== undefined && { password })
        }
      });

      const updatedRoom = await roomService.getRoomById(room.id);

      // Notify all players in room
      io.to(socket.roomCode).emit('roomSettingsUpdated', {
        room: updatedRoom
      });

      logInfo('Room settings updated', {
        roomId: room.id,
        updatedBy: socket.userId
      });
      
      callback({ 
        success: true,
        room: updatedRoom
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to update room settings' 
      });
    }
  });

  // Kick player (for room creator only)
  socket.on('kickPlayer', async (data, callback) => {
    try {
      const { targetUserId } = data;

      if (!socket.roomCode) {
        return callback({ 
          success: false, 
          error: 'Not in a room' 
        });
      }

      const room = await roomService.getRoomByCode(socket.roomCode);
      
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      if (room.creator.id !== socket.userId) {
        return callback({ 
          success: false, 
          error: 'Only room creator can kick players' 
        });
      }

      if (targetUserId === socket.userId) {
        return callback({ 
          success: false, 
          error: 'Cannot kick yourself' 
        });
      }

      // Remove player from room
      await roomService.leaveRoom(targetUserId, socket.roomCode);

      // Find target socket and make them leave
      const targetSockets = await io.in(socket.roomCode).fetchSockets();
      for (const targetSocket of targetSockets) {
        if (targetSocket.userId === targetUserId) {
          targetSocket.leave(socket.roomCode);
          delete targetSocket.roomCode;
          targetSocket.emit('kicked', {
            roomCode: socket.roomCode,
            roomName: room.name
          });
          break;
        }
      }

      const updatedRoom = await roomService.getRoomById(room.id);

      // Notify others
      io.to(socket.roomCode).emit('playerKicked', {
        playerId: targetUserId,
        room: updatedRoom
      });

      logInfo('Player kicked from room', {
        roomId: room.id,
        kickedUserId: targetUserId,
        kickedBy: socket.userId
      });

      callback({ 
        success: true,
        room: updatedRoom
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to kick player' 
      });
    }
  });
}