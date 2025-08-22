export interface Player {
  id: string;
  nickname: string;
  roomCode: string | null;
  score: number;
  wins: number;
  losses: number;
  hasConfession?: boolean;
  isPlaying?: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  currentGame: Game | null;
  chatHistory: ChatMessage[];
}

export interface Game {
  id: string;
  type: 'rock-paper-scissors' | 'racing-3d';
  players: string[];
  state: any;
  startedAt: number;
}

export interface ChatMessage {
  id: string;
  type: 'message' | 'confession' | 'system';
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
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

export interface Racing3DState {
  players: Record<string, {
    position: number;
    speed: number;
    lane: number;
    boosts: number;
  }>;
  trackLength: number;
  obstacles: Array<{
    position: number;
    lane: number;
  }>;
  startTime: number;
}