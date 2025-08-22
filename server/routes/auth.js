import express from 'express';
import prisma from '../config/database.js';
import { sessionStore } from '../config/redis.js';
import { 
  hashPassword, 
  comparePassword, 
  generateTokenPair,
  generateSessionToken,
  verifyToken,
  generateUniqueUsername,
  isValidEmail
} from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { userValidation, validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logInfo } from '../config/logger.js';

const router = express.Router();

// Register
router.post('/register', 
  userValidation.register,
  validate,
  asyncHandler(async (req, res) => {
    const { email, username, password, nickname } = req.body;

    // Check if user exists
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username }
      });
      
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username: username || generateUniqueUsername(),
        password: hashedPassword,
        nickname: nickname || username || 'Anonymous',
        provider: 'LOCAL'
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user.id);

    // Save refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    // Create session
    const sessionToken = generateSessionToken();
    const session = {
      userId: user.id,
      token: sessionToken,
      createdAt: new Date()
    };
    
    await sessionStore.set(sessionToken, session);

    // Create session record in database
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    logInfo('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nickname: user.nickname
      },
      tokens: {
        accessToken,
        refreshToken,
        sessionToken
      }
    });
  })
);

// Login
router.post('/login',
  userValidation.login,
  validate,
  asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { username: username || undefined }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user.id);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLoginAt: new Date()
      }
    });

    // Create session
    const sessionToken = generateSessionToken();
    const session = {
      userId: user.id,
      token: sessionToken,
      createdAt: new Date()
    };
    
    await sessionStore.set(sessionToken, session);

    // Create session record in database
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    logInfo('User logged in', { userId: user.id });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nickname: user.nickname
      },
      tokens: {
        accessToken,
        refreshToken,
        sessionToken
      }
    });
  })
);

// Guest login (anonymous)
router.post('/guest',
  asyncHandler(async (req, res) => {
    const { nickname } = req.body;

    // Create guest user
    const user = await prisma.user.create({
      data: {
        nickname: nickname || `Guest${Math.floor(Math.random() * 9999)}`,
        username: generateUniqueUsername(),
        provider: 'LOCAL'
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user.id);

    // Create session
    const sessionToken = generateSessionToken();
    const session = {
      userId: user.id,
      token: sessionToken,
      isGuest: true,
      createdAt: new Date()
    };
    
    await sessionStore.set(sessionToken, session);

    logInfo('Guest user created', { userId: user.id });

    res.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        isGuest: true
      },
      tokens: {
        accessToken,
        sessionToken
      }
    });
  })
);

// Refresh token
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
      // Verify refresh token
      const decoded = verifyToken(refreshToken, true);

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user.id);

      // Update refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken }
      });

      res.json({
        success: true,
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  })
);

// Logout
router.post('/logout',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessionToken = req.headers['x-session-token'];

    // Clear refresh token
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });

    // Delete session from Redis
    if (sessionToken) {
      await sessionStore.delete(sessionToken);
    }

    // Mark database sessions as inactive
    await prisma.session.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    logInfo('User logged out', { userId });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

// Get current user
router.get('/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            gameStats: true,
            achievements: true,
            friends: true
          }
        }
      }
    });

    // Get stats
    const stats = await prisma.gameStat.aggregate({
      where: { userId: req.user.id },
      _sum: {
        wins: true,
        losses: true,
        score: true
      }
    });

    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          totalGames: user._count.gameStats,
          wins: stats._sum.wins || 0,
          losses: stats._sum.losses || 0,
          totalScore: stats._sum.score || 0,
          achievements: user._count.achievements,
          friends: user._count.friends
        }
      }
    });
  })
);

// Update profile
router.patch('/profile',
  authenticateToken,
  userValidation.updateProfile,
  validate,
  asyncHandler(async (req, res) => {
    const { nickname, bio, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(nickname && { nickname }),
        ...(bio !== undefined && { bio }),
        ...(avatar !== undefined && { avatar })
      }
    });

    logInfo('Profile updated', { userId: user.id });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nickname: user.nickname,
        bio: user.bio,
        avatar: user.avatar
      }
    });
  })
);

// Change password
router.post('/change-password',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Check current password
    const validPassword = await comparePassword(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    logInfo('Password changed', { userId: user.id });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// Delete account
router.delete('/account',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Soft delete user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: null,
        username: `deleted_${userId}`,
        password: null,
        refreshToken: null
      }
    });

    // Delete all sessions
    await prisma.session.deleteMany({
      where: { userId }
    });

    logInfo('Account deleted', { userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);

export default router;