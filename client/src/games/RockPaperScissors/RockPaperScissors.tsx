import { useState, useEffect } from 'react';
import './RockPaperScissors.css';

interface RockPaperScissorsProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

const choices = [
  { value: 'rock', emoji: '✊', beats: 'scissors' },
  { value: 'paper', emoji: '✋', beats: 'rock' },
  { value: 'scissors', emoji: '✌️', beats: 'paper' }
];

function RockPaperScissors({ game, socket, room, player, playerId }: RockPaperScissorsProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<string | null>(null);
  const [opponentHasChosen, setOpponentHasChosen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleGameUpdate = (data: any) => {
      if (data.game.id === game.id) {
        const state = data.game.state;
        const myChoice = playerId === game.players[0] ? state.player1Choice : state.player2Choice;
        const theirChoice = playerId === game.players[0] ? state.player2Choice : state.player1Choice;
        
        // Kendi seçimimizi her zaman göster
        if (myChoice) setSelectedChoice(myChoice);
        
        // Karşı tarafın seçim yaptığını göster (ama ne seçtiğini gösterme)
        if (!data.reveal && data.action && data.action.playerId !== playerId) {
          setOpponentHasChosen(true);
        }
        
        // Karşı tarafın seçimini sadece reveal true ise göster
        if (data.reveal && theirChoice) {
          setOpponentChoice(theirChoice);
        }
        
        if (data.tie) {
          setResult('tie');
          setTimeout(() => {
            setSelectedChoice(null);
            setOpponentChoice(null);
            setOpponentHasChosen(false);
            setResult(null);
          }, 2000);
        }
      }
    };

    const handleGameEnded = (data: any) => {
      if (data.winner === playerId) {
        setResult('win');
      } else {
        setResult('lose');
      }
    };

    socket.socket?.on('gameUpdate', handleGameUpdate);
    socket.socket?.on('gameEnded', handleGameEnded);

    return () => {
      socket.socket?.off('gameUpdate', handleGameUpdate);
      socket.socket?.off('gameEnded', handleGameEnded);
    };
  }, [socket, game.id, playerId, game.players]);

  const handleChoice = async (choice: string) => {
    if (selectedChoice || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setSelectedChoice(choice);
      await socket.sendGameAction({ type: 'choice', choice });
    } catch (error) {
      console.error('Failed to send choice:', error);
      setSelectedChoice(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOpponentName = () => {
    const opponentId = game.players.find((id: string) => id !== playerId);
    const opponent = room?.players.find((p: any) => p.id === opponentId);
    return opponent?.nickname || 'Opponent';
  };

  return (
    <div className="rock-paper-scissors">
      <div className="game-status">
        {!selectedChoice && <p>Choose your weapon!</p>}
        {selectedChoice && !opponentChoice && <p>Waiting for {getOpponentName()}...</p>}
        {selectedChoice && opponentChoice && !result && <p>Revealing choices...</p>}
        {result === 'win' && <p className="result-win">You Win! 🎉</p>}
        {result === 'lose' && <p className="result-lose">You Lose! Your confession will be revealed! 😱</p>}
        {result === 'tie' && <p className="result-tie">It's a Tie! Playing again...</p>}
      </div>

      <div className="choices-area">
        <div className="player-section">
          <h3>Your Choice</h3>
          <div className="choices">
            {!selectedChoice ? (
              choices.map(choice => (
                <button
                  key={choice.value}
                  className="choice-btn"
                  onClick={() => handleChoice(choice.value)}
                  disabled={isSubmitting}
                >
                  <span className="choice-emoji">{choice.emoji}</span>
                  <span className="choice-name">{choice.value}</span>
                </button>
              ))
            ) : (
              <div className="selected-choice">
                <span className="choice-emoji large">
                  {choices.find(c => c.value === selectedChoice)?.emoji}
                </span>
                <span className="choice-name">{selectedChoice}</span>
              </div>
            )}
          </div>
        </div>

        <div className="vs">VS</div>

        <div className="player-section">
          <h3>{getOpponentName()}'s Choice</h3>
          <div className="choices">
            {opponentChoice ? (
              <div className="selected-choice">
                <span className="choice-emoji large">
                  {choices.find(c => c.value === opponentChoice)?.emoji}
                </span>
                <span className="choice-name">{opponentChoice}</span>
              </div>
            ) : opponentHasChosen ? (
              <div className="waiting-choice ready">
                <span className="choice-emoji large">✅</span>
                <span className="choice-name">Ready!</span>
              </div>
            ) : (
              <div className="waiting-choice">
                <span className="choice-emoji large">❓</span>
                <span className="choice-name">Choosing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RockPaperScissors;