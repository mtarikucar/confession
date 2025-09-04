import { EventEmitter } from 'events';
import { logInfo, logError } from '../config/logger.js';
import cacheService from './cacheService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Game Manager with proper lifecycle management
 */
class GameManager extends EventEmitter {
  constructor() {
    super();
    this.games = new Map();
    this.gameTypes = new Map();
    this.playerGames = new Map(); // Track which game each player is in
    this.roomGames = new Map(); // Track active game per room
    
    // Game lifecycle settings
    this.settings = {
      minPlayers: 2,
      maxPlayers: 20,
      voteTimeout: 30000, // 30 seconds for voting
      startDelay: 5000, // 5 second countdown before game starts
      reconnectTimeout: 30000, // 30 seconds to reconnect
      idleTimeout: 300000, // 5 minutes idle timeout
      maxGameDuration: 1800000 // 30 minutes max game duration
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }
  
  /**
   * Register a game type
   */
  registerGameType(gameType) {
    const { id, name, minPlayers, maxPlayers, createInstance } = gameType;
    
    if (!id || !createInstance) {
      throw new Error('Game type must have id and createInstance');
    }
    
    this.gameTypes.set(id, {
      id,
      name: name || id,
      minPlayers: minPlayers || 2,
      maxPlayers: maxPlayers || 20,
      createInstance
    });
    
    logInfo('Game type registered', { id, name });
  }
  
  /**
   * Start game selection phase for a room
   */
  async startGameSelection(roomId, roomCode, players, io) {
    try {
      // Check if room already has an active game
      if (this.roomGames.has(roomId)) {
        const existingGame = this.roomGames.get(roomId);
        if (existingGame.state !== 'ended') {
          throw new Error('Room already has an active game');
        }
      }
      
      // Create selection session
      const selectionId = uuidv4();
      const selection = {
        id: selectionId,
        roomId,
        roomCode,
        players,
        votes: new Map(),
        hostId: players.find(p => p.isHost)?.id,
        startedAt: Date.now(),
        state: 'voting'
      };
      
      // Store selection
      await cacheService.set(`selection:${selectionId}`, selection, 60);
      
      // Emit available games to room
      const availableGames = this.getAvailableGames(players.length);
      io.to(roomCode).emit('gameSelectionStarted', {
        games: availableGames,
        votingTimeout: this.settings.voteTimeout,
        isHost: selection.hostId
      });
      
      // Set voting timeout
      setTimeout(() => {
        this.endGameSelection(selectionId, roomCode, io);
      }, this.settings.voteTimeout);
      
      return selection;
    } catch (error) {
      logError(error, { roomId, roomCode });
      throw error;
    }
  }
  
  /**
   * Handle game vote
   */
  async handleGameVote(selectionId, playerId, gameTypeId) {
    try {
      const selection = await cacheService.get(`selection:${selectionId}`);
      if (!selection || selection.state !== 'voting') {
        throw new Error('Invalid or expired selection session');
      }
      
      // Update vote
      selection.votes.set(playerId, gameTypeId);
      await cacheService.set(`selection:${selectionId}`, selection, 60);
      
      // Calculate vote counts
      const voteCounts = new Map();
      for (const gameId of selection.votes.values()) {
        voteCounts.set(gameId, (voteCounts.get(gameId) || 0) + 1);
      }
      
      return {
        votes: Object.fromEntries(voteCounts),
        totalVotes: selection.votes.size,
        totalPlayers: selection.players.length
      };
    } catch (error) {
      logError(error, { selectionId, playerId, gameTypeId });
      throw error;
    }
  }
  
  /**
   * End game selection and determine winner
   */
  async endGameSelection(selectionId, roomCode, io) {
    try {
      const selection = await cacheService.get(`selection:${selectionId}`);
      if (!selection || selection.state !== 'voting') {
        return;
      }
      
      selection.state = 'ended';
      
      // Count votes
      const voteCounts = new Map();
      for (const gameId of selection.votes.values()) {
        voteCounts.set(gameId, (voteCounts.get(gameId) || 0) + 1);
      }
      
      // Determine winner (most votes, or host's choice if tie)
      let winnerId = null;
      let maxVotes = 0;
      
      for (const [gameId, votes] of voteCounts) {
        if (votes > maxVotes) {
          winnerId = gameId;
          maxVotes = votes;
        }
      }
      
      // If no votes or tie, let host decide or pick random
      if (!winnerId) {
        const availableGames = this.getAvailableGames(selection.players.length);
        winnerId = availableGames[0]?.id;
      }
      
      if (winnerId) {
        // Start countdown
        io.to(roomCode).emit('gameSelected', {
          gameId: winnerId,
          countdown: this.settings.startDelay / 1000
        });
        
        // Start game after countdown
        setTimeout(() => {
          this.createGame(
            winnerId,
            selection.roomId,
            selection.roomCode,
            selection.players,
            io
          );
        }, this.settings.startDelay);
      }
      
      // Clean up selection
      await cacheService.delete(`selection:${selectionId}`);
    } catch (error) {
      logError(error, { selectionId });
    }
  }
  
  /**
   * Create and start a game
   */
  async createGame(gameTypeId, roomId, roomCode, players, io) {
    try {
      const gameType = this.gameTypes.get(gameTypeId);
      if (!gameType) {
        throw new Error(`Unknown game type: ${gameTypeId}`);
      }
      
      // Check player count
      if (players.length < gameType.minPlayers || players.length > gameType.maxPlayers) {
        throw new Error(`Invalid player count for game ${gameTypeId}`);
      }
      
      // Create game instance
      const gameId = uuidv4();
      const gameInstance = gameType.createInstance(gameId, players);
      
      // Set up game state
      const game = {
        id: gameId,
        type: gameTypeId,
        roomId,
        roomCode,
        instance: gameInstance,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          connected: true,
          ready: false,
          score: 0
        })),
        state: 'starting',
        startedAt: Date.now(),
        lastActivity: Date.now()
      };
      
