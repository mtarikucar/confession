import { GameInterface } from './gameInterface.js';

// Word categories with Turkish words
const WORD_CATEGORIES = {
  animals: ['kedi', 'köpek', 'kuş', 'balık', 'fil', 'aslan', 'kaplan', 'zürafa', 'maymun', 'tavşan', 'kaplumbağa', 'timsah'],
  objects: ['masa', 'sandalye', 'telefon', 'bilgisayar', 'kitap', 'kalem', 'araba', 'bisiklet', 'uçak', 'gemi', 'ev', 'ağaç'],
  actions: ['koşmak', 'yürümek', 'atlamak', 'yüzmek', 'uçmak', 'dans', 'okumak', 'yazmak', 'yemek', 'uyumak', 'gülmek', 'ağlamak'],
  food: ['elma', 'muz', 'pizza', 'hamburger', 'pasta', 'dondurma', 'çikolata', 'ekmek', 'peynir', 'domates', 'patates', 'pilav'],
  sports: ['futbol', 'basketbol', 'voleybol', 'tenis', 'yüzme', 'koşu', 'bisiklet', 'kayak', 'boks', 'güreş', 'atletizm', 'golf']
};

export class DrawingGuessGame extends GameInterface {
  constructor(players) {
    const playerIds = players.slice(0, 8);
    super(...playerIds);
    
    this.players = playerIds;
    this.maxPlayers = 8;
    this.roundDuration = 60000; // 60 seconds per round
    this.rounds = playerIds.length; // Each player draws once
    this.currentRound = 0;
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.category = null;
    this.roundStartTime = null;
    this.roundTimer = null;
    this.drawingData = []; // Store drawing strokes
    
    // Points system
    this.pointsForCorrectGuess = 100;
    this.pointsForDrawer = 10; // Points per correct guess
    this.speedBonus = 50; // Extra points for fast guesses
    
    // Initialize player states
    const initialState = {
      players: {},
      currentDrawer: null,
      currentWord: null,
      wordHint: null,
      roundTimeLeft: this.roundDuration / 1000,
      round: 0,
      totalRounds: this.rounds,
      drawingData: [],
      guessedPlayers: [],
      chatMessages: []
    };
    
    playerIds.forEach(playerId => {
      initialState.players[playerId] = {
        score: 0,
        hasGuessed: false,
        isDrawing: false
      };
    });
    
    this.state = initialState;
    this.startNextRound();
  }
  
  startNextRound() {
    if (this.currentRound >= this.rounds) {
      this.endGame();
      return;
    }
    
    // Select drawer
    this.currentDrawerIndex = this.currentRound % this.players.length;
    const drawer = this.players[this.currentDrawerIndex];
    
    // Select random word and category
    const categories = Object.keys(WORD_CATEGORIES);
    this.category = categories[Math.floor(Math.random() * categories.length)];
    const words = WORD_CATEGORIES[this.category];
    this.currentWord = words[Math.floor(Math.random() * words.length)];
    
    // Reset round state
    this.drawingData = [];
    this.roundStartTime = Date.now();
    
    // Update state
    this.state.currentDrawer = drawer;
    this.state.currentWord = this.currentWord; // Only drawer sees this
    this.state.wordHint = this.getWordHint(this.currentWord);
    this.state.round = this.currentRound + 1;
    this.state.roundTimeLeft = this.roundDuration / 1000;
    this.state.drawingData = [];
    this.state.guessedPlayers = [];
    this.state.chatMessages = [];
    
    // Reset player round states
    Object.keys(this.state.players).forEach(playerId => {
      this.state.players[playerId].hasGuessed = false;
      this.state.players[playerId].isDrawing = playerId === drawer;
    });
    
    // Start round timer
    this.startRoundTimer();
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
  }
  
  getWordHint(word) {
    // Show word length with underscores
    return word.split('').map(char => char === ' ' ? ' ' : '_').join(' ');
  }
  
  startRoundTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
    }
    
    this.roundTimer = setInterval(() => {
      const elapsed = Date.now() - this.roundStartTime;
      const timeLeft = Math.max(0, this.roundDuration - elapsed) / 1000;
      
      this.state.roundTimeLeft = Math.ceil(timeLeft);
      
      if (timeLeft <= 0) {
        this.endRound();
      } else if (this.onStateUpdate) {
        this.onStateUpdate(this.getState());
      }
    }, 1000);
  }
  
  endRound() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Add message revealing the word
    this.state.chatMessages.push({
      type: 'system',
      message: `Kelime "${this.currentWord}" idi!`,
      timestamp: Date.now()
    });
    
    this.currentRound++;
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
    
    // Start next round after a delay
    setTimeout(() => {
      this.startNextRound();
    }, 3000);
  }
  
  processAction(playerId, action) {
    if (this.finished) {
      return { success: false, error: 'Game is finished' };
    }
    
    switch (action.type) {
      case 'draw':
        return this.handleDraw(playerId, action.data);
      
      case 'guess':
        return this.handleGuess(playerId, action.guess);
      
      case 'clear':
        return this.handleClearCanvas(playerId);
      
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }
  
  handleDraw(playerId, drawData) {
    // Only the current drawer can draw
    if (playerId !== this.state.currentDrawer) {
      return { success: false, error: 'You are not the drawer' };
    }
    
    // Add drawing data
    this.drawingData.push(drawData);
    this.state.drawingData.push(drawData);
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
    
    return { success: true };
  }
  
  handleClearCanvas(playerId) {
    // Only the current drawer can clear
    if (playerId !== this.state.currentDrawer) {
      return { success: false, error: 'You are not the drawer' };
    }
    
    this.drawingData = [];
    this.state.drawingData = [];
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
    
    return { success: true };
  }
  
  handleGuess(playerId, guess) {
    // Drawer cannot guess
    if (playerId === this.state.currentDrawer) {
      return { success: false, error: 'You are drawing!' };
    }
    
    // Player already guessed correctly
    if (this.state.players[playerId].hasGuessed) {
      return { success: false, error: 'You already guessed correctly' };
    }
    
    // Normalize guess for comparison
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = this.currentWord.toLowerCase().trim();
    
    // Check if guess is correct
    if (normalizedGuess === normalizedWord) {
      // Calculate points
      const elapsed = Date.now() - this.roundStartTime;
      const timeBonus = elapsed < 30000 ? this.speedBonus : 0;
      const points = this.pointsForCorrectGuess + timeBonus;
      
      // Update guesser's score
      this.state.players[playerId].score += points;
      this.state.players[playerId].hasGuessed = true;
      
      // Update drawer's score
      this.state.players[this.state.currentDrawer].score += this.pointsForDrawer;
      
      // Add to guessed players
      this.state.guessedPlayers.push(playerId);
      
      // Add success message
      this.state.chatMessages.push({
        type: 'success',
        playerId: playerId,
        message: `doğru tahmin etti! (+${points} puan)`,
        timestamp: Date.now()
      });
      
      // Check if everyone has guessed
      const activeGuessers = this.players.filter(p => p !== this.state.currentDrawer);
      const allGuessed = activeGuessers.every(p => this.state.players[p].hasGuessed);
      
      if (allGuessed) {
        this.endRound();
      } else if (this.onStateUpdate) {
        this.onStateUpdate(this.getState());
      }
      
      return { success: true, correct: true, points };
    } else {
      // Wrong guess - add to chat
      this.state.chatMessages.push({
        type: 'guess',
        playerId: playerId,
        message: guess,
        timestamp: Date.now()
      });
      
      if (this.onStateUpdate) {
        this.onStateUpdate(this.getState());
      }
      
      return { success: true, correct: false };
    }
  }
  
  endGame() {
    this.finished = true;
    
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Calculate rankings
    const rankings = Object.entries(this.state.players)
      .map(([playerId, data]) => ({
        playerId,
        score: data.score
      }))
      .sort((a, b) => b.score - a.score);
    
    this.winner = rankings[0]?.playerId || null;
    
    // Notify game end
    if (this.onGameEnd) {
      this.onGameEnd({
        winner: this.winner,
        rankings,
        finalScores: this.state.players
      });
    }
  }
  
  getState() {
    // Return full state - filtering will be done server-side
    return this.state;
  }
  
  cleanup() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
}