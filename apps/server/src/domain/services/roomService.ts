import { Room } from '@prisma/client';
import { RoomRepository } from '../repositories/roomRepository';
import { roomNameSchema } from '@confess-and-play/shared';
import { AppError } from '../../utils/errors';
import { config } from '../../config';

export class RoomService {
  private roomRepository: RoomRepository;

  constructor() {
    this.roomRepository = new RoomRepository();
  }

  async createRoom(name: string): Promise<Room> {
    // Validate room name
    const validationResult = roomNameSchema.safeParse(name);
    if (!validationResult.success) {
      throw new AppError('Invalid room name', 400, 'INVALID_ROOM_NAME');
    }

    return this.roomRepository.create(name);
  }

  async getRoom(id: string): Promise<Room> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }
    return room;
  }

  async getAllRooms(): Promise<Room[]> {
    return this.roomRepository.findAll();
  }

  async updateRoom(id: string, name: string): Promise<Room> {
    // Validate room name
    const validationResult = roomNameSchema.safeParse(name);
    if (!validationResult.success) {
      throw new AppError('Invalid room name', 400, 'INVALID_ROOM_NAME');
    }

    const room = await this.getRoom(id);
    return this.roomRepository.update(id, name);
  }

  async deleteRoom(id: string): Promise<void> {
    await this.getRoom(id);
    await this.roomRepository.delete(id);
  }

  async cleanupEmptyRooms(): Promise<number> {
    const emptyRooms = await this.roomRepository.findEmptyRooms(config.ROOM_EMPTY_TTL_MS);
    
    for (const room of emptyRooms) {
      await this.roomRepository.delete(room.id);
    }
    
    return emptyRooms.length;
  }
}