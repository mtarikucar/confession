import React, { useState, useEffect } from 'react';
import './GameSelector.css';
import { AVAILABLE_GAMES } from './gameData';
import type { Game } from './gameData';
import type { 
  Room, 
  GameType, 
  SocketResponse, 
  GameSelectedData, 
  GameChangedData 
} from '../../../../shared/types';

// Socket instance interface
interface SocketInstance {
  socket: any; // The actual socket.io client
  roomCode: string | null;
  isAuthenticated: boolean;
  player: any;
  room: Room | null;
}

interface GameSelectorProps {
  socket: SocketInstance;
  room: Room | null;
  isHost: boolean;
  onGameSelected: (gameId: string) => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({ 
  socket, 
  room, 
  isHost, 
  onGameSelected 
}) => {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const playerCount = room?.players?.length || 0;
  const roomCode = room?.code || socket?.roomCode;

  useEffect(() => {
    if (!socket?.socket) return;

    const handleGameSelected = (data: GameSelectedData) => {
      setSelectedGame(data.gameType);
      setError(null);
      setLoading(false);
    };

    const handleGameChanged = (data: GameChangedData) => {
      setSelectedGame(data.gameType);
      setError(null);
      setLoading(false);
    };

    // Listen for game selection confirmations
    socket.socket.on('gameSelected', handleGameSelected);
    socket.socket.on('gameChanged', handleGameChanged);

    return () => {
      socket.socket?.off('gameSelected', handleGameSelected);
      socket.socket?.off('gameChanged', handleGameChanged);
    };
  }, [socket]);

  const handleGameClick = (gameId: string) => {
    if (!isHost || loading || !roomCode) {
      return;
    }
    
    // Check if game exists
    const game = AVAILABLE_GAMES.find(g => g.id === gameId);
    if (!game) {
      return;
    }

    setLoading(true);
    setError(null);

    // Host directly selects the game
    socket.socket?.emit('selectGame', { 
      roomCode: roomCode, 
      gameType: gameId as GameType
    }, (response: SocketResponse) => {
      setLoading(false);
      
      if (response.success) {
        setSelectedGame(gameId as GameType);
        onGameSelected(gameId);
      } else {
        setError(response.error || 'Failed to select game');
        console.error('Failed to select game:', response.error);
      }
    });
  };



  return (
    <div className="game-selector">
      <div className="selector-header">
        <h2>Oyun Seç</h2>
      </div>



      <div className="games-grid">
        {AVAILABLE_GAMES.map((game) => {
          const isSelected = selectedGame === game.id;
          const canClick = isHost && !loading;

          return (
            <div
              key={game.id}
              className={`
                game-card 
                ${isSelected ? 'selected' : ''}
                ${!isHost ? 'non-interactive' : ''}
              `}
              onClick={() => canClick && handleGameClick(game.id)}
              role={isHost ? 'button' : 'presentation'}
              tabIndex={canClick ? 0 : -1}
              onKeyDown={(e) => {
                if (canClick && (e.key === 'Enter' || e.key === ' ')) {
                  handleGameClick(game.id);
                }
              }}
              aria-label={`${game.name} game`}
            >
              <div className="game-icon">{game.icon}</div>
              <h3 className="game-name">{game.name}</h3>
              <p className="game-description">{game.description}</p>
              
              {isSelected && (
                <div className="selected-indicator">✓</div>
              )}
            </div>
          );
        })}
      </div>


    </div>
  );
};

export default GameSelector;