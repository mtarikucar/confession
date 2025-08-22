import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define transports
const transports = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    )
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
  exitOnError: false
});

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Log unhandled exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/exceptions.log'),
    maxsize: 5242880,
    maxFiles: 5,
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/rejections.log'),
    maxsize: 5242880,
    maxFiles: 5,
  })
);

// Helper functions for structured logging
export const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export const logInfo = (message, context = {}) => {
  logger.info({
    message,
    ...context
  });
};

export const logWarn = (message, context = {}) => {
  logger.warn({
    message,
    ...context
  });
};

export const logDebug = (message, context = {}) => {
  logger.debug({
    message,
    ...context
  });
};

export const logGameEvent = (event, gameId, playerId, data = {}) => {
  logger.info({
    message: `Game Event: ${event}`,
    gameId,
    playerId,
    ...data
  });
};

export const logSocketEvent = (event, socketId, data = {}) => {
  logger.debug({
    message: `Socket Event: ${event}`,
    socketId,
    ...data
  });
};

export const logApiRequest = (method, path, userId, statusCode, responseTime) => {
  const level = statusCode >= 400 ? 'warn' : 'info';
  logger[level]({
    message: `API Request: ${method} ${path}`,
    userId,
    statusCode,
    responseTime: `${responseTime}ms`
  });
};

export default logger;