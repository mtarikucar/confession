import prisma from '../config/database.js';
import { sessionStore, roomCache } from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class PlayerService {
  /**
   * Get or create a player/user
   */
  async getOrCreatePlayer(socketId, nickname, userId = null) {
    try {
      // If userId provided, get existing user
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            sessions: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        });

        if (user) {
          // Update session with socket ID
          if (user.sessions[0]) {
            await prisma.session.update({
              where: { id: user.sessions[0].id },
              data: { socketId }
            });
          }

          return {
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            username: user.username,
            isAuthenticated: true,
            socketId
          };
        }
      }

      // Create guest user
      const guestUser = await prisma.user.create({
        data: {
          id: uuidv4(),
          nickname: nickname || `Guest${Math.floor(Math.random() * 9999)}`,
          provider: 'LOCAL',
          sessions: {
            create: {
              socketId,
              token: uuidv4(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
          }
        },
        include: {
          sessions: true
        }
      });

      logInfo('Guest player created', { userId: guestUser.id, nickname: guestUser.nickname });

      return {
        id: guestUser.id,
        nickname: guestUser.nickname,
        isAuthenticated: false,
        socketId,
        sessionToken: guestUser.sessions[0].token
      };
    } catch (error) {
      logError(error, { socketId, nickname });
      throw error;
    }
  }

  /**
   * Get player by socket ID
   */
  async getPlayerBySocketId(socketId) {
    try {
      const session = await prisma.session.findUnique({
        where: { socketId },
        include: {
          user: true
        }
      });

      if (!session) return null;

      return {
        id: session.user.id,
        nickname: session.user.nickname,
        email: session.user.email,
        username: session.user.username,
        isAuthenticated: !!session.user.email,
        socketId
      };
    } catch (error) {
      logError(error, { socketId });
      return null;
    }
  }

  /**
   * Update player stats
   */
  async updateStats(userId, stats) {
    try {
      // For now, we'll store aggregated stats in Redis
      // In the future, this should update GameStat records
      
      const key = `player:stats:${userId}`;
      const currentStats = await sessionStore.get(key) || { wins: 0, losses: 0, games: 0 };
      
      const updatedStats = {
        ...currentStats,
        ...stats,
        lastUpdated: new Date()
      };

      await sessionStore.set(key, updatedStats, 86400 * 7); // 7 days TTL
      
      return updatedStats;
    } catch (error) {
      logError(error, { userId, stats });
      throw error;
    }
  }

  /**
   * Get player stats
   */
  async getStats(userId) {
    try {
      // Get from database
      const stats = await prisma.gameStat.aggregate({
        where: { userId },
        _sum: {
          wins: true,
          losses: true,
          score: true
        },
        _count: {
          id: true
        }
      });

      return {
        wins: stats._sum.wins || 0,
        losses: stats._sum.losses || 0,
        totalScore: stats._sum.score || 0,
        gamesPlayed: stats._count.id || 0
      };
    } catch (error) {
      logError(error, { userId });
      return { wins: 0, losses: 0, totalScore: 0, gamesPlayed: 0 };
    }
  }

  /**
   * Get player's current room
   */
  async getCurrentRoom(userId) {
    try {
      const roomPlayer = await prisma.roomPlayer.findFirst({
        where: {
          userId,
          leftAt: null
        },
        include: {
          room: true
        },
        orderBy: {
          joinedAt: 'desc'
        }
      });

      return roomPlayer?.room || null;
    } catch (error) {
      logError(error, { userId });
      return null;
    }
  }

  /**
   * Disconnect player (cleanup)
   */
  async disconnect(socketId) {
    try {
      // Update session
      const session = await prisma.session.findUnique({
        where: { socketId },
        include: { user: true }
      });

      if (session) {
        // Mark session as inactive
        await prisma.session.update({
          where: { id: session.id },
          data: { 
            socketId: null,
            isActive: false 
          }
        });

        // Mark player as left from all rooms
        await prisma.roomPlayer.updateMany({
          where: {
            userId: session.userId,
            leftAt: null
          },
          data: {
            leftAt: new Date()
          }
        });

        logInfo('Player disconnected', { userId: session.userId, socketId });
      }

      return true;
    } catch (error) {
      logError(error, { socketId });
      return false;
    }
  }

  /**
   * Get online players count
   */
  async getOnlineCount() {
    try {
      const count = await prisma.session.count({
        where: {
          isActive: true,
          socketId: { not: null }
        }
      });
      return count;
    } catch (error) {
      logError(error);
      return 0;
    }
  }
}

export default new PlayerService();