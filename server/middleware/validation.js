import { body, param, query, validationResult } from 'express-validator';
import { AppError } from './errorHandler.js';

// Validation result handler
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));
    
    throw new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      errorMessages
    );
  }
  
  next();
};

// User validation rules
export const userValidation = {
  register: [
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-20 characters and contain only letters, numbers, and underscores'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('nickname')
      .isLength({ min: 2, max: 30 })
      .trim()
      .withMessage('Nickname must be 2-30 characters')
  ],
  
  login: [
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 20 })
      .withMessage('Invalid username'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  
  updateProfile: [
    body('nickname')
      .optional()
      .isLength({ min: 2, max: 30 })
      .trim()
      .withMessage('Nickname must be 2-30 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .trim()
      .withMessage('Bio must be less than 500 characters'),
    body('avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL')
  ]
};

// Room validation rules
export const roomValidation = {
  create: [
    body('name')
      .isLength({ min: 3, max: 50 })
      .trim()
      .withMessage('Room name must be 3-50 characters'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .trim()
      .withMessage('Description must be less than 200 characters'),
    body('maxPlayers')
      .optional()
      .isInt({ min: 2, max: 20 })
      .withMessage('Max players must be between 2 and 20'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    body('password')
      .optional()
      .isLength({ min: 4, max: 20 })
      .withMessage('Password must be 4-20 characters')
  ],
  
  join: [
    param('roomCode')
      .isLength({ min: 6, max: 6 })
      .matches(/^[A-Z0-9]+$/)
      .withMessage('Invalid room code'),
    body('password')
      .optional()
      .isLength({ min: 4, max: 20 })
      .withMessage('Invalid password')
  ],
  
  update: [
    param('roomId')
      .isUUID()
      .withMessage('Invalid room ID'),
    body('name')
      .optional()
      .isLength({ min: 3, max: 50 })
      .trim()
      .withMessage('Room name must be 3-50 characters'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .trim()
      .withMessage('Description must be less than 200 characters'),
    body('maxPlayers')
      .optional()
      .isInt({ min: 2, max: 20 })
      .withMessage('Max players must be between 2 and 20')
  ]
};

// Confession validation rules
export const confessionValidation = {
  submit: [
    body('text')
      .isLength({ min: 10, max: 500 })
      .trim()
      .withMessage('Confession must be 10-500 characters')
      .matches(/^[^<>]*$/)
      .withMessage('Confession contains invalid characters'),
    body('roomId')
      .isUUID()
      .withMessage('Invalid room ID')
  ]
};

// Game validation rules
export const gameValidation = {
  action: [
    body('type')
      .notEmpty()
      .withMessage('Action type is required'),
    body('gameId')
      .optional()
      .isUUID()
      .withMessage('Invalid game ID')
  ],
  
  submitWord: [
    body('word')
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ]+$/)
      .withMessage('Invalid word format')
  ],
  
  drawingData: [
    body('data')
      .isArray()
      .withMessage('Drawing data must be an array'),
    body('data.*.x')
      .isNumeric()
      .withMessage('Invalid x coordinate'),
    body('data.*.y')
      .isNumeric()
      .withMessage('Invalid y coordinate')
  ]
};

// Chat validation rules
export const chatValidation = {
  sendMessage: [
    body('text')
      .isLength({ min: 1, max: 500 })
      .trim()
      .withMessage('Message must be 1-500 characters')
      .matches(/^[^<>]*$/)
      .withMessage('Message contains invalid characters'),
    body('roomId')
      .isUUID()
      .withMessage('Invalid room ID')
  ]
};

// Search/Filter validation rules
export const searchValidation = {
  rooms: [
    query('search')
      .optional()
      .isLength({ max: 50 })
      .trim()
      .withMessage('Search query too long'),
    query('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid page number'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  
  leaderboard: [
    query('type')
      .optional()
      .isIn(['global', 'weekly', 'monthly'])
      .withMessage('Invalid leaderboard type'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

// Socket event validation
export const validateSocketEvent = (eventName, rules) => {
  return async (data, callback) => {
    try {
      // Create a mock req object for validation
      const req = {
        body: data,
        params: {},
        query: {}
      };
      
      // Run validation rules
      for (const rule of rules) {
        await rule.run(req);
      }
      
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
          field: error.path,
          message: error.msg
        }));
        
        if (callback) {
          callback({
            success: false,
            error: 'Validation failed',
            details: errorMessages
          });
        }
        
        return false;
      }
      
      return true;
    } catch (error) {
      if (callback) {
        callback({
          success: false,
          error: 'Validation error'
        });
      }
      
      return false;
    }
  };
};

// Sanitization helpers
export const sanitizeHtml = (text) => {
  if (!text) return '';
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
};

export const sanitizeFilename = (filename) => {
  if (!filename) return '';
  
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 255);
};