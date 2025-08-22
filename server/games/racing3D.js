import { GameInterface } from './gameInterface.js';

export class Racing3DGame extends GameInterface {
  constructor(players) {
    const playerIds = players.slice(0, 8);
    super(...playerIds);
    
    this.players = playerIds;
    this.maxPlayers = 8;
    this.lanes = 4;
    this.trackLength = 500;
    
    // Game loop settings
    this.tickRate = 60; // 60 Hz server tick rate
    this.tickInterval = 1000 / this.tickRate;
    this.lastTickTime = Date.now();
    this.gameLoopInterval = null;
    
    // Simplified physics for consistent movement
    this.physics = {
      maxSpeed: 5,         // Units per second
      acceleration: 3,     // Speed gain per second
      brakeForce: 5,       // Speed loss per second when braking  
      friction: 1,         // Natural speed loss per second
      boostSpeed: 8,       // Boost max speed
      boostDuration: 2000  // Boost duration in ms
    };
    
    // Initialize players with simpler state
    const initialState = {};
    playerIds.forEach((playerId, index) => {
      initialState[playerId] = {
        position: 0,
        speed: 0,
        lane: index % this.lanes,
        boosts: 3,
        isBoosting: false,
        boostEndTime: 0,
        lastLaneChange: 0,
        finished: false,
        finishTime: null,
        inputs: {
          accelerate: false,
          brake: false,
          left: false,
          right: false
        }
      };
    });
    
    this.state = {
      players: initialState,
      trackLength: this.trackLength,
      startTime: Date.now(),
      raceStarted: false,
      countdown: 3,
      leaderboard: [],
      frameCount: 0
    };
    
    // Start countdown
    this.startCountdown();
  }
  
  startCountdown() {
    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      this.emitStateUpdate(); // Send countdown update to clients
      
      if (this.state.countdown <= 0) {
        this.state.raceStarted = true;
        this.state.startTime = Date.now();
        clearInterval(this.countdownInterval);
        this.startGameLoop();
      }
    }, 1000);
  }
  
  startGameLoop() {
    if (this.gameLoopInterval) return;
    
    this.gameLoopInterval = setInterval(() => {
      this.tick();
    }, this.tickInterval);
  }
  
  tick() {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000; // Convert to seconds
    this.lastTickTime = now;
    
    if (!this.state.raceStarted || this.finished) return;
    
    // Update each player
    Object.keys(this.state.players).forEach(playerId => {
      this.updatePlayer(playerId, deltaTime);
    });
    
    // Update leaderboard
    this.updateLeaderboard();
    
    // Increment frame count
    this.state.frameCount++;
    
    // Emit state update every 3 frames (20 Hz to clients) for smoother movement
    if (this.state.frameCount % 3 === 0) {
      this.emitStateUpdate();
    }
  }
  
  updatePlayer(playerId, deltaTime) {
    const player = this.state.players[playerId];
    if (!player || player.finished) return;
    
    const now = Date.now();
    
    // Check if boost is active
    if (player.isBoosting && now > player.boostEndTime) {
      player.isBoosting = false;
    }
    
    // Update speed based on inputs
    if (player.inputs.accelerate && !player.inputs.brake) {
      // Accelerate
      const maxSpeed = player.isBoosting ? this.physics.boostSpeed : this.physics.maxSpeed;
      player.speed = Math.min(player.speed + this.physics.acceleration * deltaTime, maxSpeed);
    } else if (player.inputs.brake) {
      // Brake
      player.speed = Math.max(0, player.speed - this.physics.brakeForce * deltaTime);
    } else {
      // Apply friction when not accelerating
      player.speed = Math.max(0, player.speed - this.physics.friction * deltaTime);
    }
    
    // Update position based on current speed
    player.position += player.speed;
    
    // Check if finished
    if (player.position >= this.trackLength) {
      player.finished = true;
      player.finishTime = now - this.state.startTime;
      player.position = this.trackLength; // Cap at finish line
      player.speed = 0;
      this.checkGameEnd();
    }
  }
  
  checkGameEnd() {
    // Check if any player has finished
    const finishedPlayers = Object.entries(this.state.players)
      .filter(([id, p]) => p.finished)
      .sort((a, b) => a[1].finishTime - b[1].finishTime);
    
    if (finishedPlayers.length > 0 && !this.finished) {
      this.handleRaceFinish(finishedPlayers[0][0]);
    }
  }
  
  processAction(playerId, action) {
    if (!this.state.players[playerId]) {
      return { success: false, error: 'Player not in game' };
    }
    
    const player = this.state.players[playerId];
    const now = Date.now();
    
    // Don't process inputs if game hasn't started or player finished
    if (!this.state.raceStarted || player.finished) {
      return { success: true };
    }
    
    switch (action.type) {
      case 'input':
        // Process inputs directly
        if (action.inputs) {
          // Update stored inputs
          player.inputs = { ...action.inputs };
          
          // Handle lane changes (instant, no interpolation on server)
          if (action.inputs.left && now - player.lastLaneChange > 300) {
            if (player.lane > 0) {
              player.lane--;
              player.lastLaneChange = now;
            }
          } else if (action.inputs.right && now - player.lastLaneChange > 300) {
            if (player.lane < this.lanes - 1) {
              player.lane++;
              player.lastLaneChange = now;
            }
          }
        }
        break;
        
      case 'boost':
        if (player.boosts > 0 && !player.isBoosting) {
          player.boosts--;
          player.isBoosting = true;
          player.boostEndTime = now + this.physics.boostDuration;
        }
        break;
        
      default:
        break;
    }
    
    return { 
      success: true, 
      state: this.getClientState(playerId)
    };
  }
  
  updateLeaderboard() {
    const leaderboard = Object.entries(this.state.players)
      .map(([id, player]) => ({
        playerId: id,
        position: player.position,
        speed: player.speed,
        finished: player.finished
      }))
      .sort((a, b) => b.position - a.position);
    
    this.state.leaderboard = leaderboard;
  }
  
  handleRaceFinish(playerId) {
    if (this.finished) return;
    
    this.finished = true;
    this.winner = playerId;
    
    // Stop game loop
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    const rankings = this.calculateFinalRankings();
    
    // Emit final result
    this.emitGameEnd({
      winner: playerId,
      rankings: rankings,
      finalState: this.state
    });
  }
  
  calculateFinalRankings() {
    return Object.entries(this.state.players)
      .map(([id, player]) => ({
        playerId: id,
        finalPosition: player.position,
        finishTime: player.finishTime,
        totalTime: Date.now() - this.state.startTime
      }))
      .sort((a, b) => b.finalPosition - a.finalPosition)
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }));
  }
  
  getClientState(playerId) {
    // Return optimized state for specific client
    return {
      player: this.state.players[playerId],
      players: this.state.players,
      leaderboard: this.state.leaderboard,
      raceStarted: this.state.raceStarted,
      countdown: this.state.countdown,
      trackLength: this.trackLength
    };
  }
  
  emitStateUpdate() {
    // This will be called by the game service to emit updates
    if (this.onStateUpdate) {
      this.onStateUpdate(this.state);
    }
  }
  
  emitGameEnd(data) {
    if (this.onGameEnd) {
      this.onGameEnd(data);
    }
  }
  
  checkWinCondition() {
    return this.finished;
  }
  
  getState() {
    return this.state;
  }
  
  cleanup() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
}