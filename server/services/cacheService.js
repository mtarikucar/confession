import redisClient, { 
  sessionStore, 
  roomCache, 
  gameCache, 
  rateLimiter,
  leaderboard 
} from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';

class CacheService {
  constructor() {
    this.matchmakingQueues = new Map(); // Room-specific matchmaking queues
    this.activeGames = new Map(); // Active game instances
  }

  /**
   * Add player to matchmaking queue
   */
  async addToMatchmaking(roomCode, playerId) {
    try {
      const key = `matchmaking:${roomCode}`;
      await redisClient.sadd(key, playerId);
      await redisClient.expire(key, 60); // 60 seconds TTL
      
      logInfo('Player added to matchmaking', { roomCode, playerId });
      return true;
    } catch (error) {
      logError(error, { roomCode, playerId });
      return false;
    }
  }

  /**
   * Get matchmaking queue for room
   */
  async getMatchmakingQueue(roomCode) {
    try {
      const key = `matchmaking:${roomCode}`;
      const players = await redisClient.smembers(key);
      return players;
    } catch (error) {
      logError(error, { roomCode });
      return [];
    }
  }

  /**
   * Remove from matchmaking
   */
  async removeFromMatchmaking(roomCode, playerId) {
    try {
      const key = `matchmaking:${roomCode}`;
      await redisClient.srem(key, playerId);
      return true;
    } catch (error) {
      logError(error, { roomCode, playerId });
      return false;
    }
  }

  /**
   * Clear matchmaking queue
   */
  async clearMatchmakingQueue(roomCode) {
    try {
      const key = `matchmaking:${roomCode}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }

  /**
   * Store active game instance
   */
  setActiveGame(gameId, gameInstance) {
    this.activeGames.set(gameId, gameInstance);
  }

  /**
   * Get active game instance
   */
  getActiveGame(gameId) {
    return this.activeGames.get(gameId);
  }

  /**
   * Remove active game instance
   */
  removeActiveGame(gameId) {
    const game = this.activeGames.get(gameId);
    if (game && game.cleanup) {
      game.cleanup();
    }
    this.activeGames.delete(gameId);
  }

  /**
   * Store matchmaking timer
   */
  setMatchmakingTimer(roomCode, timerId) {
    this.matchmakingQueues.set(roomCode, timerId);
  }

  /**
   * Get matchmaking timer
   */
  getMatchmakingTimer(roomCode) {
    return this.matchmakingQueues.get(roomCode);
  }

  /**
   * Clear matchmaking timer
   */
  clearMatchmakingTimer(roomCode) {
    const timerId = this.matchmakingQueues.get(roomCode);
    if (timerId) {
      clearTimeout(timerId);
      this.matchmakingQueues.delete(roomCode);
    }
  }

  /**
   * Cache room list
   */
  async cachePublicRooms(rooms) {
    try {
      const key = 'rooms:public';
      await redisClient.setex(key, 30, JSON.stringify(rooms)); // 30 seconds cache
      return true;
    } catch (error) {
      logError(error);
      return false;
    }
  }

  /**
   * Get cached public rooms
   */
  async getCachedPublicRooms() {
    try {
      const key = 'rooms:public';
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError(error);
      return null;
    }
  }

  /**
   * Update player online status
   */
  async setPlayerOnline(playerId, socketId) {
    try {
      const key = `online:${playerId}`;
      await redisClient.setex(key, 300, socketId); // 5 minutes TTL
      await redisClient.sadd('online:players', playerId);
      return true;
    } catch (error) {
      logError(error, { playerId, socketId });
      return false;
    }
  }

  /**
   * Remove player online status
   */
  async setPlayerOffline(playerId) {
    try {
      const key = `online:${playerId}`;
      await redisClient.del(key);
      await redisClient.srem('online:players', playerId);
      return true;
    } catch (error) {
      logError(error, { playerId });
      return false;
    }
  }

  /**
   * Get online players count
   */
  async getOnlinePlayersCount() {
    try {
      const count = await redisClient.scard('online:players');
      return count;
    } catch (error) {
      logError(error);
      return 0;
    }
  }

  /**
   * Cache user profile
   */
  async cacheUserProfile(userId, profile) {
    try {
      const key = `profile:${userId}`;
      await redisClient.setex(key, 3600, JSON.stringify(profile)); // 1 hour cache
      return true;
    } catch (error) {
      logError(error, { userId });
      return false;
    }
  }

  /**
   * Get cached user profile
   */
  async getCachedUserProfile(userId) {
    try {
      const key = `profile:${userId}`;
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError(error, { userId });
      return null;
    }
  }

  /**
   * Invalidate user profile cache
   */
  async invalidateUserProfile(userId) {
    try {
      const key = `profile:${userId}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      logError(error, { userId });
      return false;
    }
  }

  /**
   * Store typing indicator
   */
  async setTypingIndicator(roomCode, playerId) {
    try {
      const key = `typing:${roomCode}:${playerId}`;
      await redisClient.setex(key, 3, '1'); // 3 seconds TTL
      return true;
    } catch (error) {
      logError(error, { roomCode, playerId });
      return false;
    }
  }

  /**
   * Get typing users in room
   */
  async getTypingUsers(roomCode) {
    try {
      const pattern = `typing:${roomCode}:*`;
      const keys = await redisClient.keys(pattern);
      
      const typingUsers = keys.map(key => {
        const parts = key.split(':');
        return parts[parts.length - 1];
      });
      
      return typingUsers;
    } catch (error) {
      logError(error, { roomCode });
      return [];
    }
  }

  /**
   * Clean up all cache for a player
   */
  async cleanupPlayer(playerId) {
    try {
      // Remove from online status
      await this.setPlayerOffline(playerId);
      
      // Clear profile cache
      await this.invalidateUserProfile(playerId);
      
      // Clear any typing indicators
      const typingKeys = await redisClient.keys(`typing:*:${playerId}`);
      if (typingKeys.length > 0) {
        await redisClient.del(...typingKeys);
      }
      
      logInfo('Player cache cleaned up', { playerId });
      return true;
    } catch (error) {
      logError(error, { playerId });
      return false;
    }
  }

  /**
   * Clean up all cache for a room
   */
  async cleanupRoom(roomCode) {
    try {
      // Clear room cache
      await roomCache.delete(roomCode);
      
      // Clear matchmaking queue
      await this.clearMatchmakingQueue(roomCode);
      
      // Clear matchmaking timer
      this.clearMatchmakingTimer(roomCode);
      
      // Clear typing indicators
      const typingKeys = await redisClient.keys(`typing:${roomCode}:*`);
      if (typingKeys.length > 0) {
        await redisClient.del(...typingKeys);
      }
      
      logInfo('Room cache cleaned up', { roomCode });
      return true;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }
}

// Export singleton instance
export default new CacheService();

// Also export the cache utilities from redis config
export { 
  sessionStore, 
  roomCache, 
  gameCache, 
  rateLimiter,
  leaderboard 
};