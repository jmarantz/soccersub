goog.module('soccersub.PlanCalculator');

const Assignment = goog.require('soccersub.Assignment2');
const Lineup = goog.require('soccersub.Lineup');
const util = goog.require('soccersub.util');

const AVAILABLE = -1;

/**
 * @enum {string}
 */
const EventType = {
  UNAVAILABLE: 'unavailable',
  BENCH: 'bench',
  FIELD: 'field',
  KEEPER: 'keeper',
};

/**
 * @typedef {!{
 *   type: !EventType,
 *   timeSec: number,
 *   assignment: ?Assignment,
 * }}
 */
let PlayerEvent;

/**
 * @param {string} playerName
 * @param {string} positionName
 * @param {number} timeSec
 * @return {!Assignment}
 */
const makeAssignment = (playerName, positionName, timeSec) => {
  return {playerName, positionName, timeSec};
}

class PlanCalculator {
  /**
   * @param {!Lineup} lineup
   * @param {function()} save
   * @param {function(string)} log
   */
  constructor(lineup, save, log) {
    /** @private {!Lineup} */
    this.lineup_ = lineup;

    /**
     * Captures time-ordered assignments, both pending and future.
     * The boundary index between these is this.assignmentIndex_.
     *
     * @private {!Array<!Assignment>}
     */
    this.assignments_ = [];

    /** 
     * Index in assignments_ of the first assignment that hasn't been
     * executed yet.  Elements prior to this index are considered immutable
     * until game reset or time-rewind.
     * 
     * @private {number}
     */
    this.assignmentIndex_ = 0;

    /**
     * In order to meaningfully decide which people need the most playing
     * time, in a context where players may arrive after the game has started,
     * we need to know the sequence of their arrival.  E.g. if there are 8
     * players and 4 field positions, they should each play have the time.
     * But if one of them arrived midway through the half, he only gets to
     * be considered for the percentage of time based on the time he was
     * around and eligible to play.
     *
     * This also can account for keepers, where we don't consider
     * their time spent as keeper toward their field percentage.  Note
     * also that keepers can in theory come in and out of games
     * multiple times.  Whenever a keeper comes out, a new
     * availability-span is added.
     *
     * So this map tracks spans of times when players are eligible.
     *
     * @private {!Map<string, !Array<!PlayerEvent>>}
     */
    this.playerEventsMap_ = new Map();

    /** @private {number} */
    this.gameTimeSec_ = 0;

    /** @type {number} */
    this.minutesPerHalf = 24;

    /** @private {!Array<string>} */
    this.positionNames_ = [];

    /** @private {!Map<string, number>} */
    this.positionNameIndexMap_ = new Map();

    /** @private {!Map<string, number>} */
    this.playerTimeMap_ = new Map();
    
    /** @private {!Map<string, string>} */
    this.positionPlayerMap_ = new Map();
    
    /** 
     * The priority-map assigns priority indices to players. These are
     * used to resolve which player to choose when other factors (time
     * played so far, time waiting on bench) are equal. If we sub players
     * one at a time, this is usually relevant only at the start of each
     * half, when those numbers are equal.  But it can remain relevant
     * throughout the game when multiple players are substituted 
     * concurrently.
     *
     * @private {!Map<string, number>}
     */
    this.playerPriorityMap_ = new Map();

    /**
     * The model tries to give each player equal time. When starting a
     * new half, we just divide time in half by the number of field
     * players available (assuming keeper does not sub).  Whene there
     * is a player added (arrived late) or removed (injury), we need
     * to recompute the shift-time for the half based on the current
     * scenario.  That happens rarely so we'll have an alternate path
     * for when the player-count changes, and retain the shift
     * information.
     *
     * @private {number}
     */
    this.shiftTimeSec_ = 0;

    /** @private {number} */
    this.nextPlayerChangeSec_ = 0;
  }

