import { GameInterface } from './gameInterface.js';

export class TruthOrDareGame extends GameInterface {
  constructor(players) {
    const playerIds = players.slice(0, 8);
    super(...playerIds);
    
    this.players = playerIds;
    this.maxPlayers = 8;
    
    // Load questions and dares
    this.loadQuestionsAndDares();
    
    // Initialize game state
    this.state = {
      players: {},
      currentPlayerIndex: 0,
      currentPlayer: playerIds[0],
      spinResult: null,
      currentQuestion: null,
      currentDare: null,
      phase: 'waiting', // waiting, spinning, choosing, answering, voting, completed
      votes: {},
      scores: {},
      round: 1,
      maxRounds: 10,
      targetScore: 15,
      passesUsed: {},
      timeLimit: 60000, // 60 seconds for truth, 120 for dare
      roundStartTime: Date.now(),
      usedTruths: [],
      usedDares: [],
      spinHistory: []
    };
    
    // Initialize player states
    playerIds.forEach(playerId => {
      this.state.players[playerId] = {
        id: playerId,
        score: 0,
        passesRemaining: 2,
        hasVoted: false,
        isActive: true,
        truthsCompleted: 0,
        daresCompleted: 0,
        currentAction: null
      };
      this.state.scores[playerId] = 0;
      this.state.passesUsed[playerId] = 0;
    });
  }
  
  loadQuestionsAndDares() {
    // Use fallback questions directly - file loading causing issues
    console.log('Loading Truth or Dare questions...');
    
    // Fallback questions - Turkish
      this.truths = [
        "En utanç verici anın neydi?",
        "Bu odadaki en çekici kişi kim?",
        "Söylediğin en büyük yalan neydi?",
        "En büyük korkun nedir?",
        "Kimseye söylemediğin bir sırrın var mı?",
        "Hiç bir ilişkide aldattın mı?",
        "Hala yaptığın en çocukça şey nedir?",
        "En kötü alışkanlığın nedir?",
        "İlk aşkın kimdi?",
        "Hayatında yaptığın en cesur şey neydi?",
        "Hiç yasadışı bir şey yaptın mı?",
        "En son ne zaman ağladın ve neden?",
        "Telefondaki en utanç verici fotoğraf hangisi?",
        "En garip takıntın nedir?",
        "En son kime kıskançlık duydun?"
      ];
      
      this.dares = [
        "10 şınav çek",
        "30 saniye boyunca bir şarkı söyle",
        "En iyi dans hareketini yap",
        "Birinin taklitini yap, diğerleri tahmin etsin",
        "30 saniye tavuk taklidi yap",
        "Bir fıkra anlat",
        "3 tur boyunca aksanlı konuş",
        "Amuda kalk",
        "2 tur boyunca kafiyeli konuş",
        "30 saniye robot dansı yap",
        "Ayaklarınla isim yaz",
        "30 saniye maymun taklidi yap",
        "Alfabeyi tersten söyle",
        "30 saniye boyunca tek ayak üzerinde dur",
        "5 farklı hayvan sesi çıkar"
      ];
  }
  
  processAction(playerId, action) {
    if (!this.state.players[playerId]) {
      return { success: false, error: 'Player not in game' };
    }
    
    const player = this.state.players[playerId];
    
    switch (action.type) {
      case 'spin':
        if (this.state.currentPlayer !== playerId || this.state.phase !== 'waiting') {
          return { success: false, error: 'Not your turn or wrong phase' };
        }
        return this.spinWheel(playerId);
      
      case 'choose':
        if (this.state.currentPlayer !== playerId || this.state.phase !== 'choosing') {
          return { success: false, error: 'Not your turn or wrong phase' };
        }
        return this.makeChoice(playerId, action.choice);
      
      case 'complete':
        if (this.state.currentPlayer !== playerId || this.state.phase !== 'answering') {
          return { success: false, error: 'Not your turn or wrong phase' };
        }
        return this.completeTask(playerId);
      
      case 'pass':
        if (this.state.currentPlayer !== playerId || this.state.phase !== 'answering') {
          return { success: false, error: 'Not your turn or wrong phase' };
        }
        return this.usePass(playerId);
      
      case 'vote':
        if (this.state.phase !== 'voting') {
          return { success: false, error: 'Not voting phase' };
        }
        return this.castVote(playerId, action.vote);
      
      default:
        return { success: false, error: 'Invalid action type' };
    }
  }
  
