import { User } from '@prisma/client';
import { prisma } from '../../prisma/client';

export class UserRepository {
  async create(nickname: string): Promise<User> {
    return prisma.user.create({
      data: {
        nickname: nickname.toLowerCase(),
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        room: true,
        confession: true,
      },
    });
  }

  async findByNickname(nickname: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { nickname: nickname.toLowerCase() },
    });
  }

  async updateRoom(userId: string, roomId: string | null): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { roomId },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  async findByRoom(roomId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { roomId },
      include: {
        confession: true,
      },
    });
  }
}