  /**
   * Called whenever the lineup is updated.  This determines whether
   * the players are removed.  If the lineup has changed mid-shift, we
   * complete the current shift first, and the new shift-time is
   * applicable once the current shift completes.
   *
   * The change in the number of available players is returned.
   * @return {number}
   */
  updatePlayers() {
    let playerDelta = 0;

    // Find new players.
    for (const player of this.lineup_.playerNames) {
      let events = this.playerEventsMap_.get(player);
      if (!events) {
        events = [];
        this.playerEventsMap_.set(player, events);

        // Players that come late get the lowest priority by default, so all
        // things being equal, when choosing the next player the ones that
        // came on time will go in first.  This can be overridden by the coach
        // in the UI via drag & drop.
        this.playerPriorityMap_.set(player, this.playerPriorityMap_.size + 1);
      }
      const len = events.length;
      if ((len == 0) || (events[len - 1].type == EventType.UNAVAILABLE)) {
        events.push({type: EventType.BENCH, timeSec: this.gameTimeSec_,
                     assignment: null});
        ++playerDelta;
      }
    }

    // Find players that are no longer available.
    this.playerEventsMap_.forEach((events, player) => {
      if (!this.lineup_.playerNames.has(player) &&
          (events[events.length - 1].type != EventType.UNAVAILABLE)) {
        --playerDelta;
        events.push({type: EventType.UNAVAILABLE, 
                     timeSec: this.gameTimeSec_, assignment: null});
      }
    });
    this.computeShiftTime_();
    return playerDelta;
  }

  /** @return {number} */
  shiftTimeSec() {
    return this.shiftTimeSec_;
  }

  /** @private */
  computeShiftTime_() {
    const halfSec = this.minutesPerHalf * 60;
    let endOfHalfSec = halfSec;
    if (this.gameTimeSec_ == halfSec) {
      endOfHalfSec += halfSec;
    }

    const timeLeftSec = endOfHalfSec - this.nextPlayerChangeSec_;
    const numFieldPlayers = this.lineup_.playerNames.size - 1;
    this.shiftTimeSec_ = timeLeftSec / numFieldPlayers;
  }

  /**
   * @param {string} player
   * @return {!{percentInGame: number, benchTimeSec: number}}
   * @private
   */
  computeGameTiming_(player) {
    const events = this.playerEventsMap_.get(player);
    let percentInGame = 50;
    let benchTimeSec = 0;
    
    if (!events) {
      return {percentInGame, benchTimeSec};
    }
    let availableSec = 0;
    let fieldSec = 0;
    let startBenchTime = 0;
    let startAvailableTime = 0;
    let previousFieldTime = 0;
    let previousType = EventType.UNAVAILABLE;
    let lastTimeSec = 0;

    const sequence = (t1, t2) => {
      return t1 + ' -> ' + t2;
    }

    const accumulateTime = (timeSec, type) => {
      switch (sequence(previousType, type)) {
      case sequence(EventType.FIELD, EventType.UNAVAILABLE):
      case sequence(EventType.FIELD, EventType.KEEPER):
        fieldSec += timeSec - previousFieldTime;
        availableSec += timeSec - startAvailableTime;
        break;
      case sequence(EventType.FIELD, EventType.BENCH):
        fieldSec += timeSec - previousFieldTime;
        startBenchTime = timeSec;
        break;
      case sequence(EventType.BENCH, EventType.FIELD):
        previousFieldTime = timeSec;
        benchTimeSec += timeSec - startBenchTime;
        break;
      case sequence(EventType.BENCH, EventType.KEEPER):
      case sequence(EventType.BENCH, EventType.UNAVAILABLE):
        availableSec += timeSec - startAvailableTime;
        benchTimeSec += timeSec - startBenchTime;
        break;
      case sequence(EventType.UNAVAILABLE, EventType.FIELD):
      case sequence(EventType.KEEPER, EventType.FIELD):
        startAvailableTime = timeSec;
        previousFieldTime = timeSec;
        break;
      case sequence(EventType.UNAVAILABLE, EventType.BENCH):
      case sequence(EventType.KEEPER, EventType.BENCH):
        startAvailableTime = timeSec;
        startBenchTime = timeSec;
        break;
      }
    };

    for (const event of events) {
      if (previousType == event.type) {
        continue;
      }
      lastTimeSec = event.timeSec;
      accumulateTime(lastTimeSec, event.type);
      previousType = event.type;
    }
    if (this.gameTimeSec_ != lastTimeSec) {
      accumulateTime(this.gameTimeSec_, EventType.UNAVAILABLE);
    }

    if (availableSec == 0) {
      percentInGame = 50;
    } else {
      percentInGame = 100 * fieldSec / availableSec;
    }
    return {percentInGame, benchTimeSec};
  }

