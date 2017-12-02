goog.module('soccersub.Plan');
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
    const thead = googDom.getRequiredElement('player-matrix-head');
    thead.innerHTML = '';
    const tbody = googDom.getRequiredElement('player-matrix-body');
    tbody.innerHTML = '';

    this.freshenPlayerList();

    const addTextElement = (parent, text, type) => {
      const item = document.createElement(type);
      item.textContent = text;
      parent.appendChild(item);
    };

    addTextElement(thead, 'Time', 'th');
    //addTextElement(thead, 'Time-', 'th');

    // Put the abbreviated position names into the table head, in one row.
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(thead, Lineup.abbrev(positionName), 'th');
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

    for (let sec = 0; sec < gameSec; sec += shiftSec) {
      if ((half == 0) && (sec >= halfSec)) {
        ++half;
        sec = halfSec + 1;
        const tr = document.createElement('tr');
        tbody.appendChild(tr);
        const td = document.createElement('td');
        tr.appendChild(td);
        td.className = 'plan-divider';
        td.setAttribute('colspan', numFieldPlayers + 2);
        swapKeepers();
      }

      const tr = document.createElement('tr');
      tbody.appendChild(tr);
      addTextElement(tr, util.formatTime(sec * 1000), 'td');
      for (let i = 0; i < numFieldPositions; ++i) {
        addTextElement(tr, assignments[i], 'td');
      }
      addTextElement(tr, keeper, 'td');
      assignments[positionToSwap] = this.players_[nextPlayer];
      positionToSwap = (positionToSwap + 1) % numFieldPositions;
      nextPlayer = (nextPlayer + 1) % numFieldPlayers;
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

}

exports = Plan;
