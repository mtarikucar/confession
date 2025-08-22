import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

interface LandingProps {
  socket: any;
}

function Landing({ socket }: LandingProps) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    try {
      setIsConnecting(true);

      // Connect with nickname if not already connected
      if (!socket.isConnected || !socket.isAuthenticated) {
        await socket.connectWithNickname(nickname);
      } else if (socket.player?.nickname !== nickname) {
        // Update nickname if already connected but with different nickname
        await socket.updateNickname(nickname);
      }

      if (isCreating) {
        const { roomCode } = await socket.createRoom();
        navigate(`/room/${roomCode}`);
      } else {
        if (!roomCode.trim()) {
          setError('Please enter a room code');
          return;
        }
        await socket.joinRoom(roomCode.toUpperCase());
        navigate(`/room/${roomCode.toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join/create room');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-container">
        <h1>Confession Game</h1>
        <p className="subtitle">Share your secrets, play to keep them hidden</p>
        
        <form onSubmit={handleSubmit} className="landing-form">
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="input"
          />

          <div className="room-options">
            <button
              type="button"
              className={`option-btn ${isCreating ? 'active' : ''}`}
              onClick={() => setIsCreating(true)}
            >
              Create Room
            </button>
            <button
              type="button"
              className={`option-btn ${!isCreating ? 'active' : ''}`}
              onClick={() => setIsCreating(false)}
            >
              Join Room
            </button>
          </div>

          {!isCreating && (
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              className="input"
              style={{ textTransform: 'uppercase' }}
            />
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" className="submit-btn" disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : (isCreating ? 'Create Room' : 'Join Room')}
          </button>
        </form>

        <div className="game-info">
          <h3>How to Play:</h3>
          <ol>
            <li>Submit a confession before playing</li>
            <li>Compete in mini-games against other players</li>
            <li>Winners keep their confessions hidden</li>
            <li>Losers have their confessions revealed to everyone!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default Landing;