  /**
   * Eligible players are compared based on how long they've been in the
   * game, how long they've been waiting, and finally by an arbitrary priority
   * which can be adjusted.
   *
   * @param {string} player1
   * @param {string} player2
   * @return {boolean}
   */
  comparePlayers(player1, player2) {
    // TODO(jmarantz): cache these timings somehow.
    const timing1 = this.computeGameTiming_(player1);
    const timing2 = this.computeGameTiming_(player2);
    let cmp = timing1.percentInGame - timing2.percentInGame;
    if (cmp != 0) {
      return cmp < 0;
    }
    cmp = timing2.benchTimeSec - timing1.benchTimeSec;
    if (cmp != 0) {
      return cmp < 0;
    }
    cmp = this.playerPriorityMap_.get(player1) - 
      this.playerPriorityMap_.get(player2);
    if (cmp != 0) {
      return cmp < 0;         // this should cover all players.
    }
    return player1 < player2; // This should not be reachable.
  }

  /**
   * @param {string} player
   * @return {boolean}
   */
  playerIsAvailable(player) {
    let events = this.playerEventsMap_.get(player);
    return events && (events[events.length - 1].type == EventType.BENCH);
  }

  /**
   * Computes a numeric priority for a player.  This is is more natural to
   * express in relative terms (ie is player1 higher priority than player2)
   * but the PriorityQueue implementation does not allow for that.
   *
   * @param {string} player
   * @return {number}
   */
  playerPriority(player) {
    const timing = this.computeGameTiming_(player);
    let priority = timing.percentInGame * 1e6;
    priority += timing.benchTimeSec * 100;
    priority += this.playerPriorityMap_.size - 
      this.playerPriorityMap_.get(player);
    return priority;
  }

  /** @return {?string} */
  pickNextPosition() {
    // Determine which position has been in the longest, by iterating backward
    // through assignments, eliminating positions from the candidate list
    const positions = new Set(this.positionNames_);
    
    for (let i = this.assignments_.length - 1; i >= 0; --i) {
      const assignment = this.assignments_[i];
      positions.delete(assignent.positionName);
      if (positions.size == 1) {
        return Array.from(positions)[0];
      }
    }
    return null;
  }

  /**
   * @param {number} numPlayers
   * @return {!Array<string>}
   */
  pickNextPlayers(numPlayers) {
    const players = Array.from(this.lineup_.playerNames).filter(
      (player) => this.playerIsAvailable(player));
    if (numPlayers < players.length) {
      util.sortTopN(players, numPlayers, (player) => this.playerPriority(player));
    }
    players.length = Math.min(players.length, numPlayers);
    return players;
  }

  /**
   * @param {string} player
   * @return {?string}
   */
  playerPosition(player) {
    const events = this.playerEventsMap_.get(player);
    if (!events) {
      return null;
    }
    const assignment = events[events.length - 1].assignment;
    if (!assignment) {
      return null;
    }
    return assignment.positionName;
  }

  makeInitialAssignments() {
    const nextPlayers = this.pickNextPlayers(this.positionNames_.length);
    const assignments = [];
    for (let i = 0; i < nextPlayers.length; ++i) {
      const player = nextPlayers[i];
      const position = this.positionNames_[i];
      assignments.push(makeAssignment(player, position, this.gameTimeSec_));
    }
    this.nextPlayerChangeSec_ = this.shiftTimeSec_;
    this.executeAssignments(assignments);
  }

  /**
   * @param {!Assignment} assignment
   */
  addAssignment(assignment) {
    this.assignments_.push(assignment);
    const previousPlayer = this.positionPlayerMap_.get(assignment.positionName);
    if (previousPlayer) {
      this.playerEventsMap_.get(previousPlayer).push({
        type: EventType.BENCH,
        timeSec: this.gameTimeSec_,
        assignment: null,
      });
    }
    const previousPosition = this.playerPosition(assignment.playerName);
    if (previousPosition) {
      this.positionPlayerMap_.delete(previousPosition);
    }
    this.positionPlayerMap_.set(assignment.positionName, assignment.playerName);
    this.playerEventsMap_.get(assignment.playerName).push({
      type: (assignment.positionName == Lineup.KEEPER) ? 
        EventType.KEEPER : EventType.FIELD,
      timeSec: this.gameTimeSec_,
      assignment: assignment,
    });
  }