  spinWheel(playerId) {
    // Simulate wheel spin with weighted probabilities
    const options = [
      { type: 'truth', weight: 40 },
      { type: 'dare', weight: 40 },
      { type: 'pass', weight: 10 },
      { type: 'double', weight: 10 }
    ];
    
    const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
    let random = Math.random() * totalWeight;
    
    let result = null;
    for (const option of options) {
      random -= option.weight;
      if (random <= 0) {
        result = option.type;
        break;
      }
    }
    
    this.state.spinResult = result;
    this.state.spinHistory.push({
      player: playerId,
      result: result,
      round: this.state.round
    });
    
    // Auto-handle special results
    if (result === 'pass') {
      // Free pass - skip turn
      this.state.phase = 'completed';
      
      // Notify state update
      if (this.onStateUpdate) {
        this.onStateUpdate(this.state);
      }
      
      setTimeout(() => {
        this.nextTurn();
      }, 2000);
      return {
        success: true,
        spinResult: 'pass',
        message: 'Free pass! Your turn is skipped.'
      };
    } else if (result === 'double') {
      // Double points for next task
      this.state.players[playerId].doublePoints = true;
      this.state.phase = 'choosing';
      return {
        success: true,
        spinResult: 'double',
        message: 'Double points! Choose Truth or Dare for double points.'
      };
    } else {
      // Truth or Dare
      this.state.phase = 'answering';
      
      if (result === 'truth') {
        this.assignTruth(playerId);
      } else {
        this.assignDare(playerId);
      }
      
      return {
        success: true,
        spinResult: result,
        question: this.state.currentQuestion,
        dare: this.state.currentDare,
        timeLimit: result === 'truth' ? 60 : 120
      };
    }
  }
  
  makeChoice(playerId, choice) {
    if (choice !== 'truth' && choice !== 'dare') {
      return { success: false, error: 'Invalid choice' };
    }
    
    this.state.phase = 'answering';
    
    if (choice === 'truth') {
      this.assignTruth(playerId);
      this.state.timeLimit = 60000;
    } else {
      this.assignDare(playerId);
      this.state.timeLimit = 120000;
    }
    
    return {
      success: true,
      choice: choice,
      question: this.state.currentQuestion,
      dare: this.state.currentDare,
      timeLimit: this.state.timeLimit / 1000
    };
  }
  
  assignTruth(playerId) {
    // Get a random truth that hasn't been used
    const availableTruths = this.truths.filter(t => !this.state.usedTruths.includes(t));
    
    if (availableTruths.length === 0) {
      // Reset if all truths have been used
      this.state.usedTruths = [];
      availableTruths.push(...this.truths);
    }
    
    const truth = availableTruths[Math.floor(Math.random() * availableTruths.length)];
    this.state.currentQuestion = truth;
    this.state.usedTruths.push(truth);
    this.state.players[playerId].currentAction = 'truth';
  }
  
  assignDare(playerId) {
    // Get a random dare that hasn't been used
    const availableDares = this.dares.filter(d => !this.state.usedDares.includes(d));
    
    if (availableDares.length === 0) {
      // Reset if all dares have been used
      this.state.usedDares = [];
      availableDares.push(...this.dares);
    }
    
    const dare = availableDares[Math.floor(Math.random() * availableDares.length)];
    this.state.currentDare = dare;
    this.state.usedDares.push(dare);
    this.state.players[playerId].currentAction = 'dare';
  }
  
  completeTask(playerId) {
    const player = this.state.players[playerId];
    
    // Start voting phase
    this.state.phase = 'voting';
    this.state.votes = {};
    
    // Reset voting status for all players except current player
    Object.values(this.state.players).forEach(p => {
      if (p.id !== playerId) {
        p.hasVoted = false;
      }
    });
    
    return {
      success: true,
      phase: 'voting',
      message: 'Task completed! Other players are voting...'
    };
  }
  
  usePass(playerId) {
    const player = this.state.players[playerId];
    
    if (player.passesRemaining <= 0) {
      return { success: false, error: 'No passes remaining' };
    }
    
    player.passesRemaining--;
    this.state.passesUsed[playerId]++;
    player.score = Math.max(0, player.score - 1);
    this.state.scores[playerId] = player.score;
    
    this.state.phase = 'completed';
    this.nextTurn();
    
    return {
      success: true,
      passesRemaining: player.passesRemaining,
      message: 'Pass used! -1 point'
    };
  }
  
