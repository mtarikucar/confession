import { RockPaperScissorsGame } from '../games/rockPaperScissors.js';
import { DrawingGuessGame } from '../games/drawingGuess.js';
import { WordBattleGame } from '../games/wordBattle.js';
import { TruthOrDareGame } from '../games/truthOrDare.js';
import gameService from '../services/gameService.js';
import gameStateService from '../services/gameStateService.js';
import actionQueueService from '../services/actionQueueService.js';
import roomService from '../services/roomService.js';
import prisma from '../config/database.js';
import { logInfo, logError } from '../config/logger.js';

const GAMES = {
  'rock-paper-scissors': RockPaperScissorsGame,
  'drawing-guess': DrawingGuessGame,
  'word-battle': WordBattleGame,
  'truth-or-dare': TruthOrDareGame
};

// Active game instances (stored in memory for real-time updates)
const activeGames = new Map();

// Helper function to start game
async function startGame(io, roomCode, players, selectedGameType = null) {
  try {
    // Get room details
    const room = await roomService.getRoomByCode(roomCode);
    if (!room) {
      logError(new Error('Room not found'), { roomCode });
      return;
    }

    // Check if there's already a game
    const existingGame = await gameService.getCurrentGameByRoomId(room.id);
    if (existingGame) {
      logInfo('Game already in progress', { roomId: room.id });
      return;
    }
    
    // Use selected game type or default to first available game
    const gameType = selectedGameType || Object.keys(GAMES)[0];
    const GameClass = GAMES[gameType];
    
    if (!GameClass) {
      logError(new Error('Invalid game type'), { gameType, selectedGameType });
      return;
    }
    
    logInfo('Selected game type', { gameType, GameClass: GameClass?.name, available: Object.keys(GAMES) });
    
    // Create game instance (generate temporary ID for game)
    const tempGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[gameHandlers] Creating game instance for:', gameType, 'with players:', players);
    const gameInstance = new GameClass(players);
    
    const initialState = gameInstance.getState();
    
    // Create game in database
    const game = await gameService.createGame(
      room.id,
      gameType,
      players,
      initialState
    );
    
    const gameId = game.id;
    
    // Store active game instance
    activeGames.set(gameId, gameInstance);
    await gameService.storeActiveGameInstance(gameId, gameInstance);
    
    // Persist game state
    await gameStateService.saveGame({
      id: gameId,
      type: gameType,
      roomCode,
      players: players.map(id => ({ id, nickname: '', hasConfession: true })),
      state: initialState,
      confession: null,
      matchedPlayers: [],
      startedAt: Date.now()
    });
    
    // Setup real-time updates for games that support it
    if (gameType === 'drawing-guess' || gameType === 'word-battle' || gameType === 'truth-or-dare') {
      gameInstance.onStateUpdate = async (state) => {
        try {
          // Only update to Redis (single source of truth)
          await gameStateService.updateGame(gameId, { state });
        } catch (error) {
          logError(error, { gameId, gameType, context: 'onStateUpdate' });
          // Don't crash, just log the error
        }
        
        // For DrawingGuess, filter the current word based on who's receiving
        if (gameType === 'drawing-guess') {
          // Send different state to different players
          for (const playerId of players) {
            const playerSockets = await io.in(roomCode).fetchSockets();
            const playerSocket = playerSockets.find(s => s.userId === playerId);
            
            if (playerSocket) {
              const filteredState = {
                ...state,
                currentWord: playerId === state.currentDrawer ? state.currentWord : null
              };
              playerSocket.emit('gameUpdate', {
                game: {
                  id: gameId,
                  type: gameType,
                  players: players,
                  state: filteredState
                }
              });
            }
          }
        } else {
          // For other games, send same state to all
          io.to(roomCode).emit('gameUpdate', {
            game: {
              id: gameId,
              type: gameType,
              players: players,
              state: state
            }
          });
        }
      };
      
      gameInstance.onGameEnd = async (data) => {
        const winner = data.winner;
        const rankings = data.rankings;
        
        // End game in database
        await gameService.endGame(gameId, winner, rankings);
        
        // Handle winner/loser logic for multi-player games
        if (rankings && rankings.length > 0) {
          // Get the last place player
          const lastPlace = rankings[rankings.length - 1];
          const lastPlayerId = lastPlace.playerId;
          
          // Only reveal confession of the last place player
          const confession = await prisma.confession.findFirst({
            where: {
              roomId: room.id,
              userId: lastPlayerId,
              isRevealed: false
            }
          });
          
          if (confession) {
            // Update confession as revealed
            await prisma.confession.update({
              where: { id: confession.id },
              data: {
                isRevealed: true,
                revealedAt: new Date(),
                revealedInGameId: gameId
              }
            });
            
            // Get loser's nickname
            const loserUser = await prisma.user.findUnique({
              where: { id: lastPlayerId },
              select: { nickname: true }
            });
            
            const loserNickname = loserUser?.nickname || 'Unknown';
            
            // Add confession reveal to chat
            const chatMessage = await prisma.chatMessage.create({
              data: {
                roomId: room.id,
                userId: lastPlayerId,
                nickname: loserNickname,
                text: `🏁 Last place! ${loserNickname}'s confession: ${confession.text}`,
                type: 'CONFESSION',
                isSystem: true
              }
            });
            
            io.to(roomCode).emit('confessionRevealed', {
              playerId: lastPlayerId,
              confession: confession.text,
              chatMessage: {
                id: chatMessage.id,
                userId: chatMessage.userId,
                nickname: chatMessage.nickname,
                text: chatMessage.text,
                type: chatMessage.type,
                isSystem: chatMessage.isSystem,
                createdAt: chatMessage.createdAt
              }
            });
          }
        }
        
        // Clean up game instance
        gameInstance.cleanup();
        activeGames.delete(gameId);
        
        // Mark game as ended in Redis
        await gameStateService.updateGame(gameId, {
          state: 'ended',
          endedAt: Date.now(),
          winner,
          rankings
        });
        
        // Get updated room data
        const updatedRoom = await roomService.getRoomById(room.id);
        
        io.to(roomCode).emit('gameEnded', {
          game: {
            id: gameId,
            type: gameType
          },
          winner,
          rankings,
          room: updatedRoom
        });
      };
    }
    
    // Get updated room data with game
    const updatedRoom = await roomService.getRoomById(room.id);
    
    // For DrawingGuess, send different initial state to different players
    if (gameType === 'drawing-guess') {
      for (const playerId of players) {
        const playerSockets = await io.in(roomCode).fetchSockets();
        const playerSocket = playerSockets.find(s => s.userId === playerId);
        
        if (playerSocket) {
          const filteredState = {
            ...initialState,
            currentWord: playerId === initialState.currentDrawer ? initialState.currentWord : null
          };
          
          playerSocket.emit('matchStarted', {
            game: {
              id: gameId,
              type: gameType,
              players: players,
              state: filteredState,
              startedAt: game.startedAt
            },
            room: updatedRoom
          });
        }
      }
    } else {
      // For other games, send same state to all
      io.to(roomCode).emit('matchStarted', {
        game: {
          id: gameId,
          type: gameType,
          players: players,
          state: initialState,
          startedAt: game.startedAt
        },
        room: updatedRoom
      });
    }
    
    logInfo('Game started', {
      gameId,
      roomCode,
      gameType,
      playerCount: players.length
    });
  } catch (error) {
    logError(error, { roomCode, players });
  }
}

