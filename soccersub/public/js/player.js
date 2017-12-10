goog.module('soccersub.Player');

const Lineup = goog.require('soccersub.Lineup');
const util = goog.require('soccersub.util');
let Position = goog.forwardDeclare('soccersub.Position');

const DB_PREFIX = 'player:';

class Player {
  /**
   * @param {string} name
   * @param {!Lineup} lineup
   * @param {function(string)} writeStatus
   */
  constructor(name, lineup, writeStatus) {
    this.name = name;
    /** @type {!Lineup} */
    this.lineup = lineup;
    /** @private {function(string)} */
    this.writeStatus_ = writeStatus;
    /** @type {boolean} */
    this.available;
    /** @type {boolean} */
    this.selected = false;
    /** @type {number} */
    this.timeInGameMs;
    /** @type {number} */
    this.timeInShiftMs;
    /** @type {!Object<string, number>} */
    this.timeAtPositionMs;
    /** @type {!Object} */
    this.elementAtPosition;
    /** @type {?Position} */
    this.currentPosition;
    /** @type {?Position} */
    this.nextPosition;
    /** @type {?Element} */
    this.nameElement = null;    // initialized on render.
    /** @type {?Element} */
    this.element = null;        // all the visualization for a player.
    /** @type {!Element} */
    this.gameTimeElement = document.createElement('td');
    /** @type {number} */
    this.percentageInGameNotKeeper;
    /** @type {boolean} */
    this.showTimesAtPosition = false;
    /** @type {boolean} */
    this.hasLongestShift = false;
    this.reset();
  };

  reset() {
    this.timeInGameMs = 0;
    this.timeInShiftMs = 0;
    this.percentageInGameNotKeeper = 0;
    this.available = this.lineup.playerNames.has(this.name);
    this.timeAtPositionMs = {};
    this.elementAtPosition = {};
    /** @type {?Position} */
    this.currentPosition = null;
    this.nextPosition = null;
    this.selected = false;
/*
    for (let i = 0; i < this.lineup.positionNames.length; ++i) {
      const positionName = this.lineup.positionNames[i];
      this.timeAtPositionMs[positionName] = 0;
    }
*/
  }

  /** @param {number} elapsedTimeMs */
  computePercentageInGameNotKeeper(elapsedTimeMs) {
    const timeAsKeeperMs = this.timeAtPositionMs['keeper'] || 0;
    const totalInGameWhenThisPlayerWasNotKeeperMs = elapsedTimeMs - timeAsKeeperMs;
    if (!totalInGameWhenThisPlayerWasNotKeeperMs) {
      return 0;
    }
    const playtimeTimeWhileNotKeeper = this.timeInGameMs - timeAsKeeperMs;
    this.percentageInGameNotKeeper = 100 * playtimeTimeWhileNotKeeper /
      totalInGameWhenThisPlayerWasNotKeeperMs;
  }

