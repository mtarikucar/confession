import RockPaperScissors from './RockPaperScissors/RockPaperScissors';
import DrawingGuess from './DrawingGuess/DrawingGuess';
import WordBattle from './WordBattle/WordBattle';
import TruthOrDare from './TruthOrDare/TruthOrDare';
import './GameContainer.css';

interface GameContainerProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

function GameContainer({ game, socket, room, player, playerId }: GameContainerProps) {
  const renderGame = () => {
    switch (game.type) {
      case 'rock-paper-scissors':
        return (
          <RockPaperScissors 
            game={game} 
            socket={socket}
            room={room}
            player={player} 
            playerId={playerId}
          />
        );
      case 'drawing-guess':
        return (
          <DrawingGuess 
            game={game} 
            socket={socket}
            room={room}
            player={player} 
            playerId={playerId}
          />
        );
      case 'word-battle':
        return (
          <WordBattle 
            game={game} 
            socket={socket}
            room={room}
            player={player} 
            playerId={playerId}
          />
        );
      case 'truth-or-dare':
        return (
          <TruthOrDare 
            game={game} 
            socket={socket}
            room={room}
            player={player} 
            playerId={playerId}
          />
        );
      default:
        return <div>Unknown game type</div>;
    }
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Game: {game.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
        <div className="game-players">
          {game.players.map((pId: string) => {
            const gamePlayer = room?.players.find((p: any) => p.id === pId);
            return (
              <span key={pId} className={pId === playerId ? 'current-player' : ''}>
                {gamePlayer?.nickname || 'Unknown'}
              </span>
            );
          })}
        </div>
      </div>
      <div className="game-content">
        {renderGame()}
      </div>
    </div>
  );
}

export default GameContainer;