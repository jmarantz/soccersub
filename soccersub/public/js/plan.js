goog.module('soccersub.Plan');
const Assignment = goog.require('soccersub.Assignment');
const Drag = goog.require('soccersub.Drag');
const Lineup = goog.require('soccersub.Lineup');
const PlanCalculator = goog.require('soccersub.PlanCalculator');
const googDom = goog.require('goog.dom');
const util = goog.require('soccersub.util');

/**
 * When we initiate a drag, we capture the player we are swapping, and
 * the game-half (0 or 1) in which we want the swap to occur.  The swaps
 * only have a context within the current half, because each half can be
 * tweaked independently.
 *
 * @typedef {!{
 *   playerIndex: number,
 *   positionIndex: number,
 *   half: number,
 *   row: number,
 * }}
 */
let DragSource;

/**
 * We can drop a player onto another player (a "player drop"), or, if
 * he's not keeper -- we can drop him to another row in the same
 * column, in order to adjust when he is subbed in.  Note that we
 * cannot adjust the timing of a keeper, or anyone starting in the
 * half. We'll call this a timing-drop.
 *
 * @typedef {!{
 *   playerIndex: number,
 *   rowIndex: number,
 *   positionIndex: number,
 * }}
 */
let DragTarget;

class Plan {
  /**
   * @param {!Lineup} lineup
   * @param {function()} save
   * @param {function(string)} log
   */
  constructor(lineup, save, log) {
    util.setupButton('reset-plan', () => this.resetAndRender());

    /** @type {!Lineup} lineup */
    this.lineup = lineup;
    /** @type {!PlanCalculator} */
    this.calculator_ = new PlanCalculator(lineup, save, log);
    /** @type {number} */
    this.minutesPerHalf = 24;
    /** @private {function()} */
    this.save_ = save;
    /** @private {function(string)} */
    this.log_ = log;
    /** @private {!Array<string>} */
    this.players_ = [];    // alphabetical list of players.
    /** @private {!Array<!Array<number>>} */
    this.playerOrder_ = [[], []];
    /** @private {!Array<!Array<number>>} */
    this.positionOrder_ = [[], []];
    /** @private {!Drag<DragSource, DragTarget>} */
    this.drag_ = new Drag(googDom.getRequiredElement("plan-panel"), 
                          (event) => this.findDragSource(event),
                          (event, source) => this.findDragTarget(event, source),
                          (source, target) => this.drop_(source, target));
    /** @private {!Element} */
    this.thead_ = googDom.getRequiredElement('player-matrix-head');
    /** @private {!Element} */
    this.tbody_ = googDom.getRequiredElement('player-matrix-body');
    /** @private {!Array<!Assignment>} */
    this.assignments_ = [];
    /** @private {!Array<number>} */
    this.startRows_ = [];       // indexed by half
    /** @private {!Array<string>} */
    this.positionNames_ = [];
  }

  // Resets the player-list from the lineup and randomizes.
  resetAndRender() {
    this.reset();
    this.render();
    this.save_();
  }

  /**
   * Resets the player-list from the lineup and randomizes.
   */
  reset() {
    this.players_ = [...this.lineup.playerNames];
    this.playerOrder_ = [[], []];
    this.positionOrder_ = [[], []];
    for (let half = 0; half < 2; ++half) {
      this.playerOrder_[half] = [...Array(this.players_.length).keys()];
      util.shuffle(this.playerOrder_[half]);
      this.positionOrder_[half] =
        [...Array(this.lineup.getNumPositions()).keys()];
      // We don't shuffle the positionOrder -- it's not necessary to
      // introduce 2 dimensinons of entropy, and we also never want to
      // re-order the keeper.
    }
    this.save_();
    this.startRows_ = [];
  }

  /** @param {!Object} map */
  save(map) {
    if (!this.checkOrder()) {
      console.log('saving invalid playerOrder');
    }
    map['player_order'] = this.playerOrder_;
    map['position_order'] = this.positionOrder_;
  }

