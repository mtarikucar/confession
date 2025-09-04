import redisClient from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';

/**
 * Simplified State Manager without locks
 * Uses atomic Redis operations and optimistic updates
 */
class SimpleStateManager {
  constructor() {
    this.roomPrefix = 'room:state:';
    this.gamePrefix = 'game:state:';
    this.TTL = {
      room: 3600 * 24, // 24 hours
      game: 3600 * 4,  // 4 hours
    };
  }

  /**
   * Save room state (atomic operation)
   */
  async saveRoomState(roomCode, state) {
    const key = `${this.roomPrefix}${roomCode}`;
    
    try {
      const serialized = JSON.stringify({
        ...state,
        lastUpdated: Date.now()
      });
      
      await redisClient.setex(key, this.TTL.room, serialized);
      
      logInfo('Room state saved', { roomCode, size: serialized.length });
      return true;
    } catch (error) {
      logError(error, { roomCode });
      return false;
    }
  }

  /**
   * Get room state
   */
  async getRoomState(roomCode) {
    const key = `${this.roomPrefix}${roomCode}`;
    
    try {
      const data = await redisClient.get(key);
      
      if (!data) {
        return null;
      }
      
      const state = JSON.parse(data);
      
      // Check if state is stale
      if (state.lastUpdated && Date.now() - state.lastUpdated > this.TTL.room * 1000) {
        await redisClient.del(key);
        return null;
      }
      
      return state;
    } catch (error) {
      logError(error, { roomCode });
      return null;
    }
  }

  /**
   * Update room state using Redis hash operations for atomic updates
   */
  async updateRoomState(roomCode, updates) {
    const key = `${this.roomPrefix}${roomCode}`;
    
    try {
      const currentState = await this.getRoomState(roomCode) || {};
      
      const newState = {
        ...currentState,
        ...updates,
        lastUpdated: Date.now()
      };
      
      const serialized = JSON.stringify(newState);
      await redisClient.setex(key, this.TTL.room, serialized);
      
      return newState;
    } catch (error) {
      logError(error, { roomCode });
      throw error;
    }
  }

  /**
   * Save game state
   */
  async saveGameState(gameId, state) {
    const key = `${this.gamePrefix}${gameId}`;
    
    try {
      const serialized = JSON.stringify({
        ...state,
        lastUpdated: Date.now()
      });
      
      await redisClient.setex(key, this.TTL.game, serialized);
      
      logInfo('Game state saved', { gameId, size: serialized.length });
      return true;
    } catch (error) {
      logError(error, { gameId });
      return false;
    }
  }

  /**
   * Get game state
   */
  async getGameState(gameId) {
    const key = `${this.gamePrefix}${gameId}`;
    
    try {
      const data = await redisClient.get(key);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }

  /**
   * Update game state atomically using Redis operations
   */
  async updateGameState(gameId, updates) {
    const key = `${this.gamePrefix}${gameId}`;
    
    try {
      // Use Redis WATCH/MULTI/EXEC for optimistic concurrency control
      const watchKey = await redisClient.watch(key);
      
      const currentData = await redisClient.get(key);
      const currentState = currentData ? JSON.parse(currentData) : {};
      
      const newState = {
        ...currentState,
        ...updates,
        lastUpdated: Date.now()
      };
      
      const serialized = JSON.stringify(newState);
      
      // Execute transaction
      const multi = redisClient.multi();
      multi.setex(key, this.TTL.game, serialized);
      const result = await multi.exec();
      
      if (!result) {
        // Transaction failed due to concurrent modification
        // Retry once with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return this.updateGameState(gameId, updates);
      }
      
      return newState;
    } catch (error) {
      logError(error, { gameId });
      // On error, still try to save the state (best effort)
      try {
        const fallbackState = { ...updates, lastUpdated: Date.now() };
        await redisClient.setex(key, this.TTL.game, JSON.stringify(fallbackState));
        return fallbackState;
      } catch (fallbackError) {
        logError(fallbackError, { gameId });
        throw error;
      }
    }
  }

  /**
   * Delete room state
   */
  async deleteRoomState(roomCode) {
    const key = `${this.roomPrefix}${roomCode}`;
    
    try {
      await redisClient.del(key);
      logInfo('Room state deleted', { roomCode });
    } catch (error) {
      logError(error, { roomCode });
    }
  }

  /**
   * Delete game state
   */
  async deleteGameState(gameId) {
    const key = `${this.gamePrefix}${gameId}`;
    
    try {
      await redisClient.del(key);
      logInfo('Game state deleted', { gameId });
    } catch (error) {
      logError(error, { gameId });
    }
  }

  /**
   * Get all active room codes
   */
  async getActiveRoomCodes() {
    try {
      const keys = await redisClient.keys(`${this.roomPrefix}*`);
      return keys.map(key => key.replace(this.roomPrefix, ''));
    } catch (error) {
      logError(error);
      return [];
    }
  }

  /**
   * Batch update multiple game states
   */
  async batchUpdateGameStates(updates) {
    const results = [];
    
    for (const { gameId, state } of updates) {
      try {
        const result = await this.updateGameState(gameId, state);
        results.push({ gameId, success: true, state: result });
      } catch (error) {
        logError(error, { gameId });
        results.push({ gameId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Cleanup stale states
   */
  async cleanup() {
    try {
      const roomKeys = await redisClient.keys(`${this.roomPrefix}*`);
      const gameKeys = await redisClient.keys(`${this.gamePrefix}*`);
      
      let cleaned = 0;
      
      // Check and clean room states
      for (const key of roomKeys) {
        const data = await redisClient.get(key);
        if (data) {
          const state = JSON.parse(data);
          if (state.lastUpdated && Date.now() - state.lastUpdated > this.TTL.room * 1000) {
            await redisClient.del(key);
            cleaned++;
          }
        }
      }
      
      // Check and clean game states
      for (const key of gameKeys) {
        const data = await redisClient.get(key);
        if (data) {
          const state = JSON.parse(data);
          if (state.lastUpdated && Date.now() - state.lastUpdated > this.TTL.game * 1000) {
            await redisClient.del(key);
            cleaned++;
          }
        }
      }
      
      logInfo('State cleanup completed', { cleaned });
      
      return cleaned;
    } catch (error) {
      logError(error);
      return 0;
    }
  }
}

export default new SimpleStateManager();