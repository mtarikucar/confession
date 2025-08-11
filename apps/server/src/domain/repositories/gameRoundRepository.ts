import { GameRound, GameStatus } from '@prisma/client';
import { prisma } from '../../prisma/client';

export class GameRoundRepository {
  async create(data: {
    roomId: string;
    player1Id: string;
    player2Id: string;
    gameId: string;
  }): Promise<GameRound> {
    return prisma.gameRound.create({
      data: {
        ...data,
        status: 'pending',
        startedAt: new Date(),
      },
      include: {
        player1: true,
        player2: true,
      },
    });
  }

  async findById(id: string): Promise<GameRound | null> {
    return prisma.gameRound.findUnique({
      where: { id },
      include: {
        player1: { include: { confession: true } },
        player2: { include: { confession: true } },
        winner: true,
        revealedConfession: { include: { user: true } },
      },
    });
  }

  async findActiveByRoom(roomId: string): Promise<GameRound | null> {
    return prisma.gameRound.findFirst({
      where: {
        roomId,
        status: 'in_progress',
      },
      include: {
        player1: true,
        player2: true,
      },
    });
  }

  async updateStatus(id: string, status: GameStatus): Promise<GameRound> {
    const data: any = { status };
    if (status === 'completed' || status === 'cancelled') {
      data.completedAt = new Date();
    }
    if (status === 'in_progress') {
      data.startedAt = new Date();
    }
    
    return prisma.gameRound.update({
      where: { id },
      data,
    });
  }

  async completeRound(
    id: string,
    winnerId: string | null,
    revealedConfessionId: string | null,
    metadata?: any
  ): Promise<GameRound> {
    return prisma.gameRound.update({
      where: { id },
      data: {
        status: 'completed',
        winnerId,
        revealedConfessionId,
        metadata,
        completedAt: new Date(),
      },
      include: {
        winner: true,
        revealedConfession: { include: { user: true } },
      },
    });
  }

  async findByRoom(roomId: string, limit: number = 10): Promise<GameRound[]> {
    return prisma.gameRound.findMany({
      where: { roomId },
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}