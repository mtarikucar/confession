import { GameInterface } from './gameInterface.js';

export class RockPaperScissorsGame extends GameInterface {
  constructor(players) {
    // Maksimum 8 oyuncu desteği
    const playerIds = players.slice(0, 8);
    super(...playerIds);
    
    this.players = playerIds;
    this.maxPlayers = 8;
    
    // Oyun modları: 'elimination' (eleme), 'tournament' (turnuva), 'battle-royale' (herkes herkese)
    this.gameMode = players.length > 2 ? 'battle-royale' : 'classic';
    
    // Başlangıç durumu
    this.state = {
      players: {},
      currentRound: 1,
      maxRounds: 5, // Battle royale için maksimum tur sayısı
      roundChoices: {},
      scores: {},
      eliminated: [],
      powerUps: {},
      specialMoves: ['rock', 'paper', 'scissors', 'lizard', 'spock'], // Genişletilmiş seçenekler
      useSpecialMoves: players.length > 4, // 4+ oyuncu için özel hamleler
      roundTimeLimit: 30000, // 30 saniye
      roundStartTime: Date.now(),
      tournamentBracket: null,
      currentMatches: [],
      champions: []
    };
    
    // Her oyuncu için başlangıç durumu
    playerIds.forEach(playerId => {
      this.state.players[playerId] = {
        id: playerId,
        choice: null,
        ready: false,
        lives: 3, // Battle royale için can sayısı
        score: 0,
        streak: 0,
        powerUps: {
          shield: 1, // Bir kaybı yok sayma
          peek: 1, // Rakiplerin seçimini görme
          change: 1 // Son anda seçim değiştirme
        },
        eliminated: false,
        rank: null
      };
      this.state.scores[playerId] = 0;
    });
    
    // Turnuva modu için bracket oluştur
    if (this.gameMode === 'tournament' && players.length >= 4) {
      this.createTournamentBracket();
    }
  }
  
