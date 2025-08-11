export const config = {
  SERVER_PORT: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/confess_game',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_URL: process.env.REDIS_URL,
  
  // Game config
  MIN_PLAYERS_PER_GAME: 2,
  MAX_CONFESSION_LENGTH: 500,
  MIN_CONFESSION_LENGTH: 10,
  MIN_NICKNAME_LENGTH: 3,
  MAX_NICKNAME_LENGTH: 20,
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 60,
  
  // Room settings
  ROOM_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  ROOM_EMPTY_TTL_MS: 30 * 60 * 1000, // 30 minutes
} as const;