import { z } from 'zod';

// Validation schemas
export const nicknameSchema = z
  .string()
  .min(3, 'Nickname must be at least 3 characters')
  .max(20, 'Nickname must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Nickname can only contain letters, numbers, and underscores');

export const confessionSchema = z
  .string()
  .min(10, 'Confession must be at least 10 characters')
  .max(500, 'Confession must be at most 500 characters');

export const roomNameSchema = z
  .string()
  .min(3, 'Room name must be at least 3 characters')
  .max(50, 'Room name must be at most 50 characters');

export const chatMessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(200, 'Message must be at most 200 characters');

// API request schemas
export const createUserSchema = z.object({
  nickname: nicknameSchema,
});

export const createRoomSchema = z.object({
  name: roomNameSchema,
});

export const createConfessionSchema = z.object({
  userId: z.string().uuid(),
  content: confessionSchema,
});

// Socket event schemas
export const joinRoomSchema = z.object({
  userId: z.string().uuid(),
  roomId: z.string().uuid(),
});

export const leaveRoomSchema = z.object({
  userId: z.string().uuid(),
  roomId: z.string().uuid(),
});

export const sendConfessionSchema = z.object({
  userId: z.string().uuid(),
  content: confessionSchema,
});

export const startGameSchema = z.object({
  roomId: z.string().uuid(),
  gameId: z.string().optional(),
});

export const playMoveSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  move: z.any(),
});

export const chatMessagePayloadSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  text: chatMessageSchema,
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateConfessionInput = z.infer<typeof createConfessionSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type LeaveRoomInput = z.infer<typeof leaveRoomSchema>;
export type SendConfessionInput = z.infer<typeof sendConfessionSchema>;
export type StartGameInput = z.infer<typeof startGameSchema>;
export type PlayMoveInput = z.infer<typeof playMoveSchema>;
export type ChatMessageInput = z.infer<typeof chatMessagePayloadSchema>;