import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chat from './Chat';
import ConfessionForm from './ConfessionForm';
import GameContainer from '../games/GameContainer';
import SettingsModal from './SettingsModal';
import './Room.css';

interface RoomProps {
  socket: any;
  isReconnecting?: boolean;
  reconnectFailed?: boolean;
  initialCheckDone?: boolean;
}

function Room({ socket, isReconnecting, reconnectFailed, initialCheckDone }: RoomProps) {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [needNewConfession, setNeedNewConfession] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [attemptingRoomRejoin, setAttemptingRoomRejoin] = useState(false);
  
  // Extract room and player from socket for easier access
  const { room, player } = socket;

  // Handle authentication and room rejoin
  useEffect(() => {
    // Wait for initial check to complete
    if (!initialCheckDone) {
      console.log('[Room] Waiting for initial check...');
      return;
    }
    
    console.log('[Room] Auth check:', {
      isReconnecting,
      reconnectFailed,
      isAuthenticated: socket.isAuthenticated,
      hasRoom: !!room,
      roomCode,
      initialCheckDone
    });
    
    // If still reconnecting, wait
    if (isReconnecting) {
      console.log('[Room] Still reconnecting, waiting...');
      return;
    }

    // Only redirect if we're sure there's no valid session
    if (!socket.isAuthenticated && !isReconnecting && initialCheckDone) {
      console.log('[Room] Not authenticated after initial check, redirecting to landing');
      navigate('/');
      return;
    }

    // If authenticated but not in room, join it
    if (socket.isAuthenticated && roomCode && (!room || room.code !== roomCode.toUpperCase())) {
      const joinOrRejoinRoom = async () => {
        setAttemptingRoomRejoin(true);
        try {
          console.log('[Room] Attempting to join/rejoin room:', roomCode);
          
          // Try to join the room
          await socket.joinRoom(roomCode.toUpperCase());
          setAttemptingRoomRejoin(false);
        } catch (error) {
          console.error('[Room] Failed to join room:', error);
          setAttemptingRoomRejoin(false);
          // Only redirect if the room doesn't exist or we can't join
          navigate('/');
        }
      };
      
      joinOrRejoinRoom();
    }
  }, [socket.isAuthenticated, room, roomCode, navigate, isReconnecting, initialCheckDone, socket]);

  useEffect(() => {
    // İtiraf açığa çıktığında dinle
    const handleConfessionRevealed = (data: any) => {
      // Eğer açığa çıkan itiraf bu oyuncunun itirafıysa
      if (data.playerId === socket.player?.id) {
        setNeedNewConfession(true);
      }
    };

    // Oyun başladığında
    const handleMatchStarted = (data: any) => {
      console.log('[Room] matchStarted received:', data);
      setGameStarting(false);
    };
    
    // Oyun başlıyor bildirimi
    const handleGameStarting = (data: any) => {
      console.log('[Room] gameStarting received:', data);
      setGameStarting(true);
    };

    socket.socket?.on('confessionRevealed', handleConfessionRevealed);
    socket.socket?.on('matchStarted', handleMatchStarted);
    socket.socket?.on('gameStarting', handleGameStarting);

    return () => {
      socket.socket?.off('confessionRevealed', handleConfessionRevealed);
      socket.socket?.off('matchStarted', handleMatchStarted);
      socket.socket?.off('gameStarting', handleGameStarting);
    };
  }, [socket.player, socket.socket]);

  const handleStartGame = async () => {
    if (!isHost) return;
    
    console.log('Starting game...', {
      roomCode,
      socket: !!socket.socket,
      isAuthenticated: socket.isAuthenticated,
      playersWithConfession
    });
    
    try {
      setGameStarting(true);
      
      if (!socket.socket) {
        console.error('Socket not connected!');
        alert('Bağlantı hatası! Sayfayı yenileyin.');
        setGameStarting(false);
        return;
      }
      
      console.log('[Room] Emitting startGameWithPool with roomCode:', roomCode, {
        connected: socket.socket.connected,
        auth: socket.socket.auth,
        id: socket.socket.id
      });
      
      socket.socket.emit('startGameWithPool', {
        roomCode: roomCode.toUpperCase()
      }, (response: any) => {
        console.log('[Room] startGameWithPool response:', response);
        if (!response || !response.success) {
          console.error('Failed to start game:', response?.error);
          alert(response?.error || 'Oyun başlatılamadı');
          setGameStarting(false);
        }
      });
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Oyun başlatılırken bir hata oluştu');
      setGameStarting(false);
    }
  };


  // Try both creator.id and creatorId fields for compatibility
  const isHost = (room?.creator?.id === player?.id) || (room?.creatorId === player?.id);

  const handleLeaveRoom = async () => {
    try {
      await socket.leaveRoom();
      navigate('/');
    } catch (error) {
      console.error('Failed to leave room:', error);
      navigate('/');
    }
  };

  const playerHasConfession = room?.players.find(
    p => p.id === player?.id
  )?.hasConfession;
  
  // İtirafı olan oyuncu sayısı
  const playersWithConfession = room?.players.filter(p => p.hasConfession).length || 0;
  const totalPlayers = room?.players.length || 0;

  // Add beforeunload handler to prevent refresh during active games
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if there's an active game
      if (room?.currentGame && room.currentGame.players.includes(player?.id || '')) {
        e.preventDefault();
        e.returnValue = 'Oyun devam ediyor! Sayfayı yenilerseniz oyundan çıkacaksınız. Devam etmek istediğinize emin misiniz?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [room?.currentGame, player?.id]);

  // Debug logs
  console.log('Current room:', room);
  console.log('Current game:', room?.currentGame);
  console.log('Player ID:', player?.id);
  console.log('Is player in game?', room?.currentGame?.players?.includes(player?.id || ''));

  // Show loading state while reconnecting
  if (isReconnecting || attemptingRoomRejoin) {
    return (
      <div className="room">
        <div className="reconnecting-container">
          <div className="spinner"></div>
          <h2>Bağlantı yenileniyor...</h2>
          <p>Lütfen bekleyin, odaya tekrar bağlanıyorsunuz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room">
      <div className="room-header">
        <h1>Room: {roomCode}</h1>
        <div className="room-info">
          <span>Players: {room?.players.length || 0}</span>
          <button onClick={() => setShowSettings(true)} className="settings-btn">
            ⚙️ Ayarlar
          </button>
          <button onClick={handleLeaveRoom} className="leave-btn">
            Leave Room
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        socket={socket}
        room={room}
        isHost={isHost}
      />

      {/* Ready Status Bar */}
      <div className="ready-status-bar">
        <div className="status-content">
          <div className="ready-info">
            <span className="ready-icon">✅</span>
            <span className="ready-text">
              {playersWithConfession}/{totalPlayers} oyuncu hazır
            </span>
          </div>
          {room?.settings?.gamePool && room.settings.gamePool.length > 0 ? (
            <div className="pool-status-inline">
              <span className="pool-icon">🎮</span>
              <span>{room.settings.gamePool.length} oyun seçili</span>
            </div>
          ) : (
            <div className="pool-status-inline warning">
              <span className="pool-icon">⚠️</span>
              <span>Oyun havuzu seçilmedi</span>
            </div>
          )}
        </div>
      </div>

      <div className="room-content">
        <div className="main-area">
          {!playerHasConfession || needNewConfession ? (
            <ConfessionForm 
              socket={socket} 
              isRenewal={needNewConfession}
              onSubmitted={() => setNeedNewConfession(false)}
            />
          ) : room?.currentGame && 
            room.currentGame.players.includes(player?.id || '') ? (
            <GameContainer 
              game={room.currentGame} 
              socket={socket} 
              room={room}
              player={player}
              playerId={player?.id || ''}
            />
          ) : (
            <div className="waiting-area">
              {isHost ? (
                <>
                  <h2>Oyun Başlat</h2>
                  <div className="game-start-section">
                    <div className="ready-status">
                      <div className="ready-counter">
                        <span className="ready-count">{playersWithConfession}</span>
                        <span className="separator">/</span>
                        <span className="total-count">{totalPlayers}</span>
                        <span className="label">oyuncu hazır</span>
                      </div>
                      
                      {!room?.settings?.gamePool?.length ? (
                        <div className="settings-prompt">
                          <p className="warning">Önce oyun havuzunu seçmelisiniz</p>
                          <button 
                            className="open-settings-btn"
                            onClick={() => setShowSettings(true)}
                          >
                            ⚙️ Oyun Havuzu Seç
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="start-game-btn"
                          onClick={handleStartGame}
                          disabled={gameStarting || playersWithConfession < 2}
                        >
                          {gameStarting ? (
                            <>
                              <div className="spinner"></div>
                              Oyun başlatılıyor...
                            </>
                          ) : (
                            <>
                              🎮 Oyunu Başlat
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : gameStarting ? (
                <div className="waiting-message">
                  <div className="spinner"></div>
                  <p>Oyun başlıyor...</p>
                </div>
              ) : (
                <>
                  <h2>Oyuna Hazırsın!</h2>
                  <p>İtirafın gönderildi ve gizli.</p>
                  
                  <div className="waiting-info">
                    <div className="ready-counter-small">
                      <span className="icon">👥</span>
                      <span>{playersWithConfession}/{totalPlayers} oyuncu hazır</span>
                    </div>
                    
                    {room?.settings?.gamePool && room.settings.gamePool.length > 0 ? (
                      (
                        <div className="selected-pool-info">
                          <p className="pool-status">✅ Oyun havuzu seçili</p>
                          <p className="waiting-host">Oda yöneticisinin oyunu başlatması bekleniyor...</p>
                        </div>
                      )
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}

          {room?.currentGame && 
           !room.currentGame.players.includes(player?.id || '') && (
            <div className="spectator-area">
              <h3>Game in Progress</h3>
              <p>Watching: {
                room.players
                  .filter(p => room?.currentGame?.players.includes(p.id))
                  .map(p => p.nickname)
                  .join(' vs ')
              }</p>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="players-list">
            <h3>Players</h3>
            <ul>
              {room?.players.map(roomPlayer => (
                <li key={roomPlayer.id} className={roomPlayer.isPlaying ? 'playing' : ''}>
                  <span className="player-name">{roomPlayer.nickname}</span>
                  <span className="player-status">
                    {roomPlayer.isPlaying ? '🎮' : roomPlayer.hasConfession ? '✅' : '⏳'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Chat socket={socket} />
        </div>
      </div>
    </div>
  );
}

export default Room;