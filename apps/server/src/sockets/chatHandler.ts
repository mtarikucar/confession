import { Server, Socket } from 'socket.io';
import { SocketManager } from './socketManager';
import { chatMessageSchema, SOCKET_EVENTS, ERROR_CODES } from '@confess-and-play/shared';
import { filterProfanity } from '../utils/profanityFilter';

const socketManager = SocketManager.getInstance();

// Simple rate limiter for chat messages
const messageRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userMessages = messageRateLimit.get(userId) || [];
  
  // Filter out old messages
  const recentMessages = userMessages.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentMessages.length >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }
  
  recentMessages.push(now);
  messageRateLimit.set(userId, recentMessages);
  return true;
}

export function setupChatHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data: { roomId: string; userId: string; text: string }) => {
    try {
      const { roomId, userId, text } = data;
      
      // Validate message
      const validation = chatMessageSchema.safeParse(text);
      if (!validation.success) {
        throw new Error('Invalid message format');
      }
      
      // Check rate limit
      if (!checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded. Please slow down.');
      }
      
      // Get user info
      const socketUser = socketManager.getUserByUserId(userId);
      if (!socketUser) {
        throw new Error('User not found');
      }
      
      // Filter profanity
      const filteredText = filterProfanity(text);
      
      // Emit message to room
      io.to(roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE_RESPONSE, {
        roomId,
        message: {
          from: userId,
          nickname: socketUser.nickname,
          text: filteredText,
          ts: Date.now(),
          type: 'user',
        },
      });
      
      console.log(`Chat message from ${socketUser.nickname} in room ${roomId}`);
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: error.code || ERROR_CODES.CHAT_MESSAGE_ERROR || ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to send message',
      });
    }
  });
  
  // System message handler (for announcements)
  socket.on('system_message', async (data: { roomId: string; text: string }) => {
    try {
      const { roomId, text } = data;
      
      // Only allow system messages from authorized sources
      // In production, add proper authorization here
      
      io.to(roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE_RESPONSE, {
        roomId,
        message: {
          from: 'system',
          text,
          ts: Date.now(),
          type: 'system',
        },
      });
      
      console.log(`System message sent to room ${roomId}`);
    } catch (error: any) {
      console.error('Error sending system message:', error);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to send system message',
      });
    }
  });
}