  /** 
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.log_('plan playerOrder...');
    this.playerOrder_ = map['player_order'];
    this.positionOrder_ = map['position_order'];
    this.log_('plan players...');
    this.players_ = [...this.lineup.playerNames];
    this.log_('plan checking order...');

    // Cleanup any missing or malformed data.
    if (!this.checkOrder()) {
      this.log_('Malformed order');
      this.reset();
      return true;
    }
    this.log_('plan rendering...');
    this.render();
    return true;
  }

  /**
   * Checks to see if playerOrder_ is well formed, returning true if it is.
   * @return {boolean}
   */
  checkOrder() {
    if (!this.playerOrder_ || !Array.isArray(this.playerOrder_) || 
        this.playerOrder_.length != 2) {
      return false;
    }
    /** @param {!Array<number>} order */
    const checkArray = (order, len) => {
      if (!Array.isArray(order) || (order.length != len)) {
        return false;
      }
      // Make sure all the numbers are covered from [0:n-1].
      const covered = new Set();
      for (const index of order) {
        if ((typeof index != 'number') || (index < 0) || 
            (index >= len) || (Math.floor(index) != index) ||
            covered.has(index)) {
          return false;
        }
        covered.add(index);
      }
      return true;
    };
    
    if (!this.playerOrder_.every((a) => checkArray(a, this.players_.length))) {
      return false;
    }
    return this.positionOrder_.every(
      (a) =>  checkArray(a, this.lineup.getNumPositions()));
  }

  // Freshens player list while trying to avoid changing the position
  // of existing players, updating this.playerOrder_ to minimize
  // assignment changes if the number of players remains the same.
  freshenPlayers() {
    // If the number of players changes, we just have to punt and recompute
    // everything.
    if (this.players_.length != this.lineup.getNumPlayers()) {
      console.log('player lengths different: resetting');
      this.reset();
      return;
    }

    // If the player-list has not changed, we are done.
    if (this.players_.every((p, i) => this.lineup.playerNames.has(p))) {
      console.log('lineup didn\'t change: already fresh');
      return;
    }

    const players = [...this.lineup.playerNames];
    // Otherwise try to keep their order the same, even if the new players are
    // not in the same alpahbetical order as they were before.  The new players
    // swap in where the players they replaced were.
    for (let half = 0; half < 2; ++half) {
      /** @type {!Map<string, number>} */
      const indexMap = new Map();
      const freeIndexes = [];
      const playerOrder = this.playerOrder_[half];
      //const posOrder = this.positionOrder_[half];

      // Capture the existing index mappings, as well as the free indexes.
      for (let i = 0; i < this.players_.length; ++i) {
        const index = playerOrder[i];
        if (this.lineup.playerNames.has(this.players_[i])) {
          indexMap.set(this.players_[i], index);
        } else {
          freeIndexes.push(i);
        }
      }

      // Find the new elements, that are in the new lineup, but not in our map.
      // and assign them a free index from the free-list we just collected.
      let nextFree = 0;
      for (const player of this.lineup.playerNames) {
        if (!indexMap.has(player)) {
          indexMap.set(player, freeIndexes[nextFree++]);
        }
      }

      // Finally, copy over the player-list and set their order.
      this.playerOrder_[half] = players.map((player) => indexMap.get(player));
    }
    this.players_ = players;
    if (!this.checkOrder()) {
      this.log_('order borked');
    }
  }

