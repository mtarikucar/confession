import { useState, useRef, useEffect } from 'react';
import './DrawingGuess.css';

interface DrawingGuessProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

interface Point {
  x: number;
  y: number;
}

interface DrawingStroke {
  points: Point[];
  color: string;
  lineWidth: number;
}

function DrawingGuess({ game, socket, room, player, playerId }: DrawingGuessProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentLineWidth, setCurrentLineWidth] = useState(3);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [guess, setGuess] = useState('');
  const [guessInput, setGuessInput] = useState('');
  
  const gameState = game.state || {};
  const isDrawer = gameState.currentDrawer === playerId;
  const hasGuessed = gameState.players?.[playerId]?.hasGuessed || false;
  const currentWord = isDrawer ? gameState.currentWord : null;
  const wordHint = gameState.wordHint || '';
  const roundTimeLeft = gameState.roundTimeLeft || 0;
  const currentRound = gameState.round || 1;
  const totalRounds = gameState.totalRounds || 1;
  
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#FFC0CB', '#A52A2A', '#808080'
  ];
  
  const lineWidths = [1, 3, 5, 8, 12];
  
  useEffect(() => {
    // Redraw canvas when drawing data updates
    if (canvasRef.current && gameState.drawingData) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set canvas quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Redraw all strokes
      gameState.drawingData.forEach((stroke: DrawingStroke) => {
        if (stroke.points && stroke.points.length > 0) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          
          ctx.stroke();
        }
      });
      
      // Redraw current stroke if drawing
      if (isDrawing && currentStroke.length > 0) {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
        
        for (let i = 1; i < currentStroke.length; i++) {
          ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
        }
        
        ctx.stroke();
      }
    }
  }, [gameState.drawingData, currentStroke, isDrawing, currentColor, currentLineWidth]);
  
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scaling factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Apply scaling to get correct canvas coordinates
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !canvasRef.current) return;
    
    e.preventDefault(); // Prevent scrolling on touch devices
    const { x, y } = getMousePos(e);
    
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawer || !canvasRef.current) return;
    
    e.preventDefault();
    const { x, y } = getMousePos(e);
    
    const newStroke = [...currentStroke, { x, y }];
    setCurrentStroke(newStroke);
    
    // Draw on local canvas immediately for smooth experience
    const ctx = canvasRef.current.getContext('2d');
    if (ctx && currentStroke.length > 0) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };
  
  const stopDrawing = () => {
    if (!isDrawing || !isDrawer) return;
    
    setIsDrawing(false);
    
    // Send stroke to server
    if (currentStroke.length > 1) {
      socket.sendGameAction({
        type: 'draw',
        data: {
          points: currentStroke,
          color: currentColor,
          lineWidth: currentLineWidth
        }
      });
    }
    
    setCurrentStroke([]);
  };
  
  const clearCanvas = () => {
    if (!isDrawer) return;
    
    socket.sendGameAction({
      type: 'clear'
    });
    
    // Clear local canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };
  
  const submitGuess = () => {
    if (!guessInput.trim() || isDrawer || hasGuessed) return;
    
    socket.sendGameAction({
      type: 'guess',
      guess: guessInput.trim()
    });
    
    setGuessInput('');
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="drawing-guess-container">
      <div className="game-info">
        <div className="round-info">
          Round {currentRound} / {totalRounds}
        </div>
        <div className="timer" data-time={roundTimeLeft}>
          {formatTime(roundTimeLeft)}
        </div>
        <div className="word-hint">
          {isDrawer ? (
            <div className="drawer-word">
              <strong>Çiz:</strong> {currentWord}
            </div>
          ) : (
            <div className="guesser-hint">
              <strong>Tahmin Et:</strong> {wordHint}
            </div>
          )}
        </div>
      </div>
      
      <div className="game-area">
        <div className="drawing-section">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className={`drawing-canvas ${isDrawer ? 'drawable' : ''}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
          
          {isDrawer && (
            <div className="drawing-tools">
              <div className="color-palette">
                {colors.map(color => (
                  <button
                    key={color}
                    className={`color-btn ${currentColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCurrentColor(color)}
                  />
                ))}
              </div>
              
              <div className="line-widths">
                {lineWidths.map(width => (
                  <button
                    key={width}
                    className={`width-btn ${currentLineWidth === width ? 'active' : ''}`}
                    onClick={() => setCurrentLineWidth(width)}
                  >
                    <div 
                      className="width-preview" 
                      style={{ 
                        height: `${width}px`,
                        backgroundColor: currentColor
                      }}
                    />
                  </button>
                ))}
              </div>
              
              <button className="clear-btn" onClick={clearCanvas}>
                Temizle
              </button>
            </div>
          )}
        </div>
        
        <div className="sidebar">
          <div className="scores">
            <h3>Skorlar</h3>
            {Object.entries(gameState.players || {}).map(([pId, player]: [string, any]) => (
              <div key={pId} className={`score-item ${pId === playerId ? 'current' : ''}`}>
                <span className="player-name">
                  {pId === gameState.currentDrawer && '🎨 '}
                  {player.hasGuessed && '✅ '}
                  {room?.players.find((p: any) => p.id === pId)?.nickname || 'Unknown'}
                </span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
          </div>
          
          <div className="chat-section">
            <div className="chat-messages">
              {(gameState.chatMessages || []).map((msg: any, index: number) => (
                <div key={index} className={`chat-message ${msg.type}`}>
                  {msg.type === 'system' ? (
                    <span className="system-msg">{msg.message}</span>
                  ) : msg.type === 'success' ? (
                    <span className="success-msg">
                      {room?.players.find((p: any) => p.id === msg.playerId)?.nickname} {msg.message}
                    </span>
                  ) : (
                    <span className="guess-msg">
                      <strong>{room?.players.find((p: any) => p.id === msg.playerId)?.nickname}:</strong> {msg.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {!isDrawer && !hasGuessed && (
              <div className="guess-input">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                  placeholder="Tahmininizi yazın..."
                />
                <button onClick={submitGuess}>Gönder</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawingGuess;