goog.module('soccersub.PlanCalculator');

const Assignment = goog.require('soccersub.Assignment2');
const Lineup = goog.require('soccersub.Lineup');
const util = goog.require('soccersub.util');

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
 * @typedef {!{
 *   percentInGame: number,
 *   benchTimeSec: number,
 * }}
 */
let PlayerTiming;

/**
 * @typedef {!Map<string, string>}
 */
let PositionToPlayerMap;

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

    /** private {!Map<number, !PositionToPlayerMap>} */
    this.pins_ = new Map();

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

    /** @private {number} */
    this.half_ = 0;

    /** @type {number} */
    this.minutesPerHalf = 24;

    /** @type {!Array<string>} */
    this.positionNames = [];

    /** @private {!Map<string, number>} */
    this.positionNameIndexMap_ = new Map();

    // private {!Map<string, number>}
    // this.playerTimeMap_ = new Map();
    
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

    // private {?string}
    //this.secondHalfKeeper_ = null;
  }

  /** @return {boolean} */
  sanityCheck() {
    let ret = true;
    let check = (a, msg) => {
      if (!a) {
        console.log(msg());
        ret = false;
      }
    };
    let checkEq = (a, b, msg) =>
        check(a == b, () => msg + ': ' + a + ' != ' + b);
    let checkLe = (a, b, msg) =>
        check(a <= b, () => msg + ': ' + a + ' != ' + b);
    checkLe(this.assignmentIndex_, this.assignments_.length, 
            'assignments vs index');
    checkLe(this.playerEventsMap_.size, this.playerPriorityMap_.size, 
            'player events vs priority');
    checkEq(this.positionNames.length, this.positionNameIndexMap_.size, 
            'positionNames');
    return ret;
  }

  /** @param {!Object} map */
  save(map) {
    map['plan_assignments'] = this.assignments_;
    map['plan_index'] = this.assignmentIndex_;
    //map['plan_pins'] = util.saveMap(this.pins_);
    map['plan_player_events'] = util.saveMap(this.playerEventsMap_);
    map['plan_position_names'] = util.saveMap(this.positionNameIndexMap_);
    map['plan_gametime'] = this.gameTimeSec_;
    map['plan_half'] = this.half_;
    map['plan_positions'] = this.positionNames;
    map['plan_position_players'] = util.saveMap(this.positionPlayerMap_);
    map['plan_priorities'] = util.saveMap(this.playerPriorityMap_);
    map['plan_shift_time_sec'] = this.shiftTimeSec_;
    map['plan_next_player_change_sec'] = this.nextPlayerChangeSec_;
  }

  /**
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.assignments_ = map['plan_assignments'];
    this.assignmentIndex_ = map['plan_index'];
    this.gameTimeSec_ = map['plan_gametime'];
    this.half_ = map['plan_half'];
    this.positionNames = map['plan_positions'];
    this.shiftTimeSec_ = map['plan_shift_time_sec'];
    this.nextPlayerChangeSec_ = map['plan_next_player_change_sec'];
    return (
      //util.restoreMap(map['plan_swaps'], this.swaps_) &&
      util.restoreMap(map['plan_player_events'], this.playerEventsMap_) &&
      util.restoreMap(map['plan_position_players'], this.positionPlayerMap_) &&
      util.restoreMap(map['plan_priorities'], this.playerPriorityMap_) &&
      util.restoreMap(map['plan_position_names'], this.positionNameIndexMap_)
    );
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
        if (!this.playerPriorityMap_.has(player)) {
          this.playerPriorityMap_.set(player, this.playerPriorityMap_.size + 1);
        }
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

  /** @return {!Array<!Assignment>} */
  assignments() {
    return this.assignments_;
  }

  /**
   * @param {string} playerName
   * @param {string} positionName
   * @return {!Assignment}
   */
  makeAssignment(playerName, positionName) {
    return {playerName: playerName, positionName: positionName, 
            timeSec: this.gameTimeSec_, executed: false, index: -1};
  }

  /** @return {number} */
  shiftTimeSec() {
    return this.shiftTimeSec_;
  }

  /** @private */
  computeShiftTime_() {
    const halfSec = this.minutesPerHalf * 60;
/*
    let endOfHalfSec = halfSec;
    if (this.gameTimeSec_ == halfSec) {
      endOfHalfSec += halfSec;
    }

    const timeLeftSec = endOfHalfSec - this.nextPlayerChangeSec_;
*/
    const numFieldPlayers = this.lineup_.playerNames.size - 1;
    this.shiftTimeSec_ = halfSec /*timeLeftSec*/ / numFieldPlayers;
/*
    const gameTimeSec = this.gameTimeSec_;
    if ((this.nextPlayerChangeSec_ <= gameTimeSec) || 
        (this.nextPlayerChangeSec_ > (gameTimeSec + this.shiftTimeSec_))) {
      this.nextPlayerChangeSec_  = gameTimeSec + this.shiftTimeSec_;
    }
*/
  }

  /**
   * @param {string} player
   * @param {number} timeSec
   * @return {!PlayerTiming}
   * @private
   */
  computeGameTiming_(player, timeSec) {
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
    if (timeSec != lastTimeSec) {
      accumulateTime(timeSec, EventType.UNAVAILABLE);
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
    const timing1 = this.computeGameTiming_(player1, this.gameTimeSec_);
    const timing2 = this.computeGameTiming_(player2, this.gameTimeSec_);
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
   * @return {!{type: EventType, assignment: ?Assignment}}
   */
  playerStatus(player) {
    let events = this.playerEventsMap_.get(player);
    if (!events || (events.length == 0)) {
      return {type: EventType.UNAVAILABLE, assignment: null};
    }
    const event = events[events.length - 1];
    return {type: event.type, assignment: event.assignment};
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
    const timing = this.computeGameTiming_(player, this.gameTimeSec_);
    let priority = (100 - timing.percentInGame) * 1e6;
    priority += timing.benchTimeSec * 100;
    priority += this.playerPriorityMap_.size - 
      this.playerPriorityMap_.get(player);
    return priority;
  }

  /**
   * Computes and returns a map of player names to how much time
   * they've spent in the game playing.
   * @return {!Map<string, !PlayerTiming>}
   */
  computeGameTimingForAllPlayers() {
    let map = new Map();
    const fullTimeSec = 2 * this.minutesPerHalf * 60;
    for (const player of this.lineup_.playerNames) {
      map.set(player, this.computeGameTiming_(player, fullTimeSec));
    }
    return map;
  }

  /** @return {?string} */
  pickNextFieldPosition() {
    // Determine which position has been in the longest, by iterating backward
    // through assignments, eliminating positions from the candidate list
    const positions = new Set(this.positionNames);
    positions.delete(Lineup.KEEPER);
    
    for (let i = this.assignments_.length - 1; i >= 0; --i) {
      const assignment = this.assignments_[i];
      positions.delete(assignment.positionName);
      if (positions.size == 1) {
        return Array.from(positions)[0];
      }
    }
    return null;
  }

  /**
   * @param {!Array<string>} positions
   * @param {?PositionToPlayerMap} positionToPinnedPlayerMap
   * @param {!Set<string>} pinnedPlayers
   * @return {!Array<string>}
   */
  pickNextPlayers(positions, positionToPinnedPlayerMap, pinnedPlayers) {
    const players = Array(positions.length).fill('');

    const isAvailable = (player) => {
      const status = this.playerStatus(player).type;
      return ((status == EventType.BENCH) && !pinnedPlayers.has(player));
    };

    // First see if any of the positions are pinned.
    let numAssigned = 0;
    if (positionToPinnedPlayerMap) {
      for (let i = 0; i < positions.length; ++i) {
        const pinnedPlayer = positionToPinnedPlayerMap.get(positions[i]);
        if (pinnedPlayer) {
          positionToPinnedPlayerMap.delete(positions[i]);
          if (!pinnedPlayers.has(pinnedPlayer)) {
            players[i] = pinnedPlayer;
            pinnedPlayers.add(pinnedPlayer);
            ++numAssigned;
          }
        }
      }
    }

    const pool = Array.from(this.lineup_.playerNames).filter(isAvailable);
    const needPlayers = positions.length - numAssigned;
    if ((needPlayers > 0) && (needPlayers < pool.length)) {
      util.sortTopN(pool, needPlayers, (player) => this.playerPriority(player));
    }
    for (let i = 0, poolIndex = 0; 
         (i < players.length) && (poolIndex < pool.length); ++i) {
      if (!players[i]) {
        players[i] = pool[poolIndex++];
      }
    }
    return players;
  }

  /**
   * @param {string} player
   * @return {?string}
   */
  playerPosition(player) {
    const events = this.playerEventsMap_.get(player);
    if (!events || (events.length == 0)) {
      return null;
    }
    const assignment = events[events.length - 1].assignment;
    if (!assignment) {
      return null;
    }
    return assignment.positionName;
  }

  // Clears the current schedule, rediscovering the set of players and positions from
  // the lineup.  Does not reset any pinned players.
  reset() {
    this.assignments_ = [];
    this.assignmentIndex_ = 0;
    this.playerEventsMap_.clear();
    this.gameTimeSec_ = 0;
    this.updatePlayers();
/*
    let positionToPlayerMap = this.pins_.get(0);
    const nextPlayers = this.pickNextPlayers(
      this.positionNames, positionToPlayerMap);
    const assignments = [];
    for (let i = 0; i < nextPlayers.length; ++i) {
      const player = nextPlayers[i];
      const position = this.positionNames[i];
      assignments.push(this.makeAssignment(player, position));
    }
    this.executeAssignments(assignments, 0);
*/
    this.gameTimeSec_ = 0;
    this.nextPlayerChangeSec_ = 0;
  }

  /**
   * Records an assignment, updating all the maps and the assignment array.
   * If the player being assigned was already in a position, the caller may
   * want to assign a new player.  The empty position is returned, or null
   * if the player was previously on the bench.
   *
   * @param {!Assignment} assignment
   * @return {?string}
   */
  addAssignment(assignment) {
    const previousPlayer = this.positionPlayerMap_.get(assignment.positionName);
    if (previousPlayer) {
      // In some cases, an old pin can result in an assignment of a player
      // to the position he/she's already in, so we can early-exit.
      if (previousPlayer == assignment.playerName) {
        return null;
      }
      this.playerEventsMap_.get(previousPlayer).push({
        type: EventType.BENCH,
        timeSec: assignment.timeSec,
        assignment: null,
      });
    }
    assignment.index = this.assignments_.length;
    this.assignments_.push(assignment);
    const previousPosition = this.playerPosition(assignment.playerName);
    if (previousPosition) {
      this.positionPlayerMap_.delete(previousPosition);
    }
    this.positionPlayerMap_.set(assignment.positionName, assignment.playerName);
    let events = this.playerEventsMap_.get(assignment.playerName);
    if (!events) {
      events = [];
      this.playerEventsMap_.set(assignment.playerName, events);
    }
    events.push({
      type: (assignment.positionName == Lineup.KEEPER) ? 
        EventType.KEEPER : EventType.FIELD,
      timeSec: assignment.timeSec,
      assignment: assignment,
    });
    return previousPosition;
  }

  /** 
   * @param {!Array<!Assignment>} assignments
   * @param {number} timeSec
   */
  executeAssignments(assignments, timeSec) {
    this.gameTimeSec_ = timeSec;

    // The first time we execute assignments, we'll just follow the plan up
    // until timeSec. Thereafter, executeAssignments must be called explicitly
    // as the assignments actually occur, because generally the timing in the
    // game will vary.
    let clearTimePredicate = (timeSec) => timeSec > this.gameTimeSec_;
    let clearTimeSec;
    if ((this.assignmentIndex_ == 0) && (timeSec > 0)) {
      for (let i = 0; i < this.assignments_.length; ++i) {
        const assignment = this.assignments_[i];
        if (assignment.timeSec > 0) {
          clearTimeSec = assignment.timeSec;
          clearTimePredicate = (timeSec) => timeSec >= clearTimeSec;
          this.assignmentIndex_ = i;
          break;
        } else {
          assignment.executed = true;
          this.positionPlayerMap_.set(assignment.positionName, 
                                      assignment.playerName);
        }
      }
    }

    this.clearAssignmentsAfter_(clearTimePredicate);
    for (const assignment of assignments) {
      assignment.executed = true;
      assignment.timeSec = timeSec;
      this.addAssignment(assignment);
      ++this.assignmentIndex_;
    }

    // If executed change more than 30 seconds early, probably due to an injury,
    // don't change the next player timing at all.
    while (this.nextPlayerChangeSec_ <= this.gameTimeSec_ + 30) {
      this.nextPlayerChangeSec_ += this.shiftTimeSec_;
    }
    // For late assignments we could move it forward, but punt for now.
    // this.nextPlayerChangeSec_ = timeSec + this.shiftTimeSec_;
    
    // TODO(jmarantz): special case being close to the end of the half or game.

/*
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
*/
  }

  setupPositions() {
    this.positionNames = [];
    for (const row of this.lineup_.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          //addTextElement(this.thead_, Lineup.abbrev(positionName), 'th');
          this.positionNameIndexMap_.set(positionName, 
                                         this.positionNames.length);
          this.positionNames.push(positionName);
        }
      }
    }
  }

  /**
   * @param {function(number):boolean} predicate
   * @private
   */
  clearAssignmentsAfter_(predicate) {
    // Override any existing plan for the future, because we are going to
    // recompute it. Any assignments already made are assumed to be correct.
    // We also have to iterate through the players and remove any future
    // events.
    if (this.assignmentIndex_ < this.assignments_.length) {
      this.assignments_.length = this.assignmentIndex_;
      this.playerEventsMap_.forEach((events, player) => {
        for (let i = 0; i < events.length; ++i) {
          const event = events[i];
          if (predicate(event.timeSec) ||
              (event.assignment && !event.assignment.executed)) {
            events.length = i;
            break;
          }
        }
      });
    }
    // Note: if we were to add a cache for player timing stats, it would need
    // to be invalidated here.
  }

  /**
     
   * @param {string} playerName
   * @param {string} positionName
   * @param {number} assignmentIndex
   * @param {number} timeSec
   */
  pinPlayerPosition(playerName, positionName, assignmentIndex, timeSec) {
    // We can swap initial assignments if the game hasn't started yet.  In this
    // case we will not be recomputing these assignments, so we do them directly.
    // We will also need to add them to the persisted map so if we start a new 
    // game, the assignment preferences are remembered.
    if ((assignmentIndex < this.assignmentIndex_) && (this.gameTimeSec_ > 0)) {
      console.log('attempted to do an initial swap after game started');
      return;
    }

    let /** ?PositionToPlayerMap */ positionPlayerMap = 
        this.pins_.get(timeSec);
    if (!positionPlayerMap) {
      positionPlayerMap = new Map();
      this.pins_.set(timeSec, positionPlayerMap);
    } else {
      // O(# positions) walk through existing positionPlayerMap at this time,
      // looking for other mappings for this player, which must be eliminated.
      for (const [position, player] of positionPlayerMap) {
        if (player == playerName) {
          positionPlayerMap.delete(position);
          break;     // There should be no other mappings for this player.
        }
      }
    }
    positionPlayerMap.set(positionName, playerName);

    if (assignmentIndex < this.assignmentIndex_) {
      this.reset();
    }
    this.computePlan();
  }

  /** 
   * @param {!Map<string, string>} positionToPinnedPlayerMap
   * @return {!Array<string>} 
   * @private
   */
  findPositionsToFill_(positionToPinnedPlayerMap) {
    // Figure out what positions to fill.
    if (this.gameTimeSec_ == 0) {
      return this.positionNames;
    }
    const positions = [];

    // Pick a new keeper at halftime.
    let numPlayersOnBench = 0;
    this.playerEventsMap_.forEach((events, player) => {
      if (this.playerStatus(player).type == EventType.BENCH) {
        ++numPlayersOnBench;
      }
    });

    const halfSec = this.minutesPerHalf * 60;
    let addedKeeper = false;
    if ((this.half_ == 0) && (Math.ceil(this.gameTimeSec_) >= halfSec)) {
      this.gameTimeSec_ = halfSec;
      this.half_ = 1;
      positions.push(Lineup.KEEPER);
      addedKeeper = true;
      --numPlayersOnBench;
    }

    if (positionToPinnedPlayerMap.size > 0) {
      for (const [position, player] of positionToPinnedPlayerMap) {
        if ((position != Lineup.KEEPER) || !addedKeeper) {
          positions.push(position);
        }
      }
    } else if (numPlayersOnBench >= 1) {
      const position = this.pickNextFieldPosition();
      if (position) {
        positions.push(position);
      } else {
        console.log('no positions defined at ' + this.gameTimeSec_ + 'sec');
      }
    }
    return positions;
  }
    
  computePlan() {
    this.computePlan_(false);
  }

  makeInitialAssignments() {
    this.computePlan_(true);
  }

  /** 
   * @param {boolean} initialOnly
   * @private
   */
  computePlan_(initialOnly) {
    this.clearAssignmentsAfter_((timeSec) => timeSec > this.gameTimeSec_);

    let half = 0;
    const halfSec = this.minutesPerHalf * 60;
    const gameSec = 2 * halfSec;
    const saveGameTime = this.gameTimeSec_;
    const saveHalf = this.half_;
    const savePositionPlayerMap = new Map(this.positionPlayerMap_);

    const /** PositionToPlayerMap */ positionToPinnedPlayerMap = new Map();
    const pinTimes = Array.from(this.pins_.keys()).sort();
    let pinIndex = 0;

    for (this.gameTimeSec_ = this.nextPlayerChangeSec_; 
         this.gameTimeSec_ < gameSec; 
         this.gameTimeSec_ += this.shiftTimeSec_) {
      for (; (pinIndex < pinTimes.length) &&  
           (pinTimes[pinIndex] <= this.gameTimeSec_); ++pinIndex) {
        for (const [position, player] of this.pins_.get(pinTimes[pinIndex])) {
          if (this.positionPlayerMap_.get(position) != player) {
            positionToPinnedPlayerMap.set(position, player);
          }
        }
      }

      let positions = this.findPositionsToFill_(positionToPinnedPlayerMap);

      const pinnedPlayers = new Set();
      let players = this.pickNextPlayers(
        positions, positionToPinnedPlayerMap, pinnedPlayers);
      if (players.length == 0) {
        console.log('not enough players');
        break;
      }

      for (let i = 0; i < players.length; ++i) {
/*
        let pinnedPlayer = positionToPinnedPlayerMap.get(positions[i]);
        if (pinnedPlayer) {
          const {type, assignment} = this.playerStatus(pinnedPlayer)
          switch (type) {
          case EventType.UNAVAILABLE:
            // If the pinned player is not currently an active player (eg sick), just
            // ignore the pin.  Leave the player pinned for when he recovers.
            break;
          case EventType.FIELD:
          case EventType.KEEPER:
            console.log('assigning player that is busy: ' + pinnedPlayer + ' at ' + 
                        this.gameTimeSec_);
            break;
          case EventType.BENCH:
            if (i + 1 < players.length) {
              players[i + 1] = players[i];
            }
            players[i] = pinnedPlayer;
            break;
          }
        }
*/

        const positionNeedingPlayer = 
              this.addAssignment(this.makeAssignment(players[i], positions[i]));
        if (positionNeedingPlayer) {
          const replacementPlayers = this.pickNextPlayers(
            [positionNeedingPlayer], positionToPinnedPlayerMap, pinnedPlayers);
          if (replacementPlayers.length) {
            positions.push(positionNeedingPlayer);
            players.push(replacementPlayers[0]);
          }
        }
      }
/*
      if (this.gameTimeSec_ == 0) {
        this.executeAssignments(assignments, 0);
      }
*/
      if (initialOnly) {
        break;
      }
    }

    // We have mutated some structures while computing the plan, but now restore
    // them to the current executed state.
    this.gameTimeSec_ = saveGameTime;
    this.half_ = saveHalf;
    this.positionPlayerMap_ = savePositionPlayerMap;
  }

  /**
   * @param {string} positionName
   * @return {number}
   */
  positionIndex(positionName) {
    const index = this.positionNameIndexMap_.get(positionName);
    if (index == null) {
      return -1;
    }
    return index;
  }

  /**
   * @param {!Assignment} assignment
   * @return {number}
   */
  assignHalf(assignment) {
    return (assignment.timeSec < this.minutesPerHalf * 60) ? 0 : 1;
  }

  /** @return {number} */
  gameTimeSec() {
    return this.gameTimeSec_;
  }
}

PlanCalculator.PlayerTiming = PlayerTiming;
exports = PlanCalculator;



/*
        // pick a new keeper.
        //if (this.secondHalfKeeper_) {
          //players = [this.secondHalfKeeper_];
        //} else {
          //this.secondHalfKeeper_ = players[0];
        //}
        //position = Lineup.KEEPER;

*/