  /** @param {!Array<!Assignment>} assignments */
  executeAssignments(assignments) {
    let hasNewAssignment = false;
    for (const assignment of assignments) {
      // If the assignment being executed is the one planned, we just have
      // to correct the timing (which is likely off a little) and bump
      // up the assignment index.  No big changes are needed.
      if (this.assignmentIndex_ < this.assignments_.length) {
        const nextAssignment = this.assignments_[this.assignmentIndex_];
        if ((nextAssignment.playerName == assignment.playerName) &&
            (nextAssignment.positionName == assignment.positionName)) {
          nextAssignment.timeSec = assignment.timeSec;
          ++this.assignmentIndex_;
          continue;
        }
      }
      hasNewAssignment = true;
      this.addAssignment(assignment);
      ++this.assignmentIndex_;
    }

    // However, if either the player or position is not what we recommended,
    // then our plan needs to be reconsidered in light of the unexpected
    // substitution.
    if (hasNewAssignment) {
      this.assignments_.length = this.assignmentIndex_;
      this.computePlan();
    }
  }

  setupPositions() {
    this.positionNames_ = [];
    for (const row of this.lineup_.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          //addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
          this.positionNameIndexMap_.set(positionName, 
                                         this.positionNames_.length);
          this.positionNames_.push(positionName);
        }
      }
    }
  }

  computePlan() {
    // Override any existing plan for the future, because we are going to
    // recompute it. Any assignments already made are assumed to be correct.
    // We also have to iterate through the players and remove any future
    // events.
    this.assignments_.length = this.assignmentIndex_;
    this.playerEventsMap_.forEach((events, player) => {
      const index = util.upperBound(
        events, (event) => this.timeSec <= this.gameTimeSec_);
      if (index != -1) {
        events.length = index;
      }
    });
    // Note: if we were to add a cache for player timing stats, it would need
    // to be invalidated here.

    let half = 0;
    const halfSec = this.minutesPerHalf * 60;
    const gameSec = 2 * halfSec;
    for (let timeSec = this.nextPlayerChangeSec_; timeSec < gameSec; 
         timeSec += this.shiftTimeSec) {
      const players = this.pickNextPlayers(1);
      if (players.length != 1) {
        console.log('not enough players');
        return;
      }

      let position;
      if ((half == 0) && (timeSec >= halfSec)) {
        timeSec = halfSec;
        half = 1;
        // pick a new keeper.
        if (this.secondHalfKeeper_) {
          players = [this.secondHalfKeeper_];
        } else {
          this.secondHalfKeeper_ = players[0];
        }
        position = Lineup.KEEPER;
      } else {
        position = this.pickNextPosition();
      }
      this.addAssignment(makeAssignment(players[0], position, timeSec));
    }
  }

  /*
   * Computes maps of assigned playerTime in seconds for a half, combining any
   * time already played with projected time based on the current plan.
   *
   * param {number} half
   * return {!Map<string, number>}
   */
/*
  computePlayerTime(half) {
    const firstHalfTime = new Map();
    const secondHalfTime = new Map();
    const playerTimeInHalfSec = [new Map(), new Map()];
    const currentPlayerAtPosition = new Map();
    let timeSec = 0;
    let timeMap = firstHalfTime;
    for (const assignment of this.assignments_) {
      if (assignment.timeSec >= this.minutesPerHalf) {
        if (assignment.timeSec > this.minutesPerHalf) {
          console.log('all assignments should be reset at half');
        }
        half = 1;
        timeMap = secondHalfTime;
      }
      const prevAssignment = positionPlayerMap.get(assignment.positionName);
      const deltaTimeSec = assignment.timeSec;
      if (prevAssignment) {
        deltaTimeSec -= prevAssignment.timeSec;
      }
      const currentTime = timeMap.get(prevAssignment.playerName) || 0;
      timeMap.set(prevAssignment.playerName, currentTime + deltaTime);
      positionPlayerMap.set(assignment);
    }
    return {firstHalfTime, seocndHalfTime};
  }
*/

  /*
   * param {number} timeSec
   * return {!Array<?Player>}
   */
/*
  addRow(timeSec) {
    const assignments = Array(this.positionNames_.length).fill(null);
    this.assignmentMatrix_.push({timeSec, assignments});
  }

  makeInitialAssignmentsIfNeeded() {
    const initial = this.assignmentMatrix_.length ? this.assignmentMatrix_
          : this.addRow(0);
    for (let i = 0; i < this.positionNames_.length; ++i) {
      if (initial.length <= i) {
        initial.push(null);
      }
      if (initial[i] == null) {
        initial[i] = this.findNextPlayer();
      }
    }
  }
*/

  /**
   * @param {!Assignment} assignment
   * @return {number}
   * @private
   */
  assignHalf_(assignment) {
    return (assignment.timeSec < this.minutesPerHalf * 60) ? 0 : 1;
  }
}

exports = PlanCalculator;
