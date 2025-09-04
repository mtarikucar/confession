import { useState, useEffect } from 'react';
import './TruthOrDare.css';

interface TruthOrDareProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

function TruthOrDare({ game, socket, room, player, playerId }: TruthOrDareProps) {
  const [gameState, setGameState] = useState(game.state);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showVoteResults, setShowVoteResults] = useState(false);
  const [voteResults, setVoteResults] = useState<any>(null);

  useEffect(() => {
    const handleGameUpdate = (data: any) => {
      if (data.game.id === game.id) {
        setGameState(data.game.state);
        
        // Reset vote state when phase changes
        if (data.game.state.phase !== 'voting') {
          setHasVoted(false);
          setShowVoteResults(false);
        }
      }
    };

    const handleGameEnded = (data: any) => {
      if (data.game.id === game.id) {
        console.log('Game ended:', data);
      }
    };

    socket.socket?.on('gameUpdate', handleGameUpdate);
    socket.socket?.on('gameEnded', handleGameEnded);

    return () => {
      socket.socket?.off('gameUpdate', handleGameUpdate);
      socket.socket?.off('gameEnded', handleGameEnded);
    };
  }, [socket, game.id]);

  useEffect(() => {
    // Timer for tasks
    if (gameState.phase === 'answering' && timeLeft === null) {
      const timeLimit = gameState.spinResult === 'truth' ? 60 : 120;
      setTimeLeft(timeLimit);
    }

    if (timeLeft !== null && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState.phase, gameState.spinResult]);

  const isMyTurn = gameState.currentPlayer === playerId;

  const handleSpin = async () => {
    if (!isMyTurn || gameState.phase !== 'waiting') return;
    
    setIsSpinning(true);
    setSpinResult(null);
    
    // Animate spinner
    setTimeout(async () => {
      await socket.sendGameAction({ type: 'spin' });
      setIsSpinning(false);
    }, 3000);
  };

  const handleChoice = async (choice: 'truth' | 'dare') => {
    if (!isMyTurn || gameState.phase !== 'choosing') return;
    await socket.sendGameAction({ type: 'choose', choice });
  };

  const handleComplete = async () => {
    if (!isMyTurn || gameState.phase !== 'answering') return;
    setTimeLeft(null);
    await socket.sendGameAction({ type: 'complete' });
  };

  const handlePass = async () => {
    if (!isMyTurn || gameState.phase !== 'answering') return;
    const playerState = gameState.players[playerId];
    if (playerState.passesRemaining <= 0) {
      alert('No passes remaining!');
      return;
    }
    setTimeLeft(null);
    await socket.sendGameAction({ type: 'pass' });
  };

  const handleVote = async (vote: boolean) => {
    if (hasVoted || gameState.phase !== 'voting' || isMyTurn) return;
    setHasVoted(true);
    await socket.sendGameAction({ type: 'vote', vote });
  };

  const getPlayerName = (id: string) => {
    const p = room?.players.find((p: any) => p.id === id);
    return p?.nickname || 'Unknown';
  };

  const getCurrentPlayerName = () => {
    return getPlayerName(gameState.currentPlayer);
  };

  // Update current task when state changes
  useEffect(() => {
    if (gameState.currentQuestion) {
      setCurrentTask(gameState.currentQuestion);
      setSpinResult('truth');
    } else if (gameState.currentDare) {
      setCurrentTask(gameState.currentDare);
      setSpinResult('dare');
    } else {
      setCurrentTask(null);
    }
  }, [gameState.currentQuestion, gameState.currentDare]);

  // Show vote results
  useEffect(() => {
    if (gameState.phase === 'completed' && voteResults) {
      setShowVoteResults(true);
      setTimeout(() => {
        setShowVoteResults(false);
        setVoteResults(null);
      }, 3000);
    }
  }, [gameState.phase, voteResults]);

  const renderSpinner = () => {
    const segments = ['TRUTH', 'DARE', 'PASS', 'DOUBLE'];
    const colors = ['#FF6B6B', '#4ECDC4', '#95E1D3', '#FFD93D'];
    
    return (
      <div className="spinner-container">
        <div className={`spinner ${isSpinning ? 'spinning' : ''}`}>
          {segments.map((segment, index) => (
            <div
              key={segment}
              className="spinner-segment"
              style={{
                backgroundColor: colors[index],
                transform: `rotate(${index * 90}deg)`
              }}
            >
              <span className="segment-text">{segment}</span>
            </div>
          ))}
          <div className="spinner-arrow">▼</div>
        </div>
        {spinResult && !isSpinning && (
          <div className={`spin-result ${spinResult}`}>
            {spinResult.toUpperCase()}!
          </div>
        )}
      </div>
    );
  };

  const renderScoreboard = () => {
    const players = Object.values(gameState.players) as any[];
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="scoreboard">
        <h3>Scoreboard</h3>
        <div className="score-list">
          {sortedPlayers.map((p: any) => (
            <div key={p.id} className={`score-item ${p.id === playerId ? 'current-player' : ''}`}>
              <span className="player-name">{getPlayerName(p.id)}</span>
              <div className="player-stats">
                <span className="score">{p.score} pts</span>
                <span className="passes">🎫 {p.passesRemaining}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="game-info">
          <span>Round: {gameState.round}/{gameState.maxRounds}</span>
          <span>Target: {gameState.targetScore} pts</span>
        </div>
      </div>
    );
  };

  const renderGamePhase = () => {
    switch (gameState.phase) {
      case 'waiting':
        if (isMyTurn) {
          return (
            <div className="phase-content">
              <h2>Your Turn!</h2>
              <p>Spin the wheel to get your challenge</p>
              <button className="spin-button" onClick={handleSpin} disabled={isSpinning}>
                {isSpinning ? 'Spinning...' : 'SPIN THE WHEEL'}
              </button>
              {renderSpinner()}
            </div>
          );
        } else {
          return (
            <div className="phase-content">
              <h2>{getCurrentPlayerName()}'s Turn</h2>
              <p>Waiting for them to spin...</p>
              {renderSpinner()}
            </div>
          );
        }

      case 'choosing':
        if (isMyTurn) {
          return (
            <div className="phase-content">
              <h2>Double Points! Choose Your Challenge</h2>
              <div className="choice-buttons">
                <button className="choice-btn truth" onClick={() => handleChoice('truth')}>
                  TRUTH (2x points)
                </button>
                <button className="choice-btn dare" onClick={() => handleChoice('dare')}>
                  DARE (4x points)
                </button>
              </div>
            </div>
          );
        } else {
          return (
            <div className="phase-content">
              <h2>{getCurrentPlayerName()} is choosing...</h2>
              <p>Double points round!</p>
            </div>
          );
        }

      case 'answering':
        if (isMyTurn) {
          return (
            <div className="phase-content">
              <div className="task-container">
                <h2 className={`task-type ${spinResult}`}>
                  {spinResult?.toUpperCase()}
                </h2>
                <div className="task-text">{currentTask}</div>
                {timeLeft !== null && (
                  <div className="timer">
                    Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                )}
                <div className="action-buttons">
                  <button className="complete-btn" onClick={handleComplete}>
                    I DID IT!
                  </button>
                  <button 
                    className="pass-btn" 
                    onClick={handlePass}
                    disabled={gameState.players[playerId].passesRemaining <= 0}
                  >
                    PASS ({gameState.players[playerId].passesRemaining} left)
                  </button>
                </div>
              </div>
            </div>
          );
        } else {
          return (
            <div className="phase-content">
              <h2>{getCurrentPlayerName()} is doing their {spinResult}!</h2>
              <div className="task-container spectator">
                <div className="task-type">{spinResult?.toUpperCase()}</div>
                <div className="task-text">{currentTask}</div>
              </div>
            </div>
          );
        }

      case 'voting':
        if (isMyTurn) {
          return (
            <div className="phase-content">
              <h2>Waiting for votes...</h2>
              <p>Other players are voting on your performance</p>
              <div className="voting-progress">
                {Object.values(gameState.players).filter((p: any) => p.id !== playerId && p.hasVoted).length} / 
                {Object.values(gameState.players).filter((p: any) => p.id !== playerId).length} voted
              </div>
            </div>
          );
        } else {
          return (
            <div className="phase-content">
              <h2>Did {getCurrentPlayerName()} complete the task?</h2>
              <div className="task-reminder">
                <div className="task-type">{spinResult?.toUpperCase()}</div>
                <div className="task-text">{currentTask}</div>
              </div>
              {!hasVoted ? (
                <div className="vote-buttons">
                  <button className="vote-yes" onClick={() => handleVote(true)}>
                    ✅ YES
                  </button>
                  <button className="vote-no" onClick={() => handleVote(false)}>
                    ❌ NO
                  </button>
                </div>
              ) : (
                <p className="voted-message">Vote submitted! Waiting for others...</p>
              )}
            </div>
          );
        }

      case 'completed':
        return (
          <div className="phase-content">
            {showVoteResults && voteResults && (
              <div className="vote-results">
                <h2>{voteResults.voteResult ? 'Task Approved!' : 'Task Failed!'}</h2>
                <p>✅ {voteResults.approvals} votes | ❌ {voteResults.rejections} votes</p>
                <p>Points earned: {voteResults.pointsEarned}</p>
              </div>
            )}
            <p>Getting ready for next turn...</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="truth-or-dare">
      <div className="game-header">
        <h1>Truth or Dare Spinner</h1>
        <div className="current-turn">
          Current Turn: {getCurrentPlayerName()} {isMyTurn && '(You)'}
        </div>
      </div>

      <div className="game-content">
        <div className="main-area">
          {renderGamePhase()}
        </div>
        
        <div className="sidebar">
          {renderScoreboard()}
        </div>
      </div>
    </div>
  );
}

export default TruthOrDare;