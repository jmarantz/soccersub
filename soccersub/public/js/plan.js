goog.module('soccersub.Plan');
const Assignment = goog.require('soccersub.Assignment2');
const Drag = goog.require('soccersub.Drag');
const Lineup = goog.require('soccersub.Lineup');
const PlanCalculator = goog.require('soccersub.PlanCalculator');
const googDom = goog.require('goog.dom');
const util = goog.require('soccersub.util');

/**
 * Captures an assignment that we want to make. Players are specified as
 * indexes into this.players_.  The critical design question here is what
 * happens to automated and manually specified assignments when:
 *   - a player is swapped or renamed.  In this case, all assignments are
 *     retained except for the even swap.
 *   - players are removed or added.  In this case, the default assignments
 *     are recomputed from scratch based on the player ordering.  We try to
 *     keep the ordering as stable as possible.
 *
 * @typedef {!{
 *   element: !Element,
 *   rowIndex: number,
 *   assignment: !Assignment,
 * }}
 */
let RenderedAssignment;

/**
 * When we initiate a drag, we capture the player we are swapping, and
 * the game-half (0 or 1) in which we want the swap to occur.  The swaps
 * only have a context within the current half, because each half can be
 * tweaked independently.
 *
 * @typedef {!{
 *   playerName: string,
 *   positionName: string,
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
 *   playerName: string,
 *   rowIndex: number,
 *   positionName: string,
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
    /** @private {function()} */
    this.save_ = save;
    /** @private {function(string)} */
    this.log_ = log;
    /** @private {!Drag<DragSource, DragTarget>} */
    this.drag_ = new Drag(googDom.getRequiredElement("plan-panel"), 
                          (event) => this.findDragSource(event),
                          (event, source) => this.findDragTarget(event, source),
                          (source, target) => this.drop_(source, target));
    /** @private {!Element} */
    this.thead_ = googDom.getRequiredElement('player-matrix-head');
    /** @private {!Element} */
    this.tbody_ = googDom.getRequiredElement('player-matrix-body');
    /** @private {!Element} */
    this.pastScrim_ = googDom.getRequiredElement('plan-game-past-scrim');
    /** @private {!Array<number>} */
    this.startRows_ = [];       // indexed by half
    /** @private {!Array<!RenderedAssignment>} */
    this.renderedAssignments_ = [];
    const observer = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.intersectionRatio > 0) {
          this.renderGameProgress_();
          return;
        }
      }
    });
    observer.observe(this.tbody_);
    /** @private {number} */
    this.gameTimeSec_ = 0;
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
    this.calculator_ = new PlanCalculator(this.lineup, this.save_, this.log_);
    this.calculator_.updatePlayers();
    this.calculator_.setupPositions();
    this.calculator_.makeInitialAssignments();
    this.calculator_.computePlan();
    this.save_();
    this.startRows_ = [];
  }

  /** @param {!Object} map */
  save(map) {
    if (!this.checkOrder()) {
      console.log('saving invalid playerOrder');
    }
    //map['player_order'] = this.playerOrder_;
    //map['position_order'] = this.positionOrder_;
  }

  /** 
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.log_('plan playerOrder...');
    //this.playerOrder_ = map['player_order'];
    //this.positionOrder_ = map['position_order'];
    this.log_('plan players...');
    //this.players_ = [...this.lineup.playerNames];
    this.log_('plan checking order...');

    // Cleanup any missing or malformed data.
    if (!this.checkOrder()) {
      this.log_('Malformed order');
      this.reset();
      return true;
    }
    this.log_('plan rendering...');
    this.calculator_.updatePlayers();
    this.calculator_.setupPositions();
    this.render();
    return true;
  }

  /**
   * Checks to see if playerOrder_ is well formed, returning true if it is.
   * @return {boolean}
   */
  checkOrder() {
    return true;
/*
    if (!this.playerOrder_ || !Array.isArray(this.playerOrder_) || 
        this.playerOrder_.length != 2) {
      return false;
    }
    // param {!Array<number>} order
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
    */
  }

  // Freshens player list while trying to avoid changing the position
  // of existing players, updating this.playerOrder_ to minimize
  // assignment changes if the number of players remains the same.
  freshenPlayers() {
    if (this.calculator_.updatePlayers() != 0) {
    }

    /*
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
      //type {!Map<string, number>}
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
    */
  }

  render() {
    this.thead_.innerHTML = '';
    this.tbody_.innerHTML = '';
    this.freshenPlayers();
    const numPositions = this.lineup.getNumPositions();
    const /** number */ numTableColumns = numPositions + 1;
    this.renderedAssignments_ = [];

/*
    // Pick a player ordering based on this.playerOrder_, which is
    // randomized during reset(), and tweaked by drag & drop.
    // Initially, players_[playerOrder_[half][N-1] will be goalie for
    // a half.  intereractively swap players later, with drag & drop,
    // to get the right goalies.
    const numFieldPositions = this.lineup.getNumPositions() - 1;
    if ((numFieldPositions <= 0) || (numFieldPlayers <= 0)) {
      return;
    }

    this.assignments_ = [];
*/
    let rowIndex = -1;

    /**
     * @param {!Element} parent
     * @param {string} text
     * @param {string} type
     * @return {!Element}
     */
    const addTextElement = (parent, text, type) => {
      if (type == 'tr') {
        ++rowIndex;
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
    //this.positionNames_ = [];
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
          //this.positionNames_.push(positionName);
        }
      }
    }

    // Subtract one to avoid a 1-second shift at end due to rounding error.
    let sec = 0;

    let /** ?Assignment */ prevAssignment = null;
    let firstRowOfHalf = true;
    let half = 0;
    /** @type {!Array<?Assignment>} */
    let subs = Array(numPositions).fill(null);

    /**
     * @param {!Assignment} assignment
     * @return {number}
     */
    const timeSec = (assignment) => Math.max(0, Math.ceil(assignment.timeSec));

    const renderRow = () => {
      /** @type {?Element} */
      let tr = null;
      let col = 0;
      for (const assignment of subs) {
        if (assignment) {
          if (!tr) {
            tr = addTextElement(this.tbody_, '', 'tr');
            const timeMs = 1000 * timeSec(assignment);
            addTextElement(tr, util.formatTime(timeMs), 'td');
            for (let i = 0; i < col; ++i) {
              addTextElement(tr, '', 'td');
            }
          }
          const element = addTextElement(tr, assignment.playerName, 'td');
          this.renderedAssignments_.push({
            element: element, 
            rowIndex: rowIndex - 1, 
            assignment: assignment,
          });
        } else if (tr) {
          addTextElement(tr, '', 'td');
        }
        ++col;
      }
      subs = Array(numPositions).fill(null);
    };

    this.startRows_ = [];
    const /** !Array<!Assignment> */ assignments = 
          this.calculator_.assignments();
    const halfSec = this.calculator_.minutesPerHalf * 60;
    for (let i = 0; i < assignments.length; ++i) {
      const /** !Assignment */ assignment = assignments[i];
      const assignmentTime = timeSec(assignment);
      if ((half == 0) && (assignmentTime >= halfSec)) {
        ++half;
        firstRowOfHalf = true;
        renderRow();
      }
      if (firstRowOfHalf) {
        const tr = addTextElement(this.tbody_, '', 'tr');
        //const playerOrder = this.playerOrder_[half];
        //const positionOrder = this.positionOrder_[half];
        const td = addTextElement(tr, '', 'td');
        td.className = 'plan-divider';
        td.setAttribute('colspan', numTableColumns);
        firstRowOfHalf = false;
        this.startRows_.push(rowIndex);
      }

      if ((prevAssignment == null) || 
          (timeSec(prevAssignment) != assignmentTime)) {
        renderRow();
      }
      const posIndex = this.calculator_.positionIndex(assignment.positionName);
      subs[posIndex] = assignment;
      prevAssignment = assignment;
    }
    renderRow();
  }

  // Assumptions: parents will not notify us whether kids are coming.  Kids
  // will arrive late or leave early. Kids will need to be subed out early
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
   * @return {?RenderedAssignment}
   */
  findRenderedAssignment(x, y) {
    for (const /** !RenderedAssignment */ renderedAssignment of 
         this.renderedAssignments_) {
      const bounds = renderedAssignment.element.getBoundingClientRect();
      if ((y >= bounds.top) && (y <= bounds.bottom)) {
        if ((x >= bounds.left) && (x <= bounds.right)) {
          return renderedAssignment;
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
    for (const assignment of this.renderedAssignments_) {
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
   * @param {!RenderedAssignment} renderedAssignment
   * @return {number}
   * @private
   */
  assignHalf_(renderedAssignment) {
    return this.calculator_.assignHalf(renderedAssignment.assignment);
  }

  /**
   * @param {!Event} event
   * @return {?{source: !DragSource, label: string}}
   */
  findDragSource(event) {
    const renderedAssignment = this.findRenderedAssignment(
      event.clientX, event.clientY);
    if (!renderedAssignment) {
      return null;
    }
    const assignment = renderedAssignment.assignment;
    const half = this.assignHalf_(renderedAssignment);
    const source = {
      playerName: assignment.playerName, 
      positionName: assignment.positionName, 
      half: half,
      row: renderedAssignment.rowIndex,
    };
    return {source: source, label: assignment.playerName};
  }

  /**
   * @param {!Event} event
   * @param {!DragSource} source
   * @return {?{target: !DragTarget, elements: !Array<!Element>}}
   */
  findDragTarget(event, source) {
    const x = event.clientX;
    const y = event.clientY;
    let renderedAssignment = this.findRenderedAssignment(x, y);
    let targetElements = {
      target: {playerName: '', rowIndex: -1, positionName: ''},
      elements: []
    };
    if (!renderedAssignment || 
        (this.assignHalf_(renderedAssignment) != source.half)) {
      // Keepers are not eligiable.
      if (source.positionName == Lineup.KEEPER) {
        return null;
      }

      // You can't adjust the time of the first assignment in the half.
      if (this.startRows_.indexOf(source.row) != -1) {
        return null;
      }

      const rowCol = this.findRowColumn(x, y);
      if (!rowCol) {
        return null;
      }
      const {row, column, element} = rowCol;
      console.log('col=' + column);
      if ((row == source.row) /*|| (column - 1 != source.positionIndex)*/) {
        return null;
      }

      // Now find the assignment that matches the row for this y-position.
      renderedAssignment = this.renderedAssignments_.find(
        (a) => (a.rowIndex == row) && 
          (a.assignment.positionName != Lineup.KEEPER));
      if (!renderedAssignment) {
        return null;
      }

      targetElements.target.rowIndex = row;
      targetElements.target.positionName = renderedAssignment.assignment.positionName;
      targetElements.elements.push(element);
      targetElements.elements.push(renderedAssignment.element);
    } else {
      for (const a of this.renderedAssignments_) {
        const aHalf = this.assignHalf_(a) ;
        if ((renderedAssignment.assignment.playerName == 
             a.assignment.playerName) &&
            (aHalf == source.half)) {
          targetElements.elements.push(renderedAssignment.element);
        }
      }
    }
    targetElements.target.playerName = renderedAssignment.assignment.playerName;
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
/*
    if (!target || (target.playerName == source.playerName)) {
      return;
    }
    if (target.positionName != '') {
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
*/
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
    const assignments = this.calculator_.assignments();
    const index = util.upperBound(
      assignments, 
      (assignment) => assignment.timeSec < currentTimeSec);
    if (index == -1) {
      return null;
    }
    return assignments[index];
  }
  
  /**
   * @return {!Array<!Assignment>}
   */
  initialAssignments() {
    this.calculator_.makeInitialAssignments();
    this.calculator_.computePlan();
    this.render();
    // save?

    /** @type {!Array<!Assignment>} */
    const initial = [];
    for (const a of this.renderedAssignments_) {
      if (a.rowIndex == this.startRows_[0]) {
        initial.push(a.assignment);
      }
    }
    return initial;
  }

  /**
   * @param {!Array<!Assignment>} assignments
   * @param {number} timeSec
   */
  executeAssignments(assignments, timeSec) {
    this.calculator_.executeAssignments(assignments, timeSec);
    this.calculator_.computePlan();
    this.render();
  }

  /**
   * @param {number} gameTimeSec
   */
  updateGameTime(gameTimeSec) {
    this.gameTimeSec_ = gameTimeSec;
    this.renderGameProgress_();
  }

  /** @private */
  renderGameProgress_() {
    const rect = this.tbody_.getBoundingClientRect();
    if ((this.gameTimeSec_ == 0) || !rect) {
      this.pastScrim_.style.display = 'hidden';
      return;
    }
    this.pastScrim_.style.left = '' + rect.left + 'px';
    this.pastScrim_.style.top = '' + rect.top + 'px';
    this.pastScrim_.style.width = '' + rect.width + 'px';
    const fullGameSec = 2 * this.calculator_.minutesPerHalf * 60;
    const height = (rect.height * this.gameTimeSec_ / fullGameSec);
    this.pastScrim_.style.height = '' + height + 'px';
    this.pastScrim_.style.display = 'block';
  }
}

exports = Plan;
