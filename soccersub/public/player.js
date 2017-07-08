class Player {
  /**
   * @param {string} name
   * @param {Game} game
   */
  constructor(name, game) {
    this.name = name;
    this.game = game;
    /** @type {boolean} */
    this.availableForGame;
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
    /** @type {!Element} */
    this.nameElement;
    /** @type {!Element} */
    this.gameTimeElement = document.createElement('td');
    /** @type {number} */
    this.timeInShift;
    this.reset();
  };

  reset() {
    this.timeInGameMs = 0;
    this.timeInShiftMs = 0;
    this.availableForGame = true;  
    this.timeAtPositionMs = {};
    this.elementAtPosition = {};
    /** @type {?Position} */
    this.currentPosition = null;
    this.selected = false;
    for (let i = 0; i < this.game.positionNames.length; ++i) {
      const positionName = this.game.positionNames[i];
      this.timeAtPositionMs[positionName] = 0;
    }
  }

  computePercentageInGameNotKeeper() {
    const timeAsKeeperMs = this.timeAtPositionMs['keeper'];
    const totalInGameWhenThisPlayerWasNotKeeperMs = this.game.elapsedTimeMs -
        timeAsKeeperMs;
    if (!totalInGameWhenThisPlayerWasNotKeeperMs) {
      return 0;
    }
    const playtimeTimeWhileNotKeeper = this.timeInGameMs - timeAsKeeperMs;
    return 100 * playtimeTimeWhileNotKeeper /
      totalInGameWhenThisPlayerWasNotKeeperMs;
  }

  writeStatus() {
    let msg = this.name + ': [';
    if (this.currentPosition != null) {
      msg += this.currentPosition.name + ': ' +
        formatTime(this.timeAtPositionMs[this.currentPosition.name]);
    } else if (this.availableForGame) {
      msg += 'available';
    } else { 
      msg += 'unavailable';
    }
    msg += ']';
    for (let i = 0; i < this.game.positionNames.length; ++i) {
      const positionName = this.game.positionNames[i];
      if ((this.currentPosition == null) ||
          (this.currentPosition.name != positionName)) {
        const timeMs = this.timeAtPositionMs[positionName];
        if (timeMs && (timeMs != 0)) {
          msg += " " + positionName + ": " + formatTime(timeMs);
        }
      }
    }
    this.game.writeStatus(msg);
  }

  /**
   * @param {string} field
   * @param {Object.<string, string>} storage
   * @return {string}
   */
  getStorage(field, storage) {
    return storage['Player:' + this.name + ':' + field];
  }

  /**
   * @param {string} field
   * @param {string} value
   * @param {!Object.<string, string>} storage
   */
  setStorage(field, value, storage) {
    storage['Player:' + this.name + ':' + field] = value;
  };

  /**
   * @param {Object} gameMap
   */
  restore(gameMap) {
    const playerMap = gameMap[this.name];
    if (!playerMap) {
      this.reset();
      return;
    }
    this.timeInGameMs = playerMap.timeInGameMs;
    this.timeInShiftMs = playerMap.timeInShiftMs;
    this.availableForGame = playerMap.availableForGame;
    // timeAtPositionMs ...
    this.currentPosition = this.game.findPosition(playerMap.currentPosition);
    if (this.currentPosition != null) {
      this.currentPosition.restorePlayer(this);
    }
    this.timeAtPositionMs = {};
    for (let i = 0; i < this.game.positionNames.length; ++i) {
      const positionName = this.game.positionNames[i];
      const timeMs = playerMap[positionName];
      this.timeAtPositionMs[positionName] = timeMs ? timeMs : 0;
    }
  }

  /**
   * @param {!Object} gameMap
   */
  save(gameMap) {
    const playerMap = {};
    gameMap[this.name] = playerMap;
    playerMap.timeInGameMs = this.timeInGameMs;
    playerMap.timeInShiftMs = this.timeInShiftMs;
    playerMap.availableForGame = this.availableForGame;
    playerMap.currentPosition = this.currentPosition
      ? this.currentPosition.name : null;
    for (let i = 0; i < this.game.positionNames.length; ++i) {
      const positionName = this.game.positionNames[i];
      const timeMs = this.timeAtPositionMs[positionName];
      if (timeMs) {
        playerMap[positionName] = timeMs;
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
    let cmp = player1.computePercentageInGameNotKeeper() -
        player2.computePercentageInGameNotKeeper();
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
    if (player1.availableForGame && !player2.availableForGame) {
      return -1;
    } else if (player2.availableForGame && !player1.availableForGame) {
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
   */
  render(tableBody) {
    const row = document.createElement('tr');
    this.nameElement = document.createElement('td');
    handleTouch(this.nameElement, this.game.bind(this.game.selectPlayer, this));
    this.nameElement.textContent = this.name;
    row.appendChild(this.nameElement);
    this.gameTimeElement = document.createElement('td');
    this.renderGameTime();
    row.appendChild(this.gameTimeElement);
    if (this.game.showTimesAtPosition) {
      for (let i = 0; i < this.game.positionNames.length; ++i) {
        const positionName = this.game.positionNames[i];
        const td = document.createElement('td');
        row.appendChild(td);
        this.elementAtPosition[positionName] = td;
      }
    }
    this.updateColor();
    tableBody.appendChild(row);
  }

  /**
   * @param {?Position} position
   */
  setPosition(position) {
    if (this.currentPosition != position) {
      if (this.currentPosition != null) {
        const oldPos = this.currentPosition;
        this.currentPosition = null;
        oldPos.setPlayer(null);
      } else {
        this.timeInShiftMs = 0;
      }
      this.currentPosition = position;
      this.timeInShift = 0;
      this.updateColor();
      this.writeStatus();
      //this.save();
    }
  }

  updateColor() {
    let color = 'white';
    if (!this.availableForGame) {
      color = 'lightblue';
    } else if (this.currentPosition != null) {
      if (this.currentPosition == this.game.positionWithLongestShift) {
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
   * @return {string}
   */
  renderAtPosition() {
    if (this.selected) {
      this.writeStatus();
    }
    return this.name + ' ' + formatTime(this.timeInShiftMs);
  }

  renderGameTime() {
    this.gameTimeElement.textContent = formatTime(this.timeInGameMs) + ' ('
      + Math.round(this.computePercentageInGameNotKeeper()) + '%)';
  }

  /**
   * @param {number} timeMs
   */
  addTimeToShift(timeMs) {
    this.timeInShiftMs += timeMs;
    this.timeInGameMs += timeMs;
    this.timeAtPositionMs[this.currentPosition.name] += timeMs;
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