      // Store game
      this.games.set(gameId, game);
      this.roomGames.set(roomId, game);
      
      // Track players in game
      for (const player of players) {
        this.playerGames.set(player.id, gameId);
      }
      
      // Set up game instance callbacks
      gameInstance.on('stateUpdate', (state) => {
        this.handleGameStateUpdate(gameId, state, io);
      });
      
      gameInstance.on('gameEnd', (result) => {
        this.handleGameEnd(gameId, result, io);
      });
      
      gameInstance.on('playerAction', (playerId, action) => {
        this.handlePlayerAction(gameId, playerId, action, io);
      });
      
      // Start the game
      game.state = 'active';
      gameInstance.start();
      
      // Emit game started event
      io.to(roomCode).emit('gameStarted', {
        gameId,
        type: gameTypeId,
        players: game.players,
        initialState: gameInstance.getState()
      });
      
      // Cache game state
      await this.saveGameState(game);
      
      logInfo('Game created and started', { gameId, type: gameTypeId, roomId });
      
      return game;
    } catch (error) {
      logError(error, { gameTypeId, roomId });
      throw error;
    }
  }
  
  /**
   * Handle game state update
   */
  async handleGameStateUpdate(gameId, state, io) {
    try {
      const game = this.games.get(gameId);
      if (!game) return;
      
      game.lastActivity = Date.now();
      
      // Emit state update to room
      io.to(game.roomCode).emit('gameStateUpdate', {
        gameId,
        state,
        timestamp: Date.now()
      });
      
      // Save state
      await this.saveGameState(game);
    } catch (error) {
      logError(error, { gameId });
    }
  }
  
  /**
   * Handle game end
   */
  async handleGameEnd(gameId, result, io) {
    try {
      const game = this.games.get(gameId);
      if (!game) return;
      
      game.state = 'ended';
      game.endedAt = Date.now();
      game.result = result;
      
      // Calculate final scores and rankings
      const rankings = this.calculateRankings(game, result);
      
      // Emit game ended event
      io.to(game.roomCode).emit('gameEnded', {
        gameId,
        result,
        rankings,
        duration: game.endedAt - game.startedAt
      });
      
      // Clean up
      this.roomGames.delete(game.roomId);
      for (const player of game.players) {
        this.playerGames.delete(player.id);
      }
      
      // Archive game state
      await cacheService.set(`game:archive:${gameId}`, game, 3600);
      
      // Remove from active games
      this.games.delete(gameId);
      
      logInfo('Game ended', { gameId, duration: game.endedAt - game.startedAt });
    } catch (error) {
      logError(error, { gameId });
    }
  }
  
  /**
   * Handle player action in game
   */
  async handlePlayerAction(gameId, playerId, action, io) {
    try {
      const game = this.games.get(gameId);
      if (!game || game.state !== 'active') {
        throw new Error('Game not found or not active');
      }
      
      // Update last activity
      game.lastActivity = Date.now();
      
      // Forward action to game instance
      const result = await game.instance.handleAction(playerId, action);
      
      if (result) {
        // Emit action result
        io.to(game.roomCode).emit('gameActionResult', {
          gameId,
          playerId,
          action,
          result,
          timestamp: Date.now()
        });
      }
      
      // Save state
      await this.saveGameState(game);
    } catch (error) {
      logError(error, { gameId, playerId, action });
      throw error;
    }
  }
  
  /**
   * Handle player disconnect
   */
  async handlePlayerDisconnect(playerId, socketId) {
    try {
      const gameId = this.playerGames.get(playerId);
      if (!gameId) return;
      
      const game = this.games.get(gameId);
      if (!game) return;
      
      // Mark player as disconnected
      const player = game.players.find(p => p.id === playerId);
      if (player) {
        player.connected = false;
        player.disconnectedAt = Date.now();
      }
      
      // Notify game instance
      if (game.instance.handlePlayerDisconnect) {
        game.instance.handlePlayerDisconnect(playerId);
      }
      
      // Save state
      await this.saveGameState(game);
      
      logInfo('Player disconnected from game', { playerId, gameId });
    } catch (error) {
      logError(error, { playerId });
    }
  }
  
  /**
   * Handle player reconnect
   */
  async handlePlayerReconnect(playerId, socketId, io) {
    try {
      const gameId = this.playerGames.get(playerId);
      if (!gameId) return null;
      
      const game = this.games.get(gameId);
      if (!game) return null;
      
      // Mark player as reconnected
      const player = game.players.find(p => p.id === playerId);
      if (player) {
        player.connected = true;
        delete player.disconnectedAt;
      }
      
      // Notify game instance
      if (game.instance.handlePlayerReconnect) {
        game.instance.handlePlayerReconnect(playerId);
      }
      
      // Send current game state to reconnected player
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('gameReconnected', {
          gameId,
          type: game.type,
          state: game.instance.getState(),
          players: game.players
        });
      }
      
      // Save state
      await this.saveGameState(game);
      
      logInfo('Player reconnected to game', { playerId, gameId });
      
      return game;
    } catch (error) {
      logError(error, { playerId });
      return null;
    }
  }
  
  /**
   * Get available games for player count
   */
  getAvailableGames(playerCount) {
    const available = [];
    
    for (const [id, gameType] of this.gameTypes) {
      if (playerCount >= gameType.minPlayers && playerCount <= gameType.maxPlayers) {
        available.push({
          id,
          name: gameType.name,
          minPlayers: gameType.minPlayers,
          maxPlayers: gameType.maxPlayers
        });
      }
    }
    
    return available;
  }
  
  /**
   * Calculate rankings from game result
   */
  calculateRankings(game, result) {
    const rankings = [];
    
    // Combine game players with result scores
    for (const player of game.players) {
      const score = result.scores?.[player.id] || player.score || 0;
      rankings.push({
        playerId: player.id,
        nickname: player.nickname,
        score,
        rank: 0
      });
    }
    
    // Sort by score (descending)
    rankings.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    let currentRank = 1;
    for (let i = 0; i < rankings.length; i++) {
      if (i > 0 && rankings[i].score < rankings[i - 1].score) {
        currentRank = i + 1;
      }
      rankings[i].rank = currentRank;
    }
    
    return rankings;
  }
  
  /**
   * Save game state to cache
   */
  async saveGameState(game) {
    try {
      // Don't save the instance itself, just the state
      const stateToSave = {
        ...game,
        instance: undefined,
        instanceState: game.instance.getState()
      };
      
      await cacheService.set(`game:${game.id}`, stateToSave, 3600);
    } catch (error) {
      logError(error, { gameId: game.id });
    }
  }
  
  /**
   * Load game state from cache
   */
  async loadGameState(gameId) {
    try {
      return await cacheService.get(`game:${gameId}`);
    } catch (error) {
      logError(error, { gameId });
      return null;
    }
  }
  
  /**
   * Clean up idle and expired games
   */
  async cleanupGames() {
    try {
      const now = Date.now();
      const toRemove = [];
      
      for (const [gameId, game] of this.games) {
        // Check for idle timeout
        if (now - game.lastActivity > this.settings.idleTimeout) {
          toRemove.push(gameId);
          logInfo('Removing idle game', { gameId, idle: now - game.lastActivity });
        }
        
        // Check for max duration
        if (now - game.startedAt > this.settings.maxGameDuration) {
          toRemove.push(gameId);
          logInfo('Removing expired game', { gameId, duration: now - game.startedAt });
        }
        
        // Check for all players disconnected
        const allDisconnected = game.players.every(p => !p.connected);
        if (allDisconnected && now - game.lastActivity > this.settings.reconnectTimeout) {
          toRemove.push(gameId);
          logInfo('Removing abandoned game', { gameId });
        }
      }
      
      // Remove games
      for (const gameId of toRemove) {
        const game = this.games.get(gameId);
        if (game) {
          // Clean up game instance
          if (game.instance && game.instance.cleanup) {
            game.instance.cleanup();
          }
          
          // Remove from maps
          this.games.delete(gameId);
          this.roomGames.delete(game.roomId);
          for (const player of game.players) {
            this.playerGames.delete(player.id);
          }
          
          // Remove from cache
          await cacheService.delete(`game:${gameId}`);
        }
      }
      
      if (toRemove.length > 0) {
        logInfo('Cleaned up games', { count: toRemove.length });
      }
    } catch (error) {
      logError(error);
    }
  }
  
  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupGames();
    }, 60000); // Run every minute
  }
  
  /**
   * Get game stats
   */
  getStats() {
    return {
      activeGames: this.games.size,
      gameTypes: this.gameTypes.size,
      playersInGames: this.playerGames.size,
      roomsWithGames: this.roomGames.size
    };
  }
}

// Export singleton instance
export default new GameManager();