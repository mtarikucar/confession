import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chat from './Chat';
import ConfessionForm from './ConfessionForm';
import GameContainer from '../games/GameContainer';
import './Room.css';

interface RoomProps {
  socket: any;
}

function Room({ socket }: RoomProps) {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [isWaiting, setIsWaiting] = useState(false);
  const [needNewConfession, setNeedNewConfession] = useState(false);
  
  // Extract room and player from socket for easier access
  const { room, player } = socket;

  useEffect(() => {
    if (!socket.isAuthenticated || !socket.player) {
      navigate('/');
    }
  }, [socket.isAuthenticated, socket.player, navigate]);

  useEffect(() => {
    // İtiraf açığa çıktığında dinle
    const handleConfessionRevealed = (data: any) => {
      // Eğer açığa çıkan itiraf bu oyuncunun itirafıysa
      if (data.playerId === socket.player?.id) {
        setNeedNewConfession(true);
        setIsWaiting(false);
      }
    };

    // Oyun başladığında waiting durumunu kapat
    const handleMatchStarted = () => {
      console.log('Match started!');
      setIsWaiting(false);
    };

    socket.socket?.on('confessionRevealed', handleConfessionRevealed);
    socket.socket?.on('matchStarted', handleMatchStarted);

    return () => {
      socket.socket?.off('confessionRevealed', handleConfessionRevealed);
      socket.socket?.off('matchStarted', handleMatchStarted);
    };
  }, [socket.player, socket.socket]);

  const handleRequestMatch = async () => {
    try {
      setIsWaiting(true);
      const matched = await socket.requestMatch();
      if (!matched) {
        setTimeout(() => setIsWaiting(false), 3000);
      } else {
        setIsWaiting(false);
      }
    } catch (error) {
      console.error('Failed to request match:', error);
      setIsWaiting(false);
    }
  };

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

  // Debug logs
  console.log('Current room:', room);
  console.log('Current game:', room?.currentGame);
  console.log('Player ID:', player?.id);
  console.log('Is player in game?', room?.currentGame?.players?.includes(player?.id || ''));

  return (
    <div className="room">
      <div className="room-header">
        <h1>Room: {roomCode}</h1>
        <div className="room-info">
          <span>Players: {room?.players.length || 0}</span>
          <button onClick={handleLeaveRoom} className="leave-btn">
            Leave Room
          </button>
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
              <h2>Ready to Play!</h2>
              {isWaiting ? (
                <div className="waiting-message">
                  <div className="spinner"></div>
                  <p>Waiting for another player...</p>
                </div>
              ) : (
                <>
                  <p>Your confession is submitted and hidden.</p>
                  <p>Win games to keep it secret!</p>
                  <button 
                    onClick={handleRequestMatch} 
                    className="play-btn"
                    disabled={!room || room.players.filter(p => p.hasConfession).length < 2}
                  >
                    Find Match
                  </button>
                  {room && room.players.filter(p => p.hasConfession).length < 2 && (
                    <p className="warning">Waiting for more players to submit confessions...</p>
                  )}
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