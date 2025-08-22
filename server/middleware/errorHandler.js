import { logError } from '../config/logger.js';

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper for route handlers
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logError(err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = new AppError(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = `Validation error: ${errors.join(', ')}`;
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Prisma errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0];
    const message = `Duplicate ${field || 'field'} value`;
    error = new AppError(message, 400, 'DUPLICATE_FIELD');
  }

  if (err.code === 'P2025') {
    const message = 'Resource not found';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
};

// Socket error handler
export const handleSocketError = (socket, error) => {
  logError(error, {
    socketId: socket.id,
    userId: socket.userId,
    roomCode: socket.roomCode
  });

  const errorResponse = {
    message: error.message || 'Socket error occurred',
    code: error.code || 'SOCKET_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack
    })
  };

  socket.emit('error', errorResponse);
};

// Unhandled rejection handler
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    logError(err, { type: 'unhandledRejection' });
    
    if (process.env.NODE_ENV === 'production') {
      // In production, log and continue
      console.error('Unhandled Rejection:', err);
    } else {
      // In development, exit
      console.error('Unhandled Rejection! Shutting down...');
      process.exit(1);
    }
  });
};

// Uncaught exception handler
export const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logError(err, { type: 'uncaughtException' });
    console.error('Uncaught Exception! Shutting down...');
    process.exit(1);
  });
};

// Graceful shutdown handler
export const gracefulShutdown = (server, prisma, redisClient) => {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log('HTTP server closed');

      try {
        // Close database connections
        await prisma.$disconnect();
        console.log('Database connection closed');

        // Close Redis connections
        if (redisClient) {
          await redisClient.quit();
          console.log('Redis connection closed');
        }

        console.log('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};