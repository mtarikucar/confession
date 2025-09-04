export interface Player {
  id: string;
  nickname: string;
  roomCode: string | null;
  score: number;
  wins: number;
  losses: number;
  hasConfession?: boolean;
  isPlaying?: boolean;
  isHost?: boolean;
}

export interface Room {
  id?: string;
  code: string;
  name?: string;
  creatorId?: string;
  creator?: {
    id: string;
    nickname: string;
  };
  players: Player[];
  currentGame: Game | null;
  chatHistory: ChatMessage[];
  maxPlayers?: number;
  isActive?: boolean;
  selectedGameType?: GameType;
  settings?: RoomSettings;
}

export interface RoomSettings {
  selectedGameType?: GameType;
  gamePool?: GameType[]; // Array of allowed game types
  autoStart?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
}

export type GameType = 
  | 'rock-paper-scissors' 
  | 'drawing-guess' 
  | 'word-battle'
  | 'truth-or-dare';

export type GameStatus = 
  | 'waiting' 
  | 'starting' 
  | 'in-progress' 
  | 'ended';

export interface Game {
  id: string;
  name: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: string;
  type?: GameType;
  players?: string[];
  state?: any;
  status?: GameStatus;
  winner?: string;
  rankings?: GameRanking[];
  startedAt?: number;
  endedAt?: number;
}

export interface GameRanking {
  playerId: string;
  nickname: string;
  position: number;
  score?: number;
  time?: number;
}

export type MessageType = 
  | 'message' 
  | 'confession' 
  | 'system' 
  | 'game';

export interface ChatMessage {
  id: string;
  type: MessageType;
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
  userId?: string;
  roomId?: string;
  createdAt?: Date;
}

export interface Confession {
  text: string;
  revealed: boolean;
  submittedAt: number;
}

export interface RockPaperScissorsState {
  player1Choice: 'rock' | 'paper' | 'scissors' | null;
  player2Choice: 'rock' | 'paper' | 'scissors' | null;
  round: number;
  scores: Record<string, number>;
}

// Game Metadata for display
export interface GameMetadata {
  id: GameType;
  name: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: string;
}

// Socket Response Types
export interface SocketResponse {
  success: boolean;
  error?: string;
  data?: any;
  matched?: boolean;
  waitingForPlayers?: boolean;
}

// Socket Event Data Types
export interface SelectGameData {
  roomCode: string;
  gameType: GameType;
}

export interface GameSelectedData {
  gameType: GameType;
  selectedBy: string;
}

export interface GameChangedData {
  gameType: GameType;
  changedBy: string;
}

export interface GameAction {
  type: string;
  gameId?: string;
  [key: string]: any;
}

export interface ConfessionRevealedData {
  playerId: string;
  confession: string;
  chatMessage: ChatMessage;
}

// TurboLegends Enums
export enum WeatherType {
  CLEAR = 'clear',
  RAIN = 'rain',
  STORM = 'storm',
  FOG = 'fog',
  NIGHT = 'night',
  SUNSET = 'sunset'
}

export enum PowerUpType {
  NITRO = 'nitro',
  SHIELD = 'shield',
  MISSILE = 'missile',
  OIL_SLICK = 'oil_slick',
  SPEED_BOOST = 'speed_boost',
  REPAIR = 'repair',
  GHOST = 'ghost',
  MAGNET = 'magnet'
}