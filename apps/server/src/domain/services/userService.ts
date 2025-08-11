import { User } from '@prisma/client';
import { UserRepository } from '../repositories/userRepository';
import { nicknameSchema } from '@confess-and-play/shared';
import { AppError } from '../../utils/errors';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(nickname: string): Promise<User> {
    // Validate nickname
    const validationResult = nicknameSchema.safeParse(nickname);
    if (!validationResult.success) {
      throw new AppError('Invalid nickname', 400, 'INVALID_NICKNAME');
    }

    // Check if nickname already exists
    const existingUser = await this.userRepository.findByNickname(nickname);
    if (existingUser) {
      throw new AppError('Nickname already taken', 409, 'NICKNAME_TAKEN');
    }

    return this.userRepository.create(nickname);
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  async joinRoom(userId: string, roomId: string): Promise<User> {
    const user = await this.getUser(userId);
    return this.userRepository.updateRoom(userId, roomId);
  }

  async leaveRoom(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    return this.userRepository.updateRoom(userId, null);
  }

  async getUsersInRoom(roomId: string): Promise<User[]> {
    return this.userRepository.findByRoom(roomId);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}