  /** @return {string} */
  status() {
    let msg = this.name + ': [';
    if (this.currentPosition != null) {
      msg += this.currentPosition.name + ': ' +
        util.formatTime(this.timeAtPositionMs[this.currentPosition.name] || 0);
    } else if (this.available) {
      msg += 'available';
    } else { 
      msg += 'unavailable';
    }
    msg += ']';
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if ((this.currentPosition == null) ||
            (this.currentPosition.name != positionName)) {
          const timeMs = this.timeAtPositionMs[positionName] || 0;
          if (timeMs && (timeMs != 0)) {
            msg += " " + positionName + ": " + util.formatTime(timeMs);
          }
        }
      }
    }
    return msg;
  }

  /**
   * @param {string} field
   * @param {Object.<string, string>} storage
   * @return {string}
   */
  getStorage(field, storage) {
    return storage[DB_PREFIX + this.name + ':' + field];
  }

  /**
   * @param {string} field
   * @param {string} value
   * @param {!Object.<string, string>} storage
   */
  setStorage(field, value, storage) {
    storage[DB_PREFIX + this.name + ':' + field] = value;
  };

  /**
   * @param {Object} gameMap
   * @return {?string}
   */
  restore(gameMap) {
    const playerMap = gameMap[DB_PREFIX + this.name];
    if (!playerMap) {
      this.reset();
      return null;
    }
    this.timeInGameMs = playerMap['timeInGameMs'];
    this.timeInShiftMs = playerMap['timeInShiftMs'];
    this.available = this.lineup.playerNames.has(this.name);
    // timeAtPositionMs ...
    this.timeAtPositionMs = {};
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        this.timeAtPositionMs[positionName] = playerMap[positionName] || 0;
      }
    }
    return playerMap['currentPosition']
  }

  /** 
   * @param {!Lineup} lineup 
   * @param {function(string): ?Position} findPosition
   */
  static dbSection(lineup, findPosition) {
    let fields = [
      ['timeInGameMs', (p) => p.timeInGameMs, (p, v) => p.timeInGameMs = v],
      ['timeInShiftMs', (p) => p.timeInShiftMs, (p, v) => p.timeInShiftMs = v],
      ['currentPosition', 
       (p) => p.currentPosition ? p.currentPosition.name : null,
       (p, positionName) => {
         p.currentPosition = null;
         p.nextPosition = null;
         if (positionName) {
           p.currentPosition = findPosition(positionName);
         }
       }],
    ];
    for (const row of lineup.getActivePositionNames()) {
      for (const positionName of row) {
        fields.push([
          positionName, 
          (p) => p.timeAtPositionMs[positionName] || 0,
          (p, v) => p.timeAtPositionMs[positionName] = v || 0
        ]);
      }
    }
  }

  /**
   * @param {!Object} gameMap
   */
  save(gameMap) {
    const playerMap = {};
    gameMap[DB_PREFIX + this.name] = playerMap;
    playerMap['timeInGameMs'] = this.timeInGameMs;
    playerMap['timeInShiftMs'] = this.timeInShiftMs;
    playerMap['currentPosition'] = this.currentPosition
      ? this.currentPosition.name : null;

    for (const row of this.lineup.getActivePositionNames()) {       
      for (const positionName of row) {
        const timeMs = this.timeAtPositionMs[positionName];
        if (timeMs) {
          playerMap[positionName] = timeMs;
        }
      }
    }
  }

  /** @return {boolean} */
  isPlaying() {
    return this.currentPosition != null;
  }

  /**
   * Compare two players in terms of play-time, returning the difference
   * in milliseconds between the amount the two players have played in the
   * game.  If the game-times are equal, return the difference beween the
   * shift-times in milliseconds.
   *
   * @param {!Player} player1
   * @param {!Player} player2
   * @return {number}
   */
  static comparePlayingTimeMs(player1, player2) {
    let cmp = player1.percentageInGameNotKeeper - 
        player2.percentageInGameNotKeeper;
    if (cmp == 0) {
      cmp = player1.timeInGameMs - player2.timeInGameMs;
      if (cmp == 0) {
        cmp = player1.timeInShiftMs - player2.timeInShiftMs;
      }
    }
    return cmp;
  }

  /**
   * @param {!Player} player1
   * @param {!Player} player2
   * @return {number}
   */
  static compare(player1, player2) {
    if (player1.available && !player2.available) {
      return -1;
    } else if (player2.available && !player1.available) {
      return 1;
    }
    let cmp = Player.comparePlayingTimeMs(player1, player2);
    if (cmp == 0) {
      if (player1.name < player2.name) {
        cmp = -1;
      } else if (player1.name > player2.name) {
        cmp = 1;
      }
    }
    return cmp;
  }

  /**
   * @param {!Element} tableBody
   * @param {!Element} row
   */
  render(tableBody, row) {
    this.nameElement = document.createElement('td');
    this.nameElement.textContent = this.name;
    row.appendChild(this.nameElement);
    this.gameTimeElement = document.createElement('td');
    this.renderGameTime();
    row.appendChild(this.gameTimeElement);
    if (this.showTimesAtPosition) {
      for (const positionName of this.lineup.getActivePositionNames()) {
        const td = document.createElement('td');
        row.appendChild(td);
        this.elementAtPosition[positionName] = td;
      }
    }
    this.updateColor();
    tableBody.appendChild(row);
  }

  /** 
   * @param {number} x
   * @param {number} y
   * @return {boolean}
   */
  inside(x, y) {
    return (this.nameElement && 
            util.inside(x, y, this.nameElement.getBoundingClientRect())) ||
      (this.gameTimeElement && 
        util.inside(x, y, this.gameTimeElement.getBoundingClientRect()));
  }

  /**
   * @param {?Position} position
   */
  setNextPosition(position) {
    if (this.nextPosition != position) {
      if (this.nextPosition && this.nextPosition.nextPlayer == this) {
        this.nextPosition.setNextPlayer(null);
        this.nextPosition.render();
      }
      this.nextPosition = position;
    }
  }

  /**
   * @param {?Position} position
   * @param {boolean} clearTimeInShift
   */
  setPosition(position, clearTimeInShift) {
    if (clearTimeInShift && this.currentPosition) {
      this.timeInShiftMs = 0;
      this.hasLongestShift = false;
    }
    if (this.nextPosition) {
      if (this.nextPosition.nextPlayer == this) {
        this.nextPosition.setNextPlayer(null);
      }
      this.nextPosition = null;
    }

    if (this.currentPosition != position) {
      if (this.currentPosition) {
        const oldPos = this.currentPosition;
        this.currentPosition = null;
        oldPos.setPlayer(null);
      }
      this.currentPosition = position;
      this.updateColor();
      //this.save();
    }
  }

  updateColor() {
    if (!this.nameElement) {
      return;
    }
    let color = 'white';
    if (!this.available) {
      color = 'lightblue';
    } else if (this.currentPosition != null) {
      if (this.hasLongestShift) {
        color = 'orange';
      } else if (this.currentPosition.name == 'keeper') {
        color = 'bisque';
      } else {
        color = 'aquamarine';
      }
    }
    
    if (this.selected) {
      this.nameElement.style.backgroundColor = 'black';
      this.nameElement.style.color = color;
    } else {
      this.nameElement.style.backgroundColor = color;
      this.nameElement.style.color = 'black';
    }
  }

  /**
   * @param {boolean} verbose
   * @return {string}
   */
  renderAtPosition(verbose) {
    if (this.selected) {
      this.writeStatus_(this.status());
    }
    let str = this.name + ' ' + util.formatTime(this.timeInShiftMs);
    if (verbose) {
      str += ' ' + this.formatGameTime();
    }
    return str;
  }

  /** @return {string} */
  formatGameTime() {
    return util.formatTime(this.timeInGameMs) + ' ('
      + Math.round(this.percentageInGameNotKeeper) + '%)'
  }
  renderGameTime() {
    this.gameTimeElement.textContent = this.formatGameTime();
  }

  /**
   * @param {number} timeMs
   */
  addTimeToShift(timeMs) {
    this.timeInShiftMs += timeMs;
    this.timeInGameMs += timeMs;
    this.timeAtPositionMs[this.currentPosition.name] = timeMs +
          (this.timeAtPositionMs[this.currentPosition.name] || 0);
    this.renderGameTime();
    //if (SHOW_TIMES_AT_POSITION) {
    //var positionMs = ...;
    //var elt = this.elementAtPosition[this.currentPosition.name];
    //elt.textContent = formatTime(positionMs);
    //}
  }

  /**
   * unselects player
   */
  unselect() {
    this.selected = false;
    this.updateColor();
  }

  /**
   * @return {void}
   */
  select() {
    this.selected = true;
    this.updateColor();
  }
}

exports = Player;
