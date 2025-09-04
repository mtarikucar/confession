import { useState } from 'react';
import GamePoolSelector from './GameSelector/GamePoolSelector';
import './RoomSettings.css';

interface RoomSettingsProps {
  socket: any;
  room: any;
  isHost: boolean;
}

function RoomSettings({ socket, room, isHost }: RoomSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // İtirafı olan oyuncu sayısı
  const playersWithConfession = room?.players.filter((p: any) => p.hasConfession).length || 0;
  const totalPlayers = room?.players.length || 0;

  return (
    <div className="room-settings">
      <div className="settings-header">
        <div className="settings-info">
          <h3>Oda Ayarları</h3>
          <div className="ready-counter-inline">
            <span className="ready-icon">✅</span>
            <span className="ready-text">
              {playersWithConfession}/{totalPlayers} oyuncu hazır
            </span>
          </div>
        </div>
        <button 
          className="settings-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Ayarları gizle' : 'Ayarları göster'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="settings-content">
          <div className="game-pool-section">
            <div className="section-header">
              <h4>Oyun Havuzu</h4>
              {!isHost && (
                <span className="host-only-badge">Sadece oda sahibi değiştirebilir</span>
              )}
            </div>
            <GamePoolSelector 
              socket={socket}
              room={room}
              isHost={isHost}
              onPoolUpdated={() => {
                console.log('Game pool updated from settings');
              }}
            />
          </div>
          
          {room?.settings?.gamePool && room.settings.gamePool.length > 0 && (
            <div className="pool-info">
              <p className="pool-status">
                ✅ {room.settings.gamePool.length} oyun seçili
              </p>
              <p className="pool-description">
                Oyun başladığında, havuzdan rastgele bir oyun seçilecek.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoomSettings;