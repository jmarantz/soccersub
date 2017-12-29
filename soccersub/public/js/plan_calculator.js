goog.module('soccersub.PlanCalculator');

const Assignment = goog.require('soccersub.Assignment2');

/**
 * Holds a span of time when a player starts & stops being available.
 * Players that are currently available have -1 for their stopTime.
 *
 * @typedef {!{
 *   startTime: number,
 *   stopTime: number,
 * }}
 */
let AvailabilitySpan;

/**
 * @typedef {!Array<!AvailabilitySpan>}
 */
let Availability;

class PlanCalculator {
  /**
   * @param {!Lineup} lineup
   * @param {function()} save
   * @param {function(string)} log
   */
  constructor(lineup, save, log) {
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
     * @private {!Map<string, !Availability>}
     */
    this.playerAvailablityMap_ = new Map();

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
    this.shiftTimeSec = 0;

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
    for (const player of this.lineup.playerNames) {
      let availability = this.playerAvailablityMap_.get(player);
      if (!availability) {
        availability = [];
        this.playerAvailablityMap_.set(player, availability);

        // Players that come late get the lowest priority by default, so all
        // things being equal, when choosing the next player the ones that
        // came on time will go in first.  This can be overridden by the coach
        // in the UI via drag & drop.
        this.playerPriorityMap_.set(player, this.playerPriorityMap_.size + 1);
      }
      if ((availability.length == 0) ||
          (availability[availability.length - 1].stopTime != AVAILABLE)) {
        availability.push({startTime: this.gameTimeSec_, stopTime: AVAILABLE});
        ++playerDelta;
      }
    }

    // Find players that are no longer available.
    for (const [player, availability] of this.playerAvailablityMap_) {
      if (!this.lineup.playerNames.has(player) &&
          (availability[availability.length - 1].stopTime == AVAILABLE)) {
        --playerDelta;
        availability[availability.length - 1].stopTime = this.gameTimeSec_;
      }
    }
    return playerDelta;
  }

  computeShiftTime() {
    const halfSec = this.minutesPerHalf * 60;
    let endOfHalfSec = this.gameTimeSec_;
    if (endOfHalfSec >= halfSec) {
      endOfHalfSec -= halfSec;
    }

    const timeLeftSec = endOfHalfSec - this.nextPlayerChangeSec_;
    const numFieldPlayers = this.lineup.playerNames.size - 1;
    this.shiftTimeSec_ = timeLeftSec / numFieldPlayers;
  }

