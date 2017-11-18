goog.module('soccersub.Position');
const util = goog.require('soccersub.util');
const googDom = goog.require('goog.dom');
let Game = goog.forwardDeclare('soccersub.Game');
let Player = goog.forwardDeclare('soccersub.Player');

class Position {
  /**
   * @param {string} name
   * @param {!Element} headRow
   * @param {!Game} game
   */
  constructor(name, headRow, game) {
    /** @type {string} */
    this.name = name;
    /** @type {?Player} */
    this.currentPlayer = null;

    // The position shows up twice in the DOM, once in the field
    // layout, and once as a table header for the players, so we 
    // can see how long they've played at each position.  First
    // the field layout, which will be sensitive to touch events
    // for player assignment, and we will write the player in there
    // when assigned.
    /** @type {!Element} */
    this.element = goog.dom.getRequiredElement(name);
    if (!this.element) {
      console.log('could not find element ' + name);
    }

    this.element.style.lineHeight = 'normal';
    const nameNode = document.createElement('b');
    nameNode.textContent = this.name + ':';
    this.element.appendChild(nameNode);
    this.element.appendChild(document.createElement('br'));
    /** @type {!Text} */
    this.playerNode = document.createTextNode('');
    this.element.appendChild(this.playerNode);

    this.render();
    
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
    if (this.currentPlayer) {
      this.playerNode.textContent = this.currentPlayer.renderAtPosition();
    } else {
      this.playerNode.textContent = 'NEEDS PLAYER'
    }
  }

  /** @param {string} color */
  setBackgroundColor(color) {
    this.element.style.backgroundColor = color;
    // this.element.style.opacity = 0.5;
  }

  /** @param {?Player} player */
  setPlayer(player) {
    if (this.currentPlayer != player) {
      if (this.currentPlayer != null) {
        var oldPlayer = this.currentPlayer;
        this.currentPlayer = null;
        oldPlayer.setPosition(null, true);
      }
      this.currentPlayer = player;
      this.render();
    }
  }

  /** @param {number} timeMs */
  addTimeToShift(timeMs) {
    if (this.currentPlayer != null) {
      this.currentPlayer.addTimeToShift(timeMs);
      this.render();
    }
  }

  /** @return {?ClientRect} */
  boundingBox() {
    if (!this.element) {
      return null;
    }
    return this.element.getBoundingClientRect();
  }
}

exports = Position;
