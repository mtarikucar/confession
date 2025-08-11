'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@confess-and-play/shared';
import RPSGame from '@/games/rps2d/RPSGame';

interface GameAreaProps {
  roomId: string;
  userId: string;
  gameActive: boolean;
  hasConfession: boolean;
}

export default function GameArea({ roomId, userId, gameActive, hasConfession }: GameAreaProps) {
  const { currentGame } = useStore();
  const [selectedGame, setSelectedGame] = useState('rps');
  const socket = getSocket();

  const startGame = () => {
    if (!hasConfession) {
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: '⚠️ You must submit a confession before starting a game!',
        ts: Date.now(),
        type: 'system',
      });
      return;
    }

    socket.emit(SOCKET_EVENTS.START_GAME, {
      roomId,
      gameId: selectedGame,
    });
  };

  if (gameActive && currentGame) {
    return (
      <div className="h-full bg-white/10 backdrop-blur-md rounded-xl p-4">
        <div className="h-full flex flex-col">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">Game in Progress</h2>
            <p className="text-white/70">
              Round ID: {currentGame.roundId}
            </p>
          </div>

          <div className="flex-1">
            {currentGame.gameId === 'rps' && (
              <RPSGame
                roundId={currentGame.roundId}
                userId={userId}
                players={currentGame.players}
              />
            )}
            {currentGame.gameId === 'ballrace3d' && (
              <div className="h-full flex items-center justify-center text-white">
                <p>Ball Race 3D - Coming Soon!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white/10 backdrop-blur-md rounded-xl p-4">
      <div className="h-full flex flex-col items-center justify-center">
        <h2 className="text-3xl font-bold text-white mb-8">Ready to Play?</h2>
        
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white/20 rounded-lg p-4">
            <label className="block text-white mb-2">Select Game:</label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="w-full px-4 py-2 bg-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="rps">Rock Paper Scissors</option>
              <option value="ballrace3d">Ball Race 3D (Coming Soon)</option>
            </select>
          </div>

          {!hasConfession && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-3 rounded-lg">
              ⚠️ You must submit a confession before playing!
            </div>
          )}

          <button
            onClick={startGame}
            disabled={!hasConfession || selectedGame === 'ballrace3d'}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Game
          </button>

          <p className="text-white/60 text-center text-sm">
            Minimum 2 players with confessions required to start
          </p>
        </div>
      </div>
    </div>
  );
}