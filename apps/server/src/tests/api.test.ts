import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { prisma } from '../prisma/client';

describe('API Tests', () => {
  let userId: string;
  let roomId: string;

  beforeAll(async () => {
    // Clean database
    await prisma.gameRound.deleteMany();
    await prisma.confession.deleteMany();
    await prisma.user.deleteMany();
    await prisma.room.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User API', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ nickname: 'testuser' })
        .expect(201);

      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.nickname).toBe('testuser');
      userId = response.body.user.id;
    });

    it('should not create duplicate nickname', async () => {
      await request(app)
        .post('/api/users')
        .send({ nickname: 'testuser' })
        .expect(409);
    });

    it('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .expect(200);

      expect(response.body.user.id).toBe(userId);
    });
  });

  describe('Room API', () => {
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .send({ name: 'Test Room' })
        .expect(201);

      expect(response.body.room).toHaveProperty('id');
      expect(response.body.room.name).toBe('Test Room');
      roomId = response.body.room.id;
    });

    it('should get all rooms', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(Array.isArray(response.body.rooms)).toBe(true);
      expect(response.body.rooms.length).toBeGreaterThan(0);
    });

    it('should allow user to join room', async () => {
      const response = await request(app)
        .post(`/api/users/${userId}/join-room`)
        .send({ roomId })
        .expect(200);

      expect(response.body.user.roomId).toBe(roomId);
    });
  });

  describe('Confession API', () => {
    it('should create a confession', async () => {
      const response = await request(app)
        .post('/api/confessions')
        .send({
          userId,
          content: 'This is my test confession for the game',
        })
        .expect(201);

      expect(response.body.confession).toHaveProperty('id');
      expect(response.body.confession.isRevealed).toBe(false);
    });

    it('should not allow duplicate confession', async () => {
      await request(app)
        .post('/api/confessions')
        .send({
          userId,
          content: 'Another confession',
        })
        .expect(409);
    });

    it('should get confession by user ID', async () => {
      const response = await request(app)
        .get(`/api/confessions/user/${userId}`)
        .expect(200);

      expect(response.body.confession.userId).toBe(userId);
    });
  });
});