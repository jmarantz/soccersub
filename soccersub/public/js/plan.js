goog.module('soccersub.Plan');
const Drag = goog.require('soccersub.Drag');
const Lineup = goog.require('soccersub.Lineup');
const googDom = goog.require('goog.dom');
const util = goog.require('soccersub.util');

class Plan {
  /**
   * @param {!Lineup} lineup
   * @param {function()} save
   */
  constructor(lineup, save) {
    /** @type {!Lineup} lineup */
    this.lineup = lineup;
    /** @type {number} */
    this.minutesRemainingInHalf = 24;
    /** @type {number} */
    this.minutesRemainingInGame = 48;
    /** @private {function()} */
    this.save_ = save;
    /** @private {!Array<string>} */
    this.players_ = [];
    util.setupButton('reset-plan', () => this.reset());

    /** @private {!Drag<number, number>} */
    this.drag_ = new Drag(googDom.getRequiredElement("plan-panel"), 
                          (event) => this.findDragSource(event),
                          (event) => this.findDragTarget(event),
                          (source, target) => this.drop_(source, target));

    /** !private {!Element} */
    this.thead_ = googDom.getRequiredElement('player-matrix-head');
    /** !private {!Element} */
    this.tbody_ = googDom.getRequiredElement('player-matrix-body');
  }

  // Resets the player-list from the lineup and randomizes.
  reset() {
    this.players_ = [...this.lineup.playerNames];
    util.shuffle(this.players_);
    this.render();
    this.save_();
  }

  /** @param {!Object} map */
  save(map) {
    map['plan'] = this.players_;
  }

  /** 
   * @param {!Object} map
   * @return {boolean}
*/
  restore(map) {
    this.players_ = map['plan'] || [];
    this.render();
    return true;
  }

  // Freshens player list while trying to avoid changing the position
  // of existing players.
  freshenPlayerList() {
    console.log('old: ' + this.players_);

    // Do a first pass over the existing players, making a note of new players
    // and deleted players based on the set in lineup.
    const newPlayerSet = new Set(this.lineup.playerNames);
    const deletedPlayerSet = new Set();
    for (const player of this.players_) {
      if (newPlayerSet.has(player)) {
        newPlayerSet.delete(player);
      } else {
        deletedPlayerSet.add(player);
      }
    }

    // Now do another pass, building the freshened list, and 
    // replacing this.players_ with it.
    const newPlayerPool = [...newPlayerSet];
    let poolIndex = 0;
    const newPlayerList = [];
    for (const player of this.players_) {
      if (deletedPlayerSet.has(player)) {
        if (poolIndex < newPlayerPool.length) {
          newPlayerList.push(newPlayerPool[poolIndex++]);
        }
      } else {
        newPlayerList.push(player);
      }
    }
    for (; poolIndex < newPlayerPool.length; ++poolIndex) {
      newPlayerList.push(newPlayerPool[poolIndex]);
    }
    this.players_ = newPlayerList;
    if (this.players_.length != this.lineup.playerNames.size) {
      debugger;
    }
    console.log('new: ' + this.players_);
  }

