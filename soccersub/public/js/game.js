goog.module('soccersub.Game');

const Dialog = goog.require('goog.ui.Dialog');
const Drag = goog.require('soccersub.Drag');
const Assignment = goog.require('soccersub.Assignment2');
const Lineup = goog.require('soccersub.Lineup');
const Plan = goog.require('soccersub.Plan');
const Player = goog.require('soccersub.Player');
const Position = goog.require('soccersub.Position');
//const Storage = goog.require('soccersub.Storage');
const googDom = goog.require('goog.dom');
const util = goog.require('soccersub.util');

let deployTimestamp = window['deployTimestamp'] || 'dev';

/** Maintains the state of a single game. */
class Game {
  /**
   * @param {!Lineup} lineup
   * @param {function(string)} writeStatus
   * @param {function(string)} writeLog
   * @param {function()} save
   * @param {!Plan} plan
   */
  constructor(lineup, writeStatus, writeLog, save, plan) {
    /** @type {function(string)} */
    this.writeStatus = writeStatus;
    /** @private {function(string)} */
    this.writeLog_ = writeLog;
    /** @private {function()} */
    this.save_ = save;
    /** @private {!Plan} */
    this.plan_ = plan;
    /** @type {boolean} */
    this.showTimesAtPosition = false;

    // Set up HTML element connections & handlers.
    this.gameClockElement = util.setupButton(
      'game-clock', () => this.toggleClock());

    /** @type {Position} */
    this.positionWithLongestShift = null;

    /** @type {!Element} */
    this.timeAdjust = goog.dom.getRequiredElement('time-adjust');
    /** @type {!Element} */
    this.cumulativeAdjustedTime = 
      goog.dom.getRequiredElement('time-adjust-cumulative');
    /** @type {number} */
    this.cumulativeAdjustedTimeSec = 0;

    /** @type {boolean} */
    this.timeoutPending = false;
    /** @type {!Element} */
    this.resetTag = util.setupButton('reset', () => this.confirmAndReset());
    /** @type {!Element} */
    this.gameDiv = goog.dom.getRequiredElement('game-panel');
    /** @type {boolean} */
    this.clockStarted = false;
    /** @type {boolean} */
    this.assignmentsMade = false;
    /** @type {number} */
    this.queuedAssignmentTimeSec = -1;
    /** @type {!Element} */
    this.makeSubsButton = util.setupButton('make-subs', () => this.makeSubs());
    this.makeSubsButton.style.backgroundColor = 'lightgray';
    /** @type {!Element} */
    this.cancelSubsButton = util.setupButton('cancel-subs', 
                                             () => this.cancelSubs());
    this.cancelSubsButton.style.backgroundColor = 'lightgray';

    const setupTimeAdjust = (id, deltaSec) => {
      util.setupButton(id, () => this.adjustTime(deltaSec));
    };
    setupTimeAdjust('sub-1-minute', -60);
    setupTimeAdjust('sub-10-sec', -10);
    setupTimeAdjust('sub-5-sec', -5);
    setupTimeAdjust('sub-1-sec', -1);
    setupTimeAdjust('add-1-sec', 1);
    setupTimeAdjust('add-5-sec', 5);
    setupTimeAdjust('add-10-sec', 10);
    setupTimeAdjust('add-1-minute', 60);

    /** @private {!Drag<Player, Position>} */
    this.drag_ = new Drag(this.gameDiv,
                          (event) => this.findDragSource(event),
                          (event, source) => this.findPositionAtEvent(event),
                          (source, target) => this.drop_(source, target));

    /** @type {number} */
    this.elapsedTimeMs;
    /** @type {number} */
    this.timeOfLastUpdateMs;
    /** @type {boolean} */
    this.rendered;
    /** @type {!Array<!Position>} */
    this.positions;
    /** @type {!Map<string, !Position>} */
    this.positionMap;
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
    /** @type {number} */
    this.updateCount = 0;
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

  /**
   * @param {!Assignment} assignment
   * @return {!{player: ?Player, position: ?Position}}
   */
  getPlayerAndPosition(assignment) {
    const player = this.playerMap.get(assignment.playerName);
    const position = this.positionMap.get(assignment.positionName);
    return {player, position};
  }

  reset() {
    try {
      this.elapsedTimeMs = 0;
      this.plan_.updateGameTime(0);
      this.timeOfLastUpdateMs = 0;
      this.rendered = false;
      this.positions = [];
      this.positionMap = new Map();
      this.selectedPlayer = null;
      this.constructPlayersAndPositions();
      this.sortAndRenderPlayers(false);
      this.timeRunning = false;
      this.clockStarted = false;
      this.assignmentsMade = false;
      this.queuedAssignmentTimeSec = -1;
      this.cumulativeAdjustedTimeSec = 0;
      this.showAdjustedTime();
      this.update_(false);
      this.writeLog_('reset');
      for (const assignment of this.plan_.initialAssignments()) {
        const {player, position} = this.getPlayerAndPosition(assignment);
        if (player && position) {
          this.assignPlayerToPosition(player, position);
        }
      }
      this.completeAssignments();
    } catch (err) {
      this.writeStatus('ERROR: ' + err + '\n' + err.stack);
    }
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
    this.positionMap = new Map;
    const field = goog.dom.getRequiredElement('field');
    field.innerHTML = '';
    for (const row of this.lineup.getActivePositionNames()) {
      const tableRow = util.makeSingleRowTable(field);
      for (const positionName of row) {
        if (positionName) {
          this.makePositionElement(tableRow, positionName);
          const abbrev = Lineup.abbrev(positionName);
          const position = new Position(
            positionName, abbrev, headRow,  this.showTimesAtPosition);
          this.positions.push(position);
          this.positionMap.set(positionName, position);
          util.handleTouch(
            position.element, () => this.selectPosition(position), 
            positionName);
        }
      }
    }
    this.constructPlayers();
  }

  constructPlayers() {
    this.activePlayers = [];
    this.playerMap = new Map();
    for (const name of this.lineup.playerNames) {
      var player = new Player(name, this.lineup, this.writeStatus);
      this.activePlayers.push(player);
      player.available = true;
      this.playerMap.set(name, player);
    }
    for (const name of this.lineup.unavailablePlayerNames) {
      var player = new Player(name, this.lineup, this.writeStatus);
      player.available = false;
      this.playerMap.set(name, player);
    }
    this.lineup.modified = false;
  }

  /**
   * @param {!Event} event
   * @return {?{target: !Position, elements: !Array<!Element>}}
   */
  findPositionAtEvent(event) {
    for (const position of this.positions) {
      if (util.inside(event.clientX, event.clientY, position.boundingBox())) {
        return {target: position, elements: [position.element]};
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
      if (player.inside(event.clientX, event.clientY)) {
        return player;
      }
    }
    return null;
  }

  /**
   * @param {!Event} event
   * @return {?{source:!Player, label: string}}
   */
  findDragSource(event) {
    const targetElement = this.findPositionAtEvent(event);
    const player = targetElement ? targetElement.target.currentPlayer :
          this.findPlayerAtEvent(event);
    if (!player) {
      return null;
    }
    this.selectPlayer(player);
    return {source: player, label: player.name};
  }


  /**
   * @param {!Player} player
   * @param {?Position} position
   * @private
   */
  drop_(player, position) {
    if (position && (player.currentPosition != position)) {
      if (this.clockStarted) {
        this.addPendingAssignment(player, position);
      } else {
        this.assignPlayerToPosition(player, position);
        this.completeAssignments();
      }
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
    for (const name of this.lineup.playerNames) {
      let player = previouslyActivePlayers.get(name);
      if (player) {
        previouslyActivePlayers.delete(player.name);
      } else {
        player = this.playerMap.get(name);
        if (player) {
          player.available = true;
        } else {
          player = new Player(name, this.lineup, this.writeStatus);
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
    this.update_(false);
  }

  /**
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.rendered = false;
    if (!this.lineup.restore(map)) {
      this.writeLog_('restore failed: lineup restore failure');
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
      if (positionName && player.available) {
        const position = this.findPosition(positionName);
        // position can be null here if the list of positions is adjusted
        // mid-game.
        if (position) {
          player.setPosition(position, false);
          position.setPlayer(player);
        }
      }
    }

    this.elapsedTimeMs = map['elapsedTimeMs'];
    this.cumulativeAdjustedTimeSec = map['cumulativeAdjustedTimeSec'] || 0;
    this.timeRunning = map['timeRunning'];
    this.clockStarted = !!map['clockStarted'];
    this.queuedAssignmentTimeSec = -1;
    this.timeOfLastUpdateMs = map['timeOfLastUpdateMs'];
    this.sortAndRenderPlayers(true);
    for (const player of this.activePlayers) {
      player.updateColor();
    }
    this.showAdjustedTime();
    this.update_(false);
    this.writeLog_('restore');
    return true;
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

  /** @param {!Object} map */
  save(map) {
    map['elapsedTimeMs'] = this.elapsedTimeMs;
    map['cumulativeAdjustedTimeSec'] = this.cumulativeAdjustedTimeSec;
    map['timeRunning'] = this.timeRunning;
    map['clockStarted'] = this.clockStarted;
    map['assignmentsMade'] = this.assignmentsMade;
    map['timeOfLastUpdateMs'] = this.timeOfLastUpdateMs;
    this.lineup.save(map);
    const playerSection = Player.dbSection(
      this.lineup, (posName) => this.findPosition(posName));
    for (const player of this.playerMap.values()) {
      player.save(map);
    }
  }

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
      /** @type {?Element} */
      let row = null;
      let index = 0;
      const numColumns = 2;
      for (const player of this.activePlayers) {
        if (player.currentPosition || player.nextPosition) {
          continue;
        }
        if ((index % numColumns) == 0) {
          row = document.createElement('tr');
          tableBody.appendChild(row);
        } else {
          const td = document.createElement('td');
          (/** @type {!Element} */ (row)).appendChild(td);
          td.style.width = '10px';
        }
        ++index;
        if (row) {
          player.render(tableBody, /** @type {!Element} */ (row));  // NTI
        }
      }
    }
  }

  toggleClock() {
    this.clockStarted = true;
    this.timeRunning = !this.timeRunning;
    this.timeOfLastUpdateMs = util.currentTimeMs();
    this.update_(true);
  };

  redrawClock() {
    var background = 'white';
    let adjustDisplay = 'none';
    if (this.timeRunning) {
      this.gameClockElement.style.backgroundColor = 'lightgreen';
    } else {
      this.gameClockElement.style.backgroundColor = 'pink';
      this.timeAdjust.style.display = 'block';
      if (this.elapsedTimeMs == 0) {
        this.gameClockElement.innerHTML = 'Start<br>Clock';
      } else {
        adjustDisplay = 'block';
        background = 'red';
      }
    }
    this.timeAdjust.style.display = adjustDisplay;
    this.gameDiv.style.backgroundColor = background;
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
    /** @type {?Position} */
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
    if (this.positionWithLongestShift && 
        this.positionWithLongestShift.currentPlayer) {
      this.positionWithLongestShift.currentPlayer.hasLongestShift = false;
    }
    this.positionWithLongestShift = pos;
    if (pos && pos.currentPlayer) {
      pos.currentPlayer.hasLongestShift = true;
    }
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
  }

  /**
   * @param {!Player} player
   * @param {!Position} position
   */
  addPendingAssignment(player, position) {
    if (player.available && position.nextPlayer != player &&
        (player.currentPosition != position)) {
      if (position.nextPlayer) {
        position.nextPlayer.nextPosition = null;
      }
      position.setNextPlayer(player);
      player.setNextPosition(position);
      this.writeStatus(player.status());
      this.sortAndRenderPlayers(false);
      this.makeSubsButton.style.backgroundColor = 'white';
      this.cancelSubsButton.style.backgroundColor = 'white';
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
    const assignments = [];
    for (const position of this.positions) {
      const player = position.nextPlayer;
      if (player && player.available) {
        subs.push([position, player]);
        assignments.push({
          playerName: player.name,
          positionName: position.name,
          timeSec: this.elapsedTimeMs / 1000,
        });
      }
    }
    // Now walk through the collected substitution list and execute them.
    for (const [position, player] of subs) {
      this.assignPlayerToPosition(player, position);
    }
    this.plan_.executeAssignments(assignments, this.elapsedTimeMs / 1000);

    this.completeAssignments();
  }

  /**
   * @param {!Player} player
   * @param {!Position} position
   */
  assignPlayerToPosition(player, position) {
    player.setPosition(position, true);
    this.writeStatus(player.status());
    position.setPlayer(player);
    this.writeLog_(player.name + ' --> ' + (position ? position.name : 'null'));
  }
  
  completeAssignments() {
    this.makeSubsButton.style.backgroundColor = 'lightgray';
    this.cancelSubsButton.style.backgroundColor = 'lightgray';
    this.sortAndRenderPlayers(false);
    this.queuedAssignmentTimeSec = -1;
    this.assignmentsMade = true;
    this.update_(true);
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

  updateTimer() {
    this.timeoutPending = false;
    this.update_(true);
  };

  /**
   * @private
   * @param {boolean} save
   */
  update_(save) {
    //this.writeStatus('updating: ' + ++this.updateCount);
    if (this.timeRunning) {
      var timeMs = util.currentTimeMs();
      var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
      if (true /*timeSinceLastUpdate > 0*/) {
        this.elapsedTimeMs += timeSinceLastUpdate;
        this.plan_.updateGameTime(this.elapsedTimeMs / 1000);
        this.timeOfLastUpdateMs = timeMs;
        for (const position of this.positions) {
          position.addTimeToShift(timeSinceLastUpdate);
        }
        if (!this.drag_.active()) {
          this.sortAndRenderPlayers(false);
        }
      }
      if (!this.timeoutPending) {
        this.timeoutPending = true;
        window.setTimeout(() => this.updateTimer(), 1000);
      }

      const timeSec = this.elapsedTimeMs / 1000;
      const nextAssignment = this.plan_.nextAssignment(timeSec);
      if (nextAssignment) {
        const {player, position} = this.getPlayerAndPosition(nextAssignment);
        if (player && position) {
          const deltaSec = nextAssignment.timeSec - timeSec;
          this.writeStatus('In ' + Math.round(deltaSec) + 's: ' +
                           nextAssignment.playerName + ' at ' + 
                           nextAssignment.positionName);
          if ((deltaSec < 30) && 
              (this.queuedAssignmentTimeSec < nextAssignment.timeSec)) {
            navigator.vibrate([500]);
            this.addPendingAssignment(player, position);
            this.queuedAssignmentTimeSec = nextAssignment.timeSec;
          } else if ((5 < deltaSec) && (deltaSec <= 7)) {
            navigator.vibrate([500]);
          }
        }
      }
    }
    this.redrawClock();
    this.gameClockElement.innerHTML = this.clockStarted ? 
      util.formatTime(this.elapsedTimeMs) : 'Start<br>Clock';
    if (save) {
      this.save_();
    }
    const started = this.clockStarted || this.assignmentsMade;
    this.resetTag.style.backgroundColor = started ? 'white': 'lightgray';
  }

  adjustTime(deltaSec) {
    let deltaMs = deltaSec * 1000;
    if (this.elapsedTimeMs + deltaMs < 0) {
      deltaMs = -this.elapsedTimeMs;
      deltaSec = deltaMs / 1000;
    }
    this.elapsedTimeMs += deltaMs;
    this.plan_.updateGameTime(this.elapsedTimeMs / 1000);
    this.cumulativeAdjustedTimeSec += deltaSec;
    this.showAdjustedTime();
    this.update_(true);
    for (const position of this.positions) {
      position.addTimeToShift(deltaMs);
    }
    this.computePositionWithLongestShift_();
    this.computePercentageInGameNotKeeper_();
  }

  showAdjustedTime() {
    this.cumulativeAdjustedTime.textContent = '' + 
      Math.round(this.cumulativeAdjustedTimeSec) + 'sec';
  }
}

exports = Game;
