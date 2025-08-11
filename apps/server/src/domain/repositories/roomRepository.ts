import { Room } from '@prisma/client';
import { prisma } from '../../prisma/client';

export class RoomRepository {
  async create(name: string): Promise<Room> {
    return prisma.room.create({
      data: { name },
    });
  }

  async findById(id: string): Promise<Room | null> {
    return prisma.room.findUnique({
      where: { id },
      include: {
        users: true,
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findAll(): Promise<Room[]> {
    return prisma.room.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, name: string): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data: { name },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.room.delete({
      where: { id },
    });
  }

  async findEmptyRooms(ttlMs: number): Promise<Room[]> {
    const cutoffTime = new Date(Date.now() - ttlMs);
    return prisma.room.findMany({
      where: {
        users: {
          none: {},
        },
        createdAt: {
          lt: cutoffTime,
        },
      },
    });
  }
}