// User types
export interface User {
  id: string;
  nickname: string;
  roomId?: string | null;
  createdAt: Date;
}

// Room types
export interface Room {
  id: string;
  name: string;
  userCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Confession types
export interface Confession {
  id: string;
  userId: string;
  content: string;
  isRevealed: boolean;
  createdAt: Date;
}

// Game types
export type GameStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface GameRound {
  id: string;
  roomId: string;
  player1Id: string;
  player2Id: string;
  winnerId?: string | null;
  revealedConfessionId?: string | null;
  gameId: string;
  status: GameStatus;
  metadata?: any;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

// Socket event payloads
export interface JoinRoomPayload {
  userId: string;
  roomId: string;
}

export interface LeaveRoomPayload {
  userId: string;
  roomId: string;
}

export interface SendConfessionPayload {
  userId: string;
  content: string;
}

export interface StartGamePayload {
  roomId: string;
  gameId?: string;
}

export interface PlayMovePayload {
  roomId: string;
  userId: string;
  move: any;
}

export interface ChatMessagePayload {
  roomId: string;
  userId: string;
  text: string;
}

// Socket response types
export interface UserJoinedResponse {
  roomId: string;
  user: {
    id: string;
    nickname: string;
  };
}

export interface UserLeftResponse {
  roomId: string;
  userId: string;
}

export interface ConfessionSubmittedResponse {
  userId: string;
  status: 'ok' | 'error';
}

export interface GameStartedResponse {
  roomId: string;
  roundId: string;
  gameId: string;
  players: string[];
  assets?: string[];
}

export interface RoundUpdateResponse {
  roundId: string;
  state: any;
}

export interface RoundResultResponse {
  roundId: string;
  winnerId: string | null;
  loserId: string | null;
  revealedConfession?: {
    userId: string;
    content: string;
  };
}

export interface ChatMessageResponse {
  roomId: string;
  message: {
    from: 'system' | string;
    text: string;
    ts: number;
  };
}

export interface ErrorEventResponse {
  code: string;
  message: string;
  context?: any;
}

// Game module interface
export interface GameOptions {
  width: number;
  height: number;
  players: string[];
  assets?: string[];
}

export interface GameModule {
  id: string;
  name: string;
  type: '2D' | '3D';
  assets: string[];
  mount(container: HTMLElement, options: GameOptions): void;
  handleRemote(stateOrMove: any): void;
  unmount(): void;
}

// RPS specific types
export type RPSMove = 'rock' | 'paper' | 'scissors';

export interface RPSGameState {
  player1Move?: RPSMove;
  player2Move?: RPSMove;
  result?: 'player1' | 'player2' | 'draw';
}