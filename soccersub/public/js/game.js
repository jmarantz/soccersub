goog.module('soccersub.Game');
const Dialog = goog.require('goog.ui.Dialog');
const googDom = goog.require('goog.dom');
const Lineup = goog.require('soccersub.Lineup');
const Player = goog.require('soccersub.Player');
const Position = goog.require('soccersub.Position');
const Prompt = goog.require('goog.ui.Prompt');
const Storage = goog.require('soccersub.Storage');
const util = goog.require('soccersub.util');

let deployTimestamp = window['deployTimestamp'] || 'dev';

class Game {
  /**
   * @param {!Lineup} lineup
   */
  constructor(lineup) {
    goog.dom.getRequiredElement('game_version').textContent = deployTimestamp;

    /** @type {boolean} */
    this.showTimesAtPosition = false;
    /** @type {boolean} */
    this.debugSorting = false;

    // Set up HTML element connections & handlers.
    this.gameClockElement = goog.dom.getRequiredElement('game_clock');
    /** @type {!Element} */
    this.toggleClockButton = util.setupButton('clock_toggle',
                                              () => this.toggleClock());

    /** @type {Position} */
    this.positionWithLongestShift = null;

    /** @type {?Element} */
    this.dragElement = null;

    /** @type {?Position} */
    this.dragOverPosition = null;
    
    /** @type {?Position} */
    this.dragStartPosition = null;
    
    /** @type {string} */
    this.dragSaveBackgroundColor = '';
    
    /** @type {?Player} */
    this.dragPlayer = null;

    /** @type {?Event} */
    this.dragMoveEvent = null;

    /** @type {!Element} */
    this.statusBar = goog.dom.getRequiredElement('status_bar');

    /** @type {!Element} */
    this.dragVisual = goog.dom.getRequiredElement('drag-visual');

    /** @type {!Element} */
    this.dragText = goog.dom.getRequiredElement('drag-text');

    /** @type {!Element} */
    this.timeAdjust = goog.dom.getRequiredElement('time-adjust');
    /** @type {!Element} */
    this.cumulativeAdjustedTime = 
      goog.dom.getRequiredElement('time-adjust-cumulative');
    /** @type {number} */
    this.cumulativeAdjustedTimeSec = 0;

    //this.statusBarWriteMs = 0;
    /** @type {boolean} */
    this.timeoutPending = false;
    /** @type {!Element} */
    this.resetTag = goog.dom.getRequiredElement('reset');
    util.handleTouch(this.resetTag, this.bind(this.confirmAndReset));
    /** @type {!Element} */
    this.showLogTag = goog.dom.getRequiredElement('show-log');
    util.handleTouch(this.showLogTag, this.bind(this.showLog));
    this.gameDiv = goog.dom.getRequiredElement('game');
    this.logDiv = goog.dom.getRequiredElement('log');
    this.lineupDiv = goog.dom.getRequiredElement('lineup');
    this.logText = goog.dom.getRequiredElement('log-text');
    util.setupButton('show-game1', () => this.showGame());
    util.setupButton('show-game2', () => this.resetLineupAndShowGame());
    this.started = false;
    /** @type {!Element} */
    this.makeSubsButton = util.setupButton('make-subs', () => this.makeSubs());
    this.makeSubsButton.style.backgroundColor = 'lightgray';
    /** @type {!Element} */
    this.cancelSubsButton = util.setupButton('cancel-subs', 
                                             () => this.cancelSubs());
    this.cancelSubsButton.style.backgroundColor = 'lightgray';
    util.setupButton('adjust-roster', () => this.adjustRoster());
    util.setupButton('adjust-positions', () => this.adjustPositions());
    
    const setupTimeAdjust = (id, deltaSec) => {
      util.handleTouch(goog.dom.getRequiredElement(id),
                       () => this.adjustTime(deltaSec));
    };
    setupTimeAdjust('sub-1-minute', -60);
    setupTimeAdjust('sub-10-sec', -10);
    setupTimeAdjust('sub-5-sec', -5);
    setupTimeAdjust('sub-1-sec', -1);
    setupTimeAdjust('add-1-sec', 1);
    setupTimeAdjust('add-5-sec', 5);
    setupTimeAdjust('add-10-sec', 10);
    setupTimeAdjust('add-1-minute', 60);

    goog.events.listen(this.gameDiv, 'touchstart', this.dragStart, false, this);
    goog.events.listen(this.gameDiv, 'touchmove', this.dragMove, false, this);
    goog.events.listen(this.gameDiv, 'touchend', this.dragEnd, false, this);

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
    /** @type {string} */
    this.log_ = '';
    /** @type {number} */
    this.updateCount = 0;

    this.constructPlayersAndPositions();
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
      dialog.dispose();
    });
    dialog.setVisible(true);
  }

  reset() {
    try {
      this.elapsedTimeMs = 0;
      this.timeOfLastUpdateMs = 0;
      this.rendered = false;
      this.positions = [];
      this.selectedPlayer = null;
      this.constructPlayersAndPositions();
      this.sortAndRenderPlayers(false);
      this.timeRunning = false;
      this.started = false;
      this.cumulativeAdjustedTimeSec = 0;
      this.showAdjustedTime();
      //this.lineup.reset();
      //this.lineup.render(goog.dom.getRequiredElement('positions'));
      this.update();
      this.log('reset');
    } catch (err) {
      this.writeStatus('ERROR: ' + err + '\n' + err.stack);
    }
  }

  /**
   * @param {!Element} field
   * @return {!Element} 
   */
  makeTableRow(field) {
    const table = document.createElement('table');
    table.className = 'field-row';
    field.appendChild(table);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    const tr = document.createElement('tr');
    tbody.appendChild(tr);
    return tr;
  }

  /**
   * @param {!Element} tableRow
   * @param {string} name
   */
  makePositionElement(tableRow, name) {
    const td = document.createElement('td');
    td.className = 'player';
    td.id = name;
    tableRow.appendChild(td);
  }

  constructPlayersAndPositions() {
    var headRow = goog.dom.getRequiredElement('table-head-row');
    this.positions = [];
    const field = goog.dom.getRequiredElement('field');
    field.innerHTML = '';
    for (const row of this.lineup.getActivePositionNames()) {
      const tableRow = util.makeSingleRowTable(field);
      for (const positionName of row) {
        if (positionName) {
          this.makePositionElement(tableRow, positionName);
          const position = new Position(positionName, headRow, this);
          this.positions.push(position);
          util.handleTouch(
            position.element, this.bind(this.selectPosition, position));
        }
      }
    }
    this.activePlayers = [];
    this.playerMap = new Map();
    for (const name of this.lineup.playerNames) {
      var player = new Player(name, this.lineup, this);
      this.activePlayers.push(player);
      player.available = true;
      this.playerMap.set(name, player);
    }
    for (const name of this.lineup.unavailablePlayerNames) {
      var player = new Player(name, this.lineup, this);
      player.available = false;
      this.playerMap.set(name, player);
    }
  }

  /**
   * @param {!Event} event
   * @return {?Position}
   */
  findPositionAtEvent(event) {
    for (const position of this.positions) {
      if (util.inside(event.clientX, event.clientY, position.boundingBox())) {
        return position;
      }
    }
    return null;
  }

  /**
   * @param {!Event} event
   * @return {?Player}
   */
  findPlayerAtEvent(event) {
    for (const player of this.activePlayers) {
      if (util.inside(event.clientX, event.clientY, player.boundingBox())) {
        return player;
      }
    }
    return null;
  }

  dragStart(e) {
    console.log('drag start: ' + e.clientX + ',' + e.clientY);
    this.cleanupDrag();
    this.dragStartPosition = this.findPositionAtEvent(e);
    this.dragPlayer = this.dragStartPosition
      ? this.dragStartPosition.currentPlayer : this.findPlayerAtEvent(e);
    if (this.dragPlayer) {
      this.dragVisual.style.display = 'block';
      this.dragText.textContent = this.dragPlayer.name;
      this.dragMove(e);

      this.selectPlayer(this.dragPlayer);
    }
  }

  dragMove(event) {
    console.log('drag move: ' + event.clientX + ',' + event.clientY);
    if (!this.dragPlayer) {
      return;
    }

    if (!this.dragMoveEvent) {
      window.requestAnimationFrame(() => {
        const height = this.dragVisual.clientHeight;
        this.dragVisual.style.left = this.dragMoveEvent.clientX + 'px';
        this.dragVisual.style.top = (this.dragMoveEvent.clientY - height) + 'px';
        const position = this.findPositionAtEvent(this.dragMoveEvent);
        if (this.dragOverPosition != position) {
          if (this.dragOverPosition && 
              this.dragOverPosition != this.dragStartPosition) {
            this.dragOverPosition.element.style.backgroundColor =
              this.dragSaveBackgroundColor;
          }
          this.dragOverPosition = position;
          if (position && position != this.dragStartPosition) {
            this.dragSaveBackgroundColor = position.element.style.backgroundColor;
            position.element.style.backgroundColor = 'green';
          }
        }
        this.dragMoveEvent = null;
      });
    }
    event.preventDefault();
    this.dragMoveEvent = event;
  }

  dragEnd(e) {
    console.log('drag end: ' + e.clientX + ',' + e.clientY);
    if (!this.dragPlayer) {
      return;
    }

    const position = this.findPositionAtEvent(e);
    if (position && (this.dragPlayer.currentPosition != position)) {
      this.addPendingAssignment(this.dragPlayer, position);
      this.makeSubsButton.style.backgroundColor = 'white';
      this.cancelSubsButton.style.backgroundColor = 'white';
    }
    this.cleanupDrag();
  }

  cleanupDrag() {
    this.dragPlayer = null;
    this.dragVisual.style.display = 'none';
    if (this.dragElement) {
      goog.style.setOpacity(this.dragElement, 1.0);
      this.dragElement = null;
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
          player.available = true;
        } else {
          player = new Player(name, this.lineup, this);
        }
      }
      this.activePlayers.push(player);
    }

    // The remaining previouslyActivePlayers are now inactive.
    for (const player of previouslyActivePlayers.values()) {
      player.available = false;
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
      this.log('restore failed: local storage not available');
      return false;
    }

    try {
      var storedGame = window.localStorage.game;
      if (!storedGame) {
        this.log('restore failed: no "game" entry in localStorage');
        return false;
      }
      var map = /** @type {!Object} */ (JSON.parse(storedGame));

      this.rendered = false;
      if (!this.lineup.restore(map)) {
        this.log('restore failed: lineup restore failure');
        return false;
      }
/*
      const playerSection = Player.dbSection(this.lineup);
      for (const player of this.playerMap.values()) {
        player.restore(map);
      }
*/
      this.constructPlayersAndPositions();
      for (const player of this.playerMap.values()) {
        const positionName = player.restore(map);
        if (positionName) {
          const position = this.findPosition(positionName);
          // position can be null here if the list of positions is adjusted
          // mid-game.
          if (position) {
            player.setPosition(position, false);
            position.setPlayer(player);
          }
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
      this.cumulativeAdjustedTimeSec = map.cumulativeAdjustedTimeSec || 0;
      this.timeRunning = map.timeRunning;
      this.started = map.started;
      this.timeOfLastUpdateMs = map.timeOfLastUpdateMs;
      this.sortAndRenderPlayers(true);
      for (const player of this.activePlayers) {
        player.updateColor();
      }
      this.showAdjustedTime();
      this.update();
      this.log('restore');
      return true;
    } catch (err) {
      this.log('restore failed: exception caught: ' + err);
      return false;
    }
  }

  /**
   * @param {string} name
   * @return {?Position}
   */
  findPosition(name) {
    for (const position of this.positions) {
      if (position.name == name) {
        return position;
      }
    }
    return null;
  }

  nsave() {
    //this.storage.saveToLocalStorage();
  }

  save() {
    var map = {};
    map.elapsedTimeMs = this.elapsedTimeMs;
    map.cumulativeAdjustedTimeSec = this.cumulativeAdjustedTimeSec;
    map.timeRunning = this.timeRunning;
    map.started = this.started;
    map.timeOfLastUpdateMs = this.timeOfLastUpdateMs;
    this.lineup.save(map);
    const playerSection = Player.dbSection(this.lineup);
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
    var changed = true; // !this.rendered || force;
    for (var i = 0; !changed && (i < players.length); ++i) {
      changed = players[i] != this.activePlayers[i];
    }
    if (changed) {
      this.rendered = true;
      this.activePlayers = players;
      var tableBody = goog.dom.getRequiredElement('table-body');
      tableBody.innerHTML = '';
      for (const player of this.activePlayers) {
        if (!player.currentPosition && !player.nextPosition) {
          player.render(tableBody);
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
      this.timeAdjust.style.display = 'none';
    } else {
      this.gameClockElement.style.backgroundColor = 'pink';
      this.timeAdjust.style.display = 'block';
      if (this.elapsedTimeMs == 0) {
        this.toggleClockButton.textContent = 'Start Clock';
      } else {
        this.toggleClockButton.textContent = 'Resume Clock';
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
          this.save();
          this.constructPlayersAndPositions();
          this.restore();
        }
        prompt.dispose();
      });
    prompt.setRows(15);
    prompt.setDefaultValue(this.lineup.getPlayersAsText());
    prompt.setVisible(true);
  }

  adjustPositions() {
    this.logDiv.style.display = 'none';
    this.gameDiv.style.display = 'none';
    this.lineupDiv.style.display = 'block';
/*
    const prompt = new goog.ui.Prompt(
      'Position Entry',
      'Positions names in lines, each position separated by comma',
      (response) => {
        if (response) {
          this.lineup.setPositionsFromText(response);
          this.save();
          this.constructPlayersAndPositions();
          this.restore();
        }
        prompt.dispose();
      });
    prompt.setRows(15);
    prompt.setDefaultValue(this.lineup.getPositionsAsText());
    prompt.setVisible(true);
*/
  }

  showLog() {
    this.logDiv.style.display = 'block';
    this.gameDiv.style.display = 'none';
    this.lineupDiv.style.display = 'none';
    window.scrollTo(0, document.body.scrollHeight);
  }

  showGame() {
    this.logDiv.style.display = 'none';
    this.gameDiv.style.display = 'block';
    this.lineupDiv.style.display = 'none';
  }

  resetLineupAndShowGame() {
    this.save();
    this.constructPlayersAndPositions();
    this.restore();
    this.showGame();
  }

  /**
   * @param {?Player} player
   */
  selectPlayer(player) {
    if (this.selectedPlayer == player) {
      // If new player is already selected, we're done
      return;
    }
    if (this.selectedPlayer != null) {
      this.selectedPlayer.unselect();
    }
    this.selectedPlayer = player;
    if (player != null) {
      player.select();
    }
    if (this.selectedPlayer == null) {
      this.writeStatus(' ');
    } else {
      this.writeStatus(this.selectedPlayer.status());
    }
    this.redrawPositions();
  }

  /**
   * @param {?Position} position
   */
  selectPosition(position) {
    this.selectPlayer(position.currentPlayer);
  }

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
    var unavailable = (this.selectedPlayer != null) && !this.selectedPlayer.available;
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

  log(text) {
    const msg = util.formatTime(this.elapsedTimeMs) + ': ' + text + '\n';
    //this.log_ += msg;
    this.logText.textContent += msg;
    this.writeStatus(msg);
  }

  /**
   * @param {!Player} player
   * @param {!Position} position
   */
  addPendingAssignment(player, position) {
    if (player.available && position.nextPlayer != player) {
      position.setNextPlayer(player);
      player.setNextPosition(position);
      this.writeStatus(player.status());
      this.sortAndRenderPlayers(false);
    }
  }

  makeSubs() {
    // Make a first-pass over the planned substitutions, where we
    // collect all the subs we intend to make in a local array.  This
    // is becasue if you make the subs in the first pass, and you are
    // trying to get players to swap positions, the sanity logic can
    // erase a pending assignments that would be not make sense by
    // itself.
    const subs = [];
    for (const position of this.positions) {
      const player = position.nextPlayer;
      if (player && player.available) {
        subs.push([position, player]);
      }
    }

    // Now walk through the collected substitution list and execute them.
    for (const [position, player] of subs) {
      player.setPosition(position, true);
      this.writeStatus(player.status());
      position.setPlayer(player);
      this.log(player.name + ' --> ' + (position ? position.name : 'null'));
    }
    this.makeSubsButton.style.backgroundColor = 'lightgray';
    this.cancelSubsButton.style.backgroundColor = 'lightgray';
    this.sortAndRenderPlayers(false);
    this.started = true;
    this.update();
  }
  
  cancelSubs() {
    for (const position of this.positions) {
      if (position.nextPlayer) {
        if (position.nextPlayer.nextPosition == position) {
          position.nextPlayer.setNextPosition(null);
        }
        position.setNextPlayer(null);
      }
      position.render();
    }
    this.makeSubsButton.style.backgroundColor = 'lightgray';
    this.cancelSubsButton.style.backgroundColor = 'lightgray';
    this.sortAndRenderPlayers(false);
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
    //this.writeStatus('updating: ' + ++this.updateCount);
    if (this.timeRunning) {
      var timeMs = util.currentTimeMs();
      var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
      if (timeSinceLastUpdate > 0) {
        this.elapsedTimeMs += timeSinceLastUpdate;
        this.timeOfLastUpdateMs = timeMs;
        for (const position of this.positions) {
          position.addTimeToShift(timeSinceLastUpdate);
        }
        if (this.dragPlayer == null) {
          this.sortAndRenderPlayers(false);
        }
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

  adjustTime(deltaSec) {
    let deltaMs = deltaSec * 1000;
    if (this.elapsedTimeMs + deltaMs < 0) {
      deltaMs = -this.elapsedTimeMs;
      deltaSec = deltaMs / 1000;
    }
    this.elapsedTimeMs += deltaMs;
    this.cumulativeAdjustedTimeSec += deltaSec;
    this.showAdjustedTime();
    this.update();
  }

  showAdjustedTime() {
    this.cumulativeAdjustedTime.textContent = '' + 
      Math.round(this.cumulativeAdjustedTimeSec) + 'sec';
  }
}

exports = Game;
