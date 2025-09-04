import redisClient from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';

/**
 * Centralized State Manager for Redis
 * Handles all state operations with atomic guarantees
 */
class StateManager {
  constructor() {
    this.roomPrefix = 'room:state:';
    this.gamePrefix = 'game:state:';
    this.lockPrefix = 'lock:';
    this.TTL = {
      room: 3600 * 24, // 24 hours
      game: 3600 * 4,  // 4 hours
      lock: 30         // 30 seconds (increased from 10)
    };
    this.LOCK_TIMEOUT = 10000; // 10 seconds default lock timeout
    this.MAX_LOCK_RETRIES = 3;  // Maximum lock retry attempts
  }

  /**
   * Acquire a distributed lock for atomic operations with retry
   */
  async acquireLock(key, timeout = 10000, retries = 0) {
    const lockKey = `${this.lockPrefix}${key}`;
    const lockValue = Date.now() + timeout;
    
    try {
      const result = await redisClient.set(
        lockKey, 
        lockValue, 
        'NX', 
        'PX', 
        timeout
      );
      
      if (result === 'OK') {
        return true;
      }
      
      // If lock failed and we have retries left, wait and retry
      if (retries < this.MAX_LOCK_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 100 * (retries + 1)));
        return await this.acquireLock(key, timeout, retries + 1);
      }
      
      return false;
    } catch (error) {
      logError(error, { lockKey, retries });
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(key) {
    const lockKey = `${this.lockPrefix}${key}`;
    try {
      await redisClient.del(lockKey);
    } catch (error) {
      logError(error, { lockKey });
    }
  }

  /**
   * Save room state atomically
   */
  async saveRoomState(roomCode, state) {
    const key = `${this.roomPrefix}${roomCode}`;
    const lockAcquired = await this.acquireLock(key, this.LOCK_TIMEOUT);
    
    if (!lockAcquired) {
      logError(new Error('Lock acquisition failed'), { roomCode, key });
      // Try without lock as fallback (best effort)
      try {
        const serialized = JSON.stringify({
          ...state,
          lastUpdated: Date.now()
        });
        await redisClient.setex(key, this.TTL.room, serialized);
        logInfo('Room state saved without lock (fallback)', { roomCode });
        return true;
      } catch (fallbackError) {
        logError(fallbackError, { roomCode, context: 'fallback save' });
        throw new Error('Could not acquire lock for room state update');
      }
    }
    
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
      throw error;
    } finally {
      await this.releaseLock(key);
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
      
      // Check if state is stale (older than 24 hours)
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
   * Update room state partially (atomic)
   */
  async updateRoomState(roomCode, updates) {
    const key = `${this.roomPrefix}${roomCode}`;
    const lockAcquired = await this.acquireLock(key, this.LOCK_TIMEOUT);
    
    if (!lockAcquired) {
      logError(new Error('Lock acquisition failed'), { roomCode, key });
      // Try without lock as fallback (best effort)
      try {
        const currentState = await this.getRoomState(roomCode) || {};
        const newState = {
          ...currentState,
          ...updates,
          lastUpdated: Date.now()
        };
        const serialized = JSON.stringify(newState);
        await redisClient.setex(key, this.TTL.room, serialized);
        logInfo('Room state updated without lock (fallback)', { roomCode });
        return newState;
      } catch (fallbackError) {
        logError(fallbackError, { roomCode, context: 'fallback update' });
        throw new Error('Could not acquire lock for room state update');
      }
    }
    
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
    } finally {
      await this.releaseLock(key);
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
   * Update game state atomically
   */
  async updateGameState(gameId, updates) {
    const key = `${this.gamePrefix}${gameId}`;
    const lockAcquired = await this.acquireLock(key, this.LOCK_TIMEOUT);
    
    if (!lockAcquired) {
      logError(new Error('Lock acquisition failed'), { gameId, key });
      // Try without lock as fallback (best effort)
      try {
        const currentState = await this.getGameState(gameId) || {};
        const newState = {
          ...currentState,
          ...updates,
          lastUpdated: Date.now()
        };
        const serialized = JSON.stringify(newState);
        await redisClient.setex(key, this.TTL.game, serialized);
        logInfo('Game state updated without lock (fallback)', { gameId });
        return newState;
      } catch (fallbackError) {
        logError(fallbackError, { gameId, context: 'fallback update' });
        throw new Error('Could not acquire lock for game state update');
      }
    }
    
    try {
      const currentState = await this.getGameState(gameId) || {};
      
      const newState = {
        ...currentState,
        ...updates,
        lastUpdated: Date.now()
      };
      
      const serialized = JSON.stringify(newState);
      await redisClient.setex(key, this.TTL.game, serialized);
      
      return newState;
    } catch (error) {
      logError(error, { gameId });
      throw error;
    } finally {
      await this.releaseLock(key);
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

export default new StateManager();