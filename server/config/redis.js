import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import dotenv from 'dotenv';

dotenv.config();

// Create Redis clients
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Create pub/sub clients for Socket.IO adapter
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

// Session store functions
export const sessionStore = {
  async get(sessionId) {
    try {
      const session = await redisClient.get(`session:${sessionId}`);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  async set(sessionId, session, ttl = 86400) {
    try {
      await redisClient.setex(
        `session:${sessionId}`,
        ttl,
        JSON.stringify(session)
      );
      return true;
    } catch (error) {
      console.error('Error setting session:', error);
      return false;
    }
  },

  async delete(sessionId) {
    try {
      await redisClient.del(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  },

  async exists(sessionId) {
    try {
      const exists = await redisClient.exists(`session:${sessionId}`);
      return exists === 1;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  },

  async touch(sessionId, ttl = 86400) {
    try {
      await redisClient.expire(`session:${sessionId}`, ttl);
      return true;
    } catch (error) {
      console.error('Error touching session:', error);
      return false;
    }
  }
};

// Room state cache functions
export const roomCache = {
  async get(roomCode) {
    try {
      const room = await redisClient.get(`room:${roomCode}`);
      return room ? JSON.parse(room) : null;
    } catch (error) {
      console.error('Error getting room from cache:', error);
      return null;
    }
  },

  async set(roomCode, roomData, ttl = 3600) {
    try {
      await redisClient.setex(
        `room:${roomCode}`,
        ttl,
        JSON.stringify(roomData)
      );
      return true;
    } catch (error) {
      console.error('Error setting room in cache:', error);
      return false;
    }
  },

  async delete(roomCode) {
    try {
      await redisClient.del(`room:${roomCode}`);
      return true;
    } catch (error) {
      console.error('Error deleting room from cache:', error);
      return false;
    }
  },

  async addPlayer(roomCode, playerId) {
    try {
      await redisClient.sadd(`room:${roomCode}:players`, playerId);
      return true;
    } catch (error) {
      console.error('Error adding player to room:', error);
      return false;
    }
  },

  async removePlayer(roomCode, playerId) {
    try {
      await redisClient.srem(`room:${roomCode}:players`, playerId);
      return true;
    } catch (error) {
      console.error('Error removing player from room:', error);
      return false;
    }
  },

  async getPlayers(roomCode) {
    try {
      const players = await redisClient.smembers(`room:${roomCode}:players`);
      return players;
    } catch (error) {
      console.error('Error getting room players:', error);
      return [];
    }
  }
};

// Game state cache functions
export const gameCache = {
  async get(gameId) {
    try {
      const game = await redisClient.get(`game:${gameId}`);
      return game ? JSON.parse(game) : null;
    } catch (error) {
      console.error('Error getting game from cache:', error);
      return null;
    }
  },

  async set(gameId, gameData, ttl = 7200) {
    try {
      await redisClient.setex(
        `game:${gameId}`,
        ttl,
        JSON.stringify(gameData)
      );
      return true;
    } catch (error) {
      console.error('Error setting game in cache:', error);
      return false;
    }
  },

  async delete(gameId) {
    try {
      await redisClient.del(`game:${gameId}`);
      return true;
    } catch (error) {
      console.error('Error deleting game from cache:', error);
      return false;
    }
  },

  async updateState(gameId, state) {
    try {
      const game = await this.get(gameId);
      if (game) {
        game.state = state;
        await this.set(gameId, game);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating game state:', error);
      return false;
    }
  }
};

// Rate limiting functions
export const rateLimiter = {
  async checkLimit(key, limit = 10, window = 60) {
    try {
      const current = await redisClient.incr(`rate:${key}`);
      
      if (current === 1) {
        await redisClient.expire(`rate:${key}`, window);
      }
      
      return current <= limit;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return true; // Allow on error
    }
  },

  async getRemainingLimit(key, limit = 10) {
    try {
      const current = await redisClient.get(`rate:${key}`);
      return Math.max(0, limit - (parseInt(current) || 0));
    } catch (error) {
      console.error('Error getting remaining limit:', error);
      return limit;
    }
  },

  async reset(key) {
    try {
      await redisClient.del(`rate:${key}`);
      return true;
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      return false;
    }
  }
};

// Word validation cache functions
export const wordCache = {
  async get(word) {
    try {
      const result = await redisClient.get(`word:${word.toLowerCase()}`);
      return result === null ? undefined : result === 'true';
    } catch (error) {
      console.error('Error getting word from cache:', error);
      return undefined;
    }
  },

  async set(word, isValid, ttl = 86400) { // 24 hour TTL by default
    try {
      await redisClient.setex(
        `word:${word.toLowerCase()}`,
        ttl,
        isValid.toString()
      );
      return true;
    } catch (error) {
      console.error('Error setting word in cache:', error);
      return false;
    }
  },

  async setMultiple(words, ttl = 86400) {
    try {
      const pipeline = redisClient.pipeline();
      
      for (const [word, isValid] of Object.entries(words)) {
        pipeline.setex(`word:${word.toLowerCase()}`, ttl, isValid.toString());
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Error setting multiple words in cache:', error);
      return false;
    }
  },

  async exists(word) {
    try {
      const exists = await redisClient.exists(`word:${word.toLowerCase()}`);
      return exists === 1;
    } catch (error) {
      console.error('Error checking word existence:', error);
      return false;
    }
  },

  async getStats() {
    try {
      const keys = await redisClient.keys('word:*');
      let validCount = 0;
      let invalidCount = 0;
      
      if (keys.length > 0) {
        const values = await redisClient.mget(...keys);
        values.forEach(val => {
          if (val === 'true') validCount++;
          else if (val === 'false') invalidCount++;
        });
      }
      
      return {
        total: keys.length,
        valid: validCount,
        invalid: invalidCount
      };
    } catch (error) {
      console.error('Error getting word cache stats:', error);
      return { total: 0, valid: 0, invalid: 0 };
    }
  }
};

// Leaderboard functions
export const leaderboard = {
  async addScore(userId, score) {
    try {
      await redisClient.zadd('leaderboard:global', score, userId);
      return true;
    } catch (error) {
      console.error('Error adding score to leaderboard:', error);
      return false;
    }
  },

  async getTop(count = 10) {
    try {
      const scores = await redisClient.zrevrange(
        'leaderboard:global',
        0,
        count - 1,
        'WITHSCORES'
      );
      
      const leaderboard = [];
      for (let i = 0; i < scores.length; i += 2) {
        leaderboard.push({
          userId: scores[i],
          score: parseInt(scores[i + 1])
        });
      }
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  },

  async getRank(userId) {
    try {
      const rank = await redisClient.zrevrank('leaderboard:global', userId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return null;
    }
  },

  async getScore(userId) {
    try {
      const score = await redisClient.zscore('leaderboard:global', userId);
      return score ? parseInt(score) : 0;
    } catch (error) {
      console.error('Error getting user score:', error);
      return 0;
    }
  }
};

// Export Socket.IO adapter
export function createRedisAdapter() {
  return createAdapter(pubClient, subClient);
}

// Export pub/sub clients for external use
export { pubClient, subClient };

export default redisClient;