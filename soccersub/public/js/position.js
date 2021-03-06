goog.module('soccersub.Position');
const util = goog.require('soccersub.util');
const googDom = goog.require('goog.dom');
let Player = goog.forwardDeclare('soccersub.Player');

const rightArrow = '&rarr;';

class Position {
  /**
   * @param {string} name
   * @param {string} abbrev
   * @param {!Element} headRow
   * @param {boolean} showTimesAtPosition
   */
  constructor(name, abbrev, headRow, showTimesAtPosition) {
    /** @type {string} */
    this.name = name;
    /** @type {?Player} */
    this.currentPlayer = null;
    /** @type {?Player} */
    this.nextPlayer = null;

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
    nameNode.textContent = abbrev + ': ';
    this.element.appendChild(nameNode);
    //this.element.appendChild(document.createElement('br'));
    // type {!Text}
    //this.playerNode = document.createTextNode('');
    /** @type {!Element} */
    this.playerNode = document.createElement('span');
    this.element.appendChild(this.playerNode);

    this.render();
    
    // Now the table header entry, which we are just going to automatically
    // populate, and don't need to reference it after that.
    if (showTimesAtPosition) {
      var th = document.createElement('th');
      th.textContent = name;
      headRow.appendChild(th);
    }
  }

  /**
   * @return {void}
   */
  render() {
    let text = '';
    if (this.currentPlayer) {
      const verbose = !this.nextPlayer;
      text = this.currentPlayer.renderAtPosition(verbose);
    } else if (!this.nextPlayer) {
      text = 'needs player'
    }
    if (this.nextPlayer) {
      //text += ' > ' + this.nextPlayer.name;
      text += ' ' + rightArrow + ' ' + this.nextPlayer.name;
      this.playerNode.classList.add('pending-assignment');
    } else {
      this.playerNode.classList.remove('pending-assignment');
    }
    this.playerNode.innerHTML = text;
  }

  /** @param {string} color */
  setBackgroundColor(color) {
    this.element.style.backgroundColor = color;
    // this.element.style.opacity = 0.5;
  }

  /** @param {?Player} player */
  setNextPlayer(player) {
    this.nextPlayer = player;
    this.render();
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
      this.nextPlayer = null;
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
