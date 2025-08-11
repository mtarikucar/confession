'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS, RPSMove } from '@confess-and-play/shared';
import { useStore } from '@/store/useStore';

interface RPSGameProps {
  roundId: string;
  userId: string;
  players: any[];
}

export default function RPSGame({ roundId, userId, players }: RPSGameProps) {
  const [selectedMove, setSelectedMove] = useState<RPSMove | null>(null);
  const [opponentMove, setOpponentMove] = useState<RPSMove | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const socket = getSocket();

  const isPlayer = players.some(p => p.id === userId);
  const opponent = players.find(p => p.id !== userId);

  useEffect(() => {
    // Listen for round updates
    socket.on(SOCKET_EVENTS.ROUND_UPDATE, (data: any) => {
      if (data.roundId === roundId) {
        if (data.state.waitingFor !== userId && !submitted) {
          // Opponent has made their move
          useStore.getState().addMessage({
            id: Date.now().toString(),
            from: 'system',
            text: 'Opponent has made their move! Waiting for you...',
            ts: Date.now(),
            type: 'system',
          });
        }
      }
    });

    socket.on(SOCKET_EVENTS.ROUND_RESULT, (data: any) => {
      if (data.roundId === roundId) {
        // Show result
        if (data.isDraw) {
          setResult('draw');
        } else if (data.winnerId === userId) {
          setResult('win');
        } else {
          setResult('lose');
        }

        // Show moves based on metadata
        if (data.metadata?.moves) {
          const myMove = data.metadata.moves.find((m: any) => m.userId === userId);
          const oppMove = data.metadata.moves.find((m: any) => m.userId !== userId);
          
          if (myMove) setSelectedMove(myMove.move);
          if (oppMove) setOpponentMove(oppMove.move);
        }
      }
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROUND_UPDATE);
      socket.off(SOCKET_EVENTS.ROUND_RESULT);
    };
  }, [roundId, userId, submitted]);

  const submitMove = (move: RPSMove) => {
    if (submitted || !isPlayer) return;

    setSelectedMove(move);
    setSubmitted(true);

    socket.emit(SOCKET_EVENTS.PLAY_MOVE, {
      roundId,
      userId,
      move,
    });

    // Start countdown animation
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getMoveEmoji = (move: RPSMove | null) => {
    switch (move) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
      default: return '❓';
    }
  };

  const getResultMessage = () => {
    switch (result) {
      case 'win': return '🎉 You Won!';
      case 'lose': return '💔 You Lost!';
      case 'draw': return '🤝 Draw!';
      default: return '';
    }
  };

  const getResultColor = () => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'lose': return 'text-red-400';
      case 'draw': return 'text-yellow-400';
      default: return 'text-white';
    }
  };

  if (!isPlayer) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Spectator Mode</p>
          <p className="text-white/70">
            {players.map(p => p.nickname).join(' vs ')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Players Display */}
      <div className="flex justify-center items-center gap-8 mb-8">
        <div className="text-center">
          <div className="w-24 h-24 bg-blue-500/30 rounded-full flex items-center justify-center mb-2">
            <span className="text-4xl">{getMoveEmoji(selectedMove)}</span>
          </div>
          <p className="text-white font-semibold">You</p>
          {submitted && !result && (
            <p className="text-green-400 text-sm mt-1">Move submitted!</p>
          )}
        </div>

        <div className="text-white text-2xl">VS</div>

        <div className="text-center">
          <div className="w-24 h-24 bg-red-500/30 rounded-full flex items-center justify-center mb-2">
            <span className="text-4xl">{getMoveEmoji(opponentMove)}</span>
          </div>
          <p className="text-white font-semibold">{opponent?.nickname || 'Opponent'}</p>
        </div>
      </div>

      {/* Countdown */}
      {countdown !== null && (
        <div className="text-6xl font-bold text-white mb-8 animate-pulse">
          {countdown}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`text-4xl font-bold mb-8 ${getResultColor()}`}>
          {getResultMessage()}
        </div>
      )}

      {/* Move Selection */}
      {!submitted && !result && (
        <>
          <p className="text-white text-xl mb-6">Choose your move:</p>
          <div className="flex gap-4">
            <button
              onClick={() => submitMove('rock')}
              className="group relative"
            >
              <div className="w-32 h-32 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-all duration-200 transform hover:scale-110">
                <span className="text-5xl mb-2">✊</span>
                <span className="text-white font-semibold">Rock</span>
              </div>
            </button>

            <button
              onClick={() => submitMove('paper')}
              className="group relative"
            >
              <div className="w-32 h-32 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-all duration-200 transform hover:scale-110">
                <span className="text-5xl mb-2">✋</span>
                <span className="text-white font-semibold">Paper</span>
              </div>
            </button>

            <button
              onClick={() => submitMove('scissors')}
              className="group relative"
            >
              <div className="w-32 h-32 bg-white/20 hover:bg-white/30 rounded-xl flex flex-col items-center justify-center transition-all duration-200 transform hover:scale-110">
                <span className="text-5xl mb-2">✌️</span>
                <span className="text-white font-semibold">Scissors</span>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Waiting Message */}
      {submitted && !result && countdown === null && (
        <div className="text-white text-xl animate-pulse">
          Waiting for opponent...
        </div>
      )}
    </div>
  );
}