  render() {
    this.thead_.innerHTML = '';
    this.tbody_.innerHTML = '';
    this.freshenPlayers();

    // Pick a player ordering based on this.playerOrder_, which is
    // randomized during reset(), and tweaked by drag & drop.
    // Initially, players_[playerOrder_[half][N-1] will be goalie for
    // a half.  intereractively swap players later, with drag & drop,
    // to get the right goalies.
    const numFieldPlayers = this.players_.length - 1;
    const numFieldPositions = this.lineup.getNumPositions() - 1;
    if ((numFieldPositions <= 0) || (numFieldPlayers <= 0)) {
      return;
    }

    this.assignments_ = [];
    let row = -1;

    const addTextElement = (parent, text, type) => {
      if (type == 'tr') {
        ++row;
      }
      const item = document.createElement(type);
      if (text) {
        item.textContent = text;
      }
      parent.appendChild(item);
      return item;
    };

    addTextElement(this.thead_, 'Time', 'th');

    // Put the abbreviated position names into the table head, in one row.
    this.positionNames_ = [];
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
          this.positionNames_.push(positionName);
        }
      }
    }

    const shiftMinutes = this.minutesPerHalf / numFieldPlayers;
    const shiftSec = shiftMinutes * 60;

    // Subtract one to avoid a 1-second shift at end due to rounding error.
    const halfSec = 60 * this.minutesPerHalf;
    let sec = 0;

    let nextPosition = -1;
    let nextPlayer = 0;

    for (let half = 0; half < 2; ++half) {
      const playerOrder = this.playerOrder_[half];
      const positionOrder = this.positionOrder_[half];
      let firstRowOfHalf = true;
      const tr = addTextElement(this.tbody_, '', 'tr');
      const td = addTextElement(tr, '', 'td');
      td.className = 'plan-divider';
      td.setAttribute('colspan', numFieldPlayers + 2);

      for (let end = (1 + half) * halfSec - 1; sec < end; sec += shiftSec) {
        const tr = addTextElement(this.tbody_, '', 'tr');
        addTextElement(tr, util.formatTime(sec * 1000), 'td');
        const assign = (playerIndex, positionIndex) => {
          const playerName = this.players_[playerOrder[playerIndex]];
          this.assignments_.push({
            playerIndex: playerIndex,
            positionIndex: positionIndex,
            element: addTextElement(tr, playerName, 'td'),
            timeSec: sec,
            row: row,
          });
        };

        let subs = Array(numFieldPositions).fill(-1);
        for (let i = 0; i < numFieldPositions; ++i) {
          if (firstRowOfHalf || (i == nextPosition)) {
            subs[positionOrder[i]] = nextPlayer;
            nextPlayer = (nextPlayer + 1) % numFieldPlayers;
          }
        }
        for (let i = 0; i < subs.length; ++i) {
          if (subs[i] == -1) {
            addTextElement(tr, '', 'td');
          } else {
            assign(subs[i], i);
          }
        }

        if (firstRowOfHalf) {
          assign(numFieldPlayers, numFieldPositions);  // Keeper
          firstRowOfHalf = false;
          this.startRows_.push(row);
        }
        nextPosition = (nextPosition + 1) % numFieldPositions;
      }
    }
  }

  // Assumptions: parents will not notify us whether kids are coming.  Kids
  // will arrive late or leave early. Kids will need to be subed our early
  // for injuries or other reasons.  For this reason, the plan must be
  // extremely dynamic, changing mid-game based on conditions.
  //
  // At the same time, a fair amount of careful manipulation occurs to
  // get players organized as desired, and whatever positions are hand-picked
  // must stay in place, though timing of subs can & will change based on the
  // randomly changing available roster.
  //
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
  //
  // Compute should be re-called whenever a change happens.  E.g. whenever there
  // is:
  //    - a roster change
  //    - a position change a coach might want to switch formations mid-game
  //      or a substitution made

  /**
   * @param {number} x
   * @param {number} y
   * @return {?Assignment}
   */
  findAssignment(x, y) {
    for (const assignment of this.assignments_) {
      const bounds = assignment.element.getBoundingClientRect();
      if ((y >= bounds.top) && (y <= bounds.bottom)) {
        if ((x >= bounds.left) && (x <= bounds.right)) {
          return assignment;
        }
      }
    }
    return null;
  }
  
  /**
   * @param {number} x
   * @param {number} y
   * @return {number}
   */
  findColumnIndex(x, y) {
    // If not dragging 
    for (const assignment of this.assignments_) {
      let bounds = assignment.element.getBoundingClientRect();
      if ((y >= bounds.top) && (y <= bounds.bottom)) {
        const tr = assignment.element.parentElement;
        if (tr.tagName == 'TR') {
          // Figure out which column we are in.
          let columnIndex = 0;
          for (const td of tr.getElementsByTagName('td')) {
            if (td != assignment.element) {
              bounds = td.getBoundingClientRect();
/*
              console.log('checking (' + x + ',' + y + '): left=' + bounds.left + 
                          ', right=' + bounds.right + ', top' + bounds.top +
                          ', bottom=' + bounds.bottom);
*/
              if ((x >= bounds.left) && (x <= bounds.right)) {
                return columnIndex;
              }
            }
            ++columnIndex;
          }
        }
      }
    }
    return -1;
  }

  /**
   * @param {!Assignment} assignment
   * @return {number}
   * @private
   */
  assignHalf_(assignment) {
    return (assignment.timeSec < this.minutesPerHalf * 60) ? 0 : 1;
  }

  /**
   * @param {!Event} event
   * @return {?{source: !DragSource, label: string}}
   */
  findDragSource(event) {
    const assignment = this.findAssignment(event.clientX, event.clientY);
    if (!assignment) {
      return null;
    }
    const half = this.assignHalf_(assignment);
    const source = {
      playerIndex: assignment.playerIndex, 
      positionIndex: assignment.positionIndex, 
      half: half,
      row: assignment.row,
    };
    const playerOrder = this.playerOrder_[half];
    const playerName = this.players_[playerOrder[source.playerIndex]];
    return {source: source, label: playerName};
  }

  /**
   * @param {!Event} event
   * @param {!DragSource} source
   * @return {?{target: !DragTarget, elements: !Array<!Element>}}
   */
  findDragTarget(event, source) {
    const x = event.clientX;
    const y = event.clientY;
    let assignment = this.findAssignment(x, y);
    let targetElements = {
      target: {playerIndex: -1, rowIndex: -1, positionIndex: -1},
      elements: []
    };
    if (!assignment || (this.assignHalf_(assignment) != source.half)) {
      // Keepers are not eligiable.
      const keeper = this.lineup.getNumPositions() - 1;
      if (source.positionIndex == keeper) {
        return null;
      }

      // You can't adjust the time of the first assignment in the ahlf.
      if (this.startRows_.indexOf(source.row) != -1) {
        return null;
      }

      const rowCol = this.findRowColumn(x, y);
      if (!rowCol) {
        return null;
      }
      const {row, column, element} = rowCol;
      console.log('col=' + column);
      if ((row == source.row) || (column - 1 != source.positionIndex)) {
        return null;
      }

      // Now find the assignment that matches the row for this y-position.
      assignment = this.assignments_.find(
        (a) => (a.row == row) && (a.positionIndex != keeper));
      if (!assignment) {
        return null;
      }

      targetElements.target.rowIndex = row;
      targetElements.target.positionIndex = assignment.positionIndex;
      targetElements.elements.push(element);
      targetElements.elements.push(assignment.element);
    } else {
      for (const a of this.assignments_) {
        const aHalf = this.assignHalf_(a) ;
        if ((a.playerIndex == assignment.playerIndex) &&  (aHalf == source.half)) {
          targetElements.elements.push(a.element);
        }
      }
    }
    targetElements.target.playerIndex = assignment.playerIndex;
    return targetElements;
  }

  /**
   * My interpretation of the intent of this drop is that the
   * user primarily wants to swap the default order in which
   * positions get substituted, which we'll do by permuting
   * posOrder.  Hoewver I think it's also nice to keep the
   * same players in the same positions.  So let's say we start
   * with:
   *     LF      RF    LB       RB    Keeper
   *     Al      Ben   Charley  Dave  Ed
   *     Fred
   *             George
   *                   Henry
   *                            Al
   * changing now let's say we grab George and move him
   * up one cell.  Now what we want is:
   *     LF      RF    LB       RB    Keeper
   *     Al      Ben   Charley  Dave  Ed
   *             George
   *     Fred         
   *                   Henry
   *                            Al
   * which we can achieve with three order-map permutations:
   *    1. position-order map swap LF and RF
   *    2. player-order map swap Al and Ben
   *    3. player-order map swap George and Fred.
   *
   * Note that this will not exactly achieve the desired
   * result, as Al re-appears at RB, and after this permutation,
   * Ben will instead appear at RB.
   *
   * It probably doesnt make sense to adjust Al's second
   * appearance in tiem, as it's really dictated in our model by
   * the first appearance.  So will only allow modifying the
   * first substitution for a player.

   * First step is to find which position we are swapping with
   * for timing.
   * @param {!DragSource} source
   * @param {?DragTarget} target
   * @private
   */
  drop_(source, target) {
    if (!target || (target.playerIndex == source.playerIndex)) {
      return;
    }
    if (target.positionIndex != -1) {
      const positionOrder = this.positionOrder_[source.half];
      Plan.swap_(source.positionIndex, target.positionIndex, positionOrder);
      this.log_('plan swap positions ' + 
                this.positionNames_[positionOrder[source.positionIndex]] + ' & ' +
                this.positionNames_[positionOrder[target.positionIndex]]);

      // Also swap the players that were at these positions initially.
      const initialPlayers = [];
      for (const a of this.assignments_) {
        if ((a.row == this.startRows_[source.half]) &&
            ((a.positionIndex == source.positionIndex) ||
             (a.positionIndex == target.positionIndex)) &&
            (a.playerIndex != source.playerIndex) &&
            (a.playerIndex != target.playerIndex)) {
          initialPlayers.push(a.playerIndex);
        }
      }
      if (initialPlayers.length == 2) {
        Plan.swap_(initialPlayers[0], initialPlayers[1], this.playerOrder_[source.half]);
      } else {
        console.log('initialPlayers.length == ' + initialPlayers.length);
      }
    }
    const playerOrder = this.playerOrder_[source.half];
    Plan.swap_(source.playerIndex, target.playerIndex, playerOrder);
    this.log_('plan swap players ' +  
              this.players_[playerOrder[target.playerIndex]] + ' & ' + 
              this.players_[playerOrder[source.playerIndex]]);
    this.render();
    this.save_();
  }

  /**
   * @param {number} src
   * @param {number} dst
   * @param {!Array<number>} array
   */
  static swap_(src, dst, array) {
    [array[src], array[dst]] = [array[dst], array[src]];
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
    console.log('row=' + rowInfo.rowIndex);
    let colIndex = 0;
    for (const td of rowInfo.rowElement.getElementsByTagName(rowInfo.dataTag)) {
      const bounds = td.getBoundingClientRect();
      if ((x >= bounds.left) && (x <= bounds.right)) {
        return {row: rowInfo.rowIndex, column: colIndex, element: td};
      }
      ++colIndex;
    }
    return null;
  }

  /**
   * @param {number} y
   * @return {?{rowIndex: number, rowElement: !Element, dataTag: string}}
   */
  findRow(y) {
    let rowIndex = 0;
    for (const row of this.tbody_.getElementsByTagName('tr')) {
      const bounds = row.getBoundingClientRect();
      if ((y >= bounds.top) && (y <= bounds.bottom)) {
        return {rowIndex: rowIndex, rowElement: row, dataTag: 'td'};
      }
      ++rowIndex;
    }
    return null;
  }

  /**
   * Returns the next assignment to occur after a given current time in seconds.
   * Currently does a linear walk over the assignment list.  Returns null if there
   * are no more subs in the current half.
   *
   * @param {number} currentTimeSec
   * @return {?Assignment}
   */
  nextAssignment(currentTimeSec) {
    const index = util.upperBound(
      this.assignments_, (assignment) => currentTimeSec < assignment.timeSec);
    if (index == -1) {
      return null;
    }
    return this.assignments_[index];
  }
  
  /**
   * @return {!Array<!Assignment>}
   */
  initialAssignments() {
    const initial = [];
    for (const a of this.assignments_) {
      if (a.row == this.startRows_[0]) {
        initial.push(a);
      }
    }
    return initial;
  }

  /**
   * @param {!Assignment} assignment
   * @return {string}
   */
  assignmentPlayer(assignment) {
    const half = this.assignHalf_(assignment);
    const playerOrder = this.playerOrder_[half];
    return this.players_[playerOrder[assignment.playerIndex]];
  }

  /**
   * @param {!Assignment} assignment
   * @return {string}
   */
  assignmentPosition(assignment) {
    const half = this.assignHalf_(assignment);
    const positionOrder = this.positionOrder_[half];
    return this.positionNames_[positionOrder[assignment.positionIndex]];
  }
}

Plan.Assignment = Assignment;

exports = Plan;