  createTournamentBracket() {
    // Turnuva eşleşmelerini oluştur
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    const matches = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        matches.push({
          player1: shuffled[i],
          player2: shuffled[i + 1],
          winner: null
        });
      } else {
        // Tek oyuncu varsa direkt sonraki tura geçer
        this.state.champions.push(shuffled[i]);
      }
    }
    
    this.state.currentMatches = matches;
    this.state.tournamentBracket = {
      currentRound: 1,
      totalRounds: Math.ceil(Math.log2(this.players.length)),
      matches: matches
    };
  }

  processAction(playerId, action) {
    if (!this.state.players[playerId]) {
      return { success: false, error: 'Player not in game' };
    }
    
    const player = this.state.players[playerId];
    
    if (player.eliminated) {
      return { success: false, error: 'Player is eliminated' };
    }
    
    switch (action.type) {
      case 'choice':
        return this.processChoice(playerId, action.choice);
      
      case 'usePowerUp':
        return this.usePowerUp(playerId, action.powerUp, action.data);
      
      case 'ready':
        player.ready = true;
        return { success: true, state: this.state };
      
      default:
        return { success: false, error: 'Invalid action type' };
    }
  }
  
  processChoice(playerId, choice) {
    const player = this.state.players[playerId];
    const validChoices = this.state.useSpecialMoves 
      ? this.state.specialMoves 
      : ['rock', 'paper', 'scissors'];
    
    if (!validChoices.includes(choice)) {
      return { success: false, error: 'Invalid choice' };
    }
    
    player.choice = choice;
    this.state.roundChoices[playerId] = choice;
    
    // Tüm aktif oyuncular seçim yaptı mı kontrol et
    const activePlayers = Object.values(this.state.players).filter(p => !p.eliminated);
    const allChosen = activePlayers.every(p => p.choice !== null);
    
    console.log('RockPaperScissors - processChoice:', {
      playerId,
      choice,
      allPlayers: Object.keys(this.state.players),
      choices: Object.keys(this.state.players).map(id => ({
        id,
        choice: this.state.players[id].choice
      })),
      activePlayers: activePlayers.length,
      allChosen,
      gameMode: this.gameMode
    });
    
    if (allChosen) {
      if (this.gameMode === 'battle-royale') {
        return this.resolveBattleRoyaleRound();
      } else if (this.gameMode === 'tournament') {
        return this.resolveTournamentRound();
      } else {
        return this.resolveClassicRound();
      }
    }
    
    return { 
      success: true, 
      finished: false,
      waitingFor: activePlayers.filter(p => p.choice === null).map(p => p.id)
    };
  }
  
  usePowerUp(playerId, powerUpType, data) {
    const player = this.state.players[playerId];
    
    if (!player.powerUps[powerUpType] || player.powerUps[powerUpType] <= 0) {
      return { success: false, error: 'No power-up available' };
    }
    
    switch (powerUpType) {
      case 'shield':
        player.shieldActive = true;
        player.powerUps.shield--;
        break;
      
      case 'peek':
        // Rastgele bir rakibin seçimini göster
        const opponents = Object.values(this.state.players)
          .filter(p => p.id !== playerId && !p.eliminated && p.choice);
        if (opponents.length > 0) {
          const target = opponents[Math.floor(Math.random() * opponents.length)];
          player.powerUps.peek--;
          return {
            success: true,
            peek: { playerId: target.id, choice: target.choice }
          };
        }
        break;
      
      case 'change':
        if (player.choice && data.newChoice) {
          player.choice = data.newChoice;
          this.state.roundChoices[playerId] = data.newChoice;
          player.powerUps.change--;
        }
        break;
    }
    
    return { success: true, state: this.state };
  }
  
  resolveBattleRoyaleRound() {
    const choices = this.state.roundChoices;
    const results = {};
    const roundWinners = [];
    const roundLosers = [];
    
    // Her oyuncunun diğer tüm oyuncularla karşılaştırması
    Object.keys(choices).forEach(playerId => {
      if (this.state.players[playerId].eliminated) return;
      
      let wins = 0;
      let losses = 0;
      
      Object.keys(choices).forEach(opponentId => {
        if (playerId === opponentId || this.state.players[opponentId].eliminated) return;
        
        const result = this.compareChoices(choices[playerId], choices[opponentId]);
        if (result === 1) wins++;
        else if (result === -1) losses++;
      });
      
      results[playerId] = { wins, losses };
      
      // Skor güncelleme
      this.state.players[playerId].score += wins;
      this.state.scores[playerId] += wins;
      
      // Can kaybı kontrolü
      if (losses > wins && !this.state.players[playerId].shieldActive) {
        this.state.players[playerId].lives--;
        if (this.state.players[playerId].lives <= 0) {
          this.state.players[playerId].eliminated = true;
          this.state.eliminated.push(playerId);
        }
      }
      
      // Shield kullanıldıysa deaktive et
      this.state.players[playerId].shieldActive = false;
      
      // Streak güncelleme
      if (wins > losses) {
        this.state.players[playerId].streak++;
        roundWinners.push(playerId);
        
        // Uzun streak için bonus power-up
        if (this.state.players[playerId].streak >= 3) {
          this.grantRandomPowerUp(playerId);
        }
      } else {
        this.state.players[playerId].streak = 0;
        roundLosers.push(playerId);
      }
    });
    
    // Yeni round hazırlığı
    this.resetRound();
    this.state.currentRound++;
    
    // Kazanan kontrolü (son kalan)
    const activePlayers = Object.values(this.state.players).filter(p => !p.eliminated);
    
    if (activePlayers.length === 1) {
      this.finished = true;
      this.winner = activePlayers[0].id;
      
      return {
        success: true,
        finished: true,
        winner: this.winner,
        finalScores: this.state.scores,
        rankings: this.calculateFinalRankings()
      };
    } else if (activePlayers.length === 0 || this.state.currentRound > this.state.maxRounds) {
      // Beraberlik veya maksimum tur aşıldı
      return this.endGameByScore();
    }
    
    return {
      success: true,
      finished: false,
      roundResults: results,
      roundWinners,
      roundLosers,
      eliminated: this.state.eliminated,
      activePlayers: activePlayers.map(p => p.id),
      state: this.state
    };
  }
  
  resolveTournamentRound() {
    const results = [];
    
    this.state.currentMatches.forEach(match => {
      const p1Choice = this.state.roundChoices[match.player1];
      const p2Choice = this.state.roundChoices[match.player2];
      
      if (p1Choice && p2Choice) {
        const result = this.compareChoices(p1Choice, p2Choice);
        
        if (result === 1) {
          match.winner = match.player1;
          this.state.champions.push(match.player1);
          this.state.players[match.player2].eliminated = true;
        } else if (result === -1) {
          match.winner = match.player2;
          this.state.champions.push(match.player2);
          this.state.players[match.player1].eliminated = true;
        } else {
          // Beraberlik durumunda tekrar
          return {
            success: true,
            finished: false,
            tie: true,
            needsRematch: [match.player1, match.player2]
          };
        }
        
        results.push(match);
      }
    });
    
    // Sonraki tur için eşleşmeleri oluştur
    if (this.state.champions.length > 1 && 
        results.every(r => r.winner !== null)) {
      this.state.currentMatches = [];
      const champions = [...this.state.champions];
      this.state.champions = [];
      
      for (let i = 0; i < champions.length; i += 2) {
        if (champions[i + 1]) {
          this.state.currentMatches.push({
            player1: champions[i],
            player2: champions[i + 1],
            winner: null
          });
        } else {
          this.state.champions.push(champions[i]);
        }
      }
      
      this.resetRound();
      this.state.tournamentBracket.currentRound++;
    }
    
    // Final kazananı kontrolü
    if (this.state.champions.length === 1 && this.state.currentMatches.length === 0) {
      this.finished = true;
      this.winner = this.state.champions[0];
      
      return {
        success: true,
        finished: true,
        winner: this.winner,
        tournamentComplete: true,
        finalBracket: this.state.tournamentBracket
      };
    }
    
    this.resetRound();
    
    return {
      success: true,
      finished: false,
      matchResults: results,
      nextMatches: this.state.currentMatches,
      state: this.state
    };
  }
  
  resolveClassicRound() {
    // 2 oyuncu için klasik mod
    const players = Object.values(this.state.players);
    const p1 = players[0];
    const p2 = players[1];
    
    const result = this.compareChoices(p1.choice, p2.choice);
    
    if (result === 0) {
      this.resetRound();
      return {
        success: true,
        finished: false,
        tie: true,
        choices: { [p1.id]: p1.choice, [p2.id]: p2.choice }
      };
    }
    
    const winner = result === 1 ? p1.id : p2.id;
    const loser = result === 1 ? p2.id : p1.id;
    
    this.state.scores[winner]++;
    this.winner = winner;
    this.finished = true;
    
    return {
      success: true,
      finished: true,
      winner,
      loser,
      choices: { [p1.id]: p1.choice, [p2.id]: p2.choice },
      scores: this.state.scores
    };
  }
  
  compareChoices(choice1, choice2) {
    if (choice1 === choice2) return 0;
    
    // Genişletilmiş kurallar (Rock-Paper-Scissors-Lizard-Spock)
    if (this.state.useSpecialMoves) {
      const rules = {
        rock: ['scissors', 'lizard'],
        paper: ['rock', 'spock'],
        scissors: ['paper', 'lizard'],
        lizard: ['spock', 'paper'],
        spock: ['scissors', 'rock']
      };
      
      return rules[choice1].includes(choice2) ? 1 : -1;
    }
    
    // Klasik kurallar
    const wins = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper'
    };
    
    return wins[choice1] === choice2 ? 1 : -1;
  }
  
  grantRandomPowerUp(playerId) {
    const player = this.state.players[playerId];
    const powerUps = ['shield', 'peek', 'change'];
    const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
    
    player.powerUps[randomPowerUp] = Math.min(
      (player.powerUps[randomPowerUp] || 0) + 1, 
      3
    );
  }
  
  resetRound() {
    Object.values(this.state.players).forEach(player => {
      player.choice = null;
      player.ready = false;
    });
    this.state.roundChoices = {};
    this.state.roundStartTime = Date.now();
  }
  
  endGameByScore() {
    const rankings = this.calculateFinalRankings();
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
        rankings
      };
    } else {
      // Çoklu beraberlik
      return {
        success: true,
        finished: true,
        draw: true,
        winners,
        finalScores: this.state.scores,
        rankings
      };
    }
  }
  
  calculateFinalRankings() {
    return Object.values(this.state.players)
      .sort((a, b) => {
        // Önce elenmemiş oyuncular
        if (a.eliminated !== b.eliminated) {
          return a.eliminated ? 1 : -1;
        }
        // Sonra skora göre
        return this.state.scores[b.id] - this.state.scores[a.id];
      })
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        score: this.state.scores[player.id],
        lives: player.lives,
        eliminated: player.eliminated,
        streak: player.streak
      }));
  }
  
  checkWinCondition() {
    return this.finished;
  }
  
  getState() {
    return {
      ...this.state,
      gameOver: this.finished,
      winner: this.winner
    };
  }
}