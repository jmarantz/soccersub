goog.module('soccersub.Position');
const util = goog.require('soccersub.util');
let Game = goog.forwardDeclare('soccersub.Game');
let Player = goog.forwardDeclare('soccersub.Player');

class Position {
  /**
   * @param {string} name
   * @param {!Element} headRow
   * @param {!Game} game
   */
  constructor(name, headRow, game) {
    this.name = name;
    this.currentPlayer = null;

    // The position shows up twice in the DOM, once in the field
    // layout, and once as a table header for the players, so we 
    // can see how long they've played at each position.  First
    // the field layout, which will be sensitive to touch events
    // for player assignment, and we will write the player in there
    // when assigned.
    const element = document.getElementById(name);

    // Rebuild the element in case this is a 'reset' and the HTML element
    // already has a touch handler.
    this.element = element.cloneNode(true);
    const parent = element.parentNode;
    parent.removeChild(element);
    parent.appendChild(this.element);

    this.element.style.lineHeight = 'normal';
    this.render();
    util.handleTouch(this.element, game.bind(game.assignPosition, this));
    
    // Now the table header entry, which we are just going to automatically
    // populate, and don't need to reference it after that.
    if (game.showTimesAtPosition) {
      var th = document.createElement('th');
      th.textContent = name;
      headRow.appendChild(th);
    }
  }

  /**
   * @return {void}
   */
  render() {
    let text = '<b>' + this.name + ':</b><br/>';
    if (this.currentPlayer) {
      text += '' + this.currentPlayer.renderAtPosition();
    } else {
      text += '<i><b>NEEDS PLAYER</b></i>';
    }
    this.element.innerHTML = text;
  }

  /** @param {string} color */
  setBackgroundColor(color) {
    this.element.style.backgroundColor = color;
    // this.element.style.opacity = 0.5;
  }

  /** @param {?Player} player */
  restorePlayer(player) {
    this.currentPlayer = player;
    this.render();
  }

  /** @param {?Player} player */
  setPlayer(player) {
    if (this.currentPlayer != player) {
      if (this.currentPlayer != null) {
        var oldPlayer = this.currentPlayer;
        this.currentPlayer = null;
        oldPlayer.setPosition(null);
      }
      this.restorePlayer(player);
    }
  }

  /** @param {number} timeMs */
  addTimeToShift(timeMs) {
    if (this.currentPlayer != null) {
      this.currentPlayer.addTimeToShift(timeMs);
      this.render();
    }
  }
}

exports = Position;
