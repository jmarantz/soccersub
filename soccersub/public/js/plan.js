goog.module('soccersub.Plan');
const Drag = goog.require('soccersub.Drag');
const Lineup = goog.require('soccersub.Lineup');
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
 *   half: number,
 * }}
 */
let DragSource;

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
 *   playerIndex: number,
 *   positionIndex: number,
 *   element: !Element,
 *   timeSec: number,
 * }}
 */
let Assignment;

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
    /** @private {!Drag<DragSource, number>} */
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
  }

  // Resets the player-list from the lineup and randomizes.
  resetAndRender() {
    this.reset_();
    this.render();
  }

  /**
   * Resets the player-list from the lineup and randomizes.
   * @private
   */
  reset_() {
    this.players_ = [...this.lineup.playerNames];
    this.playerOrder_ = [[], []];
    for (let half = 0; half < 2; ++half) {
      this.playerOrder_[half] = [...Array(this.players_.length).keys()];
      util.shuffle(this.playerOrder_[half]);
    }
    this.save_();
  }

  /** @param {!Object} map */
  save(map) {
    if (!this.checkOrder()) {
      console.log('saving invalid playerOrder');
    }
    map['player_order'] = this.playerOrder_;
  }

  /** 
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.log_('plan playerOrder...');
    this.playerOrder_ = map['player_order'];
    this.log_('plan players...');
    this.players_ = [...this.lineup.playerNames];
    this.log_('plan checking order...');

    // Cleanup any missing or malformed data.
    if (!this.checkOrder()) {
      this.log_('Malformed order');
      this.reset_();
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
    const checkArray = (order) => {
      if (!Array.isArray(order) || (order.length != this.players_.length)) {
        return false;
      }
      // Make sure all the numbers are covered from [0:n-1].
      const covered = new Set();
      for (const index of order) {
        if ((typeof index != 'number') || (index < 0) || 
            (index >= this.players_.length) || (Math.floor(index) != index) ||
            covered.has(index)) {
          return false;
        }
        covered.add(index);
      }
      return true;
    };
    return checkArray(this.playerOrder_[0]) && checkArray(this.playerOrder_[1]);
  }

  // Freshens player list while trying to avoid changing the position
  // of existing players, updating this.playerOrder_ to minimize
  // assignment changes if the number of players remains the same.
  freshenPlayers() {
    // If the number of players changes, we just have to punt and recompute
    // everything.
    if (this.players_.length != this.lineup.getNumPlayers()) {
      console.log('player lengths different: resetting');
      this.reset_();
      return;
    }

    // If the player-list has not changed, we are done.
    if (this.players_.every((p, i) => this.lineup.playerNames.has(p))) {
      console.log('lineup didn\'t change: already fresh');
      return;
    }

    // Otherwise try to keep their order the same, even if the new players are
    // not in the same alpahbetical order as they were before.  The new players
    // swap in where the players they replaced were.
    for (let half = 0; half < 2; ++half) {
      /** @type {!Map<string, number>} */
      const indexMap = new Map();
      const freeIndexes = [];
      const order = this.playerOrder_[half];

      // Capture the existing index mappings, as well as the free indexes.
      for (let i = 0; i < this.players_.length; ++i) {
        const index = order[i];
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
      this.players_ = [...this.lineup.playerNames];
      for (let i = 0; i < this.players_.length; ++i) {
        order[i] = indexMap.get(this.players_[i]);
      }
    }
  }

  render() {
    this.thead_.innerHTML = '';
    this.tbody_.innerHTML = '';
    this.freshenPlayers();

    this.assignments_ = [];

    const addTextElement = (parent, text, type) => {
      const item = document.createElement(type);
      if (text) {
        item.textContent = text;
      }
      parent.appendChild(item);
      return item;
    };

    addTextElement(this.thead_, 'Time', 'th');

    // Put the abbreviated position names into the table head, in one row.
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
        }
      }
    }

    // Pick a player ordering based on this.playerOrder_, which is
    // randomized during reset(), and tweaked by drag & drop.
    // Initially, players_[playerOrder_[half][N-1] will be goalie for
    // a half.  intereractively swap players later, with drag & drop,
    // to get the right goalies.
    const numFieldPlayers = this.players_.length - 1;
    const numFieldPositions = this.lineup.getNumPositions() - 1;
    const shiftMinutes = this.minutesPerHalf / numFieldPlayers;
    const shiftSec = shiftMinutes * 60;

    // Subtract one to avoid a 1-second shift at end due to rounding error.
    const halfSec = 60 * this.minutesPerHalf;
    let sec = 0;

    let nextPosition = -1;
    let nextPlayer = 0;

    for (let half = 0; half < 2; ++half) {
      const order = this.playerOrder_[half];
      let firstRowOfHalf = true;
      const tr = addTextElement(this.tbody_, '', 'tr');
      const td = addTextElement(tr, '', 'td');
      td.className = 'plan-divider';
      td.setAttribute('colspan', numFieldPlayers + 2);

      for (let end = (1 + half) * halfSec - 1; sec < end; sec += shiftSec) {
        const tr = addTextElement(this.tbody_, '', 'tr');
        addTextElement(tr, util.formatTime(sec * 1000), 'td');
        const assign = (playerIndex, positionIndex) => {
          const playerName = this.players_[order[playerIndex]];
          this.assignments_.push({
            playerIndex: playerIndex,
            positionIndex: positionIndex,
            element: addTextElement(tr, playerName, 'td'),
            timeSec: sec,
          });
        };
        for (let i = 0; i < numFieldPositions; ++i) {
          if (firstRowOfHalf || (i == nextPosition)) {
            assign(nextPlayer, i);
            nextPlayer = (nextPlayer + 1) % numFieldPlayers;
          } else {
            addTextElement(tr, '', 'td');
          }
        }
        if (firstRowOfHalf) {
          assign(numFieldPlayers, numFieldPositions);  // Keeper
          firstRowOfHalf = false;
        }
        nextPosition = (nextPosition + 1) % numFieldPositions;
      }
    }
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
   * @param {number} x
   * @param {number} y
   * @return {?Assignment}
   */
  findAssignment(x, y) {
    for (const assignment of this.assignments_) {
      const bounds = assignment.element.getBoundingClientRect();
      if ((x >= bounds.left) && (x <= bounds.right) &&
          (y >= bounds.top) && (y <= bounds.bottom)) {
        return assignment;
      }
    }
    return null;
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
    const source = {playerIndex: assignment.playerIndex, half: half};
    const order = this.playerOrder_[half];
    const playerName = this.players_[order[source.playerIndex]];
    return {source: source, label: playerName};
  }

  /**
   * @param {!Event} event
   * @param {!DragSource} source
   * @return {?{target: number, elements: !Array<!Element>}}
   */
  findDragTarget(event, source) {
    const assignment = this.findAssignment(event.clientX, event.clientY);
    if (!assignment || (this.assignHalf_(assignment) != source.half)) {
      return null;
    }

    const target = {target: assignment.playerIndex, elements: []};
    for (const a of this.assignments_) {
      const aHalf = this.assignHalf_(a) ;
      if ((a.playerIndex == target.target) && (aHalf == source.half)) {
        target.elements.push(a.element);
      }
    }
    return target;
  }

  /**
   * @param {!DragSource} source
   * @param {?number} target
   * @private
   */
  drop_(source, target) {
    if (target != null) {
      const order = this.playerOrder_[source.half];
      const src = source.playerIndex;
      [order[src], order[target]] = [order[target], order[src]];
      this.render();
      this.save_();
    }
  }
}

exports = Plan;
