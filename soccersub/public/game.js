goog.module('soccersub.Game');
const Dialog = goog.require('goog.ui.Dialog');
const Lineup = goog.require('soccersub.Lineup');
const Player = goog.require('soccersub.Player');
const Position = goog.require('soccersub.Position');
const Prompt = goog.require('goog.ui.Prompt');
const util = goog.require('soccersub.util');

class Game {
  /**
   * @param {!Lineup} lineup
   */
  constructor(lineup) {
    /** @type {boolean} */
    this.showTimesAtPosition = false;
    /** @type {boolean} */
    this.debugSorting = false;

    // Set up HTML element connections & handlers.
    this.gameClockElement = document.getElementById('game_clock');
    /** @type {!Element} */
    this.toggleClockButton = 
      /** @type {!Element} */ (document.getElementById('clock_toggle'));
    util.handleTouch(this.toggleClockButton, this.bind(this.toggleClock));

    /** @type {Position} */
    this.positionWithLongestShift = null;

    this.statusBar = document.getElementById('status_bar');
    //this.statusBarWriteMs = 0;
    /** @type {boolean} */
    this.timeoutPending = false;
    this.resetTag = /** @type {!Element} */ (document.getElementById('reset'));
    util.handleTouch(this.resetTag, this.bind(this.confirmAndReset));
    this.started = false;
    this.adjustRosterButton = /** @type {!Element} */ 
        (document.getElementById('adjust-roster'));
    this.adjustRosterButton.style.backgroundColor = 'white';
    util.handleTouch(this.adjustRosterButton, this.bind(this.adjustRoster));

    /** @type {number} */
    this.elapsedTimeMs;
    /** @type {number} */
    this.timeOfLastUpdateMs;
    /** @type {boolean} */
    this.rendered;
    /** @type {!Array<!Position>} */
    this.positions;
    /** @type {?Player} */
    this.selectedPlayer;
    /** @type {!Array<!Player>} */
    this.activePlayers;
    /** @type {!Map<string, !Player>} */
    this.playerMap;
    /** @type {!Lineup} */
    this.lineup = lineup;
    /** @type {boolean} */
    this.timeRunning = false;
    /** @type {boolean} */
    this.started = false;

    if (!this.restore()) {
      this.reset();
    }
  }

  bind(func, ...optArgs) {
    var game = this;
    return function(...laterArgs) {
      var args = optArgs.concat(laterArgs);
      var result = null;
      try {
        if (args.length) {
          result = func.apply(game, args);
        } else {
          result = func.apply(game);
        }
      } catch (err) {
        game.writeStatus('ERROR: ' + err + '\n' + err.stack);
      }
      return result;
    }
  }

