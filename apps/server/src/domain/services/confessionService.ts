import { Confession } from '@prisma/client';
import { ConfessionRepository } from '../repositories/confessionRepository';
import { UserService } from './userService';
import { confessionSchema } from '@confess-and-play/shared';
import { AppError } from '../../utils/errors';
import { filterProfanity } from '../../utils/profanityFilter';

export class ConfessionService {
  private confessionRepository: ConfessionRepository;
  private userService: UserService;

  constructor() {
    this.confessionRepository = new ConfessionRepository();
    this.userService = new UserService();
  }

  async createConfession(userId: string, content: string): Promise<Confession> {
    // Validate user exists
    await this.userService.getUser(userId);

    // Check if user already has a confession
    const existingConfession = await this.confessionRepository.findByUserId(userId);
    if (existingConfession) {
      throw new AppError('User already has a confession', 409, 'CONFESSION_EXISTS');
    }

    // Validate confession content
    const validationResult = confessionSchema.safeParse(content);
    if (!validationResult.success) {
      throw new AppError('Invalid confession content', 400, 'INVALID_CONFESSION');
    }

    // Filter profanity
    const filteredContent = filterProfanity(content);

    return this.confessionRepository.create(userId, filteredContent);
  }

  async getConfessionByUserId(userId: string): Promise<Confession | null> {
    return this.confessionRepository.findByUserId(userId);
  }

  async revealConfession(confessionId: string): Promise<Confession> {
    const confession = await this.confessionRepository.findById(confessionId);
    if (!confession) {
      throw new AppError('Confession not found', 404, 'CONFESSION_NOT_FOUND');
    }

    if (confession.isRevealed) {
      return confession;
    }

    return this.confessionRepository.reveal(confessionId);
  }

  async deleteConfession(userId: string): Promise<void> {
    const confession = await this.confessionRepository.findByUserId(userId);
    if (!confession) {
      throw new AppError('Confession not found', 404, 'CONFESSION_NOT_FOUND');
    }

    await this.confessionRepository.deleteByUserId(userId);
  }
}