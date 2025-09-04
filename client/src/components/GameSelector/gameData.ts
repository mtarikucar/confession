export type Game = {
  id: string;
  name: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: string;
};

export const AVAILABLE_GAMES = [
  {
    id: 'truth-or-dare',
    name: 'Truth or Dare',
    icon: '🎯',
    minPlayers: 2,
    maxPlayers: 8,
    description: 'Spin the wheel and face your truth or complete the dare! Vote on challenges.',
    difficulty: 'easy',
    duration: '15-20 min'
  },
  {
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    icon: '✂️',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic rock paper scissors game. Best of 3 rounds wins!',
    difficulty: 'easy',
    duration: '2-3 min'
  },
  {
    id: 'drawing-guess',
    name: 'Draw & Guess',
    icon: '🎨',
    minPlayers: 3,
    maxPlayers: 8,
    description: 'Take turns drawing and guessing. Show your creativity and guessing skills!',
    difficulty: 'easy',
    duration: '10-15 min'
  },
  {
    id: 'word-battle',
    name: 'Word Battle',
    icon: '📝',
    minPlayers: 2,
    maxPlayers: 8,
    description: 'Create the most words from given letters. Vocabulary battle royale!',
    difficulty: 'medium',
    duration: '3-5 min'
  }
];