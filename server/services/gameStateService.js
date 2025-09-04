import stateManager from './simpleStateManager.js';
import { logInfo, logError, logWarn } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { sessionStore } from '../config/redis.js';

/**
 * Game State Service
 * Handles game instance persistence and restoration with serialization
 */
class GameStateService {
  constructor() {
    this.activeGames = new Map();
    this.gameTimeouts = new Map();
    this.GAME_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.ACTION_QUEUE_SIZE = 100;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Serialize game instance for storage
   */
  serializeGame(game) {
    try {
      if (!game) return null;
      
      return {
        id: game.id,
        type: game.type,
        roomCode: game.roomCode,
        players: game.players?.map(p => ({
          id: p.id,
          nickname: p.nickname,
          hasConfession: p.hasConfession,
          score: p.score || 0
        })),
        state: game.state,
        currentPlayer: game.currentPlayer,
        confession: game.confession,
        matchedPlayers: game.matchedPlayers,
        winner: game.winner,
        settings: game.settings,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        round: game.round,
        maxRounds: game.maxRounds,
        timeLeft: game.timeLeft,
        actionHistory: game.actionHistory?.slice(-this.ACTION_QUEUE_SIZE), // Keep last N actions
        customData: game.customData || {},
        lastActivity: Date.now()
      };
    } catch (error) {
      logError(error, { gameId: game?.id });
      return null;
    }
  }

  /**
   * Deserialize game from storage
   */
  deserializeGame(data) {
    try {
      if (!data) return null;
      
      // Check if game is stale
      if (data.lastActivity && Date.now() - data.lastActivity > this.GAME_TIMEOUT) {
        logWarn('Game is stale, not restoring', { gameId: data.id });
        return null;
      }
      
      // Basic game object restoration
      const game = {
        ...data,
        emit: this.createEmitFunction(data.roomCode),
        broadcast: this.createBroadcastFunction(data.roomCode)
      };
      
      return game;
    } catch (error) {
      logError(error, { gameData: data });
      return null;
    }
  }

  /**
   * Create emit function for restored game
   */
  createEmitFunction(roomCode) {
    return (event, data) => {
      // This will be overridden when game is activated
      logInfo('Emit called on inactive game', { roomCode, event });
    };
  }

  /**
   * Create broadcast function for restored game
   */
  createBroadcastFunction(roomCode) {
    return (event, data) => {
      // This will be overridden when game is activated
      logInfo('Broadcast called on inactive game', { roomCode, event });
    };
  }

  /**
   * Save game state to Redis
   */
  async saveGame(game) {
    try {
      if (!game || !game.id) {
        logWarn('Invalid game object for saving');
        return false;
      }
      
      const serialized = this.serializeGame(game);
      if (!serialized) {
        logError('Failed to serialize game', { gameId: game.id });
        return false;
      }
      
      // Save to Redis using stateManager
      await stateManager.saveGameState(game.id, serialized);
      
      // Update local cache
      this.activeGames.set(game.id, game);
      
      // Reset timeout
      this.resetGameTimeout(game.id);
      
      logInfo('Game state saved', { 
        gameId: game.id, 
        roomCode: game.roomCode,
        playerCount: game.players?.length 
      });
      
      return true;
    } catch (error) {
      logError(error, { gameId: game?.id });
      return false;
    }
  }

  /**
   * Load game state from Redis
   */
  async loadGame(gameId) {
    try {
      // Check local cache first
      if (this.activeGames.has(gameId)) {
        return this.activeGames.get(gameId);
      }
      
      // Load from Redis
      const data = await stateManager.getGameState(gameId);
      if (!data) {
        logInfo('Game not found in storage', { gameId });
        return null;
      }
      
      const game = this.deserializeGame(data);
      if (game) {
        // Cache locally
        this.activeGames.set(gameId, game);
        this.resetGameTimeout(gameId);
      }
      
      return game;
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }

  /**
   * Update game state atomically
   */
  async updateGame(gameId, updates) {
    try {
      const newState = await stateManager.updateGameState(gameId, updates);
      
      // Update local cache
      if (this.activeGames.has(gameId)) {
        const cachedGame = this.activeGames.get(gameId);
        Object.assign(cachedGame, updates);
      }
      
      this.resetGameTimeout(gameId);
      
      return newState;
    } catch (error) {
      logError(error, { gameId });
      throw error;
    }
  }

  /**
   * Create new game instance
   */
  async createGame(roomCode, gameType, players, confession, settings = {}) {
    try {
      const gameId = uuidv4();
      
      const game = {
        id: gameId,
        type: gameType,
        roomCode,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          hasConfession: p.hasConfession || false,
          score: 0
        })),
        confession,
        settings,
        state: 'waiting',
        matchedPlayers: [],
        startedAt: Date.now(),
        round: 1,
        maxRounds: settings.maxRounds || 5,
        actionHistory: [],
        customData: {}
      };
      
      // Save to Redis and cache
      await this.saveGame(game);
      
      logInfo('Game created', { 
        gameId, 
        roomCode, 
        gameType,
        playerCount: players.length 
      });
      
      return game;
    } catch (error) {
      logError(error, { roomCode, gameType });
      throw error;
    }
  }

  /**
   * Delete game
   */
  async deleteGame(gameId) {
    try {
      // Remove from Redis
      await stateManager.deleteGameState(gameId);
      
      // Remove from local cache
      this.activeGames.delete(gameId);
      
      // Clear timeout
      if (this.gameTimeouts.has(gameId)) {
        clearTimeout(this.gameTimeouts.get(gameId));
        this.gameTimeouts.delete(gameId);
      }
      
      logInfo('Game deleted', { gameId });
      
      return true;
    } catch (error) {
      logError(error, { gameId });
      return false;
    }
  }

  /**
   * Get active games for a room
   */
  async getRoomActiveGames(roomCode) {
    try {
      const games = [];
      
      // Check local cache
      for (const [gameId, game] of this.activeGames) {
        if (game.roomCode === roomCode && game.state !== 'ended') {
          games.push(game);
        }
      }
      
      return games;
    } catch (error) {
      logError(error, { roomCode });
      return [];
    }
  }

  /**
   * Handle player disconnection
   */
  async handlePlayerDisconnect(playerId, gameId) {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return null;
      
      // Mark player as disconnected
      const playerIndex = game.players?.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        await this.updateGame(gameId, {
          players: game.players.map((p, i) => 
            i === playerIndex 
              ? { ...p, disconnected: true, disconnectedAt: Date.now() }
              : p
          )
        });
      }
      
      logInfo('Player marked as disconnected in game', { playerId, gameId });
      
      return game;
    } catch (error) {
      logError(error, { playerId, gameId });
      return null;
    }
  }

  /**
   * Handle player reconnection
   */
  async handlePlayerReconnect(playerId, gameId) {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return null;
      
      // Mark player as reconnected
      const playerIndex = game.players?.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        await this.updateGame(gameId, {
          players: game.players.map((p, i) => 
            i === playerIndex 
              ? { ...p, disconnected: false, disconnectedAt: null }
              : p
          )
        });
      }
      
      logInfo('Player reconnected to game', { playerId, gameId });
      
      return game;
    } catch (error) {
      logError(error, { playerId, gameId });
      return null;
    }
  }

  /**
   * Add action to game history
   */
  async addGameAction(gameId, action) {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return false;
      
      const actionEntry = {
        id: uuidv4(),
        type: action.type,
        playerId: action.playerId,
        data: action.data,
        timestamp: Date.now()
      };
      
      const updatedHistory = [...(game.actionHistory || []), actionEntry];
      
      // Keep only last N actions to prevent memory issues
      if (updatedHistory.length > this.ACTION_QUEUE_SIZE) {
        updatedHistory.splice(0, updatedHistory.length - this.ACTION_QUEUE_SIZE);
      }
      
      await this.updateGame(gameId, {
        actionHistory: updatedHistory,
        lastActivity: Date.now()
      });
      
      return true;
    } catch (error) {
      logError(error, { gameId, action });
      return false;
    }
  }

  /**
   * Get game history
   */
  async getGameHistory(gameId, limit = 50) {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return [];
      
      const history = game.actionHistory || [];
      return history.slice(-limit);
    } catch (error) {
      logError(error, { gameId });
      return [];
    }
  }

  /**
   * Reset game timeout
   */
  resetGameTimeout(gameId) {
    // Clear existing timeout
    if (this.gameTimeouts.has(gameId)) {
      clearTimeout(this.gameTimeouts.get(gameId));
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      this.handleGameTimeout(gameId);
    }, this.GAME_TIMEOUT);
    
    this.gameTimeouts.set(gameId, timeout);
  }

  /**
   * Handle game timeout
   */
  async handleGameTimeout(gameId) {
    try {
      logInfo('Game timeout reached', { gameId });
      
      // Update game state to ended
      await this.updateGame(gameId, {
        state: 'ended',
        endedAt: Date.now(),
        endReason: 'timeout'
      });
      
      // Clean up after a delay
      setTimeout(() => {
        this.deleteGame(gameId);
      }, 60000); // Delete after 1 minute
    } catch (error) {
      logError(error, { gameId });
    }
  }

  /**
   * Cleanup stale games
   */
  async cleanupStaleGames() {
    try {
      let cleaned = 0;
      
      for (const [gameId, game] of this.activeGames) {
        // Check if game is stale
        if (game.lastActivity && Date.now() - game.lastActivity > this.GAME_TIMEOUT) {
          await this.deleteGame(gameId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logInfo('Cleaned up stale games', { count: cleaned });
      }
      
      return cleaned;
    } catch (error) {
      logError(error);
      return 0;
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupStaleGames();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Get game statistics
   */
  async getGameStats(gameId) {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return null;
      
      return {
        id: game.id,
        type: game.type,
        roomCode: game.roomCode,
        state: game.state,
        playerCount: game.players?.length || 0,
        round: game.round,
        maxRounds: game.maxRounds,
        duration: game.startedAt ? Date.now() - game.startedAt : 0,
        actionCount: game.actionHistory?.length || 0,
        lastActivity: game.lastActivity
      };
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }

  /**
   * Restore all games for a room
   */
  async restoreRoomGames(roomCode) {
    try {
      const games = [];
      
      // This would need to query Redis for all games with this room code
      // For now, check local cache
      for (const [gameId, game] of this.activeGames) {
        if (game.roomCode === roomCode) {
          games.push(game);
        }
      }
      
      logInfo('Restored games for room', { roomCode, count: games.length });
      
      return games;
    } catch (error) {
      logError(error, { roomCode });
      return [];
    }
  }
}

export default new GameStateService();