  /**
   * @return {void}
   */
  confirmAndReset() {
    const dialog = new goog.ui.Dialog(
      undefined /* cssClass */, false /* useIframeMask */);
    dialog.setTextContent('Completely reset game state?');
    dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createOkCancel());
    goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, (e) => {
      if (e.key == 'ok') {
        this.reset();
      }
    });
    dialog.setVisible(true);
  }

  reset() {
    this.elapsedTimeMs = 0;
    this.timeOfLastUpdateMs = 0;
    this.rendered = false;
    this.positions = [];
    this.selectedPlayer = null;
    this.constructPlayersAndPositions();
    this.sortAndRenderPlayers(false);
    this.timeRunning = false;
    this.started = false;
    //this.lineup.reset();
    this.update();
    this.updateAvailableButton();
  }

  constructPlayersAndPositions() {
    var headRow = /** @type {!Element} */ (document.getElementById('table-head-row'));
    this.positions = [];
    for (var i = 0; i < this.lineup.positionNames.length; ++i) {
      this.positions.push(new Position(this.lineup.positionNames[i], headRow, this));
    }
    this.activePlayers = [];
    this.playerMap = new Map();
    for (const name of this.lineup.playerNames) {
      var player = new Player(name, this.lineup, this);
      this.activePlayers.push(player);
      player.availableForGame = true;
      this.playerMap.set(name, player);
    }
    for (const name of this.lineup.unavailablePlayerNames) {
      var player = new Player(name, this.lineup, this);
      player.availableForGame = false;
      this.playerMap.set(name, player);
    }
  }

  /**
   * Following an adjustment of the set of players, update the ones in the game
   * currently.  Make new players for those that we didn't previously know about,
   * and move any that were deleted or commented out to inactive status.  We don't
   * delete them so that they can retain their stats if they are brought back (e.g.
   * recover from injury).
   */
  updatePlayers() {
    // Make a map of active players based on the lineup change, which might differ
    // from this.activePlayers.

    // Populate the previously active players.
    const previouslyActivePlayers = new Map();
    for (const player of this.activePlayers) {
      previouslyActivePlayers.set(player.name, player);
    }
    this.activePlayers = [];

    // Iterate over the new set of active players, pulling player records from
    // the current inactive & active maps.
    for (var i = 0; i < this.lineup.playerNames.length; ++i) {
      const name = this.lineup.playerNames[i];
      let player = previouslyActivePlayers.get(name);
      if (player) {
        previouslyActivePlayers.delete(player.name);
      } else {
        player = this.playerMap.get(name);
        if (player) {
          player.availableForGame = true;
        } else {
          player = new Player(name, this.lineup, this);
        }
      }
      this.activePlayers.push(player);
    }

    // The remaining previouslyActivePlayers are now inactive.
    for (const player of previouslyActivePlayers.values()) {
      player.availableForGame = false;
      var position = player.currentPosition;
      if (position != null) {
        position.setPlayer(null);
        position.render();
      }
    }

    this.sortAndRenderPlayers(true);
    this.redrawPositions();
    this.update();
  }

  /**
   * @return {boolean}
   */
  restore() {
    if (!util.storageAvailable('localStorage')) {
      return false;
    }

    //try {
      var storedGame = window.localStorage.game;
      if (!storedGame) {
        return false;
      }
      var map = /** @type {!Object} */ (JSON.parse(storedGame));

      this.rendered = false;
      if (!this.lineup.restore(map)) {
        return false;
      }
      this.constructPlayersAndPositions();
      for (const player of this.playerMap.values()) {
        const positionName = player.restore(map);
        if (positionName) {
          const position = this.findPosition(positionName);
          player.setPosition(position);
          position.setPlayer(player);
          //this.writeStatus(player.status());
        }
      }

      /*
        for (var i = 0; i < this.positions.length; ++i) {
        var position = this.position[i];
        position.restore();
        }
      */
      this.elapsedTimeMs = map.elapsedTimeMs;
      this.timeRunning = map.timeRunning;
      this.started = map.started;
      this.timeOfLastUpdateMs = map.timeOfLastUpdateMs;
      this.sortAndRenderPlayers(true);
      for (const player of this.activePlayers) {
        player.updateColor();
      }
      this.update();
      this.updateAvailableButton();
      return true;
    //} catch (err) {
    //  return false;
    //}
  }

  /**
   * @param {string} name
   * @return {?Position}
   */
  findPosition(name) {
    for (var i = 0; i < this.positions.length; ++i) {
      var position = this.positions[i];
      if (position.name == name) {
        return position;
      }
    }
    return null;
  }

  save() {
    var map = {};
    map.elapsedTimeMs = this.elapsedTimeMs;
    map.timeRunning = this.timeRunning;
    map.started = this.started;
    map.timeOfLastUpdateMs = this.timeOfLastUpdateMs;
    this.lineup.save(map);
    for (const player of this.playerMap.values()) {
      player.save(map);
    }
    window.localStorage.game = JSON.stringify(map);
  };

  /** @private */
  computePercentageInGameNotKeeper_() {
    for (const player of this.activePlayers) {
      player.computePercentageInGameNotKeeper(this.elapsedTimeMs);
    }
  }

  /** @param {boolean} force */
  sortAndRenderPlayers(force) {
    this.computePositionWithLongestShift_();
    this.computePercentageInGameNotKeeper_();
    var players = this.activePlayers.slice(0);
    players.sort(Player.compare);
    var changed = !this.rendered || force;
    for (var i = 0; !changed && (i < players.length); ++i) {
      changed = players[i] != this.activePlayers[i];
    }
    if (changed) {
      this.rendered = true;
      this.activePlayers = players;
      var tableBody = document.getElementById('table-body');
      tableBody.innerHTML = '';
      for (var i = 0; i < this.activePlayers.length; ++i) {
        var player = this.activePlayers[i];
        player.render(tableBody);
        if (player.nameElement) {
          util.handleTouch(player.nameElement,
                           this.bind(this.selectPlayer, player));
        }
      }
    }
  }

  toggleClock() {
    this.started = true;
    this.timeRunning = !this.timeRunning;
    this.timeOfLastUpdateMs = util.currentTimeMs();
    this.update();
  };

  redrawClock() {
    var background = 'white';
    if (this.timeRunning) {
      this.gameClockElement.style.backgroundColor = 'lightgreen';
      this.toggleClockButton.textContent = 'Stop Clock';
    } else {
      this.gameClockElement.style.backgroundColor = 'pink';
      if (this.elapsedTimeMs == 0) {
        this.toggleClockButton.textContent = 'Start Clock';
      } else {
        this.toggleClockButton.textContent = 'Resume Clock';
        this.toggleClockButton.style.backgroundColor = 'white';
        background = 'red';
      }
    }
    document.body.style.backgroundColor = background;
  }

  adjustRoster() {
    const prompt = new goog.ui.Prompt(
      'Roster Entry',
      'Entry names of players, prefixing unavailable ones with #',
      (response) => {
        if (response) {
          this.lineup.setPlayersFromText(response);
          this.updatePlayers();
          this.save();
        }
      });
    prompt.setRows(15);
    prompt.setDefaultValue(this.lineup.getPlayersAsText());
    prompt.setVisible(true);
/*
    if (this.selectedPlayer != null) {
      this.selectedPlayer.availableForGame = !this.selectedPlayer.availableForGame;
      if (!this.selectedPlayer.availableForGame) {
        var position = this.selectedPlayer.currentPosition;
        if (position != null) {
          position.setPlayer(null);
          position.render();
        }
      }
      this.writeStatus(this.selectedPlayer.status());
      this.updateAvailableButton();
      this.sortAndRenderPlayers();
      this.redrawPositions();
      this.update();
    }
*/
  }

  /**
   * @param {?Player} player
   */
  selectPlayer(player) {
    if (this.selectedPlayer == player) {
      // If current player is selected, simply unselect.
      this.selectedPlayer = null;
      if (player != null) {
        player.unselect();
      }
    } else {
      if (this.selectedPlayer != null) {
        this.selectedPlayer.unselect();
      }
      this.selectedPlayer = player;
      if (player != null) {
        player.select();
      }
    }
    if (this.selectedPlayer == null) {
      this.writeStatus(' ');
    } else {
      this.writeStatus(this.selectedPlayer.status());
    }
    this.updateAvailableButton();
    this.redrawPositions();
  }

  updateAvailableButton() {
/*
    if (this.selectedPlayer) {
      if (this.selectedPlayer.availableForGame) {
        this.unavailableButton.style.backgroundColor = 'white';
        this.unavailableButton.textContent = 'Make Unavailable';
      } else {
        this.unavailableButton.style.backgroundColor = 'lightgreen';
        this.unavailableButton.textContent = 'Make Available';
      }
    } else {
      this.unavailableButton.style.backgroundColor = 'lightgray';
      this.unavailableButton.textContent = 'Make Unavailable';
    }
*/
  };

  /** @private */
  computePositionWithLongestShift_() {
    var pos = null;
    for (var i = 0; i < this.positions.length; ++i) {
      var position = this.positions[i];
      if ((position.name != 'keeper') && (position.currentPlayer != null)) {
        if ((pos == null) || 
            (position.currentPlayer.timeInShiftMs > pos.currentPlayer.timeInShiftMs)) {
          pos = position;
        }
      }
    }
    this.positionWithLongestShift = pos;
    this.redrawPositions();
  }

  redrawPositions() {
    var unavailable = (this.selectedPlayer != null) && !this.selectedPlayer.availableForGame;
    for (var i = 0; i < this.positions.length; ++i) {
      var position = this.positions[i];
      if (unavailable) {
        position.setBackgroundColor('lightgray');
      } else {
        if (position.currentPlayer == null) {
          position.setBackgroundColor('yellow');
        } else if (position.currentPlayer.selected) {
          position.setBackgroundColor('pink');
        } else if (position == this.positionWithLongestShift) {
          position.setBackgroundColor('orange');
        } else {
          position.setBackgroundColor('white');
        }
      }
    }
  };

  /**
   * @param {?Position} position
   */
  assignPosition(position) {
    if (this.selectedPlayer == null) {
      if (position.currentPlayer != null) {
        this.selectPlayer(position.currentPlayer);
      } else {
        this.writeStatus('Select a player before assigning a position');
      }
    } else if (this.selectedPlayer.availableForGame) {
      this.selectedPlayer.setPosition(position);
      this.writeStatus(this.selectedPlayer.status());
      if (position != null) {
        position.setPlayer(this.selectedPlayer);
      }
      
      // Unselect the player so we are less likely to double-assign.
      this.selectPlayer(null);
      this.sortAndRenderPlayers(false);
      this.started = true;
      this.update();
    }
  }

  /**
   * @param {string} text
   */
  writeStatus(text) {
    this.statusBar.textContent = text;
    //this.statusBarWriteMs = currentTimeMs();
  }

  updateTimer() {
    this.timeoutPending = false;
    this.update();
  };

  update() {
    if (this.timeRunning) {
      var timeMs = util.currentTimeMs();
      var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
      if (timeSinceLastUpdate > 0) {
        this.elapsedTimeMs += timeSinceLastUpdate;
        this.timeOfLastUpdateMs = timeMs;
        for (var i = 0; i < this.positions.length; ++i) {
          this.positions[i].addTimeToShift(timeSinceLastUpdate);
        }
        this.sortAndRenderPlayers(false);
      }
      if (!this.timeoutPending) {
        this.timeoutPending = true;
        window.setTimeout(this.bind(this.updateTimer), 1000);
      }
    }
    /*if ((this.statusBarWriteMs != 0) &&
      (timeMs - this.statusBarWriteMs) > 5000) {
      this.statusBar.textContent = ' ';
      this.statusBarWriteMs = 0;
      }*/
    this.redrawClock();
    this.gameClockElement.innerHTML = '<b>Game Clock: </b>' +
      util.formatTime(this.elapsedTimeMs);
    this.save();
    this.resetTag.style.backgroundColor = this.started ? 'white': 'lightgray';
  }
}

exports = Game;