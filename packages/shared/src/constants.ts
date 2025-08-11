// Socket events
export const SOCKET_EVENTS = {
  // Client to server
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_CONFESSION: 'send_confession',
  START_GAME: 'start_game',
  PLAY_MOVE: 'play_move',
  CHAT_MESSAGE: 'chat_message',
  
  // Server to client
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  CONFESSION_SUBMITTED: 'confession_submitted',
  GAME_STARTED: 'game_started',
  ROUND_UPDATE: 'round_update',
  ROUND_RESULT: 'round_result',
  CHAT_MESSAGE_RESPONSE: 'chat_message',
  ERROR_EVENT: 'error_event',
} as const;

// Game IDs
export const GAME_IDS = {
  RPS: 'rps',
  BALL_RACE_3D: 'ballrace3d',
} as const;

// Game configurations
export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS_PER_ROOM: 10,
  ROUND_TIMEOUT_MS: 60000, // 1 minute
  MOVE_TIMEOUT_MS: 30000, // 30 seconds
} as const;

// Validation limits
export const LIMITS = {
  MIN_NICKNAME_LENGTH: 3,
  MAX_NICKNAME_LENGTH: 20,
  MIN_CONFESSION_LENGTH: 10,
  MAX_CONFESSION_LENGTH: 500,
  MIN_ROOM_NAME_LENGTH: 3,
  MAX_ROOM_NAME_LENGTH: 50,
  MAX_CHAT_MESSAGE_LENGTH: 200,
} as const;

// Error codes
export const ERROR_CODES = {
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  INVALID_NICKNAME: 'INVALID_NICKNAME',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CONFESSION_REQUIRED: 'CONFESSION_REQUIRED',
  CONFESSION_EXISTS: 'CONFESSION_EXISTS',
  INVALID_CONFESSION: 'INVALID_CONFESSION',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  INVALID_MOVE: 'INVALID_MOVE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ROUND_NOT_FOUND: 'ROUND_NOT_FOUND',
  INSUFFICIENT_PLAYERS: 'INSUFFICIENT_PLAYERS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Profanity filter words (basic example - expand as needed)
export const PROFANITY_WORDS = [
  // Add actual words here
] as const;