export function handleGameEvents(io, socket) {
  // Handle game pool updates (multiple games selection)
  socket.on('updateGamePool', async (data, callback) => {
    try {
      const { roomCode, gamePool } = data;
      
      if (!roomCode || !socket.roomCode) {
        return callback({ 
          success: false, 
          error: 'Not in a room' 
        });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      // Check if user is room host
      // Use creatorId field from room object
      if (room.creatorId !== socket.userId && room.creator?.id !== socket.userId) {
        return callback({ 
          success: false, 
          error: 'Only the room host can update the game pool' 
        });
      }

      // Validate game pool
      if (!Array.isArray(gamePool) || gamePool.length === 0) {
        return callback({ 
          success: false, 
          error: 'At least one game must be selected' 
        });
      }

      // Filter out invalid games (including turbo-racing) instead of throwing error
      const validGamePool = gamePool.filter(gameType => {
        // Specifically exclude turbo-racing and any other invalid games
        if (gameType === 'turbo-racing') {
          logInfo('Filtering out turbo-racing from game pool');
          return false;
        }
        return GAMES[gameType] !== undefined;
      });
      
      // Ensure at least one valid game remains
      if (validGamePool.length === 0) {
        // If no valid games, use defaults
        const defaultGames = ['word-battle', 'drawing-guess', 'rock-paper-scissors', 'truth-or-dare'];
        await roomService.updateRoomSettings(room.id, { gamePool: defaultGames });
        logInfo('No valid games in pool, using defaults', { 
          original: gamePool,
          defaults: defaultGames 
        });
      } else {
        // Update room settings with filtered game pool
        await roomService.updateRoomSettings(room.id, { gamePool: validGamePool });
        
        if (validGamePool.length !== gamePool.length) {
          logInfo('Filtered invalid games from pool', { 
            original: gamePool,
            filtered: validGamePool,
            removed: gamePool.filter(g => !validGamePool.includes(g))
          });
        }
      }
      
      // Notify all players in the room with the filtered pool
      const finalPool = validGamePool.length > 0 ? validGamePool : ['word-battle', 'drawing-guess', 'rock-paper-scissors', 'truth-or-dare'];
      io.to(roomCode).emit('gamePoolUpdated', {
        gamePool: finalPool,
        updatedBy: socket.userId
      });
      
      // Also emit full room update to ensure all clients are synced
      const updatedRoom = await roomService.getRoomByCode(roomCode);
      if (updatedRoom) {
        io.to(roomCode).emit('roomUpdated', { 
          room: updatedRoom 
        });
      }
      
      logInfo('Game pool updated', {
        roomCode,
        gamePool: finalPool,
        updatedBy: socket.userId
      });
      
      callback({ success: true });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to update game pool' 
      });
    }
  });
  
  // Host selects game for the room (legacy - now uses game pool)
  socket.on('selectGame', async (data, callback) => {
    try {
      const { roomCode, gameType } = data;
      
      if (!roomCode || !gameType) {
        return callback({
          success: false,
          error: 'Missing roomCode or gameType'
        });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({
          success: false,
          error: 'Room not found'
        });
      }

      // Check if user is room host/admin
      if (room.creator?.id !== socket.userId) {
        return callback({
          success: false,
          error: 'Only room admin can select games'
        });
      }

      // Validate game type
      if (!GAMES[gameType]) {
        return callback({
          success: false,
          error: 'Invalid game type'
        });
      }

      // Update room's selected game (we'll store this in room settings)
      await roomService.updateRoomSettings(room.id, { selectedGameType: gameType });
      
      // Notify all players about the selected game
      io.to(roomCode).emit('gameSelected', {
        gameType,
        selectedBy: socket.nickname
      });

      callback({ success: true });
    } catch (error) {
      logError(error, { userId: socket.userId, data });
      callback({
        success: false,
        error: 'Failed to select game'
      });
    }
  });

  // Host changes game during gameplay
  socket.on('changeGame', async (data, callback) => {
    try {
      const { roomCode, gameType } = data;
      
      if (!roomCode || !gameType) {
        return callback({
          success: false,
          error: 'Missing roomCode or gameType'
        });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({
          success: false,
          error: 'Room not found'
        });
      }

      // Check if user is room host/admin
      if (room.creator?.id !== socket.userId) {
        return callback({
          success: false,
          error: 'Only room admin can change games'
        });
      }

      // Validate game type
      if (!GAMES[gameType]) {
        return callback({
          success: false,
          error: 'Invalid game type'
        });
      }

      // End current game if any
      const currentGame = await gameService.getCurrentGameByRoomId(room.id);
      if (currentGame) {
        // End the current game
        await gameService.endGame(currentGame.id, null, []);
        
        // Clean up active game instance
        activeGames.delete(currentGame.id);
        
        // Notify players that game was ended
        io.to(roomCode).emit('gameEnded', {
          game: { id: currentGame.id, type: currentGame.type },
          reason: 'changed_by_admin'
        });
      }

      // Update room's selected game
      await roomService.updateRoomSettings(room.id, { selectedGameType: gameType });
      
      // Notify all players about the game change
      io.to(roomCode).emit('gameChanged', {
        gameType,
        changedBy: socket.nickname
      });

      callback({ success: true });
    } catch (error) {
      logError(error, { userId: socket.userId, data });
      callback({
        success: false,
        error: 'Failed to change game'
      });
    }
  });

  // Host starts game directly with all ready players (no matchmaking)
  socket.on('startGameWithPool', async (data, callback) => {
    try {
      const { roomCode } = data;
      logInfo('startGameWithPool requested', { roomCode, socketRoomCode: socket.roomCode, userId: socket.userId });
      
      if (!roomCode) {
        logInfo('No room code provided', { roomCode, socketRoomCode: socket.roomCode });
        if (callback && typeof callback === 'function') {
          return callback({ 
            success: false, 
            error: 'No room code provided' 
          });
        }
        return;
      }
      
      // Set socket.roomCode if not set (happens after reconnection)
      if (!socket.roomCode) {
        socket.roomCode = roomCode;
        socket.join(roomCode);
        logInfo('Set socket.roomCode from request', { roomCode });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        logInfo('Room not found', { roomCode });
        if (callback && typeof callback === 'function') {
          return callback({ 
            success: false, 
            error: 'Room not found' 
          });
        }
        return;
      }

      // Check if user is room host (check both creator.id and creatorId)
      if (room.creator?.id !== socket.userId && room.creatorId !== socket.userId) {
        logInfo('Not room host', { userId: socket.userId, creatorId: room.creatorId });
        if (callback && typeof callback === 'function') {
          return callback({ 
            success: false, 
            error: 'Only the room host can start the game' 
          });
        }
        return;
      }

      // Check if there's already a game in progress
      const currentGame = await gameService.getCurrentGameByRoomId(room.id);
      if (currentGame) {
        logInfo('Game already in progress', { roomId: room.id });
        if (callback && typeof callback === 'function') {
          return callback({ 
            success: false, 
            error: 'Game already in progress' 
          });
        }
        return;
      }

      // Get room settings to check game pool
      let roomSettings = await roomService.getRoomSettings(room.id);
      
      // Filter out turbo-racing and invalid games
      if (roomSettings.gamePool && Array.isArray(roomSettings.gamePool)) {
        const validPool = roomSettings.gamePool.filter(gameType => {
          return gameType !== 'turbo-racing' && GAMES[gameType];
        });
        
        if (validPool.length !== roomSettings.gamePool.length) {
          logInfo('Filtered invalid games from pool before starting', {
            original: roomSettings.gamePool,
            filtered: validPool
          });
          roomSettings.gamePool = validPool;
        }
      }
      
      // If no game pool or empty after filtering, set default
      if (!roomSettings.gamePool || roomSettings.gamePool.length === 0) {
        const defaultGamePool = ['word-battle', 'drawing-guess', 'rock-paper-scissors', 'truth-or-dare'];
        await roomService.updateRoomSettings(room.id, { gamePool: defaultGamePool });
        roomSettings = { ...roomSettings, gamePool: defaultGamePool };
      }

      // Get all players with confessions
      const playersWithConfessions = await prisma.user.findMany({
        where: {
          id: {
            in: await prisma.confession.findMany({
              where: {
                roomId: room.id,
                isRevealed: false
              },
              select: { userId: true }
            }).then(confessions => confessions.map(c => c.userId))
          }
        },
        select: { id: true }
      });

      const playerIds = playersWithConfessions.map(p => p.id);
      
      if (playerIds.length < 2) {
        logInfo('Not enough players', { playerCount: playerIds.length });
        if (callback && typeof callback === 'function') {
          return callback({ 
            success: false, 
            error: 'En az 2 oyuncunun itiraf göndermesi gerekiyor' 
          });
        }
        return;
      }

      // Select random game from pool
      const gamePool = roomSettings.gamePool;
      const randomGameType = gamePool[Math.floor(Math.random() * gamePool.length)];
      
      logInfo('Starting game with pool', {
        roomCode,
        playerCount: playerIds.length,
        selectedGame: randomGameType,
        gamePool
      });

      // Notify all players that game is starting
      io.to(roomCode).emit('gameStarting', {
        gameType: randomGameType,
        playerCount: playerIds.length
      });

      // Start the game with all ready players
      await startGame(io, roomCode, playerIds, randomGameType);
      
      if (callback && typeof callback === 'function') {
        callback({ 
          success: true,
          gameType: randomGameType,
          playerCount: playerIds.length
        });
      }
    } catch (error) {
      logError(error, { userId: socket.userId, error: error.message });
      if (callback && typeof callback === 'function') {
        callback({ 
          success: false, 
          error: 'Failed to start game: ' + error.message 
        });
      }
    }
  });

  socket.on('requestMatch', async (data, callback) => {
    try {
      const { roomCode } = data;
      
      if (!roomCode || !socket.roomCode) {
        return callback({ 
          success: false, 
          error: 'Not in a room' 
        });
      }

      // Get room
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) {
        return callback({ 
          success: false, 
          error: 'Room not found' 
        });
      }

      // Check if user has submitted confession
      const hasConfession = await prisma.confession.findFirst({
        where: {
          roomId: room.id,
          userId: socket.userId,
          isRevealed: false
        }
      });

      if (!hasConfession) {
        return callback({ 
          success: false, 
          error: 'Must submit confession first' 
        });
      }

      // Check if there's already a game in progress
      const currentGame = await gameService.getCurrentGameByRoomId(room.id);
      if (currentGame) {
        return callback({ 
          success: false, 
          error: 'Game already in progress' 
        });
      }

      // Start or update matchmaking timer
      const hasTimer = await gameService.hasMatchmakingTimer(roomCode);
      
      if (!hasTimer) {
        // First player requesting match - start a timer
        logInfo('Starting matchmaking timer', { roomCode });
        
        await gameService.setMatchmakingTimer(roomCode, 5000);
        
        // Set a timeout to start the game after 5 seconds
        setTimeout(async () => {
          const match = await gameService.matchPlayers(room.id);
          const stillNoGame = !(await gameService.getCurrentGameByRoomId(room.id));
          
          if (match && stillNoGame) {
            // Get room settings to check for selected game type
            const roomSettings = await roomService.getRoomSettings(room.id);
            const selectedGameType = roomSettings.selectedGameType;
            
            logInfo('Starting game after timeout', {
              roomCode,
              playerCount: match.count,
              selectedGameType
            });
            await startGame(io, roomCode, match.players, selectedGameType);
          }
          
          await gameService.clearMatchmakingTimer(roomCode);
        }, 5000);
        
        // Notify all players that matchmaking has started
        io.to(roomCode).emit('matchmakingStarted', {
          waitTime: 5,
          currentPlayers: 1
        });
      }

      // Try to match players
      const match = await gameService.matchPlayers(room.id);
      
      // If we have 8 players, start immediately
      if (match && match.count >= 8) {
        logInfo('Starting game immediately with 8 players', { roomCode });
        
        // Clear the timer
        await gameService.clearMatchmakingTimer(roomCode);
        
        // Get room settings to check for selected game type
        const roomSettings = await roomService.getRoomSettings(room.id);
        const selectedGameType = roomSettings.selectedGameType;
        
        await startGame(io, roomCode, match.players, selectedGameType);
        callback({ success: true, matched: true });
        return;
      }
      
      // Otherwise wait for timer or more players
      callback({ 
        success: true, 
        matched: false, 
        waitingForPlayers: true 
      });
    } catch (error) {
      logError(error, { userId: socket.userId });
      callback({ 
        success: false, 
        error: 'Failed to request match' 
      });
    }
  });

  socket.on('gameAction', async (action, callback) => {
    try {
      if (!socket.roomCode) {
        if (callback) callback({ 
          success: false, 
          error: 'Not in a room' 
        });
        return;
      }

      // Get room
      const room = await roomService.getRoomByCode(socket.roomCode);
      if (!room) {
        if (callback) callback({ 
          success: false, 
          error: 'Room not found' 
        });
        return;
      }

      // Get current game
      const currentGame = await gameService.getCurrentGameByRoomId(room.id);
      if (!currentGame) {
        if (callback) callback({ 
          success: false, 
          error: 'No game in progress' 
        });
        return;
      }
      
      // Queue the action for sequential processing
      const queueId = `game:${currentGame.id}`;
      const actionHandler = async () => {
        return processGameAction(io, socket, room, currentGame, action);
      };
      
      try {
        await actionQueueService.enqueue(queueId, {
          type: 'gameAction',
          playerId: socket.userId,
          action
        }, actionHandler);
        
        if (callback) callback({ success: true });
      } catch (queueError) {
        logError(queueError, { gameId: currentGame.id, playerId: socket.userId });
        if (callback) callback({ 
          success: false, 
          error: 'Action queue error' 
        });
      }
    } catch (error) {
      logError(error, { userId: socket.userId, action });
      if (callback) callback({ 
        success: false, 
        error: 'Failed to process game action' 
      });
    }
  });
}

