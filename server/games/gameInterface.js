export class GameInterface {
  constructor(player1Id, player2Id) {
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.state = {};
    this.finished = false;
    this.winner = null;
  }

  processAction(playerId, action) {
    throw new Error('processAction must be implemented by subclass');
  }

  getState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
  }

  checkWinCondition() {
    throw new Error('checkWinCondition must be implemented by subclass');
  }

  reset() {
    this.state = {};
    this.finished = false;
    this.winner = null;
  }
}