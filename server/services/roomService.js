import prisma from '../config/database.js';
import { roomCache } from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';
import { generateRoomCode } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

class RoomService {
  /**
   * Create a new room
   */
  async createRoom(creatorId, { name, description, password, maxPlayers = 20, isPublic = true }) {
    try {
      // Generate unique room code
      let roomCode;
      let attempts = 0;
      
      do {
        roomCode = generateRoomCode();
        const existing = await prisma.room.findUnique({ where: { code: roomCode } });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error('Failed to generate unique room code');
      }

      // Create room in database
      const room = await prisma.room.create({
        data: {
          id: uuidv4(),
          code: roomCode,
          name,
          description,
          password,
          maxPlayers,
          isPublic,
          creatorId,
          players: {
            create: {
              userId: creatorId,
              isWaiting: true
            }
          }
        },
        include: {
          creator: {
            select: {
              id: true,
              nickname: true
            }
          },
          players: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true
                }
              }
            }
          }
        }
      });

      // Cache room data
      await roomCache.set(roomCode, {
        id: room.id,
        code: roomCode,
        name: room.name,
        playerCount: 1,
        maxPlayers: room.maxPlayers,
        isPublic: room.isPublic,
        hasPassword: !!password
      });

      logInfo('Room created', { roomId: room.id, roomCode, creatorId });

      return room;
    } catch (error) {
      logError(error, { creatorId, name });
      throw error;
    }
  }

  /**
   * Join a room
   */
  async joinRoom(userId, roomCode, password = null) {
    try {
      // Get room from database
      const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: {
          players: {
            where: { leftAt: null }
          }
        }
      });

      if (!room) {
        throw new Error('Room not found');
      }

      if (!room.isActive) {
        throw new Error('Room is not active');
      }

      if (room.password && room.password !== password) {
        throw new Error('Invalid password');
      }

      if (room.players.length >= room.maxPlayers) {
        throw new Error('Room is full');
      }

      // Check if player is already in room
      const existingPlayer = room.players.find(p => p.userId === userId);
      if (existingPlayer) {
        return this.getRoomById(room.id);
      }

      // Add player to room
      await prisma.roomPlayer.create({
        data: {
          roomId: room.id,
          userId,
          isWaiting: true
        }
      });

      // Update cache
      await roomCache.addPlayer(roomCode, userId);

      logInfo('Player joined room', { userId, roomId: room.id, roomCode });

      return this.getRoomById(room.id);
    } catch (error) {
      logError(error, { userId, roomCode });
      throw error;
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(userId, roomCode) {
    try {
      const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: {
          players: {
            where: { 
              userId,
              leftAt: null 
            }
          }
        }
      });

      if (!room || room.players.length === 0) {
        return false;
      }

      // Mark player as left
      await prisma.roomPlayer.updateMany({
        where: {
          roomId: room.id,
          userId,
          leftAt: null
        },
        data: {
          leftAt: new Date()
        }
      });

      // Update cache
      await roomCache.removePlayer(roomCode, userId);

      // Check if room should be deactivated
      const remainingPlayers = await prisma.roomPlayer.count({
        where: {
          roomId: room.id,
          leftAt: null
        }
      });

      if (remainingPlayers === 0) {
        await this.deactivateRoom(room.id);
      }

      logInfo('Player left room', { userId, roomId: room.id, roomCode });

      return true;
    } catch (error) {
      logError(error, { userId, roomCode });
      return false;
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId) {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          creator: {
            select: {
              id: true,
              nickname: true
            }
          },
          players: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatar: true
                }
              }
            }
          },
          games: {
            where: { endedAt: null },
            take: 1,
            orderBy: { startedAt: 'desc' }
          },
          confessions: {
            select: {
              id: true,
              userId: true,
              isRevealed: true,
              text: true,
              user: {
                select: {
                  nickname: true
                }
              }
            }
          },
          chatMessages: {
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              nickname: true,
              text: true,
              type: true,
              isSystem: true,
              createdAt: true
            }
          }
        }
      });

      if (!room) return null;

      // Parse game JSON fields if exists
      const currentGame = room.games[0];
      if (currentGame) {
        // Convert game type from ENUM to kebab-case
        currentGame.type = currentGame.type.toLowerCase().replace(/_/g, '-');
        
        // Parse players
        if (typeof currentGame.players === 'string') {
          try {
            currentGame.players = JSON.parse(currentGame.players);
          } catch (e) {
            currentGame.players = [];
          }
        }
        // Parse state
        if (typeof currentGame.state === 'string') {
          try {
            currentGame.state = JSON.parse(currentGame.state);
          } catch (e) {
            currentGame.state = {};
          }
        }
        // Parse rankings
        if (typeof currentGame.rankings === 'string') {
          try {
            currentGame.rankings = JSON.parse(currentGame.rankings);
          } catch (e) {
            currentGame.rankings = null;
          }
        }
      }

      // Format room data
      return {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        maxPlayers: room.maxPlayers,
        isPublic: room.isPublic,
        isActive: room.isActive,
        creator: room.creator,
        players: room.players.map(p => ({
          id: p.user.id,
          nickname: p.user.nickname,
          avatar: p.user.avatar,
          isWaiting: p.isWaiting,
          isSpectator: p.isSpectator,
          hasConfession: room.confessions.some(c => c.userId === p.user.id && !c.isRevealed),
          isPlaying: currentGame?.players?.includes(p.user.id) || false
        })),
        currentGame: currentGame || null,
        confessions: room.confessions,
        chatHistory: room.chatMessages.reverse()
      };
    } catch (error) {
      logError(error, { roomId });
      return null;
    }
  }

  /**
   * Get room by code
   */
  async getRoomByCode(roomCode) {
    try {
      const room = await prisma.room.findUnique({
        where: { code: roomCode }
      });

      if (!room) return null;

      return this.getRoomById(room.id);
    } catch (error) {
      logError(error, { roomCode });
      return null;
    }
  }

  /**
   * Get public rooms
   */
  async getPublicRooms(limit = 20, offset = 0) {
    try {
      const rooms = await prisma.room.findMany({
        where: {
          isPublic: true,
          isActive: true
        },
        include: {
          _count: {
            select: {
              players: {
                where: { leftAt: null }
              }
            }
          },
          creator: {
            select: {
              nickname: true
            }
          }
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return rooms.map(room => ({
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        playerCount: room._count.players,
        maxPlayers: room.maxPlayers,
        hasPassword: !!room.password,
        creator: room.creator.nickname,
        createdAt: room.createdAt
      }));
    } catch (error) {
      logError(error);
      return [];
    }
  }

  /**
   * Add confession to room
   */
  async addConfession(roomId, userId, text) {
    try {
      const confession = await prisma.confession.create({
        data: {
          roomId,
          userId,
          text
        }
      });

      logInfo('Confession added', { roomId, userId, confessionId: confession.id });

      return confession;
    } catch (error) {
      logError(error, { roomId, userId });
      throw error;
    }
  }

  /**
   * Reveal confession
   */
  async revealConfession(confessionId, gameId = null) {
    try {
      const confession = await prisma.confession.update({
        where: { id: confessionId },
        data: {
          isRevealed: true,
          revealedAt: new Date(),
          revealedInGameId: gameId
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true
            }
          }
        }
      });

      logInfo('Confession revealed', { confessionId, userId: confession.userId });

      return confession;
    } catch (error) {
      logError(error, { confessionId });
      throw error;
    }
  }

  /**
   * Add chat message
   */
  async addChatMessage(roomId, { userId, nickname, text, type = 'CHAT', isSystem = false }) {
    try {
      const message = await prisma.chatMessage.create({
        data: {
          roomId,
          userId,
          nickname,
          text,
          type,
          isSystem
        }
      });

      return message;
    } catch (error) {
      logError(error, { roomId, userId });
      throw error;
    }
  }

  /**
   * Deactivate room
   */
  async deactivateRoom(roomId) {
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: { isActive: false }
      });

      // Get room code for cache
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { code: true }
      });

      if (room) {
        await roomCache.delete(room.code);
      }

      logInfo('Room deactivated', { roomId });

      return true;
    } catch (error) {
      logError(error, { roomId });
      return false;
    }
  }

  /**
   * Check if user has submitted confession
   */
  async hasSubmittedConfession(roomId, userId) {
    try {
      const confession = await prisma.confession.findFirst({
        where: {
          roomId,
          userId
        }
      });

      return !!confession;
    } catch (error) {
      logError(error, { roomId, userId });
      return false;
    }
  }

  /**
   * Get waiting players for matchmaking
   */
  async getWaitingPlayers(roomId) {
    try {
      const players = await prisma.roomPlayer.findMany({
        where: {
          roomId,
          isWaiting: true,
          leftAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true
            }
          }
        }
      });

      // Filter players who have submitted confessions
      const playersWithConfessions = [];
      for (const player of players) {
        const hasConfession = await this.hasSubmittedConfession(roomId, player.userId);
        if (hasConfession) {
          playersWithConfessions.push(player.userId);
        }
      }

      return playersWithConfessions;
    } catch (error) {
      logError(error, { roomId });
      return [];
    }
  }

  /**
   * Get all active rooms for a user
   */
  async getUserRooms(userId) {
    try {
      const rooms = await prisma.roomPlayer.findMany({
        where: {
          userId,
          leftAt: null
        },
        include: {
          room: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      });

      return rooms.map(rp => rp.room);
    } catch (error) {
      logError(error, { userId });
      return [];
    }
  }

  /**
   * Update player waiting status
   */
  async updatePlayerWaitingStatus(roomId, userId, isWaiting) {
    try {
      await prisma.roomPlayer.updateMany({
        where: {
          roomId,
          userId,
          leftAt: null
        },
        data: {
          isWaiting
        }
      });

      logInfo('Player waiting status updated', { roomId, userId, isWaiting });
      return true;
    } catch (error) {
      logError(error, { roomId, userId, isWaiting });
      return false;
    }
  }
}

export default new RoomService();