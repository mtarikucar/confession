import { Confession } from '@prisma/client';
import { prisma } from '../../prisma/client';

export class ConfessionRepository {
  async create(userId: string, content: string): Promise<Confession> {
    return prisma.confession.create({
      data: {
        userId,
        content,
      },
    });
  }

  async findByUserId(userId: string): Promise<Confession | null> {
    return prisma.confession.findUnique({
      where: { userId },
    });
  }

  async reveal(id: string): Promise<Confession> {
    return prisma.confession.update({
      where: { id },
      data: { isRevealed: true },
    });
  }

  async findById(id: string): Promise<Confession | null> {
    return prisma.confession.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.confession.delete({
      where: { userId },
    });
  }
}