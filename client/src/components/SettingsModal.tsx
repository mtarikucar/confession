import { useState, useEffect } from 'react';
import GamePoolSelector from './GameSelector/GamePoolSelector';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: any;
  room: any;
  isHost: boolean;
}

function SettingsModal({ isOpen, onClose, socket, room, isHost }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('game-pool');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-modal-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2>⚙️ Oda Ayarları</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-tabs">
          <button 
            className={`tab ${activeTab === 'game-pool' ? 'active' : ''}`}
            onClick={() => setActiveTab('game-pool')}
          >
            🎮 Oyun Havuzu
          </button>
          <button 
            className={`tab ${activeTab === 'room-info' ? 'active' : ''}`}
            onClick={() => setActiveTab('room-info')}
          >
            ℹ️ Oda Bilgileri
          </button>
        </div>
        
        <div className="settings-modal-content">
          {activeTab === 'game-pool' ? (
            <div className="settings-section">
              <div className="section-description">
                <p>Odada oynanabilecek oyunları seçin. Oyun başlatıldığında, havuzdan rastgele bir oyun seçilecek.</p>
                {!isHost && (
                  <div className="permission-notice">
                    <span className="notice-icon">🔒</span>
                    <span>Sadece oda sahibi bu ayarları değiştirebilir</span>
                  </div>
                )}
              </div>
              
              <GamePoolSelector 
                socket={socket}
                room={room}
                isHost={isHost}
                onPoolUpdated={() => {
                  console.log('Game pool updated from settings modal');
                }}
              />
              
              {room?.settings?.gamePool && room.settings.gamePool.length > 0 && (
                <div className="current-pool-info">
                  <h4>Seçili Oyunlar ({room.settings.gamePool.length})</h4>
                  <div className="selected-games-preview">
                    {room.settings.gamePool.map((gameId: string) => (
                      <span key={gameId} className="game-badge">
                        {gameId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="settings-section">
              <h3>Oda Bilgileri</h3>
              <div className="room-info-grid">
                <div className="info-item">
                  <span className="info-label">Oda Kodu:</span>
                  <span className="info-value">{room?.code}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Oda Sahibi:</span>
                  <span className="info-value">{room?.creator?.nickname}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Oyuncu Sayısı:</span>
                  <span className="info-value">{room?.players?.length || 0} / {room?.maxPlayers || 20}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Durum:</span>
                  <span className="info-value status-active">Aktif</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="settings-modal-footer">
          <button className="btn-close" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;