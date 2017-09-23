goog.module('soccersub.Game');
const Dialog = goog.require('goog.ui.Dialog');
const DragDrop = goog.require('goog.fx.DragDrop');
const DragDropGroup = goog.require('goog.fx.DragDropGroup');
const Lineup = goog.require('soccersub.Lineup');
const Player = goog.require('soccersub.Player');
const Position = goog.require('soccersub.Position');
const Prompt = goog.require('goog.ui.Prompt');
const Storage = goog.require('soccersub.Storage');
const util = goog.require('soccersub.util');

const VERSION_STRING = 'v2';

class Game {
  /**
   * @param {!Lineup} lineup
   */
  constructor(lineup) {
    document.getElementById('game_version').textContent = VERSION_STRING;

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

    /** @type {boolean} */
    this.dragActive = false;

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
    this.adjustPositionsButton = /** @type {!Element} */ 
        (document.getElementById('adjust-positions'));
    this.adjustPositionsButton.style.backgroundColor = 'white';
    util.handleTouch(this.adjustPositionsButton, 
                     this.bind(this.adjustPositions));

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
    /** @type {!DragDropGroup} */
    this.playerDragGroup =  new goog.fx.DragDropGroup();
    /** @type {!DragDropGroup} */
    this.positionDropGroup = new goog.fx.DragDropGroup();
    /** @type {?function():undefined} */
    this.dragRestore = null;
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
      //this.lineup.reset();
      this.update();
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
    var headRow = /** @type {!Element} */ (document.getElementById('table-head-row'));
    this.positions = [];
    const field = document.getElementById('field');
    field.innerHTML = '';
    for (const row of this.lineup.positionNames) {
      const tableRow = this.makeTableRow(field);
      for (const positionName of row) {
        if (positionName) {
          this.makePositionElement(tableRow, positionName);
          const position = new Position(positionName, headRow, this);
          this.positionDropGroup.addItem(position.element, position);
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
    this.positionDropGroup.setTargetClass('target');
    this.positionDropGroup.setSourceClass('source');
    this.positionDropGroup.addTarget(this.positionDropGroup);
    this.positionDropGroup.init();

    goog.events.listen(this.positionDropGroup, 'dragover', (e) => this.dragOver(e));
    goog.events.listen(this.positionDropGroup, 'dragout', (e) => this.dragOut(e));
    goog.events.listen(this.positionDropGroup, 'drop', (e) => this.drop(e));
    goog.events.listen(this.positionDropGroup, 'dragstart', (e) => this.dragStart(e));
    goog.events.listen(this.positionDropGroup, 'dragend', (e) => this.dragEnd(e));

    goog.events.listen(this.playerDragGroup, 'dragstart', (e) => this.dragStart(e));
  }

  saveRestoreColor(event) {
    if (this.dragRestore) {
      this.dragRestore();
      this.dragRestore = null;
    }
    if (event && event.dropTargetItem) {
      const dragSaveColor = event.dropTargetItem.element.style.backgroundColor;
      this.dragRestore = () => event.dropTargetItem.element.style.backgroundColor
        = dragSaveColor;
    }
  }

  dragOver(event) {
    this.saveRestoreColor(event);
    event.dropTargetItem.element.style.backgroundColor = 'green';
  }

  dragOut(event) {
    this.saveRestoreColor(null);
  }

  dragStart(event) {
    this.saveRestoreColor(event);
    goog.style.setOpacity(event.dragSourceItem.element, 0.5);
    this.dragActive = true;
    console.log('starting drag');
  }

  dragEnd(event) {
    this.saveRestoreColor(event);
    goog.style.setOpacity(event.dragSourceItem.element, 1.0);
    this.dragActive = false;
    console.log('finished drag');
  }

  drop(event) {
    this.saveRestoreColor(event);

    // We can drop positions over other positions, for one a player is moved
    // directly from one position to another without going out first.  So
    // check if the source is a player or a position.
    const source = event.dragSourceItem.data;
    let player;
    if (source instanceof Player) {
      player = source;
    } else {
      player = source.currentPlayer;
    }
    if (!player) {
      return;
    }
    const position = /** type {!Position} */ (event.dropTargetItem.data);
    this.dragActive = false;
    this.assignPosition(player, position);
    console.log('drop');
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
      return false;
    }

    try {
      var storedGame = window.localStorage.game;
      if (!storedGame) {
        return false;
      }
      var map = /** @type {!Object} */ (JSON.parse(storedGame));

      this.rendered = false;
      if (!this.lineup.restore(map)) {
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
      this.timeRunning = map.timeRunning;
      this.started = map.started;
      this.timeOfLastUpdateMs = map.timeOfLastUpdateMs;
      this.sortAndRenderPlayers(true);
      for (const player of this.activePlayers) {
        player.updateColor();
      }
      this.update();
      return true;
    } catch (err) {
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
      var tableBody = document.getElementById('table-body');
      tableBody.innerHTML = '';
      for (const player of this.activePlayers) {
        if (!player.currentPosition) {
          player.render(tableBody);
          if (player.nameElement) {
            util.handleTouch(
              player.nameElement, this.bind(this.selectPlayer, player));
            this.playerDragGroup.addItem(player.nameElement, player);
          } else {
            console.log('how does this happen?');
          }
        }
      }
      this.playerDragGroup.addTarget(this.positionDropGroup);
      this.playerDragGroup.setSourceClass('source');
      this.playerDragGroup.init();
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
          this.save();
          this.constructPlayersAndPositions();
          this.restore();
        }
      });
    prompt.setRows(15);
    prompt.setDefaultValue(this.lineup.getPlayersAsText());
    prompt.setVisible(true);
  }

  adjustPositions() {
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
      });
    prompt.setRows(15);
    prompt.setDefaultValue(this.lineup.getPositionsAsText());
    prompt.setVisible(true);
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

  /**
   * @param {?Player} player
   * @param {?Position} position
   */
  assignPosition(player, position) {
    if (player == null) {
      // Can we get here?
      if (position.currentPlayer != null) {
        this.selectPlayer(position.currentPlayer);
      } else {
        this.writeStatus('Select a player before assigning a position');
      }
    } else if (player.available) {
      //const previousPosition = player.currentPosition;
      player.setPosition(position, true);
      this.writeStatus(player.status());
      if (position != null) {
        position.setPlayer(player);
      }
      //if (previousPosition != null) {
      //  previousPosition.setPlayer(null);
      //}

      // Unselect the player so we are less likely to double-assign.
      //this.selectPlayer(null);
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
        if (!this.dragActive) {
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
}

exports = Game;