// Extracted game action processing logic
async function processGameAction(io, socket, room, currentGame, action) {
  try {
    // Parse players if it's a string (from JSON field)
    let gamePlayers = currentGame.players;
    if (typeof gamePlayers === 'string') {
      try {
        gamePlayers = JSON.parse(gamePlayers);
      } catch (e) {
        gamePlayers = [];
      }
    }
    
    // Check if player is in the game
    if (!gamePlayers.includes(socket.userId)) {
      throw new Error('Not a participant in this game');
    }

      // Get active game instance
      let gameInstance = activeGames.get(currentGame.id);
      
      // If no active instance, try to restore from Redis first
      if (!gameInstance) {
        const persistedGame = await gameStateService.loadGame(currentGame.id);
        if (persistedGame && persistedGame.state !== 'ended') {
          // Restore game from persisted state
          const gameType = currentGame.type.toLowerCase().replace(/_/g, '-');
          const GameClass = GAMES[gameType];
          
          if (GameClass) {
            gameInstance = new GameClass(gamePlayers);
            // Restore the persisted state
            if (persistedGame.state && typeof gameInstance.restoreState === 'function') {
              gameInstance.restoreState(persistedGame.state);
            }
            activeGames.set(currentGame.id, gameInstance);
          }
        }
      }
      
      // If still no instance, try to recreate from database
      if (!gameInstance) {
        const gameType = currentGame.type.toLowerCase().replace(/_/g, '-');
        
        logInfo('Recreating game instance', {
          gameId: currentGame.id,
          originalType: currentGame.type,
          convertedType: gameType,
          availableGames: Object.keys(GAMES)
        });
        
        const GameClass = GAMES[gameType];
        
        if (!GameClass) {
          logError(new Error('Unknown game type'), {
            gameType,
            availableTypes: Object.keys(GAMES)
          });
          throw new Error(`Unknown game type: ${gameType}`);
        }
        
        gameInstance = new GameClass(gamePlayers);
        
        // Restore state if available
        if (currentGame.state) {
          // Note: This might not fully restore the game state
          // depending on the game implementation
        }
        
        activeGames.set(currentGame.id, gameInstance);
        
        // Setup callbacks for games that need them
        if (gameType === 'drawing-guess' || gameType === 'word-battle') {
          gameInstance.onStateUpdate = async (state) => {
            try {
              await gameStateService.updateGame(currentGame.id, { state });
            } catch (error) {
              logError(error, { gameId: currentGame.id, gameType, context: 'gameAction.onStateUpdate' });
            }
            io.to(socket.roomCode).emit('gameUpdate', {
              game: {
                id: currentGame.id,
                type: gameType,
                players: gamePlayers,
                state: state
              }
            });
          };
        }
      }
      
      // Handle the action
      const result = gameInstance.processAction(socket.userId, action);
      
      logInfo('Game action processed', {
        gameId: currentGame.id,
        playerId: socket.userId,
        action: action,
        result: result
      });
      
      // Record action in database and Redis
      await gameService.recordGameAction(
        currentGame.id,
        socket.userId,
        action
      );
      
      // Add to game history in Redis
      await gameStateService.addGameAction(currentGame.id, {
        type: action.type || 'unknown',
        playerId: socket.userId,
        data: action
      });
      
      // Update game state only in Redis (avoid double update)
      const newState = gameInstance.getState();
      try {
        await gameStateService.updateGame(currentGame.id, { 
          state: newState,
          lastActivity: Date.now() 
        });
      } catch (error) {
        logError(error, { gameId: currentGame.id, context: 'gameAction.stateUpdate' });
      }
      
      // Check if game ended
      if (newState.gameOver) {
        const winner = newState.winner;
        const rankings = newState.rankings || gameInstance.getRankings?.();
        
        await gameService.endGame(currentGame.id, winner, rankings);
        
        // Handle confession reveal for loser
        if (winner && gamePlayers.length === 2) {
          const loserId = gamePlayers.find(p => p !== winner);
          
          const confession = await prisma.confession.findFirst({
            where: {
              roomId: room.id,
              userId: loserId,
              isRevealed: false
            }
          });
          
          if (confession) {
            await prisma.confession.update({
              where: { id: confession.id },
              data: {
                isRevealed: true,
                revealedAt: new Date(),
                revealedInGameId: currentGame.id
              }
            });
            
            const loserUser = await prisma.user.findUnique({
              where: { id: loserId },
              select: { nickname: true }
            });
            
            const chatMessage = await prisma.chatMessage.create({
              data: {
                roomId: room.id,
                userId: loserId,
                nickname: loserUser?.nickname || 'Unknown',
                text: `😭 Lost the game! Confession: ${confession.text}`,
                type: 'CONFESSION',
                isSystem: true
              }
            });
            
            io.to(socket.roomCode).emit('confessionRevealed', {
              playerId: loserId,
              confession: confession.text,
              chatMessage: {
                id: chatMessage.id,
                userId: chatMessage.userId,
                nickname: chatMessage.nickname,
                text: chatMessage.text,
                type: chatMessage.type,
                isSystem: chatMessage.isSystem,
                createdAt: chatMessage.createdAt
              }
            });
          }
        }
        
        // Clean up
        activeGames.delete(currentGame.id);
        
        // Mark as ended in Redis
        await gameStateService.updateGame(currentGame.id, {
          state: 'ended',
          endedAt: Date.now(),
          winner,
          rankings
        });
        
        // Get updated room
        const updatedRoom = await roomService.getRoomById(room.id);
        
        io.to(socket.roomCode).emit('gameEnded', {
          game: {
            id: currentGame.id,
            type: currentGame.type.toLowerCase().replace(/_/g, '-')
          },
          winner,
          rankings,
          room: updatedRoom
        });
      } else {
        // Emit game update
        io.to(socket.roomCode).emit('gameUpdate', {
          game: {
            id: currentGame.id,
            type: currentGame.type.toLowerCase().replace(/_/g, '-'),
            players: gamePlayers,
            state: newState
          }
        });
      }
      
      return { success: true, result };
  } catch (error) {
    logError(error, { 
      gameId: currentGame?.id,
      playerId: socket.userId, 
      action 
    });
    throw error;
  }
}