  /**
   */
  pickNextPlayer() {
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
        if ((nextAssignment.playerName_ == assignment.playerName_) &&
            (nextAssignment.positionName_ == assignment.positionName_)) {
          nextAssignment_.timeSec = assignment.timeSec;
          ++this.assignmentIndex_;
          continue;
        }
      }
      hasNewAssignment = true;
    }

    // However, if either the player or position is not what we recommended,
    // then our plan needs to be reconsidered in light of the unexpected
    // substitution.
    if (hasNewAssignment) {
      this.assignments_.length = this.assignmentIndex_;
      this.assignments_.push(assignment);
      this.computePlan();
    }
  }

  setupPositions() {
    this.positionNames_ = [];
    for (const row of this.lineup.getActivePositionNames()) {
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
    // We compute a plan by calcuating play-time based on the Player
    // objects, and then making "semi-fresh" decisions as to who goes
    // in when. "fresh" because new information may alter priority in
    // future assignments, e.g. to compensate for a delayed substition
    // or a change in plan vs execution as determined by the coach.
    // But "semi-" because there are some arbitrary decisions that may
    // have been overridden at the start of the game, say to contrive
    // to get a player into a particular position or get two players
    // that play well together in at the same time.  Examples of
    // arbitrary decisions we may want to remember are:
    //   1. Which starting player gets substituted first.
    //   2. Which non-starting player enters the game first.
    // Once the players have all rotated in, there are may be fewer
    // arbitrary decisions, because each player on the field entered
    // at a different time, unless multipe players are substituted at
    // once, which happens more in outdoor soccer than Futsal.

    const playerTimeMap = new Map();
    const positionAssignmentMap = new Map();
    for (const assignment of this.assignments_) {
      const prevAssignment = positionAssignmentMap.get(assignment.positionName);
      const deltaTimeSec = assignment.timeSec;
      if (prevAssignment) {
        deltaTimeSec -= prevAssignment.timeSec;
      }
      const currentTime = playerTimeMap.get(prevAssignment.playerName) || 0;
      playerTimeMap.set(prevAssignment.playerName, currentTime + deltaTime);
      positionAssignmentMap.set(assignment.position, assignment);
    }

    // Now we make assignments for the remainder of the game, aiming for
    // play-time equality.  It we are starting a new half, we just divide
    // time in half by the number of field players available (assuming keeper
    // does not sub).  Whene there is a player added (arrived late) or
    // removed (injury), we need to recompute the shift-time for the half
    // based on the current scenario.  That happens rarely so we'll have
    // an alternate path for when the player-count changes, and retain the
    // shift information.
  }

  /**
   * Copmutes the next assignment based on wwhat players have played so far, and
   * how long they've been out.
   *
   * @param {!Map<name, number>} playerTimeMap
   * @return {?Assignment}
   */
  computeNextAssignment(playerTimeMap) {
    // Which position do we assign?  The one with the player that's got
    // the most time.
    for (let i = 0; i < this.positionNames_.length; ++i) {
      if (
    }
  }

  compute() {
    // Tracks the amount of time a player has played in each half.  These all
    // map player names to time-in-game in seconds.
    const playerTimeInHalfSec = [new Map(), new Map()];
    const playerTimeInGameSec = new Map();

    // TODO(jmarantz): changes in formation mid-game should be possible, and
    // will be chalenging because there will be active and inactive positions.

    let half =  (this.gameTimeSec_ < this.minutesPerHalf) ? 0 : 1;
    let firstHalf, secondHalf;
    if (this.gameTime_ == 0) {
      this.makeInitialAssignmentsIfNeeded();
    } else {
      {firstHalf, secondHalf} = this.computePlayerTime();
    }

    const assignmentMatrix = this.fillAssignmentMatrix();
    let timeLeftInHalfSec = this.minutesPerHalf - this.gameTimeSec_;
    if (half == 1) {
      timeLeftInHalfSec += this.minutesPerHalf;
    }    
  }


  /**
   * Matrix of assignments.  Outer array is indexed by shifts, inner array
   * is indexed by positionIndex.
   *
   * @return {!Array<!Array<?Assignment>>}
   */
  fillAssignmentMatrix() {
    const assignmentMatrix = [];
    let previousAssignmentTimeSec = -1;
    let row = null;
    for (const assignment of this.assignments_) {
      if (assignment.timeSec != previousAssignmentTimeSec) {
        row = row ? row.slice() : Array(this.positionNames_.length).fill(null);
        assignmentMatrix.push(row);
        previousAssignmentTimeSec = assignment.timeSec;
      }
      const posIndex = this.positionNameIndexMap_.get(assignment.positionName);
      if (posIndex == null) {
        console.log('Invalid position: ' + assignment.positionName);
        debugger;
      } else {
        row[posIndex] = assignment;
       }
    }
    return assignmentMatrix;
  }

  /**
   * Computes maps of assigned playerTime in seconds for a half, combining any
   * time already played with projected time based on the current plan.
   *
   * @param {number} half
   * @return {!Map<string, number>}
   */
  computePlayerTime(half) {
    const firstHalfTime = new Map();
    const secondHalfTime = new Map();
    const playerTimeInHalfSec = [new Map(), new Map()];
    let half = 0;
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

  /**
   * @param {number} timeSec
   * @return {!Array</Player>}
   */
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

  /**
   * @param {!Assignment} assignment
   * @return {number}
   * @private
   */
  assignHalf_(assignment) {
    return (assignment.timeSec < this.minutesPerHalf * 60) ? 0 : 1;
  }
}
