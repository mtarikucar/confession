import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class GameService {
  constructor() {
    this.activeGamesPrefix = 'game:active:';
    this.matchmakingPrefix = 'matchmaking:';
  }

  /**
   * Create a new game
   */
  async createGame(roomId, type, players, initialState = {}) {
    try {
      const gameId = uuidv4();
      
      // Create game in database
      const game = await prisma.game.create({
        data: {
          id: gameId,
          roomId,
          type: type.toUpperCase().replace(/-/g, '_'),
          state: initialState,
          players: players
        }
      });

      // Update room's currentGameId
      await prisma.room.update({
        where: { id: roomId },
        data: { currentGameId: gameId }
      });

      // Mark players as playing
      await prisma.roomPlayer.updateMany({
        where: {
          roomId,
          userId: { in: players }
        },
        data: {
          isWaiting: false
        }
      });

      logInfo('Game created', { 
        gameId, 
        roomId, 
        type, 
        playerCount: players.length 
      });

      return game;
    } catch (error) {
      logError(error, { roomId, type, players });
      throw error;
    }
  }

  /**
   * Update game state
   */
  async updateGameState(gameId, state) {
    try {
      const game = await prisma.game.update({
        where: { id: gameId },
        data: { state }
      });

      // Also update in cache
      const cacheKey = `${this.activeGamesPrefix}${gameId}`;
      await redisClient.set(cacheKey, JSON.stringify(state), 'EX', 3600);

      return game;
    } catch (error) {
      logError(error, { gameId });
      throw error;
    }
  }

  /**
   * End a game
   */
  async endGame(gameId, winnerId = null, rankings = null) {
    try {
      // Get game details
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          room: true
        }
      });

      if (!game) {
        throw new Error('Game not found');
      }

      // Update game record
      const endedGame = await prisma.game.update({
        where: { id: gameId },
        data: {
          endedAt: new Date(),
          winnerId,
          rankings,
          duration: Math.floor((Date.now() - game.startedAt.getTime()) / 1000)
        }
      });

      // Clear room's currentGameId
      await prisma.room.update({
        where: { id: game.roomId },
        data: { currentGameId: null }
      });

      // Mark all players as waiting again
      await prisma.roomPlayer.updateMany({
        where: {
          roomId: game.roomId,
          userId: { in: game.players }
        },
        data: {
          isWaiting: true
        }
      });

      // Update game stats for players
      if (winnerId) {
        await prisma.gameStat.create({
          data: {
            gameId,
            userId: winnerId,
            wins: 1,
            position: 1
          }
        });
      }

      // Handle rankings if provided
      if (rankings && Array.isArray(rankings)) {
        for (const ranking of rankings) {
          if (ranking.playerId !== winnerId) {
            await prisma.gameStat.create({
              data: {
                gameId,
                userId: ranking.playerId,
                losses: ranking.position === rankings.length ? 1 : 0,
                position: ranking.position
              }
            });
          }
        }
      }

      // Clear from cache
      const cacheKey = `${this.activeGamesPrefix}${gameId}`;
      await redisClient.del(cacheKey);

      logInfo('Game ended', { 
        gameId, 
        winnerId, 
        duration: endedGame.duration 
      });

      return endedGame;
    } catch (error) {
      logError(error, { gameId });
      throw error;
    }
  }

  /**
   * Get active game by ID
   */
  async getActiveGame(gameId) {
    try {
      // Check cache first
      const cacheKey = `${this.activeGamesPrefix}${gameId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const game = await prisma.game.findUnique({
        where: { 
          id: gameId,
          endedAt: null
        }
      });

      if (game) {
        // Cache it
        await redisClient.set(cacheKey, JSON.stringify(game), 'EX', 3600);
      }

      return game;
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }

  /**
   * Store active game instance in Redis
   */
  async storeActiveGameInstance(gameId, instance) {
    try {
      const cacheKey = `${this.activeGamesPrefix}instance:${gameId}`;
      await redisClient.set(
        cacheKey, 
        JSON.stringify({
          type: instance.constructor.name,
          state: instance.getState ? instance.getState() : {},
          players: instance.players
        }), 
        'EX', 
        3600
      );
    } catch (error) {
      logError(error, { gameId });
    }
  }

  /**
   * Get active game instance from Redis
   */
  async getActiveGameInstance(gameId) {
    try {
      const cacheKey = `${this.activeGamesPrefix}instance:${gameId}`;
      const data = await redisClient.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }

  /**
   * Match players for a game
   */
  async matchPlayers(roomId) {
    try {
      // Get room with players who have confessions
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          players: {
            where: {
              leftAt: null,
              isWaiting: true
            },
            include: {
              user: true
            }
          },
          confessions: {
            where: {
              isRevealed: false
            }
          }
        }
      });

      if (!room) {
        return null;
      }

      // Filter players who have submitted confessions
      const eligiblePlayers = room.players.filter(player => 
        room.confessions.some(c => c.userId === player.userId)
      );

      if (eligiblePlayers.length < 2) {
        return null;
      }

      // Match players (2-8 players)
      const maxPlayers = Math.min(eligiblePlayers.length, 8);
      const minPlayers = 2;
      
      // If we have 8 or more, start immediately with 8
      if (eligiblePlayers.length >= 8) {
        const selectedPlayers = eligiblePlayers
          .slice(0, 8)
          .map(p => p.userId);
        
        return {
          players: selectedPlayers,
          count: selectedPlayers.length
        };
      }

      // Otherwise, return all eligible players (2-7)
      const selectedPlayers = eligiblePlayers.map(p => p.userId);
      
      return {
        players: selectedPlayers,
        count: selectedPlayers.length
      };
    } catch (error) {
      logError(error, { roomId });
      return null;
    }
  }

  /**
   * Set matchmaking timer
   */
  async setMatchmakingTimer(roomCode, duration = 5000) {
    try {
      const key = `${this.matchmakingPrefix}${roomCode}`;
      await redisClient.set(key, Date.now() + duration, 'PX', duration);
      return true;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }

  /**
   * Check if matchmaking timer exists
   */
  async hasMatchmakingTimer(roomCode) {
    try {
      const key = `${this.matchmakingPrefix}${roomCode}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }

  /**
   * Clear matchmaking timer
   */
  async clearMatchmakingTimer(roomCode) {
    try {
      const key = `${this.matchmakingPrefix}${roomCode}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }

  /**
   * Get game by room ID
   */
  async getCurrentGameByRoomId(roomId) {
    try {
      const game = await prisma.game.findFirst({
        where: {
          roomId,
          endedAt: null
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      return game;
    } catch (error) {
      logError(error, { roomId });
      return null;
    }
  }

  /**
   * Record game action
   */
  async recordGameAction(gameId, playerId, action) {
    try {
      await prisma.gameAction.create({
        data: {
          gameId,
          playerId,
          action
        }
      });
    } catch (error) {
      logError(error, { gameId, playerId });
    }
  }
}

export default new GameService();