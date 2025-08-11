import { GameRound } from '@prisma/client';
import { GameRoundRepository } from '../repositories/gameRoundRepository';
import { ConfessionService } from './confessionService';
import { UserService } from './userService';
import { AppError } from '../../utils/errors';
import { config } from '../../config';

interface GameMove {
  userId: string;
  move: any;
  timestamp: number;
}

export class GameService {
  private gameRoundRepository: GameRoundRepository;
  private confessionService: ConfessionService;
  private userService: UserService;
  private activeMoves: Map<string, GameMove[]> = new Map();

  constructor() {
    this.gameRoundRepository = new GameRoundRepository();
    this.confessionService = new ConfessionService();
    this.userService = new UserService();
  }

  async createGameRound(
    roomId: string,
    player1Id: string,
    player2Id: string,
    gameId: string
  ): Promise<GameRound> {
    // Validate players exist and have confessions
    const [player1, player2] = await Promise.all([
      this.userService.getUser(player1Id),
      this.userService.getUser(player2Id),
    ]);

    const [confession1, confession2] = await Promise.all([
      this.confessionService.getConfessionByUserId(player1Id),
      this.confessionService.getConfessionByUserId(player2Id),
    ]);

    if (!confession1 || !confession2) {
      throw new AppError('Both players must have confessions', 400, 'CONFESSION_REQUIRED');
    }

    // Check if there's already an active game in the room
    const activeGame = await this.gameRoundRepository.findActiveByRoom(roomId);
    if (activeGame) {
      throw new AppError('A game is already in progress', 409, 'GAME_IN_PROGRESS');
    }

    const round = await this.gameRoundRepository.create({
      roomId,
      player1Id,
      player2Id,
      gameId,
    });

    // Start the game
    await this.gameRoundRepository.updateStatus(round.id, 'in_progress');
    
    return round;
  }

  async submitMove(roundId: string, userId: string, move: any): Promise<void> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new AppError('Game round not found', 404, 'ROUND_NOT_FOUND');
    }

    if (round.status !== 'in_progress') {
      throw new AppError('Game is not in progress', 400, 'GAME_NOT_IN_PROGRESS');
    }

    // Validate user is part of the game
    if (userId !== round.player1Id && userId !== round.player2Id) {
      throw new AppError('User is not part of this game', 403, 'NOT_YOUR_GAME');
    }

    // Store the move
    const moves = this.activeMoves.get(roundId) || [];
    
    // Check if user already submitted a move
    if (moves.find(m => m.userId === userId)) {
      throw new AppError('Move already submitted', 409, 'MOVE_ALREADY_SUBMITTED');
    }

    moves.push({ userId, move, timestamp: Date.now() });
    this.activeMoves.set(roundId, moves);

    // If both players have submitted moves, determine winner
    if (moves.length === 2) {
      await this.resolveRound(roundId, moves);
    }
  }

  private async resolveRound(roundId: string, moves: GameMove[]): Promise<void> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) return;

    const winnerId = this.determineWinner(round.gameId, moves);
    
    let revealedConfessionId: string | null = null;
    
    if (winnerId) {
      // Determine loser and reveal their confession
      const loserId = winnerId === round.player1Id ? round.player2Id : round.player1Id;
      const loserConfession = await this.confessionService.getConfessionByUserId(loserId);
      
      if (loserConfession) {
        await this.confessionService.revealConfession(loserConfession.id);
        revealedConfessionId = loserConfession.id;
      }
    }

    // Complete the round
    await this.gameRoundRepository.completeRound(
      roundId,
      winnerId,
      revealedConfessionId,
      { moves }
    );

    // Clean up moves
    this.activeMoves.delete(roundId);
  }

  private determineWinner(gameId: string, moves: GameMove[]): string | null {
    if (gameId === 'rps') {
      return this.determineRPSWinner(moves);
    }
    // Add other game logic here
    return null;
  }

  private determineRPSWinner(moves: GameMove[]): string | null {
    const [move1, move2] = moves;
    const choice1 = move1.move as string;
    const choice2 = move2.move as string;

    if (choice1 === choice2) return null; // Draw

    const winConditions: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };

    if (winConditions[choice1] === choice2) {
      return move1.userId;
    } else {
      return move2.userId;
    }
  }

  async getRoundById(id: string): Promise<GameRound> {
    const round = await this.gameRoundRepository.findById(id);
    if (!round) {
      throw new AppError('Game round not found', 404, 'ROUND_NOT_FOUND');
    }
    return round;
  }

  async getRoomHistory(roomId: string): Promise<GameRound[]> {
    return this.gameRoundRepository.findByRoom(roomId);
  }

  async cancelRound(roundId: string): Promise<void> {
    await this.gameRoundRepository.updateStatus(roundId, 'cancelled');
    this.activeMoves.delete(roundId);
  }
}