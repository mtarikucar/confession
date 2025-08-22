import { RockPaperScissorsGame } from '../games/rockPaperScissors.js';
import { Racing3DGame } from '../games/racing3D.js';
import { DrawingGuessGame } from '../games/drawingGuess.js';
import { WordBattleGame } from '../games/wordBattle.js';
import gameService from '../services/gameService.js';
import roomService from '../services/roomService.js';
import prisma from '../config/database.js';
import { logInfo, logError } from '../config/logger.js';

const GAMES = {
  'rock-paper-scissors': RockPaperScissorsGame,
  'racing-3d': Racing3DGame,
  'drawing-guess': DrawingGuessGame,
  'word-battle': WordBattleGame
};

// Active game instances (stored in memory for real-time updates)
const activeGames = new Map();

// Helper function to start game
async function startGame(io, roomCode, players) {
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
    
    // Randomly select a game type
    const gameTypes = Object.keys(GAMES);
    const gameType = gameTypes[Math.floor(Math.random() * gameTypes.length)];
    const GameClass = GAMES[gameType];
    
    logInfo('Selected game type', { gameType, GameClass: GameClass?.name, available: gameTypes });
    
    // Create game instance
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
    
    // Setup real-time updates for games that support it
    if (gameType === 'racing-3d' || gameType === 'drawing-guess' || gameType === 'word-battle') {
      gameInstance.onStateUpdate = async (state) => {
        // Update database
        await gameService.updateGameState(gameId, state);
        
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
            logInfo('Starting game after timeout', {
              roomCode,
              playerCount: match.count
            });
            await startGame(io, roomCode, match.players);
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
        
        await startGame(io, roomCode, match.players);
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
        if (callback) callback({ 
          success: false, 
          error: 'Not a participant in this game' 
        });
        return;
      }

      // Get active game instance
      let gameInstance = activeGames.get(currentGame.id);
      
      // If no active instance, try to recreate from database
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
          if (callback) callback({ 
            success: false, 
            error: `Unknown game type: ${gameType}` 
          });
          return;
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
            await gameService.updateGameState(currentGame.id, state);
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
      
      // Record action in database
      await gameService.recordGameAction(
        currentGame.id,
        socket.userId,
        action
      );
      
      // Update game state in database
      const newState = gameInstance.getState();
      await gameService.updateGameState(currentGame.id, newState);
      
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
      
      if (callback) callback({ 
        success: true, 
        result 
      });
    } catch (error) {
      logError(error, { userId: socket.userId, action });
      if (callback) callback({ 
        success: false, 
        error: 'Failed to process game action' 
      });
    }
  });
}