  castVote(playerId, vote) {
    if (playerId === this.state.currentPlayer) {
      return { success: false, error: 'Cannot vote for yourself' };
    }
    
    const player = this.state.players[playerId];
    if (player.hasVoted) {
      return { success: false, error: 'Already voted' };
    }
    
    player.hasVoted = true;
    this.state.votes[playerId] = vote;
    
    // Check if all players have voted
    const otherPlayers = Object.values(this.state.players)
      .filter(p => p.id !== this.state.currentPlayer && p.isActive);
    const allVoted = otherPlayers.every(p => p.hasVoted);
    
    if (allVoted) {
      return this.resolveVotes();
    }
    
    return {
      success: true,
      voted: true,
      waitingFor: otherPlayers.filter(p => !p.hasVoted).length
    };
  }
  
  resolveVotes() {
    const currentPlayer = this.state.players[this.state.currentPlayer];
    const votes = Object.values(this.state.votes);
    const approvals = votes.filter(v => v === true).length;
    const rejections = votes.filter(v => v === false).length;
    
    let pointsEarned = 0;
    let success = approvals > rejections;
    
    if (success) {
      // Task completed successfully
      if (currentPlayer.currentAction === 'truth') {
        pointsEarned = 1;
        currentPlayer.truthsCompleted++;
      } else if (currentPlayer.currentAction === 'dare') {
        pointsEarned = 2;
        currentPlayer.daresCompleted++;
      }
      
      // Apply double points if active
      if (currentPlayer.doublePoints) {
        pointsEarned *= 2;
        currentPlayer.doublePoints = false;
      }
      
      currentPlayer.score += pointsEarned;
      this.state.scores[this.state.currentPlayer] = currentPlayer.score;
    }
    
    // Check win condition
    if (currentPlayer.score >= this.state.targetScore) {
      this.finished = true;
      this.winner = this.state.currentPlayer;
      
      const rankings = this.calculateRankings();
      
      return {
        success: true,
        finished: true,
        winner: this.winner,
        finalScores: this.state.scores,
        rankings: rankings
      };
    }
    
    // Check if max rounds reached
    if (this.state.round >= this.state.maxRounds) {
      return this.endGameByScore();
    }
    
    // Continue to next turn
    this.state.phase = 'completed';
    const result = {
      success: true,
      voteResult: success,
      pointsEarned: pointsEarned,
      approvals: approvals,
      rejections: rejections,
      scores: this.state.scores
    };
    
    // Notify state update for completed phase
    if (this.onStateUpdate) {
      this.onStateUpdate(this.state);
    }
    
    setTimeout(() => {
      this.nextTurn();
    }, 3000);
    
    return result;
  }
  
  nextTurn() {
    console.log('TruthOrDare: nextTurn() called');
    
    // Clear current task
    this.state.currentQuestion = null;
    this.state.currentDare = null;
    this.state.spinResult = null;
    this.state.votes = {};
    
    // Move to next player
    const activePlayers = this.state.players;
    const activePlayerIds = Object.keys(activePlayers).filter(id => activePlayers[id].isActive);
    
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % activePlayerIds.length;
    this.state.currentPlayer = activePlayerIds[this.state.currentPlayerIndex];
    
    // Increment round when all players have had a turn
    if (this.state.currentPlayerIndex === 0) {
      this.state.round++;
    }
    
    this.state.phase = 'waiting';
    this.state.roundStartTime = Date.now();
    
    // Reset player action
    Object.values(this.state.players).forEach(p => {
      p.currentAction = null;
      p.hasVoted = false;
    });
    
    console.log('TruthOrDare: phase changed to waiting, current player:', this.state.currentPlayer);
    
    // Notify state update
    if (this.onStateUpdate) {
      console.log('TruthOrDare: calling onStateUpdate');
      this.onStateUpdate(this.state);
    } else {
      console.log('TruthOrDare: onStateUpdate not set!');
    }
  }
  
  endGameByScore() {
    const rankings = this.calculateRankings();
    const topScore = Math.max(...Object.values(this.state.scores));
    const winners = Object.keys(this.state.scores)
      .filter(id => this.state.scores[id] === topScore);
    
    this.finished = true;
    
    if (winners.length === 1) {
      this.winner = winners[0];
      return {
        success: true,
        finished: true,
        winner: this.winner,
        finalScores: this.state.scores,
        rankings: rankings
      };
    } else {
      return {
        success: true,
        finished: true,
        draw: true,
        winners: winners,
        finalScores: this.state.scores,
        rankings: rankings
      };
    }
  }
  
  calculateRankings() {
    return Object.values(this.state.players)
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        playerId: player.id,
        position: index + 1,
        score: player.score,
        truthsCompleted: player.truthsCompleted,
        daresCompleted: player.daresCompleted,
        passesUsed: this.state.passesUsed[player.id] || 0
      }));
  }
  
  getState() {
    return {
      ...this.state,
      gameOver: this.finished,
      winner: this.winner
    };
  }
}