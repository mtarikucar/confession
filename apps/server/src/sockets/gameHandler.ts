import { Server, Socket } from 'socket.io';
import { GameService } from '../domain/services/gameService';
import { UserService } from '../domain/services/userService';
import { ConfessionService } from '../domain/services/confessionService';
import { SocketManager } from './socketManager';
import { SOCKET_EVENTS, ERROR_CODES, GAME_CONFIG } from '@confess-and-play/shared';

const gameService = new GameService();
const userService = new UserService();
const confessionService = new ConfessionService();
const socketManager = SocketManager.getInstance();

export function setupGameHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.START_GAME, async (data: { roomId: string; gameId?: string }) => {
    try {
      const { roomId, gameId = 'rps' } = data;
      
      // Get users in room
      const usersInRoom = await userService.getUsersInRoom(roomId);
      
      // Check minimum players
      if (usersInRoom.length < GAME_CONFIG.MIN_PLAYERS) {
        throw new Error(`Need at least ${GAME_CONFIG.MIN_PLAYERS} players to start`);
      }
      
      // Check all players have confessions
      const playersWithConfessions = usersInRoom.filter(u => u.confession);
      if (playersWithConfessions.length < GAME_CONFIG.MIN_PLAYERS) {
        throw new Error('All players must submit confessions before starting');
      }
      
      // Select two players for the game (can be expanded for more players)
      const [player1, player2] = playersWithConfessions.slice(0, 2);
      
      // Create game round
      const round = await gameService.createGameRound(
        roomId,
        player1.id,
        player2.id,
        gameId
      );
      
      // Get game assets based on gameId
      const assets = gameId === 'rps' 
        ? ['/assets/games/rps/rock.png', '/assets/games/rps/paper.png', '/assets/games/rps/scissors.png']
        : [];
      
      // Emit game started event to room
      io.to(roomId).emit(SOCKET_EVENTS.GAME_STARTED, {
        roomId,
        roundId: round.id,
        gameId,
        players: [
          { id: player1.id, nickname: player1.nickname },
          { id: player2.id, nickname: player2.nickname },
        ],
        assets,
      });
      
      console.log(`Game ${gameId} started in room ${roomId}`);
    } catch (error: any) {
      console.error('Error starting game:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to start game',
      });
    }
  });
  
  socket.on(SOCKET_EVENTS.PLAY_MOVE, async (data: { roundId: string; userId: string; move: any }) => {
    try {
      const { roundId, userId, move } = data;
      
      // Submit move
      await gameService.submitMove(roundId, userId, move);
      
      // Get round details
      const round = await gameService.getRoundById(roundId);
      
      // Notify room about the move
      const socketUser = socketManager.getUserByUserId(userId);
      if (socketUser?.roomId) {
        io.to(socketUser.roomId).emit(SOCKET_EVENTS.ROUND_UPDATE, {
          roundId,
          state: {
            userId,
            moveSubmitted: true,
            waitingFor: round.player1Id === userId ? round.player2Id : round.player1Id,
          },
        });
      }
      
      // Check if round is complete
      if (round.status === 'completed') {
        // Get the revealed confession if any
        let revealedConfession = null;
        if (round.revealedConfessionId && round.revealedConfession) {
          revealedConfession = {
            userId: round.revealedConfession.userId,
            content: round.revealedConfession.content,
            nickname: round.revealedConfession.user?.nickname,
          };
        }
        
        // Emit round result
        if (socketUser?.roomId) {
          io.to(socketUser.roomId).emit(SOCKET_EVENTS.ROUND_RESULT, {
            roundId,
            winnerId: round.winnerId,
            loserId: round.winnerId === round.player1Id ? round.player2Id : round.player1Id,
            isDraw: !round.winnerId,
            revealedConfession,
            metadata: round.metadata,
          });
          
          // If there was a revealed confession, also send it as a chat message
          if (revealedConfession) {
            io.to(socketUser.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE_RESPONSE, {
              roomId: socketUser.roomId,
              message: {
                from: 'system',
                text: `💔 ${revealedConfession.nickname}'s confession: "${revealedConfession.content}"`,
                ts: Date.now(),
                type: 'confession_reveal',
              },
            });
          }
        }
      }
      
      console.log(`User ${userId} played move in round ${roundId}`);
    } catch (error: any) {
      console.error('Error playing move:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to play move',
      });
    }
  });
  
  socket.on('cancel_game', async (data: { roundId: string }) => {
    try {
      const { roundId } = data;
      
      await gameService.cancelRound(roundId);
      
      const socketUser = socketManager.getUser(socket.id);
      if (socketUser?.roomId) {
        io.to(socketUser.roomId).emit('game_cancelled', {
          roundId,
          cancelledBy: socketUser.userId,
        });
      }
      
      console.log(`Game round ${roundId} cancelled`);
    } catch (error: any) {
      console.error('Error cancelling game:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to cancel game',
      });
    }
  });
}