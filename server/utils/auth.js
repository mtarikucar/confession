import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

// Password hashing
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// JWT token generation
export const generateToken = (payload, isRefreshToken = false) => {
  const secret = isRefreshToken ? JWT_REFRESH_SECRET : JWT_SECRET;
  const expiresIn = isRefreshToken ? JWT_REFRESH_EXPIRE : JWT_EXPIRE;
  
  return jwt.sign(payload, secret, { expiresIn });
};

export const generateTokenPair = (userId, additionalData = {}) => {
  const payload = { userId, ...additionalData };
  
  return {
    accessToken: generateToken(payload, false),
    refreshToken: generateToken({ userId }, true)
  };
};

// JWT token verification
export const verifyToken = (token, isRefreshToken = false) => {
  const secret = isRefreshToken ? JWT_REFRESH_SECRET : JWT_SECRET;
  
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

// Session token generation
export const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Socket authentication token
export const generateSocketToken = (userId, roomCode) => {
  const payload = {
    userId,
    roomCode,
    type: 'socket',
    timestamp: Date.now()
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const verifySocketToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'socket') {
      throw new Error('Invalid socket token type');
    }
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - decoded.timestamp;
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw new Error('Socket token too old');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid socket token');
  }
};

// Room code generation
export const generateRoomCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return code;
};

// Generate unique username
export const generateUniqueUsername = () => {
  const adjectives = ['Swift', 'Brave', 'Clever', 'Happy', 'Lucky', 'Mighty', 'Noble', 'Quick', 'Sharp', 'Wise'];
  const nouns = ['Eagle', 'Tiger', 'Lion', 'Wolf', 'Bear', 'Falcon', 'Dragon', 'Phoenix', 'Panther', 'Hawk'];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber = Math.floor(Math.random() * 9999);
  
  return `${randomAdjective}${randomNoun}${randomNumber}`;
};

// Validate email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
export const isStrongPassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Sanitize user input
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
};

// Generate OTP for email verification
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash OTP for storage
export const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

// Verify OTP
export const verifyOTP = (inputOTP, hashedOTP) => {
  const hashedInput = hashOTP(inputOTP);
  return hashedInput === hashedOTP;
};