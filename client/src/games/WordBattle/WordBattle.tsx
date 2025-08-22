import { useState, useEffect } from 'react';
import './WordBattle.css';

interface WordBattleProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

function WordBattle({ game, socket, room, player, playerId }: WordBattleProps) {
  const [wordInput, setWordInput] = useState('');
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameState, setGameState] = useState(game.state || {});
  const letters = gameState.letters || [];
  const roundTimeLeft = gameState.roundTimeLeft || 0;
  const currentRound = gameState.round || 1;
  const totalRounds = gameState.totalRounds || 3;
  const playerData = gameState.players?.[playerId] || { score: 0, wordsFound: [] };
  const recentSubmissions = gameState.recentSubmissions || [];
  const usedWords = gameState.usedWords || [];
  
  // Update game state when it changes
  useEffect(() => {
    setGameState(game.state || {});
  }, [game.state, game]);
  
  useEffect(() => {
    // Reset selected letters when round changes
    setSelectedLetters([]);
    setWordInput('');
    setIsSubmitting(false);
  }, [currentRound]);
  
  const handleLetterClick = (index: number) => {
    if (selectedLetters.includes(index)) {
      // Remove letter
      const newSelected = selectedLetters.filter(i => i !== index);
      setSelectedLetters(newSelected);
      
      // Update word input
      const newWord = newSelected.map(i => letters[i]).join('');
      setWordInput(newWord);
    } else {
      // Add letter
      const newSelected = [...selectedLetters, index];
      setSelectedLetters(newSelected);
      
      // Update word input
      const newWord = newSelected.map(i => letters[i]).join('');
      setWordInput(newWord);
    }
  };
  
  const handleClear = () => {
    setSelectedLetters([]);
    setWordInput('');
  };
  
  const handleSubmit = async () => {
    if (wordInput.length < 3 || isSubmitting) return;
    
    setIsSubmitting(true);
    
    console.log('Submitting word:', wordInput);
    
    try {
      const result = await socket.sendGameAction({
        type: 'submitWord',
        word: wordInput
      });
      
      console.log('Result received:', result);
      
      if (result && result.success) {
        // Clear input after successful submission
        handleClear();
        console.log(`Word accepted! Earned ${result.points} points`);
      }
      setIsSubmitting(false);
    } catch (error: any) {
      console.error('Error submitting word:', error);
      setIsSubmitting(false);
      // Show error to user
      alert(error.message || 'Kelime gönderilemedi');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getPointsForLength = (length: number) => {
    if (length >= 8) return 10;
    const pointsMap: { [key: number]: number } = {
      3: 1,
      4: 2,
      5: 3,
      6: 5,
      7: 7
    };
    return pointsMap[length] || Math.max(1, length - 2);
  };
  
  return (
    <div className="word-battle-container">
      <div className="game-header">
        <div className="round-info">
          Round {currentRound} / {totalRounds}
        </div>
        <div className="timer" data-time={roundTimeLeft}>
          {formatTime(roundTimeLeft)}
        </div>
        <div className="player-score">
          Skor: <span className="score-value">{playerData.score}</span>
        </div>
      </div>
      
      <div className="game-area">
        <div className="main-section">
          <div className="letters-grid">
            {letters.map((letter: string, index: number) => (
              <button
                key={index}
                className={`letter-btn ${selectedLetters.includes(index) ? 'selected' : ''}`}
                onClick={() => handleLetterClick(index)}
                disabled={isSubmitting}
              >
                {letter.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div className="word-input-section">
            <input
              type="text"
              value={wordInput.toUpperCase()}
              readOnly
              placeholder="Harflere tıklayarak kelime oluştur..."
              className="word-display"
              onKeyDown={handleKeyPress}
            />
            <div className="word-controls">
              <button 
                className="clear-btn" 
                onClick={handleClear}
                disabled={isSubmitting || wordInput.length === 0}
              >
                Temizle
              </button>
              <button 
                className="submit-btn" 
                onClick={handleSubmit}
                disabled={isSubmitting || wordInput.length < 3}
              >
                Gönder {wordInput.length >= 3 && `(+${getPointsForLength(wordInput.length)})`}
              </button>
            </div>
          </div>
          
          <div className="points-info">
            <h4>Puan Tablosu</h4>
            <div className="points-grid">
              <span>3 harf: 1 puan</span>
              <span>4 harf: 2 puan</span>
              <span>5 harf: 3 puan</span>
              <span>6 harf: 5 puan</span>
              <span>7 harf: 7 puan</span>
              <span>8+ harf: 10 puan</span>
            </div>
          </div>
        </div>
        
        <div className="sidebar">
          <div className="scoreboard">
            <h3>Skor Tablosu</h3>
            {Object.entries(gameState.players || {}).map(([pId, player]: [string, any]) => (
              <div key={pId} className={`score-item ${pId === playerId ? 'current' : ''}`}>
                <span className="player-name">
                  {room?.players.find((p: any) => p.id === pId)?.nickname || 'Unknown'}
                </span>
                <span className="player-stats">
                  {player.wordsFound.length} kelime
                </span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
          </div>
          
          <div className="submissions-section">
            <h3>Son Gönderimler</h3>
            <div className="submissions-list">
              {recentSubmissions.map((sub: any, index: number) => (
                <div key={index} className={`submission-item ${sub.type}`}>
                  {sub.type === 'roundEnd' ? (
                    <span className="round-end">{sub.message}</span>
                  ) : (
                    <>
                      <span className="submission-player">
                        {room?.players.find((p: any) => p.id === sub.playerId)?.nickname}:
                      </span>
                      <span className="submission-word">{sub.word}</span>
                      <span className={`submission-result ${sub.type}`}>
                        {sub.message}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="used-words">
            <h3>Kullanılan Kelimeler ({usedWords.length})</h3>
            <div className="words-list">
              {usedWords.map((word: string, index: number) => (
                <span key={index} className="used-word">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="my-words">
        <h4>Bulduğun Kelimeler ({playerData.wordsFound.length})</h4>
        <div className="my-words-list">
          {playerData.wordsFound.map((word: string, index: number) => (
            <span key={index} className="my-word">
              {word} <span className="word-points">+{getPointsForLength(word.length)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WordBattle;