import React, { useState, useEffect } from 'react';
import './GameSelector.css';
import { AVAILABLE_GAMES } from './gameData';
import type { Game } from './gameData';
import type { 
  Room, 
  GameType, 
  SocketResponse
} from '../../../../shared/types';

interface SocketInstance {
  socket: any;
  roomCode: string | null;
  isAuthenticated: boolean;
  player: any;
  room: Room | null;
}

interface GamePoolSelectorProps {
  socket: SocketInstance;
  room: Room | null;
  isHost: boolean;
  onPoolUpdated?: () => void;
}

const GamePoolSelector: React.FC<GamePoolSelectorProps> = ({ 
  socket, 
  room, 
  isHost, 
  onPoolUpdated 
}) => {
  const [selectedGames, setSelectedGames] = useState<Set<GameType>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const playerCount = room?.players?.length || 0;
  const roomCode = room?.code || socket?.roomCode;

  // Initialize with existing game pool
  useEffect(() => {
    if (room?.settings?.gamePool && room.settings.gamePool.length > 0) {
      // Filter out turbo-racing and any invalid games
      const validGamePool = room.settings.gamePool.filter(gameId => {
        // Exclude turbo-racing
        if (gameId === 'turbo-racing') return false;
        // Only include games that exist in AVAILABLE_GAMES
        return AVAILABLE_GAMES.some(game => game.id === gameId);
      });
      
      if (validGamePool.length > 0) {
        setSelectedGames(new Set(validGamePool));
      } else {
        // If no valid games, use defaults
        const defaultGames = AVAILABLE_GAMES.map(game => game.id as GameType);
        setSelectedGames(new Set(defaultGames));
      }
    } else {
      // Default to all games
      const defaultGames = AVAILABLE_GAMES.map(game => game.id as GameType);
      setSelectedGames(new Set(defaultGames));
    }
  }, [room?.settings?.gamePool]);

  useEffect(() => {
    if (!socket?.socket) return;

    const handleGamePoolUpdated = (data: { gamePool: GameType[], updatedBy: string }) => {
      // Filter out turbo-racing from received game pool
      const validGamePool = data.gamePool.filter(gameId => {
        return gameId !== 'turbo-racing' && AVAILABLE_GAMES.some(game => game.id === gameId);
      });
      
      setSelectedGames(new Set(validGamePool));
      setError(null);
      setLoading(false);
      onPoolUpdated?.();
    };

    socket.socket.on('gamePoolUpdated', handleGamePoolUpdated);

    return () => {
      socket.socket?.off('gamePoolUpdated', handleGamePoolUpdated);
    };
  }, [socket, onPoolUpdated]);

  const handleGameToggle = (gameId: string) => {
    if (!isHost || loading) {
      return;
    }

    const game = AVAILABLE_GAMES.find(g => g.id === gameId);
    if (!game) return;

    const newSelectedGames = new Set(selectedGames);
    
    if (newSelectedGames.has(gameId as GameType)) {
      // Don't allow removing if it's the last game
      if (newSelectedGames.size === 1) {
        setError('En az bir oyun seçili olmalı');
        return;
      }
      newSelectedGames.delete(gameId as GameType);
    } else {
      newSelectedGames.add(gameId as GameType);
    }

    // Update local state immediately for better UX
    setSelectedGames(newSelectedGames);
    
    // Auto-update the game pool
    setLoading(true);
    setError(null);
    
    socket.socket?.emit('updateGamePool', { 
      roomCode: roomCode, 
      gamePool: Array.from(newSelectedGames)
    }, (response: SocketResponse) => {
      setLoading(false);
      
      if (!response || !response.success) {
        // Revert on error
        setError(response?.error || 'Oyun havuzu güncellenemedi');
        setSelectedGames(selectedGames);
      } else {
        onPoolUpdated?.();
      }
    });
  };

  // Removed handleUpdatePool - now auto-updates on selection

  const handleSelectAll = () => {
    if (!isHost || loading) return;
    
    const allGames = AVAILABLE_GAMES.map(game => game.id as GameType);
    
    setLoading(true);
    setError(null);
    
    socket.socket?.emit('updateGamePool', { 
      roomCode: roomCode, 
      gamePool: allGames
    }, (response: SocketResponse) => {
      setLoading(false);
      
      if (response.success) {
        setSelectedGames(new Set(allGames));
        onPoolUpdated?.();
      } else {
        setError(response.error || 'Oyun havuzu güncellenemedi');
      }
    });
  };

  const handleClearAll = () => {
    if (!isHost || loading) return;
    
    // Keep at least one game selected
    const firstGame = AVAILABLE_GAMES[0]?.id as GameType;
    if (!firstGame) return;
    
    setLoading(true);
    setError(null);
    
    socket.socket?.emit('updateGamePool', { 
      roomCode: roomCode, 
      gamePool: [firstGame]
    }, (response: SocketResponse) => {
      setLoading(false);
      
      if (response.success) {
        setSelectedGames(new Set([firstGame]));
        onPoolUpdated?.();
      } else {
        setError(response.error || 'Oyun havuzu güncellenemedi');
      }
    });
  };

  const isGamePlayable = (game: Game): boolean => {
    return true; // Allow all games to be selected
  };


  return (
    <div className="game-pool-selector">
      <div className="selector-header">
        <h2>Oyun Havuzu</h2>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button 
            className="error-close" 
            onClick={() => setError(null)}
            aria-label="Hatayı kapat"
          >
            ×
          </button>
        </div>
      )}

      {isHost ? (
        <p className="selector-info">
          Hangi oyunlar oynanabilsin?
        </p>
      ) : (
        <p className="selector-info">
          Oda sahibi oyun havuzunu belirliyor...
        </p>
      )}

      <div className="selected-count">
        <span>Seçilen: {selectedGames.size} oyun</span>
        {isHost && (
          <div className="pool-actions">
            <button 
              onClick={handleSelectAll} 
              className="select-all-btn"
              disabled={loading}
            >
              Tümünü Seç
            </button>
            <button 
              onClick={handleClearAll} 
              className="clear-all-btn"
              disabled={loading || selectedGames.size === 0}
            >
              Temizle
            </button>
          </div>
        )}
      </div>

      <div className="games-grid pool-grid">
        {AVAILABLE_GAMES.map((game) => {
          const playable = isGamePlayable(game);
          const isSelected = selectedGames.has(game.id as GameType);
          const canToggle = isHost && playable && !loading;

          return (
            <div
              key={game.id}
              className={`
                game-card pool-card
                ${!playable ? 'disabled' : ''} 
                ${isSelected ? 'selected' : ''}
                ${!isHost ? 'non-interactive' : ''}
                ${loading ? 'loading' : ''}
              `}
              onClick={() => canToggle && handleGameToggle(game.id)}
              role={isHost ? 'checkbox' : 'presentation'}
              aria-checked={isSelected}
              tabIndex={canToggle ? 0 : -1}
              onKeyDown={(e) => {
                if (canToggle && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleGameToggle(game.id);
                }
              }}
              aria-label={`${game.name} oyunu`}
              aria-disabled={!playable || !isHost}
            >
              <div className="checkbox-area">
                <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <span className="checkmark">✓</span>}
                </div>
              </div>

              <div className="game-content">
                <div className="game-icon" aria-hidden="true">{game.icon}</div>
                <h3 className="game-name">{game.name}</h3>
                
                <p className="game-description">{game.description}</p>
              </div>

            </div>
          );
        })}
      </div>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner-small"></div>
          <span>Güncelleniyor...</span>
        </div>
      )}

      {!isHost && selectedGames.size > 0 && (
        <div className="selected-games-preview">
          <h3>Oynanabilecek Oyunlar</h3>
          <div className="preview-games">
            {Array.from(selectedGames).map(gameId => {
              const game = AVAILABLE_GAMES.find(g => g.id === gameId);
              if (!game) return null;
              
              return (
                <div key={gameId} className="preview-game-chip">
                  <span className="chip-icon">{game.icon}</span>
                  <span className="chip-name">{game.name}</span>
                </div>
              );
            })}
          </div>
          <p className="pool-info">
            Bu oyunlardan biri rastgele seçilecek
          </p>
        </div>
      )}
    </div>
  );
};

export default GamePoolSelector;