  render() {
    this.thead_.innerHTML = '';
    this.tbody_.innerHTML = '';

    this.freshenPlayerList();

    const addTextElement = (parent, text, type) => {
      const item = document.createElement(type);
      item.textContent = text;
      parent.appendChild(item);
    };

    addTextElement(this.thead_, 'Time', 'th');
    //addTextElement(thead, 'Time-', 'th');

    // Put the abbreviated position names into the table head, in one row.
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
        }
      }
    }

    // Pick a player ordering at random.  Player N-2 will be goalie for the
    // first half.  Player N-1 will be goalie for the second half.  We can
    // intereractively swap players later, with drag & drop, to get the
    // right goalies.
    const numFieldPlayers = this.players_.length - 1;
    const numFieldPositions = this.lineup.getNumPositions() - 1;
    const shiftMinutes = this.minutesRemainingInHalf / numFieldPlayers;
    let keeper = this.players_[numFieldPlayers];
    const shiftSec = shiftMinutes * 60;
    
    const assignments = this.players_.slice(0, numFieldPositions);
    let positionToSwap = 0;
    let nextPlayer = numFieldPositions % numFieldPlayers;
    
    // Subtract one to avoid a 1-second shift at end due to rounding error.
    const halfSec = 60 * this.minutesRemainingInHalf - 1;
    const gameSec = 60 * this.minutesRemainingInGame - 1;
    let half = 0;

    const swapKeepers = () => {
      this.players_[numFieldPlayers] = this.players_[numFieldPlayers - 1];
      this.players_[numFieldPlayers - 1] = keeper;
      keeper = this.players_[numFieldPlayers];
    };

    let firstRowOfHalf = true;
    let previousSwap = null;
    for (let sec = 0; sec < gameSec; sec += shiftSec) {
      if ((half == 0) && (sec >= halfSec)) {
        ++half;
        sec = halfSec + 1;
        const tr = document.createElement('tr');
        this.tbody_.appendChild(tr);
        const td = document.createElement('td');
        tr.appendChild(td);
        td.className = 'plan-divider';
        td.setAttribute('colspan', numFieldPlayers + 2);
        swapKeepers();
        firstRowOfHalf = true;
      }

      const tr = document.createElement('tr');
      this.tbody_.appendChild(tr);
      addTextElement(tr, util.formatTime(sec * 1000), 'td');
      for (let i = 0; i < numFieldPositions; ++i) {
        if (firstRowOfHalf || (i == previousSwap)) {
          addTextElement(tr, assignments[i], 'td');
        } else {
          addTextElement(tr, '', 'td');
        }
      }
      addTextElement(tr, keeper, 'td');
      previousSwap = positionToSwap;
      assignments[positionToSwap] = this.players_[nextPlayer];
      positionToSwap = (positionToSwap + 1) % numFieldPositions;
      nextPlayer = (nextPlayer + 1) % numFieldPlayers;
      firstRowOfHalf = false;
    }
    swapKeepers();
  }

  compute() {
    // Strategy:
    //  1. goalies divide time evenly.
    //  2. a percentage of time played during the game exclusive of
    //     goalie is computed.  So if the first-half keeper plays gets
    //     half the minutes in the second half, his percentage is 50%,
    //     even though you could argue he was in 75% of the game
    //     overall.
    //  3. Each player plays half his minutes at forward and half his
    //     minutes at defense.
    //  4. Certain players may be paired with each other, and an
    //     attempt can be made to accomodate that if it's in the model.
    //  5. Cetain players may prefer playing on right or left, and this
    //     can be factored in as well.
    //  6. the plan can be recomputed at any time during the game, and
    //     does the best job possible of evening out the time given what's
    //     happened so far, even if that was not according to plan, or even
    //     if the set of available players changed.
    //  7. In general a perfect solution is not possible, and arbitrary
    //     points are assigned to the goals above, and we try to find the
    //     max point-score overall for the team.

    // Ignore goalies for now.  Focus on field players.
    
  }

  /**
   * @param {!Event} event
   * @return {?{source:number, label: string, element: !Element}}
   */
  findPlayer(event) {
    const rowColElement = this.findRowColumn(event.clientX, event.clientY);
    if (!rowColElement) {
      return null;
    }

    const {row, column, element} = rowColElement;

    if (row == 0) {
      // We are dragging a position, which means we swapping columns as a whole.
      // as opposed to swapping player roles.  For now ignore.
      return null;
    }

    const player = element.textContent;
    const playerIndex = this.players_.indexOf(player);
    if (playerIndex == -1) {
      console.log('Could not find player: ' + player);
      return null;              // Cannot find player.  Shouldn't happen.
    }

    return {source: playerIndex, label: player, element: element};
  }

  /**
   * @param {!Event} event
   * @return {?{source:number, label: string}}
   */
  findDragSource(event) {
    const playerInfo = this.findPlayer(event);
    if (!playerInfo) {
      return null;
    }
    return {source: playerInfo.source, label: playerInfo.label};
  }

  /**
   * @param {!Event} event
   * @return {?{target: number, element: !Element}}
   */
  findDragTarget(event) {
    const playerInfo = this.findPlayer(event);
    if (!playerInfo) {
      return null;
    }
    return {target: playerInfo.source, element: playerInfo.element};
  }

  /**
   * @param {number} player1
   * @param {number} player2
   * @private
   */
  drop_(player1, player2) {
    [this.players_[player1], this.players_[player2]] = 
      [this.players_[player2], this.players_[player1]];
    this.render();
  }

  /**
   * Finds the row/column of the planning table.  If the head is selected,
   * row==0 is returned, so row==1 is the first row.
   *
   * @param {number} x
   * @param {number} y
   * @return {?{row: number, column: number, element: !Element}}
   */
  findRowColumn(x, y) {
    // First find the row matching the y-position.
    let rowInfo = this.findRow(y);
    if (!rowInfo) {
      return null;
    }
    let colIndex = 0;
    for (const td of rowInfo.rowElement.getElementsByTagName(rowInfo.dataTag)) {
      const bounds = td.getBoundingClientRect();
      if ((x >= bounds.left) && (x <= bounds.right)) {
        return {row: rowInfo.rowIndex, column: colIndex, element: td};
      }
    }
    return null;
  }

  /**
   * @param {number} y
   * @return {?{rowIndex: number, rowElement: !Element, dataTag: string}}
   */
  findRow(y) {
    const rowElement = this.thead_;
    let bounds = this.thead_.getBoundingClientRect();
    if ((y >= bounds.top) && (y <= bounds.bottom)) {
      return {rowIndex: 0, rowElement: this.thead_, dataTag: 'th'};
    } else {
      let rowIndex = 1;
      for (const row of this.tbody_.getElementsByTagName('tr')) {
        bounds = row.getBoundingClientRect();
        if ((y >= bounds.top) && (y <= bounds.bottom)) {
          return {rowIndex: rowIndex, rowElement: row, dataTag: 'td'};
        }
        ++rowIndex;
      }
    }
    return null;
  }
}

exports = Plan;
