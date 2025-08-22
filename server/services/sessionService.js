import prisma from '../config/database.js';
import { sessionStore } from '../config/redis.js';
import { logInfo, logError } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

class SessionService {
  /**
   * Create or update session for socket connection
   */
  async createSocketSession(socketId, userId, metadata = {}) {
    try {
      // Generate session token
      const token = jwt.sign(
        { userId, socketId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Check if user already has an active session
      const existingSession = await prisma.session.findFirst({
        where: {
          userId,
          isActive: true
        }
      });

      let session;
      
      if (existingSession) {
        // Update existing session with new socket ID
        session = await prisma.session.update({
          where: { id: existingSession.id },
          data: {
            socketId,
            token,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
      } else {
        // Create new session
        session = await prisma.session.create({
          data: {
            id: uuidv4(),
            userId,
            socketId,
            token,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            isActive: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
      }

      // Store in Redis for fast access
      await sessionStore.set(socketId, {
        sessionId: session.id,
        userId,
        token,
        createdAt: session.createdAt
      });

      logInfo('Socket session created', { sessionId: session.id, userId, socketId });

      return session;
    } catch (error) {
      logError(error, { userId, socketId });
      throw error;
    }
  }

  /**
   * Get session by socket ID
   */
  async getSessionBySocketId(socketId) {
    try {
      // Try Redis first
      const cached = await sessionStore.get(socketId);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const session = await prisma.session.findUnique({
        where: { socketId },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true
            }
          }
        }
      });

      if (session && session.isActive) {
        // Cache for next time
        await sessionStore.set(socketId, {
          sessionId: session.id,
          userId: session.userId,
          token: session.token,
          user: session.user
        });

        return session;
      }

      return null;
    } catch (error) {
      logError(error, { socketId });
      return null;
    }
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token) {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true
            }
          }
        }
      });

      if (session && session.isActive && session.expiresAt > new Date()) {
        return session;
      }

      return null;
    } catch (error) {
      logError(error, { token });
      return null;
    }
  }

  /**
   * Update socket ID for reconnection
   */
  async updateSocketId(sessionId, newSocketId) {
    try {
      const session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          socketId: newSocketId,
          updatedAt: new Date()
        }
      });

      // Update Redis
      await sessionStore.delete(session.socketId);
      await sessionStore.set(newSocketId, {
        sessionId: session.id,
        userId: session.userId,
        token: session.token
      });

      logInfo('Socket ID updated', { sessionId, newSocketId });

      return session;
    } catch (error) {
      logError(error, { sessionId, newSocketId });
      return null;
    }
  }

  /**
   * Handle socket disconnection
   */
  async handleDisconnect(socketId) {
    try {
      // Don't immediately deactivate - allow for reconnection
      const session = await prisma.session.findUnique({
        where: { socketId }
      });

      if (session) {
        // Just update the timestamp, don't deactivate
        await prisma.session.update({
          where: { id: session.id },
          data: {
            updatedAt: new Date()
          }
        });

        // Keep in Redis for potential reconnection
        await sessionStore.touch(socketId);

        logInfo('Socket disconnected, session preserved', { sessionId: session.id, socketId });
      }

      return true;
    } catch (error) {
      logError(error, { socketId });
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await prisma.session.updateMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              isActive: true,
              updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          ]
        },
        data: {
          isActive: false
        }
      });

      if (result.count > 0) {
        logInfo('Expired sessions cleaned up', { count: result.count });
      }

      return result.count;
    } catch (error) {
      logError(error);
      return 0;
    }
  }

  /**
   * Create guest user for anonymous players
   */
  async createGuestUser(nickname, socketId) {
    try {
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          nickname: nickname || `Guest_${Math.random().toString(36).substr(2, 6)}`,
          provider: 'LOCAL',
          isActive: true,
          lastLoginAt: new Date()
        }
      });

      // Create session for guest
      const session = await this.createSocketSession(socketId, user.id, {
        ipAddress: 'guest',
        userAgent: 'guest'
      });

      logInfo('Guest user created', { userId: user.id, nickname: user.nickname });

      return {
        user,
        session
      };
    } catch (error) {
      logError(error, { nickname, socketId });
      throw error;
    }
  }

  /**
   * Get or create user for socket connection
   */
  async getOrCreateUserForSocket(socketId, nickname) {
    try {
      // Check if socket already has a session
      const existingSession = await this.getSessionBySocketId(socketId);
      if (existingSession && existingSession.user) {
        return {
          user: existingSession.user,
          session: existingSession,
          isNew: false
        };
      }

      // Create guest user
      const { user, session } = await this.createGuestUser(nickname, socketId);
      
      return {
        user,
        session,
        isNew: true
      };
    } catch (error) {
      logError(error, { socketId, nickname });
      throw error;
    }
  }

  /**
   * Get active users in a room
   */
  async getRoomActiveSessions(roomCode) {
    try {
      const room = await prisma.room.findUnique({
        where: { code: roomCode },
        include: {
          players: {
            where: { leftAt: null },
            include: {
              user: {
                include: {
                  sessions: {
                    where: { isActive: true },
                    select: {
                      socketId: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!room) return [];

      return room.players.map(player => ({
        userId: player.user.id,
        nickname: player.user.nickname,
        socketIds: player.user.sessions.map(s => s.socketId)
      }));
    } catch (error) {
      logError(error, { roomCode });
      return [];
    }
  }
}

export default new SessionService();